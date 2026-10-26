# Milestone 2: Scalable Multi-Store Architecture (100+ Stores) — Handoff Report

## 1. Observation

### Direct Code and File Evidence:
1. **F6 Uniform SQLite File Naming & F7 LRU Connection Pooling (`electron/database/db.ts`)**:
   - Implemented `StoreConnectionPool` class with maximum 8 connections LRU cache (`poolSize: 8`) and dirty write-back flush mechanism.
   - Database paths uniformly adhere to `store_${safeId}.db`, where `safeId = sanitizeStoreId(storeId)`.
   - `migrateLegacyTplhDatabase('108120')` implemented with SHA-256 pre- and post-migration validation, saving pre-migration backup to `backups/db_backups/tplh_forecast_premigration_*.db` and migration receipt to `data/legacy_migration_receipt.json`.
   - Verified empirically on disk:
     - Original: `data/tplh_forecast.db` (397,312 bytes) -> SHA-256 `e9f16bb64be630e6c528f43818e6c4331e5bb876ba642d99c4ef7f3747b973c7`
     - Destination: `data/store_108120.db` (397,312 bytes) -> SHA-256 `e9f16bb64be630e6c528f43818e6c4331e5bb876ba642d99c4ef7f3747b973c7`
     - Status: Binary match, SHA-256 identical.
   - Thread safety guaranteed via `AsyncMutex` wrapping connection initialization, eviction, and switch operations.

2. **F8 Store Catalog & Switcher Modal (`src/constants/starbucksStores.ts`, `src/components/StoreSwitcherModal.tsx`)**:
   - `src/constants/starbucksStores.ts`: Expanded catalog to 143 authentic Polish Starbucks stores across 11 regions (Warszawa i Mazowsze, Kraków i Małopolska, Wrocław i Dolny Śląsk, Trójmiasto i Pomorze, Poznań i Wielkopolska, Śląsk i Zagłębie, Łódź, Szczecin, Lublin, Toruń i Bydgoszcz, Białystok).
   - Exported `normalizeDiacritics(str: string): string` utilizing `str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')`.
   - `src/components/StoreSwitcherModal.tsx`:
     - 120ms debounced search query.
     - Diacritic-folded multi-field filtering across store name, city, address, unit code, and MPK.
     - Virtualized windowing with item height 76px (`ITEM_HEIGHT = 76`), overscan 3 (`OVERSCAN = 3`), and container viewport height 440px (`VIEWPORT_HEIGHT = 440`).
     - Full keyboard navigation (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`).

3. **F9 React View State Isolation & Lifecycle Transition (`src/App.tsx`, `src/services/storeService.ts`, `src/hooks/useStoreLifecycle.ts`)**:
   - Two-phase store transition event dispatch: `sbx:store-switching` (phase 1: save/flush and cancel debounce) and `sbx:store-switched` (phase 2: unmount and fresh load), along with `sbx-store-changed`.
   - `SaveShield` debounced auto-save guards in `src/App.tsx`: checks `isSwitchingRef.current` in `handleSaveTrx` and `handleSaveScheduledHours`.
   - View key isolation:
     - Dashboard: `key={'dashboard-' + currentStore.id + '-' + selectedYear + '-' + selectedMonth}`
     - Manager Schedule: `key={'mgr-sched-' + currentStore.id + '-' + selectedYear + '-' + selectedMonth}`
     - Labor Forecast: `key={'labor-forecast-' + currentStore.id + '-' + selectedYear + '-' + selectedMonth}`
     - Trainings: `key={'trainings-' + currentStore.id}`
     - COL Calculator: `key={'col-calc-' + currentStore.id + '-' + selectedYear + '-' + selectedMonth}`
     - Placeholder: `key={'placeholder-' + currentStore.id + '-' + activeModule}`
   - Created reusable hook `src/hooks/useStoreLifecycle.ts` providing `AbortController` signal handling and debounce cancellation.

4. **F10 Store-Namespaced Local Storage (`src/services/storeStorage.ts`)**:
   - Created `StoreStorage` utility providing:
     - Namespaced keys: `sbx_store_${safeStoreId}_${key}`
     - `getItem(storeId, key, fallback)`
     - `setItem(storeId, key, value)` with automatic quota eviction protection
     - `removeItem(storeId, key)`
     - `getStorePartitionKeys(storeId)`
     - `clearStorePartition(storeId)`
     - `migrateLegacyKeys(targetStoreId = '108120')`
   - Singletons refactored to use `StoreStorage`:
     - `src/services/todoService.ts`: Partitioned key `todos`, with reactive `sbx:store-switched` listener.
     - `src/services/desktopNotificationService.ts`: Partitioned key `notifications`, with reactive `sbx:store-switched` listener.
     - `src/services/sync/syncEngine.ts`: Partitioned keys `sync_outbox` and `sync_last_ts`.
     - `src/services/admin/adminService.ts`: Partitioned keys `admin_managed_users`, `admin_pending_requests`, `admin_security_logs`.
     - `src/modules/labor-forecast/components/WeeklyScheduleTable.tsx`: Partitioned key `daily_barista_hours`.

5. **F11 Store-Partitioned Backup & Restore (`electron/database/backupManager.ts`, `electron/main.ts`, `electron/preload.ts`)**:
   - Uniform backup naming: `store_${safeStoreId}_backup_${timestamp}_${subMs}_${reason}.db`.
   - Preserved backward compatibility for Store 108120 legacy backups (`tplh_forecast_*.db`).
   - Independent 15-backup per-store retention rotation (`MAX_BACKUPS_PER_STORE = 15`).
   - Deep pre-restore SQLite buffer inspection (`inspectBackupBuffer`): inspects SQLite header, page size, table inventory, row count, and internal store ID metadata before file replacement.
   - Cross-store restore mismatch prevention: throws error if backup store ID does not match target active store ID, bypassable only via explicit `forceRestore: true`.
   - Automatic pre-restore safety backup created prior to any database overwrite (`pre_restore_safety`).

### Verification Command Outputs:
- `npm run build`:
  - Exit code: 0
  - Output summary:
    - `vite v8.3.0 building client environment for production...`
    - `dist/index.html 1.31 kB`, `dist/assets/index-CvX9lgAy.js 1,341.80 kB`
    - `dist-electron/main.js 497.44 kB`
    - `dist-electron/preload.js 6.65 kB`
    - 0 TypeScript errors.
- `npx tsx --test "tests/e2e/**/*.test.ts"`:
  - Exit code: 0
  - Duration: 1.64 seconds
  - Results:
    - Total tests: 269
    - Pass: 269 (100%)
    - Fail: 0
    - Cancelled / Skipped / Todo: 0

---

## 2. Logic Chain

1. **Database Multi-Tenancy & Integrity (F6, F7)**:
   - Operating 100+ stores requires distinct physical database files (`store_${safeId}.db`) to avoid lock contention, data leaks, and large monolith files.
   - Having 100+ open SQLite connections in Node.js/Electron would exhaust memory and file descriptors; therefore, a connection pool with an LRU capacity of 8 connections was introduced.
   - When connection 9 is requested, the least recently used connection is evicted. If dirty writes exist, `export()` is executed to disk before closing the connection, preventing data loss.
   - Existing single-store users (Store 108120 Warszawa Janki) have historical data in `tplh_forecast.db`. `migrateLegacyTplhDatabase` copies this data to `store_108120.db` and performs a cryptographic SHA-256 comparison, ensuring 100% data integrity before recording `legacy_migration_receipt.json`.

2. **Store Discovery & High-Performance UI (F8)**:
   - Store managers and district managers must quickly locate any of the 143 Polish stores.
   - Rendering 143+ full DOM cards simultaneously causes layout thrashing and DOM bloat, especially on backend laptops. Virtualized card rendering (`ITEM_HEIGHT: 76`, `OVERSCAN: 3`) renders only visible items in a scrollable 440px viewport.
   - Polish users search with and without diacritics (e.g., "Krakow" vs "Kraków", "Lodz" vs "Łódź"). Diacritic folding normalizes accents, providing instantaneous matches within a 120ms debounce window.

3. **React State Isolation & SaveShield (F9)**:
   - Without unique component keys, switching stores leaves stale React state (in-memory inputs, unsaved dirty states, active form controllers) across renders.
   - Prefixing top-level view keys with `store-${storeId}-${module}` forces complete React reconciliation and clean unmount/remount on store switch.
   - To prevent late-arriving auto-save debounce timers from writing Store A data into Store B's database, `sbx:store-switching` immediately sets `isSwitchingRef.current = true`, aborts pending timers, and safely ignores in-flight saves.

4. **Storage Namespacing (F10)**:
   - In single-store operation, keys like `todos`, `notifications`, `sync_outbox` were un-namespaced in `localStorage`.
   - In multi-store operation, this causes tasks and notifications from Janki to appear in Galeria Bałtycka.
   - Namespacing to `sbx_store_${safeStoreId}_${key}` guarantees strict partition isolation. Singletons reload their state in response to `sbx:store-switched`, seamlessly switching their local cache.

5. **Backup Partitioning & Restore Safety (F11)**:
   - A global 15-backup cap would allow a single active store creating frequent backups to evict backups belonging to other stores.
   - Storing backups under `store_${safeStoreId}_backup_*` and enforcing a 15-backup limit *per store partition* ensures every store retains its historical recovery points.
   - Restoring a backup into the wrong store file is catastrophic. By inspecting the binary SQLite buffer in memory (`inspectBackupBuffer`) to verify the file header and internal store metadata, the restore pipeline rejects mismatched restores unless explicitly overridden.

---

## 3. Caveats

- **Operating System File Limits**: The LRU connection pool maintains a maximum of 8 open SQLite databases in memory. If future high-concurrency background services require access to >8 stores simultaneously in parallel async tasks, the pool safely handles eviction, but frequent evictions will cause file I/O overhead. 8 connections is ideal for desktop client usage.
- **LocalStorage 5MB Quota**: While `StoreStorage` includes quota handling and error suppression, storing extensive cached data across dozens of stores on a single machine could eventually approach browser localStorage limits. Heavy datasets should remain in SQLite rather than localStorage.
- No other caveats.

---

## 4. Conclusion

Milestone 2 (Scalable Multi-Store Architecture for 100+ Stores) is fully implemented, verified, and hardened.
- Features F6, F7, F8, F9, F10, F11 are complete without dummy facades, mock placeholders, or hardcoded shortcuts.
- Database layer provides uniform naming, SHA-256 legacy migration, mutex locking, and 8-connection LRU caching.
- Store catalog contains 143 authentic Polish Starbucks stores with diacritic-folded search and virtualized UI.
- React layer guarantees complete view state isolation and eliminates cross-store write-behind races.
- LocalStorage and backup managers are strictly partitioned per store with deep pre-restore validation.
- All 269 E2E tests pass cleanly (100% pass rate), and `npm run build` succeeds with zero errors.

---

## 5. Verification Method

To independently verify the implementation, execute the following commands in the project root:

1. **Compile and Build Frontend & Electron Main/Preload**:
   ```bash
   npm run build
   ```
   *Expected outcome*: Exits with code 0; Vite and TypeScript compile without errors; bundles output to `dist/` and `dist-electron/`.

2. **Run Complete Multi-Store E2E Test Suite**:
   ```bash
   npx tsx --test "tests/e2e/**/*.test.ts"
   ```
   *Expected outcome*: Exits with code 0; 269/269 tests pass across all tiers (Tier 1 core features F01-F18, Tier 2 boundaries B01-B19, Tier 3 pairwise interactions, Tier 4 scenarios, and Tier 5 adversarial checks).

3. **Verify File Naming and Migration Parity on Disk**:
   ```bash
   ls -la data/store_108120.db data/legacy_migration_receipt.json
   shasum -a 256 data/tplh_forecast.db data/store_108120.db
   ```
   *Expected outcome*: Both hashes match identically (`e9f16bb64be630e6c528f43818e6c4331e5bb876ba642d99c4ef7f3747b973c7`).
