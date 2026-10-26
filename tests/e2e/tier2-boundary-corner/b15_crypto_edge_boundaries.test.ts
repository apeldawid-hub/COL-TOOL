import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptPayload, decryptPayload } from '../helpers/cryptoSpec';

test('B15: Cryptographic Edge & Truncation Boundaries', async (t) => {
  const storeId = '108150';
  const unitCode = '18150';

  await t.test('test_b15_ciphertext_truncated_by_one_byte', () => {
    const envelope = encryptPayload({ msg: 'sensitive data' }, storeId, unitCode, 'vault', 'd1');
    const rawCipher = Buffer.from(envelope.ciphertext, 'base64');
    const truncatedCipher = rawCipher.subarray(0, rawCipher.length - 1).toString('base64');

    const corruptedEnvelope = { ...envelope, ciphertext: truncatedCipher };
    assert.throws(
      () => decryptPayload(corruptedEnvelope, storeId, unitCode, 'vault', 'd1'),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );
  });

  await t.test('test_b15_auth_tag_truncated_by_one_byte', () => {
    const envelope = encryptPayload({ msg: 'sensitive data' }, storeId, unitCode, 'vault', 'd1');
    const rawTag = Buffer.from(envelope.tag, 'base64');
    const truncatedTag = rawTag.subarray(0, rawTag.length - 1).toString('base64');

    const corruptedEnvelope = { ...envelope, tag: truncatedTag };
    assert.throws(
      () => decryptPayload(corruptedEnvelope, storeId, unitCode, 'vault', 'd1'),
      /Invalid authentication tag length|Unsupported state/i
    );
  });

  await t.test('test_b15_iv_truncated_to_11_bytes', () => {
    const envelope = encryptPayload({ msg: 'sensitive data' }, storeId, unitCode, 'vault', 'd1');
    const rawIv = Buffer.from(envelope.iv, 'base64');
    const truncatedIv = rawIv.subarray(0, 11).toString('base64');

    const corruptedEnvelope = { ...envelope, iv: truncatedIv };
    assert.throws(
      () => decryptPayload(corruptedEnvelope, storeId, unitCode, 'vault', 'd1'),
      /Invalid initialization vector|Unsupported state/i
    );
  });

  await t.test('test_b15_iv_extended_beyond_12_bytes', () => {
    const envelope = encryptPayload({ msg: 'sensitive data' }, storeId, unitCode, 'vault', 'd1');
    const rawIv = Buffer.from(envelope.iv, 'base64');
    const extendedIv = Buffer.concat([rawIv, Buffer.from([0x01, 0x02])]).toString('base64');

    const corruptedEnvelope = { ...envelope, iv: extendedIv };
    // AES-GCM standard supports variable IV length, but with different IV the plaintext will fail auth tag
    assert.throws(
      () => decryptPayload(corruptedEnvelope, storeId, unitCode, 'vault', 'd1'),
      /Invalid initialization vector|Unsupported state or unable to authenticate data|bad decrypt/i
    );
  });

  await t.test('test_b15_empty_payload_integrity_verification', () => {
    const emptyEnvelope = encryptPayload({}, storeId, unitCode, 'vault', 'empty_doc');
    const decrypted = decryptPayload(emptyEnvelope, storeId, unitCode, 'vault', 'empty_doc');
    assert.deepEqual(decrypted, {});
  });
});
