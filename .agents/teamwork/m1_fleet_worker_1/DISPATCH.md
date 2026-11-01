## 2026-10-26T16:45:00Z
You are M1 Worker 1 implementing Milestone 1: Licensing & Hardware-Bound Activation Engine.
Your working directory is:
/Users/dawidapel/COL Tool/.agents/teamwork/m1_fleet_worker_1

MANDATORY FIRST STEP:
Read the project specifications in:
/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Specifically section "## Follow-up — 2026-10-26T16:11:59Z" and AGENTS.md.
Also read the scope document in:
/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_4/SCOPE.md

AND THOROUGHLY STUDY THE SYNTHESIZED EXPLORER REPORTS:
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_fleet_explorer_1/report.md
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_fleet_explorer_2/report.md
- /Users/dawidapel/COL Tool/.agents/teamwork/m1_fleet_explorer_3/report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP FOR THIS TASK:
- `src/services/security/licensingService.ts`
- `electron/security/hardwareIdManager.ts`
- `electron/security/licenseVaultManager.ts`
- `electron/main.ts` (IPC handlers registration for licensing & hardware fingerprint)
- `electron/preload.ts` (exposing licensing and hardware APIs via window.api)
- `src/types/` (if needed for Electron API or Licensing types)
- `tests/security/licensing_key_engine.test.ts`
- `tests/security/hardware_binding_anticopy.test.ts`
- `package.json` (add `"test": "node --import tsx --test \"tests/**/*.test.ts\""` script)

IMPLEMENTATION REQUIREMENTS:
1. `package.json`:
   - Add `"test": "node --import tsx --test \"tests/**/*.test.ts\""` to `"scripts"`.

2. `electron/security/hardwareIdManager.ts`:
   - Implement deterministic cross-platform hardware identity harvesting:
     * macOS: `IOPlatformUUID` via `ioreg -rd1 -c IOPlatformExpertDevice`, fallback `sysctl -n kern.uuid`.
     * Windows: `MachineGuid` via `reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid`, fallback CIM UUID.
     * Linux: `/etc/machine-id` or `/var/lib/dbus/machine-id`.
     * Deterministic primary MAC selection (filtering ephemeral `awdl`, `utun`, `docker`, prioritizing `en0`/`eth0`/`wlan0`, sorting alphabetically).
     * CPU model & core count, machine hostname.
     * Calculate 64-hex SHA-256 fingerprint with salt `sbx_hw_anchor_v1_`.
     * Support `process.env.SBX_TEST_HARDWARE_FINGERPRINT` override for test suites and headless environments.
     * Export singleton `hardwareIdManager` with `getHardwareFingerprint()`.

3. `electron/security/licenseVaultManager.ts`:
   - Manage encrypted license record in `userData/security/license.enc` (create dir if missing, POSIX `0o600`).
   - Use `safeStorage.encryptString` / `decryptString` with hardware-keyed AES-256-GCM fallback if desktop safeStorage is unavailable.
   - Methods: `saveLicense(payload: string): Promise<boolean>`, `loadLicense(): Promise<string | null>`, `revokeLicense(): Promise<boolean>`.

4. `electron/main.ts` & `electron/preload.ts`:
   - Register IPC handlers:
     * `system:get-hardware-fingerprint` -> returns hardware fingerprint.
     * `licensing:save-license` -> saves encrypted license to vault.
     * `licensing:load-license` -> loads and decrypts license from vault.
     * `licensing:revoke-license` -> wipes and removes license file.
   - Expose in `electron/preload.ts` under `api`:
     * `getHardwareFingerprint(): Promise<string>`
     * `saveLicense(payload: string): Promise<boolean>`
     * `loadLicense(): Promise<string | null>`
     * `revokeLicense(): Promise<boolean>`
   - Update `IElectronAPI` / `electron.d.ts` so TypeScript compiles cleanly.

5. `src/services/security/licensingService.ts`:
   - Canonical format: `SBX-<storeId>-<randomHex>-<checksum>`
     * 16 hex characters for `<randomHex>` (64-bit entropy).
     * Byte 0 encodes tier (`01` = `STORE_CLIENT`, `FF` = `FLEET_MASTER`), Bytes 1..7 are CSPRNG entropy.
     * Checksum: 10 hex characters HMAC-SHA256 of `SBX:<tier>:<storeId>:<randomHex>` using signing secret.
     * Constant-time comparison (`timingSafeStringEqual` using `crypto.timingSafeEqual` with bitwise XOR fallback loop).
   - Implement all methods of `ILicensingService`:
     * `generateActivationKey(storeId: string, tier?: 'STORE_CLIENT' | 'FLEET_MASTER'): string`
     * `validateKeyFormat(key: string): { valid: boolean; storeId?: string; tier?: string; randomHex?: string; checksum?: string; error?: string }`
     * `verifyKeySignature(key: string): boolean`
     * `getHardwareFingerprint(): Promise<string>`
     * `activateStation(key: string): Promise<{ success: boolean; license?: ActiveLicenseRecord; error?: string }>`
     * `getActiveLicense(): Promise<ActiveLicenseRecord | null>`
     * `isStationActivated(): Promise<boolean>`
     * `revokeLicense(): Promise<void>`
     * `verifyStationHardwareLock(): Promise<{ status: 'ACTIVATED' | 'UNACTIVATED' | 'HARDWARE_LOCKOUT' | 'TAMPER_DETECTED'; license?: ActiveLicenseRecord; error?: string }>`
   - Support pluggable storage & hardware providers so unit tests run cleanly in Node test runner without Electron GUI.

6. Automated Test Suites in `tests/security/`:
   - `tests/security/licensing_key_engine.test.ts`:
     * Format validation regex (valid/invalid store IDs, hex lengths, casing).
     * Checksum verification (valid keys pass, modified characters fail, forged keys fail).
     * Constant-time equality verification.
     * Tier encoding round-trip (`STORE_CLIENT` vs `FLEET_MASTER`).
     * Collision resistance (no duplicate keys across 1,000 generated keys).
   - `tests/security/hardware_binding_anticopy.test.ts`:
     * Deterministic fingerprint consistency across multiple invocations.
     * Station activation round-trip (valid key + current hardware = ACTIVATED).
     * Anti-copying hardware mismatch rejection: license bound to Hardware A loaded on simulated Hardware B returns `HARDWARE_LOCKOUT`.
     * Tampered signature detection: modifying storeId or fingerprint in active license returns `TAMPER_DETECTED`.
     * Revocation: `revokeLicense()` clears active license and returns `UNACTIVATED`.

VERIFICATION:
- Run `node --import tsx --test "tests/security/**/*.test.ts"` and verify all unit tests pass.
- Run `npm run build` and verify TypeScript compilation and Vite build succeed cleanly with 0 errors.
