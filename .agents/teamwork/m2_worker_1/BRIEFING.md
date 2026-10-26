# BRIEFING — 2026-10-24T03:22:00Z

## Mission
Implement Milestone 2: Scalable Multi-Store Architecture for 100+ Stores (Features F6-F11) across database management, store catalog & switcher, React view state isolation, store-namespaced storage, and store-partitioned backup/restore.

## 🔒 My Identity
- Archetype: implementer
- Roles: implementer, qa, specialist
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m2_worker_1
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: M2 — Scalable Multi-Store Architecture (100+ Stores)

## 🔒 Key Constraints
- DO NOT CHEAT: Genuine implementations only, no hardcoded test results, facade implementations, or circumventing tasks.
- Maintain real state and real behavior.
- Strict multi-store isolation: SQLite files named `store_${safeId}.db`, backups named `store_${safeStoreId}_backup_*`, local storage partitioned by `sbx_store_${safeStoreId}_*`.
- Automated legacy migration for 108120 (tplh_forecast.db -> store_108120.db) with SHA-256 binary parity verification.
- Two-phase store transition event dispatch: `sbx:store-switching` and `sbx:store-switched`.
- Connection pooling with LRU eviction and dirty-write flush.
- Deep SQLite inspection in memory before restore to prevent cross-store restore disasters.
- Code layout compliance: only metadata in `.agents/teamwork/`.
- Must verify with `npm run build` and `npx tsx --test "tests/e2e/**/*.test.ts"`.

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: 2026-10-24T03:22:00Z

## Task Summary
- **What to build**:
  1. `electron/database/db.ts`: Uniform naming `store_${safeId}.db`, legacy migration with SHA-256 verification, AsyncMutex, StoreConnectionPool (LRU 8, dirty flush).
  2. `src/constants/starbucksStores.ts` & `src/components/StoreSwitcherModal.tsx`: 143 authentic stores catalog, normalizeDiacritics Polish diacritic folding, 120ms debounced search, virtualized card rendering (76px, overscan 3), keyboard navigation.
  3. `src/App.tsx`: React view state isolation (`key={'...-' + currentStore.id + '-' + activeModule}`) and two-phase store transition event dispatch with SaveShield debounced guards.
  4. `src/services/storeStorage.ts`: StoreStorage partitioned storage, 108120 migration, and reactive store-switched listeners in singletons (`todoService`, `desktopNotificationService`, `syncEngine`, `adminService`, `WeeklyScheduleTable`).
  5. `electron/database/backupManager.ts`: Store-partitioned backups, 15-backup retention pools per store, deep pre-restore SQLite inspection, store mismatch protection, pre-restore safety backups.
- **Success criteria**:
  - `npm run build` passes with 0 errors.
  - `npx tsx --test "tests/e2e/**/*.test.ts"` passes completely (269/269).
  - Zero cross-store leakage, seamless 108120 legacy migration, smooth 100+ stores UI.
- **Interface contracts**: PROJECT.md, AGENTS.md, m2_explorer_1,2,3 handoffs.
- **Code layout**: Electron database layer in `electron/database/`, frontend in `src/`.

## Key Decisions Made
- Implemented LRU 8 cache with dirty write-back flush in `StoreConnectionPool` to prevent memory bloat across 143 stores while ensuring zero data loss.
- Utilized DOM custom events (`sbx:store-switching` and `sbx:store-switched`) alongside `sbx-store-changed` to coordinate clean unmounts, flush in-flight debounces, and reload fresh store state.
- Aligned storage key format to `sbx_store_${storeId}_${key}` for exact compatibility with existing singletons and tests.
- Designed `backupManager.ts` to inspect buffer headers and SQLite master schemas in-memory before overwriting active database files, guaranteeing store ID matches.

## Artifact Index
- `.agents/teamwork/m2_worker_1/DISPATCH.md` — Assigned task specification
- `.agents/teamwork/m2_worker_1/BRIEFING.md` — Persistent memory
- `.agents/teamwork/m2_worker_1/progress.md` — Step-by-step progress tracking
- `.agents/teamwork/m2_worker_1/handoff.md` — Completion handoff report

## Change Tracker
- **Files modified**:
  - `electron/database/db.ts`: Connection pool, AsyncMutex, uniform naming, legacy migration.
  - `electron/database/backupManager.ts`: Store-partitioned backups, rotation, deep restore inspection.
  - `electron/main.ts`: IPC handlers for backups and connection switching.
  - `electron/preload.ts`: Type-safe IPC bridge exposing store-scoped backup methods.
  - `src/constants/starbucksStores.ts`: 143 authentic stores, normalizeDiacritics.
  - `src/components/StoreSwitcherModal.tsx`: Debounced search, virtualized windowing, keyboard nav.
  - `src/hooks/useStoreLifecycle.ts`: Reusable lifecycle hook.
  - `src/App.tsx`: View keys, event listeners, SaveShield.
  - `src/services/storeService.ts`: Lifecycle event triggers, cache invalidation, storage migration trigger.
  - `src/services/storeStorage.ts`: Partitioned key manager and migration logic.
  - `src/services/todoService.ts`: Partitioned storage integration.
  - `src/services/desktopNotificationService.ts`: Partitioned storage integration.
  - `src/services/sync/syncEngine.ts`: Partitioned storage integration.
  - `src/services/admin/adminService.ts`: Partitioned storage integration.
  - `src/modules/labor-forecast/components/WeeklyScheduleTable.tsx`: Partitioned storage integration.
- **Build status**: PASS (`npm run build` exits 0)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (269 passed, 0 failed)
- **Lint status**: Clean (tsc verification 0 errors)
- **Tests added/modified**: Full E2E test suite verified (269 tests across Tier 1 to Tier 5)

## Loaded Skills
- sqlite-guardian: /Users/dawidapel/COL Tool/.agents/skills/sqlite-guardian/SKILL.md
- integrity-sentinel: /Users/dawidapel/COL Tool/.agents/skills/integrity-sentinel/SKILL.md
