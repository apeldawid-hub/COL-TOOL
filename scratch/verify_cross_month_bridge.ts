import { CalculationEngine } from '../src/modules/labor-forecast/services/calculationEngine';
import {
  AopPlanRecord,
  WeekRecord,
  NcRuleRecord,
  ManagerScheduleShift,
  ShiftDefinition,
  ManagerEmployee,
} from '../src/types';

console.log('=== TEST: Weryfikacja Obsługi Pełnego Cyklu Przełomów Miesięcy (Split-Week Cross-Month Bridge) ===\n');

// 1. Definicje pracowników i zmian
const mockEmployees: ManagerEmployee[] = [
  { id: 1, name: 'Dawid Szeluga', role: 'SM', contract_hours_ratio: 1.0, sort_order: 1, is_active: true },
  { id: 2, name: 'Dawid Apel', role: 'ASM', contract_hours_ratio: 1.0, sort_order: 2, is_active: true },
  { id: 3, name: 'Kamil Kamiński', role: 'SSV', contract_hours_ratio: 1.0, sort_order: 3, is_active: true },
];

const mockShiftDefs: ShiftDefinition[] = [
  { code: 'AM', name: 'Opening', hours: 8.0, category: 'work', is_nc: false, is_absence: false },
  { code: 'PM', name: 'Closing', hours: 8.0, category: 'work', is_nc: false, is_absence: false },
  { code: 'NC', name: 'Non-Coverage SM', hours: 8.0, category: 'nc', is_nc: true, is_absence: false },
  { code: 'OFF', name: 'Wolne', hours: 0.0, category: 'off', is_nc: false, is_absence: false },
];

// 2. Mock planu AOP i tygodni dla Września 2026 (W5 ma 2 dni: 29.09 – 30.09)
const mockPlanSept: AopPlanRecord = {
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

const mockWeeksSept: WeekRecord[] = [
  {
    week_key: '2026_Wrzesień_W5',
    year: 2026,
    month_name: 'Wrzesień',
    week_num_in_month: 'W5',
    days_count: 2,
    week_type: 'Niepełny (2 dni)',
    date_from: '29.09',
    date_to: '30.09',
    floor_hours: 64.0, // 2 dni x 32h = 64h
    day_weight: 0.06667,
  },
];

// 3. Mock planu AOP i tygodni dla Października 2026 (W1 ma 5 dni: 01.10 – 05.10)
const mockPlanOct: AopPlanRecord = {
  key: '2026_Październik',
  year: 2026,
  month: 'Październik',
  month_code: 'M10',
  weeks_count: 5,
  plan_trx: 11200,
  target_tplh: 6.7,
  labor_budget: 1671.6,
  avg_weekly_hours: 334.3,
};

const mockWeeksOct: WeekRecord[] = [
  {
    week_key: '2026_Październik_W1',
    year: 2026,
    month_name: 'Październik',
    week_num_in_month: 'W1',
    days_count: 5,
    week_type: 'Niepełny (5 dni)',
    date_from: '01.10',
    date_to: '05.10',
    floor_hours: 208.0, // 5 dni x 32h = 160h lub wg bazy 208h (zależy od weekendu)
    day_weight: 0.16667,
  },
];

// 4. Zmiany menedżerów na styku miesięcy:
// Część Wrzesień (29.09 - Wt, 30.09 - Śr):
// Dzień 29.09: Dawid S. AM (8h), Dawid A. PM (8h) -> Cov: 16h, AM: true, PM: true
// Dzień 30.09: Kamil K. AM (8h) -> Cov: 8h, AM: true, PM: false (Luka PM!)
//
// Część Październik (01.10 - Czw, 02.10 - Pt, 03.10 - Sob, 04.10 - Nd, 05.10 - Pn):
// Dzień 01.10: Dawid S. AM (8h), Dawid A. PM (8h) -> Cov: 16h
// Dzień 02.10: Dawid A. PM (8h) -> Cov: 8h, AM: false (Luka AM!)
// Dzień 03.10: Kamil K. AM (8h), Dawid S. PM (8h) -> Cov: 16h
// Dzień 04.10: Dawid S. AM (8h), Kamil K. PM (8h) -> Cov: 16h
// Dzień 05.10: Dawid A. AM (8h), Kamil K. PM (8h) -> Cov: 16h
const mockShifts: ManagerScheduleShift[] = [
  // Wrzesień (month = 9)
  { id: 1, employee_id: 1, year: 2026, month: 9, day: 29, date: '2026-09-29', shift_code: 'AM', hours: 8.0 },
  { id: 2, employee_id: 2, year: 2026, month: 9, day: 29, date: '2026-09-29', shift_code: 'PM', hours: 8.0 },
  { id: 3, employee_id: 3, year: 2026, month: 9, day: 30, date: '2026-09-30', shift_code: 'AM', hours: 8.0 },

  // Październik (month = 10)
  { id: 4, employee_id: 1, year: 2026, month: 10, day: 1, date: '2026-10-01', shift_code: 'AM', hours: 8.0 },
  { id: 5, employee_id: 2, year: 2026, month: 10, day: 1, date: '2026-10-01', shift_code: 'PM', hours: 8.0 },
  { id: 6, employee_id: 2, year: 2026, month: 10, day: 2, date: '2026-10-02', shift_code: 'PM', hours: 8.0 },
  { id: 7, employee_id: 3, year: 2026, month: 10, day: 3, date: '2026-10-03', shift_code: 'AM', hours: 8.0 },
  { id: 8, employee_id: 1, year: 2026, month: 10, day: 3, date: '2026-10-03', shift_code: 'PM', hours: 8.0 },
  { id: 9, employee_id: 1, year: 2026, month: 10, day: 4, date: '2026-10-04', shift_code: 'AM', hours: 8.0 },
  { id: 10, employee_id: 3, year: 2026, month: 10, day: 4, date: '2026-10-04', shift_code: 'PM', hours: 8.0 },
  { id: 11, employee_id: 2, year: 2026, month: 10, day: 5, date: '2026-10-05', shift_code: 'AM', hours: 8.0 },
  { id: 12, employee_id: 3, year: 2026, month: 10, day: 5, date: '2026-10-05', shift_code: 'PM', hours: 8.0 },
];

console.log('--- TEST 1: Trailing Bridge (Wrzesień W5 ➔ Październik W1) ---');
const summarySept = CalculationEngine.calculateMonth(
  mockPlanSept,
  mockWeeksSept,
  {},
  {},
  {},
  null,
  [],
  [],
  [],
  mockShifts,
  mockShiftDefs,
  mockEmployees
);

const bridgeSept = summarySept.crossMonthBridge;
if (!bridgeSept) throw new Error('BŁĄD: crossMonthBridge dla Września W5 nie został wygenerowany!');

console.log('Bridge Type:', bridgeSept.bridgeType); // trailing
console.log('Combined Date Range:', bridgeSept.combinedDateRange); // 29.09 – 05.10
console.log('Part Current Month:', bridgeSept.partCurrentMonth.monthName, bridgeSept.partCurrentMonth.dates, `(${bridgeSept.partCurrentMonth.daysCount} dni)`);
console.log('Part Current MGR Hours:', bridgeSept.partCurrentMonth.managerHours, 'h'); // Oczekiwano: 16 (D29) + 8 (D30) = 24h
console.log('Part Adjacent Month:', bridgeSept.partAdjacentMonth.monthName, bridgeSept.partAdjacentMonth.dates, `(${bridgeSept.partAdjacentMonth.daysCount} dni)`);
console.log('Part Adjacent MGR Hours:', bridgeSept.partAdjacentMonth.managerHours, 'h'); // Oczekiwano: 16 + 8 + 16 + 16 + 16 = 72h
console.log('Total Combined MGR Hours:', bridgeSept.totalCombinedManagerHours, 'h'); // 24 + 72 = 96h
console.log('Total Combined Barista Pool:', bridgeSept.totalCombinedBaristaPool, 'h'); // 272 - 96 = 176h
console.log('Liczba dni w all7DaysCoverage:', bridgeSept.all7DaysCoverage?.length); // 7
console.log('Luki AM/PM na 7 dni:', { missingAm: bridgeSept.missingAmTotal, missingPm: bridgeSept.missingPmTotal });

if (bridgeSept.bridgeType !== 'trailing') throw new Error(`Oczekiwano bridgeType trailing, otrzymano ${bridgeSept.bridgeType}`);
if (bridgeSept.combinedDateRange !== '29.09 – 05.10') throw new Error(`Błędny zakres: ${bridgeSept.combinedDateRange}`);
if (bridgeSept.partCurrentMonth.managerHours !== 24.0) throw new Error(`Błędne godziny partCurrentMonth: ${bridgeSept.partCurrentMonth.managerHours}`);
if (bridgeSept.partAdjacentMonth.managerHours !== 72.0) throw new Error(`Błędne godziny partAdjacentMonth: ${bridgeSept.partAdjacentMonth.managerHours}`);
if (bridgeSept.totalCombinedManagerHours !== 96.0) throw new Error(`Błędne totalCombinedManagerHours: ${bridgeSept.totalCombinedManagerHours}`);
if (bridgeSept.all7DaysCoverage?.length !== 7) throw new Error(`Błąd liczby dni w all7DaysCoverage: ${bridgeSept.all7DaysCoverage?.length}`);
if (bridgeSept.missingAmTotal !== 1 || bridgeSept.missingPmTotal !== 1) {
  throw new Error(`Błąd weryfikacji luk AM/PM: AM=${bridgeSept.missingAmTotal}, PM=${bridgeSept.missingPmTotal}`);
}
console.log('✅ TEST 1 (Trailing Bridge) zakończony pełnym sukcesem!\n');

console.log('--- TEST 2: Leading Bridge (Październik W1 ➔ Wrzesień W5) ---');
const summaryOct = CalculationEngine.calculateMonth(
  mockPlanOct,
  mockWeeksOct,
  {},
  {},
  {},
  null,
  [],
  [],
  [],
  mockShifts,
  mockShiftDefs,
  mockEmployees
);

const bridgeOct = summaryOct.crossMonthBridge;
if (!bridgeOct) throw new Error('BŁĄD: crossMonthBridge dla Października W1 nie został wygenerowany!');

console.log('Bridge Type:', bridgeOct.bridgeType); // leading
console.log('Combined Date Range:', bridgeOct.combinedDateRange); // 29.09 – 05.10
console.log('Part Current Month:', bridgeOct.partCurrentMonth.monthName, bridgeOct.partCurrentMonth.dates, `(${bridgeOct.partCurrentMonth.daysCount} dni)`);
console.log('Part Current MGR Hours:', bridgeOct.partCurrentMonth.managerHours, 'h'); // 72h
console.log('Part Adjacent Month:', bridgeOct.partAdjacentMonth.monthName, bridgeOct.partAdjacentMonth.dates, `(${bridgeOct.partAdjacentMonth.daysCount} dni)`);
console.log('Part Adjacent MGR Hours:', bridgeOct.partAdjacentMonth.managerHours, 'h'); // 24h
console.log('Total Combined MGR Hours:', bridgeOct.totalCombinedManagerHours, 'h'); // 96h
console.log('Total Combined Barista Pool:', bridgeOct.totalCombinedBaristaPool, 'h'); // 176h
console.log('Chronologia all7DaysCoverage:');
bridgeOct.all7DaysCoverage?.forEach((d) => {
  console.log(`  - ${d.dayOfWeek} ${d.date} (${d.monthName}): AM=${d.hasAm ? '✅' : '❌'}, PM=${d.hasPm ? '✅' : '❌'}, MGR=${d.coverageHours}h`);
});

if (bridgeOct.bridgeType !== 'leading') throw new Error(`Oczekiwano bridgeType leading, otrzymano ${bridgeOct.bridgeType}`);
if (bridgeOct.combinedDateRange !== '29.09 – 05.10') throw new Error(`Błędny zakres: ${bridgeOct.combinedDateRange}`);
if (bridgeOct.partCurrentMonth.managerHours !== 72.0) throw new Error(`Błędne godziny partCurrentMonth: ${bridgeOct.partCurrentMonth.managerHours}`);
if (bridgeOct.partAdjacentMonth.managerHours !== 24.0) throw new Error(`Błędne godziny partAdjacentMonth: ${bridgeOct.partAdjacentMonth.managerHours}`);
if (bridgeOct.totalCombinedManagerHours !== 96.0) throw new Error(`Błędne totalCombinedManagerHours: ${bridgeOct.totalCombinedManagerHours}`);
if (bridgeOct.all7DaysCoverage?.length !== 7) throw new Error(`Błąd liczby dni w all7DaysCoverage: ${bridgeOct.all7DaysCoverage?.length}`);
// Chronologia: Pierwszy dzień musi być 2026-09-29, a ostatni 2026-10-05
if (bridgeOct.all7DaysCoverage?.[0].date !== '2026-09-29') {
  throw new Error(`Błąd chronologii: pierwszy dzień to ${bridgeOct.all7DaysCoverage?.[0].date}, oczekiwano 2026-09-29`);
}
if (bridgeOct.all7DaysCoverage?.[6].date !== '2026-10-05') {
  throw new Error(`Błąd chronologii: ostatni dzień to ${bridgeOct.all7DaysCoverage?.[6].date}, oczekiwano 2026-10-05`);
}

console.log('✅ TEST 2 (Leading Bridge) zakończony pełnym sukcesem!\n');

console.log('🎉 Wszystkie asercje pełnego cyklu przełomów miesięcy (Split-Week Cross-Month Bridge) przeszły w 100% poprawnie!');
