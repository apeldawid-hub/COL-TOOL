import {
  AopPlanRecord,
  WeekRecord,
  WeeklyCalculatedRow,
  MonthlyCalculationSummary,
  PlanningCadenceInfo,
  CrossMonthBridge,
  CrossMonthBridgePart,
  ManagerDailyCoverageItem,
  TrendLearningSummary,
  NcRuleRecord,
  ManagerScheduleShift,
  ShiftDefinition,
  ManagerEmployee,
  MondayProjectionDetails,
  EnsembleForecastResult,
} from '../../../types';
import { SystemClock } from '../../../services/systemClock';
import { TrendLearningEngine } from './trendLearningEngine';
import { getPolishTradingSundays } from '../../managers-schedule/services/managerScheduleEngine';
import { PartialWeekEngine } from './engine/partialWeekEngine';
import { ManagerCoverageEngine } from './engine/managerCoverageEngine';
import { FlexAllocationEngine } from './engine/flexAllocationEngine';
import { EnsembleForecastEngine } from './engine/ensembleForecastEngine';
import { CrossMonthBridgeEngine } from './engine/crossMonthBridgeEngine';

export class CalculationEngine {
  /**
   * Pomocnicza funkcja analityczna przeliczająca szczegółowo dni i Floor Hours dla tygodnia
   */
  public static calculatePartialWeekInfo(week: WeekRecord) {
    return PartialWeekEngine.calculatePartialWeekInfo(week);
  }

  /**
   * Pomocnicza funkcja wyliczająca dobowe pokrycie godzin przez menedżerów dla zadanej listy dni
   */
  public static calculateDaysManagerCoverage(
    year: number,
    monthNum: number,
    days: number[],
    managerShifts: ManagerScheduleShift[],
    shiftDefinitions: ShiftDefinition[],
    managerEmployees: ManagerEmployee[],
    monthName?: string
  ) {
    return ManagerCoverageEngine.calculateDaysManagerCoverage(
      year,
      monthNum,
      days,
      managerShifts,
      shiftDefinitions,
      managerEmployees,
      monthName
    );
  }

  /**
   * Wylicza dystrybucję puli manipulacji zmianami (godzin ponad floor 32h) na poszczególne dni tygodnia
   */
  public static enrichDailyCoverageWithFlex(
    days: ManagerDailyCoverageItem[],
    totalWeekBudget: number,
    dayOfWeekStats: { day_of_week: string; total_hours: number; days_count: number }[] = [],
    year?: number
  ) {
    return FlexAllocationEngine.enrichDailyCoverageWithFlex(days, totalWeekBudget, dayOfWeekStats, year);
  }

  /**
   * Silnik Predykcji Zespołowej (Multi-Model Ensemble Forecasting)
   */
  public static calculateEnsembleForecast(
    aopPlan: AopPlanRecord,
    historicalPlans: AopPlanRecord[],
    closedRows: WeeklyCalculatedRow[],
    monthTemporalStatus: 'past' | 'current' | 'future',
    planTrxTotal: number,
    targetTplh: number
  ): EnsembleForecastResult {
    return EnsembleForecastEngine.calculateEnsembleForecast(
      aopPlan,
      historicalPlans,
      closedRows,
      monthTemporalStatus,
      planTrxTotal,
      targetTplh
    );
  }

  /**
   * Główna funkcja wyliczająca pełny bilans i metryki dla wybranego miesiąca
   * Uwzględnia realny cykl planowania: grafik układa się w poniedziałek z 7-dniowym wyprzedzeniem (na tydzień W+2),
   * podczas gdy tydzień W+1 jest już opublikowany.
   */
  public static calculateMonth(
    aopPlan: AopPlanRecord,
    weeks: WeekRecord[],
    weeklyActualTrxMap: Record<string, number | null>,
    weeklyActualHoursMap: Record<string, number>,
    weeklyScheduledHoursMap: Record<string, number> = {},
    targetWeekKeyOverride?: string | null,
    historicalPlans: AopPlanRecord[] = [],
    ncRules: NcRuleRecord[] = [],
    dayOfWeekStats: { day_of_week: string; total_hours: number; days_count: number }[] = [],
    managerShifts: ManagerScheduleShift[] = [],
    shiftDefinitions: ShiftDefinition[] = [],
    managerEmployees: ManagerEmployee[] = [],
    dailyKpiMap: Record<string, { trx: number; salesNet: number; hours: number; tplh: number; agc: number; deliveryTrx: number }> = {},
    dailyActualHoursMap: Record<string, number> = {}
  ): MonthlyCalculationSummary {
    const targetTplh = aopPlan.target_tplh > 0 ? aopPlan.target_tplh : 6.7;
    const planTrxTotal = aopPlan.plan_trx;
    const planHoursTotal = Number((planTrxTotal / targetTplh).toFixed(1));
    const ncBudgetTotal = Number(
      ncRules.reduce((sum, r) => sum + (r.monthly_hours || 0), 0).toFixed(1)
    );

    // Funkcja pomocnicza do bezpiecznego odczytu dobowego KPI wg daty (obsługuje formaty YYYY-MM-DD oraz DD.MM.YYYY)
    const getDailyKpi = (y: number, m: number, d: number) => {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dot = `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
      return dailyKpiMap[iso] || dailyKpiMap[dot] || null;
    };

    // Analiza trendu z tego miesiąca (średnie transakcje w poniedziałki i niedziele z realnych raportów)
    const reportedMondaysTrx: number[] = [];
    const reportedSundaysTrx: number[] = [];

    if (dailyKpiMap && Object.keys(dailyKpiMap).length > 0) {
      for (const [dateStr, kpi] of Object.entries(dailyKpiMap)) {
        if (!kpi || !kpi.trx || kpi.trx <= 0) continue;
        const dObj = new Date(dateStr.includes('.') ? dateStr.split('.').reverse().join('-') : dateStr);
        if (isNaN(dObj.getTime())) continue;
        const dayOfWeek = dObj.getDay();
        if (dayOfWeek === 1) { // Poniedziałek
          reportedMondaysTrx.push(kpi.trx);
        } else if (dayOfWeek === 0) { // Niedziela
          reportedSundaysTrx.push(kpi.trx);
        }
      }
    }

    const avgMondayTrxThisMonth =
      reportedMondaysTrx.length > 0
        ? Math.round(reportedMondaysTrx.reduce((a, b) => a + b, 0) / reportedMondaysTrx.length)
        : null;

    const avgSundayTrxThisMonth =
      reportedSundaysTrx.length > 0
        ? Math.round(reportedSundaysTrx.reduce((a, b) => a + b, 0) / reportedSundaysTrx.length)
        : null;

    // Określenie statusu temporalnego całego miesiąca
    const monthTemporalStatus = SystemClock.getMonthTemporalStatus(aopPlan.year, aopPlan.month);
    const isCurrentMonth = monthTemporalStatus === 'current';

    // Odrzucamy tygodnie nieistniejące (dni <= 0 lub brak w miesiącu)
    const validWeeks = weeks.filter(
      (w) => w.days_count > 0 && w.week_type !== 'Brak w miesiącu'
    );

    // Sortowanie tygodni po kolejności (W1, W2, etc.)
    const sortedWeeks = [...validWeeks].sort((a, b) =>
      a.week_num_in_month.localeCompare(b.week_num_in_month, undefined, { numeric: true })
    );

    // Krok 1: Wstępne rozbicie tygodniowe AOP z przeliczeniem niepełnych tygodni
    const baseRows = sortedWeeks.map((w) => {
      const partialInfo = CalculationEngine.calculatePartialWeekInfo(w);
      const floorHoursToUse = partialInfo.calculatedFloorHours > 0 
        ? partialInfo.calculatedFloorHours 
        : w.floor_hours;

      const planTrx = Math.round(planTrxTotal * w.day_weight);
      const planHours = Number((planHoursTotal * w.day_weight).toFixed(1));
      const planTplh = planHours > 0 ? Number((planTrx / planHours).toFixed(2)) : targetTplh;

      // Określenie statusu temporalnego tygodnia wg zegara systemowego
      const temporalStatus = SystemClock.getWeekTemporalStatus(w.date_from, w.date_to, w.year);
      const isCurrentCalendarWeek = isCurrentMonth && temporalStatus === 'current';
      const isInProgress = isCurrentCalendarWeek;

      let actTrx =
        weeklyActualTrxMap[w.week_key] !== undefined &&
        weeklyActualTrxMap[w.week_key] !== null
          ? Number(weeklyActualTrxMap[w.week_key])
          : null;

      // Jeśli tydzień lub miesiąc jest przeszły i nie wprowadzono ręcznie TRX dla tygodnia,
      // ale w aop_plans posiadamy rzeczywiste transakcje (actual_trx) z karty wyników,
      // rozbijamy je proporcjonalnie na poszczególne tygodnie według wagi dniowej:
      if (
        actTrx === null &&
        aopPlan.actual_trx &&
        aopPlan.actual_trx > 0 &&
        (monthTemporalStatus === 'past' || temporalStatus === 'past')
      ) {
        actTrx = Math.round(aopPlan.actual_trx * w.day_weight);
      }

      const actHoursVal = weeklyActualHoursMap[w.week_key];
      let actHours =
        actHoursVal !== undefined && actHoursVal > 0 ? Number(actHoursVal.toFixed(1)) : null;

      const schedHoursVal = weeklyScheduledHoursMap[w.week_key];
      const scheduledHours =
        schedHoursVal !== undefined && schedHoursVal > 0 ? Number(schedHoursVal.toFixed(1)) : null;

      // Sprawdzenie warunku Flash Forecast (poniedziałek kończący bieżący tydzień w toku)
      const sysNow = SystemClock.now();
      const isMondayToday = sysNow.dayOfWeek === 'Pn' || sysNow.date.getDay() === 1;
      let isEndingTodayOnMonday = false;
      let mondayDayOfMonth = 0;
      let mondayMonthNum = 0;

      if (w.date_to && w.date_to.includes('.')) {
        const [d2Str, m2Str] = w.date_to.split('.');
        mondayDayOfMonth = parseInt(d2Str, 10);
        mondayMonthNum = parseInt(m2Str, 10);
        isEndingTodayOnMonday =
          isCurrentCalendarWeek &&
          isMondayToday &&
          sysNow.dayOfMonth === mondayDayOfMonth &&
          (sysNow.monthIndex + 1) === mondayMonthNum &&
          sysNow.year === w.year;
      }

      // Weryfikacja, czy raport zamykający poniedziałek już wpłynął do bazy
      const mondayKpi = getDailyKpi(w.year, mondayMonthNum, mondayDayOfMonth);
      const isMondayAlreadyReported = !!(mondayKpi && mondayKpi.trx > 0);

      // Jeśli raport za zamykający poniedziałek już wpłynął, estymacja Flash natychmiast ustępuje danym rzeczywistym
      if (isMondayAlreadyReported) {
        isEndingTodayOnMonday = false;
      }

      let isMondayProjected = false;
      let mondayProjection: MondayProjectionDetails | undefined = undefined;

      if (isEndingTodayOnMonday) {
        // Baza odniesienia celu godzinowego tygodnia:
        // Jeśli SM wprowadził 'Grafik (h)', to jest to jego cel. W przeciwnym razie plan tygodnia z AOP.
        const targetWeekHours =
          scheduledHours !== null && scheduledHours > 0 ? scheduledHours : planHours;

        // 1. Zbieramy rzeczywiste dane sprzedaży i transakcji z dni 1-6 (wtorek–niedziela)
        let sumTrxDays1to6 = 0;
        let sumHoursDays1to6 = 0;

        if (w.date_from && w.date_from.includes('.')) {
          const [dFromStr, mFromStr] = w.date_from.split('.');
          let curD = parseInt(dFromStr, 10);
          let curM = parseInt(mFromStr, 10);

          for (let step = 0; step < (w.days_count ? w.days_count - 1 : 6); step++) {
            const kpi = getDailyKpi(w.year, curM, curD);
            if (kpi && kpi.trx > 0) {
              sumTrxDays1to6 += kpi.trx;
              sumHoursDays1to6 += kpi.hours;
            } else {
              // Sprawdzamy czy to była niedziela bez wpisu w KPI ale z zarejestrowanymi godzinami RCP
              const iso = `${w.year}-${String(curM).padStart(2, '0')}-${String(curD).padStart(2, '0')}`;
              const dot = `${String(curD).padStart(2, '0')}.${String(curM).padStart(2, '0')}.${w.year}`;
              const dayHours = dailyActualHoursMap[iso] ?? dailyActualHoursMap[dot] ?? 0;
              const dObj = new Date(iso);
              if (dObj.getDay() === 0 && (dayHours > 0 || avgSundayTrxThisMonth)) {
                // Niedziela: uzupełniamy z faktycznej średniej niedzielnej tego miesiąca (~179 TRX)
                sumTrxDays1to6 += (avgSundayTrxThisMonth || 179);
                sumHoursDays1to6 += (dayHours > 0 ? dayHours : 32.0);
              }
            }
            curD++;
            const daysInCurMonth = new Date(w.year, curM, 0).getDate();
            if (curD > daysInCurMonth) {
              curD = 1;
              curM++;
            }
          }
        }

        // Godziny zalogowane z dni 1-6 (wtorek–niedziela):
        // Jeśli posiadamy zagregowane godziny w Fichajes (actHours), to one są bazą.
        const loggedHoursDays1to6 =
          actHours !== null && actHours > 0
            ? actHours
            : (sumHoursDays1to6 > 0 ? Number(sumHoursDays1to6.toFixed(1)) : 0);

        // Transakcje z dni 1-6:
        let actualTrxDays1to6 =
          sumTrxDays1to6 > 0
            ? sumTrxDays1to6
            : (actTrx !== null && actTrx > 0 ? actTrx : null);

        if (actualTrxDays1to6 === null || actualTrxDays1to6 <= 0) {
          actualTrxDays1to6 = Math.round(planTrx * (6 / 7));
        }

        // 2. Autonomiczna estymacja transakcji na dzisiejszy poniedziałek (Day 7):
        // Bazuje na realnym trendzie z poniedziałków tego miesiąca (W1..W3 śr. ~302 TRX)
        // lub historycznej wadze dobowej z poprzednich lat / AOP (~12.1% tygodnia)
        let projectedMondayTrx = 0;
        if (avgMondayTrxThisMonth && avgMondayTrxThisMonth > 0) {
          projectedMondayTrx = avgMondayTrxThisMonth;
        } else {
          projectedMondayTrx = Math.round(planTrx * 0.121);
        }

        const fullWeekProjectedTrx = actualTrxDays1to6 + projectedMondayTrx;

        // 3. Autonomiczne domknięcie godzin na poniedziałek:
        // Godziny kierowników na poniedziałek (z grafiku Modułu 2):
        let projectedMgrHours = 0;
        if (managerShifts && managerShifts.length > 0) {
          const resMon = CalculationEngine.calculateDaysManagerCoverage(
            w.year,
            mondayMonthNum,
            [mondayDayOfMonth],
            managerShifts,
            shiftDefinitions || [],
            managerEmployees || [],
            w.month_name
          );
          projectedMgrHours = Number(resMon.managerHours.toFixed(1));
        }

        // Twarda ochrona dobowego Floor Hours (32.0h na dobę w Janki: 1 AM MGR + 1 AM Barista + 1 PM MGR + 1 PM Barista)
        const floorMondayHours = 32.0;

        // Domykanie godzin:
        // Sprawdzamy cel grafiku lub zaplanowany budżet tygodnia
        const remainingForMonday = Math.max(0, Number((targetWeekHours - loggedHoursDays1to6).toFixed(1)));
        
        // Całkowite godziny poniedziałku to minimum 32.0h (Floor) lub dopełnienie do celu grafiku
        const projectedTotalMondayHours = Number(Math.max(floorMondayHours, remainingForMonday).toFixed(1));
        
        // Godziny baristów to różnica między dobową obsadą poniedziałku a obsadą menedżerów
        const projectedBaristaHours = Number(Math.max(0, projectedTotalMondayHours - projectedMgrHours).toFixed(1));

        const fullWeekProjectedHours = Number((loggedHoursDays1to6 + projectedTotalMondayHours).toFixed(1));

        isMondayProjected = true;
        mondayProjection = {
          isMondayToday: true,
          date: `${String(mondayDayOfMonth).padStart(2, '0')}.${String(mondayMonthNum).padStart(2, '0')}`,
          dayOfMonth: mondayDayOfMonth,
          loggedHoursDays1to6,
          projectedMgrHours,
          projectedBaristaHours,
          projectedTotalMondayHours,
          fullWeekProjectedHours,
          targetWeekHours,
          planTrx,
          actualTrxDays1to6,
          projectedMondayTrx,
          fullWeekProjectedTrx,
        };

        // Zasilamy actHours i actTrx wartościami pełnymi z uwzględnieniem estymacji poniedziałku:
        actHours = fullWeekProjectedHours;
        actTrx = fullWeekProjectedTrx;
      }

      // Złota reguła operacyjna:
      // Tydzień uznaje się za ZAMKNIĘTY, gdy:
      // 1. Cały miesiąc jest już przeszły (monthTemporalStatus === 'past')
      // 2. LUB tydzień minął już w czasie (temporalStatus === 'past') i posiada zarejestrowane godziny RCP lub transakcje
      // 3. LUB trwa poniedziałek kończący tydzień bieżący z aktywną estymacją Flash Monday Forecast
      const hasActualData = (actHours !== null && actHours > 0) || (actTrx !== null && actTrx > 0);
      const isClosed =
        monthTemporalStatus === 'past' ||
        hasActualData ||
        temporalStatus === 'past' ||
        isMondayProjected;

      const actTplh =
        actTrx !== null && actTrx > 0 && actHours !== null && actHours > 0
          ? Number((actTrx / actHours).toFixed(2))
          : null;

      const dataCompletionNotice = isMondayProjected
        ? `Flash Forecast: Poniedziałek estymowany (+${mondayProjection?.projectedTotalMondayHours}h = ${mondayProjection?.projectedMgrHours}h MGR + ${mondayProjection?.projectedBaristaHours}h Barisci, +${mondayProjection?.projectedMondayTrx} TRX). MTD domknięte do planowania W+2.`
        : isInProgress
        ? `Grafik trwa do poniedziałku (${w.date_to}). Zarejestrowane logowania RCP są cząstkowe; pełne dane tygodnia spłyną w poniedziałek.`
        : null;

      return {
        week: {
          ...w,
          floor_hours: floorHoursToUse,
          days_count: partialInfo.calculatedDaysCount,
        },
        planTrx,
        planHours,
        actualTrx: actTrx,
        actualHours: actHours,
        scheduledHours,
        planTplh,
        actualTplh: actTplh,
        hanwRecommendation: null as number | null,
        isClosed,
        status: (isClosed ? 'closed' : 'future') as 'closed' | 'current' | 'published' | 'target_planning' | 'future',
        isCurrentCalendarWeek,
        isInProgress,
        dataCompletionNotice,
        isPublishedWeek: false,
        isTargetPlanningWeek: false,
        isPartial: partialInfo.isPartial,
        calculatedDaysCount: partialInfo.calculatedDaysCount,
        activeDayNames: partialInfo.activeDayNames,
        calculatedFloorHours: floorHoursToUse,
        floorBreakdown: partialInfo.floorBreakdown,
        isMondayProjected,
        mondayProjection,
      };
    });

    // Krok 2: Silnik predykcyjny Trend Velocity (MTD)
    const closedRows = baseRows.filter((r) => r.isClosed);
    let planTrxMtd = 0;
    let actualTrxMtd = 0;
    let actualHoursMtd = 0;

    for (const r of closedRows) {
      planTrxMtd += r.planTrx;
      actualTrxMtd += r.actualTrx || 0;
      actualHoursMtd += r.actualHours || 0;
    }
    actualHoursMtd = Number(actualHoursMtd.toFixed(1));

    // W przypadku zamkniętego miesiąca bierzemy oficjalne dane z aop_plans (karty wyników):
    if (monthTemporalStatus === 'past') {
      if (aopPlan.actual_trx && aopPlan.actual_trx > 0) {
        actualTrxMtd = aopPlan.actual_trx;
      }
      if (planTrxTotal > 0) {
        planTrxMtd = planTrxTotal;
      }
      const totalLoggedHours = Number(baseRows.reduce((sum, r) => sum + (r.actualHours || 0), 0).toFixed(1));
      if (totalLoggedHours > 0) {
        actualHoursMtd = totalLoggedHours;
      }
    }

    // Krok 2: Silnik predykcyjny Zespołu Modeli (Ensemble Forecast: AOP + Run-Rate + YoY)
    const ensembleResult = CalculationEngine.calculateEnsembleForecast(
      aopPlan,
      historicalPlans,
      closedRows,
      monthTemporalStatus,
      planTrxTotal,
      targetTplh
    );

    const trendVelocityMtd = ensembleResult.blendedVelocity;

    // Prognoza TRX dla otwartych tygodni i łączna prognoza miesiąca
    let forecastOpenTrx = 0;
    const openRows = baseRows.filter(
      (r) => !r.isClosed && (r.actualHours === null || r.actualHours === 0) && (r.week.days_count || 0) > 0
    );

    for (const r of openRows) {
      forecastOpenTrx += r.planTrx * trendVelocityMtd;
    }

    const forecastTotalTrx =
      monthTemporalStatus === 'past' && aopPlan.actual_trx && aopPlan.actual_trx > 0
        ? aopPlan.actual_trx
        : Math.round(actualTrxMtd + forecastOpenTrx);

    // Prognoza faktycznych godzin na koniec miesiąca (Projected Actual Hours):
    // Zamknięte tygodnie: rzeczywiste godziny actualHoursMtd
    // Otwarte tygodnie: ułożony grafik (scheduledHours) LUB estymacja na bazie bieżącego MTD TPLH / Floor Hours
    // Prognoza faktycznych godzin na koniec miesiąca (Projected Actual Hours oparta na Trendzie MTD & AI):
    // Zamknięte tygodnie: rzeczywiste godziny actualHoursMtd
    // Otwarte tygodnie: estymacja godzin przy utrzymaniu dotychczasowego tempa efektywności TPLH (currentMtdTplh)
    let forecastOpenHours = 0;
    const currentMtdTplh = actualHoursMtd > 0 && actualTrxMtd > 0 ? actualTrxMtd / actualHoursMtd : targetTplh;

    for (const r of openRows) {
      const estOpenTrx = r.planTrx * trendVelocityMtd;
      const estHoursFromTplh = currentMtdTplh > 0 ? estOpenTrx / currentMtdTplh : r.planHours;
      const floorBase = r.calculatedFloorHours || r.week.floor_hours || (r.week.days_count ? r.week.days_count * 32 : 32);
      forecastOpenHours += Math.max(floorBase, Number(estHoursFromTplh.toFixed(1)));
    }

    const forecastTotalHours =
      monthTemporalStatus === 'past'
        ? (actualHoursMtd > 0 ? actualHoursMtd : (aopPlan.actual_hours || (aopPlan.actual_trx && aopPlan.actual_tplh ? Number((aopPlan.actual_trx / aopPlan.actual_tplh).toFixed(1)) : planHoursTotal)))
        : Number((actualHoursMtd + forecastOpenHours).toFixed(1));

    const forecastEndingTplh =
      forecastTotalHours > 0
        ? Number((forecastTotalTrx / forecastTotalHours).toFixed(2))
        : targetTplh;

    // Krok 3: Wypracowany budżet godzin (Earned Labor Budget)
    const earnedLaborBudget = Number((forecastTotalTrx / targetTplh).toFixed(1));
    const deltaEarnedHours = Number((earnedLaborBudget - planHoursTotal).toFixed(1));
    const remainingHoursBudget =
      monthTemporalStatus === 'past' ? 0 : Number((earnedLaborBudget - actualHoursMtd).toFixed(1));

    // Krok 4: Relacje czasowe i Wyznaczanie Tygodnia Opublikowanego (W+1) oraz Docelowego Planowania (W+2)
    // Tydzień bieżący, opublikowany i docelowy w rytmie poniedziałkowym występują TYLKO w bieżącym miesiącu operacyjnym!
    let currentCalIdx = -1;
    let publishedIdx: number | null = null;
    let targetPlanningIdx: number | null = null;

    if (isCurrentMonth) {
      currentCalIdx = baseRows.findIndex((r) => r.isCurrentCalendarWeek);
      if (currentCalIdx === -1) {
        currentCalIdx = baseRows.findIndex((r) => !r.isClosed);
        if (currentCalIdx === -1) currentCalIdx = 0;
      }

      // Tydzień opublikowany: tydzień kolejny po bieżącym (currentCalIdx + 1)
      publishedIdx = currentCalIdx + 1 < baseRows.length ? currentCalIdx + 1 : null;

      // Tydzień docelowy planowania: tydzień, na który grafik układa się w poniedziałek (currentCalIdx + 2)
      targetPlanningIdx = currentCalIdx + 2 < baseRows.length 
        ? currentCalIdx + 2 
        : publishedIdx !== null ? publishedIdx : currentCalIdx;
    }

    // Jeśli użytkownik manualnie wybrał tydzień docelowy (np. kliknięciem w wiersz)
    if (targetWeekKeyOverride) {
      const manualIdx = baseRows.findIndex((r) => r.week.week_key === targetWeekKeyOverride);
      if (manualIdx !== -1) {
        targetPlanningIdx = manualIdx;
      }
    }

    // Godziny zaplanowane na opublikowany tydzień (W+1)
    let publishedScheduledHours = 0;
    if (publishedIdx !== null) {
      const pubRow = baseRows[publishedIdx];
      publishedScheduledHours = pubRow.scheduledHours !== null && pubRow.scheduledHours > 0
        ? pubRow.scheduledHours
        : pubRow.planHours;
    }

    // Zaangażowany budżet robocizny przed docelowym tygodniem planowania:
    let committedHoursBeforeTarget = 0;
    if (targetPlanningIdx !== null && targetPlanningIdx >= 0) {
      for (let i = 0; i < targetPlanningIdx; i++) {
        const prevRow = baseRows[i];
        if (prevRow.isClosed) {
          committedHoursBeforeTarget += prevRow.actualHours || 0;
        } else {
          const allocated = prevRow.scheduledHours !== null && prevRow.scheduledHours > 0
            ? prevRow.scheduledHours
            : prevRow.planHours;
          committedHoursBeforeTarget += allocated;
        }
      }
    }
    committedHoursBeforeTarget = Number(committedHoursBeforeTarget.toFixed(1));

    const budgetForPlanningWeeks = Number(
      Math.max(0, earnedLaborBudget - committedHoursBeforeTarget).toFixed(1)
    );

    // Suma wag otwartych tygodni podlegających planowaniu
    const planningWeeks = targetPlanningIdx !== null && targetPlanningIdx >= 0 ? baseRows.slice(targetPlanningIdx) : [];
    const planningTotalWeight = planningWeeks.reduce((acc, r) => acc + r.week.day_weight, 0);

    let nextWeekHanw: number | null = null;
    let nextWeekFloorHours: number | null = null;
    let nextWeekHanwFinal: number | null = null;
    let isFloorAlertTriggered = false;

    // Oznaczenie statusów poszczególnych tygodni
    const rowsWithHanw: WeeklyCalculatedRow[] = baseRows.map((row, idx) => {
      const isCurrentCal = isCurrentMonth && idx === currentCalIdx;
      const isPub = isCurrentMonth && idx === publishedIdx;
      const isTarget = targetPlanningIdx !== null && idx === targetPlanningIdx;

      let rowStatus: 'closed' | 'current' | 'published' | 'target_planning' | 'future' = 'future';
      if (monthTemporalStatus === 'past') {
        rowStatus = 'closed';
      } else if (isTarget) {
        rowStatus = 'target_planning';
      } else if (isPub) {
        rowStatus = 'published';
      } else if (isCurrentCal) {
        rowStatus = 'current';
      } else if (row.isClosed) {
        rowStatus = 'closed';
      } else if (row.scheduledHours !== null && row.scheduledHours > 0) {
        rowStatus = 'published';
      } else {
        rowStatus = 'future';
      }

      // Wyliczanie rekomendacji HANW dla danego tygodnia
      let hanwRaw = row.planHours;
      if (isTarget && planningTotalWeight > 0 && budgetForPlanningWeeks > 0) {
        hanwRaw = Number(
          (budgetForPlanningWeeks * (row.week.day_weight / planningTotalWeight)).toFixed(1)
        );
      }
      const floorH = row.week.floor_hours;
      const hanwFinal = Math.max(hanwRaw, floorH);

      if (isTarget) {
        nextWeekHanw = hanwRaw;
        nextWeekFloorHours = floorH;
        nextWeekHanwFinal = hanwFinal;

        if (hanwRaw < floorH) {
          isFloorAlertTriggered = true;
        }
      }

      // Obliczenia powiązania z grafikiem menedżerskim (Moduł 2 ➔ Moduł 1)
      let weekManagerCoverageHours = 0;
      let weekManagerNcHours = 0;
      let managerDailyCoverage: ManagerDailyCoverageItem[] = [];

      let startDay = 1;
      let endDay = 7;
      if (row.week.date_from && row.week.date_to && row.week.date_from.includes('.') && row.week.date_to.includes('.')) {
        startDay = parseInt(row.week.date_from.split('.')[0], 10);
        endDay = parseInt(row.week.date_to.split('.')[0], 10);
      }

      const monthNamesList = [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
      ];
      const monthNum = monthNamesList.indexOf(aopPlan.month) + 1 || 9;

      if (startDay <= endDay && managerShifts && managerShifts.length > 0) {
        const daysToCalc: number[] = [];
        for (let d = startDay; d <= endDay; d++) daysToCalc.push(d);
        const resCov = CalculationEngine.calculateDaysManagerCoverage(
          aopPlan.year,
          monthNum,
          daysToCalc,
          managerShifts,
          shiftDefinitions,
          managerEmployees,
          aopPlan.month
        );
        weekManagerCoverageHours = resCov.managerCoverageHours;
        weekManagerNcHours = resCov.managerNcHours;
        managerDailyCoverage = resCov.dailyCoverage;
      }

      const managerCoverageHours = Number(weekManagerCoverageHours.toFixed(1));
      const managerNcHours = Number(weekManagerNcHours.toFixed(1));
      const managerHours = Number((managerCoverageHours + managerNcHours).toFixed(1));
      const weekTargetBudget = (rowStatus === 'target_planning' || rowStatus === 'published') && hanwFinal
        ? hanwFinal
        : (row.scheduledHours !== null && row.scheduledHours > 0 ? row.scheduledHours : row.planHours);

      const baristaHoursPool = Math.max(0, Number((weekTargetBudget - managerHours).toFixed(1)));

      const baristaScheduledHours = row.scheduledHours !== null
        ? Math.max(0, Number((row.scheduledHours - managerHours).toFixed(1)))
        : null;

      // Wyliczamy dystrybucję puli flex (godzin ponad floor 32h) na poszczególne dni tygodnia
      const flexResult = CalculationEngine.enrichDailyCoverageWithFlex(
        managerDailyCoverage,
        weekTargetBudget,
        dayOfWeekStats,
        aopPlan.year
      );
      managerDailyCoverage = flexResult.enrichedDays;
      const totalBaseFloorHours = flexResult.totalBaseFloorHours;
      const flexHoursPool = flexResult.flexHoursPool;
      const flexHoursPerDayAvg = flexResult.flexHoursPerDayAvg;

      return {
        ...row,
        status: rowStatus,
        isCurrentCalendarWeek: isCurrentCal,
        isInProgress: isCurrentCal,
        isPublishedWeek: isPub,
        isTargetPlanningWeek: isTarget,
        hanwRecommendation: monthTemporalStatus === 'past' ? null : (isTarget || isPub ? hanwFinal : null),
        managerHours,
        managerCoverageHours,
        managerNcHours,
        baristaHoursPool,
        baristaScheduledHours,
        managerDailyCoverage,
        totalBaseFloorHours,
        flexHoursPool,
        flexHoursPerDayAvg,
      };
    });

    const totalActualTplh =
      aopPlan.actual_tplh && aopPlan.actual_tplh > 0
        ? aopPlan.actual_tplh
        : actualTrxMtd > 0 && actualHoursMtd > 0
        ? Number((actualTrxMtd / actualHoursMtd).toFixed(2))
        : null;

    const currentWeekMatch = rowsWithHanw.find((r) => r.isCurrentCalendarWeek);
    const targetWeekMatch = rowsWithHanw.find((r) => r.isTargetPlanningWeek);
    const pubWeekMatch = rowsWithHanw.find((r) => r.isPublishedWeek);

    let planningCadence: PlanningCadenceInfo | undefined = undefined;
    if (isCurrentMonth && targetWeekMatch) {
      const planningMonday = SystemClock.getNextPlanningMonday();
      planningCadence = {
        planningDeadlineDate: planningMonday.formattedDate,
        planningDeadlineDayName: 'Poniedziałek',
        daysUntilDeadline: planningMonday.daysUntil,
        isDeadlineToday: planningMonday.isToday,
        targetWeekKey: targetWeekMatch.week.week_key,
        targetWeekNum: targetWeekMatch.week.week_num_in_month,
        targetWeekDates: `${targetWeekMatch.week.date_from} – ${targetWeekMatch.week.date_to}`,
        publishedWeekKey: pubWeekMatch ? pubWeekMatch.week.week_key : null,
        publishedWeekNum: pubWeekMatch ? pubWeekMatch.week.week_num_in_month : null,
        publishedWeekDates: pubWeekMatch ? `${pubWeekMatch.week.date_from} – ${pubWeekMatch.week.date_to}` : null,
        publishedScheduledHours: publishedScheduledHours,
        currentWeekNum: currentWeekMatch ? currentWeekMatch.week.week_num_in_month : undefined,
        currentWeekDates: currentWeekMatch ? `${currentWeekMatch.week.date_from} – ${currentWeekMatch.week.date_to}` : undefined,
        currentWeekInProgress: currentWeekMatch ? currentWeekMatch.isInProgress : false,
      };
    }

    // Krok 5: Analiza przełomu miesięcy (Cross-Month Bridge)
    const crossMonthBridge = CalculationEngine.calculateCrossMonthBridge(
      rowsWithHanw,
      aopPlan.year,
      aopPlan.month,
      managerShifts,
      shiftDefinitions,
      managerEmployees
    );

    // Przypisanie mostu do wiersza tygodnia cząstkowego
    if (crossMonthBridge) {
      rowsWithHanw.forEach((r) => {
        if (
          r.week.week_key === crossMonthBridge.partCurrentMonth.weekKey ||
          r.week.week_num_in_month === crossMonthBridge.partCurrentMonth.weekNum
        ) {
          r.crossMonthBridge = crossMonthBridge;
        }
      });
    }

    // Krok 6: Adaptacyjny moduł uczenia się trendów (Trend Learning Intelligence)
    const trendLearning = TrendLearningEngine.analyzeTrend(
      aopPlan,
      historicalPlans,
      rowsWithHanw,
      trendVelocityMtd,
      earnedLaborBudget,
      planHoursTotal,
      dayOfWeekStats,
      ensembleResult
    );

    // Krok 7: Kluczowa metryka SM — ile godzin na dodatkowe zmiany
    // Surplus = Wypracowany budżet (Earned) - Suma Floor Hours miesiąca - Godziny NC
    const totalFloorHoursMonth = Number(
      rowsWithHanw.reduce((sum, r) => sum + r.calculatedFloorHours, 0).toFixed(1)
    );
    const surplusHours = Number(
      Math.max(0, earnedLaborBudget - totalFloorHoursMonth - ncBudgetTotal).toFixed(1)
    );
    const weeksCount = rowsWithHanw.length > 0 ? rowsWithHanw.length : 1;
    const surplusHoursPerWeek = Number((surplusHours / weeksCount).toFixed(1));

    // Podsumowania integracji z grafikiem menedżerskim (Moduł 2 ➔ Moduł 1)
    const totalManagerCoverageHoursMonth = Number(
      rowsWithHanw.reduce((sum, r) => sum + (r.managerCoverageHours || 0), 0).toFixed(1)
    );
    const totalManagerNcHoursMonth = Number(
      rowsWithHanw.reduce((sum, r) => sum + (r.managerNcHours || 0), 0).toFixed(1)
    );
    const totalManagerHoursMonth = Number(
      (totalManagerCoverageHoursMonth + totalManagerNcHoursMonth).toFixed(1)
    );
    const totalBaristaPoolMonth = Number(
      rowsWithHanw.reduce((sum, r) => sum + (r.baristaHoursPool || 0), 0).toFixed(1)
    );

    let coverageGapsMonthCount = 0;
    for (const r of rowsWithHanw) {
      if (r.managerDailyCoverage) {
        for (const d of r.managerDailyCoverage) {
          if (!d.hasAm || !d.hasPm) {
            coverageGapsMonthCount++;
          }
        }
      }
    }

    const ncPlannedVsBudget = {
      plannedNcHours: totalManagerNcHoursMonth,
      budgetNcHours: ncBudgetTotal,
      variance: Number((totalManagerNcHoursMonth - ncBudgetTotal).toFixed(1))
    };

    // Kalkulacja dwuwymiarowa P&L (Sales & COL %)
    const effectiveAgc = aopPlan.plan_agc || (aopPlan.plan_sales && aopPlan.plan_trx ? Number((aopPlan.plan_sales / aopPlan.plan_trx).toFixed(2)) : 28.08);
    const forecastSales = aopPlan.plan_sales ? Number((forecastTotalTrx * effectiveAgc).toFixed(2)) : undefined;
    
    // Średni koszt roboczogodziny z AOP lub domyślny
    const avgHourlyLaborCost = aopPlan.plan_col_pln && aopPlan.labor_budget && aopPlan.labor_budget > 0 
      ? aopPlan.plan_col_pln / aopPlan.labor_budget 
      : 49.5;
    const forecastColPln = forecastSales ? Number((earnedLaborBudget * avgHourlyLaborCost).toFixed(2)) : undefined;
    const forecastColPercent = forecastSales && forecastColPln && forecastSales > 0 
      ? Number(((forecastColPln / forecastSales) * 100).toFixed(2)) 
      : (aopPlan.plan_col_percent || undefined);

    return {
      year: aopPlan.year,
      month: aopPlan.month,
      monthTemporalStatus,
      monthPlan: aopPlan,
      planHoursTotal,
      actualHoursMtd,
      planTrxMtd,
      actualTrxMtd,
      trendVelocityMtd,
      forecastTotalTrx,
      earnedLaborBudget,
      forecastTotalHours,
      forecastEndingTplh,
      deltaEarnedHours,
      remainingHoursBudget,
      nextWeekHanw,
      nextWeekFloorHours,
      nextWeekHanwFinal,
      isFloorAlertTriggered,
      totalActualTplh,
      systemTimestamp: SystemClock.now().timestamp,
      currentWeekKey: currentWeekMatch ? currentWeekMatch.week.week_key : null,
      targetPlanningWeekKey: targetWeekMatch ? targetWeekMatch.week.week_key : null,
      planningCadence,
      crossMonthBridge,
      trendLearning,
      ncBudgetTotal,
      surplusHours,
      surplusHoursPerWeek,
      totalFloorHoursMonth,

      totalManagerHoursMonth,
      totalManagerCoverageHoursMonth,
      totalManagerNcHoursMonth,
      totalBaristaPoolMonth,
      ncPlannedVsBudget,
      coverageGapsMonthCount,
      ensembleForecast: ensembleResult,

      forecastSales,
      forecastColPln,
      forecastColPercent,

      rows: rowsWithHanw,
    };
  }

  /**
   * Wyznacza scalony 7-dniowy tydzień operacyjny na przełomie miesięcy (np. W5 Września 29-30.09 i W1 Października 01-05.10)
   */
  public static calculateCrossMonthBridge(
    rows: WeeklyCalculatedRow[],
    currentYear: number,
    currentMonth: string,
    managerShifts: ManagerScheduleShift[] = [],
    shiftDefinitions: ShiftDefinition[] = [],
    managerEmployees: ManagerEmployee[] = []
  ): CrossMonthBridge | null {
    return CrossMonthBridgeEngine.calculateCrossMonthBridge(
      rows,
      currentYear,
      currentMonth,
      managerShifts,
      shiftDefinitions,
      managerEmployees
    );
  }
}
