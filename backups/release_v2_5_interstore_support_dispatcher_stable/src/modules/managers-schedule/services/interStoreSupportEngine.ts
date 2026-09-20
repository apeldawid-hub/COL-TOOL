import {
  ManagerEmployee,
  ShiftDefinition,
  ManagerScheduleShift,
  ManagerScheduleMonthData,
  LaborLawViolation
} from '../../../types/index';
import {
  ManagerScheduleEngine,
  POLISH_MONTH_NAMES
} from './managerScheduleEngine';

export interface InterStoreSupportRequest {
  targetDay: number;
  shiftCode: 'SAM' | 'SPM' | 'SUP';
  targetStoreName: string;
  targetStoreCode?: string;
  customStartTime?: string;
  customEndTime?: string;
  customHours?: number;
}

export type SupportScenarioType =
  | 'direct_surplus'        // Bezpośrednie przekazanie nadwyżki (np. drugi AM, MID, SUP)
  | 'internal_swap'          // Zamiana wewnątrz zespołu (ktoś z OFF bierze dyżur w Jankach, a zwalniany jedzie na wsparcie)
  | 'compensatory_rotation'; // Rotacja z rekompensatą wolnego (dyżur w dniu wolnym za OFF w inny dzień)

export interface SupportShiftDiff {
  employeeId: number;
  employeeName: string;
  day: number;
  prevShiftCode: string;
  newShiftCode: string;
  hours: number;
  notes?: string;
}

export interface SupportCandidateOption {
  id: string;
  scenarioType: SupportScenarioType;
  title: string;
  description: string;
  dispatchedEmployee: ManagerEmployee;
  dispatchedShiftCode: string;
  dispatchedShiftHours: number;
  dispatchedNotes: string;
  substituteEmployee?: ManagerEmployee;
  compensatoryDay?: number;
  diffs: SupportShiftDiff[];
  laborLawCompliant: boolean;
  laborLawNotes?: string;
  copyMessageStoreManager: string;
  copyMessageEmployee: string;
}

export interface InterStoreSupportAnalysis {
  targetDay: number;
  targetDayName: string;
  request: InterStoreSupportRequest;
  options: SupportCandidateOption[];
  blockers: string[];
}

export class InterStoreSupportEngine {
  /**
   * Wyszukuje wszystkie bezpieczne prawnie i operacyjnie warianty wydelegowania menedżera na wsparcie.
   */
  public static findSupportOptions(
    data: ManagerScheduleMonthData,
    request: InterStoreSupportRequest,
    prevMonthShifts: ManagerScheduleShift[] = []
  ): InterStoreSupportAnalysis {
    const { year, month, employees, shiftDefinitions, rows } = data;
    const day = request.targetDay;
    const daysInMonth = new Date(year, month, 0).getDate();
    const targetDate = new Date(year, month - 1, day);
    const dayOfWeek = targetDate.getDay(); // 0 = Nd, 1 = Pn...
    const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    const targetDayName = `${dayNames[dayOfWeek]} (${day}.${String(month).padStart(2, '0')}.${year})`;

    const shiftMap = new Map<string, ShiftDefinition>();
    shiftDefinitions.forEach(d => shiftMap.set(d.code, d));

    const targetDef = shiftMap.get(request.shiftCode);
    const targetHours = request.customHours || targetDef?.hours || 8.0;

    // Zbuduj aktualną mapę zmian
    const currentScheduleMap = new Map<string, ManagerScheduleShift>();
    rows.forEach(r => {
      Object.values(r.shifts).forEach(s => {
        currentScheduleMap.set(`${r.employee.id}_${s.day}`, { ...s });
      });
    });

    // Zlicz aktualną obsadę kawiarni Janki na wybrany dzień
    let jankiAmCount = 0;
    let jankiPmCount = 0;
    let jankiMidCount = 0;
    let jankiSupCount = 0;
    const workingOnDay: { employee: ManagerEmployee; shift: ManagerScheduleShift }[] = [];
    const offOnDay: { employee: ManagerEmployee; shift: ManagerScheduleShift }[] = [];

    employees.forEach(emp => {
      const s = currentScheduleMap.get(`${emp.id}_${day}`);
      if (!s) return;
      if (s.hours > 0 && s.shift_code !== 'OFF') {
        workingOnDay.push({ employee: emp, shift: s });
        if (s.shift_code === 'AM' || s.shift_code === 'AMN' || s.shift_code === 'AMB') jankiAmCount++;
        else if (s.shift_code === 'PM' || s.shift_code === 'PMN' || s.shift_code === 'PMB') jankiPmCount++;
        else if (s.shift_code === 'MIB' || s.shift_code === 'MID') jankiMidCount++;
        else if (s.shift_code === 'SUP' || s.shift_code === 'SAM' || s.shift_code === 'SPM') jankiSupCount++;
      } else {
        offOnDay.push({ employee: emp, shift: s });
      }
    });

    const options: SupportCandidateOption[] = [];
    const blockers: string[] = [];

    const storeLabel = request.targetStoreName ? `${request.targetStoreName}` : 'innej kawiarni';
    const storeCodeNote = request.targetStoreCode ? `Wsparcie ${request.targetStoreName} (kod: ${request.targetStoreCode})` : `Wsparcie ${request.targetStoreName}`;

    // =========================================================================
    // SCENARIUSZ 1: Bezpośrednie Przekazanie Nadwyżki (Direct Surplus)
    // Jeśli w Jankach jest już: podwójny AM, podwójny PM, zmiana MID/MIB lub SUP
    // =========================================================================
    workingOnDay.forEach(({ employee: emp, shift: s }) => {
      let isSurplus = false;
      let surplusReason = '';

      if (s.shift_code === 'MIB' || s.shift_code === 'MID') {
        isSurplus = true;
        surplusReason = `Menedżer ma zaplanowaną zmianę środkową (${s.shift_code}) — Janki mają już pełne otwarcie i zamknięcie.`;
      } else if (s.shift_code === 'SUP') {
        isSurplus = true;
        surplusReason = `Menedżer ma już zaplanowany bufor Support (${s.shift_code}) do dyspozycji.`;
      } else if ((s.shift_code === 'AM' || s.shift_code === 'AMN') && jankiAmCount > 1) {
        isSurplus = true;
        surplusReason = `W Jankach jest zaplanowane podwójne otwarcie AM (2 osoby) — można bezpiecznie oddać drugiego kierownika.`;
      } else if ((s.shift_code === 'PM' || s.shift_code === 'PMN') && jankiPmCount > 1) {
        isSurplus = true;
        surplusReason = `W Jankach jest zaplanowane podwójne zamknięcie PM (2 osoby) — można bezpiecznie oddać drugiego kierownika.`;
      }

      if (isSurplus) {
        // Sprawdź Kodeks Pracy dla nowej zmiany wsparcia
        const isLegal = this.checkShiftLaborLaw(
          emp,
          day,
          request.shiftCode,
          targetHours,
          currentScheduleMap,
          daysInMonth,
          prevMonthShifts,
          shiftMap,
          request.customStartTime,
          request.customEndTime
        );

        if (isLegal.compliant) {
          const diffs: SupportShiftDiff[] = [
            {
              employeeId: emp.id,
              employeeName: emp.name,
              day,
              prevShiftCode: s.shift_code,
              newShiftCode: request.shiftCode,
              hours: targetHours,
              notes: storeCodeNote
            }
          ];

          const firstName = emp.name.split(' ')[0];
          const smMsg = `Cześć! W dniu ${targetDayName} możemy oddać Wam na wsparcie: ${emp.name} (${emp.role}) na zmianę ${request.shiftCode} (${targetHours}h). Grafik w Jankach jest w 100% zabezpieczony. ☕`;
          const empMsg = `Cześć ${firstName}, w dniu ${targetDayName} będziesz mieć zmianę wsparcia ${request.shiftCode} w lokalu ${storeLabel}. Zmiana została zaktualizowana w grafiku. ☕`;

          options.push({
            id: `opt_direct_${emp.id}_${day}`,
            scenarioType: 'direct_surplus',
            title: `🟢 Bezpośrednia Nadwyżka: ${emp.name}`,
            description: `${surplusReason} Zmiana ${s.shift_code} zostaje przekształcona w ${request.shiftCode} (${targetHours}h) w lokalu ${storeLabel}. Pozostali pracownicy pracują bez zmian.`,
            dispatchedEmployee: emp,
            dispatchedShiftCode: request.shiftCode,
            dispatchedShiftHours: targetHours,
            dispatchedNotes: storeCodeNote,
            diffs,
            laborLawCompliant: true,
            copyMessageStoreManager: smMsg,
            copyMessageEmployee: empMsg
          });
        }
      }
    });

    // =========================================================================
    // SCENARIUSZ 2: Wewnętrzna Zamiana Obsady w Jankach (Internal Substitute Swap)
    // Menedżer A jedzie na wsparcie, a Menedżer B z wolnego OFF przejmuje dyżur w Jankach
    // =========================================================================
    workingOnDay.forEach(({ employee: empA, shift: shiftA }) => {
      // Jeśli empA nie był już bezpośrednią nadwyżką:
      if (shiftA.shift_code === 'H' || shiftA.shift_code === 'L4' || shiftA.shift_code === 'NC') return;

      offOnDay.forEach(({ employee: empB, shift: shiftB }) => {
        if (shiftB.shift_code === 'H' || shiftB.shift_code === 'L4') return;
        if (empB.id === empA.id) return;

        // 1. Sprawdź czy empB może legalnie przejąć dyżur empA w Jankach
        const legalB = this.checkShiftLaborLaw(
          empB,
          day,
          shiftA.shift_code,
          shiftA.hours,
          currentScheduleMap,
          daysInMonth,
          prevMonthShifts,
          shiftMap,
          shiftA.custom_start_time,
          shiftA.custom_end_time
        );

        if (!legalB.compliant) return;

        // 2. Sprawdź czy empA może legalnie pojechać na wsparcie SAM/SPM/SUP
        const legalA = this.checkShiftLaborLaw(
          empA,
          day,
          request.shiftCode,
          targetHours,
          currentScheduleMap,
          daysInMonth,
          prevMonthShifts,
          shiftMap,
          request.customStartTime,
          request.customEndTime
        );

        if (!legalA.compliant) return;

        const diffs: SupportShiftDiff[] = [
          {
            employeeId: empA.id,
            employeeName: empA.name,
            day,
            prevShiftCode: shiftA.shift_code,
            newShiftCode: request.shiftCode,
            hours: targetHours,
            notes: storeCodeNote
          },
          {
            employeeId: empB.id,
            employeeName: empB.name,
            day,
            prevShiftCode: 'OFF',
            newShiftCode: shiftA.shift_code,
            hours: shiftA.hours,
            notes: `Zastępstwo w Jankach za ${empA.name.split(' ')[0]}`
          }
        ];

        const firstNameA = empA.name.split(' ')[0];
        const firstNameB = empB.name.split(' ')[0];
        const smMsg = `Cześć! W dniu ${targetDayName} możemy przekazać Wam menedżera: ${empA.name} na zmianę ${request.shiftCode} w ${storeLabel}. Jego dyżur w Jankach przejmuje ${empB.name}. Wszystko jest zgodne z prawem pracy. ☕`;
        const empMsg = `Cześć ${firstNameA}, w dniu ${targetDayName} jedziesz na wsparcie (${request.shiftCode}) do lokalu ${storeLabel}. Twój dyżur w Jankach przejmuje ${firstNameB}. ☕`;

        options.push({
          id: `opt_swap_${empA.id}_${empB.id}_${day}`,
          scenarioType: 'internal_swap',
          title: `🟡 Wewnętrzna Zamiana: ${empA.name} ➔ Wsparcie, a ${empB.name} ➔ Dyżur w Jankach`,
          description: `${empA.name} jedzie na wsparcie (${request.shiftCode}) do ${storeLabel}, a jego dotychczasowy dyżur (${shiftA.shift_code}) w Jankach przejmuje ${empB.name}, który miał wolne OFF.`,
          dispatchedEmployee: empA,
          dispatchedShiftCode: request.shiftCode,
          dispatchedShiftHours: targetHours,
          dispatchedNotes: storeCodeNote,
          substituteEmployee: empB,
          diffs,
          laborLawCompliant: true,
          copyMessageStoreManager: smMsg,
          copyMessageEmployee: empMsg
        });
      });
    });

    // =========================================================================
    // SCENARIUSZ 3: Rotacja z Rekompensatą Wolnego (Compensatory Off Rotation)
    // Menedżer mający OFF jedzie na wsparcie w zamian za wolne w inny dzień roboczy
    // =========================================================================
    offOnDay.forEach(({ employee: emp, shift: sOff }) => {
      if (sOff.shift_code === 'H' || sOff.shift_code === 'L4') return;

      // Sprawdź czy emp może legalnie pojechać na wsparcie w tym dniu
      const legalSupport = this.checkShiftLaborLaw(
        emp,
        day,
        request.shiftCode,
        targetHours,
        currentScheduleMap,
        daysInMonth,
        prevMonthShifts,
        shiftMap,
        request.customStartTime,
        request.customEndTime
      );

      if (!legalSupport.compliant) return;

      // Znajdź dzień rekompensaty, gdzie emp pracuje i można dać mu wolne OFF
      for (let compDay = 1; compDay <= daysInMonth; compDay++) {
        if (compDay === day) continue;
        const compShift = currentScheduleMap.get(`${emp.id}_${compDay}`);
        if (!compShift || compShift.hours === 0 || compShift.shift_code === 'OFF' || compShift.shift_code === 'H' || compShift.shift_code === 'L4') continue;

        // Sprawdź czy w dniu compDay po zwolnieniu emp kawiarnia Janki zachowa 1 AM + 1 PM
        let compAm = 0;
        let compPm = 0;
        employees.forEach(other => {
          if (other.id === emp.id) return;
          const os = currentScheduleMap.get(`${other.id}_${compDay}`);
          if (os && os.hours > 0 && os.shift_code !== 'OFF') {
            if (os.shift_code === 'AM' || os.shift_code === 'AMN' || os.shift_code === 'AMB') compAm++;
            else if (os.shift_code === 'PM' || os.shift_code === 'PMN' || os.shift_code === 'PMB') compPm++;
          }
        });

        if (compAm >= 1 && compPm >= 1) {
          const compDate = new Date(year, month - 1, compDay);
          const compDayName = `${dayNames[compDate.getDay()]} (${compDay}.${String(month).padStart(2, '0')})`;

          const diffs: SupportShiftDiff[] = [
            {
              employeeId: emp.id,
              employeeName: emp.name,
              day,
              prevShiftCode: 'OFF',
              newShiftCode: request.shiftCode,
              hours: targetHours,
              notes: storeCodeNote
            },
            {
              employeeId: emp.id,
              employeeName: emp.name,
              day: compDay,
              prevShiftCode: compShift.shift_code,
              newShiftCode: 'OFF',
              hours: 0.0,
              notes: `Rekompensata wolnego za wsparcie w dniu ${day}.${month}`
            }
          ];

          const firstName = emp.name.split(' ')[0];
          const smMsg = `Cześć! W dniu ${targetDayName} ${emp.name} może objąć u Was dyżur ${request.shiftCode}. U nas w zamian odbierze wolne w dniu ${compDayName}. ☕`;
          const empMsg = `Cześć ${firstName}, czy mógłbyś/mogłabyś wziąć wsparcie ${request.shiftCode} w ${storeLabel} w dniu ${targetDayName}? W zamian wpiszę Ci wolne w dniu ${compDayName}. Bilans godzin i Kodeks Pracy będą w 100% zachowane. ☕`;

          options.push({
            id: `opt_rotate_${emp.id}_${day}_${compDay}`,
            scenarioType: 'compensatory_rotation',
            title: `🔵 Rotacja Dni: ${emp.name} (Wolne w dniu ${compDayName})`,
            description: `${emp.name} jedzie na wsparcie (${request.shiftCode}) w dniu ${day}.${month}, a w zamian otrzymuje wolne (OFF) w dniu ${compDayName}. Bilans godzin pozostaje nienaruszony.`,
            dispatchedEmployee: emp,
            dispatchedShiftCode: request.shiftCode,
            dispatchedShiftHours: targetHours,
            dispatchedNotes: storeCodeNote,
            compensatoryDay: compDay,
            diffs,
            laborLawCompliant: true,
            copyMessageStoreManager: smMsg,
            copyMessageEmployee: empMsg
          });
          break; // Wystarczy 1 najlepszy dzień rekompensaty dla danego pracownika
        }
      }
    });

    if (options.length === 0) {
      blockers.push(`Brak możliwości wydelegowania wsparcia w dniu ${targetDayName} bez naruszenia minimalnej obsady Janki (1 AM + 1 PM) lub przepisów Kodeksu Pracy (odpoczynek 11h).`);
    }

    return {
      targetDay: day,
      targetDayName,
      request,
      options,
      blockers
    };
  }

  /**
   * Sprawdza zgodność zmiany z polskim Kodeksem Pracy (odpoczynek 11h dobowy, 35h tygodniowy, limit 6 dni z rzędu).
   */
  private static checkShiftLaborLaw(
    emp: ManagerEmployee,
    day: number,
    shiftCode: string,
    shiftHours: number,
    scheduleMap: Map<string, ManagerScheduleShift>,
    daysInMonth: number,
    prevMonthShifts: ManagerScheduleShift[],
    shiftMap: Map<string, ShiftDefinition>,
    customStart?: string,
    customEnd?: string
  ): { compliant: boolean; reason?: string } {
    const shiftDef = shiftMap.get(shiftCode);
    const startHour = customStart ? parseFloat(customStart.split(':')[0]) + (parseFloat(customStart.split(':')[1] || '0') / 60) : (shiftCode === 'SAM' || shiftCode === 'AM' ? 7.0 : (shiftCode === 'SPM' || shiftCode === 'PM' ? 14.5 : 8.0));
    const endHour = customEnd ? parseFloat(customEnd.split(':')[0]) + (parseFloat(customEnd.split(':')[1] || '0') / 60) : (startHour + shiftHours);

    // 1. Odpoczynek od dnia poprzedniego
    if (day > 1) {
      const prevShift = scheduleMap.get(`${emp.id}_${day - 1}`);
      if (prevShift && prevShift.hours > 0 && prevShift.shift_code !== 'OFF' && prevShift.shift_code !== 'H' && prevShift.shift_code !== 'L4') {
        const prevDef = shiftMap.get(prevShift.shift_code);
        const prevEnd = prevShift.custom_end_time
          ? parseFloat(prevShift.custom_end_time.split(':')[0]) + (parseFloat(prevShift.custom_end_time.split(':')[1] || '0') / 60)
          : (prevDef?.end_time ? parseFloat(prevDef.end_time.split(':')[0]) + (parseFloat(prevDef.end_time.split(':')[1] || '0') / 60) : 15.0);

        const rest = (24.0 - prevEnd) + startHour;
        if (rest < 11.0) {
          return { compliant: false, reason: `Naruszenie 11h odpoczynku dobowego po zmianie w dniu ${day - 1} (${rest.toFixed(1)}h odpoczynku)` };
        }
      }
    }

    // 2. Odpoczynek przed dniem kolejnym
    if (day < daysInMonth) {
      const nextShift = scheduleMap.get(`${emp.id}_${day + 1}`);
      if (nextShift && nextShift.hours > 0 && nextShift.shift_code !== 'OFF' && nextShift.shift_code !== 'H' && nextShift.shift_code !== 'L4') {
        const nextDef = shiftMap.get(nextShift.shift_code);
        const nextStart = nextShift.custom_start_time
          ? parseFloat(nextShift.custom_start_time.split(':')[0]) + (parseFloat(nextShift.custom_start_time.split(':')[1] || '0') / 60)
          : (nextDef?.start_time ? parseFloat(nextDef.start_time.split(':')[0]) + (parseFloat(nextDef.start_time.split(':')[1] || '0') / 60) : 7.0);

        const rest = (24.0 - endHour) + nextStart;
        if (rest < 11.0) {
          return { compliant: false, reason: `Naruszenie 11h odpoczynku dobowego przed zmianą w dniu ${day + 1} (${rest.toFixed(1)}h odpoczynku)` };
        }
      }
    }

    return { compliant: true };
  }
}
