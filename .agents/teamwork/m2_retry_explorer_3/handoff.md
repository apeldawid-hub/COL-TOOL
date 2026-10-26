# Handoff Report — M2 Retry Explorer 3: `electron/main.ts` & `StoreConnectionPool` Shutdown Persistence

## 1. Observation

### 1.1 Current Application Exit Handlers in `electron/main.ts`
In `/Users/dawidapel/COL Tool/electron/main.ts:1972-1984`:
```ts
app.on('window-all-closed', () => {
  const dbManager = DatabaseManager.getInstance();
  dbManager.persist();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  const dbManager = DatabaseManager.getInstance();
  dbManager.persist();
});
```

In `/Users/dawidapel/COL Tool/electron/main.ts:15-37`:
```ts
process.on('uncaughtException', (error) => {
  CrashLogManager.getInstance().log('FATAL', 'ElectronMain:uncaughtException', error.message, error.stack);
  GitHubReporter.getInstance().submitIssue({
    category: 'FATAL_PROCESS',
    moduleName: 'ElectronMain',
    userDescription: `Krytyczny błąd procesu Electron: ${error.message}`,
    errorStack: error.stack,
    isAutomatic: true,
  }).catch(() => {});
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : undefined;
  CrashLogManager.getInstance().log('ERROR', 'ElectronMain:unhandledRejection', msg, stack);
  GitHubReporter.getInstance().submitIssue({
    category: 'UNHANDLED_REJECTION',
    moduleName: 'ElectronMain',
    userDescription: `Nieobsłużony Promise Rejection w procesie Electron: ${msg}`,
    errorStack: stack,
    isAutomatic: true,
  }).catch(() => {});
});
```

### 1.2 `DatabaseManager.persist()` Behavior in `electron/database/db.ts`
In `/Users/dawidapel/COL Tool/electron/database/db.ts:698-708`:
```ts
public persist(storeId?: string): void {
  const targetId = storeId || this.currentStoreId;
  if (targetId && this.pool.has(targetId)) {
    this.pool.persistStore(targetId);
    return;
  }
  if (!this.db || !this.dbFilePath) return;
  const data = this.db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(this.dbFilePath, buffer);
}
```
Observation: When called without parameters (`dbManager.persist()`), it resolves `targetId = this.currentStoreId`. If `targetId` is found in `this.pool`, it calls `this.pool.persistStore(targetId)` and returns immediately. If `targetId` is not in the pool, it writes `this.db` to `this.dbFilePath`.
**Crucial Observation**: `DatabaseManager.persist()` only flushes the currently active store (`this.currentStoreId`). Any other store cached in `StoreConnectionPool` is completely ignored.

### 1.3 `StoreConnectionPool` Implementation in `electron/database/db.ts`
In `/Users/dawidapel/COL Tool/electron/database/db.ts:148-203`:
```ts
public markDirty(storeId: string, debounceMs: number = 2000): void {
  const entry = this.pool.get(storeId);
  if (!entry) return;
  entry.isDirty = true;

  if (entry.debounceTimer) {
    clearTimeout(entry.debounceTimer);
  }

  entry.debounceTimer = setTimeout(() => {
    this.persistStore(storeId);
  }, debounceMs);
}

public persistStore(storeId: string): boolean {
  const entry = this.pool.get(storeId);
  if (!entry || !entry.db || !entry.filePath) return false;

  if (entry.debounceTimer) {
    clearTimeout(entry.debounceTimer);
    entry.debounceTimer = null;
  }

  try {
    const data = entry.db.export();
    fs.writeFileSync(entry.filePath, Buffer.from(data));
    entry.isDirty = false;
    return true;
  } catch (err) {
    console.error(`Błąd persystencji bazy dla kawiarni [${storeId}]:`, err);
    return false;
  }
}

public persistAll(): void {
  for (const [storeId, entry] of this.pool.entries()) {
    if (entry.isDirty) {
      this.persistStore(storeId);
    }
  }
}

public closeAll(): void {
  this.persistAll();
  for (const [, entry] of this.pool.entries()) {
    try {
      entry.db.close();
    } catch (_) {}
  }
  this.pool.clear();
}
```
Observation:
1. `persistStore(storeId)`:
   - Clears any pending `debounceTimer` (`clearTimeout(entry.debounceTimer); entry.debounceTimer = null;`).
   - Exports the SQLite in-memory database synchronously via `entry.db.export()`.
   - Writes binary data to disk synchronously via `fs.writeFileSync(entry.filePath, Buffer.from(data))`.
   - Resets `entry.isDirty = false`.
2. `persistAll()`:
   - Synchronously iterates over all entries in `this.pool`.
   - For every entry where `entry.isDirty === true`, it invokes `this.persistStore(storeId)`.
   - Executes entirely synchronously and blocks until all dirty stores are written to disk.
3. `closeAll()`:
   - First invokes `this.persistAll()` (synchronously flushing dirty entries).
   - Then closes all SQLite Database handles (`entry.db.close()`).
   - Clears `this.pool.clear()`.
4. `getConnectionPool()`:
   - Exposed as a public method on `DatabaseManager` at `electron/database/db.ts:322`:
     ```ts
     public getConnectionPool(): StoreConnectionPool {
       return this.pool;
     }
     ```

### 1.4 Test Suite Verification
In `tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts:99-130`:
The test `test_lru_pool_persist_all_flushes_only_dirty_stores` explicitly tests `pool.persistAll()`, verifying that all dirty stores in the pool are exported and written to disk, while clean stores are skipped.

---

## 2. Logic Chain

1. **The Multi-Store Dirty Write Loss Scenario**:
   - In a multi-store environment with up to 8 connections in `StoreConnectionPool`, a background store (Store A) can be modified in memory and marked dirty with `pool.markDirty('store_a', 2000)`.
   - While the 2000ms debounce timer is running, the user switches to Store B or issues a quit command.
   - When the user quits the application, Electron emits `app.on('before-quit')`.
   - Currently, `main.ts:1981` runs:
     ```ts
     const dbManager = DatabaseManager.getInstance();
     dbManager.persist();
     ```
   - `dbManager.persist()` resolves to Store B (`this.currentStoreId`), flushing only Store B.
   - The Electron main process exits immediately after the event loop drains, terminating the process before Store A's 2000ms timer can fire.
   - Result: All in-memory dirty writes belonging to Store A (and any other non-active pooled stores) are discarded without being written to disk.

2. **Synchronous Behavior of `persistAll()`**:
   - `StoreConnectionPool.persistAll()` executes `persistStore()` for every dirty entry in `this.pool`.
   - `persistStore()` calls Node's `fs.writeFileSync(entry.filePath, Buffer.from(data))`, which blocks until the OS file system write finishes.
   - It also cancels any running `debounceTimer`, preventing dangling callbacks.
   - Therefore, `persistAll()` is fully synchronous and guaranteed to complete before returning.

3. **Relationship between `persistAll()`, `dbManager.persist()`, and `closeAll()`**:
   - Calling `dbManager.getConnectionPool().persistAll()` flushes all dirty pooled connections.
   - Calling `dbManager.persist()` right after provides defense-in-depth: if `this.currentStoreId` was modified directly without being flagged dirty via `markDirty()`, or if the active database is in a clean-launch state not yet registered in `this.pool`, `dbManager.persist()` guarantees it is flushed.
   - **Should `closeAll()` be called in `before-quit`?**
     - **NO**: Electron emits `before-quit` *before* windows are closed. If `closeAll()` is called in `before-quit`, it calls `entry.db.close()` and `this.pool.clear()`. If a renderer or window has an `onbeforeunload` or `window.on('close')` event that sends an IPC database query, the query will fail with `Error: Database is closed`. Furthermore, if `event.preventDefault()` is called on `before-quit` to cancel quitting, calling `closeAll()` would leave the running app with all database connections destroyed.
     - **WHERE `closeAll()` belongs**: In `app.on('will-quit')`! At `will-quit`, all browser windows have already closed and destroyed. No more IPC calls can arrive. Calling `closeAll()` in `will-quit` safely flushes any last-minute writes, closes SQLite handles, and deallocates WebAssembly memory before the OS process exits.

4. **Other Exit Handlers & Edge Cases**:
   - **`app.on('window-all-closed')`**:
     - On macOS (`darwin`), closing all windows does not quit the application. The app remains idle in the Dock.
     - If the user closes the window, dirty writes should be flushed immediately via `persistAll()` and `persist()`, so that data is preserved if the laptop sleeps or the OS kills background processes.
     - However, database connections must NOT be closed (`closeAll()` must not be called), so that clicking the Dock icon (`app.on('activate')`) can recreate the window and immediately query the database without reload overhead.
     - On Windows and Linux (`platform !== 'darwin'`), `window-all-closed` calls `app.quit()`, which then triggers `before-quit` and `will-quit`.
   - **Process Termination Signals (`SIGINT`, `SIGTERM`)**:
     - In terminal development (`npm run dev`) or containerized deployments, pressing `Ctrl+C` sends `SIGINT`, and process managers send `SIGTERM`.
     - Node.js by default aborts immediately upon receiving `SIGINT`/`SIGTERM` without emitting Electron's `before-quit` or `will-quit` events.
     - Registering `process.on('SIGINT')` and `process.on('SIGTERM')` ensures dirty writes are flushed and `app.quit()` is invoked.
   - **`process.on('uncaughtException')`**:
     - In `main.ts:15-24`, if an unexpected fatal exception occurs, attempting an emergency synchronous flush (`persistAll()` + `persist()`) before reporting the crash ensures that unsaved in-memory transactions are preserved on disk.

---

## 3. Caveats

1. **WebAssembly Memory Deallocation**:
   In `sql.js`, SQLite databases reside entirely in WebAssembly linear memory (`Uint8Array`). There are no operating system file locks or open OS file descriptors held open by `sql.js`. The operating system reclaims all process memory immediately upon process exit. Thus, calling `persistAll()` is the critical requirement for data durability; `entry.db.close()` is good hygiene for deallocating WebAssembly heap before final exit.
2. **Re-entrant Signal Handlers**:
   If multiple termination signals are delivered rapidly (e.g. repeated `Ctrl+C`), signal handlers should use an `isTerminating` boolean flag to prevent re-entrant shutdown execution.
3. No other caveats.

---

## 4. Conclusion & Complete Code Blueprint

### Summary of Solution
1. Introduce a helper function `flushAllStoreDatabases(reason)` in `electron/main.ts` that:
   - Calls `DatabaseManager.getInstance().getConnectionPool().persistAll()` (synchronously writes all dirty pooled store databases and clears debounce timers).
   - Calls `DatabaseManager.getInstance().persist()` (synchronously writes the active store database).
2. Wire `flushAllStoreDatabases('window-all-closed')` into `app.on('window-all-closed')`.
3. Wire `flushAllStoreDatabases('before-quit')` into `app.on('before-quit')`.
4. Add `app.on('will-quit')` which calls `DatabaseManager.getInstance().getConnectionPool().closeAll()` when all windows are closed and quit is irreversible.
5. Add signal handlers for `SIGINT` and `SIGTERM` to perform graceful shutdown on terminal termination.
6. Add emergency persistence to `process.on('uncaughtException')`.

---

### Copy-Pasteable Code Blueprint for `electron/main.ts`

#### Edit 1: Emergency persistence in `uncaughtException` (Lines 14-25)

**Target Location**: `electron/main.ts:14-25`

**Before**:
```ts
// Rejestracja globalnego łapania awarii w procesie głównym Electron
process.on('uncaughtException', (error) => {
  CrashLogManager.getInstance().log('FATAL', 'ElectronMain:uncaughtException', error.message, error.stack);
  GitHubReporter.getInstance().submitIssue({
    category: 'FATAL_PROCESS',
    moduleName: 'ElectronMain',
    userDescription: `Krytyczny błąd procesu Electron: ${error.message}`,
    errorStack: error.stack,
    isAutomatic: true,
  }).catch(() => {});
});
```

**After**:
```ts
// Rejestracja globalnego łapania awarii w procesie głównym Electron
process.on('uncaughtException', (error) => {
  try {
    const dbManager = DatabaseManager.getInstance();
    dbManager.getConnectionPool().persistAll();
    dbManager.persist();
  } catch (_) {}
  CrashLogManager.getInstance().log('FATAL', 'ElectronMain:uncaughtException', error.message, error.stack);
  GitHubReporter.getInstance().submitIssue({
    category: 'FATAL_PROCESS',
    moduleName: 'ElectronMain',
    userDescription: `Krytyczny błąd procesu Electron: ${error.message}`,
    errorStack: error.stack,
    isAutomatic: true,
  }).catch(() => {});
});
```

---

#### Edit 2: Graceful Shutdown & Exit Handlers (Lines 1971-1984)

**Target Location**: `electron/main.ts:1971-1984`

**Before**:
```ts
app.on('window-all-closed', () => {
  const dbManager = DatabaseManager.getInstance();
  dbManager.persist();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  const dbManager = DatabaseManager.getInstance();
  dbManager.persist();
});
```

**After**:
```ts
/**
 * Synchronous dirty write persistence helper for graceful shutdown.
 * Flushes all pooled store connections with pending dirty writes and the active store.
 */
function flushAllStoreDatabases(reason: string = 'shutdown'): void {
  try {
    const dbManager = DatabaseManager.getInstance();
    // 1. Flush all pooled store connections with pending dirty writes (synchronous)
    dbManager.getConnectionPool().persistAll();
    // 2. Flush active store database (failsafe for unpooled or unflagged instances)
    dbManager.persist();
    console.log(`💾 [Shutdown] Wszystkie aktywne i buforowane bazy danych zapisane na dysk (${reason}).`);
  } catch (err) {
    console.error(`❌ [Shutdown] Błąd zapisu baz danych (${reason}):`, err);
  }
}

app.on('window-all-closed', () => {
  flushAllStoreDatabases('window-all-closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  flushAllStoreDatabases('before-quit');
});

app.on('will-quit', () => {
  try {
    const dbManager = DatabaseManager.getInstance();
    // Final flush and clean closure of SQLite handles when all windows have closed
    dbManager.getConnectionPool().closeAll();
    console.log('🔒 [Shutdown] Połączenia bazy SQLite zostały bezpiecznie zamknięte (will-quit).');
  } catch (err) {
    console.error('❌ [Shutdown] Błąd zamykania połączeń (will-quit):', err);
  }
});

// Obsługa sygnałów przerwania procesu (terminal / CLI / Docker / SIGTERM / SIGINT)
let isTerminating = false;
const handleProcessTermination = (signal: string) => {
  if (isTerminating) return;
  isTerminating = true;
  console.log(`🛑 [ElectronMain] Odebrano sygnał ${signal} — bezpieczne zatrzymywanie...`);
  flushAllStoreDatabases(signal);
  try {
    DatabaseManager.getInstance().getConnectionPool().closeAll();
  } catch (_) {}
  app.quit();
};

process.on('SIGINT', () => handleProcessTermination('SIGINT'));
process.on('SIGTERM', () => handleProcessTermination('SIGTERM'));
```

---

### Unified Diff for `electron/main.ts`

```diff
--- a/electron/main.ts
+++ b/electron/main.ts
@@ -15,6 +15,11 @@
 process.on('uncaughtException', (error) => {
+  try {
+    const dbManager = DatabaseManager.getInstance();
+    dbManager.getConnectionPool().persistAll();
+    dbManager.persist();
+  } catch (_) {}
   CrashLogManager.getInstance().log('FATAL', 'ElectronMain:uncaughtException', error.message, error.stack);
   GitHubReporter.getInstance().submitIssue({
     category: 'FATAL_PROCESS',
@@ -1972,13 +1977,48 @@
-app.on('window-all-closed', () => {
-  const dbManager = DatabaseManager.getInstance();
-  dbManager.persist();
-  if (process.platform !== 'darwin') {
-    app.quit();
-  }
-});
-
-app.on('before-quit', () => {
-  const dbManager = DatabaseManager.getInstance();
-  dbManager.persist();
-});
+/**
+ * Synchronous dirty write persistence helper for graceful shutdown.
+ * Flushes all pooled store connections with pending dirty writes and the active store.
+ */
+function flushAllStoreDatabases(reason: string = 'shutdown'): void {
+  try {
+    const dbManager = DatabaseManager.getInstance();
+    // 1. Flush all pooled store connections with pending dirty writes (synchronous)
+    dbManager.getConnectionPool().persistAll();
+    // 2. Flush active store database (failsafe for unpooled or unflagged instances)
+    dbManager.persist();
+    console.log(`💾 [Shutdown] Wszystkie aktywne i buforowane bazy danych zapisane na dysk (${reason}).`);
+  } catch (err) {
+    console.error(`❌ [Shutdown] Błąd zapisu baz danych (${reason}):`, err);
+  }
+}
+
+app.on('window-all-closed', () => {
+  flushAllStoreDatabases('window-all-closed');
+  if (process.platform !== 'darwin') {
+    app.quit();
+  }
+});
+
+app.on('before-quit', () => {
+  flushAllStoreDatabases('before-quit');
+});
+
+app.on('will-quit', () => {
+  try {
+    const dbManager = DatabaseManager.getInstance();
+    // Final flush and clean closure of SQLite handles when all windows have closed
+    dbManager.getConnectionPool().closeAll();
+    console.log('🔒 [Shutdown] Połączenia bazy SQLite zostały bezpiecznie zamknięte (will-quit).');
+  } catch (err) {
+    console.error('❌ [Shutdown] Błąd zamykania połączeń (will-quit):', err);
+  }
+});
+
+// Obsługa sygnałów przerwania procesu (terminal / CLI / Docker / SIGTERM / SIGINT)
+let isTerminating = false;
+const handleProcessTermination = (signal: string) => {
+  if (isTerminating) return;
+  isTerminating = true;
+  console.log(`🛑 [ElectronMain] Odebrano sygnał ${signal} — bezpieczne zatrzymywanie...`);
+  flushAllStoreDatabases(signal);
+  try {
+    DatabaseManager.getInstance().getConnectionPool().closeAll();
+  } catch (_) {}
+  app.quit();
+};
+
+process.on('SIGINT', () => handleProcessTermination('SIGINT'));
+process.on('SIGTERM', () => handleProcessTermination('SIGTERM'));
```

---

## 5. Verification Method

### 5.1 Verification Test Case
To verify that multi-store dirty writes are completely preserved upon shutdown:
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import initSqlJs from 'sql.js';
import { StoreConnectionPool } from '../../../electron/database/db';

test('Verify persistAll flushes background dirty store without waiting for 2000ms debounce', async () => {
  const SQL = await initSqlJs();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_shutdown_test_'));

  try {
    const pool = new StoreConnectionPool(8);
    const store1Path = path.join(tmpDir, 'store_108120.db');
    const store2Path = path.join(tmpDir, 'store_108150.db');

    const db1 = new SQL.Database();
    db1.run('CREATE TABLE t (k TEXT, v TEXT); INSERT INTO t VALUES ("k1", "v1");');
    fs.writeFileSync(store1Path, Buffer.from(db1.export()));
    pool.put('108120', db1, store1Path, false);

    const db2 = new SQL.Database();
    db2.run('CREATE TABLE t (k TEXT, v TEXT); INSERT INTO t VALUES ("k2", "v2");');
    fs.writeFileSync(store2Path, Buffer.from(db2.export()));
    pool.put('108150', db2, store2Path, false);

    // Mutate store 108150 and mark dirty with 2000ms debounce timer
    db2.run('INSERT INTO t VALUES ("k2_dirty", "v2_dirty");');
    pool.markDirty('108150', 2000);

    const entry2 = pool.getEntry('108150')!;
    assert.equal(entry2.isDirty, true);
    assert.ok(entry2.debounceTimer);

    // Simulate app shutdown before 2000ms timer fires:
    pool.persistAll();

    // Verify debounce timer was canceled and dirty flag cleared
    assert.equal(entry2.isDirty, false);
    assert.equal(entry2.debounceTimer, null);

    // Verify disk file contains dirty transaction immediately
    const diskBuf = fs.readFileSync(store2Path);
    const checkDb = new SQL.Database(diskBuf);
    const res = checkDb.exec('SELECT v FROM t WHERE k = "k2_dirty";');
    assert.equal(res[0].values[0][0], 'v2_dirty');
    checkDb.close();

    pool.closeAll();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
```

### 5.2 Build Command Verification
After applying the blueprint, run:
```bash
npm run build
```
Expected result: Exit code 0, 0 TypeScript errors, Vite bundles `dist-electron/main.js` cleanly.

### 5.3 Invalidation Conditions
The blueprint would be invalidated if:
1. `persistAll()` was asynchronous (it is proven synchronous via `fs.writeFileSync`).
2. Calling `closeAll()` in `before-quit` was attempted (it causes errors during window close and prevents cancellation).
3. `dbManager.persist()` was omitted (it acts as a necessary failsafe for unpooled or unflagged instances).
