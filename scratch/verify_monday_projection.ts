import { DatabaseManager } from '../electron/database/db';
import { CalculationEngine } from '../src/modules/labor-forecast/services/calculationEngine';
import { SystemClock } from '../src/services/systemClock';
import { WeekRecord, AopPlanRecord } from '../src/types';

async function run() {
  console.log('=== TEST: Flash Forecast / Pre-closing Projection dla poniedziałku ===\n');

  const dbManager = DatabaseManager.getInstance();
  await dbManager.init();
  const db = dbManager.getDb();

  // Symulujemy czas systemowy: Poniedziałek, 14.09.2026 09:15
  SystemClock.setMockDate('2026-09-14T09:15:00');
  const clockNow = SystemClock.now();
  console.log(`🕒 Ustawiony czas systemowy: ${clockNow.timestamp} (${clockNow.dayOfWeekFull})\n`);

  // Pobierz dane dla Września 2026
  const year = 2026;
  const monthName = 'Wrzesień';
  const monthNum = 9;

  // 1. AOP Plan
  const planStmt = db.prepare('SELECT * FROM aop_plans WHERE year = ? AND month = ?');
  planStmt.bind([year, monthName]);
  planStmt.step();
  const aopPlan = planStmt.getAsObject() as unknown as AopPlanRecord;
  planStmt.free();

  // 2. Weeks
  const weeksStmt = db.prepare('SELECT * FROM calendar_weeks WHERE year = ? AND month_name = ? ORDER BY week_key ASC');
  weeksStmt.bind([year, monthName]);
  const weeks: WeekRecord[] = [];
  while (weeksStmt.step()) {
    weeks.push(weeksStmt.getAsObject() as unknown as WeekRecord);
  }
  weeksStmt.free();

  // 3. Actual Hours from MAPAL (unit 384)
  const pattern = `${year}_${monthName}_%`;
  const hoursStmt = db.prepare(`
    SELECT week_key, SUM(computable_time) as total_hours
    FROM labor_actuals_log
    WHERE week_key LIKE ?
      AND (unit_code = '384' OR unit_name LIKE '%108120%' OR unit_code IS NULL OR unit_code = '')
    GROUP BY week_key
  `);
  hoursStmt.bind([pattern]);
  const actualHoursMap: Record<string, number> = {};
  while (hoursStmt.step()) {
    const row = hoursStmt.getAsObject();
    actualHoursMap[String(row.week_key)] = Number(row.total_hours);
  }
  hoursStmt.free();

  // 4. Actual TRX & Scheduled Hours
  const trxStmt = db.prepare('SELECT week_key, actual_trx, scheduled_hours FROM weekly_actual_trx WHERE week_key LIKE ?');
  trxStmt.bind([pattern]);
  const weeklyTrxMap: Record<string, number> = {};
  const scheduledHoursMap: Record<string, number> = {};
  while (trxStmt.step()) {
    const row = trxStmt.getAsObject();
    if (row.actual_trx !== null) weeklyTrxMap[String(row.week_key)] = Number(row.actual_trx);
    if (row.scheduled_hours !== null) scheduledHoursMap[String(row.week_key)] = Number(row.scheduled_hours);
  }
  trxStmt.free();

  // 6. Manager shifts, definitions, employees
  const shiftsStmt = db.prepare('SELECT * FROM manager_schedule_shifts WHERE year = ? AND month = ?');
  shiftsStmt.bind([year, monthNum]);
  const managerShifts: any[] = [];
  while (shiftsStmt.step()) managerShifts.push(shiftsStmt.getAsObject());
  shiftsStmt.free();

  const defsStmt = db.prepare('SELECT * FROM shift_definitions');
  const shiftDefinitions: any[] = [];
  while (defsStmt.step()) shiftDefinitions.push(defsStmt.getAsObject());
  defsStmt.free();

  const empsStmt = db.prepare('SELECT * FROM manager_employees');
  const managerEmployees: any[] = [];
  while (empsStmt.step()) managerEmployees.push(empsStmt.getAsObject());
  empsStmt.free();

  console.log(`Dane wejściowe:`);
  console.log(`- Godziny rzeczywiste z bazy:`, actualHoursMap);
  console.log(`- Zaplanowane godziny (Grafik h):`, scheduledHoursMap);
  console.log(`- Liczba zmian menedżerów w miesiącu: ${managerShifts.length}`);

  // Uruchomienie CalculationEngine
  const summary = CalculationEngine.calculateMonth(
    aopPlan,
    weeks,
    weeklyTrxMap,
    actualHoursMap,
    scheduledHoursMap,
    null,
    [],
    [],
    [],
    managerShifts,
    shiftDefinitions,
    managerEmployees
  );

  console.log('\n--- WYNIKI PRZELICZENIA TYGODNI ---');
  for (const r of summary.rows) {
    console.log(`\n[${r.week.week_num_in_month}] ${r.week.date_from} – ${r.week.date_to} | Status: ${r.status} | isClosed: ${r.isClosed}`);
    console.log(`  Plan: ${r.planHours}h | Sched: ${r.scheduledHours ?? '—'}h | Act RCP: ${r.actualHours ?? '—'}h | HANW: ${r.hanwRecommendation ?? '—'}h`);
    if (r.isMondayProjected && r.mondayProjection) {
      const p = r.mondayProjection;
      console.log(`  🔮 FLASH MONDAY FORECAST AKTYWNY:`);
      console.log(`     • Data poniedziałku: ${p.date} (dzień ${p.dayOfMonth})`);
      console.log(`     • Zalogowano 6 dni (Wt-Nd): ${p.loggedHoursDays1to6}h`);
      console.log(`     • Kierownicy z Modułu 2: ${p.projectedMgrHours}h`);
      console.log(`     • Barisci (różnica celu): ${p.projectedBaristaHours}h`);
      console.log(`     • Estymacja poniedziałku łącznie: +${p.projectedTotalMondayHours}h`);
      console.log(`     • Prognoza całego tygodnia: ${p.fullWeekProjectedHours}h (cel tygodnia: ${p.targetWeekHours}h)`);
      console.log(`     • Transakcje: estymacja Pn: +${p.projectedMondayTrx} TRX, tydzień: ${p.fullWeekProjectedTrx} TRX (plan: ${p.planTrx})`);
    }
  }

  console.log('\n--- PODSUMOWANIE MIESIĘCZNE MTD ---');
  console.log(`Actual Hours MTD: ${summary.actualHoursMtd}h`);
  console.log(`Plan TRX MTD: ${summary.planTrxMtd} | Actual TRX MTD: ${summary.actualTrxMtd}`);
  console.log(`Trend Velocity MTD: ${(summary.trendVelocityMtd * 100).toFixed(1)}%`);
  console.log(`Earned Labor Budget: ${summary.earnedLaborBudget}h (plan: ${summary.planHoursTotal}h, delta: ${summary.deltaEarnedHours}h)`);
  console.log(`Remaining Budget: ${summary.remainingHoursBudget}h`);

  const w4 = summary.rows.find(r => r.week.week_num_in_month === 'W4');
  console.log(`\n🎯 Rekomendacja HANW dla W4 (docelowy tydzień planowania): ${w4?.hanwRecommendation}h (Floor: ${w4?.week.floor_hours}h)`);

  // Weryfikacja asercji logicznych
  const w2 = summary.rows.find(r => r.week.week_num_in_month === 'W2');
  if (!w2?.isMondayProjected) {
    throw new Error('FAIL: W2 powinien mieć aktywny isMondayProjected!');
  }
  if (!w2?.isClosed) {
    throw new Error('FAIL: W2 powinien być isClosed === true dla celów MTD!');
  }
  if (w2?.status !== 'current') {
    throw new Error(`FAIL: Status W2 powinien być 'current', a jest '${w2?.status}'!`);
  }
  if (w4?.status !== 'target_planning') {
    throw new Error(`FAIL: Status W4 powinien być 'target_planning', a jest '${w4?.status}'!`);
  }
  if (!w4?.hanwRecommendation || w4.hanwRecommendation <= 0) {
    throw new Error(`FAIL: HANW dla W4 powinno być dodatnią liczbą godzin, a jest '${w4?.hanwRecommendation}'!`);
  }

  console.log('\n✅ WSZYSTKIE ASERCJE DLA PONIEDZIAŁKU PRZESZŁY POMYŚLNIE!');

  // Test symulacji wtorku (kiedy poniedziałek minął i zaimportowano dane)
  SystemClock.setMockDate('2026-09-15T08:00:00');
  const tuesdaySummary = CalculationEngine.calculateMonth(
    aopPlan,
    weeks,
    weeklyTrxMap,
    actualHoursMap,
    scheduledHoursMap,
    null,
    [],
    [],
    [],
    managerShifts,
    shiftDefinitions,
    managerEmployees
  );
  const w2Tuesday = tuesdaySummary.rows.find(r => r.week.week_num_in_month === 'W2');
  console.log(`\n🕒 Test po przejściu na wtorek 15.09:`);
  console.log(`   W2 status: ${w2Tuesday?.status} | isMondayProjected: ${w2Tuesday?.isMondayProjected ?? false}`);
  const w3Tuesday = tuesdaySummary.rows.find(r => r.week.week_num_in_month === 'W3');
  console.log(`   W3 status: ${w3Tuesday?.status}`);
  const w5Tuesday = tuesdaySummary.rows.find(r => r.week.week_num_in_month === 'W5');
  console.log(`   W5 status: ${w5Tuesday?.status}`);

  if (w2Tuesday?.isMondayProjected) {
    throw new Error('FAIL: We wtorek isMondayProjected powinno być false!');
  }
  if (w2Tuesday?.status !== 'closed') {
    throw new Error(`FAIL: We wtorek status W2 powinien być 'closed', a jest '${w2Tuesday?.status}'!`);
  }
  if (w3Tuesday?.status !== 'current') {
    throw new Error(`FAIL: We wtorek status W3 powinien być 'current', a jest '${w3Tuesday?.status}'!`);
  }

  SystemClock.resetMockDate();
  console.log('\n🎉 TEST AUTOMATYCZNEGO PRZEJŚCIA WE WTOREK ZAKOŃCZONY SUKCESEM!');
}

run().catch(err => {
  console.error('BŁĄD TESTU:', err);
  process.exit(1);
});
