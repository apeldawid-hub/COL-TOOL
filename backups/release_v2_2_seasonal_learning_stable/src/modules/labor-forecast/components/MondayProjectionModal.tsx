import React, { useState } from 'react';
import { Sparkles, X, Check, Clock, Users, ArrowRight, Info, Target, AlertCircle } from 'lucide-react';
import { WeeklyCalculatedRow } from '../../../types';

interface MondayProjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: WeeklyCalculatedRow;
  onSaveTrx: (weekKey: string, trx: number | null) => Promise<void>;
  onSaveScheduledHours?: (weekKey: string, hours: number | null) => Promise<void>;
}

export const MondayProjectionModal: React.FC<MondayProjectionModalProps> = ({
  isOpen,
  onClose,
  row,
  onSaveTrx,
  onSaveScheduledHours,
}) => {
  const p = row.mondayProjection;

  const [editTrxValue, setEditTrxValue] = useState<string>(
    p?.actualTrxDays1to6 !== null && p?.actualTrxDays1to6 !== undefined
      ? String(p.actualTrxDays1to6)
      : ''
  );

  const [baristaHoursInput, setBaristaHoursInput] = useState<string>(
    p?.projectedBaristaHours !== undefined ? String(p.projectedBaristaHours) : '29.5'
  );

  const [editSchedValue, setEditSchedValue] = useState<string>(
    row.scheduledHours !== null && row.scheduledHours !== undefined
      ? String(row.scheduledHours)
      : String(p?.fullWeekProjectedHours ?? '')
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !p) return null;

  const baristasVal = parseFloat(baristaHoursInput) || 0;
  const mondayTotalVal = Number((p.projectedMgrHours + baristasVal).toFixed(1));
  const fullWeekVal = Number((p.loggedHoursDays1to6 + mondayTotalVal).toFixed(1));

  // Znajdź pokrycie dzienne dla poniedziałku z row.managerDailyCoverage
  const mondayDayCoverage = row.managerDailyCoverage?.find((d) => d.day === p.dayOfMonth);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const trxVal = editTrxValue.trim() === '' ? null : Number(editTrxValue);
      await onSaveTrx(row.week.week_key, isNaN(trxVal as number) ? null : trxVal);

      if (onSaveScheduledHours) {
        await onSaveScheduledHours(row.week.week_key, fullWeekVal);
      }
      onClose();
    } catch (err) {
      console.error('Błąd zapisu danych Flash Forecast:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-[#E2E8E5] rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col">
        {/* Nagłówek okna */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-700 via-indigo-700 to-[#006241] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur-xs shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">
                  Flash Forecast: Poniedziałek ({p.date})
                </h3>
                <span className="text-[10px] font-black uppercase bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/20">
                  {row.week.week_num_in_month} ({row.week.date_from} – {row.week.date_to})
                </span>
              </div>
              <p className="text-xs text-purple-100/90 mt-0.5">
                Pre-closing projection na zakończenie bieżącego tygodnia roboczego
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ciało okna */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Wyjaśnienie operacyjne: Poniedziałek vs Wtorek */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 via-indigo-50/60 to-emerald-50 border border-purple-200/80 shadow-2xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-purple-950 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-purple-700" />
              Cykl planowania: Poniedziałek vs Wtorek
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-white/90 border border-purple-200 shadow-2xs">
                <div className="font-bold text-purple-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-600 inline-block"></span>
                  <span>W Poniedziałek (Dziś):</span>
                </div>
                <p className="text-stone-600 text-[11px] mt-1 leading-relaxed">
                  Tydzień kończy się wieczorem. System domyka estymację: menedżerowie z Modułu 2 (<strong>+{p.projectedMgrHours}h</strong>), barisci do celu (<strong>+{p.projectedBaristaHours}h</strong>) oraz transakcje (<strong>+{p.projectedMondayTrx} TRX</strong>). MTD i rekomendacja HANW na W+2 są odblokowane.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white/90 border border-emerald-200 shadow-2xs">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#006241] inline-block"></span>
                  <span>We Wtorek (Jutro):</span>
                </div>
                <p className="text-stone-600 text-[11px] mt-1 leading-relaxed">
                  Dzień oficjalnego rozliczenia. Tydzień {row.week.week_num_in_month} przechodzi w stan zamknięty, a estymacja wygasa. System wczytuje <strong>100% oficjalnych danych z MAPAL Fichajes (7 dni)</strong>, a bieżącym staje się nowy tydzień.
                </p>
              </div>
            </div>
          </div>

          {/* Karta 1: Rozbicie godzinowe */}
          <div className="border border-[#E2E8E5] rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-[#F8FAF9] px-4 py-2.5 border-b border-[#E2E8E5] flex items-center justify-between">
              <span className="text-xs font-black text-[#1E3932] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#006241]" />
                1. Bilans Godzin Robocizny Tygodnia
              </span>
              <span className="text-xs font-bold text-stone-500">
                Estymacja tygodnia: <strong className="text-stone-800">{fullWeekVal}h</strong> (dziś Pn: <strong className="text-purple-700">+{mondayTotalVal}h</strong>)
              </span>
            </div>

            <div className="p-4 space-y-3">
              {/* Krok po kroku */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-center">
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg">
                  <div className="text-[10px] uppercase font-bold text-blue-800">1. Logowania (6 dni)</div>
                  <div className="text-base font-black text-blue-950 mt-0.5">{p.loggedHoursDays1to6} h</div>
                  <div className="text-[10px] text-blue-700 mt-0.5">Wt – Nd (MAPAL)</div>
                </div>

                <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-lg">
                  <div className="text-[10px] uppercase font-bold text-purple-800">2. MGR na dziś (Pn)</div>
                  <div className="text-base font-black text-purple-950 mt-0.5">+{p.projectedMgrHours} h</div>
                  <div className="text-[10px] text-purple-700 mt-0.5">Moduł 2 (Grafik)</div>
                </div>

                <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg">
                  <div className="text-[10px] uppercase font-bold text-amber-800">3. Barisci na dziś (Pn)</div>
                  <div className="text-base font-black text-amber-950 mt-0.5">+{baristasVal} h</div>
                  <div className="text-[10px] text-amber-700 mt-0.5">Z grafiku kawiarni</div>
                </div>

                <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg">
                  <div className="text-[10px] uppercase font-bold text-emerald-800">Razem tydzień</div>
                  <div className="text-base font-black text-emerald-950 mt-0.5">{fullWeekVal} h</div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">Dziś: +{mondayTotalVal}h</div>
                </div>
              </div>

              {/* Bezpośrednie wprowadzanie godzin baristów na poniedziałek */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Zaplanowane godziny baristów na dziś (Pn):</span>
                  </div>
                  <p className="text-[11px] text-amber-800/85 mt-0.5">
                    Wpisz godziny baristów z ułożonego grafiku kawiarni na dziś (np. <strong>29.5 h</strong>).
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <input
                    type="number"
                    step="0.5"
                    value={baristaHoursInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBaristaHoursInput(val);
                      const b = parseFloat(val) || 0;
                      const tot = Number((p.loggedHoursDays1to6 + p.projectedMgrHours + b).toFixed(1));
                      setEditSchedValue(String(tot));
                    }}
                    placeholder="np. 29.5"
                    className="w-24 px-3 py-1.5 bg-white border-2 border-amber-500 focus:ring-2 focus:ring-amber-500 rounded-lg text-sm font-black text-amber-950 outline-none text-right shadow-xs"
                  />
                  <span className="text-xs font-black text-amber-900">h</span>
                </div>
              </div>

              {/* Szczegóły menedżerów na dziś */}
              {mondayDayCoverage && (
                <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-stone-500 font-bold text-[11px]">Obsada menedżerska na poniedziałek ({p.projectedMgrHours}h):</span>
                  {mondayDayCoverage.amEmployees.map((emp, i) => (
                    <span key={i} className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-md font-semibold text-[11px]">
                      🌅 {emp}
                    </span>
                  ))}
                  {mondayDayCoverage.pmEmployees.map((emp, i) => (
                    <span key={i} className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-md font-semibold text-[11px]">
                      🌙 {emp}
                    </span>
                  ))}
                  {mondayDayCoverage.otherEmployees.map((emp, i) => (
                    <span key={i} className="px-2 py-0.5 bg-stone-100 border border-stone-200 text-stone-800 rounded-md font-semibold text-[11px]">
                      💼 {emp}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Karta 2: Transakcje i edycja 6 dni */}
          <div className="border border-[#E2E8E5] rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-[#F8FAF9] px-4 py-2.5 border-b border-[#E2E8E5] flex items-center justify-between">
              <span className="text-xs font-black text-[#1E3932] uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-purple-700" />
                2. Transakcje (TRX) i Wprowadzanie Danych z 6 Dni
              </span>
              <span className="text-xs font-bold text-stone-500">
                Plan AOP: <strong className="text-stone-800">{p.planTrx} TRX</strong>
              </span>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Wprowadź rzeczywiste TRX z 6 dni (Wt–Nd):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editTrxValue}
                      onChange={(e) => setEditTrxValue(e.target.value)}
                      placeholder={p.actualTrxDays1to6 ? String(p.actualTrxDays1to6) : 'np. 2198'}
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 rounded-lg text-sm font-bold text-stone-900 outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">
                    {editTrxValue
                      ? `Poniedziałek zostanie oszacowany jako: max(0, ${p.planTrx} - ${editTrxValue}) = +${Math.max(0, p.planTrx - (Number(editTrxValue) || 0))} TRX`
                      : 'Brak wpisu: system przyjmuje plan AOP tygodnia jako bazę.'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Łączny cel grafiku tygodnia ("Grafik h"):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      value={editSchedValue}
                      onChange={(e) => {
                        const totStr = e.target.value;
                        setEditSchedValue(totStr);
                        const tot = parseFloat(totStr) || 0;
                        const b = Math.max(0, Number((tot - p.loggedHoursDays1to6 - p.projectedMgrHours).toFixed(1)));
                        setBaristaHoursInput(String(b));
                      }}
                      placeholder={String(fullWeekVal)}
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 rounded-lg text-sm font-bold text-stone-900 outline-none"
                    />
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Suma: 6 dni ({p.loggedHoursDays1to6}h) + dzisiejszy poniedziałek ({mondayTotalVal}h).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Baner informacyjny o wtorkowym zasileniu */}
          <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
            <Check className="w-4 h-4 text-[#006241] shrink-0" />
            <span>
              <strong>Automatyczna aktualizacja:</strong> Po zaimportowaniu rzeczywistych logowań z Fichajes we wtorek rano, Flash Forecast zostanie automatycznie zastąpiony oficjalnym rozliczeniem bez konieczności resetowania danych.
            </span>
          </div>
        </div>

        {/* Stopka okna */}
        <div className="px-6 py-3.5 bg-[#F8FAF9] border-t border-[#E2E8E5] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 text-xs font-bold transition-all cursor-pointer"
          >
            Zamknij
          </button>

          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSaving ? 'Zapisywanie...' : 'Zapisz i Przelicz Tydzień'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
