# DISPATCH: Milestone 1 Explorer 3 (Clean Launch Onboarding Flow & SQL Parameterization)

Your working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3
Role: teamwork_preview_explorer
Original Request: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Project Root: /Users/dawidapel/COL Tool
Project Architecture: /Users/dawidapel/COL Tool/PROJECT.md
Survey 1 Handoff: /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_1/handoff.md
Survey 2 Handoff: /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_2/handoff.md

## Scope: Features F4 & F5
Focus on:
1. F4: Clean Launch Store Onboarding Wizard:
   - In `electron/database/db.ts`: eliminate `currentStoreId = '108120_janki'`.
   - Prevent auto-seeding Janki data when `active_store.json` is missing.
   - Fix `hasExistingData()` and `hasCompletedOnboarding` in `electron/main.ts` and `src/App.tsx` so fresh launches without active store cleanly present `OnboardingWizardView`.
   - Ensure completing the wizard successfully saves the chosen store from the catalog and initializes that store's clean database.
2. F5: Parameterized Electron SQL & Importers:
   - In `electron/main.ts`: replace `WHERE (unit_code = '18120' OR unit_code = '384'...)` with parameterized queries using the active store's `unit_code` and `mpk`.
   - In `electron/importer/mapalParser.ts` and `universalReportParser.ts`: replace hardcoded `isJanki` matching with active store unit code comparison.

Formulate exact code modification instructions for the Worker.
Write your findings to `/Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3/handoff.md`.


## 2026-10-24T00:26:38Z
You are m1_explorer_3 for Milestone 1.
Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3
Read /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3/DISPATCH.md, /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md, /Users/dawidapel/COL Tool/PROJECT.md, /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_1/handoff.md, and /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_2/handoff.md.

Task: Formulate exact implementation instructions for Feature F4 (Clean launch onboarding flow) and Feature F5 (Parameterized Electron SQL & Importers).
Maintain progress.md and write your recommendations to handoff.md.
