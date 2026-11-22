import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ManagerScheduleEngine } from '../../src/modules/managers-schedule/services/managerScheduleEngine';
import { TorEngine } from '../../src/modules/managers-schedule/services/torEngine';
import { ManagerEmployee, ManagerScheduleShift } from '../../src/types';

describe('Proporcjonalna Norma Etatu & Dołączenie w trakcie Kwartału (TOR)', () => {
  it('1. Oblicza pełną normę gdy brak daty lub data to 1. dzień miesiąca', () => {
    // Listopad 2026: 20 dni roboczych (11 listopada to środa - święto robocze) = 20 dni * 8h = 160h
    const fullNormNov = ManagerScheduleEngine.calculateProportionalNorm(2026, 11, null, 1.0);
    assert.equal(fullNormNov.isProportional, false);
    assert.equal(fullNormNov.startDay, 1);
    assert.equal(fullNormNov.nominalHours, 160);

    const firstDayNov = ManagerScheduleEngine.calculateProportionalNorm(2026, 11, '2026-11-01', 1.0);
    assert.equal(firstDayNov.isProportional, false);
    assert.equal(firstDayNov.nominalHours, 160);
  });

  it('2. Oblicza proporcjonalną normę art. 130 KP dla zatrudnienia / awansu w trakcie miesiąca', () => {
    // Listopad 2026 od 16 listopada (poniedziałek) do 30 listopada (poniedziałek):
    // Dni robocze: 16-20 (5 dni) + 23-27 (5 dni) + 30 (1 dzień) = 11 dni roboczych * 8h = 88h
    const propNormNov = ManagerScheduleEngine.calculateProportionalNorm(2026, 11, '2026-11-16', 1.0);
    assert.equal(propNormNov.isProportional, true);
    assert.equal(propNormNormCheck(propNormNov.startDay), 16);
    assert.equal(propNormNov.workingDays, 11);
    assert.equal(propNormNov.nominalHours, 88.0);
    assert.equal(propNormNov.fullMonthNominalHours, 160.0);

    // Połowa etatu (0.5): 88h * 0.5 = 44h
    const partTimeNov = ManagerScheduleEngine.calculateProportionalNorm(2026, 11, '2026-11-16', 0.5);
    assert.equal(partTimeNov.isProportional, true);
    assert.equal(partTimeNov.nominalHours, 44.0);
  });

  it('3. TOR: Pracownik dołączający w 2. miesiącu kwartału (M1 nieaktywny, M2 proporcjonalny, M3 pełny)', () => {
    // Kwartał 4 2026 (Październik 176h, Listopad 160h, Grudzień 168h)
    const empNewJoin: ManagerEmployee = {
      id: 99,
      name: 'Nowy Manager',
      role: 'SSV',
      sort_order: 1,
      activeMonths: [11, 12], // Aktywny w M2 i M3
      contract_hours_ratio: 1.0,
      monthlyEffectiveFrom: {
        10: null,       // Nie był w grafiku w M1
        11: '2026-11-16', // Awans od 16 listopada
        12: null        // W M3 pełny miesiąc
      }
    };

    const employees = [empNewJoin];
    const allShifts: ManagerScheduleShift[] = [
      // Zmiany w M2 od 16 listopada (88h zaplanowane)
      { year: 2026, month: 11, day: 16, employee_id: 99, shift_code: 'AM', hours: 8.0, date: '2026-11-16' },
      { year: 2026, month: 11, day: 17, employee_id: 99, shift_code: 'AM', hours: 8.0, date: '2026-11-17' },
      { year: 2026, month: 11, day: 18, employee_id: 99, shift_code: 'AM', hours: 8.0, date: '2026-11-18' },
      { year: 2026, month: 11, day: 19, employee_id: 99, shift_code: 'AM', hours: 8.0, date: '2026-11-19' },
      { year: 2026, month: 11, day: 20, employee_id: 99, shift_code: 'AM', hours: 8.0, date: '2026-11-20' },
      { year: 2026, month: 11, day: 23, employee_id: 99, shift_code: 'PM', hours: 8.0, date: '2026-11-23' },
      { year: 2026, month: 11, day: 24, employee_id: 99, shift_code: 'PM', hours: 8.0, date: '2026-11-24' },
      { year: 2026, month: 11, day: 25, employee_id: 99, shift_code: 'PM', hours: 8.0, date: '2026-11-25' },
      { year: 2026, month: 11, day: 26, employee_id: 99, shift_code: 'PM', hours: 8.0, date: '2026-11-26' },
      { year: 2026, month: 11, day: 27, employee_id: 99, shift_code: 'PM', hours: 8.0, date: '2026-11-27' },
      { year: 2026, month: 11, day: 30, employee_id: 99, shift_code: 'AM', hours: 8.0, date: '2026-11-30' },
      // W M3 zaplanowane pełne 168h (21 dni x 8h)
      ...Array.from({ length: 21 }, (_, i) => ({
        year: 2026, month: 12, day: i + 1, employee_id: 99, shift_code: 'AM', hours: 8.0, date: `2026-12-${String(i+1).padStart(2, '0')}`
      }))
    ];

    const torData = TorEngine.calculateQuarterData(
      2026,
      4,
      employees,
      allShifts,
      {},
      undefined,
      undefined,
      undefined,
      undefined,
      new Date('2026-11-22')
    );

    const row = torData.rows.find(r => r.employee.id === 99);
    assert.ok(row, 'Wiersz pracownika powinien istnieć w TOR');

    // M1 (Październik): Nieaktywny (0h normy, brak fałszywych niedogodzin)
    assert.equal(row.months[0].isActiveInMonth, false);
    assert.equal(row.months[0].normHours, 0.0);
    assert.equal(row.months[0].balanceHours, 0.0);

    // M2 (Listopad): Proporcjonalna norma 88.0h, wypracowane 88.0h -> Bilans 0.0h
    assert.equal(row.months[1].isActiveInMonth, true);
    assert.equal(row.months[1].isProportionalNorm, true);
    assert.equal(row.months[1].startDay, 16);
    assert.equal(row.months[1].normHours, 88.0);
    assert.equal(row.months[1].balanceHours, 0.0);

    // M3 (Grudzień): Pełna norma 168.0h, wypracowane 168.0h -> Bilans 0.0h
    assert.equal(row.months[2].isActiveInMonth, true);
    assert.equal(row.months[2].normHours, 168.0);
    assert.equal(row.months[2].balanceHours, 0.0);

    // Podsumowanie kwartału: Bilans TOTAL = 0.0h (Zrównoważony, brak fałszywego deficytu -176h za Październik!)
    assert.equal(row.quarterTotalBalance, 0.0);
    assert.equal(row.quarterStatus, 'OK');
  });
});

function propNormNormCheck(v: number): number {
  return v;
}
