// src/modules/managers-schedule/constants/defaultWeeklyRequirements.ts
import { ManagerWeeklyRequirement } from '../../../types';

export const DEFAULT_WEEKLY_REQUIREMENTS: ManagerWeeklyRequirement[] = [
  { effective_from_year: 2026, effective_from_month: 1, day_of_week: 1, day_name: 'Poniedziałek', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', shift_length_hours: 8.0, min_handover_minutes: 60, required_hours: 16.0, notes: 'Standard Pn–Czw (2 MGR)' },
  { effective_from_year: 2026, effective_from_month: 1, day_of_week: 2, day_name: 'Wtorek', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', shift_length_hours: 8.0, min_handover_minutes: 60, required_hours: 16.0, notes: 'Standard Pn–Czw (2 MGR)' },
  { effective_from_year: 2026, effective_from_month: 1, day_of_week: 3, day_name: 'Środa', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', shift_length_hours: 8.0, min_handover_minutes: 60, required_hours: 16.0, notes: 'Standard Pn–Czw (2 MGR)' },
  { effective_from_year: 2026, effective_from_month: 1, day_of_week: 4, day_name: 'Czwartek', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', shift_length_hours: 8.0, min_handover_minutes: 60, required_hours: 16.0, notes: 'Standard Pn–Czw (2 MGR)' },
  { effective_from_year: 2026, effective_from_month: 1, day_of_week: 5, day_name: 'Piątek', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', shift_length_hours: 8.0, min_handover_minutes: 60, required_hours: 16.0, notes: 'Standard Piątek (2 MGR)' },
  { effective_from_year: 2026, effective_from_month: 1, day_of_week: 6, day_name: 'Sobota', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', shift_length_hours: 8.0, min_handover_minutes: 60, required_hours: 16.0, notes: 'Standard Sobota (2 MGR)' },
  { effective_from_year: 2026, effective_from_month: 1, day_of_week: 0, day_name: 'Niedziela (wolna od handlu)', is_open: true, manager_count: 2, start_time: '08:00', end_time: '21:00', shift_length_hours: 7.0, min_handover_minutes: 60, required_hours: 14.0, notes: 'Niedziela Wolna od Handlu (2 MGR)' },
  { effective_from_year: 2026, effective_from_month: 1, day_of_week: 7, day_name: 'Niedziela Handlowa', is_open: true, manager_count: 2, start_time: '08:00', end_time: '21:00', shift_length_hours: 8.0, min_handover_minutes: 60, required_hours: 16.0, notes: 'Niedziela Handlowa (2 MGR)' },
];
