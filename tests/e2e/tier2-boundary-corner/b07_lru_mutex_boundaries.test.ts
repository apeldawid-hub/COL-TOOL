import test from 'node:test';
import assert from 'node:assert/strict';
import { LRUConnectionPool, AsyncMutex } from '../helpers/testHarness';

test('B07: LRU Connection Pool & Concurrency Mutex Boundaries', async (t) => {
  await t.test('test_b07_pool_boundary_at_exactly_8_connections', () => {
    const pool = new LRUConnectionPool(8);
    for (let i = 1; i <= 8; i++) {
      pool.put(`store_${i}`, { id: i });
    }
    assert.equal(pool.size(), 8);
    assert.equal(pool.evictionLog.length, 0);
  });

  await t.test('test_b07_pool_boundary_at_exactly_9_connections', () => {
    const pool = new LRUConnectionPool(8);
    for (let i = 1; i <= 9; i++) {
      pool.put(`store_${i}`, { id: i });
    }
    assert.equal(pool.size(), 8);
    assert.equal(pool.evictionLog.length, 1);
  });

  await t.test('test_b07_reaccessing_evicted_store_reopens_connection', () => {
    const pool = new LRUConnectionPool(2);
    pool.put('store_1', { handle: 'h1' });
    pool.put('store_2', { handle: 'h2' });
    pool.put('store_3', { handle: 'h3' }); // evicts store_1

    assert.equal(pool.has('store_1'), false);

    // Reopen store_1
    pool.put('store_1', { handle: 'h1_reopened' });
    assert.equal(pool.has('store_1'), true);
    assert.equal(pool.get('store_1').handle, 'h1_reopened');
  });

  await t.test('test_b07_mutex_queue_depth_boundary_50_tasks', async () => {
    const mutex = new AsyncMutex();
    let count = 0;

    const tasks = Array.from({ length: 50 }, () =>
      mutex.runExclusive(async () => {
        count += 1;
      })
    );

    await Promise.all(tasks);
    assert.equal(count, 50, 'All 50 queued tasks must execute sequentially without drop');
  });

  await t.test('test_b07_zero_ms_immediate_mutex_execution', async () => {
    const mutex = new AsyncMutex();
    const result = await mutex.runExclusive(async () => 'instant_ok');
    assert.equal(result, 'instant_ok');
  });
});
