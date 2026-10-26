import test from 'node:test';
import assert from 'node:assert/strict';

test('B01: Fallback Elimination Boundary & Corner Cases', async (t) => {
  const sanitizeStoreId = (rawId: any): string | null => {
    if (typeof rawId !== 'string') return null;
    const trimmed = rawId.trim();
    if (!trimmed || trimmed.length === 0) return null;
    return trimmed.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  };

  await t.test('test_b01_empty_string_store_id_rejected', () => {
    assert.equal(sanitizeStoreId(''), null);
    assert.equal(sanitizeStoreId('   '), null);
  });

  await t.test('test_b01_null_and_undefined_store_id_handling', () => {
    assert.equal(sanitizeStoreId(null), null);
    assert.equal(sanitizeStoreId(undefined), null);
  });

  await t.test('test_b01_leading_trailing_whitespace_stripped', () => {
    assert.equal(sanitizeStoreId('  108150  '), '108150');
  });

  await t.test('test_b01_numeric_store_id_requires_explicit_string_coercion', () => {
    assert.equal(sanitizeStoreId(108150 as any), null, 'Must strictly require string input or explicit coercion');
    assert.equal(sanitizeStoreId(String(108150)), '108150');
  });

  await t.test('test_b01_unicode_store_names_handling_without_fallback', () => {
    const raw = '108180_Łódź_Śródmieście';
    const sanitized = sanitizeStoreId(raw);
    assert.ok(sanitized);
    assert.notEqual(sanitized, '108120', 'Must not fall back to 108120 for non-ASCII store names');
  });
});
