import {
  ManagerEmployee,
  ShiftDefinition,
  ManagerScheduleShift,
  ManagerCalculatedRow,
  DayCoverageSummary,
  ManagerScheduleMonthData,
  LaborLawViolation,
  PublicationStatusInfo,
  ShiftComplianceTestResult,
  MonthlyNormRecord,
  RcpAbsenceConflict
} from '../../../types/index';

/**
 * Algorytm wyznaczania Wielkanocy (Meeus/Jones/Butcher)
 */
function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Zwraca mapę polskich świąt ustawowo wolnych od pracy dla danego roku
 */
export function getPolishHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();

  // Stałe święta ustawowo wolne od pracy w Polsce
  holidays.set(`${year}-01-01`, 'Nowy Rok');
  holidays.set(`${year}-01-06`, 'Święto Trzech Króli');
  holidays.set(`${year}-05-01`, 'Święto Pracy');
  holidays.set(`${year}-05-03`, 'Święto Konstytucji 3 Maja');
  holidays.set(`${year}-08-15`, 'Wniebowzięcie NMP / Wojska Polskiego');
  holidays.set(`${year}-11-01`, 'Wszystkich Świętych');
  holidays.set(`${year}-11-11`, 'Narodowe Święto Niepodległości');
  holidays.set(`${year}-12-25`, 'Boże Narodzenie (I dzień)');
  holidays.set(`${year}-12-26`, 'Boże Narodzenie (II dzień)');

  // Ruchome święta ustawowe
  const easter = getEasterSunday(year);
  const easterDate = new Date(year, easter.month - 1, easter.day);
  holidays.set(formatDateIso(easterDate), 'Wielkanoc (I dzień)');

  // Poniedziałek Wielkanocny (+1 dzień)
  const easterMonday = new Date(easterDate);
  easterMonday.setDate(easterDate.getDate() + 1);
  holidays.set(formatDateIso(easterMonday), 'Poniedziałek Wielkanocny');

  // Zielone Świątki (+49 dni od Wielkanocy, zawsze niedziela)
  const pentecost = new Date(easterDate);
  pentecost.setDate(easterDate.getDate() + 49);
  holidays.set(formatDateIso(pentecost), 'Zielone Świątki');

  // Boże Ciało (+60 dni od Wielkanocy)
  const corpusChristi = new Date(easterDate);
  corpusChristi.setDate(easterDate.getDate() + 60);
  holidays.set(formatDateIso(corpusChristi), 'Boże Ciało');

  return holidays;
}

/**
 * Zwraca zbiór dat ISO (YYYY-MM-DD) wszystkich niedziel handlowych w Polsce dla danego roku
 * Zgodnie z art. 7 ust. 1 Ustawy o ograniczeniu handlu w niedziele i święta:
 * 1. Ostatnia niedziela stycznia
 * 2. Niedziela przed Wielkanocą (Niedziela Palmowa)
 * 3. Ostatnia niedziela kwietnia
 * 4. Ostatnia niedziela czerwca
 * 5. Ostatnia niedziela sierpnia
 * 6 i 7. Dwie niedziele poprzedzające Boże Narodzenie (25 grudnia)
 */
export function getPolishTradingSundays(year: number): Set<string> {
  const tradingSundays = new Set<string>();

  // Pomocnicza funkcja do wyszukiwania ostatniej niedzieli w danym miesiącu (1..12)
  const getLastSundayOfMonth = (m: number): Date => {
    const lastDay = new Date(year, m, 0).getDate();
    for (let d = lastDay; d >= 1; d--) {
      const dt = new Date(year, m - 1, d);
      if (dt.getDay() === 0) return dt;
    }
    return new Date(year, m - 1, lastDay);
  };

  // 1. Ostatnia niedziela stycznia
  tradingSundays.add(formatDateIso(getLastSundayOfMonth(1)));

  // 2. Niedziela przed Wielkanocą (Niedziela Palmowa)
  const easter = getEasterSunday(year);
  const easterSunday = new Date(year, easter.month - 1, easter.day);
  const palmSunday = new Date(easterSunday);
  palmSunday.setDate(easterSunday.getDate() - 7);
  tradingSundays.add(formatDateIso(palmSunday));

  // 3. Ostatnia niedziela kwietnia
  tradingSundays.add(formatDateIso(getLastSundayOfMonth(4)));

  // 4. Ostatnia niedziela czerwca
  tradingSundays.add(formatDateIso(getLastSundayOfMonth(6)));

  // 5. Ostatnia niedziela sierpnia
  tradingSundays.add(formatDateIso(getLastSundayOfMonth(8)));

  // 6 i 7. Dwie kolejne niedziele bezpośrednio poprzedzające Boże Narodzenie (25 grudnia)
  let decSundaysCount = 0;
  for (let d = 24; d >= 1; d--) {
    const dt = new Date(year, 11, d);
    if (dt.getDay() === 0) {
      tradingSundays.add(formatDateIso(dt));
      decSundaysCount++;
      if (decSundaysCount === 2) break;
    }
  }

  return tradingSundays;
}

function formatDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseTimeToHours(timeStr?: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h + m / 60;
}

export function formatHoursToTimeString(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const FLEXIBLE_ADMIN_SHIFT_CODES = new Set([
  'NC', 'BT', 'T', 'TAM', 'TPM', 'PRE', 'MEE', 'SUP', 'SAM', 'SPM'
]);

/**
 * Zwraca optymalny, zgodny z prawem pracy przedział czasowy dla danej zmiany.
 * Dla zmian administracyjnych i elastycznych (np. NC, administracja SM), jeśli użytkownik nie ustawił
 * sztywnych godzin, godziny rozpoczęcia i zakończenia płynnie dopasowują się do sąsiadujących zmian,
 * gwarantując min. 11h odpoczynku dobowego bez sztucznych kolizji.
 */
export function resolveEffectiveShiftTimes(
  shift: ManagerScheduleShift,
  def?: ShiftDefinition,
  prevEndHour: number | null = null,
  nextStartHour: number | null = null
): { startHour: number; endHour: number; isFlexibleAdapted?: boolean } {
  // Jeśli użytkownik manualnie wpisał custom_start_time i custom_end_time, respektujemy je w 100%
  if (shift.custom_start_time && shift.custom_end_time) {
    const s = parseTimeToHours(shift.custom_start_time);
    const e = parseTimeToHours(shift.custom_end_time);
    if (s !== null && e !== null) {
      return { startHour: s, endHour: e };
    }
  }

  const duration = shift.hours > 0 ? shift.hours : (def?.hours || 8.0);
  const isFlexible = FLEXIBLE_ADMIN_SHIFT_CODES.has(shift.shift_code) || def?.is_nc === 1;

  if (isFlexible) {
    // Domyślny start dla NC / administracji to np. 08:00 lub def.start_time
    let nominalStart = parseTimeToHours(shift.custom_start_time || def?.start_time) ?? 8.0;

    // Jeśli zmiana z dnia poprzedniego kończyła się późno (np. PM 22:30 -> prevEndHour = 22.5):
    // Wymagany najwcześniejszy start: (24.0 - prevEndHour) + startHour >= 11.0 => startHour >= prevEndHour + 11.0 - 24.0
    if (prevEndHour !== null) {
      const minStartForPrevRest = prevEndHour + 11.0 - 24.0;
      if (nominalStart < minStartForPrevRest) {
        nominalStart = Math.min(14.0, Number(minStartForPrevRest.toFixed(2)));
      }
    }

    let nominalEnd = nominalStart + duration;

    // Jeśli zmiana z dnia następnego zaczyna się wcześnie (np. AM 07:00 -> nextStartHour = 7.0):
    // Wymagany najpóźniejszy koniec: (24.0 - endHour) + nextStartHour >= 11.0 => endHour <= nextStartHour + 13.0
    if (nextStartHour !== null) {
      const maxEndForNextRest = nextStartHour + 13.0;
      if (nominalEnd > maxEndForNextRest) {
        const minAllowedStart = prevEndHour !== null ? Math.max(7.0, prevEndHour + 11.0 - 24.0) : 7.0;
        const adjustedStart = Math.max(minAllowedStart, maxEndForNextRest - duration);
        nominalStart = Number(adjustedStart.toFixed(2));
        nominalEnd = nominalStart + duration;
      }
    }

    return { startHour: nominalStart, endHour: nominalEnd, isFlexibleAdapted: true };
  }

  // Sztywne zmiany operacyjne (AM, PM, AMN, PMN, MIB itp.)
  const s = parseTimeToHours(shift.custom_start_time || def?.start_time) ?? 8.0;
  const e = parseTimeToHours(shift.custom_end_time || def?.end_time) ?? (s + duration);
  return { startHour: s, endHour: e };
}

export const POLISH_MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

export const POLISH_DAY_ABBR = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];

export class ManagerScheduleEngine {
  /**
   * Wylicza normy czasu pracy Kodeksu Pracy dla danego miesiąca i roku
   */
  public static calculateMonthNorms(year: number, month: number): {
    totalDays: number;
    workingDays: number;
    offDaysNorm: number;
    fullTimeNominalHours: number;
  } {
    const daysInMonth = new Date(year, month, 0).getDate();
    const holidays = getPolishHolidays(year);

    let workingDaysCount = 0;
    let saturdayHolidays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
      const dateStr = formatDateIso(date);
      const isHoliday = holidays.has(dateStr);

      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Poniedziałek - Piątek
        if (!isHoliday) {
          workingDaysCount++;
        }
      } else if (dayOfWeek === 6 && isHoliday) {
        // Święto przypadające w sobotę obniża wymiar o 8h (art. 130 § 2 KP)
        saturdayHolidays++;
      }
    }

    const effectiveWorkingDays = Math.max(0, workingDaysCount - saturdayHolidays);
    const fullTimeNominalHours = effectiveWorkingDays * 8.0;
    const offDaysNorm = daysInMonth - effectiveWorkingDays;

    return {
      totalDays: daysInMonth,
      workingDays: effectiveWorkingDays,
      offDaysNorm,
      fullTimeNominalHours
    };
  }

  /**
   * Weryfikacja 4 kluczowych norm polskiego Kodeksu Pracy:
   * 1. Min. 11h odpoczynku dobowego między zmianami (art. 132 KP)
   * 2. Co najmniej 35h nieprzerwanego odpoczynku tygodniowego (art. 133 KP)
   * 3. Max. 12h pracy w dobie (art. 135 KP)
   * 4. Maksymalnie 3 niedziele pracujące pod rząd (art. 151^10 KP)
   */
  public static validateLaborLaw(
    year: number,
    month: number,
    totalDays: number,
    employee: ManagerEmployee,
    shiftsByDay: Record<number, ManagerScheduleShift>,
    shiftDefMap: Map<string, ShiftDefinition>,
    boundaryShifts?: {
      prevMonthShifts?: ManagerScheduleShift[];
      nextMonthShifts?: ManagerScheduleShift[];
    }
  ): {
    violations: LaborLawViolation[];
    violationsByDay: Record<number, LaborLawViolation[]>;
  } {
    const violations: LaborLawViolation[] = [];
    const violationsByDay: Record<number, LaborLawViolation[]> = {};

    const addViolation = (v: LaborLawViolation) => {
      violations.push(v);
      if (!violationsByDay[v.day]) {
        violationsByDay[v.day] = [];
      }
      violationsByDay[v.day].push(v);
    };

    const nonWorkingCodes = new Set(['OFF', 'H', 'L4', 'M', 'Z', 'FULL']);

    // ----------------------------------------------------
    // REGULA 1: Min. 11h przerwy między zmianami (art. 132 KP)
    // ----------------------------------------------------
    // 1a. Wewnętrzne dni miesiąca (D -> D+1)
    for (let day = 1; day < totalDays; day++) {
      const s1 = shiftsByDay[day];
      const s2 = shiftsByDay[day + 1];

      if (!s1 || !s2) continue;
      const isS1Working = s1.hours > 0 && !nonWorkingCodes.has(s1.shift_code);
      const isS2Working = s2.hours > 0 && !nonWorkingCodes.has(s2.shift_code);

      if (isS1Working && isS2Working) {
        const def1 = shiftDefMap.get(s1.shift_code);
        const def2 = shiftDefMap.get(s2.shift_code);

        // Wyznacz godziny dla s1 uwzględniając dzień poprzedni (day - 1)
        let s0EndHour: number | null = null;
        if (day > 1) {
          const s0 = shiftsByDay[day - 1];
          if (s0 && s0.hours > 0 && !nonWorkingCodes.has(s0.shift_code)) {
            const def0 = shiftDefMap.get(s0.shift_code);
            s0EndHour = parseTimeToHours(s0.custom_end_time || def0?.end_time);
          }
        }

        // Wyznacz godziny dla s2 uwzględniając dzień kolejny (day + 2)
        let s3StartHour: number | null = null;
        if (day + 1 < totalDays) {
          const s3 = shiftsByDay[day + 2];
          if (s3 && s3.hours > 0 && !nonWorkingCodes.has(s3.shift_code)) {
            const def3 = shiftDefMap.get(s3.shift_code);
            s3StartHour = parseTimeToHours(s3.custom_start_time || def3?.start_time);
          }
        }

        const t1 = resolveEffectiveShiftTimes(s1, def1, s0EndHour, null);
        const t2 = resolveEffectiveShiftTimes(s2, def2, t1.endHour, s3StartHour);

        const endHour1 = t1.endHour;
        const startHour2 = t2.startHour;

        if (endHour1 !== null && startHour2 !== null) {
          // Czas przerwy w godzinach: od końca zmiany dnia D do początku zmiany dnia D+1
          const restHours = Number(((24.0 - endHour1) + startHour2).toFixed(1));

          if (restHours < 11.0) {
            addViolation({
              id: `daily_rest_${employee.id}_${day + 1}`,
              employeeId: employee.id,
              employeeName: employee.name,
              ruleType: 'daily_rest_11h',
              severity: 'error',
              day: day + 1,
              title: `Zbyt krótki odpoczynek dobowy (${restHours}h < 11h)`,
              message: `Przerwa między zmianą ${s1.shift_code} (koniec ${s1.custom_end_time || formatHoursToTimeString(endHour1)}) w dniu ${day} a zmianą ${s2.shift_code} (początek ${s2.custom_start_time || formatHoursToTimeString(startHour2)}) w dniu ${day + 1} wynosi tylko ${restHours}h.`,
              details: `Kodeks Pracy (art. 132 § 1 KP) wymaga co najmniej 11 godzin nieprzerwanego odpoczynku w każdej dobie pracowniczej.`
            });
          }
        }
      }
    }

    // 1b. Przejście z poprzedniego miesiąca do dnia 1 (M-1 -> D1)
    if (boundaryShifts?.prevMonthShifts && boundaryShifts.prevMonthShifts.length > 0) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
      const prevLast = boundaryShifts.prevMonthShifts.find(s => s.employee_id === employee.id && s.day === prevMonthLastDay);
      const s1 = shiftsByDay[1];

      if (prevLast && s1) {
        const isPrevWorking = prevLast.hours > 0 && !nonWorkingCodes.has(prevLast.shift_code);
        const isS1Working = s1.hours > 0 && !nonWorkingCodes.has(s1.shift_code);

        if (isPrevWorking && isS1Working) {
          const defPrev = shiftDefMap.get(prevLast.shift_code);
          const def1 = shiftDefMap.get(s1.shift_code);

          const s2 = shiftsByDay[2];
          let s2StartHour: number | null = null;
          if (s2 && s2.hours > 0 && !nonWorkingCodes.has(s2.shift_code)) {
            const def2 = shiftDefMap.get(s2.shift_code);
            s2StartHour = parseTimeToHours(s2.custom_start_time || def2?.start_time);
          }

          const tPrev = resolveEffectiveShiftTimes(prevLast, defPrev, null, null);
          const t1 = resolveEffectiveShiftTimes(s1, def1, tPrev.endHour, s2StartHour);

          const endHourPrev = tPrev.endHour;
          const startHour1 = t1.startHour;

          if (endHourPrev !== null && startHour1 !== null) {
            const restHours = Number(((24.0 - endHourPrev) + startHour1).toFixed(1));
            if (restHours < 11.0) {
              addViolation({
                id: `daily_rest_cross_prev_${employee.id}_1`,
                employeeId: employee.id,
                employeeName: employee.name,
                ruleType: 'daily_rest_11h',
                severity: 'error',
                day: 1,
                title: `Przejście miesiąca: zbyt krótki odpoczynek dobowy (${restHours}h < 11h)`,
                message: `Przerwa między zmianą ${prevLast.shift_code} z ostatniego dnia poprzedniego miesiąca (${prevMonthLastDay}.${String(prevMonth).padStart(2, '0')}, koniec ${prevLast.custom_end_time || formatHoursToTimeString(endHourPrev)}) a zmianą ${s1.shift_code} w dniu 1 (początek ${s1.custom_start_time || formatHoursToTimeString(startHour1)}) wynosi tylko ${restHours}h.`,
                details: `Kodeks Pracy (art. 132 § 1 KP) wymaga co najmniej 11 godzin nieprzerwanego odpoczynku między dobami pracowniczymi, w tym na styku miesięcy.`
              });
            }
          }
        }
      }
    }

    // 1c. Przejście z ostatniego dnia miesiąca do dnia 1 kolejnego miesiąca (D_last -> M+1)
    if (boundaryShifts?.nextMonthShifts && boundaryShifts.nextMonthShifts.length > 0) {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextFirst = boundaryShifts.nextMonthShifts.find(s => s.employee_id === employee.id && s.day === 1);
      const sLast = shiftsByDay[totalDays];

      if (nextFirst && sLast) {
        const isLastWorking = sLast.hours > 0 && !nonWorkingCodes.has(sLast.shift_code);
        const isNextWorking = nextFirst.hours > 0 && !nonWorkingCodes.has(nextFirst.shift_code);

        if (isLastWorking && isNextWorking) {
          const defLast = shiftDefMap.get(sLast.shift_code);
          const defNext = shiftDefMap.get(nextFirst.shift_code);

          const sPenult = shiftsByDay[totalDays - 1];
          let sPenultEndHour: number | null = null;
          if (sPenult && sPenult.hours > 0 && !nonWorkingCodes.has(sPenult.shift_code)) {
            const defPenult = shiftDefMap.get(sPenult.shift_code);
            sPenultEndHour = parseTimeToHours(sPenult.custom_end_time || defPenult?.end_time);
          }

          const tLast = resolveEffectiveShiftTimes(sLast, defLast, sPenultEndHour, null);
          const tNext = resolveEffectiveShiftTimes(nextFirst, defNext, tLast.endHour, null);

          const endHourLast = tLast.endHour;
          const startHourNext = tNext.startHour;

          if (endHourLast !== null && startHourNext !== null) {
            const restHours = Number(((24.0 - endHourLast) + startHourNext).toFixed(1));
            if (restHours < 11.0) {
              addViolation({
                id: `daily_rest_cross_next_${employee.id}_${totalDays}`,
                employeeId: employee.id,
                employeeName: employee.name,
                ruleType: 'daily_rest_11h',
                severity: 'error',
                day: totalDays,
                title: `Przejście miesiąca: zbyt krótki odpoczynek przed kolejnym miesiącem (${restHours}h < 11h)`,
                message: `Przerwa między zmianą ${sLast.shift_code} w dniu ${totalDays} (koniec ${sLast.custom_end_time || formatHoursToTimeString(endHourLast)}) a zaplanowaną zmianą ${nextFirst.shift_code} w dniu 1.${String(nextMonth).padStart(2, '0')} (początek ${nextFirst.custom_start_time || formatHoursToTimeString(startHourNext)}) wynosi tylko ${restHours}h.`,
                details: `Kodeks Pracy (art. 132 § 1 KP) wymaga co najmniej 11 godzin nieprzerwanego odpoczynku między dobami pracowniczymi.`
              });
            }
          }
        }
      }
    }

    // ----------------------------------------------------
    // REGULA 2: Max. 12h pracy w dobie (art. 135 KP)
    // ----------------------------------------------------
    for (let day = 1; day <= totalDays; day++) {
      const s = shiftsByDay[day];
      if (s && s.hours > 12.0) {
        addViolation({
          id: `max_daily_${employee.id}_${day}`,
          employeeId: employee.id,
          employeeName: employee.name,
          ruleType: 'max_daily_12h',
          severity: 'error',
          day,
          title: `Przekroczenie 12h pracy (${s.hours}h > 12h)`,
          message: `Dla zmiany ${s.shift_code} zaplanowano ${s.hours}h pracy w jednej dobie.`,
          details: `Zgodnie z art. 135 KP maksymalny dobowy wymiar czasu pracy nie może przekraczać 12 godzin.`
        });
      }
    }

    // ----------------------------------------------------
    // REGULA 3: Maksymalnie 3 pracujące niedziele pod rząd (art. 151^10 KP)
    // ----------------------------------------------------
    let consecutiveWorkingSundays = 0;

    // Uwzględnienie serii pracujących niedziel z końca poprzedniego miesiąca
    if (boundaryShifts?.prevMonthShifts && boundaryShifts.prevMonthShifts.length > 0) {
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
      const prevSundays: number[] = [];
      for (let d = 1; d <= prevMonthLastDay; d++) {
        if (new Date(prevYear, prevMonth - 1, d).getDay() === 0) {
          prevSundays.push(d);
        }
      }
      for (let i = prevSundays.length - 1; i >= 0; i--) {
        const sunD = prevSundays[i];
        const prevS = boundaryShifts.prevMonthShifts.find(s => s.employee_id === employee.id && s.day === sunD);
        if (prevS && prevS.hours > 0 && !nonWorkingCodes.has(prevS.shift_code)) {
          consecutiveWorkingSundays++;
        } else {
          break;
        }
      }
    }

    const sundays: number[] = [];
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === 0) {
        sundays.push(day);
      }
    }

    for (const sunDay of sundays) {
      const s = shiftsByDay[sunDay];
      const isWorking = s && s.hours > 0 && !nonWorkingCodes.has(s.shift_code);

      if (isWorking) {
        consecutiveWorkingSundays++;
        if (consecutiveWorkingSundays > 3) {
          addViolation({
            id: `consecutive_sundays_${employee.id}_${sunDay}`,
            employeeId: employee.id,
            employeeName: employee.name,
            ruleType: 'consecutive_sundays',
            severity: 'error',
            day: sunDay,
            title: `4. pracująca niedziela z rzędu (max 3)`,
            message: `Zaplanowano ${consecutiveWorkingSundays}. pracującą niedzielę pod rząd dla ${employee.name} (wliczając niedziele z poprzedniego miesiąca).`,
            details: `Zgodnie z art. 151^10 KP pracownik pracujący w niedziele powinien korzystać co najmniej raz na 4 tygodnie z wolnej niedzieli.`
          });
        }
      } else {
        consecutiveWorkingSundays = 0;
      }
    }

    // ----------------------------------------------------
    // REGULA 4: Co najmniej 35h nieprzerwanego odpoczynku tygodniowego (art. 133 KP)
    // ----------------------------------------------------
    let consecutiveWorkingDaysCount = 0;

    // Uwzględnienie dni ciągłej pracy z końca poprzedniego miesiąca
    if (boundaryShifts?.prevMonthShifts && boundaryShifts.prevMonthShifts.length > 0) {
      const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
      for (let d = prevMonthLastDay; d >= Math.max(1, prevMonthLastDay - 6); d--) {
        const prevS = boundaryShifts.prevMonthShifts.find(s => s.employee_id === employee.id && s.day === d);
        if (prevS && prevS.hours > 0 && !nonWorkingCodes.has(prevS.shift_code)) {
          consecutiveWorkingDaysCount++;
        } else {
          break;
        }
      }
    }

    for (let day = 1; day <= totalDays; day++) {
      const s = shiftsByDay[day];
      const isWorking = s && s.hours > 0 && !nonWorkingCodes.has(s.shift_code);

      if (isWorking) {
        consecutiveWorkingDaysCount++;
        if (consecutiveWorkingDaysCount >= 7) {
          addViolation({
            id: `weekly_rest_${employee.id}_${day}`,
            employeeId: employee.id,
            employeeName: employee.name,
            ruleType: 'weekly_rest_35h',
            severity: 'warning',
            day,
            title: `Brak 35h odpoczynku tygodniowego (${consecutiveWorkingDaysCount} dni pracy z rzędu)`,
            message: `Menedżer pracuje ${consecutiveWorkingDaysCount} dni z rzędu bez co najmniej 35-godzinnej ciągłej przerwy wypoczynkowej (wliczając ciągłość z poprzedniego miesiąca).`,
            details: `Zgodnie z art. 133 § 1 KP pracownikowi przysługuje w każdym tygodniu prawo do co najmniej 35 godzin nieprzerwanego odpoczynku.`
          });
        }
      } else {
        consecutiveWorkingDaysCount = 0;
      }
    }

    // ----------------------------------------------------
    // REGULA 5: Zmiana niedzielna zaplanowana w dzień powszedni
    // ----------------------------------------------------
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month - 1, day);
      const isSunday = date.getDay() === 0;
      const s = shiftsByDay[day];
      if (s && !isSunday && s.hours > 0 && !nonWorkingCodes.has(s.shift_code)) {
        const def = shiftDefMap.get(s.shift_code);
        const isSundayOnly = def?.is_sunday_only || (def?.name && def.name.toLowerCase().includes('niedziel')) || ['AMN', 'PMN'].includes(s.shift_code);
        if (isSundayOnly) {
          addViolation({
            id: `sunday_shift_invalid_${employee.id}_${day}`,
            employeeId: employee.id,
            employeeName: employee.name,
            ruleType: 'sunday_shift_invalid',
            severity: 'error',
            day,
            title: `Zmiana niedzielna poza niedzielą (${s.shift_code})`,
            message: `Zmiana ${s.shift_code} (${def?.name || 'Niedziela'}) może być zaplanowana wyłącznie w niedzielę. Dzień ${day} to dzień powszedni.`,
            details: `Reguła operacyjna grafiku: kody zmian oznaczone jako niedzielne (np. AMN, PMN) mogą być wyznaczane wyłącznie w niedziele.`
          });
        }
      }
    }

    return { violations, violationsByDay };
  }

  /**
   * Główna funkcja kalkulacji danych miesiąca dla widoku grafiku managerskiego
   */
  public static calculateMonthData(
    year: number,
    month: number,
    employees: ManagerEmployee[],
    shiftDefinitions: ShiftDefinition[],
    shifts: ManagerScheduleShift[],
    events: { day: number; event_text: string }[],
    monthlyNormRecord?: MonthlyNormRecord | null,
    boundaryShifts?: {
      prevMonthShifts?: ManagerScheduleShift[];
      nextMonthShifts?: ManagerScheduleShift[];
    },
    rcpLogs?: Record<number, Record<number, { hours: number; unitCode?: string; unitName?: string }>>,
    hasCompleteRcpLogs?: boolean
  ): ManagerScheduleMonthData {
    const monthName = POLISH_MONTH_NAMES[month - 1] || `Miesiąc ${month}`;
    const calculatedNorms = this.calculateMonthNorms(year, month);
    const norms = {
      totalDays: calculatedNorms.totalDays,
      workingDays: monthlyNormRecord ? Number(monthlyNormRecord.working_days) : calculatedNorms.workingDays,
      offDaysNorm: monthlyNormRecord ? Number(monthlyNormRecord.off_days) : calculatedNorms.offDaysNorm,
      fullTimeNominalHours: monthlyNormRecord ? Number(monthlyNormRecord.full_time_hours) : calculatedNorms.fullTimeNominalHours
    };
    const isCustomNorm = Boolean(monthlyNormRecord?.is_custom);
    const customNormNotes = monthlyNormRecord?.notes;
    const holidays = getPolishHolidays(year);

    // Mapa definicji zmian po kodzie
    const shiftDefMap = new Map<string, ShiftDefinition>();
    for (const def of shiftDefinitions) {
      shiftDefMap.set(def.code, def);
    }

    // Mapa zmian: empId -> day -> shift
    const shiftsByEmp = new Map<number, Map<number, ManagerScheduleShift>>();
    for (const s of shifts) {
      if (!shiftsByEmp.has(s.employee_id)) {
        shiftsByEmp.set(s.employee_id, new Map());
      }
      shiftsByEmp.get(s.employee_id)!.set(s.day, s);
    }

    // Mapa wydarzeń po dniu
    const eventsMap: Record<number, string> = {};
    for (const ev of events) {
      if (ev.event_text && ev.event_text.trim()) {
        eventsMap[ev.day] = ev.event_text.trim();
      }
    }

    const allMonthViolations: LaborLawViolation[] = [];

    // Wyliczanie wierszy dla każdego menedżera
    const rows: ManagerCalculatedRow[] = employees.map(emp => {
      const empShiftsMap = shiftsByEmp.get(emp.id) || new Map<number, ManagerScheduleShift>();
      const shiftsRecord: Record<number, ManagerScheduleShift> = {};
      const empRatio = emp.contract_hours_ratio || 1.0;

      let totalWorkedHours = 0;
      let totalOffDays = 0;

      for (let day = 1; day <= norms.totalDays; day++) {
        let s = empShiftsMap.get(day);
        if (!s) {
          // Domyślnie brak przypisanej zmiany = OFF
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          s = {
            year,
            month,
            day,
            date: dateStr,
            employee_id: emp.id,
            shift_code: 'OFF',
            hours: 0.0
          };
        }
        shiftsRecord[day] = s;

        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();
        const dateStr = formatDateIso(date);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = holidays.has(dateStr);
        const isNonWorkingDay = isWeekend || isHoliday;

        // Godziny wypracowane: suma godzin ze zmian (w tym H oraz L4 wliczane do etatu pracownika)
        let effectiveHours = s.hours;
        if (s.shift_code === 'H') {
          // Urlop wypoczynkowy NIE liczy się w weekendy i święta państwowe (0.0h)
          // W dni robocze wynosi wymiar dobowy etatu pracownika (8.0 * empRatio)
          effectiveHours = isNonWorkingDay ? 0.0 : Number((8.0 * empRatio).toFixed(1));
          s.hours = effectiveHours;
        } else if (s.shift_code === 'L4') {
          // L4 w dni robocze wlicza się do etatu w wymiarze dobowym etatu pracownika (8.0 * empRatio)
          // W weekendy i święta państwowe (dni wolne) = 0.0h
          effectiveHours = isNonWorkingDay ? 0.0 : Number((8.0 * empRatio).toFixed(1));
          s.hours = effectiveHours;
        }

        if (effectiveHours > 0) {
          totalWorkedHours += effectiveHours;
        }

        // Zliczanie dni wolnych
        if (s.shift_code === 'OFF') {
          totalOffDays++;
        }
      }

      totalWorkedHours = Number(totalWorkedHours.toFixed(1));
      const nominalHours = Number((norms.fullTimeNominalHours * empRatio).toFixed(1));
      const balanceHours = Number((totalWorkedHours - nominalHours).toFixed(1));
      const coveragePercent = nominalHours > 0
        ? Number(((totalWorkedHours / nominalHours) * 100).toFixed(1))
        : 100.0;

      // Walidacja reguł Kodeksu Pracy dla menedżera (w tym przejść między miesiącami)
      const { violations, violationsByDay } = this.validateLaborLaw(
        year,
        month,
        norms.totalDays,
        emp,
        shiftsRecord,
        shiftDefMap,
        boundaryShifts
      );

      allMonthViolations.push(...violations);

      return {
        employee: emp,
        shifts: shiftsRecord,
        totalWorkedHours,
        totalOffDays,
        nominalHours,
        coveragePercent,
        balanceHours,
        violations,
        violationsByDay
      };
    });

    // Wyliczanie podsumowania dziennego (pokrycie otwarć AM / zamknięć PM w kawiarni 108120 Janki)
    const daySummaries: DayCoverageSummary[] = [];

    // Zmiany wsparcia na INNYCH kawiarniach (SUP, SAM, SPM) — liczą się do czasu pracy menedżera, ale NIE do obsady Janki
    const externalSupportCodes = new Set(['SUP', 'SAM', 'SPM']);
    const openingShiftCodes = new Set(['AM', 'AMN', 'AMB']); // otwarcia Janki (SAM to wsparcie innej kawiarni)
    const closingShiftCodes = new Set(['PM', 'PMN', 'PMB']); // zamknięcia Janki (SPM to wsparcie innej kawiarni)
    const nonWorkingCodes = new Set(['OFF', 'L4', 'M', 'Z', 'FULL']);

    // Inicjalizacja niedziel handlowych dla całego miesiąca (holidays zadeklarowane wyżej)
    const tradingSundays = getPolishTradingSundays(year);

    for (let day = 1; day <= norms.totalDays; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      const dayName = POLISH_DAY_ABBR[dayOfWeek];
      const isSunday = dayOfWeek === 0;
      const isSaturday = dayOfWeek === 6;
      const isWeekend = isSunday || isSaturday;
      const dateStr = formatDateIso(date);
      const isHoliday = holidays.has(dateStr);
      const holidayName = holidays.get(dateStr);
      const isTradingSunday = isSunday && tradingSundays.has(dateStr);
      const isNonTradingSunday = isSunday && !isTradingSunday;
      const isNonWorkingDay = isWeekend || isHoliday;
      const dayType: 'workday' | 'saturday' | 'sunday_non_trading' | 'sunday_trading' | 'holiday' = isHoliday
        ? 'holiday'
        : isTradingSunday
        ? 'sunday_trading'
        : isNonTradingSunday
        ? 'sunday_non_trading'
        : isSaturday
        ? 'saturday'
        : 'workday';

      let totalManagersWorking = 0;
      const openingManagers: string[] = [];
      const closingManagers: string[] = [];
      const externalSupportManagers: string[] = [];

      for (const row of rows) {
        const shift = row.shifts[day];
        if (!shift) continue;
        const code = shift.shift_code;

        // Menedżer liczy się do obsady kawiarni Janki tylko gdy pracuje na miejscu (nie jest to nieobecność H/L4 ani wsparcie na zewnątrz SUP/SAM/SPM)
        if (!nonWorkingCodes.has(code) && code !== 'H' && !externalSupportCodes.has(code)) {
          totalManagersWorking++;
        }

        if (externalSupportCodes.has(code)) {
          externalSupportManagers.push(`${row.employee.name.split(' ')[0]} (${code})`);
        }

        if (openingShiftCodes.has(code)) {
          openingManagers.push(row.employee.name.split(' ')[0]); // Imię
        }
        if (closingShiftCodes.has(code)) {
          closingManagers.push(row.employee.name.split(' ')[0]); // Imię
        }
      }

      const dayViolationsCount = rows.reduce((sum, r) => sum + (r.violationsByDay[day]?.length || 0), 0);

      daySummaries.push({
        day,
        dayName,
        dateString: dateStr,
        isWeekend,
        isHoliday,
        holidayName,
        isSunday,
        isTradingSunday,
        isNonWorkingDay,
        dayType,
        totalManagersWorking,
        hasOpeningCoverage: openingManagers.length > 0,
        hasClosingCoverage: closingManagers.length > 0,
        openingManagers,
        closingManagers,
        externalSupportManagers,
        eventText: eventsMap[day] || undefined,
        violationsCount: dayViolationsCount
      });
    }

    // Całkowite godziny zespołu i średnie pokrycie
    const totalTeamHours = Number(rows.reduce((sum, r) => sum + r.totalWorkedHours, 0).toFixed(1));
    const averageCoveragePercent = rows.length > 0
      ? Number((rows.reduce((sum, r) => sum + r.coveragePercent, 0) / rows.length).toFixed(1))
      : 100.0;

    const tradingSundaysList = daySummaries.filter(d => d.isTradingSunday).map(d => d.day);
    const holidaysList = daySummaries.filter(d => d.isHoliday && d.holidayName).map(d => ({ day: d.day, name: d.holidayName! }));

    // Wykrywanie kolizji zarejestrowanych logowań RCP z urlopami (H) i chorobowym (L4)
    const rcpConflicts: RcpAbsenceConflict[] = [];
    if (rcpLogs) {
      for (const row of rows) {
        const empRcp = rcpLogs[row.employee.id];
        if (!empRcp) continue;

        for (let day = 1; day <= norms.totalDays; day++) {
          const shift = row.shifts[day];
          const code = shift?.shift_code;
          if (code === 'H' || code === 'L4') {
            const rcpDay = empRcp[day];
            if (rcpDay && rcpDay.hours > 0) {
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              rcpConflicts.push({
                employeeId: row.employee.id,
                employeeName: row.employee.name,
                day,
                date: dateStr,
                shiftCode: code as 'L4' | 'H',
                shiftName: code === 'H' ? 'Urlop Wypoczynkowy (H)' : 'Zwolnienie Lekarskie (L4)',
                rcpHours: rcpDay.hours,
                unitCode: rcpDay.unitCode,
                unitName: rcpDay.unitName
              });
            }
          }
        }
      }
    }

    return {
      year,
      month,
      monthName,
      totalDays: norms.totalDays,
      workingDays: norms.workingDays,
      offDaysNorm: norms.offDaysNorm,
      fullTimeNominalHours: norms.fullTimeNominalHours,
      tradingSundaysCount: tradingSundaysList.length,
      tradingSundaysList,
      holidaysCount: holidaysList.length,
      holidaysList,
      isCustomNorm,
      customNormNotes,
      isMonthClosed: this.isMonthClosed(year, month),
      employees,
      shiftDefinitions,
      rows,
      daySummaries,
      events: eventsMap,
      totalTeamHours,
      averageCoveragePercent,
      violations: allMonthViolations,
      totalViolationsCount: allMonthViolations.length,
      rcpLogs,
      hasCompleteRcpLogs: Boolean(hasCompleteRcpLogs),
      rcpConflicts
    };
  }

  /**
   * Sprawdza, czy dany miesiąc jest zamknięty (miniony miesiąc kalendarzowy względem bieżącej daty systemowej)
   * Zgodnie z wytycznymi, grafik z zamkniętych miesięcy przeszłych ma całkowicie zablokowaną możliwość edycji (tryb tylko do odczytu / archiwum).
   */
  public static isMonthClosed(
    year: number,
    month: number,
    currentDate: Date = new Date()
  ): boolean {
    const curYear = currentDate.getFullYear();
    const curMonth = currentDate.getMonth() + 1;
    if (year < curYear) return true;
    if (year === curYear && month < curMonth) return true;
    return false;
  }

  /**
   * Wylicza status publikacji grafiku w odniesieniu do reguły 7 dni przed wejściem w życie (art. 129 § 3 KP)
   */
  public static getPublicationStatus(
    year: number,
    month: number,
    currentDate: Date = new Date()
  ): PublicationStatusInfo {
    // 1. dzień miesiąca grafiku o północy
    const firstDay = new Date(year, month - 1, 1, 0, 0, 0);
    // Data graniczna publikacji: dokładnie 7 dni przed 1. dniem miesiąca
    const cutoffDate = new Date(year, month - 1, 1, 0, 0, 0);
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    // Wyzerujmy godziny dla bieżącej daty w porównaniu dni
    const curDateClean = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0);

    const diffMs = cutoffDate.getTime() - curDateClean.getTime();
    const daysUntilPublication = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const isPublished = daysUntilPublication <= 0;

    const firstDayStr = formatDateIso(firstDay);
    const cutoffDateStr = formatDateIso(cutoffDate);

    if (isPublished) {
      return {
        year,
        month,
        firstDayOfSchedule: firstDayStr,
        publicationCutoffDate: cutoffDateStr,
        daysUntilPublication,
        isPublished: true,
        statusBadge: 'published',
        statusLabel: 'Grafik Opublikowany (Oficjalny)',
        statusDescription: `Grafik wszedł w życie na 7 dni przed startem okresu (wymóg art. 129 § 3 KP). Wcześniejsze wersje robocze zostały zamrożone. Każda kolejna modyfikacja zapisuje się jako korekta po publikacji.`
      };
    } else {
      return {
        year,
        month,
        firstDayOfSchedule: firstDayStr,
        publicationCutoffDate: cutoffDateStr,
        daysUntilPublication,
        isPublished: false,
        statusBadge: 'draft',
        statusLabel: `Wersja Robocza (Pozostało ${daysUntilPublication} dni do publikacji)`,
        statusDescription: `Faza planowania roboczego. Zgodnie z art. 129 § 3 KP grafik musi zostać ostatecznie opublikowany do dnia ${cutoffDateStr}. Do tego czasu możesz tworzyć punkty przywracania i cofać wersje.`
      };
    }
  }

  /**
   * Pre-flight walidacja KP przed przypisaniem zmiany:
   * Sprawdza, czy przypisanie danej zmiany nie spowoduje złamania przepisów Kodeksu Pracy.
   */
  public static testShiftCompliance(
    year: number,
    month: number,
    employeeId: number,
    day: number,
    newShiftCode: string,
    rows: ManagerCalculatedRow[],
    shiftDefinitions: ShiftDefinition[],
    boundaryShifts?: {
      prevMonthShifts?: ManagerScheduleShift[];
      nextMonthShifts?: ManagerScheduleShift[];
    },
    customHours?: number,
    customStartTime?: string,
    customEndTime?: string
  ): ShiftComplianceTestResult {
    const row = rows.find(r => r.employee.id === employeeId);
    if (!row) {
      return { isValid: true, violations: [] };
    }

    const shiftDefMap = new Map<string, ShiftDefinition>();
    for (const def of shiftDefinitions) {
      shiftDefMap.set(def.code, def);
    }

    const empRatio = row.employee.contract_hours_ratio || 1.0;
    const def = shiftDefMap.get(newShiftCode);
    let hours = customHours !== undefined ? customHours : (def ? def.hours : (newShiftCode === 'OFF' ? 0.0 : 8.0));
    if (newShiftCode === 'L4' || newShiftCode === 'H') {
      hours = Number((8.0 * empRatio).toFixed(1));
    }
    const totalDays = new Date(year, month, 0).getDate();

    // Utwórz kopię zmian menedżera z nową testowaną wartością
    const testShifts: Record<number, ManagerScheduleShift> = {};
    for (let d = 1; d <= totalDays; d++) {
      if (d === day) {
        testShifts[d] = {
          year,
          month,
          day: d,
          date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          employee_id: employeeId,
          shift_code: newShiftCode,
          hours,
          custom_start_time: customStartTime,
          custom_end_time: customEndTime
        };
      } else {
        testShifts[d] = row.shifts[d] || {
          year,
          month,
          day: d,
          date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          employee_id: employeeId,
          shift_code: 'OFF',
          hours: 0.0
        };
      }
    }

    // Walidacja prawem pracy dla testowanego zestawu (w tym reguły przejść między miesiącami)
    const { violations } = this.validateLaborLaw(
      year,
      month,
      totalDays,
      row.employee,
      testShifts,
      shiftDefMap,
      boundaryShifts
    );

    // Filtrujemy naruszenia, które wiążą się bezpośrednio z modyfikowanym dniem:
    // np. naruszenie odpoczynku dobowego w dniu 'day' lub 'day + 1'
    const directViolations = violations.filter(v => {
      if (v.day === day) return true;
      if (v.ruleType === 'daily_rest_11h' && (v.day === day || v.day === day + 1)) return true;
      if (v.ruleType === 'consecutive_sundays' && v.day === day) return true;
      return false;
    });

    if (directViolations.length > 0) {
      return {
        isValid: false,
        violations: directViolations,
        primaryViolation: directViolations[0]
      };
    }

    return {
      isValid: true,
      violations: []
    };
  }
}
