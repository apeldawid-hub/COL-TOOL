/**
 * Moduł 2: Managers Schedule & TOR — Stałe Domenowe i Kodeks Pracy
 */

export * from './defaultShifts';

// Kodeks Pracy (art. 130, 132, 133, 151 KP)
export const MIN_DAILY_REST_HOURS = 11; // art. 132 KP: min. 11h nieprzerwanego odpoczynku dobowego
export const MIN_WEEKLY_REST_HOURS = 35; // art. 133 KP: min. 35h nieprzerwanego odpoczynku tygodniowego
export const MAX_CONSECUTIVE_WORK_DAYS = 6; // Zakaz pracy 7 dni z rzędu bez doby wolnej
export const FOURTH_SUNDAY_RULE_WEEKS = 4; // art. 151^10 KP: co najmniej 1 niedziela na 4 wolna od pracy

// Standard Floor Hours dla grafiku kierowniczego
export const MIN_DAILY_FLOOR_HOURS = 32.0;
export const MIN_WEEKLY_FLOOR_HOURS = 224.0;

// Silnik AutoScheduler AI
export const AUTOSCHEDULER_DEFAULT_MAX_ITERATIONS = 2000; // 2k prób stochastycznych z twardą weryfikacją KP
