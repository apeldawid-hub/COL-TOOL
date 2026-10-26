import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Worker } from 'worker_threads';
import initSqlJs from 'sql.js';
import { DatabaseManager, StoreConnectionPool, AsyncMutex } from '../electron/database/db';
import { BackupManager } from '../electron/database/backupManager';

test('Adversarial Challenger: Dynamic Electron Resolution & Multi-Store Concurrency Stress', async (suite) => {
  const SQL = await initSqlJs();

  // =========================================================================
  // SUITE 1: DYNAMIC ELECTRON RESOLUTION CONCURRENCY & THREAD RESILIENCE
  // =========================================================================
  await suite.test('Suite 1: Dynamic Electron Resolution Under Multi-Threaded & Async Concurrency', async (t) => {
    await t.test('test_10_concurrent_worker_threads_import_db_and_backup_manager', async () => {
      const workerCount = 10;
      const workerScriptPath = path.resolve('tests/temp_worker_stress.mjs');

      // Create worker runner script
      fs.writeFileSync(
        workerScriptPath,
        `
        import { parentPort, workerData } from 'worker_threads';
        import fs from 'fs';
        import path from 'path';
        import os from 'os';
        import { DatabaseManager, StoreConnectionPool, AsyncMutex } from '../electron/database/db.ts';
        import { BackupManager } from '../electron/database/backupManager.ts';

        async function runWorker() {
          const workerId = workerData.id;
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_worker_' + workerId + '_'));

          try {
            // Verify core exports are present
            if (!DatabaseManager || !StoreConnectionPool || !AsyncMutex || !BackupManager) {
              throw new Error('Core database exports missing in worker thread ' + workerId);
            }

            // Verify independent instantiation inside worker thread
            const dbMgr = new DatabaseManager(tmpDir);
            await dbMgr.init();

            const pool = new StoreConnectionPool(4);
            const mutex = new AsyncMutex();
            const backupMgr = new BackupManager(tmpDir);

            // Quick transaction in worker
            dbMgr.setAppSetting('worker_thread_id', String(workerId));
            const settings = dbMgr.getAppSettings();
            if (settings['worker_thread_id'] !== String(workerId)) {
              throw new Error('Worker value mismatch: expected ' + workerId + ', got ' + settings['worker_thread_id']);
            }

            dbMgr.getConnectionPool().closeAll();
            pool.closeAll();

            parentPort.postMessage({ workerId, success: true });
          } catch (err) {
            parentPort.postMessage({ workerId, success: false, error: err.stack || err.message });
          } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          }
        }

        runWorker();
        `
      );

      try {
        const promises = Array.from({ length: workerCount }, (_, i) => {
          return new Promise<{ workerId: number; success: boolean; error?: string }>((resolve, reject) => {
            const worker = new Worker(workerScriptPath, {
              workerData: { id: i },
              execArgv: ['--import', 'tsx'],
            });

            worker.on('message', (msg) => resolve(msg));
            worker.on('error', (err) => reject(err));
            worker.on('exit', (code) => {
              if (code !== 0) {
                reject(new Error(`Worker ${i} exited with non-zero code: ${code}`));
              }
            });
          });
        });

        const results = await Promise.all(promises);

        assert.equal(results.length, 10, 'All 10 worker threads must execute to completion');
        for (const res of results) {
          assert.equal(
            res.success,
            true,
            `Worker ${res.workerId} failed with error: ${res.error}`
          );
        }
      } finally {
        if (fs.existsSync(workerScriptPath)) {
          fs.unlinkSync(workerScriptPath);
        }
      }
    });

    await t.test('test_rapid_asynchronous_concurrent_module_reimports', async () => {
      // Stress dynamic resolution mechanism across 50 concurrent dynamic imports with unique query cache busters
      const importPromises = Array.from({ length: 50 }, async (_, i) => {
        const dbModule = await import(`../electron/database/db.ts?bust=${Date.now()}_${i}`);
        assert.ok(dbModule.DatabaseManager, 'DatabaseManager must be exported');
        assert.ok(dbModule.StoreConnectionPool, 'StoreConnectionPool must be exported');
        assert.ok(dbModule.AsyncMutex, 'AsyncMutex must be exported');
        return true;
      });

      const results = await Promise.all(importPromises);
      assert.equal(results.length, 50, 'All 50 concurrent dynamic imports must resolve cleanly');
    });

    await t.test('test_dynamic_electron_fallback_guards', () => {
      // In headless Node.js environment, electron require returns a string path, not an object with app
      // Validate that fallback paths work reliably without crashing
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_fallback_test_'));
      try {
        const dbManager = new DatabaseManager(tmpDir);
        // computeDbFilePath with no app object
        const filePath = dbManager.computeDbFilePath('108120');
        assert.ok(filePath.includes('store_108120.db'));
        assert.ok(filePath.startsWith(tmpDir));

        const backupMgr = new BackupManager(tmpDir);
        const status = backupMgr.getDatabaseStatus('108120');
        assert.ok(status.dbPath.length > 0);
        assert.equal(typeof status.backupsCount, 'number');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // =========================================================================
  // SUITE 2: RAPID MULTI-STORE SWITCHING UNDER ASYNC MUTEX & LRU DIRTY EVICTION
  // =========================================================================
  await suite.test('Suite 2: 50 Concurrent Switches Across 10 Stores with Dirty LRU Eviction', async (t) => {
    const tmpStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_adv_switch_stress_'));

    try {
      const dbManager = DatabaseManager.getInstance(tmpStorageDir);
      await dbManager.init();

      await t.test('test_50_concurrent_switches_strict_serialization_and_dirty_eviction', async () => {
        const switchCount = 50;
        const distinctStoresCount = 10;
        let activeSwitches = 0;
        let maxConcurrentSwitches = 0;

        // Instrument switchMutex to guarantee zero concurrency violations (strictly 1 active at a time)
        const mutex = dbManager.getSwitchMutex();
        const originalRunExclusive = mutex.runExclusive.bind(mutex);
        mutex.runExclusive = async function <T>(fn: () => Promise<T>): Promise<T> {
          return originalRunExclusive(async () => {
            activeSwitches++;
            if (activeSwitches > maxConcurrentSwitches) {
              maxConcurrentSwitches = activeSwitches;
            }
            try {
              return await fn();
            } finally {
              activeSwitches--;
            }
          });
        };

        // Expected transactions per store: storeId -> array of written keys/values
        const expectedTransactions: Map<string, Array<{ key: string; value: string }>> = new Map();
        for (let s = 1; s <= distinctStoresCount; s++) {
          const storeId = `108${String(s).padStart(3, '0')}`;
          expectedTransactions.set(storeId, []);
        }

        // Fire 50 concurrent switch operations
        const switchPromises = Array.from({ length: switchCount }, (_, index) => {
          const storeNum = (index % distinctStoresCount) + 1;
          const storeId = `108${String(storeNum).padStart(3, '0')}`;
          const key = `tx_key_op_${index}`;
          const value = `tx_payload_${index}_timestamp_${Date.now()}`;

          expectedTransactions.get(storeId)!.push({ key, value });

          return (async () => {
            // Asynchronously switch store
            const result = await dbManager.switchStoreDatabase(storeId, {
              name: `Adversarial Starbucks Store ${storeNum}`,
              unitCode: String(18000 + storeNum),
              mpk: storeId,
              city: 'Warszawa',
            });

            assert.equal(result.success, true, `Switch to store [${storeId}] must succeed`);
            assert.equal(result.storeId, storeId);

            // Verify active database handle
            // Retrieve database handle specifically for this store from the pool
            const storeDb = dbManager.getConnectionPool().get(storeId);
            assert.ok(storeDb, `Database handle in pool must exist for store [${storeId}]`);

            // Execute critical write operation directly into this store's in-memory SQLite state
            const stmt = storeDb.prepare(`
              INSERT INTO app_settings (key, value, updated_at)
              VALUES (?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            `);
            stmt.run([key, String(value)]);
            stmt.free();

            // Mark store dirty in pool with a 10s debounce timer so that eviction (or persistAll) flushes to disk
            dbManager.getConnectionPool().markDirty(storeId, 10000);

            // Assert connection pool size <= 8 handles at every step
            const currentPoolSize = dbManager.getConnectionPool().size();
            assert.ok(
              currentPoolSize <= 8,
              `Pool size (${currentPoolSize}) exceeded maximum 8 connections limit during operation ${index}`
            );

            return { index, storeId, key, value };
          })();
        });

        const completedOperations = await Promise.all(switchPromises);

        // 1. Verify concurrency invariant
        assert.equal(completedOperations.length, 50, 'All 50 switch operations must complete');
        assert.equal(
          maxConcurrentSwitches,
          1,
          `Concurrency violation detected! maxConcurrentSwitches must strictly be 1, but observed: ${maxConcurrentSwitches}`
        );
        assert.equal(activeSwitches, 0, 'Active switches must return to 0');

        // 2. Verify pool evictions occurred and flushed dirty writes
        const pool = dbManager.getConnectionPool();
        const evictionLog = pool.evictionLog;
        assert.ok(
          evictionLog.length >= 42,
          `Expected at least 42 pool evictions for 50 switches over 10 stores in an 8-cap pool, got: ${evictionLog.length}`
        );

        // Verify that dirty stores were properly flushed on eviction
        const dirtyFlushes = evictionLog.filter((e) => e.flushed);
        assert.ok(
          dirtyFlushes.length > 0,
          `Expected dirty evictions to trigger flushes, but got 0 flushed out of ${evictionLog.length}`
        );

        // 3. Flush any remaining pooled dirty databases to disk before forensic check
        pool.persistAll();
        dbManager.persist();

        // 4. Forensic disk verification: Read each of the 10 store databases directly from disk using raw SQL.Database
        for (let s = 1; s <= distinctStoresCount; s++) {
          const storeId = `108${String(s).padStart(3, '0')}`;
          const dbFilePath = dbManager.computeDbFilePath(storeId);

          assert.ok(fs.existsSync(dbFilePath), `Database file for [${storeId}] must exist on disk at ${dbFilePath}`);

          const diskBuffer = fs.readFileSync(dbFilePath);
          assert.ok(diskBuffer.length > 0, `Database file for [${storeId}] must be non-empty`);

          const rawDb = new SQL.Database(diskBuffer);
          try {
            // Check PRAGMA integrity
            const integrityRes = rawDb.exec('PRAGMA integrity_check;');
            assert.equal(
              integrityRes[0].values[0][0],
              'ok',
              `PRAGMA integrity_check failed for store [${storeId}] on disk`
            );

            // Verify all expected transactions for this store exist on disk
            const expectedList = expectedTransactions.get(storeId)!;
            assert.ok(expectedList.length >= 5, `Store [${storeId}] must have at least 5 transactions recorded`);

            for (const expected of expectedList) {
              const queryRes = rawDb.exec(
                `SELECT value FROM app_settings WHERE key = '${expected.key}';`
              );
              assert.ok(
                queryRes.length > 0 && queryRes[0].values.length > 0,
                `Data loss detected! Key [${expected.key}] missing on disk for store [${storeId}]`
              );
              assert.equal(
                queryRes[0].values[0][0],
                expected.value,
                `Data corruption detected for key [${expected.key}] in store [${storeId}]`
              );
            }

            // Verify NO cross-store leakage: check that keys from other stores are not present
            for (let otherS = 1; otherS <= distinctStoresCount; otherS++) {
              if (otherS === s) continue;
              const otherStoreId = `108${String(otherS).padStart(3, '0')}`;
              const foreignKeys = expectedTransactions.get(otherStoreId)!;
              for (const foreign of foreignKeys) {
                const leakCheck = rawDb.exec(
                  `SELECT value FROM app_settings WHERE key = '${foreign.key}';`
                );
                assert.equal(
                  leakCheck.length,
                  0,
                  `Cross-store data leakage! Key [${foreign.key}] belonging to store [${otherStoreId}] found in store [${storeId}]`
                );
              }
            }
          } finally {
            rawDb.close();
          }
        }
      });

      await t.test('test_rapid_alternation_between_hot_cache_hits_and_cold_reloads', async () => {
        // Repeatedly cycle between 2 hot stores and 1 cold store in rapid succession
        const storeHotA = '108001';
        const storeHotB = '108002';
        const storeCold = '108099';

        for (let iter = 0; iter < 10; iter++) {
          const resA = await dbManager.switchStoreDatabase(storeHotA);
          assert.equal(resA.success, true);
          assert.equal(dbManager.getCurrentStoreId(), storeHotA);

          const resB = await dbManager.switchStoreDatabase(storeHotB);
          assert.equal(resB.success, true);
          assert.equal(dbManager.getCurrentStoreId(), storeHotB);

          const resCold = await dbManager.switchStoreDatabase(storeCold);
          assert.equal(resCold.success, true);
          assert.equal(dbManager.getCurrentStoreId(), storeCold);
        }

        const pool = dbManager.getConnectionPool();
        assert.ok(pool.size() <= 8);
        assert.ok(pool.has(storeCold));
      });

      await t.test('test_mutex_unhandled_rejection_recovery_under_load', async () => {
        const mutex = dbManager.getSwitchMutex();

        // Launch 10 promises: 5 failing, 5 succeeding interleaved
        const tasks = Array.from({ length: 10 }, (_, i) => {
          return (async () => {
            if (i % 2 === 1) {
              try {
                await mutex.runExclusive(async () => {
                  throw new Error(`Injected failure at index ${i}`);
                });
                assert.fail('Should have thrown');
              } catch (err: any) {
                assert.equal(err.message, `Injected failure at index ${i}`);
                return `caught_${i}`;
              }
            } else {
              return await mutex.runExclusive(async () => {
                return `success_${i}`;
              });
            }
          })();
        });

        const results = await Promise.all(tasks);
        assert.equal(results.length, 10);
        for (let i = 0; i < 10; i++) {
          if (i % 2 === 1) {
            assert.equal(results[i], `caught_${i}`);
          } else {
            assert.equal(results[i], `success_${i}`);
          }
        }
      });
    } finally {
      fs.rmSync(tmpStorageDir, { recursive: true, force: true });
    }
  });
});
