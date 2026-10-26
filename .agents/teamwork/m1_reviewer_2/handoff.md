# Independent Review & Adversarial Challenge Report — Milestone 1

## Review Summary

**Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Tool Commands and Execution Results
1. **Compilation (`npm run build`)**:
   - Command: `npm run build`
   - Exit Code: `0`
   - Output:
     ```
     > starbucks-operations-suite@2.8.67 build
     > tsc && vite build

     vite v8.3.0 building client environment for production...
     ✓ 2538 modules transformed.
     dist/index.html                               1.31 kB │ gzip:   0.63 kB
     dist/assets/index-zI8l80Gh.js             1,313.33 kB │ gzip: 287.44 kB
     dist-electron/main.js  485.48 kB │ gzip: 124.36 kB
     dist-electron/preload.js  6.55 kB │ gzip: 1.67 kB
     ✓ built in 881ms
     ```

2. **E2E Test Suite (`npx tsx --test "tests/e2e/**/*.test.ts"`)**:
   - Command: `npx tsx --test "tests/e2e/**/*.test.ts"`
   - Exit Code: `1` (FAIL)
   - Results Summary:
     ```
     ℹ tests 252
     ℹ suites 0
     ℹ pass 248
     ℹ fail 4
     ℹ cancelled 0
     ℹ skipped 0
     ℹ todo 0
     ℹ duration_ms 1572.793667
     ```
   - Verbatim Failures:
     - **Failure 1 & 2** in `tests/e2e/tier2-boundary-corner/b19_m1_adversarial_stress.test.ts:100`:
       ```
       ✖ test_b19_col_calculator_empty_crew_zero_division_vulnerability (0.782334ms)
         AssertionError [ERR_ASSERTION]: VULNERABILITY DETECTED: ColEngine produced non-finite whatIfColSavings: NaN (colEngine.ts:302 zero-division on crewHoursPlan=0)
       ```
     - **Failure 3** in `tests/e2e/tier2-boundary-corner/b19_m1_adversarial_stress.test.ts:154`:
       ```
       ✖ test_b19_col_bonus_sheet_no_hardcoded_financial_defaults (0.358791ms)
         AssertionError [ERR_ASSERTION]: ColBonusSheet.tsx contains hardcoded mock salesAop (310000 PLN) instead of 0 or dynamic AOP
       ```
     - **Failure 4** in `tests/e2e/tier5-adversarial/m1_stress_challenge.test.ts:1`:
       ```
       /Users/dawidapel/COL Tool/electron/database/db.ts:4
       import { app } from 'electron';
                ^
       SyntaxError: The requested module 'electron' does not provide an export named 'app'
           at #asyncInstantiate (node:internal/modules/esm/module_job:455:21)
       ```

### 1.2 Source Code Inspection
1. **Division by Zero Vulnerability in `ColEngine`**:
   - Location: `/Users/dawidapel/COL Tool/src/modules/col-calculator/services/colEngine.ts:302`
   - Verbatim Code:
     ```ts
     294: const avgCrewCostHourly = crewHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
     ...
     301: const hoursSaved = Math.max(0, totalWorkingHoursPlan - hoursWithImprovedTplh);
     302: const avgCrewHourlyCost = totalWorkingHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
     303: const whatIfColSavings = hoursSaved * avgCrewHourlyCost;
     304: const whatIfColPctInfluence = kpis.salesTarget > 0 ? (whatIfColSavings / kpis.salesTarget) * 100 : 0;
     ```
   - Observation: When a store has manager hours scheduled (`totalWorkingHoursPlan > 0`), but no crew/barista hours entered yet (`crewHoursPlan === 0`), line 302 performs `0 / 0`, yielding `NaN`. Consequently, `whatIfColSavings` and `whatIfColPctInfluence` become `NaN`.

2. **Residual Mock Financial Data in UI View**:
   - Location: `/Users/dawidapel/COL Tool/src/modules/col-calculator/components/ColBonusSheet.tsx:5-8`
   - Verbatim Code:
     ```tsx
     export const ColBonusSheet: React.FC = () => {
       const [salesAop, setSalesAop] = useState<number>(310000);
       const [salesActual, setSalesActual] = useState<number>(315000);
       const [profitAop, setProfitAop] = useState<number>(45000);
       const [profitActual, setProfitActual] = useState<number>(47000);
     ```
   - Observation: Hardcoded initial states of `310000`, `315000`, `45000`, and `47000` exist directly in `ColBonusSheet.tsx`.

3. **Node/Electron Compatibility in Adversarial Test Harness**:
   - Location: `/Users/dawidapel/COL Tool/tests/e2e/tier5-adversarial/m1_stress_challenge.test.ts:10`
   - Observation: Directly imports `DatabaseManager` from `electron/database/db.ts`, which attempts a top-level import of `import { app } from 'electron';`. When executed by Node.js via `npx tsx --test`, Node cannot resolve Electron runtime exports without mocking.

4. **Clean Launch and Fallback Elimination (Verified Passed)**:
   - Location: `/Users/dawidapel/COL Tool/src/services/storeService.ts:38-109` and `/Users/dawidapel/COL Tool/electron/database/db.ts:121-126`
   - Observation: `StoreService.hasConfiguredStore()` returns `false` on empty `localStorage`. `StoreService.getCurrentStore()` returns `{ id: '', name: '', shortName: '', unitCode: '', mpk: '', city: '', district: '', address: '', type: 'Mall' }`.
   - In `electron/database/db.ts`, clean launch with no active store loads an in-memory SQLite instance without loading `tplh_forecast.db`.
   - In `src/App.tsx:75-85`, `checkOnboardingState()` activates `OnboardingWizardView` whenever `hasCompletedOnboarding` is false.
   - Ripgrep scans for `"Tutaj pojawią się"`, `"W budowie"`, and `"Lorem"` across `src/` and `electron/` return 0 matches.

---

## 2. Logic Chain

1. **Premise 1 (Test Suite Requirement)**: The task mandate explicitly specifies: `Run npm run build and npx tsx --test "tests/e2e/**/*.test.ts"`. Observation 1.1 shows `npx tsx --test` exits with code 1 and 4 failing tests. An implementation cannot be approved while the project test suite is failing.
2. **Premise 2 (Zero-Division Robustness)**: In Observation 1.2.1, `colEngine.ts:302` uses condition `totalWorkingHoursPlan > 0` before computing `totalCrewPlan / crewHoursPlan`. In any clean onboarding scenario or newly configured store where managers are scheduled (160h) but baristas have not yet been imported or added (`crewHoursPlan = 0`), the formula evaluates to `0 / 0 = NaN`. This causes `whatIfColSavings: NaN` on the P&L dashboard. This directly breaks the requirement for graceful handling of unconfigured or newly selected stores.
3. **Premise 3 (Audit & Mock Data Purge)**: Acceptance Criteria R1 states: *"Conduct an exhaustive audit across the entire codebase ... to remove all hardcoded fallback values, unit codes, mock schedules, dummy sales metrics, and AI filler texts ... No placeholder AI filler texts, fake employee records, or mock financial numbers exist in production UI views."* Observation 1.2.2 proves `ColBonusSheet.tsx` contains hardcoded mock financial figures (`310000`, `315000`, `45000`, `47000`) hardcoded into `useState`.
4. **Premise 4 (Test Isolation)**: Observation 1.2.3 shows `m1_stress_challenge.test.ts` attempts to import an Electron module directly in a pure Node runner. While the testing harness was authored separately, the test suite as specified in the dispatch must cleanly pass.
5. **Deductive Conclusion**: Because two genuine product defects exist (the `NaN` zero-division runtime vulnerability in `colEngine.ts` and the hardcoded mock financial numbers in `ColBonusSheet.tsx`), and the requested test execution fails with code 1, the review verdict must be **REQUEST_CHANGES**.

---

## 3. Findings

### [Critical] Finding 1: Zero-Division Runtime Vulnerability (`NaN`) on Clean / Empty Crew State
- **What**: Division by zero produces `NaN` in `ColEngine.calculate`.
- **Where**: `/Users/dawidapel/COL Tool/src/modules/col-calculator/services/colEngine.ts`, line 302:
  ```ts
  const avgCrewHourlyCost = totalWorkingHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
  ```
- **Why**: When managers are scheduled but crew is empty (`crewHoursPlan === 0`), `totalWorkingHoursPlan > 0` is true, so `0 / 0` evaluates to `NaN`. This poisons `whatIfColSavings` and `whatIfColPctInfluence`.
- **Suggestion**: Change condition to check `crewHoursPlan > 0`:
  ```ts
  const avgCrewHourlyCost = crewHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
  ```

### [Critical] Finding 2: Hardcoded Mock Financial Defaults in `ColBonusSheet`
- **What**: Hardcoded sales and profit numbers embedded in component state (`310000 PLN`, `315000 PLN`, `45000 PLN`, `47000 PLN`).
- **Where**: `/Users/dawidapel/COL Tool/src/modules/col-calculator/components/ColBonusSheet.tsx`, lines 5-8:
  ```tsx
  const [salesAop, setSalesAop] = useState<number>(310000);
  const [salesActual, setSalesActual] = useState<number>(315000);
  const [profitAop, setProfitAop] = useState<number>(45000);
  const [profitActual, setProfitActual] = useState<number>(47000);
  ```
- **Why**: Directly violates Milestone 1 requirement to purge all mock numbers and dummy sales metrics from production UI views.
- **Suggestion**: Default states to `0` or pass real values dynamically:
  ```tsx
  const [salesAop, setSalesAop] = useState<number>(0);
  const [salesActual, setSalesActual] = useState<number>(0);
  const [profitAop, setProfitAop] = useState<number>(0);
  const [profitActual, setProfitActual] = useState<number>(0);
  ```

### [Major] Finding 3: Electron Import Syntax Error in E2E Adversarial Test Suite
- **What**: `tests/e2e/tier5-adversarial/m1_stress_challenge.test.ts` fails with `SyntaxError: The requested module 'electron' does not provide an export named 'app'`.
- **Where**: `/Users/dawidapel/COL Tool/tests/e2e/tier5-adversarial/m1_stress_challenge.test.ts`, line 10.
- **Why**: When `npx tsx --test "tests/e2e/**/*.test.ts"` runs under Node, it cannot load Electron runtime native modules.
- **Suggestion**: Provide a lightweight mock for Electron in `testHarness.ts` or refactor the test to test through `UniversalReportParser` without directly importing `db.ts` that imports electron's `app`.

---

## 4. Verified Claims

| Claim from Worker | Verification Method | Result | Notes |
|---|---|---|---|
| Clean launch does not default to 108120 / Janki | Executed `StoreService.getCurrentStore()` with empty localStorage | **PASS** | Returns empty store object; `hasConfiguredStore()` returns `false` |
| Onboarding wizard triggers on clean launch | Verified `App.tsx` onboarding gate and `dbManager.hasActiveStore()` | **PASS** | `OnboardingWizardView` renders until store selection completes |
| AI filler texts purged ("Tutaj pojawią się", "W budowie", "Lorem") | Ripgrep search across `src/` and `electron/` | **PASS** | 0 occurrences in codebase |
| Parameterized SQL queries in parsers and electron | Code inspection & git diff of `mapalParser.ts`, `universalReportParser.ts`, `main.ts` | **PASS** | Queries parameterized by active store identifiers |
| Build succeeds (`npm run build`) | `npm run build` executed directly | **PASS** | Built in 881ms, exit code 0 |
| Entire E2E test suite passes (245 tests) | `npx tsx --test "tests/e2e/**/*.test.ts"` | **FAIL** | 248 passed, 4 failed (adversarial tier detected vulnerabilities) |

---

## 5. Adversarial Challenge Report

### Overall Risk Assessment: MEDIUM

### Challenges
1. **Challenge 1 (Zero Crew Schedule Crash)**:
   - *Assumption challenged*: `ColEngine` assumes that if working hours are planned, crew hours must be non-zero.
   - *Attack scenario*: A Store Manager creates the manager schedule in Module 2 (allocating 160h to SM/ASM) and opens the COL Calculator before adding baristas.
   - *Blast radius*: P&L dashboard displays `NaN zł` and `NaN %`, corrupting What-If simulations.
   - *Mitigation*: Replace `totalWorkingHoursPlan > 0` with `crewHoursPlan > 0` at line 302 of `colEngine.ts`.

2. **Challenge 2 (Residual Hardcoded Sales in Bonus Calculator)**:
   - *Assumption challenged*: All UI views have been purged of static financial numbers.
   - *Attack scenario*: A new store manager opens `ColBonusSheet` expecting unconfigured zero-state, but sees 310,000 PLN sales and 45,000 PLN profit.
   - *Blast radius*: Misleading bonus estimations and non-compliance with data hygiene criteria.
   - *Mitigation*: Initialize state to 0 in `ColBonusSheet.tsx`.

---

## 6. Caveats
- Historical references in `src/constants/changelog.ts` and the interactive walkthrough in `src/components/InteractiveModelTutorial.tsx` retain historical Janki data by design (explicitly documented as intentional for user guide and archive purposes).
- The store catalog `src/constants/starbucksStores.ts` retains Janki alongside 100+ Polish Starbucks locations so users may legitimately select it from the catalog.

---

## 7. Conclusion
Milestone 1 has achieved substantial architectural improvements: clean launch store onboarding is functional, static store fallbacks in SQL and IPC handlers have been eliminated, and AI filler texts have been replaced.
However, adversarial stress testing revealed **two concrete defects in the codebase**:
1. Zero-division runtime error generating `NaN` in `colEngine.ts:302`.
2. Residual hardcoded mock figures (`310000 PLN`, etc.) in `ColBonusSheet.tsx:5-8`.
Furthermore, `npx tsx --test "tests/e2e/**/*.test.ts"` fails with 4 failing tests.

Therefore, the final verdict is **REQUEST_CHANGES**.

---

## 8. Verification Method for Rework
To independently verify the fixes:
1. `npm run build` must complete with exit code 0.
2. `npx tsx --test "tests/e2e/**/*.test.ts"` must complete with 0 failures:
   - `test_b19_col_calculator_empty_crew_zero_division_vulnerability` must PASS.
   - `test_b19_col_bonus_sheet_no_hardcoded_financial_defaults` must PASS.
   - `m1_stress_challenge.test.ts` must PASS.
3. Verify `src/modules/col-calculator/services/colEngine.ts` line 302 uses `crewHoursPlan > 0`.
4. Verify `src/modules/col-calculator/components/ColBonusSheet.tsx` initializes sales/profit state with `0`.
