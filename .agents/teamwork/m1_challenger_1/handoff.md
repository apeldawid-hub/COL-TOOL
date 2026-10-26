# Handoff Report — Milestone 1 Adversarial Empirical Stress Testing

**Challenger**: `m1_challenger_1`  
**Milestone**: Milestone 1 (Hardening Features F1, F2, F3, F4)  
**Verdict**: **REJECT**

---

## 1. Observation

### 1.1 Zero Division and NaN/Infinity Failure in COL Calculator (`src/modules/col-calculator/services/colEngine.ts:302`)
In `src/modules/col-calculator/services/colEngine.ts` lines 301–305:
```ts
301:     const hoursSaved = Math.max(0, totalWorkingHoursPlan - hoursWithImprovedTplh);
302:     const avgCrewHourlyCost = totalWorkingHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
303:     const whatIfColSavings = hoursSaved * avgCrewHourlyCost;
304:     const whatIfColPctInfluence = kpis.salesTarget > 0 ? (whatIfColSavings / kpis.salesTarget) * 100 : 0;
```
Notice line 302:
`totalWorkingHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;`
When a store initializes or syncs scheduled managers from Module 2, `totalWorkingHoursPlan > 0` (e.g. 160h). However, because mock baristas were purged from `colDefaultData.ts` (`DEFAULT_COL_CREW_UOP = []`, `DEFAULT_COL_CREW_UZ = []`), `crewHoursPlan === 0`.
Because `totalWorkingHoursPlan > 0` is true, the engine divides by `crewHoursPlan` (0).
When executed via node/tsx:
```json
{
  "whatIfColSavings": NaN,
  "whatIfColPctInfluence": NaN
}
```
Downstream in `src/modules/col-calculator/components/ColSpreadsheetGrid.tsx` lines 295–298:
```tsx
295:                 <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
296:                   <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
297:                   <span>{fmtPln(summary.whatIfColSavings)}</span>
298:                 </div>
299:                 <div className="text-[10px] text-slate-500">
300:                   -{summary.whatIfColPctInfluence.toFixed(2)} pp
301:                 </div>
```
Formatting `NaN` with `fmtPln()` yields `"NaN zł"`, and calling `(-NaN).toFixed(2)` yields `"-NaN pp"`, corrupting the UI rendering.

Contrast this with `colEngine.ts:294`, where the guard was correctly implemented:
```ts
294:     const avgCrewCostHourly = crewHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
```

### 1.2 Unpurged Mock Financial Numbers in `src/modules/col-calculator/components/ColBonusSheet.tsx:5-8`
In `src/modules/col-calculator/components/ColBonusSheet.tsx`:
```ts
5:   const [salesAop, setSalesAop] = useState<number>(310000);
6:   const [salesActual, setSalesActual] = useState<number>(315000);
7:   const [profitAop, setProfitAop] = useState<number>(45000);
8:   const [profitActual, setProfitActual] = useState<number>(47000);
```
When an unconfigured or newly onboarded store opens the "BONUS" tab, it displays hardcoded mock financial metrics (310,000 PLN sales, 315,000 PLN actuals, 45,000 PLN profit, 47,000 PLN actuals) rather than 0 or values dynamically resolved from the store's AOP plan.

### 1.3 Clean Launch State & Store Fallback Verification (`StoreService`)
In `src/services/storeService.ts`:
- On clean launch (empty `localStorage`), `StoreService.hasConfiguredStore()` returns `false`.
- `StoreService.getCurrentStore()` returns `{ id: '', name: '', shortName: '', unitCode: '', mpk: '', city: '', district: '', address: '', type: 'Mall' }`.
- `DEFAULT_STORE_ID` is confirmed completely removed from `src/constants/starbucksStores.ts` exports.

### 1.4 Multi-Store Switching Isolation
- Switched between Store 108004 Nowy Świat (`unitCode: '323'`, `mpk: '108004'`) and Store 108035 Galeria Bałtycka (`unitCode: '18035'`, `mpk: '108035'`).
- `StoreService.getCurrentStore()` correctly updated to each store without retaining prior store keys or falling back to Janki (`18120`/`108120`).

### 1.5 Tool Execution Results
1. `npm run build`:
   - Transformed 2538 modules cleanly.
   - Output: `dist/index.html`, `dist-electron/main.js`, `dist-electron/preload.js`.
   - Exit code: 0.
2. `npx tsx --test "tests/e2e/tier2-boundary-corner/b19_m1_adversarial_stress.test.ts"`:
   - Output:
     ```
     ▶ B19: Milestone 1 Adversarial Empirical Stress Testing
       ✔ test_b19_clean_launch_unconfigured_state_and_no_default_store_id (0.407917ms)
       ✔ test_b19_multiple_store_switches_isolation_and_no_leakage (0.733458ms)
       ✔ test_b19_col_calculator_pure_zero_state (0.781458ms)
       ✖ test_b19_col_calculator_empty_crew_zero_division_vulnerability (0.759584ms)
       ✖ test_b19_col_bonus_sheet_no_hardcoded_financial_defaults (0.404833ms)
     ✖ B19: Milestone 1 Adversarial Empirical Stress Testing (3.854875ms)
     ℹ tests 6, pass 3, fail 3
     ```
   - Exit code: 1.

---

## 2. Logic Chain

1. **Observation 1.1** demonstrates that `colEngine.ts:302` contains a logical bug: it tests `totalWorkingHoursPlan > 0` instead of `crewHoursPlan > 0`, but then divides `totalCrewPlan` by `crewHoursPlan`.
2. When mock baristas were purged in Milestone 1 (Feature F2), newly initialized stores or stores importing manager schedules naturally start with `crewHoursPlan === 0` and `totalWorkingHoursPlan > 0`.
3. Dividing by zero produces `NaN` / `Infinity` in `whatIfColSavings` and `whatIfColPctInfluence`.
4. Downstream React rendering in `ColSpreadsheetGrid.tsx:298` directly interpolates these values, causing the user interface to display `-NaN pp` and `NaN zł`. This violates zero-state safety and arithmetic integrity.
5. **Observation 1.2** demonstrates that `ColBonusSheet.tsx:5-8` still holds hardcoded dummy sales and profit numbers (310k, 315k, 45k, 47k), which directly violates Acceptance Criteria R1 / F2 ("No placeholder AI filler texts, fake employee records, or mock financial numbers exist in production UI views").
6. Therefore, despite successful clean launch handling (Observation 1.3) and multi-store switching isolation (Observation 1.4), Milestone 1 contains two verified defects that prevent approval.

---

## 3. Caveats

- Pure zero state (where both managers and crew have 0 hours) does not trigger the division by zero because `totalWorkingHoursPlan > 0` evaluates to false, falling back to 32.5. The bug is specifically exposed when manager schedules are present but baristas are empty.
- Historical archives in `src/constants/changelog.ts` and the interactive walkthrough in `src/components/InteractiveModelTutorial.tsx` legitimately retain Janki 108120 references for historical audit purposes; these are not considered defects.

---

## 4. Conclusion

**Verdict: REJECT.**

Milestone 1 cannot be approved until the following two defects are corrected by the worker:

1. **Fix zero-division in `src/modules/col-calculator/services/colEngine.ts:302`**:
   Change:
   ```ts
   const avgCrewHourlyCost = totalWorkingHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
   ```
   To:
   ```ts
   const avgCrewHourlyCost = crewHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
   ```
2. **Purge mock numbers in `src/modules/col-calculator/components/ColBonusSheet.tsx:5-8`**:
   Change initial state values for `salesAop`, `salesActual`, `profitAop`, and `profitActual` to `0` (or dynamically initialize from the store's AOP plan).

---

## 5. Verification Method

1. Run the empirical stress test suite:
   ```bash
   npx tsx --test "tests/e2e/tier2-boundary-corner/b19_m1_adversarial_stress.test.ts"
   ```
   *Current state*: Fails with 2 assertions (zero-division `NaN` and mock numbers in `ColBonusSheet.tsx`).
   *Expected state after fix*: All 6 tests in `b19` pass cleanly.
2. Run full E2E suite:
   ```bash
   npx tsx --test "tests/e2e/**/*.test.ts"
   ```
   *Expected state after fix*: 251 tests pass, 0 fail.
3. Run project build:
   ```bash
   npm run build
   ```
   *Result*: Exits with code 0.
