import React, { useState, useEffect } from 'react';
import { MonthlyNormRecord } from '../../../types';
import { ManagerScheduleEngine } from '../services/managerScheduleEngine';
import {
  Clock,
  Calendar,
  RotateCcw,
  Save,
  X,
  Scale,
  Info,
  CheckCircle2,
  AlertTriangle,
  FileEdit
} from 'lucide-react';

interface MonthNormEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  monthName: string;
  currentNormRecord?: MonthlyNormRecord | null;
  onSaveNorm: (norm: {
    year: number;
    month: number;
    working_days: number;
    off_days: number;
    full_time_hours: number;
    notes?: string;
  }) => Promise<void>;
  onResetNorm: () => Promise<void>;
}

export const MonthNormEditModal: React.FC<MonthNormEditModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  monthName,
  currentNormRecord,
  onSaveNorm,
  onResetNorm
}) => {
  // Domyślna norma wyliczona z Kodeksu Pracy
  const officialNorm = ManagerScheduleEngine.calculateMonthNorms(year, month);

  const [workingDays, setWorkingDays] = useState<number>(officialNorm.workingDays);
  const [offDays, setOffDays] = useState<number>(officialNorm.offDaysNorm);
  const [fullTimeHours, setFullTimeHours] = useState<number>(officialNorm.fullTimeNominalHours);
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (currentNormRecord) {
        setWorkingDays(Number(currentNormRecord.working_days));
        setOffDays(Number(currentNormRecord.off_days));
        setFullTimeHours(Number(currentNormRecord.full_time_hours));
        setNotes(currentNormRecord.notes || '');
      } else {
        setWorkingDays(officialNorm.workingDays);
        setOffDays(officialNorm.offDaysNorm);
        setFullTimeHours(officialNorm.fullTimeNominalHours);
        setNotes('');
      }
    }
  }, [isOpen, currentNormRecord, officialNorm.workingDays, officialNorm.offDaysNorm, officialNorm.fullTimeNominalHours]);

  if (!isOpen) return null;

  const isCustom = Boolean(currentNormRecord?.is_custom);

  // Zmiana dni roboczych automatycznie proponuje przeliczenie godzin (dni * 8h)
  const handleWorkingDaysChange = (val: number) => {
    setWorkingDays(val);
    const newOff = Math.max(0, officialNorm.totalDays - val);
    setOffDays(newOff);
    setFullTimeHours(Number((val * 8.0).toFixed(1)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await onSaveNorm({
        year,
        month,
        working_days: workingDays,
        off_days: offDays,
        full_time_hours: fullTimeHours,
        notes: notes.trim()
      });
      onClose();
    } catch (err) {
      console.error('Błąd zapisu normy:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToOfficial = async () => {
    if (!window.confirm('Czy na pewno chcesz przywrócić oficjalną normę Kodeksu Pracy dla tego miesiąca?')) return;
    try {
      setIsResetting(true);
      await onResetNorm();
      setWorkingDays(officialNorm.workingDays);
      setOffDays(officialNorm.offDaysNorm);
      setFullTimeHours(officialNorm.fullTimeNominalHours);
      setNotes('');
      onClose();
    } catch (err) {
      console.error('Błąd przywracania normy KP:', err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-[#E2E8E5] w-full max-w-lg overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* NAGŁÓWEK */}
        <div className="bg-[#1E3932] text-white px-6 py-5 flex items-center justify-between border-b border-emerald-950">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl">
              <Clock className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-emerald-300 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5" />
                <span>Norma Miesiąca • {monthName} {year}</span>
              </div>
              <h2 className="text-xl font-black tracking-tight text-white mt-0.5">
                Konfiguracja Normy Czasu Pracy
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* PODGLĄD OFICJALNEJ NORMY KODEKSU PRACY */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#006241] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Oficjalna Norma Kodeksu Pracy (art. 130 KP)</span>
              </span>
              {isCustom ? (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 border border-amber-300">
                  Ręcznie Nadpisana
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-900 border border-emerald-300">
                  Zgodna z KP
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                <div className="text-[10px] uppercase font-semibold text-stone-500">Dni robocze</div>
                <div className="text-base font-black text-[#1E3932]">{officialNorm.workingDays} dni</div>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                <div className="text-[10px] uppercase font-semibold text-stone-500">Dni wolne (OFF)</div>
                <div className="text-base font-black text-[#1E3932]">{officialNorm.offDaysNorm} dni</div>
              </div>
              <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                <div className="text-[10px] uppercase font-semibold text-stone-500">Norma (1.0 Etat)</div>
                <div className="text-base font-black text-[#006241]">{officialNorm.fullTimeNominalHours.toFixed(1)} h</div>
              </div>
            </div>
          </div>

          {/* POLA EDYCJI */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileEdit className="w-3.5 h-3.5 text-[#006241]" />
                <span>Wartości Obowiązujące w Grafiku</span>
              </label>
              <span className="text-[11px] text-stone-400">
                Łącznie dni w miesiącu: {officialNorm.totalDays}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Norma Pełny Etat (h)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="300"
                  value={fullTimeHours}
                  onChange={e => setFullTimeHours(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 bg-white font-black text-[#1E3932] focus:outline-hidden focus:ring-2 focus:ring-[#006241]/30 text-center"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Dni Robocze
                </label>
                <input
                  type="number"
                  min="0"
                  max={officialNorm.totalDays}
                  value={workingDays}
                  onChange={e => handleWorkingDaysChange(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 bg-white font-bold text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-[#006241]/30 text-center"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Dni Wolne (OFF)
                </label>
                <input
                  type="number"
                  min="0"
                  max={officialNorm.totalDays}
                  value={offDays}
                  onChange={e => setOffDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-300 bg-white font-bold text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-[#006241]/30 text-center"
                  required
                />
              </div>
            </div>

            {/* Notatka / Uzasadnienie korekty */}
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                Notatka / Uzasadnienie modyfikacji normy (opcjonalnie)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="np. Porozumienie ze Store Managerem, wyrównanie okresu rozliczeniowego..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#006241]/30"
              />
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl text-[11px] text-stone-500 flex items-start gap-2 border border-stone-200 leading-relaxed">
            <Info className="w-4 h-4 text-[#006241] flex-shrink-0 mt-0.5" />
            <span>
              Zmiana normy miesięcznej automatycznie przeliczy bilans godzin (+/- h) i normy cząstkowe wszystkich menedżerów (0.75, 0.5, 0.25 etatu) w siatce grafiku.
            </span>
          </div>

          {/* PRZYCISKI AKCJI */}
          <div className="pt-3 border-t border-[#E2E8E5] flex items-center justify-between gap-3">
            {isCustom ? (
              <button
                type="button"
                onClick={handleResetToOfficial}
                disabled={isResetting}
                className="px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Przywróć oficjalne wyliczenie Kodeksu Pracy"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>Przywróć normę KP</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-[#006241] hover:bg-[#00754A] active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Zapisywanie...' : 'Zapisz Normę'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
