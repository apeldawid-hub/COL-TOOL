# BRIEFING — 2026-10-26T16:52:00Z

## Mission
Survey Explorer 2: Deep technical survey of the Dual-Profile Runtime Architecture (Master HQ vs Store Client) (R2), including App.tsx, navigation, StoreContext, AuthContext, storeService, FleetMasterDashboard, and StoreClientView restrictions.

## 🔒 My Identity
- Archetype: explorer
- Roles: survey, code analysis, architecture design
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/survey_fleet_explorer_2
- Original parent: bc820f6a-3865-4f82-8517-3240379a0b72
- Milestone: Survey & Architectural Design for Dual-Profile Runtime Architecture (R2)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code files
- Output comprehensive survey report in `/Users/dawidapel/COL Tool/.agents/teamwork/survey_fleet_explorer_2/survey_report.md`
- Maintain progress.md with timestamp heartbeats
- Send final completion message to orchestrator `bc820f6a-3865-4f82-8517-3240379a0b72`

## Current Parent
- Conversation ID: bc820f6a-3865-4f82-8517-3240379a0b72
- Updated: not yet

## Investigation State
- **Explored paths**:
  * `ORIGINAL_REQUEST.md` (Follow-up 2026-10-26T16:11:59Z)
  * `PROJECT.md` & `AGENTS.md`
  * `src/App.tsx`
  * `src/context/StoreContext.tsx`
  * `src/constants/starbucksStores.ts` (1527 lines, 100+ stores catalog)
  * `src/services/storeService.ts`
  * `src/components/Sidebar.tsx` & `src/components/Header.tsx`
  * `src/components/StoreSwitcherModal.tsx`
  * `src/components/admin/AdminConsoleModal.tsx` & `src/services/admin/adminService.ts`
  * `src/components/FirebaseFleetPanel.tsx` & `src/services/firebaseTelemetryService.ts`
  * `src/components/UnifiedSettingsModal.tsx` & `src/components/DatabaseBackupModal.tsx`
  * `src/services/sync/syncEngine.ts`
  * `firestore.rules` & `src/services/security/vaultService.ts`
  * `electron/preload.ts` & `electron/main.ts`
  * Peer reports: `survey_fleet_explorer_1/survey_report.md`, `survey_fleet_explorer_3/progress.md`
- **Key findings**:
  * Single runtime profile currently allows any user to freely browse and switch to any of the 100+ stores in Poland.
  * Store users are exposed to dangerous developer tools: Clean Slate database reset, raw package export/import, PRAGMA check, VACUUM, and nationwide telemetry tabs (`firebase_fleet`, `testing_guide`).
  * `appMode: 'FLEET_MASTER' | 'STORE_CLIENT'` cleanly segregates capabilities:
    - `STORE_CLIENT`: locks store selector to `assignedStoreIds` (e.g. `108120`), purges developer tabs and destructive buttons, introduces `CloudSyncIndicator` one-click sync, and packages the workspace into `StoreClientView.tsx`.
    - `FLEET_MASTER`: provides `FleetMasterDashboard.tsx` with 100+ store health overview, license generator (`SBX-<storeId>-<randomHex>-<checksum>`), remote Kill-Switch lockdown, security audit trail, and release telemetry.
  * Integration requires: new `AuthContext.tsx`, new `src/types/fleet.ts`, new `fleetService.ts`, new `FleetMasterDashboard.tsx`, new `StoreClientView.tsx`, new `CloudSyncIndicator.tsx`, new `StoreStationInfoModal.tsx`, and scoped refactoring of `StoreContext.tsx` and navigation components.
- **Unexplored areas**: None within scope. All R2 architectural items thoroughly investigated and documented.

## Key Decisions Made
- AuthContext will serve as the single source of truth for runtime `appMode`, station activation, and session state.
- StoreContext will consume AuthContext and enforce tenant boundary filtering on `availableStores` and `switchStore()`.
- FleetMasterDashboard will be a dedicated view with 5 tabs: Catalog, Licensing, Kill-Switch, Audit Trail, and Release Management.
- StoreClientView will feature a non-clickable/info-only store badge and a friendly one-click cloud sync indicator.

## Artifact Index
- `DISPATCH.md` — Parent dispatch recording
- `BRIEFING.md` — Persistent working memory
- `progress.md` — Heartbeat and step tracking
- `survey_report.md` — Exhaustive architectural specification and modification inventory
- `handoff.md` — 5-component self-contained handoff report
