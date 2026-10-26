# BRIEFING — 2026-10-24T02:53:30Z

## Mission
Investigate electron/database/db.ts and electron/main.ts and design exact implementation blueprints for Features F6 (Uniform DB Naming & Legacy Migration) and F7 (StoreConnectionPool with LRU Caching & Mutex).

## 🔒 My Identity
- Archetype: explorer
- Roles: M2 Explorer 1 (Uniform DB Naming, Legacy Migration & LRU Connection Pool)
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_1
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: Milestone 2

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in production code
- Adhere strictly to the Handoff Protocol and 5-Component Report structure
- Files for content delivery, Messages for coordination
- Deliver exact code blueprints, file paths, line references, and failure analysis

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: 2026-10-24T02:53:30Z

## Investigation State
- **Explored paths**:
  - `electron/database/db.ts` (DatabaseManager lines 1-2013, computeDbFilePath, switchStoreDatabase, persist, reloadFromDisk, seedNewStoreData, createSchema)
  - `electron/main.ts` (IPC handlers lines 1-350, window-all-closed, before-quit lines 1968-1980)
  - `electron/preload.ts` (IPC bridge signatures)
  - `electron/database/backupManager.ts`
  - `tests/e2e/tier1-feature-coverage/f06_db_naming_migration.test.ts`
  - `tests/e2e/tier1-feature-coverage/f07_lru_pool_mutex.test.ts`
  - `tests/e2e/tier2-boundary-corner/b06_db_file_boundaries.test.ts`
  - `tests/e2e/tier2-boundary-corner/b07_lru_mutex_boundaries.test.ts`
  - `tests/e2e/tier3-pairwise-interactions/pairwise_interactions.test.ts`
  - `tests/e2e/tier4-real-world-scenarios/real_world_scenarios.test.ts`
  - `data/` directory (found existing `tplh_forecast.db` 397KB)
- **Key findings**:
  - `computeDbFilePath` currently contains hardcoded routing for `108120_janki`, `108120`, and `18120` to `tplh_forecast.db`. Must be sanitized and unified to `store_${safeId}.db`.
  - Active physical file `data/tplh_forecast.db` is 397KB; zero-data-loss migration must atomically copy it to `store_108120.db` with SHA-256 checksum verification and safety backup before activation.
  - `switchStoreDatabase` currently executes synchronously without concurrency protection, risking race conditions when rapidly switching stores.
  - `DatabaseManager` currently holds only a single `Database | null` handle, reloading from disk on every switch. A size-8 LRU `StoreConnectionPool` will allow instant memory cache hits, evicting the least recently used store with mandatory dirty-write flushes and statement cleanup.
  - Full backward compatibility is preserved for all IPC handlers (`db:query`, `db:save-*`, `db:get-*`) by keeping `dbManager.getDb()` delegating to the active pool handle.
- **Unexplored areas**: None for F6/F7 scope.

## Key Decisions Made
- Design `StoreConnectionPool` maintaining up to 8 connections with `PooledConnection` tracking (`db`, `filePath`, `lastAccessed`, `isDirty`, `debounceTimer`).
- Design `AsyncMutex` with FIFO promise chaining and strict `try ... finally` release semantics.
- Design two-phase legacy migration (`tplh_forecast.db` -> atomic tmp file -> SHA-256 parity verification -> rename to `store_108120.db`).
- Preserve `DatabaseManager` singleton and public API methods so no breaking changes occur in `electron/main.ts` or renderer.

## Artifact Index
- `DISPATCH.md` — Dispatch instructions and history
- `BRIEFING.md` — Persistent working memory and state
- `progress.md` — Agent heartbeat and status
- `handoff.md` — 5-Component comprehensive architectural blueprint and implementation report
