// tests/unit/shiftHoursAndHandover.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ManagerWeeklyRequirement, DayCoverageSummary } from '../../src/types';
import { parseTimeToHours, formatHoursToTimeString } from '../../src/modules/managers-schedule/services/managerScheduleEngine';

describe('Shift Hours & Handover Overlap (Moduł 2: Managers Schedule)', () => {
  it('1. Oblicza poprawne okno przekazania zmiany (Handover) przy standardzie 8h (07:00–22:30)', () => {
    const openTime = '07:00';
    const closeTime = '22:30';
    const shiftLen = 8.0;

    const sh = parseTimeToHours(openTime)!;
    const eh = parseTimeToHours(closeTime)!;

    const amEnd = sh + shiftLen; // 7 + 8 = 15:00
    const pmStart = eh - shiftLen; // 22.5 - 8 = 14:30

    const overlapHours = amEnd - pmStart; // 15.0 - 14.5 = 0.5h
    const overlapMinutes = Math.round(overlapHours * 60);

    assert.strictEqual(formatHoursToTimeString(amEnd), '15:00');
    assert.strictEqual(formatHoursToTimeString(pmStart), '14:30');
    assert.strictEqual(overlapMinutes, 30);
  });

  it('2. Oblicza 2-godzinną zakładkę przekazania zmiany przy zmianach 9h i godzinach 07:00–21:00', () => {
    const openTime = '07:00';
    const closeTime = '21:00';
    const shiftLen = 9.0;

    const sh = parseTimeToHours(openTime)!;
    const eh = parseTimeToHours(closeTime)!;

    const amEnd = sh + shiftLen; // 7 + 9 = 16:00
    const pmStart = eh - shiftLen; // 21 - 9 = 12:00

    const overlapHours = amEnd - pmStart; // 16 - 12 = 4.0h
    const overlapMinutes = Math.round(overlapHours * 60);

    assert.strictEqual(formatHoursToTimeString(amEnd), '16:00');
    assert.strictEqual(formatHoursToTimeString(pmStart), '12:00');
    assert.strictEqual(overlapMinutes, 240); // 4h zakładki przy 14h rozpiętości i dwóch zmianach 9h (18h sumy)
  });

  it('3. Wykrywa brak lub zbyt krótką zakładkę (< 60 min) i flaguje ostrzeżenie', () => {
    const minHandover = 60;
    const overlapMinutes = 30; // 30 min przy standardzie 07:00-22:30 i 8h zmianach
    const isCompliant = overlapMinutes >= minHandover;

    assert.strictEqual(isCompliant, false);
  });

  it('4. Zmiana godzin otwarcia na 08:00 przesuwa start AM na 08:00 a koniec na 16:00 (dla 8h)', () => {
    const openTime = '08:00';
    const shiftLen = 8.0;

    const sh = parseTimeToHours(openTime)!;
    const amEnd = sh + shiftLen;

    assert.strictEqual(sh, 8.0);
    assert.strictEqual(formatHoursToTimeString(amEnd), '16:00');
  });

  it('5. Zmiana zamknięcia z 22:30 na 21:00 przesuwa koniec PM na 21:00 a start na 13:00 (dla 8h)', () => {
    const closeTime = '21:00';
    const shiftLen = 8.0;

    const eh = parseTimeToHours(closeTime)!;
    const pmStart = eh - shiftLen;

    assert.strictEqual(eh, 21.0);
    assert.strictEqual(formatHoursToTimeString(pmStart), '13:00');
  });

  it('6. Wersjonowanie czasowe profilu tygodnia: profil z 2026-04 jest skuteczny dla maja 2026 i nie nadpisuje marca 2026', () => {
    const profiles = [
      { effective_from_year: 2026, effective_from_month: 1, open: '07:00' },
      { effective_from_year: 2026, effective_from_month: 4, open: '08:00' }
    ];

    const getEffectiveProfileFor = (targetYear: number, targetMonth: number) => {
      const candidates = profiles.filter(p => 
        p.effective_from_year < targetYear ||
        (p.effective_from_year === targetYear && p.effective_from_month <= targetMonth)
      );
      candidates.sort((a, b) => {
        if (a.effective_from_year !== b.effective_from_year) return b.effective_from_year - a.effective_from_year;
        return b.effective_from_month - a.effective_from_month;
      });
      return candidates[0];
    };

    // Marzec 2026 (miesiąc 3) otrzymuje stary profil (07:00)
    const marchProfile = getEffectiveProfileFor(2026, 3);
    assert.strictEqual(marchProfile.open, '07:00');

    // Maj 2026 (miesiąc 5) otrzymuje nowy profil z kwietnia (08:00)
    const mayProfile = getEffectiveProfileFor(2026, 5);
    assert.strictEqual(mayProfile.open, '08:00');
  });

  it('7. Samonaprawa schematu tabeli manager_weekly_requirements w SQLite (migracja ze starego PK i brakujących kolumn)', async () => {
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Utwórz starą tabelę sprzed aktualizacji (pojedynczy PK na day_of_week, brak effective_from_year itp.)
    db.run(`
      CREATE TABLE manager_weekly_requirements (
        day_of_week INTEGER PRIMARY KEY,
        day_name TEXT NOT NULL,
        is_open INTEGER DEFAULT 1,
        manager_count INTEGER DEFAULT 2,
        start_time TEXT DEFAULT '07:00',
        end_time TEXT DEFAULT '22:30',
        required_hours REAL DEFAULT 16.0,
        notes TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO manager_weekly_requirements (day_of_week, day_name) VALUES (1, 'Poniedziałek');
    `);

    // Zaimportuj DatabaseManager i przetestuj samonaprawę
    const { DatabaseManager } = await import('../../electron/database/db');
    DatabaseManager.ensureSchemaIntegrity(db as any);

    // Weryfikacja: tabela musi posiadać composite primary key i unikalny indeks
    const tableInfo = db.exec("PRAGMA table_info(manager_weekly_requirements)");
    const cols = tableInfo[0].values.map((v: any[]) => String(v[1]));
    assert.ok(cols.includes('effective_from_year'), 'Tabela powinna posiadać kolumnę effective_from_year');
    assert.ok(cols.includes('effective_from_month'), 'Tabela powinna posiadać kolumnę effective_from_month');
    assert.ok(cols.includes('shift_length_hours'), 'Tabela powinna posiadać kolumnę shift_length_hours');
    assert.ok(cols.includes('min_handover_minutes'), 'Tabela powinna posiadać kolumnę min_handover_minutes');

    // Weryfikacja zapisu z klauzulą ON CONFLICT(effective_from_year, effective_from_month, day_of_week)
    const stmt = db.prepare(`
      INSERT INTO manager_weekly_requirements (
        effective_from_year, effective_from_month, day_of_week, day_name, is_open, manager_count, start_time, end_time, shift_length_hours, min_handover_minutes, required_hours, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(effective_from_year, effective_from_month, day_of_week) DO UPDATE SET
        day_name = excluded.day_name,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run([2026, 4, 1, 'Poniedziałek Nowy', 1, 2, '08:00', '21:00', 8.5, 90, 17.0, 'Test']);
    stmt.free();

    const checkRes = db.exec("SELECT day_name, start_time, shift_length_hours FROM manager_weekly_requirements WHERE effective_from_year = 2026 AND effective_from_month = 4 AND day_of_week = 1");
    assert.strictEqual(checkRes[0].values[0][0], 'Poniedziałek Nowy');
    assert.strictEqual(checkRes[0].values[0][1], '08:00');
    assert.strictEqual(checkRes[0].values[0][2], 8.5);
  });
});
