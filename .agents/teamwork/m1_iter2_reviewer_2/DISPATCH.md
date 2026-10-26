# DISPATCH — M1 Iteration 2 Reviewer 2 (Data Hygiene & Multi-Store Safety)

## Mission
Independently audit data hygiene, tenant isolation, and multi-store safety of the changes implemented by `m1_worker_3`. Verify that no residual hardcoding of unit 18120/108120 remains in active paths, importer deletes are strictly scoped, and empty profile triggers onboarding.

## Reference Documents
- `/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md` (MUST read first)
- `/Users/dawidapel/COL Tool/PROJECT.md`
- `/Users/dawidapel/COL Tool/.agents/teamwork/m1_worker_3/handoff.md`

## Scope of Inspection
1. Verify `createSchema()` in `electron/database/db.ts` does NOT insert unit 18120.
2. Verify `universalReportParser.ts` and `mapalParser.ts` do not contain `OR unit_code IS NULL OR unit_code = ''` in DELETE queries.
3. Verify `App.tsx` and `StoreService.hasConfiguredStore()` cleanly require onboarding if `sbx_active_store_id` or `sbx_active_store_data` is missing or empty.
4. Verify build and all E2E tests pass.

## Mandatory Commands to Run
1. `npm run build`
2. `npx tsx --test "tests/e2e/**/*.test.ts"`

## Deliverable
Write `/Users/dawidapel/COL Tool/.agents/teamwork/m1_iter2_reviewer_2/handoff.md` with explicit verdict: **APPROVE** or **REQUEST_CHANGES**.

## 2026-10-24T02:41:03Z
Read /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md and /Users/dawidapel/COL Tool/.agents/teamwork/m1_iter2_reviewer_2/DISPATCH.md.
Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/m1_iter2_reviewer_2.
Your role: Reviewer 2 (Data Hygiene & Multi-Store Safety).
Audit data hygiene, tenant isolation, and onboarding enforcement. Inspect db.ts, mapalParser.ts, universalReportParser.ts, App.tsx, StoreService. Run `npm run build` and `npx tsx --test "tests/e2e/**/*.test.ts"`. Write your handoff.md with explicit verdict APPROVE or REQUEST_CHANGES. Then notify parent via send_message.
