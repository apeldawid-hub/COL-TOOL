// src/modules/managers-schedule/components/WeeklyRequirementsModal.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { X, Clock, Users, Sparkles, Check, RotateCcw, AlertCircle, ShieldAlert, Calendar, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { ManagerWeeklyRequirement } from '../../../types';
import { DEFAULT_WEEKLY_REQUIREMENTS } from '../constants/defaultWeeklyRequirements';
import { parseTimeToHours, formatHoursToTimeString } from '../services/managerScheduleEngine';

interface WeeklyRequirementsModalProps {
  isOpen: boolean;
  initialRequirements?: ManagerWeeklyRequirement[];
  year?: number;
  month?: number;
  storeName?: string;
  storeId?: string;
  isReadOnly?: boolean;
  onSave: (requirements: ManagerWeeklyRequirement[], options?: { year: number; month: number; storeId?: string }) => Promise<void> | void;
  onClose: () => void;
  onAdaptDraft?: (options: { year: number; month: number }) => Promise<{ success: boolean; updated: number }>;
}

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

export const WeeklyRequirementsModal: React.FC<WeeklyRequirementsModalProps> = ({
  isOpen,
  initialRequirements,
  year = new Date().getFullYear(),
  month = new Date().getMonth() + 1,
  storeName,
  storeId,
  isReadOnly = false,
  onSave,
  onClose,
  onAdaptDraft
}) => {
  // Stan okresu wejścia w życie (Wersjonowanie roczno-miesięczne)
  const [effectiveYear, setEffectiveYear] = useState<number>(() => {
    return initialRequirements?.[0]?.effective_from_year || year;
  });
  const [effectiveMonth, setEffectiveMonth] = useState<number>(() => {
    return initialRequirements?.[0]?.effective_from_month || month;
  });

  // Globalne domyślne parametry kawiarni
  const [globalShiftLength, setGlobalShiftLength] = useState<number>(() => {
    return initialRequirements?.[0]?.shift_length_hours || 8.0;
  });
  const [globalMinHandover, setGlobalMinHandover] = useState<number>(() => {
    return initialRequirements?.[0]?.min_handover_minutes || 60;
  });

  const [requirements, setRequirements] = useState<ManagerWeeklyRequirement[]>(() => {
    if (initialRequirements && initialRequirements.length > 0) {
      const map = new Map(initialRequirements.map(r => [r.day_of_week, r]));
      return DEFAULT_WEEKLY_REQUIREMENTS.map(def => {
        const existing = map.get(def.day_of_week);
        return existing ? { ...def, ...existing } : def;
      });
    }
    return DEFAULT_WEEKLY_REQUIREMENTS;
  });

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isAdaptingDraft, setIsAdaptingDraft] = useState<boolean>(false);
  const [adaptResultMsg, setAdaptResultMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Dynamiczne pobieranie profilu dla wybranego okresu obowiązywania (zabezpieczenie przed nadpisywaniem historii)
  useEffect(() => {
    let isCancelled = false;
    const fetchProfileForPeriod = async () => {
      try {
        const api = (window as any).api;
        if (api?.getManagerWeeklyRequirements) {
          const list = await api.getManagerWeeklyRequirements({
            year: effectiveYear,
            month: effectiveMonth,
            storeId
          });
          if (!isCancelled && Array.isArray(list) && list.length > 0) {
            const map = new Map(list.map((r: any) => [r.day_of_week, r]));
            setRequirements(prev =>
              prev.map(item => {
                const existing = map.get(item.day_of_week);
                return existing ? { ...item, ...existing } : item;
              })
            );
            if (list[0]?.shift_length_hours) setGlobalShiftLength(Number(list[0].shift_length_hours));
            if (list[0]?.min_handover_minutes) setGlobalMinHandover(Number(list[0].min_handover_minutes));
          }
        }
      } catch (err) {
        console.warn('Nie udało się pobrać profilu dla okresu:', err);
      }
    };
    fetchProfileForPeriod();
    return () => {
      isCancelled = true;
    };
  }, [effectiveYear, effectiveMonth, storeId]);

  if (!isOpen) return null;

  const updateDay = (dayOfWeek: number, patch: Partial<ManagerWeeklyRequirement>) => {
    setRequirements(prev =>
      prev.map(item => {
        if (item.day_of_week !== dayOfWeek) return item;
        const updated = { ...item, ...patch };

        // Jeśli zmieniono czasy, długość lub obsadę, przelicz required_hours
        if (
          patch.start_time !== undefined ||
          patch.end_time !== undefined ||
          patch.manager_count !== undefined ||
          patch.shift_length_hours !== undefined ||
          patch.is_open !== undefined
        ) {
          if (!updated.is_open || updated.manager_count === 0) {
            updated.required_hours = 0;
          } else if (updated.start_time && updated.end_time) {
            const sh = parseTimeToHours(updated.start_time) ?? 7.0;
            const eh = parseTimeToHours(updated.end_time) ?? 22.5;
            let span = eh - sh;
            if (span < 0) span += 24;

            const shiftLen = updated.shift_length_hours || 8.0;
            if (updated.manager_count === 1) {
              updated.required_hours = Number(span.toFixed(1));
            } else {
              updated.required_hours = Number((updated.manager_count * shiftLen).toFixed(1));
            }
          }
        }
        return updated;
      })
    );
  };

  // Zastosowanie globalnej długości zmian do wszystkich dni roboczych/wszystkich dni
  const handleApplyGlobalShiftLength = (targetLen: number) => {
    setGlobalShiftLength(targetLen);
    setRequirements(prev =>
      prev.map(item => {
        // Niedziela wolna może zachować 7h jeśli użytkownik tego nie nadpisze, ale dla standardu stosujemy
        const updated = { ...item, shift_length_hours: targetLen };
        if (updated.is_open && updated.manager_count > 0) {
          updated.required_hours = updated.manager_count === 1 ? updated.required_hours : Number((updated.manager_count * targetLen).toFixed(1));
        }
        return updated;
      })
    );
  };

  // Zastosowanie globalnego minimalnego czasu przekazania do wszystkich dni
  const handleApplyGlobalMinHandover = (minMinutes: number) => {
    setGlobalMinHandover(minMinutes);
    setRequirements(prev =>
      prev.map(item => ({ ...item, min_handover_minutes: minMinutes }))
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
            shift_length_hours: monday.shift_length_hours,
            min_handover_minutes: monday.min_handover_minutes,
            required_hours: monday.required_hours
          };
        }
        return item;
      })
    );
  };

  const handleResetToStandardDefaults = () => {
    setRequirements(DEFAULT_WEEKLY_REQUIREMENTS);
    setGlobalShiftLength(8.0);
    setGlobalMinHandover(60);
  };

  // Wyliczenie okna przekazania zmiany (Handover Overlap) dla danego dnia
  const computeHandoverInfo = (req: ManagerWeeklyRequirement) => {
    if (!req.is_open || req.manager_count < 2 || !req.start_time || !req.end_time) {
      return null;
    }
    const sh = parseTimeToHours(req.start_time) ?? 7.0;
    const eh = parseTimeToHours(req.end_time) ?? 22.5;
    const len = req.shift_length_hours || globalShiftLength || 8.0;

    // AM: od sh do sh + len
    const amEnd = sh + len;
    // PM: od eh - len do eh
    const pmStart = eh - len;

    const overlapHours = amEnd - pmStart;
    const overlapMinutes = Math.round(overlapHours * 60);

    const amEndStr = formatHoursToTimeString(amEnd);
    const pmStartStr = formatHoursToTimeString(pmStart);

    const minRequired = req.min_handover_minutes || globalMinHandover || 60;
    const isCompliant = overlapMinutes >= minRequired;
    const isGap = overlapMinutes <= 0;

    return {
      amEndStr,
      pmStartStr,
      overlapMinutes,
      overlapHours: Number(overlapHours.toFixed(1)),
      minRequired,
      isCompliant,
      isGap
    };
  };

  // Dopasowanie obecnego szkicu do nowego profilu
  const handleAdaptDraft = async () => {
    if (isAdaptingDraft) return;
    try {
      setIsAdaptingDraft(true);
      setAdaptResultMsg(null);
      let updatedCount = 0;
      if (onAdaptDraft) {
        const res = await onAdaptDraft({ year: effectiveYear, month: effectiveMonth });
        updatedCount = res.updated;
      } else if ((window as any).api?.adaptScheduleToWeeklyRequirements) {
        const res = await (window as any).api.adaptScheduleToWeeklyRequirements({
          year: effectiveYear,
          month: effectiveMonth
        });
        updatedCount = res.updated;
      }
      setAdaptResultMsg(`Pomyślnie zsynchronizowano ${updatedCount} zmian AM/PM w szkicu (${MONTH_NAMES[effectiveMonth - 1]} ${effectiveYear}).`);
      setTimeout(() => setAdaptResultMsg(null), 6000);
    } catch (e: any) {
      setAdaptResultMsg(`Błąd dopasowania szkicu: ${e?.message || 'Nieznany błąd'}`);
    } finally {
      setIsAdaptingDraft(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessToast(null);

      // Przypisz okres obowiązywania do każdego wiersza
      const finalizedReqs: ManagerWeeklyRequirement[] = requirements.map(r => ({
        ...r,
        effective_from_year: effectiveYear,
        effective_from_month: effectiveMonth,
        shift_length_hours: r.shift_length_hours || globalShiftLength,
        min_handover_minutes: r.min_handover_minutes || globalMinHandover
      }));

      await onSave(finalizedReqs, { year: effectiveYear, month: effectiveMonth, storeId });
      setSuccessToast(`Pomyślnie zapisano profil tygodniowy Shift Hours (od ${MONTH_NAMES[effectiveMonth - 1]} ${effectiveYear}).`);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Błąd zapisu profilu tygodniowego:', err);
      setErrorMessage(err?.message || 'Wystąpił błąd podczas zapisywania profilu w bazie danych.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* NAGŁÓWEK */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#1E3932] to-[#0c1c18] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-2xl border border-emerald-400/30">
              <Clock className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight">
                  Standardowe Godziny Zmian & Profil Kawiarni (Shift Hours)
                </h2>
                {storeName && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 font-bold border border-emerald-400/30">
                    {storeName}
                  </span>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-200 font-bold border border-amber-400/30">
                  Domyślnie 2 MGR
                </span>
              </div>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                Konfiguracja godzin otwarcia/zamknięcia, standardowej długości zmian (8h/9h) i okna przekazania zmiany (Handover Overlap).
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

        {/* PASEK WERSJONOWANIA I PARAMETRÓW DOMYŚLNYCH */}
        <div className="px-6 py-3.5 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
          {/* Wybór okresu wejścia w życie */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-stone-700 font-bold">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>Obowiązuje od:</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-stone-300 rounded-xl px-2 py-1 shadow-2xs">
              <select
                value={effectiveMonth}
                onChange={(e) => setEffectiveMonth(Number(e.target.value))}
                disabled={isReadOnly}
                className="bg-transparent font-bold text-stone-800 focus:outline-hidden cursor-pointer"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={`m-${idx + 1}`} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={effectiveYear}
                onChange={(e) => setEffectiveYear(Number(e.target.value))}
                disabled={isReadOnly}
                className="bg-transparent font-bold text-stone-800 focus:outline-hidden cursor-pointer"
              >
                {[year - 1, year, year + 1, year + 2].map((y) => (
                  <option key={`y-${y}`} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Historia wstecz nie ulegnie modyfikacji</span>
            </div>
          </div>

          {/* Domyślna długość zmian menedżerów */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-stone-700">Długość zmian:</span>
              <div className="inline-flex rounded-xl p-0.5 bg-white border border-stone-300 shadow-2xs">
                {[8.0, 8.5, 9.0].map((len) => (
                  <button
                    key={`len-${len}`}
                    type="button"
                    onClick={() => handleApplyGlobalShiftLength(len)}
                    disabled={isReadOnly}
                    className={`px-2 py-0.5 rounded-lg text-xs font-black transition-all ${
                      globalShiftLength === len
                        ? 'bg-[#006241] text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {len}h
                  </button>
                ))}
              </div>
            </div>

            {/* Minimalna zakładka przekazania */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-stone-700">Min. Zakładka:</span>
              <select
                value={globalMinHandover}
                onChange={(e) => handleApplyGlobalMinHandover(Number(e.target.value))}
                disabled={isReadOnly}
                className="bg-white border border-stone-300 rounded-xl px-2 py-1 text-xs font-bold text-stone-800 focus:outline-hidden shadow-2xs cursor-pointer"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min (Std)</option>
                <option value={90}>90 min</option>
              </select>
            </div>

            {/* Przyciski szybkich akcji */}
            <button
              type="button"
              onClick={handleApplyMondayToAllWorkdays}
              disabled={isReadOnly}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              title="Kopiuje godziny i długość z Poniedziałku na Pn–Pt"
            >
              Kopiuj Pn ➔ Pn–Pt
            </button>
            <button
              type="button"
              onClick={handleResetToStandardDefaults}
              disabled={isReadOnly}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 transition-colors flex items-center gap-1 cursor-pointer"
              title="Przywraca standard Starbucks (8h, Pn–So 07:00–22:30, Nd 08:00–21:00)"
            >
              <RotateCcw className="w-3 h-3 text-stone-500" />
              Reset
            </button>
          </div>
        </div>

        {/* KOMUNIKAT BŁĘDU / SUKCESU ZAPISU */}
        {errorMessage && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successToast && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* KOMUNIKAT DOPASOWANIA SZKICU */}
        {adaptResultMsg && (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{adaptResultMsg}</span>
          </div>
        )}

        {/* FORMULARZ DNI TYGODNIA */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Dzień Tygodnia</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Obsada (Menedżerowie)</th>
                  <th className="py-2.5 px-3 text-center">Godziny Kawiarni (Od – Do)</th>
                  <th className="py-2.5 px-3 text-center">Długość Zmiany MGR</th>
                  <th className="py-2.5 px-3 text-center">Zakładka Przekazania (Handover)</th>
                  <th className="py-2.5 px-3 text-center">Wymiar (h)</th>
                  <th className="py-2.5 px-3">Notatka</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {requirements.map((req) => {
                  const isTrading = req.day_of_week === 7;
                  const isSundayNonTrading = req.day_of_week === 0;
                  const isWeekend = req.day_of_week === 6 || isSundayNonTrading || isTrading;
                  const handoverInfo = computeHandoverInfo(req);

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

                      {/* Godziny obecności menedżerów / kawiarni */}
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

                      {/* Długość zmiany MGR */}
                      <td className="py-2.5 px-3 text-center">
                        <select
                          value={req.shift_length_hours || globalShiftLength}
                          onChange={(e) => updateDay(req.day_of_week, { shift_length_hours: Number(e.target.value) })}
                          disabled={isReadOnly || !req.is_open}
                          className="px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 focus:ring-1 focus:ring-emerald-500 disabled:bg-stone-100"
                        >
                          <option value={7.0}>7.0h</option>
                          <option value={8.0}>8.0h (Std)</option>
                          <option value={8.5}>8.5h</option>
                          <option value={9.0}>9.0h</option>
                          <option value={10.0}>10.0h</option>
                        </select>
                      </td>

                      {/* Wyliczona zakładka przekazania zmiany */}
                      <td className="py-2.5 px-3 text-center">
                        {handoverInfo ? (
                          <div
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold border ${
                              handoverInfo.isGap
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : handoverInfo.isCompliant
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                            title={`AM kończy: ${handoverInfo.amEndStr}, PM zaczyna: ${handoverInfo.pmStartStr}. Wymóg: min. ${handoverInfo.minRequired}m.`}
                          >
                            <span>
                              {handoverInfo.pmStartStr}–{handoverInfo.amEndStr}
                            </span>
                            <span className="text-[10px] opacity-80">
                              ({handoverInfo.overlapMinutes}m)
                            </span>
                            <span>
                              {handoverInfo.isGap ? '❌' : handoverInfo.isCompliant ? '✅' : '⚠️'}
                            </span>
                          </div>
                        ) : req.is_open && req.manager_count === 1 ? (
                          <span className="text-stone-400 italic text-[11px]">1 MGR (Cały dzień)</span>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
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
              <strong>Jak działa profil tygodniowy Shift Hours?</strong> Zdefiniowane godziny i długości zmian stanowią bezpośrednią bazę dla solvera <strong>AutoScheduler AI</strong> oraz popovera ręcznego wyboru zmian. 
              Dla wybranego okresu obowiązywania (od {MONTH_NAMES[effectiveMonth - 1]} {effectiveYear}) system wyznaczy dyżury AM od otwarcia oraz PM do zamknięcia z uwzględnieniem okna przekazania zmiany.
            </div>
          </div>

          {/* STOPKA PRZYCISKÓW */}
          <div className="pt-2 flex items-center justify-between border-t border-stone-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
              >
                Anuluj
              </button>
              {/* Opcja synchronizacji bieżącego szkicu */}
              <button
                type="button"
                onClick={handleAdaptDraft}
                disabled={isReadOnly || isAdaptingDraft}
                className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title={`Aktualizuje istniejące zmiany AM/PM w szkicu (${MONTH_NAMES[effectiveMonth - 1]} ${effectiveYear}) do nowych godzin`}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${isAdaptingDraft ? 'animate-spin' : ''}`} />
                <span>{isAdaptingDraft ? 'Dopasowywanie...' : `Dopasuj obecny szkic (${MONTH_NAMES[effectiveMonth - 1]} ${effectiveYear})`}</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isReadOnly || isSubmitting}
                className="px-5 py-2 rounded-xl bg-[#006241] hover:bg-[#00754A] text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'Zapisywanie...'
                    : `Zapisz Profil (od ${MONTH_NAMES[effectiveMonth - 1]} ${effectiveYear})`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
