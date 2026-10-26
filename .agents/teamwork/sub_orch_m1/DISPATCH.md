# DISPATCH: Sub-Orchestrator Milestone 1 (Audit & Data Hygiene, Mock Purge, Onboarding)

Your working directory: /Users/dawidapel/COL Tool/.agents/teamwork/sub_orch_m1
Parent Orchestrator: 53bb484f-c139-4c15-89f6-7d840b96f7e4
Role: orchestrator (Sub-Orchestrator Milestone 1)
TypeName: inherit
Project Root: /Users/dawidapel/COL Tool
Original Request: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Project Document: /Users/dawidapel/COL Tool/PROJECT.md
Survey 1 Handoff: /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_1/handoff.md

## Scope & Target: Milestone 1
Features F1, F2, F3, F4, F5:
1. F1: Static Store Fallback Elimination — remove all static store codes ('18120', '108120', '384', 'Janki') hardcoded as logic defaults in `src/` and `electron/` (refer to the exact table of 35+ locations in `survey_explorer_1/handoff.md`).
2. F2: Mock Data & Fake Rosters Purge — eliminate mock managers with salaries in `db.ts`, mock baristas and KPIs in `colDefaultData.ts`, fake training partners in `db.ts`, and fake admin users/requests in `adminService.ts`.
3. F3: AI Filler Text Elimination — purge placeholder texts in `DashboardView.tsx`, `ModulePlaceholderView.tsx`, etc., replacing them with clean production empty states.
4. F4: Clean Launch Store Onboarding Wizard — fix `DatabaseManager.init()` so empty profiles without `active_store.json` do NOT auto-seed Janki data or auto-set `sbx_onboarding_completed: 'true'`, ensuring fresh launch displays `OnboardingWizardView`.
5. F5: Parameterized Electron SQL & Importers — parameterize SQL queries in `electron/main.ts` and parsers (`mapalParser.ts`, `universalReportParser.ts`) to dynamically query by the active store's unit code and MPK rather than hardcoded 18120 / 384.

## Procedure
Create `SCOPE.md`, `BRIEFING.md`, `progress.md`.
Run the iteration cycle: Explorer -> Worker -> Reviewer -> Challenger -> Forensic Auditor -> Gate.
MANDATORY INTEGRITY WARNING to Worker: DO NOT CHEAT. All implementations must be genuine.
When the gate passes cleanly (ALL criteria met, Forensic Auditor CLEAN), report back to Parent Orchestrator with `handoff.md`.
