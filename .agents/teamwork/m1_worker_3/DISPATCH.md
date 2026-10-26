# DISPATCH: Milestone 1 Worker 3 (Remediation & Final Hardening)

Your working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_3
Role: teamwork_preview_worker
Original Request: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Project Root: /Users/dawidapel/COL Tool
Project Architecture: /Users/dawidapel/COL Tool/PROJECT.md

## Reference Blueprints from Retry Explorers
Read these 3 handoff reports — they contain exact line numbers, code blocks, and instructions:
1. `/Users/dawidapel/COL Tool/.agents/teamwork/m1_retry_explorer_1/handoff.md` (colEngine.ts zero-division fix, ColBonusSheet mock values zeroing)
2. `/Users/dawidapel/COL Tool/.agents/teamwork/m1_retry_explorer_2/handoff.md` (db.ts stores table schema cleanup, seedNewStoreData store insertion, main.ts:190 polymorphic IPC signature)
3. `/Users/dawidapel/COL Tool/.agents/teamwork/m1_retry_explorer_3/handoff.md` (App.tsx StoreService.hasConfiguredStore gating, mapalParser delete query overreach & dynamic text, test suite synchronization)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Tasks to Implement
1. **Fix zero-division in `src/modules/col-calculator/services/colEngine.ts:302`**:
   Change:
   `const avgCrewHourlyCost = totalWorkingHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;`
   To:
   `const avgCrewHourlyCost = crewHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;`
2. **Purge mock numbers in `src/modules/col-calculator/components/ColBonusSheet.tsx:5-8`**:
   Change initial states for `salesAop`, `salesActual`, `profitAop`, and `profitActual` to `0`.
3. **Clean SQLite `stores` table schema & add store registration in `electron/database/db.ts`**:
   - Lines 1080–1082: Remove `INSERT OR IGNORE INTO stores ... 18120 Janki` from `createSchema()`.
   - Lines 286–346 (`seedNewStoreData`): Insert the newly configured store into `stores (store_code, store_name, weekly_floor_hours)`.
   - Line 1587 (`exportHistoricalDataPackage`): Read store code and name dynamically from active store settings instead of static `'18120'`.
   - `electron/main.ts:803–811`: In `db:save-floor-rules`, if `db.getRowsModified() === 0`, insert the store record so floor hours are never lost.
4. **Polymorphic IPC signature in `electron/main.ts:190` & `electron/preload.ts`**:
   Accept both `(storeId, storeInfo)` and `{ storeId, storeInfo }` in `store:switch-database`.
5. **Gating in `src/App.tsx:107–115`**:
   Strictly evaluate `StoreService.hasConfiguredStore()` rather than raw `localStorage.getItem('sbx_onboarding_completed') === 'true'`.
6. **Importer query safety & status text in `electron/importer/mapalParser.ts` & `universalReportParser.ts`**:
   - Remove `OR unit_code IS NULL OR unit_code = ''` from delete queries in both parsers.
   - Replace `"dla kawiarni Janki"` with `${activeStoreName || 'aktywnej kawiarni'}` in `mapalParser.ts:349-350`.
7. **Test Suite Verification**:
   - Align test assertions in `tests/e2e/tier2-boundary-corner/b19_m1_adversarial_stress.test.ts` and `tests/e2e/tier5-adversarial/m1_stress_challenge.test.ts` to assert that zero-division is prevented and mock data is purged.
   - Run `npm run build` (must exit 0).
   - Run `npx tsx --test "tests/e2e/**/*.test.ts"` (all 269 tests must pass with exit code 0).

Document verification output in `/Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_3/handoff.md`.

## 2026-10-24T02:32:32Z
[Message] timestamp=2026-10-24T02:32:32Z sender=53bb484f-c139-4c15-89f6-7d840b96f7e4 priority=MESSAGE_PRIORITY_HIGH content=You are m1_worker_3 for Milestone 1 Iteration 2 Remediation.
Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_3
Read /Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_3/DISPATCH.md, /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md, /Users/dawidapel/COL Tool/PROJECT.md, and the 3 retry explorer blueprints:
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_retry_explorer_1/handoff.md
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_retry_explorer_2/handoff.md
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_retry_explorer_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute the fixes:
1. `colEngine.ts:302`: `crewHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5`.
2. `ColBonusSheet.tsx:5-8`: Initialize `salesAop`, `salesActual`, `profitAop`, `profitActual` to 0.
3. `db.ts`: Remove hardcoded store 18120 from `createSchema()`. Add store registration in `seedNewStoreData()`. Add defensive insertion in `main.ts:803-811`.
4. `main.ts:190` & `preload.ts`: Support polymorphic signature for `store:switch-database`.
5. `App.tsx:107-115`: Strictly evaluate `StoreService.hasConfiguredStore()`.
6. `mapalParser.ts` & `universalReportParser.ts`: Remove `OR unit_code IS NULL OR unit_code = ''` from delete queries. Update `mapalParser.ts:349-350` status text with dynamic store name.
7. Test suite synchronization: Run `npm run build` and `npx tsx --test "tests/e2e/**/*.test.ts"`. Ensure 100% of tests pass cleanly.

Write handoff.md and notify parent when complete.
