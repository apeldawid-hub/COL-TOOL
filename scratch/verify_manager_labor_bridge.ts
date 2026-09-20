import { CalculationEngine } from '../src/modules/labor-forecast/services/calculationEngine';
import {
  AopPlanRecord,
  WeekRecord,
  NcRuleRecord,
  ManagerScheduleShift,
  ShiftDefinition,
  ManagerEmployee
} from '../src/types';

console.log('=== TEST 1: Weryfikacja powiązania Moduł 2 ➔ Moduł 1 (Manager Labor Bridge) ===');

const mockPlan: AopPlanRecord = {
  key: '2026_Wrzesień',
  year: 2026,
  month: 'Wrzesień',
  month_code: 'M09',
  weeks_count: 5,
  plan_trx: 10830,
  target_tplh: 6.7,
  labor_budget: 1616.4,
  avg_weekly_hours: 323.3,
};

const mockWeeks: WeekRecord[] = [
  {
    week_key: '2026_Wrzesień_W1',
    year: 2026,
    month_name: 'Wrzesień',
    week_num_in_month: 'W1',
    days_count: 7,
    week_type: 'Pełny (7 dni)',
    date_from: '01.09',
    date_to: '07.09',
    floor_hours: 272.0,
    day_weight: 0.23333,
  },
  {
    week_key: '2026_Wrzesień_W2',
    year: 2026,
    month_name: 'Wrzesień',
    week_num_in_month: 'W2',
    days_count: 7,
    week_type: 'Pełny (7 dni)',
    date_from: '08.09',
    date_to: '14.09',
    floor_hours: 272.0,
    day_weight: 0.23333,
  }
];

const mockNcRules: NcRuleRecord[] = [
  { id: 1, name: 'Administracja SM', default_weekly_hours: 8, monthly_hours: 32, is_fixed: true, is_active: true }
];

const mockEmployees: ManagerEmployee[] = [
  { id: 1, name: 'Dawid Szeluga', role: 'SM', contract_hours_ratio: 1.0, sort_order: 1, is_active: true },
  { id: 2, name: 'Dawid Apel', role: 'ASM', contract_hours_ratio: 1.0, sort_order: 2, is_active: true },
  { id: 3, name: 'Kamil Kamiński', role: 'SSV', contract_hours_ratio: 1.0, sort_order: 3, is_active: true }
];

const mockShiftDefs: ShiftDefinition[] = [
  { code: 'AM', name: 'Opening', hours: 8.0, category: 'work', is_nc: false, is_absence: false },
  { code: 'PM', name: 'Closing', hours: 8.0, category: 'work', is_nc: false, is_absence: false },
  { code: 'NC', name: 'Non-Coverage SM', hours: 8.0, category: 'nc', is_nc: true, is_absence: false },
  { code: 'SAM', name: 'Support AM inna kawiarnia', hours: 8.0, category: 'work', is_nc: false, is_absence: false },
  { code: 'OFF', name: 'Wolne', hours: 0.0, category: 'off', is_nc: false, is_absence: false },
  { code: 'L4', name: 'Zwolnienie', hours: 8.0, category: 'absence', is_nc: false, is_absence: true }
];

// Dni 1..7 (W1):
// Dzień 1 (Wt): Dawid S. ma AM (8h), Dawid A. ma PM (8h) -> Coverage: 16h, Floor deficit: 16h, hasAm: true, hasPm: true
// Dzień 2 (Śr): Dawid S. ma NC (8h), Kamil K. ma PM (8h) -> Coverage: 8h, NC: 8h, Floor deficit: 24h, hasAm: false, hasPm: true (Luka AM!)
// Dzień 3 (Czw): Dawid A. ma SAM (Support w innej kawiarni, 8h) -> Powinien być ZIGNOROWANY w Janki (Coverage: 0h)
// Dzień 4 (Pt): Dawid S. ma L4 (8h) -> Powinno być ZIGNOROWANE w Janki (Coverage: 0h)
const mockShifts: ManagerScheduleShift[] = [
  { id: 1, employee_id: 1, year: 2026, month: 9, day: 1, date: '2026-09-01', shift_code: 'AM', hours: 8.0 },
  { id: 2, employee_id: 2, year: 2026, month: 9, day: 1, date: '2026-09-01', shift_code: 'PM', hours: 8.0 },
  { id: 3, employee_id: 1, year: 2026, month: 9, day: 2, date: '2026-09-02', shift_code: 'NC', hours: 8.0 },
  { id: 4, employee_id: 3, year: 2026, month: 9, day: 2, date: '2026-09-02', shift_code: 'PM', hours: 8.0 },
  { id: 5, employee_id: 2, year: 2026, month: 9, day: 3, date: '2026-09-03', shift_code: 'SAM', hours: 8.0 },
  { id: 6, employee_id: 1, year: 2026, month: 9, day: 4, date: '2026-09-04', shift_code: 'L4', hours: 8.0 }
];

const scheduledMap = {
  '2026_Wrzesień_W1': 320.0
};

const summary = CalculationEngine.calculateMonth(
  mockPlan,
  mockWeeks,
  {},
  {},
  scheduledMap,
  null,
  [],
  mockNcRules,
  [],
  mockShifts,
  mockShiftDefs,
  mockEmployees
);

const w1 = summary.rows.find(r => r.week.week_key === '2026_Wrzesień_W1');
if (!w1) throw new Error('Nie znaleziono wiersza W1');

console.log('--- Wyniki dla Tygodnia W1 ---');
console.log('Manager Coverage Hours:', w1.managerCoverageHours); // Oczekiwano: 16 (D1) + 8 (D2) = 24h
console.log('Manager NC Hours:', w1.managerNcHours);             // Oczekiwano: 8h (D2)
console.log('Manager Total Hours:', w1.managerHours);           // Oczekiwano: 32h (24 + 8)
console.log('Barista Hours Pool:', w1.baristaHoursPool);        // Oczekiwano: planHours (377.2) - 32 = 345.2h
console.log('Barista Scheduled Hours:', w1.baristaScheduledHours); // Oczekiwano: 320 - 32 = 288h

if (w1.managerCoverageHours !== 24.0) {
  throw new Error(`Błąd: w1.managerCoverageHours = ${w1.managerCoverageHours}, oczekiwano 24.0`);
}
if (w1.managerNcHours !== 8.0) {
  throw new Error(`Błąd: w1.managerNcHours = ${w1.managerNcHours}, oczekiwano 8.0`);
}
if (w1.managerHours !== 32.0) {
  throw new Error(`Błąd: w1.managerHours = ${w1.managerHours}, oczekiwano 32.0`);
}
if (w1.baristaScheduledHours !== 288.0) {
  throw new Error(`Błąd: w1.baristaScheduledHours = ${w1.baristaScheduledHours}, oczekiwano 288.0`);
}
console.log('✅ Weryfikacja tygodnia W1 zakończona sukcesem!');

console.log('\n--- Dobowy Rozkład Dni w W1 ---');
const day1 = w1.managerDailyCoverage?.find(d => d.day === 1);
const day2 = w1.managerDailyCoverage?.find(d => d.day === 2);
const day3 = w1.managerDailyCoverage?.find(d => d.day === 3);

console.log('Dzień 1 (AM + PM):', { hasAm: day1?.hasAm, hasPm: day1?.hasPm, cov: day1?.coverageHours, deficit: day1?.floorDeficit });
console.log('Dzień 2 (NC + PM):', { hasAm: day2?.hasAm, hasPm: day2?.hasPm, cov: day2?.coverageHours, nc: day2?.ncHours, deficit: day2?.floorDeficit });
console.log('Dzień 3 (SAM - inna kawiarnia):', { cov: day3?.coverageHours });

if (!day1?.hasAm || !day1?.hasPm || day1.coverageHours !== 16.0 || day1.floorDeficit !== 16.0) {
  throw new Error('Błąd weryfikacji Dnia 1');
}
if (day2?.hasAm || !day2?.hasPm || day2.coverageHours !== 8.0 || day2.ncHours !== 8.0 || day2.floorDeficit !== 24.0) {
  throw new Error('Błąd weryfikacji Dnia 2');
}
if (day3?.coverageHours !== 0.0) {
  throw new Error('Błąd: Zmiana SAM nie została wykluczona z kawiarni Janki');
}
console.log('✅ Dobowy rozkład i wykluczenie wsparć SAM działa bezbłędnie!');

console.log('\n--- Podsumowanie Miesiąca ---');
console.log('Total MGR Hours Month:', summary.totalManagerHoursMonth);
console.log('Total Barista Pool Month:', summary.totalBaristaPoolMonth);
console.log('NC Planned vs Budget:', summary.ncPlannedVsBudget);
console.log('Coverage Gaps Month Count:', summary.coverageGapsMonthCount);

if (summary.totalManagerHoursMonth !== 32.0) {
  throw new Error(`Błąd summary.totalManagerHoursMonth = ${summary.totalManagerHoursMonth}`);
}
if (summary.ncPlannedVsBudget?.plannedNcHours !== 8.0 || summary.ncPlannedVsBudget?.budgetNcHours !== 32.0) {
  throw new Error('Błąd weryfikacji ncPlannedVsBudget');
}
console.log('✅ Podsumowanie miesiąca i rozliczenie NC działa bezbłędnie!');

console.log('\n🎉 Wszystkie testy powiązania Moduł 2 ➔ Moduł 1 zakończone sukcesem!');
