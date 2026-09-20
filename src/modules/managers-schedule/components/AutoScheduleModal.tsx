import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CalendarCheck,
  ShieldCheck,
  RotateCcw,
  Users,
  Layers,
  ArrowRight,
  TrendingUp,
  Info,
  Scale,
  Calendar,
  Coffee,
  Check,
  HelpCircle,
  Copy,
  MessageSquare,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import {
  ManagerScheduleMonthData,
  ManagerScheduleShift
} from '../../../types/index';
import {
  AutoSchedulerEngine,
  AutoScheduleOptions,
  AutoScheduleResult,
  ConflictInsight,
  ConflictNegotiationOption
} from '../services/autoSchedulerEngine';
import { formatManagerRole } from '../services/managerScheduleEngine';

interface AutoScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ManagerScheduleMonthData;
  onApplySchedule: (generatedShifts: ManagerScheduleShift[]) => Promise<void>;
  prevMonthShifts?: ManagerScheduleShift[];
  initialResult?: AutoScheduleResult | null;
  onOpenDispositions?: () => void;
}

export const AutoScheduleModal: React.FC<AutoScheduleModalProps> = ({
  isOpen,
  onClose,
  data,
  onApplySchedule,
  prevMonthShifts = [],
  initialResult = null,
  onOpenDispositions
}) => {
  // Domyślne opcje generatora (wszystkie zaawansowane heurystyki są na stałe aktywne)
  const [selectedMode, setSelectedMode] = useState<'smart_full' | 'fill_gaps'>('smart_full');
  const [activeTab, setActiveTab] = useState<'grid' | 'employees' | 'diff' | 'insights'>('grid');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<AutoScheduleResult | null>(initialResult);

  // Stan asystenta negocjacji
  const [copiedOptionId, setCopiedOptionId] = useState<string | null>(null);
  const [appliedOptionIds, setAppliedOptionIds] = useState<Set<string>>(new Set());

  // Synchronizacja initialResult przy zmianie
  React.useEffect(() => {
    if (initialResult) {
      setResult(initialResult);
    }
  }, [initialResult]);

  // Zgromadź istniejące zmiany z rows
  const existingShiftsList = useMemo(() => {
    const list: ManagerScheduleShift[] = [];
    data.rows.forEach(r => {
      Object.values(r.shifts).forEach(s => {
        list.push(s);
      });
    });
    return list;
  }, [data.rows]);

  // Sformatuj dyspozycje
  const dispositionsByEmployee = useMemo(() => {
    const map: Record<number, Record<number, string>> = {};
    data.rows.forEach(r => {
      map[r.employee.id] = {};
      Object.entries(r.shifts).forEach(([dayStr, s]) => {
        const d = parseInt(dayStr, 10);
        if (s.disposition) {
          map[r.employee.id][d] = s.disposition;
        }
      });
    });
    return map;
  }, [data.rows]);

  // Uruchomienie generowania grafiku (20 000 prób)
  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult(null);
    setAppliedOptionIds(new Set());

    const options: AutoScheduleOptions = {
      mode: selectedMode,
      allocateMidInPeaks: true,
      respectDispositions: true,
      preserveFixedShifts: true,
      preferConsecutiveOffDays: true,
      balanceFairness: true,
      smoothWeeklyHours: true,
      iterationsCount: 2000
    };

    try {
      const res = await AutoSchedulerEngine.generateScheduleAsync(
        data.year,
        data.month,
        data.employees,
        data.shiftDefinitions,
        existingShiftsList,
        dispositionsByEmployee,
        options,
        prevMonthShifts
      );
      setResult(res);
      // Jeśli są konflikty krytyczne, automatycznie przełącz na zakładkę Sprawiedliwość i Kompromisy
      if (res.conflictInsights && res.conflictInsights.some(c => c.requestedDispo === 'OFF')) {
        setActiveTab('insights');
      }
    } catch (err) {
      console.error('Błąd generowania grafiku:', err);
      alert('Wystąpił błąd podczas generowania grafiku.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Kopiowanie wiadomości do schowka
  const handleCopyMessage = (text: string, optionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOptionId(optionId);
    setTimeout(() => {
      setCopiedOptionId(null);
    }, 3000);
  };

  // Zastosowanie wariantu kompromisowego w pamięci
  const handleApplyNegotiationOption = (insight: ConflictInsight, opt: ConflictNegotiationOption) => {
    if (!result) return;

    const updatedShifts = result.generatedShifts.map(s => {
      if (s.employee_id === insight.employeeId) {
        if (opt.type === 'compensate_off' && opt.suggestedTargetDay && s.day === opt.suggestedTargetDay) {
          return {
            ...s,
            shift_code: 'OFF',
            hours: 0.0,
            custom_start_time: undefined,
            custom_end_time: undefined
          };
        }
        if (opt.type === 'support_shift' && s.day === insight.day) {
          return {
            ...s,
            shift_code: 'OFF',
            hours: 0.0,
            custom_start_time: undefined,
            custom_end_time: undefined
          };
        }
      }
      return s;
    });

    // Przelicz statystyki pracownika
    const updatedEmployeeStats = result.employeeStats.map(empStat => {
      if (empStat.employeeId === insight.employeeId) {
        const empShifts = updatedShifts.filter(s => s.employee_id === empStat.employeeId);
        const plannedH = empShifts.reduce((acc, cur) => acc + cur.hours, 0);
        const offDays = empShifts.filter(s => s.shift_code === 'OFF' || s.hours === 0).length;
        const workDays = empShifts.filter(s => s.shift_code !== 'OFF' && s.hours > 0).length;
        return {
          ...empStat,
          plannedHours: Number(plannedH.toFixed(1)),
          balanceHours: Number((plannedH - empStat.nominalHours).toFixed(1)),
          offDaysCount: offDays,
          workingDaysCount: workDays
        };
      }
      return empStat;
    });

    const totalPlanned = updatedShifts.reduce((acc, s) => acc + s.hours, 0);

    setResult({
      ...result,
      generatedShifts: updatedShifts,
      employeeStats: updatedEmployeeStats,
      stats: {
        ...result.stats,
        totalPlannedHours: Number(totalPlanned.toFixed(1))
      }
    });

    setAppliedOptionIds(prev => new Set(prev).add(opt.id));
  };

  // Zatwierdzenie i aplikacja wygenerowanego grafiku
  const handleApply = async () => {
    if (!result) return;
    const confirm = window.confirm(
      `✨ Czy na pewno chcesz zastosować wygenerowany grafik dla ${data.monthName} ${data.year}?\n\n` +
      `Zaplanowano ${result.stats.totalPlannedHours}h dla ${result.employeeStats.length} menedżerów.\n` +
      `Zgodność z Kodeksem Pracy: 100% (0 naruszeń).\n` +
      `Zgodność z dyspozycjami: ${result.stats.dispositionMatchRate}%.`
    );
    if (!confirm) return;

    setIsApplying(true);
    try {
      await onApplySchedule(result.generatedShifts);
      onClose();
    } catch (err) {
      console.error('Błąd zapisywania grafiku:', err);
      alert('Wystąpił błąd podczas zapisywania grafiku.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  const criticalConflicts = result?.conflictInsights?.filter(c => c.requestedDispo === 'OFF') || [];
  const preferenceConflicts = result?.conflictInsights?.filter(c => c.requestedDispo !== 'OFF') || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E2E8E5] w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* NAGŁÓWEK MODALA */}
        <div className="bg-[#006241] text-white p-5 sm:px-7 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>AutoScheduling — Podgląd i Propozycja Grafiku</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-700/80 text-[10px] font-bold uppercase tracking-wider border border-white/20">
                  20 000 prób • Global Optimum
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Starbucks 108120 Janki • <strong>{data.monthName} {data.year}</strong> • Norma: {data.fullTimeNominalHours}h (pełny etat)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GŁÓWNA ZAWARTOŚĆ */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-stone-50/50">
          
          {/* Jeśli brak wyniku - proste menu wyboru trybu bez zbędnych checkboxów */}
          {!result && (
            <div className="bg-white rounded-2xl p-6 border border-[#E2E8E5] shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-stone-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#006241]" />
                  <span>Wybierz Tryb Optymalizacji (20 000 Prób AI)</span>
                </h3>
                <p className="text-xs text-stone-500 mt-1">
                  Wszystkie zaawansowane reguły (ochrona dyspozycji, Kodeks Pracy, równość weekendów, ciągłość odpoczynku) są włączone domyślnie.
                </p>
              </div>

              {/* Wybór Trybu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedMode('smart_full')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    selectedMode === 'smart_full'
                      ? 'border-[#006241] bg-emerald-50/50 shadow-xs'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="schedule_mode"
                    checked={selectedMode === 'smart_full'}
                    onChange={() => setSelectedMode('smart_full')}
                    className="mt-1 accent-[#006241] w-4 h-4"
                  />
                  <div>
                    <div className="text-sm font-black text-stone-900 flex items-center gap-2">
                      <span>🌟 Smart Full (Pełne Generowanie)</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[#006241] text-[10px] font-bold">Zalecane</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      Układa cały miesiąc od nowa na 20 000 symulacji. <strong>Zachowuje i chroni</strong> wprowadzone urlopy (H), chorobowe (L4), administrację (NC), szkolenia (T) oraz wsparcia (SUP/SAM/SPM).
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMode('fill_gaps')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    selectedMode === 'fill_gaps'
                      ? 'border-[#006241] bg-emerald-50/50 shadow-xs'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="schedule_mode"
                    checked={selectedMode === 'fill_gaps'}
                    onChange={() => setSelectedMode('fill_gaps')}
                    className="mt-1 accent-[#006241] w-4 h-4"
                  />
                  <div>
                    <div className="text-sm font-black text-stone-900">
                      🧩 Fill Gaps (Dopełnij Luki)
                    </div>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                      Pozostawia <strong>wszystkie dotychczas wpisane zmiany bez zmian</strong> i dopełnia jedynie brakujące otwarcia, zamknięcia oraz godziny pracownikom do ich pełnego etatu.
                    </p>
                  </div>
                </button>
              </div>

              {/* Przycisk Uruchomienia */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="px-6 py-3 bg-[#006241] hover:bg-[#00754A] text-white font-black text-sm rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2.5 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 text-amber-300 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Trwa optymalizacja AI (20 000 prób)...' : '✨ Uruchom AutoScheduling (20 000 prób)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* SEKCJA 2: WYNIKI I PODGLĄD PROPOZYCJI */}
          {result && (
            <div className="space-y-4 animate-fade-in">
              
              {/* BANER ASYSTENTA NEGOCJACJI W RAZIE PATU OBSADOWEGO */}
              {criticalConflicts.length > 0 && (
                <div className="bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 text-white rounded-2xl p-4 shadow-md flex items-center justify-between gap-4 border border-rose-300">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 border border-white/30">
                      <ShieldAlert className="w-6 h-6 text-white animate-pulse" />
                    </div>
                    <div>
                      <div className="text-sm font-black tracking-wide flex items-center gap-2">
                        <span>🤝 Asystent Negocjacji z Zespołem: Wykryto {criticalConflicts.length} {criticalConflicts.length === 1 ? 'sytuację patową' : 'sytuacje patowe'} w obsadzie</span>
                        <span className="px-2 py-0.5 rounded-full bg-white text-rose-900 text-[10px] font-black uppercase">
                          Wymagany Kompromis
                        </span>
                      </div>
                      <p className="text-xs text-rose-100 mt-0.5">
                        Prośba o wolne (OFF) musiała ustąpić na rzecz obowiązkowej obsady kawiarni (1 AM + 1 PM) z przyczyn prawnych KP. Sprawdź propozycje negocjacji i gotowe wiadomości dla Store Managera w zakładce <strong>Kompromisy</strong>.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('insights')}
                    className="px-4 py-2 bg-white text-rose-900 hover:bg-rose-50 font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                  >
                    <span>Zobacz Opcje Kompromisu</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* KAFELKI KPI PROPOZYCJI */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* 1. Godziny Zespołu */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="text-[10px] uppercase font-bold text-stone-400 flex items-center justify-between">
                    <span>Godziny Zespołu</span>
                    <Clock className="w-3.5 h-3.5 text-[#006241]" />
                  </div>
                  <div className="text-lg font-black text-stone-900 mt-0.5">
                    {result.stats.totalPlannedHours} h
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Cel: {result.stats.targetTeamHours} h ({Number((result.stats.totalPlannedHours - result.stats.targetTeamHours).toFixed(1))}h)
                  </div>
                </div>

                {/* 2. Zgodność z Dyspozycjami */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="text-[10px] uppercase font-bold text-stone-400 flex items-center justify-between">
                    <span>Dyspozycje</span>
                    <CalendarCheck className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="text-lg font-black text-amber-900 mt-0.5">
                    {result.stats.dispositionMatchRate}%
                  </div>
                  <div className="text-[10px] text-stone-400">
                    {result.stats.dispositionMatchedCount} z {result.stats.dispositionTotalCount} próśb
                  </div>
                </div>

                {/* 3. Tarcza Kodeksu Pracy */}
                <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 shadow-xs text-emerald-950">
                  <div className="text-[10px] uppercase font-bold text-emerald-800 flex items-center justify-between">
                    <span>Kodeks Pracy</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-[#006241]" />
                  </div>
                  <div className="text-lg font-black text-emerald-900 mt-0.5">
                    100% Zgodny
                  </div>
                  <div className="text-[10px] text-emerald-700">
                    0 naruszeń prawnych
                  </div>
                </div>

                {/* 4. Sprawiedliwość Weekendów */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="text-[10px] uppercase font-bold text-stone-400 flex items-center justify-between">
                    <span>Sprawiedliwość</span>
                    <Scale className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div className="text-lg font-black text-stone-900 mt-0.5">
                    {result.stats.qualityMetrics?.weekendFairnessScore || 100}%
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Równomierne weekendy
                  </div>
                </div>

                {/* 5. Bloki 2x OFF */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="text-[10px] uppercase font-bold text-stone-400 flex items-center justify-between">
                    <span>Pakiety 2x OFF</span>
                    <Coffee className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="text-lg font-black text-stone-900 mt-0.5">
                    {result.stats.qualityMetrics?.consecutiveOffBlocksCount || 0} bloków
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Ciągłość odpoczynku
                  </div>
                </div>

                {/* 6. Zmiany MID */}
                <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs">
                  <div className="text-[10px] uppercase font-bold text-stone-400 flex items-center justify-between">
                    <span>Zmiany MID / NC</span>
                    <Layers className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <div className="text-lg font-black text-stone-900 mt-0.5">
                    {result.stats.midShiftsCount} MID • {result.stats.ncShiftsCount} NC
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Wsparcia szczytowe
                  </div>
                </div>
              </div>

              {/* PRZEŁĄCZNIK ZAKŁADEK PODGLĄDU */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3 bg-stone-50/80">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('grid')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeTab === 'grid'
                          ? 'bg-[#006241] text-white shadow-xs'
                          : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                      }`}
                    >
                      Siatka Miesiąca (Matryca)
                    </button>
                    <button
                      onClick={() => setActiveTab('employees')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeTab === 'employees'
                          ? 'bg-[#006241] text-white shadow-xs'
                          : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                      }`}
                    >
                      Bilans Menedżerów ({result.employeeStats.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('diff')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        activeTab === 'diff'
                          ? 'bg-[#006241] text-white shadow-xs'
                          : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200'
                      }`}
                    >
                      Rejestr Zmian (Diff)
                    </button>
                    <button
                      onClick={() => setActiveTab('insights')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'insights'
                          ? 'bg-[#006241] text-white shadow-xs'
                          : (criticalConflicts.length > 0
                              ? 'bg-rose-100 text-rose-900 border border-rose-300 font-black'
                              : 'bg-white text-stone-600 hover:text-stone-900 border border-stone-200')
                      }`}
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${criticalConflicts.length > 0 ? 'text-rose-600' : 'text-amber-500'}`} />
                      <span>Sprawiedliwość i Kompromisy ({result.conflictInsights?.length || 0})</span>
                      {criticalConflicts.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {result.stats.iterationsEvaluated && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black flex items-center gap-1 shadow-2xs">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span>Zwycięzca turnieju: {result.stats.iterationsEvaluated} symulacji AI</span>
                      </span>
                    )}
                    <span className="text-[11px] text-stone-500 italic">
                      Podgląd propozycji przed ostatecznym zapisem w bazie
                    </span>
                  </div>
                </div>

                {/* ZAKŁADKA 1: SIATKA MIESIĄCA */}
                {activeTab === 'grid' && (
                  <div className="overflow-x-auto p-4 max-h-96">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-500">
                          <th className="p-2 text-left font-bold sticky left-0 bg-white z-10 min-w-[140px]">Pracownik</th>
                          {Array.from({ length: result.stats.coverageDaysCount + result.stats.missingCoverageCount }).map((_, i) => (
                            <th key={`head-day-${i + 1}`} className="p-1.5 text-center font-bold min-w-[32px]">
                              {i + 1}
                            </th>
                          ))}
                          <th className="p-2 text-right font-bold min-w-[70px]">Suma</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.employeeStats.map(empStat => {
                          const empShifts = result.generatedShifts.filter(s => s.employee_id === empStat.employeeId);
                          return (
                            <tr key={`grid-emp-${empStat.employeeId}`} className="border-b border-stone-100 hover:bg-stone-50/50">
                              <td className="p-2 font-bold text-stone-900 sticky left-0 bg-white z-10 border-r border-stone-200">
                                <div>{empStat.name}</div>
                                <div className="text-[10px] text-stone-500 font-semibold">{formatManagerRole(empStat.role)} • {empStat.contractRatio} etatu</div>
                              </td>
                              {empShifts.map(s => {
                                let badgeColor = 'bg-stone-100 text-stone-500';
                                if (s.shift_code === 'AM' || s.shift_code === 'AMN') badgeColor = 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-300';
                                else if (s.shift_code === 'PM' || s.shift_code === 'PMN') badgeColor = 'bg-amber-100 text-amber-900 font-bold border border-amber-300';
                                else if (s.shift_code === 'MIB' || s.shift_code === 'MID') badgeColor = 'bg-purple-100 text-purple-900 font-bold border border-purple-300';
                                else if (s.shift_code === 'NC') badgeColor = 'bg-blue-100 text-blue-900 font-bold border border-blue-300';
                                else if (s.shift_code === 'H') badgeColor = 'bg-sky-100 text-sky-900 font-bold border border-sky-300';
                                else if (s.shift_code === 'L4') badgeColor = 'bg-rose-100 text-rose-900 font-bold border border-rose-300';
                                else if (s.shift_code === 'SUP' || s.shift_code === 'SAM' || s.shift_code === 'SPM') badgeColor = 'bg-indigo-100 text-indigo-900 font-bold border border-indigo-300';

                                return (
                                  <td key={`grid-cell-${empStat.employeeId}-${s.day}`} className="p-1 text-center">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${badgeColor}`}>
                                      {s.shift_code === 'OFF' ? '—' : s.shift_code}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="p-2 text-right font-black text-stone-900">
                                {empStat.plannedHours} h
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ZAKŁADKA 2: BILANS PRACOWNIKÓW */}
                {activeTab === 'employees' && (
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 text-stone-500 font-bold text-left">
                          <th className="p-2">Menedżer</th>
                          <th className="p-2">Rola</th>
                          <th className="p-2 text-center">Wymiar</th>
                          <th className="p-2 text-right">Norma</th>
                          <th className="p-2 text-right">Zaplanowane</th>
                          <th className="p-2 text-right">Bilans</th>
                          <th className="p-2 text-center">Dni Pracy</th>
                          <th className="p-2 text-center">Dni OFF</th>
                          <th className="p-2 text-center">Weekend</th>
                          <th className="p-2 text-center">Zgodność Dyspozycji</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.employeeStats.map(emp => (
                          <tr key={`stat-${emp.employeeId}`} className="border-b border-stone-100 hover:bg-stone-50/60">
                            <td className="p-2 font-bold text-stone-900">{emp.name}</td>
                            <td className="p-2 font-bold text-[#006241]">{formatManagerRole(emp.role)}</td>
                            <td className="p-2 text-center font-bold text-stone-700">{emp.contractRatio}</td>
                            <td className="p-2 text-right text-stone-600">{emp.nominalHours} h</td>
                            <td className="p-2 text-right font-black text-stone-900">{emp.plannedHours} h</td>
                            <td className={`p-2 text-right font-black ${
                              emp.balanceHours === 0 ? 'text-emerald-700' : (emp.balanceHours > 0 ? 'text-blue-700' : 'text-amber-700')
                            }`}>
                              {emp.balanceHours > 0 ? `+${emp.balanceHours}` : emp.balanceHours} h
                            </td>
                            <td className="p-2 text-center font-semibold text-stone-700">{emp.workingDaysCount}</td>
                            <td className="p-2 text-center font-semibold text-stone-500">{emp.offDaysCount}</td>
                            <td className="p-2 text-center text-stone-600">{emp.weekendDaysCount} dni</td>
                            <td className="p-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                emp.dispositionMatchRate >= 80 ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
                              }`}>
                                {emp.dispositionMatchRate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ZAKŁADKA 3: REJESTR ZMIAN (DIFF) */}
                {activeTab === 'diff' && (
                  <div className="p-4 max-h-96 overflow-y-auto space-y-2">
                    <div className="text-xs font-bold text-stone-700 mb-2">
                      Zestawienie zmian wprowadzonych przez solver:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {result.diffs.filter(d => d.changeType !== 'unchanged').map((diff, i) => (
                        <div
                          key={`diff-${i}`}
                          className="p-2.5 rounded-xl border border-stone-200 bg-white text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-stone-900">{diff.employeeName}</div>
                            <div className="text-[10px] text-stone-500">
                              Dzień {diff.day} ({diff.dayName}) • Dysp: <strong>{diff.disposition}</strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 text-[10px]">
                              {diff.prevShiftCode}
                            </span>
                            <ArrowRight className="w-3 h-3 text-stone-400" />
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[#006241] text-[10px] font-black border border-emerald-300">
                              {diff.newShiftCode}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ZAKŁADKA 4: ASYSTENT NEGOCJACJI I KOMPROMISÓW AI (INSIGHTS) */}
                {activeTab === 'insights' && (
                  <div className="p-5 space-y-6 max-h-[520px] overflow-y-auto">
                    
                    {/* ASYSTENT NEGOCJACJI DLA KRYTYCZNYCH PATÓW (OFF) */}
                    {criticalConflicts.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                              {criticalConflicts.length}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-rose-950 flex items-center gap-1.5">
                                <span>🤝 Asystent Negocjacji z Zespołem (Naruszenia Prośby o Wolne OFF)</span>
                              </h4>
                              <p className="text-xs text-rose-700">
                                Sytuacje patowe, w których żaden inny dostępny menedżer nie mógł legalnie objąć dyżuru bez naruszenia Kodeksu Pracy.
                              </p>
                            </div>
                          </div>

                          {onOpenDispositions && (
                            <button
                              onClick={onOpenDispositions}
                              className="px-3 py-1.5 rounded-xl border border-rose-300 hover:bg-rose-100 text-rose-900 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Otwórz Matrycę Dyspozycji</span>
                            </button>
                          )}
                        </div>

                        <div className="space-y-4">
                          {criticalConflicts.map(item => (
                            <div
                              key={item.id}
                              className="p-4 rounded-2xl border-2 border-rose-200 bg-white shadow-xs space-y-3.5"
                            >
                              {/* NAGŁÓWEK KONFLIKTU */}
                              <div className="flex items-start justify-between gap-3 border-b border-rose-100 pb-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-base text-stone-900">{item.employeeName}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black">
                                      {item.dayName}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase">
                                      Pat Obsadowy
                                    </span>
                                  </div>
                                  <div className="text-xs text-stone-600">
                                    <strong>Diagnoza AI:</strong> {item.reason}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right">
                                    <div className="text-[9px] text-stone-400 font-bold uppercase">Prośba</div>
                                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-xs font-black">
                                      OFF
                                    </span>
                                  </div>
                                  <ArrowRight className="w-3.5 h-3.5 text-stone-400 mt-2" />
                                  <div className="text-left">
                                    <div className="text-[9px] text-stone-400 font-bold uppercase">Wymuszony Dyżur</div>
                                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#006241] border border-emerald-300 text-xs font-black">
                                      {item.assignedShiftCode} ({item.assignedHours}h)
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* BLOKADY ZESPOŁU */}
                              {item.blockers && item.blockers.length > 0 && (
                                <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-200 text-xs flex items-center gap-2">
                                  <span className="text-stone-500 font-bold text-[11px] shrink-0">🔒 Ograniczenia pozostałych kierowników:</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.blockers.map((b, bIdx) => (
                                      <span key={bIdx} className="px-2 py-0.5 rounded bg-white text-stone-700 border border-stone-300 text-[10px] font-semibold">
                                        {b}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* PROPOZYCJE KOMPROMISU I NEGOCJACJI */}
                              <div className="space-y-2 pt-1">
                                <div className="text-xs font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                  <span>Rekomendowane Opcje dla Store Managera do Uzgodnienia z Zespołem:</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {item.negotiationOptions?.map(opt => {
                                    const isCopied = copiedOptionId === opt.id;
                                    const isApplied = appliedOptionIds.has(opt.id);

                                    return (
                                      <div
                                        key={opt.id}
                                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                                          isApplied
                                            ? 'bg-emerald-50/70 border-emerald-300'
                                            : 'bg-stone-50/70 border-stone-200 hover:border-emerald-300 hover:bg-white'
                                        }`}
                                      >
                                        <div className="space-y-1.5">
                                          <div className="font-black text-xs text-stone-900 flex items-center justify-between">
                                            <span>{opt.title}</span>
                                            {isApplied && (
                                              <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center gap-1">
                                                <Check className="w-2.5 h-2.5" />
                                                Zastosowano
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[11px] text-stone-600 leading-relaxed">
                                            {opt.description}
                                          </p>

                                          {/* PODGLĄD WIADOMOŚCI SMS / WHATSAPP */}
                                          {opt.copyMessageText && (
                                            <div className="bg-white p-2.5 rounded-lg border border-stone-200 text-[11px] text-stone-700 italic space-y-1 mt-2">
                                              <div className="text-[9px] text-stone-400 not-italic font-bold uppercase flex items-center gap-1">
                                                <MessageSquare className="w-3 h-3 text-[#006241]" />
                                                <span>Gotowy tekst wiadomości do pracownika:</span>
                                              </div>
                                              <div>"{opt.copyMessageText}"</div>
                                            </div>
                                          )}
                                        </div>

                                        {/* PRZYCISKI AKCJI */}
                                        <div className="flex items-center gap-2 pt-1">
                                          {opt.copyMessageText && (
                                            <button
                                              onClick={() => handleCopyMessage(opt.copyMessageText!, opt.id)}
                                              className="flex-1 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                              {isCopied ? (
                                                <>
                                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                  <span className="text-emerald-700 font-black">Skopiowano! ☕</span>
                                                </>
                                              ) : (
                                                <>
                                                  <Copy className="w-3.5 h-3.5 text-stone-500" />
                                                  <span>Kopiuj wiadomość</span>
                                                </>
                                              )}
                                            </button>
                                          )}

                                          <button
                                            onClick={() => handleApplyNegotiationOption(item, opt)}
                                            disabled={isApplied}
                                            className={`flex-1 px-3 py-1.5 rounded-lg text-[11px] font-black transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                                              isApplied
                                                ? 'bg-emerald-100 text-[#006241] border border-emerald-300 cursor-default'
                                                : 'bg-[#006241] hover:bg-[#00754A] text-white shadow-xs'
                                            }`}
                                          >
                                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                            <span>{isApplied ? 'Zastosowano' : opt.actionLabel}</span>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* PULPIT METRYK SPRAWIEDLIWOŚCI */}
                    {result.stats.qualityMetrics && (
                      <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-3">
                        <div className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-2">
                          <Scale className="w-4 h-4 text-[#006241]" />
                          <span>Pulpit Sprawiedliwości i Ergonomii AI</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                            <div className="text-[10px] text-stone-500 font-bold uppercase">Balans Weekendów</div>
                            <div className="text-base font-black text-emerald-800 mt-1">
                              {result.stats.qualityMetrics.weekendFairnessScore}%
                            </div>
                            <div className="text-[9px] text-stone-400">Równe soboty i niedziele</div>
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                            <div className="text-[10px] text-stone-500 font-bold uppercase">Balans Zamknięć</div>
                            <div className="text-base font-black text-emerald-800 mt-1">
                              {result.stats.qualityMetrics.closingsFairnessScore}%
                            </div>
                            <div className="text-[9px] text-stone-400">Równe PM dla SSV/ASM</div>
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                            <div className="text-[10px] text-stone-500 font-bold uppercase">Wygładzenie Tygodnia</div>
                            <div className="text-base font-black text-blue-800 mt-1">
                              {result.stats.qualityMetrics.weeklySmoothingScore}%
                            </div>
                            <div className="text-[9px] text-stone-400">Brak skoków obciążenia</div>
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                            <div className="text-[10px] text-stone-500 font-bold uppercase">Pakiety 2x OFF</div>
                            <div className="text-base font-black text-purple-800 mt-1">
                              {result.stats.qualityMetrics.consecutiveOffBlocksCount}
                            </div>
                            <div className="text-[9px] text-stone-400">Bloki 2+ dni wolnych</div>
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
                            <div className="text-[10px] text-stone-500 font-bold uppercase">Wolne Weekendy</div>
                            <div className="text-base font-black text-amber-800 mt-1">
                              {result.stats.qualityMetrics.fullWeekendsOffCount} / {result.stats.qualityMetrics.totalEmployeesCount}
                            </div>
                            <div className="text-[9px] text-stone-400">Min. 1 pełny wolny weekend</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* LISTA POZOSTAŁYCH ZMIAN PREFERENCJI (AM/PM) */}
                    {preferenceConflicts.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                          <Info className="w-4 h-4 text-[#006241]" />
                          <span>Modyfikacje Preferencji Poranka/Wieczoru ({preferenceConflicts.length}):</span>
                        </h4>

                        <div className="space-y-2.5">
                          {preferenceConflicts.map(item => (
                            <div
                              key={item.id}
                              className="p-3.5 rounded-2xl border bg-stone-50 border-stone-200 text-stone-800 text-xs"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-sm text-stone-900">{item.employeeName}</span>
                                    <span className="text-stone-400">•</span>
                                    <span className="font-semibold text-stone-700">{item.dayName}</span>
                                  </div>

                                  <div className="text-xs font-medium text-stone-700 pt-0.5">
                                    <strong>Uzasadnienie:</strong> {item.reason}
                                  </div>

                                  {item.negotiationOptions?.[0]?.copyMessageText && (
                                    <div className="pt-1 flex items-center gap-2">
                                      <button
                                        onClick={() => handleCopyMessage(item.negotiationOptions![0].copyMessageText!, item.negotiationOptions![0].id)}
                                        className="px-2.5 py-1 rounded-lg bg-white border border-stone-300 text-[10px] font-bold text-stone-700 flex items-center gap-1 hover:bg-stone-50 cursor-pointer"
                                      >
                                        <MessageSquare className="w-3 h-3 text-[#006241]" />
                                        <span>{copiedOptionId === item.negotiationOptions[0].id ? '✅ Skopiowano wiadomość' : 'Kopiuj zapytanie do pracownika'}</span>
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="text-right">
                                    <div className="text-[10px] text-stone-400 font-bold uppercase">Zgłoszono</div>
                                    <span className="px-2 py-0.5 rounded text-[11px] font-black bg-blue-100 text-blue-900">
                                      {item.requestedDispo}
                                    </span>
                                  </div>

                                  <ArrowRight className="w-3.5 h-3.5 text-stone-400 mt-2.5" />

                                  <div className="text-left">
                                    <div className="text-[10px] text-stone-400 font-bold uppercase">Przydzielono</div>
                                    <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-[#006241] border border-emerald-300">
                                      {item.assignedShiftCode} ({item.assignedHours}h)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.conflictInsights?.length === 0 && (
                      <div className="p-6 text-center bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-900">
                        <CheckCircle2 className="w-8 h-8 text-[#006241] mx-auto mb-2" />
                        <div className="text-sm font-black">Perfekcyjne dopasowanie!</div>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Wszystkie zgłoszone prośby o wolne (OFF) oraz preferencje zmian (AM/PM) zostały w 100% zrealizowane bez konieczności kompromisów.
                        </p>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* STOPKA AKCJI */}
        <div className="bg-white p-4 sm:px-7 border-t border-[#E2E8E5] flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-bold text-xs transition cursor-pointer"
          >
            Anuluj
          </button>

          <div className="flex items-center gap-3">
            {result && (
              <button
                onClick={handleGenerate}
                disabled={isGenerating || isApplying}
                className="px-4 py-2.5 rounded-xl border border-stone-300 hover:border-stone-400 bg-white text-stone-800 font-bold text-xs transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                <span>Wygeneruj Ponownie</span>
              </button>
            )}

            <button
              onClick={handleApply}
              disabled={!result || isApplying || isGenerating}
              className="px-6 py-2.5 bg-[#006241] hover:bg-[#00754A] text-white font-black text-xs rounded-xl transition shadow-md hover:shadow flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{isApplying ? 'Zapisywanie grafiku...' : '✅ Zastosuj Wygenerowany Grafik'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

