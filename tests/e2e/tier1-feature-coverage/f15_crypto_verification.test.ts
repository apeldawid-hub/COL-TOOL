import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptPayload, decryptPayload } from '../helpers/cryptoSpec';

test('F15: Cryptographic Unit Test Suite', async (t) => {
  const storeId = '108150';
  const unitCode = '18150';

  await t.test('test_f15_tampered_ciphertext_fails_auth_tag', () => {
    const envelope = encryptPayload({ data: 'secret' }, storeId, unitCode, 'vault', 'doc1');
    const rawCipher = Buffer.from(envelope.ciphertext, 'base64');
    // Flip one bit
    rawCipher[0] ^= 0x01;
    const tamperedCipher = rawCipher.toString('base64');

    const tamperedEnvelope = { ...envelope, ciphertext: tamperedCipher };

    assert.throws(
      () => decryptPayload(tamperedEnvelope, storeId, unitCode, 'vault', 'doc1'),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );
  });

  await t.test('test_f15_tampered_aad_fails_decryption', () => {
    const envelope = encryptPayload({ data: 'secret' }, storeId, unitCode, 'vault', 'doc1');

    // Attempt decryption with wrong docId (tampered AAD)
    assert.throws(
      () => decryptPayload(envelope, storeId, unitCode, 'vault', 'doc2_tampered'),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );
  });

  await t.test('test_f15_different_store_key_fails_decryption', () => {
    const envelope = encryptPayload({ data: 'secret' }, storeId, unitCode, 'vault', 'doc1');

    const differentUnitCode = '18160';
    assert.throws(
      () => decryptPayload(envelope, storeId, differentUnitCode, 'vault', 'doc1'),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );
  });

  await t.test('test_f15_iv_uniqueness_across_identical_payloads', () => {
    const payload = { same: 'data' };
    const env1 = encryptPayload(payload, storeId, unitCode, 'vault', 'doc1');
    const env2 = encryptPayload(payload, storeId, unitCode, 'vault', 'doc1');

    assert.notEqual(env1.iv, env2.iv, 'IVs must be uniquely generated for each encryption');
    assert.notEqual(env1.ciphertext, env2.ciphertext);
  });

  await t.test('test_f15_tampered_tag_fails_decryption', () => {
    const envelope = encryptPayload({ data: 'secret' }, storeId, unitCode, 'vault', 'doc1');
    const rawTag = Buffer.from(envelope.tag, 'base64');
    rawTag[rawTag.length - 1] ^= 0xff;
    const tamperedTag = rawTag.toString('base64');

    const tamperedEnvelope = { ...envelope, tag: tamperedTag };
    assert.throws(
      () => decryptPayload(tamperedEnvelope, storeId, unitCode, 'vault', 'doc1'),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );
  });
});
