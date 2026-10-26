import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import initSqlJs from 'sql.js';
import { StoreConnectionPool, AsyncMutex, DatabaseManager } from '../../../electron/database/db';

test('Milestone 2 Challenger 1: Adversarial LRU Pool & 50-Concurrent Mutex Stress Testing', async (suite) => {
  const SQL = await initSqlJs();

  // =========================================================================
  // SUITE 1: SHA-256 BINARY MATCH & FORENSIC TABLE PARITY
  // =========================================================================
  await suite.test('Suite 1: SHA-256 Forensic Parity (tplh_forecast.db vs store_108120.db)', async (t) => {
    const legacyPath = path.resolve(process.cwd(), 'data', 'tplh_forecast.db');
    const storePath = path.resolve(process.cwd(), 'data', 'store_108120.db');
    const receiptPath = path.resolve(process.cwd(), 'data', 'legacy_migration_receipt.json');

    await t.test('test_files_exist_on_disk_and_non_empty', () => {
      assert.ok(fs.existsSync(legacyPath), 'Legacy tplh_forecast.db must exist on disk');
      assert.ok(fs.existsSync(storePath), 'Migrated store_108120.db must exist on disk');
      assert.ok(fs.existsSync(receiptPath), 'legacy_migration_receipt.json must exist');

      const statLegacy = fs.statSync(legacyPath);
      const statStore = fs.statSync(storePath);

      assert.equal(statLegacy.size, 397312, 'Legacy file must be exactly 397,312 bytes');
      assert.equal(statStore.size, 397312, 'Store file must be exactly 397,312 bytes');
      assert.equal(statLegacy.size, statStore.size, 'Byte sizes must match exactly');
    });

    await t.test('test_sha256_binary_checksum_identical', () => {
      const legacyBuf = fs.readFileSync(legacyPath);
      const storeBuf = fs.readFileSync(storePath);

      const hashLegacy = crypto.createHash('sha256').update(legacyBuf).digest('hex');
      const hashStore = crypto.createHash('sha256').update(storeBuf).digest('hex');

      assert.equal(hashLegacy, 'e9f16bb64be636fa56ac5e77b8de4ad28beb5e55a5acaf8f068947a5431f511b');
      assert.equal(hashStore, hashLegacy, 'SHA-256 hashes must be byte-for-byte identical');

      const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
      assert.equal(receipt.sha256, hashStore, 'Migration receipt SHA-256 must match active database');
      assert.equal(receipt.bytes, 397312);
    });

    await t.test('test_sqlite_tables_and_record_counts_parity', () => {
      const dbLegacy = new SQL.Database(fs.readFileSync(legacyPath));
      const dbStore = new SQL.Database(fs.readFileSync(storePath));

      try {
        const getTables = (db: any) => {
          const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
          return res.length > 0 ? res[0].values.map((v: any[]) => v[0] as string) : [];
        };

        const tablesLegacy = getTables(dbLegacy);
        const tablesStore = getTables(dbStore);

        assert.ok(tablesLegacy.length > 0, 'Legacy database must contain tables');
        assert.deepEqual(tablesStore, tablesLegacy, 'Tables list must be 100% identical');

        // Check row counts for all tables
        for (const table of tablesLegacy) {
          const countLegacy = Number(dbLegacy.exec(`SELECT COUNT(*) FROM "${table}"`)[0].values[0][0]);
          const countStore = Number(dbStore.exec(`SELECT COUNT(*) FROM "${table}"`)[0].values[0][0]);
          assert.equal(countStore, countLegacy, `Row count mismatch in table [${table}]`);
        }
      } finally {
        dbLegacy.close();
        dbStore.close();
      }
    });
  });

  // =========================================================================
  // SUITE 2: STORE CONNECTION POOL (8-CONN LIMIT, LRU, DIRTY FLUSH, REOPEN)
  // =========================================================================
  await suite.test('Suite 2: StoreConnectionPool Adversarial Stress & Integrity', async (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_pool_stress_'));

    try {
      await t.test('test_lru_pool_8_connection_cap_and_least_recent_eviction', async () => {
        const pool = new StoreConnectionPool(8);
        const closedDbs: string[] = [];

        // Open 8 genuine SQLite databases
        for (let i = 1; i <= 8; i++) {
          const db = new SQL.Database();
          db.run('CREATE TABLE kv (k TEXT, v TEXT);');
          db.run(`INSERT INTO kv VALUES ('store', 'store_${i}');`);
          const filePath = path.join(tmpDir, `store_${i}.db`);
          fs.writeFileSync(filePath, Buffer.from(db.export()));

          // Monkey patch close to track closing
          const origClose = db.close.bind(db);
          db.close = () => {
            closedDbs.push(`store_${i}`);
            origClose();
          };

          pool.put(`store_${i}`, db, filePath, false);
        }

        assert.equal(pool.size(), 8, 'Pool size must be exactly 8');
        assert.equal(closedDbs.length, 0, 'No databases should be closed yet');

        // Allow clock to advance by 10ms so lastAccessed updates are strictly greater than insertion timestamps
        await new Promise((r) => setTimeout(r, 10));

        // Refresh access to store_1 to store_7, leaving store_8 untouched
        for (let i = 1; i <= 7; i++) {
          pool.get(`store_${i}`);
        }

        // Allow another 5ms before adding store_9
        await new Promise((r) => setTimeout(r, 5));

        // Now store_8 has the oldest lastAccessed timestamp
        const db9 = new SQL.Database();
        const path9 = path.join(tmpDir, 'store_9.db');
        const evictRes = pool.put('store_9', db9, path9, false);

        assert.equal(evictRes.evicted, 'store_8', 'store_8 was least recently used and must be evicted');
        assert.equal(pool.size(), 8, 'Pool size must remain strictly 8');
        assert.equal(pool.has('store_8'), false, 'store_8 must be purged from pool');
        assert.equal(pool.has('store_9'), true, 'store_9 must be present');
        assert.ok(closedDbs.includes('store_8'), 'store_8 database handle must be cleanly closed');

        pool.closeAll();
      });

      await t.test('test_lru_pool_dirty_writes_cleanly_flushed_to_disk_on_eviction', () => {
        const pool = new StoreConnectionPool(3);

        const s1Path = path.join(tmpDir, 's1.db');
        const s2Path = path.join(tmpDir, 's2.db');
        const s3Path = path.join(tmpDir, 's3.db');
        const s4Path = path.join(tmpDir, 's4.db');

        // Initialize S1 with table and initial record
        const db1 = new SQL.Database();
        db1.run('CREATE TABLE t (val TEXT);');
        db1.run("INSERT INTO t VALUES ('initial_s1');");
        fs.writeFileSync(s1Path, Buffer.from(db1.export()));
        pool.put('s1', db1, s1Path, false);

        // Put S2 and S3
        const db2 = new SQL.Database();
        fs.writeFileSync(s2Path, Buffer.from(db2.export()));
        pool.put('s2', db2, s2Path, false);

        const db3 = new SQL.Database();
        fs.writeFileSync(s3Path, Buffer.from(db3.export()));
        pool.put('s3', db3, s3Path, false);

        assert.equal(pool.size(), 3);

        // Mutate S1 with new transactions in memory (UNSAVED to disk) and mark dirty
        db1.run("INSERT INTO t VALUES ('DIRTY_TRANSACTION_CRITICAL_PAYROLL');");
        pool.markDirty('s1', 10000); // 10s debounce timer

        const entry1 = pool.getEntry('s1')!;
        assert.equal(entry1.isDirty, true, 'S1 must be flagged dirty');
        assert.ok(entry1.debounceTimer, 'S1 must have pending debounce timer');

        // Touch S2 and S3 so S1 is the oldest LRU candidate
        pool.get('s2');
        pool.get('s3');

        // Add S4 -> forces eviction of S1!
        const db4 = new SQL.Database();
        fs.writeFileSync(s4Path, Buffer.from(db4.export()));
        const evictResult = pool.put('s4', db4, s4Path, false);

        assert.equal(evictResult.evicted, 's1');
        assert.equal(evictResult.flushed, true, 'Eviction of dirty connection must execute dirty flush');

        // Empirically inspect S1 on disk by reading the file independently
        assert.ok(fs.existsSync(s1Path));
        const diskBuf = fs.readFileSync(s1Path);
        const checkDb = new SQL.Database(diskBuf);

        try {
          const res = checkDb.exec('SELECT val FROM t ORDER BY rowid;');
          assert.equal(res[0].values.length, 2, 'Disk file must have both initial and dirty transaction');
          assert.equal(res[0].values[0][0], 'initial_s1');
          assert.equal(res[0].values[1][0], 'DIRTY_TRANSACTION_CRITICAL_PAYROLL');

          // Verify SQLite integrity
          const integrity = checkDb.exec('PRAGMA integrity_check;');
          assert.equal(integrity[0].values[0][0], 'ok', 'Database on disk must pass integrity_check');
        } finally {
          checkDb.close();
        }

        pool.closeAll();
      });

      await t.test('test_lru_pool_churn_under_high_store_turnover', () => {
        // Run 50 different stores through an 8-connection pool
        const pool = new StoreConnectionPool(8);
        const storesCount = 50;

        for (let i = 1; i <= storesCount; i++) {
          const db = new SQL.Database();
          db.run('CREATE TABLE data (id INT);');
          db.run(`INSERT INTO data VALUES (${i});`);
          const fPath = path.join(tmpDir, `churn_${i}.db`);
          fs.writeFileSync(fPath, Buffer.from(db.export()));

          // Mark odd stores dirty, even stores clean
          const isDirty = (i % 2 === 1);
          if (isDirty) {
            db.run(`INSERT INTO data VALUES (${i * 1000});`);
          }

          pool.put(`churn_${i}`, db, fPath, isDirty);

          assert.ok(pool.size() <= 8, `Pool size ${pool.size()} exceeded max limit 8 at step ${i}`);
        }

        assert.equal(pool.size(), 8, 'Final pool size must be exactly 8');
        assert.equal(pool.evictionLog.length, 42, 'Exactly 42 stores must have been evicted (50 - 8)');

        // Verify that evicted odd stores were flushed and have their data on disk
        for (let i = 1; i <= 42; i++) {
          const fPath = path.join(tmpDir, `churn_${i}.db`);
          const db = new SQL.Database(fs.readFileSync(fPath));
          const rows = db.exec('SELECT id FROM data;');
          if (i % 2 === 1) {
            // Odd: was dirty, should have 2 rows
            assert.equal(rows[0].values.length, 2, `Store churn_${i} should have flushed dirty write`);
            assert.equal(rows[0].values[1][0], i * 1000);
          } else {
            // Even: clean, 1 row
            assert.equal(rows[0].values.length, 1);
          }
          db.close();
        }

        pool.closeAll();
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // SUITE 3: ASYNC MUTEX & 50 CONCURRENT SWITCH OPERATIONS
  // =========================================================================
  await suite.test('Suite 3: AsyncMutex & 50 Concurrent switchStoreDatabase Operations', async (t) => {
    const tmpStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_mutex_50_stress_'));

    try {
      const dbManager = DatabaseManager.getInstance(tmpStorageDir);
      await dbManager.init();

      await t.test('test_50_concurrent_switch_operations_concurrency_and_integrity', async () => {
        const switchCount = 50;
        let activeSwitches = 0;
        let maxConcurrentSwitches = 0;
        const switchLog: Array<{ callIndex: number; storeId: string; start: number; end: number }> = [];

        const mutex = dbManager.getSwitchMutex();
        const origRunExclusive = mutex.runExclusive.bind(mutex);
        mutex.runExclusive = async function <T>(fn: () => Promise<T>): Promise<T> {
          return origRunExclusive(async () => {
            activeSwitches++;
            maxConcurrentSwitches = Math.max(maxConcurrentSwitches, activeSwitches);
            try {
              return await fn();
            } finally {
              activeSwitches--;
            }
          });
        };

        // Generate 50 switch calls across 10 rotating stores
        const promises = Array.from({ length: switchCount }, (_, index) => {
          const storeNum = (index % 10) + 1;
          const storeId = `108${String(storeNum).padStart(3, '0')}`;
          const unitCode = String(18000 + storeNum);

          return (async () => {
            const start = Date.now();
            const result = await dbManager.switchStoreDatabase(storeId, {
              name: `Starbucks Test Store ${storeNum}`,
              unitCode,
              mpk: storeId,
              city: 'Warszawa',
            });

            const end = Date.now();
            switchLog.push({ callIndex: index, storeId, start, end });

            // Invariant assertions on switch result
            assert.equal(result.success, true, `Switch call ${index} to [${storeId}] must succeed`);
            assert.equal(result.storeId, storeId);
            assert.ok(result.dbPath.endsWith(`store_${storeId}.db`));

            // Verify db handle is active and healthy
            const currentDb = dbManager.getDb();
            assert.ok(currentDb, 'Database handle must never be null');

            // Quick transaction to test write under switch
            dbManager.setAppSetting(`test_key_${index}`, `val_${index}`);

            return result;
          })();
        });

        const allResults = await Promise.all(promises);

        // Verification of concurrency invariants
        assert.equal(allResults.length, 50, 'All 50 switches must complete');
        assert.equal(
          maxConcurrentSwitches,
          1,
          `Max concurrent switches must strictly be 1 under AsyncMutex, got: ${maxConcurrentSwitches}`
        );

        // Verify pool size after 50 switches
        const pool = dbManager.getConnectionPool();
        assert.ok(
          pool.size() <= 8,
          `Connection pool size (${pool.size()}) must never exceed max 8 handles`
        );

        // Verify active store is the final executed switch
        const finalStoreId = dbManager.getCurrentStoreId();
        assert.ok(finalStoreId.length > 0, 'Active store must be set');

        // Check SQLite integrity check on active store
        const integrity = dbManager.getDb().exec('PRAGMA integrity_check;');
        assert.equal(integrity[0].values[0][0], 'ok', 'Active database must have PRAGMA integrity_check ok');

        // Check integrity on all 10 store databases on disk
        for (let i = 1; i <= 10; i++) {
          const storeId = `108${String(i).padStart(3, '0')}`;
          const dbPath = dbManager.computeDbFilePath(storeId);
          if (fs.existsSync(dbPath)) {
            const diskBuf = fs.readFileSync(dbPath);
            const checkDb = new SQL.Database(diskBuf);
            const pragmaRes = checkDb.exec('PRAGMA integrity_check;');
            assert.equal(
              pragmaRes[0].values[0][0],
              'ok',
              `Database file [${dbPath}] must be completely uncorrupted`
            );
            checkDb.close();
          }
        }
      });

      await t.test('test_async_mutex_recovers_cleanly_from_injected_rejection', async () => {
        const mutex = dbManager.getSwitchMutex();
        let errorCaught = false;

        try {
          await mutex.runExclusive(async () => {
            throw new Error('Simulated disk full or I/O failure');
          });
        } catch (e: any) {
          errorCaught = true;
          assert.equal(e.message, 'Simulated disk full or I/O failure');
        }

        assert.equal(errorCaught, true);

        // Subsequent operation must run cleanly without deadlocking
        let subsequentCompleted = false;
        await mutex.runExclusive(async () => {
          subsequentCompleted = true;
        });

        assert.equal(subsequentCompleted, true, 'Mutex must not deadlock after an unhandled exception');
      });
    } finally {
      fs.rmSync(tmpStorageDir, { recursive: true, force: true });
    }
  });
});
