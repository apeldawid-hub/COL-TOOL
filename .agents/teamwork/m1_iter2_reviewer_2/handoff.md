# Handoff Report — Reviewer 2: Data Hygiene & Multi-Store Safety

**Agent**: `m1_iter2_reviewer_2`  
**Roles**: `reviewer`, `critic`  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m1_iter2_reviewer_2`  
**Parent / Caller**: `53bb484f-c139-4c15-89f6-7d840b96f7e4`  
**Date**: 2026-10-24T02:45:30Z  
**Verdict**: **APPROVE**  

---

## 1. Observation

Direct code inspections, adversarial grep searches, builds, and test runs were independently conducted across the codebase:

### 1.1 Schema Initialization & Elimination of Hardcoded Store Defaults (`electron/database/db.ts`)
- In `electron/database/db.ts:1074-1099` (`createSchema()`), the unconditional insertion of unit `18120` (`INSERT OR IGNORE INTO stores ... VALUES ('18120', '108120 SBX Warszawa Janki', 272.0);`) has been completely removed. `createSchema()` now sets up only standard floor and non-coverage rules without tenant bias.
- In `electron/database/db.ts:343-355` (`seedNewStoreData()`), store registration dynamically resolves the active tenant's primary store code and name:
  ```ts
  const primaryStoreCode = unitCode || storeMpk || this.currentStoreId || '';
  if (primaryStoreCode) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO stores (store_code, store_name, weekly_floor_hours)
      VALUES (?, ?, 272.0)
    `);
    stmt.run([primaryStoreCode, storeName]);
    stmt.free();
  }
  ```
- In `electron/database/db.ts:1601-1602` (`exportHistoricalPackage()`), dynamic store identifiers are used (`storeIdents.unitCode || 'custom'`, `storeIdents.storeName || 'Starbucks Store'`) instead of static string literals.
- In `electron/main.ts:828-836`, when saving floor rules, if `db.getRowsModified() === 0`, a dynamic fallback insert registers the active store with its calculated floor hours.

### 1.2 Importer Isolation & Scoped Delete Queries (`electron/importer/`)
- In `electron/importer/mapalParser.ts:293-299`, deletion queries are strictly scoped:
  ```ts
  const deleteStmt = db.prepare(`
    DELETE FROM labor_actuals_log 
    WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ?)
      AND date >= ? AND date <= ?
  `);
  deleteStmt.run([activeUnitCode, activeMpk, storeFilter, minDate, maxDate]);
  deleteStmt.free();
  ```
  The clause `OR unit_code IS NULL OR unit_code = ''` has been completely eliminated.
- In `electron/importer/mapalParser.ts:348-351`, the success notification dynamically injects `${targetStoreName}` rather than `"dla kawiarni Janki"`.
- In `electron/importer/universalReportParser.ts:876-890`, the deletion query similarly filters strictly by active store identifiers (`activeUnitCode`, `activeMpk`, `storeFilter`) and active manager names, with zero occurrences of `OR unit_code IS NULL OR unit_code = ''`.

### 1.3 Onboarding Gating & Clean Launch State (`src/App.tsx` & `src/services/storeService.ts`)
- In `src/services/storeService.ts:41-50`, `StoreService.hasConfiguredStore()` validates both completion flag and trimmed identity:
  ```ts
  public static hasConfiguredStore(): boolean {
    try {
      const savedName = localStorage.getItem(STORAGE_STORE_NAME_KEY)?.trim();
      const savedUnitCode = localStorage.getItem(STORAGE_UNIT_CODE_KEY)?.trim();
      const isOnboarded = localStorage.getItem('sbx_onboarding_completed') === 'true';
      return Boolean((savedName || savedUnitCode) && isOnboarded);
    } catch {
      return false;
    }
  }
  ```
- In `src/services/storeService.ts:98-109`, unconfigured clean launch returns an empty store object (`id: ''`, `name: ''`, `unitCode: ''`), preventing silent fallback to store 108120.
- In `src/App.tsx:60-67, 72-124, 408-412`, unconfigured states immediately block normal views and render `OnboardingWizardView`.

### 1.4 ColEngine Zero-Division & Mock Financial Purge
- In `src/modules/col-calculator/services/colEngine.ts:302`:
  ```ts
  const avgCrewHourlyCost = crewHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
  ```
  Guards against division by zero ($0/0 \rightarrow \text{NaN}$) when manager hours exist but crew hours are zero.
- In `src/modules/col-calculator/components/ColBonusSheet.tsx:5-8`, state variables `salesAop`, `salesActual`, `profitAop`, and `profitActual` are initialized to `0` rather than prototype mock constants.

### 1.5 Global Codebase Search for Store Identifiers ('18120', '108120', '384')
- `src/`: Grep search reveals 0 active logic defaults. All occurrences are either:
  1. Documentation/markdown comments.
  2. The legitimate catalog entry in `src/constants/starbucksStores.ts` for store 108120.
  3. UI search input placeholder text (`StoreSwitcherModal.tsx:273`, `StoreSwitcherModal.tsx:512`).
  4. The dedicated interactive training tutorial (`InteractiveModelTutorial.tsx`) demonstrating the Janki reference scenario.
- `electron/`: Only `db.ts:177` retains backward-compatibility file path routing to legacy `tplh_forecast.db` when explicitly selecting store 108120 (per Milestone 1 specification; Milestone 2 will unify naming).

### 1.6 Build and Test Execution
- Command: `npm run build`
  - Output: Exit code 0, 0 TypeScript errors, client bundle and electron bundles built in < 1 second.
- Command: `npx tsx --test "tests/e2e/**/*.test.ts"`
  - Output: `ℹ tests 269`, `ℹ pass 269`, `ℹ fail 0` (100% pass across all 5 test tiers).
- Targeted Adversarial Suite: `npx tsx --test "tests/e2e/tier2-boundary-corner/b19_m1_adversarial_stress.test.ts" "tests/e2e/tier5-adversarial/m1_stress_challenge.test.ts"`
  - Output: `ℹ tests 24`, `ℹ pass 24`, `ℹ fail 0`.

---

## 2. Logic Chain

1. **Absence of Hardcoded Defaults**:
   Observations in Section 1.1 and 1.5 prove that table creation and store registration do not inject hardcoded unit `18120` or mock roster records into newly created SQLite databases. Each new store database starts clean and receives only its own store identity upon onboarding.
2. **Tenant Isolation in Importers**:
   Observations in Section 1.2 demonstrate that `mapalParser.ts` and `universalReportParser.ts` scope DELETE operations strictly to `(unit_code = ? OR unit_code = ? OR unit_name LIKE ?)`. Removing `OR unit_code IS NULL OR unit_code = ''` prevents catastrophic data wipes across multi-store environments where legacy or foreign rows might have missing unit codes.
3. **Robust Onboarding Enforcement**:
   Observations in Section 1.3 show that `StoreService.hasConfiguredStore()` trims whitespace and requires both `isOnboarded` and non-empty store identity. Corrupt or empty profiles cannot bypass the onboarding wizard, guaranteeing that users must explicitly configure or select their store before accessing operations.
4. **ColEngine Mathematical Integrity**:
   Observation 1.4 confirms that `colEngine.ts` handles the edge case of newly onboarded stores with manager hours but zero barista hours without throwing NaN or Infinity.
5. **No Integrity Violations Detected**:
   Review of `b19_m1_adversarial_stress.test.ts` and `m1_stress_challenge.test.ts` confirms tests perform genuine mathematical evaluations and string inspections. No shortcuts, mocked facades, or fake passes were introduced.

---

## 3. Caveats

- **Legacy Database Routing**: Line 177 of `electron/database/db.ts` preserves backwards compatibility for legacy Store 18120 by directing it to `tplh_forecast.db`. This is expected behavior for Milestone 1; Milestone 2 (Feature F6) will unify all databases to `store_${id}.db` and execute the automated legacy file migration.
- **Tutorial Component Reference Data**: `InteractiveModelTutorial.tsx` contains static reference numbers to demonstrate the application to new store managers. This component is an explicit visual walk-through and does not affect live operational calculations or database persistence.

---

## 4. Conclusion & Verdict

**Verdict**: **APPROVE**

All requirements from `ORIGINAL_REQUEST.md` (Milestone 1 scope) and `DISPATCH.md` have been fully met:
- Zero hardcoded fallback defaults in active logic.
- Importer deletion queries are strictly scoped with zero cross-tenant contamination risk.
- Onboarding gating strictly requires valid store configuration.
- ColEngine edge cases and mock financial numbers are remediated.
- 100% of the 269 E2E tests pass, and TypeScript builds cleanly.

---

## 5. Adversarial Challenge & Stress-Test Summary

| Challenge / Hypothesis | Stress Scenario | Result | Status |
| :--- | :--- | :--- | :--- |
| **H1: Empty Profile Onboarding Bypass** | `localStorage` has `sbx_onboarding_completed: 'true'` but empty or whitespace store name/code. | `StoreService.hasConfiguredStore()` trims values and returns `false`. `App.tsx` forces `OnboardingWizardView`. | **PASS (Mitigated)** |
| **H2: Cross-Tenant Deletion on Report Import** | MAPAL import executed with rows lacking unit code. | `DELETE` query strictly filters by parameterized `activeUnitCode`, `activeMpk`, and `storeFilter`. No `OR unit_code IS NULL` clause. | **PASS (Mitigated)** |
| **H3: Zero Division in ColEngine on New Store** | New store onboarded with 1 SM (160h) and 0 baristas scheduled. | `avgCrewHourlyCost` evaluates `crewHoursPlan > 0` condition, falls back to `32.5`, producing finite numbers without NaN. | **PASS (Mitigated)** |
| **H4: Polymorphic IPC Signature Mismatch** | Caller invokes `switchStoreDatabase` with either `(storeId, storeInfo)` or `{ storeId, storeInfo }`. | `electron/main.ts:195-203` parses both signatures safely, preventing crashes. | **PASS (Mitigated)** |

---

## 6. Verification Method

To independently verify all findings:

1. **Verify Build**:
   ```bash
   npm run build
   ```
   *Expected outcome*: Exit code 0, 0 errors.

2. **Run Full E2E Test Suite**:
   ```bash
   npx tsx --test "tests/e2e/**/*.test.ts"
   ```
   *Expected outcome*: 269 passed, 0 failed.

3. **Verify Absence of Dangerous Importer Delete Queries**:
   ```bash
   grep -rn "unit_code IS NULL" electron/importer/
   ```
   *Expected outcome*: 0 occurrences.

4. **Verify Absence of Unit 18120 in Schema Creation**:
   ```bash
   grep -n "18120" electron/database/db.ts
   ```
   *Expected outcome*: Only line 177 (legacy file router).
