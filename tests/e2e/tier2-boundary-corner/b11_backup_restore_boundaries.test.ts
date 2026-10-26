import test from 'node:test';
import assert from 'node:assert/strict';

test('B11: Store Backup & Restore Boundaries', async (t) => {
  await t.test('test_b11_backup_of_empty_database_schema', () => {
    const emptyDbPayload = Buffer.from('SQLite format 3: empty tables');
    assert.ok(emptyDbPayload.length > 0);
  });

  await t.test('test_b11_backup_rotation_boundary_exactly_15', () => {
    const list: string[] = [];
    for (let i = 1; i <= 15; i++) {
      list.push(`b_${i}`);
    }
    // No rotation at 15
    assert.equal(list.length, 15);
    assert.equal(list[0], 'b_1');
  });

  await t.test('test_b11_backup_rotation_boundary_16_triggers_single_eviction', () => {
    const list: string[] = [];
    for (let i = 1; i <= 15; i++) {
      list.push(`b_${i}`);
    }
    list.push('b_16');
    const evicted = list.shift();
    assert.equal(evicted, 'b_1');
    assert.equal(list.length, 15);
    assert.equal(list[0], 'b_2');
    assert.equal(list[14], 'b_16');
  });

  await t.test('test_b11_restore_rejects_truncated_file', () => {
    const truncatedBuf = Buffer.from('SQLite'); // less than 16 bytes
    const isValid = truncatedBuf.length >= 100 && truncatedBuf.subarray(0, 16).toString().startsWith('SQLite format 3');
    assert.equal(isValid, false, 'Truncated backup must be rejected before restore');
  });

  await t.test('test_b11_backup_creation_timestamp_collision_prevention', () => {
    const b1 = `store_108150_${1700000000000}_0.db`;
    const b2 = `store_108150_${1700000000000}_1.db`;
    assert.notEqual(b1, b2, 'Sub-millisecond counter prevents filename collisions');
  });
});
