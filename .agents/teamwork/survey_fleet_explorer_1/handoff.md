# Handoff Report — Survey Explorer 1 (Licensing, Hardware Binding & Master Hardening)

**Date**: 2026-10-26T16:32:00Z  
**Agent**: `survey_fleet_explorer_1`  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/survey_fleet_explorer_1`  
**Handoff Type**: Hard (Investigation Complete)  

---

## 1. Observation
1. **Existing Security Services**:
   - `src/services/security/encryptionService.ts` lines 1-13 defines AES-256-GCM authenticated encryption engine using PBKDF2-HMAC-SHA256 (600,000 iterations), salt `sbx_vault_salt_v1_${storeId}_${unitCode}`, canonical JSON (RFC 8785 subset), and serialized envelope format `enc:v1:<storeId>:<keyId>:<iv>:<tag>:<ciphertext>`.
   - `src/services/security/encryptionService.ts` lines 94-168 implements `StoreKeyCache` with LRU caching, 1-hour TTL, and explicit cryptographic memory zeroization via `entry.key.fill(0)` on expiry, eviction, and store invalidation.
   - `electron/security/vaultKeyManager.ts` lines 20-30 & 80-95 manages `master_seed.enc` stored in `userData/security/master_seed.enc` protected via Electron `safeStorage` (OS Keychain / DPAPI).
   - `electron/database/backupManager.ts` lines 80-150 manages SQLite database backups per-store with 15-backup rotation and SHA-256 integrity checksums.
2. **Current Device Identification Vulnerability**:
   - `src/services/auth/authService.ts` lines 54-61 implements `getDeviceFingerprint()` as:
     ```typescript
     public static getDeviceFingerprint(): string {
       let uuid = localStorage.getItem(STORAGE_DEVICE_UUID_KEY);
       if (!uuid) {
         uuid = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
         localStorage.setItem(STORAGE_DEVICE_UUID_KEY, uuid);
       }
       return uuid;
     }
     ```
     This is non-deterministic and trivially wiped, spoofed, or copied across machines.
3. **Electron & Preload IPC Channels**:
   - `electron/preload.ts` lines 273-283 exposes crypto IPC channels:
     `cryptoIsSafeStorageAvailable`, `cryptoGetMasterPassphrase`, `cryptoDeriveStoreKey`, `cryptoSafeStorageEncrypt`, `cryptoSafeStorageDecrypt`.
   - `electron/main.ts` lines 1971-1989 implements handlers for those IPC calls.
   - There are currently no IPC handlers for hardware fingerprinting, activation key verification, or master credential validation.
4. **Disaster Recovery & BIP-39 Status**:
   - Grep search for `bip39` or `mnemonic` in the workspace returned zero results. Neither a BIP-39 mnemonic generator nor a validator exists in the current repository.
5. **Licensing Status**:
   - Grep search for `licensing` in `src/` returned zero results. No `licensingService.ts` exists yet.

---

## 2. Logic Chain
1. *From Observation 2 & 3*: Because the renderer process in Electron runs with `nodeIntegration: false` and `contextIsolation: true`, it cannot directly access native operating system devices, motherboard identifiers, or run shell commands. Therefore, deterministic hardware identity must be harvested in the Electron Main process (`electron/main.ts`) using Node's `os`, `crypto`, and system queries (`ioreg` on macOS, `wmic`/CIM on Windows, `/etc/machine-id` on Linux), and surfaced to the renderer via an IPC channel `system:get-hardware-fingerprint`.
2. *From Observation 1 & 3*: Electron's `safeStorage` utilizes the host operating system's credential store (macOS Keychain, Windows DPAPI). If an encrypted license record (`userData/security/license.enc`) and the SQLite database (`store_${id}.db`) are copied to an unauthorized physical machine, the destination OS Keychain will fail to decrypt `safeStorage` ciphertext. Combining this OS Keychain barrier with a deterministic hardware fingerprint check (`license.hardwareFingerprint === currentHwFingerprint`) provides mathematical certainty against unauthorized database copying.
3. *From Requirement R1 & Observation 5*: To generate and validate keys of format `SBX-<storeId>-<randomHex>-<checksum>`, `<randomHex>` provides 64 bits of entropy (8 bytes CSPRNG), and `<checksum>` is derived via `HMAC-SHA256(MASTER_KEY, "SBX:" + storeId + ":" + randomHex).slice(0, 10)`. Constant-time comparison (`crypto.timingSafeEqual`) prevents timing side-channels.
4. *From Observation 4 & Requirement R4*: Implementing BIP-39 with 24 words requires 256 bits of entropy and 8 bits of SHA-256 checksum ($264 / 11 = 24$ words). By embedding the standard 2,048-word English dictionary directly in `src/services/security/bip39Wordlist.ts`, we eliminate heavy third-party crypto-currency dependencies while ensuring full offline operation and 100% deterministic master seed reconstruction in disaster recovery scenarios.
5. *From Observation 1 & Requirement R4*: `StoreKeyCache` in `encryptionService.ts` already implements `key.fill(0)`. By wiring an `InactivityService` that triggers on user idle timeout (default 15 minutes), calling `StoreKeyCache.clear()` and the Electron main zeroization IPC, all unencrypted key buffers in RAM are wiped and the UI session is locked.

---

## 3. Caveats
- In non-Electron environments (such as headless Node test runners or browser dev server previews), native `safeStorage` and `ioreg` are unavailable. The architecture must include deterministic fallbacks for unit tests (e.g. mock hardware IDs or in-memory safeStorage mocks) so `node --test` or `npm run build` continue to succeed cleanly without Electron GUI runtime.
- macOS Gatekeeper / hardened runtime permissions do not block `ioreg -rd1 -c IOPlatformExpertDevice`, but running shell commands in sandboxed Mac App Store builds would require entitlements; however, this app is distributed as an independent DMG / direct release (`build.mac.hardenedRuntime: false` in `package.json`).

---

## 4. Conclusion
1. **Licensing & Hardware Lock (R1)**:
   - Create `src/services/security/licensingService.ts` implementing `generateActivationKey`, `validateKeyFormat`, `verifyKeySignature`, and `activateStation`.
   - Add Electron main-process hardware harvester in `electron/security/hardwareIdManager.ts` and expose via `system:get-hardware-fingerprint` IPC.
   - Enforce hardware lock on application startup in `src/App.tsx`.
2. **Master Hardening & Disaster Recovery (R4)**:
   - Create `src/services/security/bip39Wordlist.ts` (2,048 words) and `src/services/security/masterRecoveryService.ts` for BIP-39 24-word phrase generation and validation.
   - Integrate `InactivityService` with `StoreKeyCache.clear()` for in-memory key zeroization.
   - Establish `crypto:verify-master-credential` IPC bridge with constant-time equality and rate limiting.

All technical details and code contracts have been compiled in `/Users/dawidapel/COL Tool/.agents/teamwork/survey_fleet_explorer_1/survey_report.md`.

---

## 5. Verification Method
1. **Inspect Report Artifacts**:
   - Verify `/Users/dawidapel/COL Tool/.agents/teamwork/survey_fleet_explorer_1/survey_report.md` exists and contains detailed interface definitions, algorithms, and code contracts.
2. **Verify Codebase Immutability**:
   - Run `git status` to verify zero application source code files (`src/`, `electron/`) were modified during this investigation:
     ```bash
     git status --porcelain
     ```
3. **Verify Build & Test Integrity**:
   - Test build command to ensure no regressions were introduced:
     ```bash
     npm run build
     ```
