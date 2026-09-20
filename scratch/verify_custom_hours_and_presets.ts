import { DatabaseManager } from '../electron/database/db';
import { ManagerScheduleEngine } from '../src/modules/managers-schedule/services/managerScheduleEngine';
import { ShiftDefinition } from '../src/types';

async function runVerification() {
  console.log('================================================================');
  console.log('🧪 TEST: Weryfikacja Dostosowywania Godzin i Presetów Zmian');
  console.log('================================================================\n');

  const dbManager = DatabaseManager.getInstance();
  await dbManager.init();
  const db = dbManager.getDb();

  // 1. Sprawdzenie walidacji Kodeksu Pracy z customHours w ManagerScheduleEngine.testShiftCompliance
  console.log('--- TEST 1: Walidacja Kodeksu Pracy z customHours ---');
  const shiftDefsStmt = db.prepare("SELECT * FROM shift_definitions");
  const shiftDefs: ShiftDefinition[] = [];
  while (shiftDefsStmt.step()) {
    shiftDefs.push(shiftDefsStmt.getAsObject() as ShiftDefinition);
  }
  shiftDefsStmt.free();

  const employees = dbManager.getMonthlyRoster(2026, 9);
  const dawid = employees.find(e => e.name.toLowerCase().includes('dawid apel'))!;

  // Stwórz mock rows dla września 2026
  const septScheduleStmt = db.prepare("SELECT * FROM manager_schedule_shifts WHERE year = 2026 AND month = 9 AND employee_id = ?");
  septScheduleStmt.bind([dawid.id]);
  const dawidShifts: Record<number, any> = {};
  while (septScheduleStmt.step()) {
    const s = septScheduleStmt.getAsObject();
    dawidShifts[s.day as number] = s;
  }
  septScheduleStmt.free();

  const mockRows = [{
    employee: dawid,
    shifts: dawidShifts,
    totalWorkedHours: 0,
    nominalHours: 168,
    balanceHours: 0,
    totalOffDays: 8,
    violations: [],
    violationsByDay: {}
  }];

  // Test 1a: Zmiana NC z customHours = 13.0h (powinna wygenerować naruszenie Kodeksu Pracy: max 12h)
  const testOverLimit = ManagerScheduleEngine.testShiftCompliance(
    2026,
    9,
    dawid.id,
    15,
    'NC',
    mockRows as any,
    shiftDefs,
    undefined,
    13.0
  );
  console.log(`- Test 13.0h NC: isValid = ${testOverLimit.isValid} (Oczekiwano: false)`);
  if (testOverLimit.isValid || !testOverLimit.primaryViolation?.title.includes('12h')) {
    throw new Error(`BŁĄD: Zmiana 13.0h powinna wygenerować naruszenie limitu 12h! Otrzymano: ${JSON.stringify(testOverLimit)}`);
  }
  console.log(`  Naruszenie: ${testOverLimit.primaryViolation.title} (${testOverLimit.primaryViolation.article})`);
  console.log('✅ Test 1a (blokada >12h) zaliczony.');

  // Test 1b: Zmiana NC z customHours = 4.0h (powinna być w pełni zgodna)
  const testValid4h = ManagerScheduleEngine.testShiftCompliance(
    2026,
    9,
    dawid.id,
    15,
    'NC',
    mockRows as any,
    shiftDefs,
    undefined,
    4.0
  );
  console.log(`- Test 4.0h NC: isValid = ${testValid4h.isValid} (Oczekiwano: true)`);
  if (!testValid4h.isValid) {
    throw new Error(`BŁĄD: Zmiana 4.0h powinna być poprawna! Naruszenia: ${JSON.stringify(testValid4h.violations)}`);
  }
  console.log('✅ Test 1b (akceptacja 4.0h) zaliczony.\n');

  // 2. Test zapisu zmiany z customHours do bazy danych
  console.log('--- TEST 2: Zapis zmiany z customHours (NC 4.0h) do SQLite ---');
  // Zapisujemy testową zmianę na dzień 28 września 2026
  const origShiftStmt = db.prepare("SELECT * FROM manager_schedule_shifts WHERE year = 2026 AND month = 9 AND day = 28 AND employee_id = ?");
  origShiftStmt.bind([dawid.id]);
  const originalShift = origShiftStmt.step() ? origShiftStmt.getAsObject() : null;
  origShiftStmt.free();

  // Wstawiamy NC 4.0h
  db.run(`
    INSERT INTO manager_schedule_shifts (year, month, day, date, employee_id, shift_code, hours)
    VALUES (2026, 9, 28, '2026-09-28', ?, 'NC', 4.0)
    ON CONFLICT(year, month, day, employee_id) DO UPDATE SET
      shift_code = 'NC',
      hours = 4.0
  `, [dawid.id]);

  // Odczyt z bazy
  const checkStmt = db.prepare("SELECT shift_code, hours FROM manager_schedule_shifts WHERE year = 2026 AND month = 9 AND day = 28 AND employee_id = ?");
  checkStmt.bind([dawid.id]);
  if (!checkStmt.step()) throw new Error('Nie znaleziono zapisanego rekordu!');
  const saved = checkStmt.getAsObject();
  checkStmt.free();
  console.log(`Zapisano w bazie: shift_code = ${saved.shift_code}, hours = ${saved.hours} (Oczekiwano: NC, 4.0h)`);
  if (saved.shift_code !== 'NC' || Number(saved.hours) !== 4.0) {
    throw new Error('Błąd zapisu customHours do bazy!');
  }
  console.log('✅ Test 2 (zapis i odczyt customHours) zaliczony.\n');

  // 3. Test przeliczenia godzin menedżera w ManagerScheduleEngine
  console.log('--- TEST 3: Wpływ customHours na sumę godzin menedżera ---');
  const allSeptShiftsStmt = db.prepare("SELECT * FROM manager_schedule_shifts WHERE year = 2026 AND month = 9");
  const allShifts: any[] = [];
  while (allSeptShiftsStmt.step()) {
    allShifts.push(allSeptShiftsStmt.getAsObject());
  }
  allSeptShiftsStmt.free();

  const processedMonth = ManagerScheduleEngine.calculateMonthData(
    2026,
    9,
    employees,
    shiftDefs,
    allShifts,
    [],
    null,
    undefined,
    undefined,
    false
  );

  const dawidRow = processedMonth.rows.find(r => r.employee.id === dawid.id)!;
  const day28Shift = dawidRow.shifts[28];
  console.log(`Dzień 28 w siatce: ${day28Shift.shift_code} (${day28Shift.hours}h)`);
  if (day28Shift.hours !== 4.0) {
    throw new Error(`BŁĄD: shift.hours w siatce to ${day28Shift.hours}, oczekiwano 4.0!`);
  }
  console.log(`Suma godzin Dawida we wrześniu: ${dawidRow.totalWorkedHours.toFixed(1)}h`);
  console.log('✅ Test 3 (propagacja customHours do siatki i sumy) zaliczony.\n');

  // Przywrócenie oryginalnej wartości dla dnia 28
  if (originalShift) {
    db.run(`
      UPDATE manager_schedule_shifts SET shift_code = ?, hours = ?
      WHERE year = 2026 AND month = 9 AND day = 28 AND employee_id = ?
    `, [originalShift.shift_code, originalShift.hours, dawid.id]);
  } else {
    db.run("DELETE FROM manager_schedule_shifts WHERE year = 2026 AND month = 9 AND day = 28 AND employee_id = ?", [dawid.id]);
  }
  dbManager.persist();
  console.log('Przywrócono stan pierwotny dnia 28.');

  // 4. Test słownika definicji i presetów dla zmian elastycznych
  console.log('\n--- TEST 4: Weryfikacja definicji i presetów zmian elastycznych ---');
  const flexibleCodes = ['NC', 'SAM', 'SPM', 'SUP', 'MIB', 'MID', 'MI4'];
  const foundFlexible = shiftDefs.filter(s => flexibleCodes.includes(s.code));
  console.log(`Liczba znalezionych zmian elastycznych w katalogu: ${foundFlexible.length}`);
  for (const f of foundFlexible) {
    console.log(`  - ${f.code.padEnd(5)} | ${f.name.padEnd(25)} | Domyślne: ${f.hours}h | Kategoria: ${f.category}`);
  }

  if (foundFlexible.length < 5) {
    throw new Error('Brak kluczowych zmian elastycznych w katalogu shift_definitions!');
  }
  console.log('✅ Test 4 (katalog zmian elastycznych) zaliczony.\n');

  console.log('================================================================');
  console.log('🎉 WSZYSTKIE TESTY CUSTOM HOURS I PRESETÓW ZAKOŃCZONE SUKCESEM!');
  console.log('================================================================\n');
}

runVerification().catch(err => {
  console.error('❌ BŁĄD WERYFIKACJI:', err);
  process.exit(1);
});
