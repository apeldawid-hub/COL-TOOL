# DISPATCH: Milestone 1 Retry Explorer 2 (SQLite Stores Schema & Registration, IPC Signatures)

Your working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_retry_explorer_2
Role: teamwork_preview_explorer
Original Request: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Project Root: /Users/dawidapel/COL Tool
Project Architecture: /Users/dawidapel/COL Tool/PROJECT.md
Gate Status: /Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_1/GATE_STATUS.md
Reviewer 1 Report: /Users/dawidapel/COL Tool/.agents/teamwork/m1_reviewer_1/handoff.md

## Objective
Analyze the SQLite schema and registration defects identified during Milestone 1 gate verification:
1. `electron/database/db.ts:1080–1082`: Lingering hardcoded `INSERT OR IGNORE INTO stores ... 18120 Janki` inside `createSchema()`. Formulate removal.
2. `electron/database/db.ts:286–346`: `seedNewStoreData()` never registers newly configured stores in `stores` table, causing `main.ts:806` floor hour updates to fail (0 rows updated). Formulate exact `INSERT INTO stores (store_code, store_name, weekly_floor_hours)` logic for the new store.
3. `electron/main.ts:190`: IPC signature for `store:switch-database` expecting an object `{ storeId, storeInfo }` vs contracted two arguments `(storeId, storeInfo)`. Formulate fix to accept both seamlessly.

Write your findings to `/Users/dawidapel/COL Tool/.agents/teamwork/m1_retry_explorer_2/handoff.md`.

## 2026-10-24T02:25:38Z
You are m1_retry_explorer_2 for Milestone 1 Iteration 2.
Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_retry_explorer_2
Read /Users/dawidapel/COL Tool/.agents/teamwork/m1_retry_explorer_2/DISPATCH.md, /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md, /Users/dawidapel/COL Tool/PROJECT.md, /Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_1/GATE_STATUS.md, and:
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_reviewer_1/handoff.md

Task: Formulate exact fix strategy for db.ts createSchema lingering Janki store, seedNewStoreData new store registration, and main.ts:190 IPC signature mismatch.
Write handoff.md and notify parent when complete.
