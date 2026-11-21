// src/modules/managers-schedule/components/WeeklyRequirementsModal.tsx
import React, { useState } from 'react';
import { X, Clock, Users, Sparkles, Check, RotateCcw, AlertCircle, ShieldAlert } from 'lucide-react';
import { ManagerWeeklyRequirement } from '../types';

interface WeeklyRequirementsModalProps {
  isOpen: boolean;
  initialRequirements?: ManagerWeeklyRequirement[];
  onSave: (requirements: ManagerWeeklyRequirement[]) => Promise<void> | void;
  onClose: () => void;
  isReadOnly?: boolean;
}

const DEFAULT_WEEKLY_REQUIREMENTS: ManagerWeeklyRequirement[] = [
  { day_of_week: 1, day_name: 'Poniedziałek', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', required_hours: 16.0, notes: 'Standard Pn–Czw (2 MGR)' },
  { day_of_week: 2, day_name: 'Wtorek', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', required_hours: 16.0, notes: 'Standard Pn–Czw (2 MGR)' },
  { day_of_week: 3, day_name: 'Środa', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', required_hours: 16.0, notes: 'Standard Pn–Czw (2 MGR)' },
  { day_of_week: 4, day_name: 'Czwartek', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', required_hours: 16.0, notes: 'Standard Pn–Czw (2 MGR)' },
  { day_of_week: 5, day_name: 'Piątek', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', required_hours: 16.0, notes: 'Standard Piątek (2 MGR)' },
  { day_of_week: 6, day_name: 'Sobota', is_open: true, manager_count: 2, start_time: '07:00', end_time: '22:30', required_hours: 16.0, notes: 'Standard Sobota (2 MGR)' },
  { day_of_week: 0, day_name: 'Niedziela (wolna od handlu)', is_open: true, manager_count: 2, start_time: '08:00', end_time: '21:00', required_hours: 14.0, notes: 'Niedziela Wolna od Handlu (2 MGR)' },
  { day_of_week: 7, day_name: 'Niedziela Handlowa', is_open: true, manager_count: 2, start_time: '08:00', end_time: '21:00', required_hours: 16.0, notes: 'Niedziela Handlowa (2 MGR)' },
];

export const WeeklyRequirementsModal: React.FC<WeeklyRequirementsModalProps> = ({
  isOpen,
  initialRequirements,
  onSave,
  onClose,
  isReadOnly = false
}) => {
  const [requirements, setRequirements] = useState<ManagerWeeklyRequirement[]>(() => {
    if (initialRequirements && initialRequirements.length > 0) {
      // Łączymy z domyślnymi na wypadek brakujących dni
      const map = new Map(initialRequirements.map(r => [r.day_of_week, r]));
      return DEFAULT_WEEKLY_REQUIREMENTS.map(def => map.get(def.day_of_week) || def);
    }
    return DEFAULT_WEEKLY_REQUIREMENTS;
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const updateDay = (dayOfWeek: number, patch: Partial<ManagerWeeklyRequirement>) => {
    setRequirements(prev =>
      prev.map(item => {
        if (item.day_of_week !== dayOfWeek) return item;
        const updated = { ...item, ...patch };

        // Jeśli zmieniono czasy, przelicz szacowane required_hours
        if (patch.start_time !== undefined || patch.end_time !== undefined || patch.manager_count !== undefined) {
          if (!updated.is_open || updated.manager_count === 0) {
            updated.required_hours = 0;
          } else if (updated.start_time && updated.end_time) {
            const [sh, sm] = updated.start_time.split(':').map(Number);
            const [eh, em] = updated.end_time.split(':').map(Number);
            if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
              let diff = (eh * 60 + em) - (sh * 60 + sm);
              if (diff < 0) diff += 24 * 60;
              const spanHours = Number((diff / 60).toFixed(1));
              // Przy 2 menedżerach godziny sumaryczne to zazwyczaj 2 zmiany (np. 2 x 8h = 16h)
              updated.required_hours = updated.manager_count === 1 ? spanHours : Math.max(spanHours, updated.manager_count * 8.0);
            }
          }
        }
        return updated;
      })
    );
  };

  const handleApplyMondayToAllWorkdays = () => {
    const monday = requirements.find(r => r.day_of_week === 1);
    if (!monday) return;
    setRequirements(prev =>
      prev.map(item => {
        if (item.day_of_week >= 1 && item.day_of_week <= 5) {
          return {
            ...item,
            is_open: monday.is_open,
            manager_count: monday.manager_count,
            start_time: monday.start_time,
            end_time: monday.end_time,
            required_hours: monday.required_hours
          };
        }
        return item;
      })
    );
  };

  const handleResetToStandardDefaults = () => {
    setRequirements(DEFAULT_WEEKLY_REQUIREMENTS);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await onSave(requirements);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* NAGŁÓWEK */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#1E3932] to-[#0c1c18] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-2xl border border-emerald-400/30">
              <Clock className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight flex items-center gap-2">
                <span>Standardowy Profil Tygodnia (Godziny & Obsada)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-400/30">
                  Domyślnie 2 MGR
                </span>
              </h2>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Określ stałe godziny obecności menedżerów dla dni tygodnia. System automatycznie zastosuje je w każdym miesiącu.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* INFO BANER STARBUCKS STANDARD & NON-COVERAGE EXCLUSION */}
        <div className="px-6 py-3 bg-amber-50/80 border-b border-amber-200 text-amber-950 text-xs flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
            <div className="leading-snug">
              <strong>Złota Reguła Obsady Sali:</strong> Standardowo wymagane są <strong>2 osoby prowadzące zmianę (otwarcie + zamknięcie)</strong>. 
              <span className="text-purple-900 font-bold ml-1">
                Zmiany szkoleniowe (T, TAM, TPM) oraz administracja (NC) są wykluczone z obsady sali
              </span> — kierownik na NC nie liczy się do 2 osób prowadzących.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleApplyMondayToAllWorkdays}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
              title="Kopiuje godziny i obsadę z Poniedziałku na Wtorek, Środę, Czwartek i Piątek"
            >
              Kopiuj Pn ➔ Pn–Pt
            </button>
            <button
              type="button"
              onClick={handleResetToStandardDefaults}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 transition-colors flex items-center gap-1 cursor-pointer"
              title="Przywraca domyślne standardy Starbucks (2 MGR, Pn–So 07:00–22:30, Nd 08:00–21:00)"
            >
              <RotateCcw className="w-3 h-3 text-stone-500" />
              Standard Starbucks
            </button>
          </div>
        </div>

        {/* FORMULARZ DNI TYGODNIA */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Dzień Tygodnia</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Obsada (Menedżerowie)</th>
                  <th className="py-2.5 px-3 text-center">Godziny Menedżerów (Od – Do)</th>
                  <th className="py-2.5 px-3 text-center">Wymiar (h)</th>
                  <th className="py-2.5 px-3">Notatka / Profil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {requirements.map((req) => {
                  const isTrading = req.day_of_week === 7;
                  const isSundayNonTrading = req.day_of_week === 0;
                  const isWeekend = req.day_of_week === 6 || isSundayNonTrading || isTrading;

                  return (
                    <tr
                      key={`weekly-${req.day_of_week}`}
                      className={`hover:bg-stone-50/80 transition-colors ${
                        isTrading
                          ? 'bg-emerald-50/40'
                          : isSundayNonTrading
                          ? 'bg-amber-50/30'
                          : ''
                      }`}
                    >
                      {/* Dzień tygodnia */}
                      <td className="py-2.5 px-3 font-bold text-stone-800">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isTrading
                                ? 'bg-emerald-500 ring-2 ring-emerald-200'
                                : isSundayNonTrading
                                ? 'bg-amber-500'
                                : isWeekend
                                ? 'bg-amber-400'
                                : 'bg-stone-400'
                            }`}
                          />
                          <span>{req.day_name}</span>
                        </div>
                      </td>

                      {/* Status Otwarte / Zamknięte */}
                      <td className="py-2.5 px-3 text-center">
                        <label className="inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(req.is_open)}
                            onChange={(e) => updateDay(req.day_of_week, { is_open: e.target.checked })}
                            disabled={isReadOnly}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-stone-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600 relative"></div>
                          <span className="ml-2 text-[11px] font-semibold text-stone-700">
                            {req.is_open ? 'Czynne' : 'Zamknięte'}
                          </span>
                        </label>
                      </td>

                      {/* Liczba menedżerów */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex rounded-xl p-0.5 bg-stone-100 border border-stone-200">
                          {[
                            { count: 1, label: '1 MGR' },
                            { count: 2, label: '2 MGR (Std)' },
                            { count: 3, label: '3 MGR' }
                          ].map((opt) => (
                            <button
                              key={`cnt-${req.day_of_week}-${opt.count}`}
                              type="button"
                              onClick={() => updateDay(req.day_of_week, { manager_count: opt.count, is_open: true })}
                              disabled={isReadOnly || !req.is_open}
                              className={`px-2 py-1 text-[11px] font-black rounded-lg transition-all ${
                                req.is_open && req.manager_count === opt.count
                                  ? 'bg-[#006241] text-white shadow-xs'
                                  : 'text-stone-600 hover:text-stone-900 disabled:opacity-40'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Godziny menedżerów */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="time"
                            value={req.start_time || '07:00'}
                            onChange={(e) => updateDay(req.day_of_week, { start_time: e.target.value })}
                            disabled={isReadOnly || !req.is_open}
                            className="px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-800 focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-100 disabled:text-stone-400"
                          />
                          <span className="text-stone-400 font-bold">–</span>
                          <input
                            type="time"
                            value={req.end_time || '22:30'}
                            onChange={(e) => updateDay(req.day_of_week, { end_time: e.target.value })}
                            disabled={isReadOnly || !req.is_open}
                            className="px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-semibold text-stone-800 focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-100 disabled:text-stone-400"
                          />
                        </div>
                      </td>

                      {/* Wymiar godzin */}
                      <td className="py-2.5 px-3 text-center font-bold text-stone-800">
                        {req.is_open ? `${req.required_hours || 16.0}h` : '0h'}
                      </td>

                      {/* Notatka */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={req.notes || ''}
                          onChange={(e) => updateDay(req.day_of_week, { notes: e.target.value })}
                          disabled={isReadOnly}
                          placeholder="np. Standard Pn–Czw (2 MGR)"
                          className="w-full px-2 py-1 text-xs bg-white border border-stone-200 rounded-lg text-stone-700 focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-100"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-[11px] text-stone-600 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Jak działa profil tygodniowy?</strong> Powyższe reguły są automatyczną bazą dla wszystkich dni w grafiku. 
              Jeśli dla konkretnej daty (np. Wigilia 24.12 lub Sylwester 31.12) wprowadzisz indywidualny wymóg klikając w nagłówek kolumny, 
              ma on pierwszeństwo nad wzorcem tygodnia.
            </div>
          </div>

          {/* STOPKA PRZYCISKÓW */}
          <div className="pt-2 flex items-center justify-between border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 transition-colors"
            >
              Anuluj
            </button>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isReadOnly || isSubmitting}
                className="px-5 py-2 rounded-xl bg-[#006241] hover:bg-[#00754A] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'Zapisywanie...' : 'Zapisz Wzorzec Tygodnia (2 MGR)'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
