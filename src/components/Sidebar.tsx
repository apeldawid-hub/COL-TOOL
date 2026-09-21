import React from 'react';
import { AppModule } from '../types';
import { APP_VERSION } from '../version';
import {
  LayoutDashboard,
  BarChart3,
  CalendarDays,
  GraduationCap,
  Calculator,
  LineChart,
  Boxes,
  Users,
  ChevronLeft,
  ChevronRight,
  Settings,
  Database,
  UploadCloud,
  LogOut,
  Store,
  Sparkles,
  RefreshCw,
  Bug,
} from 'lucide-react';

interface SidebarProps {
  activeModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings?: () => void;
  onOpenBackupModal?: () => void;
  onOpenImportModal?: () => void;
  onOpenUpdateModal?: () => void;
  onOpenBugReporter?: () => void;
  hasUpdateAvailable?: boolean;
  onRefresh?: () => void;
  isLoading?: boolean;
  onLogout?: () => void;
}

interface NavItem {
  id: AppModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeType?: 'active' | 'scratch';
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Podsumowanie',
    icon: LayoutDashboard,
  },
  {
    id: 'labor_forecast',
    label: 'TPLH Forecast',
    icon: BarChart3,
    badge: 'v1.2',
    badgeType: 'active',
  },
  {
    id: 'managers_schedule',
    label: 'Grafik Managerski',
    icon: CalendarDays,
    badge: 'v1.0',
    badgeType: 'active',
  },
  {
    id: 'trainings',
    label: 'Szkolenia',
    icon: GraduationCap,
    badge: 'Wkrótce',
    badgeType: 'scratch',
  },
  {
    id: 'col_calculator',
    label: 'COL Calculator',
    icon: Calculator,
    badge: 'Wkrótce',
    badgeType: 'scratch',
  },
  {
    id: 'analytics',
    label: 'Analiza',
    icon: LineChart,
    badge: 'Wkrótce',
    badgeType: 'scratch',
  },
  {
    id: 'ibs_ims',
    label: 'IBS & IMS',
    icon: Users,
    badge: 'Wkrótce',
    badgeType: 'scratch',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  isCollapsed,
  onToggleCollapse,
  onOpenSettings,
  onOpenBackupModal,
  onOpenImportModal,
  onOpenUpdateModal,
  onOpenBugReporter,
  hasUpdateAvailable = false,
  onRefresh,
  isLoading,
  onLogout,
}) => {
  return (
    <aside
      className={`bg-[#1E3932] text-white flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out border-r border-[#006241]/30 relative z-30 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Sekcja Górna: Brand & Logo */}
      <div>
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
          {!isCollapsed && (
            <div className="flex items-center space-x-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-[#006241] flex items-center justify-center text-white shadow-sm ring-2 ring-[#006241]/40 shrink-0">
                <span className="text-lg">☕</span>
              </div>
              <div className="truncate">
                <span className="font-black text-sm tracking-wider text-white block leading-tight">
                  STARBUCKS
                </span>
                <span className="text-[10px] font-bold text-emerald-300/80 uppercase tracking-wider">
                  Operations Suite
                </span>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-10 h-10 mx-auto rounded-full bg-[#006241] flex items-center justify-center text-white shadow-sm ring-2 ring-[#006241]/40">
              <span className="text-xl">☕</span>
            </div>
          )}

          {/* Przycisk zwijania/rozwijania */}
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Rozwiń pasek boczny' : 'Zwiń pasek boczny'}
            className={`p-1.5 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ${
              isCollapsed ? 'hidden' : 'block'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Wskaźnik Kawiarni */}
        {!isCollapsed && (
          <div className="px-4 py-2.5 mx-3 my-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <Store className="w-3.5 h-3.5 text-[#CBA258]" />
              <span className="font-bold text-white">108120 Janki</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#006241] text-emerald-100 font-bold">
              18120
            </span>
          </div>
        )}

        {/* Lista Modułów */}
        <div className="px-3 py-2 space-y-1">
          <div className={`px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300/60 ${isCollapsed ? 'text-center' : ''}`}>
            {isCollapsed ? '•' : 'Moduły'}
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectModule(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-2xl font-bold transition-all group relative cursor-pointer ${
                  isCollapsed ? 'justify-center p-3' : 'px-3.5 py-2.5 justify-between'
                } ${
                  isActive
                    ? 'bg-[#006241] text-white shadow-sm ring-1 ring-emerald-400/30'
                    : 'text-emerald-100/75 hover:text-white hover:bg-white/8'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${
                      isActive ? 'text-white' : 'text-emerald-200/80 group-hover:text-white'
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="text-xs tracking-tight truncate">{item.label}</span>
                  )}
                </div>

                {!isCollapsed && item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${
                      item.badgeType === 'active'
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Dymek aktywnego elementu w trybie zwiniętym */}
                {isCollapsed && isActive && (
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#CBA258] rounded-r-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sekcja Dolna: Narzędzia i Wyloguj */}
      <div className="p-3 border-t border-white/10 space-y-1">
        {/* Toggle przycisk w trybie zwiniętym */}
        {isCollapsed && (
          <button
            onClick={onToggleCollapse}
            title="Rozwiń pasek boczny"
            className="w-full flex items-center justify-center p-2.5 rounded-2xl text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer mb-2"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Odśwież dane */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title={isCollapsed ? 'Odśwież dane' : undefined}
            className={`w-full flex items-center rounded-2xl text-xs font-semibold text-emerald-100/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center p-3' : 'px-3.5 py-2 space-x-3'
            }`}
          >
            <RefreshCw className={`w-4 h-4 text-emerald-300 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            {!isCollapsed && <span>Odśwież dane</span>}
          </button>
        )}

        {/* Import */}
        {onOpenImportModal && (
          <button
            onClick={onOpenImportModal}
            title={isCollapsed ? 'Import' : undefined}
            className={`w-full flex items-center rounded-2xl text-xs font-semibold bg-[#006241]/80 hover:bg-[#00754A] text-white transition-colors cursor-pointer shadow-xs border border-emerald-500/30 ${
              isCollapsed ? 'justify-center p-3' : 'px-3.5 py-2 space-x-3'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-emerald-200" />
            {!isCollapsed && <span>Import</span>}
          </button>
        )}

        {/* Ustawienia Konfiguracji (Dynamiczne pozycjonowanie wg modułu) */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            title={isCollapsed ? `Ustawienia (${activeModule})` : undefined}
            className={`w-full flex items-center rounded-2xl text-xs font-semibold text-emerald-100/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ${
              isCollapsed ? 'justify-center p-3' : 'px-3.5 py-2 justify-between'
            }`}
          >
            <div className="flex items-center space-x-3 truncate">
              <Settings className="w-4 h-4 text-emerald-300 shrink-0" />
              {!isCollapsed && <span>Ustawienia</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-300 font-mono uppercase border border-emerald-500/20">
                {activeModule === 'labor_forecast' ? 'TPLH' :
                 activeModule === 'managers_schedule' ? 'Grafik' :
                 activeModule === 'trainings' ? 'Szkolenia' :
                 activeModule === 'col_calculator' ? 'COL' : 'System'}
              </span>
            )}
          </button>
        )}

        {/* Wyloguj */}
        {onLogout && (
          <button
            onClick={onLogout}
            title={isCollapsed ? 'Wyloguj' : undefined}
            className={`w-full flex items-center rounded-2xl text-xs font-semibold text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 transition-colors cursor-pointer pt-2 mt-1 border-t border-white/10 ${
              isCollapsed ? 'justify-center p-3' : 'px-3.5 py-2 space-x-3'
            }`}
          >
            <LogOut className="w-4 h-4 text-rose-300" />
            {!isCollapsed && <span>Wyloguj</span>}
          </button>
        )}
      </div>
    </aside>
  );
};
