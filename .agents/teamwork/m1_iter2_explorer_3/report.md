# Comprehensive Test Alignment & Strategy Report: `tests/security/`

**Agent**: M1 Iteration 2 Explorer 3 (`m1_iter2_explorer_3`)  
**Mission**: Milestone 1: Licensing & Hardware-Bound Activation Engine  
**Target Files**:
- `tests/security/licensing_key_engine.test.ts`
- `tests/security/hardware_binding_anticopy.test.ts`
- `tests/security/licensing_adversarial_challenge.test.ts`
- `tests/security/adversarial_hardware_tamper.test.ts`
- `electron/security/licenseVaultManager.ts`
- `tests/e2e/helpers/mockElectron.mjs`
**Target Commands**: `npm run test:security` and `npm run build`

---

## 1. Executive Summary

A comprehensive investigation into the security test suites under `tests/security/` reveals that while `npm run test:security` currently passes 52 tests and `npm run build` compiles with 0 errors, **the test suite contains 3 critical latent assertion traps that will immediately fail CI/CD as soon as the M1 bug fixes from Explorer 1 and Explorer 2 are applied to `src/services/security/licensingService.ts`**:

1. **Trap 1 (`challenge_6` in `licensing_adversarial_challenge.test.ts`)**:
   - The test was authored by Challenger 1 as a **proof of vulnerability**, asserting `statusAfterAttack.status === 'ACTIVATED'` when an adversary flips `revoked: true` to `revoked: false`.
   - Once Explorer 1's fix cryptographically binds `license.revoked` into the envelope HMAC, tampering will correctly yield `TAMPER_DETECTED`.
   - **Impact**: Without updating the assertion, `challenge_6` will fail immediately with `AssertionError: false == true`.
2. **Trap 2 (`challenge_5` in `licensing_adversarial_challenge.test.ts`)**:
   - The test asserts that passing a non-string (e.g. number) to `verifyKeySignature` throws an unhandled `TypeError` (`expectedStoreId.trim is not a function`).
   - Once Explorer 2's fix sanitizes `expectedStoreId` to safely reject non-strings without throwing, `numericThrew` will be `false`.
   - **Impact**: `assert.equal(numericThrew, true)` will fail immediately with `AssertionError: false == true`.
3. **Trap 3 (`challenge_3` in `licensing_adversarial_challenge.test.ts`)**:
   - 18 invalid store ID test cases (e.g. `STORE:123`, `STORE\x00123`, `../../etc/passwd`, `1`, `12`) specify `shouldThrowOnGen: false`, expecting `generateActivationKey` to generate a key string that is subsequently rejected during `validateKeyFormat`.
   - If Explorer 2 / Worker adds strict validation to `generateActivationKey` that throws on `!/^[A-Z0-9_]{3,16}$/.test(normStoreId)`, all 18 cases will throw unhandled errors.
   - **Impact**: `challenge_3` will crash with 18 unhandled exceptions unless the test harness is aligned.
4. **Electron Import Decoupling (`licenseVaultManager.ts`)**:
   - `electron/security/licenseVaultManager.ts` imports `{ app, safeStorage } from 'electron'` directly. In pure Node.js runners (like `node:test` via `tsx`), static ESM imports of `electron` throw `SyntaxError: The requested module 'electron' does not provide an export named 'app'`.
   - Challenger 2 avoided this by implementing `DiskVaultStorageProvider` inside `adversarial_hardware_tamper.test.ts`. However, to achieve project-wide resilience, `licenseVaultManager.ts` must adopt the codebase-standard safe dynamic resolution pattern from `electron/database/db.ts:9`.
5. **Coverage Gap in `hardware_binding_anticopy.test.ts`**:
   - The `HARDWARE_LOCKOUT` state with `revoked: true` on an intact, persisted envelope is currently untested (the revocation test currently deletes the file, returning `UNACTIVATED`).

---

## 2. Current State Analysis

### 2.1 Empirical Execution Results
- **Command**: `npm run test:security` (`node --import tsx --test "tests/security/**/*.test.ts"`)
  - **Output**:
    ```
    ✔ M1-CHALLENGER-2: Hardware-Bound Anti-Copying & Anti-Tamper Stress Suite (17 tests) (490ms)
    ✔ M1-F2/F3: Hardware Identity & Anti-Copying Enforcement (9 tests) (60ms)
    ✔ M1-CHALLENGE: Adversarial Stress & Vulnerability Testing (10 tests) (163ms)
    ✔ M1-F1: Licensing Key Cryptographic Engine (14 tests) (13ms)
    ℹ tests 52, pass 52, fail 0
    ```
  - **Exit Code**: `0`
- **Command**: `npm run build` (`tsc && vite build`)
  - **Output**:
    - Vite client: 2,546 modules bundled into `dist/`.
    - Electron main: 179 modules bundled into `dist-electron/main.js` (448.42 kB).
    - Electron preload: 2 modules bundled into `dist-electron/preload.js` (7.59 kB).
  - **Exit Code**: `0` (0 TypeScript / bundling errors).

---

## 3. Deep-Dive Inspection of All 4 Test Suites

### 3.1 `tests/security/licensing_key_engine.test.ts` (172 lines)
- **Role**: Baseline functional verification of Feature F1 (Key generation, format validation, HMAC signatures, constant-time equality).
- **Tested Components**:
  - `LicensingService.generateActivationKey`
  - `LicensingService.validateKeyFormat`
  - `LicensingService.verifyKeySignature`
  - `timingSafeStringEqual`
- **Status**: 14 tests pass.
- **Sensitivity to Bug Fixes**:
  - Store IDs used in tests: `'108120'`, `'HQ_MASTER'`, `'HQ_FLEET'`, `'warszawa_janki'`, `'108150'`. All are valid strings conforming to `^[A-Z0-9_]{3,16}$`.
  - Keys used for tampering tests (`test_f1_tampered_store_id_fails_signature`, etc.) test format mutations.
  - **Verdict**: Fully compatible; no modifications required.

---

### 3.2 `tests/security/hardware_binding_anticopy.test.ts` (316 lines)
- **Role**: Baseline functional verification of Features F2 and F3 (Hardware fingerprinting, station activation, anti-cloning, tamper detection, revocation, memory zeroization).
- **Tested Components**:
  - `HardwareIdManager` (determinism, components harvesting, test override).
  - `LicensingService.activateStation`, `verifyStationHardwareLock`, `revokeLicense`, `isStationActivated`.
  - `StoreKeyCache.clear` (in-memory zeroization).
- **Status**: 9 tests pass.
- **Coverage Gap Identified by Reviewer 2**:
  - In `test_f3_license_revocation_returns_unactivated`:
    ```typescript
    // Revoke license
    await service.revokeLicense('Station decommissioned');
    // Storage mock deletes file -> returns UNACTIVATED
    const status = await service.verifyStationHardwareLock();
    assert.equal(status.status, 'UNACTIVATED');
    ```
  - `verifyStationHardwareLock()` lines 501–510 have an explicit branch:
    ```typescript
    if (license.revoked) {
      return {
        status: 'HARDWARE_LOCKOUT',
        isActivated: false,
        hardwareMismatch: false,
        revoked: true,
        license,
        error: license.revokeReason || 'Licencja dla tej stacji została wycofana (Kill-Switch).',
      };
    }
    ```
  - This branch is never exercised because the test storage provider deletes the file upon revocation.
- **Recommended Action**:
  Add `test_f3_persisted_revoked_envelope_triggers_hardware_lockout` to explicitly test that when an envelope remains in storage with `revoked: true` and a valid HMAC signature, `verifyStationHardwareLock()` returns `{ status: 'HARDWARE_LOCKOUT', revoked: true, isActivated: false }`.

---

### 3.3 `tests/security/licensing_adversarial_challenge.test.ts` (529 lines)
- **Role**: Adversarial challenge suite authored by Challenger 1 (massive collision testing, bit flips, brute-force oracle simulation, constant-time variance benchmarking, and vulnerability proofs).
- **Status**: 10 tests currently pass, BUT contains 3 latent traps:

#### Latent Trap 1: `challenge_6_adversarial_kill_switch_tampering_vulnerability` (Lines 476–527)
- **Current Code**:
  ```typescript
  // 3. ATTACK SCENARIO: Adversary edits stored JSON and flips revoked: false
  parsedRevoked.revoked = false;
  delete parsedRevoked.revokeReason;
  savedLicenseStr = JSON.stringify(parsedRevoked);

  // 4. Verify station status
  const statusAfterAttack = await service.verifyStationHardwareLock();

  const killSwitchVulnerabilityConfirmed = statusAfterAttack.status === 'ACTIVATED';

  assert.equal(
    killSwitchVulnerabilityConfirmed,
    true,
    'CRITICAL SECURITY FLAW CONFIRMED: Modifying revoked: false bypasses Kill-Switch without triggering TAMPER_DETECTED!'
  );
  ```
- **The Issue**: Once Worker seals `license.revoked` into `envelopePayload` (`...:${license.revoked ? 'REVOKED' : 'ACTIVE'}`), editing `revoked: false` invalidates the HMAC. `statusAfterAttack.status` will be `'TAMPER_DETECTED'`, NOT `'ACTIVATED'`.
- **Failure upon patch**: `assert.equal(false, true)` throws `ERR_ASSERTION`.
- **Required Action**: Convert `challenge_6` from a vulnerability demonstration into a security regression assertion:
  ```typescript
  assert.equal(
    statusAfterAttack.status,
    'TAMPER_DETECTED',
    'Flipping revoked: false in envelope must invalidate HMAC seal and trigger TAMPER_DETECTED'
  );
  assert.equal(statusAfterAttack.isActivated, false, 'Station must remain locked');
  ```

#### Latent Trap 2: `challenge_5_verify_key_signature_handles_non_string_expected_store_id` (Lines 445–472)
- **Current Code**:
  ```typescript
  // 2. Vulnerability Investigation: What happens if expectedStoreId is ""?
  const emptyStoreResult = LicensingService.verifyKeySignature(key, '', masterSecret);
  assert.equal(typeof emptyStoreResult, 'boolean');

  // 3. Vulnerability Investigation: What happens if expectedStoreId is non-string (number, object)?
  let numericThrew = false;
  try {
    LicensingService.verifyKeySignature(key, (108120 as any), masterSecret);
  } catch (err: any) {
    numericThrew = true;
    assert.ok(err instanceof TypeError, 'Throws TypeError: expectedStoreId.trim is not a function');
  }
  assert.equal(numericThrew, true, 'Proves Finding 2: non-string expectedStoreId causes unhandled TypeError');
  ```
- **The Issue**: Once Worker fixes `verifyKeySignature` to sanitize `expectedStoreId` (rejecting non-strings and empty strings with `return false`), calling `verifyKeySignature(key, 108120)` will NOT throw.
- **Failure upon patch**: `numericThrew` will be `false`, and `assert.equal(numericThrew, true)` will fail.
- **Required Action**: Update `challenge_5` to assert safe handling:
  ```typescript
  // 2. Empty string expectedStoreId must return false:
  const emptyStoreResult = LicensingService.verifyKeySignature(key, '', masterSecret);
  assert.equal(emptyStoreResult, false, 'Empty string expectedStoreId must return false');

  // 3. Non-string expectedStoreId must return false without throwing:
  assert.doesNotThrow(() => {
    const numericResult = LicensingService.verifyKeySignature(key, (108120 as any), masterSecret);
    assert.equal(numericResult, false, 'Numeric expectedStoreId must return false');
  });
  ```

#### Latent Trap 3: `challenge_3_store_id_boundary_values_and_injections` (Lines 225–296)
- **Current Code**:
  Lines 227–253 define 25 test cases. 18 of them have `shouldThrowOnGen: false`, including invalid IDs like `1`, `12`, `STORE-123`, `STORE:123`, `STORE\x00123`, `../../etc/passwd`.
  Lines 267–270 execute:
  ```typescript
  } else {
    // Generation produces a key
    const key = LicensingService.generateActivationKey(testCase.id, 'STORE_CLIENT', masterSecret);
    ...
    // Validate format:
    const formatResult = LicensingService.validateKeyFormat(key);
    assert.equal(formatResult.valid, false);
  ```
- **The Issue**: Explorer 2 was tasked with:
  "2. `generateActivationKey`: Validate `normStoreId` against `^[A-Z0-9_]{3,16}$` before generating a key."
  If Worker modifies `generateActivationKey` to throw on invalid store IDs without updating `challenge_3`, all 18 cases will throw unhandled exceptions in line 269!
- **Required Action**: In `challenge_3`, either:
  1. (Cleanest): Wrap the generation call in a `try/catch`. If generation throws, assert that `testCase.shouldBeValid === false` (confirming early rejection); OR
  2. Set `shouldThrowOnGen: true` for all test cases where `!/^[A-Z0-9_]{3,16}$/.test(testCase.id.trim().toUpperCase())`.

---

### 3.4 `tests/security/adversarial_hardware_tamper.test.ts` (671 lines)
- **Role**: Adversarial challenge suite authored by Challenger 2 (Cloning attacks, disk corruption, MAC address priority resolution, hardware oscillation, and revocation shredding).
- **Tested Components**:
  - `HardwareIdManager` (MAC priority, 1,000 rapid cycles, zero drift).
  - `LicensingService` with `DiskVaultStorageProvider` (AES-256-GCM hardware-keyed disk storage, anti-forensic overwriting).
- **Status**: 17 tests pass cleanly.
- **Top-Level Electron Import Strategy**:
  - When Challenger 1 originally ran tests, this file imported `LicenseVaultManager` from `electron/security/licenseVaultManager.ts`, which threw:
    `SyntaxError: The requested module 'electron' does not provide an export named 'app'`
  - Challenger 2 resolved this by creating `DiskVaultStorageProvider` directly inside the test file (lines 30–109), simulating `LicenseVaultManager`'s AES-256-GCM hardware-keyed disk vault in pure Node.js.
  - This test is currently completely decoupled from Electron and passes 17/17.

---

## 4. Resolution of Top-Level Electron Import Issues in Pure Node Test Runner

### 4.1 The Mechanism of the Failure
When Node.js runs tests with `node --import tsx --test`, it operates in pure Node.js mode.
In Node.js, `require('electron')` resolves to `node_modules/electron/index.js`, which exports a **string** containing the filesystem path to the Electron binary executable.
When a TypeScript/ESM file executes:
```typescript
import { app, safeStorage } from 'electron';
```
Node's ESM loader attempts to resolve the named export `app` on `module.exports`. Because `module.exports` is a string (not an object with named properties), Node halts module evaluation with:
```
SyntaxError: The requested module 'electron' does not provide an export named 'app'
```

### 4.2 The Codebase Pattern for Electron Imports
The codebase already has an established, battle-tested pattern to solve this exact problem in `electron/database/db.ts` lines 5–15 and `electron/database/backupManager.ts` lines 5–15:
```typescript
// Safe dynamic resolution of electron app in both packaged Electron and standalone Node/tsx test runners
let app: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electronModule = typeof require === 'function' ? require('electron') : undefined;
  app = (typeof electronModule === 'object' && electronModule !== null && 'app' in electronModule)
    ? electronModule.app
    : undefined;
} catch {
  app = undefined;
}
```

### 4.3 Proposed Fix in `electron/security/licenseVaultManager.ts`
Replace line 12:
```typescript
// BEFORE (line 12):
import { app, safeStorage } from 'electron';
```
With:
```typescript
// AFTER:
let app: any;
let safeStorage: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const electronModule = typeof require === 'function' ? require('electron') : undefined;
  if (typeof electronModule === 'object' && electronModule !== null) {
    app = 'app' in electronModule ? electronModule.app : undefined;
    safeStorage = 'safeStorage' in electronModule ? electronModule.safeStorage : undefined;
  }
} catch {
  app = undefined;
  safeStorage = undefined;
}
```
**Benefits**:
1. When running inside Electron, `electronModule` contains native `app` and `safeStorage`.
2. When imported into Node.js (test runners, utility scripts), `app` and `safeStorage` become `undefined`.
3. `LicenseVaultManager.isSafeStorageAvailable()` already checks `typeof safeStorage !== 'undefined' && safeStorage.isEncryptionAvailable()`, so it automatically falls back to hardware-keyed `AES-256-GCM` without crashing!
4. `npm run build` bundles this cleanly into `dist-electron/main.js`.

### 4.4 Proposed Addition to `tests/e2e/helpers/mockElectron.mjs`
To ensure that existing e2e test loaders also support `safeStorage`:
In `tests/e2e/helpers/mockElectron.mjs`, export `safeStorage`:
```javascript
export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: (str) => Buffer.from(str),
  decryptString: (buf) => buf.toString('utf8'),
};
```

---

## 5. Complete Action Plan for M1 Worker (Code Snippets & Diffs)

### 5.1 File 1: `src/services/security/licensingService.ts`
Worker must incorporate Explorer 1 and Explorer 2's fixes:

#### A. Input Sanitization in `generateActivationKey` (around line 234):
```typescript
    if (!storeId || typeof storeId !== 'string') {
      throw new Error('storeId jest wymagane do wygenerowania klucza licencyjnego.');
    }

    const normStoreId = storeId.trim().toUpperCase();
    if (!/^[A-Z0-9_]{3,16}$/.test(normStoreId)) {
      throw new Error(`Nieprawidłowy format storeId (${normStoreId}). Wymagane 3-16 znaków alfanumerycznych.`);
    }
```

#### B. Safe `expectedStoreId` Handling in `verifyKeySignature` (around line 321):
```typescript
    if (expectedStoreId !== undefined && expectedStoreId !== null) {
      if (typeof expectedStoreId !== 'string') {
        return false;
      }
      const normExpected = expectedStoreId.trim().toUpperCase();
      if (normExpected.length === 0) {
        return false;
      }

      if (tier === 'STORE_CLIENT' && storeId !== normExpected) {
        return false;
      }

      if (
        tier === 'FLEET_MASTER' &&
        storeId !== normExpected &&
        storeId !== 'HQ_MASTER' &&
        storeId !== 'FLEET_HQ' &&
        storeId !== 'HQ_FLEET'
      ) {
        return false;
      }
    }
```

#### C. Envelope Payload HMAC Sealing `license.revoked` (lines 389, 482, 562):
```typescript
    // In activateStation (line 389):
    const envelopePayload = `ACT:v1:${format.data.fullKey}:${format.data.storeId}:${format.data.tier}:${hwFingerprint}:${activatedAt}:ACTIVE`;

    // In verifyStationHardwareLock (line 482):
    const revocationState = license.revoked === true ? 'REVOKED' : 'ACTIVE';
    const envelopePayload = `ACT:v1:${license.key}:${license.storeId}:${license.tier}:${license.hardwareFingerprint}:${license.activatedAt}:${revocationState}`;

    // In revokeLicense (line 562):
    const envelopePayload = `ACT:v1:${license.key}:${license.storeId}:${license.tier}:${license.hardwareFingerprint}:${license.activatedAt}:REVOKED`;
```

---

### 5.2 File 2: `tests/security/licensing_adversarial_challenge.test.ts`
Worker must align the test assertions:

#### A. In `challenge_3_store_id_boundary_values_and_injections` (around line 256):
Handle cases where `generateActivationKey` throws for invalid store IDs:
```typescript
    for (const testCase of boundaryCases) {
      if (testCase.shouldThrowOnGen) {
        let threw = false;
        try {
          const key = LicensingService.generateActivationKey(testCase.id, 'STORE_CLIENT', masterSecret);
          const val = LicensingService.validateKeyFormat(key);
          assert.equal(val.valid, false);
        } catch {
          threw = true;
        }
        assert.ok(threw || testCase.id.trim() === '');
      } else {
        let key: string | null = null;
        try {
          key = LicensingService.generateActivationKey(testCase.id, 'STORE_CLIENT', masterSecret);
        } catch (err) {
          // If generateActivationKey strictly rejects invalid IDs, verify it was expected to be invalid
          if (!testCase.shouldBeValid) {
            continue; // Clean rejection at generation time
          }
          throw err;
        }

        assert.ok(typeof key === 'string' && key.startsWith('SBX-'));
        const formatResult = LicensingService.validateKeyFormat(key);
        if (testCase.shouldBeValid) {
          assert.equal(formatResult.valid, true);
          assert.equal(LicensingService.verifyKeySignature(key, testCase.id, masterSecret), true);
        } else {
          assert.equal(formatResult.valid, false);
          assert.equal(LicensingService.verifyKeySignature(key, testCase.id, masterSecret), false);
        }
      }
    }
```

#### B. In `challenge_5_verify_key_signature_handles_non_string_expected_store_id` (around line 454):
```typescript
    // 2. Empty string expectedStoreId must return false:
    const emptyStoreResult = LicensingService.verifyKeySignature(key, '', masterSecret);
    assert.equal(emptyStoreResult, false, 'Empty string expectedStoreId must return false');

    // 3. Non-string expectedStoreId must return false without throwing:
    assert.doesNotThrow(() => {
      const numericResult = LicensingService.verifyKeySignature(key, (108120 as any), masterSecret);
      assert.equal(numericResult, false, 'Numeric expectedStoreId must return false');
    });
```

#### C. In `challenge_6_adversarial_kill_switch_tampering_vulnerability` (around line 520):
```typescript
    // 4. Verify station status
    const statusAfterAttack = await service.verifyStationHardwareLock();

    // With HMAC sealing license.revoked, tampering revoked from true to false invalidates signature:
    assert.equal(
      statusAfterAttack.status,
      'TAMPER_DETECTED',
      'Tampering revoked status from true to false must trigger TAMPER_DETECTED'
    );
    assert.equal(statusAfterAttack.isActivated, false, 'Station must remain unactivated');
```

---

### 5.3 File 3: `tests/security/hardware_binding_anticopy.test.ts`
Add the missing coverage test for `HARDWARE_LOCKOUT` with `revoked: true`:

```typescript
  await t.test('test_f3_persisted_revoked_envelope_triggers_hardware_lockout', async () => {
    let savedLicenseStr: string | null = null;
    const hw = 'f'.repeat(64);

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str: string) => {
        savedLicenseStr = str;
        return true;
      },
      loadLicense: async () => savedLicenseStr,
      revokeLicense: async () => true, // Preserves envelope file with revoked: true
    };

    const mockHwProvider: IHardwareFingerprintProvider = {
      getFingerprint: async () => hw,
    };

    const service = new LicensingService(mockStorage, mockHwProvider, masterSecret);
    const key = service.generateActivationKey(storeId, 'STORE_CLIENT');
    await service.activateStation(key, storeId);

    // Revoke license (saves revoked envelope)
    await service.revokeLicense('Remote kill-switch');

    // Verification must detect valid signature with revoked: true -> HARDWARE_LOCKOUT
    const status = await service.verifyStationHardwareLock();
    assert.equal(status.status, 'HARDWARE_LOCKOUT');
    assert.equal(status.revoked, true);
    assert.equal(status.isActivated, false);
  });
```

---

### 5.4 File 4: `electron/security/licenseVaultManager.ts`
Replace `import { app, safeStorage } from 'electron';` with the safe dynamic resolution pattern detailed in Section 4.3.

---

### 5.5 File 5: `tests/e2e/helpers/mockElectron.mjs`
Export `safeStorage` mock object as detailed in Section 4.4.

---

## 6. Verification Method

Once Worker implements these modifications:

1. **Run Full Security Test Suite**:
   ```bash
   npm run test:security
   ```
   **Expected Result**:
   - `tests/security/adversarial_hardware_tamper.test.ts`: 17 passed
   - `tests/security/hardware_binding_anticopy.test.ts`: 10 passed (including new persisted revocation test)
   - `tests/security/licensing_adversarial_challenge.test.ts`: 10 passed (aligned with fixed security contracts)
   - `tests/security/licensing_key_engine.test.ts`: 14 passed
   - **Total**: 51+ tests passed, 0 failures, exit code 0.

2. **Run Production Build Verification**:
   ```bash
   npm run build
   ```
   **Expected Result**:
   - `tsc` type check passes with 0 errors.
   - `vite build` builds `dist/`, `dist-electron/main.js`, and `dist-electron/preload.js` with exit code 0.
