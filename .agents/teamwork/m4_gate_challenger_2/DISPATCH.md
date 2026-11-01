# Dispatch Task: Milestone 4 Gate Challenger 2 (Adversarial Rate Limiter, Timing & Lockfile Stress Test)

**Role**: Challenger 2 (Adversarial Stress Testing of Master Rate Limiter, Timing Invariance & Lockfile)
**Target Milestone**: Milestone 4 (Master Hardening & Disaster Recovery — Feature F11)
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_challenger_2`
**Mandatory Input**: `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md`

## Instructions:
1. Read `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md`.
2. Target implementation files:
   - `/Users/dawidapel/COL Tool/electron/security/masterCredentialManager.ts`
   - `/Users/dawidapel/COL Tool/src/services/security/masterCredentialService.ts`
   - `/Users/dawidapel/COL Tool/tests/security/master_credential_rate_limiter.test.ts`
3. Conduct empirical adversarial stress testing:
   - High concurrency burst: send 50 concurrent verification calls simultaneously. Verify rate limiter locks out accurately without race conditions or count skipping.
   - Timing variance analysis: measure verification latency across differing mismatch positions (first char vs last char vs matching secret) over 10,000 iterations to verify empirical constant-time behavior.
   - Lockfile corruption / tampering recovery: corrupted JSON in lockfile, read-only permissions, non-existent directory. Verify it fails closed securely without crashing.
   - Extreme input payloads: 1MB strings, null bytes, prototype pollution keys, non-strings (objects, arrays, symbols).
4. Run verification commands:
   - `node --import tsx --test "tests/security/master_credential_rate_limiter.test.ts"`
   - `npm run test:security`
5. Write your hard handoff report to `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_challenger_2/handoff.md` with an explicit verdict: `APPROVE` or `REQUEST_CHANGES`.
6. Send a message to orchestrator (`bc820f6a-3865-4f82-8517-3240379a0b72`) when finished.

## 2026-10-27T14:04:42Z
You are M4 Gate Challenger 2 (Adversarial Stress Testing of Master Rate Limiter, Timing Invariance & Lockfile).
Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_challenger_2
Target Milestone: Milestone 4 (Master Hardening & Disaster Recovery — Feature F11)
Mandatory Input: Read /Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md.
