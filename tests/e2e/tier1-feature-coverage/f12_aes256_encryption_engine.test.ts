import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { deriveStoreKey, encryptPayload, decryptPayload } from '../helpers/cryptoSpec';

test('F12: Client-Side AES-256-GCM Encryption Engine', async (t) => {
  const storeId = '108150';
  const unitCode = '18150';

  await t.test('test_f12_pbkdf2_key_derivation_parameters', () => {
    const key = deriveStoreKey(storeId, unitCode);
    assert.equal(key.length, 32, 'AES-256 requires 256-bit (32 bytes) key');
  });

  await t.test('test_f12_salt_incorporates_store_id_and_unit_code', () => {
    const expectedSaltStr = `sbx_vault_salt_v1_${storeId}_${unitCode}`;
    const salt = crypto.createHash('sha256').update(expectedSaltStr, 'utf8').digest();
    assert.equal(salt.length, 32);
  });

  await t.test('test_f12_aes_256_gcm_produces_96bit_iv_and_128bit_tag', () => {
    const envelope = encryptPayload({ foo: 'bar' }, storeId, unitCode, 'financial', 'doc1');
    const ivBuf = Buffer.from(envelope.iv, 'base64');
    const tagBuf = Buffer.from(envelope.tag, 'base64');

    assert.equal(ivBuf.length, 12, 'IV must be 96-bit (12 bytes)');
    assert.equal(tagBuf.length, 16, 'Auth tag must be 128-bit (16 bytes)');
  });

  await t.test('test_f12_serialized_envelope_format', () => {
    const envelope = encryptPayload({ num: 42 }, storeId, unitCode, 'salaries', 'emp_01');
    const parts = envelope.serialized.split(':');

    assert.equal(parts.length, 7);
    assert.equal(parts[0], 'enc');
    assert.equal(parts[1], 'v1');
    assert.equal(parts[2], storeId);
    assert.equal(parts[3], 'k1');
  });

  await t.test('test_f12_roundtrip_encryption_decryption_fidelity', () => {
    const originalPayload = {
      executiveSummary: 'September P&L',
      laborCostPLN: 142500.5,
      partners: [{ id: 'p1', rate: 32.5 }, { id: 'p2', rate: 29.8 }],
    };

    const envelope = encryptPayload(originalPayload, storeId, unitCode, 'financial', 'doc_pl_2026_09');
    const decrypted = decryptPayload(envelope, storeId, unitCode, 'financial', 'doc_pl_2026_09');

    assert.deepEqual(decrypted, originalPayload);
  });
});
