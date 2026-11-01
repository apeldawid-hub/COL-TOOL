# Architectural Survey & Production Design Report: Dual-Profile Runtime Architecture (R2)

**Document**: Dual-Profile Runtime Architecture (Master HQ vs Store Client), Fleet Master Control & Store Client Restrictions  
**Investigator**: Survey Explorer 2 (`survey_fleet_explorer_2`)  
**Project**: Starbucks Operations Suite (Electron + React 19 + TypeScript + Vite)  
**Date**: 2026-10-26T16:45:00Z  
**Status**: Ready for Implementation Design  

---

## 1. Executive Summary

This report delivers a comprehensive, production-grade architectural blueprint for implementing Requirement **R2: Dual-Profile Runtime Architecture (Master HQ vs Store Client)** across the Starbucks Operations Suite.

The application currently operates with a single unified profile: every launched instance loads the entire catalog of **100+ Starbucks retail units** (`STARBUCKS_STORES_CATALOG` in `src/constants/starbucksStores.ts`), mounts developer diagnostics (SQLite VACUUM, PRAGMA integrity check, raw package export/import, clean-slate database resets), and allows any local user to switch freely to any other store across Poland via `StoreSwitcherModal.tsx`.

Under the enterprise security model defined in `ORIGINAL_REQUEST.md` (Follow-up 2026-10-26T16:11:59Z), the application must cleanly bifurcate into two distinct runtime profiles driven by `appMode: 'FLEET_MASTER' | 'STORE_CLIENT'`:

1. **`STORE_CLIENT` (Dedicated Retail Station)**:
   - Locked strictly to the store(s) assigned to that physical station via its hardware-bound activation key (`SBX-<storeId>-<randomHex>-<checksum>`).
   - Store selector is permanently locked: no store switching, no browsing unassigned stores, no "Add Custom Store" tab.
   - Stripped of all developer jargon, raw database buttons (clean slate, manual restore, VACUUM/PRAGMA), and fleet-wide telemetry.
   - Enhanced with a friendly, seamless one-click cloud synchronization bar with visual status indicators (Synced, In-Flight, Offline, Error).
   - Encapsulated within `StoreClientView.tsx` with dedicated, distraction-free back-office ergonomics for the Store Manager (SM).

2. **`FLEET_MASTER` (Central HQ / District Manager Control Center)**:
   - Unlocked access across all 100+ stores in Poland.
   - Features the newly designed **`FleetMasterDashboard.tsx`** (`src/components/admin/FleetMasterDashboard.tsx`):
     * Macro overview of 100+ stores with real-time health, synchronization status, and cryptographic parity.
     * License Key Generator Modal for provisioning new store stations (`SBX-<storeId>-<randomHex>-<checksum>`).
     * Store activation, deactivation, and remote Kill-Switch revocation.
     * Security audit trail and fleet release management (version telemetry, OTA patch distribution).
     * Global store switching capability to inspect individual store operational modules (`labor-forecast`, `managers-schedule`, `col-calculator`, `trainings`).

---

## 2. Current State Codebase Audit

### 2.1 `src/App.tsx` Lifecycle & Routing Audit
- **Lines 55–67**: Evaluates onboarding status via `StoreService.hasConfiguredStore()` and `localStorage.getItem('sbx_onboarding_completed')`.
- **Lines 70–124**: Asynchronously synchronizes settings from Electron IPC `api.getAppSettings()`.
- **Lines 548–560**: Unconditionally renders `<LoginView />` when `!isLoggedIn`. There is currently **no station activation gate** before login: an unprovisioned station can immediately proceed to login or onboarding.
- **Lines 562–603**: Renders `<Sidebar />` and `<Header />` with global action props (`onOpenSettings`, `onOpenAdminConsole`, `onOpenBackupModal`).
- **Lines 604–740**: Module routing dynamically renders `<DashboardView />`, `<ManagerScheduleView />`, `<LaborForecastView />`, `<TrainingsView />`, or `<ColCalculatorView />`, all keyed by `currentStore.id`.
- **Lines 752–834**: Unconditionally mounts all modals: `ImportModal`, `UnifiedSettingsModal`, `DatabaseBackupModal`, `AppUpdateModal`, `BugReporterModal`, `StoreSwitcherModal`, `CloudDocumentsModal`, and `AdminConsoleModal`.

### 2.2 Store Registry & Selection Flow Audit
| File & Location | Current Implementation | Architectural Vulnerability / Gap |
| :--- | :--- | :--- |
| `src/constants/starbucksStores.ts` (Lines 30–1527) | Static catalog of 100+ stores (`STARBUCKS_STORES_CATALOG`) with address, MPK, unit code, district, city. | Clean catalog, but exposed in full to every client station without profile filtering. |
| `src/services/storeService.ts` (Lines 56–95) | `getAllStores()` merges `STARBUCKS_STORES_CATALOG` with `getCustomStores()` from `localStorage` / disk. | Does not accept or check `appMode` or `assignedStoreIds`. Returns all 100+ stores to any caller. |
| `src/context/StoreContext.tsx` (Lines 20–22, 54–69) | `availableStores` is initialized with `StoreService.getAllStores()`. `switchStore(id)` switches database to any arbitrary store ID. | Allows unrestricted store switching. A store employee can switch the local database to any other store in Poland. |
| `src/components/StoreSwitcherModal.tsx` (Lines 88–160) | Virtualized list of all stores with search, city filters, and tab `ADD_NEW` to create custom stores. | Available from both Header and Sidebar. No permission checks or profile gates exist. |

### 2.3 Navigation & Developer Leaks Audit
1. **`src/components/Sidebar.tsx` (Lines 181–207)**:
   - Clicking the store badge opens `openStoreSwitcher()` for all users.
   - Lines 328–357: Renders "Panel Admina" (Root Shield) button opening `AdminConsoleModal`.
2. **`src/components/Header.tsx` (Lines 158–173, 178–195)**:
   - Store badge is a clickable button opening `StoreSwitcherModal`.
   - Backup overdue badge opens `DatabaseBackupModal`.
3. **`src/components/DatabaseBackupModal.tsx` (Lines 185–302)**:
   - Contains dangerous administrative buttons:
     * `handleExportPackage` (Exports raw JSON tables to `IMPORT/`)
     * `handleImportHistoricalPackage` (Overwrites database from `IMPORT/`)
     * `handleCleanSlateReset` (Completely wipes database to clean slate)
     * Arbitrary file restore with buffer injection.
4. **`src/components/UnifiedSettingsModal.tsx` (Lines 74–85, 1906, 2185–2193, 2296–2356)**:
   - Tab `firebase_fleet`: Renders `<FirebaseFleetPanel />` displaying raw telemetry of all machines in the company.
   - Tab `testing_guide`: Displays internal developer testing checklists.
   - Tab `system`: Includes "Przełącz lub Dodaj Kawiarnię...", manual PRAGMA integrity check, and manual SQLite VACUUM buttons.

---

## 3. Dual-Profile Runtime Architecture (`appMode`)

### 3.1 Capabilities Matrix: `FLEET_MASTER` vs `STORE_CLIENT`

| Feature / Capability | `STORE_CLIENT` Profile | `FLEET_MASTER` Profile |
| :--- | :---: | :---: |
| **Primary User Persona** | Store Manager (SM), ASM, SSV, Barista | District Manager (DM), Regional HQ, System Admin |
| **Store Scope** | Strictly bound to 1 assigned store (e.g. `108120`) | All 100+ stores in Poland |
| **Store Switcher Access** | ❌ **Locked** (Displays fixed store badge) | ✅ **Full 100+ stores virtualized switcher** |
| **Fleet Master Dashboard** | ❌ **Hidden & Inaccessible** | ✅ **Default HQ Command View** |
| **License Key Generator** | ❌ **Hidden** | ✅ **Generate keys `SBX-<storeId>-...`** |
| **Remote Kill-Switch Center** | ❌ **Hidden** | ✅ **Revoke / restore station licenses** |
| **Security Audit Trail** | ❌ **Local store logs only** | ✅ **Fleet-wide audit logs & exports** |
| **Cloud Sync Interface** | ✅ **Friendly One-Click Sync Bar** | ✅ **Fleet Sync & Parity Telemetry** |
| **Database Destructive Actions** | ❌ **Purged** (No Clean Slate / No raw wipe) | ✅ **Controlled Master Maintenance** |
| **Developer Tabs in Settings** | ❌ **Purged** (No `firebase_fleet`, no test guide) | ✅ **Full Diagnostic & Fleet Tabs** |
| **Master Disaster Recovery** | ❌ **Hidden** | ✅ **BIP-39 24-Word Seed Recovery** |

### 3.2 Persistent Profile Storage & Determination Flow

The runtime profile must be stored securely so that it cannot be trivially escalated by tampering with unencrypted `localStorage`:

1. **Storage Tiering**:
   - **Electron Main Process (`userData/security/profile.json` & OS Keychain via `safeStorage`)**:
     * Holds cryptographic activation proof: `ActiveLicenseRecord` containing `storeId`, `tier: 'STORE_CLIENT' | 'FLEET_MASTER'`, and `hardwareFingerprint`.
     * Exposes IPC channel: `ipcRenderer.invoke('auth:get-runtime-profile')`.
   - **Local Cache (`localStorage['sbx_app_mode']`)**:
     * Mirrored in renderer for synchronous initial render, validated against the Main process on startup.

2. **Resolution Algorithm at Launch (`App.tsx` startup)**:
   ```
   [Application Startup]
             │
             ▼
   Is Station Activated with Valid License?
             │
      ┌──────┴──────┐
      │ NO          │ YES
      ▼             ▼
   [Render         Examine License Tier in ActiveLicenseRecord
    ActivationModal]     │
                    ┌────┴───────────────────────────┐
                    │ tier == 'STORE_CLIENT'         │ tier == 'FLEET_MASTER'
                    ▼                                ▼
   Set appMode = 'STORE_CLIENT'             Set appMode = 'FLEET_MASTER'
   assignedStoreIds = [license.storeId]     assignedStoreIds = [all 100+ stores]
   Restrict StoreContext & Nav              Unlock FleetMasterDashboard & Switcher
   ```

### 3.3 AuthContext Specification (`src/context/AuthContext.tsx`)

To fulfill the architectural promise outlined in `PROJECT.md` line 10 and replace fragmented auth logic, a dedicated `AuthContext` must be created.

```typescript
// src/context/AuthContext.tsx

export type AppRuntimeMode = 'FLEET_MASTER' | 'STORE_CLIENT';

export interface StationLicenseInfo {
  licenseKey: string;
  storeId: string;
  tier: AppRuntimeMode;
  hardwareFingerprint: string;
  activatedAt: string;
  expiresAt?: string;
  isValid: boolean;
  isRevoked: boolean;
}

export interface AuthContextType {
  // Runtime Profile
  appMode: AppRuntimeMode;
  isFleetMaster: boolean;
  isStoreClient: boolean;
  assignedStoreIds: string[];
  
  // Station Activation State
  isStationActivated: boolean;
  licenseInfo: StationLicenseInfo | null;
  activateStation: (activationKey: string) => Promise<{ success: boolean; message: string }>;
  deactivateStation: () => Promise<void>;
  
  // User Session
  currentSession: AuthUserSession | null;
  currentUser: ManagedAppUser | null;
  isAuthenticated: boolean;
  login: (email: string, otpCode: string) => Promise<{ success: boolean; message: string }>;
  quickLoginSM: (unitCode?: string) => AuthUserSession;
  logout: () => void;
  
  // Inactivity Auto-Lock
  isLocked: boolean;
  unlockSession: (pinOrPassword: string) => Promise<boolean>;
  resetInactivityTimer: () => void;
}
```

### 3.4 Scoped `StoreContext.tsx` Refactor

`StoreContext` must consume `AuthContext` to enforce strict tenant isolation:

```typescript
// Proposed Refactor in src/context/StoreContext.tsx

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { appMode, assignedStoreIds, isStoreClient } = useAuth();
  
  // Filter stores according to active profile
  const allStores = useMemo(() => StoreService.getAllStores(), []);
  
  const availableStores = useMemo(() => {
    if (appMode === 'STORE_CLIENT') {
      return allStores.filter(s => assignedStoreIds.includes(s.id) || assignedStoreIds.includes(s.unitCode));
    }
    return allStores; // FLEET_MASTER sees all 100+ stores
  }, [allStores, appMode, assignedStoreIds]);

  const switchStore = useCallback(async (storeOrId: StarbucksStore | string) => {
    const targetId = typeof storeOrId === 'string' ? storeOrId : storeOrId.id;
    
    // Security Guard: Prevent store hopping in STORE_CLIENT mode
    if (isStoreClient && !assignedStoreIds.includes(targetId)) {
      console.error(`[Security Guard] Zablokowano próbę przełączenia do nieautoryzowanego lokalu: ${targetId}`);
      return { success: false, error: 'Unauthorized store switch attempt' };
    }
    
    return await StoreService.setCurrentStore(targetStore);
  }, [isStoreClient, assignedStoreIds]);

  const addCustomStore = useCallback(async (store: StarbucksStore, activate = true) => {
    // In STORE_CLIENT mode, custom store creation is blocked
    if (isStoreClient) {
      console.warn('[Security Guard] Dodawanie własnych kawiarni jest zablokowane na stacji klienckiej.');
      return { success: false };
    }
    return await StoreService.addCustomStore(store, activate);
  }, [isStoreClient]);
  
  // ...
};
```

---

## 4. `FleetMasterDashboard.tsx` Specification

**File Path**: `/Users/dawidapel/COL Tool/src/components/admin/FleetMasterDashboard.tsx`  
**Purpose**: Central operations command center for Starbucks District Managers and Regional Executives, supervising 100+ stores.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ☕ STARBUCKS FLEET MASTER HQ                     [FLEET_MASTER] [104 Lokale] [Dawid]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [KPI 1: 104 Lokale] [KPI 2: 98 Aktywnych] [KPI 3: 86 Online] [KPI 4: 2 Revoked]      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Zakładki:                                                                             │
│  [ 🏬 1. Katalog Floty (100+) ] [ 🔑 2. Licencje ] [ ⚡ 3. Kill-Switch ] [ 📜 4. Audyt ]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [🔍 Szukaj lokalu (nazwa, unit, MPK)...]  [Filtr Dystryktu: Wszystkie ▾] [Status: All ▾]│
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 108120 SBX Warszawa Janki   │ Unit: 18120 │ Online ● │ v2.8.70 │ 100% Zgodna  │  │
│  │ 108004 SBX Nowy Świat       │ Unit: 323   │ Online ● │ v2.8.70 │ 100% Zgodna  │  │
│  │ 108046 SBX Sadyba Best Mall │ Unit: 341   │ Syncing◔ │ v2.8.69 │ Parity OK    │  │
│  │ 108081 SBX Złote Tarasy     │ Unit: 381   │ Offline○ │ v2.8.70 │ 3h temu      │  │
│  │ 108099 SBX Test Unit        │ Unit: 999   │ REVOKED⚡│ v2.7.00 │ Kill-Switch  │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│                                            Akcje: [Szczegóły] [Przełącz Widok] [Blokuj]│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Data Models & Types (`src/types/fleet.ts`)

```typescript
// src/types/fleet.ts

export type FleetStoreHealth = 'healthy' | 'warning' | 'offline' | 'revoked';
export type FleetSyncState = 'synced' | 'syncing' | 'pending' | 'error';
export type FleetParityState = 'verified' | 'mismatch' | 'unverified';

export interface FleetStoreRecord {
  // Store Metadata
  id: string;               // '108120'
  unitCode: string;         // '18120'
  mpk: string;              // '108120'
  name: string;             // '108120 SBX Warszawa Janki'
  shortName: string;        // '108120 Janki'
  city: string;             // 'Warszawa / Janki'
  district: string;         // 'Dystrykt Warszawa'
  storeType: 'Mall' | 'Street' | 'Drive-Thru' | 'Office' | 'Travel';
  
  // Licensing & Hardware
  licenseKey?: string;
  licenseStatus: 'ACTIVE' | 'REVOKED' | 'UNPROVISIONED' | 'EXPIRED';
  hardwareFingerprint?: string;
  activatedAt?: string;
  expiresAt?: string;
  
  // Real-time Health & Telemetry
  health: FleetStoreHealth;
  syncState: FleetSyncState;
  parityState: FleetParityState;
  appVersion: string;
  lastHeartbeatAt: string;
  lastSyncAt: string;
  pendingChangesCount: number;
  databaseSizeBytes: number;
  
  // Store Metrics Snapshot
  weeklyFloorHoursBase: number;
  activeStaffCount: number;
  openAlertsCount: number;
}

export interface FleetAuditRecord {
  id: string;
  timestamp: string;
  actorEmail: string;
  actorRole: string;
  targetStoreId: string;
  targetStoreName: string;
  action: 
    | 'KEY_GENERATED'
    | 'STATION_ACTIVATED'
    | 'KILL_SWITCH_REVOKED'
    | 'KILL_SWITCH_RESTORED'
    | 'CONFIG_UPDATED'
    | 'PARITY_VERIFIED'
    | 'REMOTE_MAINTENANCE';
  details: string;
  hardwareFingerprint?: string;
  ipAddress?: string;
}

export interface ProvisionLicensePayload {
  storeId: string;
  unitCode: string;
  storeName: string;
  validityDays: number;
  requireHardwareLock: boolean;
  notes?: string;
}
```

### 4.2 Component Architecture & State Structure

```typescript
// src/components/admin/FleetMasterDashboard.tsx

interface FleetMasterDashboardProps {
  onNavigateToStore?: (storeId: string) => void;
  onClose?: () => void;
}

export const FleetMasterDashboard: React.FC<FleetMasterDashboardProps> = ({
  onNavigateToStore,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'LICENSES' | 'KILL_SWITCH' | 'AUDIT' | 'RELEASES'>('CATALOG');
  const [stores, setStores] = useState<FleetStoreRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [healthFilter, setHealthFilter] = useState<'ALL' | FleetStoreHealth>('ALL');
  const [isLoading, setIsLoading] = useState(false);
  
  // Modals inside Fleet Master
  const [isLicenseGeneratorOpen, setIsLicenseGeneratorOpen] = useState(false);
  const [selectedStoreForKillSwitch, setSelectedStoreForKillSwitch] = useState<FleetStoreRecord | null>(null);
  const [selectedStoreDetail, setSelectedStoreDetail] = useState<FleetStoreRecord | null>(null);
  // ...
};
```

### 4.3 Tab 1: Fleet Catalog Overview (100+ Stores)
- **Aggregated Metric Cards**:
  * Total Fleet Stores (104)
  * Active & Licensed Stations (98 / 94.2%)
  * Connected & Online Now (86 / 82.7%)
  * Kill-Switch Revoked (2 / 1.9%)
  * Outdated App Versions (6 / 5.8%)
- **Filter Controls**:
  * Multi-token search (unit code, store name, MPK, city).
  * District quick-filter pills (Dystrykt Warszawa, Centralny, Zachodni, Południowy, Północny).
  * Health status pills: `All`, `Zdrowe ●`, `Ostrzeżenie ⚠️`, `Offline ○`, `Zablokowane ⚡`.
- **Fleet Table / Grid**:
  * Renders virtualized rows or rich cards.
  * Column 1: Store identity (Unit code badge, name, type, city).
  * Column 2: Connection & Heartbeat (`Online ●`, relative time e.g. "3 min temu").
  * Column 3: App version & update indicator (green if equal to `APP_VERSION`, amber if outdated).
  * Column 4: Cloud vault parity status (SHA-256 Verified shield).
  * Column 5: Action buttons:
    - 🔍 `Szczegóły`: Opens store inspector drawer (staff roster, database size, last backup).
    - 🚀 `Przełącz na lokal`: Switches active store and opens Module 1/2 for that store.
    - ⚡ `Kill-Switch`: Opens emergency lockdown modal.

### 4.4 Tab 2: License Key Generator Modal (`LicenseGeneratorModal`)
- **Inputs**:
  * Target Store selector: Searchable dropdown populated from `STARBUCKS_STORES_CATALOG`.
  * License Validity: Presets (1 Year, 2 Years, Starbucks Perpetual Corporate).
  * Hardware Lock requirement toggle (enabled by default).
  * Notes / Authorized Store Manager name.
- **Generation Logic**:
  * Calls `licensingService.generateActivationKey(storeId, 'STORE_CLIENT')`.
  * Produces canonical key: `SBX-108120-7F3A29B0E1D4C688-9B2C4E10A5`.
- **Output Experience**:
  * Cryptographic Key box with one-click copy.
  * Printable / Exportable PDF Station Provisioning Certificate.
  * QR Code for mobile deployment.
  * Automatically appends record to central fleet license registry.

### 4.5 Tab 3: Store Activation, Deactivation & Remote Kill-Switch Revocation
- **Operational Workflow**:
  1. Fleet Master identifies a compromised station (e.g. laptop stolen from store back office).
  2. Master clicks `⚡ Zastosuj Kill-Switch` for unit `108120`.
  3. Modal displays confirmation challenge requiring the user to type `REVOKE 108120`.
  4. Reason selection: `Kradzież sprzętu`, `Wypowiedzenie pracownika`, `Audyt bezpieczeństwa`, `Zamknięcie kawiarni`.
  5. Action dispatched:
     * Writes revocation flag to Firestore `/stores/{storeId}/telemetry/status` (`{ isRevoked: true, revokedAt: timestamp, revokedBy: actor }`).
     * Revokes license in the local license cache and fleet database.
     * Appends entry to `SecurityAuditLog`.
  6. **Station Effect**: The targeted station immediately locks its UI on next heartbeat or launch, clears all in-memory cryptographic keys via `StoreKeyCache.clear()`, and displays the Kill-Switch lockdown screen.
  7. **Reactivation Flow**: Fleet Master can click `Cofnij Kill-Switch (Reaktywuj)` with master credentials to generate a fresh activation key and restore station operation.

### 4.6 Tab 4: Security Audit Trail & Fleet Release Management
- **Audit Trail**:
  * Comprehensive table recording all fleet-wide administrative actions.
  * Columns: Timestamp, Action Type, Actor Email, Target Store, Details, Device Fingerprint.
  * Export options: Download CSV, Download JSON.
- **Fleet Release Management**:
  * Displays version distribution across all 100+ stores.
  * Visualizes which stores have downloaded the latest OTA patch vs which remain on older builds.
  * Button: "Wymuś powiadomienie o aktualizacji dla opóźnionych lokali" (triggers push notification).

---

## 5. Store Client View & Navigation Restrictions (`StoreClientView.tsx`)

**File Path**: `/Users/dawidapel/COL Tool/src/components/StoreClientView.tsx`  
**Purpose**: Distraction-free, secure retail client workspace for the Store Manager and baristas on the store laptop.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ☕ 108120 SBX Warszawa Janki (Unit 18120) 🔒 [☁️ Zsynchronizowano (2m)] [SM: Dawid] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [ Moduł 1: TPLH ] [ Moduł 2: Grafik ] [ Moduł 3: Szkolenia ] [ Moduł 4: COL Calc ]    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│                                   STORE WORKSPACE                                      │
│                                                                                        │
│   - Restricted Store Selector: Displays only assigned store 108120                     │
│   - One-Click Cloud Sync Widget: [ Synchronizuj teraz ☁️ ]                             │
│   - Zero Developer Options: No VACUUM, no PRAGMA, no raw clean slate                   │
│   - Back-Office Ergonomics: Optimized for 13" laptop screen                            │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Store Selector Lock & Station Info Modal
- **In `src/components/Header.tsx` & `src/components/Sidebar.tsx`**:
  * When `appMode === 'STORE_CLIENT'`:
    - The clickable dropdown chevron (`ChevronsUpDown`) is replaced with a green lock badge (`Lock` or `ShieldCheck`).
    - Tooltip reads: `Stacja przypisana do lokalu: ${currentStore.name}. Zmiana jednostki zablokowana.`
    - Clicking the badge does NOT open `StoreSwitcherModal`.
    - Instead, it opens a lightweight informational modal: `<StoreStationInfoModal />`:
      * Store Name, Unit Code, MPK, District, Address.
      * Station Activation Status: `Licencja Aktywna (Sprzęt zweryfikowany)`.
      * Assigned Hardware Fingerprint (truncated).
      * Information message: `Stacja robocza jest skonfigurowana do pracy wyłącznie w tym lokalu. Aby przenieść licencję na inny lokal, skontaktuj się z District Managerem.`

### 5.2 Developer Leaks & Raw Database UI Stripping

| Component & Section | Current Hazardous UI | Required Production Stripping in `STORE_CLIENT` |
| :--- | :--- | :--- |
| `src/components/UnifiedSettingsModal.tsx` | Tab `firebase_fleet` (Telemetry of all machines across Poland) | **Completely removed from tab list** when `appMode === 'STORE_CLIENT'`. |
| `src/components/UnifiedSettingsModal.tsx` | Tab `testing_guide` (Developer QA manual testing instructions) | **Completely removed from tab list** when `appMode === 'STORE_CLIENT'`. |
| `src/components/UnifiedSettingsModal.tsx` (System Tab) | Button "Przełącz lub Dodaj Kawiarnię..." | **Hidden**; replaced with read-only store badge. |
| `src/components/UnifiedSettingsModal.tsx` (System Tab) | Buttons "Test Spójności (PRAGMA)" and "Optymalizuj (VACUUM)" | **Hidden**; replaced with friendly "Status systemu: Optymalny". |
| `src/components/DatabaseBackupModal.tsx` | Button "Reset do Czystej Bazy (Clean Slate)" | **Completely removed**. Store managers cannot wipe store data. |
| `src/components/DatabaseBackupModal.tsx` | Button "Importuj Paczkę Historyczną" | **Completely removed**. Prevents accidental file overwrites. |
| `src/components/Sidebar.tsx` | Button "Panel Admina" (Root Shield) | **Restricted**: If role is not SM, button is hidden. If SM, opens simplified local staff access request queue only. |

### 5.3 Seamless One-Click Cloud Sync Bar (`CloudSyncIndicator.tsx`)

To replace technical telemetry panels with Store Manager friendly UI, a dedicated cloud synchronization indicator must be placed in the header of `StoreClientView.tsx` and `Header.tsx`:

```typescript
// src/components/sync/CloudSyncIndicator.tsx

interface CloudSyncIndicatorProps {
  compact?: boolean;
  onSyncTriggered?: () => void;
}

export const CloudSyncIndicator: React.FC<CloudSyncIndicatorProps> = ({ compact = false }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => SyncEngine.getStatus());
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    return SyncEngine.subscribe(setSyncStatus);
  }, []);

  const handleManualSync = async () => {
    if (isSyncingNow) return;
    setIsSyncingNow(true);
    try {
      await SyncEngine.flushOutbox();
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsSyncingNow(false);
    }
  };

  // Visual status pill:
  // 🟢 Green: Online and up-to-date ("Zsynchronizowano")
  // 🟡 Yellow: In-flight synchronization ("Synchronizowanie...")
  // ⚪ Gray: Offline operation ("Tryb lokalny - offline")
  // 🔴 Red: Sync error ("Wymaga ponowienia")
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleManualSync}
        disabled={isSyncingNow}
        className="flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer bg-emerald-50 hover:bg-emerald-100 text-[#006241] border border-emerald-200"
      >
        <Cloud className={`w-4 h-4 ${isSyncingNow ? 'animate-bounce text-emerald-600' : 'text-[#006241]'}`} />
        <span>{isSyncingNow ? 'Synchronizuję...' : 'Synchronizuj z chmurą'}</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      </button>
    </div>
  );
};
```

---

## 6. Comprehensive Implementation Inventory

### 6.1 Existing Files to Modify

| File Path | Lines | Modification Scope | Rationale |
| :--- | :--- | :--- | :--- |
| `src/types/index.ts` | 604–612 | Add `'fleet_master'` to `AppModule`. Add `AppRuntimeMode` type. | Supports rendering Fleet Master Dashboard as a first-class module view. |
| `src/context/StoreContext.tsx` | 20–22, 54–69 | Filter `availableStores` by `assignedStoreIds` when in `STORE_CLIENT` mode. Guard `switchStore()` against cross-store leakage. | Enforces strict multi-store tenant boundaries on client machines. |
| `src/services/storeService.ts` | 56–95, 194–279 | Add `getAvailableStoresForProfile(mode, assignedIds)`. Validate store switching permissions. | Service-level enforcement of store access boundaries. |
| `src/components/Header.tsx` | 158–173, 178–195 | Condition store switcher button on `appMode`. When `STORE_CLIENT`, render locked badge with station info modal. Embed `CloudSyncIndicator`. | Restricts store switching and surfaces friendly sync status. |
| `src/components/Sidebar.tsx` | 58–106, 181–207, 328–357 | If `FLEET_MASTER`, inject `Fleet Master Control` nav item. If `STORE_CLIENT`, disable store switcher and strip root admin tools. | Customizes sidebar navigation per runtime profile. |
| `src/components/StoreSwitcherModal.tsx` | 38–44, 88–122 | Guard modal: if `STORE_CLIENT`, display only assigned stores or disable modal completely. | Prevents unassigned store browsing. |
| `src/components/UnifiedSettingsModal.tsx` | 74–85, 1906, 2185–2193, 2296–2356 | Conditionally hide `firebase_fleet` and `testing_guide` tabs. Strip VACUUM/PRAGMA and store switcher button in `STORE_CLIENT`. | Cleanses technical jargon and developer options from store view. |
| `src/components/DatabaseBackupModal.tsx` | 185–302 | In `STORE_CLIENT`, hide Clean Slate reset, raw file restore buffer, and raw package import buttons. | Protects store database against accidental destruction. |
| `src/App.tsx` | 55–150, 548–560, 604–740 | Integrate `AuthContext`. Check station activation before login. Route between `FleetMasterDashboard` and `StoreClientView`. | Central application coordinator for runtime profiles. |

### 6.2 New Files to Create

| Target File Path | Purpose & Exports | Dependencies |
| :--- | :--- | :--- |
| `src/context/AuthContext.tsx` | Centralizes authentication, station license, `appMode`, auto-lock, and user session. | `authService.ts`, `licensingService.ts` |
| `src/types/fleet.ts` | Type definitions for `FleetStoreRecord`, `FleetAuditRecord`, `ProvisionLicensePayload`. | `starbucksStores.ts` |
| `src/services/admin/fleetService.ts` | Service layer for Fleet Master: fetching store health, issuing licenses, triggering remote Kill-Switch, aggregating audit logs. | `firebaseTelemetryService.ts`, `licensingService.ts` |
| `src/components/admin/FleetMasterDashboard.tsx` | Master HQ command center: 100+ stores overview, license provisioning, kill-switch revocation, audit trail, release distribution. | `fleetService.ts`, `licensingService.ts` |
| `src/components/admin/LicenseGeneratorModal.tsx` | Modal for generating and exporting `SBX-<storeId>-<randomHex>-<checksum>` activation keys. | `licensingService.ts` |
| `src/components/StoreClientView.tsx` | Dedicated Store Client container wrapping modules with store-locked header and friendly sync bar. | `StoreContext.tsx`, `CloudSyncIndicator.tsx` |
| `src/components/sync/CloudSyncIndicator.tsx` | Friendly one-click cloud synchronization pill and manual sync trigger. | `syncEngine.ts` |
| `src/components/StoreStationInfoModal.tsx` | Informational modal displayed when Store Client clicks the locked store badge. | `StoreContext.tsx`, `AuthContext.tsx` |
| `tests/e2e/tier1-feature-coverage/r2_dual_profile_architecture.test.ts` | Automated unit and boundary tests verifying profile isolation, store locking, and UI restrictions. | `node:test`, `testHarness.ts` |

---

## 7. Step-by-Step Implementation Roadmap

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Core Context & Profile Engine                                           │
│ - Create src/types/fleet.ts and src/context/AuthContext.tsx                      │
│ - Refactor StoreContext.tsx & storeService.ts to enforce assignedStoreIds scoping │
│ - Connect runtime profile persistence in Electron and localStorage              │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Store Client Lockdown & UI Stripping                                    │
│ - Create src/components/sync/CloudSyncIndicator.tsx                              │
│ - Create src/components/StoreStationInfoModal.tsx & src/components/StoreClientView.tsx │
│ - Restrict Header.tsx & Sidebar.tsx store selector in STORE_CLIENT mode          │
│ - Sanitize UnifiedSettingsModal.tsx & DatabaseBackupModal.tsx                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Fleet Master Control Center                                             │
│ - Create src/services/admin/fleetService.ts                                      │
│ - Create src/components/admin/LicenseGeneratorModal.tsx                          │
│ - Implement src/components/admin/FleetMasterDashboard.tsx                        │
│ - Add 'fleet_master' navigation tab to Sidebar.tsx for FLEET_MASTER profile       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: Verification & Automated Testing                                        │
│ - Write tests/e2e/tier1-feature-coverage/r2_dual_profile_architecture.test.ts   │
│ - Verify build cleanly: npm run build                                            │
│ - Document release notes in VERSION_HISTORY.md                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Verification & Test Plan

1. **Profile Isolation Unit Tests**:
   - Verify `STORE_CLIENT` mode strictly rejects `switchStore('108004')` when licensed for `108120`.
   - Verify `STORE_CLIENT` mode returns only `[assignedStore]` from `availableStores`.
   - Verify `FLEET_MASTER` mode returns all 100+ stores and allows arbitrary store switching.

2. **UI Sanitization Tests**:
   - Verify `firebase_fleet` and `testing_guide` tabs are absent in `STORE_CLIENT` mode.
   - Verify Clean Slate reset button is absent in `STORE_CLIENT` mode.
   - Verify Store Switcher modal cannot be opened from `Header` or `Sidebar` in `STORE_CLIENT` mode.

3. **Fleet Master License & Kill-Switch Tests**:
   - Verify `LicenseGeneratorModal` outputs keys matching `/^SBX-([A-Z0-9_]{3,12})-([A-F0-9]{16})-([A-F0-9]{10})$/i`.
   - Verify remote Kill-Switch revocation sets `isRevoked: true` and invalidates station session.

4. **Build & Parity Verification**:
   - Run `npm run build` (`tsc && vite build`) to guarantee zero TypeScript or bundle regressions.
   - Run existing E2E test suite (`tests/`) to ensure backwards compatibility across Modules 1–4.
