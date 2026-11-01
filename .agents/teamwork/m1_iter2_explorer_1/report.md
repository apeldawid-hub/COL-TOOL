# Architectural & Cryptographic Fix Strategy: Kill-Switch HMAC Envelope Binding

**Document**: Recommendation Report — Milestone 1 Iteration 2  
**Author**: M1 Iteration 2 Explorer 1 (`m1_iter2_explorer_1`)  
**Target File**: `src/services/security/licensingService.ts`  
**Related Tests**: `tests/security/licensing_adversarial_challenge.test.ts`, `tests/security/hardware_binding_anticopy.test.ts`  
**Timestamp**: 2026-10-26T18:35:00Z  

---

## 1. Executive Summary

In Milestone 1 Gate 1 review, Challenger 1 (`m1_fleet_challenger_1`) uncovered a **Critical Security Vulnerability** in the station licensing and remote Kill-Switch engine:
The HMAC-SHA256 signature calculated over the active license envelope (`ActiveLicenseRecord.signature`) completely omits the `license.revoked` status from its signing payload.

Consequently, an active license payload and a revoked license payload share an **identical HMAC signature**:
$$\text{HMAC}(K_{sign}, \text{ACT:v1:}\dots\text{:activatedAt}) \equiv \text{HMAC}(K_{sign}, \text{ACT:v1:}\dots\text{:activatedAt})$$

An attacker or compromised station with access to local storage can tamper with a revoked license by flipping `"revoked": true` to `"revoked": false`. When the application validates the station status on boot via `verifyStationHardwareLock()`, the HMAC signature check succeeds completely, the revocation flag evaluates to `false`, and the station transitions into `ACTIVATED` status. The remote Kill-Switch is bypassed without triggering `TAMPER_DETECTED`.

This report provides the **exact, production-grade fix strategy**:
1. Formulates the canonical **8-segment envelope payload format** that cryptographically binds `license.revoked` via explicit enum tokens (`'ACTIVE'` vs `'REVOKED'`).
2. Introduces a centralized, non-duplicative private helper `computeEnvelopePayload(...)` in `LicensingService` to guarantee strict signature-generation and signature-verification parity.
3. Provides exact drop-in code modifications for all 3 occurrences (`activateStation:389`, `verifyStationHardwareLock:482`, and `revokeLicense:562`).
4. Details the necessary test reconciliation in `tests/security/licensing_adversarial_challenge.test.ts` (inverting `challenge_6` from asserting the vulnerability exists to asserting tamper rejection).

---

## 2. Vulnerability Deep Dive (Root Cause Analysis)

### 2.1 The Vulnerable Implementation

In `src/services/security/licensingService.ts`, the active license envelope is signed and verified using an envelope payload template string across three locations:

1. **Station Activation (`activateStation`, line 389)**:
   ```typescript
   // Line 389:
   const envelopePayload = `ACT:v1:${format.data.fullKey}:${format.data.storeId}:${format.data.tier}:${hwFingerprint}:${activatedAt}`;
   const envelopeSig = crypto
     .createHmac('sha256', this.signingSecret)
     .update(envelopePayload, 'utf8')
     .digest('hex');

   const license: ActiveLicenseRecord = {
     version: 'v1',
     key: format.data.fullKey,
     storeId: format.data.storeId,
     tier: format.data.tier,
     hardwareFingerprint: hwFingerprint,
     activatedAt,
     signature: envelopeSig,
     revoked: false,
   };
   ```

2. **Station Boot & Hardware Lock Verification (`verifyStationHardwareLock`, line 482)**:
   ```typescript
   // Line 482:
   const envelopePayload = `ACT:v1:${license.key}:${license.storeId}:${license.tier}:${license.hardwareFingerprint}:${license.activatedAt}`;
   const expectedSig = crypto
     .createHmac('sha256', this.signingSecret)
     .update(envelopePayload, 'utf8')
     .digest('hex');

   if (!timingSafeStringEqual(license.signature, expectedSig)) {
     return { status: 'TAMPER_DETECTED', ... };
   }

   // Line 501: Check revocation status
   if (license.revoked) {
     return { status: 'HARDWARE_LOCKOUT', revoked: true, ... };
   }
   ```

3. **Remote Kill-Switch Revocation (`revokeLicense`, line 562)**:
   ```typescript
   // Line 562:
   const license: ActiveLicenseRecord = typeof raw === 'string' ? JSON.parse(raw) : raw;
   license.revoked = true;
   license.revokedAt = new Date().toISOString();
   license.revokeReason = reason;

   const envelopePayload = `ACT:v1:${license.key}:${license.storeId}:${license.tier}:${license.hardwareFingerprint}:${license.activatedAt}`;
   license.signature = crypto
     .createHmac('sha256', this.signingSecret)
     .update(envelopePayload, 'utf8')
     .digest('hex');
   ```

### 2.2 Attack Mechanics & Proof of Vulnerability

The vulnerability manifests through the following sequence:

```
[Fleet Master]                      [Compromised Store Station]
      |                                           |
      |--- 1. Issue Kill-Switch (Revocation) ---->|
      |                                           | Storage writes revoked license:
      |                                           | {
      |                                           |   "key": "SBX-108120-...",
      |                                           |   "revoked": true,
      |                                           |   "signature": HMAC(ACT:v1:...:activatedAt)
      |                                           | }
      |                                           |
      |                                           | 2. ATTACKER EDITS LOCAL JSON:
      |                                           |    "revoked": false
      |                                           |
      |                                           | 3. Station restarts -> verifyStationHardwareLock()
      |                                           |    Calculates HMAC over:
      |                                           |    `ACT:v1:...:${license.activatedAt}`
      |                                           |    MATCHES SIGNATURE! (Signature valid!)
      |                                           |
      |                                           | 4. Evaluates `if (license.revoked)` -> FALSE!
      |                                           |    Evaluates Hardware Fingerprint -> MATCH!
      |                                           |
      |                                           |<-- Status: ACTIVATED (Kill-Switch Bypassed!)
```

This vulnerability was empirically proven in Challenger 1's test harness (`tests/security/licensing_adversarial_challenge.test.ts:501-527`):
```typescript
parsedRevoked.revoked = false;
delete parsedRevoked.revokeReason;
savedLicenseStr = JSON.stringify(parsedRevoked);

const statusAfterAttack = await service.verifyStationHardwareLock();
assert.equal(statusAfterAttack.status === 'ACTIVATED', true); // Flaw confirmed
```

---

## 3. Inventory of All Envelope Signing & Verification Occurrences

An exhaustive search across the entire codebase (`src/`, `electron/`, `tests/`) reveals that envelope signing and verification logic is strictly localized:

| # | File & Location | Purpose | Role | Current Payload Expression |
|---|-----------------|---------|------|----------------------------|
| 1 | `src/services/security/licensingService.ts:389` | Station initial activation | **Sign** (Seal Active) | `ACT:v1:${format.data.fullKey}:${format.data.storeId}:${format.data.tier}:${hwFingerprint}:${activatedAt}` |
| 2 | `src/services/security/licensingService.ts:482` | Lock & tamper verification | **Verify** | `ACT:v1:${license.key}:${license.storeId}:${license.tier}:${license.hardwareFingerprint}:${license.activatedAt}` |
| 3 | `src/services/security/licensingService.ts:562` | Remote Kill-Switch execution | **Sign** (Seal Revoked) | `ACT:v1:${license.key}:${license.storeId}:${license.tier}:${license.hardwareFingerprint}:${license.activatedAt}` |
| 4 | `src/services/security/licensingService.ts:427` | `getActiveLicense()` | **Consumer** | Delegates to `verifyStationHardwareLock()` |
| 5 | `src/services/security/licensingService.ts:543` | `isStationActivated()` | **Consumer** | Delegates to `verifyStationHardwareLock()` |
| 6 | `electron/security/licenseVaultManager.ts` | POSIX 0o600 OS Keychain / AES-GCM persistence | **Storage Vault** | Transparent container (`safeStorage` / AES-GCM); does not parse internal HMAC envelope |
| 7 | `tests/security/licensing_adversarial_challenge.test.ts:517` | Challenge 6 stress test | **Adversarial Test** | Documents and asserts Kill-Switch bypass flaw |
| 8 | `tests/security/hardware_binding_anticopy.test.ts:244` | Tampered storeId in envelope | **Adversarial Test** | Tests envelope tampering detection |
| 9 | `tests/security/adversarial_hardware_tamper.test.ts:251-360` | Tamper suites 2.1 - 2.4 | **Adversarial Test** | Tests storeId, tier, activatedAt, and forged HMAC tampering |

**Crucial Finding**: No other file in `electron/` or `src/` computes or validates `ACT:v1:`. All envelope cryptographic authority is encapsulated within `LicensingService`.

---

## 4. Recommended Fix Strategy & Specification

### 4.1 The Canonical 8-Segment Envelope Payload Format

The envelope payload must be expanded to **8 colon-separated tokens**:

$$\mathbf{Payload} = \texttt{ACT:v1:} \parallel \mathbf{Key} \parallel \texttt{:} \parallel \mathbf{StoreId} \parallel \texttt{:} \parallel \mathbf{Tier} \parallel \texttt{:} \parallel \mathbf{HwFingerprint} \parallel \texttt{:} \parallel \mathbf{ActivatedAt} \parallel \texttt{:} \parallel \mathbf{RevocationStatus}$$

Where:
- Token 0: `ACT` (Prefix identifier for station activation envelope)
- Token 1: `v1` (Envelope specification schema version)
- Token 2: `key` (Canonical license key, e.g. `SBX-108120-01A1B2C3D4E5F678-1234567890`)
- Token 3: `storeId` (Store identifier, e.g. `108120`)
- Token 4: `tier` (License tier: `'STORE_CLIENT'` | `'FLEET_MASTER'`)
- Token 5: `hardwareFingerprint` (64-character lowercase SHA-256 hex string)
- Token 6: `activatedAt` (ISO-8601 UTC timestamp, e.g. `2026-10-26T18:00:00.000Z`)
- **Token 7: `status`** (Cryptographic revocation state: **`'ACTIVE'`** | **`'REVOKED'`**)

#### Rationale for `'ACTIVE'` vs `'REVOKED'` String Enum
Rather than raw boolean string coercion (`'true'` / `'false'`), explicit enum tokens `'ACTIVE'` and `'REVOKED'` are strictly specified because:
1. **Total Immunity to Boolean Coercion Bugs**: In JavaScript/TypeScript, `"false"` evaluates to truthy (`Boolean("false") === true`), whereas `undefined` evaluates to falsy. Using `revoked === true ? 'REVOKED' : 'ACTIVE'` ensures that only the exact boolean literal `true` binds to `'REVOKED'`.
2. **Deterministic Canonicalization**: Missing, null, undefined, or empty string properties all collapse strictly to `'ACTIVE'`, preventing accidental bypasses.
3. **Audit Trail Readability**: Cryptographic payloads in logs or audit certificates remain unambiguous and human-readable.

---

### 4.2 Centralized Helper: `computeEnvelopePayload`

To eliminate code duplication across lines 389, 482, and 562, and prevent any future format drift, introduce a dedicated private method in `LicensingService`:

```typescript
  /**
   * Constructs the canonical envelope payload string to be cryptographically signed with HMAC-SHA256.
   * Seals key, storeId, tier, hardwareFingerprint, activatedAt, and revocation status into the HMAC digest.
   *
   * Format: ACT:v1:<key>:<storeId>:<tier>:<hardwareFingerprint>:<activatedAt>:<ACTIVE|REVOKED>
   */
  private computeEnvelopePayload(
    key: string,
    storeId: string,
    tier: string,
    hardwareFingerprint: string,
    activatedAt: string,
    revoked: boolean
  ): string {
    const status = revoked === true ? 'REVOKED' : 'ACTIVE';
    return `ACT:v1:${key}:${storeId}:${tier}:${hardwareFingerprint}:${activatedAt}:${status}`;
  }
```

---

### 4.3 Precise Drop-in Replacements in `src/services/security/licensingService.ts`

#### Occurrence 1: Line 389 in `activateStation`
*Before*:
```typescript
    const hwFingerprint = await this.getHardwareFingerprint();
    const activatedAt = new Date().toISOString();

    // Compute envelope HMAC signature
    const envelopePayload = `ACT:v1:${format.data.fullKey}:${format.data.storeId}:${format.data.tier}:${hwFingerprint}:${activatedAt}`;
    const envelopeSig = crypto
      .createHmac('sha256', this.signingSecret)
      .update(envelopePayload, 'utf8')
      .digest('hex');
```

*After*:
```typescript
    const hwFingerprint = await this.getHardwareFingerprint();
    const activatedAt = new Date().toISOString();

    // Compute envelope HMAC signature sealing hardware and ACTIVE status
    const envelopePayload = this.computeEnvelopePayload(
      format.data.fullKey,
      format.data.storeId,
      format.data.tier,
      hwFingerprint,
      activatedAt,
      false // Newly activated station is always unrevoked (ACTIVE)
    );
    const envelopeSig = crypto
      .createHmac('sha256', this.signingSecret)
      .update(envelopePayload, 'utf8')
      .digest('hex');
```

#### Occurrence 2: Line 482 in `verifyStationHardwareLock`
*Before*:
```typescript
    // Verify envelope HMAC signature
    const envelopePayload = `ACT:v1:${license.key}:${license.storeId}:${license.tier}:${license.hardwareFingerprint}:${license.activatedAt}`;
    const expectedSig = crypto
      .createHmac('sha256', this.signingSecret)
      .update(envelopePayload, 'utf8')
      .digest('hex');

    if (!timingSafeStringEqual(license.signature, expectedSig)) {
      console.warn('⚠️ [LicensingService] Wykryto manipulację w kopercie licencji (Signature mismatch).');
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

*After*:
```typescript
    // Verify envelope HMAC signature sealing key, storeId, tier, hardware, and revocation status
    const envelopePayload = this.computeEnvelopePayload(
      license.key,
      license.storeId,
      license.tier,
      license.hardwareFingerprint,
      license.activatedAt,
      Boolean(license.revoked)
    );
    const expectedSig = crypto
      .createHmac('sha256', this.signingSecret)
      .update(envelopePayload, 'utf8')
      .digest('hex');

    if (!timingSafeStringEqual(license.signature, expectedSig)) {
      console.warn('⚠️ [LicensingService] Wykryto manipulację w kopercie licencji (Signature mismatch).');
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

#### Occurrence 3: Line 562 in `revokeLicense`
*Before*:
```typescript
  public async revokeLicense(reason: string = 'Wycofanie przez administratora floty'): Promise<void> {
    const raw = await this.storageProvider.loadLicense();
    if (raw) {
      try {
        const license: ActiveLicenseRecord = typeof raw === 'string' ? JSON.parse(raw) : raw;
        license.revoked = true;
        license.revokedAt = new Date().toISOString();
        license.revokeReason = reason;
        const envelopePayload = `ACT:v1:${license.key}:${license.storeId}:${license.tier}:${license.hardwareFingerprint}:${license.activatedAt}`;
        license.signature = crypto
          .createHmac('sha256', this.signingSecret)
          .update(envelopePayload, 'utf8')
          .digest('hex');
        await this.storageProvider.saveLicense(JSON.stringify(license));
      } catch (_) {}
    }
```

*After*:
```typescript
  public async revokeLicense(reason: string = 'Wycofanie przez administratora floty'): Promise<void> {
    const raw = await this.storageProvider.loadLicense();
    if (raw) {
      try {
        const license: ActiveLicenseRecord = typeof raw === 'string' ? JSON.parse(raw) : raw;
        license.revoked = true;
        license.revokedAt = new Date().toISOString();
        license.revokeReason = reason;
        const envelopePayload = this.computeEnvelopePayload(
          license.key,
          license.storeId,
          license.tier,
          license.hardwareFingerprint,
          license.activatedAt,
          true // Explicitly revoked
        );
        license.signature = crypto
          .createHmac('sha256', this.signingSecret)
          .update(envelopePayload, 'utf8')
          .digest('hex');
        await this.storageProvider.saveLicense(JSON.stringify(license));
      } catch (_) {}
    }
```

---

### 4.4 Proof of Tamper Resistance Post-Fix

Let us mathematically analyze all attack scenarios against the proposed fix:

| Attack Scenario | Envelope In Storage | Attacker Modification | Verification Payload Computed | Expected HMAC vs Stored Signature | Result |
|---|---|---|---|---|---|
| **Scenario 1: Adversary flips revoked to false** | Signed with `:REVOKED` ($S_{rev}$) | `"revoked": false` | `...:ACTIVE` | $H(\dots\text{:ACTIVE}) \neq S_{rev}$ | **`TAMPER_DETECTED`** (Bypass prevented!) |
| **Scenario 2: Adversary deletes revoked field** | Signed with `:REVOKED` ($S_{rev}$) | `delete license.revoked` | `...:ACTIVE` | $H(\dots\text{:ACTIVE}) \neq S_{rev}$ | **`TAMPER_DETECTED`** |
| **Scenario 3: Adversary sets non-boolean value** | Signed with `:REVOKED` ($S_{rev}$) | `"revoked": "false"` / `0` / `null` | `...:ACTIVE` | $H(\dots\text{:ACTIVE}) \neq S_{rev}$ | **`TAMPER_DETECTED`** |
| **Scenario 4: Adversary tries to forge active license as revoked (DoS)** | Signed with `:ACTIVE` ($S_{act}$) | `"revoked": true` | `...:REVOKED` | $H(\dots\text{:REVOKED}) \neq S_{act}$ | **`TAMPER_DETECTED`** |
| **Scenario 5: Legitimate station boot (Active)** | Signed with `:ACTIVE` ($S_{act}$) | None (`"revoked": false`) | `...:ACTIVE` | $H(\dots\text{:ACTIVE}) == S_{act}$ | **`ACTIVATED`** |
| **Scenario 6: Legitimate revoked station boot (Kill-Switch Lockout)** | Signed with `:REVOKED` ($S_{rev}$) | None (`"revoked": true`) | `...:REVOKED` | $H(\dots\text{:REVOKED}) == S_{rev}$ | **`HARDWARE_LOCKOUT`** (`revoked: true`) |

---

## 5. Test Suite Reconciliation & Hardening Plan

### 5.1 Reconcile `challenge_6` in `tests/security/licensing_adversarial_challenge.test.ts`

In `tests/security/licensing_adversarial_challenge.test.ts`, Challenge 6 was originally written as an adversarial regression test to confirm the presence of the vulnerability:

```typescript
// Line 513-527 in tests/security/licensing_adversarial_challenge.test.ts (BEFORE FIX):
    // 4. Verify station status
    const statusAfterAttack = await service.verifyStationHardwareLock();

    // VULNERABILITY DEMONSTRATION:
    // Because envelope signature payload ACT:v1:${key}:${storeId}:${tier}:${hw}:${activatedAt}
    // does NOT include license.revoked in the HMAC, the signature check succeeds!
    // And because revoked was set to false, the station status becomes ACTIVATED!
    const killSwitchVulnerabilityConfirmed = statusAfterAttack.status === 'ACTIVATED';

    assert.equal(
      killSwitchVulnerabilityConfirmed,
      true,
      'CRITICAL SECURITY FLAW CONFIRMED: Modifying revoked: false bypasses Kill-Switch without triggering TAMPER_DETECTED!'
    );
```

Once the fix is applied, `statusAfterAttack.status` will be `'TAMPER_DETECTED'`!
The test assertion must be updated to verify the tamper protection:

```typescript
// Recommended Update for challenge_6 (AFTER FIX):
    // 4. Verify station status
    const statusAfterAttack = await service.verifyStationHardwareLock();

    assert.equal(
      statusAfterAttack.status,
      'TAMPER_DETECTED',
      'Tampering revoked: false must fail envelope HMAC verification and trigger TAMPER_DETECTED'
    );
    assert.equal(statusAfterAttack.isActivated, false);
    assert.ok(
      statusAfterAttack.error?.includes('Podpis') || statusAfterAttack.error?.includes('modyfikację'),
      'Error message must indicate cryptographic signature mismatch'
    );
```

### 5.2 Add Verification for Legitimate `HARDWARE_LOCKOUT` on Revocation

As noted in Reviewer 2's report (Finding 3), the test suite previously lacked coverage for a persisted envelope with `revoked: true` successfully validating its signature and returning `status: 'HARDWARE_LOCKOUT'`.

The implementer should add the following sub-test to `challenge_6` or `tests/security/hardware_binding_anticopy.test.ts`:

```typescript
    // Verify legitimate revoked envelope (untampered) returns HARDWARE_LOCKOUT
    const legitRevokedStr = JSON.stringify(parsedRevoked); // parsedRevoked has revoked: true and valid S_rev
    mockStorage.loadLicense = async () => legitRevokedStr;

    const legitRevokedStatus = await service.verifyStationHardwareLock();
    assert.equal(legitRevokedStatus.status, 'HARDWARE_LOCKOUT');
    assert.equal(legitRevokedStatus.revoked, true);
    assert.equal(legitRevokedStatus.isActivated, false);
    assert.ok(legitRevokedStatus.error?.includes('Kill-Switch'));
```

### 5.3 Synergies with Additional Gate 1 Remediations

To ensure 100% clean test execution (`npm run test:security` passing with 0 failures):
1. **Store ID Sanitization in `verifyKeySignature` (Line 321)**:
   ```typescript
   if (expectedStoreId !== undefined && expectedStoreId !== null) {
     const normExpected = String(expectedStoreId).trim().toUpperCase();
     if (!normExpected) {
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
2. **Key Format Control Characters in `validateKeyFormat` (Line 267)**:
   Ensure `validateKeyFormat` strictly rejects keys with embedded control characters or unescaped newlines (`\n`, `\0`, `\r`) if raw format verification is enforced.

---

## 6. Verification Method

To independently verify the resolution after implementation:

1. **Run Full Security Test Suite**:
   ```bash
   npm run test:security
   ```
   *Expected Result*: All tests pass cleanly (exit code 0), with `challenge_6` confirming `status === 'TAMPER_DETECTED'` when `revoked` is altered.

2. **Run Application Production Build**:
   ```bash
   npm run build
   ```
   *Expected Result*: Clean build with zero TypeScript or Vite errors, generating `dist/` and `dist-electron/`.

3. **Verify Interactive Node REPL**:
   ```typescript
   import { LicensingService } from './src/services/security/licensingService';
   // 1. Activate
   // 2. Revoke
   // 3. Flip revoked to false
   // 4. Verify verifyStationHardwareLock() returns { status: 'TAMPER_DETECTED', isActivated: false }
   ```
