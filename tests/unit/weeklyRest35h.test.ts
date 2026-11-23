import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ManagerScheduleEngine } from '../../src/modules/managers-schedule/services/managerScheduleEngine';
import { ManagerEmployee, ShiftDefinition, ManagerScheduleShift } from '../../src/types';

describe('Art. 133 KP: Odpoczynek tygodniowy 35h (Weekly Rest 35h)', () => {
  const mockEmployee: ManagerEmployee = {
    id: 1,
    name: 'Jan Kowalski',
    role: 'SM',
    contract_type: 'FULL',
    contract_hours_ratio: 1.0,
    is_active: 1
  };

  const mockShiftDefs: ShiftDefinition[] = [
    { code: 'AM', name: 'Otwarcie', start_time: '07:00', end_time: '15:00', hours: 8.0, is_nc: 0, is_absence: 0, color_bg: '', category: 'coverage', is_sunday_only: 0 },
    { code: 'PM', name: 'Zamknięcie (22:30)', start_time: '14:30', end_time: '22:30', hours: 8.0, is_nc: 0, is_absence: 0, color_bg: '', category: 'coverage', is_sunday_only: 0 },
    { code: 'OFF', name: 'Dzień wolny', start_time: '', end_time: '', hours: 0, is_nc: 0, is_absence: 0, color_bg: '', category: 'absence', is_sunday_only: 0 }
  ];

  const shiftDefMap = new Map<string, ShiftDefinition>();
  for (const def of mockShiftDefs) {
    shiftDefMap.set(def.code, def);
  }

  it('1. Wykrywa naruszenie art. 133 KP: PM (koniec 22:30) -> OFF -> AM (start 09:00) = 34.5h < 35h', () => {
    const year = 2026;
    const month = 11;
    const totalDays = 30;

    // Listopad 2026:
    // Dzień 9 (Pn): PM
    // Dzień 10 (Wt): PM
    // Dzień 11 (Śr): PM (koniec 22:30)
    // Dzień 12 (Cz): OFF
    // Dzień 13 (Pt): AM z godzinami 09:00 - 19:00 (start 09:00)
    // Dzień 14 (Sb): PM
    // Dzień 15 (Nd): PM
    const shifts: Record<number, ManagerScheduleShift> = {
      9: { id: 9, employee_id: 1, year, month, day: 9, shift_code: 'PM', hours: 8.0 },
      10: { id: 10, employee_id: 1, year, month, day: 10, shift_code: 'PM', hours: 8.0 },
      11: { id: 11, employee_id: 1, year, month, day: 11, shift_code: 'PM', hours: 8.0, custom_end_time: '22:30' },
      12: { id: 12, employee_id: 1, year, month, day: 12, shift_code: 'OFF', hours: 0 },
      13: { id: 13, employee_id: 1, year, month, day: 13, shift_code: 'AM', hours: 10.0, custom_start_time: '09:00', custom_end_time: '19:00' },
      14: { id: 14, employee_id: 1, year, month, day: 14, shift_code: 'PM', hours: 8.0 },
      15: { id: 15, employee_id: 1, year, month, day: 15, shift_code: 'PM', hours: 8.0 }
    };

    const result = ManagerScheduleEngine.validateLaborLaw(year, month, totalDays, mockEmployee, shifts, shiftDefMap);
    const weeklyViolation = result.violations.find(v => v.ruleType === 'weekly_rest_35h' && v.day === 12);

    assert.ok(weeklyViolation, 'Musi wykryć naruszenie 35h odpoczynku tygodniowego dla dnia OFF (dzień 12)');
    assert.equal(weeklyViolation?.severity, 'error');
    assert.ok(weeklyViolation?.title.includes('34.5h < 35h'));
    assert.ok(weeklyViolation?.details.includes('art. 133 § 1 KP'));
    assert.ok(weeklyViolation?.details.includes('09:30'));
  });

  it('2. Zalicza odpoczynek gdy PM kończy się o 22:00: PM (22:00) -> OFF -> AM (09:00) = 35.0h', () => {
    const year = 2026;
    const month = 11;
    const totalDays = 30;

    const shifts: Record<number, ManagerScheduleShift> = {
      9: { id: 9, employee_id: 1, year, month, day: 9, shift_code: 'PM', hours: 8.0 },
      10: { id: 10, employee_id: 1, year, month, day: 10, shift_code: 'PM', hours: 8.0 },
      11: { id: 11, employee_id: 1, year, month, day: 11, shift_code: 'PM', hours: 8.0, custom_end_time: '22:00' },
      12: { id: 12, employee_id: 1, year, month, day: 12, shift_code: 'OFF', hours: 0 },
      13: { id: 13, employee_id: 1, year, month, day: 13, shift_code: 'AM', hours: 10.0, custom_start_time: '09:00', custom_end_time: '19:00' },
      14: { id: 14, employee_id: 1, year, month, day: 14, shift_code: 'PM', hours: 8.0 },
      15: { id: 15, employee_id: 1, year, month, day: 15, shift_code: 'PM', hours: 8.0 }
    };

    const result = ManagerScheduleEngine.validateLaborLaw(year, month, totalDays, mockEmployee, shifts, shiftDefMap);
    const weeklyViolation = result.violations.find(v => v.ruleType === 'weekly_rest_35h' && v.day === 12);

    assert.equal(weeklyViolation, undefined, 'Gdy odpoczynek wynosi dokładnie 35.0h, nie może być naruszenia');
  });

  it('3. Zalicza odpoczynek gdy start po OFF przesunięto na 09:30: PM (22:30) -> OFF -> AM (09:30) = 35.0h', () => {
    const year = 2026;
    const month = 11;
    const totalDays = 30;

    const shifts: Record<number, ManagerScheduleShift> = {
      9: { id: 9, employee_id: 1, year, month, day: 9, shift_code: 'PM', hours: 8.0 },
      10: { id: 10, employee_id: 1, year, month, day: 10, shift_code: 'PM', hours: 8.0 },
      11: { id: 11, employee_id: 1, year, month, day: 11, shift_code: 'PM', hours: 8.0, custom_end_time: '22:30' },
      12: { id: 12, employee_id: 1, year, month, day: 12, shift_code: 'OFF', hours: 0 },
      13: { id: 13, employee_id: 1, year, month, day: 13, shift_code: 'AM', hours: 9.5, custom_start_time: '09:30', custom_end_time: '19:00' },
      14: { id: 14, employee_id: 1, year, month, day: 14, shift_code: 'PM', hours: 8.0 },
      15: { id: 15, employee_id: 1, year, month, day: 15, shift_code: 'PM', hours: 8.0 }
    };

    const result = ManagerScheduleEngine.validateLaborLaw(year, month, totalDays, mockEmployee, shifts, shiftDefMap);
    const weeklyViolation = result.violations.find(v => v.ruleType === 'weekly_rest_35h' && v.day === 12);

    assert.equal(weeklyViolation, undefined, 'Gdy start jest o 09:30 (odpoczynek 35.0h), nie może być naruszenia');
  });

  it('4. Zalicza odpoczynek przy 2 dniach wolnych pod rząd (OFF + OFF = min. 48h)', () => {
    const year = 2026;
    const month = 11;
    const totalDays = 30;

    const shifts: Record<number, ManagerScheduleShift> = {
      9: { id: 9, employee_id: 1, year, month, day: 9, shift_code: 'PM', hours: 8.0 },
      10: { id: 10, employee_id: 1, year, month, day: 10, shift_code: 'PM', hours: 8.0 },
      11: { id: 11, employee_id: 1, year, month, day: 11, shift_code: 'PM', hours: 8.0, custom_end_time: '22:30' },
      12: { id: 12, employee_id: 1, year, month, day: 12, shift_code: 'OFF', hours: 0 },
      13: { id: 13, employee_id: 1, year, month, day: 13, shift_code: 'OFF', hours: 0 },
      14: { id: 14, employee_id: 1, year, month, day: 14, shift_code: 'AM', hours: 8.0, custom_start_time: '07:00' },
      15: { id: 15, employee_id: 1, year, month, day: 15, shift_code: 'PM', hours: 8.0 }
    };

    const result = ManagerScheduleEngine.validateLaborLaw(year, month, totalDays, mockEmployee, shifts, shiftDefMap);
    const weeklyViolation = result.violations.find(v => v.ruleType === 'weekly_rest_35h');

    assert.equal(weeklyViolation, undefined, 'Dwa dni wolne pod rząd dają > 48h odpoczynku — brak naruszeń');
  });
});
