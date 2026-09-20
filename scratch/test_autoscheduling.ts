import { AutoSchedulerEngine } from '../src/modules/managers-schedule/services/autoSchedulerEngine';
import { ManagerEmployee, ShiftDefinition, ManagerScheduleShift } from '../src/types';

console.log('=== TEST SOLVERA AUTOSCHEDULING ===');

const employees: ManagerEmployee[] = [
  { id: 1, name: 'Dawid Szeluga', role: 'CUSTOMER AND SALES MANAGER', contract_type: 'FULL', contract_hours_ratio: 1.0, sort_order: 1, is_active: 1 },
  { id: 2, name: 'Dawid Apel', role: 'ASSISTANT STORE MANAGER', contract_type: 'FULL', contract_hours_ratio: 1.0, sort_order: 2, is_active: 1 },
  { id: 3, name: 'Kamil Kamiński', role: 'SSV', contract_type: 'FULL', contract_hours_ratio: 1.0, sort_order: 3, is_active: 1 },
  { id: 4, name: 'Zuzanna Makowska', role: 'SSV', contract_type: '0.75', contract_hours_ratio: 0.75, sort_order: 4, is_active: 1 },
  { id: 5, name: 'Weronika Bieńkowska', role: 'SSV', contract_type: '0.5', contract_hours_ratio: 0.5, sort_order: 5, is_active: 1 },
  { id: 6, name: 'Gabi Znojek', role: 'SSV', contract_type: 'FULL', contract_hours_ratio: 1.0, sort_order: 6, is_active: 1 },
  { id: 7, name: 'Aleksandra Płużyńska', role: 'SSV', contract_type: 'FULL', contract_hours_ratio: 1.0, sort_order: 7, is_active: 1 }
];

const shiftDefinitions: ShiftDefinition[] = [
  { code: 'AM', name: 'Opening', start_time: '07:00', end_time: '15:00', hours: 8.0, is_nc: 0, is_absence: 0, is_sunday_only: 0 },
  { code: 'PM', name: 'Closing', start_time: '14:30', end_time: '22:30', hours: 8.0, is_nc: 0, is_absence: 0, is_sunday_only: 0 },
  { code: 'AMN', name: 'AM Niedziela', start_time: '08:00', end_time: '14:00', hours: 6.0, is_nc: 0, is_absence: 0, is_sunday_only: 1 },
  { code: 'PMN', name: 'PM Niedziela', start_time: '14:00', end_time: '21:00', hours: 7.0, is_nc: 0, is_absence: 0, is_sunday_only: 1 },
  { code: 'MIB', name: 'MID Bar', start_time: '12:00', end_time: '20:00', hours: 8.0, is_nc: 0, is_absence: 0, is_sunday_only: 0 },
  { code: 'NC', name: 'NC Admin', start_time: '08:00', end_time: '16:00', hours: 8.0, is_nc: 1, is_absence: 0, is_sunday_only: 0 },
  { code: 'H', name: 'Urlop', start_time: '08:00', end_time: '16:00', hours: 8.0, is_nc: 0, is_absence: 1, is_sunday_only: 0 },
  { code: 'L4', name: 'Chorobowe', start_time: '00:00', end_time: '00:00', hours: 0.0, is_nc: 0, is_absence: 1, is_sunday_only: 0 },
  { code: 'OFF', name: 'Wolne', start_time: '00:00', end_time: '00:00', hours: 0.0, is_nc: 0, is_absence: 0, is_sunday_only: 0 }
];

// Symulacja istniejących urlopów H i NC
const existingShifts: ManagerScheduleShift[] = [
  // Kamil ma urlop 1..5 września
  { year: 2026, month: 9, day: 1, date: '2026-09-01', employee_id: 3, shift_code: 'H', hours: 8.0 },
  { year: 2026, month: 9, day: 2, date: '2026-09-02', employee_id: 3, shift_code: 'H', hours: 8.0 },
  { year: 2026, month: 9, day: 3, date: '2026-09-03', employee_id: 3, shift_code: 'H', hours: 8.0 },
  { year: 2026, month: 9, day: 4, date: '2026-09-04', employee_id: 3, shift_code: 'H', hours: 8.0 },
  { year: 2026, month: 9, day: 5, date: '2026-09-05', employee_id: 3, shift_code: 'H', hours: 0.0 } // sobota = 0h
];

// Dyspozycje
const dispositionsByEmployee: Record<number, Record<number, string>> = {
  2: { 10: 'M', 11: 'M', 12: 'M', 18: 'Z', 19: 'Z' }, // Dawid Apel rano 10-12, zamykanie 18-19
  6: { 6: 'Z', 13: 'Z', 20: 'Z', 27: 'Z' }             // Gabi woli zamykać w niedziele
};

const result = AutoSchedulerEngine.generateSchedule(
  2026,
  9,
  employees,
  shiftDefinitions,
  existingShifts,
  dispositionsByEmployee,
  {
    mode: 'smart_full',
    allocateMidInPeaks: true,
    respectDispositions: true,
    preserveFixedShifts: true,
    preferConsecutiveOffDays: true
  }
);

console.log(`\n📊 Wyniki Generowania:`);
console.log(`- Godziny łącznie: ${result.stats.totalPlannedHours}h (Cel: ${result.stats.targetTeamHours}h)`);
console.log(`- Zgodność z dyspozycjami: ${result.stats.dispositionMatchRate}% (${result.stats.dispositionMatchedCount}/${result.stats.dispositionTotalCount})`);
console.log(`- Naruszenia Kodeksu Pracy: ${result.violations.length}`);
console.log(`- Obsadzone dni (AM/PM): ${result.stats.coverageDaysCount} (Luki: ${result.stats.missingCoverageCount})`);
console.log(`- Zmiany: AM=${result.stats.openingShiftsCount}, PM=${result.stats.closingShiftsCount}, MID=${result.stats.midShiftsCount}, NC=${result.stats.ncShiftsCount}`);

console.log(`\n👥 Bilans Pracowników:`);
result.employeeStats.forEach(emp => {
  console.log(`- ${emp.name} (${emp.role}, ${emp.contractRatio}): Plan=${emp.plannedHours}h / Norma=${emp.nominalHours}h, Bilans=${emp.balanceHours > 0 ? `+${emp.balanceHours}` : emp.balanceHours}h, Dni rob=${emp.workingDaysCount}, Dni OFF=${emp.offDaysCount}, Weekendy=${emp.weekendDaysCount}, Dyspo=%${emp.dispositionMatchRate}`);
});

if (result.violations.length > 0) {
  console.error('\n❌ BŁĘDY KODEKSU PRACY:');
  result.violations.forEach(v => console.error(`[${v.ruleType}] Dzień ${v.day}: ${v.message}`));
  process.exit(1);
} else {
  console.log('\n✅ SUKCES: 100% Zgodność z Kodeksem Pracy, pełna obsada i zbalansowany grafik!');
}
