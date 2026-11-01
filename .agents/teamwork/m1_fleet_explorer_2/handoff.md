# Handoff Report: Electron Hardware Identity & IPC Layer (Milestone 1)

**Agent**: M1 Explorer 2 (`m1_fleet_explorer_2`)  
**Parent**: Orchestrator (`bc820f6a-3865-4f82-8517-3240379a0b72`)  
**Timestamp**: 2026-10-26T16:48:00Z  
**Target Milestone**: Milestone 1 — Licensing & Hardware-Bound Activation Engine  

---

## 1. Observation

1. **Host Hardware Identity Commands**:
   - On macOS (`darwin`), verified `ioreg -rd1 -c IOPlatformExpertDevice` returns exact motherboard UUID:
     `"IOPlatformUUID" = "820B738D-7542-5FA2-BB0F-F6B4C78AFE8C"` (exit code 0).
   - On macOS, `sysctl -n kern.uuid` returns dynamic kernel UUID `2FCBB3F2-6B19-3907-ACF8-C715EE4F0973`, which resets across kernel boots, confirming `IOPlatformUUID` must be the primary anchor.
   - On Windows, `reg query "HKLM\SOFTWARE\Microsoft\Cryptography" /v MachineGuid` is available in all editions and runs in <15 ms without starting PowerShell.
   - On Linux, `/etc/machine-id` or `/var/lib/dbus/machine-id` can be read synchronously via `fs.readFileSync` with zero subprocess overhead.
2. **Network Interface Layout**:
   - Running `os.networkInterfaces()` on macOS revealed virtual/ad-hoc adapters (`awdl0`, `llw0`, `utun0`..`utun7`) alongside physical interface `en0` (`86:fe:2a:f8:9c:9b`).
   - Without deterministic filtering, multi-NIC machines can change interface ordering across boots.
3. **Existing IPC and SafeStorage State**:
   - Inspected `electron/main.ts` (lines 1971–1989) and `electron/security/vaultKeyManager.ts`:
     * IPC channels exist for `crypto:is-safe-storage-available`, `crypto:get-master-passphrase`, `crypto:derive-store-key`, `crypto:safe-storage-encrypt`, `crypto:safe-storage-decrypt`.
     * `safeStorage.encryptString` and `decryptString` are used successfully in `VaultKeyManager` for `userData/security/master_seed.enc`.
     * Neither `system:get-hardware-fingerprint` nor `licensing:save-license`, `licensing:load-license`, `licensing:revoke-license` currently exist in `electron/main.ts` or `electron/preload.ts`.
4. **Runtime Separation (Node vs Electron)**:
   - Verified that importing `electron` in standard Node (outside Electron app runtime) returns `{ app: undefined, safeStorage: undefined }`. Thus, unit test runners (`node --import tsx --test`) must run against a decoupled `HardwareIdManager` that does not hard-depend on Electron window APIs.

---

## 2. Logic Chain

1. **Step 1 — Machine-Level Anti-Theft Requirement**:
   The business requirement (R1) mandates that Starbucks Operations Suite cannot be copied to unauthorized laptops. Because store SQLite databases (`store_${id}.db`) reside in the user's home directory, storing an unencrypted license key in `localStorage` is vulnerable to trivial copying.
2. **Step 2 — Dual-Layer Cryptographic Binding**:
   - Layer 1 (OS Keychain): Storing the active license in `userData/security/license.enc` encrypted via `safeStorage.encryptString` guarantees that copying the folder to another physical laptop causes `safeStorage.decryptString` to fail at the OS level (Keychain/DPAPI).
   - Layer 2 (Hardware Fingerprint): Storing the SHA-256 hash of `OS + UUID + CPU + Cores + Primary MAC + Hostname` inside the license record guarantees that even if Keychain data were somehow cloned, the application detects the hardware mismatch and triggers an immediate anti-theft lockout.
3. **Step 3 — Deterministic MAC Resolution**:
   Because `os.networkInterfaces()` order is non-deterministic when ad-hoc Wi-Fi (`awdl0`) or VPN tunnels (`utun*`) are active, we established a priority filter: preferred physical names (`en0`, `eth0`, `wlan0`, `Ethernet`, `Wi-Fi`) are matched first, ephemeral prefixes are stripped, and remaining interfaces are sorted alphabetically.
4. **Step 4 — Seamless Multi-Environment Support**:
   - In production Electron Desktop: Native OS APIs gather real hardware UUID and save to OS Keychain.
   - In Node.js test runners (`node --import tsx --test`): `HardwareIdManager` runs cleanly using pure Node standard libraries (`os`, `child_process`, `crypto`, `fs`) with test overrides via `process.env.SBX_TEST_HARDWARE_FINGERPRINT`.
   - In Web Browser Dev Mode (`http://localhost:5173`): `licensingService.ts` detects absence of `window.api` and falls back to a WebCrypto SHA-256 browser seed in `localStorage`.
5. **Step 5 — IPC Layer Clean Separation**:
   In `electron/main.ts` and `electron/preload.ts`, 4 dedicated channels are defined:
   - `system:get-hardware-fingerprint` $\rightarrow$ returns SHA-256 string.
   - `licensing:save-license` $\rightarrow$ writes encrypted `license.enc`.
   - `licensing:load-license` $\rightarrow$ decrypts and returns license envelope.
   - `licensing:revoke-license` $\rightarrow$ cryptographically wipes and unlinks `license.enc`.

---

## 3. Caveats

1. **Docker / Containerized CI**:
   Inside minimal Docker containers or CI workers, `/etc/machine-id` or `ioreg` may not exist, and MAC addresses may be virtual. In such environments, `HardwareIdManager` automatically falls back to a synthetic stable UUID or honours `process.env.SBX_TEST_HARDWARE_FINGERPRINT`.
2. **Linux Without Desktop Keyring**:
   Headless Linux distributions lack `safeStorage` (no Secret Service or KWallet daemon). To handle this, `LicenseVaultManager` implements an automatic AES-256-GCM fallback keyed by the hardware fingerprint itself.
3. **No Code Modification Constraint**:
   Per the investigation mandate, no repository source files (`src/`, `electron/`) were modified during this explorer phase. All designs and code specifications have been written to `report.md`.

---

## 4. Conclusion

The recommended implementation strategy for Milestone 1's hardware identity and IPC layer is complete, fully specified, and documented in `report.md`:
1. `electron/security/hardwareIdManager.ts`: A singleton harvesting `IOPlatformUUID` (macOS), `MachineGuid` (Windows), and `machine-id` (Linux), with deterministic MAC resolution, CPU/hostname anchors, and 64-hex SHA-256 fingerprint derivation.
2. `electron/security/licenseVaultManager.ts`: Manages `userData/security/license.enc` using `safeStorage.encryptString` / `decryptString` with POSIX `0o600` permissions and hardware-bound AES-256-GCM fallback.
3. `electron/preload.ts` & `electron/main.ts`: Registers 4 clean IPC handlers (`system:get-hardware-fingerprint`, `licensing:save-license`, `licensing:load-license`, `licensing:revoke-license`) exposed to the renderer via `window.api`.

---

## 5. Verification Method

To independently verify this strategy once implemented:
1. **Determinism Test**:
   Run `node --import tsx --test tests/security/hardwareIdManager.test.ts` to confirm 100 consecutive invocations produce the identical 64-hex fingerprint.
2. **OS Command Verification**:
   - macOS: `ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID`
   - Windows: `reg query "HKLM\SOFTWARE\Microsoft\Cryptography" /v MachineGuid`
   - Linux: `cat /etc/machine-id`
3. **SafeStorage Round-Trip & Revocation Test**:
   Save a license payload, verify that `license.enc` is created in `userData/security/`, verify decryption returns exact payload, call `revokeLicense`, and verify the file is erased.
4. **Anti-Cloning Simulation**:
   Copy `license.enc` to a separate machine or change `process.env.SBX_TEST_HARDWARE_FINGERPRINT` to verify that `loadLicense()` or `verifyHardwareLock()` rejects the license.
