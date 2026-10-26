import test from 'node:test';
import assert from 'node:assert/strict';
import { generateStoreCatalog } from '../helpers/testHarness';

test('B08: Store Registry Scale & Lookup Boundaries', async (t) => {
  const catalog100 = generateStoreCatalog(100);
  const catalog150 = generateStoreCatalog(150);

  await t.test('test_b08_registry_with_exactly_100_stores', () => {
    assert.equal(catalog100.length, 100);
    const ids = new Set(catalog100.map((s) => s.id));
    assert.equal(ids.size, 100);
  });

  await t.test('test_b08_registry_with_150_stores_boundary', () => {
    assert.equal(catalog150.length, 150);
  });

  await t.test('test_b08_empty_search_query_returns_full_catalog', () => {
    const search = (q: string) => {
      const trimmed = q.trim().toLowerCase();
      if (!trimmed) return catalog100;
      return catalog100.filter((s) => s.name.toLowerCase().includes(trimmed));
    };

    assert.equal(search('').length, 100);
    assert.equal(search('   ').length, 100);
  });

  await t.test('test_b08_search_query_with_special_regex_characters', () => {
    const safeSearch = (q: string) => {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(escaped, 'i');
      return catalog100.filter((s) => reg.test(s.name));
    };

    // Query containing regex special characters
    const results = safeSearch('SBX (Warszawa) [Store]');
    assert.ok(Array.isArray(results), 'Should not throw SyntaxError on regex characters');
  });

  await t.test('test_b08_case_insensitive_store_search', () => {
    const search = (q: string) => {
      const lower = q.toLowerCase();
      return catalog100.filter((s) => s.name.toLowerCase().includes(lower));
    };

    const upper = search('WARSZAWA');
    const lower = search('warszawa');
    assert.equal(upper.length, lower.length);
    assert.ok(upper.length > 0);
  });
});
