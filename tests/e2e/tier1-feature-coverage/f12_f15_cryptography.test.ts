/**
 * Starbucks Operations Suite — Comprehensive Cryptographic Unit Test Suite (Features F12 & F15)
 *
 * Verifies:
 * 1. Full round-trip AES-256-GCM encryption & decryption fidelity (nested payloads, Polish unicode, numeric bounds).
 * 2. Decryption failure & tamper detection on corrupted ciphertext (bit flips & truncation).
 * 3. Decryption failure on corrupted or truncated 128-bit authentication tag.
 * 4. Decryption failure on tampered AAD context binding (mismatched storeId, vaultType, docId).
 * 5. PBKDF2 600,000 iterations key derivation uniqueness across storeId and unitCode boundaries.
 * 6. Canonical string envelope serialization/deserialization (`enc:v1:...`) and malformed envelope rejection.
 * 7. Performance benchmark: 100 round-trip encryptions execute in < 200ms with in-memory key caching.
 * 8. End-to-end VaultService packaging, classification, and unpackaging across all 5 Firestore vault collections.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  deriveStoreKeySync,
  deriveStoreKey,
  encryptPayloadSync,
  decryptPayloadSync,
  encryptPayload,
  decryptPayload,
  serializeEnvelope,
  parseEnvelope,
  canonicalJson,
  canonicalSha256,
  StoreKeyCache,
} from '../../../src/services/security/encryptionService';
import type { EncryptedEnvelope } from '../../../src/services/security/encryptionService';
import {
  VaultService,
} from '../../../src/services/security/vaultService';
import type {
  FinancialVaultPayload,
  PersonnelVaultPayload,
  ScheduleVaultPayload,
  HealthGdprVaultPayload,
} from '../../../src/services/security/vaultService';

test('F12/F15: Comprehensive Cryptographic Test Suite', async (t) => {
  const storeId = '108150';
  const unitCode = '18150';
  const vaultType = 'vault_financials';
  const docId = 'month_2026_03';

  // Test 1: Full round-trip encrypt and decrypt for complex nested objects, Polish unicode strings, and binary numbers
  await t.test('Test 1: Full round-trip encrypt and decrypt for complex nested objects, Polish unicode, and numbers', async () => {
    const complexPayload = {
      metadata: {
        storeName: '108150 SBX Warszawa Janki',
        city: 'Warszawa',
        district: 'Dystrykt Mazowsze',
        currency: 'PLN',
        isMallLocation: true,
        tags: ['drive-thru', 'flagship', '24h'],
      },
      polishDiacritics: {
        proverb: 'Zażółć gęślą jaźń',
        employees: [
          'Michał Brzęczyszczykiewicz',
          'Stanisław Żółkiewski',
          'Grażyna Łączkowska',
          'Józef Piłsudski',
        ],
        legalNotice: 'Koszty pracy P&L (wynagrodzenia zasadnicze + narzuty ZUS 19.48% + ekwiwalenty odzieżowe 0.85 zł/h)',
      },
      numericExtremes: {
        zero: 0,
        floatValue: 142500.55,
        negativeAdjustment: -350.25,
        subCent: 0.0001,
        maxSafeInt: Number.MAX_SAFE_INTEGER,
        minSafeInt: Number.MIN_SAFE_INTEGER,
      },
      deepHierarchy: {
        level1: {
          level2: {
            level3: {
              active: true,
              nullField: null,
              emptyList: [],
              emptyMap: {},
              roster: [
                { id: 'mgr_1', rate: 45.5, bonusEligible: true },
                { id: 'barista_1', rate: 30.5, bonusEligible: false },
              ],
            },
          },
        },
      },
    };

    // 5-arg sync invocation
    const envelope = encryptPayloadSync(complexPayload, storeId, unitCode, vaultType, docId);
    assert.equal(envelope.version, 'v1');
    assert.equal(envelope.storeId, storeId);
    assert.ok(envelope.ciphertext.length > 0);

    const decrypted = decryptPayloadSync(envelope, storeId, unitCode, vaultType, docId);
    assert.deepEqual(decrypted, complexPayload);

    // 4-arg async invocation
    const asyncEnv = await encryptPayload(complexPayload, storeId, vaultType, docId);
    const asyncDec = await decryptPayload(asyncEnv, storeId, vaultType, docId);
    assert.deepEqual(asyncDec, complexPayload);
  });

  // Test 2: Decryption failure on corrupted ciphertext (verifying GCM AEAD tag check)
  await t.test('Test 2: Decryption failure on corrupted ciphertext (GCM AEAD tag check)', () => {
    const envelope = encryptPayloadSync({ sensitiveData: 'top_secret_financials' }, storeId, unitCode, vaultType, docId);
    const rawCipher = Buffer.from(envelope.ciphertext, 'base64');

    // Flip bit in the first byte
    rawCipher[0] ^= 0x01;
    const tamperedEnvelope: EncryptedEnvelope = {
      ...envelope,
      ciphertext: rawCipher.toString('base64'),
      serialized: `enc:v1:${storeId}:${envelope.keyId}:${envelope.iv}:${envelope.tag}:${rawCipher.toString('base64')}`,
    };

    assert.throws(
      () => decryptPayloadSync(tamperedEnvelope, storeId, unitCode, vaultType, docId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );

    // Truncate ciphertext by 1 byte
    const truncatedCipher = rawCipher.subarray(0, rawCipher.length - 1);
    const truncatedEnvelope: EncryptedEnvelope = {
      ...envelope,
      ciphertext: truncatedCipher.toString('base64'),
      serialized: `enc:v1:${storeId}:${envelope.keyId}:${envelope.iv}:${envelope.tag}:${truncatedCipher.toString('base64')}`,
    };
    assert.throws(
      () => decryptPayloadSync(truncatedEnvelope, storeId, unitCode, vaultType, docId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );
  });

  // Test 3: Decryption failure on corrupted auth tag
  await t.test('Test 3: Decryption failure on corrupted auth tag', () => {
    const envelope = encryptPayloadSync({ data: 'payroll_records' }, storeId, unitCode, vaultType, docId);
    const rawTag = Buffer.from(envelope.tag, 'base64');

    // Flip bits in the authentication tag
    rawTag[rawTag.length - 1] ^= 0xff;
    const tamperedTagEnvelope: EncryptedEnvelope = {
      ...envelope,
      tag: rawTag.toString('base64'),
      serialized: `enc:v1:${storeId}:${envelope.keyId}:${envelope.iv}:${rawTag.toString('base64')}:${envelope.ciphertext}`,
    };

    assert.throws(
      () => decryptPayloadSync(tamperedTagEnvelope, storeId, unitCode, vaultType, docId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );

    // Corrupted tag length (15 bytes instead of 16 bytes)
    const shortTag = rawTag.subarray(0, 15);
    const shortTagEnvelope: EncryptedEnvelope = {
      ...envelope,
      tag: shortTag.toString('base64'),
      serialized: `enc:v1:${storeId}:${envelope.keyId}:${envelope.iv}:${shortTag.toString('base64')}:${envelope.ciphertext}`,
    };
    assert.throws(
      () => decryptPayloadSync(shortTagEnvelope, storeId, unitCode, vaultType, docId),
      /Invalid authentication tag length|Unsupported state/i
    );
  });

  // Test 4: Decryption failure on tampered AAD context (e.g. wrong storeId, wrong vaultType, or wrong docId)
  await t.test('Test 4: Decryption failure on tampered AAD context (wrong storeId, vaultType, docId)', () => {
    const envelope = encryptPayloadSync({ plAmount: 180000 }, storeId, unitCode, vaultType, docId);

    // Tampered docId
    assert.throws(
      () => decryptPayloadSync(envelope, storeId, unitCode, vaultType, 'month_2026_04'),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );

    // Tampered vaultType
    assert.throws(
      () => decryptPayloadSync(envelope, storeId, unitCode, 'vault_personnel', docId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );

    // Tampered storeId in AAD (with matching storeId in envelope)
    assert.throws(
      () => decryptPayloadSync({ ...envelope, storeId: '108151' }, '108151', unitCode, vaultType, docId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );
  });

  // Test 5: Key derivation uniqueness: different storeId or unitCode produces different derived keys and cannot decrypt
  await t.test('Test 5: Key derivation uniqueness across storeId and unitCode boundaries', () => {
    const key1 = deriveStoreKeySync('108150', '18150');
    const key2 = deriveStoreKeySync('108151', '18151');
    const key3 = deriveStoreKeySync('108150', '18151');
    const key4 = deriveStoreKeySync('108152', '18150');

    assert.equal(key1.length, 32);
    assert.equal(key2.length, 32);
    assert.equal(key3.length, 32);
    assert.equal(key4.length, 32);

    assert.notDeepEqual(key1, key2, 'Different storeId and unitCode must yield distinct keys');
    assert.notDeepEqual(key1, key3, 'Different unitCode must yield distinct keys');
    assert.notDeepEqual(key1, key4, 'Different storeId must yield distinct keys');

    // Encrypt with Store A, attempt decrypt with Store B unitCode
    const envelope = encryptPayloadSync({ aopSales: 350000 }, '108150', '18150', vaultType, docId);
    assert.throws(
      () => decryptPayloadSync(envelope, '108150', '18151', vaultType, docId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );
  });

  // Test 6: String serialization and deserialization (enc:v1:...)
  await t.test('Test 6: String serialization and deserialization (enc:v1:...)', () => {
    const envelope = encryptPayloadSync({ token: 'sbx_auth_xyz' }, storeId, unitCode, vaultType, docId);
    const serialized = envelope.serialized;

    // Verify canonical prefix and token count
    const parts = serialized.split(':');
    assert.equal(parts.length, 7);
    assert.equal(parts[0], 'enc');
    assert.equal(parts[1], 'v1');
    assert.equal(parts[2], storeId);
    assert.equal(parts[3], 'k1');
    assert.equal(parts[4], envelope.iv);
    assert.equal(parts[5], envelope.tag);
    assert.equal(parts[6], envelope.ciphertext);

    // Decrypt directly from serialized string
    const decryptedFromString = decryptPayloadSync(serialized, storeId, unitCode, vaultType, docId);
    assert.deepEqual(decryptedFromString, { token: 'sbx_auth_xyz' });

    // Malformed envelope strings rejection
    const invalidFormats = [
      '',
      'plain:text',
      'enc:v2:store:key:iv:tag:cipher', // unsupported version
      'enc:v1:store:key:iv:tag', // missing ciphertext token
      `enc:v1:999999:k1:${parts[4]}:${parts[5]}:${parts[6]}`, // mismatched storeId
    ];

    for (const badFormat of invalidFormats) {
      assert.throws(
        () => decryptPayloadSync(badFormat, storeId, unitCode, vaultType, docId),
        /Malformed envelope format|Store ID mismatch/i
      );
    }
  });

  // Test 7: Performance benchmark: 100 round-trip encryptions execute in < 200ms
  await t.test('Test 7: Performance benchmark: 100 round-trip encryptions execute in < 200ms', () => {
    // Warm up key cache for storeId / unitCode
    deriveStoreKeySync(storeId, unitCode);

    const iterations = 100;
    const testData = {
      period: '2026-10',
      totalRevenue: 284500.75,
      laborCostTotal: 58240.12,
      hourlyRates: [32.5, 34.0, 31.8, 38.5, 42.0],
      note: 'Zażółć gęślą jaźń — test benchmark',
    };

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const iterationDocId = `benchmark_doc_${i}`;
      const env = encryptPayloadSync(testData, storeId, unitCode, vaultType, iterationDocId);
      const dec = decryptPayloadSync(env, storeId, unitCode, vaultType, iterationDocId);
      assert.equal(dec.totalRevenue, testData.totalRevenue);
    }

    const elapsedMs = performance.now() - startTime;
    console.log(`[BENCHMARK] 100 round-trip AES-256-GCM encryptions + decryptions took: ${elapsedMs.toFixed(2)} ms`);

    assert.ok(
      elapsedMs < 200,
      `Performance benchmark failed: 100 round-trip operations took ${elapsedMs.toFixed(2)} ms, expected < 200 ms`
    );
  });

  // Test 8: VaultService Packaging, Classification & Unpackaging Pipelines
  await t.test('Test 8: VaultService packaging, classification & unpackaging across 5 vault subcollections', async () => {
    // 1. Classification rules
    const plRule = VaultService.classifyField('aop_plans', 'plan_sales');
    assert.equal(plRule.tier, 'TIER_1_FINANCIAL');
    assert.equal(plRule.targetVault, 'vault_financials');
    assert.equal(plRule.requiresEncryption, true);

    const salaryRule = VaultService.classifyField('manager_employees', 'monthly_salary');
    assert.equal(salaryRule.tier, 'TIER_2_HR_GDPR');
    assert.equal(salaryRule.targetVault, 'vault_personnel');
    assert.equal(salaryRule.requiresEncryption, true);

    const l4Rule = VaultService.classifyField('manager_schedule_shifts', 'shift_code_medical_l4');
    assert.equal(l4Rule.tier, 'TIER_2_HR_GDPR');
    assert.equal(l4Rule.targetVault, 'vault_health_gdpr');
    assert.equal(l4Rule.requiresEncryption, true);

    const telemetryRule = VaultService.classifyField('calendar_weeks', 'week_key');
    assert.equal(telemetryRule.tier, 'TIER_3_PUBLIC_ROUTING');
    assert.equal(telemetryRule.requiresEncryption, false);

    // 2. Sensitive fields detection & sanitization
    assert.equal(VaultService.containsSensitiveFields({ a: { salary: 5000 } }), true);
    assert.equal(VaultService.containsSensitiveFields({ a: { is_active: 1 } }), false);

    const sanitized = VaultService.sanitizeForPublicSchedule({
      employee_id: 1,
      name: 'Jan Kowalski',
      shift_code: 'L4',
      hourly_rate: 35.0,
      notes: 'Doctor sick leave',
    });
    assert.equal(sanitized.shift_code, 'ABSENCE');
    assert.equal(sanitized.hourly_rate, undefined);
    assert.equal(sanitized.notes, undefined);
    assert.equal(sanitized.name, 'Jan Kowalski');

    // 3. Financial Vault packaging & unpackaging
    const finPayload: FinancialVaultPayload = {
      period: 'month_2026_03',
      aopPlans: [
        {
          key: '2026_M03',
          year: 2026,
          month: 'Marzec',
          month_code: 'M03',
          plan_trx: 28400,
          target_tplh: 12.5,
          labor_budget: 2272,
          avg_weekly_hours: 568,
          plan_sales: 384000,
          actual_sales: 391200,
          actual_trx: 28900,
          actual_tplh: 12.8,
          plan_agc: 13.52,
          actual_agc: 13.54,
          plan_col_pln: 98000,
          plan_col_percent: 25.5,
          plan_cos_pln: 110000,
          plan_cos_percent: 28.6,
          plan_ops_profit: 45000,
        },
      ],
      colSummary: { totalCOLPercent: 25.4, zusPLN: 19088 },
    };

    const finPkg = await VaultService.packageFinancialVault(storeId, unitCode, 'month_2026_03', finPayload);
    assert.equal(finPkg.success, true);
    assert.equal(finPkg.doc.vaultType, 'vault_financials');
    assert.ok(typeof finPkg.doc.encryptedPayload === 'string');

    const finUnpkg = await VaultService.unpackageFinancialVault(finPkg.doc, storeId, unitCode);
    assert.equal(finUnpkg.success, true);
    assert.equal(finUnpkg.metrics.checksumVerified, true);
    assert.deepEqual(finUnpkg.payload, finPayload);

    // 4. Personnel Vault packaging & unpackaging
    const persPayload: PersonnelVaultPayload = {
      staffGroup: 'active_roster',
      managers: [
        {
          id: 1,
          name: 'Kierownik Jan',
          role: 'STORE_MANAGER',
          contract_type: 'FULL',
          contract_hours_ratio: 1.0,
          hourly_rate: 45.0,
          monthly_salary: 7500.0,
          sort_order: 1,
          is_active: 1,
        },
      ],
      crewUop: [
        {
          id: 'uop_1',
          name: 'Barista Anna',
          position: 'BARISTA',
          contractRatio: 0.75,
          hourlyRate: 31.5,
          planWorkHours: 126,
          isDisability: false,
        },
      ],
    };

    const persPkg = await VaultService.packagePersonnelVault(storeId, unitCode, 'active_roster', 'roster_2026_03', persPayload);
    assert.equal(persPkg.success, true);
    const persUnpkg = await VaultService.unpackagePersonnelVault(persPkg.doc, storeId, unitCode);
    assert.equal(persUnpkg.metrics.checksumVerified, true);
    assert.deepEqual(persUnpkg.payload, persPayload);

    // 5. Schedule Vault packaging & unpackaging
    const schedPayload: ScheduleVaultPayload = {
      weekKey: '2026_Wrzesień_W1',
      shifts: [
        {
          year: 2026,
          month: 9,
          day: 1,
          date: '2026-09-01',
          employee_id: 1,
          shift_code: 'AM',
          hours: 8.0,
        },
      ],
    };

    const schedPkg = await VaultService.packageScheduleVault(storeId, unitCode, '2026_Wrzesień_W1', 'week_w1', schedPayload);
    assert.equal(schedPkg.success, true);
    const schedUnpkg = await VaultService.unpackageScheduleVault(schedPkg.doc, storeId, unitCode);
    assert.equal(schedUnpkg.metrics.checksumVerified, true);
    assert.deepEqual(schedUnpkg.payload, schedPayload);

    // 6. Health & GDPR Vault packaging & unpackaging
    const healthPayload: HealthGdprVaultPayload = {
      period: '2026_Q1',
      l4MedicalAbsences: [
        {
          employeeId: 1,
          employeeName: 'Barista Anna',
          date: '2026-02-14',
          shiftCode: 'L4',
          hours: 8.0,
          notes: 'Zwolnienie lekarskie e-ZLA',
        },
      ],
    };

    const healthPkg = await VaultService.packageHealthGdprVault(storeId, unitCode, '2026_Q1', 'health_q1', healthPayload);
    assert.equal(healthPkg.success, true);
    const healthUnpkg = await VaultService.unpackageHealthGdprVault(healthPkg.doc, storeId, unitCode);
    assert.equal(healthUnpkg.metrics.checksumVerified, true);
    assert.deepEqual(healthUnpkg.payload, healthPayload);

    // 7. Telemetry Status builder
    const telemetry = VaultService.buildTelemetryStatus({
      storeId,
      unitCode,
      storeName: 'SBX Janki',
      vaultStats: {
        financialsRecordsCount: 1,
        financialsLastChecksum: finPkg.doc.checksum,
        personnelRecordsCount: 2,
        personnelLastChecksum: persPkg.doc.checksum,
        schedulesRecordsCount: 1,
        schedulesLastChecksum: schedPkg.doc.checksum,
        healthGdprRecordsCount: 1,
        healthGdprLastChecksum: healthPkg.doc.checksum,
      },
      localDatabaseHealth: {
        integrity: 'ok',
        totalTables: 19,
        totalLocalRecords: 120,
        dbSizeBytes: 65536,
      },
    });
    assert.equal(telemetry.storeId, storeId);
    assert.equal(telemetry.unitCode, unitCode);
    assert.equal(telemetry.localDatabaseHealth.integrity, 'ok');
  });

  // Test 9: Canonical JSON edge cases (undefined omission, array null conversion, Date ISO serialization)
  await t.test('Test 9: Canonical JSON edge cases (undefined, Date, array nulls)', () => {
    // 1. Undefined property in object must be omitted
    const objWithUndef = { b: 2, a: undefined, c: 'valid' };
    const serializedObj = canonicalJson(objWithUndef);
    assert.equal(serializedObj, '{"b":2,"c":"valid"}');
    assert.deepEqual(JSON.parse(serializedObj), { b: 2, c: 'valid' });

    // 2. Undefined in array must serialize to null
    const arrWithUndef = [1, undefined, 'text', null];
    const serializedArr = canonicalJson(arrWithUndef);
    assert.equal(serializedArr, '[1,null,"text",null]');
    assert.deepEqual(JSON.parse(serializedArr), [1, null, 'text', null]);

    // 3. Date instance must serialize to ISO string
    const testDate = new Date('2026-03-01T14:30:00.000Z');
    const serializedDate = canonicalJson(testDate);
    assert.equal(serializedDate, '"2026-03-01T14:30:00.000Z"');

    // 4. Nested complex structure with mixed edge cases
    const complexStructure = {
      timestamp: testDate,
      optionalNote: undefined,
      items: [100, undefined, 200],
      nestedObj: {
        active: true,
        skipped: undefined,
      },
    };
    const serializedComplex = canonicalJson(complexStructure);
    const parsedComplex = JSON.parse(serializedComplex);
    assert.equal(parsedComplex.timestamp, '2026-03-01T14:30:00.000Z');
    assert.equal('optionalNote' in parsedComplex, false);
    assert.deepEqual(parsedComplex.items, [100, null, 200]);
    assert.deepEqual(parsedComplex.nestedObj, { active: true });
  });

  // Test 10: StoreKeyCache memory hygiene & buffer zeroization
  await t.test('Test 10: StoreKeyCache zeroization on invalidation and clear', () => {
    const testStoreId = '108198';
    const testUnitCode = '18198';
    const testPassHash = 'test_hash_01';

    const secretKeyBuf = Buffer.alloc(32, 0x42);
    StoreKeyCache.set(testStoreId, testUnitCode, testPassHash, secretKeyBuf);

    assert.equal(StoreKeyCache.get(testStoreId, testUnitCode, testPassHash)?.equals(Buffer.alloc(32, 0x42)), true);

    // Invalidate store -> buffer must be zeroized
    StoreKeyCache.invalidateStore(testStoreId);
    assert.equal(secretKeyBuf.equals(Buffer.alloc(32, 0x00)), true, 'Evicted buffer must be zero-filled');
    assert.equal(StoreKeyCache.get(testStoreId, testUnitCode, testPassHash), null);
  });

  // Test 11: Electron IPC key derivation integration & caching
  await t.test('Test 11: IPC key derivation offloading via window.api.cryptoDeriveStoreKey', async () => {
    const mockStoreId = '108199';
    const mockUnitCode = '18199';
    const mockKeyBytes = crypto.randomBytes(32);
    let ipcCalls = 0;

    // Simulate Electron renderer environment with window.api
    (globalThis as any).window = {
      api: {
        cryptoDeriveStoreKey: async (sId: string, uCode: string) => {
          ipcCalls++;
          assert.equal(sId, mockStoreId);
          assert.equal(uCode, mockUnitCode);
          return mockKeyBytes.toString('base64');
        },
      },
    };

    try {
      StoreKeyCache.invalidateStore(mockStoreId);

      // First call -> invokes IPC
      const key1 = await deriveStoreKey(mockStoreId, mockUnitCode);
      assert.equal(ipcCalls, 1, 'Cache miss must trigger IPC exactly once');
      assert.deepEqual(key1, mockKeyBytes);

      // Second call -> hits StoreKeyCache, zero additional IPC calls
      const key2 = await deriveStoreKey(mockStoreId, mockUnitCode);
      assert.equal(ipcCalls, 1, 'Subsequent call must hit StoreKeyCache');
      assert.deepEqual(key2, mockKeyBytes);

      // Async encryption and decryption round-trip using IPC key
      const payload = { encryptedSecret: 'ipc_safe_storage_value' };
      const env = await encryptPayload(payload, mockStoreId, mockUnitCode, 'vault_test', 'doc_01');
      const dec = await decryptPayload(env, mockStoreId, mockUnitCode, 'vault_test', 'doc_01');
      assert.deepEqual(dec, payload);
    } finally {
      delete (globalThis as any).window;
      StoreKeyCache.invalidateStore(mockStoreId);
    }
  });
});
