import { DatabaseManager } from '../electron/database/db';
import { ManagerScheduleEngine } from '../src/modules/managers-schedule/services/managerScheduleEngine';
import { ShiftDefinition } from '../src/types';

async function runVerification() {
  console.log('================================================================');
  console.log('🧪 TEST: Weryfikacja Dostosowywania Przedziału Godzinowego Zmian');
  console.log('================================================================\n');

  const dbManager = DatabaseManager.getInstance();
  await dbManager.init();
  const db = dbManager.getDb();

  // 1. Sprawdzenie schematu bazy danych
  console.log('--- TEST 1: Weryfikacja kolumn w tabeli manager_schedule_shifts ---');
  const tableInfoStmt = db.prepare("PRAGMA table_info(manager_schedule_shifts)");
  const cols: string[] = [];
  while (tableInfoStmt.step()) {
    const col = tableInfoStmt.getAsObject();
    cols.push(col.name as string);
  }
  tableInfoStmt.free();

  console.log('Znalezione kolumny w manager_schedule_shifts:', cols.join(', '));
  if (!cols.includes('custom_start_time') || !cols.includes('custom_end_time')) {
    throw new Error('BŁĄD: Kolumny custom_start_time lub custom_end_time nie istnieją w tabeli!');
  }
  console.log('✅ TEST 1 zaliczony: Obie kolumny istnieją w schemacie SQLite.\n');

  // 2. Pobranie definicji zmian i menedżera
  const shiftDefsStmt = db.prepare("SELECT * FROM shift_definitions");
  const shiftDefs: ShiftDefinition[] = [];
  while (shiftDefsStmt.step()) {
    shiftDefs.push(shiftDefsStmt.getAsObject() as ShiftDefinition);
  }
  shiftDefsStmt.free();

  const employees = dbManager.getMonthlyRoster(2026, 9);
  const dawid = employees.find(e => e.name.toLowerCase().includes('dawid apel'))!;

  // 3. Test 11h odpoczynku z niestandardowymi godzinami (np. start o 09:00 vs 10:00 po zmianie do 23:00)
  console.log('--- TEST 2: Walidacja 11h odpoczynku z niestandardowymi godzinami ---');
  // Dzień 14: PM kończy się o 23:00
  // Dzień 15: Chcemy przypisać NC od 09:00 do 17:00 (przerwa = 10.0h < 11h) -> POWINNO WYKRYĆ NARUSZENIE art. 132 KP
  const mockRows = [{
    employee: dawid,
    shifts: {
      14: {
        year: 2026,
        month: 9,
        day: 14,
        date: '2026-09-14',
        employee_id: dawid.id,
        shift_code: 'PM',
        hours: 8.0,
        custom_start_time: '15:00',
        custom_end_time: '23:00'
      }
    },
    totalWorkedHours: 8.0,
    nominalHours: 168,
    balanceHours: 0,
    totalOffDays: 8,
    violations: [],
    violationsByDay: {}
  }];

  const testBreakViolation = ManagerScheduleEngine.testShiftCompliance(
    2026,
    9,
    dawid.id,
    15,
    'NC',
    mockRows as any,
    shiftDefs,
    undefined,
    8.0,
    '09:00',
    '17:00'
  );

  console.log(`- Próba przypisania NC 09:00–17:00 po PM do 23:00: isValid = ${testBreakViolation.isValid}`);
  if (testBreakViolation.isValid || !testBreakViolation.primaryViolation) {
    throw new Error(`BŁĄD: Oczekiwano naruszenia art. 132 KP (10h odpoczynku zamiast 11h)!`);
  }
  console.log(`  Zgłoszone naruszenie: ${testBreakViolation.primaryViolation.title}`);
  console.log(`  Szczegóły: ${testBreakViolation.primaryViolation.message}`);
  console.log('✅ TEST 2a zaliczony: System zablokował 10h przerwę między 23:00 a 09:00!\n');

  // Test 2b: Dzień 15 zmiana od 10:00 do 18:00 (przerwa = 11.0h) -> ZGODNE Z KODEKSEM PRACY
  const testBreakValid = ManagerScheduleEngine.testShiftCompliance(
    2026,
    9,
    dawid.id,
    15,
    'NC',
    mockRows as any,
    shiftDefs,
    undefined,
    8.0,
    '10:00',
    '18:00'
  );

  console.log(`- Próba przypisania NC 10:00–18:00 po PM do 23:00: isValid = ${testBreakValid.isValid}`);
  if (!testBreakValid.isValid) {
    throw new Error(`BŁĄD: Oczekiwano zgodności (11.0h odpoczynku), ale otrzymano: ${JSON.stringify(testBreakValid.violations)}`);
  }
  console.log('✅ TEST 2b zaliczony: Zmiana 10:00–18:00 ma 11.0h przerwy i jest dozwolona.\n');

  // 4. Test zapisu i odczytu z bazy danych
  console.log('--- TEST 3: Zapis i odczyt zmiany z custom_start_time i custom_end_time w SQLite ---');
  // Zapisujemy na dzień 20 września zmianę SAM od 09:00 do 17:00 (8.0h)
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO manager_schedule_shifts (
      year, month, day, date, employee_id, shift_code, hours, custom_start_time, custom_end_time
    ) VALUES (2026, 9, 20, '2026-09-20', ?, 'SAM', 8.0, '09:00', '17:00')
  `);
  insertStmt.bind([dawid.id]);
  insertStmt.step();
  insertStmt.free();

  // Odczytujemy
  const selectStmt = db.prepare(`
    SELECT * FROM manager_schedule_shifts
    WHERE year = 2026 AND month = 9 AND day = 20 AND employee_id = ?
  `);
  selectStmt.bind([dawid.id]);
  selectStmt.step();
  const savedShift = selectStmt.getAsObject();
  selectStmt.free();

  console.log('Odczytany rekord zmiany z bazy:', savedShift);
  if (savedShift.custom_start_time !== '09:00' || savedShift.custom_end_time !== '17:00' || Number(savedShift.hours) !== 8.0) {
    throw new Error(`BŁĄD: Niezgodność zapisanych danych! Otrzymano: ${JSON.stringify(savedShift)}`);
  }
  console.log('✅ TEST 3 zaliczony: Zapis i odczyt custom_start_time / custom_end_time w SQLite działa perfekcyjnie.\n');

  // Sprzątanie po teście
  const cleanupStmt = db.prepare(`
    DELETE FROM manager_schedule_shifts
    WHERE year = 2026 AND month = 9 AND day = 20 AND employee_id = ? AND shift_code = 'SAM'
  `);
  cleanupStmt.bind([dawid.id]);
  cleanupStmt.step();
  cleanupStmt.free();

  console.log('================================================================');
  console.log('🎉 WSZYSTKIE TESTY ZAKOŃCZONE PEŁNYM SUKCESEM!');
  console.log('================================================================');
}

runVerification().catch(err => {
  console.error('Błąd weryfikacji:', err);
  process.exit(1);
});
