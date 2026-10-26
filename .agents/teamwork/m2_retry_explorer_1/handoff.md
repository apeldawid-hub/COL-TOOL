# Handoff Report: Milestone 2 Electron Database Import & Test Compatibility Architecture

## Executive Summary
This report provides an exhaustive, root-cause investigation and actionable implementation blueprint resolving the fatal `SyntaxError: The requested module 'electron' does not provide an export named 'app'` encountered when executing `npx tsx --test "tests/e2e/**/*.test.ts"`, alongside fixes for backup isolation in `migrateLegacyTplhDatabase`, store ID underscore handling in `validateRestoreTarget`, and pooled connection persistence on application termination.

---

## 1. Observation

### 1.1 Verbatim Failure Reproduction
When running the full E2E test suite or targeted adversarial challenge tests without external custom loaders:
- **Command**:
  ```bash
  npx tsx --test tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts
  ```
- **Exit Code**: `1`
- **Verbatim Error Output**:
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
  ✖ tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts (101.357125ms)
  ℹ tests 1
  ℹ suites 0
  ℹ pass 0
  ℹ fail 1
  ```
- **Same Error on Second Adversarial Test**:
  ```bash
  npx tsx --test tests/e2e/tier5-adversarial/m2_challenger_concurrency_stress.test.ts
  ```
  Fails identically at `electron/database/db.ts:5`.

### 1.2 Inspection of `electron` Package in Standalone Node.js vs Electron Runtime
1. **Inspection of `node_modules/electron/index.js`**:
   - Line 52:
     ```javascript
     module.exports = getElectronPath();
     ```
   - In standard Node.js (which `tsx` executes), `node_modules/electron/index.js` exports a `string` (e.g. `"/Users/dawidapel/COL Tool/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"`).
   - Under Node.js ESM module instantiation, attempting a named import `import { app } from 'electron'` triggers a fatal `SyntaxError` at link time because string primitives export no named bindings.
2. **Behavior of `require('electron')` in Standalone Node / `tsx`**:
   - Executing:
     ```bash
     npx tsx -e "const electron = require('electron'); console.log(typeof electron, electron.app);"
     ```
     Yields: `string undefined`.
   - Node.js does **not** throw an error on `require('electron')`; it simply yields a string, where `electron.app === undefined`.
3. **Behavior in Packaged Electron (`dist-electron/main.js`)**:
   - When bundled by Vite (`vite-plugin-electron`), `electron` is treated as a built-in external module.
   - Inside an Electron process, Electron's internal module loader overrides `'electron'` to return the Electron API namespace object containing `{ app, BrowserWindow, ipcMain, ... }`.

### 1.3 Inspection of `app` Usage Across `db.ts` and `backupManager.ts`
1. **`electron/database/db.ts`**:
   - Line 5: `import { app } from 'electron';`
   - Line 288: `if (typeof app !== 'undefined' && app && app.isPackaged)`
   - Line 442: `const backupDir = (typeof app !== 'undefined' && app && app.isPackaged) ? ...`
   - Line 1877: `(typeof app !== 'undefined' && app && app.isPackaged) ? ...`
   - Line 1963: `(typeof app !== 'undefined' && app && app.isPackaged) ? ...`
   - Line 1976: `(typeof app !== 'undefined' && app && app.isPackaged) ? ...`
   - Line 1989: `(typeof app !== 'undefined' && app && app.isPackaged) ? ...`
   - Line 2023: `(typeof app !== 'undefined' && app && app.isPackaged) ? ...`
   - Line 2174: `const userData = app?.getPath ? app.getPath('userData') : process.cwd();`
   - Line 2187: `(typeof app !== 'undefined' && app && app.isPackaged) ? ...`
   - Line 2295: `(typeof app !== 'undefined' && app && app.isPackaged) ? ...`
   - **Crucial Observation**: Every single runtime reference to `app` in `db.ts` is **already guard-checked** with `typeof app !== 'undefined' && app` or `app?.getPath`!
2. **`electron/database/backupManager.ts`**:
   - Line 5: `import { app } from 'electron';`
   - Line 64: `} else if (typeof app !== 'undefined' && app && app.isPackaged) {`
   - `backupManager.ts` is also imported directly in `tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts:8`. If `db.ts` is fixed without updating `backupManager.ts`, the test suite immediately fails on `backupManager.ts:5`.

### 1.4 Inspection of `migrateLegacyTplhDatabase` Backup Directory Determination
In `electron/database/db.ts:442-445`:
```typescript
// 1. Safety backup of legacy database
const backupDir = (typeof app !== 'undefined' && app && app.isPackaged)
  ? path.join(app.getPath('userData'), 'backups', 'db_backups')
  : path.join(process.cwd(), 'backups', 'db_backups');
```
- In unit and adversarial tests (`m2_stress_challenge.test.ts`), `DatabaseManager` is instantiated with an isolated temporary folder `tmpStorageDir = fs.mkdtempSync(...)`.
- Because `app` is not packaged during tests, line 444 hardcodes `path.join(process.cwd(), 'backups', 'db_backups')`.
- Inspection of `backups/db_backups/` revealed 9 leaked test artifacts (e.g. `legacy_tplh_migration_backup_2026-10-24T06-47-02-365Z.db`) committed to the project workspace instead of being cleaned up with `tmpStorageDir`.

### 1.5 Inspection of `validateRestoreTarget` and `parseReasonFromFilename` in `backupManager.ts`
1. **`validateRestoreTarget` (lines 48-53)**:
   ```typescript
   export function validateRestoreTarget(backupFilename: string, targetStoreId: string): boolean {
     if (!backupFilename || !targetStoreId) return false;
     const match = backupFilename.match(/^store_([^_]+)_/);
     if (!match) return false;
     return match[1].toLowerCase() === targetStoreId.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
   }
   ```
   - For a file `store_108120_janki_backup_2026-10-24_manual.db`, `^store_([^_]+)_` matches only `108120`.
   - Comparing `108120 === 108120_janki` returns `false`, erroneously rejecting valid restores for stores with underscores.
2. **`parseReasonFromFilename` (lines 488-500)**:
   - Splits on `_` and slices from index 5 (`parts.slice(5).join(' ')`), assuming index 1 is the sole store ID segment. For `store_108120_janki_backup_2026-10-24_12-00-00_000_manual.db`, it returns `'12-00-00 000 manual'` instead of `'manual'`.

### 1.6 Inspection of App Quit Persistence in `electron/main.ts`
In `electron/main.ts:1980-1983`:
```typescript
app.on('before-quit', () => {
  const dbManager = DatabaseManager.getInstance();
  dbManager.persist();
});
```
- `dbManager.persist()` only flushes the current active store. Any dirty connections in `StoreConnectionPool` are lost upon exit if their debounce timer hasn't elapsed.
- `dbManager.getConnectionPool().persistAll()` must be called prior to `dbManager.persist()`.

---

## 2. Logic Chain

1. **Why `SyntaxError` Occurs**:
   Node.js ESM imports are resolved and linked statically prior to code evaluation. When `tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts` executes in `tsx`, Node imports `electron/database/db.ts`. Because `db.ts` contains `import { app } from 'electron'`, Node parses the CommonJS wrapper of `node_modules/electron/index.js`. Because `module.exports` is a string, named export extraction fails fatally.

2. **Why Safe Dynamic Resolution Succeeds in Both Environments**:
   ```typescript
   let app: any;
   try {
     // eslint-disable-next-line @typescript-eslint/no-require-imports
     const electronModule = typeof require === 'function' ? require('electron') : undefined;
     app = (typeof electronModule === 'object' && electronModule !== null && 'app' in electronModule)
       ? electronModule.app
       : undefined;
   } catch {
     app = undefined;
   }
   ```
   - **In Standalone Node / tsx (`npx tsx --test`)**:
     `require('electron')` returns a string. `typeof electronModule === 'object'` evaluates to `false`. `app` becomes `undefined`. No exception is thrown. All existing guard checks in `db.ts` evaluate safely and fall back to local development directories or `this.storageDir`.
   - **In Packaged Electron / Dev (`dist-electron/main.js` / Vite)**:
     `electron/main.ts` statically imports from `'electron'`, ensuring the Electron runtime module is bound. When `require('electron')` is invoked in the main process, Electron returns its API namespace object with `app`. `app` is populated with the true Electron `App` instance (`isPackaged`, `getPath`, etc.).
   - **Zero Code Modification at Call Sites**:
     Because the top-level variable is named `app`, not a single line of downstream business logic in `db.ts` or `backupManager.ts` requires renaming.

3. **Why Scoping `backupDir` to `this.storageDir` Fixes Test Pollution**:
   - In `DatabaseManager`, `this.storageDir` is `path.join(app.getPath('userData'), 'data')` in production, and `path.join(process.cwd(), 'data')` in standard dev mode.
   - When unit/adversarial tests instantiate `new DatabaseManager(tmpStorageDir)`, `this.storageDir` points to the test temporary directory.
   - Setting:
     ```typescript
     let backupDir = customBackupDir;
     if (!backupDir) {
       if (typeof app !== 'undefined' && app && app.isPackaged) {
         backupDir = path.join(app.getPath('userData'), 'backups', 'db_backups');
       } else if (this.storageDir && this.storageDir !== path.join(process.cwd(), 'data')) {
         backupDir = path.join(this.storageDir, 'backups', 'db_backups');
       } else {
         backupDir = path.join(process.cwd(), 'backups', 'db_backups');
       }
     }
     ```
     guarantees that test safety backups are placed in `tmpStorageDir/backups/db_backups/` and are automatically deleted when `tmpStorageDir` is unlinked in the test teardown.

4. **Why `^store_(.+?)_backup_` Solves Store ID Underscores**:
   The store backup naming standard is:
   `store_${safeStoreId}_backup_${timestampStr}_${subMs}_${safeReason}.db`.
   The `_backup_` token is a fixed delimiter. Matching `^store_(.+?)_backup_` non-greedily extracts the complete `safeStoreId` regardless of how many underscores it contains (e.g. `108120_janki`, `wroclaw_glowny`, `custom_store_1`).

---

## 3. Caveats

1. **Scope of Test Runners**:
   `tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts` and `m2_challenger_concurrency_stress.test.ts` directly import backend Electron files. Frontend components (`src/`) should not import `electron/database/db.ts` directly; they communicate via Electron IPC (`window.api`).
2. **TypeScript Constructor Visibility**:
   In `db.ts`, changing `private constructor(storageDir?: string)` to `public constructor(storageDir?: string)` enables clean instantiation in unit tests without TypeScript errors, while preserving `DatabaseManager.getInstance()` for production singleton access.
3. No other caveats.

---

## 4. Conclusion & Complete Code Blueprint

### Summary of Targeted Fixes:
1. **`electron/database/db.ts`**: Replace static `import { app } from 'electron'` with safe dynamic resolution. Make constructor public. Scope `backupDir` in `migrateLegacyTplhDatabase` (and related methods) to `this.storageDir`.
2. **`electron/database/backupManager.ts`**: Replace static `import { app } from 'electron'` with safe dynamic resolution. Fix `validateRestoreTarget` regex to `^store_(.+?)_backup_`. Fix `parseReasonFromFilename` regex.
3. **`electron/main.ts`**: Add `dbManager.getConnectionPool().persistAll()` to `before-quit`.
4. **`tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts`**: Add underscore store ID test cases to `validateRestoreTarget` and verify test backup directory isolation.

---

### Complete Copy-Pasteable Code Blueprint

#### Component A: `electron/database/db.ts`

##### 1. Replace Line 5:
```typescript
<<<<
import { app } from 'electron';
====
// Safe dynamic resolution of electron app in both packaged Electron and standalone Node/tsx test runners
let app: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electronModule = typeof require === 'function' ? require('electron') : undefined;
  app = (typeof electronModule === 'object' && electronModule !== null && 'app' in electronModule)
    ? electronModule.app
    : undefined;
} catch {
  app = undefined;
}
>>>>
```

##### 2. Make Constructor Public (Line 285):
```typescript
<<<<
  private constructor(storageDir?: string) {
====
  public constructor(storageDir?: string) {
>>>>
```

##### 3. Update `migrateLegacyTplhDatabase` (Lines 412–450):
```typescript
<<<<
  public migrateLegacyTplhDatabase(targetStoreId: string = '108120'): { migrated: boolean; error?: string; bytes?: number } {
    try {
      const legacyPath = path.join(this.storageDir, 'tplh_forecast.db');
      const targetPath = this.computeDbFilePath(targetStoreId);

      // Trigger condition: legacy file exists, target uniform file does not exist
      if (!fs.existsSync(legacyPath) || fs.existsSync(targetPath)) {
        return { migrated: false };
      }

      console.log(`🔄 [F6 Migration] Rozpoczęcie automatycznej migracji bazy legacy: ${legacyPath} -> ${targetPath}`);

      const stat = fs.statSync(legacyPath);
      if (stat.size < 100) {
        console.warn('⚠️ [F6 Migration] Plik legacy ma rozmiar < 100 bajtów — pomijanie migracji uszkodzonego pliku.');
        return { migrated: false, error: 'Legacy file too small or corrupted' };
      }

      // Check SQLite binary header magic
      const fd = fs.openSync(legacyPath, 'r');
      const headerBuf = Buffer.alloc(16);
      fs.readSync(fd, headerBuf, 0, 16, 0);
      fs.closeSync(fd);

      if (!headerBuf.toString('utf8').startsWith('SQLite format 3')) {
        console.warn('⚠️ [F6 Migration] Plik legacy nie posiada poprawnego nagłówka SQLite format 3.');
        return { migrated: false, error: 'Invalid SQLite header' };
      }

      // 1. Safety backup of legacy database
      const backupDir = (typeof app !== 'undefined' && app && app.isPackaged)
        ? path.join(app.getPath('userData'), 'backups', 'db_backups')
        : path.join(process.cwd(), 'backups', 'db_backups');
====
  public migrateLegacyTplhDatabase(targetStoreId: string = '108120', customBackupDir?: string): { migrated: boolean; error?: string; bytes?: number } {
    try {
      const legacyPath = path.join(this.storageDir, 'tplh_forecast.db');
      const targetPath = this.computeDbFilePath(targetStoreId);

      // Trigger condition: legacy file exists, target uniform file does not exist
      if (!fs.existsSync(legacyPath) || fs.existsSync(targetPath)) {
        return { migrated: false };
      }

      console.log(`🔄 [F6 Migration] Rozpoczęcie automatycznej migracji bazy legacy: ${legacyPath} -> ${targetPath}`);

      const stat = fs.statSync(legacyPath);
      if (stat.size < 100) {
        console.warn('⚠️ [F6 Migration] Plik legacy ma rozmiar < 100 bajtów — pomijanie migracji uszkodzonego pliku.');
        return { migrated: false, error: 'Legacy file too small or corrupted' };
      }

      // Check SQLite binary header magic
      const fd = fs.openSync(legacyPath, 'r');
      const headerBuf = Buffer.alloc(16);
      fs.readSync(fd, headerBuf, 0, 16, 0);
      fs.closeSync(fd);

      if (!headerBuf.toString('utf8').startsWith('SQLite format 3')) {
        console.warn('⚠️ [F6 Migration] Plik legacy nie posiada poprawnego nagłówka SQLite format 3.');
        return { migrated: false, error: 'Invalid SQLite header' };
      }

      // 1. Safety backup of legacy database
      let backupDir = customBackupDir;
      if (!backupDir) {
        if (typeof app !== 'undefined' && app && app.isPackaged) {
          backupDir = path.join(app.getPath('userData'), 'backups', 'db_backups');
        } else if (this.storageDir && this.storageDir !== path.join(process.cwd(), 'data')) {
          backupDir = path.join(this.storageDir, 'backups', 'db_backups');
        } else {
          backupDir = path.join(process.cwd(), 'backups', 'db_backups');
        }
      }
>>>>
```

##### 4. Scope `backupDir` in Remaining Methods (Lines 1989, 2023, 2187, 2295):
Replace each instance of:
```typescript
const backupDir = (typeof app !== 'undefined' && app && app.isPackaged)
  ? path.join(app.getPath('userData'), 'backups', 'db_backups')
  : path.join(process.cwd(), 'backups', 'db_backups');
```
with:
```typescript
const backupDir = (typeof app !== 'undefined' && app && app.isPackaged)
  ? path.join(app.getPath('userData'), 'backups', 'db_backups')
  : (this.storageDir && this.storageDir !== path.join(process.cwd(), 'data')
    ? path.join(this.storageDir, 'backups', 'db_backups')
    : path.join(process.cwd(), 'backups', 'db_backups'));
```

---

#### Component B: `electron/database/backupManager.ts`

##### 1. Replace Line 5:
```typescript
<<<<
import { app } from 'electron';
====
// Safe dynamic resolution of electron app in both packaged Electron and standalone Node/tsx test runners
let app: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electronModule = typeof require === 'function' ? require('electron') : undefined;
  app = (typeof electronModule === 'object' && electronModule !== null && 'app' in electronModule)
    ? electronModule.app
    : undefined;
} catch {
  app = undefined;
}
>>>>
```

##### 2. Fix `validateRestoreTarget` (Lines 48–53):
```typescript
<<<<
export function validateRestoreTarget(backupFilename: string, targetStoreId: string): boolean {
  if (!backupFilename || !targetStoreId) return false;
  const match = backupFilename.match(/^store_([^_]+)_/);
  if (!match) return false;
  return match[1].toLowerCase() === targetStoreId.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
}
====
export function validateRestoreTarget(backupFilename: string, targetStoreId: string): boolean {
  if (!backupFilename || !targetStoreId) return false;
  const match = backupFilename.match(/^store_(.+?)_backup_/);
  if (!match) return false;
  return match[1].toLowerCase() === targetStoreId.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
}
>>>>
```

##### 3. Fix Regex in `listBackups` (Lines 180–184):
```typescript
<<<<
      } else if (file.startsWith('store_')) {
        const match = file.match(/^store_([^_]+)_/);
        if (match && match[1].toLowerCase() === safeActiveId) {
          belongsToStore = true;
          parsedStoreId = activeStoreId;
        }
      }
====
      } else if (file.startsWith('store_')) {
        const match = file.match(/^store_(.+?)_backup_/);
        if (match && match[1].toLowerCase() === safeActiveId) {
          belongsToStore = true;
          parsedStoreId = activeStoreId;
        }
      }
>>>>
```

##### 4. Fix `parseReasonFromFilename` (Lines 488–500):
```typescript
<<<<
  private parseReasonFromFilename(filename: string): string {
    const name = filename.replace('.db', '');
    const parts = name.split('_');
    if (name.startsWith('store_') && parts.length >= 6) {
      const raw = parts.slice(5).join(' ');
      return this.formatReason(raw);
    }
    if (name.startsWith('tplh_forecast_') && parts.length >= 4) {
      const raw = parts.slice(3).join('_');
      return this.formatReason(raw);
    }
    return 'ręczna';
  }
====
  private parseReasonFromFilename(filename: string): string {
    const storeMatch = filename.match(/^store_.+?_backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_\d{3}_(.+?)\.db$/);
    if (storeMatch) {
      return this.formatReason(storeMatch[1]);
    }
    const legacyMatch = filename.match(/^tplh_forecast_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_(.+?)\.db$/);
    if (legacyMatch) {
      return this.formatReason(legacyMatch[1]);
    }
    const name = filename.replace('.db', '');
    const parts = name.split('_');
    if (name.startsWith('store_') && parts.length >= 6) {
      const raw = parts.slice(5).join(' ');
      return this.formatReason(raw);
    }
    if (name.startsWith('tplh_forecast_') && parts.length >= 4) {
      const raw = parts.slice(3).join('_');
      return this.formatReason(raw);
    }
    return 'ręczna';
  }
>>>>
```

---

#### Component C: `electron/main.ts`

##### Add `persistAll()` to `before-quit` (Lines 1980–1983):
```typescript
<<<<
app.on('before-quit', () => {
  const dbManager = DatabaseManager.getInstance();
  dbManager.persist();
});
====
app.on('before-quit', () => {
  const dbManager = DatabaseManager.getInstance();
  dbManager.getConnectionPool().persistAll();
  dbManager.persist();
});
>>>>
```

---

#### Component D: `tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts`

##### 1. Verify Isolated Backup Placement in Suite 3 (Lines 270–280):
```typescript
<<<<
        assert.equal(targetSha256, legacySha256, 'Target SHA-256 must identically match legacy SHA-256');

        // Check migration receipt
        const receiptPath = path.join(tmpStorageDir, 'legacy_migration_receipt.json');
        assert.ok(fs.existsSync(receiptPath), 'Migration receipt JSON must be written');
        const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
        assert.equal(receipt.sha256, legacySha256);
        assert.equal(receipt.bytes, 1024);
====
        assert.equal(targetSha256, legacySha256, 'Target SHA-256 must identically match legacy SHA-256');

        // Check migration receipt
        const receiptPath = path.join(tmpStorageDir, 'legacy_migration_receipt.json');
        assert.ok(fs.existsSync(receiptPath), 'Migration receipt JSON must be written');
        const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
        assert.equal(receipt.sha256, legacySha256);
        assert.equal(receipt.bytes, 1024);

        // Verify safety backup was placed within isolated test storageDir hierarchy
        const testBackupDir = path.join(tmpStorageDir, 'backups', 'db_backups');
        assert.ok(fs.existsSync(testBackupDir), 'Safety backup directory must exist in test hierarchy');
        const backupFiles = fs.readdirSync(testBackupDir);
        assert.equal(backupFiles.length, 1, 'Exactly one safety backup file must be created');
        assert.ok(backupFiles[0].startsWith('legacy_tplh_migration_backup_'));
>>>>
```

##### 2. Add Underscore Store ID Tests in Suite 4 (Lines 305–310):
```typescript
<<<<
      await t.test('test_validateRestoreTarget_allows_matching_and_rejects_mismatch', () => {
        assert.equal(validateRestoreTarget('store_108150_backup_2026-10-24_manual.db', '108150'), true);
        assert.equal(validateRestoreTarget('store_108150_backup_2026-10-24_manual.db', '108120'), false);
        assert.equal(validateRestoreTarget('invalid_filename.db', '108150'), false);
        assert.equal(validateRestoreTarget('', '108150'), false);
      });
====
      await t.test('test_validateRestoreTarget_allows_matching_and_rejects_mismatch', () => {
        assert.equal(validateRestoreTarget('store_108150_backup_2026-10-24_manual.db', '108150'), true);
        assert.equal(validateRestoreTarget('store_108150_backup_2026-10-24_manual.db', '108120'), false);
        assert.equal(validateRestoreTarget('store_108120_janki_backup_2026-10-24_12-00-00_000_manual.db', '108120_janki'), true);
        assert.equal(validateRestoreTarget('store_108120_janki_backup_2026-10-24_12-00-00_000_manual.db', '108120'), false);
        assert.equal(validateRestoreTarget('store_wroclaw_glowny_backup_2026-10-24_12-00-00_000_manual.db', 'wroclaw_glowny'), true);
        assert.equal(validateRestoreTarget('invalid_filename.db', '108150'), false);
        assert.equal(validateRestoreTarget('', '108150'), false);
      });
>>>>
```

---

## 5. Verification Method

Once implemented by `m2_worker_2`, independently verify using the following commands:

1. **Verify Production Build with Zero Compiler Warnings/Errors**:
   ```bash
   npm run build
   ```
   *Expected Outcome*: Exit code `0`; `tsc` compiles with 0 errors; Vite produces `dist/` and `dist-electron/` bundles.

2. **Verify Full E2E Test Suite (All Tiers 1–5 Passing 100%)**:
   ```bash
   npx tsx --test "tests/e2e/**/*.test.ts"
   ```
   *Expected Outcome*: Exit code `0`; all 311+ tests execute and pass without loaders or flags.

3. **Verify Adversarial Challenge Tests Independently**:
   ```bash
   npx tsx --test tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts
   npx tsx --test tests/e2e/tier5-adversarial/m2_challenger_concurrency_stress.test.ts
   ```
   *Expected Outcome*: Exit code `0` on both test files.

4. **Verify Zero Test Backup Pollution in Project Workspace**:
   ```bash
   git status backups/db_backups/
   ```
   *Expected Outcome*: Clean; no untracked or modified files in `backups/db_backups/`.
