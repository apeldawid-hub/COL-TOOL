import { ManagerScheduleEngine } from '../src/modules/managers-schedule/services/managerScheduleEngine';
import { TorEngine } from '../src/modules/managers-schedule/services/torEngine';
import { ManagerEmployee, ShiftDefinition, ManagerScheduleShift } from '../src/types';

console.log('=== TEST 1: Weryfikacja normalizacji nazwisk i imion ===');

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,;.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesManagerName(rawLogName: string, managerName: string): boolean {
  const normLog = normalizeName(rawLogName);
  const normMgr = normalizeName(managerName);

  if (normLog === normMgr) return true;

  const logTokens = normLog.split(' ').filter(Boolean);
  const mgrTokens = normMgr.split(' ').filter(Boolean);

  if (logTokens.length >= 2 && mgrTokens.length >= 2) {
    const allMgrTokensInLog = mgrTokens.every(token => logTokens.includes(token));
    if (allMgrTokensInLog) return true;

    const allLogTokensInMgr = logTokens.every(token => mgrTokens.includes(token));
    if (allLogTokensInMgr) return true;
  }

  return false;
}

const testPairs = [
  ['APEL, DAWID', 'Dawid Apel', true],
  ['WOJTCZUK, MATEUSZ', 'Mateusz Wojtczuk', true],
  ['KĘPKA, KACPER', 'Kacper Kępka', true],
  ['KEPKA, KACPER', 'Kacper Kępka', true],
  ['KOWALSKI, JAN', 'Dawid Apel', false]
];

for (const [raw, mgr, expected] of testPairs) {
  const result = matchesManagerName(raw as string, mgr as string);
  console.log(`Match "${raw}" <-> "${mgr}": ${result} (oczekiwano: ${expected}) -> ${result === expected ? '✅ OK' : '❌ BŁĄD'}`);
  if (result !== expected) {
    throw new Error(`Błąd dopasowania nazwiska: ${raw} vs ${mgr}`);
  }
}

console.log('\n=== TEST 2: Detekcja kolizji RCP vs L4 / H w managerScheduleEngine ===');

const mockEmployees: ManagerEmployee[] = [
  { id: 1, name: 'Dawid Apel', role: 'SM', contract_hours_ratio: 1.0, sort_order: 1, is_active: true },
  { id: 2, name: 'Mateusz Wojtczuk', role: 'ASM', contract_hours_ratio: 1.0, sort_order: 2, is_active: true }
];

const mockShiftDefs: ShiftDefinition[] = [
  { code: 'AM', name: 'Opening', hours: 8.0, category: 'work', color: '#006241' },
  { code: 'PM', name: 'Closing', hours: 8.0, category: 'work', color: '#1E3932' },
  { code: 'L4', name: 'Zwolnienie lekarskie', hours: 8.0, category: 'absence', color: '#DC2626' },
  { code: 'H', name: 'Urlop wypoczynkowy', hours: 8.0, category: 'absence', color: '#2563EB' },
  { code: 'OFF', name: 'Wolne', hours: 0.0, category: 'off', color: '#9CA3AF' }
];

// Dawid ma L4 dnia 5 oraz H dnia 10
const mockShifts: ManagerScheduleShift[] = [
  { id: 1, employee_id: 1, year: 2026, month: 9, day: 5, date: '2026-09-05', shift_code: 'L4', hours: 8.0 },
  { id: 2, employee_id: 1, year: 2026, month: 9, day: 10, date: '2026-09-10', shift_code: 'H', hours: 8.0 },
  { id: 3, employee_id: 2, year: 2026, month: 9, day: 5, date: '2026-09-05', shift_code: 'AM', hours: 8.0 }
];

// W logowaniach MAPAL Dawid ma zarejestrowane 8.25h dnia 5 (na kawiarni Mokotów - unit 380) oraz 4h dnia 10 (Janki 384)
const mockRcpLogs = {
  1: {
    5: { hours: 8.25, unitCode: '380', unitName: '108110 SBX Warszawa Mokotów' },
    10: { hours: 4.0, unitCode: '384', unitName: '108120 SBX Warszawa Janki' }
  },
  2: {
    5: { hours: 8.0, unitCode: '384', unitName: '108120 SBX Warszawa Janki' }
  }
};

const resultMonth = ManagerScheduleEngine.calculateMonthData(
  2026,
  9,
  mockEmployees,
  mockShiftDefs,
  mockShifts,
  [],
  null,
  undefined,
  mockRcpLogs,
  true
);

console.log(`Liczba wykrytych kolizji RCP vs Absencja: ${resultMonth.rcpConflicts?.length}`);
console.log('Szczegóły kolizji:', JSON.stringify(resultMonth.rcpConflicts, null, 2));

if (resultMonth.rcpConflicts?.length !== 2) {
  throw new Error(`Oczekiwano dokładnie 2 kolizji, otrzymano: ${resultMonth.rcpConflicts?.length}`);
}
console.log('✅ Detekcja kolizji RCP vs L4 i H działa bezbłędnie!');

console.log('\n=== TEST 3: Zasilenie kolumny RCP w TOR (torEngine) ===');

const quarterData = TorEngine.calculateQuarterData(
  2026,
  3, // Q3: lipiec, sierpień, wrzesień
  mockEmployees,
  mockShifts,
  {},
  { 1: { 9: 12.25 }, 2: { 9: 8.0 } }, // actualRcpByMonth: empId -> month -> hours
  { 9: true } // hasActualRcpByMonth: month -> boolean
);

const dawidRow = quarterData.rows.find(r => r.employee.id === 1);
const septSummary = dawidRow?.months.find(m => m.month === 9);

console.log('Wrzesień dla Dawida w TOR:', {
  rcpHours: septSummary?.rcpHours,
  hHours: septSummary?.hHours,
  l4Hours: septSummary?.l4Hours,
  isRcpFromActuals: septSummary?.isRcpFromActuals
});

if (septSummary?.rcpHours !== 12.25 || !septSummary?.isRcpFromActuals) {
  throw new Error(`Błąd zasilania RCP w TOR: rcpHours=${septSummary?.rcpHours}, isRcpFromActuals=${septSummary?.isRcpFromActuals}`);
}

console.log('✅ torEngine prawidłowo zaciąga godziny z actualRcpByMonth i oznacza isRcpFromActuals!');
console.log('\nWszystkie testy zakończone sukcesem! 🎉');
