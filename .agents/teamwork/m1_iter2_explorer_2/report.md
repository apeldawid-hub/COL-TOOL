# Architectural & Cryptographic Hardening Report: Input Sanitization & Boundary Handling

**Agent**: M1 Iteration 2 Explorer 2 (`m1_iter2_explorer_2`)  
**Target File**: `src/services/security/licensingService.ts`  
**Milestone**: Milestone 1: Licensing & Hardware-Bound Activation Engine  
**Date**: 2026-10-26  
**Status**: Completed (Read-Only Analysis)  

---

## 1. Executive Summary

During Gate 1 review and adversarial testing of Milestone 1, two significant input validation and boundary vulnerabilities were identified in `src/services/security/licensingService.ts`:

1. **Store Constraint Bypass & Unhandled TypeError in `verifyKeySignature` (Line 321)**:
   - When `expectedStoreId` is passed as an empty string (`""`), JavaScript's truthy check `if (expectedStoreId)` evaluates to `false`. The store constraint check is completely bypassed, causing `verifyKeySignature` to return `true` for a key generated for a different store!
   - When `expectedStoreId` is passed as a non-string type (e.g. number `108120`), JavaScript throws an uncaught `TypeError: expectedStoreId.trim is not a function`, crashing callers and IPC boundaries.
2. **Missing Store ID Format Validation in `generateActivationKey` (Line 234)**:
   - `generateActivationKey` currently accepts invalid store IDs (e.g. `STORE-123`, `12`, `KRAKÓW_1`, `STORE\n123`, `☕_STORE`). It produces malformed license keys that are immediately rejected by `validateKeyFormat`. Generating unactivatable, syntactically invalid keys violates generation invariants.

This report provides the exact, production-grade fix strategy, TypeScript code replacement snippets, boundary truth tables, and test suite alignment instructions for the implementer (`m1_fleet_worker_1`).

---

## 2. Issue 1: `verifyKeySignature` Store ID Boundary Handling

### 2.1 Vulnerability Mechanism & Line Analysis

In `src/services/security/licensingService.ts:310-336`:
```typescript
320:    // Optional store ID matching
321:    if (expectedStoreId) {
322:      const normExpected = expectedStoreId.trim().toUpperCase();
323:      if (tier === 'STORE_CLIENT' && storeId !== normExpected) {
324:        return false;
325:      }
...
```

#### Failure Mode A: Store Constraint Bypass on Empty String
- In JavaScript, `Boolean("") === false`.
- If a caller invokes `licensingService.verifyKeySignature(key, currentStoreId)` where `currentStoreId` is uninitialized or empty (`""`), the condition `if (expectedStoreId)` evaluates to `false`.
- The store identity check (lines 323–334) is skipped entirely.
- The function computes the HMAC checksum against the `storeId` embedded in the key itself, which naturally matches.
- Result: **A key issued for Store `108120` (Warszawa Janki) evaluates as valid against expected store `""`!**
- Impact: If station onboarding or station activation initializes with `storeId = ""` before store catalog selection, any valid Starbucks key from any store can activate the station, breaking multi-store tenant isolation (Requirement R2).

#### Failure Mode B: Uncaught `TypeError` on Non-String Input
- If `expectedStoreId` is a number (e.g. `108120`, common from numeric JSON payloads or database lookups), `Boolean(108120) === true`.
- Line 322 executes `expectedStoreId.trim()`.
- Because `Number.prototype.trim` does not exist, V8 throws:
  `TypeError: expectedStoreId.trim is not a function`
- This unhandled runtime exception crashes the caller thread or unhandled IPC promise.

#### Failure Mode C: Whitespace-Only String Bypass on `FLEET_MASTER` Keys
- If `expectedStoreId` is `"   "`, `normExpected` becomes `""`.
- For `tier === 'FLEET_MASTER'`, lines 327–334 check:
  ```typescript
  if (
    tier === 'FLEET_MASTER' &&
    storeId !== normExpected &&
    storeId !== 'HQ_MASTER' &&
    storeId !== 'FLEET_HQ' &&
    storeId !== 'HQ_FLEET'
  ) {
    return false;
  }
  ```
  If `storeId === 'HQ_MASTER'`, the condition evaluates to `false`, meaning it does NOT return `false`. A whitespace-only string is treated as a valid store match for HQ master keys!

---

### 2.2 Exact Fix Specification for `verifyKeySignature`

To completely eliminate all three failure modes, `verifyKeySignature` must:
1. Treat `expectedStoreId === undefined` and `expectedStoreId === null` as the ONLY conditions where store filtering is intentionally omitted.
2. If `expectedStoreId !== undefined && expectedStoreId !== null`:
   - Strictly check `typeof expectedStoreId === 'string'`. If not string, safely return `false`.
   - Normalize via `.trim().toUpperCase()`.
   - If trimmed length is 0 (`normExpected.length === 0`), reject immediately by returning `false`.
   - For `STORE_CLIENT`, require `normStoreId === normExpected`.
   - For `FLEET_MASTER`, require `normStoreId === normExpected || normStoreId === 'HQ_MASTER' || normStoreId === 'FLEET_HQ' || normStoreId === 'HQ_FLEET'`.
3. Wrap HMAC calculation and constant-time comparison in a `try / catch` block to guarantee that unexpected errors return `false` rather than throwing.

#### Proposed Code Replacement (Drop-In)

**Target File**: `src/services/security/licensingService.ts`  
**Lines 310–344**:

```typescript
  /**
   * Verifies the cryptographic HMAC-SHA256 signature tag of the key using constant-time comparison.
   * Supports optional store ID restriction with strict type and boundary validation.
   */
  public verifyKeySignature(
    key: string,
    expectedStoreId?: string,
    customSecret?: string
  ): boolean {
    const format = this.validateKeyFormat(key);
    if (!format.valid || !format.data) return false;

    const { storeId, randomHex, checksum, tier } = format.data;
    const normStoreId = storeId.trim().toUpperCase();

    // Enforce strict type and boundary handling on expectedStoreId
    if (expectedStoreId !== undefined && expectedStoreId !== null) {
      if (typeof expectedStoreId !== 'string') {
        return false;
      }
      const normExpected = expectedStoreId.trim().toUpperCase();
      if (normExpected.length === 0) {
        return false;
      }
      if (tier === 'STORE_CLIENT' && normStoreId !== normExpected) {
        return false;
      }
      if (
        tier === 'FLEET_MASTER' &&
        normStoreId !== normExpected &&
        normStoreId !== 'HQ_MASTER' &&
        normStoreId !== 'FLEET_HQ' &&
        normStoreId !== 'HQ_FLEET'
      ) {
        return false;
      }
    }

    try {
      const payload = `SBX:${tier}:${normStoreId}:${randomHex}`;
      const secret =
        typeof customSecret === 'string' && customSecret.length > 0
          ? customSecret
          : this.signingSecret;
      const hmac = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex').toUpperCase();
      const expectedChecksum = hmac.substring(0, 10);

      return timingSafeStringEqual(checksum, expectedChecksum);
    } catch {
      return false;
    }
  }
```

---

### 2.3 Boundary Verification Matrix for `verifyKeySignature`

| Input `expectedStoreId` | Key Store ID | Key Tier | Old Behavior | New Behavior | Rationale |
|:---|:---|:---|:---|:---|:---|
| `undefined` | `'108120'` | `STORE_CLIENT` | `true` (valid HMAC) | `true` (valid HMAC) | Store check intentionally omitted |
| `null` | `'108120'` | `STORE_CLIENT` | `true` (valid HMAC) | `true` (valid HMAC) | Store check intentionally omitted |
| `""` (empty string) | `'108120'` | `STORE_CLIENT` | **`true` (BYPASS VULN!)** | **`false` (REJECTED)** | Empty store can never match a valid key |
| `"   "` (whitespace) | `'108120'` | `STORE_CLIENT` | `false` | **`false` (REJECTED)** | Zero-length normalized store rejected |
| `""` (empty string) | `'HQ_MASTER'` | `FLEET_MASTER` | **`true` (BYPASS VULN!)** | **`false` (REJECTED)** | Fleet master cannot unlock empty store |
| `108120` (number) | `'108120'` | `STORE_CLIENT` | **Throws `TypeError`** | **`false` (REJECTED)** | Non-string type safely rejected |
| `{ store: '108120' }` | `'108120'` | `STORE_CLIENT` | **Throws `TypeError`** | **`false` (REJECTED)** | Object type safely rejected |
| `true` (boolean) | `'108120'` | `STORE_CLIENT` | **Throws `TypeError`** | **`false` (REJECTED)** | Boolean type safely rejected |
| `'108120'` | `'108120'` | `STORE_CLIENT` | `true` | `true` | Valid store ID match |
| `'  108120  '` | `'108120'` | `STORE_CLIENT` | `true` | `true` | Whitespace padding safely trimmed |
| `'108121'` | `'108120'` | `STORE_CLIENT` | `false` | `false` | Store ID mismatch rejected |
| `'108120'` | `'HQ_MASTER'` | `FLEET_MASTER` | `true` | `true` | Fleet HQ master key valid for any store |

---

## 3. Issue 2: `generateActivationKey` Format Validation Defect

### 3.1 Vulnerability Mechanism & Invariant Violation

In `src/services/security/licensingService.ts:229-239`:
```typescript
  public generateActivationKey(
    storeId: string,
    tier: LicenseTier = 'STORE_CLIENT',
    customSecret?: string
  ): string {
    if (!storeId || typeof storeId !== 'string') {
      throw new Error('storeId jest wymagane do wygenerowania klucza licencyjnego.');
    }

    const normStoreId = storeId.trim().toUpperCase();
```

Notice that after `normStoreId = storeId.trim().toUpperCase()`, the function does NOT validate `normStoreId` against the canonical store pattern.
- If `storeId` is `"1"` or `"12"`, it generates `SBX-1-01...` or `SBX-12-01...`.
- If `storeId` is `"STORE-123"`, it generates `SBX-STORE-123-01...`.
- If `storeId` contains unicode (`"KRAKÓW_1"`), colons, slashes, newlines, or emojis, a key is generated.
- However, `LicensingService.CANONICAL_KEY_REGEX` requires:
  `^SBX-([A-Z0-9_]{3,16})-([A-F0-9]{16})-([A-F0-9]{10})$/i`
- When a user or system attempts to activate a station with such a key, `validateKeyFormat` immediately returns `valid: false`.
- **System Invariant**: `generateActivationKey` must never generate a key that fails `validateKeyFormat`. Any invalid store ID must be rejected at key creation time.

---

### 3.2 Canonical Store ID Regular Expression

In `LicensingService`, define a static constant:
```typescript
public static readonly STORE_ID_REGEX = /^[A-Z0-9_]{3,16}$/;
```

**Grammar Rules**:
- Minimum length: 3 characters (e.g. unit code `384`).
- Maximum length: 16 characters (e.g. `WARSZAWA_JANKI`).
- Allowed characters: Uppercase ASCII letters `A-Z`, digits `0-9`, and underscore `_`.
- Forbidden characters: Hyphens (`-` is used as segment delimiter), spaces, periods, slashes, colons, null bytes, non-ASCII characters, and symbols.

---

### 3.3 Exact Fix Specification for `generateActivationKey`

#### Proposed Code Replacement (Drop-In)

**Target File**: `src/services/security/licensingService.ts`  
**Around Line 185**:
```typescript
export class LicensingService implements ILicensingService {
  private static instance: LicensingService | null = null;
  public static readonly CANONICAL_KEY_REGEX = /^SBX-([A-Z0-9_]{3,16})-([A-F0-9]{16})-([A-F0-9]{10})$/i;
  public static readonly STORE_ID_REGEX = /^[A-Z0-9_]{3,16}$/;
  public static readonly DEFAULT_MASTER_SIGNING_SECRET = 'sbx_ent_lic_sign_v1_starbucks_ops_2026';
```

**Lines 229–257**:
```typescript
  /**
   * Generates a canonical signed activation key.
   * Format: SBX-<storeId>-<randomHex>-<checksum>
   * - Validates storeId against ^[A-Z0-9_]{3,16}$
   * - 64-bit entropy (16 hex chars)
   * - Byte 0 encodes tier: '01' for STORE_CLIENT, 'FF' for FLEET_MASTER
   * - Bytes 1..7 are CSPRNG entropy
   * - Checksum: 10 hex characters HMAC-SHA256 of `SBX:<tier>:<normStoreId>:<randomHex>`
   */
  public generateActivationKey(
    storeId: string,
    tier: LicenseTier = 'STORE_CLIENT',
    customSecret?: string
  ): string {
    if (!storeId || typeof storeId !== 'string') {
      throw new Error('storeId jest wymagane do wygenerowania klucza licencyjnego.');
    }

    const normStoreId = storeId.trim().toUpperCase();
    if (!LicensingService.STORE_ID_REGEX.test(normStoreId)) {
      throw new Error(
        `Nieprawidłowy identyfikator lokalu "${storeId}". Oczekiwano 3-16 znaków alfanumerycznych lub podkreślenia (^[A-Z0-9_]{3,16}$).`
      );
    }

    const validTier: LicenseTier = tier === 'FLEET_MASTER' ? 'FLEET_MASTER' : 'STORE_CLIENT';
    const tierByte = validTier === 'FLEET_MASTER' ? 'FF' : '01';
    const entropyHex = crypto.randomBytes(7).toString('hex').toUpperCase();
    const randomHex = `${tierByte}${entropyHex}`; // Exactly 16 chars

    const payload = `SBX:${validTier}:${normStoreId}:${randomHex}`;
    const secret =
      typeof customSecret === 'string' && customSecret.length > 0
        ? customSecret
        : this.signingSecret;
    const hmac = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex').toUpperCase();
    const checksum = hmac.substring(0, 10); // 10 chars

    return `SBX-${normStoreId}-${randomHex}-${checksum}`;
  }
```

---

## 4. Additional Boundary & Sanitization Hardening in `licensingService.ts`

To ensure end-to-end defensiveness, the following four boundary enhancements are recommended:

### 4.1 `validateKeyFormat` Upper Length Bound (ReDoS / Memory DoS Protection)
In `validateKeyFormat(key: string)`:
A canonical key never exceeds 48 characters (`4 + 16 + 1 + 16 + 1 + 10 = 48`).
If an attacker sends an unbounded string (e.g. 10 MB payload), running `.trim().toUpperCase()` causes unnecessary heap allocation.
**Fix**:
```typescript
  public validateKeyFormat(key: string): KeyValidationResult {
    if (!key || typeof key !== 'string') {
      return { valid: false, error: 'Klucz licencyjny nie może być pusty.' };
    }

    if (key.length > 128) {
      return {
        valid: false,
        error: 'Klucz licencyjny przekracza maksymalną dozwoloną długość (128 znaków).',
      };
    }

    const trimmed = key.trim().toUpperCase();
    const match = LicensingService.CANONICAL_KEY_REGEX.exec(trimmed);
...
```

### 4.2 Hardware Fingerprint Sanitization in `activateStation`
In `activateStation(key: string, expectedStoreId?: string)`:
Ensure the hardware fingerprint returned by the provider is non-empty and sanitized:
```typescript
    const rawHw = await this.getHardwareFingerprint();
    const hwFingerprint = (typeof rawHw === 'string' ? rawHw.trim().toLowerCase() : '');
    if (!hwFingerprint || hwFingerprint.length < 16) {
      return {
        success: false,
        errorCode: 'HARDWARE_ERROR',
        error: 'Nie udało się pobrać prawidłowego odcisku sprzętowego stacji.',
      };
    }
```

### 4.3 Rigorous Envelope Structure Verification in `verifyStationHardwareLock`
In `verifyStationHardwareLock()`:
Ensure that deserialized envelopes have string types on all essential fields before constructing the verification HMAC payload:
```typescript
    if (
      !license ||
      typeof license !== 'object' ||
      typeof license.key !== 'string' ||
      typeof license.storeId !== 'string' ||
      (license.tier !== 'STORE_CLIENT' && license.tier !== 'FLEET_MASTER') ||
      typeof license.hardwareFingerprint !== 'string' ||
      typeof license.activatedAt !== 'string' ||
      typeof license.signature !== 'string'
    ) {
      return {
        status: 'TAMPER_DETECTED',
        isActivated: false,
        hardwareMismatch: false,
        revoked: false,
        license,
        error: 'Koperta licencyjna ma uszkodzoną, niepełną lub zmanipulowaną strukturę pól.',
      };
    }
```

### 4.4 Cryptographic Seal of Revocation State (Kill-Switch Integrity)
In coordination with Explorer 1, ensure lines 389, 482, and 562 bind `license.revoked`:
```typescript
const revokedToken = license.revoked === true ? 'REVOKED' : 'ACTIVE';
const envelopePayload = `ACT:v1:${license.key}:${license.storeId}:${license.tier}:${license.hardwareFingerprint}:${license.activatedAt}:${revokedToken}`;
```

---

## 5. Test Suite Alignment & Invalidation Analysis

When `generateActivationKey` and `verifyKeySignature` are updated, two tests in `tests/security/licensing_adversarial_challenge.test.ts` require alignment:

### 5.1 Alignment 1: `challenge_3_store_id_boundary_values_and_injections`
In `tests/security/licensing_adversarial_challenge.test.ts:227-253`:
Previously, invalid store IDs had `shouldThrowOnGen: false` because `generateActivationKey` permitted invalid IDs.
With our fix, `generateActivationKey` throws an `Error` for all invalid store IDs.
**Required test update**:
In `boundaryCases`:
For any test case where `shouldBeValid === false`, set `shouldThrowOnGen: true`.
For example:
```typescript
{ id: '1', desc: '1 char (too short)', shouldThrowOnGen: true, shouldBeValid: false },
{ id: '12', desc: '2 chars (too short)', shouldThrowOnGen: true, shouldBeValid: false },
{ id: '12345678901234567', desc: '17 chars (too long)', shouldThrowOnGen: true, shouldBeValid: false },
{ id: 'STORE-123', desc: 'store ID with hyphen', shouldThrowOnGen: true, shouldBeValid: false },
...
```
Or update the loop to accept throwing as valid rejection:
```typescript
      let threw = false;
      let key = '';
      try {
        key = LicensingService.generateActivationKey(testCase.id, 'STORE_CLIENT', masterSecret);
      } catch {
        threw = true;
      }
      if (!testCase.shouldBeValid) {
        assert.ok(
          threw || !LicensingService.validateKeyFormat(key).valid,
          `Invalid store ID must throw on generation or fail format validation: ${testCase.desc}`
        );
      }
```

### 5.2 Alignment 2: `challenge_5_verify_key_signature_handles_non_string_expected_store_id`
In `tests/security/licensing_adversarial_challenge.test.ts:457-471`:
**Before**:
```typescript
    const emptyStoreResult = LicensingService.verifyKeySignature(key, '', masterSecret);
    assert.equal(typeof emptyStoreResult, 'boolean');

    let numericThrew = false;
    try {
      LicensingService.verifyKeySignature(key, (108120 as any), masterSecret);
    } catch (err: any) {
      numericThrew = true;
      assert.ok(err instanceof TypeError, 'Throws TypeError: expectedStoreId.trim is not a function');
    }
    assert.equal(numericThrew, true, 'Proves Finding 2: non-string expectedStoreId causes unhandled TypeError');
```

**After (Aligning to fixed behavior)**:
```typescript
    // 1. Empty string must be cleanly rejected (fixing the store constraint bypass)
    const emptyStoreResult = LicensingService.verifyKeySignature(key, '', masterSecret);
    assert.equal(emptyStoreResult, false, 'Empty string expectedStoreId must return false');

    // 2. Whitespace-only string must also be rejected
    const whitespaceStoreResult = LicensingService.verifyKeySignature(key, '   ', masterSecret);
    assert.equal(whitespaceStoreResult, false, 'Whitespace expectedStoreId must return false');

    // 3. Non-string types must safely return false without throwing TypeError
    const numericResult = LicensingService.verifyKeySignature(key, (108120 as any), masterSecret);
    assert.equal(numericResult, false, 'Numeric expectedStoreId must return false without throwing');

    const objectResult = LicensingService.verifyKeySignature(key, ({ id: '108120' } as any), masterSecret);
    assert.equal(objectResult, false, 'Object expectedStoreId must return false without throwing');
```

---

## 6. Summary of Recommendations for Implementer

1. Add `STORE_ID_REGEX = /^[A-Z0-9_]{3,16}$/` to `LicensingService`.
2. In `generateActivationKey`:
   Validate `normStoreId` with `STORE_ID_REGEX` immediately after trimming and uppercasing. Throw descriptive `Error` on mismatch.
3. In `verifyKeySignature`:
   Check `if (expectedStoreId !== undefined && expectedStoreId !== null)`.
   If `typeof expectedStoreId !== 'string'`, return `false`.
   Trim and uppercase `normExpected`. If `normExpected.length === 0`, return `false`.
   Compare `normExpected` against `normStoreId`.
4. In `validateKeyFormat`:
   Add length check `if (key.length > 128) return { valid: false, error: '...' }`.
5. Align test assertions in `tests/security/licensing_adversarial_challenge.test.ts` as specified in Section 5.
