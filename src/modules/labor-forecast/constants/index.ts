/**
 * Moduł 1: Labor Forecast & Labor Balancing — Stałe Domenowe Starbucks
 */

// Złota reguła obsady Starbucks Floor Hours
export const MIN_DAILY_FLOOR_HOURS = 32.0; // 1 MGR + 1 Barista AM + 1 MGR + 1 Barista PM = 4 os. * 8h = 32h
export const MIN_WEEKLY_FLOOR_HOURS = 224.0; // 32.0h * 7 dni tygodnia

// Minimum obsadowe dobowe
export const DEFAULT_MIN_STAFF_AM = 2; // 1 MGR + 1 Barista
export const DEFAULT_MIN_STAFF_PM = 2; // 1 MGR + 1 Barista

// Mnożnik niedziel handlowych w CH (pełny ruch ~250% normy)
export const SUNDAY_COMMERCIAL_TRAFFIC_MULTIPLIER = 2.5;

// Granice tolerancji TPLH
export const TPLH_TOLERANCE_WARNING = 0.05; // 5% odchyłka od planu
export const TPLH_TOLERANCE_CRITICAL = 0.10; // 10% odchyłka od planu
