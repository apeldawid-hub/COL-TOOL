# BRIEFING — 2026-10-24T00:36:00Z

## Mission
Formulate exact implementation instructions for Feature F2 (Mock data & fake rosters purge) across db.ts, colDefaultData.ts, adminService.ts, and authService.ts.

## 🔒 My Identity
- Archetype: explorer
- Roles: [investigation, synthesis, teamwork_preview_explorer]
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_2
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: Milestone 1

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do NOT directly modify source code (except writing reports and metadata files in own folder)
- Produce exact implementation instructions for Feature F2 (Mock data & fake rosters purge)

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: 2026-10-24T00:36:00Z

## Investigation State
- **Explored paths**:
  * `electron/database/db.ts`: `seedDemoManagerTeamAndShifts()`, `seedMonthlyRosters()`, `getTrainingPartners()`, `seedInitialData()`
  * `src/modules/col-calculator/services/colDefaultData.ts`: `DEFAULT_COL_MANAGERS`, `DEFAULT_COL_CREW_UOP`, `DEFAULT_COL_CREW_UZ`, `DEFAULT_COL_KPIS`, `DEFAULT_COL_OTHER_COSTS`, `DEFAULT_COL_STORE_INFO`
  * `src/modules/col-calculator/components/ColVacationReserveSheet.tsx`: `initialDaysMap`, `prevMonthReserveBrutto`
  * `src/services/admin/adminService.ts`: `initDefaults()`
  * `src/components/admin/AdminConsoleModal.tsx`: Empty state messages
  * `src/services/auth/authService.ts`: `quickLoginStoreManager()`, `request2FaOtp()`, `registerPartner()`
  * `src/components/LoginView.tsx`: Store Manager card dynamic values
  * `src/services/firebaseTelemetryService.ts`: `getDefaultLocalData()`, `recordOrUpdateHeartbeat()`
  * Auxiliary files: `App.tsx`, `AopManagerModal.tsx`, `OnboardingWizardView.tsx`
- **Key findings**:
  * 28 named employees with real-looking compensation (up to 7,200 PLN salary) and mock hours in `colDefaultData.ts`.
  * Automatic injection of 2 fake baristas in `db.ts` `getTrainingPartners()` when table is empty.
  * 3 fake managed users, 1 request, and 1 security audit log seeded on clean profile in `adminService.ts`.
  * Fallback store manager `Dawid Apel` (`dawid.apel@amrest.eu`) hardcoded in `authService.ts` and `LoginView.tsx`.
  * 3 fake installations in `firebaseTelemetryService.ts`.
- **Unexplored areas**: None within the scope of Feature F2.

## Key Decisions Made
- Special rows in COL Calculator (`isSpecialRow: true`) represent structural payroll items; preserved with zeroed values (`baseSalary: 0, planBonus: 0, estBonus: 0`).
- Shift definitions (`shift_definitions`) and Labor Code norms (`manager_monthly_norms`) are standard statutory rules, not mock data; preserved.
- `quickLoginStoreManager()` dynamically queries `AdminService.getUsers()` first, then `localStorage`, before falling back to generic values.

## Artifact Index
- DISPATCH.md — Task dispatch and incoming instructions
- progress.md — Liveness heartbeat and progress log
- handoff.md — Final 5-component handoff report with exact implementation instructions for Worker
