# Dispatch Task: Milestone 4 Iteration 2 Explorer 1 (Canonical BIP-39 Wordlist Restoration)

**Role**: M4 Iter2 Explorer 1 (Canonical BIP-39 English Wordlist Reconstruction & SHA-256 Verification)
**Target Milestone**: Milestone 4 (Master Hardening & Disaster Recovery — Feature F10 Remediation)
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m4_iter2_explorer_1`
**Mandatory Input**: `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md`

## Forensic Audit Evidence Report:
The Forensic Auditor delivered an **INTEGRITY VIOLATION** report at `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_auditor_1/handoff.md`.
Key findings:
- `src/services/security/bip39Wordlist.ts` had a corrupted wordlist with SHA-256: `481f58152bab0fe35c2485a59a803a1345ea5a6565927f57f62cd9ce6faee4bb`.
- Canonical BIP-39 English wordlist SHA-256: `2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda`.
- Missing canonical words: `employ` (index 583), `gospel` (index 749), `ride` (index 1484).
- Foreign words inserted: `ladle` (index 272), `offline` (index 1230).
- This shifted word indices by 1 for all subsequent 1,465 words, breaking interoperability with standard BIP-39 wallets and failing canonical SatoshiLabs test vectors.

## Instructions:
1. Read `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md` and the full forensic audit report at `/Users/dawidapel/COL Tool/.agents/teamwork/m4_gate_auditor_1/handoff.md`.
2. Inspect `src/services/security/bip39Wordlist.ts`.
3. Investigate the authoritative canonical BIP-0039 English wordlist (from `https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/english.txt`).
4. Detail the exact fix strategy to restore the full, verbatim, 2,048-word canonical list in `src/services/security/bip39Wordlist.ts` such that:
   - SHA-256 of `RAW_BIP39_ENGLISH_WORDS.join('\n') + '\n'` equals `2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda`.
   - Length is exactly 2,048 unique words, strictly lowercase and alphabetically sorted.
   - Zero foreign words; `employ`, `gospel`, `ride` restored to their exact canonical index positions.
   - `BIP39_ENGLISH_WORDLIST` is frozen with `Object.freeze()`.
   - `BIP39_WORD_INDEX_MAP` precomputed for $O(1)$ constant-time lookup.
5. Write your findings and recommended strategy to `/Users/dawidapel/COL Tool/.agents/teamwork/m4_iter2_explorer_1/handoff.md`.
6. Use `send_message` to report back to orchestrator `bc820f6a-3865-4f82-8517-3240379a0b72`.
