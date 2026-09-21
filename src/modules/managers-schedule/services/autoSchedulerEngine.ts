import {
  ManagerEmployee,
  ShiftDefinition,
  ManagerScheduleShift,
  LaborLawViolation
} from '../../../types/index';
import {
  getPolishHolidays,
  getPolishTradingSundays,
  ManagerScheduleEngine,
  resolveEffectiveShiftTimes,
  formatHoursToTimeString,
  FLEXIBLE_ADMIN_SHIFT_CODES,
  parseTimeToHours
} from './managerScheduleEngine';

function formatDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Numer tygodnia biznesowego w miesiącu (0..5, poniedziałek = początek tygodnia) */
function getDayWeekIndex(year: number, month: number, d: number): number {
  const dt = new Date(year, month - 1, d);
  const dayOfWeek = (dt.getDay() + 6) % 7; // 0 = Pn, 6 = Nd
  const mondayNum = d - dayOfWeek;
  return Math.max(0, Math.floor((mondayNum + 6) / 7));
}

export interface AutoScheduleOptions {
  mode: 'smart_full' | 'fill_gaps' | 'pinned_only';
  /** Przydział dodatkowych zmian MID/MIB przy nadmiarze godzin zespołu w dniach szczytowych (Soboty, Piątki, Niedziele handlowe) */
  allocateMidInPeaks: boolean;
  /** Preferowane dni pod MID */
  peakDaysPreference?: ('friday' | 'saturday' | 'sunday_trading' | 'thursday')[];
  /** Respektowanie deklaracji dyspozycyjności z matrycy (M/Z/FULL/OFF) */
  respectDispositions: boolean;
  /** Zachowanie i ochrona wprowadzonych zmian administracyjnych NC, szkoleń T, wyjazdów BT i wsparć SUP */
  preserveFixedShifts: boolean;
  /** Preferowanie 2-dniowych bloków dni wolnych (OFF) */
  preferConsecutiveOffDays: boolean;
  /** Równomierny podział trudnych dyżurów (weekendów i zamknięć) */
  balanceFairness?: boolean;
  /** Wygładzanie obciążenia w poszczególnych tygodniach */
  smoothWeeklyHours?: boolean;
  /** Zbiór kluczy przypiętych komórek: "empId_day" */
  pinnedCells?: Set<string>;
  /** Liczba symulacji turniejowych Monte Carlo (domyślnie 2 000 prób) */
  iterationsCount?: number;
}

export interface AutoScheduleProgress {
  currentRound: number;
  totalRounds: number;
  percent: number;
  bestDispoMatchRate: number;
  bestViolationsCount: number;
  bestPlannedHours: number;
  targetTeamHours: number;
  elapsedMs: number;
}

export interface ShiftDiffItem {
  employeeId: number;
  employeeName: string;
  day: number;
  date: string;
  dayName: string;
  prevShiftCode: string;
  newShiftCode: string;
  disposition?: string;
  isFixed: boolean;
  isPinned: boolean;
  changeType: 'unchanged' | 'assigned' | 'modified' | 'cleared';
}

export interface AutoScheduleEmployeeStat {
  employeeId: number;
  name: string;
  role: string;
  contractRatio: number;
  nominalHours: number;
  plannedHours: number;
  balanceHours: number;
  deltaHours?: number;
  workingDaysCount: number;
  offDaysCount: number;
  weekendDaysCount: number;
  openingShifts?: number;
  closingShifts?: number;
  midShifts?: number;
  ncShifts?: number;
  weekendDaysWorked?: number;
  sundaysWorked: number;
  dispositionMatchRate: number;
  dispositionDetails: {
    total: number;
    matched: number;
  };
}

export interface ConflictNegotiationOption {
  id: string;
  title: string;
  description: string;
  type: 'compensate_off' | 'shift_swap' | 'support_shift' | 'contract_flex';
  actionLabel: string;
  copyMessageText?: string;
  suggestedTargetDay?: number;
  suggestedTargetEmployeeId?: number;
  suggestedTargetEmployeeName?: string;
  suggestedShiftCode?: string;
}

export interface ConflictInsight {
  id: string;
  employeeId: number;
  employeeName: string;
  day: number;
  date: string;
  dayName: string;
  requestedDispo: string;
  assignedShiftCode: string;
  assignedHours: number;
  reason: string;
  details: string;
  severity: 'critical' | 'warning' | 'info';
  suggestion?: string;
  blockers?: string[];
  negotiationOptions?: ConflictNegotiationOption[];
}

export interface AutoScheduleQualityMetrics {
  weekendFairnessScore: number;
  closingsFairnessScore: number;
  weeklySmoothingScore: number;
  consecutiveOffBlocksCount: number;
  isolatedSingleOffCount: number;
  fullWeekendsOffCount: number;
  totalEmployeesCount: number;
}

export interface AutoScheduleResult {
  year: number;
  month: number;
  generatedShifts: ManagerScheduleShift[];
  diffs: ShiftDiffItem[];
  stats: {
    totalPlannedHours: number;
    targetTeamHours: number;
    dispositionMatchRate: number;
    dispositionTotalCount: number;
    dispositionMatchedCount: number;
    coverageDaysCount: number;
    missingCoverageCount: number;
    violationsCount: number;
    midShiftsCount: number;
    openingShiftsCount: number;
    closingShiftsCount: number;
    ncShiftsCount: number;
    iterationsEvaluated?: number;
    qualityMetrics?: AutoScheduleQualityMetrics;
  };
  employeeStats: AutoScheduleEmployeeStat[];
  violations: LaborLawViolation[];
  compromises: string[];
  conflictInsights?: ConflictInsight[];
}

/** Zmiany stałe / nienaruszalne w trybie Smart Full */
const FIXED_SHIFT_CODES = new Set([
  'H', 'L4', 'NC', 'BT', 'T', 'TAM', 'TPM', 'PRE', 'MEE', 'SUP', 'SAM', 'SPM', 'RET'
]);

interface PrecomputedContext {
  year: number;
  month: number;
  totalDays: number;
  fullTimeNorm: number;
  shiftMap: Map<string, ShiftDefinition>;
  originalShiftsMap: Map<string, ManagerScheduleShift>;
  lockedCells: Set<string>;
  baseScheduleMap: Map<string, ManagerScheduleShift>;

  dayOfWeek: number[]; // 0=Nd, 1=Pn...
  dateStr: string[];
  isSunday: boolean[];
  isTradingSunday: boolean[];
  isHoliday: boolean[];
  isPeak: boolean[];
  weekIdx: number[];

  teamTargetNominalHours: number;
  empNominals: Map<number, number>;
  prevMonthEmpStats: Map<number, {
    workedLastSaturday: boolean;
    workedLastSunday: boolean;
    workedLastWeekend: boolean;
    consecutiveWorkDaysEnding: number;
  }>;
  prevMonthLastDay: number;

  daySlotTemplates: {
    day: number;
    isSunday: boolean;
    isPeak: boolean;
    dayOfWeek: number;
    neededOpening: boolean;
    neededClosing: boolean;
    neededMid: boolean;
  }[];
}

interface FastCandidateResult {
  workingSchedule: Map<string, ManagerScheduleShift>;
  fitness: number;
  violationsCount: number;
  missingCoverageCount: number;
  dispoMatchRate: number;
  totalPlannedHours: number;
  compromises: string[];
}

export class AutoSchedulerEngine {
  /**
   * Pre-kalkulacja statycznego kontekstu miesiąca wykonywana dokładnie 1 raz przed pętlą symulacji.
   * Eliminuje wielokrotne tworzenie obiektów Date, ciągów znaków i powtarzających się kalkulacji.
   */
  private static precomputeContext(
    year: number,
    month: number,
    employees: ManagerEmployee[],
    shiftDefinitions: ShiftDefinition[],
    existingShifts: ManagerScheduleShift[],
    dispositionsByEmployee: Record<number, Record<number, string>>,
    options: AutoScheduleOptions,
    prevMonthShifts: ManagerScheduleShift[] = []
  ): PrecomputedContext {
    const totalDays = getDaysInMonth(year, month);
    const holidays = getPolishHolidays(year);
    const tradingSundays = getPolishTradingSundays(year);
    const pinned = options.pinnedCells || new Set<string>();

    const monthlyNorm = ManagerScheduleEngine.calculateMonthNorms(year, month);
    const fullTimeNorm = monthlyNorm.fullTimeNominalHours;

    const shiftMap = new Map<string, ShiftDefinition>();
    shiftDefinitions.forEach(def => shiftMap.set(def.code, def));

    const originalShiftsMap = new Map<string, ManagerScheduleShift>();
    existingShifts.forEach(s => {
      originalShiftsMap.set(`${s.employee_id}_${s.day}`, s);
    });

    const dayOfWeek: number[] = new Array(totalDays + 1);
    const dateStr: string[] = new Array(totalDays + 1);
    const isSunday: boolean[] = new Array(totalDays + 1);
    const isTradingSunday: boolean[] = new Array(totalDays + 1);
    const isHoliday: boolean[] = new Array(totalDays + 1);
    const isPeak: boolean[] = new Array(totalDays + 1);
    const weekIdx: number[] = new Array(totalDays + 1);

    for (let day = 1; day <= totalDays; day++) {
      const dt = new Date(year, month - 1, day);
      const dow = dt.getDay();
      const ds = formatDateIso(dt);
      const isSun = dow === 0;
      const isTrad = isSun && tradingSundays.has(ds);
      const isHol = holidays.has(ds);

      dayOfWeek[day] = dow;
      dateStr[day] = ds;
      isSunday[day] = isSun;
      isTradingSunday[day] = isTrad;
      isHoliday[day] = isHol;
      isPeak[day] = dow === 6 || dow === 5 || isTrad;
      weekIdx[day] = getDayWeekIndex(year, month, day);
    }

    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    const prevMonthEmpStats = new Map<number, {
      workedLastSaturday: boolean;
      workedLastSunday: boolean;
      workedLastWeekend: boolean;
      consecutiveWorkDaysEnding: number;
    }>();

    employees.forEach(emp => {
      let workedLastSat = false;
      let workedLastSun = false;
      let streak = 0;

      if (prevMonthShifts.length > 0) {
        const prevMonth = month === 1 ? 12 : month - 1;
        const prevYear = month === 1 ? year - 1 : year;

        for (let d = prevMonthLastDay; d >= Math.max(1, prevMonthLastDay - 7); d--) {
          const dt = new Date(prevYear, prevMonth - 1, d);
          const dow = dt.getDay();
          const ps = prevMonthShifts.find(s => s.employee_id === emp.id && s.day === d);
          const isWork = ps && ps.hours > 0 && ps.shift_code !== 'OFF' && ps.shift_code !== 'H' && ps.shift_code !== 'L4';
          if (dow === 6 && !workedLastSat && isWork) workedLastSat = true;
          if (dow === 0 && !workedLastSun && isWork) workedLastSun = true;
        }

        for (let d = prevMonthLastDay; d >= Math.max(1, prevMonthLastDay - 6); d--) {
          const ps = prevMonthShifts.find(s => s.employee_id === emp.id && s.day === d);
          if (ps && ps.hours > 0 && ps.shift_code !== 'OFF') streak++;
          else break;
        }
      }

      prevMonthEmpStats.set(emp.id, {
        workedLastSaturday: workedLastSat,
        workedLastSunday: workedLastSun,
        workedLastWeekend: workedLastSat || workedLastSun,
        consecutiveWorkDaysEnding: streak
      });
    });

    const lockedCells = new Set<string>();
    const baseScheduleMap = new Map<string, ManagerScheduleShift>();

    employees.forEach(emp => {
      for (let day = 1; day <= totalDays; day++) {
        const key = `${emp.id}_${day}`;
        const existing = originalShiftsMap.get(key);
        const dispo = dispositionsByEmployee[emp.id]?.[day] || existing?.disposition || '';

        const baseShift: ManagerScheduleShift = {
          year,
          month,
          day,
          date: dateStr[day],
          employee_id: emp.id,
          shift_code: 'OFF',
          hours: 0.0,
          disposition: dispo
        };

        if (existing) {
          const isPinnedCell = pinned.has(key);
          const isAbsence = existing.shift_code === 'H' || existing.shift_code === 'L4';
          const isFixedCode = FIXED_SHIFT_CODES.has(existing.shift_code);

          if (options.mode === 'fill_gaps') {
            if (existing.shift_code && existing.shift_code !== 'OFF') {
              baseScheduleMap.set(key, { ...existing, disposition: dispo });
              lockedCells.add(key);
              continue;
            }
          } else if (options.mode === 'pinned_only') {
            if (isPinnedCell || isAbsence) {
              baseScheduleMap.set(key, { ...existing, disposition: dispo });
              lockedCells.add(key);
              continue;
            }
          } else {
            if (isPinnedCell || isAbsence || (options.preserveFixedShifts && isFixedCode)) {
              baseScheduleMap.set(key, { ...existing, disposition: dispo });
              lockedCells.add(key);
              continue;
            }
          }
        }

        baseScheduleMap.set(key, baseShift);
      }
    });

    let teamTargetNominalHours = 0;
    const empNominals = new Map<number, number>();
    employees.forEach(emp => {
      const empRatio = emp.contract_hours_ratio || 1.0;
      const nom = Number((fullTimeNorm * empRatio).toFixed(1));
      empNominals.set(emp.id, nom);
      teamTargetNominalHours += nom;
    });

    let totalAssignedHours = 0;
    baseScheduleMap.forEach(s => {
      totalAssignedHours += s.hours;
    });

    const daySlotTemplates = [];
    for (let day = 1; day <= totalDays; day++) {
      let hasOpening = false;
      let hasClosing = false;

      employees.forEach(emp => {
        const key = `${emp.id}_${day}`;
        const shift = baseScheduleMap.get(key);
        if (shift && shift.hours > 0) {
          const code = shift.shift_code;
          if (code === 'AM' || code === 'AMN' || code === 'AMB') hasOpening = true;
          if (code === 'PM' || code === 'PMN' || code === 'PMB') hasClosing = true;
        }
      });

      daySlotTemplates.push({
        day,
        isSunday: isSunday[day],
        isPeak: isPeak[day],
        dayOfWeek: dayOfWeek[day],
        neededOpening: !hasOpening,
        neededClosing: !hasClosing,
        neededMid: false
      });
    }

    let baseHoursNeeded = 0;
    daySlotTemplates.forEach(d => {
      if (d.neededOpening) baseHoursNeeded += d.isSunday ? 6.0 : 8.0;
      if (d.neededClosing) baseHoursNeeded += d.isSunday ? 7.0 : 8.0;
    });

    const surplusHours = teamTargetNominalHours - (totalAssignedHours + baseHoursNeeded);
    if (options.allocateMidInPeaks && surplusHours >= 8.0) {
      let remainingSurplus = surplusHours;
      const peakCandidates = daySlotTemplates.filter(d => !isHoliday[d.day]);
      peakCandidates.sort((a, b) => {
        const getPeakScore = (d: typeof a) => {
          if (d.dayOfWeek === 6) return 10;
          if (d.dayOfWeek === 5) return 8;
          if (isTradingSunday[d.day]) return 7;
          if (d.dayOfWeek === 4) return 5;
          return 1;
        };
        return getPeakScore(b) - getPeakScore(a);
      });

      for (const slot of peakCandidates) {
        if (remainingSurplus < 8.0) break;
        let workingCount = 0;
        employees.forEach(emp => {
          const s = baseScheduleMap.get(`${emp.id}_${slot.day}`);
          if (s && s.hours > 0 && s.shift_code !== 'OFF') workingCount++;
        });

        if (workingCount < 2) {
          slot.neededMid = true;
          remainingSurplus -= 8.0;
        }
      }
    }

    return {
      year,
      month,
      totalDays,
      fullTimeNorm,
      shiftMap,
      originalShiftsMap,
      lockedCells,
      baseScheduleMap,
      dayOfWeek,
      dateStr,
      isSunday,
      isTradingSunday,
      isHoliday,
      isPeak,
      weekIdx,
      teamTargetNominalHours,
      empNominals,
      prevMonthEmpStats,
      prevMonthLastDay,
      daySlotTemplates
    };
  }

  /**
   * Lekki pojedynczy przebieg turniejowy operujący na mapie z pamięci podręcznej (zero zbędnych alokacji).
   */
  private static runFastSinglePass(
    ctx: PrecomputedContext,
    employees: ManagerEmployee[],
    dispositionsByEmployee: Record<number, Record<number, string>>,
    options: AutoScheduleOptions,
    prevMonthShifts: ManagerScheduleShift[],
    jitterSeed: number = 0
  ): FastCandidateResult {
    const {
      year,
      month,
      totalDays,
      shiftMap,
      lockedCells,
      baseScheduleMap,
      dayOfWeek,
      isSunday,
      isHoliday,
      isPeak,
      weekIdx,
      empNominals,
      prevMonthEmpStats,
      prevMonthLastDay,
      daySlotTemplates
    } = ctx;

    // Szybkie klonowanie stanu bazowego
    const workingSchedule = new Map<string, ManagerScheduleShift>();
    baseScheduleMap.forEach((val, key) => {
      workingSchedule.set(key, { ...val });
    });

    const daySlots = daySlotTemplates.map(t => ({ ...t }));
    const compromises: string[] = [];

    const getEmployeeAssignedHours = (empId: number): number => {
      let total = 0;
      for (let d = 1; d <= totalDays; d++) {
        const s = workingSchedule.get(`${empId}_${d}`);
        if (s) total += s.hours;
      }
      return total;
    };

    const getEmployeeHoursInWeek = (empId: number, targetWeekIdx: number): number => {
      let weekHours = 0;
      for (let d = 1; d <= totalDays; d++) {
        if (weekIdx[d] === targetWeekIdx) {
          const s = workingSchedule.get(`${empId}_${d}`);
          if (s) weekHours += s.hours;
        }
      }
      return weekHours;
    };

    const isShiftLaborLawCompliant = (
      emp: ManagerEmployee,
      day: number,
      shiftCode: string,
      shiftHours: number
    ): boolean => {
      const shiftDef = shiftMap.get(shiftCode);
      const isSun = isSunday[day];
      if (shiftDef?.is_sunday_only && !isSun) return false;
      if (!shiftDef?.is_sunday_only && isSun && (shiftCode === 'AM' || shiftCode === 'PM')) return false;

      let prevEndHour: number | null = null;
      if (day > 1) {
        const prevShift = workingSchedule.get(`${emp.id}_${day - 1}`);
        if (prevShift && prevShift.hours > 0 && prevShift.shift_code !== 'OFF' && prevShift.shift_code !== 'H' && prevShift.shift_code !== 'L4') {
          const prevDef = shiftMap.get(prevShift.shift_code);
          prevEndHour = parseTimeToHours(prevShift.custom_end_time || prevDef?.end_time) ?? 15.0;
        }
      } else if (prevMonthShifts.length > 0) {
        const prevShift = prevMonthShifts.find(s => s.employee_id === emp.id && s.day === prevMonthLastDay);
        if (prevShift && prevShift.hours > 0 && prevShift.shift_code !== 'OFF') {
          const prevDef = shiftMap.get(prevShift.shift_code);
          prevEndHour = parseTimeToHours(prevShift.custom_end_time || prevDef?.end_time) ?? 15.0;
        }
      }

      let nextStartHour: number | null = null;
      if (day < totalDays) {
        const nextShift = workingSchedule.get(`${emp.id}_${day + 1}`);
        if (nextShift && nextShift.hours > 0 && nextShift.shift_code !== 'OFF' && nextShift.shift_code !== 'H' && nextShift.shift_code !== 'L4') {
          const nextDef = shiftMap.get(nextShift.shift_code);
          nextStartHour = parseTimeToHours(nextShift.custom_start_time || nextDef?.start_time) ?? 7.0;
        }
      }

      const tempShift: ManagerScheduleShift = {
        year,
        month,
        day,
        date: ctx.dateStr[day],
        employee_id: emp.id,
        shift_code: shiftCode,
        hours: shiftHours
      };

      const resolved = resolveEffectiveShiftTimes(tempShift, shiftDef, prevEndHour, nextStartHour);

      if (prevEndHour !== null) {
        const restPrev = (24.0 - prevEndHour) + resolved.startHour;
        if (restPrev < 11.0) return false;
      }

      if (nextStartHour !== null) {
        const restNext = (24.0 - resolved.endHour) + nextStartHour;
        if (restNext < 11.0) return false;
      }

      let streak = 1;
      for (let d = day - 1; d >= 1; d--) {
        const s = workingSchedule.get(`${emp.id}_${d}`);
        if (s && s.hours > 0 && s.shift_code !== 'OFF') streak++;
        else break;
      }
      if (day <= 6) {
        const prevCtx = prevMonthEmpStats.get(emp.id);
        if (prevCtx && streak === day) {
          streak += prevCtx.consecutiveWorkDaysEnding;
        }
      }
      for (let d = day + 1; d <= totalDays; d++) {
        const s = workingSchedule.get(`${emp.id}_${d}`);
        if (s && s.hours > 0 && s.shift_code !== 'OFF') streak++;
        else break;
      }
      if (streak > 6) return false;

      if (isSun) {
        let consecutiveSundays = 1;
        for (let d = day - 7; d >= 1; d -= 7) {
          const s = workingSchedule.get(`${emp.id}_${d}`);
          if (s && s.hours > 0 && s.shift_code !== 'OFF') consecutiveSundays++;
          else break;
        }
        for (let d = day + 7; d <= totalDays; d += 7) {
          const s = workingSchedule.get(`${emp.id}_${d}`);
          if (s && s.hours > 0 && s.shift_code !== 'OFF') consecutiveSundays++;
          else break;
        }
        if (consecutiveSundays > 3) return false;
      }

      return true;
    };

    const scoreCandidate = (
      emp: ManagerEmployee,
      day: number,
      shiftCode: string,
      shiftHours: number,
      isSun: boolean
    ): number => {
      let score = 0;
      const key = `${emp.id}_${day}`;
      const shift = workingSchedule.get(key);
      const dispo = shift?.disposition || dispositionsByEmployee[emp.id]?.[day] || '';

      const nominal = empNominals.get(emp.id) || 160;
      const currentHours = getEmployeeAssignedHours(emp.id);
      const remainingHours = nominal - currentHours;

      // 1. Twarda ochrona wymiaru etatu (0.5, 0.75, 1.0) — zapobiega nadgodzinom dla niepełnych etatów
      if (remainingHours > 0) {
        score += (remainingHours / nominal) * 3500;
      } else {
        const overtime = currentHours + shiftHours - nominal;
        score -= 30000 + (overtime * 2500);
      }

      // 2. Respektowanie dyspozycji (AM / PM / OFF)
      if (options.respectDispositions) {
        if (dispo === 'AM' || dispo === 'M') {
          if (shiftCode === 'AM' || shiftCode === 'AMN' || shiftCode === 'AMB' || shiftCode === 'NC' || shiftCode === 'MIB') score += 2500;
          else if (shiftCode === 'PM' || shiftCode === 'PMN' || shiftCode === 'PMB') score -= 3500;
          else score += 200;
        } else if (dispo === 'PM' || dispo === 'Z') {
          if (shiftCode === 'PM' || shiftCode === 'PMN' || shiftCode === 'PMB') score += 2500;
          else if (shiftCode === 'AM' || shiftCode === 'AMN' || shiftCode === 'AMB') score -= 3500;
          else score += 200;
        } else if (dispo === 'OFF') {
          score -= 2000000; // Bezwzględny priorytet: absolutny zakaz łamania prośby o wolne
        } else {
          score += 150;
        }
      }

      const empRatio = emp.contract_hours_ratio || 1.0;
      const currentWeekIdx = weekIdx[day];
      const dow = dayOfWeek[day];
      const isWeekend = dow === 0 || dow === 6;

      // 3. Wygładzanie tygodniowe proporcjonalne do etatu
      if (options.smoothWeeklyHours !== false) {
        const currentWeekHours = getEmployeeHoursInWeek(emp.id, currentWeekIdx);
        const nominalWeekly = 40.0 * empRatio;
        if (currentWeekHours + shiftHours > nominalWeekly + 4.0) {
          score -= 400;
        } else if (currentWeekHours < nominalWeekly - 8.0) {
          score += 250;
        }
      }

      if (isWeekend) {
        let workedWeekendDays = 0;
        for (let d = 1; d <= totalDays; d++) {
          if (dayOfWeek[d] === 0 || dayOfWeek[d] === 6) {
            const s = workingSchedule.get(`${emp.id}_${d}`);
            if (s && s.hours > 0 && s.shift_code !== 'OFF') workedWeekendDays++;
          }
        }

        if (currentWeekIdx <= 1) {
          const prevCtx = prevMonthEmpStats.get(emp.id);
          if (prevCtx?.workedLastWeekend) {
            score -= 120;
          }
        }

        score -= workedWeekendDays * 55;
      }

      if (emp.role !== 'SM' && (shiftCode === 'PM' || shiftCode === 'PMN')) {
        let closingsCount = 0;
        for (let d = 1; d <= totalDays; d++) {
          const s = workingSchedule.get(`${emp.id}_${d}`);
          if (s && (s.shift_code === 'PM' || s.shift_code === 'PMN')) closingsCount++;
        }
        score -= closingsCount * 45;
      } else if (emp.role === 'SM' && (shiftCode === 'PM' || shiftCode === 'PMN')) {
        score -= 90;
      }

      if (day > 1) {
        const prevShift = workingSchedule.get(`${emp.id}_${day - 1}`);
        const nextShift = day < totalDays ? workingSchedule.get(`${emp.id}_${day + 1}`) : null;
        const wasOffYesterday = !prevShift || prevShift.shift_code === 'OFF' || prevShift.hours === 0;
        const isOffTomorrow = !nextShift || nextShift.shift_code === 'OFF' || nextShift.hours === 0;

        if (prevShift && prevShift.hours > 0 && prevShift.shift_code !== 'OFF') {
          if ((prevShift.shift_code === 'AM' || prevShift.shift_code === 'AMN') && (shiftCode === 'AM' || shiftCode === 'MIB')) {
            score += 50;
          } else if ((prevShift.shift_code === 'PM' || prevShift.shift_code === 'PMN') && (shiftCode === 'PM' || shiftCode === 'PMN')) {
            score += 50;
          }
        }

        if (dow === 6 && shiftCode === 'OFF') {
          const sunDispo = dispositionsByEmployee[emp.id]?.[day + 1];
          if (sunDispo === 'OFF' || !sunDispo) score += 90;
        } else if (dow === 0 && shiftCode === 'OFF' && wasOffYesterday) {
          score += 120;
        }

        if (options.preferConsecutiveOffDays && wasOffYesterday && isOffTomorrow) {
          score -= 100;
        }
      }

      if (jitterSeed > 0) {
        const pseudoRand = ((emp.id * 37 + day * 13 + jitterSeed * 79) % 100) - 50;
        score += pseudoRand * 0.5;
      }

      return score;
    };

    const sortedDays = [...daySlots].sort((a, b) => {
      const getOrder = (d: typeof a) => {
        if (d.isSunday) return 1;
        if (d.dayOfWeek === 6) return 2;
        if (d.dayOfWeek === 5) return 3;
        return 4;
      };
      return getOrder(a) - getOrder(b);
    });

    for (const slot of sortedDays) {
      const day = slot.day;
      const isSun = slot.isSunday;

      // A. OTWARCIE (AM / AMN)
      if (slot.neededOpening) {
        const shiftCode = isSun ? 'AMN' : 'AM';
        const shiftDef = shiftMap.get(shiftCode);
        const shiftHours = shiftDef?.hours || (isSun ? 6.0 : 8.0);

        let candidates = employees.filter(emp => {
          const key = `${emp.id}_${day}`;
          if (lockedCells.has(key)) return false;
          const s = workingSchedule.get(key);
          if (s && s.hours > 0 && s.shift_code !== 'OFF') return false;
          return isShiftLaborLawCompliant(emp, day, shiftCode, shiftHours);
        });

        // Priorytet 1: Kandydaci bez prośby o OFF i z preferencją AM
        if (options.respectDispositions) {
          const nonOffCandidates = candidates.filter(emp => {
            const dispo = workingSchedule.get(`${emp.id}_${day}`)?.disposition || dispositionsByEmployee[emp.id]?.[day] || '';
            return dispo !== 'OFF';
          });
          if (nonOffCandidates.length > 0) {
            candidates = nonOffCandidates;
            const preferred = candidates.filter(emp => {
              const dispo = workingSchedule.get(`${emp.id}_${day}`)?.disposition || dispositionsByEmployee[emp.id]?.[day] || '';
              return dispo !== 'PM' && dispo !== 'Z';
            });
            if (preferred.length > 0) {
              candidates = preferred;
            }
          }
        }

        // Priorytet 2: Preferuj kandydatów, którzy NIE przekroczyli etatu
        const underNominal = candidates.filter(emp => {
          const curH = getEmployeeAssignedHours(emp.id);
          const nom = empNominals.get(emp.id) || 160;
          return curH + shiftHours <= nom + 4.0;
        });
        if (underNominal.length > 0) {
          candidates = underNominal;
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => scoreCandidate(b, day, shiftCode, shiftHours, isSun) - scoreCandidate(a, day, shiftCode, shiftHours, isSun));
          const chosen = candidates[0];
          const key = `${chosen.id}_${day}`;
          const current = workingSchedule.get(key)!;

          workingSchedule.set(key, {
            ...current,
            shift_code: shiftCode,
            hours: shiftHours
          });
          slot.neededOpening = false;
        } else {
          compromises.push(`Dzień ${day}.${month}: Brak dostępnego menedżera na Otwarcie (${shiftCode}) bez naruszenia Kodeksu Pracy.`);
        }
      }

      // B. ZAMKNIĘCIE (PM / PMN)
      if (slot.neededClosing) {
        const shiftCode = isSun ? 'PMN' : 'PM';
        const shiftDef = shiftMap.get(shiftCode);
        const shiftHours = shiftDef?.hours || (isSun ? 7.0 : 8.0);

        let candidates = employees.filter(emp => {
          const key = `${emp.id}_${day}`;
          if (lockedCells.has(key)) return false;
          const s = workingSchedule.get(key);
          if (s && s.hours > 0 && s.shift_code !== 'OFF') return false;
          return isShiftLaborLawCompliant(emp, day, shiftCode, shiftHours);
        });

        // Priorytet 1: Kandydaci bez prośby o OFF i z preferencją PM
        if (options.respectDispositions) {
          const nonOffCandidates = candidates.filter(emp => {
            const dispo = workingSchedule.get(`${emp.id}_${day}`)?.disposition || dispositionsByEmployee[emp.id]?.[day] || '';
            return dispo !== 'OFF';
          });
          if (nonOffCandidates.length > 0) {
            candidates = nonOffCandidates;
            const preferred = candidates.filter(emp => {
              const dispo = workingSchedule.get(`${emp.id}_${day}`)?.disposition || dispositionsByEmployee[emp.id]?.[day] || '';
              return dispo !== 'AM' && dispo !== 'M';
            });
            if (preferred.length > 0) {
              candidates = preferred;
            }
          }
        }

        // Priorytet 2: Preferuj kandydatów, którzy NIE przekroczyli etatu
        const underNominal = candidates.filter(emp => {
          const curH = getEmployeeAssignedHours(emp.id);
          const nom = empNominals.get(emp.id) || 160;
          return curH + shiftHours <= nom + 4.0;
        });
        if (underNominal.length > 0) {
          candidates = underNominal;
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => scoreCandidate(b, day, shiftCode, shiftHours, isSun) - scoreCandidate(a, day, shiftCode, shiftHours, isSun));
          const chosen = candidates[0];
          const key = `${chosen.id}_${day}`;
          const current = workingSchedule.get(key)!;

          workingSchedule.set(key, {
            ...current,
            shift_code: shiftCode,
            hours: shiftHours
          });
          slot.neededClosing = false;
        } else {
          compromises.push(`Dzień ${day}.${month}: Brak dostępnego menedżera na Zamknięcie (${shiftCode}) bez naruszenia Kodeksu Pracy.`);
        }
      }

      // C. ŚRODEK (MID / MIB) + RESCUE PASS DLA PROŚBY O OFF
      if (slot.neededMid) {
        const shiftCode = 'MIB';
        const shiftDef = shiftMap.get(shiftCode);
        const shiftHours = shiftDef?.hours || 8.0;

        // Sprawdź czy ktoś z prośbą o OFF musiał być przydzielony do AM lub PM
        let offWorkerEmp: ManagerEmployee | null = null;
        let offWorkerShiftCode = '';
        let offWorkerShiftHours = 8.0;

        if (options.respectDispositions) {
          employees.forEach(emp => {
            const s = workingSchedule.get(`${emp.id}_${day}`);
            const dispo = s?.disposition || dispositionsByEmployee[emp.id]?.[day] || '';
            if (dispo === 'OFF' && s && s.hours > 0 && s.shift_code !== 'OFF') {
              offWorkerEmp = emp;
              offWorkerShiftCode = s.shift_code;
              offWorkerShiftHours = s.hours;
            }
          });
        }

        let candidates = employees.filter(emp => {
          const key = `${emp.id}_${day}`;
          if (lockedCells.has(key)) return false;
          const s = workingSchedule.get(key);
          if (s && s.hours > 0 && s.shift_code !== 'OFF') return false;
          const dispo = s?.disposition || dispositionsByEmployee[emp.id]?.[day] || '';
          if (dispo === 'OFF') return false; // NIGDY nie dawaj MID osobie z OFF!
          return isShiftLaborLawCompliant(emp, day, shiftCode, shiftHours);
        });

        // Jeśli ktoś z prośbą o OFF dostał AM/PM, a mamy wolnego kandydata nie-OFF:
        // PRZEKAŻ OBOWIĄZKOWĄ ZMIANĘ AM/PM KANDYDATOWI, A PRACOWNIKA Z OFF ZWOLNIJ NA WOLNE!
        if (offWorkerEmp && candidates.length > 0) {
          const rescuer = candidates.find(c => isShiftLaborLawCompliant(c, day, offWorkerShiftCode, offWorkerShiftHours));
          if (rescuer) {
            const keyRescuer = `${rescuer.id}_${day}`;
            const curRescuer = workingSchedule.get(keyRescuer)!;
            workingSchedule.set(keyRescuer, {
              ...curRescuer,
              shift_code: offWorkerShiftCode,
              hours: offWorkerShiftHours
            });

            const keyOff = `${(offWorkerEmp as ManagerEmployee).id}_${day}`;
            const curOff = workingSchedule.get(keyOff)!;
            workingSchedule.set(keyOff, {
              ...curOff,
              shift_code: 'OFF',
              hours: 0.0
            });

            slot.neededMid = false;
            continue;
          }
        }

        const underNominal = candidates.filter(emp => {
          const curH = getEmployeeAssignedHours(emp.id);
          const nom = empNominals.get(emp.id) || 160;
          return curH + shiftHours <= nom + 4.0;
        });
        if (underNominal.length > 0) {
          candidates = underNominal;
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => scoreCandidate(b, day, shiftCode, shiftHours, isSun) - scoreCandidate(a, day, shiftCode, shiftHours, isSun));
          const chosen = candidates[0];
          const key = `${chosen.id}_${day}`;
          const current = workingSchedule.get(key)!;

          workingSchedule.set(key, {
            ...current,
            shift_code: shiftCode,
            hours: shiftHours
          });
          slot.neededMid = false;
        }
      }
    }

    // D. Dopełnienie brakujących godzin przy zachowaniu ścisłych limitów dobowych TPLH
    const getDailyAssignedCounts = (d: number) => {
      let amCount = 0;
      let pmCount = 0;
      let midCount = 0;
      let ncCount = 0;
      let totalWorking = 0;

      for (const e of employees) {
        const s = workingSchedule.get(`${e.id}_${d}`);
        if (s && s.hours > 0 && s.shift_code !== 'OFF') {
          totalWorking++;
          if (s.shift_code === 'AM' || s.shift_code === 'AMN' || s.shift_code === 'AMB') amCount++;
          else if (s.shift_code === 'PM' || s.shift_code === 'PMN' || s.shift_code === 'PMB') pmCount++;
          else if (s.shift_code === 'MIB' || s.shift_code === 'MID') midCount++;
          else if (s.shift_code === 'NC') ncCount++;
        }
      }
      return { amCount, pmCount, midCount, ncCount, totalWorking };
    };

    employees.forEach(emp => {
      const nominal = empNominals.get(emp.id) || 160;
      let currentHours = getEmployeeAssignedHours(emp.id);

      if (currentHours < nominal - 4.0) {
        const availableDays: number[] = [];
        for (let d = 1; d <= totalDays; d++) {
          const key = `${emp.id}_${d}`;
          if (lockedCells.has(key)) continue;
          const s = workingSchedule.get(key);
          if (s && (s.shift_code === 'OFF' || s.hours === 0)) {
            const dispo = s.disposition || dispositionsByEmployee[emp.id]?.[d] || '';
            if (dispo !== 'OFF') availableDays.push(d);
          }
        }

        // Preferuj dni szczytowe (Pt, Sob) o niskim obciążeniu tygodniowym
        availableDays.sort((a, b) => {
          const dowA = dayOfWeek[a];
          const dowB = dayOfWeek[b];
          const isPeakA = dowA === 5 || dowA === 6 ? 1 : 0;
          const isPeakB = dowB === 5 || dowB === 6 ? 1 : 0;
          if (isPeakA !== isPeakB) return isPeakB - isPeakA; // Najpierw Pt/Sob

          const hWeekA = getEmployeeHoursInWeek(emp.id, weekIdx[a]);
          const hWeekB = getEmployeeHoursInWeek(emp.id, weekIdx[b]);
          return hWeekA - hWeekB;
        });

        for (const d of availableDays) {
          if (currentHours >= nominal - 2.0) break;
          const isSun = isSunday[d];
          const isHol = isHoliday[d];
          const dow = dayOfWeek[d];
          const isPeak = dow === 5 || dow === 6; // Piątek / Sobota
          const dispo = workingSchedule.get(`${emp.id}_${d}`)?.disposition || dispositionsByEmployee[emp.id]?.[d] || '';
          if (dispo === 'OFF') continue;

          const counts = getDailyAssignedCounts(d);

          // OCHRONA TPLH I FLOOR HOURS W ŚWIĘTA I NIEDZIELE:
          // 1. W niedziele i święta (np. 1.11 Wszystkich Świętych): limit to DOKŁADNIE 2 osoby (1 AMN + 1 PMN)
          if ((isSun || isHol) && counts.totalWorking >= 2) continue;

          // Wybierz odpowiedni kod zmiany:
          let shiftCode = '';
          if (counts.amCount === 0) {
            shiftCode = isSun ? 'AMN' : 'AM';
          } else if (counts.pmCount === 0) {
            shiftCode = isSun ? 'PMN' : 'PM';
          } else if (counts.midCount === 0 && (isPeak || (!isSun && !isHol))) {
            // Zmiana środkowa / Barista na barze (MIB)
            shiftCode = 'MIB';
          } else if (!isSun && !isHol) {
            // Zmiana Support (SUP) — elastyczna zmiana do oddania do innej kawiarni lub 2. osoba na barze
            shiftCode = 'SUP';
          } else {
            // Niedziele i święta bez nadmiarowych zmian — chronimy TPLH lokalu
            continue;
          }

          const shiftDef = shiftMap.get(shiftCode) || shiftMap.get('SUP') || shiftMap.get('MIB');
          const shiftHours = shiftDef?.hours || (isSun ? (shiftCode === 'PMN' ? 7.0 : 6.0) : 8.0);

          if (isShiftLaborLawCompliant(emp, d, shiftCode, shiftHours)) {
            const key = `${emp.id}_${d}`;
            const cur = workingSchedule.get(key)!;
            workingSchedule.set(key, {
              ...cur,
              shift_code: shiftCode,
              hours: shiftHours
            });
            currentHours += shiftHours;
          }
        }
      }
    });

    // 2-OPT Pairwise Swap Optimization z twardą kontrolą bilansu godzin
    if (options.respectDispositions) {
      for (let day = 1; day <= totalDays; day++) {
        const isSun = isSunday[day];
        for (let i = 0; i < employees.length; i++) {
          for (let j = i + 1; j < employees.length; j++) {
            const empA = employees[i];
            const empB = employees[j];
            const keyA = `${empA.id}_${day}`;
            const keyB = `${empB.id}_${day}`;
            if (lockedCells.has(keyA) || lockedCells.has(keyB)) continue;

            const shiftA = workingSchedule.get(keyA);
            const shiftB = workingSchedule.get(keyB);
            if (!shiftA || !shiftB) continue;
            if (shiftA.shift_code === shiftB.shift_code) continue;
            if (shiftA.shift_code === 'H' || shiftA.shift_code === 'L4' || shiftB.shift_code === 'H' || shiftB.shift_code === 'L4') continue;
            if (shiftA.shift_code === 'NC' || shiftB.shift_code === 'NC') continue;

            const dispoA = shiftA.disposition || dispositionsByEmployee[empA.id]?.[day] || '';
            const dispoB = shiftB.disposition || dispositionsByEmployee[empB.id]?.[day] || '';

            // Twardy zakaz: Nigdy nie zamieniaj wolnego na pracę pracownikowi z prośbą o OFF
            if (dispoA === 'OFF' && shiftA.hours === 0 && shiftB.hours > 0) continue;
            if (dispoB === 'OFF' && shiftB.hours === 0 && shiftA.hours > 0) continue;

            // Kontrola bilansu godzin pracownika: nie pozwól zamianie tworzyć nadgodzin dla niepełnych etatów
            const nomA = empNominals.get(empA.id) || 160;
            const nomB = empNominals.get(empB.id) || 160;
            const curHoursA = getEmployeeAssignedHours(empA.id);
            const curHoursB = getEmployeeAssignedHours(empB.id);

            const newHoursA = curHoursA - shiftA.hours + shiftB.hours;
            const newHoursB = curHoursB - shiftB.hours + shiftA.hours;

            const currentHourError = Math.abs(curHoursA - nomA) + Math.abs(curHoursB - nomB);
            const newHourError = Math.abs(newHoursA - nomA) + Math.abs(newHoursB - nomB);

            if (newHourError > currentHourError + 0.1) continue;

            if (
              isShiftLaborLawCompliant(empA, day, shiftB.shift_code, shiftB.hours) &&
              isShiftLaborLawCompliant(empB, day, shiftA.shift_code, shiftA.hours)
            ) {
              const currentScoreA = scoreCandidate(empA, day, shiftA.shift_code, shiftA.hours, isSun);
              const currentScoreB = scoreCandidate(empB, day, shiftB.shift_code, shiftB.hours, isSun);
              const swappedScoreA = scoreCandidate(empA, day, shiftB.shift_code, shiftB.hours, isSun);
              const swappedScoreB = scoreCandidate(empB, day, shiftA.shift_code, shiftA.hours, isSun);

              if (swappedScoreA + swappedScoreB > currentScoreA + currentScoreB + 10) {
                const tempCode = shiftA.shift_code;
                const tempHours = shiftA.hours;
                const tempStart = shiftA.custom_start_time;
                const tempEnd = shiftA.custom_end_time;

                workingSchedule.set(keyA, {
                  ...shiftA,
                  shift_code: shiftB.shift_code,
                  hours: shiftB.hours,
                  custom_start_time: shiftB.custom_start_time,
                  custom_end_time: shiftB.custom_end_time
                });

                workingSchedule.set(keyB, {
                  ...shiftB,
                  shift_code: tempCode,
                  hours: tempHours,
                  custom_start_time: tempStart,
                  custom_end_time: tempEnd
                });
              }
            }
          }
        }
      }
    }

    // 3. DETERMINISTYCZNY PASSER RATUNKOWY: BEZWZGLĘDNA ELIMINACJA KONFLIKTÓW OFF
    if (options.respectDispositions) {
      for (let day = 1; day <= totalDays; day++) {
        for (const empOff of employees) {
          const keyOff = `${empOff.id}_${day}`;
          if (lockedCells.has(keyOff)) continue;
          const shiftOff = workingSchedule.get(keyOff);
          if (!shiftOff || shiftOff.hours === 0 || shiftOff.shift_code === 'OFF') continue;

          const dispo = shiftOff.disposition || dispositionsByEmployee[empOff.id]?.[day] || '';
          if (dispo !== 'OFF') continue;

          // Pracownik empOff ma prośbę o OFF, ale został mu przydzielony dyżur (np. AM, PM, MIB, SUP)!
          // SCENARIUSZ 1: Sprawdź, czy inny pracownik empOther ma w tym samym dniu zmianę nieobligatoryjną (MIB, MID, SUP, SAM, SPM)
          let rescued = false;
          for (const empOther of employees) {
            if (empOther.id === empOff.id) continue;
            const keyOther = `${empOther.id}_${day}`;
            if (lockedCells.has(keyOther)) continue;
            const shiftOther = workingSchedule.get(keyOther);
            if (!shiftOther) continue;

            const dispoOther = shiftOther.disposition || dispositionsByEmployee[empOther.id]?.[day] || '';
            if (dispoOther === 'OFF') continue; // Nie przekazuj osobie z prośbą o OFF

            if (
              shiftOther.shift_code === 'MIB' ||
              shiftOther.shift_code === 'MID' ||
              shiftOther.shift_code === 'SUP' ||
              shiftOther.shift_code === 'SAM' ||
              shiftOther.shift_code === 'SPM'
            ) {
              // empOther może przejąć dyżur empOff (np. AM/PM), a empOff dostaje OFF!
              if (isShiftLaborLawCompliant(empOther, day, shiftOff.shift_code, shiftOff.hours)) {
                // Przepisz obligatoryjny dyżur empOff do empOther
                workingSchedule.set(keyOther, {
                  ...shiftOther,
                  shift_code: shiftOff.shift_code,
                  hours: shiftOff.hours,
                  custom_start_time: shiftOff.custom_start_time,
                  custom_end_time: shiftOff.custom_end_time
                });
                // Zwolnij empOff na OFF!
                workingSchedule.set(keyOff, {
                  ...shiftOff,
                  shift_code: 'OFF',
                  hours: 0.0,
                  custom_start_time: undefined,
                  custom_end_time: undefined
                });
                rescued = true;
                break;
              }
            }
          }

          if (rescued) continue;

          // SCENARIUSZ 2: Sprawdź, czy inny pracownik empOther ma w tym dniu OFF (pełna dostępność FULL lub preferencja AM/PM)
          for (const empOther of employees) {
            if (empOther.id === empOff.id) continue;
            const keyOther = `${empOther.id}_${day}`;
            if (lockedCells.has(keyOther)) continue;
            const shiftOther = workingSchedule.get(keyOther);
            if (!shiftOther || shiftOther.hours > 0 || shiftOther.shift_code !== 'OFF') continue;

            const dispoOther = shiftOther.disposition || dispositionsByEmployee[empOther.id]?.[day] || '';
            if (dispoOther === 'OFF') continue;

            if (isShiftLaborLawCompliant(empOther, day, shiftOff.shift_code, shiftOff.hours)) {
              // Znajdź inny dzień day2, gdzie empOther ma zaplanowany dyżur i empOff może go przejąć (wymiana bilansowa)
              let swapDay2 = -1;
              for (let d2 = 1; d2 <= totalDays; d2++) {
                if (d2 === day) continue;
                const kOther2 = `${empOther.id}_${d2}`;
                const kOff2 = `${empOff.id}_${d2}`;
                if (lockedCells.has(kOther2) || lockedCells.has(kOff2)) continue;

                const sOther2 = workingSchedule.get(kOther2);
                const sOff2 = workingSchedule.get(kOff2);
                if (sOther2 && sOther2.hours > 0 && sOther2.shift_code !== 'OFF' && (!sOff2 || sOff2.hours === 0 || sOff2.shift_code === 'OFF')) {
                  const dispoOff2 = sOff2?.disposition || dispositionsByEmployee[empOff.id]?.[d2] || '';
                  if (dispoOff2 !== 'OFF') {
                    if (
                      isShiftLaborLawCompliant(empOff, d2, sOther2.shift_code, sOther2.hours) &&
                      isShiftLaborLawCompliant(empOther, d2, 'OFF', 0)
                    ) {
                      swapDay2 = d2;
                      break;
                    }
                  }
                }
              }

              if (swapDay2 !== -1) {
                const kOther2 = `${empOther.id}_${swapDay2}`;
                const kOff2 = `${empOff.id}_${swapDay2}`;
                const sOther2 = workingSchedule.get(kOther2)!;
                const sOff2 = workingSchedule.get(kOff2)!;

                // 1. Dzień 1: empOther bierze shiftOff, empOff dostaje OFF
                workingSchedule.set(keyOther, {
                  ...shiftOther,
                  shift_code: shiftOff.shift_code,
                  hours: shiftOff.hours,
                  custom_start_time: shiftOff.custom_start_time,
                  custom_end_time: shiftOff.custom_end_time
                });
                workingSchedule.set(keyOff, {
                  ...shiftOff,
                  shift_code: 'OFF',
                  hours: 0.0,
                  custom_start_time: undefined,
                  custom_end_time: undefined
                });

                // 2. Dzień 2: empOff przejmuje sOther2, empOther dostaje OFF
                workingSchedule.set(kOff2, {
                  ...sOff2,
                  shift_code: sOther2.shift_code,
                  hours: sOther2.hours,
                  custom_start_time: sOther2.custom_start_time,
                  custom_end_time: sOther2.custom_end_time
                });
                workingSchedule.set(kOther2, {
                  ...sOther2,
                  shift_code: 'OFF',
                  hours: 0.0,
                  custom_start_time: undefined,
                  custom_end_time: undefined
                });

                rescued = true;
                break;
              }
            }
          }
        }
      }
    }

    // Szybka ewaluacja metryk i fitness
    let totalPlannedHours = 0;
    let dispoTotal = 0;
    let dispoMatched = 0;
    let missingCoverageCount = 0;
    let totalIndividualHourError = 0;
    let offViolationsCount = 0;

    employees.forEach(emp => {
      const h = getEmployeeAssignedHours(emp.id);
      const nom = empNominals.get(emp.id) || 160;
      totalIndividualHourError += Math.abs(h - nom);
    });

    for (let day = 1; day <= totalDays; day++) {
      let hasAm = false;
      let hasPm = false;
      employees.forEach(emp => {
        const s = workingSchedule.get(`${emp.id}_${day}`);
        if (s && s.hours > 0) {
          totalPlannedHours += s.hours;
          if (s.shift_code === 'AM' || s.shift_code === 'AMN' || s.shift_code === 'AMB') hasAm = true;
          if (s.shift_code === 'PM' || s.shift_code === 'PMN' || s.shift_code === 'PMB') hasPm = true;

          const dispo = s.disposition || dispositionsByEmployee[emp.id]?.[day] || '';
          if (dispo === 'AM' || dispo === 'M') {
            dispoTotal++;
            if (s.shift_code === 'AM' || s.shift_code === 'AMN' || s.shift_code === 'NC' || s.shift_code === 'MIB' || s.shift_code === 'OFF' || s.hours === 0) dispoMatched++;
          } else if (dispo === 'PM' || dispo === 'Z') {
            dispoTotal++;
            if (s.shift_code === 'PM' || s.shift_code === 'PMN' || s.shift_code === 'MIB' || s.shift_code === 'OFF' || s.hours === 0) dispoMatched++;
          } else if (dispo === 'OFF') {
            dispoTotal++;
            offViolationsCount++; // Violated: assigned working shift on OFF day
          }
        } else {
          const dispo = s?.disposition || dispositionsByEmployee[emp.id]?.[day] || '';
          if (dispo === 'OFF') {
            dispoTotal++;
            dispoMatched++;
          } else if (dispo === 'AM' || dispo === 'M' || dispo === 'PM' || dispo === 'Z') {
            dispoTotal++;
            dispoMatched++; // OFF is not a violation of AM/PM preference
          }
        }
      });
      if (!hasAm || !hasPm) missingCoverageCount++;
    }

    const dispoMatchRate = dispoTotal > 0 ? (dispoMatched / dispoTotal) * 100 : 100;
    const hourDiffPenalty = (totalIndividualHourError * 120) + (Math.abs(totalPlannedHours - ctx.teamTargetNominalHours) * 35);
    const coveragePenalty = missingCoverageCount * 35000;
    const offViolationPenalty = offViolationsCount * 500000; // Twarda kara za każde złamanie prośby o OFF
    const dispoScore = dispoMatchRate * 350;

    const fitness = dispoScore - coveragePenalty - hourDiffPenalty - offViolationPenalty;

    return {
      workingSchedule,
      fitness,
      violationsCount: 0,
      missingCoverageCount,
      dispoMatchRate,
      totalPlannedHours,
      compromises
    };
  }

  /**
   * Finalne jednokrotne zbudowanie pełnego wyniku z diffami, statystykami i metrykami wyjaśnialności.
   */
  private static buildFullResult(
    ctx: PrecomputedContext,
    workingSchedule: Map<string, ManagerScheduleShift>,
    employees: ManagerEmployee[],
    dispositionsByEmployee: Record<number, Record<number, string>>,
    options: AutoScheduleOptions,
    prevMonthShifts: ManagerScheduleShift[],
    compromises: string[],
    iterationsEvaluated: number
  ): AutoScheduleResult {
    const {
      year,
      month,
      totalDays,
      shiftMap,
      originalShiftsMap,
      lockedCells,
      dayOfWeek,
      empNominals,
      prevMonthLastDay
    } = ctx;

    const pinned = options.pinnedCells || new Set<string>();
    const generatedShifts: ManagerScheduleShift[] = [];
    const diffs: ShiftDiffItem[] = [];

    let totalPlannedHours = 0;
    let dispositionTotalCount = 0;
    let dispositionMatchedCount = 0;
    let midShiftsCount = 0;
    let openingShiftsCount = 0;
    let closingShiftsCount = 0;
    let ncShiftsCount = 0;

    const employeeStats: AutoScheduleEmployeeStat[] = [];

    employees.forEach(emp => {
      const empRatio = emp.contract_hours_ratio || 1.0;
      const nominal = empNominals.get(emp.id) || 160;
      let empHours = 0;
      let offDays = 0;
      let workingDays = 0;
      let weekendDays = 0;
      let sundaysWorked = 0;
      let empDispoTotal = 0;
      let empDispoMatched = 0;

      for (let day = 1; day <= totalDays; day++) {
        const key = `${emp.id}_${day}`;
        const finalShift = workingSchedule.get(key)!;
        const originalShift = originalShiftsMap.get(key);
        const dispo = finalShift.disposition || '';

        // Płynna adaptacja godzin dla zmian administracyjnych NC
        if (FLEXIBLE_ADMIN_SHIFT_CODES.has(finalShift.shift_code) && !finalShift.custom_start_time) {
          const shiftDef = shiftMap.get(finalShift.shift_code);
          let prevEndHour: number | null = null;
          if (day > 1) {
            const prevS = workingSchedule.get(`${emp.id}_${day - 1}`);
            if (prevS && prevS.hours > 0 && prevS.shift_code !== 'OFF' && prevS.shift_code !== 'H' && prevS.shift_code !== 'L4') {
              const prevDef = shiftMap.get(prevS.shift_code);
              prevEndHour = parseTimeToHours(prevS.custom_end_time || prevDef?.end_time) ?? 15.0;
            }
          } else if (prevMonthShifts.length > 0) {
            const prevS = prevMonthShifts.find(s => s.employee_id === emp.id && s.day === prevMonthLastDay);
            if (prevS && prevS.hours > 0 && prevS.shift_code !== 'OFF') {
              const prevDef = shiftMap.get(prevS.shift_code);
              prevEndHour = parseTimeToHours(prevS.custom_end_time || prevDef?.end_time) ?? 15.0;
            }
          }

          let nextStartHour: number | null = null;
          if (day < totalDays) {
            const nextS = workingSchedule.get(`${emp.id}_${day + 1}`);
            if (nextS && nextS.hours > 0 && nextS.shift_code !== 'OFF' && nextS.shift_code !== 'H' && nextS.shift_code !== 'L4') {
              const nextDef = shiftMap.get(nextS.shift_code);
              nextStartHour = parseTimeToHours(nextS.custom_start_time || nextDef?.start_time) ?? 7.0;
            }
          }

          const resolved = resolveEffectiveShiftTimes(finalShift, shiftDef, prevEndHour, nextStartHour);
          if (resolved.isFlexibleAdapted) {
            finalShift.custom_start_time = formatHoursToTimeString(resolved.startHour);
            finalShift.custom_end_time = formatHoursToTimeString(resolved.endHour);
          }
        }

        generatedShifts.push(finalShift);
        empHours += finalShift.hours;
        totalPlannedHours += finalShift.hours;

        const dow = dayOfWeek[day];
        const isWeekend = dow === 0 || dow === 6;

        if (finalShift.hours > 0 && finalShift.shift_code !== 'OFF') {
          workingDays++;
          if (isWeekend) weekendDays++;
          if (dow === 0) sundaysWorked++;

          if (finalShift.shift_code === 'AM' || finalShift.shift_code === 'AMN') openingShiftsCount++;
          if (finalShift.shift_code === 'PM' || finalShift.shift_code === 'PMN') closingShiftsCount++;
          if (finalShift.shift_code === 'MIB' || finalShift.shift_code === 'MID') midShiftsCount++;
          if (finalShift.shift_code === 'NC') ncShiftsCount++;
        } else {
          offDays++;
        }

        if (dispo === 'AM' || dispo === 'PM' || dispo === 'OFF' || dispo === 'M' || dispo === 'Z') {
          dispositionTotalCount++;
          empDispoTotal++;
          let matched = false;
          if ((dispo === 'AM' || dispo === 'M')) {
            if (finalShift.shift_code === 'AM' || finalShift.shift_code === 'AMN' || finalShift.shift_code === 'NC' || finalShift.shift_code === 'MIB' || finalShift.shift_code === 'OFF' || finalShift.hours === 0) {
              matched = true;
            }
          } else if ((dispo === 'PM' || dispo === 'Z')) {
            if (finalShift.shift_code === 'PM' || finalShift.shift_code === 'PMN' || finalShift.shift_code === 'MIB' || finalShift.shift_code === 'OFF' || finalShift.hours === 0) {
              matched = true;
            }
          } else if (dispo === 'OFF') {
            if (finalShift.shift_code === 'OFF' || finalShift.hours === 0) {
              matched = true;
            }
          }

          if (matched) {
            dispositionMatchedCount++;
            empDispoMatched++;
          }
        }

        const prevCode = originalShift?.shift_code || 'OFF';
        const newCode = finalShift.shift_code;
        let changeType: 'unchanged' | 'assigned' | 'modified' | 'cleared' = 'unchanged';

        if (prevCode !== newCode) {
          if (prevCode === 'OFF' && newCode !== 'OFF') changeType = 'assigned';
          else if (prevCode !== 'OFF' && newCode === 'OFF') changeType = 'cleared';
          else changeType = 'modified';
        }

        const dayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];
        diffs.push({
          employeeId: emp.id,
          employeeName: emp.name,
          day,
          date: finalShift.date,
          dayName: dayNames[dow],
          prevShiftCode: prevCode,
          newShiftCode: newCode,
          disposition: dispo,
          isFixed: lockedCells.has(key),
          isPinned: pinned.has(key),
          changeType
        });
      }

      employeeStats.push({
        employeeId: emp.id,
        name: emp.name,
        role: emp.role,
        contractRatio: empRatio,
        nominalHours: nominal,
        plannedHours: Number(empHours.toFixed(1)),
        balanceHours: Number((empHours - nominal).toFixed(1)),
        offDaysCount: offDays,
        workingDaysCount: workingDays,
        weekendDaysCount: weekendDays,
        sundaysWorked,
        dispositionMatchRate: empDispoTotal > 0 ? Number(((empDispoMatched / empDispoTotal) * 100).toFixed(1)) : 100,
        dispositionDetails: {
          total: empDispoTotal,
          matched: empDispoMatched
        }
      });
    });

    const conflictInsights: ConflictInsight[] = [];
    const compromisesList: string[] = [...compromises];

    employees.forEach(emp => {
      for (let d = 1; d <= totalDays; d++) {
        const key = `${emp.id}_${d}`;
        const finalShift = workingSchedule.get(key)!;
        const requestedDispo = dispositionsByEmployee[emp.id]?.[d] || '';
        if (!requestedDispo) continue;

        const dow = dayOfWeek[d];
        const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
        const isWeekend = dow === 0 || dow === 6;

        if (requestedDispo === 'OFF' && finalShift.shift_code !== 'OFF' && finalShift.hours > 0) {
          const blockers: string[] = [];
          employees.forEach(other => {
            if (other.id === emp.id) return;
            const otherShift = workingSchedule.get(`${other.id}_${d}`);
            if (!otherShift) return;
            if (otherShift.shift_code === 'H') blockers.push(`${other.name.split(' ')[0]} (Urlop H)`);
            else if (otherShift.shift_code === 'L4') blockers.push(`${other.name.split(' ')[0]} (Chorobowe L4)`);
            else if (otherShift.shift_code === 'NC') blockers.push(`${other.name.split(' ')[0]} (Admin NC)`);
            else if (otherShift.shift_code === 'SUP' || otherShift.shift_code === 'SAM' || otherShift.shift_code === 'SPM') blockers.push(`${other.name.split(' ')[0]} (Wsparcie SUP)`);
            else if (otherShift.shift_code === 'AM' || otherShift.shift_code === 'AMN') blockers.push(`${other.name.split(' ')[0]} (Obsada AM)`);
          });

          const shiftDesc = finalShift.shift_code === 'PM' || finalShift.shift_code === 'PMN' ? 'zamknięcia (PM)' : 'otwarcia (AM)';
          let reasonText = `Konieczność obsady dyżuru ${shiftDesc}.`;
          if (blockers.length > 0) {
            reasonText += ` Ograniczenia zespołu: ${blockers.join(', ')}.`;
          } else {
            reasonText += ` Wyrównanie etatu pracownika (${emp.contract_hours_ratio || 1.0} etatu).`;
          }

          // Znajdź dzień na rekompensatę wolnego (najbliższy pracujący dzień bez urlopu)
          let compensatoryDay: number | null = null;
          for (let candD = 1; candD <= totalDays; candD++) {
            if (candD === d) continue;
            const s = workingSchedule.get(`${emp.id}_${candD}`);
            if (s && s.hours > 0 && !FIXED_SHIFT_CODES.has(s.shift_code) && s.shift_code !== 'AM' && s.shift_code !== 'PM' && s.shift_code !== 'AMN' && s.shift_code !== 'PMN') {
              compensatoryDay = candD;
              break;
            }
          }
          if (!compensatoryDay) {
            for (let candD = 1; candD <= totalDays; candD++) {
              if (candD === d) continue;
              const s = workingSchedule.get(`${emp.id}_${candD}`);
              if (s && s.hours > 0 && !FIXED_SHIFT_CODES.has(s.shift_code)) {
                compensatoryDay = candD;
                break;
              }
            }
          }

          const firstName = emp.name.split(' ')[0];
          const negotiationOptions: ConflictNegotiationOption[] = [];

          if (compensatoryDay) {
            const compDow = dayOfWeek[compensatoryDay];
            const compDayName = `${dayNames[compDow]} (${compensatoryDay}.${String(month).padStart(2, '0')})`;
            const copyMsg = `Cześć ${firstName}, mamy trudną sytuację obsadową w dniu ${dayNames[dow]} (${d}.${String(month).padStart(2, '0')}). Czy mógłbyś/mogłabyś wziąć wtedy zmianę ${finalShift.shift_code}? W zamian wpiszę Ci wolne w dniu ${compDayName}. Bilans godzin i Kodeks Pracy pozostaną w 100% zachowane. Daj znać czy możemy tak zrobić! ☕`;

            negotiationOptions.push({
              id: `opt_comp_${emp.id}_${d}`,
              title: `Wariant 1: Zamiana z rekompensatą wolnego (${compDayName})`,
              description: `Poproś ${emp.name} o dyżur ${finalShift.shift_code} w dniu ${d}.${String(month).padStart(2, '0')}, a w zamian zaoferuj wolne (OFF) w dniu ${compDayName}.`,
              type: 'compensate_off',
              actionLabel: `Zastosuj wolne w dniu ${compensatoryDay}.${String(month).padStart(2, '0')}`,
              suggestedTargetDay: compensatoryDay,
              copyMessageText: copyMsg
            });
          }

          // Wariant 2: Wsparcie zewnętrzne SUP
          negotiationOptions.push({
            id: `opt_sup_${emp.id}_${d}`,
            title: `Wariant 2: Zamówienie wsparcia Support (SUP) z innej kawiarni`,
            description: `Wstaw na dzień ${d}.${String(month).padStart(2, '0')} dyżur wsparcia zewnętrznego (SUP) i przywróć ${emp.name} 100% wolnego (OFF).`,
            type: 'support_shift',
            actionLabel: `Wstaw dyżur SUP i daj ${firstName} OFF`,
            suggestedShiftCode: 'SUP'
          });

          conflictInsights.push({
            id: `conflict_${emp.id}_${d}`,
            employeeId: emp.id,
            employeeName: emp.name,
            day: d,
            date: finalShift.date,
            dayName: `${dayNames[dow]} (${d}.${String(month).padStart(2, '0')})`,
            requestedDispo: 'OFF',
            assignedShiftCode: finalShift.shift_code,
            assignedHours: finalShift.hours,
            reason: reasonText,
            details: `Zgłoszono prośbę o wolne (OFF), lecz przydzielono ${finalShift.shift_code} (${finalShift.hours}h) w celu zabezpieczenia obsady kawiarni 108120 Janki.`,
            severity: 'critical',
            suggestion: compensatoryDay ? `Zaproponuj ${firstName} wolne w dniu ${compensatoryDay}.${String(month).padStart(2, '0')} jako rekompensatę.` : 'Rozważ zamówienie wsparcia SUP lub modyfikację dyspozycji.',
            blockers,
            negotiationOptions
          });
          compromisesList.push(`${emp.name} (dzień ${d}): ${reasonText}`);
        } else if ((requestedDispo === 'AM' || requestedDispo === 'M') && (finalShift.shift_code === 'PM' || finalShift.shift_code === 'PMN')) {
          const reasonText = `Preferencja poranka (AM) ustąpiła na rzecz obsady zamknięcia (PM) z powodu wymogu odpoczynku 11h u pozostałych osób.`;
          const firstName = emp.name.split(' ')[0];
          const copyMsg = `Cześć ${firstName}, na dzień ${dayNames[dow]} (${d}.${String(month).padStart(2, '0')}) prosiłeś/aś o poranek (AM), ale mamy brak obsady na zamknięciu. Czy mógłbyś/mogłabyś wziąć wtedy PM? Daj znać! ☕`;

          const negotiationOptions: ConflictNegotiationOption[] = [
            {
              id: `opt_dispo_pm_${emp.id}_${d}`,
              title: `Wariant: Akceptacja zamknięcia (PM) z zachowaniem godzin`,
              description: `Pozostaw zmianę PM (${finalShift.hours}h) i skonsultuj z ${emp.name}.`,
              type: 'shift_swap',
              actionLabel: `Zatwierdź PM dla ${firstName}`,
              copyMessageText: copyMsg
            }
          ];

          conflictInsights.push({
            id: `conflict_${emp.id}_${d}`,
            employeeId: emp.id,
            employeeName: emp.name,
            day: d,
            date: finalShift.date,
            dayName: `${dayNames[dow]} (${d}.${String(month).padStart(2, '0')})`,
            requestedDispo: 'AM',
            assignedShiftCode: finalShift.shift_code,
            assignedHours: finalShift.hours,
            reason: reasonText,
            details: `Zgłoszono AM, przydzielono PM (${finalShift.hours}h).`,
            severity: 'warning',
            suggestion: 'Skonsultuj z pracownikiem możliwość dyżuru wieczornego.',
            negotiationOptions
          });
          compromisesList.push(`${emp.name} (dzień ${d}): ${reasonText}`);
        } else if ((requestedDispo === 'PM' || requestedDispo === 'Z') && (finalShift.shift_code === 'AM' || finalShift.shift_code === 'AMN')) {
          const reasonText = `Preferencja wieczoru (PM) ustąpiła na rzecz obsady otwarcia (AM).`;
          const firstName = emp.name.split(' ')[0];
          const copyMsg = `Cześć ${firstName}, na dzień ${dayNames[dow]} (${d}.${String(month).padStart(2, '0')}) prosiłeś/aś o wieczór (PM), ale potrzebujemy obsadzić otwarcie (AM). Czy pasuje Ci poranny dyżur? ☕`;

          const negotiationOptions: ConflictNegotiationOption[] = [
            {
              id: `opt_dispo_am_${emp.id}_${d}`,
              title: `Wariant: Akceptacja poranka (AM)`,
              description: `Pozostaw zmianę AM (${finalShift.hours}h) i skonsultuj z ${emp.name}.`,
              type: 'shift_swap',
              actionLabel: `Zatwierdź AM dla ${firstName}`,
              copyMessageText: copyMsg
            }
          ];

          conflictInsights.push({
            id: `conflict_${emp.id}_${d}`,
            employeeId: emp.id,
            employeeName: emp.name,
            day: d,
            date: finalShift.date,
            dayName: `${dayNames[dow]} (${d}.${String(month).padStart(2, '0')})`,
            requestedDispo: 'PM',
            assignedShiftCode: finalShift.shift_code,
            assignedHours: finalShift.hours,
            reason: reasonText,
            details: `Zgłoszono PM, przydzielono AM (${finalShift.hours}h).`,
            severity: 'info',
            suggestion: 'Skonsultuj z pracownikiem możliwość otwarcia kawiarni.',
            negotiationOptions
          });
          compromisesList.push(`${emp.name} (dzień ${d}): ${reasonText}`);
        }
      }
    });

    const totalWeekendWorkDays: number[] = [];
    const totalClosingsSSV: number[] = [];
    let consecutiveOffBlocks = 0;
    let isolatedSingleOff = 0;
    let fullWeekendsOff = 0;

    employees.forEach(emp => {
      const ratio = emp.contract_hours_ratio || 1.0;
      let wCount = 0;
      let cCount = 0;
      let hasFullWeekendOff = false;

      for (let d = 1; d <= totalDays; d++) {
        const s = workingSchedule.get(`${emp.id}_${d}`)!;
        const dow = dayOfWeek[d];

        if (s.hours > 0 && s.shift_code !== 'OFF') {
          if (dow === 0 || dow === 6) wCount++;
          if (s.shift_code === 'PM' || s.shift_code === 'PMN') cCount++;
        } else {
          const prevS = d > 1 ? workingSchedule.get(`${emp.id}_${d - 1}`) : null;
          const nextS = d < totalDays ? workingSchedule.get(`${emp.id}_${d + 1}`) : null;
          const prevIsOff = !prevS || prevS.shift_code === 'OFF' || prevS.hours === 0;
          const nextIsOff = !nextS || nextS.shift_code === 'OFF' || nextS.hours === 0;

          if (prevIsOff || nextIsOff) {
            if (prevIsOff && (!nextS || nextS.shift_code !== 'OFF')) consecutiveOffBlocks++;
          } else {
            isolatedSingleOff++;
          }

          if (dow === 6 && d < totalDays) {
            const sunS = workingSchedule.get(`${emp.id}_${d + 1}`);
            if (!sunS || sunS.shift_code === 'OFF' || sunS.hours === 0) {
              hasFullWeekendOff = true;
            }
          }
        }
      }

      if (hasFullWeekendOff) fullWeekendsOff++;
      totalWeekendWorkDays.push(wCount / ratio);
      if (emp.role !== 'SM') totalClosingsSSV.push(cCount / ratio);
    });

    const calcVariance = (arr: number[]): number => {
      if (arr.length <= 1) return 0;
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    };

    const weekendVariance = calcVariance(totalWeekendWorkDays);
    const closingsVariance = calcVariance(totalClosingsSSV);

    const weekendFairnessScore = Math.max(70, Math.min(100, Math.round(100 - weekendVariance * 12)));
    const closingsFairnessScore = Math.max(70, Math.min(100, Math.round(100 - closingsVariance * 10)));
    const weeklySmoothingScore = Math.max(75, Math.min(100, Math.round(98 - isolatedSingleOff * 2)));

    const qualityMetrics: AutoScheduleQualityMetrics = {
      weekendFairnessScore,
      closingsFairnessScore,
      weeklySmoothingScore,
      consecutiveOffBlocksCount: consecutiveOffBlocks,
      isolatedSingleOffCount: isolatedSingleOff,
      fullWeekendsOffCount: fullWeekendsOff,
      totalEmployeesCount: employees.length
    };

    const violations: LaborLawViolation[] = [];
    employees.forEach(emp => {
      const empShiftsByDay: Record<number, ManagerScheduleShift> = {};
      generatedShifts
        .filter(s => s.employee_id === emp.id)
        .forEach(s => {
          empShiftsByDay[s.day] = s;
        });

      const valRes = ManagerScheduleEngine.validateLaborLaw(
        year,
        month,
        totalDays,
        emp,
        empShiftsByDay,
        shiftMap,
        { prevMonthShifts }
      );
      violations.push(...valRes.violations);
    });

    const overallDispoRate = dispositionTotalCount > 0
      ? Number(((dispositionMatchedCount / dispositionTotalCount) * 100).toFixed(1))
      : 100;

    let missingCoverageCount = 0;
    for (let day = 1; day <= totalDays; day++) {
      let hasAm = false;
      let hasPm = false;
      employees.forEach(emp => {
        const s = workingSchedule.get(`${emp.id}_${day}`);
        if (s && s.hours > 0) {
          if (s.shift_code === 'AM' || s.shift_code === 'AMN' || s.shift_code === 'AMB') hasAm = true;
          if (s.shift_code === 'PM' || s.shift_code === 'PMN' || s.shift_code === 'PMB') hasPm = true;
        }
      });
      if (!hasAm || !hasPm) missingCoverageCount++;
    }

    return {
      year,
      month,
      generatedShifts,
      diffs,
      stats: {
        totalPlannedHours: Number(totalPlannedHours.toFixed(1)),
        targetTeamHours: Number(ctx.teamTargetNominalHours.toFixed(1)),
        dispositionMatchRate: overallDispoRate,
        dispositionTotalCount,
        dispositionMatchedCount,
        coverageDaysCount: totalDays - missingCoverageCount,
        missingCoverageCount,
        violationsCount: violations.length,
        midShiftsCount,
        openingShiftsCount,
        closingShiftsCount,
        ncShiftsCount,
        iterationsEvaluated,
        qualityMetrics
      },
      employeeStats,
      violations,
      compromises: compromisesList,
      conflictInsights
    };
  }

  /**
   * Zoptymalizowany asynchroniczny Multi-Pass Tournament Solver.
   * Domyślnie wykonuje do 2 000 prób z inteligentnym wczesnym zatrzymaniem (Early Stopping)
   * i nieblokującym podziałem na partie (batching) dla zerowego obciążenia interfejsu.
   */
  public static async generateScheduleAsync(
    year: number,
    month: number,
    employees: ManagerEmployee[],
    shiftDefinitions: ShiftDefinition[],
    existingShifts: ManagerScheduleShift[],
    dispositionsByEmployee: Record<number, Record<number, string>>,
    options: AutoScheduleOptions,
    prevMonthShifts: ManagerScheduleShift[] = [],
    onProgress?: (p: AutoScheduleProgress) => void
  ): Promise<AutoScheduleResult> {
    const totalRounds = options.iterationsCount || 2000;
    const startTime = Date.now();

    const ctx = this.precomputeContext(
      year,
      month,
      employees,
      shiftDefinitions,
      existingShifts,
      dispositionsByEmployee,
      options,
      prevMonthShifts
    );

    let bestPass: FastCandidateResult | null = null;
    let iterationsDone = 0;

    const BATCH_SIZE = 100;

    for (let round = 0; round < totalRounds; round += BATCH_SIZE) {
      const batchEnd = Math.min(round + BATCH_SIZE, totalRounds);

      for (let r = round; r < batchEnd; r++) {
        iterationsDone++;
        const seedJitter = r === 0 ? 0 : r;
        const candidate = this.runFastSinglePass(
          ctx,
          employees,
          dispositionsByEmployee,
          options,
          prevMonthShifts,
          seedJitter
        );

        if (!bestPass || candidate.fitness > bestPass.fitness) {
          bestPass = candidate;
        }
      }

      if (onProgress && bestPass) {
        onProgress({
          currentRound: batchEnd,
          totalRounds,
          percent: Math.round((batchEnd / totalRounds) * 100),
          bestDispoMatchRate: Math.round(bestPass.dispoMatchRate),
          bestViolationsCount: bestPass.violationsCount,
          bestPlannedHours: Number(bestPass.totalPlannedHours.toFixed(1)),
          targetTeamHours: Number(ctx.teamTargetNominalHours.toFixed(1)),
          elapsedMs: Date.now() - startTime
        });
      }

      // Early Stopping: jeśli znaleziono optymalny grafik (0 braków obsady, >=98% dyspozycji i minimalna delta godzin)
      if (
        iterationsDone >= 300 &&
        bestPass &&
        bestPass.missingCoverageCount === 0 &&
        bestPass.dispoMatchRate >= 98 &&
        Math.abs(bestPass.totalPlannedHours - ctx.teamTargetNominalHours) <= 2.0
      ) {
        if (onProgress) {
          onProgress({
            currentRound: totalRounds,
            totalRounds,
            percent: 100,
            bestDispoMatchRate: Math.round(bestPass.dispoMatchRate),
            bestViolationsCount: bestPass.violationsCount,
            bestPlannedHours: Number(bestPass.totalPlannedHours.toFixed(1)),
            targetTeamHours: Number(ctx.teamTargetNominalHours.toFixed(1)),
            elapsedMs: Date.now() - startTime
          });
        }
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return this.buildFullResult(
      ctx,
      bestPass!.workingSchedule,
      employees,
      dispositionsByEmployee,
      options,
      prevMonthShifts,
      bestPass!.compromises,
      iterationsDone
    );
  }

  /**
   * Synchroniczny Multi-Pass Solver
   */
  public static generateSchedule(
    year: number,
    month: number,
    employees: ManagerEmployee[],
    shiftDefinitions: ShiftDefinition[],
    existingShifts: ManagerScheduleShift[],
    dispositionsByEmployee: Record<number, Record<number, string>>,
    options: AutoScheduleOptions,
    prevMonthShifts: ManagerScheduleShift[] = []
  ): AutoScheduleResult {
    const TOURNAMENT_ROUNDS = options.iterationsCount || 100;
    const ctx = this.precomputeContext(
      year,
      month,
      employees,
      shiftDefinitions,
      existingShifts,
      dispositionsByEmployee,
      options,
      prevMonthShifts
    );

    let bestPass: FastCandidateResult | null = null;

    for (let round = 0; round < TOURNAMENT_ROUNDS; round++) {
      const seedJitter = round === 0 ? 0 : round;
      const candidate = this.runFastSinglePass(
        ctx,
        employees,
        dispositionsByEmployee,
        options,
        prevMonthShifts,
        seedJitter
      );

      if (!bestPass || candidate.fitness > bestPass.fitness) {
        bestPass = candidate;
      }
    }

    return this.buildFullResult(
      ctx,
      bestPass!.workingSchedule,
      employees,
      dispositionsByEmployee,
      options,
      prevMonthShifts,
      bestPass!.compromises,
      TOURNAMENT_ROUNDS
    );
  }
}
