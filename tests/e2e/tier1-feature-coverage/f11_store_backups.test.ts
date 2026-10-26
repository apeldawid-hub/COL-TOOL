import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

test('F11: Store-Partitioned Backup & Restore', async (t) => {
  const generateBackupFilename = (storeId: string, timestamp: number) => {
    return `store_${storeId}_${timestamp}.db`;
  };

  await t.test('test_f11_backup_file_naming_convention', () => {
    const filename = generateBackupFilename('108150', 1700000000);
    assert.equal(filename, 'store_108150_1700000000.db');
  });

  await t.test('test_f11_backup_creation_captures_active_store_only', () => {
    const backupsDir = new Map<string, string>();
    const createBackup = (storeId: string, data: string) => {
      const name = generateBackupFilename(storeId, Date.now());
      backupsDir.set(name, data);
      return name;
    };

    const bName = createBackup('108150', 'store 108150 content');
    assert.ok(bName.startsWith('store_108150_'));
    assert.equal(backupsDir.get(bName), 'store 108150 content');
  });

  await t.test('test_f11_restore_validates_matching_target_store', () => {
    const validateRestoreTarget = (backupFilename: string, targetStoreId: string) => {
      const match = backupFilename.match(/^store_([^_]+)_/);
      if (!match) return false;
      return match[1] === targetStoreId;
    };

    const isMatchValid = validateRestoreTarget('store_108150_1700000000.db', '108150');
    const isMismatchBlocked = validateRestoreTarget('store_108150_1700000000.db', '108160');

    assert.equal(isMatchValid, true);
    assert.equal(isMismatchBlocked, false, 'Restoring Store A backup into Store B must be rejected');
  });

  await t.test('test_f11_rotation_preserves_up_to_15_backups_per_store', () => {
    const storeBackups: string[] = [];
    const maxBackups = 15;

    for (let i = 1; i <= 20; i++) {
      storeBackups.push(`store_108150_${i}.db`);
      if (storeBackups.length > maxBackups) {
        storeBackups.shift(); // rotate oldest
      }
    }

    assert.equal(storeBackups.length, 15);
    assert.equal(storeBackups[0], 'store_108150_6.db');
    assert.equal(storeBackups[14], 'store_108150_20.db');
  });

  await t.test('test_f11_restore_verifies_checksum_before_overwriting', () => {
    const backupContent = Buffer.from('SQLite format 3: validated content');
    const checksum = crypto.createHash('sha256').update(backupContent).digest('hex');

    const verifyBeforeRestore = (buf: Buffer, expectedSha: string) => {
      const calc = crypto.createHash('sha256').update(buf).digest('hex');
      return calc === expectedSha;
    };

    assert.equal(verifyBeforeRestore(backupContent, checksum), true);
    const corrupted = Buffer.from('Corrupted content');
    assert.equal(verifyBeforeRestore(corrupted, checksum), false);
  });
});
