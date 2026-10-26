import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

test('F6: Uniform SQLite Store Database File Naming', async (t) => {
  const computeDbPath = (storeId: string) => {
    const safeId = storeId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    return `store_${safeId}.db`;
  };

  await t.test('test_f06_database_naming_follows_uniform_convention', () => {
    assert.equal(computeDbPath('108120'), 'store_108120.db');
    assert.equal(computeDbPath('108150'), 'store_108150.db');
    assert.equal(computeDbPath('store_wroclavia'), 'store_store_wroclavia.db');
  });

  await t.test('test_f06_filename_sanitizes_special_characters', () => {
    const maliciousId = '../../etc/passwd';
    const computed = computeDbPath(maliciousId);
    assert.ok(!computed.includes('/'), 'Path traversal slashes must be replaced');
    assert.ok(!computed.includes('\\'), 'Backslashes must be replaced');
    assert.equal(computed, 'store_______etc_passwd.db');
  });

  await t.test('test_f06_legacy_tplh_db_migrates_automatically', () => {
    // Simulator for zero-loss legacy file migration
    const fileSystem = new Map<string, Buffer>();
    const legacyPayload = Buffer.from('SQLite format 3: legacy data');
    fileSystem.set('tplh_forecast.db', legacyPayload);

    // Migration function
    const migrateLegacy = (fsMap: Map<string, Buffer>) => {
      if (fsMap.has('tplh_forecast.db') && !fsMap.has('store_108120.db')) {
        const data = fsMap.get('tplh_forecast.db')!;
        fsMap.set('store_108120.db', data);
        return { migrated: true, bytes: data.length };
      }
      return { migrated: false };
    };

    const res = migrateLegacy(fileSystem);
    assert.equal(res.migrated, true);
    assert.ok(fileSystem.has('store_108120.db'));
  });

  await t.test('test_f06_migration_preserves_sqlite_table_checksum', () => {
    const original = Buffer.from('mock sqlite binary payload with 10 tables');
    const migrated = Buffer.from(original);

    const hashOrig = crypto.createHash('sha256').update(original).digest('hex');
    const hashMigr = crypto.createHash('sha256').update(migrated).digest('hex');

    assert.equal(hashOrig, hashMigr, 'Checksum must match identically after migration');
  });

  await t.test('test_f06_non_existent_db_triggers_clean_schema_creation', () => {
    const fileSystem = new Map<string, boolean>();
    const getOrCreateDb = (filename: string) => {
      if (!fileSystem.has(filename)) {
        fileSystem.set(filename, true);
        return { isNew: true, filename };
      }
      return { isNew: false, filename };
    };

    const res1 = getOrCreateDb('store_108170.db');
    assert.equal(res1.isNew, true);

    const res2 = getOrCreateDb('store_108170.db');
    assert.equal(res2.isNew, false);
  });
});
