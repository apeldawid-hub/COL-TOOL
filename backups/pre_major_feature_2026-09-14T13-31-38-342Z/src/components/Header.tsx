import React from 'react';
import { AppModule } from '../types';
import {
  Calendar,
  Store,
  UploadCloud,
  RefreshCw,
  Settings,
  Database,
  LayoutDashboard,
  BarChart3,
  CalendarDays,
  GraduationCap,
  LineChart,
  Boxes,
  User,
} from 'lucide-react';

interface HeaderProps {
  activeModule: AppModule;
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
  userName?: string;
}

const MODULE_TITLES: Record<AppModule, { title: string; icon: React.ComponentType<{ className?: string }> }> = {
  dashboard: { title: 'Podsumowanie', icon: LayoutDashboard },
  labor_forecast: { title: 'TPLH Forecast & Labor Balancing', icon: BarChart3 },
  managers_schedule: { title: 'Grafik Managerski', icon: CalendarDays },
  trainings: { title: 'Szkolenia & Certyfikacje', icon: GraduationCap },
  analytics: { title: 'Analiza Biznesowa (BI)', icon: LineChart },
  ibs_ims: { title: 'IBS & IMS (Magazyn & Dostawy)', icon: Boxes },
};

export const Header: React.FC<HeaderProps> = ({
  activeModule,
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
  userName = 'Store Manager (SM)',
}) => {
  const currentModuleInfo = MODULE_TITLES[activeModule] || MODULE_TITLES.dashboard;
  const ModuleIcon = currentModuleInfo.icon;

  return (
    <header className="bg-white border-b border-[#E2E8E5] px-6 py-3 flex items-center justify-between shadow-xs select-none shrink-0 gap-4 h-16">
      {/* Lewa strona: Tytuł Aktywnego Modułu */}
      <div className="flex items-center space-x-3 overflow-hidden">
        <div className="w-9 h-9 rounded-xl bg-[#006241]/10 text-[#006241] flex items-center justify-center font-bold shadow-2xs shrink-0">
          <ModuleIcon className="w-5 h-5" />
        </div>

        <div className="truncate">
          <h1 className="text-base font-black tracking-tight text-[#1E3932] truncate">
            {currentModuleInfo.title}
          </h1>
          <div className="flex items-center space-x-2 text-[11px] text-[#5C6F68]">
            <Store className="w-3 h-3 text-[#CBA258]" />
            <span className="font-bold text-[#1E3932]">108120 SBX Janki</span>
            <span className="text-gray-300">•</span>
            <span>Kod: <strong>384</strong></span>
          </div>
        </div>
      </div>

      {/* Środek: Selektory Roku i Miesiąca */}
      <div className="flex items-center space-x-2.5 bg-[#F4F7F5] px-3.5 py-1.5 rounded-2xl border border-[#E2E8E5]">
        <div className="flex items-center space-x-1.5 text-xs text-[#5C6F68]">
          <Calendar className="w-3.5 h-3.5 text-[#006241]" />
          <span className="font-bold text-[#1E3932] text-xs">Okres:</span>
        </div>

        {/* Wybór Roku */}
        <select
          value={selectedYear}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="bg-white text-[#1E3932] text-xs font-bold px-2.5 py-1 rounded-xl border border-[#D0DCD6] focus:border-[#006241] focus:ring-1 focus:ring-[#006241] focus:outline-none cursor-pointer shadow-xs transition-all"
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
          className="bg-white text-[#1E3932] text-xs font-bold px-2.5 py-1 rounded-xl border border-[#D0DCD6] focus:border-[#006241] focus:ring-1 focus:ring-[#006241] focus:outline-none cursor-pointer shadow-xs transition-all"
        >
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Prawa strona: Akcje i Profil */}
      <div className="flex items-center space-x-2.5">
        {/* Wskaźnik Profilu Managera */}
        <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#F0F4F2] border border-[#D0DCD6] text-xs">
          <div className="w-5 h-5 rounded-full bg-[#006241] flex items-center justify-center text-white text-[10px] font-bold">
            <User className="w-3 h-3" />
          </div>
          <span className="font-bold text-[#1E3932]">{userName}</span>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          title="Odśwież dane"
          className="p-2 rounded-xl bg-white border border-[#E2E8E5] text-[#5C6F68] hover:text-[#006241] hover:bg-[#F0F4F2] shadow-2xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#006241]' : ''}`} />
        </button>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            title="Konfiguracja: Plan AOP i Godziny NC"
            className="p-2 rounded-xl bg-white border border-[#D0DCD6] text-[#5C6F68] hover:text-[#006241] hover:bg-emerald-50 hover:border-[#006241] shadow-2xs transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}

        {onOpenBackupModal && (
          <button
            onClick={onOpenBackupModal}
            title="Kopie Zapasowe i Bezpieczeństwo Bazy SQLite"
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#D0DCD6] text-[#1E3932] hover:text-[#006241] hover:bg-emerald-50 hover:border-emerald-300 shadow-2xs transition-colors font-semibold text-xs cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-[#006241]" />
            <span>Kopie zapasowe</span>
          </button>
        )}

        <button
          onClick={onOpenImportModal}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#006241] hover:bg-[#00754A] text-white font-bold text-xs shadow-xs transition-all transform active:scale-98 cursor-pointer"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Import Fichajes</span>
        </button>
      </div>
    </header>
  );
};
