import React from 'react';
import {
  X,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Users,
  Calendar,
  ArrowRight,
  Briefcase,
  Layers,
  CheckCircle2,
  Info
} from 'lucide-react';
import { WeeklyCalculatedRow } from '../../../types';

interface ManagerLaborBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekRow: WeeklyCalculatedRow | null;
  onNavigateToManagerSchedule?: () => void;
}

export const ManagerLaborBridgeModal: React.FC<ManagerLaborBridgeModalProps> = ({
  isOpen,
  onClose,
  weekRow,
  onNavigateToManagerSchedule,
}) => {
  if (!isOpen || !weekRow) return null;

  const { week } = weekRow;
  const days = weekRow.managerDailyCoverage || [];
  const managerHours = weekRow.managerHours || 0;
  const coverageHours = weekRow.managerCoverageHours || 0;
  const ncHours = weekRow.managerNcHours || 0;
  const targetBudget = weekRow.hanwRecommendation || weekRow.planHours;
  const baristaPool = weekRow.baristaHoursPool ?? Math.max(0, targetBudget - managerHours);

  const missingAmCount = days.filter(d => !d.hasAm).length;
  const missingPmCount = days.filter(d => !d.hasPm).length;
  const totalFloorDeficit = days.reduce((sum, d) => sum + d.floorDeficit, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E2E8E5] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Nagłówek modala */}
        <div className="px-6 py-5 border-b border-[#E2E8E5] flex items-center justify-between bg-[#F7F9F8]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#E8F5E9] text-[#006241] rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-[#1E3932] tracking-tight">
                  Obsada Kadry Kierowniczej & Floor Hours
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-[#006241] text-white font-bold text-xs">
                  {week.week_num_in_month}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>Zakres tygodnia: <strong>{week.date_from} – {week.date_to}</strong></span>
                <span>•</span>
                <span>Lokal: <strong>108120 SBX Warszawa Janki (384)</strong></span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-xl transition cursor-pointer"
            title="Zamknij okno"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Treść modala */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Karty podsumowania tygodnia */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Karta 1: Godziny MGR na Janki */}
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8E5] shadow-xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Godziny MGR (Janki)</span>
                <Clock className="w-4 h-4 text-[#006241]" />
              </div>
              <div className="text-xl font-black text-stone-900">
                {managerHours.toFixed(1)} h
              </div>
              <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
                <span className="text-emerald-700 font-semibold">{coverageHours.toFixed(1)}h Coverage</span>
                <span>+</span>
                <span className="text-purple-700 font-semibold">{ncHours.toFixed(1)}h NC</span>
              </div>
            </div>

            {/* Karta 2: Rekomendacja HANW */}
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8E5] shadow-xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Cel Robocizny</span>
                <Briefcase className="w-4 h-4 text-[#006241]" />
              </div>
              <div className="text-xl font-black text-[#006241]">
                {targetBudget.toFixed(1)} h
              </div>
              <div className="text-[11px] text-stone-400 mt-1">
                {weekRow.hanwRecommendation ? 'Rekomendacja HANW' : 'Plan Godzin AOP'}
              </div>
            </div>

            {/* Karta 3: Pula dla Baristów */}
            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-xs text-emerald-950">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Pula Baristów</span>
                <Layers className="w-4 h-4 text-[#006241]" />
              </div>
              <div className="text-xl font-black text-[#006241]">
                {baristaPool.toFixed(1)} h
              </div>
              <div className="text-[11px] text-emerald-800 mt-1 font-medium">
                Do obsadzenia baristami
              </div>
            </div>

            {/* Karta 4: Zgodność Kluczowa AM/PM */}
            <div className={`p-4 rounded-2xl border shadow-xs ${
              missingAmCount === 0 && missingPmCount === 0
                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Obsada AM / PM</span>
                {missingAmCount === 0 && missingPmCount === 0 ? (
                  <ShieldCheck className="w-4 h-4 text-[#006241]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <div className="text-xl font-black">
                {missingAmCount === 0 && missingPmCount === 0
                  ? '100% Pokrycia'
                  : `${missingAmCount + missingPmCount} luk w obsadzie`}
              </div>
              <div className="text-[11px] mt-1 opacity-80">
                {missingAmCount === 0 && missingPmCount === 0
                  ? 'Kierownik na każdym AM i PM'
                  : 'Brak kierownika na zmianie!'}
              </div>
            </div>
          </div>

          {/* Tabela dobowego rozkładu obecności kadry kierowniczej */}
          <div className="bg-white border border-[#E2E8E5] rounded-2xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-[#F4F7F5] border-b border-[#E2E8E5] flex items-center justify-between text-xs">
              <div className="font-black text-[#1E3932] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#006241]" />
                <span>Dobowy Rozkład Obecności & Wymóg Floor Hours (32.0 h / dzień)</span>
              </div>
              <span className="text-[11px] text-stone-500">
                Wspiera barierę bezpieczeństwa 4 osób na sali
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F7F9F8] text-stone-600 font-bold border-b border-[#E2E8E5] text-[11px] select-none">
                    <th className="py-2.5 px-3">Dzień & Data</th>
                    <th className="py-2.5 px-3">Otwarcie (AM)</th>
                    <th className="py-2.5 px-3">Zamknięcie (PM)</th>
                    <th className="py-2.5 px-3">Inne Dyżury MGR</th>
                    <th className="py-2.5 px-3 text-right">MGR Coverage</th>
                    <th className="py-2.5 px-3 text-right">Floor Dnia</th>
                    <th className="py-2.5 px-3 text-right font-black text-[#006241]">Min. Baristów do 32h</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F0]">
                  {days.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-400">
                        Brak zarejestrowanych zmian w grafiku managerskim dla wybranego tygodnia.
                      </td>
                    </tr>
                  ) : (
                    days.map((d) => {
                      return (
                        <tr key={`day-${d.day}`} className="hover:bg-[#F9FBFA] transition-colors">
                          {/* Dzień & Data */}
                          <td className="py-2.5 px-3 font-semibold text-stone-800">
                            <div className="flex items-center gap-1.5">
                              <span className="w-7 h-5 rounded bg-stone-100 text-stone-700 font-black text-[10px] flex items-center justify-center">
                                {d.dayOfWeek}
                              </span>
                              <span>{String(d.day).padStart(2, '0')}.{String(week.month_name ? week.month_name.slice(0, 3) : '')}</span>
                            </div>
                          </td>

                          {/* Otwarcie AM */}
                          <td className="py-2.5 px-3">
                            {d.hasAm ? (
                              <div className="flex flex-wrap gap-1">
                                {d.amEmployees.map((emp, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[10px]"
                                  >
                                    {emp}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[10px]">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>Brak MGR</span>
                              </span>
                            )}
                          </td>

                          {/* Zamknięcie PM */}
                          <td className="py-2.5 px-3">
                            {d.hasPm ? (
                              <div className="flex flex-wrap gap-1">
                                {d.pmEmployees.map((emp, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px]"
                                  >
                                    {emp}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 font-bold text-[10px]">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>Brak MGR</span>
                              </span>
                            )}
                          </td>

                          {/* Inne dyżury MGR */}
                          <td className="py-2.5 px-3 text-stone-500 text-[11px]">
                            {d.otherEmployees.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {d.otherEmployees.map((emp, i) => (
                                  <span
                                    key={i}
                                    className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 text-[10px]"
                                  >
                                    {emp}
                                  </span>
                                ))}
                              </div>
                            ) : d.ncHours > 0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-medium">
                                NC ({d.ncHours}h)
                              </span>
                            ) : (
                              <span className="text-stone-300">—</span>
                            )}
                          </td>

                          {/* MGR Coverage Hours */}
                          <td className="py-2.5 px-3 text-right font-bold text-stone-900">
                            {d.coverageHours.toFixed(1)} h
                          </td>

                          {/* Floor Dnia (32h) */}
                          <td className="py-2.5 px-3 text-right text-stone-500">
                            32.0 h
                          </td>

                          {/* Min. Baristów do Floor 32h */}
                          <td className="py-2.5 px-3 text-right font-black text-[#006241]">
                            {d.floorDeficit.toFixed(1)} h
                            <span className="text-[10px] font-normal text-stone-400 block">
                              ({(d.floorDeficit / 8.0).toFixed(1)} zmian)
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Wyjaśnienie i reguły biznesowe */}
          <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-stone-600 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#006241] shrink-0 mt-0.5" />
            <div className="space-y-1 text-[11px] leading-relaxed">
              <p>
                <strong>Zasada podziału robocizny w kawiarni:</strong> Godziny dyżurów kierowniczych w lokalu Janki (384) pokrywają część minimalnego Floor Hours (32h/dzień = 4 osoby na sali).
              </p>
              <p>
                Rekomendacja <strong>Puli Baristów ({baristaPool.toFixed(1)} h)</strong> to precyzyjny limit godzin, które Store Manager może rozpisać dla baristów na dany tydzień, aby utrzymać zgodność z celem AOP/HANW i TPLH.
              </p>
            </div>
          </div>
        </div>

        {/* Stopka modala */}
        <div className="px-6 py-4 border-t border-[#E2E8E5] flex items-center justify-between bg-white">
          <div className="text-xs text-stone-500">
            Suma wymogu baristycznego do Floor Hours: <strong className="text-stone-900">{totalFloorDeficit.toFixed(1)} h</strong>
          </div>

          <div className="flex items-center gap-3">
            {onNavigateToManagerSchedule && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToManagerSchedule();
                }}
                className="px-4 py-2 bg-[#F4F7F5] hover:bg-[#E8F5E9] text-[#006241] text-xs font-bold rounded-xl border border-[#D0DCD6] hover:border-[#006241] transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>Edytuj Grafik Managerski</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2 bg-[#006241] hover:bg-[#1E3932] text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
            >
              Zamknij
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
