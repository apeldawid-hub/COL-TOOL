import React from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Lock,
} from 'lucide-react';
import { SystemClock } from '../services/systemClock';

export const POLISH_MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

export const AVAILABLE_YEARS = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036];

export interface ModuleDateBarProps {
  year: number;
  month: string | number; // np. 'Wrzesień' lub liczba 1-12 / string
  onPeriodChange: (year: number, month: string) => void;
  extraInfo?: React.ReactNode;
  className?: string;
}

export const ModuleDateBar: React.FC<ModuleDateBarProps> = ({
  year,
  month,
  onPeriodChange,
  extraInfo,
  className = ''
}) => {
  const currentNow = SystemClock.now();
  const currentYear = currentNow.year;
  const currentMonthIdx = currentNow.monthIndex; // 0-11
  const currentMonthName = POLISH_MONTHS[currentMonthIdx];

  // Indeks aktywnego miesiąca (0-11)
  const monthIdx = typeof month === 'number' 
    ? (month as number) - 1 
    : POLISH_MONTHS.indexOf(month) >= 0 
    ? POLISH_MONTHS.indexOf(month) 
    : isNaN(parseInt(month, 10)) 
    ? currentMonthIdx 
    : parseInt(month, 10) - 1;

  const monthName = POLISH_MONTHS[monthIdx] || POLISH_MONTHS[currentMonthIdx];

  // Poprzedni miesiąc (←)
  const handlePrevMonth = () => {
    if (monthIdx === 0) {
      onPeriodChange(year - 1, POLISH_MONTHS[11]);
    } else {
      onPeriodChange(year, POLISH_MONTHS[monthIdx - 1]);
    }
  };

  // Następny miesiąc (→)
  const handleNextMonth = () => {
    if (monthIdx === 11) {
      onPeriodChange(year + 1, POLISH_MONTHS[0]);
    } else {
      onPeriodChange(year, POLISH_MONTHS[monthIdx + 1]);
    }
  };

  // Skrót: LM (Last Month względem bieżącego czasu systemowego)
  const handleJumpLastMonth = () => {
    if (currentMonthIdx === 0) {
      onPeriodChange(currentYear - 1, POLISH_MONTHS[11]);
    } else {
      onPeriodChange(currentYear, POLISH_MONTHS[currentMonthIdx - 1]);
    }
  };

  // Skrót: MTD (Bieżący miesiąc systemowy)
  const handleJumpCurrentMtd = () => {
    onPeriodChange(currentYear, currentMonthName);
  };

  // Skrót: NM (Next Month względem bieżącego czasu systemowego)
  const handleJumpNextMonth = () => {
    if (currentMonthIdx === 11) {
      onPeriodChange(currentYear + 1, POLISH_MONTHS[0]);
    } else {
      onPeriodChange(currentYear, POLISH_MONTHS[currentMonthIdx + 1]);
    }
  };

  // Sprawdzenie stanu temporalnego
  const isCurrentMonth = year === currentYear && monthIdx === currentMonthIdx;
  const isPastMonth = year < currentYear || (year === currentYear && monthIdx < currentMonthIdx);
  const isFutureMonth = year > currentYear || (year === currentYear && monthIdx > currentMonthIdx);

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border border-[#E2E8E5] dark:border-zinc-800 rounded-2xl px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-xs select-none ${className}`}
    >
      {/* Lewa strona: Nawigator Miesiąca i Roku */}
      <div className="flex items-center space-x-2">
        {/* Przycisk Poprzedni */}
        <button
          onClick={handlePrevMonth}
          title="Poprzedni miesiąc"
          className="p-1.5 rounded-xl bg-[#F4F7F5] dark:bg-zinc-800 text-[#1E3932] dark:text-zinc-200 hover:bg-[#E2E8E5] dark:hover:bg-zinc-700 transition-colors cursor-pointer border border-[#D0DCD6] dark:border-zinc-700 active:scale-95"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Selektor Miesiąca */}
        <select
          value={monthName}
          onChange={(e) => onPeriodChange(year, e.target.value)}
          className="bg-[#F4F7F5] dark:bg-zinc-800 text-[#1E3932] dark:text-zinc-100 text-xs font-bold px-3 py-1.5 rounded-xl border border-[#D0DCD6] dark:border-zinc-700 focus:border-[#006241] focus:ring-1 focus:ring-[#006241] focus:outline-none cursor-pointer transition-all"
        >
          {POLISH_MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {/* Selektor Roku */}
        <select
          value={year}
          onChange={(e) => onPeriodChange(Number(e.target.value), monthName)}
          className="bg-[#F4F7F5] dark:bg-zinc-800 text-[#1E3932] dark:text-zinc-100 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-[#D0DCD6] dark:border-zinc-700 focus:border-[#006241] focus:ring-1 focus:ring-[#006241] focus:outline-none cursor-pointer transition-all"
        >
          {AVAILABLE_YEARS.map((yr) => (
            <option key={yr} value={yr}>
              {yr}
            </option>
          ))}
        </select>

        {/* Przycisk Następny */}
        <button
          onClick={handleNextMonth}
          title="Następny miesiąc"
          className="p-1.5 rounded-xl bg-[#F4F7F5] dark:bg-zinc-800 text-[#1E3932] dark:text-zinc-200 hover:bg-[#E2E8E5] dark:hover:bg-zinc-700 transition-colors cursor-pointer border border-[#D0DCD6] dark:border-zinc-700 active:scale-95"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Szybkie Skróty: LM, MTD, NM */}
        <div className="flex items-center space-x-1 pl-2 border-l border-slate-200 dark:border-zinc-700">
          <button
            onClick={handleJumpLastMonth}
            title="Przejdź do poprzedniego miesiąca (Last Month)"
            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all cursor-pointer active:scale-95 border border-slate-200 dark:border-zinc-700"
          >
            LM
          </button>

          <button
            onClick={handleJumpCurrentMtd}
            title="Przejdź do bieżącego miesiąca (Month-To-Date)"
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer active:scale-95 border ${
              isCurrentMonth
                ? 'bg-[#006241] text-white border-[#004d33] shadow-xs ring-1 ring-emerald-400/40'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-[#006241] dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border-emerald-300 dark:border-emerald-700'
            }`}
          >
            MTD
          </button>

          <button
            onClick={handleJumpNextMonth}
            title="Przejdź do następnego miesiąca (Next Month)"
            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all cursor-pointer active:scale-95 border border-slate-200 dark:border-zinc-700"
          >
            NM
          </button>
        </div>

        {/* Badge statusu temporalnego */}
        <div className="hidden sm:flex items-center pl-2">
          {isCurrentMonth && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Bieżący (MTD)
            </span>
          )}
          {isPastMonth && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded-full border border-slate-300 dark:border-zinc-700">
              <Lock className="w-3 h-3 text-slate-500" />
              Archiwalny
            </span>
          )}
          {isFutureMonth && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              Planowany
            </span>
          )}
        </div>
      </div>

      {/* Prawa strona: Opcjonalne dodatkowe wskaźniki modułu */}
      {extraInfo && (
        <div className="flex items-center space-x-3 text-xs">
          {extraInfo}
        </div>
      )}
    </div>
  );
};
