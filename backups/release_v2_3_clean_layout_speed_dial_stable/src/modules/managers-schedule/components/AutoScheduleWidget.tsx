import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Sparkles,
  CheckCircle2,
  X,
  Layers,
  ArrowRight,
  Clock,
  ShieldCheck,
  CalendarCheck,
  Scale,
  RefreshCw,
  Zap,
  Info,
  History,
  FileSpreadsheet,
  Calendar,
  ChevronRight,
  ChevronLeft,
  CalendarDays
} from 'lucide-react';
import {
  ManagerScheduleMonthData,
  ManagerScheduleShift
} from '../../../types/index';
import {
  AutoSchedulerEngine,
  AutoScheduleOptions,
  AutoScheduleResult,
  AutoScheduleProgress
} from '../services/autoSchedulerEngine';

interface AutoScheduleWidgetProps {
  data: ManagerScheduleMonthData;
  onApplySchedule: (generatedShifts: ManagerScheduleShift[]) => Promise<void>;
  prevMonthShifts?: ManagerScheduleShift[];
  disabled?: boolean;
  onOpenProposalModal?: (result: AutoScheduleResult) => void;
  onOpenDispositionsModal?: () => void;
  onOpenVersionModal?: () => void;
  onExportExcel?: () => void;
  onToggleTorView?: () => void;
  isTorActive?: boolean;
  isPublished?: boolean;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onCurrentMonth?: () => void;
  onRefresh?: () => void;
}

export const AutoScheduleWidget: React.FC<AutoScheduleWidgetProps> = ({
  data,
  onApplySchedule,
  prevMonthShifts = [],
  disabled = false,
  onOpenProposalModal,
  onOpenDispositionsModal,
  onOpenVersionModal,
  onExportExcel,
  onToggleTorView,
  isTorActive = false,
  isPublished = false,
  onPrevMonth,
  onNextMonth,
  onCurrentMonth,
  onRefresh
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAiSubmenuOpen, setIsAiSubmenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<AutoScheduleProgress | null>(null);
  const [result, setResult] = useState<AutoScheduleResult | null>(null);
  const [showFinishedToast, setShowFinishedToast] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Zgromadź istniejące zmiany z wierszy
  const existingShiftsList = useMemo(() => {
    const list: ManagerScheduleShift[] = [];
    data.rows.forEach(r => {
      Object.values(r.shifts).forEach(s => {
        list.push(s);
      });
    });
    return list;
  }, [data.rows]);

  // Zmapuj dyspozycje menedżerów
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

  // Zamknij menu przy kliknięciu poza obszarem
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
        setIsAiSubmenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Uruchomienie generowania w tle z 20 000 prób
  const handleStartGeneration = (mode: 'smart_full' | 'fill_gaps') => {
    setIsMenuOpen(false);
    setIsAiSubmenuOpen(false);
    setIsGenerating(true);
    setProgress({
      currentRound: 0,
      totalRounds: 2000,
      percent: 0,
      bestDispoMatchRate: 0,
      bestViolationsCount: 0,
      bestPlannedHours: 0,
      targetTeamHours: 0,
      elapsedMs: 0
    });
    setResult(null);
    setShowFinishedToast(false);

    const options: AutoScheduleOptions = {
      mode,
      allocateMidInPeaks: true,
      respectDispositions: true,
      preserveFixedShifts: true,
      preferConsecutiveOffDays: true,
      balanceFairness: true,
      smoothWeeklyHours: true,
      iterationsCount: 2000
    };

    // Uruchamiamy asynchronicznie w tle (nie blokuje renderowania grafiku)
    setTimeout(async () => {
      try {
        const res = await AutoSchedulerEngine.generateScheduleAsync(
          data.year,
          data.month,
          data.employees,
          data.shiftDefinitions,
          existingShiftsList,
          dispositionsByEmployee,
          options,
          prevMonthShifts,
          p => setProgress(p)
        );
        setResult(res);
        setShowFinishedToast(true);
        if (onOpenProposalModal) {
          onOpenProposalModal(res);
        }
      } catch (err) {
        console.error('Błąd generowania w tle:', err);
        alert('Wystąpił błąd podczas generowania grafiku.');
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  const handleWidgetClick = () => {
    if (disabled) return;
    if (isGenerating) return;
    setIsMenuOpen(prev => !prev);
  };

  // Parametry okręgu SVG (promień r=27, obwód ~169.64)
  const radius = 27;
  const circumference = 2 * Math.PI * radius;
  const currentPercent = progress ? Math.min(100, Math.max(0, progress.percent)) : 0;
  const strokeDashoffset = circumference - (circumference * currentPercent) / 100;

  return (
    <div ref={menuRef} className="fixed right-6 bottom-7 z-40 flex items-center flex-row-reverse select-none font-sans">
      {/* GŁÓWNY PRZYCISK: PŁYWAJĄCE LOGO STARBUCKS Z ZEGAREM AI */}
      <div className="relative group">
        
        {/* SVG Circular Progress Ring (0% -> 100% clockwise) */}
        {isGenerating && (
          <svg
            className="absolute -inset-2 w-[76px] h-[76px] -rotate-90 pointer-events-none drop-shadow-md z-10"
            viewBox="0 0 76 76"
          >
            {/* Tło toru */}
            <circle
              cx="38"
              cy="38"
              r={radius}
              stroke="#D1E7DD"
              strokeWidth="5"
              fill="none"
              opacity="0.5"
            />
            {/* Gradient dla paska postępu */}
            <defs>
              <linearGradient id="starbucksSpeedDialProgress" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="50%" stopColor="#CBA258" />
                <stop offset="100%" stopColor="#006241" />
              </linearGradient>
            </defs>
            {/* Wypełniający się pierścień zgodnie z ruchem wskazówek zegara */}
            <circle
              cx="38"
              cy="38"
              r={radius}
              stroke="url(#starbucksSpeedDialProgress)"
              strokeWidth="5"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-150 ease-out"
            />
          </svg>
        )}

        {/* Gotowy wynik - zielony pulsujący pierścień */}
        {!isGenerating && result && (
          <div className="absolute -inset-2 rounded-full bg-emerald-400/30 animate-ping pointer-events-none" />
        )}

        {/* Sam przycisk z Logo Starbucks Siren */}
        <button
          type="button"
          onClick={handleWidgetClick}
          disabled={disabled}
          aria-label="Starbucks Navigation Hub"
          title="Starbucks Quick Navigation Hub — Kliknij aby rozwinąć narzędzia"
          className={`relative w-15 h-15 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-2xl border-2 ${
            disabled
              ? 'bg-stone-300 text-stone-500 cursor-not-allowed opacity-50 shadow-none border-stone-400'
              : result && !isGenerating
              ? 'bg-[#006241] text-white border-amber-300 ring-4 ring-emerald-400/80 hover:scale-108 active:scale-95'
              : isGenerating
              ? 'bg-[#1E3932] text-amber-300 border-emerald-400 shadow-emerald-950/50 cursor-wait'
              : isMenuOpen
              ? 'bg-[#1E3932] text-white border-amber-400 ring-2 ring-emerald-500/50 scale-105'
              : 'bg-gradient-to-br from-[#006241] via-[#00754A] to-[#1E3932] text-white border-[#CBA258]/80 hover:border-amber-300 hover:shadow-emerald-900/40 hover:scale-108 active:scale-95'
          }`}
        >
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center">
              <span className="text-[11px] font-black font-mono tracking-tighter text-amber-300">
                {currentPercent}%
              </span>
            </div>
          ) : (
            <div className="relative flex items-center justify-center">
              {/* Ikona Starbucks Siren Logo */}
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-lg shadow-inner">
                <span>☕</span>
              </div>
              {/* Złota mikro-gwiazdka */}
              <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
            </div>
          )}

          {/* Dyskretna pigułka statusu gotowości */}
          {!isGenerating && result && (
            <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-black rounded-full border border-white shadow-xs animate-pulse">
              AI READY
            </span>
          )}
        </button>
      </div>

      {/* PASEK / ETYKIETA PODCZAS GENEROWANIA W TLE */}
      {isGenerating && progress && (
        <div className="mr-3.5 bg-[#1E3932]/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-2xl border border-emerald-500/40 shadow-xl flex items-center gap-2.5 animate-fade-in text-xs">
          <RefreshCw className="w-3.5 h-3.5 text-amber-300 animate-spin shrink-0" />
          <div className="leading-tight">
            <div className="font-bold text-[11px] text-emerald-100 flex items-center gap-1.5">
              <span>Optymalizacja AI w tle</span>
              <span className="text-amber-300 font-mono font-black">{currentPercent}%</span>
            </div>
            <div className="text-[10px] text-stone-300 font-mono">
              {progress.currentRound.toLocaleString()} / 20 000 prób
            </div>
          </div>
        </div>
      )}

      {/* DYMEK INFORMACYJNY PO SKOŃCZENIU */}
      {showFinishedToast && result && !isGenerating && (
        <div className="mr-3.5 bg-white text-stone-900 px-4 py-2.5 rounded-2xl border border-emerald-300 shadow-2xl flex items-center gap-3 animate-fade-in text-xs max-w-xs">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0 font-bold">
            ✨
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-stone-900 text-xs truncate">
              Grafik gotowy (20 000 prób)!
            </div>
            <div className="text-[10px] text-stone-500">
              Dyspo: <strong>{result.stats.dispositionMatchRate}%</strong> • KP: <strong>100%</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowFinishedToast(false);
              if (onOpenProposalModal) onOpenProposalModal(result);
            }}
            className="px-2.5 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white text-[11px] font-bold rounded-lg cursor-pointer transition shrink-0"
          >
            Zobacz
          </button>
          <button
            type="button"
            onClick={() => setShowFinishedToast(false)}
            className="text-stone-400 hover:text-stone-600 cursor-pointer p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ROZWIJANY SPEED-DIAL Z MINI-IKONKAMI SZYBKIEJ NAWIGACJI */}
      {isMenuOpen && !isGenerating && (
        <div className="absolute right-full mr-3.5 bottom-0 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-stone-200 p-3 z-50 animate-scale-in text-stone-800 flex flex-col gap-2.5 min-w-[260px]">
          
          {/* PASEK SZYBKIEJ NAWIGACJI MIESIĘCY (‹ [MTD] ›) */}
          <div className="bg-[#F7F9F8] p-2 rounded-2xl border border-[#E2E8E5] flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (onPrevMonth) onPrevMonth();
              }}
              title="Poprzedni Miesiąc (LM)"
              className="w-8 h-8 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (onCurrentMonth) onCurrentMonth();
              }}
              title="Przejdź do Bieżącego Miesiąca (MTD)"
              className="px-3 py-1.5 rounded-xl bg-[#006241] hover:bg-[#00754A] text-white text-xs font-black flex items-center gap-1.5 shadow-2xs transition cursor-pointer active:scale-95"
            >
              <span>{data.monthName} {data.year}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (onNextMonth) onNextMonth();
              }}
              title="Następny Miesiąc (NM)"
              className="w-8 h-8 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center transition cursor-pointer shadow-2xs active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* JEŚLI MAMY GOTOWĄ PROPOZYCJĘ AI */}
          {result && (
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                if (onOpenProposalModal) onOpenProposalModal(result);
              }}
              className="p-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-[#006241] text-white flex items-center justify-between cursor-pointer shadow-md hover:shadow-lg group"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                <div className="text-left leading-tight">
                  <div className="text-xs font-black">AI Propozycja Gotowa</div>
                  <div className="text-[9.5px] text-emerald-100">Dyspo: {result.stats.dispositionMatchRate}% • 20k prób</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* RZĄD GŁÓWNYCH MINI-IKONEK SZYBKIEJ AKCJI (SPEED DIAL) */}
          <div className="grid grid-cols-4 gap-2">
            
            {/* 1. AUTOSCHEDULING AI */}
            <button
              type="button"
              onClick={() => setIsAiSubmenuOpen(prev => !prev)}
              title="AutoScheduling AI (20 000 prób w tle)"
              className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                isAiSubmenuOpen
                  ? 'bg-emerald-50 border-[#006241] text-[#006241] shadow-inner font-bold'
                  : 'bg-white hover:bg-emerald-50/50 border-stone-200 text-stone-700 hover:text-[#006241] shadow-2xs'
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#006241] flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4 text-[#006241]" />
              </div>
              <span className="text-[10px] font-black tracking-tight">Auto AI</span>
            </button>

            {/* 2. DYSPOZYCJE */}
            {onOpenDispositionsModal && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenDispositionsModal();
                }}
                title="Matryca Dyspozycji (Zbiorcze wklejanie z Excela)"
                className="p-2.5 rounded-2xl bg-white hover:bg-amber-50/60 border border-stone-200 text-stone-700 hover:text-amber-900 flex flex-col items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <CalendarCheck className="w-4 h-4 text-amber-700" />
                </div>
                <span className="text-[10px] font-bold tracking-tight">Dyspo</span>
              </button>
            )}

            {/* 3. WIDOK TOR */}
            {onToggleTorView && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onToggleTorView();
                }}
                title={isTorActive ? 'Przełącz na Grafik Miesięczny' : 'Przełącz na TOR (Rozliczenie Kwartalne)'}
                className={`p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                  isTorActive
                    ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-black'
                    : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700 shadow-2xs'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center font-bold">
                  <Scale className="w-4 h-4 text-[#CBA258]" />
                </div>
                <span className="text-[10px] font-bold tracking-tight">{isTorActive ? 'Siatka' : 'TOR'}</span>
              </button>
            )}

            {/* 4. HISTORIA WERSJI */}
            {onOpenVersionModal && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenVersionModal();
                }}
                title="Historia Wersji i Publikacja (art. 129 KP)"
                className="p-2.5 rounded-2xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 hover:text-[#006241] flex flex-col items-center justify-center gap-1 transition cursor-pointer shadow-2xs"
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                  isPublished ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-[#006241]'
                }`}>
                  <History className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold tracking-tight">Wersje</span>
              </button>
            )}

          </div>

          {/* ROZWINIĘTE POD-MENU AUTOSCHEDULING AI (2 OPCJE) */}
          {isAiSubmenuOpen && (
            <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[#006241]">
                <span>Wybierz Tryb (20 000 Prób AI):</span>
                <span className="px-1.5 py-0.2 bg-white text-[#006241] rounded-full border border-emerald-200 text-[9px]">w tle</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStartGeneration('smart_full')}
                  className="p-2.5 rounded-xl bg-white hover:bg-[#006241] hover:text-white border border-emerald-200 text-stone-800 text-left transition cursor-pointer shadow-2xs group"
                >
                  <div className="text-xs font-black flex items-center justify-between">
                    <span>🌟 Smart Full</span>
                  </div>
                  <div className="text-[9px] text-stone-500 group-hover:text-emerald-100 mt-0.5">
                    Pełne od zera
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartGeneration('fill_gaps')}
                  className="p-2.5 rounded-xl bg-white hover:bg-[#006241] hover:text-white border border-emerald-200 text-stone-800 text-left transition cursor-pointer shadow-2xs group"
                >
                  <div className="text-xs font-black flex items-center justify-between">
                    <span>🧩 Fill Gaps</span>
                  </div>
                  <div className="text-[9px] text-stone-500 group-hover:text-emerald-100 mt-0.5">
                    Dopełnij luki
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* DOLNY PASEK NARZĘDZI: EKSPORT I ODŚWIEŻENIE */}
          <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between gap-2">
            {onExportExcel && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onExportExcel();
                }}
                className="flex-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#006241]" />
                <span>Eksport (.xlsx)</span>
              </button>
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onRefresh();
                }}
                title="Odśwież dane z bazy"
                className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
