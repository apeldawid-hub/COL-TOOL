/**
 * Moduł 4: COL Calculator — Stałe Finansowe P&L i Kosztów Pracy
 */

// Narzuty pracodawcy na wynagrodzenia
export const ZUS_EMPLOYER_CONTRIBUTION_RATE = 0.1948; // ZUS pracodawcy: 19.48%
export const PPK_EMPLOYER_DEFAULT_RATE = 0.0150;      // PPK pracodawcy: 1.50%
export const VACATION_RESERVE_FACTOR = 0.0924;        // Rezerwa urlopowa: 9.24%

// 3 Filary controllingu robocizny Starbucks
export const COL_PILLARS = [
  'AOP',          // Filar 1: Budżet roczny Annual Operating Plan
  'TARGET',       // Filar 2: Cel operacyjny zaktualizowany
  'MTD_ESTIMATE', // Filar 3: Estymacja Month-To-Date z uwzględnieniem velocity
] as const;

// 6 Arkuszy Excel Replica
export const COL_REPLICA_SHEETS = [
  'MAIN_CALCULATOR',
  'BONUS_SHEET',
  'VACATION_RESERVE_SHEET',
  'DATA_SHEET',
  'FIELD_DESCRIPTIONS',
  'USER_GUIDE',
] as const;
