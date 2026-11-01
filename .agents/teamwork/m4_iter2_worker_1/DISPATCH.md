# Dispatch Task: Milestone 4 Iteration 2 Worker (BIP-39 Canonical Wordlist & SatoshiLabs Test Suite)

**Role**: M4 Iter2 Worker (Full-Stack & Security TypeScript/Electron Engineer)
**Target Milestone**: Milestone 4 (Master Hardening & Disaster Recovery — Remediation Implementation)
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m4_iter2_worker_1`
**Mandatory Input**: `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md`

## MANDATORY INTEGRITY WARNING (VERBATIM):
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Context & Inputs:
1. Forensic Audit Report: `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_auditor_1/handoff.md`
2. Explorer 2 Blueprint: `/Users/dawidapel/COL Tool/.agents/teamwork/m4_iter2_explorer_2/handoff.md`
3. Explorer 3 Blueprint: `/Users/dawidapel/COL Tool/.agents/teamwork/m4_iter2_explorer_3/handoff.md`

## Assigned File Write Ownership (Exclusive):
- `/Users/dawidapel/COL Tool/src/services/security/bip39Wordlist.ts`
- `/Users/dawidapel/COL Tool/tests/security/master_recovery_bip39.test.ts`

## Tasks:
1. Read `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md` and the input reports above.
2. In `src/services/security/bip39Wordlist.ts`:
   - Replace the wordlist array with the exact, verbatim, canonical 2,048 BIP-0039 English words.
   - The SHA-256 hash of the words separated by `\n` plus a trailing `\n` MUST strictly equal:
     `2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda`.
   - Restore canonical words: `employ` at index 583, `gospel` at index 749, `ride` at index 1484.
   - Ensure foreign words `ladle`, `offline`, `satoshi` are completely absent.
   - Ensure `BIP39_ENGLISH_WORDLIST` is frozen with `Object.freeze()`.
   - Ensure `BIP39_WORD_INDEX_MAP` provides $O(1)$ constant-time lookup.
3. In `tests/security/master_recovery_bip39.test.ts`:
   - Replace the test suite following the comprehensive 6-section blueprint from Explorer 2 and Explorer 3:
     - Section 1: Canonical BIP-39 Wordlist Integrity, SHA-256 Attestation (`2f5eed53...`), and canonical word positions / foreign word absence.
     - Section 2: Canonical SatoshiLabs Reference Vectors across the wordlist (128-bit `7f...7f` -> `legal winner thank year wave sausage worth useful legal winner thank yellow`, 128-bit all-zeros, 160-bit, 192-bit, 224-bit vectors, and PBKDF2 seed derivations).
     - Section 3: MasterRecoveryService 256-bit SatoshiLabs Canonical Vectors (all-zeros `0x00*32` -> `23x abandon + art`, all-ones `0xff*32` -> `23x zoo + vote`, 0x7F `legal...sausage...worth title`, alternating 0x55 and 0xAA, complex pseudo-random).
     - Section 4: 100+ Randomized Round-Trip Fuzz Cycles.
     - Section 5: Tamper Detection (single word bit/word changes, swapped words, foreign words, invalid word counts 0..23, 25..30, whitespace/NFKD normalization).
     - Section 6: Hierarchical Disaster Recovery Key Derivations (MRK, Master Passphrase, Store SEK, Emergency Admin Token, Offline Cert) & Memory Hygiene (`wipeBuffer`).
4. Execute verification commands:
   - `node --import tsx --test "tests/security/master_recovery_bip39.test.ts"`
   - `npm run test:security`
   - `npm run build`
   - Run the standalone forensic validation script from Explorer 3 handoff report.
5. Deliver your hard handoff report to `/Users/dawidapel/COL Tool/.agents/teamwork/m4_iter2_worker_1/handoff.md`.
6. Send a message to orchestrator `bc820f6a-3865-4f82-8517-3240379a0b72` when complete.
