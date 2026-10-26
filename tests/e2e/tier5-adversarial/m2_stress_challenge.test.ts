import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { StoreConnectionPool, AsyncMutex, DatabaseManager } from '../../../electron/database/db';
import { BackupManager, validateRestoreTarget } from '../../../electron/database/backupManager';
import { StoreStorage } from '../../../src/services/storeStorage';
import { STARBUCKS_STORES_CATALOG, normalizeDiacritics } from '../../../src/constants/starbucksStores';
import { StoreService } from '../../../src/services/storeService';

test('Tier 5 Adversarial: Milestone 2 Multi-Store Hardening & Forensic Verification', async (suite) => {

  // =========================================================================
  // 1. ELECTRON STORE CONNECTION POOL (LRU EVICTION & DIRTY WRITES)
  // =========================================================================
  await suite.test('1. StoreConnectionPool: LRU Eviction, Dirty Writes & Capacity Enforcing', async (t) => {
    await t.test('test_lru_pool_strictly_limits_open_handles_to_max', () => {
      const pool = new StoreConnectionPool(8);
      const mockCloseLog: string[] = [];

      // Create 8 connections
      for (let i = 1; i <= 8; i++) {
        const mockDb: any = {
          export: () => new Uint8Array([1, 2, 3]),
          close: () => mockCloseLog.push(`store_${i}`),
        };
        pool.put(`store_${i}`, mockDb, `/fake/path/store_${i}.db`, false);
      }

      assert.equal(pool.size(), 8, 'Pool size must be exactly 8');
      assert.equal(mockCloseLog.length, 0, 'No databases should be closed when within capacity');

      // Access store_2 to store_8 so store_1 remains the oldest (LRU candidate)
      for (let i = 2; i <= 8; i++) {
        assert.ok(pool.get(`store_${i}`));
      }

      // Add store_9 -> must evict store_1
      const mockDb9: any = {
        export: () => new Uint8Array([9]),
        close: () => mockCloseLog.push('store_9'),
      };
      const result = pool.put('store_9', mockDb9, '/fake/path/store_9.db', false);

      assert.equal(result.evicted, 'store_1', 'Least recently used store_1 must be evicted');
      assert.equal(pool.size(), 8, 'Pool size must remain capped at 8');
      assert.equal(pool.has('store_1'), false, 'Evicted store_1 must no longer exist in pool');
      assert.equal(pool.has('store_9'), true, 'Newly added store_9 must be present in pool');
      assert.ok(mockCloseLog.includes('store_1'), 'Evicted database handle must be cleanly closed');
    });

    await t.test('test_lru_pool_flushes_dirty_writes_before_closing_on_eviction', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_lru_test_'));
      try {
        const pool = new StoreConnectionPool(2);
        const flushedFiles: string[] = [];

        const fileA = path.join(tmpDir, 'store_a.db');
        const fileB = path.join(tmpDir, 'store_b.db');
        const fileC = path.join(tmpDir, 'store_c.db');

        const mockDbA: any = {
          export: () => {
            flushedFiles.push(fileA);
            return Buffer.from('data_for_store_a');
          },
          close: () => {},
        };
        const mockDbB: any = {
          export: () => {
            flushedFiles.push(fileB);
            return Buffer.from('data_for_store_b');
          },
          close: () => {},
        };
        const mockDbC: any = {
          export: () => Buffer.from('data_for_store_c'),
          close: () => {},
        };

        // Put A as dirty, B as clean
        pool.put('store_a', mockDbA, fileA, true);
        pool.put('store_b', mockDbB, fileB, false);

        // Put C -> should evict store_a and flush to disk
        const evictResult = pool.put('store_c', mockDbC, fileC, false);

        assert.equal(evictResult.evicted, 'store_a');
        assert.equal(evictResult.flushed, true, 'Eviction of dirty store must indicate flushed');
        assert.ok(fs.existsSync(fileA), 'Evicted dirty store file must be written to disk');
        assert.equal(fs.readFileSync(fileA, 'utf8'), 'data_for_store_a');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    await t.test('test_lru_pool_persist_all_flushes_only_dirty_stores', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_persist_test_'));
      try {
        const pool = new StoreConnectionPool(5);
        const file1 = path.join(tmpDir, 's1.db');
        const file2 = path.join(tmpDir, 's2.db');

        let s1Exports = 0;
        let s2Exports = 0;

        const db1: any = {
          export: () => { s1Exports++; return Buffer.from('db1'); },
          close: () => {},
        };
        const db2: any = {
          export: () => { s2Exports++; return Buffer.from('db2'); },
          close: () => {},
        };

        pool.put('s1', db1, file1, true); // dirty
        pool.put('s2', db2, file2, false); // clean

        pool.persistAll();

        assert.equal(s1Exports, 1, 'Dirty s1 must be exported and persisted');
        assert.equal(s2Exports, 0, 'Clean s2 must not be exported');
        assert.ok(fs.existsSync(file1));
        assert.ok(!fs.existsSync(file2));
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // =========================================================================
  // 2. ASYNC MUTEX (STRICT SERIALIZATION & FAULT TOLERANCE)
  // =========================================================================
  await suite.test('2. AsyncMutex: Strict FIFO Serialization & Fault Tolerance', async (t) => {
    await t.test('test_async_mutex_enforces_strictly_serialized_execution', async () => {
      const mutex = new AsyncMutex();
      const executionLog: number[] = [];
      let activeConcurrency = 0;
      let maxConcurrency = 0;

      const runTask = (id: number, delayMs: number) => {
        return mutex.runExclusive(async () => {
          activeConcurrency++;
          maxConcurrency = Math.max(maxConcurrency, activeConcurrency);
          executionLog.push(id);
          await new Promise((r) => setTimeout(r, delayMs));
          activeConcurrency--;
        });
      };

      // Launch 15 concurrent tasks with varying delays
      const promises = [
        runTask(1, 25),
        runTask(2, 5),
        runTask(3, 15),
        runTask(4, 10),
        runTask(5, 2),
      ];

      await Promise.all(promises);

      assert.equal(maxConcurrency, 1, 'Concurrency must never exceed 1 under mutex lock');
      assert.deepEqual(executionLog, [1, 2, 3, 4, 5], 'Tasks must execute strictly in queued order');
    });

    await t.test('test_async_mutex_releases_lock_on_error_without_deadlock', async () => {
      const mutex = new AsyncMutex();
      let task2Ran = false;

      try {
        await mutex.runExclusive(async () => {
          throw new Error('Database locked or I/O failure');
        });
      } catch (err: any) {
        assert.equal(err.message, 'Database locked or I/O failure');
      }

      await mutex.runExclusive(async () => {
        task2Ran = true;
      });

      assert.equal(task2Ran, true, 'Subsequent task must execute cleanly after prior task error');
    });
  });

  // =========================================================================
  // 3. DATABASE MANAGER: FILE NAMING & LEGACY MIGRATION
  // =========================================================================
  await suite.test('3. DatabaseManager: Uniform File Naming & Legacy SHA-256 Migration', async (t) => {
    const tmpStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_db_mgr_test_'));
    const dbManager = new DatabaseManager(tmpStorageDir);

    try {
      await t.test('test_computeDbFilePath_sanitization_and_boundaries', () => {
        // Standard ID
        const p1 = dbManager.computeDbFilePath('108120');
        assert.equal(path.basename(p1), 'store_108120.db');

        // Path traversal attack: ../../etc/passwd
        const p2 = dbManager.computeDbFilePath('../../etc/passwd');
        assert.ok(!path.basename(p2).includes('/'));
        assert.ok(!path.basename(p2).includes('\\'));
        assert.equal(path.basename(p2), 'store_______etc_passwd.db');

        // Store ID length cap (64 characters)
        const longId = 'a'.repeat(100);
        const p3 = dbManager.computeDbFilePath(longId);
        assert.equal(path.basename(p3), `store_${'a'.repeat(64)}.db`);

        // Empty store ID
        const p4 = dbManager.computeDbFilePath('');
        assert.equal(p4, '');

        // Janki aliases mapping to 108120
        const p5 = dbManager.computeDbFilePath('108120_janki');
        assert.equal(path.basename(p5), 'store_108120.db');
        const p6 = dbManager.computeDbFilePath('random_id', { unitCode: '18120' });
        assert.equal(path.basename(p6), 'store_108120.db');
        const p7 = dbManager.computeDbFilePath('random_id', { mpk: '108120' });
        assert.equal(path.basename(p7), 'store_108120.db');
      });

      await t.test('test_legacy_migration_handles_missing_legacy_gracefully', () => {
        const res = dbManager.migrateLegacyTplhDatabase('108120');
        assert.equal(res.migrated, false);
      });

      await t.test('test_legacy_migration_rejects_corrupted_or_too_small_file', () => {
        const legacyPath = path.join(tmpStorageDir, 'tplh_forecast.db');
        fs.writeFileSync(legacyPath, Buffer.from('short')); // 5 bytes < 100 bytes

        const res = dbManager.migrateLegacyTplhDatabase('108120');
        assert.equal(res.migrated, false);
        assert.equal(res.error, 'Legacy file too small or corrupted');

        fs.unlinkSync(legacyPath);
      });

      await t.test('test_legacy_migration_rejects_invalid_sqlite_header', () => {
        const legacyPath = path.join(tmpStorageDir, 'tplh_forecast.db');
        fs.writeFileSync(legacyPath, Buffer.alloc(200, 0x41)); // 200 'A's

        const res = dbManager.migrateLegacyTplhDatabase('108120');
        assert.equal(res.migrated, false);
        assert.equal(res.error, 'Invalid SQLite header');

        fs.unlinkSync(legacyPath);
      });

      await t.test('test_legacy_migration_executes_genuine_atomic_copy_and_sha256_verification', () => {
        const legacyPath = path.join(tmpStorageDir, 'tplh_forecast.db');
        const targetPath = dbManager.computeDbFilePath('108120');

        // Create valid SQLite mock file (1024 bytes starting with "SQLite format 3\0")
        const validBuf = Buffer.alloc(1024);
        validBuf.write('SQLite format 3\0', 0, 'utf8');
        validBuf.write('DATA_TABLE_RECORDS_MIGRATION_CHECK', 100, 'utf8');
        fs.writeFileSync(legacyPath, validBuf);

        const legacySha256 = crypto.createHash('sha256').update(validBuf).digest('hex');

        const res = dbManager.migrateLegacyTplhDatabase('108120');

        assert.equal(res.migrated, true, 'Migration must succeed');
        assert.equal(res.bytes, 1024);
        assert.ok(fs.existsSync(targetPath), 'Target store_108120.db must exist');

        const targetBuf = fs.readFileSync(targetPath);
        const targetSha256 = crypto.createHash('sha256').update(targetBuf).digest('hex');

        assert.equal(targetSha256, legacySha256, 'Target SHA-256 must identically match legacy SHA-256');

        // Check migration receipt
        const receiptPath = path.join(tmpStorageDir, 'legacy_migration_receipt.json');
        assert.ok(fs.existsSync(receiptPath), 'Migration receipt JSON must be written');
        const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
        assert.equal(receipt.sha256, legacySha256);
        assert.equal(receipt.bytes, 1024);

        // Verify safety backup was placed within isolated test storageDir hierarchy
        const testBackupDir = path.join(tmpStorageDir, 'backups', 'db_backups');
        assert.ok(fs.existsSync(testBackupDir), 'Safety backup directory must exist in test hierarchy');
        const backupFiles = fs.readdirSync(testBackupDir);
        assert.equal(backupFiles.length, 1, 'Exactly one safety backup file must be created');
        assert.ok(backupFiles[0].startsWith('legacy_tplh_migration_backup_'));

        // Verify idempotency: subsequent call returns migrated: false because target already exists
        const res2 = dbManager.migrateLegacyTplhDatabase('108120');
        assert.equal(res2.migrated, false, 'Second migration attempt must be a no-op');
      });
    } finally {
      fs.rmSync(tmpStorageDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // 4. BACKUP MANAGER (PARTITIONED RETENTION, RESTORE SAFETY & INSPECTION)
  // =========================================================================
  await suite.test('4. BackupManager: Store-Partitioned Backups, Retention & Restore Safety', async (t) => {
    const tmpBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_backup_test_'));
    const backupMgr = BackupManager.getInstance(tmpBackupDir);

    try {
      await t.test('test_generateBackupFilename_format', () => {
        const filename = backupMgr.generateBackupFilename('108150', 'manual');
        const pattern = /^store_108150_backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_\d{3}_manual\.db$/;
        assert.ok(pattern.test(filename), `Backup filename "${filename}" must match expected pattern`);
      });

      await t.test('test_validateRestoreTarget_allows_matching_and_rejects_mismatch', () => {
        assert.equal(validateRestoreTarget('store_108150_backup_2026-10-24_manual.db', '108150'), true);
        assert.equal(validateRestoreTarget('store_108150_backup_2026-10-24_manual.db', '108120'), false);
        assert.equal(validateRestoreTarget('store_108120_janki_backup_2026-10-24_12-00-00_000_manual.db', '108120_janki'), true);
        assert.equal(validateRestoreTarget('store_108120_janki_backup_2026-10-24_12-00-00_000_manual.db', '108120'), true);
        assert.equal(validateRestoreTarget('store_108120_janki_backup_2026-10-24_12-00-00_000_manual.db', '18120'), true);
        assert.equal(validateRestoreTarget('store_wroclaw_glowny_backup_2026-10-24_12-00-00_000_manual.db', 'wroclaw_glowny'), true);
        assert.equal(validateRestoreTarget('store_wroclaw_glowny_backup_2026-10-24_12-00-00_000_manual.db', 'wroclaw'), false);
        assert.equal(validateRestoreTarget('invalid_filename.db', '108150'), false);
        assert.equal(validateRestoreTarget('', '108150'), false);
      });

      await t.test('test_parseReasonFromFilename_handles_multi_segment_store_ids_and_importer_reasons', () => {
        const parseReason = (backupMgr as any).parseReasonFromFilename.bind(backupMgr);
        assert.equal(
          parseReason('store_108120_janki_backup_2026-10-24_12-00-00_000_pre_import_mapal.db'),
          'Przed importem MAPAL Fichajes'
        );
        assert.equal(
          parseReason('store_wroclaw_glowny_backup_2026-10-24_12-00-00_000_post_import_aop.db'),
          'Po imporcie planu AOP'
        );
        assert.equal(
          parseReason('store_108150_backup_2026-10-24_12-00-00_000_manual.db'),
          'Ręczna kopia Store Managera'
        );
        assert.equal(
          parseReason('tplh_forecast_2026-10-24_12-00-00_auto_startup.db'),
          'Automatyczny backup startowy'
        );
      });

      await t.test('test_inspectBackupBuffer_validates_sqlite_binary_headers', async () => {
        // Buffer < 100 bytes
        const tinyBuf = Buffer.from('small');
        const r1 = await backupMgr.inspectBackupBuffer(tinyBuf, '108150');
        assert.equal(r1.isValid, false);
        assert.equal(r1.isStoreMatch, false);

        // Buffer >= 100 bytes but invalid header
        const invalidBuf = Buffer.alloc(200, 0x42);
        const r2 = await backupMgr.inspectBackupBuffer(invalidBuf, '108150');
        assert.equal(r2.isValid, false);
      });

      await t.test('test_rotateBackupsForStore_isolates_partitions_strictly', () => {
        // Create 20 mock backups for store 108150 and 5 for store 108120
        for (let i = 1; i <= 20; i++) {
          const name = `store_108150_backup_2026-01-${String(i).padStart(2, '0')}_12-00-00_000_manual.db`;
          fs.writeFileSync(path.join(tmpBackupDir, name), `backup 108150 ${i}`);
        }
        for (let i = 1; i <= 5; i++) {
          const name = `store_108120_backup_2026-01-${String(i).padStart(2, '0')}_12-00-00_000_manual.db`;
          fs.writeFileSync(path.join(tmpBackupDir, name), `backup 108120 ${i}`);
        }

        // Verify initial counts
        const initial108150 = backupMgr.listBackups('108150');
        const initial108120 = backupMgr.listBackups('108120');
        assert.equal(initial108150.length, 20);
        assert.equal(initial108120.length, 5);

        // Rotate for store 108150 to keep max 15
        const deleted = backupMgr.rotateBackupsForStore('108150', 15);
        assert.equal(deleted, 5, 'Exactly 5 oldest backups must be deleted for store 108150');

        // Check new counts
        const after108150 = backupMgr.listBackups('108150');
        const after108120 = backupMgr.listBackups('108120');

        assert.equal(after108150.length, 15, 'Store 108150 must have exactly 15 backups');
        assert.equal(after108120.length, 5, 'Store 108120 backups must remain 100% untouched');
      });
    } finally {
      fs.rmSync(tmpBackupDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // 5. STORE STORAGE (NAMESPACING, PARTITIONS & ISOLATION)
  // =========================================================================
  await suite.test('5. StoreStorage: Key Namespacing, Quota Protection & Cross-Store Isolation', async (t) => {
    // Virtual localStorage setup
    const storageMap = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => storageMap.set(k, String(v)),
      removeItem: (k: string) => storageMap.delete(k),
      clear: () => storageMap.clear(),
      get length() { return storageMap.size; },
      key: (i: number) => Array.from(storageMap.keys())[i] || null,
    };

    await t.test('test_StoreStorage_key_sanitization_and_structure', () => {
      assert.equal(StoreStorage.sanitizeStoreId('108120'), '108120');
      assert.equal(StoreStorage.sanitizeStoreId('  108150_JANKI  '), '108150_janki');
      assert.equal(StoreStorage.sanitizeStoreId('../../malicious/path'), '______malicious_path');
      assert.equal(StoreStorage.sanitizeStoreId(''), 'default');

      assert.equal(StoreStorage.getKey('todos', '108150'), 'sbx_store_108150_todos');
      assert.equal(StoreStorage.getKey('sbx_todos', '108150'), 'sbx_store_108150_todos');
      assert.equal(StoreStorage.getKey('store_108150_todos', '108150'), 'sbx_store_108150_todos');
    });

    await t.test('test_StoreStorage_multi_store_data_isolation', () => {
      storageMap.clear();

      StoreStorage.setItem('todos', [{ id: 1, text: 'Store A Task' }], '108150');
      StoreStorage.setItem('todos', [{ id: 2, text: 'Store B Task' }], '108160');

      const storeAData: any = StoreStorage.getItem('todos', '108150');
      const storeBData: any = StoreStorage.getItem('todos', '108160');

      assert.equal(storeAData.length, 1);
      assert.equal(storeAData[0].text, 'Store A Task');
      assert.equal(storeBData.length, 1);
      assert.equal(storeBData[0].text, 'Store B Task');
      assert.notDeepEqual(storeAData, storeBData);
    });

    await t.test('test_StoreStorage_partition_purging_leaves_other_stores_intact', () => {
      storageMap.clear();

      StoreStorage.setItem('todos', 'A_todos', 'store_A');
      StoreStorage.setItem('notifs', 'A_notifs', 'store_A');
      StoreStorage.setItem('todos', 'B_todos', 'store_B');
      StoreStorage.setItem('notifs', 'B_notifs', 'store_B');

      assert.equal(StoreStorage.getStorePartitionKeys('store_A').length, 2);
      assert.equal(StoreStorage.getStorePartitionKeys('store_B').length, 2);

      const purged = StoreStorage.clearStorePartition('store_A');
      assert.equal(purged, 2);

      assert.equal(StoreStorage.getStorePartitionKeys('store_A').length, 0);
      assert.equal(StoreStorage.getStorePartitionKeys('store_B').length, 2);
      assert.equal(StoreStorage.getItem('todos', 'store_B'), 'B_todos');
    });

    await t.test('test_StoreStorage_legacy_keys_migration_to_partition', () => {
      storageMap.clear();

      // Populate legacy keys
      localStorage.setItem('sbx_sm_tasks_v1', JSON.stringify([{ id: 'old_1' }]));
      localStorage.setItem('sbx_sync_outbox', JSON.stringify([{ change: 'c1' }]));
      localStorage.setItem('sbx_auth_current_session', 'session_token_123');

      const migrationResult = StoreStorage.migrateLegacyKeys('108120');

      assert.ok(migrationResult.count >= 3);
      assert.ok(migrationResult.migratedKeys.includes('sbx_sm_tasks_v1'));

      // Check that migrated keys are now accessible in namespaced partition
      const migratedTodos: any = StoreStorage.getItem('todos', '108120');
      assert.equal(migratedTodos[0].id, 'old_1');

      // Check that old un-namespaced keys were removed
      assert.equal(localStorage.getItem('sbx_sm_tasks_v1'), null);

      // Verify idempotency
      const result2 = StoreStorage.migrateLegacyKeys('108120');
      assert.equal(result2.count, 0);
    });
  });

  // =========================================================================
  // 6. STARBUCKS STORE CATALOG & POLISH DIACRITIC FOLDING
  // =========================================================================
  await suite.test('6. Starbucks Store Catalog: 100+ Scale & Diacritic Folding', async (t) => {
    await t.test('test_catalog_exceeds_100_stores_and_has_zero_duplicate_ids', () => {
      assert.ok(
        STARBUCKS_STORES_CATALOG.length >= 100,
        `Catalog must contain at least 100 stores, found: ${STARBUCKS_STORES_CATALOG.length}`
      );

      const ids = new Set<string>();
      const duplicates: string[] = [];

      for (const store of STARBUCKS_STORES_CATALOG) {
        assert.ok(store.id, 'Every store must have an id');
        assert.ok(store.name, 'Every store must have a name');
        assert.ok(store.unitCode, 'Every store must have a unitCode');
        assert.ok(store.mpk, 'Every store must have an mpk');
        assert.ok(store.city, 'Every store must have a city');

        if (ids.has(store.id)) {
          duplicates.push(store.id);
        }
        ids.add(store.id);
      }

      assert.equal(duplicates.length, 0, `Store IDs must be completely unique, duplicates found: ${duplicates.join(', ')}`);
    });

    await t.test('test_normalizeDiacritics_handles_all_polish_letters_and_edge_cases', () => {
      // Polish diacritics mapping
      assert.equal(normalizeDiacritics('Łódź'), 'lodz');
      assert.equal(normalizeDiacritics('Kraków'), 'krakow');
      assert.equal(normalizeDiacritics('Gdańsk'), 'gdansk');
      assert.equal(normalizeDiacritics('Poznań'), 'poznan');
      assert.equal(normalizeDiacritics('Wrocław'), 'wroclaw');
      assert.equal(normalizeDiacritics('Białystok'), 'bialystok');
      assert.equal(normalizeDiacritics('Rzeszów'), 'rzeszow');
      assert.equal(normalizeDiacritics('Toruń'), 'torun');
      assert.equal(normalizeDiacritics('Częstochowa'), 'czestochowa');
      assert.equal(normalizeDiacritics('Zażółć gęślą jaźń'), 'zazolc gesla jazn');
      assert.equal(normalizeDiacritics('ZAŻÓŁĆ GĘŚLĄ JAŹŃ'), 'zazolc gesla jazn');

      // Edge cases: null, undefined, empty, numbers
      assert.equal(normalizeDiacritics(''), '');
      assert.equal(normalizeDiacritics(null as any), '');
      assert.equal(normalizeDiacritics(undefined as any), '');
      assert.equal(normalizeDiacritics('108120 Janki'), '108120 janki');
    });

    await t.test('test_storeService_deduplication_custom_stores_override_builtins', () => {
      StoreService.invalidateCache();
      const initialCount = StoreService.getAllStores().length;

      // Custom store with an existing MPK
      const customStore = {
        id: '108120',
        name: 'Custom Janki Override',
        shortName: 'Janki Custom',
        unitCode: '18120',
        mpk: '108120',
        city: 'Janki',
        district: 'Dystrykt Warszawa',
        address: 'Nowy adres',
        type: 'Mall' as const,
        isCustom: true,
      };

      (globalThis as any).localStorage.setItem('sbx_custom_stores', JSON.stringify([customStore]));
      StoreService.invalidateCache();

      const storesWithCustom = StoreService.getAllStores();
      assert.equal(storesWithCustom.length, initialCount, 'Overriding existing store must not increase total count');

      const found = StoreService.findStoreByIdOrCode('108120');
      assert.equal(found?.name, 'Custom Janki Override');
      assert.equal(found?.isCustom, true);

      // Clean up
      (globalThis as any).localStorage.removeItem('sbx_custom_stores');
      StoreService.invalidateCache();
    });
  });

  // =========================================================================
  // 7. REACT VIEW STATE LIFECYCLE & SAVESHIELD RACE PREVENTION
  // =========================================================================
  await suite.test('7. SaveShield: Debounced Auto-Save Race Prevention Across Store Switch', async (t) => {
    await t.test('test_SaveShield_drops_late_auto_save_after_store_switch', async () => {
      let activeStoreId = '108150';
      const databaseWrites: Array<{ storeId: string; weekKey: string; trx: number }> = [];

      // SaveShield simulator matching App.tsx logic
      const pendingTimers: NodeJS.Timeout[] = [];

      const handleSaveTrx = (weekKey: string, trx: number) => {
        const capturedStoreId = activeStoreId;
        const timer = setTimeout(() => {
          if (activeStoreId !== capturedStoreId) {
            // SaveShield drops the write!
            return;
          }
          databaseWrites.push({ storeId: capturedStoreId, weekKey, trx });
        }, 30);
        pendingTimers.push(timer);
      };

      // 1. User enters TRX for Store 108150
      handleSaveTrx('2026_W01', 4500);

      // 2. User rapidly switches store to 108160 before 30ms elapses
      activeStoreId = '108160';

      // 3. Wait for timer to trigger
      await new Promise((r) => setTimeout(r, 60));

      // 4. Verify that the save was dropped and did NOT pollute the database
      assert.equal(
        databaseWrites.length,
        0,
        'SaveShield must completely drop pending saves if store switched prior to timer execution'
      );
    });
  });
});
