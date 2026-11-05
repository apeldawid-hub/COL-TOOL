import type {
  WeeklyCalculatedRow,
  CrossMonthBridge,
  CrossMonthBridgePart,
  ManagerScheduleShift,
  ShiftDefinition,
  ManagerEmployee,
} from '../../../../types';
import { ManagerCoverageEngine } from './managerCoverageEngine';
import { MIN_WEEKLY_FLOOR_HOURS } from '../../constants';

export class CrossMonthBridgeEngine {
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
      const nextFloorHours = Number((MIN_WEEKLY_FLOOR_HOURS - lastRow.calculatedFloorHours).toFixed(1));

      // Szacunkowy plan godzin kolejnego miesiąca
      const nextPlanHours = Number(
        ((nextFloorHours / MIN_WEEKLY_FLOOR_HOURS) * (lastRow.planHours / (lastRow.calculatedDaysCount / 7))).toFixed(1)
      ) || nextFloorHours;

      // Obsada menedżerska w kolejnym miesiącu
      const adjacentDays = Array.from({ length: remainingDays }, (_, i) => i + 1);
      const adjacentCoverage = ManagerCoverageEngine.calculateDaysManagerCoverage(
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
        totalFloorHours: MIN_WEEKLY_FLOOR_HOURS,
        partCurrentMonth: partCurrent,
        partAdjacentMonth: partAdjacent,
        totalCombinedPlanHours: totalCombinedPlan,
        recommendedCombinedHours: recCombined,
        totalCombinedManagerHours: totalMgrHours,
        totalCombinedBaristaPool: Math.max(
          0,
          Number(((recCombined || MIN_WEEKLY_FLOOR_HOURS) - totalMgrHours).toFixed(1))
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

      const prevFloorHours = Number((MIN_WEEKLY_FLOOR_HOURS - firstRow.calculatedFloorHours).toFixed(1));
      const prevPlanHours = Number(
        ((prevFloorHours / MIN_WEEKLY_FLOOR_HOURS) * (firstRow.planHours / (firstRow.calculatedDaysCount / 7))).toFixed(1)
      ) || prevFloorHours;

      // Obsada menedżerska w poprzednim miesiącu
      const adjacentDays: number[] = [];
      for (let d = startPrevDay; d <= daysInPrevMonth; d++) adjacentDays.push(d);

      const adjacentCoverage = ManagerCoverageEngine.calculateDaysManagerCoverage(
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
        totalFloorHours: MIN_WEEKLY_FLOOR_HOURS,
        partCurrentMonth: partCurrent,
        partAdjacentMonth: partAdjacent,
        totalCombinedPlanHours: totalCombinedPlan,
        recommendedCombinedHours: recCombined,
        totalCombinedManagerHours: totalMgrHours,
        totalCombinedBaristaPool: Math.max(
          0,
          Number(((recCombined || MIN_WEEKLY_FLOOR_HOURS) - totalMgrHours).toFixed(1))
        ),
        all7DaysCoverage: all7Days,
        missingAmTotal: all7Days.filter((d) => !d.hasAm).length,
        missingPmTotal: all7Days.filter((d) => !d.hasPm).length,
      };
    }

    // Wybór mostu do podsumowania miesiąca:
    const targetWeek = rows.find((r) => r.isTargetPlanningWeek);
    if (targetWeek) {
      if (targetWeek.week.week_num_in_month === 'W1' && leadingBridge) return leadingBridge;
      if (targetWeek.week.week_num_in_month !== 'W1' && trailingBridge) return trailingBridge;
    }

    return trailingBridge || leadingBridge || null;
  }
}
