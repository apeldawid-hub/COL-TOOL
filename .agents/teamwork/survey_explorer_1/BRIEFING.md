# BRIEFING — 2026-10-24T00:24:00Z

## Mission
Deep Codebase Audit & Data Hygiene Exploration (Requirement R1): Enumerate hardcoded store codes ('18120', '108120', '384'), AI filler texts, fake mock employee records, mock financial numbers, and examine app startup/onboarding flow.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: explorer, auditor, data hygiene analyst
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_1
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: Survey & Audit Phase

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Must provide exact file paths, line numbers, and verbatim occurrences
- Files for content delivery, messages for coordination
- Follow Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method)

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: 2026-10-24T00:24:00Z

## Investigation State
- **Explored paths**:
  - `src/constants/starbucksStores.ts`, `src/services/storeService.ts`, `src/context/StoreContext.tsx`
  - `electron/database/db.ts`, `electron/main.ts`, `electron/importer/mapalParser.ts`, `electron/importer/universalReportParser.ts`
  - `src/App.tsx`, `src/components/OnboardingWizardView.tsx`, `src/components/DashboardView.tsx`, `src/components/UnifiedSettingsModal.tsx`, `src/components/Header.tsx`, `src/components/AppUpdateModal.tsx`, `src/components/admin/AdminConsoleModal.tsx`, `src/components/ModulePlaceholderView.tsx`
  - `src/modules/col-calculator/services/colDefaultData.ts`, `src/modules/col-calculator/components/ColCalculatorView.tsx`
  - `src/modules/labor-forecast/components/AopManagerModal.tsx`, `FloorHoursModal.tsx`, `ImportModal.tsx`, `ManagerLaborBridgeModal.tsx`, `SettingsModal.tsx`
  - `src/modules/managers-schedule/components/AutoScheduleModal.tsx`, `ManagerScheduleGrid.tsx`, `services/managerExcelExport.ts`
  - `src/services/admin/adminService.ts`, `src/services/auth/authService.ts`, `src/services/firebaseTelemetryService.ts`, `src/services/cloudNotificationService.ts`, `src/services/desktopNotificationService.ts`
  - `firebase/firestore.rules`
- **Key findings**:
  - Found over 30 files containing hardcoded references to '18120', '108120', '384', and 'Janki'.
  - Found critical hardcoded SQL queries in `electron/main.ts`, `mapalParser.ts`, `universalReportParser.ts` that specifically filter for unit 18120/384.
  - Found mock employee rosters, salary data, and attendance records seeded in `electron/database/db.ts` (`seedDemoManagerTeamAndShifts`, `seedMonthlyRosters`, `getTrainingPartners`), `src/modules/col-calculator/services/colDefaultData.ts`, and `src/services/admin/adminService.ts`.
  - Discovered root cause of bypassed onboarding on fresh launch: `DatabaseManager.init()` creates `tplh_forecast.db`, runs `seedInitialData()` with Janki data, causing `hasExistingData()` to return true, which forces `sbx_onboarding_completed: 'true'` in SQLite, completely suppressing the Onboarding Wizard.
- **Unexplored areas**: None for R1 audit scope.

## Key Decisions Made
- Structured the complete audit into 3 detailed categories: (1) Hardcoded Store Codes & SQL Filters, (2) Mock Data & AI Placeholders, and (3) App Startup / Store Onboarding Bypass Mechanism.
- Formulated an actionable architecture proposal for tenant isolation and clean onboarding.

## Artifact Index
- /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_1/DISPATCH.md — Task assignment
- /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_1/progress.md — Heartbeat and status
- /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_1/handoff.md — Final deliverable report
