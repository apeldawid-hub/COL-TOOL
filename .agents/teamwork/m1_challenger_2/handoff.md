# Handoff Report — Milestone 1 Empirical Stress Testing

**Challenger**: `m1_challenger_2`  
**Milestone**: Milestone 1 Hardening (Features F1, F2, F3, F4, F5)  
**Verdict**: **REJECT**

---

## 1. Observation

### 1.1 Full Test Suite Failure (`npx tsx --test "tests/e2e/**/*.test.ts"`)
Running the mandatory acceptance command `npx tsx --test "tests/e2e/**/*.test.ts"` exits with **code 1** due to failing tests:
```
✖ failing tests:

test at tests/e2e/tier2-boundary-corner/b19_m1_adversarial_stress.test.ts:100:11
✖ test_b19_col_calculator_empty_crew_zero_division_vulnerability (0.765959ms)
  AssertionError [ERR_ASSERTION]: VULNERABILITY DETECTED: ColEngine produced non-finite whatIfColSavings: NaN (colEngine.ts:302 zero-division on crewHoursPlan=0)

test at tests/e2e/tier2-boundary-corner/b19_m1_adversarial_stress.test.ts:154:11
✖ test_b19_col_bonus_sheet_no_hardcoded_financial_defaults (0.357416ms)
  AssertionError [ERR_ASSERTION]: ColBonusSheet.tsx contains hardcoded mock salesAop (310000 PLN) instead of 0 or dynamic AOP
  true !== false

ℹ tests 269
ℹ suites 0
ℹ pass 266
ℹ fail 3
```

### 1.2 Zero-Division `NaN` Vulnerability in `colEngine.ts:302`
In `src/modules/col-calculator/services/colEngine.ts` lines 301–305:
```ts
301:     const hoursSaved = Math.max(0, totalWorkingHoursPlan - hoursWithImprovedTplh);
302:     const avgCrewHourlyCost = totalWorkingHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
303:     const whatIfColSavings = hoursSaved * avgCrewHourlyCost;
304:     const whatIfColPctInfluence = kpis.salesTarget > 0 ? (whatIfColSavings / kpis.salesTarget) * 100 : 0;
```
When a store initializes or syncs scheduled managers from Module 2, `totalWorkingHoursPlan > 0` (e.g. 160h). However, because mock baristas were purged in F2 (`DEFAULT_COL_CREW_UOP = []`, `DEFAULT_COL_CREW_UZ = []`), `crewHoursPlan === 0`.
Because line 302 tests `totalWorkingHoursPlan > 0` instead of `crewHoursPlan > 0`, it computes `0 / 0 = NaN`.
Consequently:
- `whatIfColSavings = NaN`
- `whatIfColPctInfluence = NaN`
Downstream in `src/modules/col-calculator/components/ColSpreadsheetGrid.tsx:297-300`, calling `fmtPln(summary.whatIfColSavings)` renders `"NaN zł"` and `(-summary.whatIfColPctInfluence).toFixed(2)` renders `"-NaN pp"`.

### 1.3 Unpurged Mock Financial Numbers in `ColBonusSheet.tsx:5-8`
In `src/modules/col-calculator/components/ColBonusSheet.tsx` lines 5–8:
```tsx
5:   const [salesAop, setSalesAop] = useState<number>(310000);
6:   const [salesActual, setSalesActual] = useState<number>(315000);
7:   const [profitAop, setProfitAop] = useState<number>(45000);
8:   const [profitActual, setProfitActual] = useState<number>(47000);
```
These hardcoded mock numbers (310k PLN sales, 315k PLN actuals, 45k PLN profit, 47k PLN actuals) remain in production UI, directly violating requirement F2 ("Purge mock data: No placeholder AI filler texts, fake employee records, or mock financial numbers exist in production UI views").

### 1.4 Hardcoded `"Janki"` in `electron/importer/mapalParser.ts:349-350`
In `electron/importer/mapalParser.ts` lines 348–351:
```ts
348:       const message = previousCount > 0
349:         ? `Pomyślnie zaktualizowano logowania: zastąpiono ${previousCount} dotychczasowych wpisów i zapisano ${validRecords.length} aktualnych rekordów dla kawiarni Janki (zakres: ${minDate} – ${maxDate}).`
350:         : `Pomyślnie zaimportowano ${validRecords.length} nowych logowań dla kawiarni Janki w zakresie od ${minDate} do ${maxDate}.`;
```
Even when importing records for a non-Janki store (e.g., Store 108144 Złote Tarasy or Store 108150 Bonarka), the return message hardcodes `"dla kawiarni Janki"`. While `UniversalReportParser` uses `${activeStoreName || 'aktywnej'}`, the legacy `MapalParser` was not updated.

### 1.5 Permissive Email Regex in Onboarding (`OnboardingWizardView.tsx:159`)
In `src/components/OnboardingWizardView.tsx` line 159:
```ts
const isEmailValid = /^[a-zA-Z0-9._%+-]+@amrest\.eu$/i.test(managerEmail.trim());
```
Stress testing in `tests/e2e/tier5-adversarial/m1_stress_challenge.test.ts` reveals that this regex permits consecutive dots in the email local-part (e.g. `"jan..kowalski@amrest.eu"`), which deviates from strict RFC 5322 format.

### 1.6 Onboarding Wizard & Importer Boundary Validations
Verified in `tests/e2e/tier5-adversarial/m1_stress_challenge.test.ts`:
- **Empty & whitespace rejection**: Correctly rejects empty names, whitespace-only names, names under 3 chars, and non-@amrest.eu domains.
- **Store selection validation**: Correctly rejects empty store configurations.
- **Clean launch state**: `StoreService.hasConfiguredStore()` returns `false` on an empty profile; `StoreService.getCurrentStore()` returns empty strings without falling back to Janki (108120).
- **Universal Importer with Non-Janki Store**: When active store is 108144 (Złote Tarasy), rows with unit 444 are imported cleanly with comma decimals ("7,5" -> 7.5), negative hours (-8.0) and NaN strings ("brak") are skipped, and foreign store rows (unit 999) are excluded. Zero hardcoded 18120/384 values are injected.
- **Source code scan**: Confirmed 0 occurrences of `"lorem ipsum"`, `"tutaj pojawi"`, `"w budowie (scratch)"`, `"ai placeholder"`, or `"dummy status"` across all production files in `src/`.

---

## 2. Logic Chain

1. **Observation 1.1** shows that running the required project command `npx tsx --test "tests/e2e/**/*.test.ts"` fails with exit code 1. A milestone cannot be approved when the acceptance test suite fails.
2. **Observation 1.2** proves that purging mock baristas in Milestone 1 caused an unhandled edge case in `colEngine.ts:302`: `crewHoursPlan === 0` while `totalWorkingHoursPlan > 0` causes division by zero, outputting `whatIfColSavings: NaN`. This breaks the UI contract in `ColSpreadsheetGrid.tsx`.
3. **Observation 1.3** confirms that `ColBonusSheet.tsx:5-8` still contains hardcoded dummy numbers (`310000`, `315000`, `45000`, `47000`), which contradicts the Milestone 1 F2 Acceptance Criterion ("No placeholder AI filler texts, fake employee records, or mock financial numbers exist in production UI views").
4. **Observation 1.4** confirms that `electron/importer/mapalParser.ts:349-350` still contains hardcoded `"dla kawiarni Janki"` in user-facing status messages, violating the F1/F5 requirement to parameterize all importers with active store metadata.
5. Therefore, while core onboarding flow, store switching isolation, and AI filler text elimination passed verification, the remaining defects invalidate full milestone approval.

---

## 3. Caveats

- `npm run build` succeeds cleanly without compiler errors.
- Legitimate historical mentions of store 108120 in `src/constants/changelog.ts` and `src/components/InteractiveModelTutorial.tsx` are expected and were excluded from defect scoring.
- Store 108120 CH Janki is legitimately present in `src/constants/starbucksStores.ts` as part of the 100+ stores catalog so users can select it during onboarding.

---

## 4. Conclusion

**Verdict: REJECT.**

The worker must address the following three defects before Milestone 1 can be approved:
1. **Fix zero-division in `src/modules/col-calculator/services/colEngine.ts:302`**:
   Replace:
   ```ts
   const avgCrewHourlyCost = totalWorkingHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
   ```
   With:
   ```ts
   const avgCrewHourlyCost = crewHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
   ```
2. **Purge mock numbers in `src/modules/col-calculator/components/ColBonusSheet.tsx:5-8`**:
   Change initial state values for `salesAop`, `salesActual`, `profitAop`, and `profitActual` to `0`.
3. **Fix hardcoded store name in `electron/importer/mapalParser.ts:349-350`**:
   Replace `"dla kawiarni Janki"` with dynamic active store identifier `${activeStoreName || 'aktywnej'}`.

---

## 5. Verification Method

1. Run the test suite:
   ```bash
   npx tsx --test "tests/e2e/**/*.test.ts"
   ```
   *Current state*: Fails with exit code 1 (3 failing tests in `b19` and Tier 5).  
   *Passing criterion*: All 269 tests pass with exit code 0.
2. Run build:
   ```bash
   npm run build
   ```
   *Passing criterion*: Exits with code 0.
3. Check `ColBonusSheet.tsx`:
   Inspect lines 5–8 to confirm initial state is `0`.
4. Check `colEngine.ts`:
   Inspect line 302 to confirm `crewHoursPlan > 0` guard.
5. Check `mapalParser.ts`:
   Inspect lines 349–350 to confirm `${activeStoreName || 'aktywnej'}` is used instead of `"dla kawiarni Janki"`.
