# DISPATCH — Milestone 2 Challenger 1 (Adversarial LRU Pool & Mutex Stress Testing)

## Mission
Adversarially stress-test the `StoreConnectionPool` and `AsyncMutex` implemented by `m2_worker_1` in `electron/database/db.ts`:
1. Empirically verify LRU pool boundary: Open 8 stores -> verify 8 cached; open 9th store -> verify least recently used is evicted; verify dirty writes on evicted store are cleanly persisted to disk without data loss.
2. Empirically verify mutex concurrency: Execute 50 concurrent `switchStoreDatabase` calls -> verify strict sequential FIFO execution, zero null pointer exceptions, and zero database corruption.
3. Verify SHA-256 binary parity between `tplh_forecast.db` and `store_108120.db`.
4. Run `npm run build` and all 269 E2E tests.

## Reference Documents
- `/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md` (MUST read first)
- `/Users/dawidapel/COL Tool/PROJECT.md`
- `/Users/dawidapel/COL Tool/.agents/teamwork/m2_worker_1/handoff.md`

## Deliverable
Write `/Users/dawidapel/COL Tool/.agents/teamwork/m2_challenger_1/handoff.md` with explicit verdict: **APPROVE** or **REJECT**.

## 2026-10-24T03:22:13Z
Read /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md and /Users/dawidapel/COL Tool/.agents/teamwork/m2_challenger_1/DISPATCH.md.
Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/m2_challenger_1.
Your role: M2 Challenger 1 (Adversarial LRU Pool & Mutex Stress Testing).
Adversarially stress-test StoreConnectionPool (8-conn limit, eviction dirty-flush) and AsyncMutex (50 concurrent switch operations). Verify SHA-256 binary match between legacy tplh_forecast.db and store_108120.db. Run build and tests. Write your handoff.md with explicit verdict APPROVE or REJECT. Notify parent via send_message.
## 2026-10-24T06:40:30Z
Read /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md and /Users/dawidapel/COL Tool/.agents/teamwork/m2_challenger_1/DISPATCH.md.
Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/m2_challenger_1.
Your role: M2 Challenger 1 (Adversarial LRU Pool & Mutex Stress Testing).
Adversarially stress-test StoreConnectionPool (8-conn limit, eviction dirty-flush) and AsyncMutex (50 concurrent switch operations). Verify SHA-256 binary match between legacy tplh_forecast.db and store_108120.db. Run build and tests. Write your handoff.md with explicit verdict APPROVE or REJECT. Notify parent via send_message.
