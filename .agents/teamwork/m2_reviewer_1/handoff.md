# Milestone 2 Reviewer 1: Architecture & Database Verification — Handoff Report

## Review Summary

**Verdict**: **REQUEST_CHANGES**

Milestone 2 database architecture, connection pool, and storage namespacing deliverables implemented by `m2_worker_1` (`electron/database/db.ts`, `src/services/storeStorage.ts`, `electron/database/backupManager.ts`) have been independently reviewed and adversarially tested.

While core architectural capabilities (`StoreConnectionPool` 8-handle LRU caching, `AsyncMutex` serialized store switching, uniform naming `store_${safeId}.db`, and SHA-256 legacy migration parity) are implemented with high technical merit and zero integrity violations (no facades, mock data, or shortcuts), the mandated test command `npx tsx --test "tests/e2e/**/*.test.ts"` fails with exit code 1 due to top-level static `electron` imports in backend modules, and a regex bug in `validateRestoreTarget` falsely rejects backups for store IDs containing underscores.

---

## 1. Observation

### 1.1 Mandatory Build & Test Execution

1. **Build (`npm run build`)**:
   - Command: `npm run build`
   - Exit code: 0
   - Output summary:
     - Vite built client environment in 937ms: `dist/index.html` (1.31 kB), `dist/assets/index-CvX9lgAy.js` (1,341.80 kB).
     - Vite built Electron main process in 65ms: `dist-electron/main.js` (497.44 kB).
     - Vite built preload script in 7ms: `dist-electron/preload.js` (6.65 kB).
     - 0 TypeScript compilation errors (`tsc` passed cleanly).

2. **Full E2E Test Suite (`npx tsx --test "tests/e2e/**/*.test.ts"`)**:
   - Command: `npx tsx --test "tests/e2e/**/*.test.ts"`
   - Exit code: **1 (FAILED)**
   - Failure details:
     ```
     /Users/dawidapel/COL Tool/electron/database/db.ts:5
     import { app } from 'electron';
              ^
     SyntaxError: The requested module 'electron' does not provide an export named 'app'
         at #asyncInstantiate (node:internal/modules/esm/module_job:455:21)
         at async ModuleJob.run (node:internal/modules/esm/module_job:553:5)
         at async node:internal/modules/esm/loader:647:26
         at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)

     Node.js v24.20.0
     ✖ tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts (200.455333ms)
     ℹ tests 270
     ℹ suites 0
     ℹ pass 269
     ℹ fail 1
     ```
   - Baseline tests (Tiers 1–4 and M1 adversarial): **269/269 passed (100%)**.
   - Failure cause: `tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts` imports `{ StoreConnectionPool, AsyncMutex, DatabaseManager }` from `electron/database/db.ts`. In Node.js outside Electron, the `electron` package exports an executable path string instead of `{ app, ... }`, throwing an uncatchable instantiation `SyntaxError`.
   - When executed with an Electron ESM mock loader intercepting `electron` imports:
     - Command: `NODE_OPTIONS="--loader ./.agents/teamwork/m2_reviewer_1/mock_loader.mjs --no-warnings" npx tsx --test "tests/e2e/**/*.test.ts"`
     - Total tests: **311**
     - Pass: **311 (100%)**
     - Fail: **0**
     - Duration: 2.58s.

---

### 1.2 Verification of Features and Code Inspection

#### A. F6 Uniform Database File Naming & Legacy SHA-256 Migration (`electron/database/db.ts`)
- **Naming Convention (`computeDbFilePath`, lines 399–407)**:
  - Formats paths as `store_${safeId}.db` within `this.storageDir`.
  - Truncates raw ID to 64 characters (`slice(0, 64)`).
  - Sanitizes illegal path characters via `.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()`.
  - Normalizes aliases: `108120_janki`, unitCode `18120`, and MPK `108120` resolve uniformly to `store_108120.db`.
- **Legacy Migration (`migrateLegacyTplhDatabase`, lines 412–487)**:
  - Condition: `tplh_forecast.db` exists and `store_108120.db` does not exist.
  - Verifies minimum file size (> 100 bytes) and binary magic `SQLite format 3\0`.
  - Generates pre-migration safety backup in `backups/db_backups/legacy_tplh_migration_backup_${timestamp}.db`.
  - Copies to temporary file `${targetPath}.migration_tmp`.
  - Calculates SHA-256 hashes of source and temporary file; throws error and unlinks temporary file if hashes diverge.
  - Atomically renames temporary file to target path (`fs.renameSync`).
  - Writes audit trail receipt to `data/legacy_migration_receipt.json`.
- **Empirical On-Disk Verification**:
  - `data/tplh_forecast.db`: 397,312 bytes, SHA-256: `e9f16bb64be636fa56ac5e77b8de4ad28beb5e55a5acaf8f068947a5431f511b`
  - `data/store_108120.db`: 397,312 bytes, SHA-256: `e9f16bb64be636fa56ac5e77b8de4ad28beb5e55a5acaf8f068947a5431f511b`
  - `data/legacy_migration_receipt.json`: Validated, contains exact matching SHA-256 and byte count.

#### B. F7 LRU Connection Pool & Concurrency Mutex (`electron/database/db.ts`)
- **AsyncMutex (lines 19–38)**:
  - Implements Promise queue chain (`this.queue = previous.then(() => waitPromise)`).
  - Guarantees strict FIFO execution order.
  - Stress-tested under 50 concurrent async store switch requests: concurrency remained strictly 1 at all times; execution order perfectly preserved.
  - Recovers cleanly when an exclusive task throws; subsequent tasks execute without deadlocks.
- **StoreConnectionPool (lines 43–203)**:
  - Maintains `Map<string, PooledConnection>` with `maxConnections = 8`.
  - `get(storeId)` updates `lastAccessed = Date.now()`.
  - When connection 9 is registered, finds the minimum `lastAccessed` timestamp and evicts the LRU connection.
  - Eviction clears pending debounce timers (`clearTimeout(evictedEntry.debounceTimer)`).
  - If `evictedEntry.isDirty === true`, exports SQLite buffer (`evictedEntry.db.export()`) and writes to disk before invoking `db.close()`.
  - Eviction log records `{ evictedStoreId, flushed }`.
  - Empirically verified: evicting clean handle closes cleanly; evicting dirty handle flushes changes to disk before closing.

#### C. F10 Store-Namespaced Local Storage (`src/services/storeStorage.ts`)
- **Key Partitioning**:
  - `getKey(feature, customStoreId)` returns `sbx_store_${safeStoreId}_${cleanFeature}`.
  - `sanitizeStoreId` falls back to `'default'` and cleans path traversal tokens.
- **Isolation & Partition Operations**:
  - `getItem`, `setItem`, `removeItem`, `getStorePartitionKeys`, and `clearStorePartition` operate strictly on the targeted store partition.
  - Tested: clearing Store A partition deletes 100% of Store A keys and leaves Store B keys 100% intact.
  - `setItem` catches and logs `QuotaExceededError` without throwing unhandled exceptions.
- **Legacy Key Migration (`migrateLegacyKeys`)**:
  - Migrates 11 un-namespaced keys (e.g. `sbx_sm_tasks_v1` -> `todos`, `sbx_desktop_notifications_v1` -> `notifications`) to Store 108120 partition.
  - Sets idempotency flag `sbx_migrated_v2_108120`. Old un-namespaced keys are removed.

#### D. F11 Store-Partitioned Backup & Restore (`electron/database/backupManager.ts`)
- **File Naming**:
  - Generates filenames: `store_${safeStoreId}_backup_${YYYY-MM-DD_HH-mm-ss}_${subMs}_${reason}.db`.
- **Partitioned Retention Rotation (`rotateBackupsForStore`, lines 444–465)**:
  - Enforces `maxKeep = 15` per store.
  - Tested: Store 108150 with 20 backups rotated to 15 (5 deleted); Store 108120 with 5 backups left 100% untouched.
- **Deep Pre-Restore Inspection (`inspectBackupBuffer`, lines 230–315)**:
  - Validates SQLite binary header (`SQLite format 3`).
  - Instantiates in-memory `sql.js` Database from buffer.
  - Queries `app_settings` and `stores` tables for `store_id`, `unit_code`, `store_mpk`, `store_name`.
  - Flags cross-store mismatch unless overridden via `forceRestore: true`.
  - Creates automatic `pre_restore_safety` backup before applying any file overwrite.

---

## 2. Logic Chain

1. **Integrity & Completeness Assessment**:
   - `StoreConnectionPool` implements real LRU cache logic, eviction tracking, and dirty buffer flushing.
   - `AsyncMutex` serializes asynchronous promises without deadlock.
   - `migrateLegacyTplhDatabase` performed a true zero-loss atomic copy verified by identical SHA-256 hashes (`e9f16bb64be636fa56ac5e77b8de4ad28beb5e55a5acaf8f068947a5431f511b`).
   - `StoreStorage` partitions localStorage and isolates multi-tenant data.
   - `BackupManager` partitions backups and executes real in-memory SQLite table inspection.
   - Zero hardcoded facades, fake test results, or task bypasses exist.

2. **Mandatory Build & Test Execution Failure**:
   - The user/parent dispatch instructions explicitly command:
     `Run npm run build and npx tsx --test "tests/e2e/**/*.test.ts"`.
   - Running `npx tsx --test "tests/e2e/**/*.test.ts"` produces exit code 1 because Node.js cannot resolve `import { app } from 'electron'` when loading `electron/database/db.ts` and `backupManager.ts`.
   - Code that exports classes for testing must be importable in the project's test environment without requiring ad-hoc runtime loaders.

3. **Defect in Cross-Store Restore Validation**:
   - In `backupManager.ts:50`, `validateRestoreTarget` extracts the store ID using `backupFilename.match(/^store_([^_]+)_/)`.
   - Because it stops at the first underscore, store IDs with underscores (e.g. `108120_janki`, `wroclaw_glowny`, `custom_store_1`) yield only the first prefix (e.g. `108120`), which fails equality checks against `targetStoreId` (`108120_janki`).
   - Consequently, Store Managers restoring valid backups for any store whose ID contains an underscore will be blocked by a false mismatch error.

4. **Quitting with Background Dirty Stores**:
   - `app.on('before-quit')` in `electron/main.ts:1980` calls `dbManager.persist()`.
   - `dbManager.persist()` only flushes `this.currentStoreId`.
   - Any background store connection in `StoreConnectionPool` with unpersisted dirty writes waiting on its 2000ms debounce timer is discarded without being written to disk upon app exit.

---

## 3. Findings

### Finding 1 (Critical — Test Suite Compatibility)
- **What**: Direct ESM import of `electron/database/db.ts` or `electron/database/backupManager.ts` in Node test runners fails with `SyntaxError: The requested module 'electron' does not provide an export named 'app'`.
- **Where**: `electron/database/db.ts:5`, `electron/database/backupManager.ts:5`.
- **Why**: Outside the packaged Electron runtime, the `electron` package exports an executable path string. Static named imports fail at module evaluation before `typeof app !== 'undefined'` checks can execute.
- **Suggestion**: Use dynamic require/import for `app` with a graceful headless fallback:
  ```typescript
  let app: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    app = require('electron').app;
  } catch {
    // Headless test runner fallback
  }
  ```

### Finding 2 (Major — Regex Defect in Store ID Validation)
- **What**: `validateRestoreTarget` falsely rejects backups for store IDs containing underscores.
- **Where**: `electron/database/backupManager.ts:50` and line 180.
- **Why**: The regex `^store_([^_]+)_` extracts characters only up to the first underscore. For `store_108120_janki_backup_...`, it extracts `108120`, failing comparison with `108120_janki`.
- **Suggestion**: Use the `_backup_` delimiter to extract the full sanitized store ID:
  ```typescript
  export function validateRestoreTarget(backupFilename: string, targetStoreId: string): boolean {
    if (!backupFilename || !targetStoreId) return false;
    const match = backupFilename.match(/^store_(.+?)_backup_/);
    if (!match) return false;
    return match[1].toLowerCase() === targetStoreId.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
  }
  ```

### Finding 3 (Medium — Filename Reason Extraction for Multi-Part Store IDs)
- **What**: `parseReasonFromFilename` in `BackupManager` corrupts the parsed backup reason for store IDs containing underscores.
- **Where**: `electron/database/backupManager.ts:490–494`.
- **Why**: Slicing by hardcoded index `parts.slice(5)` assumes index 1 is the sole store ID segment.
- **Suggestion**: Parse reason using explicit regex matching the filename pattern:
  ```typescript
  const match = filename.match(/^store_.+?_backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_\d{3}_(.+?)\.db$/);
  if (match) return this.formatReason(match[1]);
  ```

### Finding 4 (Medium — Incomplete Pool Flush on App Quit)
- **What**: `app.on('before-quit')` in `electron/main.ts` calls `dbManager.persist()`, persisting only the current active store and leaving dirty writes in background pooled connections unpersisted.
- **Where**: `electron/main.ts:1980–1983`, `electron/database/db.ts:698–708`.
- **Why**: `StoreConnectionPool.persistAll()` exists but is not invoked during `app.on('before-quit')`.
- **Suggestion**: Update `before-quit` handler in `electron/main.ts`:
  ```typescript
  app.on('before-quit', () => {
    const dbManager = DatabaseManager.getInstance();
    dbManager.getConnectionPool().persistAll();
    dbManager.persist();
  });
  ```

### Finding 5 (Low / Cleanliness — Workspace Backup Directory Pollution)
- **What**: `migrateLegacyTplhDatabase` creates pre-migration safety backups in `process.cwd()/backups/db_backups/` even when `DatabaseManager` is instantiated with a custom `storageDir`.
- **Where**: `electron/database/db.ts:442–445`.
- **Why**: Hardcodes `process.cwd()` instead of deriving from `this.storageDir`.
- **Suggestion**: Use `path.join(path.dirname(this.storageDir), 'backups', 'db_backups')` or accept a backup directory parameter.

---

## 4. Caveats

- **Operating System File Handles**: The LRU connection pool maintains a maximum of 8 open SQLite databases in memory. If future high-concurrency background services require access to >8 stores simultaneously in parallel async tasks, the pool safely handles eviction, but frequent evictions will cause file I/O overhead. 8 connections is ideal for desktop client usage.
- **LocalStorage 5MB Quota**: While `StoreStorage` includes quota handling and error suppression, storing extensive cached data across dozens of stores on a single machine could eventually approach browser localStorage limits. Heavy datasets should remain in SQLite rather than localStorage.
- No other caveats.

---

## 5. Conclusion

**Verdict**: **REQUEST_CHANGES**

The core multi-store SQLite database engine, LRU connection pool, AsyncMutex, and partitioned storage architecture built by `m2_worker_1` are fundamentally sound, mathematically verified, and free of integrity violations. However, the implementation requires adjustments to resolve:
1. `import { app } from 'electron'` breaking `npx tsx --test "tests/e2e/**/*.test.ts"` in headless Node environments.
2. The regex in `validateRestoreTarget` preventing valid restores for store IDs with underscores.
3. Flushing all pooled connections via `persistAll()` on `before-quit`.

Once these targeted corrections are made, the Milestone 2 implementation will meet all criteria for full approval.

---

## 6. Verification Method

To reproduce and independently verify these findings, run the following commands:

1. **Verify Production Build**:
   ```bash
   npm run build
   ```
   *Result*: Exits with code 0; TypeScript and Vite compile with 0 errors.

2. **Verify Test Runner Failure on Static Electron Import**:
   ```bash
   npx tsx --test "tests/e2e/**/*.test.ts"
   ```
   *Result*: Exits with code 1; fails on `tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts` with `SyntaxError: The requested module 'electron' does not provide an export named 'app'`.

3. **Verify All 311 Tests Pass with Mock Loader**:
   ```bash
   NODE_OPTIONS="--loader ./.agents/teamwork/m2_reviewer_1/mock_loader.mjs --no-warnings" npx tsx --test "tests/e2e/**/*.test.ts"
   ```
   *Result*: Exits with code 0; 311/311 tests pass in 2.58s.

4. **Verify SHA-256 Legacy Database Parity on Disk**:
   ```bash
   shasum -a 256 data/tplh_forecast.db data/store_108120.db
   ```
   *Result*: Identical hash output: `e9f16bb64be636fa56ac5e77b8de4ad28beb5e55a5acaf8f068947a5431f511b`.

5. **Reproduce `validateRestoreTarget` Regex Defect**:
   ```bash
   node -e "
   const regex = /^store_([^_]+)_/;
   const filename = 'store_108120_janki_backup_2026-10-24_manual.db';
   const match = filename.match(regex);
   console.log('Parsed storeId:', match ? match[1] : null);
   console.log('Matches target 108120_janki?:', match && match[1] === '108120_janki');
   "
   ```
   *Result*: Outputs `Parsed storeId: 108120` and `Matches target 108120_janki?: false`.
