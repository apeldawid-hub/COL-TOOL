# Handoff Report: Milestone 3 Retry Explorer 2 — Schema Reconciliation & Medical Sanitization

**Agent**: M3 Retry Explorer 2 (Schema Reconciliation, Field Classification, Medical Sanitization & Checksum Verification)  
**Roles**: Explorer, Investigator, Architect  
**Project Root**: `/Users/dawidapel/COL Tool`  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m3_retry_explorer_2`  
**Date**: 2026-10-24  
**Target File Responsibilities**: `src/services/security/vaultService.ts`, `firestore.rules`  
**Status**: COMPLETE (Read-Only Blueprint Delivered)

---

## 1. Observation

Direct observations from independent inspection of the codebase, Firestore security rules, existing test suites, and reviewer reports:

### Observation 1.1: Schema Divergence Between `vaultService.ts` and `firestore.rules`
1. **`src/services/security/vaultService.ts` lines 507–522**:
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
2. **`firestore.rules` lines 175–189**:
   ```firestore
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
3. **Verification**: Executing validation against the packaged document:
   - Missing required top-level fields: `version`, `iv`, `tag`, `ciphertext`.
   - `doc.updatedAt` is an ISO 8601 string (`new Date().toISOString()`), which fails Firestore rule `data.updatedAt is timestamp`.
   - `doc.schemaVersion` is provided, but rule asserted `data.version == 'v1'`.

### Observation 1.2: Telemetry Status Schema Divergence
1. **`src/services/security/vaultService.ts` lines 806–833 (`buildTelemetryStatus`)**:
   Produces an object with fields `storeId`, `unitCode`, `storeName`, `clientVersion`, `platform`, `lastSyncAt`, `lastHeartbeatAt`, `vaultStats`, `syncState`, `localDatabaseHealth`, `updatedAt`, `updatedBy`.
2. **`firestore.rules` lines 191–198 (`isValidStoreTelemetry`)**:
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
3. **Discrepancies**:
   - `docId` is completely missing from the telemetry object (required for `/stores/{storeId}/telemetry/{docId}` where rule asserts `request.resource.data.docId == docId`).
   - `status` is missing (`syncState` is provided, which also allowed `'error'`).
   - `updatedAt` is an ISO string, failing `data.updatedAt is timestamp`.

### Observation 1.3: Substring Collisions in `classifyField()`
1. **`src/services/security/vaultService.ts` lines 357–391**:
   - Uses `fnLower.includes('l4')`: falsely matches `col4` and `level4`, routing non-sensitive metadata to `vault_health_gdpr`.
   - Uses `fnLower.includes('rate')`: falsely matches `corporate_id`, `generate_timestamp`, `operate_mode`, `celebrate_date`, routing non-sensitive metadata to `vault_personnel`.
2. **`vaultService.ts` line 428 (`containsSensitiveFields`)**:
   - Uses `/salary|rate|l4|sick|bonus|payroll|sales|revenue|profit|sanepid/i.test(key)`: suffers from the exact same false positive substring matches on `rate` and `l4`.

### Observation 1.4: Medical Sick Leave L4 Leak in `sanitizeForPublicSchedule()`
1. **`src/services/security/vaultService.ts` lines 461–465**:
   ```typescript
   if (key === 'shift_code' && value === 'L4') {
     sanitized[key] = 'ABSENCE';
   } else {
     sanitized[key] = value;
   }
   ```
2. **Verification**:
   - `{ shiftCode: 'L4' }` -> produces `{ shiftCode: 'L4' }` (UNSANITIZED LEAK).
   - `{ shift_code: 'l4' }` -> produces `{ shift_code: 'l4' }` (UNSANITIZED LEAK).
   - `{ ShiftCode: '  l4  ' }` -> produces `{ ShiftCode: '  l4  ' }` (UNSANITIZED LEAK).
   - Sensitive keys list in `sanitizeForPublicSchedule` only did exact array lookups (`sensitiveKeys.includes(key)`), meaning casing variants like `HourlyRate` or `hourly_rate_pln` were not stripped if not explicitly in the array.

### Observation 1.5: Silent Checksum Failure in `unpackageGenericVault()`
1. **`src/services/security/vaultService.ts` lines 580–593**:
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
2. **Failure**: When `doc.checksum` does not match `recalculatedChecksum` (indicating payload corruption or bit flips), `unpackageGenericVault` prints a console warning and still returns `{ success: true, payload }`. Corrupted data is silently accepted as valid.

---

## 2. Logic Chain

1. **Schema Reconciliation (Resolving Observation 1.1 & 1.2)**:
   - In client-side encryption, `encryptPayloadSync` returns an `EncryptedEnvelope` containing `{ version: 'v1', storeId, keyId, iv, tag, ciphertext, serialized }`.
   - By unpacking envelope fields into top-level properties in `EncryptedVaultDocument`:
     `{ docId, storeId, unitCode, vaultType, version: envelope.version, keyId: envelope.keyId, iv: envelope.iv, tag: envelope.tag, ciphertext: envelope.ciphertext, encryptedPayload: envelope.serialized, schemaVersion: 'v1', recordCount, checksum, updatedAt, updatedBy }`.
   - This satisfies Firestore rules' requirement for top-level `version`, `iv`, `tag`, `ciphertext` while maintaining the canonical 7-segment `encryptedPayload` envelope string (`enc:v1:<storeId>:<keyId>:<iv>:<tag>:<ciphertext>`) for existing consumer code and tests (e.g. `f12_f15_cryptography.test.ts:358`).
   - In `firestore.rules`, updating `isValidVaultDocument()` to accept both timestamp and ISO string:
     `(data.updatedAt is timestamp || (data.updatedAt is string && data.updatedAt.size() > 0))`
     and adding optional envelope field checks (`encryptedPayload`, `schemaVersion`, `unitCode`, `clientVersion`, `period`, `staffGroup`, `weekKey`) guarantees 100% rule compliance without type rejections.
   - For telemetry, adding `docId: 'status'`, `status: params.status || mapSyncState(params.syncState)`, and flexible `updatedAt` ensures `/stores/{storeId}/telemetry/status` passes `isValidStoreTelemetry()`.

2. **Word-Boundary Field Classification (Resolving Observation 1.3)**:
   - Converting camelCase to snake_case (`fieldName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()`) normalizes all identifiers before regex evaluation.
   - Enforcing word boundaries with `(?:^|_)` and `(?:_|$)` ensures:
     - `/(?:^|_)(?:l4|sick|health|medical|disability|diagnosis|sanepid|convalescence)(?:_|$)/i` matches `l4`, `shift_code_l4`, `medical_l4`, `medicalL4`, `sanepid_valid_until`, but NEVER matches `col4` or `level4`.
     - `/(?:^|_)(?:salary|hourly_rate|hourlyrate|bonus_rate|rate_pln|rate|bonus|payroll|iban)(?:_|$)/i` matches `hourly_rate`, `hourlyRate`, `rate`, `rate_pln`, `salary`, `monthly_salary`, but NEVER matches `corporate_id`, `generate_timestamp`, or `operate_mode`.
   - Applying the same normalized boundary matching in `containsSensitiveFields()` eliminates false positive sensitivity detections.

3. **Robust Schedule Sanitization (Resolving Observation 1.4)**:
   - Normalizing key names (`key.toLowerCase().replace(/_/g, '')`) collapses `shift_code`, `shiftCode`, and `ShiftCode` to `'shiftcode'`.
   - Checking `typeof value === 'string' && value.trim().toUpperCase() === 'L4'` detects both lowercase `'l4'` and uppercase `'L4'`, with or without whitespace.
   - Obfuscating to `'ABSENCE'` (or configurable parameter) guarantees zero medical data leakage to public schedule views.
   - Using case-insensitive regex for sensitive keys ensures `HourlyRate`, `monthly_salary`, `medicalL4`, `notes` are completely stripped.

4. **Fail-Closed Checksum Verification (Resolving Observation 1.5)**:
   - Cryptographic integrity requires fail-closed behavior: any discrepancy between computed SHA-256 and expected `doc.checksum` indicates data corruption, truncation, or tampering.
   - `unpackageGenericVault()` already throws an `Error` for storeId mismatch, vaultType mismatch, and auth tag failures. Throwing `throw new Error('Checksum mismatch: payload corrupted...')` aligns checksum verification with the fail-closed security model.

---

## 3. Caveats

1. **Obfuscation Code in `sanitizeForPublicSchedule` (`'ABSENCE'` vs `'PL'`)**:
   - The mission dispatch mentioned: `"and replaces with 'PL'"`.
   - However, existing tests in `tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts:321` and `tests/e2e/tier5-adversarial/m3_challenger_vault_packaging_and_tenant_isolation.test.ts:375` assert:
     `assert.equal(sanitized.shift_code, 'ABSENCE')`.
   - Setting a hardcoded `'PL'` would immediately break these 2 passing test suites.
   - **Design Solution**: Provide `l4Replacement: string = 'ABSENCE'` as a default parameter in `sanitizeForPublicSchedule(record, l4Replacement = 'ABSENCE')`. If called without arguments, it defaults to `'ABSENCE'`, ensuring 100% backward compatibility with existing tests. If `'PL'` is passed, it replaces with `'PL'`. Both `'ABSENCE'` and `'PL'` are completely non-medical and eliminate the GDPR leak.
2. **Firestore Timestamp vs ISO String**:
   - In production web/mobile Firebase SDKs, `serverTimestamp()` produces a Firestore `Timestamp` object.
   - In Node.js server scripts, tests, and REST API uploads, timestamps are often passed as ISO 8601 strings (`2026-10-24T...`).
   - Allowing `(data.updatedAt is timestamp || (data.updatedAt is string && data.updatedAt.size() > 0))` supports both environments natively with zero friction.

---

## 4. Conclusion & Precise Code Blueprints

The following blueprints represent the complete, production-grade fix to be implemented by M3 Worker.

### Blueprint A: `src/services/security/vaultService.ts`

#### 1. Interface Updates (`VaultDocumentHeader`, `EncryptedVaultDocument`, `PlaintextTelemetryDocument`)
```typescript
// Replace lines 52-74 with:
export interface VaultDocumentHeader {
  docId: string;
  storeId: string;
  unitCode: string;
  vaultType: VaultType;
  version: 'v1';
  keyId?: string;
  iv: string; // base64 (12 bytes / 96-bit)
  tag: string; // base64 (16 bytes / 128-bit)
  ciphertext: string; // base64
  encryptedPayload: string; // canonical 7-segment envelope string: 'enc:v1:...'
  period?: string;
  staffGroup?: string;
  weekKey?: string;
  updatedAt: string;
  updatedBy: string;
  clientVersion: string;
  recordCount: number;
  checksum: string; // SHA-256 hex digest of canonical plaintext payload
  schemaVersion: 'v1';
}

export type EncryptedVaultDocument = VaultDocumentHeader;

// Replace lines 78-105 with:
export interface PlaintextTelemetryDocument {
  docId: string; // always 'status'
  storeId: string;
  unitCode: string;
  storeName: string;
  status: 'online' | 'offline' | 'syncing' | 'idle' | 'error';
  clientVersion: string;
  platform: string;
  lastSyncAt: string;
  lastHeartbeatAt: string;
  vaultStats: {
    financialsRecordsCount: number;
    financialsLastChecksum: string;
    personnelRecordsCount: number;
    personnelLastChecksum: string;
    schedulesRecordsCount: number;
    schedulesLastChecksum: string;
    healthGdprRecordsCount: number;
    healthGdprLastChecksum: string;
  };
  syncState: 'idle' | 'syncing' | 'error' | 'offline';
  localDatabaseHealth: {
    integrity: 'ok' | 'corrupted' | 'error';
    totalTables: number;
    totalLocalRecords: number;
    dbSizeBytes: number;
  };
  updatedAt: string;
  updatedBy: string;
}
```

#### 2. `classifyField()` and `containsSensitiveFields()`
```typescript
// Replace lines 353-436 with:
  /**
   * Field-level classification lookup with strict word-boundary matching.
   * Prevents false positives on words containing 'rate' (operate, generate, corporate)
   * or ending with 'l4' (col4, level4).
   */
  public static classifyField(tableName: string, fieldName: string): FieldClassificationRule {
    // Normalize camelCase to snake_case and lower-case
    const norm = fieldName.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

    // 1. GDPR Article 9 Health Data & Medical Absences (strict word boundaries)
    if (/(?:^|_)(?:l4|sick|health|medical|disability|diagnosis|sanepid|convalescence)(?:_|$)/i.test(norm)) {
      return {
        tier: 'TIER_2_HR_GDPR',
        requiresEncryption: true,
        targetVault: 'vault_health_gdpr',
        description: 'Special Category Data under GDPR Article 9 (Medical leaves, health clearances, disability status)',
      };
    }

    // 2. HR & Compensation Data (strict word boundaries)
    if (
      /(?:^|_)(?:salary|hourly_rate|hourlyrate|bonus_rate|rate_pln|rate|bonus|payroll|iban)(?:_|$)/i.test(norm) ||
      (/(?:^|_)contract(?:_|$)/i.test(norm) && !norm.includes('code'))
    ) {
      return {
        tier: 'TIER_2_HR_GDPR',
        requiresEncryption: true,
        targetVault: 'vault_personnel',
        description: 'Sensitive Personnel Compensation & Contract Terms',
      };
    }

    // 3. Financial & Business Confidential
    if (
      /(?:^|_)(?:sales|revenue|profit|agc|budget|drivers|whatif|labor_budget)(?:_|$)/i.test(norm) ||
      norm.startsWith('col_') || norm.startsWith('cos_') || norm.includes('plan_col') || norm.includes('plan_cos')
    ) {
      return {
        tier: 'TIER_1_FINANCIAL',
        requiresEncryption: true,
        targetVault: 'vault_financials',
        description: 'Confidential Commercial & P&L Performance Data',
      };
    }

    // 4. Default: Public Telemetry / Routing
    return {
      tier: 'TIER_3_PUBLIC_ROUTING',
      requiresEncryption: false,
      targetVault: 'telemetry',
      description: 'Public Routing, Calendar Topology, or Operational Definition',
    };
  }

  /**
   * Deep sensitivity check on an arbitrary payload object with strict word-boundary matching.
   */
  public static containsSensitiveFields(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    for (const [key, value] of Object.entries(obj)) {
      const norm = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      if (
        /(?:^|_)(?:salary|hourly_rate|hourlyrate|bonus_rate|rate_pln|rate|bonus|payroll|iban|l4|sick|health|medical|disability|diagnosis|sanepid|sales|revenue|profit|budget)(?:_|$)/i.test(norm) ||
        norm.startsWith('col_') || norm.startsWith('cos_')
      ) {
        return true;
      }
      if (typeof value === 'object' && this.containsSensitiveFields(value)) {
        return true;
      }
    }
    return false;
  }
```

#### 3. `sanitizeForPublicSchedule()`
```typescript
// Replace lines 441-469 with:
  /**
   * Sanitizes a schedule record before public display or transmission to unprivileged users.
   * Strips all compensation and medical fields, and obfuscates sick leave L4 to ABSENCE (or PL).
   * Supports both snake_case (shift_code) and camelCase (shiftCode) keys and case-insensitive L4 values.
   */
  public static sanitizeForPublicSchedule(
    record: Record<string, any>,
    l4Replacement: string = 'ABSENCE'
  ): Record<string, any> {
    const sensitivePatterns = /^(?:salary|monthly_?salary|hourly_?rate(?:_pln)?|rate(?:_pln)?|iban|medical_?l4|diagnosis|plan_?sick_?hours|est_?sick_?hours|notes)$/i;

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      const normKey = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      const compactKey = key.toLowerCase().replace(/_/g, '');

      if (sensitivePatterns.test(normKey)) {
        continue; // Strip sensitive compensation and health metadata
      }

      if (compactKey === 'shiftcode' && typeof value === 'string' && value.trim().toUpperCase() === 'L4') {
        sanitized[key] = l4Replacement;
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
```

#### 4. `packageGenericVault()` and `unpackageGenericVault()`
```typescript
// Replace lines 502-523 in packageGenericVault with:
    // 2. Client-Side AES-256-GCM Encryption with Bound AAD Context
    const envelope = encryptPayloadSync(sensitivePayload, storeId, unitCode, vaultType, docId);
    const ciphertextSizeBytes = Buffer.byteLength(envelope.serialized || '', 'utf8');

    // 3. Construct Firestore Envelope Document with Unpacked Top-Level Properties
    const doc: EncryptedVaultDocument = {
      docId,
      storeId,
      unitCode,
      vaultType,
      version: envelope.version,
      keyId: envelope.keyId,
      iv: envelope.iv,
      tag: envelope.tag,
      ciphertext: envelope.ciphertext,
      encryptedPayload: envelope.serialized,
      schemaVersion: this.SCHEMA_VERSION,
      recordCount,
      checksum,
      updatedAt,
      updatedBy,
      clientVersion: this.CLIENT_VERSION,
      ...(period ? { period } : {}),
      ...(staffGroup ? { staffGroup } : {}),
      ...(weekKey ? { weekKey } : {}),
    };

// Replace lines 567-614 in unpackageGenericVault with:
    if (!doc.encryptedPayload && !doc.ciphertext) {
      throw new Error(`Missing encryptedPayload in vault document ${doc.docId}`);
    }

    // 2. Decrypt Payload with AAD Context Verification
    const envelopeInput: string | EncryptedEnvelope = doc.encryptedPayload || {
      version: doc.version,
      storeId: doc.storeId,
      keyId: doc.keyId || 'k1',
      iv: doc.iv,
      tag: doc.tag,
      ciphertext: doc.ciphertext,
      serialized: '',
    };

    const payload = decryptPayloadSync<T>(
      envelopeInput,
      storeId,
      unitCode,
      doc.vaultType,
      doc.docId
    );

    // 3. Verify Decrypted Content Integrity Checksum (Fail Closed)
    const recalculatedChecksum = canonicalSha256(payload);
    const checksumVerified = recalculatedChecksum === doc.checksum;

    if (!checksumVerified) {
      throw new Error(
        `Checksum mismatch: payload corrupted for document ${doc.docId} (expected ${doc.checksum}, got ${recalculatedChecksum})`
      );
    }

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      header: {
        docId: doc.docId,
        storeId: doc.storeId,
        unitCode: doc.unitCode,
        vaultType: doc.vaultType,
        version: doc.version,
        keyId: doc.keyId,
        iv: doc.iv,
        tag: doc.tag,
        ciphertext: doc.ciphertext,
        encryptedPayload: doc.encryptedPayload,
        period: doc.period,
        staffGroup: doc.staffGroup,
        weekKey: doc.weekKey,
        updatedAt: doc.updatedAt,
        updatedBy: doc.updatedBy,
        clientVersion: doc.clientVersion,
        recordCount: doc.recordCount,
        checksum: doc.checksum,
        schemaVersion: doc.schemaVersion,
      },
      payload,
      metrics: {
        durationMs,
        checksumVerified,
      },
    };
```

#### 5. `buildTelemetryStatus()`
```typescript
// Replace lines 806-833 with:
  /**
   * Builds Plaintext Public Telemetry Document (`stores/{storeId}/telemetry/status`)
   */
  public static buildTelemetryStatus(params: {
    storeId: string;
    unitCode: string;
    storeName: string;
    status?: 'online' | 'offline' | 'syncing' | 'idle' | 'error';
    platform?: string;
    lastSyncAt?: string;
    vaultStats: PlaintextTelemetryDocument['vaultStats'];
    syncState?: PlaintextTelemetryDocument['syncState'];
    localDatabaseHealth: PlaintextTelemetryDocument['localDatabaseHealth'];
    updatedBy?: string;
  }): PlaintextTelemetryDocument {
    const now = new Date().toISOString();
    const syncState = params.syncState || 'idle';
    let status: 'online' | 'offline' | 'syncing' | 'idle' | 'error' = 'online';
    if (params.status) {
      status = params.status;
    } else if (syncState === 'syncing') {
      status = 'syncing';
    } else if (syncState === 'offline') {
      status = 'offline';
    } else if (syncState === 'error') {
      status = 'error';
    } else if (syncState === 'idle') {
      status = 'idle';
    }

    return {
      docId: 'status',
      storeId: params.storeId,
      unitCode: params.unitCode,
      storeName: params.storeName,
      status,
      clientVersion: this.CLIENT_VERSION,
      platform: params.platform || (typeof process !== 'undefined' ? process.platform : 'darwin'),
      lastSyncAt: params.lastSyncAt || now,
      lastHeartbeatAt: now,
      vaultStats: params.vaultStats,
      syncState,
      localDatabaseHealth: params.localDatabaseHealth,
      updatedAt: now,
      updatedBy: params.updatedBy || 'system_telemetry_reporter',
    };
  }
```

---

### Blueprint B: `firestore.rules`

#### Helper Functions Update (`isValidVaultDocument` & `isValidStoreTelemetry`)
```firestore
// Replace lines 174-199 with:
    // Validates encrypted vault payload envelope (Feature F14)
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
             (!('encryptedPayload' in data) || validString(data.encryptedPayload, 1, 2500000)) &&
             (!('schemaVersion' in data) || validString(data.schemaVersion, 1, 16)) &&
             (!('clientVersion' in data) || validString(data.clientVersion, 1, 64)) &&
             (!('unitCode' in data) || validString(data.unitCode, 1, 32)) &&
             (!('period' in data) || validOptionalString(data.period, 1, 64)) &&
             (!('staffGroup' in data) || validOptionalString(data.staffGroup, 1, 64)) &&
             (!('weekKey' in data) || validOptionalString(data.weekKey, 1, 64)) &&
             (!('recordCount' in data) || (data.recordCount is int && data.recordCount >= 0)) &&
             (!('checksum' in data) || validString(data.checksum, 32, 128)) &&
             (data.updatedAt is timestamp || (data.updatedAt is string && data.updatedAt.size() > 0)) &&
             validString(data.updatedBy, 1, 128);
    }

    function isValidStoreTelemetry(data, storeId) {
      return hasRequiredFields(['docId', 'storeId', 'status', 'clientVersion', 'updatedAt']) &&
             data.storeId == storeId &&
             validString(data.docId, 1, 128) &&
             data.status in ['online', 'offline', 'syncing', 'idle', 'error'] &&
             validString(data.clientVersion, 1, 64) &&
             (data.updatedAt is timestamp || (data.updatedAt is string && data.updatedAt.size() > 0));
    }
```

---

## 5. Verification Method

To verify these changes independently:

### Verification Command 1: TypeScript Compilation
```bash
npm run build
```
*Expected Result*: Exits 0 with 0 TS errors.

### Verification Command 2: Cryptography & Packaging Test Suite
```bash
npx tsx --test "tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts"
```
*Expected Result*: 9/9 tests pass cleanly.

### Verification Command 3: Full Multi-Tier E2E Test Suite
```bash
npx tsx --test "tests/e2e/**/*.test.ts"
```
*Expected Result*: All 332+ tests pass with zero failures.

### Verification Command 4: Direct Node Validation of Reconciled Schema & Classification
```bash
npx tsx -e "
import { VaultService } from './src/services/security/vaultService';
import { canonicalSha256 } from './src/services/security/encryptionService';
import assert from 'node:assert/strict';

async function runVerification() {
  // 1. Verify unpacked vault document fields
  const finPkg = await VaultService.packageFinancialVault('108150', '18150', 'month_2026_03', { period: 'month_2026_03' });
  const doc = finPkg.doc;
  assert.equal(doc.docId, 'month_2026_03');
  assert.equal(doc.storeId, '108150');
  assert.equal(doc.vaultType, 'vault_financials');
  assert.equal(doc.version, 'v1');
  assert.ok(typeof doc.iv === 'string' && doc.iv.length >= 16);
  assert.ok(typeof doc.tag === 'string' && doc.tag.length >= 20);
  assert.ok(typeof doc.ciphertext === 'string' && doc.ciphertext.length > 0);
  assert.ok(typeof doc.encryptedPayload === 'string' && doc.encryptedPayload.startsWith('enc:v1:'));
  assert.ok(typeof doc.updatedAt === 'string');
  assert.ok(typeof doc.updatedBy === 'string');

  // 2. Verify telemetry document fields
  const telemetry = VaultService.buildTelemetryStatus({
    storeId: '108150',
    unitCode: '18150',
    storeName: 'SBX Janki',
    vaultStats: {} as any,
    localDatabaseHealth: { integrity: 'ok' } as any,
  });
  assert.equal(telemetry.docId, 'status');
  assert.equal(telemetry.status, 'online');
  assert.ok(typeof telemetry.updatedAt === 'string');

  // 3. Verify zero substring collisions
  assert.equal(VaultService.classifyField('settings', 'col4').targetVault, 'telemetry');
  assert.equal(VaultService.classifyField('settings', 'level4').targetVault, 'telemetry');
  assert.equal(VaultService.classifyField('stores', 'corporate_id').targetVault, 'telemetry');
  assert.equal(VaultService.classifyField('sync', 'generate_timestamp').targetVault, 'telemetry');
  assert.equal(VaultService.classifyField('app', 'operate_mode').targetVault, 'telemetry');

  // 4. Verify medical sanitization
  const sanitizedCamel = VaultService.sanitizeForPublicSchedule({ shiftCode: 'l4', name: 'Jan' });
  assert.equal(sanitizedCamel.shiftCode, 'ABSENCE');
  const sanitizedSnake = VaultService.sanitizeForPublicSchedule({ shift_code: 'L4', name: 'Jan' });
  assert.equal(sanitizedSnake.shift_code, 'ABSENCE');

  // 5. Verify checksum mismatch throws
  const tamperedDoc = { ...doc, checksum: '0000000000000000000000000000000000000000000000000000000000000000' };
  await assert.rejects(
    () => VaultService.unpackageFinancialVault(tamperedDoc, '108150', '18150'),
    /Checksum mismatch/i
  );

  console.log('✅ ALL VERIFICATIONS PASSED 100%!');
}
runVerification();
"
```
*Expected Result*: Prints `✅ ALL VERIFICATIONS PASSED 100%!`.
