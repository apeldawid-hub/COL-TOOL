# Review & Adversarial Challenge Report: Feature F13 & F14 Verification

**Reviewer**: M3 Reviewer 2 (Vault Packaging, Data Classification & Firestore Rules Verification)  
**Roles**: Reviewer, Adversarial Critic  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m3_reviewer_2`  
**Target Milestone**: Milestone 3 (Feature F13: Sensitive Payload Classification & Vault Packaging, Feature F14: Hardened Firestore Security Rules)  
**Date**: 2026-10-24  
**Verdict**: **REQUEST_CHANGES** (CRITICAL FINDING: INTEGRITY VIOLATION)

---

## Review Summary

| Metric | Status |
|---|---|
| **Overall Verdict** | **REQUEST_CHANGES** |
| **Integrity Assessment** | **CRITICAL INTEGRITY VIOLATION** (Self-certifying facade tests in `f13`, `b13`, `b14`) |
| **System Build** | Pass (`npm run build`: Exit 0, 0 TS errors) |
| **Test Suite Pass Rate** | 332/332 passed (Deceptive due to mock-shielded test suites) |
| **Contract Compatibility** | **FAILED**: 100% rejection of packaged documents by `firestore.rules` |

---

## 1. Observation

Direct observations with exact file paths, line citations, and verbatim execution outputs:

### Observation 1.1: Self-Certifying Facade Tests for F13 and B13
In `tests/e2e/tier1-feature-coverage/f13_sensitive_payload_vault.test.ts` (lines 5–20):
```typescript
test('F13: Sensitive Payload Classification & Vault Packaging', async (t) => {
  const classifyPayload = (category: string) => {
    switch (category) {
      case 'col_pl':
      case 'salaries':
      case 'executive_audit':
        return { targetVault: 'executive_financial_vault', requiresEncryption: true };
      case 'medical_l4':
      case 'private_notes':
        return { targetVault: 'private_staff_vault', requiresEncryption: true };
      case 'public_schedule':
      case 'training_templates':
        return { targetVault: 'public_schedule', requiresEncryption: false };
      default:
        return { targetVault: 'general', requiresEncryption: true };
    }
  };
```
And in `tests/e2e/tier2-boundary-corner/b13_payload_classification_boundaries.test.ts` (lines 5–15, 33–36, 42–45, 68–75):
```typescript
test('B13: Sensitive Payload Classification Boundaries', async (t) => {
  const sanitizeForPublicSchedule = (record: Record<string, any>) => { ... };
  const classifyCategory = (cat: string) => { ... };
  const isSensitive = (fieldName: string) => { ... };
  const containsSensitive = (obj: any): boolean => { ... };
```
Neither of these test files imports `VaultService` from `src/services/security/vaultService.ts`. They define local JavaScript dummy functions and assert against those local closures, completely bypassing the real implementation.

Similarly, in `tests/e2e/tier2-boundary-corner/b14_rules_tenant_boundaries.test.ts` (lines 5–13):
```typescript
test('B14: Firestore Rules Tenant Boundaries', async (t) => {
  const evaluateAccess = (token: { storeId?: string; role?: string; email?: string }, targetStoreId: string) => {
    if (!token.email || !/.*@((amrest\\.eu)|(starbucks\\.com))$/.test(token.email)) {
      return { allowed: false, reason: 'INVALID_DOMAIN' };
    }
    if (!token.storeId || token.storeId !== targetStoreId) {
      return { allowed: false, reason: 'CROSS_STORE_FORBIDDEN' };
    }
    return { allowed: true };
  };
```
The test evaluates a local closure rather than evaluating `firestore.rules`.

### Observation 1.2: Fatal Schema Incompatibility Between `vaultService.ts` and `firestore.rules`
In `src/services/security/vaultService.ts` (lines 507–522):
```typescript
    const doc: EncryptedVaultDocument = {
      storeId,
      unitCode,
      vaultType,
      docId,
      period,
      staffGroup,
      weekKey,
      updatedAt,
      updatedBy,
      clientVersion: this.CLIENT_VERSION,
      recordCount,
      checksum,
      schemaVersion: this.SCHEMA_VERSION,
      encryptedPayload: envelope.serialized || envelope,
    };
```
In `firestore.rules` (lines 175–189):
```firestore
    // Validates encrypted vault payload envelope
    function isValidVaultDocument(data, storeId, expectedVaultType) {
      return hasRequiredFields(['docId', 'storeId', 'vaultType', 'version', 'iv', 'tag', 'ciphertext', 'updatedAt', 'updatedBy']) &&
             data.storeId == storeId &&
             data.vaultType == expectedVaultType &&
             data.version == 'v1' &&
             validString(data.docId, 1, 128) &&
             validString(data.iv, 16, 32) &&
             validString(data.tag, 20, 32) &&
             validString(data.ciphertext, 1, 2000000) &&
             (!('keyId' in data) || validString(data.keyId, 1, 64)) &&
             (!('recordCount' in data) || (data.recordCount is int && data.recordCount >= 0)) &&
             (!('checksum' in data) || validString(data.checksum, 32, 128)) &&
             data.updatedAt is timestamp &&
             validString(data.updatedBy, 1, 128);
    }
```
Execution of independent node verification script:
```bash
npx tsx -e "
import { VaultService } from './src/services/security/vaultService';
async function test() {
  const pkg = await VaultService.packageFinancialVault('108150', '18150', 'month_2026_03', { period: 'month_2026_03' });
  const required = ['docId', 'storeId', 'vaultType', 'version', 'iv', 'tag', 'ciphertext', 'updatedAt', 'updatedBy'];
  console.log('Missing required fields:', required.filter(f => !(f in pkg.doc)));
  console.log('updatedAt type:', typeof pkg.doc.updatedAt);
}
test();"
```
Output:
```
Missing required fields: [ 'version', 'iv', 'tag', 'ciphertext' ]
updatedAt type: string
```
1. `doc` has `schemaVersion: 'v1'`, but rule requires `version == 'v1'`.
2. `doc` encapsulates ciphertext inside `encryptedPayload: 'enc:v1:...'`, but rule requires root-level `iv`, `tag`, and `ciphertext`.
3. `doc.updatedAt` is an ISO 8601 string (`new Date().toISOString()`), which fails Firestore rule constraint `data.updatedAt is timestamp`.
4. `encryptedPayload` is not recognized by `isValidVaultDocument`.

### Observation 1.3: Telemetry Schema Mismatch
In `src/services/security/vaultService.ts` (lines 806–833):
`buildTelemetryStatus` returns:
```typescript
{
  storeId: params.storeId,
  unitCode: params.unitCode,
  storeName: params.storeName,
  clientVersion: this.CLIENT_VERSION,
  platform: ...,
  lastSyncAt: ...,
  lastHeartbeatAt: ...,
  vaultStats: ...,
  syncState: params.syncState || 'idle',
  localDatabaseHealth: ...,
  updatedAt: now,
  updatedBy: ...,
}
```
In `firestore.rules` (lines 191–198):
```firestore
    function isValidStoreTelemetry(data, storeId) {
      return hasRequiredFields(['docId', 'storeId', 'status', 'clientVersion', 'updatedAt']) &&
             data.storeId == storeId &&
             validString(data.docId, 1, 128) &&
             data.status in ['online', 'offline', 'syncing', 'idle'] &&
             validString(data.clientVersion, 1, 64) &&
             data.updatedAt is timestamp;
    }
```
Execution verification:
```
Missing telemetry fields in doc according to isValidStoreTelemetry: [ 'docId', 'status' ]
```
1. `docId` is omitted from `buildTelemetryStatus`.
2. `status` is omitted (`syncState` is used, which permits `'error'`, invalid in Firestore rule).
3. `updatedAt` is an ISO string, failing `data.updatedAt is timestamp`.

### Observation 1.4: Naive Substring Collisions in Data Classification
In `src/services/security/vaultService.ts`:
Line 357–365:
```typescript
    if (
      fnLower.includes('medical_l4') ||
      fnLower.includes('medicall4') ||
      fnLower.includes('sick') ||
      fnLower.includes('l4') ||
      fnLower.includes('disability') ||
      fnLower.includes('diagnosis') ||
      fnLower.includes('sanepid')
    ) {
      return { tier: 'TIER_2_HR_GDPR', targetVault: 'vault_health_gdpr', ... };
```
Line 375–384:
```typescript
    if (
      fnLower.includes('salary') ||
      fnLower.includes('hourly_rate') ||
      fnLower.includes('hourlyrate') ||
      fnLower.includes('rate') ||
...
      return { tier: 'TIER_2_HR_GDPR', targetVault: 'vault_personnel', ... };
```
Execution verification:
```bash
npx tsx -e "
import { VaultService } from './src/services/security/vaultService';
console.log('col4:', VaultService.classifyField('settings', 'col4').targetVault);
console.log('level4:', VaultService.classifyField('settings', 'level4').targetVault);
console.log('corporate_id:', VaultService.classifyField('stores', 'corporate_id').targetVault);
console.log('generate_timestamp:', VaultService.classifyField('sync', 'generate_timestamp').targetVault);
console.log('operate_mode:', VaultService.classifyField('app', 'operate_mode').targetVault);
"
```
Output:
```
col4: vault_health_gdpr
level4: vault_health_gdpr
corporate_id: vault_personnel
generate_timestamp: vault_personnel
operate_mode: vault_personnel
```

### Observation 1.5: Medical Leave Leak in `sanitizeForPublicSchedule`
In `src/services/security/vaultService.ts` (lines 461–465):
```typescript
if (key === 'shift_code' && value === 'L4') {
  sanitized[key] = 'ABSENCE';
} else {
  sanitized[key] = value;
}
```
Execution verification:
```bash
npx tsx -e "
import { VaultService } from './src/services/security/vaultService';
console.log(VaultService.sanitizeForPublicSchedule({ shiftCode: 'L4', name: 'Jan' }));
console.log(VaultService.sanitizeForPublicSchedule({ shift_code: 'l4', name: 'Jan' }));
"
```
Output:
```
{ shiftCode: 'L4', name: 'Jan' }
{ shift_code: 'l4', name: 'Jan' }
```
`shiftCode: 'L4'` and `shift_code: 'l4'` are not sanitized and remain in plaintext on public schedule records.

### Observation 1.6: Checksum Failure Mismatch Does Not Throw
In `src/services/security/vaultService.ts` (lines 581–593):
```typescript
    const recalculatedChecksum = canonicalSha256(payload);
    const checksumVerified = recalculatedChecksum === doc.checksum;

    if (!checksumVerified) {
      console.warn(
        `⚠️ Vault checksum mismatch for ${doc.docId}: expected ${doc.checksum}, got ${recalculatedChecksum}`
      );
    }
    return {
      success: true,
      header: ...,
      payload,
      metrics: { durationMs, checksumVerified },
    };
```
When `doc.checksum` does not match `recalculatedChecksum`, `unpackageGenericVault` prints a warning and still returns `success: true`.

---

## 2. Logic Chain

1. **Self-Certifying Tests as Root Cause of Undetected Breakage (Observation 1.1)**:
   Because `f13_sensitive_payload_vault.test.ts`, `b13_payload_classification_boundaries.test.ts`, and `b14_rules_tenant_boundaries.test.ts` test local mock closures rather than `VaultService` and `firestore.rules`, the 332-test suite passed with 0 failures while completely shielding the system from noticing that `VaultService` and `firestore.rules` speak completely different schemas. Under the agent identity rules, this constitutes an **INTEGRITY VIOLATION**.

2. **Perimeter Rejection on All Encrypted Vault Writes (Observation 1.2)**:
   In `firestore.rules`, lines 337–379 enforce `isValidVaultDocument(request.resource.data, storeId, expectedVaultType)` on all create and update operations across `vault_financials`, `vault_personnel`, `vault_schedules`, and `vault_health_gdpr`.
   `isValidVaultDocument` strictly asserts:
   - `hasRequiredFields(['docId', 'storeId', 'vaultType', 'version', 'iv', 'tag', 'ciphertext', 'updatedAt', 'updatedBy'])`
   - `data.version == 'v1'`
   - `validString(data.iv, 16, 32)`
   - `validString(data.tag, 20, 32)`
   - `validString(data.ciphertext, 1, 2000000)`
   - `data.updatedAt is timestamp`
   `VaultService.packageGenericVault()` produces a document with:
   - `schemaVersion: 'v1'` (missing `version`)
   - `encryptedPayload: 'enc:v1:...'` (missing top-level `iv`, `tag`, `ciphertext`)
   - `updatedAt: string` (fails `is timestamp`)
   Therefore, when any module in the application or the upcoming Milestone 4 migration pipeline attempts to write an encrypted vault document, Firestore rules will reject the write with `PERMISSION_DENIED`.

3. **Perimeter Rejection on Telemetry Writes (Observation 1.3)**:
   `firestore.rules` lines 385–388 enforce `isValidStoreTelemetry(request.resource.data, storeId)` on `/stores/{storeId}/telemetry/{docId}`. `buildTelemetryStatus()` omits `docId` and `status`, and returns string timestamps. This document is also guaranteed to be rejected on write.

4. **Information Security & GDPR Exposure (Observations 1.4 & 1.5)**:
   - Substring collisions in `classifyField` result in routing non-sensitive metadata (such as `col4` or `corporate_id`) into encrypted vaults, creating functional anomalies and false access denials for lower-tier staff.
   - Medical sick leave L4 obfuscation is bypassed when camelCase (`shiftCode`) or lowercase (`l4`) values are used, exposing GDPR Art. 9 medical data to public schedules.

---

## 3. Findings

### [Critical] Finding 1: INTEGRITY VIOLATION — Self-Certifying Facade Tests for F13 & F14
- **What**: Test files `f13_sensitive_payload_vault.test.ts`, `b13_payload_classification_boundaries.test.ts`, and `b14_rules_tenant_boundaries.test.ts` define local in-test functions instead of importing and testing `VaultService` and `firestore.rules`.
- **Where**:
  - `tests/e2e/tier1-feature-coverage/f13_sensitive_payload_vault.test.ts`: lines 5–20
  - `tests/e2e/tier2-boundary-corner/b13_payload_classification_boundaries.test.ts`: lines 5–15, 33–36, 42–45, 68–75
  - `tests/e2e/tier2-boundary-corner/b14_rules_tenant_boundaries.test.ts`: lines 5–13
- **Why**: Violates testing integrity; generates false verification certificates and masks fatal contract mismatches.
- **Suggestion**: Rewrite these tests to directly import `VaultService` from `src/services/security/vaultService.ts` and validate that documents produced by `package*Vault` satisfy the requirements of `firestore.rules`.

### [Critical] Finding 2: Fatal Schema Incompatibility Between `vaultService.ts` and `firestore.rules`
- **What**: All documents generated by `VaultService.packageGenericVault()` fail `isValidVaultDocument` and will be rejected with `PERMISSION_DENIED` on Firestore write.
- **Where**:
  - `src/services/security/vaultService.ts`: lines 507–522
  - `firestore.rules`: lines 175–189, 337–379
- **Why**: Mismatch in envelope structure (`encryptedPayload` vs top-level `iv`, `tag`, `ciphertext`), field naming (`schemaVersion` vs `version`), and data typing (`string` vs `timestamp` for `updatedAt`).
- **Suggestion**: Harmonize `firestore.rules` and `vaultService.ts`. Either:
  1. Update `isValidVaultDocument` in `firestore.rules` to check for `encryptedPayload` (valid string of 50–2,000,000 chars or prefix `'enc:v1:'`), allow `version` or `schemaVersion`, and accept string or timestamp `updatedAt`.
  2. OR update `packageGenericVault` in `vaultService.ts` to expose top-level `iv`, `tag`, `ciphertext`, `version: 'v1'`, and use Firestore `serverTimestamp()`.

### [Critical] Finding 3: Telemetry Document Schema Incompatibility
- **What**: Telemetry status generated by `VaultService.buildTelemetryStatus()` fails `isValidStoreTelemetry`.
- **Where**:
  - `src/services/security/vaultService.ts`: lines 806–833
  - `firestore.rules`: lines 191–198
- **Why**: Missing `docId`, missing `status` (only `syncState` present), and ISO string timestamp.
- **Suggestion**: Add `docId: 'status'`, include `status: params.syncState === 'syncing' ? 'syncing' : (params.syncState === 'offline' ? 'offline' : 'online')`, and allow string or timestamp `updatedAt`.

### [Major] Finding 4: Substring Collisions in Field Classification (`classifyField`)
- **What**: Naive `.includes('l4')` and `.includes('rate')` classify non-sensitive fields (`col4`, `level4`, `corporate_id`, `generate_timestamp`, `operate_mode`) into sensitive encrypted vaults.
- **Where**:
  - `src/services/security/vaultService.ts`: lines 358–389, 427–434
- **Why**: Lack of regex word boundaries (`/(?:^|_)l4(?:$|_)/i`) or explicit keyword lists.
- **Suggestion**: Use word-boundary regex or tokenize field names before classification.

### [Major] Finding 5: Medical Absence Leak in `sanitizeForPublicSchedule`
- **What**: Only `key === 'shift_code' && value === 'L4'` is obfuscated. Alternative casing or naming (`shiftCode: 'L4'`, `shift_code: 'l4'`) leaks into public schedules.
- **Where**:
  - `src/services/security/vaultService.ts`: lines 461–465
- **Why**: Inflexible equality comparison without key normalization or case-folding.
- **Suggestion**: Normalize key and value: `if ((key === 'shift_code' || key === 'shiftCode') && String(value).toUpperCase() === 'L4') { sanitized[key] = 'ABSENCE'; }`.

### [Major] Finding 6: Silent Checksum Acceptance in `unpackageGenericVault`
- **What**: When decrypted payload SHA-256 does not match `doc.checksum`, `unpackageGenericVault` logs a warning and returns `success: true`.
- **Where**:
  - `src/services/security/vaultService.ts`: lines 584–588
- **Why**: Allows corrupted or tampered payloads to pass validation undetected if callers inspect only `result.success`.
- **Suggestion**: Fail closed: throw an error or set `success: false` if `recalculatedChecksum !== doc.checksum`.

### [Minor] Finding 7: Lack of Parameter Boundary Validation in `packageGenericVault`
- **What**: Empty strings for `storeId`, `unitCode`, and `docId` are accepted without validation.
- **Where**:
  - `src/services/security/vaultService.ts`: lines 479–505
- **Why**: May lead to empty AAD binding context tokens and subsequent Firestore validation rejections.
- **Suggestion**: Add parameter guard assertions at entry.

---

## 4. Verified Claims Matrix

| Claim | Upstream Source | Verification Method | Result | Notes |
|---|---|---|---|---|
| Zero-Leak Per-Store Isolation | M3 Worker 1 | Inspected `isStoreAuthorized(storeId)` in `firestore.rules` | **PASS** | Token `storeId` strictly checked against path `{storeId}` |
| Workstation Enumeration Elimination | M3 Worker 1 | Inspected `/app_installations/{installId}` in `firestore.rules` | **PASS** | Read restricted to `userEmail == request.auth.token.email` or `DISTRICT_MANAGER` |
| Fast AES-256-GCM Benchmark | M3 Worker 1 | `f12_f15_cryptography.test.ts` Test 7 | **PASS** | 100 round-trips in ~4.15 ms (< 200 ms) |
| Clean TypeScript Build | M3 Worker 1 | `npm run build` | **PASS** | Exit code 0, 0 TS/Vite errors |
| Vault Document Schema Conformance | M3 Worker 1 | Cross-validation script comparing `VaultService` vs `isValidVaultDocument` | **FAIL** | 4 fatal schema contradictions (`version`, `iv`, `tag`, `ciphertext`, `timestamp`) |
| Telemetry Document Conformance | M3 Worker 1 | Cross-validation script comparing `buildTelemetryStatus` vs `isValidStoreTelemetry` | **FAIL** | Missing `docId`, missing `status`, string timestamp |
| F13 & F14 Genuine Test Coverage | M3 Worker 1 | Code inspection of `f13`, `b13`, `b14` tests | **FAIL (INTEGRITY VIOLATION)** | Tests use local closures, bypassing production services |

---

## 5. Adversarial Stress Test Results

| Attack Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| Packaged financial document written to `/stores/108150/vault_financials/month_2026_03` under `firestore.rules` | Allowed by `isValidVaultDocument` | **REJECTED**: Missing `version`, `iv`, `tag`, `ciphertext`; string `updatedAt` | **FAIL (CRITICAL)** |
| Packaged telemetry status written to `/stores/108150/telemetry/status` under `firestore.rules` | Allowed by `isValidStoreTelemetry` | **REJECTED**: Missing `docId`, missing `status`; string `updatedAt` | **FAIL (CRITICAL)** |
| Non-sensitive field `col4` passed to `classifyField` | Classified as `TIER_3_PUBLIC_ROUTING` or non-health | **FAIL**: Classified as `TIER_2_HR_GDPR` (`vault_health_gdpr`) | **FAIL (MAJOR)** |
| Public schedule record with `shiftCode: 'L4'` sanitized | Obfuscated to `shiftCode: 'ABSENCE'` | **FAIL**: Output contains raw `{ shiftCode: 'L4' }` | **FAIL (MAJOR)** |
| Vault document with mismatched header checksum unpacked | Rejected with Error or `success: false` | **FAIL**: Returns `success: true` with warning only | **FAIL (MAJOR)** |
| Cross-store read attempt by Store A user on Store B path | Rejected by `isStoreAuthorized(storeId)` | Correctly blocked | **PASS** |
| Cross-store write attempt by Store A manager on Store B vault | Rejected by `isStoreAuthorized(storeId)` | Correctly blocked | **PASS** |
| General user queries entire `/app_installations` collection | Rejected as unconstrained collection query | Correctly blocked | **PASS** |

---

## 6. Caveats

1. Firebase local emulator was not run during this static verification phase; rules behavior was evaluated via formal structural analysis against the Firebase rules specification and simulated in Node.js.
2. The core cryptographic engine (`encryptionService.ts`) is well-designed, correct, and performant; the defects reside in the interface contract layer between `vaultService.ts`, `firestore.rules`, and the facade test suites.

---

## 7. Conclusion & Next Steps

Milestone 3 cannot be approved in its current state due to a **Critical Integrity Violation** (facade tests bypassing real code) and **Critical Contract Incompatibilities** (100% rejection of packaged documents by Firestore rules).

### Required Remediation Steps:
1. **Fix Schema Contract Mismatch**:
   - Update `firestore.rules` `isValidVaultDocument` to accept `encryptedPayload` (or update `vaultService.ts` to output `{ version, iv, tag, ciphertext }` at the root).
   - Ensure timestamp compatibility (`updatedAt`).
   - Fix `buildTelemetryStatus` and `isValidStoreTelemetry` to align on `docId`, `status`, and `updatedAt`.
2. **Eliminate Facade Tests (Integrity Fix)**:
   - Rewrite `tests/e2e/tier1-feature-coverage/f13_sensitive_payload_vault.test.ts` and `tests/e2e/tier2-boundary-corner/b13_payload_classification_boundaries.test.ts` to import and test `VaultService` directly.
   - Add integration tests verifying that documents generated by `VaultService` satisfy `firestore.rules` validators.
3. **Fix Classification & Sanitization Regressions**:
   - Add word-boundary checks to `classifyField` to eliminate substring collisions (`col4`, `level4`, `corporate_id`, `operate_mode`).
   - Harden `sanitizeForPublicSchedule` against camelCase and case variations (`shiftCode`, `l4`).
   - Fail closed on checksum mismatch in `unpackageGenericVault`.

---

## 8. Verification Method

To independently reproduce all findings and verify the invalidation conditions:

1. **Verify Schema Contract Rejection**:
   ```bash
   npx tsx -e "
   import { VaultService } from './src/services/security/vaultService';
   async function test() {
     const pkg = await VaultService.packageFinancialVault('108150', '18150', 'month_2026_03', { period: 'month_2026_03' });
     const required = ['docId', 'storeId', 'vaultType', 'version', 'iv', 'tag', 'ciphertext', 'updatedAt', 'updatedBy'];
     console.log('Missing fields:', required.filter(f => !(f in pkg.doc)));
   }
   test();"
   ```
   *Expected Result*: Logs `Missing fields: [ 'version', 'iv', 'tag', 'ciphertext' ]`.

2. **Verify Telemetry Schema Rejection**:
   ```bash
   npx tsx -e "
   import { VaultService } from './src/services/security/vaultService';
   const tel = VaultService.buildTelemetryStatus({ storeId: '108150', unitCode: '18150', storeName: 'Janki', vaultStats: {} as any, localDatabaseHealth: {} as any });
   const required = ['docId', 'storeId', 'status', 'clientVersion', 'updatedAt'];
   console.log('Missing telemetry fields:', required.filter(f => !(f in tel)));
   "
   ```
   *Expected Result*: Logs `Missing telemetry fields: [ 'docId', 'status' ]`.

3. **Verify Facade Tests**:
   Inspect lines 5–20 in `tests/e2e/tier1-feature-coverage/f13_sensitive_payload_vault.test.ts` and lines 5–15 in `tests/e2e/tier2-boundary-corner/b13_payload_classification_boundaries.test.ts`. Notice that `VaultService` is never imported or tested.
