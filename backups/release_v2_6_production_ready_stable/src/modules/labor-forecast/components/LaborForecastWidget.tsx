import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  RefreshCw,
  LineChart,
  Zap
} from 'lucide-react';

interface LaborForecastWidgetProps {
  currentYear: number;
  currentMonthName: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onCurrentMonth: () => void;
  onOpenFlashForecast?: () => void;
  onOpenFichajesViewer?: () => void;
  onToggleTrendCharts?: () => void;
  isTrendChartsOpen?: boolean;
  onRefresh?: () => void;
  hasMondayProjection?: boolean;
  activeStrategy?: 'floor_safe' | 'balanced' | 'growth';
}

export const LaborForecastWidget: React.FC<LaborForecastWidgetProps> = ({
  currentYear,
  currentMonthName,
  onPrevMonth,
  onNextMonth,
  onCurrentMonth,
  onOpenFlashForecast,
  onOpenFichajesViewer,
  onToggleTrendCharts,
  isTrendChartsOpen = false,
  onRefresh,
  hasMondayProjection = false,
  activeStrategy = 'balanced'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Zamknij menu przy kliknięciu poza obszarem
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const strategyLabels = {
    floor_safe: '🛡️ Konserwatywna',
    balanced: '⚖️ Zbalansowana',
    growth: '🚀 Wzrostowa'
  };

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-50 select-none">
      {/* MENU ROZWIJANE SPEED-DIAL */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 mb-2 w-72 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-stone-200/90 p-3 animate-in fade-in slide-in-from-bottom-4 duration-200 flex flex-col gap-2">
          {/* PASEK NAWIGACJI CZASU */}
          <div className="flex items-center justify-between bg-stone-100/90 rounded-xl p-1 border border-stone-200/80">
            <button
              type="button"
              onClick={onPrevMonth}
              className="p-1.5 hover:bg-white rounded-lg text-stone-700 hover:text-[#006241] transition-all cursor-pointer shadow-2xs"
              title="Poprzedni miesiąc"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onCurrentMonth}
              className="px-2.5 py-1 text-xs font-black text-[#006241] hover:bg-white rounded-lg transition-all cursor-pointer shadow-2xs flex items-center gap-1"
              title="Powrót do bieżącego miesiąca (MTD)"
            >
              <span>{currentMonthName} {currentYear}</span>
            </button>
            <button
              type="button"
              onClick={onNextMonth}
              className="p-1.5 hover:bg-white rounded-lg text-stone-700 hover:text-[#006241] transition-all cursor-pointer shadow-2xs"
              title="Następny miesiąc"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="h-px bg-stone-200/80 my-0.5" />

          {/* LISTA SZYBKICH AKCJI */}
          <div className="flex flex-col gap-1">
            {/* 1. FLASH FORECAST */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenFlashForecast?.();
              }}
              className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-stone-800 hover:bg-amber-50 hover:text-amber-900 border border-transparent hover:border-amber-200 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-extrabold">Flash Forecast</span>
                  <span className="text-[10px] text-stone-500 font-normal">Estymacja poniedziałku W+2</span>
                </div>
              </div>
              {hasMondayProjection && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-900 border border-purple-300">
                  🔮 Estymacja
                </span>
              )}
            </button>

            {/* 2. EWIDENCJA FICHAJES VIEWER */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenFichajesViewer?.();
              }}
              className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold text-stone-800 hover:bg-stone-100 border border-transparent hover:border-stone-200 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-stone-200 text-stone-800 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-extrabold">Dziennik Fichajes</span>
                  <span className="text-[10px] text-stone-500 font-normal">2-arkuszowy podgląd logowań</span>
                </div>
              </div>
            </button>

            {/* 6. WYKRESY TRENDÓW */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onToggleTrendCharts?.();
              }}
              className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer group ${
                isTrendChartsOpen
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
                  : 'text-stone-800 hover:bg-emerald-50 hover:text-emerald-950 border-transparent hover:border-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#006241] flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                  <LineChart className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-extrabold">Wykresy Analityczne</span>
                  <span className="text-[10px] text-stone-500 font-normal">{isTrendChartsOpen ? 'Ukryj wykresy' : 'Pokaż wykresy TPLH'}</span>
                </div>
              </div>
            </button>

            {/* 7. ODŚWIEŻ */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onRefresh?.();
              }}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-all cursor-pointer group mt-0.5"
            >
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-stone-500 group-hover:rotate-180 transition-transform duration-500" />
                <span>Odśwież dane modułu</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* PŁYWAJĄCY PRZYCISK GŁÓWNY Z LOGO STARBUCKS */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-xl border-2 ${
          isOpen
            ? 'bg-[#1E3932] border-emerald-400 rotate-90 scale-105 shadow-emerald-900/40'
            : 'bg-[#006241] border-white hover:scale-110 shadow-emerald-900/30 hover:shadow-2xl hover:border-emerald-200'
        }`}
        title="Centrum sterowania TPLH Forecast (Kliknij, aby otworzyć menu)"
      >
        <div className="relative flex items-center justify-center">
          {/* Logo Starbucks / Syrena */}
          <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="4" />
            <circle cx="50" cy="50" r="38" fill="currentColor" />
            {/* Stylizowana korona / gwiazda */}
            <path
              d="M50 22 L53 30 L62 30 L55 35 L58 43 L50 38 L42 43 L45 35 L38 30 L47 30 Z"
              fill="#006241"
            />
            {/* Twarz / sylwetka */}
            <circle cx="50" cy="52" r="10" fill="#006241" />
            <path
              d="M44 64 C44 58 56 58 56 64 C56 70 44 70 44 64 Z"
              fill="#006241"
            />
          </svg>

          {hasMondayProjection && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-500 border-2 border-white animate-pulse" />
          )}
        </div>
      </button>
    </div>
  );
};
