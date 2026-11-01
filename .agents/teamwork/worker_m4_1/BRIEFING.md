# BRIEFING — 2026-10-26T21:40:00Z

## Mission
Implement Milestone 4 (Master Hardening & Disaster Recovery: F10 BIP-39 Engine + F11 Timing-Safe Master IPC Bridge & Rate Limiter) with 100% genuine code, zero mock shortcuts, comprehensive automated test suites, and clean production build.

## 🔒 My Identity
- Archetype: m4_fleet_worker_1
- Roles: implementer, qa, specialist
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/worker_m4_1
- Original parent: bc820f6a-3865-4f82-8517-3240379a0b72
- Milestone: Milestone 4 (Master Hardening & Disaster Recovery)

## 🔒 Key Constraints
- Strict BIP-39 specification: 24 words, 256 bits CSPRNG entropy + 8 bits SHA-256 checksum, canonical 2048 English wordlist embedded zero-dependency.
- PBKDF2-HMAC-SHA512 seed derivation (2048 rounds, "mnemonic" + passphrase salt).
- Constant-time verification using double SHA-256 pre-hashing and crypto.timingSafeEqual with 4096 char input bounds.
- Sliding-window rate limiter: max 5 attempts per 15-minute window (900,000 ms), 15-minute cooldown lockout on 5th failure, disk lockfile persistence at userData/security/master_rate_limit.lock.
- Memory hygiene: zeroize buffers using .fill(0).
- No cheating, no fake mocks, zero regressions in existing security test suite.

## Current Parent
- Conversation ID: bc820f6a-3865-4f82-8517-3240379a0b72
- Updated: 2026-10-26T21:40:00Z

## Task Summary
- **What to build**:
  1. `src/services/security/bip39Wordlist.ts` (canonical 2,048 English words + reverse lookup map)
  2. `src/services/security/masterRecoveryService.ts` (BIP-39 generation, validation, seed derivation, hierarchical key derivations, memory hygiene)
  3. `tests/security/master_recovery_bip39.test.ts` (Trezor test vectors, roundtrip fuzzing, checksum tampering, zeroization)
  4. `electron/security/masterCredentialManager.ts` (timing-safe verify, sliding window rate limiter, lockfile persistence, audit logging)
  5. `electron/main.ts` & `electron/preload.ts` (IPC handlers and bridge exposure)
  6. `src/services/security/masterCredentialService.ts` (Universal client for renderer and headless)
  7. `tests/security/master_credential_rate_limiter.test.ts` (rate limit & timing tests)
- **Success criteria**:
  - `npm run test:security` passes with 0 failures.
  - `npm run build` succeeds cleanly.
  - Handoff report in `worker_m4_1/handoff.md`.

## Change Tracker
- **Files modified**: None yet
- **Build status**: Pending
- **Pending issues**: None

## Quality Status
- **Build/test result**: Pending
- **Lint status**: 0 violations
- **Tests added/modified**: 2 new test suites planned

## Artifact Index
- `.agents/teamwork/worker_m4_1/DISPATCH.md` — Assigned instructions
- `.agents/teamwork/worker_m4_1/BRIEFING.md` — Working state & memory
- `.agents/teamwork/worker_m4_1/progress.md` — Liveness & heartbeat
- `.agents/teamwork/worker_m4_1/handoff.md` — Final handoff report
