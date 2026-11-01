## 2026-10-27T14:41:06Z

# Dispatch Task: Milestone 4 Iteration 2 Explorer 3 (Test Suite Harmonization & Full Verification Strategy)

**Role**: M4 Iter2 Explorer 3 (Test Harmonization & Verification Blueprint)
**Target Milestone**: Milestone 4 (Master Hardening & Disaster Recovery — Remediation Verification)
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m4_iter2_explorer_3`
**Mandatory Input**: `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md`

## Forensic Audit Evidence Report:
The Forensic Auditor delivered an **INTEGRITY VIOLATION** report at `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_auditor_1/handoff.md`.
Key findings:
- Corrupted BIP-39 wordlist must be replaced with official canonical list.
- Self-certifying tests must be eliminated and replaced with standard canonical test vectors.
- Timing safety and rate limiter in `electron/security/masterCredentialManager.ts` were found CLEAN and robust.

## Instructions:
1. Read `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md` and the full forensic audit report at `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_auditor_1/handoff.md`.
2. Inspect all existing security tests:
   - `tests/security/master_recovery_bip39.test.ts`
   - `tests/security/master_credential_rate_limiter.test.ts`
   - `tests/security/m4_challenger2_rate_limiter_stress.test.ts`
   - All tests in M1, M2, and M3.
3. Check whether any test in the test suite makes assumptions about the old corrupted wordlist (e.g. testing for 'ladle' or 'offline', or relying on shifted indices).
4. Blueprint the end-to-end verification plan:
   - Unit test command: `node --import tsx --test "tests/security/master_recovery_bip39.test.ts"`
   - Full security suite: `npm run test:security`
   - Production compilation: `npm run build`
   - Independent audit validation command.
5. Write your findings and recommended strategy to `/Users/dawidapel/COL Tool/.agents/teamwork/m4_iter2_explorer_3/handoff.md`.
6. Use `send_message` to report back to orchestrator `bc820f6a-3865-4f82-8517-3240379a0b72`.
