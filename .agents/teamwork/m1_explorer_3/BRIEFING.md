# BRIEFING — 2026-10-24T00:37:00Z

## Mission
Formulate exact implementation instructions for Feature F4 (Clean launch onboarding flow) and Feature F5 (Parameterized Electron SQL & Importers).

## 🔒 My Identity
- Archetype: explorer
- Roles: [explorer, synthesis]
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: Milestone 1

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Scope restricted to Features F4 and F5
- Write all findings to handoff.md in working directory
- Send final completion message to caller via send_message

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: 2026-10-24T00:26:38Z

## Investigation State
- **Explored paths**:
  - `electron/database/db.ts` (constructor, init, computeDbFilePath, seedNewStoreData, hasExistingData, getAppSettings, seedInitialData)
  - `electron/main.ts` (app:get-settings, db:get-actual-hours-for-month, db:get-daily-actual-hours-map, db:save-floor-rules, db:get-day-of-week-stats)
  - `src/App.tsx` (checkOnboardingState, OnboardingWizardView.onComplete)
  - `src/components/OnboardingWizardView.tsx` (selectedStore state, step 2 validation, handleFinish)
  - `src/services/storeService.ts` (getCurrentStore, initStore, setCurrentStore, hasConfiguredStore)
  - `electron/importer/mapalParser.ts` (isJanki heuristic, default unit code, SQL counts, idempotency deletes, support queries)
  - `electron/importer/universalReportParser.ts` (isJanki heuristic, commitMapalReport, parseDailyKpiForPreview)
- **Key findings**:
  - In `db.ts`, `currentStoreId` defaulted to `'108120_janki'` on empty launch, auto-seeding Janki data and writing `sbx_onboarding_completed: 'true'`.
  - In `main.ts:174` and `App.tsx:78`, `|| hasData` / `|| hasExistingData` caused any populated database to bypass onboarding.
  - In `App.tsx:onComplete`, `StoreService.setCurrentStore` was never called, leaving the newly chosen store's database uninitialized.
  - In `main.ts` and importers, four SQL queries hardcode `unit_code = '18120' OR unit_code = '384'`, breaking all operations for non-Janki stores.
  - Importers dropped non-Janki barista logs due to hardcoded `isJanki` matching.
- **Unexplored areas**: None within F4/F5 scope; all investigated and resolved.

## Key Decisions Made
- Formulated exact before/after instructions for 8 targeted code modifications across `db.ts`, `main.ts`, `App.tsx`, `OnboardingWizardView.tsx`, `storeService.ts`, `mapalParser.ts`, and `universalReportParser.ts`.
- Verified build command (`npm run build`) passes cleanly.
- Authored 5-component handoff report in `handoff.md`.

## Artifact Index
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3/DISPATCH.md — Incoming task assignments
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3/progress.md — Liveness heartbeat and milestone tracking
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3/handoff.md — 5-component handoff report
