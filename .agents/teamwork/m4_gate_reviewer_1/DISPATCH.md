# Dispatch Task: Milestone 4 Gate Reviewer 1 (BIP-39 & Disaster Recovery)

**Role**: Reviewer 1 (BIP-39 Architecture, Cryptographic Parity & Key Derivations)
**Target Milestone**: Milestone 4 (Master Hardening & Disaster Recovery — Feature F10)
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_reviewer_1`
**Mandatory Input**: `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md`

## Instructions:
1. Read `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md`.
2. Inspect Feature F10 files:
   - `/Users/dawidapel/COL Tool/src/services/security/bip39Wordlist.ts`
   - `/Users/dawidapel/COL Tool/src/services/security/masterRecoveryService.ts`
   - `/Users/dawidapel/COL Tool/tests/security/master_recovery_bip39.test.ts`
   - Worker handoff: `/Users/dawidapel/COL Tool/.agents/teamwork/worker_m4_2/handoff.md`
3. Verify:
   - Wordlist integrity: exactly 2,048 sorted lowercase English words, no duplicates, frozen array, map lookup.
   - Bitwise math: 256 bits entropy + 8 bits checksum = 264 bits = 24 x 11-bit chunks in [0..2047].
   - Checksum comparison is constant-time `(embedded ^ computed) === 0`.
   - PBKDF2 HMAC-SHA512 seed derivation (2048 rounds, salt `mnemonic + passphrase`, NFKD normalization).
   - Hierarchical key derivations (MRK, Master Passphrase, Store SEK, Emergency Admin Token, Offline Cert).
   - Memory zeroization `wipeBuffer` and `withWipedBuffer`.
4. Run verification commands:
   - `node --import tsx --test "tests/security/master_recovery_bip39.test.ts"`
   - `npm run test:security`
5. Write your hard handoff report to `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_reviewer_1/handoff.md` with an explicit verdict: `APPROVE` or `REQUEST_CHANGES`.
6. Send a message to orchestrator (`bc820f6a-3865-4f82-8517-3240379a0b72`) when finished.

## 2026-10-27T14:04:42Z
You are M4 Gate Reviewer 1 (BIP-39 Architecture, Cryptographic Parity & Key Derivations).
Working Directory: /Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_reviewer_1
Target Milestone: Milestone 4 (Master Hardening & Disaster Recovery — Feature F10)
Mandatory Input: Read /Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md.

Instructions:
1. Read /Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md and /Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_reviewer_1/DISPATCH.md.
2. Review the implementation of Feature F10 in:
   - /Users/dawidapel/COL Tool/src/services/security/bip39Wordlist.ts
   - /Users/dawidapel/COL Tool/src/services/security/masterRecoveryService.ts
   - /Users/dawidapel/COL Tool/tests/security/master_recovery_bip39.test.ts
   - Worker handoff: /Users/dawidapel/COL Tool/.agents/teamwork/worker_m4_2/handoff.md
3. Verify:
   - Wordlist integrity: exactly 2,048 sorted lowercase English words, zero duplicates, frozen array, map lookup.
   - Bitwise math: 256 bits entropy + 8 bits checksum = 264 bits = 24 x 11-bit chunks in [0..2047].
   - Checksum comparison is constant-time (embedded ^ computed) === 0.
   - PBKDF2 HMAC-SHA512 seed derivation (2048 rounds, salt "mnemonic" + passphrase, NFKD normalization).
   - Deterministic hierarchical key derivations (MRK, Master Passphrase, Store SEK, Emergency Admin Token, Offline Cert).
   - Memory hygiene: wipeBuffer and withWipedBuffer zeroizes memory cleanly.
4. Run verification commands:
   - node --import tsx --test "tests/security/master_recovery_bip39.test.ts"
   - npm run test:security
5. Write your hard handoff report to /Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_reviewer_1/handoff.md with an explicit verdict: APPROVE or REQUEST_CHANGES.
6. Use send_message to report your verdict and summary back to caller ID bc820f6a-3865-4f82-8517-3240379a0b72.
