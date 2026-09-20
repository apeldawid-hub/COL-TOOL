export interface AopPlanRecord {
  key: string;               // np. '2026_Wrzesień'
  year: number;              // 2026
  month: string;             // 'Wrzesień'
  month_code: string;        // 'M09'
  weeks_count: number;       // 5
  plan_trx: number;          // 10830
  target_tplh: number;       // 6.70
  labor_budget?: number;     // wyliczane: plan_trx / target_tplh
  avg_weekly_hours?: number; // labor_budget / weeks_count
  plan_sales?: number | null;// Sprzedaż AOP (PLN)
  actual_sales?: number | null;// Rzeczywista sprzedaż (PLN)
  actual_trx?: number | null;  // Rzeczywiste transakcje
  actual_tplh?: number | null; // Rzeczywisty TPLH
}

export interface FloorRuleDay {
  day_id: string;            // 'monday', 'tuesday', etc.
  day_name: string;          // 'Poniedziałek', 'Wtorek', etc.
  shifts_count: number;      // 5
  hours_per_shift: number;   // 8.0
  total_day_hours: number;   // 40.0
}

export interface WeekRecord {
  week_key: string;          // '2026_Wrzesień_W1'
  year: number;              // 2026
  month_name: string;        // 'Wrzesień'
  week_num_in_month: string; // 'W1'
  days_count: number;        // 7
  week_type: string;         // 'Pełny (7 dni)' lub 'Niepełny (2 dni)'
  date_from: string;         // '01.09'
  date_to: string;           // '07.09'
  floor_hours: number;       // 272.0 lub częściowe
  day_weight: number;        // np. 0.22581
}

export interface LaborActualRecord {
  id?: number;
  date: string;              // '2026-09-01'
  year: number;
  month: string;
  week: string;              // 'W1'
  week_key: string;          // '2026_Wrzesień_W1'
  day_of_week: string;       // 'Wt'
  employee: string;
  category: string;
  contract_type: string;
  computable_time: number;
  unit_code: string;
  unit_name: string;
}

export interface WeeklyActualTrx {
  week_key: string;
  actual_trx: number | null;
  manual_hours_override?: number | null;
  scheduled_hours?: number | null;
}

export interface WeeklyCalculatedRow {
  week: WeekRecord;
  planTrx: number;
  planHours: number;
  actualTrx: number | null;
  actualHours: number | null;
  scheduledHours: number | null;
  planTplh: number;
  actualTplh: number | null;
  hanwRecommendation: number | null;
  isClosed: boolean;
  status: 'closed' | 'current' | 'published' | 'target_planning' | 'future';
  isCurrentCalendarWeek: boolean;
  isInProgress: boolean;
  dataCompletionNotice?: string | null;
  isPublishedWeek: boolean;
  isTargetPlanningWeek: boolean;
  isPartial: boolean;
  calculatedDaysCount: number;
  activeDayNames: string[];
  calculatedFloorHours: number;
  floorBreakdown: string;

  // Powiązanie z grafikiem menedżerskim (Moduł 2 ➔ Moduł 1)
  managerHours?: number;                // Suma godzin menedżerów na Janki w danym tygodniu (Coverage + NC)
  managerCoverageHours?: number;        // Godziny Coverage menedżerów na Janki (AM, PM, bar)
  managerNcHours?: number;              // Godziny Non-Coverage menedżerów (NC, szkolenia, admin)
  baristaHoursPool?: number | null;     // Pula godzin dla baristów (HANW - managerHours)
  baristaScheduledHours?: number | null;// Godziny rozpisane baristom (scheduledHours - managerHours)
  managerDailyCoverage?: ManagerDailyCoverageItem[];
  crossMonthBridge?: CrossMonthBridge | null;

  // Pula Flex (Godziny poza Floor Hours do manipulacji zmianami)
  totalBaseFloorHours?: number;         // Suma bazy Floor (32h * liczba dni)
  flexHoursPool?: number;               // Pula godzin poza bazą floor (Budżet tygodnia - totalBaseFloorHours)
  flexHoursPerDayAvg?: number;          // Średnia liczba godzin flex na dzień

  // Prognozowane domknięcie poniedziałku (Sposób 1: Flash Monday Forecast)
  isMondayProjected?: boolean;
  mondayProjection?: MondayProjectionDetails;
}

export interface MondayProjectionDetails {
  isMondayToday: boolean;
  date: string;
  dayOfMonth: number;
  loggedHoursDays1to6: number;        // godziny rzeczywiste z wtorku–niedzieli (np. 281.8h)
  projectedMgrHours: number;          // godziny kierowników zaplanowane w Janki na dziś (np. 32.0h)
  projectedBaristaHours: number;      // godziny baristów wyliczone z różnicy tygodnia
  projectedTotalMondayHours: number;  // suma na poniedziałek (projectedMgrHours + projectedBaristaHours)
  fullWeekProjectedHours: number;     // suma całego tygodnia (loggedHoursDays1to6 + projectedTotalMondayHours)
  targetWeekHours: number;            // baza odniesienia tygodnia (scheduledHours lub planHours)
  planTrx: number;                    // plan TRX tygodnia z AOP
  actualTrxDays1to6: number | null;   // transakcje z 6 dni (jeśli wprowadzone)
  projectedMondayTrx: number;         // estymowane transakcje na poniedziałek (dopełnienie do planu lub run-rate)
  fullWeekProjectedTrx: number;       // łączna suma transakcji tygodnia z estymacją
}

export interface ManagerDailyCoverageItem {
  day: number;
  date: string;
  dayOfWeek: string;
  hasAm: boolean;
  hasPm: boolean;
  amEmployees: string[];
  pmEmployees: string[];
  otherEmployees: string[];
  coverageHours: number;
  ncHours: number;
  floorDeficit: number; // max(0, 32.0 - coverageHours) (ile min. baristów brakuje do 32h)
  monthName?: string;
  year?: number;

  // Wyliczenia dobowej manipulacji zmianami (poza Floor Hours)
  baseFloorHours?: number;              // 32.0h (1 MGR + 1 Barista AM, 1 MGR + 1 Barista PM)
  suggestedFlexHours?: number;          // Sugerowane godziny flex poza floorem na ten dzień
  suggestedTotalDayHours?: number;      // baseFloorHours + suggestedFlexHours (całkowity cel dnia)
  suggestedBaristaHours?: number;       // max(0, suggestedTotalDayHours - coverageHours)
  suggestedExtraShifts?: string;        // np. "+3 zmiany szczytowe" lub "+1 zmiana pomocnicza"
  dayWeightPercent?: number;            // Historyczny udział tego dnia w puli flex (np. 21.6%)
  manipulationMinHours?: number;        // Minimalna obsada (Floor = 32.0h)
  manipulationMaxHours?: number;        // Maksymalna bezpieczna obsada przed kanibalizacją
  manipulationTip?: string;             // Konkretna wskazówka operacyjna dla Store Managera
}

export interface PlanningCadenceInfo {
  planningDeadlineDate: string;   // '14.09'
  planningDeadlineDayName: string;// 'Poniedziałek'
  daysUntilDeadline: number;      // np. 3
  isDeadlineToday: boolean;       // true jeśli dziś jest poniedziałek
  targetWeekKey: string;          // '2026_Wrzesień_W4'
  targetWeekNum: string;          // 'W4'
  targetWeekDates: string;        // '22.09 – 28.09'
  publishedWeekKey: string | null;// '2026_Wrzesień_W3'
  publishedWeekNum: string | null;// 'W3'
  publishedWeekDates: string | null;// '15.09 – 21.09'
  publishedScheduledHours: number;// np. 315.0
  currentWeekNum?: string;        // 'W2'
  currentWeekDates?: string;      // '08.09 – 14.09'
  currentWeekInProgress?: boolean;
}

export interface MonthlyCalculationSummary {
  year: number;
  month: string;
  monthTemporalStatus: 'past' | 'current' | 'future';
  monthPlan: AopPlanRecord;
  planHoursTotal: number;
  actualHoursMtd: number;
  planTrxMtd: number;
  actualTrxMtd: number;
  trendVelocityMtd: number;        // Actual TRX MTD / Plan TRX MTD (np. 1.021 dla +2.1%)
  forecastTotalTrx: number;
  earnedLaborBudget: number;       // forecastTotalTrx / target_tplh
  deltaEarnedHours: number;        // earnedLaborBudget - planHoursTotal
  remainingHoursBudget: number;    // earnedLaborBudget - actualHoursMtd
  nextWeekHanw: number | null;
  nextWeekFloorHours: number | null;
  nextWeekHanwFinal: number | null;
  isFloorAlertTriggered: boolean;  // true if HANW Raw < Floor Hours
  totalActualTplh: number | null;
  systemTimestamp?: string;
  currentWeekKey?: string | null;
  targetPlanningWeekKey?: string | null;
  planningCadence?: PlanningCadenceInfo;
  crossMonthBridge?: CrossMonthBridge | null;
  trendLearning?: TrendLearningSummary | null;
  ncBudgetTotal?: number;
  /** Ile godzin na dodatkowe zmiany (Budżet AOP - Floor Hours miesiąca - NC). Kluczowa metryka dla SM. */
  surplusHours: number;
  /** surplusHours podzielone przez liczbę tygodni — orientacyjna pula na tydzień */
  surplusHoursPerWeek: number;
  /** Suma Floor Hours całego miesiąca (zsumowane z poszczególnych tygodni) */
  totalFloorHoursMonth: number;

  // Podsumowanie integracji grafiku menedżerskiego z Modułem 1
  totalManagerHoursMonth?: number;
  totalManagerCoverageHoursMonth?: number;
  totalManagerNcHoursMonth?: number;
  totalBaristaPoolMonth?: number;
  ncPlannedVsBudget?: {
    plannedNcHours: number;
    budgetNcHours: number;
    variance: number; // planned - budget
  };
  coverageGapsMonthCount?: number;

  rows: WeeklyCalculatedRow[];
}

export interface CrossMonthBridgePart {
  weekKey: string;
  year: number;
  monthName: string;
  weekNum: string;
  dates: string;
  daysCount: number;
  floorHours: number;
  planHours: number;
  activeDays: string[];
  // Wskaźniki obsady menedżerskiej części miesiąca
  managerHours?: number;
  managerCoverageHours?: number;
  managerNcHours?: number;
  baristaPool?: number;
  missingAmCount?: number;
  missingPmCount?: number;
  dailyCoverage?: ManagerDailyCoverageItem[];
}

export interface CrossMonthBridge {
  bridgeType: 'trailing' | 'leading';
  combinedDateRange: string;      // np. '29.09 – 05.10'
  totalDaysCount: number;         // 7
  totalFloorHours: number;        // 272.0
  partCurrentMonth: CrossMonthBridgePart;
  partAdjacentMonth: CrossMonthBridgePart;
  totalCombinedPlanHours: number; // np. 80h + 192h = 272h
  recommendedCombinedHours: number | null;
  // Scalone wskaźniki menedżerskie i pula baristów dla pełnego 7-dniowego grafiku operacyjnego
  totalCombinedManagerHours?: number;
  totalCombinedBaristaPool?: number;
  all7DaysCoverage?: ManagerDailyCoverageItem[];
  missingAmTotal?: number;
  missingPmTotal?: number;
}

export interface TrendLearningInsight {
  id: string;
  title: string;
  description: string;
  impact: string;
  confidenceScore: number;         // 0 - 100%
  suggestedHoursAdjustment: number;// np. +8.5 h
  category: 'seasonality' | 'payday_bump' | 'weekend_momentum' | 'stability';
}

export interface NcRuleRecord {
  id: string;
  name: string;
  category: string;
  monthly_hours: number;
  is_mandatory: boolean;
}

export interface DayOfWeekHoursTrend {
  dayId: string;           // 'monday', 'tuesday', etc.
  dayName: string;         // 'Poniedziałek', 'Wtorek', etc.
  shortName: string;       // 'Pn', 'Wt', etc.
  avgHours: number;        // np. 42.4
  floorHours: number;      // np. 40.0
  sharePercent: number;    // np. 15.2%
  trendDirection: 'increasing' | 'stable' | 'decreasing';
}

export interface StrategyOption {
  id: 'floor_safe' | 'balanced' | 'growth';
  name: string;
  hoursDelta: number;
  expectedTplh: number;
  description: string;
  badge: string;
}

export interface TrendLearningSummary {
  velocityScore: number;           // np. 1.025 (+2.5%)
  momentumTrend: 'accelerating' | 'stable' | 'decelerating';
  confidenceLevel: 'high' | 'medium' | 'low';
  /** true gdy brak zamkniętych tygodni z ACT TRX — system planuje wyłącznie wg AOP */
  isBaselineMode: boolean;
  activeStrategy: 'floor_safe' | 'balanced' | 'growth';
  strategyOptions: {
    floor_safe: StrategyOption;
    balanced: StrategyOption;
    growth: StrategyOption;
  };
  insights: TrendLearningInsight[];
  dayOfWeekTrends?: DayOfWeekHoursTrend[];
  historicalMonthsAnalyzed: number;
}

// ==========================================
// MODUŁ 2: MANAGERS SCHEDULE TYPES
// ==========================================

export interface ManagerEmployee {
  id: number;
  name: string;
  role: string;
  contract_type: string; // 'FULL' | '0.75' | '0.5' | '0.25'
  contract_hours_ratio: number; // 1.0, 0.75, 0.5, 0.25
  hourly_rate?: number; // Stawka godzinowa (PLN/h)
  sort_order: number;
  is_active: number; // 1 or 0
  activeMonths?: number[]; // Miesiące w których pracownik jest w składzie (np. [7, 8])
  monthlyRatios?: Record<number, number>; // Wymiar etatu w danym miesiącu
  monthlyRoles?: Record<number, string>; // Stanowisko w danym miesiącu
}

export interface ShiftDefinition {
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  hours: number;
  is_nc: number; // 1 or 0
  is_absence: number; // 1 or 0
  color_bg?: string;
  color_text?: string;
  category?: 'coverage' | 'nc' | 'absence' | 'dispo';
  is_sunday_only?: number; // 1 or 0 (Tylko w niedziele)
}

export interface ManagerScheduleShift {
  id?: number;
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  date: string; // YYYY-MM-DD
  employee_id: number;
  shift_code: string;
  hours: number;
  notes?: string;
  disposition?: string; // 'OFF' | 'M' | 'Z' | 'FULL'
  custom_start_time?: string; // np. '09:00'
  custom_end_time?: string;   // np. '17:00'
}

export interface ManagerScheduleEvent {
  id?: number;
  year: number;
  month: number;
  day: number;
  date: string;
  event_text: string;
}

export type LaborLawRuleType =
  | 'daily_rest_11h'          // Min 11h przerwy między zmianami (art. 132 KP)
  | 'weekly_rest_35h'         // Co najmniej 35h nieprzerwanego odpoczynku w tygodniu (art. 133 KP)
  | 'max_daily_12h'           // Max 12h pracy w dobie (art. 135 KP)
  | 'consecutive_sundays'     // Maksymalnie 3 niedziele pod rząd (art. 151^10 KP)
  | 'sunday_shift_invalid';   // Zmiana niedzielna zaplanowana w dzień powszedni

export interface LaborLawViolation {
  id: string;
  employeeId: number;
  employeeName: string;
  ruleType: LaborLawRuleType;
  severity: 'error' | 'warning';
  day: number;
  title: string;
  message: string;
  details: string;
}

export interface ManagerCalculatedRow {
  employee: ManagerEmployee;
  shifts: Record<number, ManagerScheduleShift>; // day -> shift
  totalWorkedHours: number;
  totalOffDays: number;
  nominalHours: number;
  coveragePercent: number;
  balanceHours: number; // totalWorkedHours - nominalHours
  violations: LaborLawViolation[];
  violationsByDay: Record<number, LaborLawViolation[]>;
}

export interface DayCoverageSummary {
  day: number;
  dayName: string; // 'Wt', 'Śr', etc.
  dateString: string; // '2026-09-01'
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isSunday?: boolean;
  isTradingSunday?: boolean; // Czy to niedziela handlowa
  isNonWorkingDay?: boolean; // Czy to dzień ustawowo wolny od pracy (święto lub niedziela lub sobota)
  dayType?: 'workday' | 'saturday' | 'sunday_non_trading' | 'sunday_trading' | 'holiday';
  totalManagersWorking: number;
  hasOpeningCoverage: boolean; // AM, SAM, AMN, AMB
  hasClosingCoverage: boolean; // PM, SPM, PMN, PMB
  openingManagers: string[];
  closingManagers: string[];
  externalSupportManagers?: string[]; // Menedżerowie na wsparciach (SUP, SAM, SPM na innych kawiarniach)
  eventText?: string;
  violationsCount: number;
}

export interface MonthlyNormRecord {
  year: number;
  month: number;
  working_days: number;
  off_days: number;
  full_time_hours: number;
  is_custom: number; // 0 = norma KP, 1 = manualny override
  notes?: string;
  updated_at?: string;
}

export interface ManagerScheduleMonthData {
  year: number;
  month: number;
  monthName: string;
  totalDays: number;
  workingDays: number;
  offDaysNorm: number;
  fullTimeNominalHours: number;
  tradingSundaysCount?: number;
  holidaysCount?: number;
  holidaysList?: { day: number; name: string }[];
  tradingSundaysList?: number[];
  isCustomNorm?: boolean;
  customNormNotes?: string;
  isMonthClosed?: boolean; // Czy miesiąc jest zamknięty (przeszły względem czasu systemowego) — blokada edycji
  employees: ManagerEmployee[];
  shiftDefinitions: ShiftDefinition[];
  rows: ManagerCalculatedRow[];
  daySummaries: DayCoverageSummary[];
  events: Record<number, string>;
  totalTeamHours: number;
  averageCoveragePercent: number;
  violations: LaborLawViolation[];
  totalViolationsCount: number;
  rcpLogs?: Record<number, Record<number, { hours: number; unitCode?: string; unitName?: string }>>; // empId -> day -> rcp info
  hasCompleteRcpLogs?: boolean; // Czy miesiąc posiada pełne logowania z MAPAL
  rcpConflicts?: RcpAbsenceConflict[]; // Konflikty: logowanie w systemie w trakcie L4 lub H
}

export interface RcpAbsenceConflict {
  employeeId: number;
  employeeName: string;
  day: number;
  date: string;
  shiftCode: 'L4' | 'H';
  shiftName: string;
  rcpHours: number;
  unitName?: string;
  unitCode?: string;
}

// ----------------------------------------------------
// System Wersjonowania i Publikacji (Art. 129 § 3 KP)
// ----------------------------------------------------

export type ScheduleVersionType = 'draft' | 'published' | 'post_publication_edit';

export interface ScheduleVersionRecord {
  id: number;
  year: number;
  month: number;
  version_num: number;
  version_type: ScheduleVersionType;
  title: string;
  description?: string;
  created_at: string;
  shifts_json?: string;
  events_json?: string;
  is_published: number;
  shifts_count?: number;
}

export interface PublicationStatusInfo {
  year: number;
  month: number;
  firstDayOfSchedule: string;       // np. '2026-09-01'
  publicationCutoffDate: string;     // 7 dni przed wejściem w życie, np. '2026-08-25'
  daysUntilPublication: number;      // dodatnia wartość jeśli przed publikacją, ujemna jeśli po
  isPublished: boolean;             // true jeśli minęło 7 dni przed startem (zamrożenie wersji)
  statusBadge: 'draft' | 'published';
  statusLabel: string;
  statusDescription: string;
}

export interface ShiftComplianceTestResult {
  isValid: boolean;
  violations: LaborLawViolation[];
  primaryViolation?: LaborLawViolation;
}

// ----------------------------------------------------
// Kontekst Przejść Między Miesiącami (Kodeks Pracy)
// ----------------------------------------------------

export interface BoundaryShiftsContext {
  prevMonthLastDays?: Record<number, ManagerScheduleShift[]>; // empId -> shifts z ostatnich dni M-1
  nextMonthFirstDays?: Record<number, ManagerScheduleShift[]>; // empId -> shifts z pierwszych dni M+1
}

// ----------------------------------------------------
// Trzymiesięczny Okres Rozliczeniowy (TOR)
// ----------------------------------------------------

export interface TorMonthSummary {
  year: number;
  month: number;
  monthName: string;
  contractType: string;
  contractRatio: number;
  rcpHours: number;      // Przepracowane godziny dyżurów / zmian
  hDays: number;         // Liczba dni urlopu H
  hHours: number;        // Godziny urlopu H
  l4Days: number;        // Liczba dni chorobowego L4
  l4Hours: number;       // Godziny chorobowego L4 (wliczone do etatu)
  totalHours: number;    // rcpHours + hHours + l4Hours
  normHours: number;     // Nominalna norma etatu pracownika
  balanceHours: number;  // totalHours - normHours
  isRcpFromActuals?: boolean; // true jeśli rcpHours pochodzi z zarejestrowanych logowań MAPAL
  isActiveInMonth?: boolean; // false jeśli pracownik nie był w składzie managerskim w tym miesiącu
}

export interface TorEmployeeRow {
  employee: ManagerEmployee;
  months: [TorMonthSummary, TorMonthSummary, TorMonthSummary]; // 3 miesiące kwartału
  quarterTotalBalance: number; // Suma bilansów 3 miesięcy
  quarterStatus: 'OK' | 'nadgodziny' | 'niedogodziny';
}

export interface TorQuarterData {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  quarterName: string;    // np. 'Q3 (Lipiec – Wrzesień)'
  monthNames: [string, string, string];
  monthNorms: [number, number, number]; // Normy 100% etatu dla 3 miesięcy
  rows: TorEmployeeRow[];
  totalTeamRcp: number;
  totalTeamH: number;
  totalTeamL4: number;
  totalTeamHours: number;
  totalTeamBalance: number;
}



