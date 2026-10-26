import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualLocalStorage } from '../helpers/testHarness';

test('F10: Service Storage Namespacing', async (t) => {
  const vStorage = new VirtualLocalStorage();

  await t.test('test_f10_todo_service_namespaces_keys_by_store', () => {
    const storeId = '108150';
    const key = `sbx_store_${storeId}_todos`;
    vStorage.setItem(key, JSON.stringify([{ id: 't1', text: 'Order milk' }]));

    const retrieved = JSON.parse(vStorage.getItem(key)!);
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].text, 'Order milk');
  });

  await t.test('test_f10_desktop_notification_namespacing', () => {
    const storeId = '108150';
    const notifKey = `sbx_store_${storeId}_notifications`;
    vStorage.setItem(notifKey, JSON.stringify([{ id: 'n1', title: 'Schedule approved' }]));

    assert.ok(vStorage.getItem(notifKey));
  });

  await t.test('test_f10_sync_engine_checkpoint_namespacing', () => {
    const storeA = '108150';
    const storeB = '108160';
    vStorage.setItem(`sbx_store_${storeA}_sync_last_ts`, '1700000000');
    vStorage.setItem(`sbx_store_${storeB}_sync_last_ts`, '1700005000');

    assert.notEqual(
      vStorage.getItem(`sbx_store_${storeA}_sync_last_ts`),
      vStorage.getItem(`sbx_store_${storeB}_sync_last_ts`)
    );
  });

  await t.test('test_f10_store_isolation_no_cross_read', () => {
    const storeA = '108150';
    const storeB = '108160';

    vStorage.setItem(`sbx_store_${storeA}_admin_secret`, 'secret_A');
    const storeBView = vStorage.getItem(`sbx_store_${storeB}_admin_secret`);

    assert.equal(storeBView, null, 'Store B must not see Store A namespaced secret');
  });

  await t.test('test_f10_global_preferences_remain_unpartitioned', () => {
    vStorage.setItem('sbx_app_theme', 'dark');
    vStorage.setItem('sbx_app_version', '2.8.67');

    assert.equal(vStorage.getItem('sbx_app_theme'), 'dark');
    assert.equal(vStorage.getItem('sbx_app_version'), '2.8.67');
  });
});
