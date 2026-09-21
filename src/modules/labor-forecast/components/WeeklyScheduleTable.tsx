import React, { useState } from 'react';
import {
  Users,
  Edit3,
  Check,
  CalendarDays,
  Info,
  Clock,
  Target,
  CheckCircle2,
  ShieldCheck,
  Layers,
  Sparkles,
  CalendarRange
} from 'lucide-react';
import { WeeklyCalculatedRow, CrossMonthBridge } from '../../../types';
import { MondayProjectionModal } from './MondayProjectionModal';
import { useSystemClock } from '../../../hooks/useSystemClock';
import { CalculationEngine } from '../services/calculationEngine';

interface WeeklyScheduleTableProps {
  rows: WeeklyCalculatedRow[];
  crossMonthBridge?: CrossMonthBridge | null;
  onNavigateMonth?: (monthName: string, year: number) => void;
  onSaveTrx: (weekKey: string, trx: number | null) => Promise<void>;
  onSaveScheduledHours?: (weekKey: string, hours: number | null) => Promise<void>;
  onSelectTargetWeek?: (weekKey: string) => void;
  onViewLaborDetails: (weekKey: string, weekLabel: string) => void;
  onViewMonthLaborDetails?: () => void;
  onViewManagerBridge?: (row: WeeklyCalculatedRow) => void;
}

export const WeeklyScheduleTable: React.FC<WeeklyScheduleTableProps> = ({
  rows,
  crossMonthBridge,
  onNavigateMonth,
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
  const [expandedWeekKey, setExpandedWeekKey] = useState<string | null>(null);
  const projectedRow = rows.find((r) => r.isMondayProjected && r.mondayProjection);
  const clockState = useSystemClock();

  // Stan wprowadzonych godzin dobowych baristów per tydzień i per dzień
  // klucz: `${weekKey}_${day}` -> number
  const [dailyBaristaHours, setDailyBaristaHours] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('sbux_daily_barista_hours');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const saveDailyBaristaHours = (newMap: Record<string, number>) => {
    setDailyBaristaHours(newMap);
    try {
      localStorage.setItem('sbux_daily_barista_hours', JSON.stringify(newMap));
    } catch (e) {
      console.error(e);
    }
  };

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

    // Jeśli wprowadzono sumę, automatycznie rozdziel ją na dni wg trendu AI
    if (val && val > 0) {
      const row = rows.find(r => r.week.week_key === weekKey);
      if (row) {
        const rawDays = row.managerDailyCoverage || [];
        if (rawDays.length > 0) {
          const flexInfo = CalculationEngine.enrichDailyCoverageWithFlex(rawDays, val);
          const newDailyMap = { ...dailyBaristaHours };
          flexInfo.enrichedDays.forEach(d => {
            const dayKey = `${weekKey}_${d.day}`;
            newDailyMap[dayKey] = d.suggestedBaristaHours || 0;
          });
          saveDailyBaristaHours(newDailyMap);
        }
      }
    }
    setEditingSchedKey(null);
  };

  // Zmiana godzin baristów dla konkretnego dnia
  const handleDayBaristaChange = async (
    weekKey: string,
    dayNum: number,
    newBaristaHours: number,
    daysList: any[]
  ) => {
    const dayKey = `${weekKey}_${dayNum}`;
    const newMap = { ...dailyBaristaHours, [dayKey]: Math.max(0, newBaristaHours) };
    saveDailyBaristaHours(newMap);

    // Przelicz nową sumę tygodnia
    let totalWeekHours = 0;
    daysList.forEach((d) => {
      const dKey = `${weekKey}_${d.day}`;
      const bHours = d.day === dayNum ? Math.max(0, newBaristaHours) : (newMap[dKey] !== undefined ? newMap[dKey] : (d.suggestedBaristaHours || 0));
      const mHours = d.coverageHours || 0;
      totalWeekHours += (mHours + bHours);
    });

    if (onSaveScheduledHours) {
      await onSaveScheduledHours(weekKey, Number(totalWeekHours.toFixed(1)));
    }
  };

  // Rozdzielenie sumy wg trendu AI
  const handleDistributeByTrend = async (weekKey: string, targetTotal: number, daysList: any[]) => {
    const flexInfo = CalculationEngine.enrichDailyCoverageWithFlex(daysList, targetTotal);
    const newDailyMap = { ...dailyBaristaHours };
    flexInfo.enrichedDays.forEach(d => {
      const dayKey = `${weekKey}_${d.day}`;
      newDailyMap[dayKey] = d.suggestedBaristaHours || 0;
    });
    saveDailyBaristaHours(newDailyMap);

    if (onSaveScheduledHours) {
      await onSaveScheduledHours(weekKey, Number(targetTotal.toFixed(1)));
    }
  };

  // Rozdzielenie sumy po równo
  const handleDistributeEvenly = async (weekKey: string, targetTotal: number, daysList: any[]) => {
    const totalMgr = daysList.reduce((sum, d) => sum + (d.coverageHours || 0), 0);
    const baristaPool = Math.max(0, targetTotal - totalMgr);
    const count = daysList.length || 7;
    const perDay = Number((baristaPool / count).toFixed(1));

    const newDailyMap = { ...dailyBaristaHours };
    daysList.forEach((d) => {
      const dayKey = `${weekKey}_${d.day}`;
      newDailyMap[dayKey] = perDay;
    });
    saveDailyBaristaHours(newDailyMap);

    if (onSaveScheduledHours) {
      await onSaveScheduledHours(weekKey, Number(targetTotal.toFixed(1)));
    }
  };

  return (
    <div className="bg-white border border-[#E2E8E5] rounded-2xl shadow-xs overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-[#E2E8E5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        <div>
          <h3 className="text-base font-black text-[#1E3932] tracking-tight flex items-center gap-2">
            Harmonogram i Bilans Tygodniowy (W1 – W{rows.length}{crossMonthBridge ? ` + ${crossMonthBridge.partAdjacentMonth.weekNum}` : ''})
          </h3>
          <p className="text-xs text-[#5C6F68] mt-0.5">
            Tygodnie niepełne na przełomie miesięcy są automatycznie scalane w 7-dniowy grafik operacyjny ({crossMonthBridge ? `${crossMonthBridge.partCurrentMonth.weekNum}+${crossMonthBridge.partAdjacentMonth.weekNum}` : 'Wt–Pn'}). Kliknij pole <strong>Act TRX</strong> lub <strong>Grafik (h)</strong>, aby wprowadzić dane.
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
              <th className="py-3 px-4 text-right">Plan TRX</th>
              <th className="py-3 px-4 text-right font-black text-[#006241]">Act TRX</th>
              <th className="py-3 px-4 text-right">Plan Godz.</th>
              <th className="py-3 px-4 text-right font-black text-[#0284C7]">Act RCP (h)</th>
              <th className="py-3 px-4 text-right font-black text-[#6366F1]">Grafik (h)</th>
              <th className="py-3 px-3 text-right">Plan TPLH</th>
              <th className="py-3 px-3 text-right">Act TPLH</th>
              <th className="py-3 px-4 text-right text-[#006241] font-black" title="Inteligentny Plan Godzin (HANW & Trend AI)">H Plan</th>
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

              // Sprawdzenie czy ten wiersz jest połączonym przełomem miesięcy W5+W1
              const isBridgeRow = Boolean(
                crossMonthBridge &&
                (crossMonthBridge.partCurrentMonth.weekNum === r.week.week_num_in_month ||
                 crossMonthBridge.partCurrentMonth.weekKey === r.week.week_key)
              );

              // Wyróżnienie tła wiersza w zależności od roli w cyklu operacyjnym
              let rowBg = 'bg-white';
              if (isBridgeRow) {
                rowBg = 'bg-gradient-to-r from-emerald-50/50 via-white to-blue-50/40 border-l-4 border-[#006241]';
              } else if (r.status === 'target_planning') {
                rowBg = 'bg-[#F0FDF4]/80 border-l-4 border-[#006241]';
              } else if (r.status === 'published') {
                rowBg = 'bg-[#EFF6FF]/60 border-l-4 border-[#3B82F6]';
              } else if (r.status === 'closed') {
                rowBg = 'bg-[#F8FAF9]';
              }

              const weekLabel = isBridgeRow && crossMonthBridge
                ? `${crossMonthBridge.partCurrentMonth.weekNum}+${crossMonthBridge.partAdjacentMonth.weekNum}`
                : r.week.week_num_in_month;

              const isWeekExpanded = expandedWeekKey === r.week.week_key;

              return (
                <React.Fragment key={r.week.week_key}>
                <tr
                  className={`transition-colors hover:bg-[#F2F7F4] ${isWeekExpanded ? 'bg-emerald-50/40 border-l-4 border-[#006241]' : rowBg}`}
                >
                  {/* Tydzień & Status */}
                  <td className="py-3.5 px-4 font-bold text-[#1E3932]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedWeekKey(isWeekExpanded ? null : r.week.week_key)}
                        title={
                          isWeekExpanded
                            ? `Kliknij, aby zwinąć dobowy rozkład i H +/- dla ${weekLabel}`
                            : `Kliknij, aby rozwinąć dobowy rozkład dni i propozycję H +/- dla ${weekLabel}`
                        }
                        className={`min-w-8 h-7 px-2 rounded-lg flex items-center justify-center gap-1 text-xs font-black transition-all cursor-pointer ${
                          isWeekExpanded
                            ? 'bg-[#006241] text-white shadow-md ring-2 ring-[#86EFAC] scale-105'
                            : isBridgeRow
                            ? 'bg-[#006241] text-white shadow-xs scale-105 ring-2 ring-[#86EFAC]'
                            : r.status === 'target_planning'
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
                        <span>{weekLabel}</span>
                        <span className="text-[10px] opacity-90">{isWeekExpanded ? '▴' : '▾'}</span>
                      </button>

                      <div className="flex flex-col">
                        {isBridgeRow ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black text-[#006241] px-1.5 py-0.5 rounded bg-[#DCFCE7] border border-[#86EFAC]">
                            <CalendarRange className="w-2.5 h-2.5 text-[#006241]" />
                            Scalony {weekLabel}
                          </span>
                        ) : r.status === 'target_planning' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black text-[#006241] px-1.5 py-0.5 rounded bg-[#DCFCE7] border border-[#86EFAC]">
                            <Target className="w-2.5 h-2.5 text-[#006241]" />
                            Cel HANW
                          </span>
                        ) : null}
                        {r.status === 'published' && !isBridgeRow && (
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
                        {r.status === 'current' && !isBridgeRow && (
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
                        {r.status === 'closed' && !isBridgeRow && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#006241] px-1.5 py-0.5 rounded bg-[#E8F5E9]">
                            <CheckCircle2 className="w-2.5 h-2.5 text-[#006241]" />
                            Zamknięty
                          </span>
                        )}
                        {r.status === 'future' && !isBridgeRow && (
                          <span className="text-[10px] font-medium text-gray-400">
                            Przyszły
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Daty */}
                  <td className="py-3.5 px-4 font-semibold text-[#2D3748]">
                    {isBridgeRow && crossMonthBridge ? (
                      <div className="flex flex-col">
                        <span className="font-extrabold text-[#006241]">
                          {crossMonthBridge.combinedDateRange}
                        </span>
                        <span className="text-[10px] text-stone-500 font-medium">
                          {crossMonthBridge.partCurrentMonth.dates} ({crossMonthBridge.partCurrentMonth.monthName.slice(0, 3)}) + {crossMonthBridge.partAdjacentMonth.dates} ({crossMonthBridge.partAdjacentMonth.monthName.slice(0, 3)})
                        </span>
                      </div>
                    ) : (
                      <span>{r.week.date_from} – {r.week.date_to}</span>
                    )}
                  </td>

                  {/* Dni */}
                  <td className="py-3.5 px-3 text-center">
                    {isBridgeRow && crossMonthBridge ? (
                      <div className="flex flex-col items-center">
                        <span className="font-black text-[#006241] text-sm">
                          {crossMonthBridge.totalDaysCount}
                        </span>
                        <span className="text-[9.5px] font-bold text-stone-500 block">
                          dni ({crossMonthBridge.partCurrentMonth.daysCount}d+{crossMonthBridge.partAdjacentMonth.daysCount}d)
                        </span>
                      </div>
                    ) : (
                      <>
                        <span className="font-extrabold text-[#1E3932] text-sm">
                          {r.calculatedDaysCount}
                        </span>
                        <span className="text-[10px] text-[#5C6F68] block">dni</span>
                      </>
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
                          <div className="flex flex-col items-end">
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
                            {(() => {
                              const diff = r.actualTrx - r.planTrx;
                              return (
                                <span className={`text-[9px] font-bold ${diff >= 0 ? 'text-[#006241]' : 'text-rose-700'}`}>
                                  {diff >= 0 ? `+${diff.toLocaleString('pl-PL')}` : diff.toLocaleString('pl-PL')} vs AOP
                                </span>
                              );
                            })()}
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
                        {(() => {
                          const diff = Number((r.actualHours - r.planHours).toFixed(1));
                          return (
                            <span className={`text-[9px] font-bold ${diff > 0 ? 'text-amber-700' : diff < 0 ? 'text-emerald-700' : 'text-stone-500'}`}>
                              {diff >= 0 ? `+${diff}h` : `${diff}h`} vs AOP
                            </span>
                          );
                        })()}
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
                            <span className="text-[#4338CA] font-black">
                              {r.scheduledHours.toFixed(1)} h
                            </span>
                            {(() => {
                              const diff = Number((r.scheduledHours - r.planHours).toFixed(1));
                              return (
                                <span className={`text-[9px] font-bold ${diff > 0 ? 'text-amber-700' : diff < 0 ? 'text-emerald-700' : 'text-stone-500'}`}>
                                  {diff >= 0 ? `+${diff}h` : `${diff}h`} vs AOP
                                </span>
                              );
                            })()}
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
                      <div className="flex flex-col items-end">
                        <span
                          className={
                            r.actualTplh >= r.planTplh ? 'text-[#006241]' : 'text-[#B45309]'
                          }
                        >
                          {r.actualTplh.toFixed(2)}
                        </span>
                        {(() => {
                          const diff = Number((r.actualTplh - r.planTplh).toFixed(2));
                          return (
                            <span className={`text-[9px] font-bold ${diff >= 0 ? 'text-[#006241]' : 'text-rose-700'}`}>
                              {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} vs AOP
                            </span>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>

                  {/* Inteligentny Plan Godzin (H Plan / HANW & Pula Baristów) */}
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
                        {(() => {
                          const diff = Number((r.hanwRecommendation - r.planHours).toFixed(1));
                          if (diff === 0) return null;
                          return (
                            <span className={`text-[9px] font-bold ${diff > 0 ? 'text-[#006241]' : 'text-amber-700'}`}>
                              {diff > 0 ? `+${diff}h` : `${diff}h`} vs AOP
                            </span>
                          );
                        })()}
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
                    ) : r.status === 'future' ? (
                      <div className="flex flex-col items-end">
                        <span className="px-2.5 py-0.5 rounded-full font-bold text-stone-700 bg-stone-100 border border-stone-200">
                          {r.planHours.toFixed(1)} h
                        </span>
                        <span className="text-[9px] text-stone-400 mt-0.5">Plan bazowy</span>
                        {r.baristaHoursPool !== undefined && r.baristaHoursPool !== null && (
                          <div
                            className="flex items-center gap-1 text-[9px] mt-1 whitespace-nowrap bg-stone-50 px-1.5 py-0.5 rounded border border-stone-200"
                            title="Pula godzin dla baristów"
                          >
                            <span className="text-stone-500 font-normal">Pula BAR:</span>
                            <span className="text-stone-800 font-bold">
                              {r.baristaHoursPool.toFixed(1)} h
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300" title="Tydzień zamknięty i rozliczony w RCP">—</span>
                    )}
                  </td>

                  {/* Akcje: Ewidencja MAPAL */}
                  <td className="py-3.5 px-3 text-center">
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
                  </td>
                </tr>

                {/* 🌟 ROZWIJANY DOBOWY ROZKŁAD DNI & MANIPULACJA ZMIANAMI (FLEX AI) */}
                {isWeekExpanded && (() => {
                  const isFullSplit = isBridgeRow && Boolean(crossMonthBridge?.all7DaysCoverage);
                  const targetBudget = isFullSplit && crossMonthBridge
                    ? (crossMonthBridge.recommendedCombinedHours || crossMonthBridge.totalCombinedPlanHours)
                    : (r.scheduledHours && r.scheduledHours > 0 ? r.scheduledHours : (r.hanwRecommendation || r.planHours));

                  const rawDays = isFullSplit && crossMonthBridge?.all7DaysCoverage
                    ? crossMonthBridge.all7DaysCoverage
                    : (r.managerDailyCoverage || []);

                  const flexInfo = CalculationEngine.enrichDailyCoverageWithFlex(rawDays, targetBudget);
                  const displayDays = flexInfo.enrichedDays;
                  const totalBaseFloorHours = flexInfo.totalBaseFloorHours;
                  const flexHoursPool = flexInfo.flexHoursPool;
                  const managerHours = isFullSplit && typeof crossMonthBridge?.totalCombinedManagerHours === 'number'
                    ? crossMonthBridge.totalCombinedManagerHours
                    : (r.managerHours || 0);
                  const baristaPool = isFullSplit && typeof crossMonthBridge?.totalCombinedBaristaPool === 'number'
                    ? crossMonthBridge.totalCombinedBaristaPool
                    : (r.baristaHoursPool ?? Math.max(0, targetBudget - managerHours));

                  // Wylicz aktualną sumę z wprowadzonych godzin dobowych
                  const currentCustomSum = displayDays.reduce((sum, d) => {
                    const dayKey = `${r.week.week_key}_${d.day}`;
                    const bHours = dailyBaristaHours[dayKey] !== undefined ? dailyBaristaHours[dayKey] : (d.suggestedBaristaHours || 0);
                    return sum + (d.coverageHours || 0) + bHours;
                  }, 0);

                  return (
                    <tr className="bg-gradient-to-r from-stone-50 via-emerald-50/20 to-stone-50 border-b-2 border-[#006241]/40 animate-in fade-in duration-200">
                      <td colSpan={12} className="p-3 sm:p-4">
                        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
                          {/* Nagłówek sekcji Flex AI z przyciskami szybkiego rozkładu */}
                          <div className="px-5 py-3 bg-gradient-to-r from-[#006241]/10 via-stone-50 to-emerald-50 border-b border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 bg-[#006241] text-white rounded-xl shadow-2xs">
                                <Sparkles className="w-4 h-4 text-amber-300" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-xs font-black text-[#1E3932] tracking-tight uppercase">
                                    Dystrybucja Godzin & Dobowy Rozkład Dni — {weekLabel}
                                  </h4>
                                </div>
                                <p className="text-[11px] text-stone-500 mt-0.5">
                                  Suma grafiku: <strong className="text-stone-900 font-black">{currentCustomSum.toFixed(1)}h</strong> • MGR: <strong>{managerHours.toFixed(1)}h</strong> • Pula Baristów: <strong className="text-[#006241] font-black">{baristaPool.toFixed(1)}h</strong> • Flex H +/-: <strong className="text-amber-700">+{flexHoursPool.toFixed(1)}h</strong>
                                </p>
                              </div>
                            </div>

                            {/* Narzędzia szybkiej dystrybucji */}
                            <div className="flex items-center gap-1.5 flex-wrap self-end lg:self-auto">
                              <button
                                type="button"
                                onClick={() => handleDistributeByTrend(r.week.week_key, targetBudget, rawDays)}
                                className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#006241] hover:bg-[#00754A] rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer"
                                title="Rozdziela godziny na 7 dni proporcjonalnie do historycznego popytu (Sobota > Pt > Wt...)"
                              >
                                <Sparkles className="w-3 h-3 text-amber-300" />
                                <span>Rozdziel wg Trendu AI</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDistributeEvenly(r.week.week_key, targetBudget, rawDays)}
                                className="px-2.5 py-1 text-[11px] font-bold text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg shadow-2xs transition cursor-pointer"
                                title="Dzieli pulę baristów po równo na każdy dzień tygodnia"
                              >
                                <span>⚖️ Po równo</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDistributeByTrend(r.week.week_key, rawDays.length * 32.0, rawDays)}
                                className="px-2 py-1 text-[11px] font-bold text-stone-600 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg shadow-2xs transition cursor-pointer"
                                title="Ustawia każdy dzień na bezpieczne minimum Floor (32h/dzień)"
                              >
                                <span>🛡️ Floor (32h)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setExpandedWeekKey(null)}
                                className="px-2.5 py-1 text-[11px] font-bold text-stone-500 hover:text-stone-800 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg shadow-2xs transition cursor-pointer"
                              >
                                ✕ Zwiń
                              </button>
                            </div>
                          </div>

                          {/* Tabela dobowego rozkładu H +/- */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-[#F7F9F8] text-stone-600 font-bold border-b border-stone-200 text-[11px] select-none">
                                  <th className="py-2.5 px-3">Dzień & Data</th>
                                  <th className="py-2.5 px-3 text-center font-bold text-stone-600">MGR z Grafiku</th>
                                  <th className="py-2.5 px-3 text-right font-black text-[#006241]">DLA BARISTÓW (Wpisz h)</th>
                                  <th className="py-2.5 px-3 text-right font-black text-stone-900">ŁĄCZNIE DZIEŃ</th>
                                  <th className="py-2.5 px-3 text-center font-bold text-stone-700">Trend AI / Sugestia</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {displayDays.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="py-6 text-center text-stone-400">
                                      Brak zarejestrowanych zmian w grafiku dla wybranego tygodnia.
                                    </td>
                                  </tr>
                                ) : (
                                  displayDays.map((d) => {
                                    const dayKey = `${r.week.week_key}_${d.day}`;
                                    const customBarista = dailyBaristaHours[dayKey] !== undefined
                                      ? dailyBaristaHours[dayKey]
                                      : (d.suggestedBaristaHours || 0);
                                    const dayTotalHours = Number(((d.coverageHours || 0) + customBarista).toFixed(1));
                                    const isBelowFloor = dayTotalHours < 32.0;

                                    return (
                                      <tr key={`day-flex-${d.date || d.day}`} className="hover:bg-emerald-50/30 transition-colors">
                                        {/* Dzień & Data */}
                                        <td className="py-2.5 px-3 font-semibold text-stone-800">
                                          <div className="flex items-center gap-1.5">
                                            <span className={`w-7 h-5 rounded font-black text-[10px] flex items-center justify-center ${
                                              d.dayOfWeek === 'Sob' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                              d.dayOfWeek === 'Pt' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                                              d.dayOfWeek === 'Nd' ? 'bg-stone-200 text-stone-800' :
                                              'bg-stone-100 text-stone-700'
                                            }`}>
                                              {d.dayOfWeek}
                                            </span>
                                            <span className="font-bold">
                                              {String(d.day).padStart(2, '0')}.{String(d.monthName ? d.monthName.slice(0, 3) : (r.week.month_name ? r.week.month_name.slice(0, 3) : ''))}
                                            </span>
                                          </div>
                                        </td>

                                        {/* MGR z Grafiku */}
                                        <td className="py-2.5 px-3 text-center font-bold text-stone-700">
                                          <span className="px-2 py-0.5 bg-stone-100 rounded-md border border-stone-200 text-[11px]">
                                            +{d.coverageHours?.toFixed(1) || 0} h
                                          </span>
                                        </td>

                                        {/* DLA BARISTÓW (Wpisz h) */}
                                        <td className="py-2 px-3 text-right">
                                          <div className="flex items-center justify-end gap-1.5">
                                            <input
                                              type="number"
                                              step="0.5"
                                              min="0"
                                              value={customBarista === 0 ? '' : customBarista}
                                              onChange={(e) => {
                                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                                handleDayBaristaChange(r.week.week_key, d.day, val, displayDays);
                                              }}
                                              placeholder="0"
                                              className="w-20 px-2 py-1 bg-white border border-[#006241]/40 focus:border-[#006241] focus:ring-1 focus:ring-[#006241] rounded-lg text-xs font-black text-[#006241] text-right outline-none shadow-2xs"
                                            />
                                            <span className="text-[11px] font-bold text-stone-500">h</span>
                                          </div>
                                        </td>

                                        {/* ŁĄCZNIE DZIEŃ */}
                                        <td className="py-2.5 px-3 text-right">
                                          <div className="flex flex-col items-end">
                                            <span className={`font-black text-sm ${isBelowFloor ? 'text-rose-700' : 'text-stone-900'}`}>
                                              {dayTotalHours.toFixed(1)} h
                                            </span>
                                            {isBelowFloor && (
                                              <span className="text-[9px] font-bold text-rose-600">
                                                ⚠️ &lt; 32h Floor
                                              </span>
                                            )}
                                          </div>
                                        </td>

                                        {/* Sugerowane Zmiany / Trend AI */}
                                        <td className="py-2.5 px-3 text-center">
                                          <div className="flex items-center justify-center gap-1.5" title={d.manipulationTip || undefined}>
                                            <span className="font-bold text-amber-800 text-[11px]">
                                              +{(d.suggestedFlexHours || 0).toFixed(1)}h flex
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                              (d.suggestedFlexHours || 0) >= 20
                                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                : (d.suggestedFlexHours || 0) >= 10
                                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                                : 'bg-stone-100 text-stone-700 border-stone-200'
                                            }`}>
                                              {d.suggestedExtraShifts || 'Baza'}
                                            </span>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Dolny baner z zasadą kawiarni */}
                          <div className="p-3 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-stone-600">
                            <div className="flex items-center gap-2">
                              <Info className="w-4 h-4 text-[#006241] shrink-0" />
                              <span>
                                <strong>Dystrybucja robocizny:</strong> Wpisuj godziny baristów per dzień lub kliknij <em>Rozdziel wg Trendu AI</em> / <em>Po równo</em>. Suma dni automatycznie zapisuje się jako cel tygodnia ("Grafik h").
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })()}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#F8FAF9] border-t-2 border-[#D0DCD6] font-black text-xs text-[#1E3932]">
              <td className="py-3 px-4 uppercase text-[#006241]" colSpan={3}>
                Podsumowanie Miesiąca
              </td>
              <td className="py-3 px-4 text-right">
                {rows.reduce((s, r) => s + r.planTrx, 0).toLocaleString('pl-PL')}
              </td>
              <td className="py-3 px-4 text-right text-[#006241]">
                {rows.some((r) => r.actualTrx) ? (
                  (() => {
                    const totalActTrx = rows.reduce((s, r) => s + (r.actualTrx || 0), 0);
                    const totalPlanTrx = rows.reduce((s, r) => s + r.planTrx, 0);
                    const diff = totalActTrx - totalPlanTrx;
                    return (
                      <div className="flex flex-col items-end">
                        <span className="font-black">{totalActTrx.toLocaleString('pl-PL')}</span>
                        <span className={`text-[9px] font-bold ${diff >= 0 ? 'text-[#006241]' : 'text-rose-700'}`}>
                          {diff >= 0 ? `+${diff.toLocaleString('pl-PL')}` : diff.toLocaleString('pl-PL')} vs AOP
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  '—'
                )}
              </td>
              <td className="py-3 px-4 text-right">
                {rows.reduce((s, r) => s + r.planHours, 0).toFixed(1)} h
              </td>
              <td className="py-3 px-4 text-right text-[#0284C7]">
                {rows.some((r) => r.actualHours) ? (
                  (() => {
                    const totalActH = rows.reduce((s, r) => s + (r.actualHours || 0), 0);
                    const totalPlanH = rows.reduce((s, r) => s + r.planHours, 0);
                    const diff = Number((totalActH - totalPlanH).toFixed(1));
                    return (
                      <div className="flex flex-col items-end">
                        <span className="font-black">{totalActH.toFixed(1)} h</span>
                        <span className={`text-[9px] font-bold ${diff > 0 ? 'text-amber-700' : diff < 0 ? 'text-emerald-700' : 'text-stone-500'}`}>
                          {diff >= 0 ? `+${diff}h` : `${diff}h`} vs AOP
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  '—'
                )}
              </td>
              <td className="py-3 px-4 text-right text-[#6366F1]">
                {rows.some((r) => r.scheduledHours) ? (
                  (() => {
                    const totalSchedH = rows.reduce((s, r) => s + (r.scheduledHours || 0), 0);
                    const totalPlanH = rows.reduce((s, r) => s + r.planHours, 0);
                    const diff = Number((totalSchedH - totalPlanH).toFixed(1));
                    return (
                      <div className="flex flex-col items-end">
                        <span className="font-black">{totalSchedH.toFixed(1)} h</span>
                        <span className={`text-[9px] font-bold ${diff > 0 ? 'text-amber-700' : diff < 0 ? 'text-emerald-700' : 'text-stone-500'}`}>
                          {diff >= 0 ? `+${diff}h` : `${diff}h`} vs AOP
                        </span>
                        {rows.some(r => (r.managerHours || 0) > 0) && (
                          <span className="text-[9px] text-[#006241] font-semibold">
                            MGR: {rows.reduce((s, r) => s + (r.managerHours || 0), 0).toFixed(1)}h
                          </span>
                        )}
                      </div>
                    );
                  })()
                ) : rows.some(r => (r.managerHours || 0) > 0) ? (
                  <span className="text-[10px] text-[#006241] font-bold">
                    MGR {rows.reduce((s, r) => s + (r.managerHours || 0), 0).toFixed(1)}h
                  </span>
                ) : (
                  '—'
                )}
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
                  const totalPlanTrx = rows.reduce((s, r) => s + r.planTrx, 0);
                  const totalPlanH = rows.reduce((s, r) => s + r.planHours, 0);
                  const planTplh = totalPlanH > 0 ? totalPlanTrx / totalPlanH : 0;
                  const actTplh = totalActH > 0 ? totalActTrx / totalActH : 0;
                  const diff = Number((actTplh - planTplh).toFixed(2));
                  return actTplh > 0 ? (
                    <div className="flex flex-col items-end">
                      <span className="font-black">{actTplh.toFixed(2)}</span>
                      <span className={`text-[9px] font-bold ${diff >= 0 ? 'text-[#006241]' : 'text-rose-700'}`}>
                        {diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} vs AOP
                      </span>
                    </div>
                  ) : (
                    '—'
                  );
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
