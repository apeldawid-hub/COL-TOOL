import type { ManagerDailyCoverageItem } from '../../../../types';
import { getPolishTradingSundays } from '../../../managers-schedule/services/managerScheduleEngine';
import { MIN_DAILY_FLOOR_HOURS } from '../../constants';

export class FlexAllocationEngine {
  /**
   * Wylicza dystrybucję puli manipulacji zmianami (godzin ponad floor 32h) na poszczególne dni tygodnia
   * na podstawie empirycznych wzorców, wag transakcyjno-godzinowych z MAPAL Fichajes oraz
   * statusu Niedzieli Handlowej w centrach handlowych.
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

    // Domyślne wagi rozkładu godzin flex ponad bazowy floor 32.0h/dzień
    let weightsToUse: Record<string, number> = hasTradingSunday
      ? {
          'Sob': 0.220, // Sobota: 22.0% puli flex (największy szczyt handlowy)
          'Nd': 0.200,  // Niedziela Handlowa: 20.0% puli flex (pełny ruch handlowy)
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

    // Jeśli baza danych posiada historię logowań MAPAL, wyliczamy wagi dynamicznie
    if (dayOfWeekStats && dayOfWeekStats.length > 0) {
      const flexDeltas: Record<string, number> = {};
      let totalEmpiricalFlex = 0;

      for (const stat of dayOfWeekStats) {
        if (stat.day_of_week && stat.days_count > 0) {
          const dayKey = stat.day_of_week.trim();
          const avgHours = stat.total_hours / stat.days_count;
          let flexOverFloor = Math.max(0.2, avgHours - MIN_DAILY_FLOOR_HOURS);

          // W niedziele niehandlowe blokujemy empiryczny flex w CH:
          if (dayKey === 'Nd' && !hasTradingSunday) {
            flexOverFloor = 0;
          } else if (dayKey === 'Nd' && hasTradingSunday) {
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
    const totalBaseFloorHours = daysCount * MIN_DAILY_FLOOR_HOURS;
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

      // Specjalne operacyjne traktowanie niedzieli niehandlowej (CH zamknięte):
      if (isSunday && !isTrading) {
        const baseFloorHours = MIN_DAILY_FLOOR_HOURS;
        const suggestedFlexHours = 0.0;
        const suggestedTotalDayHours = MIN_DAILY_FLOOR_HOURS;
        const suggestedBaristaHours = Math.max(0, Number((MIN_DAILY_FLOOR_HOURS - d.coverageHours).toFixed(1)));
        const maxBaristaHours = suggestedBaristaHours;
        const manipulationTip =
          '☕ Niedziela wolna od handlu (zamknięte CH). Obsada ściśle na poziomie Floor (32h = 2 AM + 2 PM). Zero nadmiarowych godzin baristycznych.';
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
          manipulationMinHours: MIN_DAILY_FLOOR_HOURS,
          manipulationMaxHours: MIN_DAILY_FLOOR_HOURS,
          maxBaristaHours,
          manipulationTip,
        };
      }

      const rawWeight = weightsToUse[d.dayOfWeek] || (1 / (daysCount || 7));
      const normalizedWeight = activeSumWeight > 0 ? rawWeight / activeSumWeight : 1 / (daysCount || 1);

      const baseFloorHours = MIN_DAILY_FLOOR_HOURS;
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
        manipulationTip = 'Sobotni szczyt w CH. Nie schodź poniżej rekomendacji baristów.';
      } else if (d.dayOfWeek === 'Pt') {
        manipulationTip = 'Popołudniowy peak weekendowy. Kluczowa obsada 14:00–20:00.';
      } else if (isSunday && isTrading) {
        manipulationTip =
          '🛒 Niedziela Handlowa w CH! Pełny ruch galerii handlowej (~250% zwykłej niedzieli). Zaplanuj min. 2 dodatkowe zmiany baristów w szczycie 13:00–19:00.';
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
}
