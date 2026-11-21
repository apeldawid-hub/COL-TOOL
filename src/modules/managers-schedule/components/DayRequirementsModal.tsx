// src/modules/managers-schedule/components/DayRequirementsModal.tsx
import React, { useState, useMemo } from 'react';
import { X, Clock, Users, AlertCircle, Sparkles, Check, RotateCcw } from 'lucide-react';
import { ManagerDayRequirement } from '../types';

interface DayRequirementsModalProps {
  isOpen: boolean;
  year: number;
  month: number;
  monthName: string;
  day: number;
  dayName: string;
  holidayName?: string;
  initialRequirement?: ManagerDayRequirement;
  onSave: (req: ManagerDayRequirement) => Promise<void> | void;
  onReset: (year: number, month: number, day: number) => Promise<void> | void;
  onClose: () => void;
  isReadOnly?: boolean;
}

export const DayRequirementsModal: React.FC<DayRequirementsModalProps> = ({
  isOpen,
  year,
  month,
  monthName,
  day,
  dayName,
  holidayName,
  initialRequirement,
  onSave,
  onReset,
  onClose,
  isReadOnly = false
}) => {
  const [isOpenDay, setIsOpenDay] = useState<boolean>(initialRequirement ? initialRequirement.is_open : true);
  const [managerCount, setManagerCount] = useState<number>(initialRequirement ? initialRequirement.manager_count : 1);
  const [startTime, setStartTime] = useState<string>(initialRequirement?.start_time || '07:00');
  const [endTime, setEndTime] = useState<string>(initialRequirement?.end_time || '16:00');
  const [notes, setNotes] = useState<string>(initialRequirement?.notes || (holidayName || ''));
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Wyliczanie długości dyżuru menedżera
  const computedHours = useMemo(() => {
    if (!isOpenDay || managerCount === 0) return 0;
    if (!startTime || !endTime) return 8.0;

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 8.0;

    let diffMinutes = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMinutes < 0) {
      // Przejście przez północ
      diffMinutes += 24 * 60;
    }
    const h = Number((diffMinutes / 60).toFixed(1));
    return Math.max(0, h);
  }, [isOpenDay, managerCount, startTime, endTime]);

  if (!isOpen) return null;

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const req: ManagerDayRequirement = {
        year,
        month,
        day,
        date: dateStr,
        is_open: isOpenDay,
        manager_count: isOpenDay ? managerCount : 0,
        start_time: isOpenDay ? startTime : undefined,
        end_time: isOpenDay ? endTime : undefined,
        required_hours: isOpenDay ? computedHours : 0,
        notes: notes.trim() || undefined
      };
      await onSave(req);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToStandard = async () => {
    if (isReadOnly || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onReset(year, month, day);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Szybkie presety
  const applyPreset = (preset: 'wigilia' | 'closed' | 'sylwester' | 'short10') => {
    if (preset === 'wigilia') {
      setIsOpenDay(true);
      setManagerCount(1);
      setStartTime('07:00');
      setEndTime('16:00');
      setNotes('Wigilia');
    } else if (preset === 'closed') {
      setIsOpenDay(false);
      setManagerCount(0);
      setNotes('Zamknięte (Święto)');
    } else if (preset === 'short10') {
      setIsOpenDay(true);
      setManagerCount(1);
      setStartTime('08:00');
      setEndTime('18:00');
      setNotes('Dyżur 10h');
    } else if (preset === 'sylwester') {
      setIsOpenDay(true);
      setManagerCount(2);
      setStartTime('07:00');
      setEndTime('19:00');
      setNotes('Sylwester');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* NAGŁÓWEK */}
        <div className="px-6 py-4 bg-[#1E3932] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Wymogi Obecności Menedżerów</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-700/80 text-emerald-100 font-semibold">
                  {dayName}, {day} {monthName}
                </span>
              </h3>
              <p className="text-xs text-emerald-200/80">
                Konfiguracja godzin dyżuru kierowniczego dla wybranego dnia
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-stone-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* WAŻNA INFORMACJA DOMENOWA STARBUCKS */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed">
            <span className="font-bold">Godziny obecności menedżera (Shift Hours):</span>
            <p className="text-[11px] text-amber-800">
              Wprowadzony przedział definiuje bezpośrednio <strong>godziny dyżuru i obecności kierownika na zmianie</strong> (uwzględnia procedury otwarcia, kasy, rozruch ekspresów i zamknięcie), a <strong>nie</strong> godziny otwarcia kawiarni dla gości.
            </p>
          </div>
        </div>

        {/* FORMULARZ */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {/* SZYBKIE PRESETY */}
          <div>
            <label className="text-xs font-bold text-stone-600 uppercase tracking-wider block mb-1.5">
              Szybkie szablony (Presety):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('wigilia')}
                className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-semibold text-center transition-all flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Wigilia 9h (1 MGR)</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('short10')}
                className="px-2.5 py-1.5 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-900 text-xs font-semibold text-center transition-all flex items-center justify-center gap-1"
              >
                <Clock className="w-3 h-3 text-sky-600" />
                <span>Dyżur 10h (1 MGR)</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('sylwester')}
                className="px-2.5 py-1.5 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-semibold text-center transition-all flex items-center justify-center gap-1"
              >
                <Users className="w-3 h-3 text-purple-600" />
                <span>Sylwester (2 MGR)</span>
              </button>
              <button
                type="button"
                onClick={() => applyPreset('closed')}
                className="px-2.5 py-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-900 text-xs font-semibold text-center transition-all flex items-center justify-center gap-1"
              >
                <X className="w-3 h-3 text-rose-600" />
                <span>Zamknięte (0h)</span>
              </button>
            </div>
          </div>

          {/* STATUS DNIA */}
          <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800">Status kawiarni w tym dniu:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpenDay(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    isOpenDay
                      ? 'bg-[#006241] text-white shadow-xs'
                      : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                  }`}
                >
                  Czynna (wymaga MGR)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpenDay(false);
                    setManagerCount(0);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    !isOpenDay
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
                  }`}
                >
                  Zamknięta (0 MGR)
                </button>
              </div>
            </div>

            {isOpenDay && (
              <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700">Wymagana liczba menedżerów:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setManagerCount(1)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      managerCount === 1
                        ? 'bg-emerald-700 text-white ring-2 ring-emerald-500'
                        : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>1 Menedżer (Pojedyncza zmiana)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManagerCount(2)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      managerCount === 2
                        ? 'bg-emerald-700 text-white ring-2 ring-emerald-500'
                        : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>2 Menedżerów (AM + PM)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* PRZEDZIAŁ GODZIN OBECNOŚCI */}
          {isOpenDay && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-stone-700 block">
                Wymagany przedział obecności menedżera (początek i koniec zmiany):
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] font-semibold text-stone-500 block mb-1">Wejście (Start zmiany):</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm font-bold bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#006241] focus:border-[#006241] text-stone-800"
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-stone-500 block mb-1">Wyjście (Koniec zmiany):</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm font-bold bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#006241] focus:border-[#006241] text-stone-800"
                  />
                </div>
              </div>

              {/* DYNAMIKA KALKULACJI GODZIN */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs text-emerald-900 font-semibold">
                    {managerCount === 1 ? 'Czas pojedynczej zmiany menedżerskiej:' : 'Łączne okno dyżuru menedżerskiego:'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-emerald-800">
                    {computedHours.toFixed(1)} h
                  </span>
                  <span className="text-[10px] text-emerald-600 font-medium">
                    ({startTime} – {endTime})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* NOTATKA / ETYKIETA OKAZJI */}
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              Etykieta dnia / Notatka (opcjonalnie):
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="np. Wigilia, Sylwester, Skrócony dyżur..."
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#006241] focus:border-[#006241] text-stone-800"
            />
          </div>

          {/* STOPKA PRZYCISKÓW */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-between gap-3">
            <div>
              {initialRequirement && (
                <button
                  type="button"
                  onClick={handleResetToStandard}
                  disabled={isSubmitting || isReadOnly}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all"
                  title="Przywraca standardowe wymaganie (2 menedżerów: AM + PM)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Przywróć standard</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-all"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isReadOnly}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'Zapisywanie...' : 'Zapisz Wymóg Dnia'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
