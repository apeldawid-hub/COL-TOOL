## 2026-10-27T06:45:13Z
You are m4_fleet_worker_2, the expert full-stack & security TypeScript/Electron engineer replacing m4_fleet_worker_1 to implement Milestone 4 (Master Hardening & Disaster Recovery) for the Starbucks Operations Suite Master Fleet HQ enterprise security project.

Your dedicated working directory:
`/Users/dawidapel/COL Tool/.agents/teamwork/worker_m4_2`

Authoritative files to read before writing code:
- `/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md` (section "## Follow-up — 2026-10-26T16:11:59Z")
- `/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_4/SCOPE.md`
- Explorer 1 Report & Blueprint: `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m4_1/handoff.md`
- Explorer 2 Report & Blueprint: `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m4_2/handoff.md`
- Explorer 3 Report & Blueprint: `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m4_3/handoff.md`
- Reference code in:
  `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m4_3/proposed_masterCredentialManager.ts`
  `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m4_3/proposed_masterCredentialService.ts`
  `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m4_3/proposed_master_credential_rate_limiter.test.ts`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Implementation Tasks:
1. Feature F10: BIP-39 Disaster Recovery Engine:
   - Create `src/services/security/bip39Wordlist.ts`:
     * Embed the canonical 2,048 English wordlist (from `abandon` to `zoo` strictly matching the BIP-0039 standard). If needed, fetch the canonical raw wordlist from official Bitcoin github repo: `https://raw.githubusercontent.com/bitcoin/bips/master/bip-0039/english.txt` or generate it from verified source.
     * Export `BIP39_ENGLISH_WORDLIST: readonly string[]` (frozen array of 2,048 words) and `BIP39_WORD_INDEX_MAP: ReadonlyMap<string, number>` for O(1) reverse lookup.
   - Create `src/services/security/masterRecoveryService.ts`:
     * Implement `generateMasterRecoveryMnemonic()` (256 bits CSPRNG entropy + 8 bits SHA-256 checksum -> 24 words).
     * Implement `validateRecoveryMnemonic(mnemonic: string)` (defensive trim/NFKD, strictly 24 words, dictionary check, bitwise 264-bit reconstruction, constant-time SHA-256 checksum verification `(embedded ^ computed) === 0`, returns `{ valid: boolean, error?: string, entropy?: Uint8Array, hexEntropy?: string }`).
     * Implement `mnemonicToSeedSync(mnemonic: string, passphrase?: string): Buffer` and `mnemonicToSeed(mnemonic: string, passphrase?: string): Promise<Buffer>` using PBKDF2-HMAC-SHA512 with 2048 iterations and salt `"mnemonic" + (passphrase || '')`.
     * Implement hierarchical master disaster recovery methods:
       - `deriveMasterRootKey(seed: Buffer | Uint8Array): Buffer`
       - `deriveMasterPassphrase(seed: Buffer | Uint8Array): string`
       - `deriveStoreRecoveryKey(seed: Buffer | Uint8Array, storeId: string, unitCode: string): Buffer`
       - `deriveEmergencyAdminToken(seed: Buffer | Uint8Array): string`
       - `generateOfflineStoreCertificate(...)`
     * Implement memory hygiene: `wipeBuffer(buf: Buffer | Uint8Array): void` calling `buf.fill(0)` and `withWipedBuffer(...)`.
   - Create automated test suite `tests/security/master_recovery_bip39.test.ts`:
     * Verify official SatoshiLabs / Trezor BIP-39 test vectors (all zeroes -> 23x `abandon` + `art`; all ones -> 23x `zoo` + `vote`; passphrase `"TREZOR"` -> `bda85446...`; empty passphrase -> `408b285c...`).
     * Verify 100+ randomized round-trip generation and validation cycles.
     * Verify tamper detection: single word modification, word swapping, non-dictionary word (e.g. `'starbucks'`), and invalid word counts (12, 18, 23, 25 words).
     * Verify determinism of hierarchical key derivations and buffer zeroization.

2. Feature F11: Timing-Safe Master IPC Bridge & Rate Limiter:
   - Create `electron/security/masterCredentialManager.ts`:
     * Pre-hash candidate and stored secret with SHA-256 before `crypto.timingSafeEqual` with 4,096 character input bounds (preventing timing leaks and RangeError on variable lengths).
     * Implement `MasterRateLimiter`: max 5 attempts per rolling 15-minute window (`WINDOW_MS = 900,000`), 15-minute cooldown lockout on 5th failure, disk lockfile persistence at `userData/security/master_rate_limit.lock`.
     * Critical security audit logging on 5th failure via `CrashLogManager`.
   - Register IPC handlers in `electron/main.ts`:
     * `crypto:verify-master-credential`
     * `crypto:get-master-credential-status`
   - Expose bridge methods in `electron/preload.ts`:
     * `verifyMasterCredential: (credential: string) => ipcRenderer.invoke('crypto:verify-master-credential', credential)`
     * `getMasterCredentialStatus: () => ipcRenderer.invoke('crypto:get-master-credential-status')`
   - Create `src/services/security/masterCredentialService.ts`:
     * Universal client for renderer with Electron IPC and headless browser fallback.
   - Install automated test suite `tests/security/master_credential_rate_limiter.test.ts` (copying and integrating from `proposed_master_credential_rate_limiter.test.ts`).

3. Verification:
   - Run `npm run test:security` and ensure all security test suites (M1, M2, M3, M4) pass with 100% pass rate (0 failures).
   - Run `npm run build` (`tsc && vite build`) and confirm clean compilation with exit code 0.

4. Deliverable:
   - Write your handoff report in `/Users/dawidapel/COL Tool/.agents/teamwork/worker_m4_2/handoff.md`.
   - Send a message to the orchestrator confirming completion with test command outputs and summary of files modified.

## 2026-10-27T13:39:11Z
**Context**: Milestone 4 (Master Hardening & Disaster Recovery) Implementation
**Content**: Your background grep task (task-60) has finished. Do not waste time searching external URLs (network access to github is restricted by policy). You can directly write `src/services/security/bip39Wordlist.ts` using the canonical 2,048 BIP-39 English wordlist (from `abandon` to `zoo`), as you have complete knowledge of the BIP-39 dictionary.
Please proceed immediately with:
1. Writing `src/services/security/bip39Wordlist.ts` (exporting `BIP39_WORDLIST` or `BIP39_ENGLISH_WORDLIST` and `BIP39_WORD_INDEX_MAP`).
2. Implementing `src/services/security/masterRecoveryService.ts` according to the blueprints in `explorer_m4_1/handoff.md` and `explorer_m4_2/handoff.md`.
3. Creating the test suite `tests/security/master_recovery_bip39.test.ts`.
4. Implementing `electron/security/masterCredentialManager.ts`, the IPC handlers in `electron/main.ts` and `electron/preload.ts`, and `src/services/security/masterCredentialService.ts` (using the ready implementations from `explorer_m4_3`).
5. Installing `tests/security/master_credential_rate_limiter.test.ts`.
6. Running `npm run test:security` and `npm run build` to verify clean pass, and delivering `handoff.md`.
**Action**: Please wake up, resume implementation of F10 and F11 immediately, update your progress.md, and notify me with your completion handoff once verified.

## 2026-10-27T14:00:43Z
**Context**: Milestone 4 Verification Complete
**Content**: All 171 security tests (`npm run test:security`) pass with 100% pass rate, and `npm run build` compiles cleanly with exit code 0.
**Action**: Please finalize your handoff report in `/Users/dawidapel/COL Tool/.agents/teamwork/worker_m4_2/handoff.md` and send completion notification with summary of changes so we can dispatch the Milestone 4 Gate Squad.


