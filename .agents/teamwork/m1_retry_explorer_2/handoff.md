# Handoff Report — SQLite Schema/Registration & IPC Signature Fix Strategy (Milestone 1 Retry)

## 1. Observation

### 1.1 Issue 1: Lingering Hardcoded Store in `createSchema()` (`electron/database/db.ts:1078–1082`, `1587–1588`)
- In `electron/database/db.ts` lines 1078–1082:
  ```ts
  // Domyślny lokal: SBX Warszawa Janki
  this.db.run(`
    INSERT OR IGNORE INTO stores (store_code, store_name, weekly_floor_hours)
    VALUES ('18120', '108120 SBX Warszawa Janki', 272.0);
  `);
  ```
- Method `createSchema()` is executed across all database instantiation pathways:
  - Line 123: Clean launch in-memory database (`this.createSchema()`)
  - Line 132: Existing database load (`this.createSchema()`)
  - Line 136: New database creation (`this.createSchema()`)
  - Line 269: Switch to existing store DB (`this.createSchema()`)
  - Line 275: Switch to new store DB (`this.createSchema()`)
- In `electron/database/db.ts` lines 1583–1589 (`exportHistoricalPackage`):
  ```ts
  const manifest = {
    packageName: 'Starbucks Operations Suite — Historical Master Package',
    version: '2.6.0',
    exportDate: new Date().toISOString(),
    storeCode: '18120',
    storeName: '108120 SBX Warszawa Janki',
    ...
  ```
  The manifest export also hardcodes `'18120'` and `'108120 SBX Warszawa Janki'`.

### 1.2 Issue 2: Missing New Store Registration in `stores` Table (`electron/database/db.ts:286–346` & `electron/main.ts:803–808`)
- In `electron/database/db.ts` lines 286–346 (`seedNewStoreData`):
  ```ts
  private seedNewStoreData(storeInfo?: { name?: string; unitCode?: string; mpk?: string; city?: string; district?: string }): void {
    if (!this.db) return;
    // 1. Zaseeduj tygodnie biznesowe kalendarza ...
    // 2. Skonfiguruj app_settings dla tej kawiarni
    const storeName = storeInfo?.name || 'Nowa Kawiarnia Starbucks';
    const unitCode = storeInfo?.unitCode || '';
    const storeMpk = storeInfo?.mpk || '';
    const storeCity = storeInfo?.city || '';
    const storeDistrict = storeInfo?.district || '';

    this.setAppSettings({
      store_name: storeName,
      unit_code: unitCode,
      store_mpk: storeMpk,
      store_city: storeCity,
      store_district: storeDistrict,
    });

    this.ensureShiftDefinitions();
    this.seedMonthlyNorms();
  }
  ```
  `seedNewStoreData` writes to `calendar_weeks`, `app_settings`, `shift_definitions`, and `manager_monthly_norms`, but **never executes any statement against the `stores` table**.
- In `electron/database/db.ts` lines 709–714:
  ```sql
  CREATE TABLE IF NOT EXISTS stores (
    store_code TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    weekly_floor_hours REAL DEFAULT 272.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  ```
- In `electron/main.ts` lines 803–808:
  ```ts
  // Aktualizacja w tabeli stores
  const { unitCode, mpk } = dbManager.getActiveStoreIdentifiers();
  db.run(
    `UPDATE stores SET weekly_floor_hours = ? WHERE store_code = ? OR store_code = ? OR store_code IS NULL OR store_code = ''`,
    [weeklySum, unitCode, mpk]
  );
  ```
  Because `createSchema()` previously inserted only `18120` and `seedNewStoreData()` never inserted the new store, for any newly configured store (e.g. `18160` Wroclavia) the `stores` table contains 0 matching rows. The `UPDATE` query affects 0 rows, silently discarding updated floor hours upon database re-read.

### 1.3 Issue 3: IPC Signature Mismatch on `store:switch-database` (`electron/main.ts:190`, `electron/preload.ts:40,201`, `PROJECT.md:53`)
- In `PROJECT.md` line 53, the contracted signature is:
  ```ts
  switchStoreDatabase(storeId: string, storeInfo?: StoreInfo): Promise<{ success: boolean; isNew: boolean; dbPath: string; storeId: string }>
  ```
- In `electron/database/db.ts` lines 241–244:
  ```ts
  public async switchStoreDatabase(
    storeId: string,
    storeInfo?: { name: string; unitCode: string; mpk: string; city?: string; district?: string }
  ): Promise<{ success: boolean; isNew: boolean; dbPath: string; storeId: string }>
  ```
  `DatabaseManager` naturally expects two arguments: `(storeId, storeInfo)`.
- In `electron/main.ts` lines 189–194:
  ```ts
  ipcMain.handle('store:switch-database', async (_event, payload: { storeId: string; storeInfo?: any }) => {
    try {
      const result = await dbManager.switchStoreDatabase(payload.storeId, payload.storeInfo);
  ```
  The IPC handler expects a single object `payload: { storeId, storeInfo }`.
- In `electron/preload.ts` lines 40 and 201:
  ```ts
  switchStoreDatabase?: (payload: { storeId: string; storeInfo?: any }) => Promise<{ success: boolean; isNew: boolean; dbPath: string; storeId: string }>;
  // ...
  switchStoreDatabase: (payload: { storeId: string; storeInfo?: any }) => ipcRenderer.invoke('store:switch-database', payload),
  ```
- When a caller adheres to the `PROJECT.md` 2-argument contract `api.switchStoreDatabase(storeId, storeInfo)`, `_event` is arg 0, `payload` is `storeId` (string), and `payload.storeId` is `undefined`, causing the handler to fail or switch to an invalid store.

---

## 2. Logic Chain

1. **Root Cause of Fallback Leakage (Observation 1.1)**:
   - `createSchema()` is intended for schema DDL and universal Polish labor law/Starbucks standards (shifts, calendar norms, floor rule templates).
   - Embedding `INSERT OR IGNORE INTO stores ... VALUES ('18120', '108120 SBX Warszawa Janki', 272.0)` inside `createSchema()` pollutes every SQLite file generated for any store with store 18120.
   - Removing this block guarantees that `createSchema()` is 100% tenant-agnostic.
2. **Root Cause of Floor Hour Update Loss (Observations 1.1 & 1.2)**:
   - When a user configures a new store (e.g. `unitCode: '18160'`, `mpk: '108160'`), `seedNewStoreData()` initializes `app_settings` and `calendar_weeks`, but leaves `stores` empty (once the Janki fallback is removed).
   - In `main.ts:806`, the handler for `db:save-floor-rules` runs an `UPDATE stores WHERE store_code = ? OR store_code = ?` against `unitCode` and `mpk`.
   - Since `stores` has no record for the new store, the `UPDATE` matches 0 rows and fails silently.
   - Therefore, `seedNewStoreData()` must explicitly register the new store in `stores (store_code, store_name, weekly_floor_hours)`.
   - Additionally, adding defensive fallback insertion in `main.ts:806` when `db.getRowsModified() === 0` ensures existing or manually imported databases are also immune to floor hour loss.
3. **Dual Signature Normalization (Observation 1.3)**:
   - Code in `src/services/storeService.ts` currently calls `switchStoreDatabase({ storeId, storeInfo })`.
   - Future callers and `PROJECT.md:53` contract specify `switchStoreDatabase(storeId, storeInfo)`.
   - By structuring `main.ts:190` to inspect `typeof arg1 === 'string'`, extracting `(arg1, arg2)` when passed as two arguments and `(arg1.storeId, arg1.storeInfo)` when passed as an object, both signatures work seamlessly without breaking changes.
   - Updating `electron/preload.ts` to accept either signature bridges both frontend conventions to Electron IPC cleanly.

---

## 3. Caveats

- **Existing Legacy Databases**: Any legacy SQLite database files already created with old builds may contain the stale `18120` record. If opened, `db.ts` will not delete it unless instructed. The defensive `INSERT OR REPLACE` in `main.ts:806` ensures updates still succeed for the active store regardless.
- **Store Code Aliases**: Starbucks stores feature both an operational Unit Code (e.g. `18120`, `323`, `18160`) and a financial MPK (e.g. `108120`, `108004`, `108160`). The primary store code should prioritize `unitCode || storeMpk || this.currentStoreId`. Since `main.ts:806` filters on both `store_code = unitCode OR store_code = mpk`, matching is 100% robust.
- **Read-Only Explorer Scope**: In accordance with explorer role constraints, no changes to `electron/` or `src/` have been directly applied in this investigation; complete drop-in diff proposals are provided below for the implementer (`m1_retry_worker_2`).

---

## 4. Conclusion & Actionable Fix Strategy

### 4.1 Fix 1: Purge Hardcoded Janki in `createSchema` and `exportHistoricalPackage`

**File**: `electron/database/db.ts`
- **Location 1**: Lines 1078–1082:
  Remove:
  ```ts
  <<<<
      // Domyślny lokal: SBX Warszawa Janki
      this.db.run(`
        INSERT OR IGNORE INTO stores (store_code, store_name, weekly_floor_hours)
        VALUES ('18120', '108120 SBX Warszawa Janki', 272.0);
      `);
  ====
  >>>>
  ```
- **Location 2**: Lines 1587–1588 in `exportHistoricalPackage`:
  Replace:
  ```ts
  <<<<
        storeCode: '18120',
        storeName: '108120 SBX Warszawa Janki',
  ====
        storeCode: this.getActiveStoreIdentifiers().unitCode || 'custom',
        storeName: this.getActiveStoreIdentifiers().storeName || 'Starbucks Store',
  >>>>
  ```

### 4.2 Fix 2: Register New Store in `seedNewStoreData` and Defend Floor Hours Update

**File**: `electron/database/db.ts`
- **Location**: Inside `seedNewStoreData()`, lines 326–346.
  Replace with:
  ```ts
      // 2. Skonfiguruj app_settings dla tej kawiarni
      const activeMeta = this.loadActiveStoreMeta();
      const effectiveInfo = storeInfo || activeMeta?.storeInfo;
      const storeName = effectiveInfo?.name || (this.currentStoreId ? `Kawiarnia Starbucks (${this.currentStoreId})` : 'Nowa Kawiarnia Starbucks');
      const unitCode = effectiveInfo?.unitCode || '';
      const storeMpk = effectiveInfo?.mpk || '';
      const storeCity = effectiveInfo?.city || '';
      const storeDistrict = effectiveInfo?.district || '';

      this.setAppSettings({
        store_name: storeName,
        unit_code: unitCode,
        store_mpk: storeMpk,
        store_city: storeCity,
        store_district: storeDistrict,
      });

      // 3. Zarejestruj nowo utworzoną kawiarnię w tabeli stores
      const primaryStoreCode = unitCode || storeMpk || this.currentStoreId || '';
      if (primaryStoreCode) {
        try {
          const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO stores (store_code, store_name, weekly_floor_hours)
            VALUES (?, ?, 272.0)
          `);
          stmt.run([primaryStoreCode, storeName]);
          stmt.free();
          console.log(`🏬 [Nowa Kawiarnia] Zarejestrowano w tabeli stores: [${primaryStoreCode}] ${storeName} (272.0h)`);
        } catch (err) {
          console.error('Błąd rejestracji kawiarni w tabeli stores:', err);
        }
      }

      // Zapewnij uniwersalne definicje zmian i normy KP bez mockowych grafików i pracowników
      this.ensureShiftDefinitions();
      this.seedMonthlyNorms();

      console.log(`✅ [Nowa Kawiarnia] Skonfigurowano app_settings i stores dla: ${storeName} (Kod: ${primaryStoreCode})`);
  ```

**File**: `electron/main.ts`
- **Location**: Lines 803–811 in `db:save-floor-rules`:
  Replace with:
  ```ts
      // Aktualizacja w tabeli stores
      const { unitCode, mpk, storeName } = dbManager.getActiveStoreIdentifiers();
      db.run(
        `UPDATE stores SET weekly_floor_hours = ? WHERE store_code = ? OR store_code = ? OR store_code IS NULL OR store_code = ''`,
        [weeklySum, unitCode, mpk]
      );

      // Zabezpieczenie: jeśli tabela stores nie miała rekordu dla tej kawiarni, wstaw wpis
      if (db.getRowsModified() === 0 && (unitCode || mpk)) {
        const primaryCode = unitCode || mpk;
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO stores (store_code, store_name, weekly_floor_hours)
          VALUES (?, ?, ?)
        `);
        stmt.run([primaryCode, storeName || `Kawiarnia Starbucks (${primaryCode})`, weeklySum]);
        stmt.free();
      }

      dbManager.persist();
  ```

### 4.3 Fix 3: Seamless Dual IPC Signature for `store:switch-database`

**File**: `electron/main.ts`
- **Location**: Lines 189–200:
  Replace with:
  ```ts
    // Przełączanie bazy danych na wybraną kawiarnię (z izolowaną, nową bazą SQLite dla nowej jednostki)
    ipcMain.handle('store:switch-database', async (_event, arg1: any, arg2?: any) => {
      try {
        let storeId: string;
        let storeInfo: any;

        if (typeof arg1 === 'string') {
          storeId = arg1;
          storeInfo = arg2;
        } else if (arg1 && typeof arg1 === 'object') {
          storeId = arg1.storeId;
          storeInfo = arg1.storeInfo;
        } else {
          throw new Error(`Nieprawidłowe parametry dla store:switch-database: oczekiwano (storeId, storeInfo) lub ({ storeId, storeInfo }), otrzymano: ${typeof arg1}`);
        }

        if (!storeId || typeof storeId !== 'string') {
          throw new Error(`Brak lub nieprawidłowy storeId w wywołaniu store:switch-database: ${storeId}`);
        }

        const result = await dbManager.switchStoreDatabase(storeId, storeInfo);
        console.log(`🏬 [Multi-Store] Przełączono bazę kawiarni: ${storeId} -> ${result.dbPath} (nowa: ${result.isNew})`);
        return result;
      } catch (err: any) {
        console.error('Błąd przełączania bazy kawiarni w IPC:', err);
        return { success: false, error: err.message };
      }
    });
  ```

**File**: `electron/preload.ts`
- **Location 1**: Line 40:
  ```ts
    switchStoreDatabase?: (
      storeIdOrPayload: string | { storeId: string; storeInfo?: any },
      storeInfo?: any
    ) => Promise<{ success: boolean; isNew: boolean; dbPath: string; storeId: string }>;
  ```
- **Location 2**: Line 201:
  ```ts
    switchStoreDatabase: (
      arg1: string | { storeId: string; storeInfo?: any },
      arg2?: any
    ) => {
      if (typeof arg1 === 'string') {
        return ipcRenderer.invoke('store:switch-database', arg1, arg2);
      }
      return ipcRenderer.invoke('store:switch-database', arg1);
    },
  ```

---

## 5. Verification Method

To independently verify the implementation:

1. **Verify No Janki in `createSchema()`**:
   - Inspect `electron/database/db.ts` around line 1080.
   - Confirm lines inserting `18120` into `stores` are absent.
   - Create a clean test database using `dbManager.createSchema()`:
     Run `SELECT * FROM stores` on a fresh schema — assert result has 0 rows.
2. **Verify New Store Registered in `stores`**:
   - Call `dbManager.switchStoreDatabase('108160', { name: '108160 SBX Wrocław Wroclavia', unitCode: '18160', mpk: '108160' })`.
   - Query `SELECT store_code, store_name, weekly_floor_hours FROM stores`.
   - Assert: exactly 1 row returned with `store_code = '18160'`, `weekly_floor_hours = 272.0`.
   - Update floor rules: invoke `db:save-floor-rules` with weekly floor hours = 280.0.
   - Assert: `SELECT weekly_floor_hours FROM stores WHERE store_code = '18160'` returns 280.0.
3. **Verify Dual IPC Signature**:
   - Test Call A (contracted 2 arguments):
     `api.switchStoreDatabase('108046', { name: '108046 SBX Warszawa Sadyba', unitCode: '341', mpk: '108046' })`
     Assert: succeeds with `result.storeId === '108046'`.
   - Test Call B (legacy object argument):
     `api.switchStoreDatabase({ storeId: '108046', storeInfo: { name: '108046 SBX Warszawa Sadyba', unitCode: '341', mpk: '108046' } })`
     Assert: succeeds with `result.storeId === '108046'`.
4. **Compile & Build**:
   - Run `npm run build` — must exit with 0 errors.
