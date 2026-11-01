# Dispatch Task: Milestone 4 Gate Forensic Auditor (Cryptographic Integrity Audit)

**Role**: Forensic Auditor (Milestone 4 Cryptographic Integrity & Anti-Cheating Verification)
**Target Milestone**: Milestone 4 (Master Hardening & Disaster Recovery — Features F10 & F11)
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_auditor_1`
**Mandatory Input**: `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md`

## Instructions:
1. Read `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md`.
2. Target implementation files:
   - `/Users/dawidapel/COL Tool/src/services/security/bip39Wordlist.ts`
   - `/Users/dawidapel/COL Tool/src/services/security/masterRecoveryService.ts`
   - `/Users/dawidapel/COL Tool/electron/security/masterCredentialManager.ts`
   - `/Users/dawidapel/COL Tool/electron/main.ts`
   - `/Users/dawidapel/COL Tool/electron/preload.ts`
   - `/Users/dawidapel/COL Tool/src/services/security/masterCredentialService.ts`
   - `/Users/dawidapel/COL Tool/tests/security/master_recovery_bip39.test.ts`
   - `/Users/dawidapel/COL Tool/tests/security/master_credential_rate_limiter.test.ts`
3. Forensic integrity checks:
   - Verify genuine, non-dummy implementation of BIP-39: no hardcoded word arrays returning canned seeds, no fake checksum calculation.
   - Verify PBKDF2 uses genuine HMAC-SHA512 crypto primitives.
   - Verify constant-time comparison is not bypassed by early returns, regexes, or substring matches.
   - Verify rate limiter logic is authentic (sliding window, real timestamps, actual disk persistence).
   - Perform static analysis & runtime tracing of all new files.
   - Zero sensitive data in git repository.
4. Run verification commands:
   - `npm run test:security`
   - `npm run build`
5. Write your hard handoff report to `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_auditor_1/handoff.md` with an explicit binary verdict: `CLEAN` or `INTEGRITY VIOLATION`.
6. Send a message to orchestrator (`bc820f6a-3865-4f82-8517-3240379a0b72`) when finished.

## 2026-10-27T14:04:42Z
[Message] timestamp=2026-10-27T14:04:42Z sender=bc820f6a-3865-4f82-8517-3240379a0b72 priority=MESSAGE_PRIORITY_HIGH content=You are M4 Gate Forensic Auditor (Milestone 4 Cryptographic Integrity & Anti-Cheating Verification).
Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_auditor_1
Target Milestone: Milestone 4 (Master Hardening & Disaster Recovery — Features F10 & F11)
Mandatory Input: Read /Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md.
