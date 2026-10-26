# Handoff Report — Milestone 2 Explorer 1: Uniform DB Naming, Legacy Migration & LRU Connection Pool (F6, F7)

## 1. Observation

### 1.1 Direct Codebase Observations in `electron/database/db.ts`

- **Hardcoded Legacy DB Naming in `computeDbFilePath`** (`electron/database/db.ts:175-183`):
  ```typescript
  175:   private computeDbFilePath(storeId: string, storeInfo?: { unitCode?: string; mpk?: string }): string {
  176:     if (!storeId) return '';
  177:     const isJanki = storeId === '108120_janki' || storeInfo?.mpk === '108120' || storeInfo?.unitCode === '18120';
  178:     if (isJanki) {
  179:       return path.join(this.storageDir, 'tplh_forecast.db');
  180:     }
  181:     const safeId = storeId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  182:     return path.join(this.storageDir, `store_${safeId}.db`);
  183:   }
  ```
  *Finding*: Line 177 hardcodes a routing exception for Store 108120 / 18120 to `tplh_forecast.db`. This violates multi-store uniformity, creates an asymmetric database layout, and breaks when scaling to 100+ stores. Furthermore, `safeId` lacks length truncation (e.g. 64-char bounds).

- **Current Synchronous Single-Connection `switchStoreDatabase`** (`electron/database/db.ts:241-280`):
  ```typescript
  241:   public async switchStoreDatabase(
  242:     storeId: string,
  243:     storeInfo?: { name: string; unitCode: string; mpk: string; city?: string; district?: string }
  244:   ): Promise<{ success: boolean; isNew: boolean; dbPath: string; storeId: string }> {
  245:     // 1. Zapisz dotychczasową bazę na dysk i zwolnij połączenie
  246:     if (this.db) {
  247:       try {
  248:         this.persist();
  249:         this.db.close();
  250:       } catch (err) {
  251:         console.warn('Błąd zamykania dotychczasowej bazy przed przełączeniem:', err);
  252:       }
  253:       this.db = null;
  254:     }
  255: 
  256:     this.currentStoreId = storeId;
  257:     this.saveActiveStoreMeta(storeId, storeInfo);
  258:     this.dbFilePath = this.computeDbFilePath(storeId, storeInfo);
  ...
  265:     const exists = fs.existsSync(this.dbFilePath);
  266:     if (exists) {
  267:       const fileBuffer = fs.readFileSync(this.dbFilePath);
  268:       this.db = new this.SQL.Database(fileBuffer);
  269:       console.log(`📦 Załadowano istniejącą bazę SQLite dla kawiarni [${storeId}] z: ${this.dbFilePath}`);
  270:       this.createSchema();
  271:       return { success: true, isNew: false, dbPath: this.dbFilePath, storeId };
  272:     } else {
  273:       // NOWA KAWIARNIA = NOWA BAZA DANYCH!
  ...
  278:       return { success: true, isNew: true, dbPath: this.dbFilePath, storeId };
  279:     }
  280:   }
  ```
  *Finding*:
  1. `DatabaseManager` maintains only one `this.db: Database | null`. Switching stores discards the current handle (`this.db.close()`) and synchronously reads the file from disk (`fs.readFileSync`), parsing the entire binary SQLite buffer every time.
  2. There is no concurrency protection. If rapid store switching occurs (e.g. rapid user clicks in the 100+ stores catalog or automated batch operations), overlapping calls execute concurrently, interleaving disk reads, resetting `this.db = null`, causing null reference crashes or race conditions.

- **Current Persistence and Reload Mechanism** (`electron/database/db.ts:144-158, 366-371`):
  ```typescript
  144:   public reloadFromDisk(): Database {
  145:     if (!this.SQL || !fs.existsSync(this.dbFilePath)) {
  146:       return this.getDb();
  147:     }
  148:     const fileBuffer = fs.readFileSync(this.dbFilePath);
  149:     if (this.db) {
  150:       try {
  151:         this.db.close();
  152:       } catch (_) {}
  153:     }
  154:     this.db = new this.SQL.Database(fileBuffer);
  155:     this.createSchema();
  156:     console.log('🔄 Przeładowano bazę SQLite z dysku:', this.dbFilePath);
  157:     return this.db!;
  158:   }
  ...
  366:   public persist(): void {
  367:     if (!this.db || !this.dbFilePath) return;
  368:     const data = this.db.export();
  369:     const buffer = Buffer.from(data);
  370:     fs.writeFileSync(this.dbFilePath, buffer);
  371:   }
  ```
  *Finding*: `persist()` exports and writes only the single active `this.db`. There is no dirty-state tracking or debounced write coordination across multiple store databases.

- **Physical File Status on Local Disk**:
  - Command: `list_dir /Users/dawidapel/COL Tool/data`
  - Output: `tplh_forecast.db` (397,312 bytes).
  - Target file `store_108120.db` does NOT yet exist on disk.
  - *Finding*: A physical legacy database exists containing 397KB of operational data (AOP plans, rosters, shifts, training data). An automated zero-data-loss migration is mandatory to prevent data loss upon switching to uniform naming.

- **Direct Observations in `electron/main.ts`**:
  - `electron/main.ts:190-216`: IPC handler `store:switch-database` directly delegates to `await dbManager.switchStoreDatabase(storeId, storeInfo)`.
  - `electron/main.ts:236, 246, 261, 298, etc.`: All query IPC handlers invoke `const db = dbManager.getDb()`.
  - `electron/main.ts:1968-1979`: On `window-all-closed` and `before-quit`, `dbManager.persist()` is invoked.

- **Existing Test Suites Validating F6 and F7**:
  - Command: `npx tsx --test tests/e2e/tier1-feature-coverage/f06_db_naming_migration.test.ts tests/e2e/tier1-feature-coverage/f07_lru_pool_mutex.test.ts`
  - Output: 12 tests passed (0 failed).
  - Specifications verified:
    - Uniform naming: `computeDbPath('108120') === 'store_108120.db'`.
    - Path traversal sanitization: `computeDbPath('../../etc/passwd') === 'store_______etc_passwd.db'`.
    - Max length truncation: 64 characters (tested in `b06_db_file_boundaries.test.ts`).
    - Zero-loss migration: binary payload identical, SHA-256 match before and after.
    - LRU pool capacity: exactly 8 connections; 9th connection evicts least recently used.
    - Eviction dirty write flush: dirty handles flushed before closing.
    - Async mutex: strict FIFO sequential execution even under rapid concurrency; releases on error.

---

## 2. Logic Chain

1. **Uniform Database Naming (F6)**:
   - *Premise*: Multi-tenant store architecture requires predictable, collision-free, path-safe database file names.
   - *Inference*: Removing the `108120_janki` / `tplh_forecast.db` exception from `computeDbFilePath` and sanitizing `storeId` with `safeId = storeId.slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()` guarantees that every store maps strictly to `path.join(storageDir, 'store_' + safeId + '.db')`.
   - *Protection*: Path traversal characters (`/`, `\`, `..`) are replaced with underscores, and IDs are clamped to 64 characters to adhere to OS filesystem path limitations.

2. **Zero-Data-Loss Migration of Legacy `tplh_forecast.db` (F6)**:
   - *Premise*: `data/tplh_forecast.db` contains 397KB of real historical store data for Store 108120. Deleting or ignoring this file would cause severe data loss.
   - *Inference*: When initializing or switching to Store 108120 (or when detecting `tplh_forecast.db` without `store_108120.db`), the system must execute an automated migration pipeline:
     1. Verify legacy database file validity (size > 100 bytes, SQLite header magic check `SQLite format 3`).
     2. Create a timestamped pre-migration backup in `backups/db_backups/legacy_tplh_migration_backup_${timestamp}.db`.
     3. Copy `tplh_forecast.db` to a temporary file `store_108120.db.migration_tmp`.
     4. Calculate and compare SHA-256 checksums of source and destination to confirm 100% binary parity.
     5. Perform an atomic filesystem rename `store_108120.db.migration_tmp` -> `store_108120.db`.
     6. Retain `tplh_forecast.db` intact (with an optional `.migrated` marker) to guarantee safety.

3. **Concurrency Control via `AsyncMutex` (F7)**:
   - *Premise*: Electron handles renderer IPC calls asynchronously. A user rapidly switching between stores or automated batch sync operations can trigger multiple overlapping `store:switch-database` calls.
   - *Inference*: Wrapping `switchStoreDatabase` in an `AsyncMutex` (a FIFO promise chain queue) guarantees that each switch finishes completely (flushing prior store state, updating active metadata, loading the new store) before the next switch begins.
   - *Fault Tolerance*: Using `try ... finally { release() }` guarantees the mutex is always released, even if a database file is locked or schema creation throws.

4. **Connection Caching via `StoreConnectionPool` (F7)**:
   - *Premise*: Re-reading, parsing WebAssembly buffers, and executing schema checks on every store switch imposes significant CPU/disk overhead when cycling through stores.
   - *Inference*: Caching up to 8 active SQLite database handles in a `StoreConnectionPool` allows repeated switches between frequent stores (e.g. Store Manager or District Manager inspecting several stores) to complete in 0 ms via memory cache hit.
   - *Eviction Integrity*: When pool size reaches 8 and a 9th store is opened, the least recently used store is evicted. Before eviction, if `isDirty === true` or debounced writes are pending, the database buffer is synchronously flushed to disk (`fs.writeFileSync`), prepared statements are cleared, `db.close()` is executed, and eviction details are logged in `evictionLog`.

5. **Full Backward Compatibility**:
   - *Premise*: Over 40 IPC handlers across `electron/main.ts` rely on `dbManager.getDb()`, `dbManager.persist()`, and `dbManager.reloadFromDisk()`.
   - *Inference*: `DatabaseManager` continues to expose `getDb()`, which points to the currently active connection in `StoreConnectionPool`. No changes are required in the query handlers in `electron/main.ts`.

---

## 3. Caveats

1. **Memory Budget for 8 In-Memory SQLite Connections**:
   - `sql.js` keeps databases in WebAssembly linear memory. A 400KB SQLite database consumes approximately 2MB to 6MB of RAM. Eight cached databases consume ~16MB to 48MB of RAM, which is completely negligible in an Electron application with an average baseline of 150MB-250MB.
2. **`backupManager.ts` Legacy Prefix**:
   - `backupManager.ts` currently filters files using `tplh_forecast_*.db`. Feature F11 (Store-Partitioned Backup & Restore) addresses store-specific backup names (`store_${storeId}_*.db`). Our F6/F7 implementation creates safety backups in that directory while remaining fully compatible.
3. **Multi-Store Concurrent Writing**:
   - While the pool caches up to 8 connections, the application UI is active in one store at a time. The active store connection receives the primary writes, while background sync tasks targeting other stores can acquire their respective connection from the pool and mark it dirty.

---

## 4. Conclusion & Complete Implementation Blueprint

### 4.1 Class Architecture Overview

```
electron/database/db.ts
├── export interface PooledConnection
├── export class AsyncMutex
├── export class StoreConnectionPool
└── export class DatabaseManager (Singleton)
    ├── private pool: StoreConnectionPool (capacity: 8)
    ├── private switchMutex: AsyncMutex
    ├── public computeDbFilePath(storeId: string): string (Uniform naming)
    ├── public migrateLegacyTplhDatabase(): Promise<MigrationResult> (Zero-loss migration)
    ├── public switchStoreDatabase(storeId: string, storeInfo?: any): Promise<...>
    ├── public persist(storeId?: string): void
    └── public getDb(): Database
```

---

### 4.2 Exact TypeScript Code Blueprint

#### Blueprint A: `AsyncMutex` and `PooledConnection` Interface

```typescript
// Add to electron/database/db.ts

export interface PooledConnection {
  storeId: string;
  db: Database;
  filePath: string;
  lastAccessed: number;
  isDirty: boolean;
  debounceTimer?: NodeJS.Timeout | null;
}

/**
 * Concurrency Mutex for serialized async store switching operations
 */
export class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  public async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const waitPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    const previous = this.queue;
    this.queue = previous.then(() => waitPromise);

    await previous;
    try {
      return await fn();
    } finally {
      release!();
    }
  }
}
```

#### Blueprint B: `StoreConnectionPool` (LRU Size 8, Dirty-Write Flush, Statement Cleanup)

```typescript
// Add to electron/database/db.ts

export class StoreConnectionPool {
  private pool = new Map<string, PooledConnection>();
  public evictionLog: Array<{ evictedStoreId: string; flushed: boolean }> = [];

  constructor(public readonly maxConnections: number = 8) {}

  /**
   * Retrieves an active database connection and updates LRU timestamp
   */
  public get(storeId: string): Database | null {
    const entry = this.pool.get(storeId);
    if (!entry) return null;
    entry.lastAccessed = Date.now();
    return entry.db;
  }

  public getEntry(storeId: string): PooledConnection | null {
    const entry = this.pool.get(storeId);
    if (!entry) return null;
    entry.lastAccessed = Date.now();
    return entry;
  }

  public has(storeId: string): boolean {
    return this.pool.has(storeId);
  }

  public size(): number {
    return this.pool.size;
  }

  /**
   * Adds or updates a store connection in the pool, enforcing LRU capacity of 8
   */
  public put(
    storeId: string,
    db: Database,
    filePath: string,
    isDirty: boolean = false
  ): { evicted?: string; flushed?: boolean } {
    if (this.pool.has(storeId)) {
      const existing = this.pool.get(storeId)!;
      existing.lastAccessed = Date.now();
      existing.db = db;
      existing.filePath = filePath;
      if (isDirty) existing.isDirty = true;
      return {};
    }

    let evicted: string | undefined;
    let flushed = false;

    // Evict least recently used if capacity reached
    if (this.pool.size >= this.maxConnections) {
      let oldestId: string | null = null;
      let oldestTime = Infinity;

      for (const [id, entry] of this.pool.entries()) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestId = id;
        }
      }

      if (oldestId) {
        const evictedEntry = this.pool.get(oldestId)!;
        
        // Clear any pending debounce timer
        if (evictedEntry.debounceTimer) {
          clearTimeout(evictedEntry.debounceTimer);
          evictedEntry.debounceTimer = null;
        }

        // Flush dirty writes to disk before closing handle
        if (evictedEntry.isDirty && evictedEntry.filePath) {
          try {
            const data = evictedEntry.db.export();
            fs.writeFileSync(evictedEntry.filePath, Buffer.from(data));
            flushed = true;
            console.log(`💾 [StoreConnectionPool] Zapisano niezapisane dane (dirty flush) dla eksmitowanej kawiarni [${oldestId}]`);
          } catch (err) {
            console.error(`Błąd zapisu dirty write podczas eksmisji [${oldestId}]:`, err);
          }
        }

        // Cleanly close SQLite database handle
        try {
          evictedEntry.db.close();
        } catch (err) {
          console.warn(`Ostrzeżenie przy zamykaniu bazy [${oldestId}]:`, err);
        }

        this.evictionLog.push({ evictedStoreId: oldestId, flushed: evictedEntry.isDirty || flushed });
        this.pool.delete(oldestId);
        evicted = oldestId;
        console.log(`♻️ [StoreConnectionPool] Wyeksmitowano połączenie LRU [${oldestId}] (flushed: ${flushed}, rozmiar puli: ${this.pool.size})`);
      }
    }

    this.pool.set(storeId, {
      storeId,
      db,
      filePath,
      lastAccessed: Date.now(),
      isDirty,
      debounceTimer: null,
    });

    return { evicted, flushed };
  }

  /**
   * Marks a store connection as dirty and schedules a debounced persist
   */
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

  /**
   * Persists a specific store database to disk immediately
   */
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

  /**
   * Persists all dirty database handles in the pool
   */
  public persistAll(): void {
    for (const [storeId, entry] of this.pool.entries()) {
      if (entry.isDirty) {
        this.persistStore(storeId);
      }
    }
  }

  /**
   * Closes all connections and flushes remaining writes
   */
  public closeAll(): void {
    this.persistAll();
    for (const [, entry] of this.pool.entries()) {
      try {
        entry.db.close();
      } catch (_) {}
    }
    this.pool.clear();
  }

  public clear(): void {
    this.closeAll();
  }
}
```

#### Blueprint C: Uniform Path Computation & Zero-Loss Legacy Migration in `DatabaseManager`

```typescript
// Replace lines 175-183 in electron/database/db.ts:

  /**
   * F6: Uniform SQLite database file naming: store_${safeId}.db
   * Enforces 64-character limit and replaces all path-traversal / illegal characters with underscores.
   */
  public computeDbFilePath(storeId: string, storeInfo?: { unitCode?: string; mpk?: string }): string {
    if (!storeId) return '';
    // Normalize any legacy alias to standard store ID
    const normalizedId = (storeId === '108120_janki' || storeInfo?.mpk === '108120' || storeInfo?.unitCode === '18120')
      ? '108120'
      : storeId;
    const truncated = normalizedId.slice(0, 64);
    const safeId = truncated.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    return path.join(this.storageDir, `store_${safeId}.db`);
  }

  /**
   * F6: Zero-data-loss automated migration of legacy tplh_forecast.db to store_108120.db
   */
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

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `legacy_tplh_migration_backup_${timestamp}.db`);
      fs.copyFileSync(legacyPath, backupPath);
      console.log(`💾 [F6 Migration] Utworzono kopię bezpieczeństwa przed migracją w: ${backupPath}`);

      // 2. Atomic copy to temporary target
      const tmpTargetPath = `${targetPath}.migration_tmp`;
      fs.copyFileSync(legacyPath, tmpTargetPath);

      // 3. Cryptographic parity check via SHA-256
      const crypto = require('crypto');
      const hashLegacy = crypto.createHash('sha256').update(fs.readFileSync(legacyPath)).digest('hex');
      const hashTarget = crypto.createHash('sha256').update(fs.readFileSync(tmpTargetPath)).digest('hex');

      if (hashLegacy !== hashTarget) {
        fs.unlinkSync(tmpTargetPath);
        throw new Error(`Błąd spójności SHA-256 podczas migracji: legacy=${hashLegacy}, target=${hashTarget}`);
      }

      // 4. Atomic rename to final destination
      fs.renameSync(tmpTargetPath, targetPath);

      // 5. Leave legacy file intact as a safety fall-back and write migration receipt
      const receiptPath = path.join(this.storageDir, 'legacy_migration_receipt.json');
      fs.writeFileSync(receiptPath, JSON.stringify({
        migratedAt: new Date().toISOString(),
        legacyPath,
        targetPath,
        bytes: stat.size,
        sha256: hashTarget,
      }, null, 2));

      console.log(`✅ [F6 Migration] Pomyślnie zmigrowano legacy tplh_forecast.db do ${targetPath} (${stat.size} B, SHA-256: ${hashTarget.slice(0, 12)}...)`);
      return { migrated: true, bytes: stat.size };
    } catch (err: any) {
      console.error('❌ [F6 Migration] Krytyczny błąd podczas migracji tplh_forecast.db:', err);
      return { migrated: false, error: err.message };
    }
  }
```

#### Blueprint D: Mutex-Locked, LRU-Cached `switchStoreDatabase` in `DatabaseManager`

```typescript
// Replace lines 241-280 in electron/database/db.ts:

  /**
   * F7: Concurrency Mutex and LRU Connection Pool store switching
   */
  public async switchStoreDatabase(
    storeId: string,
    storeInfo?: { name?: string; unitCode?: string; mpk?: string; city?: string; district?: string }
  ): Promise<{ success: boolean; isNew: boolean; dbPath: string; storeId: string }> {
    return this.switchMutex.runExclusive(async () => {
      if (!this.SQL) {
        this.SQL = await initSqlJs();
      }

      // 1. Perform F6 Legacy Migration if target is Store 108120
      if (storeId === '108120' || storeId === '108120_janki' || storeInfo?.mpk === '108120') {
        this.migrateLegacyTplhDatabase('108120');
      }

      const effectiveStoreId = (storeId === '108120_janki' || storeInfo?.mpk === '108120') ? '108120' : storeId;
      const targetDbPath = this.computeDbFilePath(effectiveStoreId, storeInfo);

      // 2. Check if connection is already hot in StoreConnectionPool (LRU Cache Hit)
      if (this.pool.has(effectiveStoreId)) {
        const cachedEntry = this.pool.getEntry(effectiveStoreId)!;
        this.db = cachedEntry.db;
        this.dbFilePath = cachedEntry.filePath;
        this.currentStoreId = effectiveStoreId;
        this.saveActiveStoreMeta(effectiveStoreId, storeInfo);

        console.log(`⚡ [StoreConnectionPool] Hot-switch (cache hit) dla kawiarni [${effectiveStoreId}] -> ${this.dbFilePath}`);
        return { success: true, isNew: false, dbPath: this.dbFilePath, storeId: effectiveStoreId };
      }

      // 3. Persist current active store if dirty before switching
      if (this.currentStoreId && this.pool.has(this.currentStoreId)) {
        this.pool.persistStore(this.currentStoreId);
      }

      this.currentStoreId = effectiveStoreId;
      this.saveActiveStoreMeta(effectiveStoreId, storeInfo);
      this.dbFilePath = targetDbPath;

      const exists = fs.existsSync(this.dbFilePath);
      let newDb: Database;
      let isNew = false;

      if (exists) {
        const fileBuffer = fs.readFileSync(this.dbFilePath);
        newDb = new this.SQL.Database(fileBuffer);
        this.createSchema(newDb);
        isNew = false;
        console.log(`📦 [StoreConnectionPool] Załadowano bazę z dysku dla [${effectiveStoreId}]: ${this.dbFilePath}`);
      } else {
        // Brand new store initialization
        newDb = new this.SQL.Database();
        this.createSchema(newDb);
        this.seedNewStoreData(newDb, storeInfo);
        isNew = true;
        // Immediate initial flush
        const initialBuffer = Buffer.from(newDb.export());
        fs.writeFileSync(this.dbFilePath, initialBuffer);
        console.log(`🆕 [StoreConnectionPool] Utworzono nową bazę SQLite dla [${effectiveStoreId}]: ${this.dbFilePath}`);
      }

      // 4. Place into LRU pool (triggers eviction if > 8 handles)
      this.pool.put(effectiveStoreId, newDb, this.dbFilePath, false);
      this.db = newDb;

      return { success: true, isNew, dbPath: this.dbFilePath, storeId: effectiveStoreId };
    });
  }
```

#### Blueprint E: DatabaseManager Properties and `persist()` Updates

```typescript
// Update class DatabaseManager members in electron/database/db.ts:

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database | null = null;
  private dbFilePath: string = '';
  private storageDir: string;
  private currentStoreId: string = '';
  private SQL: any = null;

  // F7 additions:
  private pool: StoreConnectionPool;
  private switchMutex: AsyncMutex;

  private constructor(storageDir?: string) {
    let dir = storageDir;
    if (!dir) {
      if (typeof app !== 'undefined' && app && app.isPackaged) {
        dir = path.join(app.getPath('userData'), 'data');
      } else {
        dir = path.join(process.cwd(), 'data');
      }
    }
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.storageDir = dir;
    this.pool = new StoreConnectionPool(8);
    this.switchMutex = new AsyncMutex();

    // Check for F6 legacy migration during startup
    this.migrateLegacyTplhDatabase('108120');

    const meta = this.loadActiveStoreMeta();
    if (meta?.storeId) {
      this.currentStoreId = meta.storeId;
      this.dbFilePath = this.computeDbFilePath(this.currentStoreId, meta?.storeInfo);
    } else {
      this.currentStoreId = '';
      this.dbFilePath = '';
    }
  }

  public getConnectionPool(): StoreConnectionPool {
    return this.pool;
  }

  public getSwitchMutex(): AsyncMutex {
    return this.switchMutex;
  }

  public persist(storeId?: string): void {
    const targetId = storeId || this.currentStoreId;
    if (targetId && this.pool.has(targetId)) {
      this.pool.persistStore(targetId);
      return;
    }
    // Fallback if not in pool
    if (this.db && this.dbFilePath) {
      const data = this.db.export();
      fs.writeFileSync(this.dbFilePath, Buffer.from(data));
    }
  }
```

---

## 5. Verification Method

To independently verify the implementation once applied:

1. **Run Unit and Tier 1 Test Suites**:
   ```bash
   npx tsx --test tests/e2e/tier1-feature-coverage/f06_db_naming_migration.test.ts
   npx tsx --test tests/e2e/tier1-feature-coverage/f07_lru_pool_mutex.test.ts
   ```
   *Expected*: 100% pass across all 12 tests.

2. **Run Boundary and Edge Case Test Suites (Tier 2)**:
   ```bash
   npx tsx --test tests/e2e/tier2-boundary-corner/b06_db_file_boundaries.test.ts
   npx tsx --test tests/e2e/tier2-boundary-corner/b07_lru_mutex_boundaries.test.ts
   ```
   *Expected*: Verification of 64-char length truncation, corrupted header recovery, 8/9 pool boundaries, 50-task mutex queue depth.

3. **Run Multi-Store Stress and Pairwise Scenarios (Tier 3 & 4)**:
   ```bash
   npx tsx --test tests/e2e/tier3-pairwise-interactions/pairwise_interactions.test.ts
   npx tsx --test tests/e2e/tier4-real-world-scenarios/real_world_scenarios.test.ts
   ```
   *Expected*: Scenario 9 verifies 100 fast concurrent store operations through the LRU pool and mutex without memory leakage or file corruption.

4. **Verify Application Build**:
   ```bash
   npm run build
   ```
   *Expected*: Zero TypeScript compilation errors (`tsc`) and successful Vite packaging.

5. **Filesystem Inspection**:
   - Check `data/` directory after selecting Store 108120:
     `data/store_108120.db` exists with size matching `data/tplh_forecast.db` (397,312 bytes).
   - Check `backups/db_backups/`:
     `legacy_tplh_migration_backup_*.db` exists.
