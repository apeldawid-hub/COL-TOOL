# Project Scope: Master Fleet HQ vs Store Client Architecture & Enterprise Security Model

## Architecture
The application runs as an Electron + React desktop application with two distinct runtime profiles:
1. **Fleet Master HQ (`FLEET_MASTER`)**:
   - Central command center for corporate administrators and District Managers.
   - Access to `FleetMasterDashboard.tsx`: 100+ stores catalog with live health/sync telemetry, cryptographic license provisioning modal, store activation/deactivation, remote Kill-Switch revocation, audit trails, and release management.
   - Unrestricted multi-store switching to inspect individual store operations.
   - Master credential verification and BIP-39 24-word disaster recovery.
2. **Store Client (`STORE_CLIENT`)**:
   - Dedicated retail station deployed on store laptops in backrooms.
   - Station activation gate (`ActivationModal.tsx`) requiring valid cryptographically signed activation keys `SBX-<storeId>-<randomHex>-<checksum>`.
   - Hardware-bound license lock: deterministic hardware fingerprint (OS, CPU model/cores, hostname/machine-id) harvested via Electron Main IPC and verified on startup; host OS Keychain (`safeStorage`) prevents copying app data to unauthorized machines.
   - Restricted operational boundary: store selector locked strictly to assigned store(s); all developer/destructive options (clean slate, manual restore, VACUUM/PRAGMA) and fleet telemetry stripped.
   - Ergonomic `StoreClientView.tsx` with single-click friendly `CloudSyncIndicator.tsx`.
3. **Enterprise Security & Disaster Recovery**:
   - 2FA Corporate Authentication enforcing `@amrest.eu` and `@starbucks.com` email domains.
   - Automatic session inactivity lock (15-minute idle timeout) with immediate UI state lock and cryptographic in-memory key zeroization (`entry.key.fill(0)` in `StoreKeyCache.clear()`).
   - Master disaster recovery using zero-dependency BIP-39 24-word mnemonic phrase generator and validator (256 bits entropy + 8 bits checksum) in `masterRecoveryService.ts` and `bip39Wordlist.ts`.
   - Timing-safe, rate-limited Electron IPC bridge for master credential verification.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | F1: Activation Key Cryptographic Engine | Generate and validate signed activation keys: `SBX-<storeId>-<randomHex>-<checksum>` using 64-bit CSPRNG entropy and HMAC-SHA256 signature with constant-time equality in `src/services/security/licensingService.ts` | M1 | R1 |
| 2 | F2: Deterministic Hardware Fingerprinting | Harvest deterministic machine identity (OS, CPU model/cores, machine-id/hostname) in Electron main process (`electron/security/hardwareIdManager.ts`) exposed via `system:get-hardware-fingerprint` IPC with test fallback | M1 | R1 |
| 3 | F3: Hardware-Bound License Lock & Anti-Copying | Bind active license to hardware fingerprint and store in `userData/security/license.enc` via OS Keychain (`safeStorage`); startup check prevents copying app data to unauthorized machines | M1 | R1 |
| 4 | F4: Dual-Profile Runtime Segregation | Implement `appMode: 'FLEET_MASTER' | 'STORE_CLIENT'` state in `AuthContext` and restrict `StoreContext.availableStores` and `storeService` to `assignedStoreIds` | M2 | R2 |
| 5 | F5: Fleet Master Control Center View | Implement `src/components/admin/FleetMasterDashboard.tsx` with 100+ stores catalog, license generator modal, activation/deactivation, remote Kill-Switch revocation, and audit trail | M2 | R2 |
| 6 | F6: Hardened Store Client View & Navigation Restrictions | Implement `src/components/StoreClientView.tsx`: lock store dropdown to assigned store, strip developer options, raw DB reset/restore tools, and telemetry; add friendly `CloudSyncIndicator.tsx` | M2 | R2 |
| 7 | F7: Pre-Login Station Activation Gate Modal | Implement `src/components/ActivationModal.tsx` intercepting unactivated stations before login, verifying license format, signature, and hardware binding | M3 | R3 |
| 8 | F8: Corporate 2FA Authentication Flow | Enforce `@amrest.eu` and `@starbucks.com` domain validation and 2FA OTP verification in `LoginView.tsx` and `authService.ts` | M3 | R3 |
| 9 | F9: Session Inactivity Auto-Lock & Key Zeroization | Implement `useInactivityAutoLock.ts` hook: 15-minute idle listener triggering session lock, modal dismiss, and cryptographic RAM key zeroization (`StoreKeyCache.clear()`) | M3 | R3, R4 |
| 10 | F10: BIP-39 Disaster Recovery Engine | Implement zero-dependency BIP-39 24-word mnemonic generator and validator (2,048-word dictionary in `bip39Wordlist.ts`, `masterRecoveryService.ts`) for disaster recovery seed reconstruction | M4 | R4 |
| 11 | F11: Timing-Safe Master IPC Bridge | Establish `crypto:verify-master-credential` Electron IPC bridge with constant-time verification (`crypto.timingSafeEqual`) and sliding-window rate limiting | M4 | R4 |
| 12 | F12: Automated Security Test Suite & NPM Script | Add `"test"` script in `package.json` and build comprehensive unit/boundary tests in `tests/security/` for keys, fingerprinting, profile isolation, and BIP-39 recovery | Final | R5 |
| 13 | F13: Verification, Version Bump & OTA Hot-Patch | Verify `npm run build` cleanly succeeds, document release in `VERSION_HISTORY.md`, and publish hot-patch OTA bundle | Final | R5 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Licensing & Hardware-Bound Activation Engine | Features F1, F2, F3: `licensingService.ts`, `hardwareIdManager.ts`, IPC `system:get-hardware-fingerprint`, signed key generation/validation, hardware lock | none | DONE |
| M2 | Dual-Profile Runtime & Fleet Master Dashboard | Features F4, F5, F6: `appMode` segregation, `FleetMasterDashboard.tsx` (100+ stores, provisioning, kill-switch), `StoreClientView.tsx`, `CloudSyncIndicator.tsx`, navigation stripping | M1 | DONE |
| M3 | Multi-Factor Authentication & Activation Flow | Features F7, F8, F9: `ActivationModal.tsx`, 2FA corporate domain enforcement, `useInactivityAutoLock.ts` with in-memory key zeroization | M1, M2 | DONE |
| M4 | Master Hardening & Disaster Recovery (BIP-39 & IPC) | Features F10, F11: `bip39Wordlist.ts`, `masterRecoveryService.ts`, `crypto:verify-master-credential` IPC bridge with rate-limiting | M1 | IN_PROGRESS |
| Final | Security Test Suite, Build Verification & OTA Hot-Patch | Features F12, F13: `package.json` test script, `tests/security/*.test.ts`, clean `npm run build`, `VERSION_HISTORY.md` entry, OTA patch package | M1, M2, M3, M4 | PLANNED |

---

## Interface Contracts

### 1. Licensing Engine (`src/services/security/licensingService.ts`)
- Key Format: `SBX-<storeId>-<randomHex>-<checksum>`
- Interface:
  ```typescript
  export interface ActivationKeyData {
    storeId: string;
    randomHex: string;
    checksum: string;
    fullKey: string;
    tier: 'STORE_CLIENT' | 'FLEET_MASTER';
  }

  export interface ActiveLicenseRecord {
    key: string;
    storeId: string;
    tier: 'STORE_CLIENT' | 'FLEET_MASTER';
    hardwareFingerprint: string;
    activatedAt: string;
    expiresAt?: string;
    signature: string;
    revoked: boolean;
  }

  export interface ILicensingService {
    generateActivationKey(storeId: string, tier?: 'STORE_CLIENT' | 'FLEET_MASTER'): string;
    validateKeyFormat(key: string): { valid: boolean; storeId?: string; error?: string };
    verifyKeySignature(key: string): boolean;
    getHardwareFingerprint(): Promise<string>;
    activateStation(key: string): Promise<{ success: boolean; license?: ActiveLicenseRecord; error?: string }>;
    getActiveLicense(): Promise<ActiveLicenseRecord | null>;
    isStationActivated(): Promise<boolean>;
    revokeLicense(): Promise<void>;
  }
  ```

### 2. Electron Main Hardware & Crypto IPC (`electron/main.ts` & `electron/preload.ts`)
- `system:get-hardware-fingerprint`: Returns SHA-256 hash of `OS + CPU + Hostname/MachineId + Primary MAC`.
- `licensing:save-license`: Saves encrypted license envelope using OS Keychain `safeStorage`.
- `licensing:load-license`: Decrypts license envelope from OS Keychain `safeStorage`.
- `licensing:revoke-license`: Deletes local license file and marks revoked.
- `crypto:verify-master-credential`: Timing-safe check with max 5 attempts per 15 minutes.
- `crypto:zeroize-keys`: Flushes all cached in-memory cryptographic keys in the main process.

### 3. Dual-Profile Runtime Contract (`AuthContext` & `StoreContext`)
- `appMode`: `'FLEET_MASTER' | 'STORE_CLIENT'`
- `assignedStoreIds`: `string[]` (In `STORE_CLIENT` mode, `StoreContext.availableStores` filters strictly by this list; store switcher is disabled).
- `FleetMasterDashboard.tsx`: Allows provisioning keys, viewing all 100+ stores, toggling Kill-Switch revocation, and auditing security events.
- `StoreClientView.tsx`: Displays assigned store with friendly `CloudSyncIndicator` and all developer tabs (`firebase_fleet`, `testing_guide`, destructive DB reset/restore) removed.

### 4. Disaster Recovery Contract (`src/services/security/masterRecoveryService.ts`)
- Mnemonic: 24 words from standard BIP-39 English wordlist (2,048 words in `src/services/security/bip39Wordlist.ts`).
- Entropy: 256 bits CSPRNG + 8 bits SHA-256 checksum ($264 / 11 = 24$ words).
- Methods:
  - `generateMasterRecoveryMnemonic(): string`
  - `validateRecoveryMnemonic(mnemonic: string): { valid: boolean; error?: string }`
  - `mnemonicToSeed(mnemonic: string, passphrase?: string): Uint8Array`

---

## Code Layout
- `src/services/security/licensingService.ts`: Core licensing key generation, signature, hardware binding.
- `src/services/security/masterRecoveryService.ts`: BIP-39 24-word generator, validator, and seed derivation.
- `src/services/security/bip39Wordlist.ts`: 2,048 English wordlist embedded zero-dependency.
- `electron/security/hardwareIdManager.ts`: Deterministic hardware identity derivation (macOS, Windows, Linux).
- `electron/preload.ts` & `electron/main.ts`: IPC bindings for hardware fingerprinting, license storage, master verification, key zeroization.
- `src/context/AuthContext.tsx`: AppMode (`FLEET_MASTER` vs `STORE_CLIENT`), station activation status, session user.
- `src/context/StoreContext.tsx`: Filter `availableStores` by `assignedStoreIds` in Store Client mode.
- `src/components/admin/FleetMasterDashboard.tsx`: Fleet catalog (100+ stores), license generator modal, kill-switch, audit trail.
- `src/components/StoreClientView.tsx`: Hardened store client workspace with single-store badge and `CloudSyncIndicator.tsx`.
- `src/components/ActivationModal.tsx`: Pre-login blocking activation modal.
- `src/components/LoginView.tsx`: 2FA corporate domain validation and station activation integration.
- `src/hooks/useInactivityAutoLock.ts`: 15-minute activity timer and in-memory key zeroization.
- `tests/security/`: Automated test suites for licensing keys, hardware binding, profile isolation, and BIP-39 recovery.
- `package.json`: Add `"test"` script.
- `VERSION_HISTORY.md`: Record new release.
