# BRIEFING — 2026-10-24T00:22:00Z

## Mission
Investigate current SQLite database architecture, store configuration & registry, state isolation, and design scalable multi-store (100+ stores) architecture with clean cache invalidation and zero data leakage.

## 🔒 My Identity
- Archetype: explorer
- Roles: survey_explorer_2, multi-store architecture analyst
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/survey_explorer_2
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: Requirement R2 - Scalable Multi-Store Architecture (100+ Stores)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Output is written strictly to .agents/teamwork/survey_explorer_2/
- Maintain progress.md heartbeat
- Self-contained 5-component handoff.md

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `electron/database/db.ts`, `electron/database/backupManager.ts`, `electron/main.ts`, `electron/preload.ts`
  - `src/services/storeService.ts`, `src/constants/starbucksStores.ts`, `src/context/StoreContext.tsx`
  - `src/App.tsx`, `src/components/StoreSwitcherModal.tsx`, `src/components/DatabaseBackupModal.tsx`, `src/components/OnboardingWizardView.tsx`
  - `src/modules/labor-forecast/`, `src/modules/managers-schedule/`, `src/modules/trainings/`, `src/modules/col-calculator/`
  - `src/services/todoService.ts`, `src/services/desktopNotificationService.ts`, `src/services/cloudNotificationService.ts`, `src/services/sync/syncEngine.ts`, `src/services/admin/adminService.ts`, `src/services/auth/authService.ts`
  - `firestore.rules`, `.agents/skills/sqlite-guardian/SKILL.md`
- **Key findings**:
  1. SQLite is implemented via `sql.js` (WebAssembly SQLite in-memory with file persist). DatabaseManager has a single `db: Database | null` pointer with synchronous file export (`db.export()`).
  2. Naming asymmetry: store 108120 uses `tplh_forecast.db`, while new stores use `store_${safeId}.db`. If store 108120 is requested without storeInfo, it diverges to `store_108120.db`.
  3. No connection pooling or concurrency protection in Electron: switching closes and nulls `this.db`, causing any concurrent IPC query to fail or write to the wrong database.
  4. React views (`ManagerScheduleView`, `TrainingsView`, `ColCalculatorView`) lack `key={currentStore.id}` and do NOT subscribe to store change events, keeping stale in-memory state after store switch and risking cross-store data corruption upon write.
  5. Services (`TodoService`, `DesktopNotificationService`, `SyncEngine`, `AdminService`) use unpartitioned global `localStorage` keys (`sbx_sm_tasks_v1`, `sbx_desktop_notifications_v1`, `sbx_sync_outbox`), causing cross-store data leakage.
  6. `BackupManager` uses a global prefix `tplh_forecast_` and unpartitioned backups directory, allowing backups of Store A to overwrite Store B on restore.
- **Unexplored areas**: None. All core exploration areas required for R2 have been analyzed.

## Key Decisions Made
- Formulate a 5-pillar architectural design for R2:
  1. Standardized `store_${id}.db` schema and automated migration from `tplh_forecast.db`.
  2. LRU Connection Pool & Mutex Queue in Electron for 100+ stores with debounced dirty writes.
  3. Store-scoped storage partitioning (`sbx_store_${id}_*`) across all singleton services.
  4. React Lifecycle Invalidation with `key={currentStore.id}` and clean transition guards in `App.tsx`.
  5. Store-partitioned backup manager (`backups/db_backups/${storeId}/`).

## Artifact Index
- DISPATCH.md — Task dispatch and instructions
- progress.md — Liveness heartbeat and milestone tracking
- handoff.md — Final investigation report
