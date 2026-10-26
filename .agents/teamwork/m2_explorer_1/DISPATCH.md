# DISPATCH — Milestone 2 Explorer 1: Uniform DB Naming, Legacy Migration & LRU Connection Pool (F6, F7)

## Mission
Investigate and design exact implementation blueprints for Features F6 and F7 in `electron/database/db.ts`:
1. **F6 (Uniform DB Naming & Legacy Migration)**:
   - Transition all SQLite databases to uniform `store_${storeId}.db` (or `store_${safeId}.db`).
   - Remove legacy exception in `computeDbFilePath` where Janki routed to `tplh_forecast.db`.
   - Implement automatic zero-data-loss migration: If `tplh_forecast.db` exists upon selecting store 108120/18120, safely copy/migrate it to `store_108120.db` (with backup) and update pointers.
2. **F7 (StoreConnectionPool with LRU Caching & Concurrency Mutex)**:
   - Design/implement `StoreConnectionPool` maintaining up to 8 active SQLite database connections using LRU eviction.
   - On eviction of a database connection, ensure debounced dirty writes and statements are cleanly freed and `db.close()` is executed.
   - Implement an async mutex (promise queue / lock) around `switchStoreDatabase` to eliminate race conditions when rapid store switching occurs across 100+ stores.
   - Maintain full backward compatibility for all existing IPC handlers (`db:query`, `db:save-*`, `db:get-*`).

## Reference Documents
- `/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md` (MUST read first)
- `/Users/dawidapel/COL Tool/PROJECT.md`
- `/Users/dawidapel/COL Tool/electron/database/db.ts`
- `/Users/dawidapel/COL Tool/electron/main.ts`

## Deliverables
Write `/Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_1/handoff.md` with:
- Exact line-by-line inspection of current `DatabaseManager` in `db.ts`
- Detailed design and TypeScript code blueprint for `StoreConnectionPool` (LRU size 8, eviction flush, mutex)
- Exact file migration logic for legacy `tplh_forecast.db`
- Potential failure modes and concurrency edge cases


## 2026-10-24T02:48:24Z
Read /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md and /Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_1/DISPATCH.md.
Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_1.
Your role: M2 Explorer 1 (Uniform DB Naming, Legacy Migration & LRU Connection Pool).
Investigate electron/database/db.ts and electron/main.ts. Design the exact implementation blueprint for Features F6 and F7:
- Uniform store database file naming (`store_${storeId}.db`) and automated zero-loss migration of legacy `tplh_forecast.db`.
- StoreConnectionPool with 8-connection LRU caching, dirty write flush, and async mutex lock on store switching.
Write your findings and code blueprints to /Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_1/handoff.md. Then notify parent via send_message.
