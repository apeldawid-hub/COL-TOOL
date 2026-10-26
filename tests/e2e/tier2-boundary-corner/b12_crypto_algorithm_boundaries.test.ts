import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptPayload, decryptPayload } from '../helpers/cryptoSpec';

test('B12: AES-256-GCM Encryption Algorithm Boundaries', async (t) => {
  const storeId = '108150';
  const unitCode = '18150';

  await t.test('test_b12_empty_string_payload_encryption', () => {
    const envelope = encryptPayload('', storeId, unitCode, 'notes', 'd_empty');
    const decrypted = decryptPayload(envelope, storeId, unitCode, 'notes', 'd_empty');
    assert.equal(decrypted, '');
  });

  await t.test('test_b12_single_character_payload_encryption', () => {
    const envelope = encryptPayload('A', storeId, unitCode, 'notes', 'd_single');
    const decrypted = decryptPayload(envelope, storeId, unitCode, 'notes', 'd_single');
    assert.equal(decrypted, 'A');
  });

  await t.test('test_b12_exactly_16_byte_block_aligned_payload', () => {
    const blockPayload = '0123456789abcdef';
    assert.equal(Buffer.byteLength(blockPayload), 16);

    const envelope = encryptPayload(blockPayload, storeId, unitCode, 'vault', 'd_block');
    const decrypted = decryptPayload(envelope, storeId, unitCode, 'vault', 'd_block');
    assert.equal(decrypted, blockPayload);
  });

  await t.test('test_b12_exactly_64_byte_payload', () => {
    const payload64 = 'B'.repeat(64);
    const envelope = encryptPayload(payload64, storeId, unitCode, 'vault', 'd_64');
    const decrypted = decryptPayload(envelope, storeId, unitCode, 'vault', 'd_64');
    assert.equal(decrypted, payload64);
  });

  await t.test('test_b12_nested_empty_structures_handling', () => {
    const nested = { a: [], b: {}, c: null, d: false };
    const envelope = encryptPayload(nested, storeId, unitCode, 'vault', 'd_nested');
    const decrypted = decryptPayload(envelope, storeId, unitCode, 'vault', 'd_nested');
    assert.deepEqual(decrypted, nested);
  });
});
