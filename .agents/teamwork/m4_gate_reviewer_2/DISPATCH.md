# Dispatch Task: Milestone 4 Gate Reviewer 2 (Master IPC Bridge & Rate Limiter)

**Role**: Reviewer 2 (Master IPC Bridge, Timing Invariance & Lockfile Persistence)
**Target Milestone**: Milestone 4 (Master Hardening & Disaster Recovery — Feature F11)
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_reviewer_2`
**Mandatory Input**: `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md`

## Instructions:
1. Read `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md`.
2. Inspect Feature F11 files:
   - `/Users/dawidapel/COL Tool/electron/security/masterCredentialManager.ts`
   - `/Users/dawidapel/COL Tool/electron/main.ts`
   - `/Users/dawidapel/COL Tool/electron/preload.ts`
   - `/Users/dawidapel/COL Tool/src/services/security/masterCredentialService.ts`
   - `/Users/dawidapel/COL Tool/tests/security/master_credential_rate_limiter.test.ts`
   - Worker handoff: `/Users/dawidapel/COL Tool/.agents/teamwork/worker_m4_2/handoff.md`
3. Verify:
   - `timingSafeVerify`: SHA-256 pre-hashing of candidate and expected secret, uniform 32-byte Buffers, `crypto.timingSafeEqual`, 4096 char input capping, type safety.
   - `MasterRateLimiter`: rolling 15-minute window, max 5 failed attempts, 15-minute cooldown lockout on 5th attempt, lockfile persistence at `userData/security/master_rate_limit.lock` (mode `0o600`), atomic writes, security logging.
   - IPC registration in `electron/main.ts` and contextBridge in `electron/preload.ts`.
   - `MasterCredentialService` universal renderer client and headless browser fallback.
4. Run verification commands:
   - `node --import tsx --test "tests/security/master_credential_rate_limiter.test.ts"`
   - `npm run build`
5. Write your hard handoff report to `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_reviewer_2/handoff.md` with an explicit verdict: `APPROVE` or `REQUEST_CHANGES`.
6. Send a message to orchestrator (`bc820f6a-3865-4f82-8517-3240379a0b72`) when finished.
