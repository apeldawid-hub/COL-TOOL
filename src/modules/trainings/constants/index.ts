/**
 * Moduł 3: Starbucks Training Suite — Stałe Szkoleniowe i Standardy Baristy
 */

// Cykl wdrożeniowy First 30 Days
export const FIRST_30_DAYS_DURATION = 30;

// Kody 10 zmian szkoleniowych baristy
export const TRAINING_SHIFT_CODES = [
  'T1', 'T2', 'T3', 'T4', 'T5',
  'T6', 'T7', 'T8', 'T9', 'T10',
] as const;

// Obszary certyfikacji cyfrowego Skill Check
export const SKILL_CHECK_MODULES = [
  'ESPRESSO_EXCELLENCE',
  'MILK_MASTERY',
  'COLD_BEVERAGE_CRAFT',
] as const;

// Budżetowanie — 100% zmian T1-T10 rozliczane w puli Non-Coverage (NC Training)
export const TRAINING_BUDGET_CATEGORY = 'NON_COVERAGE_TRAINING';
