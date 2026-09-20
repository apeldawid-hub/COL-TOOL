import React, { useState } from 'react';
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
  Info,
  CalendarRange,
  Sparkles,
  TrendingUp,
  BrainCircuit,
} from 'lucide-react';
import {
  WeeklyCalculatedRow,
  CrossMonthBridge,
  ManagerDailyCoverageItem
} from '../../../types';
import { CalculationEngine } from '../services/calculationEngine';

interface ManagerLaborBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekRow: WeeklyCalculatedRow | null;
  crossMonthBridge?: CrossMonthBridge | null;
  onNavigateToManagerSchedule?: () => void;
}

export const ManagerLaborBridgeModal: React.FC<ManagerLaborBridgeModalProps> = ({
  isOpen,
  onClose,
  weekRow,
  crossMonthBridge,
  onNavigateToManagerSchedule,
}) => {
  const [viewMode, setViewMode] = useState<'current_part' | 'full_7_days'>('current_part');
  const [tableTab, setTableTab] = useState<'flex_matrix' | 'floor_safety'>('flex_matrix');

  if (!isOpen || !weekRow) return null;

  const { week } = weekRow;
  const isSplitWeek = Boolean(
    crossMonthBridge &&
      (crossMonthBridge.partCurrentMonth.weekKey === week.week_key ||
        weekRow.isPartial ||
        weekRow.calculatedDaysCount < 7)
  );

  const isFullView = isSplitWeek && viewMode === 'full_7_days';

  const days: ManagerDailyCoverageItem[] = isFullView && crossMonthBridge?.all7DaysCoverage
    ? crossMonthBridge.all7DaysCoverage
    : weekRow.managerDailyCoverage || [];

  const managerHours = isFullView && typeof crossMonthBridge?.totalCombinedManagerHours === 'number'
    ? crossMonthBridge.totalCombinedManagerHours
    : weekRow.managerHours || 0;

  const coverageHours = isFullView
    ? days.reduce((sum, d) => sum + d.coverageHours, 0)
    : weekRow.managerCoverageHours || 0;

  const ncHours = isFullView
    ? days.reduce((sum, d) => sum + d.ncHours, 0)
    : weekRow.managerNcHours || 0;

  const targetBudget = isFullView && crossMonthBridge
    ? crossMonthBridge.recommendedCombinedHours || crossMonthBridge.totalCombinedPlanHours
    : weekRow.hanwRecommendation || (weekRow.scheduledHours && weekRow.scheduledHours > 0 ? weekRow.scheduledHours : weekRow.planHours);

  const baristaPool = isFullView && typeof crossMonthBridge?.totalCombinedBaristaPool === 'number'
    ? crossMonthBridge.totalCombinedBaristaPool
    : weekRow.baristaHoursPool ?? Math.max(0, targetBudget - managerHours);

  const missingAmCount = isFullView && typeof crossMonthBridge?.missingAmTotal === 'number'
    ? crossMonthBridge.missingAmTotal
    : days.filter(d => !d.hasAm).length;

  const missingPmCount = isFullView && typeof crossMonthBridge?.missingPmTotal === 'number'
    ? crossMonthBridge.missingPmTotal
    : days.filter(d => !d.hasPm).length;

  const totalFloorDeficit = days.reduce((sum, d) => sum + d.floorDeficit, 0);

  // Dynamiczne wyliczenie Puli Flex (godzin ponad floor 32h) i dystrybucji na dni
  const flexInfo = CalculationEngine.enrichDailyCoverageWithFlex(days, targetBudget);
  const displayDays = flexInfo.enrichedDays;
  const totalBaseFloorHours = flexInfo.totalBaseFloorHours;
  const flexHoursPool = flexInfo.flexHoursPool;
  const flexHoursPerDayAvg = flexInfo.flexHoursPerDayAvg;

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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-[#1E3932] tracking-tight">
                  Manipulacja Zmianami & Dobowy Rozkład Dni (Trend AI)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-[#006241] text-white font-bold text-xs">
                  {week.week_num_in_month}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[10px]">
                  🛡️ Baza Floor: 32h/d (1 MGR + 1 BAR rano/wieczór)
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
          {/* Baner Tygodnia Przełomowego (Split-Week Bridge) */}
          {isSplitWeek && crossMonthBridge && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-[#006241] text-white rounded-xl shadow-2xs mt-0.5">
                    <CalendarRange className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-[#1E3932] uppercase tracking-tight">
                        Tydzień Przełomowy AOP (Split-Week)
                      </h4>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                        {crossMonthBridge.bridgeType === 'trailing' ? 'Przełom z kolejnym miesiącem' : 'Przełom z poprzednim miesiącem'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-1 leading-snug">
                      Fizyczny grafik obejmuje <strong>7 dni ({crossMonthBridge.combinedDateRange})</strong>: część{' '}
                      <strong>{crossMonthBridge.partCurrentMonth.monthName}</strong> ({crossMonthBridge.partCurrentMonth.daysCount} dni) oraz część{' '}
                      <strong>{crossMonthBridge.partAdjacentMonth.monthName}</strong> ({crossMonthBridge.partAdjacentMonth.daysCount} dni).
                    </p>
                  </div>
                </div>

                {/* Przełącznik widoku: Cząstkowy vs Scalony 7 dni */}
                <div className="flex items-center bg-white p-1 rounded-xl border border-stone-200 shadow-2xs shrink-0 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => setViewMode('current_part')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      viewMode === 'current_part'
                        ? 'bg-[#006241] text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Dni {week.month_name} ({weekRow.calculatedDaysCount} dni)
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('full_7_days')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      viewMode === 'full_7_days'
                        ? 'bg-[#006241] text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Scalony Pełny Cykl (7 dni)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Karty podsumowania tygodnia (5 kart z Pulą Flex) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* Karta 1: Godziny MGR na Janki */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#E2E8E5] shadow-xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Godziny MGR</span>
                <Clock className="w-3.5 h-3.5 text-[#006241]" />
              </div>
              <div className="text-lg font-black text-stone-900">
                {managerHours.toFixed(1)} h
              </div>
              <div className="text-[10px] text-stone-500 mt-1 flex items-center gap-1">
                <span className="text-emerald-700 font-semibold">{coverageHours.toFixed(1)}h Cov</span>
                <span>+</span>
                <span className="text-purple-700 font-semibold">{ncHours.toFixed(1)}h NC</span>
              </div>
            </div>

            {/* Karta 2: Cel Robocizny */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#E2E8E5] shadow-xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Cel Tygodnia</span>
                <Briefcase className="w-3.5 h-3.5 text-[#006241]" />
              </div>
              <div className="text-lg font-black text-[#006241]">
                {targetBudget.toFixed(1)} h
              </div>
              <div className="text-[10px] text-stone-400 mt-1">
                {weekRow.hanwRecommendation ? 'Rekomendacja HANW' : 'Plan Godzin AOP'}
              </div>
            </div>

            {/* Karta 3: Baza Floor Hours */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#E2E8E5] shadow-xs">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider">Baza Floor (32h/d)</span>
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-lg font-black text-blue-900">
                {totalBaseFloorHours.toFixed(1)} h
              </div>
              <div className="text-[10px] text-stone-500 mt-1">
                1 MGR + 1 Barista rano/wieczór
              </div>
            </div>

            {/* Karta 4: Pula Flex (Manipulacja Zmianami) */}
            <div className="bg-gradient-to-br from-amber-50 to-emerald-50 p-3.5 rounded-2xl border-2 border-emerald-300 shadow-xs text-emerald-950">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#006241]">Pula Flex</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-lg font-black text-[#006241]">
                +{flexHoursPool.toFixed(1)} h
              </div>
              <div className="text-[10px] text-emerald-800 mt-1 font-bold">
                Godziny poza Floorem
              </div>
            </div>

            {/* Karta 5: Pula dla Baristów */}
            <div className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-200 shadow-xs text-indigo-950">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">Pula Baristów</span>
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="text-lg font-black text-indigo-900">
                {baristaPool.toFixed(1)} h
              </div>
              <div className="text-[10px] text-indigo-700 mt-1 font-medium">
                Do obsadzenia baristami
              </div>
            </div>
          </div>

          {/* Baner Podsumowania Puli Flex poza Floorem */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/70 to-indigo-50 border-2 border-emerald-300 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-[#006241] text-white rounded-xl shadow-2xs shrink-0 mt-0.5">
                <BrainCircuit className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-[#006241] uppercase tracking-wider">
                    Model Uczenia MAPAL: Pula Poza Floorem (Manipulacja Zmianami)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                    Baza 32h chroniona
                  </span>
                </div>
                <p className="text-xs text-stone-700 mt-1 leading-relaxed">
                  Baza bezpieczeństwa (1 MGR + 1 Barista rano i wieczorem) wynosi <strong>{totalBaseFloorHours.toFixed(1)} h</strong> ({displayDays.length} dni × 32h).
                  Wszystkie pozostałe godziny (<strong>+{flexHoursPool.toFixed(1)} h</strong>) to <strong>Pula Manipulacji Zmianami</strong>, którą model rozdziela na poszczególne dni na podstawie 37 tygodni historii sprzedaży w Jankach.
                </p>
              </div>
            </div>
            <div className="text-right shrink-0 bg-white px-3.5 py-2.5 rounded-xl border border-emerald-300 shadow-2xs">
              <span className="text-[10px] text-stone-500 font-bold block uppercase tracking-wide">Pula Flex do dyspozycji:</span>
              <span className="text-xl font-black text-[#006241]">+{flexHoursPool.toFixed(1)} h</span>
              <span className="text-[10px] text-stone-400 block font-medium">~{flexHoursPerDayAvg.toFixed(1)} h / dzień</span>
            </div>
          </div>

          {/* Tabela dobowego rozkładu z 2 zakładkami */}
          <div className="bg-white border border-[#E2E8E5] rounded-2xl overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-[#F4F7F5] border-b border-[#E2E8E5] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="font-black text-[#1E3932] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#006241]" />
                <span>
                  {tableTab === 'flex_matrix'
                    ? 'Dobowa Siatka: Baza Floor (32h) + Manipulacja Zmianami (Trendy MAPAL)'
                    : 'Tarcza Bezpieczeństwa Floor Hours: Obsada AM/PM & Min. 32h'}
                </span>
              </div>

              {/* Przełącznik zakładek tabeli */}
              <div className="flex items-center bg-white p-1 rounded-xl border border-stone-200 shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => setTableTab('flex_matrix')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    tableTab === 'flex_matrix'
                      ? 'bg-[#006241] text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Manipulacja Zmianami (Flex)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTableTab('floor_safety')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    tableTab === 'floor_safety'
                      ? 'bg-[#006241] text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Tarcza AM/PM & Floor</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  {tableTab === 'flex_matrix' ? (
                    <tr className="bg-[#F7F9F8] text-stone-600 font-bold border-b border-[#E2E8E5] text-[11px] select-none">
                      <th className="py-2.5 px-3">Dzień & Data</th>
                      <th className="py-2.5 px-3 text-center">Baza Floor</th>
                      <th className="py-2.5 px-3 text-center">Waga MAPAL</th>
                      <th className="py-2.5 px-3 text-right font-bold text-amber-800">Sugerowany Flex</th>
                      <th className="py-2.5 px-3 text-right font-black text-stone-900">Rekomendowany Cel</th>
                      <th className="py-2.5 px-3 text-right">MGR Floor</th>
                      <th className="py-2.5 px-3 text-right font-black text-[#006241]">DLA BARISTÓW ROZPISZ</th>
                      <th className="py-2.5 px-3 text-center">Sugerowane Zmiany Flex</th>
                    </tr>
                  ) : (
                    <tr className="bg-[#F7F9F8] text-stone-600 font-bold border-b border-[#E2E8E5] text-[11px] select-none">
                      <th className="py-2.5 px-3">Dzień & Data</th>
                      <th className="py-2.5 px-3">Otwarcie (AM)</th>
                      <th className="py-2.5 px-3">Zamknięcie (PM)</th>
                      <th className="py-2.5 px-3">Inne Dyżury MGR</th>
                      <th className="py-2.5 px-3 text-right">MGR Coverage</th>
                      <th className="py-2.5 px-3 text-right">Floor Dnia</th>
                      <th className="py-2.5 px-3 text-right font-black text-[#006241]">Min. Baristów do 32h</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-[#EEF2F0]">
                  {displayDays.length === 0 ? (
                    <tr>
                      <td colSpan={tableTab === 'flex_matrix' ? 8 : 7} className="py-8 text-center text-stone-400">
                        Brak zarejestrowanych zmian w grafiku managerskim dla wybranego tygodnia.
                      </td>
                    </tr>
                  ) : (
                    displayDays.map((d) => {
                      if (tableTab === 'flex_matrix') {
                        return (
                          <tr key={`day-${d.date || d.day}`} className="hover:bg-[#F9FBFA] transition-colors">
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
                                  {String(d.day).padStart(2, '0')}.{String(d.monthName ? d.monthName.slice(0, 3) : (week.month_name ? week.month_name.slice(0, 3) : ''))}
                                </span>
                              </div>
                            </td>

                            {/* Baza Floor (32h) */}
                            <td className="py-2.5 px-3 text-center text-stone-600 font-bold">
                              32.0 h
                              <span className="text-[9px] text-stone-400 block font-normal">1mgr+1bar x 2</span>
                            </td>

                            {/* Waga MAPAL */}
                            <td className="py-2.5 px-3 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 font-black text-[10px]">
                                {d.dayWeightPercent || 14.3}%
                              </span>
                            </td>

                            {/* Sugerowany Flex */}
                            <td className="py-2.5 px-3 text-right font-black text-amber-700">
                              +{d.suggestedFlexHours?.toFixed(1) || 0} h
                            </td>

                            {/* Rekomendowany Cel Dnia */}
                            <td className="py-2.5 px-3 text-right font-black text-stone-900 text-sm">
                              {d.suggestedTotalDayHours?.toFixed(1) || 32.0} h
                            </td>

                            {/* MGR na Floorze */}
                            <td className="py-2.5 px-3 text-right text-stone-700 font-bold">
                              {d.coverageHours.toFixed(1)} h
                            </td>

                            {/* DLA BARISTÓW ROZPISZ */}
                            <td className="py-2.5 px-3 text-right font-black text-[#006241] text-sm">
                              {d.suggestedBaristaHours?.toFixed(1) || 0} h
                            </td>

                            {/* Sugerowane Zmiany Flex & Widełki Manipulacji */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                  (d.suggestedFlexHours || 0) >= 20
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : (d.suggestedFlexHours || 0) >= 10
                                    ? 'bg-blue-100 text-blue-900 border-blue-300'
                                    : 'bg-stone-100 text-stone-700 border-stone-200'
                                }`}>
                                  {d.suggestedExtraShifts || 'Baza floor'}
                                </span>
                                {d.manipulationMinHours !== undefined && d.manipulationMaxHours !== undefined && (
                                  <div className="flex items-center gap-1 text-[9px] text-stone-500 font-medium">
                                    <span>Widełki:</span>
                                    <strong className="text-stone-700">{d.manipulationMinHours}h</strong>
                                    <span>–</span>
                                    <strong className="text-stone-700">{d.manipulationMaxHours}h</strong>
                                  </div>
                                )}
                                {d.manipulationTip && (
                                  <span className="text-[9px] text-stone-500 text-center leading-tight max-w-[200px]">
                                    {d.manipulationTip}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      // Widok tarczy Floor Safety
                      return (
                        <tr key={`day-${d.date || d.day}`} className="hover:bg-[#F9FBFA] transition-colors">
                          {/* Dzień & Data */}
                          <td className="py-2.5 px-3 font-semibold text-stone-800">
                            <div className="flex items-center gap-1.5">
                              <span className="w-7 h-5 rounded bg-stone-100 text-stone-700 font-black text-[10px] flex items-center justify-center">
                                {d.dayOfWeek}
                              </span>
                              <span>
                                {String(d.day).padStart(2, '0')}.{String(d.monthName ? d.monthName.slice(0, 3) : (week.month_name ? week.month_name.slice(0, 3) : ''))}
                              </span>
                              {d.monthName && d.monthName !== week.month_name && (
                                <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded border border-blue-200">
                                  {d.monthName}
                                </span>
                              )}
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
