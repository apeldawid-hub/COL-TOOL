# Adversarial Challenge Report — Milestone 1: Hardware-Bound Activation Engine

**Agent**: M1 Fleet Challenger 2 (`m1_fleet_challenger_2`)  
**Parent**: Orchestrator (`bc820f6a-3865-4f82-8517-3240379a0b72`)  
**Target Milestone**: Milestone 1 (Licensing & Hardware-Bound Activation Engine)  
**Date**: 2026-10-26T19:16:00Z  
**Verdict**: **APPROVE** (with 2 architectural recommendations)

---

## 1. Observation

Direct empirical observations from test harness creation, execution, and code inspection:

1. **Cloning Attack Simulation (Machine A -> Machine B)**:
   - File: `src/services/security/licensingService.ts` lines 514–523:
     ```typescript
     const currentHw = await this.getHardwareFingerprint();
     if (license.hardwareFingerprint.toLowerCase() !== currentHw.toLowerCase()) {
       return {
         status: 'HARDWARE_LOCKOUT',
         isActivated: false,
         hardwareMismatch: true,
         revoked: false,
         license,
         error: 'Wykryto próbę uruchomienia bazy na nieautoryzowanym sprzęcie (Hardware Mismatch).',
       };
     }
     ```
   - When a station is activated on Machine A (`hwA`) and the active license envelope is copied to Machine B (`hwB`), `verifyStationHardwareLock()` unconditionally reports `status: 'HARDWARE_LOCKOUT'`, `isActivated: false`, `hardwareMismatch: true`.
   - Verified across single-character fingerprint mutations and confirmed that letter casing (`toLowerCase()`) does not trigger false lockouts.

2. **Disk & Envelope Tampering Detection**:
   - File: `src/services/security/licensingService.ts` lines 482–498:
     ```typescript
     const envelopePayload = `ACT:v1:${license.key}:${license.storeId}:${license.tier}:${license.hardwareFingerprint}:${license.activatedAt}`;
     const expectedSig = crypto
       .createHmac('sha256', this.signingSecret)
       .update(envelopePayload, 'utf8')
       .digest('hex');

     if (!timingSafeStringEqual(license.signature, expectedSig)) {
       return {
         status: 'TAMPER_DETECTED',
         isActivated: false,
         hardwareMismatch: false,
         revoked: false,
         license,
         error: 'Podpis cyfrowy koperty licencji jest niepoprawny (wykryto modyfikację danych).',
       };
     }
     ```
   - Modifying `storeId` in the envelope payload triggers `TAMPER_DETECTED` (`isActivated: false`).
   - Privilege escalation (modifying `tier` from `STORE_CLIENT` to `FLEET_MASTER`) triggers `TAMPER_DETECTED` (`isActivated: false`).
   - Modifying `activatedAt` timestamp triggers `TAMPER_DETECTED` (`isActivated: false`).
   - Injecting a forged HMAC signature triggers `TAMPER_DETECTED` (`isActivated: false`).
   - Truncated or corrupted JSON syntax triggers `TAMPER_DETECTED` (`isActivated: false`).
   - Missing mandatory envelope properties (`key`, `hardwareFingerprint`, `signature`) triggers `TAMPER_DETECTED` (`isActivated: false`).

3. **Disk File Corruption in `license.enc`**:
   - File: `electron/security/licenseVaultManager.ts` lines 99–115:
     ```typescript
     try {
       // ...
       return this.decryptFallback(contentStr);
       // ...
       const decryptedStr = safeStorage.decryptString(fileBuf);
       return decryptedStr && decryptedStr.length > 0 ? decryptedStr : null;
     } catch (err) {
       console.error('[LicenseVaultManager] Błąd odszyfrowania licencji:', err);
       return null;
     }
     ```
   - When bytes inside `license.enc` are corrupted on disk, AES-256-GCM / safeStorage decryption fails and `loadLicense()` catches the error, returning `null`.
   - In `licensingService.ts` line 448:
     ```typescript
     const raw = await this.storageProvider.loadLicense();
     if (!raw) {
       this.cachedLicense = null;
       return {
         status: 'UNACTIVATED',
         isActivated: false,
         hardwareMismatch: false,
         revoked: false,
       };
     }
     ```
   - Observation: When `license.enc` on disk is corrupted, the station unconditionally blocks access (`isActivated: false`), but reports `status: 'UNACTIVATED'` rather than `TAMPER_DETECTED`.

4. **Hardware Identifier Oscillation & Sensitivity**:
   - File: `electron/security/hardwareIdManager.ts` lines 253–322:
     - `getPrimaryMacAddress()` sorts network adapters with deterministic prioritization (`en0` > `eth0` > `wlan0` > `ethernet` > `wi-fi`), secondary priority for numbered physical devices (`en*`, `eth*`, `wlan*`), and alphabetical tie-breaking (`name.localeCompare`).
     - Ignores virtual/ephemeral adapters (`awdl`, `llw`, `utun`, `tun`, `tap`, `docker`, `veth`, `vbox`, `vmnet`, `tailscale`, `wireguard`, `lo`) and zeroed MACs (`00:00:00:00:00:00`).
   - Executed 1,000 rapid query iterations with periodic cache clearing (`clearCache()`); hardware fingerprint produced 0 drift (100% stable).
   - Executed 500 consecutive MAC address queries; produced 0 drift.

5. **Revocation & Kill-Switch Protocol**:
   - File: `src/services/security/licensingService.ts` lines 554–579 & `electron/security/licenseVaultManager.ts` lines 121–138:
     - Before unlinking `license.enc`, `LicenseVaultManager.revokeLicense()` overwrites the file bytes with `crypto.randomBytes(stat.size)` (anti-forensic shredding), then unlinks the file.
     - `licensingService.revokeLicense()` clears memory cache (`this.cachedLicense = null`) and dispatches `sbx:license-revoked` event.
     - Subsequent calls immediately return `isStationActivated() === false` and `getActiveLicense() === null`.
     - Re-activation using a newly issued valid key succeeds cleanly.

6. **Test Suite Execution**:
   - Created test suite: `tests/security/adversarial_hardware_tamper.test.ts` (17 tests).
   - Executed: `npm run test:security`
     ```
     ✔ M1-CHALLENGER-2: Hardware-Bound Anti-Copying & Anti-Tamper Stress Suite (17 tests pass)
     ✔ M1-F2/F3: Hardware Identity & Anti-Copying Enforcement (9 tests pass)
     ✔ M1-CHALLENGE: Adversarial Stress & Vulnerability Testing (10 tests pass)
     ✔ M1-F1: Licensing Key Cryptographic Engine (14 tests pass)
     ℹ tests 52, pass 52, fail 0 (duration: 733 ms)
     ```
   - Executed: `npm run build` (`tsc && vite build`) -> exit code 0, 0 compiler errors.

---

## 2. Logic Chain

1. **Hardware-Bound Non-Repudiation**:
   - From Observation 1, the hardware identity derived by `HardwareIdManager` incorporates Motherboard UUID (`IOPlatformUUID` / `MachineGuid` / `machine-id`), physical MAC, CPU model/cores, and system hostname into an HMAC-SHA256 hash.
   - When station activation takes place, this fingerprint is bound inside the cryptographic envelope seal.
   - Any machine clone running on different hardware fails the check $H_{\text{active}} == H_{\text{host}}$, unconditionally yielding `HARDWARE_LOCKOUT` with `isActivated: false`.
2. **Cryptographic Anti-Tamper Sealing**:
   - From Observation 2, altering any field (`storeId`, `tier`, `key`, `activatedAt`) or injecting an arbitrary signature invalidates the HMAC signature computed with `signingSecret`.
   - Constant-time verification prevents side-channel timing leaks and returns `TAMPER_DETECTED`.
3. **Decoupled Vault Storage & Failure Mode Analysis**:
   - From Observation 3, when physical disk corruption occurs, the outer encryption layer (AES-256-GCM / safeStorage) fails authentication before plaintext parsing.
   - Because `loadLicense()` returns `null`, the station falls back to `UNACTIVATED` rather than `TAMPER_DETECTED`. The security invariant (`isActivated === false`) is strictly maintained: no unauthorized execution is permitted.
4. **Identifier Oscillation Immunity**:
   - From Observation 4, deterministic sorting and adapter filtering eliminate virtual interface noise (such as Tailscale or Docker). 1,000 rapid cycles confirmed zero fingerprint drift.
5. **Zero Credential Remanence**:
   - From Observation 5, revocation combines cryptographic overwriting with memory cache flushing, satisfying enterprise kill-switch requirements.

---

## 3. Caveats & Architectural Notes

1. **`licenseVaultManager.ts` Node Import Coupling**:
   - `electron/security/licenseVaultManager.ts` imports `{ app, safeStorage } from 'electron'`. In pure Node.js environments (such as unit test runners), importing `licenseVaultManager.ts` fails unless an Electron mock loader is registered. Unit test suites must continue using dependency injection (`ILicensingStorageProvider`) or configure the Electron test loader.
2. **Disk Corruption Status Discrepancy (`UNACTIVATED` vs `TAMPER_DETECTED`)**:
   - If `license.enc` exists on disk but is physically corrupted or truncated, `loadLicense()` returns `null`, leading `verifyStationHardwareLock()` to report `UNACTIVATED` rather than `TAMPER_DETECTED`. Access is strictly blocked in both cases (`isActivated === false`), but corporate audit logging in future milestones would benefit from distinguishing "no file" from "decryption failed / corrupted file".
3. **`getActiveLicense()` on `HARDWARE_LOCKOUT`**:
   - `licensingService.getActiveLicense()` returns the license record when status is `HARDWARE_LOCKOUT` to allow the activation UI to display the locked storeId. Upstream UI components must gate access on `isStationActivated()` or `status === 'ACTIVATED'`, never solely on `getActiveLicense() != null`.

---

## 4. Conclusion & Final Verdict

**VERDICT: APPROVE**

Milestone 1 successfully fulfills all hardware-locking, anti-copying, and tamper-resistance requirements:
- Machine cloning attacks are unconditionally neutralized.
- Envelope payload tampering and forged signatures are strictly trapped as `TAMPER_DETECTED`.
- Hardware identity derivation is mathematically deterministic and immune to interface oscillation.
- Revocation securely wipes in-memory credentials and shreds the disk license file.
- All 52 automated security tests pass cleanly in 733 ms, and `npm run build` succeeds with zero errors.

---

## 5. Verification Method

To independently reproduce and verify this assessment:

1. **Execute Empirical Challenger Test Suite**:
   ```bash
   node --import tsx --test "tests/security/adversarial_hardware_tamper.test.ts"
   ```
   *Expected Output*: 17 tests pass (0 failures).

2. **Execute Full Security Test Suite**:
   ```bash
   npm run test:security
   ```
   *Expected Output*: 52 tests pass (0 failures) in ~733 ms across all 4 security suites.

3. **Verify Production Build**:
   ```bash
   npm run build
   ```
   *Expected Output*: `tsc && vite build` completes cleanly with exit code 0.
