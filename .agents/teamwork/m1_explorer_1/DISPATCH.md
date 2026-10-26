# DISPATCH: Milestone 1 Explorer 1 (UI & Components Hardcoded Fallbacks & AI Fillers)

Your working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1
Role: teamwork_preview_explorer
Original Request: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Project Root: /Users/dawidapel/COL Tool
Project Architecture: /Users/dawidapel/COL Tool/PROJECT.md
Survey 1 Handoff: /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_1/handoff.md

## Scope: Features F1 & F3
Focus on eliminating all static store codes ('18120', '108120', '384', 'Janki') and AI filler texts across UI components:
- `src/constants/starbucksStores.ts` (remove hardcoded Janki DEFAULT_STORE_ID)
- `src/services/storeService.ts` (eliminate hardcoded Janki fallbacks in getCurrentStore, getAllStores)
- `src/components/DashboardView.tsx` (remove hardcoded headers and AI placeholder text lines 255-279)
- `src/components/UnifiedSettingsModal.tsx` (remove static Janki badges and localStorage fallbacks)
- `src/modules/labor-forecast/components/` (AopManagerModal, FloorHoursModal, ManagerLaborBridgeModal, ImportModal)
- `src/modules/col-calculator/components/` (ColCalculatorView hardcoded storeCode 18120 in loadBridgeData)
- `src/modules/managers-schedule/components/` (AutoScheduleModal, ManagerScheduleGrid, RcpAbsenceConflictDialog)
- `src/components/ModulePlaceholderView.tsx` (clean empty states)

Produce an exact implementation blueprint (file by file, replacement lines) for the Worker to execute.
Write your findings to `/Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1/handoff.md`.


## 2026-10-24T00:26:38Z
[Message] sender=53bb484f-c139-4c15-89f6-7d840b96f7e4
You are m1_explorer_1 for Milestone 1.
Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1
Read /Users/dawidapel/COL Tool/.agents/teamwork/m1_explorer_1/DISPATCH.md, /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md, /Users/dawidapel/COL Tool/PROJECT.md, and /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_1/handoff.md.

Task: Formulate exact implementation instructions for Features F1 (Static store fallbacks elimination) and F3 (AI filler text removal) across UI components, modals, and storeService.
Maintain progress.md and write your recommendations to handoff.md.
