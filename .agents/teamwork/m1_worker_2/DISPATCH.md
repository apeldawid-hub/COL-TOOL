# DISPATCH: Milestone 1 Worker 2 (Replacement Worker)

Your working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_2
Role: teamwork_preview_worker
Original Request: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Project Root: /Users/dawidapel/COL Tool
Project Architecture: /Users/dawidapel/COL Tool/PROJECT.md

## Context & Interruption Point
You are replacing m1_worker_1, which was interrupted by a system timeout during Feature F2.
Previous progress log: `/Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_1/progress.md`.
Blueprints from Explorers:
- `/Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1/handoff.md` (Features F1 & F3: UI store fallbacks, modals, storeService, AI filler text removal)
- `/Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_2/handoff.md` (Feature F2: Mock data purge in db.ts, colDefaultData.ts, adminService.ts, authService.ts)
- `/Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3/handoff.md` (Features F4 & F5: Clean launch onboarding flow in db.ts/main.ts/App.tsx, and SQL parameterization)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Tasks to Complete from Interruption Point
1. **Resume Feature F2 (Mock Data Purge)**:
   - Check `db.ts` to confirm `seedDemoManagerTeamAndShifts`, `seedMonthlyRosters`, `getTrainingPartners` mock auto-seed removals are intact.
   - Clean `src/modules/col-calculator/services/colDefaultData.ts`: zero `DEFAULT_COL_KPIS`, empty `DEFAULT_COL_CREW_UOP` and `DEFAULT_COL_CREW_UZ` (`[]`), zero other costs, keep special payroll rows with 0s.
   - Clean `src/modules/col-calculator/components/ColVacationReserveSheet.tsx`: clean `initialDaysMap` and `-127` brutto reserve.
   - Clean `src/services/admin/adminService.ts`: replace `initDefaults()` mock users, requests, and logs with empty arrays `[]`. Clean `AdminConsoleModal.tsx`.
   - Clean `src/services/auth/authService.ts`: remove hardcoded `'18120'` defaults and mock user creation in `quickLoginStoreManager()`.
   - Clean `src/services/firebaseTelemetryService.ts`: empty `getDefaultLocalData()` (`[]`).
2. **Feature F4 (Clean Launch Store Onboarding Flow)**:
   - In `src/App.tsx`, `src/services/storeService.ts`, and `src/components/OnboardingWizardView.tsx`: ensure fresh launch with empty profile displays `OnboardingWizardView`. Ensure completing onboarding activates the chosen store and initializes its clean database.
3. **Features F1 & F3 (Static Store Fallbacks Elimination & AI Filler Removal)**:
   - `src/constants/starbucksStores.ts`: remove hardcoded Janki `DEFAULT_STORE_ID`.
   - `src/services/storeService.ts`: remove hardcoded Janki fallbacks (`108120`, `18120`, `SBX Warszawa Janki`), support clean/unconfigured store profile.
   - Remove hardcoded store codes ('18120', '108120', '384') across UI views and modals: `DashboardView.tsx`, `UnifiedSettingsModal.tsx`, `AopManagerModal.tsx`, `FloorHoursModal.tsx`, `ManagerLaborBridgeModal.tsx`, `ImportModal.tsx`, `ColCalculatorView.tsx`, `AutoScheduleModal.tsx`, `ManagerScheduleGrid.tsx`, `RcpAbsenceConflictDialog.tsx`, `AppUpdateModal.tsx`.
   - `DashboardView.tsx`: replace lines 255-279 AI placeholder text with clean, production-grade quick action cards and real summary stats.
   - `ModulePlaceholderView.tsx`: clean operational empty states.
4. **Verification**:
   - Run `npm run build` and ensure clean 0-error TypeScript and Vite compilation.
   - Run `npx tsx --test "tests/e2e/**/*.test.ts"` to verify test compatibility.
   - Document all modified files and build verification output in `/Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_2/handoff.md`.


## 2026-10-24T01:40:31Z
You are m1_worker_2, the replacement worker for Milestone 1.
Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_2
Read /Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_2/DISPATCH.md, /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md, /Users/dawidapel/COL Tool/PROJECT.md, and the explorer blueprints:
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1/handoff.md
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_2/handoff.md
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_3/handoff.md
Also inspect /Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_1/progress.md for interruption state.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Resume and complete:
1. Feature F2: Purge mock data in colDefaultData.ts, ColVacationReserveSheet.tsx, adminService.ts, authService.ts, firebaseTelemetryService.ts.
2. Feature F4: Clean launch store onboarding flow in App.tsx, storeService.ts, OnboardingWizardView.tsx.
3. Feature F1 & F3: Remove static store fallbacks in starbucksStores.ts, storeService.ts, and UI components/modals. Replace AI filler texts in DashboardView.tsx.
4. Verify: Run `npm run build` (0 errors) and `npx tsx --test "tests/e2e/**/*.test.ts"`.
Write handoff.md when done and report back.
