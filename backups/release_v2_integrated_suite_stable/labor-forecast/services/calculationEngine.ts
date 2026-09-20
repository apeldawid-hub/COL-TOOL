import {
  AopPlanRecord,
  WeekRecord,
  WeeklyCalculatedRow,
  MonthlyCalculationSummary,
  PlanningCadenceInfo,
  CrossMonthBridge,
  TrendLearningSummary,
  NcRuleRecord,
  ManagerScheduleShift,
  ShiftDefinition,
  ManagerEmployee,
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
      const actHours =
        actHoursVal !== undefined && actHoursVal > 0 ? Number(actHoursVal.toFixed(1)) : null;

      const actTplh =
        actTrx !== null && actTrx > 0 && actHours !== null && actHours > 0
          ? Number((actTrx / actHours).toFixed(2))
          : null;

      const schedHoursVal = weeklyScheduledHoursMap[w.week_key];
      const scheduledHours =
        schedHoursVal !== undefined && schedHoursVal > 0 ? Number(schedHoursVal.toFixed(1)) : null;

      // Złota reguła operacyjna:
      // Tydzień uznaje się za ZAMKNIĘTY, gdy:
      // 1. Cały miesiąc jest już przeszły (monthTemporalStatus === 'past')
      // 2. LUB tydzień minął już w czasie (temporalStatus === 'past') i posiada zarejestrowane godziny RCP lub transakcje
      const isClosed =
        monthTemporalStatus === 'past' ||
        (temporalStatus === 'past' && ((actHours !== null && actHours > 0) || (actTrx !== null && actTrx > 0)));

      const dataCompletionNotice = isInProgress
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
      if (monthTemporalStatus === 'past' || row.isClosed) {
        rowStatus = 'closed';
      } else if (isTarget) {
        rowStatus = 'target_planning';
      } else if (isPub) {
        rowStatus = 'published';
      } else if (isCurrentCal) {
        rowStatus = 'current';
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
      const managerDailyCoverage: Array<{
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
        floorDeficit: number;
      }> = [];

      let startDay = 1;
      let endDay = 7;
      if (row.week.date_from && row.week.date_to && row.week.date_from.includes('.') && row.week.date_to.includes('.')) {
        startDay = parseInt(row.week.date_from.split('.')[0], 10);
        endDay = parseInt(row.week.date_to.split('.')[0], 10);
      }

      const dayLabels = ['Nd', 'Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];
      const monthNamesList = [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
      ];
      const monthNum = monthNamesList.indexOf(aopPlan.month) + 1 || 9;

      if (startDay <= endDay && managerShifts && managerShifts.length > 0) {
        for (let d = startDay; d <= endDay; d++) {
          const dateObj = new Date(aopPlan.year, monthNum - 1, d);
          const dayLabel = dayLabels[dateObj.getDay()];
          const dateStr = `${aopPlan.year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

          const dayShifts = managerShifts.filter(s => s.day === d);
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

            const shiftDef = shiftDefinitions.find(sd => sd.code === code);
            const emp = managerEmployees.find(e => e.id === s.employee_id);
            const empDisplayName = emp ? emp.name : `MGR ${s.employee_id}`;

            const isNc = shiftDef?.is_nc === 1 || ['NC', 'TAM', 'TPM', 'T', 'PRE', 'MEE', 'BT'].includes(code);

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

          weekManagerCoverageHours += dayCovH;
          weekManagerNcHours += dayNcH;

          managerDailyCoverage.push({
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
            floorDeficit: Math.max(0, Number((32.0 - dayCovH).toFixed(1)))
          });
        }
      }

      const managerCoverageHours = Number(weekManagerCoverageHours.toFixed(1));
      const managerNcHours = Number(weekManagerNcHours.toFixed(1));
      const managerHours = Number((managerCoverageHours + managerNcHours).toFixed(1));

      const baseBudgetForBaristas = (rowStatus === 'target_planning' || rowStatus === 'published') && hanwFinal
        ? hanwFinal
        : row.planHours;
      const baristaHoursPool = Math.max(0, Number((baseBudgetForBaristas - managerHours).toFixed(1)));

      const baristaScheduledHours = row.scheduledHours !== null
        ? Math.max(0, Number((row.scheduledHours - managerHours).toFixed(1)))
        : null;

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
    const crossMonthBridge = CalculationEngine.calculateCrossMonthBridge(rowsWithHanw, aopPlan.year, aopPlan.month);

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
    currentMonth: string
  ): CrossMonthBridge | null {
    if (rows.length === 0) return null;

    const MONTHS = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    const monthIdx = MONTHS.indexOf(currentMonth);

    // 1. Sprawdzamy przełom z kolejnym miesiącem (trailing bridge na ostatnim tygodniu)
    const lastRow = rows[rows.length - 1];
    if (lastRow.isPartial && lastRow.calculatedDaysCount < 7) {
      const remainingDays = 7 - lastRow.calculatedDaysCount;
      const nextMonthIdx = (monthIdx + 1) % 12;
      const nextMonthName = MONTHS[nextMonthIdx];
      const nextYear = nextMonthIdx === 0 ? currentYear + 1 : currentYear;

      const pad = (n: number) => String(n).padStart(2, '0');
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

      return {
        bridgeType: 'trailing',
        combinedDateRange,
        totalDaysCount: 7,
        totalFloorHours: 272.0,
        partCurrentMonth: {
          weekKey: lastRow.week.week_key,
          year: currentYear,
          monthName: currentMonth,
          weekNum: lastRow.week.week_num_in_month,
          dates: `${lastRow.week.date_from} – ${lastRow.week.date_to}`,
          daysCount: lastRow.calculatedDaysCount,
          floorHours: lastRow.calculatedFloorHours,
          planHours: lastRow.planHours,
          activeDays: lastRow.activeDayNames,
        },
        partAdjacentMonth: {
          weekKey: `${nextYear}_${nextMonthName}_W1`,
          year: nextYear,
          monthName: nextMonthName,
          weekNum: 'W1',
          dates: nextMonthDates,
          daysCount: remainingDays,
          floorHours: nextFloorHours,
          planHours: nextPlanHours,
          activeDays: ['Czw', 'Pt', 'Sob', 'Nd', 'Pn'].slice(0, remainingDays),
        },
        totalCombinedPlanHours: Number((lastRow.planHours + nextPlanHours).toFixed(1)),
        recommendedCombinedHours:
          lastRow.hanwRecommendation !== null
            ? Number((lastRow.hanwRecommendation + nextPlanHours).toFixed(1))
            : null,
      };
    }

    return null;
  }
}
