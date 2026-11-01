# Architectural Specification & Implementation Strategy: Store Client View & Navigation Hardening

**Milestone**: Milestone 2 — Dual-Profile Runtime Architecture & Fleet Master Dashboard  
**Document**: Technical Implementation Strategy for Store Client View, UI Pruning & Profile Isolation  
**Author**: M2 Fleet Explorer 3 (`m2_fleet_explorer_3`)  
**Date**: 2026-10-26T20:00:00Z  
**Target Files**:
- `src/components/StoreClientView.tsx` (New)
- `src/components/sync/CloudSyncIndicator.tsx` (New)
- `src/services/security/profilePolicyService.ts` (New)
- `src/components/DatabaseBackupModal.tsx` (Hardening & Pruning)
- `src/components/UnifiedSettingsModal.tsx` (Hardening & Pruning)
- `tests/security/profile_isolation.test.ts` (New Automated Test Suite)

---

## 1. Executive Summary & Architectural Vision

Under Requirement **R2 (Dual-Profile Runtime Architecture)** from `ORIGINAL_REQUEST.md` and `SCOPE.md`, the Starbucks Operations Suite bifurcates into two distinct operating modes:
1. **`FLEET_MASTER`**: HQ Command Center for District Managers and Regional Executives, managing 100+ stores with `FleetMasterDashboard.tsx`.
2. **`STORE_CLIENT`**: Dedicated retail workstation for Store Managers (SM) and baristas in store backrooms (e.g. `108120 SBX Warszawa Janki`, Unit `18120`).

On a store laptop, the application must be an **appliance-grade retail workstation**:
- **Strict Store Locking**: The application is permanently bound to its assigned store via its hardware-bound cryptographic activation key (`SBX-<storeId>-<randomHex>-<checksum>`). There is **zero access to other stores**, no store switcher dropdown, and no unassigned store browsing.
- **Zero Technical Clutter**: Destructive developer actions (Clean Slate raw wipe, importing historical raw packages, arbitrary database file overwrites) and developer diagnostics (manual PRAGMA integrity check, manual VACUUM optimize, developer testing checklists, and nationwide telemetry) must be completely stripped.
- **Friendly Operational Focus**: Store Managers are presented with a streamlined workspace (`StoreClientView.tsx`) featuring a verified store identity badge, high-visibility operational compliance indicators (Floor Hours 32h/day base, trading vs non-trading Sunday status), and a friendly, seamless one-click cloud synchronization pill (`CloudSyncIndicator.tsx`).

---

## 2. Store Client View (`src/components/StoreClientView.tsx`)

### 2.1 Workspace Design & Backroom Laptop Ergonomics
Store laptops (typically 13" MacBook Airs or compact Windows laptops in back offices) operate at 1366×768 to 1440×900 resolution. The layout of `StoreClientView.tsx` is specifically designed for these operational constraints:
- Compact, high-density top header preserving maximum vertical height for schedule and forecast tables.
- Fixed verified store identity chip that provides instant visual confidence without taking up interactive dropdown space.
- Unified, non-distracting module selector allowing 1-click transitions between Module 1 (Labor Forecast), Module 2 (Managers Schedule), Module 3 (Trainings), and Module 4 (COL Calculator).
- Fail-safe error boundary wrapping each module view with store-isolated keys to ensure immediate UI recovery without app crashes.

### 2.2 Header Layout Architecture
```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ☕ 108120 SBX Warszawa Janki (Unit 18120) 🔒  │ 🏛️ Floor: 32h/dzień ✓ │ [☁️ Zsynchronizowano (2m)] [SM: Dawid] │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  [ 📊 Pulpit ]  [ 📈 Moduł 1: TPLH ]  [ 📅 Moduł 2: Grafik ]  [ 🎓 Moduł 3: Szkolenia ]  [ 🧮 Moduł 4: COL ]  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                        │
│                                      ACTIVE MODULE CONTENT AREA                                        │
│                                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Left: Verified Store Badge (No Dropdown)**:
   - Green lock shield badge (`ShieldCheck` / `Lock`) indicating verified hardware-bound license.
   - Store name: `currentStore.name` (e.g. `108120 SBX Warszawa Janki`).
   - Unit code badge: `18120` in high-contrast monospaced font.
   - City & District: `Warszawa / Janki • Dystrykt Warszawa`.
   - Clicking does **NOT** open `StoreSwitcherModal`. Instead, it displays a non-destructive read-only station info popover or modal (`StoreStationInfoModal`).
2. **Center: Retail Operational Compliance Pills**:
   - `Baza Floor: 32.0 h/dzień (224h/tydz) ✓` (Starbucks Golden Floor Rule).
   - Sunday indicator: `CH Janki: Niedziela Handlowa` or `Niedziela Niehandlowa (Floor 32h)`.
   - Selected scheduling month & year.
3. **Right: Cloud Sync & Identity**:
   - Seamless `<CloudSyncIndicator />` (one-click sync trigger).
   - Backup Snapshot quick button (opens sanitized `DatabaseBackupModal`).
   - Settings quick button (opens sanitized `UnifiedSettingsModal`).
   - Store Manager user badge with logout.

### 2.3 Complete Implementation Blueprint for `src/components/StoreClientView.tsx`

```tsx
// src/components/StoreClientView.tsx
import React, { useState } from 'react';
import {
  ShieldCheck,
  Calendar,
  Layers,
  BarChart3,
  Users,
  GraduationCap,
  Calculator,
  LayoutDashboard,
  Bell,
  Settings,
  Database,
  LogOut,
  Info,
} from 'lucide-react';
import { StarbucksStore } from '../constants/starbucksStores';
import { AppModule } from '../types';
import { CloudSyncIndicator } from './sync/CloudSyncIndicator';
import { ErrorBoundary } from './ErrorBoundary';
import { DashboardView } from './DashboardView';
import { ManagerScheduleView } from '../modules/managers-schedule/ManagerScheduleView';
import { LaborForecastView } from '../modules/labor-forecast/LaborForecastView';
import { TrainingsView } from '../modules/trainings/TrainingsView';
import { ColCalculatorView } from '../modules/col-calculator/ColCalculatorView';

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
            >
              <div className="flex items-center gap-1 text-[#006241]">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-xs text-[#1E3932] truncate max-w-[190px] sm:max-w-[260px]">
                  {currentStore.shortName || currentStore.name}
                </span>
              </div>
              <span className="text-[10px] font-mono font-black text-emerald-800 bg-white px-1.5 py-0.5 rounded border border-emerald-300 shrink-0">
                Unit {currentStore.unitCode}
              </span>
              <span className="hidden md:inline-block text-[11px] text-stone-400 font-medium truncate">
                {currentStore.city}
              </span>
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
            <span>Floor: <strong>32.0h/dzień</strong></span>
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
        {activeModule === 'dashboard' && (
          <ErrorBoundary moduleName="Dashboard" fallbackTitle="Błąd w pulpicie kawiarni">
            <DashboardView
              key={`dashboard-${currentStore.id}-${selectedYear}-${selectedMonth}`}
              onNavigate={onSelectModule}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
            />
          </ErrorBoundary>
        )}

        {activeModule === 'labor_forecast' && (
          <ErrorBoundary moduleName="Labor Forecast" fallbackTitle="Błąd w module TPLH Forecast">
            <LaborForecastView
              key={`labor-${currentStore.id}-${selectedYear}-${selectedMonth}`}
              currentYear={selectedYear}
              currentMonthName={selectedMonth}
            />
          </ErrorBoundary>
        )}

        {activeModule === 'managers_schedule' && (
          <ErrorBoundary moduleName="Managers Schedule" fallbackTitle="Błąd w module Grafiku Managerskiego">
            <ManagerScheduleView
              key={`schedule-${currentStore.id}-${selectedYear}-${selectedMonth}`}
              currentYear={selectedYear}
              currentMonthName={selectedMonth}
            />
          </ErrorBoundary>
        )}

        {activeModule === 'trainings' && (
          <ErrorBoundary moduleName="Trainings" fallbackTitle="Błąd w module Szkoleń">
            <TrainingsView
              key={`trainings-${currentStore.id}`}
            />
          </ErrorBoundary>
        )}

        {activeModule === 'col_calculator' && (
          <ErrorBoundary moduleName="COL Calculator" fallbackTitle="Błąd w module Kalkulatora COL">
            <ColCalculatorView
              key={`col-${currentStore.id}-${selectedYear}-${selectedMonth}`}
              currentYear={selectedYear}
              currentMonthName={selectedMonth}
            />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
};
```

---

## 3. Seamless One-Click Cloud Sync (`src/components/sync/CloudSyncIndicator.tsx`)

### 3.1 UX Architecture & State Mapping
`SyncEngine` (`src/services/sync/syncEngine.ts`) manages the local-first queue (`sync_outbox`) and emits updates via `SyncEngine.subscribe()`.
`CloudSyncIndicator.tsx` translates technical outbox telemetry into 5 friendly human states:

| Engine State | `isOnline` | `pendingCount` | UI Pill Appearance | Label Text | Click Action |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **`synced` / `idle`** | `true` | `0` | Emerald-50 / Emerald-200 border | `Zsynchronizowano` (`2m temu`) | Wymusza natychmiastowe sprawdzenie |
| **`syncing`** | `true` | any | Blue-50 / Blue-300 border | `Synchronizowanie...` (spinner) | Blokada kliknięcia (in-flight) |
| **`pending`** | `true` | `> 0` | Amber-50 / Amber-300 border | `Oczekuje: X zmian` (puls) | **Wypycha zmiany natychmiast** (`flushOutbox`) |
| **`offline`** | `false` | any | Stone-100 / Stone-300 border | `Tryb lokalny (Offline)` | Wyświetla komunikat o bezpieczeństwie na dysku |
| **`error`** | `true` | any | Rose-50 / Rose-300 border | `Błąd synchronizacji` | Ponawia próbę synchronizacji |

### 3.2 Complete Implementation Blueprint for `src/components/sync/CloudSyncIndicator.tsx`

```tsx
// src/components/sync/CloudSyncIndicator.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  CloudUpload,
  CloudOff,
  AlertCircle,
  WifiOff,
} from 'lucide-react';
import { SyncEngine, SyncStatus } from '../../services/sync/syncEngine';

interface CloudSyncIndicatorProps {
  compact?: boolean;
  onSyncCompleted?: () => void;
}

export const CloudSyncIndicator: React.FC<CloudSyncIndicatorProps> = ({
  compact = false,
  onSyncCompleted,
}) => {
  const [status, setStatus] = useState<SyncStatus>(() => SyncEngine.getStatus());
  const [isSyncingInFlight, setIsSyncingInFlight] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  useEffect(() => {
    // Subskrybuj zdarzenia silnika synchronizacji
    const unsubscribe = SyncEngine.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    const handleOnline = () => setStatus(SyncEngine.getStatus());
    const handleOffline = () => setStatus(SyncEngine.getStatus());

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleTriggerSync = useCallback(async () => {
    if (isSyncingInFlight || !status.isOnline) return;

    setIsSyncingInFlight(true);
    try {
      await SyncEngine.flushOutbox();
      setShowSuccessToast(true);
      if (onSyncCompleted) onSyncCompleted();
      setTimeout(() => setShowSuccessToast(false), 2800);
    } catch (err) {
      console.error('[CloudSyncIndicator] Błąd manualnej synchronizacji:', err);
    } finally {
      setIsSyncingInFlight(false);
    }
  }, [isSyncingInFlight, status.isOnline, onSyncCompleted]);

  // Formatowanie względnego czasu ostatniej synchronizacji
  const formatLastSync = (ts: string | null): string => {
    if (!ts) return 'przed chwilą';
    try {
      const diffMs = Date.now() - new Date(ts).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'przed chwilą';
      if (diffMins < 60) return `${diffMins}m temu`;
      const diffHours = Math.floor(diffMins / 60);
      return `${diffHours}h temu`;
    } catch {
      return 'przed chwilą';
    }
  };

  const isSyncing = isSyncingInFlight || status.syncState === 'syncing';
  const hasPending = status.pendingCount > 0;
  const isOffline = !status.isOnline || status.syncState === 'offline';
  const isError = status.syncState === 'error';

  // 1. TRYB OFFLINE
  if (isOffline) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 border border-stone-300 text-stone-600 text-xs font-semibold cursor-help"
        title="Brak połączenia z siecią. Wszystkie dane są bezpiecznie zapisywane lokalnie na dysku SQLite tego laptopa. Synchronizacja nastąpi automatycznie po przywróceniu połączenia."
      >
        <CloudOff className="w-3.5 h-3.5 text-stone-500" />
        {!compact && <span>Tryb lokalny (Offline)</span>}
      </div>
    );
  }

  // 2. BŁĄD SYNCHRONIZACJI
  if (isError) {
    return (
      <button
        onClick={handleTriggerSync}
        disabled={isSyncing}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 text-xs font-bold transition-all cursor-pointer animate-pulse"
        title="Wystąpił problem podczas synchronizacji. Kliknij, aby ponowić próbę przesłania danych."
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        {!compact && <span>Błąd synchronizacji (Ponów)</span>}
      </button>
    );
  }

  // 3. W TRAKCIE SYNCHRONIZACJI
  if (isSyncing) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold cursor-wait"
        title="Trwa przesyłanie zmian grafików i danych do skarbca chmurowego Firebase..."
      >
        <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
        {!compact && <span>Synchronizowanie...</span>}
      </div>
    );
  }

  // 4. OCZEKUJĄCE ZMIANY (PENDING OUTBOX)
  if (hasPending) {
    return (
      <button
        onClick={handleTriggerSync}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-all cursor-pointer group shadow-2xs"
        title={`W kolejce oczekuje ${status.pendingCount} zmian. Kliknij, aby zsynchronizować teraz z chmurą.`}
      >
        <CloudUpload className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform shrink-0" />
        <span>Oczekuje: <strong>{status.pendingCount}</strong></span>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      </button>
    );
  }

  // 5. W 100% ZSYNCHRONIZOWANO (IDLE / SUCCESS)
  return (
    <div className="relative">
      <button
        onClick={handleTriggerSync}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/90 text-[#006241] text-xs font-bold transition-all cursor-pointer group shadow-2xs"
        title="Dane kawiarni są w 100% zsynchronizowane z chmurą Firebase. Kliknij, aby wymusić natychmiastowe odświeżenie."
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 group-hover:rotate-12 transition-transform shrink-0" />
        {!compact ? (
          <span>Zsynchronizowano <span className="text-[10px] text-emerald-700/80 font-normal">({formatLastSync(status.lastSyncAt)})</span></span>
        ) : (
          <span>Chmura ✓</span>
        )}
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      </button>

      {/* Dyskretny toast potwierdzenia synchronizacji */}
      {showSuccessToast && (
        <div className="absolute right-0 top-full mt-1.5 bg-[#1E3932] text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-lg border border-emerald-500/30 whitespace-nowrap z-50 animate-in fade-in slide-in-from-top-1">
          ✓ Zsynchronizowano pomyślnie z chmurą
        </div>
      )}
    </div>
  );
};
```

---

## 4. UI & Navigation Pruning

### 4.1 Profile Security Policy Engine (`src/services/security/profilePolicyService.ts`)
To eliminate ad-hoc conditionals scattered across components and ensure strict, testable security boundaries, a dedicated `ProfilePolicyService` must govern all UI feature gates:

```typescript
// src/services/security/profilePolicyService.ts
export type AppRuntimeMode = 'FLEET_MASTER' | 'STORE_CLIENT';

export interface ProfileSecurityPolicy {
  // Destructive Database Operations
  allowCleanSlateReset: boolean;
  allowHistoricalImport: boolean;
  allowRawDatabaseOverwrite: boolean;
  allowManualVacuumPragma: boolean;
  
  // Settings Tabs & Diagnostics
  allowFirebaseFleetTab: boolean;
  allowTestingGuideTab: boolean;
  
  // Navigation & Multi-Store Hopping
  allowStoreSwitching: boolean;
  allowCustomStoreAddition: boolean;
  allowFleetMasterDashboard: boolean;
  
  // Client Features
  showCloudSyncIndicator: boolean;
  showStationLockedBadge: boolean;
}

export class ProfilePolicyService {
  /**
   * Zwraca politykę uprawnień interfejsu dla danego profilu runtime.
   * Domyślnie (fail-safe) stosuje najbardziej restrykcyjny profil STORE_CLIENT.
   */
  public static getPolicy(mode?: string | null): ProfileSecurityPolicy {
    if (mode === 'FLEET_MASTER') {
      return {
        allowCleanSlateReset: true,
        allowHistoricalImport: true,
        allowRawDatabaseOverwrite: true,
        allowManualVacuumPragma: true,
        allowFirebaseFleetTab: true,
        allowTestingGuideTab: true,
        allowStoreSwitching: true,
        allowCustomStoreAddition: true,
        allowFleetMasterDashboard: true,
        showCloudSyncIndicator: true,
        showStationLockedBadge: false,
      };
    }

    // Fail-safe: STORE_CLIENT (domyślny i dla wszelkich nieznanych/błędnych wartości)
    return {
      allowCleanSlateReset: false,
      allowHistoricalImport: false,
      allowRawDatabaseOverwrite: false,
      allowManualVacuumPragma: false,
      allowFirebaseFleetTab: false,
      allowTestingGuideTab: false,
      allowStoreSwitching: false,
      allowCustomStoreAddition: false,
      allowFleetMasterDashboard: false,
      showCloudSyncIndicator: true,
      showStationLockedBadge: true,
    };
  }

  /**
   * Weryfikuje, czy przełączenie do lokalu targetStoreId jest dopuszczalne dla danego profilu.
   */
  public static canSwitchToStore(
    mode: AppRuntimeMode | string,
    targetStoreId: string,
    assignedStoreIds: string[] = []
  ): boolean {
    if (!targetStoreId) return false;
    if (mode === 'FLEET_MASTER') return true;

    // STORE_CLIENT może pracować wyłącznie w ramach przypisanych jednostek
    const normalizedTarget = targetStoreId.toLowerCase().trim();
    return assignedStoreIds.some((id) => id.toLowerCase().trim() === normalizedTarget);
  }

  /**
   * Filtruje katalog kawiarni do jednostek dozwolonych dla profilu.
   */
  public static filterStoresForProfile<T extends { id: string; unitCode?: string; mpk?: string }>(
    stores: T[],
    mode: AppRuntimeMode | string,
    assignedStoreIds: string[] = []
  ): T[] {
    if (mode === 'FLEET_MASTER') {
      return stores;
    }

    if (!assignedStoreIds || assignedStoreIds.length === 0) {
      return [];
    }

    const assignedSet = new Set(assignedStoreIds.map((id) => id.toLowerCase().trim()));
    return stores.filter((s) => {
      const idMatch = assignedSet.has(s.id.toLowerCase().trim());
      const unitMatch = s.unitCode ? assignedSet.has(s.unitCode.toLowerCase().trim()) : false;
      const mpkMatch = s.mpk ? assignedSet.has(s.mpk.toLowerCase().trim()) : false;
      return idMatch || unitMatch || mpkMatch;
    });
  }
}
```

---

### 4.2 Pruning `DatabaseBackupModal.tsx`

#### Hazardous Elements Identified in Codebase:
1. **Clean Slate Reset (`handleCleanSlateReset`)**:
   - Lines 493–536: Confirmation dialog for Clean Slate.
   - Lines 789–809: Card "Wersja Startowa / Clean Slate (Wyczyść)".
   - Risk: Completely wipes operational database to empty slate on store laptop.
2. **Import Historical Package (`handleImportHistoricalPackage`)**:
   - Lines 442–490: Confirmation dialog for historical package.
   - Lines 768–787: Card "Wgraj z ./IMPORT/".
   - Risk: Overwrites local store database with external files from `IMPORT/`.
3. **Raw Export to IMPORT (`handleExportPackage`)**:
   - Lines 747–766: Card "Eksport do ./IMPORT/".
   - Risk: Writes unencrypted raw database tables to local disk.

#### Implementation Changes for `DatabaseBackupModal.tsx`:
Add prop `appMode?: 'FLEET_MASTER' | 'STORE_CLIENT'` (defaulting to `'STORE_CLIENT'`).

```tsx
// W DatabaseBackupModal.tsx:
interface DatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess?: () => void;
  appMode?: 'FLEET_MASTER' | 'STORE_CLIENT';
}

export const DatabaseBackupModal: React.FC<DatabaseBackupModalProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
  appMode = 'STORE_CLIENT',
}) => {
  const policy = ProfilePolicyService.getPolicy(appMode);

  // 1. BLOKADA POTWIERDZENIA CLEAN SLATE W TRYBIE STORE_CLIENT
  // {policy.allowCleanSlateReset && confirmCleanSlate && ( ... )}

  // 2. BLOKADA POTWIERDZENIA IMPORTU PAKIETU W TRYBIE STORE_CLIENT
  // {policy.allowHistoricalImport && confirmHistoricalImport && ( ... )}

  // 3. SEKCJA CENTRUM PACZEK (Lines 705-810) - CHOWANIE DLA STORE_CLIENT
  // W trybie STORE_CLIENT wyświetlana jest bezpieczna karta informacyjna kopii:
  {policy.allowCleanSlateReset || policy.allowHistoricalImport ? (
    // Pełne Centrum Paczek dla FLEET_MASTER (Lines 705-810)
    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
      {/* 4 karty: Migracja do chmury, Eksport do IMPORT, Wgraj z IMPORT, Clean Slate */}
    </div>
  ) : (
    // Zabezpieczony panel dla STORE_CLIENT
    <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-white border border-emerald-200 text-[#006241]">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-[#1E3932] uppercase tracking-wide">
            Automatyczna Ochrona Danych Kawiarni
          </h4>
          <p className="text-[11px] text-stone-600 mt-0.5">
            System tworzy automatyczne punkty przywracania przed każdą zmianą w grafiku. Ostatnie 15 kopii jest chronione rotacyjnie.
          </p>
        </div>
      </div>
      <button
        onClick={handleCreateBackup}
        disabled={isCreating}
        className="px-3.5 py-2 rounded-xl bg-[#006241] hover:bg-[#004f34] text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
      >
        <PlusCircle className="w-3.5 h-3.5 text-[#CBA258]" />
        <span>{isCreating ? 'Tworzenie...' : 'Utwórz Kopię Ratunkową'}</span>
      </button>
    </div>
  )}
```

---

### 4.3 Pruning `UnifiedSettingsModal.tsx`

#### Hazardous Elements Identified in Codebase:
1. **Tab `firebase_fleet`**:
   - Lines 82, 713–732, 1905: Exposes nationwide machine telemetry, IP addresses, and installation states.
2. **Tab `testing_guide`**:
   - Lines 83, 687–704, 1697: Exposes developer checklists and manual testing instructions.
3. **Store Switcher Button ("Przełącz lub Dodaj Kawiarnię...")**:
   - Lines 2185–2193: Opens store hopping modal from Settings.
4. **Manual SQLite VACUUM & PRAGMA Integrity Check**:
   - Lines 2325–2343: Exposes manual database maintenance triggers to Store Managers.

#### Implementation Changes for `UnifiedSettingsModal.tsx`:
Add prop `appMode?: 'FLEET_MASTER' | 'STORE_CLIENT'` (defaulting to `'STORE_CLIENT'`).

```tsx
// W UnifiedSettingsModal.tsx:
interface UnifiedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ...
  appMode?: 'FLEET_MASTER' | 'STORE_CLIENT';
}

export const UnifiedSettingsModal: React.FC<UnifiedSettingsModalProps> = ({
  // ...
  appMode = 'STORE_CLIENT',
}) => {
  const policy = ProfilePolicyService.getPolicy(appMode);

  // 1. PRUNING TABU 'testing_guide'
  // Zamień lines 686-704 na:
  {policy.allowTestingGuideTab && (
    <button
      onClick={() => setActiveTab('testing_guide')}
      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
        activeTab === 'testing_guide' ? 'bg-[#006241] text-white' : 'text-stone-700 hover:bg-stone-200/70'
      }`}
    >
      <div className="flex items-center space-x-2.5">
        <BookOpen className="w-4 h-4 text-amber-600" />
        <span>Samouczek & Pilotaż</span>
      </div>
    </button>
  )}

  // 2. PRUNING TABU 'firebase_fleet'
  // Zamień lines 713-732 na:
  {policy.allowFirebaseFleetTab && (
    <button
      onClick={() => setActiveTab('firebase_fleet')}
      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer mb-1 ${
        activeTab === 'firebase_fleet' ? 'bg-[#1E3932] text-white' : 'text-stone-700 hover:bg-stone-200/70'
      }`}
    >
      <div className="flex items-center space-x-2.5">
        <Flame className="w-4 h-4 text-amber-500" />
        <span>Flota & Instalacje</span>
      </div>
    </button>
  )}

  // 3. PRUNING PRZYCISKU "Przełącz lub Dodaj Kawiarnię..." (Lines 2185-2193)
  // W trybie STORE_CLIENT ukryj przycisk i zastąp go statycznym wskaźnikiem stacji:
  {policy.allowStoreSwitching ? (
    <button
      onClick={openStoreSwitcher}
      className="w-full mt-2.5 px-3 py-2 bg-white hover:bg-emerald-50 border border-stone-300 hover:border-[#006241] text-[#006241] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs group"
    >
      <Store className="w-3.5 h-3.5 text-[#CBA258]" />
      <span>Przełącz lub Dodaj Kawiarnię...</span>
      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
    </button>
  ) : (
    <div className="w-full mt-2.5 px-3 py-2 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs flex items-center justify-between text-stone-700">
      <span className="flex items-center gap-1.5 font-bold text-[#006241]">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        Stacja dedykowana: {currentStore.shortName}
      </span>
      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-white px-1.5 py-0.5 rounded border border-emerald-300">
        Unit {currentStore.unitCode}
      </span>
    </div>
  )}

  // 4. USUNIĘCIE RĘCZNYCH PRZYCISKÓW VACUUM I PRAGMA (Lines 2323-2344)
  // W trybie STORE_CLIENT zastąp przyciski automatycznym wskaźnikiem:
  {policy.allowManualVacuumPragma ? (
    <div className="flex items-center gap-2 shrink-0">
      <button onClick={handleCheckDbIntegrity} ...>Test Spójności</button>
      <button onClick={handleOptimizeDb} ...>Optymalizuj (VACUUM)</button>
    </div>
  ) : (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-100/70 border border-emerald-200 text-[#006241] text-xs font-bold">
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
      <span>Automatyczna obsługa SQLite (100% OK)</span>
    </div>
  )}
```

---

## 5. Automated Security Test Suite (`tests/security/profile_isolation.test.ts`)

This automated test suite executes under Node's native test runner (`node --import tsx --test "tests/security/**/*.test.ts"`), requiring zero external dependencies and running deterministically in under 100ms.

```typescript
/**
 * Starbucks Operations Suite — Enterprise Security Test Suite
 * File: tests/security/profile_isolation.test.ts
 *
 * Scope: Feature F4 & F6 — Dual-Profile Isolation, Store Scoping & Navigation Hardening
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ProfilePolicyService, AppRuntimeMode } from '../../src/services/security/profilePolicyService';
import { STARBUCKS_STORES_CATALOG, StarbucksStore } from '../../src/constants/starbucksStores';

test('M2-F4/F6: Dual-Profile Isolation & Store Client Security Suite', async (t) => {
  const storeJankiId = '108120';
  const storeNowySwiatId = '108004';
  const storeSadybaId = '108046';

  // ==========================================================================
  // 1. availableStores Filtering by assignedStoreIds
  // ==========================================================================
  await t.test('1.1 STORE_CLIENT filters catalog to strictly 1 assigned store', () => {
    const assigned = [storeJankiId];
    const filtered = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'STORE_CLIENT',
      assigned
    );

    assert.equal(filtered.length, 1, 'STORE_CLIENT must see exactly 1 store');
    assert.equal(filtered[0].id, storeJankiId, 'Store ID must match assigned store');
    assert.equal(filtered[0].unitCode, '18120', 'Unit code must match assigned store');
  });

  await t.test('1.2 STORE_CLIENT filters catalog to multi-store cluster (e.g. 2 stores)', () => {
    const assigned = [storeJankiId, storeNowySwiatId];
    const filtered = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'STORE_CLIENT',
      assigned
    );

    assert.equal(filtered.length, 2, 'STORE_CLIENT cluster must see exactly 2 stores');
    const ids = filtered.map((s) => s.id);
    assert.ok(ids.includes(storeJankiId));
    assert.ok(ids.includes(storeNowySwiatId));
    assert.ok(!ids.includes(storeSadybaId), 'Unassigned store must be excluded');
  });

  await t.test('1.3 STORE_CLIENT with empty assignedStoreIds returns 0 stores (fail-closed)', () => {
    const filtered = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'STORE_CLIENT',
      []
    );

    assert.equal(filtered.length, 0, 'Unassigned STORE_CLIENT must fail-closed to 0 stores');
  });

  await t.test('1.4 FLEET_MASTER sees all 100+ stores regardless of assignedStoreIds parameter', () => {
    const filtered = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'FLEET_MASTER',
      [storeJankiId]
    );

    assert.equal(
      filtered.length,
      STARBUCKS_STORES_CATALOG.length,
      'FLEET_MASTER must see the entire 100+ stores catalog'
    );
    assert.ok(filtered.length >= 100, 'Catalog must contain at least 100 stores');
  });

  await t.test('1.5 STORE_CLIENT matches assigned store by unitCode or MPK case-insensitively', () => {
    const filteredByUnit = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'STORE_CLIENT',
      ['18120'] // Unit code instead of ID
    );
    assert.equal(filteredByUnit.length, 1);
    assert.equal(filteredByUnit[0].id, storeJankiId);

    const filteredLower = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'STORE_CLIENT',
      [' 108120 '] // Whitespace padding
    );
    assert.equal(filteredLower.length, 1);
    assert.equal(filteredLower[0].id, storeJankiId);
  });

  // ==========================================================================
  // 2. Store Switching Prevention in STORE_CLIENT Mode
  // ==========================================================================
  await t.test('2.1 STORE_CLIENT rejects switching to unauthorized / unassigned store', () => {
    const assigned = [storeJankiId];
    const canSwitch = ProfilePolicyService.canSwitchToStore(
      'STORE_CLIENT',
      storeNowySwiatId,
      assigned
    );

    assert.equal(canSwitch, false, 'STORE_CLIENT must be blocked from switching to unassigned store');
  });

  await t.test('2.2 STORE_CLIENT permits switching to an authorized assigned store', () => {
    const assigned = [storeJankiId];
    const canSwitch = ProfilePolicyService.canSwitchToStore(
      'STORE_CLIENT',
      storeJankiId,
      assigned
    );

    assert.equal(canSwitch, true, 'STORE_CLIENT must be permitted to select its assigned store');
  });

  await t.test('2.3 FLEET_MASTER allows unrestricted switching to any store across Poland', () => {
    const canSwitchToJanki = ProfilePolicyService.canSwitchToStore('FLEET_MASTER', storeJankiId, []);
    const canSwitchToNowySwiat = ProfilePolicyService.canSwitchToStore('FLEET_MASTER', storeNowySwiatId, []);
    const canSwitchToSadyba = ProfilePolicyService.canSwitchToStore('FLEET_MASTER', storeSadybaId, []);

    assert.equal(canSwitchToJanki, true);
    assert.equal(canSwitchToNowySwiat, true);
    assert.equal(canSwitchToSadyba, true);
  });

  await t.test('2.4 Invalid or empty targetStoreId is rejected for all profiles', () => {
    assert.equal(ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '', [storeJankiId]), false);
    assert.equal(ProfilePolicyService.canSwitchToStore('FLEET_MASTER', '', []), false);
  });

  // ==========================================================================
  // 3. Developer Options Visibility Flags Based on appMode
  // ==========================================================================
  await t.test('3.1 STORE_CLIENT policy strips all destructive & developer options', () => {
    const policy = ProfilePolicyService.getPolicy('STORE_CLIENT');

    // Destructive DB tools
    assert.equal(policy.allowCleanSlateReset, false, 'Clean slate reset must be disabled');
    assert.equal(policy.allowHistoricalImport, false, 'Historical package import must be disabled');
    assert.equal(policy.allowRawDatabaseOverwrite, false, 'Raw database overwrite must be disabled');
    assert.equal(policy.allowManualVacuumPragma, false, 'Manual VACUUM/PRAGMA must be disabled');

    // Settings tabs
    assert.equal(policy.allowFirebaseFleetTab, false, 'firebase_fleet tab must be pruned');
    assert.equal(policy.allowTestingGuideTab, false, 'testing_guide tab must be pruned');

    // Navigation
    assert.equal(policy.allowStoreSwitching, false, 'Store switcher modal must be blocked');
    assert.equal(policy.allowCustomStoreAddition, false, 'Custom store creation must be blocked');
    assert.equal(policy.allowFleetMasterDashboard, false, 'Fleet Master Dashboard must be hidden');

    // Friendly features
    assert.equal(policy.showCloudSyncIndicator, true, 'CloudSyncIndicator must be enabled');
    assert.equal(policy.showStationLockedBadge, true, 'Locked station badge must be shown');
  });

  await t.test('3.2 FLEET_MASTER policy unlocks full administrative capabilities', () => {
    const policy = ProfilePolicyService.getPolicy('FLEET_MASTER');

    assert.equal(policy.allowCleanSlateReset, true);
    assert.equal(policy.allowHistoricalImport, true);
    assert.equal(policy.allowRawDatabaseOverwrite, true);
    assert.equal(policy.allowManualVacuumPragma, true);
    assert.equal(policy.allowFirebaseFleetTab, true);
    assert.equal(policy.allowTestingGuideTab, true);
    assert.equal(policy.allowStoreSwitching, true);
    assert.equal(policy.allowCustomStoreAddition, true);
    assert.equal(policy.allowFleetMasterDashboard, true);
    assert.equal(policy.showStationLockedBadge, false);
  });

  await t.test('3.3 Failsafe: Unknown or tampered mode defaults strictly to STORE_CLIENT policy', () => {
    const nullPolicy = ProfilePolicyService.getPolicy(null);
    const undefinedPolicy = ProfilePolicyService.getPolicy(undefined);
    const tamperedPolicy = ProfilePolicyService.getPolicy('ATTACKER_OVERRIDE_ADMIN');

    assert.equal(nullPolicy.allowCleanSlateReset, false);
    assert.equal(undefinedPolicy.allowCleanSlateReset, false);
    assert.equal(tamperedPolicy.allowCleanSlateReset, false);

    assert.equal(tamperedPolicy.allowFirebaseFleetTab, false);
    assert.equal(tamperedPolicy.allowStoreSwitching, false);
    assert.equal(tamperedPolicy.allowCustomStoreAddition, false);
  });
});
```

---

## 6. Implementation Roadmap & Verification Checklist

### 6.1 Execution Order for Implementer:
1. **Create Policy Engine**: Write `src/services/security/profilePolicyService.ts`.
2. **Create Test Suite**: Write `tests/security/profile_isolation.test.ts` and verify with `npm run test:security`.
3. **Create Sync Indicator**: Write `src/components/sync/CloudSyncIndicator.tsx`.
4. **Create Store Client View**: Write `src/components/StoreClientView.tsx`.
5. **Prune `DatabaseBackupModal.tsx`**: Add `appMode` prop and guard Clean Slate, Import Historical Package, and manual raw overwrite behind `policy.allowCleanSlateReset` / `policy.allowHistoricalImport`.
6. **Prune `UnifiedSettingsModal.tsx`**: Add `appMode` prop and guard `firebase_fleet`, `testing_guide`, VACUUM/PRAGMA, and Store Switcher button behind `policy`.
7. **Wire into `App.tsx`**: When `appMode === 'STORE_CLIENT'`, render `<StoreClientView />` with pruned modals.
8. **Verify Build & Tests**:
   - `npm run test:security` (Ensures all 53 existing + new profile isolation tests pass).
   - `npm run build` (Ensures zero TypeScript or Vite bundle regressions).
