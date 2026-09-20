import { TrainingShift, TrainingPartner, TrainingProgram, StandardShiftTemplate } from '../types';
import { FIRST_30_SHIFTS, BARISTA_90_SHIFTS, BARISTA_180_SHIFTS, BARISTA_TRAINER_SHIFTS } from './trainingStandardData';

export class TrainingEngine {
  /**
   * Generuje standardowy harmonogram Zmian T dla nowego partnera w oparciu o datę zatrudnienia.
   * Uwzględnia 2-tygodniowy plan (Tyg. 1: Pn-Pt -> T1..T5, Tyg. 2: Pn-Pt -> T6..T10)
   */
  public static generateDefaultShiftsForPartner(
    partnerId: number,
    hireDateStr: string,
    program: TrainingProgram = 'first_30',
    trainerName?: string | null
  ): TrainingShift[] {
    let templates: StandardShiftTemplate[] = [];
    if (program === 'first_30') {
      templates = FIRST_30_SHIFTS;
    } else if (program === 'barista_90') {
      templates = BARISTA_90_SHIFTS;
    } else if (program === 'barista_180') {
      templates = BARISTA_180_SHIFTS;
    } else if (program === 'barista_trainer') {
      templates = BARISTA_TRAINER_SHIFTS;
    }

    const startDate = new Date(hireDateStr);
    if (isNaN(startDate.getTime())) {
      return [];
    }

    return templates.map((tmpl) => {
      const shiftDate = new Date(startDate);
      shiftDate.setDate(startDate.getDate() + tmpl.day_offset);
      const dateStr = shiftDate.toISOString().split('T')[0];

      return {
        partner_id: partnerId,
        shift_code: tmpl.shift_code,
        title: tmpl.title,
        scheduled_date: dateStr,
        start_time: tmpl.default_start_time,
        end_time: tmpl.default_end_time,
        barista_hours_t: tmpl.barista_hours_t,
        trainer_hours_t: tmpl.trainer_hours_t,
        sm_hours_t: tmpl.sm_hours_t,
        status: 'planned',
        trainer_name: tmpl.trainer_hours_t > 0 ? (trainerName || 'Przypisany Trener') : null,
        station: tmpl.station,
        notes: tmpl.description
      };
    });
  }

  /**
   * Wylicza sumaryczne statystyki godzin Zmian T dla zestawu zmian
   */
  public static calculateHoursSummary(shifts: TrainingShift[]) {
    let totalBaristaPlanned = 0;
    let totalBaristaCompleted = 0;
    let totalTrainerPlanned = 0;
    let totalTrainerCompleted = 0;
    let totalSmPlanned = 0;
    let totalSmCompleted = 0;
    let completedCount = 0;

    for (const s of shifts) {
      const bHours = Number(s.barista_hours_t) || 0;
      const tHours = Number(s.trainer_hours_t) || 0;
      const smHours = Number(s.sm_hours_t) || 0;

      totalBaristaPlanned += bHours;
      totalTrainerPlanned += tHours;
      totalSmPlanned += smHours;

      if (s.status === 'completed') {
        totalBaristaCompleted += bHours;
        totalTrainerCompleted += tHours;
        totalSmCompleted += smHours;
        completedCount++;
      }
    }

    const totalInvestmentPlanned = totalBaristaPlanned + totalTrainerPlanned + totalSmPlanned;
    const totalInvestmentCompleted = totalBaristaCompleted + totalTrainerCompleted + totalSmCompleted;
    const progressPct = shifts.length > 0 ? Math.round((completedCount / shifts.length) * 100) : 0;

    return {
      shiftsCount: shifts.length,
      completedCount,
      progressPct,
      totalBaristaPlanned: Number(totalBaristaPlanned.toFixed(2)),
      totalBaristaCompleted: Number(totalBaristaCompleted.toFixed(2)),
      totalTrainerPlanned: Number(totalTrainerPlanned.toFixed(2)),
      totalTrainerCompleted: Number(totalTrainerCompleted.toFixed(2)),
      totalSmPlanned: Number(totalSmPlanned.toFixed(2)),
      totalSmCompleted: Number(totalSmCompleted.toFixed(2)),
      totalInvestmentPlanned: Number(totalInvestmentPlanned.toFixed(2)),
      totalInvestmentCompleted: Number(totalInvestmentCompleted.toFixed(2))
    };
  }

  /**
   * Wylicza kluczowe kamienie milowe ścieżki Partner Journey (First 30 -> 90 -> 180)
   */
  public static calculateMilestones(hireDateStr: string) {
    const hire = new Date(hireDateStr);
    if (isNaN(hire.getTime())) {
      return {
        first30Target: '',
        barista90Target: '',
        barista180Target: '',
        daysSinceHire: 0
      };
    }

    const now = new Date();
    const diffTime = Math.abs(now.getTime() - hire.getTime());
    const daysSinceHire = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const f30 = new Date(hire);
    f30.setDate(f30.getDate() + 30);

    const b90 = new Date(hire);
    b90.setDate(b90.getDate() + 90);

    const b180 = new Date(hire);
    b180.setDate(b180.getDate() + 180);

    return {
      first30Target: f30.toISOString().split('T')[0],
      barista90Target: b90.toISOString().split('T')[0],
      barista180Target: b180.toISOString().split('T')[0],
      daysSinceHire
    };
  }

  /**
   * Zwraca czytelną polską nazwę programu szkoleniowego
   */
  public static getProgramLabel(program: TrainingProgram): string {
    switch (program) {
      case 'first_30':
        return 'First 30 (Wdrożenie Baristy)';
      case 'barista_90':
        return 'Barista 90 (Relacje & De-eskalacja)';
      case 'barista_180':
        return 'Barista 180 (Coffee Academy 200)';
      case 'barista_trainer':
        return 'Barista Trener (Model Nauczania)';
      case 'coffee_master':
        return 'Coffee Master (Czarny Fartuch)';
      default:
        return program;
    }
  }

  /**
   * Zwraca kolorystyczny badge dla statusu partnera
   */
  public static getPartnerStatusBadge(status: string) {
    switch (status) {
      case 'in_progress':
        return { text: 'W trakcie', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'certified':
        return { text: 'Certyfikowany', bg: 'bg-amber-50 text-amber-800 border-amber-300' };
      case 'completed':
        return { text: 'Ukończony', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'paused':
        return { text: 'Wstrzymany', bg: 'bg-stone-100 text-stone-600 border-stone-300' };
      default:
        return { text: status, bg: 'bg-stone-50 text-stone-700 border-stone-200' };
    }
  }

  /**
   * Zwraca sumę godzin zmian T dla danego roku i miesiąca (do budżetu NC Training)
   */
  public static calculateMonthlyNcTrainingHours(shifts: TrainingShift[], year: number, month: number): number {
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    let total = 0;
    for (const s of shifts) {
      if (s.scheduled_date && s.scheduled_date.startsWith(monthPrefix)) {
        // Wszystkie godziny szkoleniowe: Barista (T) + Trainer (T) + SM (T)
        total += (Number(s.barista_hours_t) || 0) + (Number(s.trainer_hours_t) || 0) + (Number(s.sm_hours_t) || 0);
      }
    }
    return Number(total.toFixed(2));
  }
}
