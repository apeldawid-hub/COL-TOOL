import {
  ManagerEmployee,
  ShiftDefinition,
  ManagerScheduleShift,
  MonthlyNormRecord,
  TorQuarterData,
  TorEmployeeRow,
  TorMonthSummary
} from '../../../types';
import { ManagerScheduleEngine, POLISH_MONTH_NAMES, getPolishHolidays } from './managerScheduleEngine';

export class TorEngine {
  /**
   * Zwraca numery 3 miesięcy dla danego kwartału (1..4)
   */
  public static getQuarterMonths(quarter: 1 | 2 | 3 | 4): [number, number, number] {
    switch (quarter) {
      case 1: return [1, 2, 3];
      case 2: return [4, 5, 6];
      case 3: return [7, 8, 9];
      case 4: return [10, 11, 12];
    }
  }

  /**
   * Zwraca nazwę kwartału
   */
  public static getQuarterName(quarter: 1 | 2 | 3 | 4): string {
    switch (quarter) {
      case 1: return 'Q1 (Styczeń – Marzec)';
      case 2: return 'Q2 (Kwiecień – Czerwiec)';
      case 3: return 'Q3 (Lipiec – Wrzesień)';
      case 4: return 'Q4 (Październik – Grudzień)';
    }
  }

  /**
   * Wyznacza kwartał na podstawie numeru miesiąca (1..12)
   */
  public static getQuarterFromMonth(month: number): 1 | 2 | 3 | 4 {
    if (month <= 3) return 1;
    if (month <= 6) return 2;
    if (month <= 9) return 3;
    return 4;
  }

  /**
   * Główna kalkulacja danych kwartalnych TOR dla podanego roku i kwartału
   */
  public static calculateQuarterData(
    year: number,
    quarter: 1 | 2 | 3 | 4,
    employees: ManagerEmployee[],
    shifts: ManagerScheduleShift[],
    monthlyNorms: Record<number, MonthlyNormRecord | null>,
    actualRcpByMonth?: Record<number, Record<number, number>>,
    hasActualRcpByMonth?: Record<number, boolean>
  ): TorQuarterData {
    const months = this.getQuarterMonths(quarter);
    const holidays = getPolishHolidays(year);
    const monthNames: [string, string, string] = [
      POLISH_MONTH_NAMES[months[0] - 1],
      POLISH_MONTH_NAMES[months[1] - 1],
      POLISH_MONTH_NAMES[months[2] - 1]
    ];

    // Normy dla 3 miesięcy
    const monthNorms: [number, number, number] = [
      monthlyNorms[months[0]]?.full_time_hours ?? ManagerScheduleEngine.calculateMonthNorms(year, months[0]).fullTimeNominalHours,
      monthlyNorms[months[1]]?.full_time_hours ?? ManagerScheduleEngine.calculateMonthNorms(year, months[1]).fullTimeNominalHours,
      monthlyNorms[months[2]]?.full_time_hours ?? ManagerScheduleEngine.calculateMonthNorms(year, months[2]).fullTimeNominalHours
    ];

    // Indeksowanie zmian po kluczu: `${employee_id}_${month}_${day}`
    const shiftMap = new Map<string, ManagerScheduleShift>();
    for (const s of shifts) {
      shiftMap.set(`${s.employee_id}_${s.month}_${s.day}`, s);
    }

    // Aktywne i posortowane osoby w zespole
    const sortedEmployees = [...employees].sort((a, b) => a.sort_order - b.sort_order);

    const rows: TorEmployeeRow[] = sortedEmployees.map(emp => {
      const contractRatio = emp.contract_hours_ratio || 1.0;

      const empMonthSummaries: TorMonthSummary[] = months.map((m, idx) => {
        const fullTimeHours = monthNorms[idx];
        const normHours = Number((fullTimeHours * contractRatio).toFixed(1));
        const daysInMonth = new Date(year, m, 0).getDate();

        let rcpHours = 0;
        let hDays = 0;
        let hHours = 0;
        let l4Days = 0;
        let l4Hours = 0;

        for (let d = 1; d <= daysInMonth; d++) {
          const s = shiftMap.get(`${emp.id}_${m}_${d}`);
          if (!s) continue;

          const date = new Date(year, m - 1, d);
          const dayOfWeek = date.getDay();
          const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          const isHoliday = holidays.has(dateStr);
          const isNonWorkingDay = isWeekend || isHoliday;

          const code = s.shift_code;
          if (code === 'H') {
            hDays++;
            // Urlop nie liczy się w weekendy i święta państwowe (0.0h)
            const dayH = isNonWorkingDay ? 0.0 : (s.hours > 0 ? s.hours : Number((8.0 * contractRatio).toFixed(1)));
            hHours += dayH;
          } else if (code === 'L4') {
            l4Days++;
            // L4 wlicza się do etatu w dni robocze (0h w dni wolne)
            const dayL4 = isNonWorkingDay ? 0.0 : (s.hours > 0 ? s.hours : Number((8.0 * contractRatio).toFixed(1)));
            l4Hours += dayL4;
          } else if (s.hours > 0 && !['OFF', 'M', 'Z', 'FULL'].includes(code)) {
            rcpHours += s.hours;
          }
        }

        const isMonthClosed = ManagerScheduleEngine.isMonthClosed(year, m);
        const hasActualRcp = Boolean(
          hasActualRcpByMonth?.[m] || 
          (isMonthClosed && actualRcpByMonth?.[emp.id]?.[m] !== undefined)
        );

        // Jeśli są zarejestrowane godziny logowań z systemu MAPAL — zasilają one kolumnę RCP
        if (hasActualRcp && actualRcpByMonth?.[emp.id]?.[m] !== undefined) {
          rcpHours = actualRcpByMonth[emp.id][m];
        } else {
          rcpHours = Number(rcpHours.toFixed(1));
        }

        hHours = Number(hHours.toFixed(1));
        l4Hours = Number(l4Hours.toFixed(1));
        const totalHours = Number((rcpHours + hHours + l4Hours).toFixed(1));
        const balanceHours = Number((totalHours - normHours).toFixed(1));

        return {
          year,
          month: m,
          monthName: monthNames[idx],
          contractType: emp.contract_type,
          contractRatio,
          rcpHours,
          hDays,
          hHours,
          l4Days,
          l4Hours,
          totalHours,
          normHours,
          balanceHours,
          isRcpFromActuals: hasActualRcp
        };
      });

      const quarterTotalBalance = Number(
        (empMonthSummaries[0].balanceHours + empMonthSummaries[1].balanceHours + empMonthSummaries[2].balanceHours).toFixed(1)
      );

      let quarterStatus: 'OK' | 'nadgodziny' | 'niedogodziny' = 'OK';
      if (quarterTotalBalance > 0.1) {
        quarterStatus = 'nadgodziny';
      } else if (quarterTotalBalance < -0.1) {
        quarterStatus = 'niedogodziny';
      }

      return {
        employee: emp,
        months: [empMonthSummaries[0], empMonthSummaries[1], empMonthSummaries[2]],
        quarterTotalBalance,
        quarterStatus
      };
    });

    // Podsumowania zespołu
    let totalTeamRcp = 0;
    let totalTeamH = 0;
    let totalTeamL4 = 0;
    let totalTeamHours = 0;
    let totalTeamBalance = 0;

    for (const r of rows) {
      for (const m of r.months) {
        totalTeamRcp += m.rcpHours;
        totalTeamH += m.hHours;
        totalTeamL4 += m.l4Hours;
        totalTeamHours += m.totalHours;
      }
      totalTeamBalance += r.quarterTotalBalance;
    }

    return {
      year,
      quarter,
      quarterName: this.getQuarterName(quarter),
      monthNames,
      monthNorms,
      rows,
      totalTeamRcp: Number(totalTeamRcp.toFixed(1)),
      totalTeamH: Number(totalTeamH.toFixed(1)),
      totalTeamL4: Number(totalTeamL4.toFixed(1)),
      totalTeamHours: Number(totalTeamHours.toFixed(1)),
      totalTeamBalance: Number(totalTeamBalance.toFixed(1))
    };
  }
}
