import type { WeekRecord } from '../../../../types';
import { MIN_DAILY_FLOOR_HOURS } from '../../constants';

export class PartialWeekEngine {
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
      // Floor = 4 zmiany × 8h = 32h na każdy dzień tygodnia (minimum operacyjne kawiarni)
      const FLOOR_PER_DAY = MIN_DAILY_FLOOR_HOURS;
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
}
