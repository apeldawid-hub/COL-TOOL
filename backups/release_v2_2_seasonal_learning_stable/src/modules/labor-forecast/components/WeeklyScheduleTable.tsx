import React, { useState } from 'react';
import { Users, Edit3, Check, CalendarDays, Info, Clock, Target, CheckCircle2, ShieldCheck, Layers, Sparkles } from 'lucide-react';
import { WeeklyCalculatedRow } from '../../../types';
import { MondayProjectionModal } from './MondayProjectionModal';
import { useSystemClock } from '../../../hooks/useSystemClock';

interface WeeklyScheduleTableProps {
  rows: WeeklyCalculatedRow[];
  onSaveTrx: (weekKey: string, trx: number | null) => Promise<void>;
  onSaveScheduledHours?: (weekKey: string, hours: number | null) => Promise<void>;
  onSelectTargetWeek?: (weekKey: string) => void;
  onViewLaborDetails: (weekKey: string, weekLabel: string) => void;
  onViewMonthLaborDetails?: () => void;
  onViewManagerBridge?: (row: WeeklyCalculatedRow) => void;
}

export const WeeklyScheduleTable: React.FC<WeeklyScheduleTableProps> = ({
  rows,
  onSaveTrx,
  onSaveScheduledHours,
  onSelectTargetWeek,
  onViewLaborDetails,
  onViewMonthLaborDetails,
  onViewManagerBridge,
}) => {
  const [editingTrxKey, setEditingTrxKey] = useState<string | null>(null);
  const [editTrxValue, setEditTrxValue] = useState<string>('');

  const [editingSchedKey, setEditingSchedKey] = useState<string | null>(null);
  const [editSchedValue, setEditSchedValue] = useState<string>('');

  const [selectedProjectionRow, setSelectedProjectionRow] = useState<WeeklyCalculatedRow | null>(null);
  const projectedRow = rows.find((r) => r.isMondayProjected && r.mondayProjection);
  const clockState = useSystemClock();

  const handleStartEditTrx = (weekKey: string, currentVal: number | null) => {
    setEditingTrxKey(weekKey);
    setEditTrxValue(currentVal !== null ? String(currentVal) : '');
  };

  const handleSaveTrx = async (weekKey: string) => {
    const val = editTrxValue.trim() === '' ? null : Number(editTrxValue);
    await onSaveTrx(weekKey, isNaN(val as number) ? null : val);
    setEditingTrxKey(null);
  };

  const handleStartEditSched = (weekKey: string, currentVal: number | null) => {
    setEditingSchedKey(weekKey);
    setEditSchedValue(currentVal !== null ? String(currentVal) : '');
  };

  const handleSaveSched = async (weekKey: string) => {
    if (!onSaveScheduledHours) return;
    const val = editSchedValue.trim() === '' ? null : Number(editSchedValue);
    await onSaveScheduledHours(weekKey, isNaN(val as number) ? null : val);
    setEditingSchedKey(null);
  };

  return (
    <div className="bg-white border border-[#E2E8E5] rounded-2xl shadow-xs overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-[#E2E8E5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        <div>
          <h3 className="text-base font-black text-[#1E3932] tracking-tight flex items-center gap-2">
            Harmonogram i Bilans Tygodniowy (W1 – W{rows.length})
          </h3>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Tygodnie niepełne są automatycznie przeliczane według kalendarza Wt–Pn. Kliknij pole <strong>Act TRX</strong> lub <strong>Grafik (h)</strong>, aby wprowadzić dane.
          </p>
        </div>

        {/* Wskaźnik cyklu operacyjnego: Poniedziałek vs Wtorek */}
        <div className="flex items-center gap-2 shrink-0">
          {clockState.dayOfWeek === 'Pn' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 shadow-2xs">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <div className="text-left sm:text-right">
                <div className="text-[11px] font-black uppercase tracking-wider text-purple-900">
                  Dziś Poniedziałek
                </div>
                <div className="text-[10px] text-purple-700 font-medium">
                  Planowanie W+2 & Flash Forecast
                </div>
              </div>
            </div>
          ) : clockState.dayOfWeek === 'Wt' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-2xs">
              <CalendarDays className="w-4 h-4 text-[#006241] shrink-0" />
              <div className="text-left sm:text-right">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#006241]">
                  Dziś Wtorek
                </div>
                <div className="text-[10px] text-[#00754A] font-medium">
                  Nowy tydzień & Pełne 7 dni Fichajes
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-700 shadow-2xs">
              <Clock className="w-4 h-4 text-stone-500 shrink-0" />
              <div className="text-left sm:text-right">
                <div className="text-[11px] font-black uppercase tracking-wider text-stone-800">
                  Dziś {clockState.dayOfWeekFull}
                </div>
                <div className="text-[10px] text-stone-500 font-medium">
                  Tydzień w toku (do Pn)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Baner Flash Forecast dla poniedziałku */}
      {projectedRow && projectedRow.mondayProjection && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-gradient-to-r from-purple-50 via-indigo-50/70 to-emerald-50 border border-purple-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-300">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-purple-900 bg-purple-100 border border-purple-300 px-2 py-0.5 rounded-md">
                  ⚡ Flash Forecast Poniedziałku ({projectedRow.mondayProjection.date})
                </span>
                <span className="text-[11px] font-bold text-stone-600">
                  Tydzień {projectedRow.week.week_num_in_month} kończy się dzisiaj
                </span>
              </div>
              <p className="text-xs text-stone-700 mt-1 leading-relaxed">
                System zamknął estymację dzisiejszego dnia: <strong>+{projectedRow.mondayProjection.projectedTotalMondayHours}h</strong> (MGR z Modułu 2: <strong>{projectedRow.mondayProjection.projectedMgrHours}h</strong> + barisci do celu tygodnia: <strong>{projectedRow.mondayProjection.projectedBaristaHours}h</strong>) oraz transakcje: <strong>+{projectedRow.mondayProjection.projectedMondayTrx} TRX</strong>.
                Dzięki temu MTD i rekomendacja HANW na W+2 są natychmiast odblokowane.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <button
              onClick={() => setSelectedProjectionRow(projectedRow)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-purple-100/80 text-purple-800 border border-purple-300 text-xs font-bold transition-all shadow-2xs hover:shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-purple-600" />
              <span>Szczegóły estymacji</span>
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#F4F7F5] text-[#006241] uppercase font-black tracking-wider border-b border-[#E2E8E5] select-none">
              <th className="py-3 px-4">Tydz. & Status</th>
              <th className="py-3 px-4">Daty</th>
              <th className="py-3 px-3 text-center">Dni</th>
              <th className="py-3 px-4">Struktura Tygodnia</th>
              <th className="py-3 px-4 text-right">Plan TRX</th>
              <th className="py-3 px-4 text-right font-black text-[#006241]">Act TRX</th>
              <th className="py-3 px-4 text-right">Plan Godz.</th>
              <th className="py-3 px-4 text-right font-black text-[#0284C7]">Act RCP (h)</th>
              <th className="py-3 px-4 text-right font-black text-[#6366F1]">Grafik (h)</th>
              <th className="py-3 px-3 text-right">Plan TPLH</th>
              <th className="py-3 px-3 text-right">Act TPLH</th>
              <th className="py-3 px-4 text-right text-[#006241] font-black">HANW Rekomendacja</th>
              <th className="py-2 px-3 text-center">
                <div className="flex flex-col items-center justify-center gap-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#006241]">
                    Logowania
                  </span>
                  <button
                    onClick={() => {
                      if (onViewMonthLaborDetails) {
                        onViewMonthLaborDetails();
                      } else if (rows.length > 0) {
                        onViewLaborDetails(
                          `${rows[0].week.year}_${rows[0].week.month_name}`,
                          `Cały miesiąc: ${rows[0].week.month_name} ${rows[0].week.year}`
                        );
                      }
                    }}
                    title={`Ewidencja i suma wszystkich zmian w miesiącu (${rows[0]?.week.month_name || ''} ${rows[0]?.week.year || ''})`}
                    className="p-1.5 rounded-lg bg-white hover:bg-[#E8F5E9] text-[#006241] border border-[#D0DCD6] hover:border-[#006241] shadow-2xs hover:shadow-xs transition-all inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase text-[#006241]">
                      Miesiąc
                    </span>
                  </button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF2F0]">
            {rows.map((r) => {
              const isEditingTrx = editingTrxKey === r.week.week_key;
              const isEditingSched = editingSchedKey === r.week.week_key;

              // Wyróżnienie tła wiersza w zależności od roli w cyklu operacyjnym
              let rowBg = 'bg-white';
              if (r.status === 'target_planning') {
                rowBg = 'bg-[#F0FDF4]/80 border-l-4 border-[#006241]';
              } else if (r.status === 'published') {
                rowBg = 'bg-[#EFF6FF]/60 border-l-4 border-[#3B82F6]';
              } else if (r.status === 'current') {
                rowBg = 'bg-[#FEFCE8]/70 border-l-4 border-[#F59E0B]';
              } else if (r.status === 'closed') {
                rowBg = 'bg-[#F8FAF9]';
              }

              return (
                <tr
                  key={r.week.week_key}
                  className={`transition-colors hover:bg-[#F2F7F4] ${rowBg}`}
                >
                  {/* Tydzień & Status */}
                  <td className="py-3.5 px-4 font-bold text-[#1E3932]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectTargetWeek && onSelectTargetWeek(r.week.week_key)}
                        title={
                          r.status === 'target_planning'
                            ? 'Aktualny cel rekomendacji HANW'
                            : 'Kliknij, aby przeliczyć HANW dla tego tygodnia'
                        }
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-all ${
                          r.status === 'target_planning'
                            ? 'bg-[#006241] text-white shadow-xs scale-105 ring-2 ring-[#006241]/30'
                            : r.status === 'published'
                            ? 'bg-[#DBEAFE] text-[#1D4ED8] border border-[#BFDBFE]'
                            : r.status === 'current'
                            ? 'bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]'
                            : r.status === 'closed'
                            ? 'bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]'
                            : 'bg-[#F0F4F2] text-[#5C6F68] hover:bg-gray-200'
                        }`}
                      >
                        {r.week.week_num_in_month}
                      </button>

                      <div className="flex flex-col">
                        {r.status === 'target_planning' && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black text-[#006241] px-1.5 py-0.5 rounded bg-[#DCFCE7] border border-[#86EFAC]">
                            <Target className="w-2.5 h-2.5 text-[#006241]" />
                            Cel HANW
                          </span>
                        )}
                        {r.status === 'published' && (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black text-[#1D4ED8] px-1.5 py-0.5 rounded bg-[#DBEAFE] border border-[#BFDBFE]">
                              <Clock className="w-2.5 h-2.5 text-[#1D4ED8]" />
                              Od jutra (W+1)
                            </span>
                            <span className="text-[9px] text-blue-700 font-bold mt-0.5 flex items-center gap-0.5" title="Możesz w każdej chwili modyfikować obsadę baristów">
                              <Edit3 className="w-2.5 h-2.5 text-blue-600" />
                              Edycja baristów
                            </span>
                          </div>
                        )}
                        {r.status === 'current' && (
                          <div className="flex flex-col">
                            <span
                              className="inline-flex items-center gap-1 text-[10px] uppercase font-black text-[#B45309] px-1.5 py-0.5 rounded bg-[#FEF3C7] border border-[#FDE68A]"
                              title={r.dataCompletionNotice || 'Grafik trwa do 14.09. Dane cząstkowe.'}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] animate-pulse" />
                              Bieżący (w toku)
                            </span>
                            <span className="text-[9px] text-[#B45309] font-semibold mt-0.5">
                              Rozliczenie w pon.
                            </span>
                          </div>
                        )}
                        {r.status === 'closed' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#006241] px-1.5 py-0.5 rounded bg-[#E8F5E9]">
                            <CheckCircle2 className="w-2.5 h-2.5 text-[#006241]" />
                            Zamknięty
                          </span>
                        )}
                        {r.status === 'future' && (
                          <span className="text-[10px] font-medium text-gray-400">
                            Przyszły
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Daty */}
                  <td className="py-3.5 px-4 font-semibold text-[#2D3748]">
                    {r.week.date_from} – {r.week.date_to}
                  </td>

                  {/* Dni */}
                  <td className="py-3.5 px-3 text-center">
                    <span className="font-extrabold text-[#1E3932] text-sm">
                      {r.calculatedDaysCount}
                    </span>
                    <span className="text-[10px] text-[#5C6F68] block">dni</span>
                  </td>

                  {/* Struktura Tygodnia (Typ + godziny na dzień + Extra zmiany) */}
                  <td className="py-3.5 px-4">
                    {r.isPartial ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            Niepełny ({r.calculatedDaysCount}d)
                          </span>
                        </div>
                        {/* Godziny na dzień dla niepełnego tygodnia */}
                        {r.activeDayNames.length > 0 && (() => {
                          const daysCount = r.calculatedDaysCount > 0 ? r.calculatedDaysCount : 1;
                          const avgPerDay = Number((r.planHours / daysCount).toFixed(1));
                          const extraPerDay = Number((avgPerDay - 32).toFixed(1));
                          return (
                            <div className="space-y-0.5">
                              <div className="text-[10px] text-[#5C6F68] font-medium">
                                Dni: <strong>{r.activeDayNames.join(', ')}</strong>
                              </div>
                              <div className="text-[10px] text-[#5C6F68]">
                                Śr. {avgPerDay}h/dzień (floor: 32h)
                              </div>
                              <div className={`text-[10px] font-bold flex items-center gap-1 whitespace-nowrap ${extraPerDay > 0 ? 'text-[#006241]' : extraPerDay < 0 ? 'text-[#DC2626]' : 'text-[#5C6F68]'}`}>
                                🧑‍🤝‍🧑 Extra: <strong>{extraPerDay > 0 ? `+${extraPerDay}` : extraPerDay} h/dzień</strong>
                              </div>
                              {onViewManagerBridge && (
                                <button
                                  type="button"
                                  onClick={() => onViewManagerBridge(r)}
                                  className="mt-1 px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[9px] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                                  title="Zobacz jak manipulować zmianami w poszczególne dni wg trendu AI"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                                  <span>Flex: +{r.flexHoursPool ?? Math.max(0, Number(((r.hanwRecommendation ?? r.planHours) - (r.calculatedDaysCount * 32)).toFixed(1)))}h (Dni & AI)</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E8ECE9] text-[#2D3748]">
                          Pełny (7 dni)
                        </span>
                        {(() => {
                          const avgPerDay = Number((r.planHours / 7).toFixed(1));
                          const extraPerDay = Number((avgPerDay - 32).toFixed(1));
                          return (
                            <div className="space-y-0.5 mt-0.5">
                              <div className="text-[10px] text-[#5C6F68]">
                                Śr. {avgPerDay}h/dzień (floor: 32h)
                              </div>
                              <div className={`text-[10px] font-bold flex items-center gap-1 whitespace-nowrap ${extraPerDay > 0 ? 'text-[#006241]' : extraPerDay < 0 ? 'text-[#DC2626]' : 'text-[#5C6F68]'}`}>
                                🧑‍🤝‍🧑 Extra: <strong>{extraPerDay > 0 ? `+${extraPerDay}` : extraPerDay} h/dzień</strong>
                              </div>
                              {onViewManagerBridge && (
                                <button
                                  type="button"
                                  onClick={() => onViewManagerBridge(r)}
                                  className="mt-1 px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-[9px] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                                  title="Zobacz jak manipulować zmianami w poszczególne dni wg trendu AI"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                                  <span>Flex: +{r.flexHoursPool ?? Math.max(0, Number(((r.hanwRecommendation ?? r.planHours) - (r.calculatedDaysCount * 32)).toFixed(1)))}h (Dni & AI)</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </td>

                  {/* Plan TRX */}
                  <td className="py-3.5 px-4 text-right font-medium text-[#2D3748]">
                    {r.planTrx.toLocaleString('pl-PL')}
                  </td>

                  {/* Act TRX (Edytowalne) */}
                  <td className="py-3.5 px-4 text-right font-black">
                    {isEditingTrx ? (
                      <div className="flex items-center justify-end space-x-1">
                        <input
                          type="number"
                          autoFocus
                          value={editTrxValue}
                          onChange={(e) => setEditTrxValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTrx(r.week.week_key);
                            if (e.key === 'Escape') setEditingTrxKey(null);
                          }}
                          onBlur={() => handleSaveTrx(r.week.week_key)}
                          className="w-20 px-2 py-1 bg-white border-2 border-[#006241] rounded-lg text-right text-[#1E3932] font-black text-xs focus:outline-none shadow-xs"
                          placeholder="TRX..."
                        />
                        <button
                          onClick={() => handleSaveTrx(r.week.week_key)}
                          className="p-1 rounded-md bg-[#006241] hover:bg-[#00754A] text-white shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : r.isMondayProjected && r.mondayProjection ? (
                      <div
                        onClick={() => setSelectedProjectionRow(r)}
                        className="cursor-pointer group flex flex-col items-end py-1 px-2 rounded-lg hover:bg-purple-50/70 border border-transparent hover:border-purple-300 transition-all"
                        title="Flash Forecast: Kliknij, aby otworzyć szczegóły lub dostosować TRX z 6 dni"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-purple-900 font-black">
                            {r.actualTrx?.toLocaleString('pl-PL')}
                          </span>
                          <span className="text-[9px] text-purple-700 bg-purple-100 border border-purple-300 px-1 py-0.2 rounded font-bold shadow-2xs">
                            🔮 Pn est.
                          </span>
                          <Edit3 className="w-3 h-3 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="text-[8.5px] text-stone-400 font-medium">
                          {r.mondayProjection.actualTrxDays1to6 ? `${r.mondayProjection.actualTrxDays1to6} + ${r.mondayProjection.projectedMondayTrx}` : `plan: ${r.planTrx}`}
                        </span>
                      </div>
                    ) : (
                      <div
                        onClick={() => handleStartEditTrx(r.week.week_key, r.actualTrx)}
                        className="cursor-pointer group flex items-center justify-end gap-1.5 py-1 px-2 rounded-lg hover:bg-white hover:border-[#006241] border border-transparent transition-all"
                        title="Kliknij, aby edytować TRX"
                      >
                        {r.actualTrx ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[#006241] font-black">
                              {r.actualTrx.toLocaleString('pl-PL')}
                            </span>
                            {r.isInProgress && (
                              <span className="text-[9px] text-[#B45309] bg-[#FEF3C7] px-1 rounded font-bold border border-[#FDE68A]">
                                cząstkowe
                              </span>
                            )}
                          </div>
                        ) : r.isInProgress ? (
                          <span className="text-[10px] text-[#B45309] italic bg-[#FEF3C7]/60 px-1.5 py-0.5 rounded border border-[#FDE68A]" title="Pełne dane spłyną w poniedziałek">
                            w toku (do Pn)
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">—</span>
                        )}
                        <Edit3 className="w-3 h-3 text-[#5C6F68] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                  </td>

                  {/* Plan Godziny */}
                  <td className="py-3.5 px-4 text-right font-medium text-[#2D3748]">
                    {r.planHours.toFixed(1)} h
                  </td>

                  {/* Act Godziny (RCP z MAPAL) */}
                  <td className="py-3.5 px-4 text-right font-black">
                    {r.isMondayProjected && r.mondayProjection ? (
                      <div
                        onClick={() => setSelectedProjectionRow(r)}
                        className="flex flex-col items-end cursor-pointer group/mon py-1 px-1.5 rounded-lg hover:bg-purple-50/70 border border-transparent hover:border-purple-300 transition-all"
                        title="Flash Forecast: Kliknij, aby zobaczyć pełne rozbicie godzin poniedziałku"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-purple-900 font-black">{r.actualHours?.toFixed(1)} h</span>
                          <span className="text-[9px] text-purple-700 bg-purple-100 border border-purple-300 px-1.5 py-0.2 rounded font-bold shadow-2xs">
                            🔮 +{r.mondayProjection.projectedTotalMondayHours}h est.
                          </span>
                        </div>
                        <span className="text-[8.5px] text-stone-400 font-medium mt-0.5">
                          ({r.mondayProjection.loggedHoursDays1to6}h + {r.mondayProjection.projectedTotalMondayHours}h)
                        </span>
                      </div>
                    ) : r.actualHours !== null && r.actualHours > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="text-[#0284C7]">{r.actualHours.toFixed(1)} h</span>
                        {r.isInProgress && (
                          <span
                            className="text-[9px] text-[#B45309] bg-[#FEF3C7] px-1 rounded font-bold border border-[#FDE68A] mt-0.5"
                            title={r.dataCompletionNotice || 'Trwający tydzień — logowania cząstkowe. Pełne rozliczenie w poniedziałek.'}
                          >
                            w toku (cząstkowe)
                          </span>
                        )}
                      </div>
                    ) : r.isInProgress ? (
                      <span className="text-[10px] text-[#B45309] italic bg-[#FEF3C7]/60 px-1.5 py-0.5 rounded border border-[#FDE68A]">
                        w toku (do Pn)
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Grafik (Scheduled Hours - Wprowadzany przez SM z podziałem MGR + Barista) */}
                  <td className="py-3.5 px-4 text-right font-black">
                    {isEditingSched ? (
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center justify-end space-x-1">
                          <input
                            type="number"
                            step="0.5"
                            autoFocus
                            value={editSchedValue}
                            onChange={(e) => setEditSchedValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveSched(r.week.week_key);
                              if (e.key === 'Escape') setEditingSchedKey(null);
                            }}
                            onBlur={() => handleSaveSched(r.week.week_key)}
                            className="w-20 px-2 py-1 bg-white border-2 border-[#6366F1] rounded-lg text-right text-[#1E3932] font-black text-xs focus:outline-none shadow-xs"
                            placeholder="Godziny..."
                          />
                          <button
                            onClick={() => handleSaveSched(r.week.week_key)}
                            className="p-1 rounded-md bg-[#6366F1] hover:bg-[#4F46E5] text-white shadow-xs cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Weryfikacja na żywo w trakcie wpisywania */}
                        {(() => {
                          const typedVal = parseFloat(editSchedValue);
                          const target = r.hanwRecommendation ?? r.planHours;
                          if (isNaN(typedVal) || !target) return null;
                          const diff = Number((typedVal - target).toFixed(1));
                          const barPool = r.managerHours ? Number((typedVal - r.managerHours).toFixed(1)) : null;

                          return (
                            <div className="flex flex-col items-end gap-0.5 mt-0.5">
                              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${
                                diff <= 0
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : 'bg-rose-100 text-rose-900 border-rose-300'
                              }`}>
                                {diff === 0
                                  ? '🎯 W celu (±0h)'
                                  : diff > 0
                                  ? `⚠️ +${diff}h ponad cel`
                                  : `✅ ${diff}h (zapas)`}
                              </span>
                              {barPool !== null && (
                                <span className="text-[9px] text-stone-600 font-bold">
                                  Barisci: <strong className={barPool >= 0 ? 'text-indigo-700 font-black' : 'text-rose-700 font-black'}>{barPool}h</strong>
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        {r.managerHours !== undefined && r.managerHours > 0 && (
                          <div className="flex items-center gap-1 text-[9px] text-stone-500">
                            <span>MGR: <strong>{r.managerHours.toFixed(1)}h</strong></span>
                            <span>•</span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const curr = parseFloat(editSchedValue) || 0;
                                setEditSchedValue((curr + r.managerHours!).toFixed(1));
                              }}
                              className="text-indigo-600 hover:text-indigo-800 underline font-semibold cursor-pointer"
                              title="Dodaj zaplanowane godziny kierowników do wpisanych godzin baristów"
                            >
                              + Dodaj MGR
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={() => handleStartEditSched(r.week.week_key, r.scheduledHours)}
                        className={`cursor-pointer group flex items-center justify-end gap-1.5 py-1 px-2 rounded-lg transition-all ${
                          r.status === 'published'
                            ? 'bg-[#EFF6FF] border border-[#BFDBFE] hover:border-[#3B82F6]'
                            : r.status === 'target_planning'
                            ? 'bg-emerald-50/70 border border-emerald-200 hover:border-emerald-400'
                            : 'hover:bg-white hover:border-[#6366F1] border border-transparent'
                        }`}
                        title={
                          r.status === 'published'
                            ? 'Kliknij, aby zmodyfikować godziny baristów na tydzień od jutra (automatycznie przelicza cel W+2)'
                            : r.status === 'target_planning'
                            ? 'Kliknij, aby wpisać zaplanowany grafik na 22.09 — system natychmiast go zweryfikuje'
                            : 'Kliknij, aby zapisać ułożony grafik (Scheduled Hours)'
                        }
                      >
                        {r.scheduledHours !== null && r.scheduledHours > 0 ? (
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1.5">
                              {(() => {
                                const target = r.hanwRecommendation ?? r.planHours;
                                if (!target) return null;
                                const diff = Number((r.scheduledHours - target).toFixed(1));
                                return (
                                  <span
                                    className={`text-[9px] font-black px-1.5 py-0.2 rounded-md border ${
                                      diff <= 0
                                        ? diff === 0
                                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                          : 'bg-teal-50 text-teal-800 border-teal-200'
                                        : 'bg-rose-100 text-rose-900 border-rose-300'
                                    }`}
                                    title={`Cel HANW: ${target.toFixed(1)}h | Różnica: ${diff > 0 ? `+${diff}` : diff}h`}
                                  >
                                    {diff === 0 ? '🎯 W celu' : diff > 0 ? `⚠️ +${diff}h` : `✅ ${diff}h`}
                                  </span>
                                );
                              })()}
                              <span className="text-[#4338CA] font-black">
                                {r.scheduledHours.toFixed(1)} h
                              </span>
                            </div>
                            {r.managerHours !== undefined && r.managerHours > 0 && (
                              <div className="flex items-center gap-1 text-[9px] mt-0.5 whitespace-nowrap">
                                <span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold" title="Godziny kadry kierowniczej na Janki">
                                  MGR {r.managerHours.toFixed(1)}h
                                </span>
                                <span>+</span>
                                <span className="px-1 py-0.2 rounded bg-indigo-100 text-indigo-800 font-bold" title="Godziny rozpisane dla baristów">
                                  BAR {typeof r.baristaScheduledHours === 'number' ? `${r.baristaScheduledHours.toFixed(1)}h` : '0h'}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className={r.status === 'published' ? 'text-[#3B82F6] font-bold' : 'text-gray-400 italic'}>
                              {r.status === 'published' ? 'wpisz...' : '—'}
                            </span>
                            {r.managerHours !== undefined && r.managerHours > 0 && (
                              <span className="text-[9px] text-emerald-700 font-semibold mt-0.5" title="Menedżerowie mają już zaplanowane godziny w grafiku">
                                MGR: {r.managerHours.toFixed(1)}h
                              </span>
                            )}
                          </div>
                        )}
                        <Edit3 className="w-3 h-3 text-[#5C6F68] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                  </td>

                  {/* Plan TPLH */}
                  <td className="py-3.5 px-3 text-right text-[#5C6F68] font-bold">
                    {r.planTplh.toFixed(2)}
                  </td>

                  {/* Act TPLH */}
                  <td className="py-3.5 px-3 text-right font-black">
                    {r.actualTplh !== null ? (
                      <span
                        className={
                          r.actualTplh >= r.planTplh ? 'text-[#006241]' : 'text-[#B45309]'
                        }
                      >
                        {r.actualTplh.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Rekomendacja HANW & Pula Baristów */}
                  <td className="py-3.5 px-4 text-right font-black">
                    {r.hanwRecommendation !== null ? (
                      <div className="flex flex-col items-end">
                        <span
                          className={`px-2.5 py-1 rounded-full font-black ${
                            r.status === 'target_planning'
                              ? 'bg-[#006241] text-white shadow-xs'
                              : 'text-[#006241] bg-[#E8F5E9] border border-[#C8E6C9]'
                          }`}
                        >
                          {r.hanwRecommendation.toFixed(1)} h
                        </span>
                        {r.status === 'target_planning' && (
                          <span className="text-[9px] text-[#006241] font-bold mt-0.5 uppercase tracking-tight">
                            🎯 Cel grafiku
                          </span>
                        )}
                        {r.baristaHoursPool !== undefined && r.baristaHoursPool !== null && (
                          <div
                            className="flex items-center gap-1 text-[9px] mt-1 whitespace-nowrap bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                            title="Rekomendowana pula godzin pozostała dla baristów po odliczeniu menedżerów"
                          >
                            <span className="text-emerald-800 font-normal">Pula BAR:</span>
                            <span className="text-emerald-950 font-black">
                              {r.baristaHoursPool.toFixed(1)} h
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Akcje: Ewidencja MAPAL & Inspekcja Obsady Menedżerskiej (Floor 32h) */}
                  <td className="py-3.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {onViewManagerBridge && (
                        <button
                          onClick={() => onViewManagerBridge(r)}
                          title={`Manipulacja zmianami i dobowy rozkład dni wg trendu AI (${r.week.week_num_in_month}): Baza Floor ${r.totalBaseFloorHours || (r.calculatedDaysCount * 32)}h + Flex +${r.flexHoursPool || 0}h`}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#006241] border border-emerald-300 shadow-2xs hover:shadow-xs transition-all inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[9px] font-black uppercase text-[#006241]">
                            FLEX AI
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() =>
                          onViewLaborDetails(
                            r.week.week_key,
                            `${r.week.month_name} ${r.week.week_num_in_month}`
                          )
                        }
                        title="Podgląd godzin i logowań pracowników (MAPAL)"
                        className="p-1.5 rounded-lg bg-white hover:bg-[#E8F5E9] text-[#006241] border border-[#D0DCD6] hover:border-[#006241] shadow-xs transition-colors inline-flex items-center cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#F8FAF9] border-t-2 border-[#D0DCD6] font-black text-xs text-[#1E3932]">
              <td className="py-3 px-4 uppercase text-[#006241]" colSpan={4}>
                Podsumowanie Miesiąca
              </td>
              <td className="py-3 px-4 text-right">
                {rows.reduce((s, r) => s + r.planTrx, 0).toLocaleString('pl-PL')}
              </td>
              <td className="py-3 px-4 text-right text-[#006241]">
                {rows.some((r) => r.actualTrx)
                  ? rows.reduce((s, r) => s + (r.actualTrx || 0), 0).toLocaleString('pl-PL')
                  : '—'}
              </td>
              <td className="py-3 px-4 text-right">
                {rows.reduce((s, r) => s + r.planHours, 0).toFixed(1)} h
              </td>
              <td className="py-3 px-4 text-right text-[#0284C7]">
                {rows.reduce((s, r) => s + (r.actualHours || 0), 0).toFixed(1)} h
              </td>
              <td className="py-3 px-4 text-right text-[#6366F1]">
                {rows.some((r) => r.scheduledHours) ? (
                  <div className="flex flex-col items-end">
                    <span>{rows.reduce((s, r) => s + (r.scheduledHours || 0), 0).toFixed(1)} h</span>
                    {rows.some(r => (r.managerHours || 0) > 0) && (
                      <span className="text-[9px] text-[#006241] font-semibold">
                        MGR: {rows.reduce((s, r) => s + (r.managerHours || 0), 0).toFixed(1)}h
                      </span>
                    )}
                  </div>
                ) : rows.some(r => (r.managerHours || 0) > 0) ? (
                  <span className="text-[10px] text-[#006241] font-bold">
                    MGR {rows.reduce((s, r) => s + (r.managerHours || 0), 0).toFixed(1)}h
                  </span>
                ) : '—'}
              </td>
              <td className="py-3 px-3 text-right text-[#5C6F68]">
                {(() => {
                  const totalPlanTrx = rows.reduce((s, r) => s + r.planTrx, 0);
                  const totalPlanH = rows.reduce((s, r) => s + r.planHours, 0);
                  return totalPlanH > 0 ? (totalPlanTrx / totalPlanH).toFixed(2) : '—';
                })()}
              </td>
              <td className="py-3 px-3 text-right text-[#006241]">
                {(() => {
                  const totalActTrx = rows.reduce((s, r) => s + (r.actualTrx || 0), 0);
                  const totalActH = rows.reduce((s, r) => s + (r.actualHours || 0), 0);
                  return totalActH > 0 && totalActTrx > 0 ? (totalActTrx / totalActH).toFixed(2) : '—';
                })()}
              </td>
              <td className="py-3 px-4 text-right">
                {rows.some(r => (r.baristaHoursPool || 0) > 0) ? (
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-stone-400 font-normal uppercase">Suma Baristów</span>
                    <span className="text-emerald-950 font-black">
                      {rows.reduce((s, r) => s + (r.baristaHoursPool || 0), 0).toFixed(1)} h
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="py-3 px-3 text-center">
                <button
                  onClick={() => {
                    if (onViewMonthLaborDetails) {
                      onViewMonthLaborDetails();
                    } else if (rows.length > 0) {
                      onViewLaborDetails(
                        `${rows[0].week.year}_${rows[0].week.month_name}`,
                        `Cały miesiąc: ${rows[0].week.month_name} ${rows[0].week.year}`
                      );
                    }
                  }}
                  title="Wszystkie logowania i zmiany w miesiącu"
                  className="p-1.5 rounded-lg bg-white hover:bg-[#E8F5E9] text-[#006241] border border-[#D0DCD6] hover:border-[#006241] shadow-xs transition-colors inline-flex items-center cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Modal szczegółów Flash Forecast dla poniedziałku */}
      {selectedProjectionRow && selectedProjectionRow.mondayProjection && (
        <MondayProjectionModal
          isOpen={Boolean(selectedProjectionRow)}
          onClose={() => setSelectedProjectionRow(null)}
          row={selectedProjectionRow}
          onSaveTrx={onSaveTrx}
          onSaveScheduledHours={onSaveScheduledHours}
        />
      )}
    </div>
  );
};
