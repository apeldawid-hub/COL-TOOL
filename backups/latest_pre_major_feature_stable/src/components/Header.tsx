import React from 'react';
import { Calendar, Store, UploadCloud, RefreshCw, CheckCircle2, Settings, BarChart3, CalendarDays, Database } from 'lucide-react';

interface HeaderProps {
  activeModule: 'labor_forecast' | 'managers_schedule';
  onModuleChange: (mod: 'labor_forecast' | 'managers_schedule') => void;
  selectedYear: number;
  selectedMonth: string;
  availableYears: number[];
  availableMonths: string[];
  onYearChange: (year: number) => void;
  onMonthChange: (month: string) => void;
  onOpenImportModal: () => void;
  onOpenSettings?: () => void;
  onOpenBackupModal?: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  onModuleChange,
  selectedYear,
  selectedMonth,
  availableYears,
  availableMonths,
  onYearChange,
  onMonthChange,
  onOpenImportModal,
  onOpenSettings,
  onOpenBackupModal,
  onRefresh,
  isLoading,
}) => {
  return (
    <header className="bg-white border-b border-[#E2E8E5] px-6 py-3.5 flex items-center justify-between shadow-xs select-none shrink-0 gap-4">
      {/* Lewa strona: Logo, Lokalizacja i Przełącznik Modułów */}
      <div className="flex items-center space-x-5">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-full bg-[#006241] flex items-center justify-center shadow-sm">
            <span className="text-xl">☕</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black tracking-tight text-[#1E3932] flex items-center gap-1.5">
                STARBUCKS
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                  Operations Suite
                </span>
              </h1>
            </div>
            <div className="flex items-center space-x-2 text-xs text-[#5C6F68] mt-0.5">
              <Store className="w-3.5 h-3.5 text-[#CBA258]" />
              <span className="font-bold text-[#1E3932]">108120 Janki</span>
              <span className="text-gray-300">•</span>
              <span>Kod: <strong>384</strong></span>
            </div>
          </div>
        </div>

        {/* Globalny Przełącznik Modułów (Segmented Tabs) */}
        <div className="bg-[#F0F4F2] p-1 rounded-2xl border border-[#D0DCD6] flex items-center gap-1 shadow-2xs">
          <button
            onClick={() => onModuleChange('labor_forecast')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeModule === 'labor_forecast'
                ? 'bg-[#006241] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>TPLH Forecast</span>
          </button>

          <button
            onClick={() => onModuleChange('managers_schedule')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeModule === 'managers_schedule'
                ? 'bg-[#006241] text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Grafik Managerski</span>
          </button>
        </div>
      </div>

      {/* Środek: Selektory Roku i Miesiąca */}
      <div className="flex items-center space-x-3 bg-[#F4F7F5] px-4 py-2 rounded-2xl border border-[#E2E8E5]">
        <div className="flex items-center space-x-2 text-xs text-[#5C6F68]">
          <Calendar className="w-4 h-4 text-[#006241]" />
          <span className="font-bold text-[#1E3932]">Okres planu:</span>
        </div>

        {/* Wybór Roku */}
        <select
          value={selectedYear}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="bg-white text-[#1E3932] text-sm font-bold px-3 py-1.5 rounded-xl border border-[#D0DCD6] focus:border-[#006241] focus:ring-1 focus:ring-[#006241] focus:outline-none cursor-pointer shadow-xs transition-all"
        >
          {availableYears.map((yr) => (
            <option key={yr} value={yr}>
              {yr}
            </option>
          ))}
        </select>

        {/* Wybór Miesiąca */}
        <select
          value={selectedMonth}
          onChange={(e) => onMonthChange(e.target.value)}
          className="bg-white text-[#1E3932] text-sm font-bold px-3 py-1.5 rounded-xl border border-[#D0DCD6] focus:border-[#006241] focus:ring-1 focus:ring-[#006241] focus:outline-none cursor-pointer shadow-xs transition-all"
        >
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Prawa strona: Akcje */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Odśwież dane"
          className="p-2.5 rounded-xl bg-white border border-[#E2E8E5] text-[#5C6F68] hover:text-[#006241] hover:bg-[#F0F4F2] shadow-xs transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#006241]' : ''}`} />
        </button>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            title="Konfiguracja: Plan AOP i Godziny NC"
            className="p-2.5 rounded-xl bg-white border border-[#D0DCD6] text-[#5C6F68] hover:text-[#006241] hover:bg-[#E8F5E9] hover:border-[#006241] shadow-xs transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}

        {onOpenBackupModal && (
          <button
            onClick={onOpenBackupModal}
            title="Kopie Zapasowe i Bezpieczeństwo Bazy SQLite"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white border border-[#D0DCD6] text-[#1E3932] hover:text-[#006241] hover:bg-emerald-50 hover:border-emerald-300 shadow-xs transition-colors font-semibold text-xs cursor-pointer"
          >
            <Database className="w-4 h-4 text-[#006241]" />
            <span>Kopie zapasowe</span>
          </button>
        )}

        <button
          onClick={onOpenImportModal}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#006241] hover:bg-[#00754A] text-white font-bold text-sm shadow-sm transition-all transform active:scale-98"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Importuj Fichajes (MAPAL)</span>
        </button>
      </div>
    </header>
  );
};
