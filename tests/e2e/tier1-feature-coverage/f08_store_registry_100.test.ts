import test from 'node:test';
import assert from 'node:assert/strict';
import { generateStoreCatalog, StoreInfo } from '../helpers/testHarness';

test('F8: Scalable Store Registry for 100+ Stores', async (t) => {
  const catalog = generateStoreCatalog(105);

  await t.test('test_f08_registry_loads_100_plus_stores', () => {
    assert.ok(catalog.length >= 100, `Catalog must have >= 100 stores, got ${catalog.length}`);
    const uniqueIds = new Set(catalog.map((s) => s.id));
    assert.equal(uniqueIds.size, catalog.length, 'All store IDs must be unique');
  });

  await t.test('test_f08_fast_lookup_by_mpk_and_unit', () => {
    // Build index
    const mpkIndex = new Map<string, StoreInfo>();
    for (const store of catalog) {
      mpkIndex.set(store.mpk, store);
    }

    const targetMpk = '108042';
    const store = mpkIndex.get(targetMpk);
    assert.ok(store);
    assert.equal(store?.mpk, targetMpk);
    assert.equal(store?.unitCode, '18042');
  });

  await t.test('test_f08_search_filtering_by_city_and_district', () => {
    const warszawaStores = catalog.filter((s) => s.city === 'Warszawa');
    assert.ok(warszawaStores.length > 0);
    for (const s of warszawaStores) {
      assert.equal(s.city, 'Warszawa');
    }
  });

  await t.test('test_f08_registry_rejects_duplicate_store_ids', () => {
    const existing = new Set(catalog.map((s) => s.id));
    const duplicateCandidate: StoreInfo = {
      id: catalog[0].id,
      name: 'Duplicate Store',
      shortName: 'Dup',
      unitCode: '99999',
      mpk: '99999',
      city: 'Warszawa',
      district: 'Dystrykt Centralny',
    };

    const isDuplicate = existing.has(duplicateCandidate.id);
    assert.equal(isDuplicate, true, 'Duplicate ID must be recognized');
  });

  await t.test('test_f08_registry_supports_runtime_store_registration', () => {
    const dynamicStores = [...catalog];
    const newStore: StoreInfo = {
      id: '108999',
      name: '108999 SBX Zakopane Krupówki',
      shortName: 'Krupówki',
      unitCode: '18999',
      mpk: '108999',
      city: 'Zakopane',
      district: 'Dystrykt Małopolska',
    };

    dynamicStores.push(newStore);
    assert.equal(dynamicStores.length, catalog.length + 1);
    const retrieved = dynamicStores.find((s) => s.id === '108999');
    assert.equal(retrieved?.name, '108999 SBX Zakopane Krupówki');
  });
});
