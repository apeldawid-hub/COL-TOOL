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
} from '../../../types';
import { SystemClock } from '../../../services/systemClock';
import { TrendLearningEngine } from './trendLearningEngine';

export class CalculationEngine {
  /**
   * Pomocnicza funkcja analityczna przeliczająca szczegółowo dni i Floor Hours dla tygodnia
   */
  public static calculatePartialWeekInfo(week: WeekRecord): {
    isPartial: boolean;
    calculatedDaysCount: number;
    activeDayNames: string[];
    calculatedFloorHours: number;
    floorBreakdown: string;
  } {
    const isPartial = week.days_count < 7;
    const dayLabels = ['Nd', 'Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];

    if (!week.date_from || !week.date_to || week.date_from === '-' || week.date_to === '-') {
      return {
        isPartial,
        calculatedDaysCount: week.days_count,
        activeDayNames: [],
        calculatedFloorHours: week.floor_hours,
        floorBreakdown: `${week.floor_hours}h`,
      };
    }

    try {
      const [d1Str, m1Str] = week.date_from.split('.');
      const [d2Str, m2Str] = week.date_to.split('.');

      const d1 = parseInt(d1Str, 10);
      const m1 = parseInt(m1Str, 10) - 1; // 0-indexed
      const d2 = parseInt(d2Str, 10);
      const m2 = parseInt(m2Str, 10) - 1;

      const startDate = new Date(week.year, m1, d1);
      const endDate = new Date(week.year, m2, d2);

      const activeDayNames: string[] = [];
      const breakdownParts: string[] = [];
      let totalFloor = 0;
      let count = 0;

      const curr = new Date(startDate);
      // Zabezpieczenie pętli (max 7 dni)
      // Floor = 4 zmiany × 8h = 32h na każdy dzień tygodnia (minimum operacyjne kawiarni)
      const FLOOR_PER_DAY = 32;
      while (curr <= endDate && count < 8) {
        const dayIdx = curr.getDay(); // 0 = Nd, 1 = Pn, ..., 6 = Sob
        const label = dayLabels[dayIdx];
        activeDayNames.push(label);
        breakdownParts.push(`${label} ${FLOOR_PER_DAY}h`);
        totalFloor += FLOOR_PER_DAY;
        count++;

        curr.setDate(curr.getDate() + 1);
      }

      if (count > 0) {
        return {
          isPartial: count < 7,
          calculatedDaysCount: count,
          activeDayNames,
          calculatedFloorHours: totalFloor,
          floorBreakdown: breakdownParts.join(' + ') + ` = ${totalFloor}h`,
        };
      }
    } catch (e) {
      console.warn('Błąd parsowania dat tygodnia:', week.week_key, e);
    }

    return {
      isPartial,
      calculatedDaysCount: week.days_count,
      activeDayNames: [],
      calculatedFloorHours: week.floor_hours,
      floorBreakdown: `${week.floor_hours}h`,
    };
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
  ): {
    dailyCoverage: ManagerDailyCoverageItem[];
    managerHours: number;
    managerCoverageHours: number;
    managerNcHours: number;
  } {
    const dayLabels = ['Nd', 'Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];
    const dailyCoverage: ManagerDailyCoverageItem[] = [];
    let totalCovH = 0;
    let totalNcH = 0;

    for (const d of days) {
      const dateObj = new Date(year, monthNum - 1, d);
      const dayLabel = dayLabels[dateObj.getDay()];
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const dayShifts = managerShifts.filter((s) => {
        if (s.date) return s.date === dateStr;
        return s.year === year && s.month === monthNum && s.day === d;
      });

      let dayCovH = 0;
      let dayNcH = 0;
      let hasAm = false;
      let hasPm = false;
      const amEmps: string[] = [];
      const pmEmps: string[] = [];
      const otherEmps: string[] = [];

      for (const s of dayShifts) {
        const code = s.shift_code;
        if (!code || ['OFF', 'L4', 'H', 'SAM', 'SPM', 'SUP', 'M', 'Z', 'FULL'].includes(code)) {
          continue;
        }
        if (s.hours <= 0) continue;

        const shiftDef = shiftDefinitions.find((sd) => sd.code === code);
        const emp = managerEmployees.find((e) => e.id === s.employee_id);
        const empDisplayName = emp ? emp.name : `MGR ${s.employee_id}`;

        const isNc =
          shiftDef?.is_nc === 1 || ['NC', 'TAM', 'TPM', 'T', 'PRE', 'MEE', 'BT'].includes(code);

        if (isNc) {
          dayNcH += s.hours;
        } else {
          dayCovH += s.hours;
          if (['AM', 'AMN'].includes(code)) {
            hasAm = true;
            amEmps.push(`${empDisplayName} (${code})`);
          } else if (['PM', 'PMN'].includes(code)) {
            hasPm = true;
            pmEmps.push(`${empDisplayName} (${code})`);
          } else {
            otherEmps.push(`${empDisplayName} (${code})`);
          }
        }
      }

      totalCovH += dayCovH;
      totalNcH += dayNcH;

      dailyCoverage.push({
        day: d,
        date: dateStr,
        dayOfWeek: dayLabel,
        hasAm,
        hasPm,
        amEmployees: amEmps,
        pmEmployees: pmEmps,
        otherEmployees: otherEmps,
        coverageHours: Number(dayCovH.toFixed(1)),
        ncHours: Number(dayNcH.toFixed(1)),
        floorDeficit: Math.max(0, Number((32.0 - dayCovH).toFixed(1))),
        monthName,
        year,
      });
    }

    return {
      dailyCoverage,
      managerHours: Number((totalCovH + totalNcH).toFixed(1)),
      managerCoverageHours: Number(totalCovH.toFixed(1)),
      managerNcHours: Number(totalNcH.toFixed(1)),
    };
  }

  /**
   * Wylicza dystrybucję puli manipulacji zmianami (godzin ponad floor 32h) na poszczególne dni tygodnia
   * na podstawie empirycznych wzorców i wag transakcyjno-godzinowych z MAPAL Fichajes
   */
  public static enrichDailyCoverageWithFlex(
    days: ManagerDailyCoverageItem[],
    totalWeekBudget: number,
    dayOfWeekStats: { day_of_week: string; total_hours: number; days_count: number }[] = []
  ): {
    enrichedDays: ManagerDailyCoverageItem[];
    totalBaseFloorHours: number;
    flexHoursPool: number;
    flexHoursPerDayAvg: number;
  } {
    // Domyślne wagi rozkładu godzin flex ponad bazowy floor 32.0h/dzień dla kawiarni 108120 Janki:
    let weightsToUse: Record<string, number> = {
      'Sob': 0.216, // Sobota: 21.6% puli flex (największy szczyt handlowy)
      'Wt': 0.181,  // Wtorek: 18.1% puli flex (początek tygodnia operacyjnego)
      'Pt': 0.172,  // Piątek: 17.2% puli flex (szczyt popołudniowy)
      'Pn': 0.134,  // Poniedziałek: 13.4% puli flex
      'Śr': 0.134,  // Środa: 13.4% puli flex
      'Czw': 0.131, // Czwartek: 13.1% puli flex
      'Nd': 0.032,  // Niedziela: 3.2% puli flex (przeważnie niehandlowe, sam floor)
    };

    // Jeśli baza danych posiada historię logowań MAPAL (np. 2024–2026), wyliczamy wagi w 100% dynamicznie
    if (dayOfWeekStats && dayOfWeekStats.length > 0) {
      const flexDeltas: Record<string, number> = {};
      let totalEmpiricalFlex = 0;

      for (const stat of dayOfWeekStats) {
        if (stat.day_of_week && stat.days_count > 0) {
          const avgHours = stat.total_hours / stat.days_count;
          const flexOverFloor = Math.max(0.5, avgHours - 32.0);
          flexDeltas[stat.day_of_week.trim()] = flexOverFloor;
          totalEmpiricalFlex += flexOverFloor;
        }
      }

      if (totalEmpiricalFlex > 0) {
        weightsToUse = {};
        for (const [dayKey, flexVal] of Object.entries(flexDeltas)) {
          weightsToUse[dayKey] = flexVal / totalEmpiricalFlex;
        }
      }
    }

    const daysCount = days.length;
    const totalBaseFloorHours = daysCount * 32.0;
    const flexHoursPool = Math.max(0, Number((totalWeekBudget - totalBaseFloorHours).toFixed(1)));
    const flexHoursPerDayAvg = daysCount > 0 ? Number((flexHoursPool / daysCount).toFixed(1)) : 0;

    const activeSumWeight = days.reduce(
      (sum, d) => sum + (weightsToUse[d.dayOfWeek] || (1 / (daysCount || 7))),
      0
    );

    const enrichedDays: ManagerDailyCoverageItem[] = days.map((d) => {
      const rawWeight = weightsToUse[d.dayOfWeek] || (1 / (daysCount || 7));
      const normalizedWeight = activeSumWeight > 0 ? rawWeight / activeSumWeight : 1 / (daysCount || 1);

      const baseFloorHours = 32.0;
      const suggestedFlexHours = Number((flexHoursPool * normalizedWeight).toFixed(1));
      const suggestedTotalDayHours = Number((baseFloorHours + suggestedFlexHours).toFixed(1));
      const suggestedBaristaHours = Math.max(0, Number((suggestedTotalDayHours - d.coverageHours).toFixed(1)));
      const extraShiftsCount = Math.round(suggestedFlexHours / 8);
      const suggestedExtraShifts =
        suggestedFlexHours <= 3.0
          ? 'Tylko floor (32h)'
          : `+${extraShiftsCount > 0 ? extraShiftsCount : 1} zmiana (${suggestedFlexHours}h flex)`;

      const manipulationMinHours = baseFloorHours;
      const manipulationMaxHours = Number((suggestedTotalDayHours + (extraShiftsCount > 1 ? 8.0 : 4.0)).toFixed(1));

      let manipulationTip = 'Stabilny dzień powszedni — możliwość manewru ±4h do ±8h (1 zmiana).';
      if (d.dayOfWeek === 'Sob') {
        manipulationTip = 'Sobotni szczyt w CH Janki. Nie schodź poniżej rekomendacji baristów.';
      } else if (d.dayOfWeek === 'Pt') {
        manipulationTip = 'Popołudniowy peak weekendowy. Kluczowa obsada 14:00–20:00.';
      } else if (d.dayOfWeek === 'Nd') {
        manipulationTip = 'Dzień o niskim obrocie. Wystarczy baza floor (32h) lub minimalny bufor.';
      } else if (d.dayOfWeek === 'Wt') {
        manipulationTip = 'Start tygodnia biznesowego / dostawy. Zalecane wsparcie poranne.';
      } else if (d.dayOfWeek === 'Pn') {
        manipulationTip = 'Dzień planowania i raportów. Możliwość zdjęcia 1 zmiany baristy (-8h).';
      }

      return {
        ...d,
        baseFloorHours,
        suggestedFlexHours,
        suggestedTotalDayHours,
        suggestedBaristaHours,
        suggestedExtraShifts,
        dayWeightPercent: Number((normalizedWeight * 100).toFixed(1)),
        manipulationMinHours,
        manipulationMaxHours,
        manipulationTip,
      };
    });

    return {
      enrichedDays,
      totalBaseFloorHours,
      flexHoursPool,
      flexHoursPerDayAvg,
    };
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
    managerEmployees: ManagerEmployee[] = []
  ): MonthlyCalculationSummary {
    const targetTplh = aopPlan.target_tplh > 0 ? aopPlan.target_tplh : 6.7;
    const planTrxTotal = aopPlan.plan_trx;
    const planHoursTotal = Number((planTrxTotal / targetTplh).toFixed(1));
    const ncBudgetTotal = Number(
      ncRules.reduce((sum, r) => sum + (r.monthly_hours || 0), 0).toFixed(1)
    );

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

      let isMondayProjected = false;
      let mondayProjection: MondayProjectionDetails | undefined = undefined;

      if (isEndingTodayOnMonday) {
        // Baza odniesienia celu godzinowego tygodnia:
        // Jeśli SM wprowadził 'Grafik (h)', to jest to jego cel. W przeciwnym razie plan tygodnia z AOP.
        const targetWeekHours =
          scheduledHours !== null && scheduledHours > 0 ? scheduledHours : planHours;

        // Godziny zalogowane z dni 1-6 (wtorek–niedziela):
        const loggedHoursDays1to6 = actHours !== null ? actHours : 0;

        // Godziny kierowników na poniedziałek (Moduł 2):
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

        // Godziny baristów wyliczone z dopełnienia celu tygodnia:
        const remainingForMonday = Math.max(0, Number((targetWeekHours - loggedHoursDays1to6).toFixed(1)));
        const projectedBaristaHours = Math.max(0, Number((remainingForMonday - projectedMgrHours).toFixed(1)));
        const projectedTotalMondayHours = Number((projectedMgrHours + projectedBaristaHours).toFixed(1));
        const fullWeekProjectedHours = Number((loggedHoursDays1to6 + projectedTotalMondayHours).toFixed(1));

        // Transakcje (TRX):
        const actualTrxDays1to6 = actTrx;
        let projectedMondayTrx = 0;
        let fullWeekProjectedTrx = planTrx;

        if (actualTrxDays1to6 !== null && actualTrxDays1to6 > 0) {
          projectedMondayTrx = Math.max(0, planTrx - actualTrxDays1to6);
          fullWeekProjectedTrx = actualTrxDays1to6 + projectedMondayTrx;
        } else {
          projectedMondayTrx = Math.round(planTrx * (1 / (w.days_count || 7)));
          fullWeekProjectedTrx = planTrx;
        }

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
      const isClosed =
        monthTemporalStatus === 'past' ||
        (temporalStatus === 'past' && ((actHours !== null && actHours > 0) || (actTrx !== null && actTrx > 0))) ||
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

    const rowsWithTrx = closedRows.filter((r) => r.actualTrx !== null && r.actualTrx > 0);
    const planTrxForTrend = rowsWithTrx.reduce((s, r) => s + r.planTrx, 0);
    const actTrxForTrend = rowsWithTrx.reduce((s, r) => s + (r.actualTrx || 0), 0);

    let trendVelocityMtd = 1.0;
    if (monthTemporalStatus === 'past' && planTrxMtd > 0 && actualTrxMtd > 0) {
      trendVelocityMtd = actualTrxMtd / planTrxMtd;
    } else if (rowsWithTrx.length > 0 && planTrxForTrend > 0) {
      trendVelocityMtd = actTrxForTrend / planTrxForTrend;
    }

    // Prognoza TRX dla otwartych tygodni i łączna prognoza miesiąca
    let forecastOpenTrx = 0;
    const openRows = baseRows.filter((r) => !r.isClosed);

    for (const r of openRows) {
      forecastOpenTrx += r.planTrx * trendVelocityMtd;
    }

    const forecastTotalTrx =
      monthTemporalStatus === 'past' && aopPlan.actual_trx && aopPlan.actual_trx > 0
        ? aopPlan.actual_trx
        : Math.round(actualTrxMtd + forecastOpenTrx);

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
        dayOfWeekStats
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
      dayOfWeekStats
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
    if (rows.length === 0) return null;

    const MONTHS = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    const monthIdx = MONTHS.indexOf(currentMonth);
    if (monthIdx < 0) return null;
    const pad = (n: number) => String(n).padStart(2, '0');

    let trailingBridge: CrossMonthBridge | null = null;
    let leadingBridge: CrossMonthBridge | null = null;

    // 1. Sprawdzamy przełom z kolejnym miesiącem (trailing bridge na ostatnim tygodniu W_last !== W1)
    const lastRow = rows[rows.length - 1];
    if (
      lastRow &&
      lastRow.isPartial &&
      lastRow.calculatedDaysCount < 7 &&
      lastRow.week.week_num_in_month !== 'W1'
    ) {
      const remainingDays = 7 - lastRow.calculatedDaysCount;
      const nextMonthIdx = (monthIdx + 1) % 12;
      const nextMonthName = MONTHS[nextMonthIdx];
      const nextYear = nextMonthIdx === 0 ? currentYear + 1 : currentYear;

      const startNextDay = 1;
      const endNextDay = remainingDays;
      const nextMonthDates = `${pad(startNextDay)}.${pad(nextMonthIdx + 1)} – ${pad(endNextDay)}.${pad(nextMonthIdx + 1)}`;
      const combinedDateRange = `${lastRow.week.date_from} – ${pad(endNextDay)}.${pad(nextMonthIdx + 1)}`;

      // Suma floor pełnego tygodnia to zawsze 272.0 h
      const nextFloorHours = Number((272.0 - lastRow.calculatedFloorHours).toFixed(1));

      // Szacunkowy plan godzin kolejnego miesiąca
      const nextPlanHours = Number(
        ((nextFloorHours / 272.0) * (lastRow.planHours / (lastRow.calculatedDaysCount / 7))).toFixed(1)
      ) || nextFloorHours;

      // Obsada menedżerska w kolejnym miesiącu
      const adjacentDays = Array.from({ length: remainingDays }, (_, i) => i + 1);
      const adjacentCoverage = CalculationEngine.calculateDaysManagerCoverage(
        nextYear,
        nextMonthIdx + 1,
        adjacentDays,
        managerShifts,
        shiftDefinitions,
        managerEmployees,
        nextMonthName
      );

      const currentDailyCoverage = (lastRow.managerDailyCoverage || []).map((d) => ({
        ...d,
        monthName: currentMonth,
        year: currentYear,
      }));

      const partCurrent: CrossMonthBridgePart = {
        weekKey: lastRow.week.week_key,
        year: currentYear,
        monthName: currentMonth,
        weekNum: lastRow.week.week_num_in_month,
        dates: `${lastRow.week.date_from} – ${lastRow.week.date_to}`,
        daysCount: lastRow.calculatedDaysCount,
        floorHours: lastRow.calculatedFloorHours,
        planHours: lastRow.planHours,
        activeDays: lastRow.activeDayNames,
        managerHours: lastRow.managerHours || 0,
        managerCoverageHours: lastRow.managerCoverageHours || 0,
        managerNcHours: lastRow.managerNcHours || 0,
        baristaPool:
          lastRow.baristaHoursPool ??
          Math.max(0, lastRow.planHours - (lastRow.managerHours || 0)),
        missingAmCount: currentDailyCoverage.filter((d) => !d.hasAm).length,
        missingPmCount: currentDailyCoverage.filter((d) => !d.hasPm).length,
        dailyCoverage: currentDailyCoverage,
      };

      const partAdjacent: CrossMonthBridgePart = {
        weekKey: `${nextYear}_${nextMonthName}_W1`,
        year: nextYear,
        monthName: nextMonthName,
        weekNum: 'W1',
        dates: nextMonthDates,
        daysCount: remainingDays,
        floorHours: nextFloorHours,
        planHours: nextPlanHours,
        activeDays: ['Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd', 'Pn'].slice(
          lastRow.calculatedDaysCount,
          7
        ),
        managerHours: adjacentCoverage.managerHours,
        managerCoverageHours: adjacentCoverage.managerCoverageHours,
        managerNcHours: adjacentCoverage.managerNcHours,
        baristaPool: Math.max(
          0,
          Number((nextPlanHours - adjacentCoverage.managerHours).toFixed(1))
        ),
        missingAmCount: adjacentCoverage.dailyCoverage.filter((d) => !d.hasAm).length,
        missingPmCount: adjacentCoverage.dailyCoverage.filter((d) => !d.hasPm).length,
        dailyCoverage: adjacentCoverage.dailyCoverage,
      };

      const all7Days = [...currentDailyCoverage, ...adjacentCoverage.dailyCoverage];
      const totalMgrHours = Number(
        (partCurrent.managerHours! + partAdjacent.managerHours!).toFixed(1)
      );
      const totalCombinedPlan = Number((lastRow.planHours + nextPlanHours).toFixed(1));
      const recCombined =
        lastRow.hanwRecommendation !== null
          ? Number((lastRow.hanwRecommendation + nextPlanHours).toFixed(1))
          : null;

      trailingBridge = {
        bridgeType: 'trailing',
        combinedDateRange,
        totalDaysCount: 7,
        totalFloorHours: 272.0,
        partCurrentMonth: partCurrent,
        partAdjacentMonth: partAdjacent,
        totalCombinedPlanHours: totalCombinedPlan,
        recommendedCombinedHours: recCombined,
        totalCombinedManagerHours: totalMgrHours,
        totalCombinedBaristaPool: Math.max(
          0,
          Number(((recCombined || 272.0) - totalMgrHours).toFixed(1))
        ),
        all7DaysCoverage: all7Days,
        missingAmTotal: all7Days.filter((d) => !d.hasAm).length,
        missingPmTotal: all7Days.filter((d) => !d.hasPm).length,
      };
    }

    // 2. Sprawdzamy przełom z poprzednim miesiącem (leading bridge na pierwszym tygodniu W1)
    const firstRow = rows[0];
    if (
      firstRow &&
      firstRow.isPartial &&
      firstRow.calculatedDaysCount < 7 &&
      firstRow.week.week_num_in_month === 'W1'
    ) {
      const remainingDays = 7 - firstRow.calculatedDaysCount;
      const prevMonthIdx = (monthIdx - 1 + 12) % 12;
      const prevMonthName = MONTHS[prevMonthIdx];
      const prevYear = monthIdx === 0 ? currentYear - 1 : currentYear;

      // Liczba dni w poprzednim miesiącu kalendarzowym
      const daysInPrevMonth = new Date(prevYear, prevMonthIdx + 1, 0).getDate();
      const startPrevDay = daysInPrevMonth - remainingDays + 1;
      const prevMonthDates = `${pad(startPrevDay)}.${pad(prevMonthIdx + 1)} – ${pad(daysInPrevMonth)}.${pad(prevMonthIdx + 1)}`;
      const combinedDateRange = `${pad(startPrevDay)}.${pad(prevMonthIdx + 1)} – ${firstRow.week.date_to}`;

      const prevFloorHours = Number((272.0 - firstRow.calculatedFloorHours).toFixed(1));
      const prevPlanHours = Number(
        ((prevFloorHours / 272.0) * (firstRow.planHours / (firstRow.calculatedDaysCount / 7))).toFixed(1)
      ) || prevFloorHours;

      // Obsada menedżerska w poprzednim miesiącu
      const adjacentDays: number[] = [];
      for (let d = startPrevDay; d <= daysInPrevMonth; d++) adjacentDays.push(d);

      const adjacentCoverage = CalculationEngine.calculateDaysManagerCoverage(
        prevYear,
        prevMonthIdx + 1,
        adjacentDays,
        managerShifts,
        shiftDefinitions,
        managerEmployees,
        prevMonthName
      );

      const currentDailyCoverage = (firstRow.managerDailyCoverage || []).map((d) => ({
        ...d,
        monthName: currentMonth,
        year: currentYear,
      }));

      const partCurrent: CrossMonthBridgePart = {
        weekKey: firstRow.week.week_key,
        year: currentYear,
        monthName: currentMonth,
        weekNum: firstRow.week.week_num_in_month,
        dates: `${firstRow.week.date_from} – ${firstRow.week.date_to}`,
        daysCount: firstRow.calculatedDaysCount,
        floorHours: firstRow.calculatedFloorHours,
        planHours: firstRow.planHours,
        activeDays: firstRow.activeDayNames,
        managerHours: firstRow.managerHours || 0,
        managerCoverageHours: firstRow.managerCoverageHours || 0,
        managerNcHours: firstRow.managerNcHours || 0,
        baristaPool:
          firstRow.baristaHoursPool ??
          Math.max(0, firstRow.planHours - (firstRow.managerHours || 0)),
        missingAmCount: currentDailyCoverage.filter((d) => !d.hasAm).length,
        missingPmCount: currentDailyCoverage.filter((d) => !d.hasPm).length,
        dailyCoverage: currentDailyCoverage,
      };

      const partAdjacent: CrossMonthBridgePart = {
        weekKey: `${prevYear}_${prevMonthName}_W5`,
        year: prevYear,
        monthName: prevMonthName,
        weekNum: 'W5',
        dates: prevMonthDates,
        daysCount: remainingDays,
        floorHours: prevFloorHours,
        planHours: prevPlanHours,
        activeDays: ['Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd', 'Pn'].slice(0, remainingDays),
        managerHours: adjacentCoverage.managerHours,
        managerCoverageHours: adjacentCoverage.managerCoverageHours,
        managerNcHours: adjacentCoverage.managerNcHours,
        baristaPool: Math.max(
          0,
          Number((prevPlanHours - adjacentCoverage.managerHours).toFixed(1))
        ),
        missingAmCount: adjacentCoverage.dailyCoverage.filter((d) => !d.hasAm).length,
        missingPmCount: adjacentCoverage.dailyCoverage.filter((d) => !d.hasPm).length,
        dailyCoverage: adjacentCoverage.dailyCoverage,
      };

      // W porządku chronologicznym: poprzedni miesiąc -> bieżący miesiąc
      const all7Days = [...adjacentCoverage.dailyCoverage, ...currentDailyCoverage];
      const totalMgrHours = Number(
        (partCurrent.managerHours! + partAdjacent.managerHours!).toFixed(1)
      );
      const totalCombinedPlan = Number((firstRow.planHours + prevPlanHours).toFixed(1));
      const recCombined =
        firstRow.hanwRecommendation !== null
          ? Number((firstRow.hanwRecommendation + prevPlanHours).toFixed(1))
          : null;

      leadingBridge = {
        bridgeType: 'leading',
        combinedDateRange,
        totalDaysCount: 7,
        totalFloorHours: 272.0,
        partCurrentMonth: partCurrent,
        partAdjacentMonth: partAdjacent,
        totalCombinedPlanHours: totalCombinedPlan,
        recommendedCombinedHours: recCombined,
        totalCombinedManagerHours: totalMgrHours,
        totalCombinedBaristaPool: Math.max(
          0,
          Number(((recCombined || 272.0) - totalMgrHours).toFixed(1))
        ),
        all7DaysCoverage: all7Days,
        missingAmTotal: all7Days.filter((d) => !d.hasAm).length,
        missingPmTotal: all7Days.filter((d) => !d.hasPm).length,
      };
    }

    // Wybór mostu do podsumowania miesiąca:
    // Jeśli targetPlanningWeek jest cząstkowy, wybieramy odpowiadający mu most
    const targetWeek = rows.find((r) => r.isTargetPlanningWeek);
    if (targetWeek) {
      if (targetWeek.week.week_num_in_month === 'W1' && leadingBridge) return leadingBridge;
      if (targetWeek.week.week_num_in_month !== 'W1' && trailingBridge) return trailingBridge;
    }

    return trailingBridge || leadingBridge || null;
  }
}
