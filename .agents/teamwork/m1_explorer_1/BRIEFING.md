# BRIEFING — 2026-10-24T00:37:00Z

## Mission
Formulate exact implementation instructions for Features F1 (Static store fallbacks elimination) and F3 (AI filler text removal) across UI components, modals, and storeService.

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: explorer, investigator, synthesizer
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: Milestone 1

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Focus on eliminating static store codes ('18120', '108120', '384', 'Janki') and AI filler texts across UI components, modals, and storeService
- Write recommendations to handoff.md following the 5-Component Handoff Protocol

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: 2026-10-24T00:26:38Z

## Investigation State
- **Explored paths**:
  - `src/constants/starbucksStores.ts`
  - `src/services/storeService.ts`
  - `src/components/DashboardView.tsx`
  - `src/components/UnifiedSettingsModal.tsx`
  - `src/modules/labor-forecast/components/` (AopManagerModal, FloorHoursModal, ManagerLaborBridgeModal, ImportModal, LaborForecastView, SettingsModal)
  - `src/modules/col-calculator/components/` (ColCalculatorView, ColUserGuideSheet) and `colDefaultData.ts`
  - `src/modules/managers-schedule/components/` (AutoScheduleModal, ManagerScheduleGrid, RcpAbsenceConflictDialog, InterStoreSupportModal)
  - `src/modules/managers-schedule/services/` (managerExcelExport, autoSchedulerEngine)
  - `src/components/ModulePlaceholderView.tsx`
  - `src/components/OnboardingWizardView.tsx`, `AppUpdateModal.tsx`, `NotificationsSettingsTab.tsx`, `NotificationsView.tsx`, `DatabaseBackupModal.tsx`, `AdminConsoleModal.tsx`, `App.tsx`
- **Key findings**:
  - Identified exact lines and replacement chunks across 15+ UI components and services.
  - Formulated dynamic binding via `useStore()` and `currentStore` (`name`, `shortName`, `unitCode`, `mpk`).
  - Formulated clean empty-state replacements for AI filler texts in DashboardView, ModulePlaceholderView, and modals.
- **Unexplored areas**: None within the F1 & F3 UI/storeService scope.

## Key Decisions Made
- Replace `DEFAULT_STORE_ID = '108120'` in `starbucksStores.ts` and eliminate static fallback object in `storeService.getCurrentStore()`, returning an unconfigured profile prior to onboarding.
- Standardize all UI components to read active store metadata from `useStore()` (`currentStore`).
- Parameterize or clean hardcoded unit checks in `ImportModal.tsx`, `ManagerScheduleGrid.tsx`, and `RcpAbsenceConflictDialog.tsx`.
- Replace AI placeholder text in `DashboardView.tsx` lines 255-279 and `ModulePlaceholderView.tsx` with professional operational empty states.

## Artifact Index
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1/DISPATCH.md — Task assignment
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1/BRIEFING.md — Persistent memory
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1/progress.md — Progress heartbeat
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1/handoff.md — Final handoff report
