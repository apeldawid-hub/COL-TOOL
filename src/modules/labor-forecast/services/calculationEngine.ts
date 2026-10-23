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
    const tradingSundays = getPolishTradingSundays(year);
    const dailyCoverage: ManagerDailyCoverageItem[] = [];
    let totalCovH = 0;
    let totalNcH = 0;

    for (const d of days) {
      const dateObj = new Date(year, monthNum - 1, d);
      const dayLabel = dayLabels[dateObj.getDay()];
      const dateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSunday = dayLabel === 'Nd';
      const isTradingSunday = isSunday && tradingSundays.has(dateStr);

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
        isSunday,
        isTradingSunday,
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
   * na podstawie empirycznych wzorców, wag transakcyjno-godzinowych z MAPAL Fichajes oraz
   * statusu Niedzieli Handlowej w CH Janki (zamknięte CH w niedziele wolne vs ~250% popytu w handlowe).
   */
  public static enrichDailyCoverageWithFlex(
    days: ManagerDailyCoverageItem[],
    totalWeekBudget: number,
    dayOfWeekStats: { day_of_week: string; total_hours: number; days_count: number }[] = [],
    year?: number
  ): {
    enrichedDays: ManagerDailyCoverageItem[];
    totalBaseFloorHours: number;
    flexHoursPool: number;
    flexHoursPerDayAvg: number;
    hasTradingSunday: boolean;
  } {
    const targetYear =
      year ||
      days[0]?.year ||
      (days[0]?.date ? parseInt(days[0].date.split('-')[0], 10) : new Date().getFullYear());
    const tradingSundays = getPolishTradingSundays(targetYear);

    // Weryfikacja czy w analizowanym tygodniu występuje Niedziela Handlowa
    const hasTradingSunday = days.some((d) => {
      if (d.dayOfWeek !== 'Nd') return false;
      if (d.isTradingSunday !== undefined) return d.isTradingSunday;
      return Boolean(d.date && tradingSundays.has(d.date));
    });

    // Domyślne wagi rozkładu godzin flex ponad bazowy floor 32.0h/dzień dla kawiarni 108120 Janki:
    // W przypadku Niedzieli Handlowej niedziela otrzymuje 20.0% puli flex (ruch ~250% normy niedzielnej).
    // W przypadku Niedzieli Wolnej od handlu niedziela otrzymuje 0% flex (zamknięte CH, czysty Floor 32h),
    // a zaoszczędzone godziny zasilają piątkowo-sobotni peak w CH Janki!
    let weightsToUse: Record<string, number> = hasTradingSunday
      ? {
          'Sob': 0.220, // Sobota: 22.0% puli flex (największy szczyt handlowy)
          'Nd': 0.200,  // Niedziela Handlowa: 20.0% puli flex (CH Janki w pełni otwarte)
          'Pt': 0.170,  // Piątek: 17.0% puli flex (szczyt popołudniowy)
          'Wt': 0.140,  // Wtorek: 14.0% puli flex
          'Pn': 0.090,  // Poniedziałek: 9.0% puli flex
          'Śr': 0.090,  // Środa: 9.0% puli flex
          'Czw': 0.090, // Czwartek: 9.0% puli flex
        }
      : {
          'Sob': 0.245, // Sobota: 24.5% puli flex (największy szczyt handlowy)
          'Pt': 0.200,  // Piątek: 20.0% puli flex (weekend peak)
          'Wt': 0.190,  // Wtorek: 19.0% puli flex (start tygodnia i dostawy)
          'Pn': 0.125,  // Poniedziałek: 12.5% puli flex
          'Śr': 0.120,  // Środa: 12.0% puli flex
          'Czw': 0.120, // Czwartek: 12.0% puli flex
          'Nd': 0.000,  // Niedziela Niehandlowa: 0.0% flex (zamknięte CH, czysty Floor 32h)
        };

    // Jeśli baza danych posiada historię logowań MAPAL (np. 2024–2026), wyliczamy wagi w 100% dynamicznie
    if (dayOfWeekStats && dayOfWeekStats.length > 0) {
      const flexDeltas: Record<string, number> = {};
      let totalEmpiricalFlex = 0;

      for (const stat of dayOfWeekStats) {
        if (stat.day_of_week && stat.days_count > 0) {
          const dayKey = stat.day_of_week.trim();
          const avgHours = stat.total_hours / stat.days_count;
          let flexOverFloor = Math.max(0.2, avgHours - 32.0);

          // W niedziele niehandlowe blokujemy empiryczny flex, bo CH jest zamknięte:
          if (dayKey === 'Nd' && !hasTradingSunday) {
            flexOverFloor = 0;
          } else if (dayKey === 'Nd' && hasTradingSunday) {
            // W niedzielę handlową ruch dorównuje sobocie:
            flexOverFloor = Math.max(flexOverFloor, 12.0);
          }

          flexDeltas[dayKey] = flexOverFloor;
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
      const isSunday = d.dayOfWeek === 'Nd';
      const isTrading = isSunday
        ? d.isTradingSunday !== undefined
          ? d.isTradingSunday
          : Boolean(d.date && tradingSundays.has(d.date))
        : false;

      // Specjalne operacyjne traktowanie niedzieli niehandlowej (CH Janki zamknięte):
      if (isSunday && !isTrading) {
        const baseFloorHours = 32.0;
        const suggestedFlexHours = 0.0;
        const suggestedTotalDayHours = 32.0;
        const suggestedBaristaHours = Math.max(0, Number((32.0 - d.coverageHours).toFixed(1)));
        const maxBaristaHours = suggestedBaristaHours;
        const manipulationTip =
          '☕ Niedziela wolna od handlu (zamknięte CH Janki). Obsada ściśle na poziomie Floor (32h = 2 AM + 2 PM). Zero nadmiarowych godzin baristycznych.';
        const suggestedExtraShifts = 'Baza Floor (CH nieczynne)';

        return {
          ...d,
          isSunday: true,
          isTradingSunday: false,
          baseFloorHours,
          suggestedFlexHours,
          suggestedTotalDayHours,
          suggestedBaristaHours,
          suggestedExtraShifts,
          dayWeightPercent: 0,
          manipulationMinHours: 32.0,
          manipulationMaxHours: 32.0,
          maxBaristaHours,
          manipulationTip,
        };
      }

      const rawWeight = weightsToUse[d.dayOfWeek] || (1 / (daysCount || 7));
      const normalizedWeight = activeSumWeight > 0 ? rawWeight / activeSumWeight : 1 / (daysCount || 1);

      const baseFloorHours = 32.0;
      const suggestedFlexHours = Number((flexHoursPool * normalizedWeight).toFixed(1));
      const suggestedTotalDayHours = Number((baseFloorHours + suggestedFlexHours).toFixed(1));
      const suggestedBaristaHours = Math.max(0, Number((suggestedTotalDayHours - d.coverageHours).toFixed(1)));
      const extraShiftsCount = Math.round(suggestedFlexHours / 8);
      const shiftPlural =
        extraShiftsCount === 1
          ? 'zmiana'
          : extraShiftsCount >= 2 && extraShiftsCount <= 4
          ? 'zmiany'
          : 'zmian';

      const suggestedExtraShifts =
        isSunday && isTrading
          ? suggestedFlexHours >= 10.0
            ? '+2 zmiany (Szczyt CH)'
            : '+1 zmiana (Szczyt CH)'
          : suggestedFlexHours <= 3.0
          ? 'Baza standardowa'
          : `+${extraShiftsCount > 0 ? extraShiftsCount : 1} ${shiftPlural}`;

      const manipulationMinHours = baseFloorHours;
      const manipulationMaxHours = Number((suggestedTotalDayHours + (extraShiftsCount > 1 ? 8.0 : 4.0)).toFixed(1));
      const maxBaristaHours = Math.max(suggestedBaristaHours, Number((manipulationMaxHours - d.coverageHours).toFixed(1)));

      let manipulationTip = 'Stabilny dzień powszedni — możliwość manewru ±4h do ±8h (1 zmiana).';
      if (d.dayOfWeek === 'Sob') {
        manipulationTip = 'Sobotni szczyt w CH Janki. Nie schodź poniżej rekomendacji baristów.';
      } else if (d.dayOfWeek === 'Pt') {
        manipulationTip = 'Popołudniowy peak weekendowy. Kluczowa obsada 14:00–20:00.';
      } else if (isSunday && isTrading) {
        manipulationTip =
          '🛒 Niedziela Handlowa w CH Janki! Pełny ruch galerii handlowej (~250% zwykłej niedzieli). Zaplanuj min. 2 dodatkowe zmiany baristów w szczycie 13:00–19:00.';
      } else if (d.dayOfWeek === 'Wt') {
        manipulationTip = 'Start tygodnia biznesowego / dostawy. Zalecane wsparcie poranne.';
      } else if (d.dayOfWeek === 'Pn') {
        manipulationTip = 'Dzień planowania i raportów. Możliwość zdjęcia 1 zmiany baristy (-8h).';
      }

      return {
        ...d,
        isSunday,
        isTradingSunday: isTrading,
        baseFloorHours,
        suggestedFlexHours,
        suggestedTotalDayHours,
        suggestedBaristaHours,
        suggestedExtraShifts,
        dayWeightPercent: Number((normalizedWeight * 100).toFixed(1)),
        manipulationMinHours,
        manipulationMaxHours,
        maxBaristaHours,
        manipulationTip,
      };
    });

    return {
      enrichedDays,
      totalBaseFloorHours,
      flexHoursPool,
      flexHoursPerDayAvg,
      hasTradingSunday,
    };
  }

  /**
   * Silnik Predykcji Zespołowej (Multi-Model Ensemble Forecasting):
   * Łączy 3 niezależne modele analityczne w zbalansowaną prognozę z przedziałem ufności:
   * 1. Model AOP MTD Velocity (waga 35–60%) — oficjalna kotwica planu korporacyjnego
   * 2. Krótkoterminowy Run-Rate z wykładniczymi wagami (waga 30–50%) — najnowsza dynamika z ostatnich tygodni
   * 3. Model Sezonowości Bliźniaczej YoY (waga 15–35%) — historyczne wykonanie dla tego samego miesiąca w CH Janki
   */
  public static calculateEnsembleForecast(
    aopPlan: AopPlanRecord,
    historicalPlans: AopPlanRecord[],
    closedRows: WeeklyCalculatedRow[],
    monthTemporalStatus: 'past' | 'current' | 'future',
    planTrxTotal: number,
    targetTplh: number
  ): EnsembleForecastResult {
    const rowsWithTrx = closedRows.filter((r) => r.actualTrx !== null && r.actualTrx > 0);
    const planTrxForTrend = rowsWithTrx.reduce((s, r) => s + r.planTrx, 0);
    const actTrxForTrend = rowsWithTrx.reduce((s, r) => s + (r.actualTrx || 0), 0);

    // 1. Model AOP MTD:
    let aopVelocity = 1.0;
    if (monthTemporalStatus === 'past' && aopPlan.actual_trx && aopPlan.actual_trx > 0 && planTrxTotal > 0) {
      aopVelocity = Number((aopPlan.actual_trx / planTrxTotal).toFixed(4));
    } else if (rowsWithTrx.length > 0 && planTrxForTrend > 0) {
      aopVelocity = Number((actTrxForTrend / planTrxForTrend).toFixed(4));
    }

    // 2. Model Krótkiego Run-Rate (Wykładnicza Recencja):
    let runRateVelocity = aopVelocity;
    let hasRunRateData = false;
    if (rowsWithTrx.length > 1) {
      hasRunRateData = true;
      let weightedSum = 0;
      let totalWeight = 0;
      rowsWithTrx.forEach((r, idx) => {
        const weekRatio = (r.actualTrx || 0) / (r.planTrx || 1);
        const weight = Math.pow(1.8, idx);
        weightedSum += weekRatio * weight;
        totalWeight += weight;
      });
      if (totalWeight > 0) {
        runRateVelocity = Number((weightedSum / totalWeight).toFixed(4));
      }
    } else if (rowsWithTrx.length === 1) {
      runRateVelocity = aopVelocity;
      hasRunRateData = true;
    }

    // 3. Model Sezonowości Bliźniaczej YoY:
    let yoyVelocity = 1.0;
    let hasYoYData = false;
    const sameMonthHistory = (historicalPlans || []).filter(
      (p) =>
        p.month === aopPlan.month &&
        p.year < aopPlan.year &&
        typeof p.actual_trx === 'number' &&
        p.actual_trx > 0 &&
        typeof p.plan_trx === 'number' &&
        p.plan_trx > 0
    );

    if (sameMonthHistory.length > 0) {
      hasYoYData = true;
      const totalHistPlan = sameMonthHistory.reduce((sum, p) => sum + (p.plan_trx || 0), 0);
      const totalHistAct = sameMonthHistory.reduce((sum, p) => sum + (p.actual_trx || 0), 0);
      if (totalHistPlan > 0) {
        yoyVelocity = Number((totalHistAct / totalHistPlan).toFixed(4));
      }
    } else {
      const anyHistory = (historicalPlans || []).filter(
        (p) =>
          typeof p.actual_trx === 'number' &&
          p.actual_trx > 0 &&
          typeof p.plan_trx === 'number' &&
          p.plan_trx > 0
      );
      if (anyHistory.length > 0) {
        const totalHistPlan = anyHistory.reduce((sum, p) => sum + (p.plan_trx || 0), 0);
        const totalHistAct = anyHistory.reduce((sum, p) => sum + (p.actual_trx || 0), 0);
        if (totalHistPlan > 0) {
          yoyVelocity = Number((totalHistAct / totalHistPlan).toFixed(4));
        }
      }
    }

    // 4. Dobór Wag Zespołu (Ensemble Weight Optimization):
    let aopWeight = 0.50;
    let runRateWeight = 0.30;
    let yoyWeight = 0.20;

    if (monthTemporalStatus === 'past') {
      aopWeight = 1.0;
      runRateWeight = 0.0;
      yoyWeight = 0.0;
    } else if (rowsWithTrx.length === 0) {
      if (hasYoYData) {
        aopWeight = 0.65;
        yoyWeight = 0.35;
        runRateWeight = 0.0;
      } else {
        aopWeight = 1.0;
        yoyWeight = 0.0;
        runRateWeight = 0.0;
      }
    } else if (rowsWithTrx.length === 1) {
      aopWeight = 0.50;
      runRateWeight = 0.30;
      yoyWeight = hasYoYData ? 0.20 : 0.0;
      if (!hasYoYData) {
        aopWeight = 0.60;
        runRateWeight = 0.40;
      }
    } else {
      aopWeight = 0.35;
      runRateWeight = 0.50;
      yoyWeight = hasYoYData ? 0.15 : 0.0;
      if (!hasYoYData) {
        aopWeight = 0.40;
        runRateWeight = 0.60;
      }
    }

    const sumW = aopWeight + runRateWeight + yoyWeight;
    aopWeight = Number((aopWeight / sumW).toFixed(2));
    runRateWeight = Number((runRateWeight / sumW).toFixed(2));
    yoyWeight = Number((1 - aopWeight - runRateWeight).toFixed(2));

    const blendedVelocity = Number(
      (aopWeight * aopVelocity + runRateWeight * runRateVelocity + yoyWeight * yoyVelocity).toFixed(4)
    );

    const allVelocities = [aopVelocity, runRateVelocity, yoyVelocity].filter((v) => v > 0);
    const minVel = Math.min(...allVelocities);
    const maxVel = Math.max(...allVelocities);

    const minFactor = Math.max(0.85, Math.min(blendedVelocity * 0.985, minVel));
    const maxFactor = Math.min(1.25, Math.max(blendedVelocity * 1.015, maxVel));

    let confidenceScore = 75;
    if (monthTemporalStatus === 'past') confidenceScore = 100;
    else {
      if (rowsWithTrx.length >= 2) confidenceScore += 15;
      else if (rowsWithTrx.length === 1) confidenceScore += 8;
      if (hasYoYData) confidenceScore += 7;
      if (Math.abs(maxFactor - minFactor) < 0.06) confidenceScore += 3;
    }
    confidenceScore = Math.min(99, confidenceScore);

    return {
      aopVelocity,
      runRateVelocity,
      yoyVelocity,
      blendedVelocity,
      weights: { aopWeight, runRateWeight, yoyWeight },
      forecastTrxRange: {
        min: Math.round(planTrxTotal * minFactor),
        expected: Math.round(planTrxTotal * blendedVelocity),
        max: Math.round(planTrxTotal * maxFactor),
      },
      earnedLaborRange: {
        floorSafe: Number(((planTrxTotal * minFactor) / targetTplh).toFixed(1)),
        balanced: Number(((planTrxTotal * blendedVelocity) / targetTplh).toFixed(1)),
        growth: Number(((planTrxTotal * maxFactor) / targetTplh).toFixed(1)),
      },
      confidenceScore,
      modelExplanation: `Zespół 3 modeli: AOP (${Math.round(aopWeight * 100)}%), Run-Rate (${Math.round(runRateWeight * 100)}%), Sezonowość YoY (${Math.round(yoyWeight * 100)}%).`,
      hasYoYData,
      hasRunRateData,
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

      // Suma floor pełnego tygodnia to zawsze 224.0 h (7 dni * 32.0 h/dzień)
      const nextFloorHours = Number((224.0 - lastRow.calculatedFloorHours).toFixed(1));

      // Szacunkowy plan godzin kolejnego miesiąca
      const nextPlanHours = Number(
        ((nextFloorHours / 224.0) * (lastRow.planHours / (lastRow.calculatedDaysCount / 7))).toFixed(1)
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
        totalFloorHours: 224.0,
        partCurrentMonth: partCurrent,
        partAdjacentMonth: partAdjacent,
        totalCombinedPlanHours: totalCombinedPlan,
        recommendedCombinedHours: recCombined,
        totalCombinedManagerHours: totalMgrHours,
        totalCombinedBaristaPool: Math.max(
          0,
          Number(((recCombined || 224.0) - totalMgrHours).toFixed(1))
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

      const prevFloorHours = Number((224.0 - firstRow.calculatedFloorHours).toFixed(1));
      const prevPlanHours = Number(
        ((prevFloorHours / 224.0) * (firstRow.planHours / (firstRow.calculatedDaysCount / 7))).toFixed(1)
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
        totalFloorHours: 224.0,
        partCurrentMonth: partCurrent,
        partAdjacentMonth: partAdjacent,
        totalCombinedPlanHours: totalCombinedPlan,
        recommendedCombinedHours: recCombined,
        totalCombinedManagerHours: totalMgrHours,
        totalCombinedBaristaPool: Math.max(
          0,
          Number(((recCombined || 224.0) - totalMgrHours).toFixed(1))
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
