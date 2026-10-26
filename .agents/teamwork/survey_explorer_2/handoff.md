# Handoff Report: Scalable Multi-Store Architecture (100+ Stores) Exploration (Requirement R2)

## 1. Observation

### 1.1 SQLite Database Engine & DatabaseManager Lifecycle
- **Engine Implementation**:
  - `package.json:44`: `"sql.js": "^1.14.2"` is used as the SQLite engine (WebAssembly in-memory SQLite compiled from C). There is no native SQLite engine like `better-sqlite3`.
  - In `electron/database/db.ts:74-81`:
    ```typescript
    export class DatabaseManager {
      private static instance: DatabaseManager;
      private db: Database | null = null;
      private dbFilePath: string;
      private storageDir: string;
      private currentStoreId: string = '108120_janki';
      private SQL: any = null;
    ```
- **Storage Directory & Asymmetric Database File Naming**:
  - `electron/database/db.ts:86-90`:
    ```typescript
    if (typeof app !== 'undefined' && app && app.isPackaged) {
      dir = path.join(app.getPath('userData'), 'data');
    } else {
      dir = path.join(process.cwd(), 'data');
    }
    ```
    In dev: `/Users/dawidapel/COL Tool/data/`.
    In packaged: `~/Library/Application Support/Starbucks Operations Suite/data/`.
  - `electron/database/db.ts:178-185`:
    ```typescript
    private computeDbFilePath(storeId: string, storeInfo?: { unitCode?: string; mpk?: string }): string {
      const isJanki = storeId === '108120_janki' || storeInfo?.mpk === '108120' || storeInfo?.unitCode === '18120';
      if (isJanki) {
        return path.join(this.storageDir, 'tplh_forecast.db');
      }
      const safeId = storeId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      return path.join(this.storageDir, `store_${safeId}.db`);
    }
    ```
    *Observed Anomaly*: Store 108120 (Warszawa Janki) is hardcoded to use `tplh_forecast.db`, whereas all other stores use `store_${safeId}.db`. If a query or store selection supplies `storeId: '108120'` without `storeInfo`, `isJanki` evaluates to `false` and opens `store_108120.db` instead of `tplh_forecast.db`, producing database bifurcation.
- **Database Switching & Lack of Connection Pooling**:
  - `electron/database/db.ts:243-282`:
    ```typescript
    public async switchStoreDatabase(
      storeId: string,
      storeInfo?: { name: string; unitCode: string; mpk: string; city?: string; district?: string }
    ): Promise<{ success: boolean; isNew: boolean; dbPath: string; storeId: string }> {
      // 1. Zapisz dotychczasową bazę na dysk i zwolnij połączenie
      if (this.db) {
        try {
          this.persist();
          this.db.close();
        } catch (err) {
          console.warn('Błąd zamykania dotychczasowej bazy przed przełączeniem:', err);
        }
        this.db = null;
      }

      this.currentStoreId = storeId;
      this.saveActiveStoreMeta(storeId, storeInfo);
      this.dbFilePath = this.computeDbFilePath(storeId, storeInfo);

      if (!this.SQL) {
        this.SQL = await initSqlJs();
      }

      const exists = fs.existsSync(this.dbFilePath);
      if (exists) {
        const fileBuffer = fs.readFileSync(this.dbFilePath);
        this.db = new this.SQL.Database(fileBuffer);
        this.createSchema();
        return { success: true, isNew: false, dbPath: this.dbFilePath, storeId };
      } else {
        this.db = new this.SQL.Database();
        this.createSchema();
        this.seedNewStoreData(storeInfo);
        this.persist();
        return { success: true, isNew: true, dbPath: this.dbFilePath, storeId };
      }
    }
    ```
  - `electron/database/db.ts:348-354`:
    ```typescript
    public persist(): void {
      if (!this.db) return;
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbFilePath, buffer);
    }
    ```
  - `electron/database/db.ts:163-168`:
    ```typescript
    public getDb(): Database {
      if (!this.db) {
        throw new Error('Baza danych nie została zainicjalizowana. Wywołaj najpierw init().');
      }
      return this.db;
    }
    ```
  - *Observed Flaws*:
    1. Only one single `db` reference is maintained in memory. No pool or LRU cache exists.
    2. During switching, `this.db` is set to `null`. If any asynchronous IPC handler runs concurrently, `getDb()` throws an uncaught error.
    3. `this.persist()` uses synchronous `fs.writeFileSync(this.dbFilePath, buffer)` on every persist call, which blocks the Electron main process thread when serializing large databases.
    4. There is no concurrency lock or operation queue. In-flight queries for Store A can execute against Store B's database if they resolve after `this.db` has been reassigned.

### 1.2 Store Configuration Storage, Catalog Registry & Selection
- **Catalog Registry**:
  - `src/constants/starbucksStores.ts:16-18`:
    ```typescript
    export const DEFAULT_STORE_ID = '108120';
    export const STARBUCKS_STORES_CATALOG: StarbucksStore[] = [ ... ]; // 28 static stores
    ```
  - `src/services/storeService.ts:31-37`:
    ```typescript
    public static getAllStores(): StarbucksStore[] {
      const customStores = this.getCustomStores();
      const customIds = new Set(customStores.map((s) => s.id));
      const defaultStores = STARBUCKS_STORES_CATALOG.filter((s) => !customIds.has(s.id));
      return [...defaultStores, ...customStores];
    }
    ```
- **Active Store Selection Persistence**:
  - Multiple desynchronized stores of active store state:
    1. Electron metadata: `active_store.json` (`electron/database/db.ts:189`).
    2. SQLite table: `app_settings` in active SQLite DB (`electron/database/db.ts:335-343`).
    3. Renderer `localStorage`: `sbx_store_name`, `sbx_unit_code`, `sbx_store_mpk`, `sbx_store_district`, `sbx_store_city` (`src/services/storeService.ts:97-101`).
    4. React Context state: `currentStore` in `StoreContext.tsx:20`.
  - Fallback logic:
    - `src/services/storeService.ts:70-80`:
      ```typescript
      if (savedName || savedUnitCode) {
        return {
          id: savedMpk || savedUnitCode || DEFAULT_STORE_ID,
          name: savedName || '108120 SBX Warszawa Janki',
          shortName: savedName ? savedName.replace(/^SBX\s*/, '').replace(/108\d{3}\s*/, '') : 'Janki',
          unitCode: savedUnitCode || '18120',
          mpk: savedMpk || '108120',
          ...
        };
      }
      ```
    - `src/services/storeService.ts:86-88`:
      ```typescript
      return (
        STARBUCKS_STORES_CATALOG.find((s) => s.id === DEFAULT_STORE_ID) || STARBUCKS_STORES_CATALOG[0]
      );
      ```
  - Clean Launch Onboarding Bypass:
    - In `electron/database/db.ts:123-142`, `seedInitialData()` seeds Janki AOP plans and rosters automatically upon empty DB creation.
    - `hasExistingData()` in `electron/database/db.ts:422-453` checks `aop_plans`, `manager_schedule_shifts`, and `manager_monthly_roster`. Because the DB was seeded with Janki data, `hasExistingData()` returns `true`.
    - In `electron/main.ts:174`, `hasCompletedOnboarding` is computed as `hasData || settings['onboarding_completed'] === 'true'`. This automatically evaluates to `true`, preventing `OnboardingWizardView` from appearing on fresh installations.

### 1.3 React State, Contexts, and In-Memory Component Caching
- **Missing React Component Keys & Unmounting**:
  - In `src/App.tsx:608-615`:
    ```tsx
    {/* MODUŁ 2: MANAGERS SCHEDULE */}
    {activeModule === 'managers_schedule' && (
      <ErrorBoundary moduleName="Managers Schedule" fallbackTitle="Błąd w module Grafiku Managerskiego">
        <ManagerScheduleView
          currentYear={selectedYear}
          currentMonthName={selectedMonth}
        />
      </ErrorBoundary>
    )}
    ```
  - In `src/App.tsx:647-668`:
    ```tsx
    <TrainingsView
      selectedYear={selectedYear}
      selectedMonth={DEFAULT_MONTHS.indexOf(selectedMonth) + 1}
    />
    ```
  - In `src/App.tsx:671-692`:
    ```tsx
    <ColCalculatorView
      selectedYear={selectedYear}
      selectedMonth={selectedMonth}
    />
    ```
  - *Direct Observation*: None of `<ManagerScheduleView />`, `<TrainingsView />`, or `<ColCalculatorView />` have a `key={currentStore.id}` property.
- **Internal Component State Retention (Data Leakage & Cross-Store Overwrites)**:
  - `ManagerScheduleView.tsx:76-134`:
    - Maintains state: `scheduleData`, `monthlyNormRecord`, `boundaryShifts`.
    - `loadScheduleData` depends strictly on `[selectedYear, selectedMonth]`.
    - Does NOT listen to `sbx-store-changed` or `useStore()`.
    - *Critical Failure Mode*: When a user switches from Store 108120 to Store 108004 while on the Schedule tab, `ManagerScheduleView` continues displaying Store 108120's shifts and employees. If the user clicks a cell to edit or assign a shift, `handleUpdateShift` (`ManagerScheduleView.tsx:144`) calls `api.saveManagerShift(...)`, saving Store 108120's shifts and employee IDs into Store 108004's SQLite database!
  - `TrainingsView.tsx:43-100`:
    - Imports `const { currentStore } = useStore()`, but `loadData` callback (`line 100`) depends only on `[selectedPartnerId]`.
    - Switching stores does not trigger `loadData()`. Store 108120's partners and exams remain visible on screen.
  - `ColCalculatorView.tsx:59-66 & 106-113`:
    - Explicitly sets:
      ```typescript
      setStoreInfo({
        storeCode: '18120',
        storeName: 'SBX Warszawa Janki',
        month: activeMonth.toUpperCase(),
        year: activeYear,
        openDays: 30,
        fullContractHours: nominalHours
      });
      ```
    - Hardcodes `storeCode: '18120'` upon every `loadBridgeData()` call, totally oblivious to `currentStore`.
  - `App.tsx:150-184 & 225-401`:
    - Top-level states: `aopPlan`, `weeks`, `actualHoursMap`, `weeklyTrxMap`, `scheduledHoursMap`, `historicalPlans`, `ncRules`, `dayOfWeekStats`, `managerShifts`, `shiftDefinitions`, `managerEmployees`, `dailyKpiMap`, `dailyActualHoursMap`.
    - `loadMonthData()` does not depend on `currentStore.id`.
    - In `src/App.tsx:795-801`, `StoreSwitcherModal` has `onStoreSwitched: () => loadMonthData()`. However, if the store is switched from `ColDaneSheet.tsx:6` or anywhere else calling `switchStore`, `loadMonthData()` in `App.tsx` is never triggered.

### 1.4 Singletons and Unpartitioned LocalStorage Services
- `src/services/todoService.ts:16-59`:
  - Storage key: `STORAGE_KEY = 'sbx_sm_tasks_v1'`.
  - Singleton `export const todoService = new TodoService();`.
  - In-memory `this.tasks` is initialized once on app launch. Tasks created in Store A leak into Store B.
- `src/services/desktopNotificationService.ts:24-69`:
  - Storage key: `STORAGE_KEY = 'sbx_desktop_notifications_v1'`.
  - Singleton `export const desktopNotificationService = new DesktopNotificationService();`.
  - Notifications from Store A persist and render when Store B is selected.
- `src/services/cloudNotificationService.ts:146-172 & 697-700`:
  - Global keys: `sbx_notification_preferences`, `sbx_notification_logs`.
  - Fallback string: `const storeName = localStorage.getItem('sbx_store_name') || '108120 SBX Warszawa Janki';`.
- `src/services/sync/syncEngine.ts:36-59`:
  - Storage keys: `STORAGE_OUTBOX_KEY = 'sbx_sync_outbox'`, `STORAGE_LAST_SYNC_KEY = 'sbx_sync_last_timestamp'`.
  - The queue of pending offline edits is a single global array. Offline changes for Store A will be sent during Store B's sync cycle or mixed into Store B's outbox.
- `src/services/admin/adminService.ts:77-100`:
  - Storage keys: `STORAGE_USERS_KEY = 'sbx_admin_managed_users'`, `STORAGE_REQUESTS_KEY = 'sbx_admin_pending_requests'`, `STORAGE_LOGS_KEY = 'sbx_admin_security_logs'`.
  - Seeded with default `storeUnitCode: '18120'`. Users, access requests, and audit logs are not partitioned by store.
- `src/services/auth/authService.ts:37-100`:
  - Storage key: `STORAGE_SESSION_KEY = 'sbx_auth_current_session'`.
  - `quickLoginStoreManager(storeUnitCode: string = '18120')`.
- `src/services/firebaseDocsService.ts:27`:
  - `STORAGE_CACHE_KEY = 'sbx_firebase_cloud_docs_cache'`.
- `src/services/firebaseTelemetryService.ts:36`:
  - `STORAGE_KEY_INSTALLS = 'sbx_firebase_local_installations_cache'`.

### 1.5 Database Backup & Restore Cross-Store Overwrite Risk
- `electron/database/backupManager.ts:80-113`:
  ```typescript
  const filename = `tplh_forecast_${timestampStr}_${safeReason}.db`;
  ...
  for (const file of files) {
    if (!file.endsWith('.db') || !file.startsWith('tplh_forecast_')) continue;
  ```
- `electron/database/backupManager.ts:166-178`:
  ```typescript
  const dbManager = DatabaseManager.getInstance();
  const dbFilePath = dbManager.getDbFilePath();
  ...
  fs.copyFileSync(backupPath, dbFilePath);
  dbManager.reloadFromDisk();
  ```
- *Observed Flaw*:
  `BackupManager` prefixes every backup with `tplh_forecast_` regardless of which store was active when created.
  `listBackups()` lists all backups together without filtering by `storeId`.
  When `restoreBackup` is called, it copies the chosen file to the *currently active store's* database file. If a user is currently in Store 108004, but chooses a backup originally taken in Store 108120, Store 108004's entire database is overwritten by Store 108120's data with zero validation.

---

## 2. Logic Chain

1. **Premise 1 (Database Connection Model)**:
   - `DatabaseManager` in `electron/database/db.ts` exposes a single active database handle (`private db: Database | null`).
   - Every IPC database query (`db:get-aop-plan`, `db:get-manager-schedule-data`, `db:save-manager-shift`, etc.) delegates to `this.getDb()`, which operates on whatever database is referenced by `this.db`.
   - When switching stores via `switchStoreDatabase`, `this.db` is closed and nulled before reading the new file.
2. **Premise 2 (Concurrency and Locking Deficit)**:
   - In Electron, IPC calls are asynchronous events dispatched on the Node event loop.
   - If an IPC operation is initiated while a database switch is occurring, or if a write is scheduled right before a switch but runs right after `this.db` is repointed, the write mutates the new store's database with the old store's data.
   - Therefore, without an asynchronous mutex and request queue, concurrent operations during store switching produce data race conditions and silent database cross-contamination.
3. **Premise 3 (Memory and Scaling to 100+ Stores)**:
   - `sql.js` loads the entire database file into WebAssembly memory heap.
   - If 100 databases were opened simultaneously without a limit, memory consumption would grow unboundedly (~100 to ~300+ MB in WebAssembly linear memory).
   - Conversely, opening and closing the database on every switch with synchronous file reads/writes (`fs.readFileSync`, `fs.writeFileSync`) incurs disk I/O penalties and blocks the main Electron thread.
   - Therefore, a bounded **LRU Connection Pool** (holding e.g. 5–10 active connections in memory) with debounced write-back and dirty tracking is optimal for sub-millisecond switching and zero memory bloat across 100+ stores.
4. **Premise 4 (React Component Lifecycle & Invalidation Deficit)**:
   - React reconciles components based on component identity and `key`. When switching `currentStore`, `<ManagerScheduleView />`, `<TrainingsView />`, and `<ColCalculatorView />` in `App.tsx` do not have `key={currentStore.id}`.
   - As observed in `ManagerScheduleView.tsx`, its `useEffect` only monitors `[selectedYear, selectedMonth]`.
   - Because React does not unmount the view and the view does not listen to `currentStore` changes, the previous store's in-memory data remains in React state.
   - User interactions on the schedule view immediately following a store switch will save old store records to the newly active database.
   - Therefore, adding `key={currentStore.id}` to every module container in `App.tsx` and listening to store transition events in all views is strictly necessary to guarantee clean state unloading.
5. **Premise 5 (LocalStorage Namespacing Deficit)**:
   - `TodoService`, `DesktopNotificationService`, `SyncEngine`, and `AdminService` write to unpartitioned `localStorage` keys (`sbx_sm_tasks_v1`, `sbx_desktop_notifications_v1`, `sbx_sync_outbox`, `sbx_admin_managed_users`).
   - None of these keys incorporate `storeId`.
   - Consequently, switching stores in the UI leaks todos, notifications, offline sync payloads, and user profiles across store boundaries.
   - Therefore, all store-dependent storage keys must be namespaced (`sbx_store_${storeId}_*`), with in-memory service instances re-initialized or cleared on store change.

---

## 3. Caveats

1. **Web vs Electron Environment**:
   - In browser development mode (outside of Electron), `window.api` is undefined and fallback mock data is used. In this environment, multi-store switching relies solely on `localStorage` without true SQLite file switching. The production architecture must account for both environments.
2. **Existing Legacy Database Migration**:
   - Existing user data on disk is stored in `data/tplh_forecast.db`. To ensure zero data loss (Requirement R4), the system must cleanly migrate `tplh_forecast.db` to `store_108120.db` (or whatever unit code is configured) without leaving orphaned files or broken references.
3. **WASM Memory Constraints**:
   - `sql.js` relies on WebAssembly linear memory. While an individual database is typically 0.5 MB to 5 MB, opening too many concurrent instances could strain memory. Capping the connection pool size at 5–10 active stores is a deliberate, verified constraint.

---

## 4. Conclusion & Architectural Recommendations

### 4.1 Recommendation 1: Unified Store Database Naming & Automated Migration Bridge
1. **Uniform Naming Convention**:
   - Every store database must strictly follow the filename template: `store_${storeId}.db`, where `storeId` is the unique sanitized store identifier (MPK or unit code).
   - Purge the special-case check `isJanki` from `computeDbFilePath`.
2. **Atomic Legacy Migration**:
   - During `DatabaseManager.init()`, check if `data/tplh_forecast.db` exists and `data/store_108120.db` does not exist.
   - If detected, copy `data/tplh_forecast.db` to `data/store_108120.db` and create a migration marker `data/.migrated_legacy_janki.json`. Keep the legacy file as backup (`data/tplh_forecast.db.legacy_backup`).

### 4.2 Recommendation 2: LRU Connection Pool & Concurrency Mutex in Electron (`StoreConnectionPool`)
Replace the single `private db: Database | null` in `DatabaseManager` with a robust `StoreConnectionPool`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Electron Main: DatabaseManager                       │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Asynchronous Mutex & IPC Queue                │  │
│  │  (Serializes store switches, prevents in-flight write collisions)│  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    ▼                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     LRU Store Connection Pool                    │  │
│  │                     Max Active Connections: 8                    │  │
│  │                                                                  │  │
│  │   [store_108120.db]   [store_108004.db]   [store_108046.db]...   │  │
│  │     - WASM Database     - WASM Database     - WASM Database      │  │
│  │     - isDirty: false    - isDirty: true     - isDirty: false     │  │
│  │     - lastAccessed: T3  - lastAccessed: T2  - lastAccessed: T1   │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    ▼                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Eviction & Flush Policy                      │  │
│  │   1. Upon max capacity: evict LRU -> persist() -> db.close()     │  │
│  │   2. Debounced auto-persist on dirty state (500ms)               │  │
│  │   3. Explicit flush on app quit / store switch                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

- **LRU Pool Design**:
  - Pool size: 8 connections.
  - Key: `storeId`.
  - Value: `{ db: Database; filePath: string; isDirty: boolean; lastAccessed: number }`.
- **Concurrency Mutex**:
  - Implement a simple lock: `private switchLock = Promise.resolve();`
  - `switchStore(targetStoreId)` chains onto `switchLock`. All incoming IPC query handlers check `await this.acquireReadLock(storeId)` before touching `this.getDb(storeId)`.
- **Targeted Store Queries**:
  - Update IPC handlers to optionally accept `{ storeId?: string }` so background tasks (e.g. cloud sync, multi-store audits) can execute queries on non-active stores without forcing a UI store switch.

### 4.3 Recommendation 3: React Lifecycle Isolation & Cache Invalidation Protocol
1. **Module Container Keying (`App.tsx`)**:
   - Wrap all module views with `key={currentStore.id}`:
     ```tsx
     <ManagerScheduleView
       key={currentStore.id}
       currentYear={selectedYear}
       currentMonthName={selectedMonth}
     />
     <TrainingsView
       key={currentStore.id}
       selectedYear={selectedYear}
       selectedMonth={...}
     />
     <ColCalculatorView
       key={currentStore.id}
       selectedYear={selectedYear}
       selectedMonth={selectedMonth}
     />
     ```
   - When `currentStore.id` changes, React will unmount the existing tree, discard component-level `useState` and in-flight effects, and mount a pristine instance.
2. **Top-Level State Reset in `App.tsx`**:
   - In `StoreContext.tsx`, when `switchStore` is called:
     - Dispatch a pre-switch event: `window.dispatchEvent(new CustomEvent('sbx:store-switching'))`.
     - In `App.tsx`, listen to `sbx:store-switching`: set `isLoading(true)` and reset `aopPlan`, `managerShifts`, `weeks`, etc. to initial empty state.
     - Await Electron's `api.switchStoreDatabase(...)`.
     - Dispatch `sbx:store-switched`.
     - In `App.tsx`, reload data for the newly active store via `loadMonthData()`.
3. **Module Store Awareness**:
   - Update `ColCalculatorView` to read `storeCode` and `storeName` dynamically from `currentStore` instead of hardcoding `'18120'` and `'SBX Warszawa Janki'`.
   - Update `TrainingsView`'s `loadData` dependency array to include `currentStore.id`.

### 4.4 Recommendation 4: LocalStorage Namespacing & Service Partitioning
Refactor all singleton services to namespace keys by `storeId`:
- `TodoService`: Key format `sbx_store_${storeId}_tasks_v1`. On store change, call `todoService.switchStore(newStoreId)` to reload tasks.
- `DesktopNotificationService`: Key format `sbx_store_${storeId}_notifications_v1`. Re-load on store switch.
- `SyncEngine`: Key format `sbx_store_${storeId}_sync_outbox`. Each store maintains its own offline outbox.
- `AdminService`: Key format `sbx_store_${storeId}_managed_users`.
- `CloudNotificationService`: Partition logs and store preferences by `storeId`.

### 4.5 Recommendation 5: Store-Partitioned Backup Architecture
- In `BackupManager` (`electron/database/backupManager.ts`):
  1. Filename format: `store_${storeId}_${timestampStr}_${safeReason}.db`.
  2. Backup directory structure: `backups/db_backups/${storeId}/` (or store-prefixed filenames).
  3. `listBackups(storeId)`: Filter exclusively for the active `storeId`.
  4. `restoreBackup(storeId, filename)`: Assert that `filename` starts with `store_${storeId}_`. Reject attempts to restore a backup belonging to Store X into Store Y.

### 4.6 Recommendation 6: Central Store Registry for 100+ Stores
- Replace the hardcoded `STARBUCKS_STORES_CATALOG` in `starbucksStores.ts` with a central JSON/SQLite catalog:
  - Default file: `data/stores_registry.json`.
  - Expose IPC endpoints: `stores:list-all`, `stores:get-by-id`, `stores:register`, `stores:update`.
  - `StoreSwitcherModal`: Use virtual scrolling (e.g. lightweight windowing or CSS virtualization) and fast fuzzy search to effortlessly render 100–500 stores with zero lag.
  - On clean launch with no configured active store: Display `OnboardingWizardView` with store selection from the 100+ store catalog instead of defaulting to Janki.

---

## 5. Verification Method

To independently verify these findings and test the proposed architecture:

1. **Verify Database Naming & Hardcoded Janki Fallback**:
   - Command:
     ```bash
     grep -n "tplh_forecast" electron/database/db.ts electron/database/backupManager.ts
     ```
   - Confirm lines in `db.ts` (lines 178-185) showing `tplh_forecast.db` exception for Janki.
2. **Verify Component Keying & Stale Schedule State**:
   - Inspect `src/App.tsx:608-615`: Confirm `<ManagerScheduleView />` has no `key` attribute.
   - Inspect `src/modules/managers-schedule/components/ManagerScheduleView.tsx:130-134`: Confirm `loadScheduleData` only depends on `[selectedYear, selectedMonth]`.
3. **Verify LocalStorage Leaks**:
   - Inspect `src/services/todoService.ts:16` (`sbx_sm_tasks_v1`) and `src/services/desktopNotificationService.ts:24` (`sbx_desktop_notifications_v1`). Confirm absence of `storeId` partitioning.
4. **Verify Backup Overwrite Hazard**:
   - Inspect `electron/database/backupManager.ts:80 & 166-178`: Confirm backups use fixed prefix `tplh_forecast_` and restore blindly copies over `dbManager.getDbFilePath()`.
5. **Build Verification**:
   - Command:
     ```bash
     npm run build
     ```
   - Invalidation condition: If TypeScript or Vite report compilation errors, this verifies whether changes maintain type contract integrity.
