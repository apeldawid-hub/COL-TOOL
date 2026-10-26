# BRIEFING — 2026-10-24T02:22:00Z

## Mission
Adversarially and empirically stress-test Milestone 1: clean launch state, empty profile handling, multiple store switches, and COL Calculator zero-state rendering.

## 🔒 My Identity
- Archetype: challenger
- Roles: critic, specialist
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_challenger_1
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: Milestone 1
- Instance: 1 of 2

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code
- Empirical verification mandatory — write/run tests directly
- No test/source code in .agents/teamwork/

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: 2026-10-24T02:12:58Z

## Review Scope
- **Files reviewed**:
  - `src/services/storeService.ts`
  - `src/constants/starbucksStores.ts`
  - `src/modules/col-calculator/services/colEngine.ts`
  - `src/modules/col-calculator/services/colDefaultData.ts`
  - `src/modules/col-calculator/components/ColBonusSheet.tsx`
  - `src/modules/col-calculator/components/ColCalculatorView.tsx`
  - `src/modules/col-calculator/components/ColSpreadsheetGrid.tsx`
  - `electron/database/db.ts`
  - `tests/e2e/tier2-boundary-corner/b19_m1_adversarial_stress.test.ts`
- **Interface contracts**: /Users/dawidapel/COL Tool/PROJECT.md
- **Review criteria**: Clean launch state, empty profile handling, multiple store switches, COL Calculator zero-state rendering, zero division / NaN prevention

## Attack Surface
- **Hypotheses tested**:
  1. Clean launch empty profile produces silent fallback to Janki 108120 -> REFUTED (StoreService cleanly returns empty strings and hasConfiguredStore() = false; DEFAULT_STORE_ID is deleted).
  2. Multiple store switches leak 108120/18120 into storage -> REFUTED (Store switching cleanly updates unitCode and mpk without retaining Janki keys).
  3. Purging mock baristas causes zero-division / NaN in COL Calculator when managers have hours -> CONFIRMED VULNERABILITY (`colEngine.ts:302` divides by `crewHoursPlan === 0` when `totalWorkingHoursPlan > 0`, causing `whatIfColSavings` and `whatIfColPctInfluence` to evaluate to `NaN` and render `-NaN pp` / `NaN zł` in `ColSpreadsheetGrid.tsx:298`).
  4. Mock financial numbers completely purged from UI views -> REFUTED (`ColBonusSheet.tsx:5-8` still contains hardcoded mock values: salesAop=310000, salesActual=315000, profitAop=45000, profitActual=47000).
- **Vulnerabilities found**:
  - BUG-M1-01: Zero division / NaN crash in `ColEngine.calculate()` at `colEngine.ts:302`.
  - BUG-M1-02: Hardcoded mock financial numbers in `ColBonusSheet.tsx:5-8`.
- **Untested angles**:
  - Offline Electron SQLite IPC concurrent store switching (covered by M2/LRU pool tests).

## Loaded Skills
- None specified in dispatch

## Key Decisions Made
- Added empirical test suite `tests/e2e/tier2-boundary-corner/b19_m1_adversarial_stress.test.ts` proving the zero-division vulnerability and mock number presence.
- Issued verdict: REJECT due to 2 verified regressions.

## Artifact Index
- DISPATCH.md — Dispatch history
- progress.md — Liveness heartbeat
- handoff.md — Final verdict and report (REJECT)
- tests/e2e/tier2-boundary-corner/b19_m1_adversarial_stress.test.ts — Empirical reproduction test harness
