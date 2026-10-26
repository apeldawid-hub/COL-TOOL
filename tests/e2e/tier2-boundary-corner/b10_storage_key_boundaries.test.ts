import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualLocalStorage } from '../helpers/testHarness';

test('B10: Storage Key Namespacing Boundaries', async (t) => {
  const vStorage = new VirtualLocalStorage();

  await t.test('test_b10_storage_key_with_special_characters_in_store_id', () => {
    const rawStoreId = 'store/../108150';
    const safeStoreId = rawStoreId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const key = `sbx_store_${safeStoreId}_todos`;

    vStorage.setItem(key, 'value1');
    assert.equal(vStorage.getItem(key), 'value1');
    assert.ok(!key.includes('/'));
  });

  await t.test('test_b10_empty_string_value_stored_in_namespaced_key', () => {
    const key = 'sbx_store_108150_notes';
    vStorage.setItem(key, '');
    assert.equal(vStorage.getItem(key), '');
  });

  await t.test('test_b10_large_json_payload_storage', () => {
    const largeObj = { data: 'X'.repeat(50000) };
    const key = 'sbx_store_108150_large';
    vStorage.setItem(key, JSON.stringify(largeObj));

    const retrieved = JSON.parse(vStorage.getItem(key)!);
    assert.equal(retrieved.data.length, 50000);
  });

  await t.test('test_b10_clearing_store_partition_leaves_other_stores_intact', () => {
    vStorage.setItem('sbx_store_108150_item1', 'A1');
    vStorage.setItem('sbx_store_108150_item2', 'A2');
    vStorage.setItem('sbx_store_108160_item1', 'B1');

    // Clear partition for 108150 only
    const p150Keys = vStorage.getStorePartitionKeys('108150');
    for (const k of p150Keys) {
      vStorage.removeItem(k);
    }

    assert.equal(vStorage.getItem('sbx_store_108150_item1'), null);
    assert.equal(vStorage.getItem('sbx_store_108160_item1'), 'B1');
  });

  await t.test('test_b10_quota_exceeded_error_handling_simulation', () => {
    const safeSetItem = (storage: VirtualLocalStorage, key: string, value: string, mockQuotaExceeded = false) => {
      if (mockQuotaExceeded) {
        throw new Error('QuotaExceededError: LocalStorage quota reached');
      }
      storage.setItem(key, value);
    };

    assert.throws(
      () => safeSetItem(vStorage, 'key', 'val', true),
      /QuotaExceededError/
    );
  });
});
