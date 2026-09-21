import React from 'react';
import { AppModule } from '../types';
import {
  Store,
  LayoutDashboard,
  BarChart3,
  CalendarDays,
  GraduationCap,
  LineChart,
  Boxes,
  Users,
  Calculator,
  User,
} from 'lucide-react';

interface HeaderProps {
  activeModule: AppModule;
  userName?: string;
  selectedYear?: number;
  selectedMonth?: string;
  onPeriodChange?: (year: number, month: string) => void;
}

const MODULE_TITLES: Record<AppModule, { title: string; icon: React.ComponentType<{ className?: string }> }> = {
  dashboard: { title: 'Podsumowanie', icon: LayoutDashboard },
  labor_forecast: { title: 'TPLH Forecast & Labor Balancing', icon: BarChart3 },
  managers_schedule: { title: 'Grafik Managerski', icon: CalendarDays },
  trainings: { title: 'Szkolenia & Certyfikacje', icon: GraduationCap },
  col_calculator: { title: 'COL Calculator (Cost of Labor)', icon: Calculator },
  analytics: { title: 'Analiza Biznesowa (BI)', icon: LineChart },
  ibs_ims: { title: 'IBS & IMS (Ideal Structure)', icon: Users },
};

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  userName = 'Store Manager (SM)',
  selectedYear,
  selectedMonth,
  onPeriodChange
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
          <div className="flex items-center gap-2">
            <h1 className="text-base font-black tracking-tight text-[#1E3932] truncate">
              {currentModuleInfo.title}
            </h1>
            {selectedMonth && selectedYear && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#006241] text-xs font-black">
                <span>{selectedMonth} {selectedYear}</span>
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2 text-[11px] text-[#5C6F68]">
            <Store className="w-3 h-3 text-[#CBA258]" />
            <span className="font-bold text-[#1E3932]">108120 SBX Janki</span>
            <span className="text-gray-300">•</span>
            <span>Kod: <strong>18120</strong></span>
          </div>
        </div>
      </div>

      {/* Prawa strona: Profil */}
      <div className="flex items-center space-x-2.5">
        {/* Wskaźnik Profilu Managera */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#F0F4F2] border border-[#D0DCD6] text-xs shadow-2xs">
          <div className="w-5 h-5 rounded-full bg-[#006241] flex items-center justify-center text-white text-[10px] font-bold">
            <User className="w-3 h-3" />
          </div>
          <span className="font-bold text-[#1E3932]">{userName}</span>
        </div>
      </div>
    </header>
  );
};

