import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ManagerScheduleEngine } from '../../src/modules/managers-schedule/services/managerScheduleEngine';
import { ManagerEmployee, ShiftDefinition, ManagerScheduleShift, ManagerDayRequirement } from '../../src/types';

describe('ManagerDayRequirements - Wymogi Obecności Menedżerów w Dniach Niestandardowych', () => {
  const mockEmployees: ManagerEmployee[] = [
    { id: 1, name: 'Dawid Szeluga', role: 'SM', contract_type: 'FULL', contract_hours_ratio: 1.0, is_active: 1 },
    { id: 2, name: 'Dawid Apel', role: 'ASM', contract_type: 'FULL', contract_hours_ratio: 1.0, is_active: 1 },
  ];

  const mockShiftDefs: ShiftDefinition[] = [
    { code: 'AM', name: 'Otwarcie', start_time: '07:00', end_time: '15:00', hours: 8.0, is_nc: 0, is_absence: 0, color_bg: '', category: 'coverage', is_sunday_only: 0 },
    { code: 'PM', name: 'Zamknięcie', start_time: '14:30', end_time: '22:30', hours: 8.0, is_nc: 0, is_absence: 0, color_bg: '', category: 'coverage', is_sunday_only: 0 },
    { code: 'OFF', name: 'Dzień wolny', start_time: '', end_time: '', hours: 0, is_nc: 0, is_absence: 0, color_bg: '', category: 'absence', is_sunday_only: 0 }
  ];

  it('1. Wigilia (24 grudnia) z wymogiem 1 MGR (07:00-16:00, 9h) — 1 obsadzony menedżer spełnia wymóg bez fałszywego braku zamknięcia', () => {
    const year = 2026;
    const month = 12;

    const dayRequirements: Record<number, ManagerDayRequirement> = {
      24: {
        year,
        month,
        day: 24,
        date: '2026-12-24',
        is_open: true,
        manager_count: 1,
        start_time: '07:00',
        end_time: '16:00',
        required_hours: 9.0,
        notes: 'Wigilia'
      }
    };

    // Przypisujemy tylko 1 menedżerowi zmianę 9h od 07:00 do 16:00
    const shifts: ManagerScheduleShift[] = [
      {
        year,
        month,
        day: 24,
        date: '2026-12-24',
        employee_id: 1,
        shift_code: 'AM',
        hours: 9.0,
        custom_start_time: '07:00',
        custom_end_time: '16:00'
      },
      {
        year,
        month,
        day: 24,
        date: '2026-12-24',
        employee_id: 2,
        shift_code: 'OFF',
        hours: 0.0
      }
    ];

    const result = ManagerScheduleEngine.calculateMonthData(
      year,
      month,
      mockEmployees,
      mockShiftDefs,
      shifts,
      [],
      null,
      undefined,
      undefined,
      false,
      dayRequirements
    );

    const dec24Summary = result.daySummaries.find(d => d.day === 24);
    assert.ok(dec24Summary, 'Podsumowanie dla 24 grudnia musi istnieć');
    assert.equal(dec24Summary.requirement?.manager_count, 1, 'Wymóg musi wynosić 1 menedżera');
    assert.equal(dec24Summary.requirement?.required_hours, 9.0, 'Godziny obecności menedżera muszą wynosić 9.0h');
    assert.equal(dec24Summary.totalManagersWorking, 1, 'Na zmianie pracuje 1 menedżer');
    assert.equal(dec24Summary.isCoverageMet, true, 'Wymóg obsadowy dnia musi być spełniony!');
  });

  it('2. Boże Narodzenie (25 grudnia) z wymogiem 0 MGR (Zamknięte) — 0 pracujących menedżerów jest w pełni prawidłowe', () => {
    const year = 2026;
    const month = 12;

    const dayRequirements: Record<number, ManagerDayRequirement> = {
      25: {
        year,
        month,
        day: 25,
        date: '2026-12-25',
        is_open: false,
        manager_count: 0,
        notes: 'Boże Narodzenie (Zamknięte)'
      }
    };

    const shifts: ManagerScheduleShift[] = [
      { year, month, day: 25, date: '2026-12-25', employee_id: 1, shift_code: 'OFF', hours: 0.0 },
      { year, month, day: 25, date: '2026-12-25', employee_id: 2, shift_code: 'OFF', hours: 0.0 }
    ];

    const result = ManagerScheduleEngine.calculateMonthData(
      year,
      month,
      mockEmployees,
      mockShiftDefs,
      shifts,
      [],
      null,
      undefined,
      undefined,
      false,
      dayRequirements
    );

    const dec25Summary = result.daySummaries.find(d => d.day === 25);
    assert.ok(dec25Summary);
    assert.equal(dec25Summary.requirement?.is_open, false);
    assert.equal(dec25Summary.totalManagersWorking, 0);
    assert.equal(dec25Summary.isCoverageMet, true, 'Dzień zamknięty z 0 menedżerami musi mieć isCoverageMet: true');
  });

  it('3. Standardowy dzień roboczy bez nadpisania wymogów — wymaga pełnej obsady 2 menedżerów (AM + PM)', () => {
    const year = 2026;
    const month = 12;

    // Dzień 10: tylko otwarcie AM, brak PM
    const shifts: ManagerScheduleShift[] = [
      { year, month, day: 10, date: '2026-12-10', employee_id: 1, shift_code: 'AM', hours: 8.0 },
      { year, month, day: 10, date: '2026-12-10', employee_id: 2, shift_code: 'OFF', hours: 0.0 }
    ];

    const result = ManagerScheduleEngine.calculateMonthData(
      year,
      month,
      mockEmployees,
      mockShiftDefs,
      shifts,
      [],
      null,
      undefined,
      undefined,
      false,
      {}
    );

    const day10Summary = result.daySummaries.find(d => d.day === 10);
    assert.ok(day10Summary);
    assert.equal(day10Summary.hasOpeningCoverage, true);
    assert.equal(day10Summary.hasClosingCoverage, false);
    assert.equal(day10Summary.isCoverageMet, false, 'Standardowy dzień z brakiem zamknięcia nie spełnia wymogu');
  });
});
