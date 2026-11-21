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

  it('4. Zmiany Non-Coverage (NC, administracja, szkolenia T) są wykluczone z obsady sali i nie zaliczają 2 osób prowadzących', () => {
    const year = 2026;
    const month = 12;

    const shiftDefsWithNC: ShiftDefinition[] = [
      ...mockShiftDefs,
      { code: 'NC', name: 'Administracja SM', start_time: '07:00', end_time: '15:00', hours: 8.0, is_nc: 1, is_absence: 0, color_bg: '', category: 'nc', is_sunday_only: 0 },
      { code: 'T', name: 'Szkolenie Baristy', start_time: '08:00', end_time: '16:00', hours: 8.0, is_nc: 1, is_absence: 0, color_bg: '', category: 'nc', is_sunday_only: 0 }
    ];

    // Dzień 15: Pracownik 1 ma otwarcie AM, Pracownik 2 ma administrację NC
    const shifts: ManagerScheduleShift[] = [
      { year, month, day: 15, date: '2026-12-15', employee_id: 1, shift_code: 'AM', hours: 8.0 },
      { year, month, day: 15, date: '2026-12-15', employee_id: 2, shift_code: 'NC', hours: 8.0 }
    ];

    const result = ManagerScheduleEngine.calculateMonthData(
      year,
      month,
      mockEmployees,
      shiftDefsWithNC,
      shifts,
      [],
      null,
      undefined,
      undefined,
      false,
      {}
    );

    const day15Summary = result.daySummaries.find(d => d.day === 15);
    assert.ok(day15Summary);
    // Na sali (Coverage) pracuje tylko 1 menedżer (AM), NC jest wykluczone!
    assert.equal(day15Summary.totalManagersWorking, 1, 'Tylko menedżer na AM liczy się jako osoba prowadząca');
    assert.equal(day15Summary.ncManagers?.length, 1, 'Menedżer na NC musi być w ncManagers');
    assert.equal(day15Summary.hasOpeningCoverage, true);
    assert.equal(day15Summary.hasClosingCoverage, false);
    assert.equal(day15Summary.isCoverageMet, false, 'Dzień z AM + NC nie ma zamknięcia PM na sali, więc isCoverageMet musi być false');
  });

  it('5. Standardowy profil tygodnia (weeklyRequirements) automatycznie definiuje standard 2 MGR dla wszystkich dni bez nadpisania', () => {
    const year = 2026;
    const month = 12;

    const weeklyRequirements = [
      { day_of_week: 1, day_name: 'Poniedziałek', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', required_hours: 16.0 },
      { day_of_week: 2, day_name: 'Wtorek', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', required_hours: 16.0 },
      { day_of_week: 3, day_name: 'Środa', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', required_hours: 16.0 },
      { day_of_week: 4, day_name: 'Czwartek', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', required_hours: 16.0 },
      { day_of_week: 5, day_name: 'Piątek', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', required_hours: 16.0 },
      { day_of_week: 6, day_name: 'Sobota', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', required_hours: 16.0 },
      { day_of_week: 0, day_name: 'Niedziela', is_open: true, manager_count: 2, start_time: '08:00', end_time: '21:00', required_hours: 14.0 },
      { day_of_week: 7, day_name: 'Niedziela Handlowa', is_open: true, manager_count: 2, start_time: '08:00', end_time: '21:00', required_hours: 16.0 }
    ];

    // Dzień 1 to wtorek (2026-12-01). Mamy AM i PM
    const shifts: ManagerScheduleShift[] = [
      { year, month, day: 1, date: '2026-12-01', employee_id: 1, shift_code: 'AM', hours: 8.0 },
      { year, month, day: 1, date: '2026-12-01', employee_id: 2, shift_code: 'PM', hours: 8.0 }
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
      {},
      weeklyRequirements
    );

    const day1Summary = result.daySummaries.find(d => d.day === 1);
    assert.ok(day1Summary);
    assert.equal(day1Summary.requirement?.manager_count, 2);
    assert.equal(day1Summary.requirement?.start_time, '07:00');
    assert.equal(day1Summary.requirement?.end_time, '22:30');
    assert.equal(day1Summary.totalManagersWorking, 2);
    assert.equal(day1Summary.isCoverageMet, true);
  });
});
