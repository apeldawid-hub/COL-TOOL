/**
 * Starbucks Operations Suite — Final Milestone Phase 2: Tier 5 White-Box Adversarial Hardening Suite
 *
 * Comprehensive empirical coverage hardening, boundary fuzzing, and failure mode verification across:
 * 1. Encryption & Canonical JSON Hardening (`encryptionService.ts`)
 * 2. Vault Classification & Packaging Boundaries (`vaultService.ts`)
 * 3. Bi-Directional Cryptographic Parity Verification Engine (`parityVerificationService.ts`)
 * 4. Zero-Data-Loss Cloud Migration Pipeline (`cloudMigrationService.ts`)
 * 5. Database Connection Pool, Mutex & Store Backups (`electron/database/db.ts` & `backupManager.ts`)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import initSqlJs from 'sql.js';

import {
  canonicalJson,
  canonicalSha256,
  StoreKeyCache,
  deriveStoreKeySync,
  deriveStoreKey,
  parseEnvelope,
  serializeEnvelope,
  encryptPayloadSync,
  decryptPayloadSync,
  resolveUnitCode,
} from '../../../src/services/security/encryptionService';
import {
  VaultService,
  EncryptedVaultDocument,
  FinancialVaultPayload,
  PersonnelVaultPayload,
  ScheduleVaultPayload,
  HealthGdprVaultPayload,
} from '../../../src/services/security/vaultService';
import {
  ParityVerificationService,
  ParityVerificationReport,
} from '../../../src/services/security/parityVerificationService';
import {
  CloudMigrationService,
  MAX_DOCS_PER_BATCH,
  KNOWN_SQLITE_TABLES,
} from '../../../src/services/security/cloudMigrationService';
import {
  DatabaseManager,
  StoreConnectionPool,
  AsyncMutex,
} from '../../../electron/database/db';
import {
  BackupManager,
  validateRestoreTarget,
} from '../../../electron/database/backupManager';

test('Tier 5 Final Adversarial Hardening & Boundary Fuzzing Suite', async (suite) => {
  const storeId = '108160'; // Starbucks Poznań Stary Browar
  const unitCode = '18160';

  // =========================================================================================
  // 1. ENCRYPTION ENGINE & CANONICAL JSON WHITE-BOX HARDENING (encryptionService.ts)
  // =========================================================================================
  await suite.test('1. Encryption Engine & RFC 8785 Canonical JSON Boundary Fuzzing', async (t) => {
    // 1.1 Canonical JSON Array & Object Sanitization
    await t.test('1.1 canonicalJson sanitizes functions, symbols, and undefined in arrays and objects', () => {
      const complexArray = [1, undefined, () => 'evil', Symbol('test'), 'hello', null];
      const resultArr = canonicalJson(complexArray);
      assert.equal(resultArr, '[1,null,null,null,"hello",null]');

      const complexObj = {
        z: 'last',
        fn: () => 'drop_me',
        sym: Symbol('drop_me_too'),
        undef: undefined,
        a: 'first',
        nested: {
          b: 2,
          drop: undefined,
          c: [undefined, 3],
        },
      };
      const resultObj = canonicalJson(complexObj);
      assert.equal(resultObj, '{"a":"first","nested":{"b":2,"c":[null,3]},"z":"last"}');
    });

    // 1.2 Date Serialization & Invalid Date Handling
    await t.test('1.2 canonicalJson handles valid ISO dates and converts invalid Dates to null', () => {
      const validDate = new Date('2026-10-24T12:00:00.000Z');
      assert.equal(canonicalJson(validDate), '"2026-10-24T12:00:00.000Z"');

      const invalidDate = new Date('invalid date string');
      assert.equal(canonicalJson(invalidDate), 'null');
    });

    // 1.3 IEEE 754 Floating Point Boundary Values
    await t.test('1.3 canonicalJson serializes IEEE 754 edge cases (NaN, Infinity, -Infinity, -0)', () => {
      assert.equal(canonicalJson(NaN), 'null');
      assert.equal(canonicalJson(Infinity), 'null');
      assert.equal(canonicalJson(-Infinity), 'null');
      assert.equal(canonicalJson(-0), '0');
    });

    // 1.4 High-Entropy Polish Unicode & Emoji UTF-8 Encoding
    await t.test('1.4 canonicalSha256 preserves UTF-8 byte fidelity across Polish diacritics and emojis', () => {
      const polishText = 'Zażółć gęślą jaźń — Kawiarnia Starbucks CH Janki ☕🇵🇱';
      const hash1 = canonicalSha256({ text: polishText });
      const hash2 = canonicalSha256({ text: polishText.normalize('NFC') });
      assert.equal(hash1, hash2, 'NFC normalized Polish string must produce identical hash');

      const controlChars = { text: 'Line1\nLine2\tTabbed\0NullByte\r\fCarriage' };
      const hashControl = canonicalSha256(controlChars);
      assert.ok(typeof hashControl === 'string' && hashControl.length === 64);
    });

    // 1.5 StoreKeyCache Multi-Store Invalidation Isolation
    await t.test('1.5 StoreKeyCache.invalidateStore isolates prefixes and zeroes out memory buffers', () => {
      StoreKeyCache.clear();

      const keyA = Buffer.from('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
      const keyA10 = Buffer.from('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
      const passHash = 'hash123';

      StoreKeyCache.set('store_1', 'unit_1', passHash, keyA);
      StoreKeyCache.set('store_10', 'unit_10', passHash, keyA10);

      assert.equal(StoreKeyCache.size(), 2);

      // Invalidate store_1 only
      StoreKeyCache.invalidateStore('store_1');

      // store_1 must be evicted and keyA buffer must be zeroed out
      assert.equal(StoreKeyCache.get('store_1', 'unit_1', passHash), null);
      assert.ok(keyA.every((byte) => byte === 0), 'Evicted key buffer must be zeroed in memory');

      // store_10 must still be present and intact
      const cachedA10 = StoreKeyCache.get('store_10', 'unit_10', passHash);
      assert.ok(cachedA10 !== null);
      assert.equal(cachedA10?.toString('utf8'), 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');

      StoreKeyCache.clear();
    });

    // 1.6 StoreKeyCache Capacity LRU Eviction & Zeroing
    await t.test('1.6 StoreKeyCache evicts oldest key and zeroes memory when capacity exceeds 256', () => {
      StoreKeyCache.clear();
      const firstKey = Buffer.alloc(32, 0x42);
      StoreKeyCache.set('store_first', 'u', 'hash', firstKey);

      for (let i = 1; i <= 256; i++) {
        const dummyKey = Buffer.alloc(32, i % 256);
        StoreKeyCache.set(`store_${i}`, 'u', 'hash', dummyKey);
      }

      assert.equal(StoreKeyCache.size(), 256);
      assert.equal(StoreKeyCache.get('store_first', 'u', 'hash'), null, 'Oldest entry must be evicted');
      assert.ok(firstKey.every((b) => b === 0), 'Evicted key buffer must be securely wiped');

      StoreKeyCache.clear();
    });

    // 1.7 parseEnvelope Fuzzing & Malformed String Rejection
    await t.test('1.7 parseEnvelope cleanly rejects malformed strings, wrong prefixes, and missing parts', () => {
      const invalidEnvelopes = [
        '',
        '   ',
        'raw:v1:108160:k1:iv:tag:cipher',
        'enc:v2:108160:k1:iv:tag:cipher', // unsupported v2
        'enc:v1:108160:k1:iv:tag', // only 6 parts
        'enc:v1:108160:k1:iv:tag:cipher:extra', // 8 parts
        'enc:v1::k1:iv:tag:cipher', // empty storeId
        'enc:v1:108160::iv:tag:cipher', // empty keyId
        'enc:v1:108160:k1::tag:cipher', // empty iv
      ];

      for (const malformed of invalidEnvelopes) {
        assert.throws(
          () => parseEnvelope(malformed),
          /Malformed envelope format/i,
          `Must reject malformed envelope: "${malformed}"`
        );
      }
    });

    // 1.8 AEAD Ciphertext & Tag Tampering Detection
    await t.test('1.8 AES-256-GCM rejects tampered IV lengths, tag lengths, and swapped AAD context', () => {
      const payload = { secret: 'top_secret_revenue_100k' };
      const envelope = encryptPayloadSync(payload, storeId, unitCode, 'vault_financials', 'doc_2026_10');

      // Tamper IV length (not 12 bytes)
      const badIvEnvelope = { ...envelope, iv: Buffer.alloc(8).toString('base64') };
      assert.throws(
        () => decryptPayloadSync(badIvEnvelope, storeId, unitCode, 'vault_financials', 'doc_2026_10'),
        /Invalid initialization vector length/i
      );

      // Tamper Tag length (not 16 bytes)
      const badTagEnvelope = { ...envelope, tag: Buffer.alloc(12).toString('base64') };
      assert.throws(
        () => decryptPayloadSync(badTagEnvelope, storeId, unitCode, 'vault_financials', 'doc_2026_10'),
        /Invalid authentication tag length/i
      );

      // Store ID mismatch in envelope vs requested decrypt storeId
      assert.throws(
        () => decryptPayloadSync(envelope, '999999', unitCode, 'vault_financials', 'doc_2026_10'),
        /Store ID mismatch in envelope/i
      );

      // Swapped docId in AAD context
      assert.throws(
        () => decryptPayloadSync(envelope, storeId, unitCode, 'vault_financials', 'doc_tampered_id'),
        /Unsupported state or unable to authenticate data|unable to authenticate/i
      );

      // Swapped vaultType in AAD context
      assert.throws(
        () => decryptPayloadSync(envelope, storeId, unitCode, 'vault_personnel', 'doc_2026_10'),
        /Unsupported state or unable to authenticate data|unable to authenticate/i
      );
    });
  });

  // =========================================================================================
  // 2. VAULT CLASSIFICATION & PACKAGING BOUNDARIES (vaultService.ts)
  // =========================================================================================
  await suite.test('2. Vault Classification & Packaging Boundary Defense', async (t) => {
    // 2.1 classifyField Word Boundaries & Substring Collision Safety
    await t.test('2.1 classifyField prevents false positive classification on substring matches', () => {
      // Substrings containing 'rate' that should NOT be classified as HR compensation
      const benignFields = ['corporate_name', 'generate_report', 'moderate_risk', 'accelerate_ratio'];
      for (const field of benignFields) {
        const rule = VaultService.classifyField('settings', field);
        assert.notEqual(rule.tier, 'TIER_2_HR_GDPR', `Field '${field}' must not be classified as HR compensation`);
      }

      // Fields ending in 4 that should NOT be classified as L4 sick leave
      const nonL4Fields = ['col4', 'level4', 'cell4', 'channel4'];
      for (const field of nonL4Fields) {
        const rule = VaultService.classifyField('schedule', field);
        assert.notEqual(rule.tier, 'TIER_2_HR_GDPR', `Field '${field}' must not be classified as L4 medical leave`);
      }

      // True sensitive fields
      assert.equal(VaultService.classifyField('employees', 'hourly_rate').tier, 'TIER_2_HR_GDPR');
      assert.equal(VaultService.classifyField('employees', 'hourlyRate').tier, 'TIER_2_HR_GDPR');
      assert.equal(VaultService.classifyField('employees', 'monthly_salary').tier, 'TIER_2_HR_GDPR');
      assert.equal(VaultService.classifyField('absences', 'l4_days').tier, 'TIER_2_HR_GDPR');
      assert.equal(VaultService.classifyField('absences', 'medical_l4').tier, 'TIER_2_HR_GDPR');
      assert.equal(VaultService.classifyField('financials', 'plan_sales').tier, 'TIER_1_FINANCIAL');
      assert.equal(VaultService.classifyField('financials', 'col_total_pln').tier, 'TIER_1_FINANCIAL');
    });

    // 2.2 sanitizeForPublicSchedule Robustness
    await t.test('2.2 sanitizeForPublicSchedule obfuscates L4 variations and strips sensitive data', () => {
      const scheduleRecord = {
        id: 101,
        employee_id: 50,
        employee_name: 'Adam Barista',
        shift_code: 'l4', // lower-case L4
        hours: 8.0,
        hourly_rate: 34.5,
        monthly_salary: 5800.0,
        medical_l4: 'Grypa',
        diagnosis: 'Zakażenie wirusowe',
        notes: 'Zwolnienie od lekarza POZ',
      };

      const sanitized = VaultService.sanitizeForPublicSchedule(scheduleRecord, 'ZWOLNIENIE_LEKARSKIE');
      assert.equal(sanitized.shift_code, 'ZWOLNIENIE_LEKARSKIE');
      assert.equal(sanitized.hourly_rate, undefined);
      assert.equal(sanitized.monthly_salary, undefined);
      assert.equal(sanitized.medical_l4, undefined);
      assert.equal(sanitized.diagnosis, undefined);
      assert.equal(sanitized.notes, undefined);
      assert.equal(sanitized.employee_name, 'Adam Barista');
      assert.equal(sanitized.hours, 8.0);
    });

    // 2.3 unpackageGenericVault Mismatch & Checksum Tampering Rejection
    await t.test('2.3 unpackageGenericVault rejects tenant mismatch, vaultType mismatch, and tampered checksum', async () => {
      const payload: FinancialVaultPayload = {
        period: 'month_2026_10',
        aopPlans: [{ key: 'k1', year: 2026, month: '10', month_code: '10', plan_trx: 20000, target_tplh: 9.5, labor_budget: 150000, avg_weekly_hours: 160, plan_sales: 800000, actual_sales: null, actual_trx: null, actual_tplh: null, plan_agc: null, actual_agc: null, plan_col_pln: null, plan_col_percent: null, plan_cos_pln: null, plan_cos_percent: null, plan_ops_profit: null }],
      };

      const pkg = await VaultService.packageFinancialVault(storeId, unitCode, 'month_2026_10', payload);
      assert.ok(pkg.success);

      // 1. Tenant mismatch
      await assert.rejects(
        () => VaultService.unpackageFinancialVault(pkg.doc, 'foreign_store_999', unitCode),
        /Tenant storeId mismatch/i
      );

      // 2. VaultType mismatch
      await assert.rejects(
        () => VaultService.unpackagePersonnelVault(pkg.doc, storeId, unitCode),
        /VaultType mismatch/i
      );

      // 3. Tampered checksum in header (payload unchanged, but header checksum forged)
      const tamperedDoc: EncryptedVaultDocument = {
        ...pkg.doc,
        checksum: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      };
      await assert.rejects(
        () => VaultService.unpackageFinancialVault(tamperedDoc, storeId, unitCode),
        /Checksum mismatch/i
      );
    });

    // 2.4 toJSON bandwidth protection
    await t.test('2.4 EncryptedVaultDocument toJSON masks encryptedPayload from wire serialization', async () => {
      const payload: PersonnelVaultPayload = {
        staffGroup: 'managers',
        managers: [{ id: 1, name: 'Anna SM', role: 'SM', contract_type: 'UoP', contract_hours_ratio: 1.0, hourly_rate: 45.0, monthly_salary: 7500.0, sort_order: 1, is_active: 1 }],
      };

      const pkg = await VaultService.packagePersonnelVault(storeId, unitCode, 'managers', 'doc_mgr', payload);
      const jsonString = JSON.stringify(pkg.doc);
      const parsedJson = JSON.parse(jsonString);

      assert.equal(parsedJson.encryptedPayload, undefined, 'toJSON must omit redundant encryptedPayload');
      assert.ok(parsedJson.ciphertext, 'toJSON must include raw base64 ciphertext');
      assert.ok(parsedJson.iv, 'toJSON must include raw base64 iv');
      assert.ok(parsedJson.tag, 'toJSON must include raw base64 tag');
    });
  });

  // =========================================================================================
  // 3. BI-DIRECTIONAL PARITY VERIFICATION HARDENING (parityVerificationService.ts)
  // =========================================================================================
  await suite.test('3. Bi-Directional Parity Verification Hardening & Drift Analysis', async (t) => {
    const service = new ParityVerificationService();

    // 3.1 Primitive Row Values & Non-Object Row Handling
    await t.test('3.1 compareDatasets handles tables with primitive values and null rows', async () => {
      const local = {
        tags: ['tag1', 'tag2', null as any],
      };
      const cloudMatch = {
        tags: ['tag1', 'tag2', null as any],
      };
      const cloudMismatch = {
        tags: ['tag1', 'tag_altered', null as any],
      };

      const matchReport = await service.compareDatasets(storeId, local, cloudMatch, unitCode);
      assert.equal(matchReport.isParityVerified, true);
      assert.ok(matchReport.certificate);

      const mismatchReport = await service.compareDatasets(storeId, local, cloudMismatch, unitCode);
      assert.equal(mismatchReport.isParityVerified, false);
      const primMismatch = mismatchReport.mismatches.find((m) => m.reason.includes('Primitive value mismatch'));
      assert.ok(primMismatch);
      assert.equal(primMismatch?.localValue, 'tag2');
      assert.equal(primMismatch?.cloudValue, 'tag_altered');
    });

    // 3.2 Numeric IEEE 754 Drift & String vs Number Type Mismatch
    await t.test('3.2 compareDatasets detects strict numeric IEEE 754 precision drift and type mismatches', async () => {
      const local = {
        kpi: [{ id: 'k1', rate: 10.5, count: 50 }],
      };
      const cloudPrecisionDrift = {
        kpi: [{ id: 'k1', rate: 10.5000000000001, count: 50 }],
      };
      const cloudTypeDrift = {
        kpi: [{ id: 'k1', rate: 10.5, count: '50' as any }],
      };

      const reportFloat = await service.compareDatasets(storeId, local, cloudPrecisionDrift, unitCode);
      assert.equal(reportFloat.isParityVerified, false);
      assert.ok(reportFloat.mismatches.some((m) => m.reason.includes('Numeric value mismatch')));

      const reportType = await service.compareDatasets(storeId, local, cloudTypeDrift, unitCode);
      assert.equal(reportType.isParityVerified, false);
      assert.ok(reportType.mismatches.some((m) => m.reason.includes('Data type mismatch')));
    });

    // 3.3 Deep Object Structure and Array Ordering In Row Fields
    await t.test('3.3 compareDatasets detects deep nested object mismatches and internal array order drift', async () => {
      const local = {
        skills: [{ id: 1, details: { grades: [100, 95], status: { verified: true } } }],
      };
      const cloudFlippedArray = {
        skills: [{ id: 1, details: { grades: [95, 100], status: { verified: true } } }],
      };

      const report = await service.compareDatasets(storeId, local, cloudFlippedArray, unitCode);
      assert.equal(report.isParityVerified, false);
      assert.ok(report.mismatches.some((m) => m.reason.includes("Field 'details' value mismatch")));
    });

    // 3.4 Missing Rows vs Extra Rows at Tail
    await t.test('3.4 compareDatasets pinpoints extra records in cloud and missing records in cloud', async () => {
      const local = {
        shifts: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
      };
      const cloudShorter = {
        shifts: [{ id: 's1' }],
      };
      const cloudLonger = {
        shifts: [{ id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4_extra' }],
      };

      const reportShorter = await service.compareDatasets(storeId, local, cloudShorter, unitCode);
      assert.equal(reportShorter.isParityVerified, false);
      assert.ok(reportShorter.mismatches.some((m) => m.reason.includes('Missing record in cloud at index 1')));
      assert.ok(reportShorter.mismatches.some((m) => m.reason.includes('Missing record in cloud at index 2')));

      const reportLonger = await service.compareDatasets(storeId, local, cloudLonger, unitCode);
      assert.equal(reportLonger.isParityVerified, false);
      assert.ok(reportLonger.mismatches.some((m) => m.reason.includes('Extra record in cloud at index 3')));
    });

    // 3.5 Cryptographic Certificate Signature Formula & Secret Key
    await t.test('3.5 ParityCertificate signature formula conforms to HMAC-SHA256(secret, payload)', async () => {
      const customSecret = 'my_custom_production_audit_secret_key_123';
      const customService = new ParityVerificationService({ customSecret });

      const dataset = {
        sample: [{ id: 1, val: 'ok' }],
      };

      const report = await customService.compareDatasets(storeId, dataset, dataset, unitCode);
      assert.equal(report.isParityVerified, true);
      assert.ok(report.certificate);

      // Verify HMAC-SHA256 signature independently
      const expectedPayload = `${storeId}:${unitCode}:${report.localCanonicalHash}:${report.localRecordsCount}`;
      const expectedSig = crypto.createHmac('sha256', customSecret).update(expectedPayload).digest('hex');
      assert.equal(report.certificate?.signature, expectedSig, 'Certificate signature must match expected HMAC');
    });

    // 3.6 verifyStoreParity with Corrupted Vault in cloudDocuments
    await t.test('3.6 verifyStoreParity reports parity failure when a cloudDocument is corrupted or tampered', async () => {
      const localTables = {
        schedules: [{ id: 1, shiftCode: 'AM', hours: 8.0, employeeId: 10 }],
      };

      const schedRes = await VaultService.packageScheduleVault(storeId, unitCode, 'week_1', 'doc_sched', {
        weekKey: 'week_1',
        shifts: localTables.schedules,
      });

      // 1. Tamper encryptedPayload string
      const tamperedPayloadDoc = {
        ...schedRes.doc,
        encryptedPayload: schedRes.doc.encryptedPayload.slice(0, -10) + 'AAAAAAAAAA',
        ciphertext: 'corrupted',
      };

      const reportPayload = await ParityVerificationService.verifyStoreParity(storeId, {
        unitCode,
        rawTables: localTables,
        cloudDocuments: [tamperedPayloadDoc],
      });

      assert.equal(reportPayload.isParityVerified, false, 'Tampered encryptedPayload must cause verification failure');
      assert.equal(reportPayload.cloudRecordsCount, 0);
      assert.ok(reportPayload.mismatches.length > 0);

      // 2. Empty encryptedPayload and tampered ciphertext fallback
      const tamperedCipherDoc = {
        ...schedRes.doc,
        encryptedPayload: '',
        ciphertext: 'corrupted_ciphertext_data',
      };

      const reportCipher = await ParityVerificationService.verifyStoreParity(storeId, {
        unitCode,
        rawTables: localTables,
        cloudDocuments: [tamperedCipherDoc],
      });

      assert.equal(reportCipher.isParityVerified, false, 'Tampered ciphertext in fallback must cause verification failure');
      assert.equal(reportCipher.cloudRecordsCount, 0);
      assert.ok(reportCipher.mismatches.length > 0);
    });
  });

  // =========================================================================================
  // 4. CLOUD MIGRATION PIPELINE & FAULT INJECTION (cloudMigrationService.ts)
  // =========================================================================================
  await suite.test('4. Cloud Migration Pipeline & Fault Injection Hardening', async (t) => {
    // 4.1 Schema Validation Defense (validateRowSchema)
    await t.test('4.1 validateRowSchema strictly enforces types across tables and permits valid nulls', () => {
      // Nulls in aop_plans are permitted
      assert.doesNotThrow(() => {
        CloudMigrationService.validateRowSchema('aop_plans', {
          plan_trx: null,
          target_tplh: null,
        });
      });

      // Non-numbers in aop_plans throw SchemaValidationError
      assert.throws(
        () => CloudMigrationService.validateRowSchema('aop_plans', { plan_trx: '25000' }),
        /SchemaValidationError: plan_trx must be a number/i
      );
      assert.throws(
        () => CloudMigrationService.validateRowSchema('aop_plans', { target_tplh: '9.85' }),
        /SchemaValidationError: target_tplh must be a number/i
      );

      // Non-numbers in manager_employees throw SchemaValidationError
      assert.throws(
        () => CloudMigrationService.validateRowSchema('manager_employees', { hourly_rate: '45.0' }),
        /SchemaValidationError: hourly_rate must be a number/i
      );
      assert.doesNotThrow(() => {
        CloudMigrationService.validateRowSchema('manager_employees', { hourly_rate: null });
      });

      // Non-numbers in schedules/manager_schedule_shifts throw SchemaValidationError
      assert.throws(
        () => CloudMigrationService.validateRowSchema('schedules', { hour: '8' }),
        /SchemaValidationError: hour must be a number/i
      );
      assert.throws(
        () => CloudMigrationService.validateRowSchema('manager_schedule_shifts', { hours: '8.0' }),
        /SchemaValidationError: hours must be a number/i
      );
    });

    // 4.2 Batch Upload Planning Boundary Fuzzing
    await t.test('4.2 createUploadPlan partitions arbitrary document counts into batches <= MAX_DOCS_PER_BATCH', () => {
      const dummyManifest: any = {
        allDocuments: Array.from({ length: 245 }, (_, i) => ({
          vaultType: 'vault_financials',
          collection: 'vault_financials',
          docId: `doc_${i}`,
          doc: { docId: `doc_${i}` },
        })),
      };

      const plan = CloudMigrationService.createUploadPlan(dummyManifest, 100);
      assert.equal(plan.totalDocuments, 245);
      assert.equal(plan.totalBatches, 3);
      assert.equal(plan.batches[0].documents.length, 100);
      assert.equal(plan.batches[1].documents.length, 100);
      assert.equal(plan.batches[2].documents.length, 45);

      // Boundary: exactly 100 documents -> 1 batch
      const plan100 = CloudMigrationService.createUploadPlan({
        allDocuments: Array.from({ length: 100 }, (_, i) => ({ docId: `d_${i}` })),
      } as any, 100);
      assert.equal(plan100.totalBatches, 1);
      assert.equal(plan100.batches[0].documents.length, 100);

      // Boundary: 0 documents -> 0 batches
      const plan0 = CloudMigrationService.createUploadPlan({ allDocuments: [] } as any, 100);
      assert.equal(plan0.totalBatches, 0);
    });

    // 4.3 Exponential Backoff Retry Resilience
    await t.test('4.3 uploadBatches recovers from transient network failures via exponential backoff', async () => {
      let callCount = 0;
      const customFetch: any = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('ETIMEDOUT: Connection timed out');
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({}),
        };
      };

      const dummyPlan = {
        batches: [
          {
            batchIndex: 1,
            totalInBatch: 1,
            documents: [
              {
                collection: 'vault_financials',
                docId: 'doc_retry_test',
                vaultType: 'vault_financials' as any,
                doc: { docId: 'doc_retry_test' } as any,
              },
            ],
          },
        ],
        totalBatches: 1,
        totalDocuments: 1,
      };

      await CloudMigrationService.uploadBatches(dummyPlan, {
        projectId: 'test-project',
        storeId,
        maxRetries: 3,
        backoffInitialMs: 5,
        customFetch,
      });

      assert.equal(callCount, 3, 'Must have attempted 3 times and succeeded on the 3rd attempt');
    });

    // 4.4 Receipt Persistence & Sanitized File Naming
    await t.test('4.4 generateReceipt and persistReceipt sanitize file paths and write receipt to disk', () => {
      const testStoreId = 'store/special:108_160';
      const dummyManifest: any = {
        allDocuments: [
          { collection: 'vault_financials', docId: 'f1', doc: { recordCount: 10, checksum: 'hash1' } },
        ],
        totalEncryptedPayloads: 1,
      };

      const receipt = CloudMigrationService.generateReceipt({
        storeId: testStoreId,
        unitCode: '18160',
        status: 'completed',
        totalEntities: 10,
        encryptedPayloadsCount: 1,
        perTableSummary: { aop_plans: 10 },
        manifest: dummyManifest,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 120,
        batchesUploaded: 1,
      });

      assert.ok(receipt.migrationId.startsWith('mig_store/special:108_160_'));
      assert.equal(receipt.totalRecords, 10);

      const receiptPath = CloudMigrationService.persistReceipt(testStoreId, receipt);
      assert.ok(receiptPath);
      assert.ok(receiptPath.includes('migration_receipt_store_special_108_160.json'), 'Path must sanitize special characters');
      assert.ok(fs.existsSync(receiptPath));

      const retrieved = CloudMigrationService.getSavedReceipt(testStoreId);
      assert.ok(retrieved);
      assert.equal(retrieved?.storeId, testStoreId);
      assert.equal(retrieved?.totalRecords, 10);

      // Cleanup
      try { fs.unlinkSync(receiptPath); } catch (_) {}
    });
  });

  // =========================================================================================
  // 5. DATABASE CONNECTION POOL, MUTEX & BACKUPS (db.ts & backupManager.ts)
  // =========================================================================================
  await suite.test('5. Database Manager, LRU Pool, Mutex & Backup Isolation', async (t) => {
    // 5.1 AsyncMutex Strict Serialization & Fault Recovery
    await t.test('5.1 AsyncMutex guarantees sequential execution under high concurrency and recovers on error', async () => {
      const mutex = new AsyncMutex();
      const executionTrace: number[] = [];
      let activeExecutions = 0;
      let maxConcurrent = 0;

      const runTask = async (id: number, delayMs: number) => {
        return mutex.runExclusive(async () => {
          activeExecutions++;
          maxConcurrent = Math.max(maxConcurrent, activeExecutions);
          await new Promise((r) => setTimeout(r, delayMs));
          executionTrace.push(id);
          activeExecutions--;
          return id;
        });
      };

      // Launch 20 concurrent tasks
      const promises = Array.from({ length: 20 }, (_, i) => runTask(i, 5));
      await Promise.all(promises);

      assert.equal(maxConcurrent, 1, 'Max concurrent executions must be exactly 1');
      assert.equal(executionTrace.length, 20);

      // Mutex fault recovery: exception inside runExclusive must not deadlock subsequent callers
      await assert.rejects(
        () => mutex.runExclusive(async () => { throw new Error('TaskFailed'); }),
        /TaskFailed/
      );

      // Subsequent task runs smoothly
      const nextResult = await mutex.runExclusive(async () => 'recovered');
      assert.equal(nextResult, 'recovered');
    });

    // 5.2 StoreConnectionPool LRU Eviction & Dirty Flush
    await t.test('5.2 StoreConnectionPool enforces max 8 handles and flushes dirty writes before eviction', async () => {
      const pool = new StoreConnectionPool(8);
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_pool_test_'));
      const SQL = await initSqlJs();

      try {
        // Create 9 mock databases
        const dbs: { storeId: string; filePath: string; db: any }[] = [];
        for (let i = 1; i <= 9; i++) {
          const sId = `store_${i}`;
          const fPath = path.join(tempDir, `${sId}.db`);
          const dbInstance = new SQL.Database();
          dbInstance.run('CREATE TABLE test (id INT); INSERT INTO test VALUES (1);');
          fs.writeFileSync(fPath, Buffer.from(dbInstance.export()));
          dbs.push({ storeId: sId, filePath: fPath, db: dbInstance });
        }

        // Add 8 stores, mark store_1 dirty with new data
        for (let i = 0; i < 8; i++) {
          pool.put(dbs[i].storeId, dbs[i].db, dbs[i].filePath, false);
        }
        assert.equal(pool.size(), 8);

        // Mutate store_1 in memory and mark dirty
        dbs[0].db.run('INSERT INTO test VALUES (2);');
        const entry1 = pool.getEntry('store_1')!;
        entry1.isDirty = true;
        // Access stores 2..8 and set lastAccessed to 0 so store_1 is deterministically the LRU candidate
        for (let i = 1; i < 8; i++) {
          pool.get(dbs[i].storeId);
        }
        entry1.lastAccessed = 0;

        // Adding 9th store must evict store_1 (oldest accessed)
        const evictionResult = pool.put(dbs[8].storeId, dbs[8].db, dbs[8].filePath, false);
        assert.equal(evictionResult.evicted, 'store_1');
        assert.equal(evictionResult.flushed, true, 'Evicted dirty store must be flushed to disk');
        assert.equal(pool.size(), 8);

        // Verify disk content of store_1 has the flushed second row
        const diskBuf = fs.readFileSync(dbs[0].filePath);
        const reloadedDb = new SQL.Database(diskBuf);
        const stmt = reloadedDb.prepare('SELECT COUNT(*) as count FROM test');
        stmt.step();
        assert.equal(stmt.getAsObject().count, 2, 'Flushed data must be persisted on disk');
        stmt.free();
        reloadedDb.close();

        pool.closeAll();
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    // 5.3 computeDbFilePath Path Traversal Defense & Alias Resolution
    await t.test('5.3 computeDbFilePath truncates long IDs and neutralizes directory traversal', () => {
      const dbMgr = new DatabaseManager('/tmp/sbx_test_dir');

      // Traversal attempt
      const traversalPath = dbMgr.computeDbFilePath('../../../etc/passwd');
      assert.ok(!traversalPath.includes('..'), 'Must not contain directory traversal segments');
      assert.ok(path.basename(traversalPath).startsWith('store_'), 'Must retain store_ prefix');

      // Truncation to 64 chars
      const giantId = 'a'.repeat(128);
      const truncatedPath = dbMgr.computeDbFilePath(giantId);
      const filename = path.basename(truncatedPath);
      // 'store_' (6) + 64 + '.db' (3) = 73
      assert.ok(filename.length <= 73, `Filename length must be <= 73 chars (got ${filename.length})`);

      // Janki alias resolution
      assert.equal(path.basename(dbMgr.computeDbFilePath('108120_janki')), 'store_108120.db');
      assert.equal(path.basename(dbMgr.computeDbFilePath('any_store', { unitCode: '18120' })), 'store_108120.db');
      assert.equal(path.basename(dbMgr.computeDbFilePath('any_store', { mpk: '108120' })), 'store_108120.db');
    });

    // 5.4 validateRestoreTarget & inspectBackupBuffer
    await t.test('5.4 validateRestoreTarget and inspectBackupBuffer prevent cross-store restore and reject bad headers', async () => {
      // 1. Filename validation
      assert.equal(validateRestoreTarget('store_108150_backup_2026-10-24_12-00-00_000_manual.db', '108150'), true);
      assert.equal(validateRestoreTarget('store_108150_backup_2026-10-24_12-00-00_000_manual.db', '108160'), false);
      assert.equal(validateRestoreTarget('store_108120_backup_2026-10-24_manual.db', '18120'), true, 'Janki unitCode alias');
      assert.equal(validateRestoreTarget('store_18120_backup_2026-10-24_manual.db', '108120_janki'), true, 'Janki name alias');
      assert.equal(validateRestoreTarget('not_a_backup.db', '108150'), false);
      assert.equal(validateRestoreTarget('', '108150'), false);

      // 2. Buffer inspection
      const backupMgr = new BackupManager('/tmp/sbx_backup_test');
      const badBuffer = Buffer.from('not an sqlite database file');
      const badInspection = await backupMgr.inspectBackupBuffer(badBuffer, '108150');
      assert.equal(badInspection.isValid, false);
      assert.ok(badInspection.error?.includes('SQLite format 3'));

      // Truncated buffer (< 100 bytes)
      const truncatedBuf = Buffer.alloc(50);
      const truncInspection = await backupMgr.inspectBackupBuffer(truncatedBuf, '108150');
      assert.equal(truncInspection.isValid, false);
    });

    // 5.5 Backup Rotation Store Partitioning
    await t.test('5.5 rotateBackupsForStore rotates only the specified store and preserves other stores', () => {
      const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_backup_rot_test_'));
      const backupMgr = new BackupManager(backupDir);

      try {
        // Create 18 backups for store_A and 5 backups for store_B
        const now = Date.now();
        for (let i = 1; i <= 18; i++) {
          const fname = `store_storea_backup_2026-10-24_12-00-${String(i).padStart(2, '0')}_000_manual.db`;
          const fpath = path.join(backupDir, fname);
          fs.writeFileSync(fpath, 'dummy db content');
          // Adjust mtime so ordering is deterministic
          fs.utimesSync(fpath, new Date(now + i * 1000), new Date(now + i * 1000));
        }

        for (let i = 1; i <= 5; i++) {
          const fname = `store_storeb_backup_2026-10-24_12-00-${String(i).padStart(2, '0')}_000_manual.db`;
          const fpath = path.join(backupDir, fname);
          fs.writeFileSync(fpath, 'dummy db content');
        }

        assert.equal(backupMgr.listBackups('storea').length, 18);
        assert.equal(backupMgr.listBackups('storeb').length, 5);

        // Rotate storeA to max 15
        const deleted = backupMgr.rotateBackupsForStore('storea', 15);
        assert.equal(deleted, 3, 'Must delete exactly 3 oldest backups for storeA');

        assert.equal(backupMgr.listBackups('storea').length, 15);
        assert.equal(backupMgr.listBackups('storeb').length, 5, 'storeB backups must remain completely intact');
      } finally {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }
    });
  });
});
