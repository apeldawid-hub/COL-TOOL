// src/components/StoreClientView.tsx
/**
 * Starbucks Operations Suite — Store Client Hardened View
 * Dedicated appliance-grade retail workstation layout for Store Managers in backrooms.
 * Features locked verified store badge, retail operational pills, friendly cloud sync pill,
 * and stripped developer options.
 */

import React, { useState, ReactNode } from 'react';
import {
  ShieldCheck,
  Calendar,
  BarChart3,
  GraduationCap,
  Calculator,
  LayoutDashboard,
  Settings,
  Database,
  LogOut,
  Info,
  Lock,
} from 'lucide-react';
import { StarbucksStore } from '../constants/starbucksStores';
import { AppModule } from '../types';
import { CloudSyncIndicator } from './sync/CloudSyncIndicator';
import { ErrorBoundary } from './ErrorBoundary';

interface StoreClientViewProps {
  currentStore: StarbucksStore;
  activeModule: AppModule;
  onSelectModule: (module: AppModule) => void;
  selectedYear: number;
  selectedMonth: string;
  userName?: string;
  userRole?: string;
  onOpenSettings: () => void;
  onOpenBackupModal: () => void;
  onOpenStationInfo?: () => void;
  onLogout: () => void;
  children?: ReactNode;
}

export const StoreClientView: React.FC<StoreClientViewProps> = ({
  currentStore,
  activeModule,
  onSelectModule,
  selectedYear,
  selectedMonth,
  userName = 'Store Manager',
  userRole = 'SM',
  onOpenSettings,
  onOpenBackupModal,
  onOpenStationInfo,
  onLogout,
  children,
}) => {
  const [showStationBadgeTooltip, setShowStationBadgeTooltip] = useState(false);

  const MODULE_NAV = [
    { id: 'dashboard' as AppModule, label: 'Pulpit', icon: LayoutDashboard },
    { id: 'labor_forecast' as AppModule, label: 'Moduł 1: TPLH', icon: BarChart3 },
    { id: 'managers_schedule' as AppModule, label: 'Moduł 2: Grafik & RCP', icon: Calendar },
    { id: 'trainings' as AppModule, label: 'Moduł 3: Szkolenia', icon: GraduationCap },
    { id: 'col_calculator' as AppModule, label: 'Moduł 4: COL Calc', icon: Calculator },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F4F7F5] select-none overflow-hidden">
      {/* 1. GŁÓWNY NAGŁÓWEK STACJI KLIENCKIEJ (STORE CLIENT HEADER) */}
      <header className="bg-white border-b border-[#D0DCD6] px-4 py-2.5 flex items-center justify-between shrink-0 shadow-xs z-20">
        {/* LEWA STRONA: ZABLOKOWANY, ZWERYFIKOWANY ZNACZEK KAWIARNI */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-[#006241] flex items-center justify-center text-white shadow-2xs">
              <span className="font-serif font-black text-sm">★</span>
            </div>

            {/* Zweryfikowana Kawiarnia (Brak przełącznika - stacja dedykowana) */}
            <div
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-50/70 border border-emerald-200/80 cursor-default"
              onMouseEnter={() => setShowStationBadgeTooltip(true)}
              onMouseLeave={() => setShowStationBadgeTooltip(false)}
              title={`Stacja robocza przypisana sprzętowo do lokalu: ${currentStore.name} (Unit: ${currentStore.unitCode}, MPK: ${currentStore.mpk}). Przełączanie kawiarni jest trwale zablokowane na stacji zaplecza.`}
            >
              <div className="flex items-center gap-1.5 text-[#006241]">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-xs text-[#1E3932] truncate max-w-[190px] sm:max-w-[260px]">
                  {currentStore.shortName || currentStore.name || 'Kawiarnia Starbucks'}
                </span>
              </div>
              <span className="text-[10px] font-mono font-black text-emerald-800 bg-white px-1.5 py-0.5 rounded border border-emerald-300 shrink-0">
                Unit {currentStore.unitCode || currentStore.id || '—'}
              </span>
              <span className="hidden md:inline-block text-[11px] text-stone-400 font-medium truncate">
                {currentStore.city}
              </span>
              <Lock className="w-3 h-3 text-emerald-600/70 ml-0.5 shrink-0" />
            </div>

            {/* Opcjonalny przycisk informacji o licencji stacji */}
            {onOpenStationInfo && (
              <button
                onClick={onOpenStationInfo}
                title="Szczegóły aktywacji sprzętowej stacji"
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ŚRODEK: OPERACYJNE ZNACZNIKI ZGODNOŚCI STARBUCKS */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Floor compliance */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 text-[#1E3932] text-[11px] font-bold border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span>Floor: <strong>32.0h/dzień (224h/tydz)</strong></span>
          </span>

          {/* Aktywny miesiąc planistyczny */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-[#006241] text-[11px] font-black border border-emerald-200">
            <Calendar className="w-3 h-3 text-emerald-700" />
            <span>{selectedMonth} {selectedYear}</span>
          </span>
        </div>

        {/* PRAWA STRONA: WSKAŹNIK SYNCHRONIZACJI Z CHMURĄ & PROFIL */}
        <div className="flex items-center space-x-2.5 shrink-0">
          {/* Bezszwowy wskaźnik synchronizacji 1-kliknięciem */}
          <CloudSyncIndicator compact={false} />

          <div className="h-4 w-px bg-stone-300" />

          {/* Kopia Zapasowa (Sanityzowana) */}
          <button
            onClick={onOpenBackupModal}
            title="Menedżer kopii bezpieczeństwa SQLite (Zapisz punkt przywracania)"
            className="p-2 rounded-xl text-stone-600 hover:text-[#006241] hover:bg-emerald-50 transition-colors cursor-pointer"
          >
            <Database className="w-4 h-4" />
          </button>

          {/* Ustawienia (Sanityzowane) */}
          <button
            onClick={onOpenSettings}
            title="Ustawienia kawiarni i wygląd"
            className="p-2 rounded-xl text-stone-600 hover:text-[#006241] hover:bg-emerald-50 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Profil Managera & Wylogowanie */}
          <div className="flex items-center space-x-2 pl-1">
            <div className="w-7 h-7 rounded-full bg-[#006241] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              {userRole}
            </div>
            <div className="hidden sm:block text-left text-xs leading-tight">
              <div className="font-bold text-[#1E3932] truncate max-w-[120px]">{userName}</div>
              <div className="text-[10px] text-stone-500 font-semibold">{userRole} • Zaplecze</div>
            </div>
            <button
              onClick={onLogout}
              title="Wyloguj ze stacji"
              className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. ERGONOMICZNA BELKA NAWIGACJI PO MODUŁACH DLA ZAPLECZA */}
      <nav className="bg-[#1E3932] text-white px-4 py-1.5 flex items-center justify-between shrink-0 shadow-sm z-10 overflow-x-auto scrollbar-none">
        <div className="flex items-center space-x-1.5">
          {MODULE_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectModule(item.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#006241] text-white shadow-xs border border-emerald-400/30'
                    : 'text-emerald-100/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#CBA258]' : 'text-emerald-300'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden md:flex items-center text-[11px] text-emerald-200/70 font-mono pr-2">
          <span>Stacja Kawiarni • Tryb Retail Locked</span>
        </div>
      </nav>

      {/* 3. OBSZAR ROBOCZY AKTYWNEGO MODUŁU */}
      <main className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 md:px-5 py-4 pb-20 w-full scrollbar-thin">
        {children || (
          <div className="p-8 text-center text-stone-500 font-medium">
            Ładowanie widoku stacji kawiarni...
          </div>
        )}
      </main>
    </div>
  );
};
