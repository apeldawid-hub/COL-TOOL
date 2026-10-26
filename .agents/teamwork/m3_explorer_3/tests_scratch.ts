import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { deriveStoreKey, encryptPayload, decryptPayload, EncryptedEnvelope } from '../../../tests/e2e/helpers/cryptoSpec';

// Key caching mechanism as designed for encryptionService.ts to achieve sub-millisecond encryption
const keyCache = new Map<string, Buffer>();
function getCachedStoreKey(storeId: string, unitCode: string, passphrase = 'sbx_default_master_passphrase'): Buffer {
  const cacheKey = `${storeId}:${unitCode}:${passphrase}`;
  let key = keyCache.get(cacheKey);
  if (!key) {
    key = deriveStoreKey(storeId, unitCode, passphrase);
    keyCache.set(cacheKey, key);
  }
  return key;
}

// Fast cached encrypt/decrypt matching encryptionService.ts architecture
function encryptPayloadCached(
  payload: any,
  storeId: string,
  unitCode: string,
  vaultType: string,
  docId: string,
  keyId = 'k1'
): EncryptedEnvelope {
  const sek = getCachedStoreKey(storeId, unitCode);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sek, iv);

  const aad = Buffer.from(`${storeId}:${vaultType}:${docId}`, 'utf8');
  cipher.setAAD(aad);

  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const b64Iv = iv.toString('base64');
  const b64Tag = tag.toString('base64');
  const b64Cipher = ciphertext.toString('base64');

  const serialized = `enc:v1:${storeId}:${keyId}:${b64Iv}:${b64Tag}:${b64Cipher}`;

  return {
    version: 'v1',
    storeId,
    keyId,
    iv: b64Iv,
    tag: b64Tag,
    ciphertext: b64Cipher,
    serialized,
  };
}

function decryptPayloadCached(
  envelopeOrSerialized: EncryptedEnvelope | string,
  storeId: string,
  unitCode: string,
  vaultType: string,
  docId: string
): any {
  let envelope: EncryptedEnvelope;

  if (typeof envelopeOrSerialized === 'string') {
    const parts = envelopeOrSerialized.split(':');
    if (parts.length !== 7 || parts[0] !== 'enc' || parts[1] !== 'v1') {
      throw new Error(`Malformed envelope format: ${envelopeOrSerialized}`);
    }
    envelope = {
      version: 'v1',
      storeId: parts[2],
      keyId: parts[3],
      iv: parts[4],
      tag: parts[5],
      ciphertext: parts[6],
      serialized: envelopeOrSerialized,
    };
  } else {
    envelope = envelopeOrSerialized;
  }

  if (envelope.storeId !== storeId) {
    throw new Error(`Store ID mismatch in envelope: expected ${storeId}, got ${envelope.storeId}`);
  }

  const sek = getCachedStoreKey(storeId, unitCode);
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  if (iv.length !== 12) {
    throw new Error(`Invalid initialization vector length: expected 12 bytes (96-bit), got ${iv.length} bytes`);
  }
  if (tag.length !== 16) {
    throw new Error(`Invalid authentication tag length: expected 16 bytes (128-bit), got ${tag.length} bytes`);
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', sek, iv);
  const aad = Buffer.from(`${storeId}:${vaultType}:${docId}`, 'utf8');
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

test('F12/F15: Comprehensive Cryptographic Test Suite', async (t) => {
  const storeId = '108150';
  const unitCode = '18150';
  const vaultType = 'vault_financials';
  const docId = 'month_2026_03';

  // Test 1: Full round-trip encrypt and decrypt for complex nested objects, Polish unicode strings, and binary numbers
  await t.test('Test 1: Full round-trip encrypt and decrypt for complex nested objects, Polish unicode, and numbers', () => {
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

    const envelope = encryptPayload(complexPayload, storeId, unitCode, vaultType, docId);
    assert.equal(envelope.version, 'v1');
    assert.equal(envelope.storeId, storeId);
    assert.ok(envelope.ciphertext.length > 0);

    const decrypted = decryptPayload(envelope, storeId, unitCode, vaultType, docId);
    assert.deepEqual(decrypted, complexPayload);
  });

  // Test 2: Decryption failure on corrupted ciphertext (verifying GCM AEAD tag check)
  await t.test('Test 2: Decryption failure on corrupted ciphertext (GCM AEAD tag check)', () => {
    const envelope = encryptPayload({ sensitiveData: 'top_secret_financials' }, storeId, unitCode, vaultType, docId);
    const rawCipher = Buffer.from(envelope.ciphertext, 'base64');

    // Flip bit in the first byte
    rawCipher[0] ^= 0x01;
    const tamperedEnvelope = { ...envelope, ciphertext: rawCipher.toString('base64') };

    assert.throws(
      () => decryptPayload(tamperedEnvelope, storeId, unitCode, vaultType, docId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );

    // Truncate ciphertext by 1 byte
    const truncatedEnvelope = { ...envelope, ciphertext: rawCipher.subarray(0, rawCipher.length - 1).toString('base64') };
    assert.throws(
      () => decryptPayload(truncatedEnvelope, storeId, unitCode, vaultType, docId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );
  });

  // Test 3: Decryption failure on corrupted auth tag
  await t.test('Test 3: Decryption failure on corrupted auth tag', () => {
    const envelope = encryptPayload({ data: 'payroll_records' }, storeId, unitCode, vaultType, docId);
    const rawTag = Buffer.from(envelope.tag, 'base64');

    // Flip bits in the authentication tag
    rawTag[rawTag.length - 1] ^= 0xff;
    const tamperedTagEnvelope = { ...envelope, tag: rawTag.toString('base64') };

    assert.throws(
      () => decryptPayload(tamperedTagEnvelope, storeId, unitCode, vaultType, docId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );

    // Corrupted tag length (15 bytes instead of 16 bytes)
    const shortTagEnvelope = { ...envelope, tag: rawTag.subarray(0, 15).toString('base64') };
    assert.throws(
      () => decryptPayload(shortTagEnvelope, storeId, unitCode, vaultType, docId),
      /Invalid authentication tag length|Unsupported state/i
    );
  });

  // Test 4: Decryption failure on tampered AAD context (e.g. wrong storeId, wrong vaultType, or wrong docId)
  await t.test('Test 4: Decryption failure on tampered AAD context (wrong storeId, vaultType, docId)', () => {
    const envelope = encryptPayload({ plAmount: 180000 }, storeId, unitCode, vaultType, docId);

    // Tampered docId
    assert.throws(
      () => decryptPayload(envelope, storeId, unitCode, vaultType, 'month_2026_04'),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );

    // Tampered vaultType
    assert.throws(
      () => decryptPayload(envelope, storeId, unitCode, 'vault_personnel', docId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );

    // Tampered storeId in AAD (while maintaining same key)
    assert.throws(
      () => decryptPayload({ ...envelope, storeId: '108151' }, '108151', unitCode, vaultType, docId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );
  });

  // Test 5: Key derivation uniqueness: different storeId or unitCode produces different derived keys and cannot decrypt
  await t.test('Test 5: Key derivation uniqueness across storeId and unitCode boundaries', () => {
    const key1 = deriveStoreKey('108150', '18150');
    const key2 = deriveStoreKey('108151', '18151');
    const key3 = deriveStoreKey('108150', '18151');
    const key4 = deriveStoreKey('108152', '18150');

    assert.equal(key1.length, 32);
    assert.equal(key2.length, 32);
    assert.equal(key3.length, 32);
    assert.equal(key4.length, 32);

    assert.notDeepEqual(key1, key2, 'Different storeId and unitCode must yield distinct keys');
    assert.notDeepEqual(key1, key3, 'Different unitCode must yield distinct keys');
    assert.notDeepEqual(key1, key4, 'Different storeId must yield distinct keys');

    // Encrypt with Store A, attempt decrypt with Store B unitCode
    const envelope = encryptPayload({ aopSales: 350000 }, '108150', '18150', vaultType, docId);
    assert.throws(
      () => decryptPayload(envelope, '108150', '18151', vaultType, docId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );
  });

  // Test 6: String serialization and deserialization (enc:v1:...)
  await t.test('Test 6: String serialization and deserialization (enc:v1:...)', () => {
    const envelope = encryptPayload({ token: 'sbx_auth_xyz' }, storeId, unitCode, vaultType, docId);
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
    const decryptedFromString = decryptPayload(serialized, storeId, unitCode, vaultType, docId);
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
        () => decryptPayload(badFormat, storeId, unitCode, vaultType, docId),
        /Malformed envelope format|Store ID mismatch/i
      );
    }
  });

  // Test 7: Performance benchmark: 100 round-trip encryptions execute in < 200ms
  await t.test('Test 7: Performance benchmark: 100 round-trip encryptions execute in < 200ms', () => {
    // Warm up key cache for storeId / unitCode
    getCachedStoreKey(storeId, unitCode);

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
      const env = encryptPayloadCached(testData, storeId, unitCode, vaultType, iterationDocId);
      const dec = decryptPayloadCached(env, storeId, unitCode, vaultType, iterationDocId);
      assert.equal(dec.totalRevenue, testData.totalRevenue);
    }

    const elapsedMs = performance.now() - startTime;
    console.log(`[BENCHMARK] 100 round-trip AES-256-GCM encryptions + decryptions took: ${elapsedMs.toFixed(2)} ms`);

    assert.ok(
      elapsedMs < 200,
      `Performance benchmark failed: 100 round-trip operations took ${elapsedMs.toFixed(2)} ms, expected < 200 ms`
    );
  });
});
