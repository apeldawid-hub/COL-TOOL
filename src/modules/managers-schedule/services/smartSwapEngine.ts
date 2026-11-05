import {
  ManagerEmployee,
  ShiftDefinition,
  ManagerScheduleShift,
  ManagerScheduleMonthData,
  LaborLawViolation
} from '../../../types';
import {
  ManagerScheduleEngine,
  formatManagerRole
} from './managerScheduleEngine';

export interface SmartSwapChange {
  employeeId: number;
  employeeName: string;
  day: number;
  date: string;
  prevShiftCode: string;
  newShiftCode: string;
  hours: number;
  customStartTime?: string;
  customEndTime?: string;
}

export interface SmartSwapCandidate {
  id: string;
  type: 'same_day' | 'cross_day';
  targetEmployeeId: number;
  targetEmployeeName: string;
  targetRole: string;
  primaryDay: number;
  compensatingDay?: number;
  score: number;
  qualityBadge: 'ideal' | 'good' | 'acceptable';
  tag: string;
  description: string;
  explanation: string;
  laborLawCompliant: boolean;
  hoursDeltaA: number;
  hoursDeltaB: number;
  containsVacation: boolean;
  containsAdmin: boolean;
  changes: SmartSwapChange[];
}

export interface RowReRollResult {
  success: boolean;
  swapsExecuted: number;
  changes: SmartSwapChange[];
  summary: string;
  details: string[];
}

function getDayWeekIndex(year: number, month: number, d: number): number {
  const dt = new Date(year, month - 1, d);
  const dayOfWeek = (dt.getDay() + 6) % 7; // 0 = Pn, 6 = Nd
  const mondayNum = d - dayOfWeek;
  return Math.max(0, Math.floor((mondayNum + 6) / 7));
}

function formatDateIso(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

const IMMUTABLE_CODES = new Set(['L4']);

/**
 * Silnik Inteligentnej Wymiany Parzystej (Smart Swap) i Re-rollu Wiersza (Minimal-Invasive Swap Chain)
 */
export class SmartSwapEngine {
  /**
   * Wyszukuje optymalne propozycje zamiany dla wskazanej komórki menedżera
   */
  public static findSmartSwapCandidates(
    year: number,
    month: number,
    day: number,
    empId: number,
    scheduleData: ManagerScheduleMonthData,
    boundaryShifts?: {
      prevMonthShifts?: ManagerScheduleShift[];
      nextMonthShifts?: ManagerScheduleShift[];
    }
  ): SmartSwapCandidate[] {
    const rowA = scheduleData.rows.find(r => r.employee.id === empId);
    if (!rowA) return [];

    const empA = rowA.employee;
    const shiftA = rowA.shifts[day] || {
      year,
      month,
      day,
      date: formatDateIso(year, month, day),
      employee_id: empA.id,
      shift_code: 'OFF',
      hours: 0.0
    };

    // Zmiana L4 jest bezwzględnie nietykalna
    if (IMMUTABLE_CODES.has(shiftA.shift_code)) {
      return [];
    }

    const shiftDefMap = new Map<string, ShiftDefinition>();
    scheduleData.shiftDefinitions.forEach(def => shiftDefMap.set(def.code, def));

    const totalDays = scheduleData.totalDays;
    const candidates: SmartSwapCandidate[] = [];

    // Klonujemy bazowy stan zmian wszystkich pracowników
    const empShiftsMap = new Map<number, Record<number, ManagerScheduleShift>>();
    scheduleData.rows.forEach(r => {
      const copy: Record<number, ManagerScheduleShift> = {};
      for (let d = 1; d <= totalDays; d++) {
        copy[d] = r.shifts[d] ? { ...r.shifts[d] } : {
          year,
          month,
          day: d,
          date: formatDateIso(year, month, d),
          employee_id: r.employee.id,
          shift_code: 'OFF',
          hours: 0.0
        };
      }
      empShiftsMap.set(r.employee.id, copy);
    });

    const isWeekendDay = (d: number) => {
      const dow = new Date(year, month - 1, d).getDay();
      return dow === 0 || dow === 6;
    };

    const isSundayDay = (d: number) => {
      return new Date(year, month - 1, d).getDay() === 0;
    };

    // Iterujemy po wszystkich potencjalnych partnerach w zespole
    for (const rowB of scheduleData.rows) {
      const empB = rowB.employee;
      if (empB.id === empA.id) continue;

      const shiftB = rowB.shifts[day] || {
        year,
        month,
        day,
        date: formatDateIso(year, month, day),
        employee_id: empB.id,
        shift_code: 'OFF',
        hours: 0.0
      };

      if (IMMUTABLE_CODES.has(shiftB.shift_code)) continue;

      // ========================================================
      // TYP 1: Same-Day Swap (Zamiana w ten sam dzień)
      // ========================================================
      if (shiftB.shift_code !== shiftA.shift_code) {
        // Czy zmiany mają tę samą liczbę godzin (np. 8h vs 8h)?
        const hoursMatch = Math.abs((shiftA.hours || 0) - (shiftB.hours || 0)) < 0.1;

        if (hoursMatch && (shiftA.hours || 0) > 0) {
          // Sprawdzamy czy zmiana niedzielna nie trafia w dzień powszedni
          const defA = shiftDefMap.get(shiftA.shift_code);
          const defB = shiftDefMap.get(shiftB.shift_code);
          const isSun = isSundayDay(day);

          const invalidSundayA = !isSun && defB?.is_sunday_only;
          const invalidSundayB = !isSun && defA?.is_sunday_only;

          if (!invalidSundayA && !invalidSundayB) {
            // Symulujemy zamianę w kopiach
            const testShiftsA = { ...empShiftsMap.get(empA.id)! };
            const testShiftsB = { ...empShiftsMap.get(empB.id)! };

            testShiftsA[day] = {
              ...shiftB,
              employee_id: empA.id,
              date: formatDateIso(year, month, day)
            };
            testShiftsB[day] = {
              ...shiftA,
              employee_id: empB.id,
              date: formatDateIso(year, month, day)
            };

            const valA = ManagerScheduleEngine.validateLaborLaw(
              year,
              month,
              totalDays,
              empA,
              testShiftsA,
              shiftDefMap,
              boundaryShifts
            );
            const valB = ManagerScheduleEngine.validateLaborLaw(
              year,
              month,
              totalDays,
              empB,
              testShiftsB,
              shiftDefMap,
              boundaryShifts
            );

            const hasErrorA = valA.violations.some(v => v.severity === 'error');
            const hasErrorB = valB.violations.some(v => v.severity === 'error');

            if (!hasErrorA && !hasErrorB) {
              const containsVacation = shiftA.shift_code === 'H' || shiftB.shift_code === 'H';
              const containsAdmin = shiftA.shift_code === 'NC' || shiftB.shift_code === 'NC';

              let score = 1000;
              let tag = '🔄 Ten sam dzień';

              if (containsVacation) {
                tag = '⚠️ Przesunięcie H';
                score -= 100;
              } else if (containsAdmin) {
                tag = '📋 Przesunięcie NC';
                score -= 50;
              }

              // Preferencje dyspozycji
              const dispoA = shiftA.disposition || '';
              const dispoB = shiftB.disposition || '';

              if (dispoA === 'AM' && (shiftB.shift_code.includes('AM') || shiftB.shift_code === 'AMN')) score += 200;
              if (dispoA === 'PM' && (shiftB.shift_code.includes('PM') || shiftB.shift_code === 'PMN')) score += 200;
              if (dispoB === 'AM' && (shiftA.shift_code.includes('AM') || shiftA.shift_code === 'AMN')) score += 200;
              if (dispoB === 'PM' && (shiftA.shift_code.includes('PM') || shiftA.shift_code === 'PMN')) score += 200;

              const candidate: SmartSwapCandidate = {
                id: `same_${empB.id}_${day}`,
                type: 'same_day',
                targetEmployeeId: empB.id,
                targetEmployeeName: empB.name,
                targetRole: formatManagerRole(empB.role),
                primaryDay: day,
                score,
                qualityBadge: score >= 1200 ? 'ideal' : score >= 900 ? 'good' : 'acceptable',
                tag,
                description: `${empA.name} bierze ${shiftB.shift_code} (${shiftB.hours}h), a ${empB.name} przejmuje ${shiftA.shift_code} (${shiftA.hours}h)`,
                explanation: `Wymiana w dniu ${day}: idealne wyrównanie etatu (0.0h). 100% zgodności z KP u obu osób.`,
                laborLawCompliant: true,
                hoursDeltaA: 0.0,
                hoursDeltaB: 0.0,
                containsVacation,
                containsAdmin,
                changes: [
                  {
                    employeeId: empA.id,
                    employeeName: empA.name,
                    day,
                    date: formatDateIso(year, month, day),
                    prevShiftCode: shiftA.shift_code,
                    newShiftCode: shiftB.shift_code,
                    hours: shiftB.hours,
                    customStartTime: shiftB.custom_start_time,
                    customEndTime: shiftB.custom_end_time
                  },
                  {
                    employeeId: empB.id,
                    employeeName: empB.name,
                    day,
                    date: formatDateIso(year, month, day),
                    prevShiftCode: shiftB.shift_code,
                    newShiftCode: shiftA.shift_code,
                    hours: shiftA.hours,
                    customStartTime: shiftA.custom_start_time,
                    customEndTime: shiftA.custom_end_time
                  }
                ]
              };

              candidates.push(candidate);
            }
          }
        }
      }

      // ========================================================
      // TYP 2: Cross-Day Balance Swap (Wymiana krzyżowa z kompensacją)
      // ========================================================
      // Scenariusz A: empA pracuje w day, empB ma OFF w day -> szukamy day2, gdzie empB pracuje, a empA ma OFF
      if ((shiftA.hours || 0) > 0 && shiftB.shift_code === 'OFF') {
        const primaryWeek = getDayWeekIndex(year, month, day);

        for (let day2 = 1; day2 <= totalDays; day2++) {
          if (day2 === day) continue;

          const shiftB2 = rowB.shifts[day2] || {
            year,
            month,
            day: day2,
            date: formatDateIso(year, month, day2),
            employee_id: empB.id,
            shift_code: 'OFF',
            hours: 0.0
          };
          const shiftA2 = rowA.shifts[day2] || {
            year,
            month,
            day: day2,
            date: formatDateIso(year, month, day2),
            employee_id: empA.id,
            shift_code: 'OFF',
            hours: 0.0
          };

          if (IMMUTABLE_CODES.has(shiftB2.shift_code) || IMMUTABLE_CODES.has(shiftA2.shift_code)) continue;

          // Warunek kompensacji: empB2 ma dyżur roboczy o zbliżonych godzinach do shiftA, a empA2 ma OFF
          const hoursEqual = Math.abs((shiftA.hours || 0) - (shiftB2.hours || 0)) < 0.1;
          if (hoursEqual && (shiftB2.hours || 0) > 0 && shiftA2.shift_code === 'OFF') {
            // Sprawdzenie niedziel
            const isSun1 = isSundayDay(day);
            const isSun2 = isSundayDay(day2);
            const defA = shiftDefMap.get(shiftA.shift_code);
            const defB2 = shiftDefMap.get(shiftB2.shift_code);

            if ((!isSun1 && defA?.is_sunday_only) || (!isSun2 && defB2?.is_sunday_only)) {
              continue;
            }

            // Symulacja 2 dni u obu osób
            const testShiftsA = { ...empShiftsMap.get(empA.id)! };
            const testShiftsB = { ...empShiftsMap.get(empB.id)! };

            // W day: empA dostaje OFF, empB przejmuje shiftA
            testShiftsA[day] = {
              year,
              month,
              day,
              date: formatDateIso(year, month, day),
              employee_id: empA.id,
              shift_code: 'OFF',
              hours: 0.0
            };
            testShiftsB[day] = {
              ...shiftA,
              employee_id: empB.id,
              date: formatDateIso(year, month, day)
            };

            // W day2: empB dostaje OFF, empA przejmuje shiftB2
            testShiftsB[day2] = {
              year,
              month,
              day: day2,
              date: formatDateIso(year, month, day2),
              employee_id: empB.id,
              shift_code: 'OFF',
              hours: 0.0
            };
            testShiftsA[day2] = {
              ...shiftB2,
              employee_id: empA.id,
              date: formatDateIso(year, month, day2)
            };

            // Walidacja KP
            const valA = ManagerScheduleEngine.validateLaborLaw(
              year,
              month,
              totalDays,
              empA,
              testShiftsA,
              shiftDefMap,
              boundaryShifts
            );
            const valB = ManagerScheduleEngine.validateLaborLaw(
              year,
              month,
              totalDays,
              empB,
              testShiftsB,
              shiftDefMap,
              boundaryShifts
            );

            const hasErrorA = valA.violations.some(v => v.severity === 'error');
            const hasErrorB = valB.violations.some(v => v.severity === 'error');

            if (!hasErrorA && !hasErrorB) {
              const compWeek = getDayWeekIndex(year, month, day2);
              const isSameWeek = primaryWeek === compWeek;
              const dayDistance = Math.abs(day - day2);

              const containsVacation = shiftA.shift_code === 'H' || shiftB2.shift_code === 'H';
              const containsAdmin = shiftA.shift_code === 'NC' || shiftB2.shift_code === 'NC';

              let score = 950;
              let tag = isSameWeek ? '📅 W tym samym tygodniu' : '🔄 Kompensacja w miesiącu';

              if (isSameWeek) score += 250;
              score -= Math.min(200, dayDistance * 10);

              if (containsVacation) {
                tag = '⚠️ Przesunięcie H';
                score -= 100;
              } else if (containsAdmin) {
                tag = '📋 Przesunięcie NC';
                score -= 50;
              }

              // Jeśli empA prosił o OFF w day, duży bonus
              if (shiftA.disposition === 'OFF') {
                score += 350;
              }

              // Jeśli empB nie prosił o OFF w day
              if (shiftB.disposition !== 'OFF') {
                score += 100;
              } else {
                score -= 250; // kara za wciskanie pracy w deklarowane wolne
              }

              // Bonus za 2-dniowy blok wolnego dla empA
              const prevA = testShiftsA[day - 1]?.shift_code === 'OFF';
              const nextA = testShiftsA[day + 1]?.shift_code === 'OFF';
              if (prevA || nextA) score += 150;

              const candidate: SmartSwapCandidate = {
                id: `cross_${empB.id}_${day}_${day2}`,
                type: 'cross_day',
                targetEmployeeId: empB.id,
                targetEmployeeName: empB.name,
                targetRole: formatManagerRole(empB.role),
                primaryDay: day,
                compensatingDay: day2,
                score,
                qualityBadge: score >= 1200 ? 'ideal' : score >= 900 ? 'good' : 'acceptable',
                tag,
                description: `${empB.name} bierze ${shiftA.shift_code} w d.${day}, a ${empA.name} odpracowuje ${shiftB2.shift_code} w d.${day2}`,
                explanation: `Wymiana krzyżowa (d.${day} ↔ d.${day2}): ${isSameWeek ? 'ten sam tydzień' : `odstęp ${dayDistance} dni`}. Bilans godzin obu osób: 0.0h w TOR.`,
                laborLawCompliant: true,
                hoursDeltaA: 0.0,
                hoursDeltaB: 0.0,
                containsVacation,
                containsAdmin,
                changes: [
                  {
                    employeeId: empA.id,
                    employeeName: empA.name,
                    day,
                    date: formatDateIso(year, month, day),
                    prevShiftCode: shiftA.shift_code,
                    newShiftCode: 'OFF',
                    hours: 0.0
                  },
                  {
                    employeeId: empB.id,
                    employeeName: empB.name,
                    day,
                    date: formatDateIso(year, month, day),
                    prevShiftCode: 'OFF',
                    newShiftCode: shiftA.shift_code,
                    hours: shiftA.hours,
                    customStartTime: shiftA.custom_start_time,
                    customEndTime: shiftA.custom_end_time
                  },
                  {
                    employeeId: empB.id,
                    employeeName: empB.name,
                    day: day2,
                    date: formatDateIso(year, month, day2),
                    prevShiftCode: shiftB2.shift_code,
                    newShiftCode: 'OFF',
                    hours: 0.0
                  },
                  {
                    employeeId: empA.id,
                    employeeName: empA.name,
                    day: day2,
                    date: formatDateIso(year, month, day2),
                    prevShiftCode: 'OFF',
                    newShiftCode: shiftB2.shift_code,
                    hours: shiftB2.hours,
                    customStartTime: shiftB2.custom_start_time,
                    customEndTime: shiftB2.custom_end_time
                  }
                ]
              };

              candidates.push(candidate);
            }
          }
        }
      }
    }

    // Sortowanie malejąco po score
    candidates.sort((a, b) => b.score - a.score);

    // Zwracamy top 6 unikalnych i najlepszych wariantów
    return candidates.slice(0, 6);
  }

  /**
   * Wykonuje serię minimalnie inwazyjnych mikrozamian (Swap Chain) dla wskazanego menedżera,
   * rozwiązując problemy z dyspozycjami (OFF/M/Z) lub alertami Kodeksu Pracy bez naruszania reszty zespołu.
   */
  public static performRowReRoll(
    empId: number,
    scheduleData: ManagerScheduleMonthData,
    boundaryShifts?: {
      prevMonthShifts?: ManagerScheduleShift[];
      nextMonthShifts?: ManagerScheduleShift[];
    }
  ): RowReRollResult {
    const row = scheduleData.rows.find(r => r.employee.id === empId);
    if (!row) {
      return {
        success: false,
        swapsExecuted: 0,
        changes: [],
        summary: 'Nie znaleziono wiersza menedżera',
        details: []
      };
    }

    const { year, month, totalDays } = scheduleData;
    const details: string[] = [];
    const allChanges: SmartSwapChange[] = [];

    // Klonujemy stan grafiku do bezpiecznej modyfikacji sekwencyjnej
    const currentMonthData: ManagerScheduleMonthData = JSON.parse(JSON.stringify(scheduleData));

    // Identyfikujemy dni z problemami:
    // 1. Prośba o OFF, a pracownik pracuje
    // 2. Alert Kodeksu Pracy
    // 3. Niedopasowanie poranka/wieczoru (M vs PM lub Z vs AM)
    interface IssueDay {
      day: number;
      severity: number;
      reason: string;
    }

    const issues: IssueDay[] = [];

    for (let d = 1; d <= totalDays; d++) {
      const s = row.shifts[d];
      if (!s) continue;

      const dispo = s.disposition || '';
      const isWorking = s.hours > 0 && s.shift_code !== 'OFF' && s.shift_code !== 'H' && s.shift_code !== 'L4';
      const dayViolations = row.violationsByDay[d] || [];

      if (dayViolations.length > 0) {
        issues.push({
          day: d,
          severity: 100,
          reason: `Naruszenie Kodeksu Pracy (${dayViolations.map(v => v.title).join(', ')})`
        });
      } else if (dispo === 'OFF' && isWorking) {
        issues.push({
          day: d,
          severity: 80,
          reason: `Praca w dniu deklarowanej prośby o wolne (OFF)`
        });
      } else if (dispo === 'AM' && s.shift_code.includes('PM')) {
        issues.push({
          day: d,
          severity: 40,
          reason: `Zamknięcie PM przy preferencji rannych zmian (AM)`
        });
      } else if (dispo === 'PM' && s.shift_code.includes('AM')) {
        issues.push({
          day: d,
          severity: 40,
          reason: `Otwarcie AM przy preferencji zamknięć (PM)`
        });
      }
    }

    issues.sort((a, b) => b.severity - a.severity);

    // Ograniczamy do max 3 kluczowych zamian (minimalna inwazja)
    const targetIssues = issues.slice(0, 3);
    let executedCount = 0;

    for (const issue of targetIssues) {
      const candidates = this.findSmartSwapCandidates(
        year,
        month,
        issue.day,
        empId,
        currentMonthData,
        boundaryShifts
      );

      if (candidates.length > 0) {
        // Wybieramy najlepszego kandydata
        const best = candidates[0];

        // Aplikujemy zmiany do currentMonthData
        best.changes.forEach(ch => {
          const targetRow = currentMonthData.rows.find(r => r.employee.id === ch.employeeId);
          if (targetRow && targetRow.shifts[ch.day]) {
            targetRow.shifts[ch.day].shift_code = ch.newShiftCode;
            targetRow.shifts[ch.day].hours = ch.hours;
            targetRow.shifts[ch.day].custom_start_time = ch.customStartTime || undefined;
            targetRow.shifts[ch.day].custom_end_time = ch.customEndTime || undefined;
          }
          allChanges.push(ch);
        });

        executedCount++;
        details.push(`Dzień ${issue.day}: ${issue.reason} ➔ Zastosowano zamianę z ${best.targetEmployeeName} (${best.tag})`);
      }
    }

    if (executedCount === 0) {
      return {
        success: false,
        swapsExecuted: 0,
        changes: [],
        summary: 'Grafik menedżera jest już optymalny lub brak bezkolizyjnych zamian parzystych',
        details: []
      };
    }

    return {
      success: true,
      swapsExecuted: executedCount,
      changes: allChanges,
      summary: `Wykonano ${executedCount} mikrozamian(y) AI dla ${row.employee.name}. Zachowano 100% KP i zbalansowany TOR.`,
      details
    };
  }
}
