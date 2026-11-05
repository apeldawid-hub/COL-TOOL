import type {
  ManagerDailyCoverageItem,
  ManagerScheduleShift,
  ShiftDefinition,
  ManagerEmployee,
} from '../../../../types';
import { getPolishTradingSundays } from '../../../managers-schedule/services/managerScheduleEngine';
import { MIN_DAILY_FLOOR_HOURS } from '../../constants';

export class ManagerCoverageEngine {
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
        floorDeficit: Math.max(0, Number((MIN_DAILY_FLOOR_HOURS - dayCovH).toFixed(1))),
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
}
