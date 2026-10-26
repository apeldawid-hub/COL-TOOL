# DISPATCH: Milestone 1 Worker (Implementation)

Your working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_1
Role: teamwork_preview_worker
Original Request: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Project Root: /Users/dawidapel/COL Tool
Project Architecture: /Users/dawidapel/COL Tool/PROJECT.md

## Reference Blueprints from Explorers
Read these 3 handoff reports carefully — they contain the exact file-by-file line numbers, before/after code blocks, and instructions:
1. `/Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1/handoff.md` (Features F1 & F3: UI store fallbacks, modals, storeService, AI filler text removal)
2. `/Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_2/handoff.md` (Feature F2: Mock data purge in db.ts, colDefaultData.ts, adminService.ts, authService.ts)
3. `/Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3/handoff.md` (Features F4 & F5: Clean launch onboarding flow in db.ts/main.ts/App.tsx, and SQL parameterization in main.ts/importers)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Tasks to Implement
1. **F1: Static Store Fallbacks Elimination**:
   - `src/constants/starbucksStores.ts`: Remove hardcoded Janki `DEFAULT_STORE_ID`.
   - `src/services/storeService.ts`: Remove hardcoded Janki fallbacks (`108120`, `18120`, `SBX Warszawa Janki`), support clean/unconfigured store profile.
   - Remove hardcoded store codes ('18120', '108120', '384') across UI views and modals: `DashboardView.tsx`, `UnifiedSettingsModal.tsx`, `AopManagerModal.tsx`, `FloorHoursModal.tsx`, `ManagerLaborBridgeModal.tsx`, `ImportModal.tsx`, `ColCalculatorView.tsx`, `AutoScheduleModal.tsx`, `ManagerScheduleGrid.tsx`, `RcpAbsenceConflictDialog.tsx`, `AppUpdateModal.tsx`.
2. **F2: Mock Data & Fake Rosters Purge**:
   - `electron/database/db.ts`: Remove auto-seeding of mock manager teams and shifts (`seedDemoManagerTeamAndShifts`), remove mock monthly rosters (`seedMonthlyRosters`), remove auto-injection of mock training partners in `getTrainingPartners()`.
   - `src/modules/col-calculator/services/colDefaultData.ts`: Zero default KPIs, empty `DEFAULT_COL_CREW_UOP` and `DEFAULT_COL_CREW_UZ`, zero other costs, keep special payroll rows with 0s.
   - `src/services/admin/adminService.ts`: Clear mock managed users, pending access requests, and mock security audit logs in `initDefaults()` to empty arrays (`[]`).
   - `src/services/auth/authService.ts`: Remove hardcoded `'18120'` defaults and mock user creation in `quickLoginStoreManager()`.
   - `src/services/firebaseTelemetryService.ts`: Empty `getDefaultLocalData()` (`[]`).
3. **F3: AI Filler Text Elimination**:
   - `src/components/DashboardView.tsx`: Replace lines 255–279 AI placeholder text with clean, production-grade quick action cards and real summary stats.
   - `src/components/ModulePlaceholderView.tsx`: Replace Janki-specific text with neutral, professional module descriptions.
4. **F4: Clean Launch Store Onboarding Wizard**:
   - `electron/database/db.ts`: Remove default `currentStoreId = '108120_janki'`. Do not auto-seed Janki AOP plans or shifts when `active_store.json` does not exist.
   - `electron/main.ts`: In `db:get-app-settings`, fix `hasCompletedOnboarding` so it checks only the explicit `onboarding_completed` setting in SQLite / settings file, NOT `|| hasData`.
   - `src/App.tsx`: On fresh launch with empty profile, ensure `hasCompletedOnboarding` is false so `OnboardingWizardView` is displayed. Ensure completing onboarding saves the chosen store and initializes its clean database.
5. **F5: Parameterized Electron SQL & Importers**:
   - `electron/main.ts`: In `db:get-actual-hours-for-month`, `db:get-daily-actual-hours-for-month`, `db:save-floor-rules`, and `db:get-day-of-week-stats`, replace hardcoded `WHERE (unit_code = '18120' OR unit_code = '384'...)` with parameterized queries matching active store's `unit_code`, `mpk`, and `unit_name`.
   - `electron/importer/mapalParser.ts` and `universalReportParser.ts`: Replace hardcoded `isJanki` heuristic with dynamic match on active store identifiers.

## Verification Requirements
After completing all modifications:
1. Run `npm run build` to verify clean TypeScript compilation and Vite build with 0 errors.
2. Run any existing unit tests (`npm test` if configured or node test scripts).
3. Document all modified files and build verification output in `/Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_1/handoff.md`.


## 2026-10-24T00:39:08Z
[Message] timestamp=2026-10-24T00:39:08Z sender=53bb484f-c139-4c15-89f6-7d840b96f7e4 priority=MESSAGE_PRIORITY_HIGH content=You are m1_worker_1 for Milestone 1: Deep Codebase Audit, Mock Purge & Onboarding Flow.
Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_1
Read /Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_1/DISPATCH.md, /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md, /Users/dawidapel/COL Tool/PROJECT.md, and the 3 explorer reports:
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1/handoff.md
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_2/handoff.md
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Execute the tasks:
1. F1: Remove static store fallbacks across UI components, modals, and storeService.
2. F2: Purge mock data, fake manager teams/salaries in db.ts, mock baristas in colDefaultData.ts, fake training partners, and mock admin users.
3. F3: Eliminate AI placeholder text in DashboardView.tsx and ModulePlaceholderView.tsx.
4. F4: Clean launch store onboarding flow: fix db.ts initialization, main.ts, and App.tsx so empty profiles trigger OnboardingWizardView.
5. F5: Parameterize all Electron SQL queries in main.ts and importers.

Verify your changes:
- Run `npm run build` and ensure clean 0-error TypeScript and Vite compilation.
- Maintain progress.md with timestamped heartbeats.
- Write handoff.md with verification commands and results, then send a message back.
