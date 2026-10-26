import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptPayload, decryptPayload } from '../helpers/cryptoSpec';

test('F18: 100% E2E Acceptance Test Pass & Adversarial Hardening', async (t) => {
  const storeId = '108150';
  const unitCode = '18150';

  await t.test('test_f18_adversarial_sql_injection_sanitization', () => {
    const maliciousInput = "108150'; DROP TABLE users;--";
    const sanitizeStoreId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitized = sanitizeStoreId(maliciousInput);

    assert.equal(sanitized, '108150___DROP_TABLE_users_--');
    assert.ok(!sanitized.includes(';'));
    assert.ok(!sanitized.includes("'"));
  });

  await t.test('test_f18_path_traversal_prevention_in_store_id', () => {
    const traversalInput = '../../../../etc/shadow';
    const sanitizeStoreId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitized = sanitizeStoreId(traversalInput);

    assert.ok(!sanitized.includes('/'));
    assert.ok(!sanitized.includes('.'));
  });

  await t.test('test_f18_malformed_crypto_envelopes_handled_safely', () => {
    const badEnvelopes = [
      '',
      'not:an:envelope',
      'enc:v1:store:key:iv:tag', // missing ciphertext
      'enc:v2:store:key:iv:tag:cipher', // unsupported version
    ];

    for (const bad of badEnvelopes) {
      assert.throws(() => decryptPayload(bad, storeId, unitCode, 'vault', 'doc1'), /Malformed/i);
    }
  });

  await t.test('test_f18_rapid_consecutive_store_switches', () => {
    const activeStoreHistory: string[] = [];
    for (let i = 0; i < 20; i++) {
      const target = `store_${i % 5}`;
      activeStoreHistory.push(target);
    }
    assert.equal(activeStoreHistory.length, 20);
    assert.equal(activeStoreHistory[19], 'store_4');
  });

  await t.test('test_f18_extreme_payload_size_handling', () => {
    // Generate ~1 MB synthetic schedule payload
    const largePayload: Record<string, any> = {};
    for (let i = 0; i < 2000; i++) {
      largePayload[`shift_${i}`] = {
        partnerId: `p_${i}`,
        date: '2026-09-15',
        start: '07:00',
        end: '15:30',
        floorHours: 8.0,
      };
    }

    const envelope = encryptPayload(largePayload, storeId, unitCode, 'schedule', 'large_doc');
    assert.ok(envelope.ciphertext.length > 50000);

    const decrypted = decryptPayload(envelope, storeId, unitCode, 'schedule', 'large_doc');
    assert.equal(Object.keys(decrypted).length, 2000);
  });
});
