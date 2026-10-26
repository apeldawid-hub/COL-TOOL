# DISPATCH — Milestone 2 Worker: Scalable Multi-Store Architecture (100+ Stores)

## Mission
Implement Milestone 2 covering Features F6, F7, F8, F9, F10, F11 based on the comprehensive blueprints provided by M2 Explorers 1, 2, and 3.

## Reference Documents (MUST Read Before Starting)
- `/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md` (MUST read first)
- `/Users/dawidapel/COL Tool/PROJECT.md`
- `/Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_1/handoff.md` (Blueprints for F6 & F7)
- `/Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_2/handoff.md` (Blueprints for F8 & F9)
- `/Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_3/handoff.md` (Blueprints for F10 & F11)

## Implementation Tasks

### 1. F6 & F7: Uniform DB Naming, Legacy Migration & LRU Connection Pool (`electron/database/db.ts`)
- Implement `AsyncMutex` class (FIFO promise queue for serialized async store switching).
- Implement `StoreConnectionPool` class maintaining up to 8 active SQLite database handles with LRU eviction, dirty-write flush (`fs.writeFileSync`), statement cleanup, `markDirty()`, `persistStore()`, `persistAll()`, `closeAll()`.
- Update `computeDbFilePath`: Remove the hardcoded Janki/108120 route to `tplh_forecast.db`. Enforce uniform `store_${safeId}.db` naming with 64-char length truncation and path-traversal sanitization.
- Implement `migrateLegacyTplhDatabase(targetStoreId = '108120')`: Detects `tplh_forecast.db`, creates safety backup in `backups/db_backups/`, copies to temporary file, validates SHA-256 binary parity, atomically renames to `store_108120.db`, and writes migration receipt.
- Refactor `DatabaseManager`: Wrap `switchStoreDatabase` in `this.switchMutex.runExclusive`, check LRU cache hit before reading disk, flush dirty writes before switching, and store active handle in pool.
- Maintain full backward compatibility for `getDb()`, `persist()`, and `reloadFromDisk()`.

### 2. F8 & F9: Scalable Store Registry & React View State Isolation (`src/`)
- In `src/constants/starbucksStores.ts`: Expand catalog to 100+ authentic Polish stores (125 stores provided in M2 Explorer 2 handoff). Implement `normalizeDiacritics()` for Polish character folding in search. Ensure `getCustomStores()` merges without duplicate keys.
- In `src/components/StoreSwitcherModal.tsx`: Add 150ms debounced search, optimize filter using `normalizeDiacritics`, implement virtualized/windowed card rendering for smooth scrolling with 100+ stores, and add keyboard navigation (`ArrowDown`/`ArrowUp`/`Enter`).
- In `src/App.tsx`: Key all module views by `key={`store-${currentStore.id}-${activeModule}`}` (or `key={currentStore.id}`) to enforce clean component unmounting/remounting on store switch:
  * `ManagerScheduleView`
  * `LaborForecastView`
  * `TrainingsView`
  * `ColCalculatorView`
  * `DashboardView`
- Implement two-phase event dispatch in `App.tsx`:
  * Pre-switch: dispatch `sbx:store-switching` with `{ fromStoreId, toStoreId }` before invoking `switchStoreDatabase`.
  * Post-switch: dispatch `sbx:store-switched` with `{ currentStore }` after database switch completes.
- Ensure `TrainingsView`, `ColCalculatorView`, and `ManagerScheduleView` cleanly reload state on `sbx:store-switched`.

### 3. F10: Service Storage Namespacing (`src/services/storeStorage.ts`)
- Create `src/services/storeStorage.ts` implementing `StoreStorage` utility:
  * `getKey(feature, customStoreId)` -> `sbx_store_${safeStoreId}_${cleanFeature}`
  * `getItem<T>(feature, customStoreId)` / `setItem<T>(feature, value, customStoreId)` with QuotaExceededError handling
  * `removeItem()`, `getStorePartitionKeys()`, `clearStorePartition()`
  * `migrateLegacyKeys(targetStoreId = '108120')` to transparently migrate un-namespaced keys for Store 108120.
- Update `todoService.ts`, `desktopNotificationService.ts`, `syncEngine.ts`, `adminService.ts`, and `WeeklyScheduleTable.tsx` to use `StoreStorage` and react to store switch events.

### 4. F11: Store-Partitioned Backup & Restore Engine (`electron/database/backupManager.ts`)
- Redesign `BackupManager`:
  * Generate filenames: `store_${safeStoreId}_backup_${timestamp}_${reason}.db`.
  * Backward compatibility: Store 108120 lists both `store_108120_*` and legacy `tplh_forecast_*`.
  * Independent 15-backup retention pool per store: `rotateBackupsForStore(storeId, 15)`.
  * Deep in-memory SQLite inspection before restore (`inspectBackupBuffer`): inspects `app_settings` and `stores` table.
  * Store mismatch guard: blocks restore if backup store != target store unless `forceRestore: true`.
  * Checksum validation: SQLite format 3 magic header and SHA-256 integrity.
  * Pre-restore safety backup: `store_${targetStoreId}_pre_restore_safety_${timestamp}.db`.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mandatory Commands to Run Before Handoff
1. `npm run build` (must exit 0 with 0 errors)
2. `npx tsx --test "tests/e2e/**/*.test.ts"` (all tests must pass)

## Deliverables
Write `/Users/dawidapel/COL Tool/.agents/teamwork/m2_worker_1/handoff.md` with:
- Observation (files modified, test run outputs, build output)
- Logic Chain
- Caveats
- Conclusion
- Verification Method

## 2026-10-24T02:56:42Z
Read /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md and /Users/dawidapel/COL Tool/.agents/teamwork/m2_worker_1/DISPATCH.md.
Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/m2_worker_1.
Your role: M2 Worker (Scalable Multi-Store Architecture for 100+ Stores).
Read the blueprints from:
- /Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_1/handoff.md (F6 & F7)
- /Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_2/handoff.md (F8 & F9)
- /Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_3/handoff.md (F10 & F11)

Implement:
1. electron/database/db.ts: Uniform store_${safeId}.db naming, automated legacy tplh_forecast.db migration to store_108120.db with SHA-256 parity verification, AsyncMutex, and StoreConnectionPool (8-conn LRU cache, dirty write flush, clean eviction).
2. src/constants/starbucksStores.ts & src/components/StoreSwitcherModal.tsx: 125 authentic stores catalog, normalizeDiacritics Polish diacritic folding, debounced search, virtualized card rendering, keyboard navigation.
3. src/App.tsx: React view state lifecycle isolation (keying module views by `key={'store-' + currentStore.id + '-' + activeModule}`) and two-phase store transition event dispatch (sbx:store-switching and sbx:store-switched).
4. src/services/storeStorage.ts: StoreStorage utility with partition keys sbx_store_${safeStoreId}_*, legacy migration for 108120, and reactive store-switched listeners in singletons (todoService, desktopNotificationService, syncEngine, adminService, WeeklyScheduleTable).
5. electron/database/backupManager.ts: Store-partitioned backups (store_${safeStoreId}_backup_*), independent 15-backup retention pools per store, deep pre-restore SQLite inspection in memory, store mismatch protection, and pre-restore safety backups.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Run `npm run build` and `npx tsx --test "tests/e2e/**/*.test.ts"`.
Write /Users/dawidapel/COL Tool/.agents/teamwork/m2_worker_1/handoff.md when complete. Notify parent via send_message.
