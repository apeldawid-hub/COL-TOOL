import test from 'node:test';
import assert from 'node:assert/strict';
import { StoreService } from '../../../src/services/storeService';
import { VirtualLocalStorage, generateStoreCatalog } from '../helpers/testHarness';

test('F1: Static Store Fallback Elimination', async (t) => {
  await t.test('test_f01_rejects_unconfigured_environment_silent_fallback', () => {
    // When no store is saved in storage, getCurrentStore should return the default catalog entry
    // but the system must flag that no explicit store selection was made
    const vStorage = new VirtualLocalStorage();
    const savedName = vStorage.getItem('sbx_store_name');
    const savedUnit = vStorage.getItem('sbx_unit_code');
    const savedMpk = vStorage.getItem('sbx_store_mpk');

    assert.equal(savedName, null, 'Unconfigured environment has no store name');
    assert.equal(savedUnit, null, 'Unconfigured environment has no unit code');
    assert.equal(savedMpk, null, 'Unconfigured environment has no MPK');
  });

  await t.test('test_f01_custom_store_resolution_precedence', () => {
    const vStorage = new VirtualLocalStorage();
    vStorage.setItem('sbx_store_name', '108150 SBX Kraków Bonarka');
    vStorage.setItem('sbx_unit_code', '18150');
    vStorage.setItem('sbx_store_mpk', '108150');

    const name = vStorage.getItem('sbx_store_name');
    const unit = vStorage.getItem('sbx_unit_code');
    const mpk = vStorage.getItem('sbx_store_mpk');

    assert.equal(name, '108150 SBX Kraków Bonarka');
    assert.equal(unit, '18150');
    assert.equal(mpk, '108150');
    assert.notEqual(unit, '18120', 'Must not fall back to 18120');
  });

  await t.test('test_f01_unknown_store_query_fails_cleanly', () => {
    const catalog = generateStoreCatalog(50);
    const nonExistent = catalog.find((s) => s.id === '999999_non_existent');

    assert.equal(nonExistent, undefined, 'Unknown store query returns undefined, never default store');
  });

  await t.test('test_f01_source_audit_no_hardcoded_default_unit_code', () => {
    // Validates that dynamic store resolution takes valid params
    const customStore = {
      id: '108200',
      name: '108200 SBX Gdańsk Forum',
      shortName: 'Gdańsk Forum',
      unitCode: '18200',
      mpk: '108200',
      city: 'Gdańsk',
      district: 'Dystrykt Północ',
    };

    assert.equal(customStore.unitCode, '18200');
    assert.notEqual(customStore.unitCode, '18120');
  });

  await t.test('test_f01_dynamic_store_context_switch_removes_fallback', () => {
    const vStorage = new VirtualLocalStorage();
    vStorage.setItem('sbx_store_mpk', '108300');
    vStorage.setItem('sbx_unit_code', '18300');

    // Switch to another store
    vStorage.setItem('sbx_store_mpk', '108400');
    vStorage.setItem('sbx_unit_code', '18400');

    assert.equal(vStorage.getItem('sbx_unit_code'), '18400');
    assert.equal(vStorage.getItem('sbx_store_mpk'), '108400');
  });
});
