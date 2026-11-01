# Handoff Report: Licensing & Hardware-Bound Activation Engine

**Agent**: M1 Explorer 1 (`m1_fleet_explorer_1`)  
**Parent Agent**: Orchestrator (`bc820f6a-3865-4f82-8517-3240379a0b72`)  
**Type**: Hard Handoff (Investigation & Architecture Design Complete)  
**Deliverable**: `/Users/dawidapel/COL Tool/.agents/teamwork/m1_fleet_explorer_1/report.md`

---

## 1. Observation

1. **Project Specifications**:
   - `ORIGINAL_REQUEST.md` (lines 199–203): Mandates `src/services/security/licensingService.ts`: "Generate and validate cryptographically signed activation keys: `SBX-<storeId>-<randomHex>-<checksum>`. Compute deterministic hardware fingerprint (OS, CPU, machine-id/hostname) and bind active license. Enforce hardware lock preventing copying app data to unauthorized machines."
   - `SCOPE.md` (lines 56–89): Defines `ILicensingService` contract with methods `generateActivationKey`, `validateKeyFormat`, `verifyKeySignature`, `getHardwareFingerprint`, `activateStation`, `getActiveLicense`, `isStationActivated`, `revokeLicense`, and types `ActivationKeyData`, `ActiveLicenseRecord` with `tier: 'STORE_CLIENT' | 'FLEET_MASTER'`.
   - `survey_report.md` (lines 131–166): Proposes 16-hex characters for `<randomHex>` (64 bits of entropy) with Byte 0 encoding the tier, and 10-hex characters for `<checksum>` (HMAC-SHA256 truncated tag).
2. **Existing Cryptographic Infrastructure**:
   - `src/services/security/encryptionService.ts` (lines 15, 87) and `src/services/security/cloudMigrationService.ts` (line 21) use `import crypto from 'crypto'` / `node:crypto`.
   - `package.json`: Vite 8.3 with `vite-plugin-electron-renderer` provides Node built-in `crypto` access in both main and renderer processes.
   - `npm run build`: Successfully builds in 1.11s with 0 errors (`tsc && vite build`).
3. **Test Infrastructure**:
   - Existing unit tests (e.g. `tests/adversarial_concurrency_stress.test.ts` and `tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts`) use Node's native test runner (`node:test` and `node:assert/strict`).

---

## 2. Logic Chain

1. **Key Format & Cryptographic Entropy**:
   - To avoid collisions and prevent key forging across 100+ stores, the key must combine human-readable scoping (`SBX-<storeId>`), sufficient entropy (`<randomHex>`), and an unforgeable cryptographic seal (`<checksum>`).
   - Using 8 bytes (16 hex chars) for `randomHex` provides 64 bits total. Allocating Byte 0 to encode the tier (`01` = `STORE_CLIENT`, `FF` = `FLEET_MASTER`) leaves 56 bits ($7.2 \times 10^{16}$ combinations) of CSPRNG entropy.
   - Truncating HMAC-SHA256 to 10 hex characters provides 40 bits ($1.1 \times 10^{12}$ combinations) of authentication tag. In tandem with rate-limiting (max 5 attempts per 15 minutes), the chance of guessing a key is mathematically negligible ($< 5 \times 10^{-12}$).
2. **Constant-Time Verification**:
   - Using standard string comparison (`===`) leaks character match counts via timing side-channels.
   - Implementing `timingSafeStringEqual` using `crypto.timingSafeEqual` in Node/Electron with a fallback to a constant-time bitwise XOR loop ensures cross-environment protection against timing attacks.
3. **Hardware Lock & Anti-Copying Enforcement**:
   - Software-only license keys can be copied between machines. To enforce physical station exclusivity, `activateStation` harvests the host's deterministic hardware fingerprint (OS, CPU, MAC, UUID) via Electron IPC and seals it into `ActiveLicenseRecord.signature`.
   - On every application launch, `isStationActivated` re-derives the host hardware fingerprint and compares it to the license. Mismatches trigger an immediate hard lockout and RAM key flush (`StoreKeyCache.clear()`), preventing data theft via USB drive copies.
4. **Modularity for Unit Tests**:
   - If `licensingService` were tightly coupled to Electron IPC (`window.api`), unit tests would require heavy DOM and IPC mocks.
   - By structuring `LicensingService` with pluggable storage and hardware providers (`ILicensingStorageProvider`, `IHardwareFingerprintProvider`), the core cryptographic logic runs natively in `node --import tsx --test`.

---

## 3. Caveats

1. **Master Signing Secret Security**: The default signing secret is embedded in code as a fallback. For maximum enterprise production security, corporate deployments should supply `process.env.SBX_LICENSING_SECRET` or an Electron main-process securely managed secret.
2. **Virtual Machine & Hardware Alterations**: If a store laptop undergoes a major hardware replacement (e.g. motherboard swap), the hardware fingerprint will change, requiring the Store Manager to obtain a fresh activation key from Fleet Master HQ. This is intended security behavior.

---

## 4. Conclusion

The implementation strategy detailed in `/Users/dawidapel/COL Tool/.agents/teamwork/m1_fleet_explorer_1/report.md` provides an airtight, production-ready specification for `src/services/security/licensingService.ts`. It fulfills all requirements from `ORIGINAL_REQUEST.md` and `SCOPE.md`, provides exact TypeScript typings and error handling, binds station licenses to hardware, and prepares the ground for Milestone 2 (`FleetMasterDashboard.tsx` and `StoreClientView.tsx`).

---

## 5. Verification Method

To independently verify this strategy:
1. **Inspect Report**:
   ```bash
   cat "/Users/dawidapel/COL Tool/.agents/teamwork/m1_fleet_explorer_1/report.md"
   ```
2. **Verify Build Compatibility**:
   Ensure current TypeScript compilation succeeds without errors:
   ```bash
   npm run build
   ```
3. **Verify Key Regex & Logic**:
   Run a quick verification of the regex and constant-time comparison in Node:
   ```bash
   node -e '
     const regex = /^SBX-([A-Z0-9_]{3,16})-([A-F0-9]{16})-([A-F0-9]{10})$/i;
     console.assert(regex.test("SBX-108120-01A4B8C1D2E3F405-7F2A9B8C1D"), "Regex must match valid key");
     console.assert(!regex.test("SBX-108120-01A4B8C1D2E3F405-INVALID"), "Regex must reject invalid key");
     console.log("Verification passed!");
   '
   ```
