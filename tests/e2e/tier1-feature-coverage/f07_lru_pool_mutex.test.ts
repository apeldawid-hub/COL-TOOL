import test from 'node:test';
import assert from 'node:assert/strict';
import { LRUConnectionPool, AsyncMutex } from '../helpers/testHarness';

test('F7: Electron LRU Connection Pool & Concurrency Mutex', async (t) => {
  await t.test('test_f07_lru_pool_holds_up_to_8_handles', () => {
    const pool = new LRUConnectionPool(8);
    for (let i = 1; i <= 8; i++) {
      pool.put(`store_${i}`, { dbId: i });
    }
    assert.equal(pool.size(), 8);
    assert.equal(pool.evictionLog.length, 0, 'No evictions when within capacity');
  });

  await t.test('test_f07_ninth_store_evicts_least_recently_used', () => {
    const pool = new LRUConnectionPool(8);
    for (let i = 1; i <= 8; i++) {
      pool.put(`store_${i}`, { dbId: i });
    }
    // Now touch store_2 through store_8 so store_1 remains the oldest
    for (let i = 2; i <= 8; i++) {
      pool.get(`store_${i}`);
    }

    const { evicted } = pool.put('store_9', { dbId: 9 });
    assert.equal(evicted, 'store_1');
    assert.equal(pool.size(), 8);
    assert.equal(pool.has('store_1'), false);
    assert.equal(pool.has('store_9'), true);
  });

  await t.test('test_f07_eviction_flushes_dirty_writes_to_disk', () => {
    const pool = new LRUConnectionPool(2);
    pool.put('store_A', { dbId: 'A' }, true); // dirty
    pool.put('store_B', { dbId: 'B' }, false);

    pool.put('store_C', { dbId: 'C' });
    const lastEviction = pool.evictionLog[0];
    assert.equal(lastEviction.evictedStoreId, 'store_A');
    assert.equal(lastEviction.flushed, true, 'Dirty writes must be marked for flush');
  });

  await t.test('test_f07_async_mutex_serializes_rapid_store_switches', async () => {
    const mutex = new AsyncMutex();
    const executionOrder: number[] = [];

    const task = (id: number, delayMs: number) => {
      return mutex.runExclusive(async () => {
        executionOrder.push(id);
        await new Promise((r) => setTimeout(r, delayMs));
      });
    };

    await Promise.all([task(1, 20), task(2, 10), task(3, 5)]);

    assert.deepEqual(executionOrder, [1, 2, 3], 'Tasks must execute strictly in queued order');
  });

  await t.test('test_f07_failed_switch_releases_mutex', async () => {
    const mutex = new AsyncMutex();
    let secondTaskExecuted = false;

    try {
      await mutex.runExclusive(async () => {
        throw new Error('Simulated database lock error');
      });
    } catch (_) {}

    await mutex.runExclusive(async () => {
      secondTaskExecuted = true;
    });

    assert.equal(secondTaskExecuted, true, 'Mutex must release even after an error');
  });
});
