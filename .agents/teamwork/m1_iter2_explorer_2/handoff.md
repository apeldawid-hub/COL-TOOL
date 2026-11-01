# Handoff Report — M1 Iteration 2 Explorer 2: Input Sanitization & Boundary Handling

**Agent**: M1 Iteration 2 Explorer 2 (`m1_iter2_explorer_2`)  
**Recipient**: Orchestrator (`bc820f6a-3865-4f82-8517-3240379a0b72`)  
**Timestamp**: 2026-10-26T18:35:00Z  
**Type**: Hard Handoff (Investigation & Strategy Specification Complete)  
**Status**: Ready for Implementation  

---

## 1. Observation

1. **Vulnerability in `verifyKeySignature` Store ID Check**:
   - Location: `src/services/security/licensingService.ts:320-335`
   - Quoted code:
     ```typescript
     // Optional store ID matching
     if (expectedStoreId) {
       const normExpected = expectedStoreId.trim().toUpperCase();
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
   - Direct execution observation:
     * When `expectedStoreId = ''`: `Boolean('') === false`. The `if (expectedStoreId)` evaluates to `false`. Store matching is bypassed. A valid activation key for Store `108120` evaluates to `true` when tested against `expectedStoreId = ''`.
     * When `expectedStoreId = 108120` (numeric): `Boolean(108120) === true`. `expectedStoreId.trim()` throws unhandled `TypeError: expectedStoreId.trim is not a function`.
     * When `expectedStoreId = '   '` and `tier === 'FLEET_MASTER'`: `storeId !== 'HQ_MASTER'` is false if store is HQ_MASTER, so `false` is not returned; it evaluates to `true`.

2. **Missing Format Invariant in `generateActivationKey`**:
   - Location: `src/services/security/licensingService.ts:229-239`
   - Quoted code:
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
       const tierByte = tier === 'FLEET_MASTER' ? 'FF' : '01';
     ```
   - Direct observation:
     * `normStoreId` is never validated against `^[A-Z0-9_]{3,16}$`.
     * Passing invalid store IDs (e.g. `'1'`, `'12'`, `'STORE-123'`, `'STORE.123'`, `'KRAKÓW_1'`) successfully generates keys such as `SBX-1-01...` or `SBX-STORE-123-01...`.
     * Passing these generated keys to `validateKeyFormat` immediately returns `{ valid: false }` because `CANONICAL_KEY_REGEX = /^SBX-([A-Z0-9_]{3,16})-([A-F0-9]{16})-([A-F0-9]{10})$/i` rejects them.

3. **Test Suite Status in `tests/security/`**:
   - Command: `npm run test:security`
   - Execution result: 52 tests passing out of 52 across 4 test suites (`licensing_key_engine.test.ts`, `hardware_binding_anticopy.test.ts`, `licensing_adversarial_challenge.test.ts`, `adversarial_hardware_tamper.test.ts`).
   - In `tests/security/licensing_adversarial_challenge.test.ts:457-471`, the existing test was structured to assert that the defects exist (`numericThrew === true` and `typeof emptyStoreResult === 'boolean'`).

---

## 2. Logic Chain

1. **Step 1: Store Constraint Bypass Analysis**
   - Observation 1 proves that `if (expectedStoreId)` treats `""` as falsy.
   - In multi-store desktop applications, uninitialized components or onboarding modals often initialize state with empty strings (`storeId: ''`).
   - If an empty string bypasses the store constraint, any legitimate key from any store can activate the station, violating multi-store tenant isolation (Requirement R2).
   - Therefore, `expectedStoreId` must only skip the store check if explicitly `undefined` or `null`. If a value is provided, it must be validated as a non-empty string.

2. **Step 2: Type Safety & Exception Prevention**
   - Observation 1 proves that calling `.trim()` on non-string inputs causes an uncaught `TypeError`.
   - Data passed into `verifyKeySignature` across IPC, JSON deserialization, or component props cannot be guaranteed to be typed at runtime in pure JavaScript.
   - Enforcing `typeof expectedStoreId === 'string'` and returning `false` on non-strings eliminates runtime crashes while safely rejecting malformed requests.

3. **Step 3: Invariant Enforcement in Key Generation**
   - Observation 2 proves that `generateActivationKey` creates keys that `validateKeyFormat` rejects.
   - A cryptographic provisioning engine must maintain the invariant: $\forall s \in \text{Domain}, \text{validateKeyFormat}(\text{generateActivationKey}(s)) = \text{valid}$.
   - Restricting `normStoreId` with `STORE_ID_REGEX = /^[A-Z0-9_]{3,16}$/` before signing ensures that every generated key is syntactically sound.

---

## 3. Caveats

1. **Test Suite Invalidation Notice**:
   When `generateActivationKey` is updated to throw an error on invalid store IDs, test cases in `tests/security/licensing_adversarial_challenge.test.ts` (specifically `boundaryCases` in `challenge_3`) will encounter exceptions unless updated to set `shouldThrowOnGen: true` for invalid store IDs. Explorer 3 and the implementer must coordinate this test alignment.
2. **Offline Master Secret Extraction**:
   While input sanitization prevents bypasses and type errors, if `SBX_LICENSING_SECRET` is not set in production environments, the engine falls back to `DEFAULT_MASTER_SIGNING_SECRET`. Environment configuration is out of scope for this task but noted for fleet security.

---

## 4. Conclusion

1. **Exact fix for `verifyKeySignature` (line 321)**:
   Replace the falsy check `if (expectedStoreId)` with:
   ```typescript
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
   ```
2. **Exact fix for `generateActivationKey` (line 234)**:
   Add `public static readonly STORE_ID_REGEX = /^[A-Z0-9_]{3,16}$/;` and validate `normStoreId`:
   ```typescript
   if (!LicensingService.STORE_ID_REGEX.test(normStoreId)) {
     throw new Error(
       `Nieprawidłowy identyfikator lokalu "${storeId}". Oczekiwano 3-16 znaków alfanumerycznych lub podkreślenia (^[A-Z0-9_]{3,16}$).`
     );
   }
   ```
3. Full technical details, code snippets, and additional boundary protections are documented in `report.md`.

---

## 5. Verification Method

To verify the strategy and subsequent implementation:

1. **Test `verifyKeySignature` with Empty String & Numeric Inputs**:
   ```typescript
   import { LicensingService } from './src/services/security/licensingService';
   const key = LicensingService.generateActivationKey('108120', 'STORE_CLIENT');
   
   // Empty string: MUST return false
   assert.equal(LicensingService.verifyKeySignature(key, ''), false);
   
   // Whitespace: MUST return false
   assert.equal(LicensingService.verifyKeySignature(key, '   '), false);
   
   // Numeric input: MUST return false without throwing TypeError
   assert.equal(LicensingService.verifyKeySignature(key, 108120 as any), false);
   
   // Valid storeId: MUST return true
   assert.equal(LicensingService.verifyKeySignature(key, '108120'), true);
   ```

2. **Test `generateActivationKey` Format Rejection**:
   ```typescript
   // Invalid store IDs: MUST throw Error
   assert.throws(() => LicensingService.generateActivationKey('12'), /identyfikator lokalu/);
   assert.throws(() => LicensingService.generateActivationKey('STORE-123'), /identyfikator lokalu/);
   assert.throws(() => LicensingService.generateActivationKey('   '), /identyfikator lokalu/);
   
   // Valid store IDs: MUST succeed
   assert.ok(LicensingService.generateActivationKey('384').startsWith('SBX-384-'));
   assert.ok(LicensingService.generateActivationKey('HQ_MASTER').startsWith('SBX-HQ_MASTER-'));
   ```

3. **Run Security Test Suite & Build**:
   ```bash
   npm run test:security
   npm run build
   ```
   Both commands must exit with code 0.
