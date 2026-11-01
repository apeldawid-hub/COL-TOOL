# Technical Architectural Specification & Implementation Strategy: Dual-Profile Runtime Architecture (R2)

**Document**: Dual-Profile Runtime Architecture (`FLEET_MASTER` vs `STORE_CLIENT`)  
**Investigator**: Explorer 1 (`m2_fleet_explorer_1`)  
**Project**: Starbucks Operations Suite (Electron + React 19 + TypeScript + Vite)  
**Date**: 2026-10-26T19:05:00Z  
**Status**: Implementation Blueprint (Read-Only Analysis)  

---

## 1. Executive Summary

This specification delivers the authoritative implementation strategy for **Milestone 2: Dual-Profile Runtime Architecture & Fleet Master Dashboard**. It establishes strict, cryptographic, profile-based segregation across the application, converting the Starbucks Operations Suite from a single monolithic client into two dedicated runtime profiles:

1. **`STORE_CLIENT` (Dedicated Retail Station)**:
   - Deployed on backroom laptops in physical Starbucks stores (e.g. `108120 SBX Warszawa Janki`).
   - Hardware-bound to its physical station and cryptographically locked strictly to its assigned store (`assignedStoreIds: [storeId]`).
   - Store selector is permanently locked: replaces interactive dropdowns with a verified store station badge (`ShieldCheck`, `Lock`, non-clickable).
   - Stripped of all developer options, raw database wipes (Clean Slate, manual file restore), and fleet-wide telemetry.
   - Hosts `<StoreClientView />` featuring an ergonomic Store Manager workflow and a friendly, single-click `<CloudSyncIndicator />`.

2. **`FLEET_MASTER` (Central HQ / District Manager Command Center)**:
   - Deployed for District Managers, Regional Operations Executives, and System Administrators.
   - Unrestricted multi-store switching across all 100+ Starbucks units in Poland.
   - Features `<FleetMasterDashboard />`: macro fleet catalog overview, cryptographic license provisioning modal (`SBX-<storeId>-<randomHex>-<checksum>`), remote Kill-Switch revocation, fleet telemetry, and audit trail.
   - Dual routing in `App.tsx`: allows instant toggling between macro fleet oversight and deep-dive inspection into individual store modules (`labor_forecast`, `managers_schedule`, `col_calculator`, `trainings`).

---

## 2. Profile State Architecture: `AuthContext.tsx` vs `StoreContext.tsx`

### 2.1 Architectural Analysis & Recommendation

| Criterion | Placement in `AuthContext.tsx` (Recommended) | Placement in `StoreContext.tsx` |
| :--- | :--- | :--- |
| **Separation of Concerns** | **Clean**: `appMode` is an identity, security, and licensing attribute derived from station activation and credentials. | **Violates SRP**: Mixes security authorization with retail catalog management. |
| **Provider Hierarchy** | **Natural**: `AuthProvider` wraps `StoreProvider`. `StoreProvider` consumes `appMode` to filter available stores. | **Awkward**: `StoreContext` would have to manage licensing without access to user auth/2FA. |
| **Security Boundary** | **High**: Session auto-lock, in-memory key zeroization, and Kill-Switch events originate in the security/auth domain. | **Low**: Security logic dispersed across UI catalog providers. |
| **Developer Ergonomics** | **Optimal**: `AuthContext` is the single source of truth; `StoreContext` re-exposes `appMode` and `isStoreClient` for convenience. | **Redundant**: Forces duplicate licensing checks in both contexts. |

**Architectural Decision**:  
`appMode: 'FLEET_MASTER' | 'STORE_CLIENT'` and `assignedStoreIds: string[]` MUST reside as authoritative state in **`src/context/AuthContext.tsx`**. `StoreContext.tsx` consumes `useAuth()` to enforce catalog and switching restrictions, and re-exposes `isStoreClient` / `isFleetMaster` so that existing UI components importing `useStore()` do not need widespread refactoring.

### 2.2 Provider Hierarchy in `src/main.tsx`

In `src/main.tsx`, `AuthProvider` is mounted directly above `StoreProvider`:

```tsx
// src/main.tsx
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { TutorialProvider } from './context/TutorialContext';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary moduleName="Aplikacja Główna" fallbackTitle="Awaria Aplikacji Starbucks Operations Suite">
      <TutorialProvider>
        <AuthProvider>
          <StoreProvider>
            <App />
          </StoreProvider>
        </AuthProvider>
      </TutorialProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
```

### 2.3 Interface Contract: `src/context/AuthContext.tsx`

```typescript
// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { licensingService } from '../services/security/licensingService';
import type { LicenseTier, ActiveLicenseRecord, LicenseStatusResult, ActivationResult } from '../types/licensing';
import { AuthService, AuthUserSession } from '../services/auth/authService';
import { AppUserRole } from '../types/admin';

export type AppRuntimeMode = 'FLEET_MASTER' | 'STORE_CLIENT';

export interface AuthContextType {
  // Runtime Profile
  appMode: AppRuntimeMode;
  isFleetMaster: boolean;
  isStoreClient: boolean;
  assignedStoreIds: string[];

  // Station Activation & Licensing
  isStationActivated: boolean;
  licenseStatus: LicenseStatusResult | null;
  activeLicense: ActiveLicenseRecord | null;
  activateStation: (key: string, expectedStoreId?: string) => Promise<ActivationResult>;
  deactivateStation: (reason?: string) => Promise<void>;

  // User Authentication & Session (Pre-M3 & M3 Ready)
  isAuthenticated: boolean;
  currentSession: AuthUserSession | null;
  currentUserRole: AppUserRole | null;
  loginWith2Fa: (email: string, otpCode: string) => Promise<{ success: boolean; message?: string }>;
  quickLoginSM: (unitCode?: string) => AuthUserSession;
  logout: () => void;

  // Inactivity Auto-Lock & Key Zeroization (M3 Ready)
  isLocked: boolean;
  unlockSession: (credential: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Synchronous initial state: Least-Privilege default ('STORE_CLIENT') with cache hydration
  const [appMode, setAppMode] = useState<AppRuntimeMode>(() => {
    try {
      const cached = localStorage.getItem('sbx_app_mode');
      if (cached === 'FLEET_MASTER' || cached === 'STORE_CLIENT') return cached;
    } catch {}
    return 'STORE_CLIENT';
  });

  const [assignedStoreIds, setAssignedStoreIds] = useState<string[]>(() => {
    try {
      const cached = localStorage.getItem('sbx_assigned_stores');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });

  const [isStationActivated, setIsStationActivated] = useState<boolean>(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusResult | null>(null);
  const [activeLicense, setActiveLicense] = useState<ActiveLicenseRecord | null>(null);
  const [currentSession, setCurrentSession] = useState<AuthUserSession | null>(() => AuthService.getCurrentSession());
  const [isLocked, setIsLocked] = useState<boolean>(false);

  // Lifecycle initialization: Cryptographic License Verification via Electron IPC
  useEffect(() => {
    let isMounted = true;

    const initializeStationSecurity = async () => {
      try {
        const status = await licensingService.verifyStationHardwareLock();
        if (!isMounted) return;

        setLicenseStatus(status);

        if (status.status === 'ACTIVATED' && status.license) {
          setIsStationActivated(true);
          setActiveLicense(status.license);

          const tier: AppRuntimeMode = status.license.tier; // 'FLEET_MASTER' | 'STORE_CLIENT'
          setAppMode(tier);

          if (tier === 'STORE_CLIENT') {
            const assigned = [status.license.storeId];
            setAssignedStoreIds(assigned);
            localStorage.setItem('sbx_app_mode', 'STORE_CLIENT');
            localStorage.setItem('sbx_assigned_stores', JSON.stringify(assigned));
          } else {
            // FLEET_MASTER has unrestricted store access
            setAssignedStoreIds([]);
            localStorage.setItem('sbx_app_mode', 'FLEET_MASTER');
            localStorage.removeItem('sbx_assigned_stores');
          }
        } else if (status.status === 'HARDWARE_LOCKOUT' || status.status === 'TAMPER_DETECTED') {
          setIsStationActivated(false);
          setActiveLicense(status.license || null);
          setAppMode('STORE_CLIENT');
          setAssignedStoreIds([]);
          localStorage.setItem('sbx_app_mode', 'STORE_CLIENT');
          if (status.revoked) {
            AuthService.logout();
            setCurrentSession(null);
          }
        } else {
          // UNACTIVATED
          setIsStationActivated(false);
          setActiveLicense(null);
          setAppMode('STORE_CLIENT');
          setAssignedStoreIds([]);
          localStorage.setItem('sbx_app_mode', 'STORE_CLIENT');
        }
      } catch (err) {
        console.error('❌ [AuthContext] Błąd weryfikacji licencji stacji:', err);
        if (isMounted) setAppMode('STORE_CLIENT');
      }
    };

    initializeStationSecurity();

    // Listen for real-time license revocation (Kill-Switch broadcast)
    const handleRevocation = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      console.warn('⚡ [AuthContext] Otrzymano zdarzenie Kill-Switch:', detail);
      setIsStationActivated(false);
      setAppMode('STORE_CLIENT');
      setAssignedStoreIds([]);
      AuthService.logout();
      setCurrentSession(null);
    };

    window.addEventListener('sbx:license-revoked', handleRevocation);
    return () => {
      isMounted = false;
      window.removeEventListener('sbx:license-revoked', handleRevocation);
    };
  }, []);

  const activateStation = useCallback(async (key: string, expectedStoreId?: string) => {
    const res = await licensingService.activateStation(key, expectedStoreId);
    if (res.success && res.license) {
      setIsStationActivated(true);
      setActiveLicense(res.license);
      setAppMode(res.license.tier);
      if (res.license.tier === 'STORE_CLIENT') {
        const assigned = [res.license.storeId];
        setAssignedStoreIds(assigned);
        localStorage.setItem('sbx_app_mode', 'STORE_CLIENT');
        localStorage.setItem('sbx_assigned_stores', JSON.stringify(assigned));
      } else {
        setAssignedStoreIds([]);
        localStorage.setItem('sbx_app_mode', 'FLEET_MASTER');
        localStorage.removeItem('sbx_assigned_stores');
      }
    }
    return res;
  }, []);

  const deactivateStation = useCallback(async (reason = 'Deaktywacja stacji przez użytkownika') => {
    await licensingService.revokeLicense(reason);
    setIsStationActivated(false);
    setActiveLicense(null);
    setAppMode('STORE_CLIENT');
    setAssignedStoreIds([]);
    AuthService.logout();
    setCurrentSession(null);
  }, []);

  const loginWith2Fa = useCallback(async (email: string, otpCode: string) => {
    const res = await AuthService.verify2FaOtp(email, otpCode);
    if (res.success && res.session) {
      setCurrentSession(res.session);
    }
    return res;
  }, []);

  const quickLoginSM = useCallback((unitCode = '') => {
    const session = AuthService.quickLoginStoreManager(unitCode);
    setCurrentSession(session);
    return session;
  }, []);

  const logout = useCallback(() => {
    AuthService.logout();
    setCurrentSession(null);
  }, []);

  const unlockSession = useCallback(async (_credential: string) => {
    // M3 Inactivity unlock implementation
    setIsLocked(false);
    return true;
  }, []);

  const isFleetMaster = appMode === 'FLEET_MASTER';
  const isStoreClient = appMode === 'STORE_CLIENT';
  const isAuthenticated = Boolean(currentSession);
  const currentUserRole = currentSession?.role || null;

  return (
    <AuthContext.Provider
      value={{
        appMode,
        isFleetMaster,
        isStoreClient,
        assignedStoreIds,
        isStationActivated,
        licenseStatus,
        activeLicense,
        activateStation,
        deactivateStation,
        isAuthenticated,
        currentSession,
        currentUserRole,
        loginWith2Fa,
        quickLoginSM,
        logout,
        isLocked,
        unlockSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

---

## 3. Station License Initialization & `appMode` Resolution Flow

```
                      ┌────────────────────────────────────────┐
                      │          Application Startup           │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │    Synchronous Hydration Check         │
                      │  localStorage['sbx_app_mode'] ||       │
                      │       'STORE_CLIENT' (Default)         │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │   Async Verification via Electron IPC  │
                      │ licensingService.verifyHardwareLock()  │
                      └───────────────────┬────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
         [status === 'ACTIVATED']                      [status !== 'ACTIVATED']
                  │                                               │
      ┌───────────┴───────────┐                       ┌───────────┴───────────┐
      ▼                       ▼                       ▼                       ▼
[tier === 'FLEET_MASTER']  [tier === 'STORE_CLIENT'] [HARDWARE_LOCKOUT /     [UNACTIVATED]
      │                       │                       TAMPER_DETECTED]        │
      ▼                       ▼                       ▼                       ▼
appMode = 'FLEET_MASTER'   appMode = 'STORE_CLIENT'   appMode = 'STORE_CLIENT' appMode = 'STORE_CLIENT'
assignedStoreIds = []      assignedStoreIds = [store] isStationActivated=false isStationActivated=false
Unlock FleetMaster & Nav   Lock StoreContext & UI     Lock Station / Zeroize  Trigger ActivationModal
```

### 3.1 Tier Derivation Details

1. **Entropy Byte 0**: In `src/services/security/licensingService.ts` (lines 245–248), key generation encodes tier:
   - `01` = `STORE_CLIENT`
   - `FF` = `FLEET_MASTER`
2. **Cryptographic Validation**: `validateKeyFormat(key)` decodes Byte 0 and `verifyKeySignature(key)` verifies the HMAC-SHA256 signature against the canonical payload `SBX:<tier>:<storeId>:<randomHex>`.
3. **Envelope Seal**: On activation, `ActiveLicenseRecord` records `tier: LicenseTier` and is sealed into `userData/security/license.enc` via OS Keychain (`safeStorage`).
4. **Resolution Timing**:
   - Initial render initializes with cached state (prevents UI flicker).
   - `verifyStationHardwareLock()` completes asynchronously (~15ms on macOS) and promotes/locks `appMode`.
   - Real-time Kill-Switch updates (`sbx:license-revoked`) downgrade `appMode` to `'STORE_CLIENT'` and invalidate all tokens.

---

## 4. Restricting `availableStores` and `storeService.ts` in `STORE_CLIENT` Mode

### 4.1 Multi-Key Store Matching in `storeService.ts`

Stores in Starbucks operations are referenced by three identifiers:
- `id`: Internal slug or MPK (e.g. `'108120'`, `'108004'`)
- `unitCode`: Operations unit number (e.g. `'18120'`, `'323'`, `'384'`)
- `mpk`: Cost center identifier (e.g. `'108120'`)

To guarantee that a license issued for `108120` correctly matches store records whether filtered by `id`, `unitCode`, or `mpk`, `storeService.ts` must provide canonical matching helpers:

```typescript
// Additions to src/services/storeService.ts

/**
 * Checks whether a given store matches any identifier in an assigned store ID list.
 */
public static isStoreAssigned(store: StarbucksStore, assignedStoreIds: string[]): boolean {
  if (!assignedStoreIds || assignedStoreIds.length === 0) return false;
  
  const normalizedAssigned = assignedStoreIds.map(id => id.trim().toLowerCase());
  
  const matches = (candidate?: string) => 
    Boolean(candidate && normalizedAssigned.includes(candidate.trim().toLowerCase()));

  return matches(store.id) || matches(store.unitCode) || matches(store.mpk);
}

/**
 * Returns stores filtered by the active runtime profile.
 * - FLEET_MASTER: Returns all 100+ stores.
 * - STORE_CLIENT: Returns only stores matching assignedStoreIds.
 */
public static getAvailableStoresForProfile(
  mode: AppRuntimeMode,
  assignedStoreIds: string[] = []
): StarbucksStore[] {
  const allStores = this.getAllStores();
  
  if (mode === 'FLEET_MASTER') {
    return allStores;
  }

  // STORE_CLIENT mode
  if (assignedStoreIds.length === 0) {
    const current = this.getCurrentStore();
    return current.id ? [current] : [];
  }

  const filtered = allStores.filter(store => this.isStoreAssigned(store, assignedStoreIds));
  
  if (filtered.length === 0) {
    const current = this.getCurrentStore();
    if (current.id && this.isStoreAssigned(current, assignedStoreIds)) {
      return [current];
    }
  }

  return filtered;
}
```

### 4.2 Security Guards on Database Switching and Custom Stores

In `src/services/storeService.ts`:

```typescript
// Guard on setCurrentStore()
public static async setCurrentStore(
  store: StarbucksStore,
  securityContext?: { appMode: AppRuntimeMode; assignedStoreIds: string[] }
): Promise<{ success: boolean; isNew?: boolean; error?: string }> {
  // Security Guard: Prevent store hopping in STORE_CLIENT mode
  if (securityContext?.appMode === 'STORE_CLIENT') {
    if (!this.isStoreAssigned(store, securityContext.assignedStoreIds)) {
      logger.warn('SECURITY', `[Access Denied] Zablokowano próbę zmiany kawiarni na ${store.name} (${store.id}) na stacji klienckiej.`, {
        storeId: store.id,
        assignedStoreIds: securityContext.assignedStoreIds,
      });
      return { success: false, error: 'Unauthorized: Station locked to assigned store.' };
    }
  }

  // Proceed with existing database switching...
}

// Guard on addCustomStore()
public static async addCustomStore(
  store: StarbucksStore,
  activate = true,
  securityContext?: { appMode: AppRuntimeMode }
): Promise<{ success: boolean; isNew?: boolean; error?: string }> {
  if (securityContext?.appMode === 'STORE_CLIENT') {
    logger.warn('SECURITY', `[Access Denied] Dodawanie własnych kawiarni jest zablokowane na stacji klienckiej.`);
    return { success: false, error: 'Feature disabled on store stations.' };
  }

  // Proceed with existing custom store persistence...
}
```

### 4.3 Refactored `StoreContext.tsx` Integration

`StoreContext` consumes `useAuth()` and guarantees tenant convergence:

```typescript
// src/context/StoreContext.tsx
export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { appMode, assignedStoreIds, isStoreClient, isFleetMaster } = useAuth();

  const [currentStore, setCurrentStoreState] = useState<StarbucksStore>(() => StoreService.getCurrentStore());
  const [isStoreSwitcherOpen, setIsStoreSwitcherOpen] = useState<boolean>(false);

  // Profile-aware availableStores
  const availableStores = useMemo(() => {
    return StoreService.getAvailableStoresForProfile(appMode, assignedStoreIds);
  }, [appMode, assignedStoreIds]);

  // Auto-convergence: If currently loaded store is not among assignedStoreIds, switch immediately
  useEffect(() => {
    if (isStoreClient && assignedStoreIds.length > 0) {
      const isAllowed = StoreService.isStoreAssigned(currentStore, assignedStoreIds);
      if (!isAllowed) {
        const target = availableStores[0] || StoreService.findStoreByIdOrCode(assignedStoreIds[0]);
        if (target) {
          console.log(`🏬 [StoreContext] Auto-konwergencja do przypisanego lokalu: ${target.name} (${target.unitCode})`);
          StoreService.setCurrentStore(target, { appMode, assignedStoreIds }).then(() => {
            setCurrentStoreState(target);
          });
        }
      }
    }
  }, [isStoreClient, assignedStoreIds, currentStore, availableStores, appMode]);

  const switchStore = useCallback(async (storeOrId: StarbucksStore | string) => {
    let targetStore: StarbucksStore | undefined;
    if (typeof storeOrId === 'string') {
      targetStore = StoreService.getAllStores().find(
        (s) => s.id === storeOrId || s.mpk === storeOrId || s.unitCode === storeOrId
      );
    } else {
      targetStore = storeOrId;
    }

    if (!targetStore) {
      return { success: false, error: 'Nie znaleziono wybranej kawiarni' };
    }

    if (isStoreClient && !StoreService.isStoreAssigned(targetStore, assignedStoreIds)) {
      console.error(`[Security Guard] Odrzucono próbę zmiany lokalu na: ${targetStore.name}`);
      return { success: false, error: 'Przełączanie kawiarni zablokowane na stacji klienckiej' };
    }

    const res = await StoreService.setCurrentStore(targetStore, { appMode, assignedStoreIds });
    setCurrentStoreState(targetStore);
    return res;
  }, [isStoreClient, assignedStoreIds, appMode]);

  const addCustomStore = useCallback(async (store: StarbucksStore, activate = true) => {
    if (isStoreClient) {
      console.warn('[Security Guard] Dodawanie własnych kawiarni jest wyłączone w trybie STORE_CLIENT.');
      return { success: false, error: 'Dodawanie kawiarni jest wyłączone na stacjach klienckich' };
    }
    const res = await StoreService.addCustomStore(store, activate, { appMode });
    if (activate) {
      setCurrentStoreState(store);
    }
    return res;
  }, [isStoreClient, appMode]);

  const openStoreSwitcher = useCallback(() => {
    if (isStoreClient) {
      // In STORE_CLIENT mode, StoreSwitcher is locked
      return;
    }
    setIsStoreSwitcherOpen(true);
  }, [isStoreClient]);

  const closeStoreSwitcher = useCallback(() => {
    setIsStoreSwitcherOpen(false);
  }, []);

  return (
    <StoreContext.Provider
      value={{
        currentStore,
        availableStores,
        appMode,
        isStoreClient,
        isFleetMaster,
        assignedStoreIds,
        switchStore,
        addCustomStore,
        removeCustomStore: StoreService.removeCustomStore,
        isStoreSwitcherOpen,
        openStoreSwitcher,
        closeStoreSwitcher,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};
```

---

## 5. UI Locking & Disabling: Header, Sidebar, and StoreSwitcherModal

### 5.1 `src/components/Header.tsx` Store Badge

In `Header.tsx` (lines 158–173), replace the interactive dropdown button with conditional rendering:

```tsx
// Inside src/components/Header.tsx
const { currentStore, openStoreSwitcher, isStoreClient } = useStore();

{/* Store Badge Area */}
{isStoreClient ? (
  /* Verified Store Station Badge (Non-clickable / Read-only) */
  <div
    title={`Stacja robocza licencjonowana dla lokalu: ${currentStore.name} (Unit: ${currentStore.unitCode}, MPK: ${currentStore.mpk}). Przełączanie kawiarni zablokowane na stacji zaplecza.`}
    className="flex items-center space-x-1.5 text-[11px] text-emerald-900 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200/90 shadow-2xs select-none cursor-default"
  >
    <ShieldCheck className="w-3.5 h-3.5 text-[#006241] shrink-0" />
    <span className="font-bold text-[#006241] truncate max-w-[130px] sm:max-w-[180px]">
      {currentStore.shortName}
    </span>
    <span className="text-emerald-300">•</span>
    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-white/90 px-1 py-0.2 rounded border border-emerald-300/60">
      {currentStore.unitCode}
    </span>
    <Lock className="w-3 h-3 text-emerald-600/70 ml-0.5 shrink-0" />
  </div>
) : (
  /* FLEET_MASTER Interactive Dropdown Button */
  <button
    onClick={openStoreSwitcher}
    title={`Aktywna kawiarnia: ${currentStore.name} (Unit: ${currentStore.unitCode}, MPK: ${currentStore.mpk}). Kliknij, aby przełączyć kawiarnię.`}
    className="flex items-center space-x-1.5 text-[11px] text-[#5C6F68] hover:text-[#006241] bg-stone-100/70 hover:bg-emerald-50 px-2 py-0.5 rounded-lg border border-transparent hover:border-emerald-200 transition-all cursor-pointer group/store"
  >
    <Store className="w-3.5 h-3.5 text-[#CBA258] group-hover/store:scale-110 transition-transform shrink-0" />
    <span className="font-bold text-[#1E3932] group-hover/store:text-[#006241] truncate max-w-[130px] sm:max-w-[180px]">
      {currentStore.shortName}
    </span>
    <span className="text-stone-300">•</span>
    <span className="text-[10px] font-mono font-bold text-stone-600 bg-white px-1 py-0.2 rounded border border-stone-200">
      {currentStore.unitCode}
    </span>
    <ChevronsUpDown className="w-3 h-3 text-stone-400 group-hover/store:text-[#006241] transition-colors ml-0.5 shrink-0" />
  </button>
)}
```

### 5.2 `src/components/Sidebar.tsx` Store Badge & Admin Tool Restrictions

In `Sidebar.tsx`:
1. **Store Switcher Button (lines 181–207)**:
   - When `isStoreClient === true`: Render non-clickable badge with `ShieldCheck` and `Lock` icons.
   - When `isStoreClient === false`: Retain interactive `openStoreSwitcher` button.
2. **Admin Console Button (lines 328–357)**:
   - In `STORE_CLIENT` mode: Restrict to Store Manager local access requests; hide root fleet administrative functions.

```tsx
// Inside src/components/Sidebar.tsx
const { currentStore, openStoreSwitcher, isStoreClient } = useStore();

{/* Store Indicator in Sidebar */}
{!isCollapsed ? (
  isStoreClient ? (
    <div
      title={`Stacja robocza przypisana do lokalu: ${currentStore.name} (${currentStore.unitCode})`}
      className="w-[calc(100%-24px)] mx-3 my-2.5 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs select-none cursor-default"
    >
      <div className="flex items-center space-x-2 min-w-0 pr-1">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="font-bold text-white truncate text-left">{currentStore.shortName}</span>
      </div>
      <div className="flex items-center space-x-1 shrink-0">
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#006241] text-emerald-100 font-bold">
          {currentStore.unitCode}
        </span>
        <Lock className="w-3 h-3 text-emerald-400/80 ml-0.5" />
      </div>
    </div>
  ) : (
    <button
      onClick={openStoreSwitcher}
      title={`Aktywna kawiarnia: ${currentStore.name} (Unit: ${currentStore.unitCode}). Kliknij, aby zmienić.`}
      className="w-[calc(100%-24px)] mx-3 my-2.5 px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/40 flex items-center justify-between text-xs transition-all cursor-pointer group/sidebar-store"
    >
      <div className="flex items-center space-x-2 min-w-0 pr-1">
        <Store className="w-3.5 h-3.5 text-[#CBA258] shrink-0 group-hover/sidebar-store:scale-110 transition-transform" />
        <span className="font-bold text-white truncate text-left">{currentStore.shortName}</span>
      </div>
      <div className="flex items-center space-x-1 shrink-0">
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#006241] text-emerald-100 font-bold">
          {currentStore.unitCode}
        </span>
        <ChevronsUpDown className="w-3 h-3 text-emerald-300/60 group-hover/sidebar-store:text-white transition-colors" />
      </div>
    </button>
  )
) : (
  isStoreClient ? (
    <div
      title={`Stacja robocza przypisana do lokalu: ${currentStore.name} (${currentStore.unitCode})`}
      className="mx-auto my-2 p-2.5 rounded-xl bg-white/5 text-emerald-400 border border-white/10 flex items-center justify-center select-none"
    >
      <ShieldCheck className="w-4 h-4" />
    </div>
  ) : (
    <button
      onClick={openStoreSwitcher}
      title={`Aktywna kawiarnia: ${currentStore.name} (${currentStore.unitCode}) - Kliknij, aby zmienić`}
      className="mx-auto my-2 p-2.5 rounded-xl bg-white/5 hover:bg-[#006241] text-[#CBA258] hover:text-white border border-white/10 transition-all cursor-pointer flex items-center justify-center"
    >
      <Store className="w-4 h-4" />
    </button>
  )
)}
```

### 5.3 `src/components/StoreSwitcherModal.tsx` Defensive Lockdown

Even if `StoreSwitcherModal` is accidentally invoked in `STORE_CLIENT` mode:
1. **Defensive Early Exit**:
   ```tsx
   if (isStoreClient) {
     return null;
   }
   ```
2. **Purge "Add Custom Store"**: The `ADD_NEW` tab is excluded entirely if `isStoreClient`.
3. **Hard Filter**: The list renders only `availableStores` (which in `STORE_CLIENT` contains only the licensed store).

---

## 6. App Routing Architecture in `src/App.tsx`

### 6.1 Type System Extension: `AppModule`

In `src/types/index.ts`:

```typescript
export type AppModule =
  | 'fleet_master'       // <-- NEW: Fleet Master Control Center View
  | 'dashboard'
  | 'labor_forecast'
  | 'managers_schedule'
  | 'trainings'
  | 'col_calculator'
  | 'analytics'
  | 'ibs_ims';
```

### 6.2 Dual-Profile Navigation in `Sidebar.tsx`

In `Sidebar.tsx`, dynamically inject the `fleet_master` item when in `FLEET_MASTER` mode:

```typescript
const FLEET_MASTER_NAV_ITEM: NavItem = {
  id: 'fleet_master',
  label: 'Centrala Floty (100+)',
  icon: ShieldCheck,
  badge: 'HQ',
  badgeType: 'active',
};

// In Sidebar component:
const navItems = useMemo(() => {
  if (isFleetMaster) {
    return [FLEET_MASTER_NAV_ITEM, ...BASE_NAV_ITEMS];
  }
  return BASE_NAV_ITEMS; // Exclude 'fleet_master' completely in STORE_CLIENT mode
}, [isFleetMaster]);
```

### 6.3 Routing Logic in `src/App.tsx`

In `src/App.tsx`:

1. **Default Module Resolution**:
   - `FLEET_MASTER`: Defaults `activeModule` to `'fleet_master'` on login, presenting the macro fleet overview.
   - `STORE_CLIENT`: Defaults `activeModule` to `'dashboard'`. If user attempts to set `'fleet_master'`, it is redirected to `'dashboard'`.
2. **View Rendering Branch**:
   When `activeModule === 'fleet_master'`: Renders `<FleetMasterDashboard />`.
   When in `FLEET_MASTER` mode and viewing store modules: The District Manager views the exact operational schedule for the store selected via the switcher, with a top banner indicating "Podgląd centralny lokalu: [Store]".
   When in `STORE_CLIENT` mode: The app renders `<StoreClientView />` locked to the assigned store.

```tsx
// Inside src/App.tsx (Main Content Render)

{/* FLEET MASTER HQ DASHBOARD */}
{activeModule === 'fleet_master' && isFleetMaster && (
  <ErrorBoundary moduleName="Fleet Master Dashboard" fallbackTitle="Błąd w Centrali Floty">
    <FleetMasterDashboard
      onNavigateToStore={async (storeId) => {
        // District Manager clicks "Przełącz na lokal"
        await switchStore(storeId);
        setActiveModule('dashboard'); // Switch to that store's operations
      }}
    />
  </ErrorBoundary>
)}

{/* STORE CLIENT VIEW / OPERATIONAL MODULES */}
{activeModule !== 'fleet_master' && (
  isStoreClient ? (
    <StoreClientView
      activeModule={activeModule}
      onNavigateModule={setActiveModule}
      selectedYear={selectedYear}
      selectedMonth={selectedMonth}
      onPeriodChange={(y, m) => {
        setSelectedYear(y);
        setSelectedMonth(m);
      }}
      // Module datasets passed cleanly into StoreClientView
      aopPlan={aopPlan}
      summary={summary}
      weeks={weeks}
      onRefresh={loadMonthData}
      isLoading={isLoading}
      // ...
    />
  ) : (
    /* Standard Master view of individual store modules */
    <main className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 md:px-5 py-4 pb-24 w-full">
      {/* Existing module renderers (Dashboard, LaborForecast, ManagerSchedule, etc.) */}
    </main>
  )
)}
```

### 6.4 `StoreClientView.tsx` Component Design

**Path**: `/Users/dawidapel/COL Tool/src/components/StoreClientView.tsx`

Features of `StoreClientView`:
1. **Header Integration**: Renders the verified store badge and `<CloudSyncIndicator />` prominently.
2. **Clean Layout**: Zero developer jargon, zero DB reset buttons, optimized for 13" laptop screens.
3. **Module Host**: Hosts the active operational module (`dashboard`, `labor_forecast`, `managers_schedule`, `trainings`, `col_calculator`).
4. **Safety Filter**: Prevents rendering any administrative modal.

### 6.5 Friendly Cloud Sync Bar (`CloudSyncIndicator.tsx`)

**Path**: `/Users/dawidapel/COL Tool/src/components/sync/CloudSyncIndicator.tsx`

Features:
- Subscribes directly to `SyncEngine.subscribe()` (using existing `SyncStatus`).
- Visual Status Pills:
  - 🟢 **Zielony** (`synced` / `idle`): "Zsynchronizowano z chmurą"
  - 🟡 **Żółty** (`syncing`): "Trwa synchronizacja (X zmian)..." (z animacją `animate-bounce`)
  - ⚪ **Szary** (`offline`): "Tryb lokalny (brak internetu)"
  - 🔴 **Czerwony** (`error`): "Błąd synchronizacji — kliknij, aby ponowić"
- Manual Flush: Single click triggers `SyncEngine.flushOutbox()` with friendly toast notification.

### 6.6 Developer Options & Hazardous UI Stripping

In `STORE_CLIENT` mode, the following elements MUST be suppressed:

| Component | Hazardous Element | Enforcement Strategy |
| :--- | :--- | :--- |
| `UnifiedSettingsModal.tsx` | Tab `firebase_fleet` | Filter out tab from `TABS` array if `isStoreClient`. |
| `UnifiedSettingsModal.tsx` | Tab `testing_guide` | Filter out tab from `TABS` array if `isStoreClient`. |
| `UnifiedSettingsModal.tsx` | "Przełącz lub Dodaj Kawiarnię..." | Hide button if `isStoreClient`. |
| `UnifiedSettingsModal.tsx` | "Test Spójności (PRAGMA)" & "Optymalizuj (VACUUM)" | Hide buttons if `isStoreClient`. |
| `DatabaseBackupModal.tsx` | "Reset do Czystej Bazy (Clean Slate)" | Hide destructive wipe button if `isStoreClient`. |
| `DatabaseBackupModal.tsx` | "Importuj Paczkę Historyczną" | Hide button if `isStoreClient`. |

---

## 7. Concrete File Modification Plan for Implementers

### Summary of Target Files

| Target File | Action | Description of Changes |
| :--- | :---: | :--- |
| `src/context/AuthContext.tsx` | **CREATE** | New context for `appMode`, licensing verification, 2FA, session management. |
| `src/context/StoreContext.tsx` | **MODIFY** | Consume `useAuth()`, filter `availableStores` by `assignedStoreIds`, auto-converge on assigned store, guard `switchStore`. |
| `src/services/storeService.ts` | **MODIFY** | Add `isStoreAssigned()`, `getAvailableStoresForProfile()`, security guards in `setCurrentStore()` and `addCustomStore()`. |
| `src/types/index.ts` | **MODIFY** | Add `'fleet_master'` to `AppModule`. Add `AppRuntimeMode` type export. |
| `src/components/Header.tsx` | **MODIFY** | Render verified store badge (`ShieldCheck`, `Lock`) when `isStoreClient`, embed `CloudSyncIndicator`. |
| `src/components/Sidebar.tsx` | **MODIFY** | Inject `fleet_master` nav item in `FLEET_MASTER` mode; lock store indicator in `STORE_CLIENT` mode. |
| `src/components/StoreSwitcherModal.tsx` | **MODIFY** | Add guard early-exit if `isStoreClient`, remove custom store tab if not HQ. |
| `src/components/sync/CloudSyncIndicator.tsx` | **CREATE** | Friendly one-click cloud synchronization indicator subscribing to `SyncEngine`. |
| `src/components/StoreClientView.tsx` | **CREATE** | Distraction-free, store-locked retail workspace container. |
| `src/components/admin/FleetMasterDashboard.tsx` | **CREATE** | Corporate command center for 100+ stores, license generator modal, kill-switch revocation. |
| `src/App.tsx` | **MODIFY** | Integrate `AuthContext`, route between `FleetMasterDashboard` and `StoreClientView`. |
| `src/main.tsx` | **MODIFY** | Wrap `StoreProvider` in `AuthProvider`. |
| `src/components/UnifiedSettingsModal.tsx` | **MODIFY** | Strip `firebase_fleet`, `testing_guide`, and manual PRAGMA/VACUUM in `STORE_CLIENT` mode. |
| `src/components/DatabaseBackupModal.tsx` | **MODIFY** | Strip Clean Slate database reset button in `STORE_CLIENT` mode. |

---

## 8. Verification & Test Plan

1. **Profile Isolation Unit Tests (`tests/security/dual_profile_isolation.test.ts`)**:
   - Verify `STORE_CLIENT` profile strictly blocks switching to unassigned store IDs.
   - Verify `availableStores` returns exactly `[assignedStore]` in `STORE_CLIENT` mode.
   - Verify `FLEET_MASTER` profile returns all 100+ stores and allows unrestricted switching.
   - Verify multi-key store matching (`id`, `unitCode`, `mpk`) correctly matches stores.
2. **UI Locking Tests**:
   - Verify `Header` renders `ShieldCheck` and `Lock` (and does not trigger `openStoreSwitcher`) in `STORE_CLIENT` mode.
   - Verify `Sidebar` renders non-clickable store badge in `STORE_CLIENT` mode.
   - Verify `StoreSwitcherModal` renders `null` if opened in `STORE_CLIENT` mode.
3. **App Routing Tests**:
   - Verify `FLEET_MASTER` mode renders `FleetMasterDashboard` when `activeModule === 'fleet_master'`.
   - Verify switching store from `FleetMasterDashboard` switches active store database.
   - Verify `STORE_CLIENT` mode renders `StoreClientView` and redirects any `'fleet_master'` route attempt to `'dashboard'`.
4. **Build & Regression Verification**:
   - `npm run build` (`tsc && vite build`) executes cleanly with zero TypeScript or packaging errors.
   - `npm run test:security` passes with 100% success.
