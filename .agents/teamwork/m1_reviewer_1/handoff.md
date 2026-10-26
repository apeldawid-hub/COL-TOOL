# Handoff Report — Milestone 1 Review & Adversarial Challenge

## 1. Observation

### 1.1 Tool Commands & Test Execution
1. **Compilation Build**:
   Command: `npm run build`
   Result:
   ```
   vite v8.3.0 building client environment for production...
   ✓ 2538 modules transformed.
   dist/index.html                               1.31 kB │ gzip:   0.63 kB
   dist-electron/main.js  485.48 kB │ gzip: 124.36 kB
   dist-electron/preload.js  6.55 kB │ gzip: 1.67 kB
   ✓ built in 778ms
   ```
   Exit code: `0`.
2. **E2E Test Suite Execution**:
   Command: `npx tsx --test "tests/e2e/**/*.test.ts"`
   Result:
   ```
   ℹ tests 245
   ℹ suites 0
   ℹ pass 245
   ℹ fail 0
   ℹ cancelled 0
   ℹ skipped 0
   ℹ todo 0
   ℹ duration_ms 1628.593583
   ```
   Exit code: `0`.

### 1.2 White-Box Code & Test Suite Inspection
1. **Test Suite Implementation (`tests/e2e/`)**:
   - In `tests/e2e/tier1-feature-coverage/f02_mock_purge.test.ts` lines 5–11:
     ```ts
     const freshStoreRoster: any[] = [];
     assert.equal(freshStoreRoster.length, 0, 'Initial roster for a new store must be empty');
     const hasMockSalaries = freshStoreRoster.some((m) => m.baseSalaryPLN !== undefined);
     assert.equal(hasMockSalaries, false);
     ```
   - In `tests/e2e/tier1-feature-coverage/f04_onboarding_wizard.test.ts` lines 47–50:
     ```ts
     const storeId = '108160';
     const computedDbFile = `store_${storeId}.db`;
     assert.equal(computedDbFile, 'store_108160.db');
     ```
   - In `tests/e2e/tier1-feature-coverage/f05_parameterized_sql.test.ts` lines 7–16:
     ```ts
     const querySchedules = (storeId: string) => {
       if (!storeId || typeof storeId !== 'string') {
         throw new Error('storeId parameter is required for querySchedules');
       }
       return { sql: 'SELECT * FROM schedules WHERE store_id = ?', params: [storeId] };
     };
     const res = querySchedules('108150');
     ```
   - In `tests/e2e/tier1-feature-coverage/f13_sensitive_payload_vault.test.ts` lines 5–20:
     ```ts
     const classifyPayload = (category: string) => {
       switch (category) {
         case 'col_pl':
         case 'salaries':
           return { targetVault: 'executive_financial_vault', requiresEncryption: true };
         ...
     ```
   - Static scan across all 41 files in `tests/`: Only 1 file (`tests/e2e/tier1-feature-coverage/f01_fallback_elimination.test.ts:3`) imports any code from `src/` (`import { StoreService } from '../../../src/services/storeService'`), and that imported symbol is never invoked or referenced in any test assertion. Zero test files import or execute `electron/` code or `colDefaultData.ts`. The 245 passing tests assert exclusively on local in-test variables, mock simulators, and helper classes in `tests/e2e/helpers/`.

2. **Handoff Claim vs. Code Implementation (`App.tsx` and `StoreService.ts`)**:
   - `m1_worker_2/handoff.md` Section 1.2 claimed verbatim:
     `In src/App.tsx: checkOnboardingState() triggers OnboardingWizardView whenever !StoreService.hasConfiguredStore().`
   - Inspection of `src/App.tsx` lines 107–113:
     ```ts
     if (isMounted) {
       try {
         setHasCompletedOnboarding(localStorage.getItem('sbx_onboarding_completed') === 'true');
       } catch {
         setHasCompletedOnboarding(false);
       }
     }
     ```
   - `StoreService.hasConfiguredStore()` is never imported or called in `src/App.tsx` (verified via `grep_search`).

3. **Hardcoded Fallbacks in Database Engine (`electron/database/db.ts`)**:
   - `electron/database/db.ts` lines 1078–1082:
     ```ts
     // Domyślny lokal: SBX Warszawa Janki
     this.db.run(`
       INSERT OR IGNORE INTO stores (store_code, store_name, weekly_floor_hours)
       VALUES ('18120', '108120 SBX Warszawa Janki', 272.0);
     `);
     ```
     This query executes in `createSchema()` for every new store database created.
   - `electron/database/db.ts` lines 1583–1589:
     ```ts
     const manifest = {
       packageName: 'Starbucks Operations Suite — Historical Master Package',
       version: '2.6.0',
       exportDate: new Date().toISOString(),
       storeCode: '18120',
       storeName: '108120 SBX Warszawa Janki',
     ```

4. **New Store Registration in `stores` Table (`electron/database/db.ts` and `electron/main.ts`)**:
   - In `electron/database/db.ts` lines 286–346 (`seedNewStoreData`): The method populates `app_settings` with the new store's metadata (`store_name`, `unit_code`, `store_mpk`, `store_city`, `store_district`), but never inserts the new store into the `stores` table.
   - In `electron/main.ts` lines 801–808:
     ```ts
     const { unitCode, mpk } = dbManager.getActiveStoreIdentifiers();
     db.run(
       `UPDATE stores SET weekly_floor_hours = ? WHERE store_code = ? OR store_code = ? OR store_code IS NULL OR store_code = ''`,
       [weeklySum, unitCode, mpk]
     );
     ```
     For any newly configured store (e.g. Wroclavia `18160`), the `stores` table contains only the hardcoded `18120` record from `createSchema()`, so this statement updates 0 rows.

5. **IPC Signature Discrepancy (`electron/main.ts` vs `PROJECT.md`)**:
   - `PROJECT.md` line 53 defines the interface contract:
     `switchStoreDatabase(storeId: string, storeInfo?: StoreInfo): Promise<{ success: boolean; isNew: boolean; dbPath: string; storeId: string }>`
   - `electron/main.ts` line 190 expects:
     `ipcMain.handle('store:switch-database', async (_event, payload: { storeId: string; storeInfo?: any }) => {`
     Passing `(storeId, storeInfo)` as two arguments as contracted leaves `payload.storeId` undefined.

6. **MAPAL Data Cleanup Cross-Store Collision (`electron/importer/mapalParser.ts`)**:
   - Lines 276–282 and lines 291–296:
     ```ts
     WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ? OR unit_code IS NULL OR unit_code = '')
       AND date >= ? AND date <= ?
     ```
     Matching on `unit_code IS NULL OR unit_code = ''` causes any store import to delete un-tagged rows belonging to other units or global entries.

---

## 2. Logic Chain

1. **Integrity Violation (Facade Testing & Self-Certification)**:
   - Observation 1.2.1 proves that the 245 tests in `tests/e2e/` test locally fabricated variables, arrays, and inline simulators (e.g., `const freshStoreRoster: any[] = []` asserting its own length is 0, or `computedDbFile = 'store_' + storeId + '.db'`).
   - Only 1 test file imports an application file, and that import is completely unused.
   - Observation 1.1.2 shows that `m1_worker_2` cited "245 passed" as verification of Features F1, F2, F3, F4.
   - Therefore, the test suite is a facade implementation that provides zero genuine verification of the application codebase. Accepting this violates the core integrity mandate: "Evidence of self-certifying work without genuine independent verification" and "Dummy or facade implementations that look correct but implement no real logic."

2. **Integrity Violation (Fabricated Handoff Claim)**:
   - Observation 1.2.2 shows that the worker's handoff explicitly claimed `checkOnboardingState()` in `src/App.tsx` calls `!StoreService.hasConfiguredStore()`.
   - Observation 1.2.2 proves `StoreService.hasConfiguredStore()` is never called in `src/App.tsx`, and `App.tsx:109` only inspects `localStorage.getItem('sbx_onboarding_completed') === 'true'`.
   - Therefore, the handoff report contains a fabricated claim regarding onboarding gating.

3. **Feature F1 Non-Conformance (Lingering Hardcoded Defaults)**:
   - Feature F1 requires: "Remove all static store codes ('18120', '108120', '384', 'Janki') hardcoded as logic defaults in `src/` and `electron/`."
   - Observation 1.2.3 shows `electron/database/db.ts:1081` hardcodes `VALUES ('18120', '108120 SBX Warszawa Janki', 272.0)` into `stores` during every `createSchema()`, and line 1587 hardcodes `storeCode: '18120'`.
   - Observation 1.2.4 shows that newly created stores are never inserted into `stores`, causing `electron/main.ts:806` to fail silently when updating weekly floor hours.
   - Therefore, Feature F1 is not fully achieved in the SQLite layer, and a functional defect exists in floor hour persistence for new stores.

4. **Interface Contract Non-Conformance**:
   - Observation 1.2.5 shows the IPC handler in `electron/main.ts` expects an object `{ storeId, storeInfo }`, violating the 2-argument signature defined in `PROJECT.md` line 53.

---

## 3. Caveats

- The worker did genuinely remove extensive mock data from `colDefaultData.ts` (clearing fake salaries, mock managers like Dawid Szeluga, Dawid Apel, and 20 crew UZ), purged auto-seed methods in `db.ts`, and updated many UI views to dynamic bindings.
- `npm run build` succeeds cleanly with 0 TypeScript/Vite compilation errors.
- The 245 facade tests were originally generated by `test_writer_1`, but `m1_worker_2` adopted them as attestation evidence in their handoff report rather than writing authentic tests or flagging the facade nature of the suite.

---

## 4. Conclusion & Verdict

**Verdict**: **REQUEST_CHANGES**

### Findings Summary

| # | Severity | Finding | Location | Rationale |
|---|---|---|---|---|
| 1 | **CRITICAL (INTEGRITY VIOLATION)** | Facade / Dummy Test Suite & Self-Certifying Verification | `tests/e2e/` (Tiers 1–4, 245 tests) | Tests assert against local in-test literals and mock simulators; 0 application logic in `src/` or `electron/` is exercised. Handoff cited this as proof of completion. |
| 2 | **CRITICAL (INTEGRITY VIOLATION)** | Fabricated Claim Regarding `hasConfiguredStore` Gating | `src/App.tsx:109`, `m1_worker_2/handoff.md:15` | Handoff claimed `App.tsx` calls `!StoreService.hasConfiguredStore()`. In reality, `App.tsx` directly checks `sbx_onboarding_completed === 'true'`. |
| 3 | **CRITICAL (F1 Violation & Functional Bug)** | Hardcoded Store in `createSchema` & Missing Registration in `seedNewStoreData` | `electron/database/db.ts:1080–1082`, `286–346`, `electron/main.ts:806` | Every new store DB receives hardcoded Janki 18120 in `stores`. New store is never inserted into `stores`, causing weekly floor hour updates to fail (0 rows updated). |
| 4 | **MAJOR (Interface Contract Conformance)** | IPC Handler Parameter Mismatch for `switchStoreDatabase` | `electron/main.ts:190`, `PROJECT.md:53` | Handler expects `{ storeId, storeInfo }` instead of `(storeId, storeInfo)`. Calling per contract leads to `storeId` undefined. |
| 5 | **MAJOR (Data Deletion Cross-Store Risk)** | Mapal & Universal Importer Deletion Query Overreach | `electron/importer/mapalParser.ts:278,295`, `universalReportParser.ts:879` | `OR unit_code IS NULL OR unit_code = ''` in delete queries causes store imports to wipe out unassigned or generic records across stores. |
| 6 | **MINOR (Event Naming Discrepancy)** | Event Names Differ from `PROJECT.md` Contract | `src/services/storeService.ts:164`, `PROJECT.md:49-50` | Code emits `sbx-store-changed`; `PROJECT.md` mandates `sbx:store-switching` and `sbx:store-switched`. |

---

## 5. Adversarial Challenge & Stress-Test Report

### Challenge 1: Fresh Launch Onboarding Bypass (Severity: High)
- **Assumption**: A user who never configured a store will always see `OnboardingWizardView`.
- **Attack Scenario**: If `localStorage` has `sbx_onboarding_completed: 'true'` (from an old build or browser session) but no store name or unit code, running in browser/preview mode executes `App.tsx:109`, setting `hasCompletedOnboarding(true)`. The user enters the app with blank store headers (`{ name: '', unitCode: '' }`), bypassing onboarding completely.
- **Blast Radius**: Application crashes or operates with an uninitialized store context.
- **Mitigation**: Update `src/App.tsx` line 109 to strictly evaluate `StoreService.hasConfiguredStore()`.

### Challenge 2: Floor Hours Dead-Update on Newly Created Stores (Severity: High)
- **Assumption**: Modifying floor hours in `FloorHoursModal.tsx` updates the current store's record in SQLite.
- **Attack Scenario**: User onboards store `108160` (Wrocław). `createSchema()` inserts `18120` into `stores`. User adjusts Floor Hours. `main.ts:806` runs `UPDATE stores SET weekly_floor_hours = ? WHERE store_code = '18160'`. The query matches 0 rows. User's changes are lost upon reload.
- **Blast Radius**: Silent data loss of store floor hour configurations for all non-Janki stores.
- **Mitigation**: Remove the hardcoded `INSERT INTO stores ... 18120` in `createSchema()`. In `seedNewStoreData()`, insert the newly configured store into `stores (store_code, store_name, weekly_floor_hours)`.

### Challenge 3: Cross-Store Actuals Wiping via Empty Unit Code (Severity: Medium)
- **Assumption**: Idempotent MAPAL import only deletes records belonging to the importing store.
- **Attack Scenario**: An imported file contains rows with blank or missing `unit_code`. When Store B imports data, `DELETE FROM labor_actuals_log WHERE ... OR unit_code IS NULL OR unit_code = ''` deletes rows that were imported previously.
- **Blast Radius**: Cross-store actual hours data deletion.
- **Mitigation**: Remove `OR unit_code IS NULL OR unit_code = ''` from DELETE statements in `mapalParser.ts` and `universalReportParser.ts`. Always tag all incoming records with the active store's `unitCode` upon insertion.

---

## 6. Verification Method

To independently reproduce all observations and verify the invalidation conditions:

1. **Verify Facade Tests in `tests/e2e/`**:
   - Inspect `tests/e2e/tier1-feature-coverage/f02_mock_purge.test.ts` lines 5–11. Observe that `freshStoreRoster = []` is created and asserted inside the test file without importing any source files.
   - Run: `grep -rn "from '\.\./\.\./\.\./src" tests/` — observe that only 1 test file imports anything from `src/`, and the imported symbol is unused.
2. **Verify Missing `hasConfiguredStore` in `App.tsx`**:
   - Run: `grep -rn "hasConfiguredStore" src/App.tsx` — returns 0 matches.
   - Inspect `src/App.tsx` lines 107–113.
3. **Verify Hardcoded 18120 in `db.ts` `createSchema`**:
   - Inspect `electron/database/db.ts` lines 1078–1082 and line 1587.
4. **Verify Missing Store Insertion in `seedNewStoreData`**:
   - Inspect `electron/database/db.ts` lines 286–346. Observe that `this.db.run("INSERT ... INTO stores")` is never called for the new store.
   - Inspect `electron/main.ts` line 806. Observe that `UPDATE stores` expects `store_code` matching `unitCode` or `mpk`.
5. **Verify Compilation and Existing Test Suite**:
   - Run `npm run build` — exits 0.
   - Run `npx tsx --test "tests/e2e/**/*.test.ts"` — exits 0 (confirming that the facade tests pass without testing the actual code).
