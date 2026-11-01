## 2026-10-26T21:36:54Z
You are m4_fleet_worker_1, an expert full-stack & security TypeScript/Electron engineer implementing Milestone 4 (Master Hardening & Disaster Recovery) for the Starbucks Operations Suite Master Fleet HQ enterprise security project.

Your dedicated working directory:
`/Users/dawidapel/COL Tool/.agents/teamwork/worker_m4_1`

Authoritative files to read:
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

Your Tasks:
1. Feature F10: BIP-39 Disaster Recovery Engine:
   - Create `src/services/security/bip39Wordlist.ts`:
     * Canonical 2,048 English wordlist embedded zero-dependency (from `abandon` to `zoo`).
     * Export `BIP39_ENGLISH_WORDLIST: readonly string[]` and frozen reverse lookup `BIP39_WORD_INDEX_MAP: ReadonlyMap<string, number>`.
   - Create `src/services/security/masterRecoveryService.ts`:
     * Implement `generateMasterRecoveryMnemonic()` (256-bit CSPRNG entropy + 8-bit SHA-256 checksum -> 24 words).
     * Implement `validateRecoveryMnemonic(mnemonic: string)` (word count = 24, dictionary check, bitwise payload reconstruction, constant-time SHA-256 checksum check, returns `{ valid: boolean, error?: string, entropy?: Uint8Array, hexEntropy?: string }`).
     * Implement `mnemonicToSeedSync(mnemonic: string, passphrase?: string): Buffer` and `mnemonicToSeed(mnemonic: string, passphrase?: string): Promise<Buffer>` (PBKDF2-HMAC-SHA512, 2048 iterations, salt `"mnemonic" + passphrase`).
     * Implement hierarchical recovery derivations: `deriveMasterRootKey()`, `deriveMasterPassphrase()`, `deriveStoreRecoveryKey(seed, storeId, unitCode)`, `deriveEmergencyAdminToken(seed)`, and `generateOfflineStoreCertificate()`.
     * Implement memory hygiene: `wipeBuffer(buf)` calling `.fill(0)`.
   - Add automated test suite `tests/security/master_recovery_bip39.test.ts` verifying official Trezor test vectors, 24-word generation/validation round-trips, checksum tampering detection, and key derivation determinism.

2. Feature F11: Timing-Safe Master IPC Bridge & Rate Limiter:
   - Create `electron/security/masterCredentialManager.ts` (using `proposed_masterCredentialManager.ts` as reference):
     * Constant-time comparison using double SHA-256 pre-hashing and `crypto.timingSafeEqual` with 4,096 char bounds.
     * Sliding-window rate limiter: max 5 attempts per 15-minute window (`900,000 ms`), 15-minute cooldown lockout on 5th failure, disk lockfile persistence at `userData/security/master_rate_limit.lock`.
     * Audit event logging on lockout via `CrashLogManager`.
   - Register IPC handlers in `electron/main.ts`:
     * `crypto:verify-master-credential`
     * `crypto:get-master-credential-status`
   - Expose bridge methods in `electron/preload.ts`:
     * `verifyMasterCredential(credential: string)`
     * `getMasterCredentialStatus()`
   - Create `src/services/security/masterCredentialService.ts` (using `proposed_masterCredentialService.ts` as reference):
     * Universal client for renderer with Electron IPC and headless browser fallback.
   - Install automated test suite `tests/security/master_credential_rate_limiter.test.ts` (from `proposed_master_credential_rate_limiter.test.ts`).

3. Verification:
   - Run `npm run test:security` and ensure all security test suites (M1, M2, M3, M4) pass cleanly (0 failures).
   - Run `npm run build` (`tsc && vite build`) and ensure clean compilation with exit code 0.

4. Deliverable:
   - Write your handoff in `/Users/dawidapel/COL Tool/.agents/teamwork/worker_m4_1/handoff.md`.
   - Send a message to the orchestrator confirming completion with test results and summary of files modified.
