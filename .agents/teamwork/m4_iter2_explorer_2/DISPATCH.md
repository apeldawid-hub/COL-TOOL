# Dispatch Task: Milestone 4 Iteration 2 Explorer 2 (SatoshiLabs Canonical Test Vectors)

**Role**: M4 Iter2 Explorer 2 (SatoshiLabs Canonical Test Vectors & MasterRecoveryService Conformance)
**Target Milestone**: Milestone 4 (Master Hardening & Disaster Recovery — Feature F10 Remediation)
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m4_iter2_explorer_2`
**Mandatory Input**: `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md`

## Forensic Audit Evidence Report:
The Forensic Auditor delivered an **INTEGRITY VIOLATION** report at `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_auditor_1/handoff.md`.
Key findings:
- Standard SatoshiLabs test vectors failed (e.g. 128-bit `7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f` -> `legal winner thank year wave sausage worth useful legal winner thank yellow`).
- In the corrupted list, `legal` was at 1018 instead of 1019, `sausage` was 1532 instead of 1533, and `yellow` was 2039 instead of 2040.
- `tests/security/master_recovery_bip39.test.ts` was flagged as a Self-Certifying Test Suite (Prohibited Pattern 4) because it only checked 0x00 and 0xFF vectors and round-tripped mnemonics against the corrupted dictionary.

## Instructions:
1. Read `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md` and the full forensic audit report at `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_auditor_1/handoff.md`.
2. Inspect `src/services/security/masterRecoveryService.ts` and `tests/security/master_recovery_bip39.test.ts`.
3. Investigate the authoritative SatoshiLabs BIP-39 test vectors from `https://raw.githubusercontent.com/trezor/python-mnemonic/master/vectors.json`.
4. Formulate the blueprint for expanding `tests/security/master_recovery_bip39.test.ts` with authentic test vectors:
   - 128-bit, 160-bit, 192-bit, 224-bit, and 256-bit test vectors across the dictionary.
   - Vector `7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f` -> `legal winner thank year wave sausage worth useful legal winner thank yellow`.
   - 256-bit all-zeros, all-ones, alternating bit patterns, and PBKDF2 seed derivations with passphrases.
   - Explicit verification that wordlist SHA-256 matches canonical hash `2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda`.
5. Verify that `masterRecoveryService.ts` packing/unpacking and bit-shifting logic is 100% compliant and does not require changes once the wordlist is restored.
6. Write your findings and recommended strategy to `/Users/dawidapel/COL Tool/.agents/teamwork/m4_iter2_explorer_2/handoff.md`.
7. Use `send_message` to report back to orchestrator `bc820f6a-3865-4f82-8517-3240379a0b72`.
