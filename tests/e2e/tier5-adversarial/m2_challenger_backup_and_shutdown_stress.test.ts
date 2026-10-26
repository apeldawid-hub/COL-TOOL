import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import initSqlJs from 'sql.js';
import { BackupManager, validateRestoreTarget } from '../../../electron/database/backupManager';
import { StoreConnectionPool, DatabaseManager } from '../../../electron/database/db';

test('Milestone 2 Challenger 2: Adversarial Multi-Underscore Store IDs, Cross-Store Isolation & Shutdown Dirty Flush', async (suite) => {
  const SQL = await initSqlJs();

  // Baseline workspace backup directory check to guarantee zero pollution
  const workspaceBackupDir = path.resolve(process.cwd(), 'backups', 'db_backups');
  const baselineWorkspaceFiles = fs.existsSync(workspaceBackupDir)
    ? new Set(fs.readdirSync(workspaceBackupDir))
    : new Set<string>();

  // =========================================================================
  // SUITE 1: MULTI-UNDERSCORE STORE IDS REGEX & LISTING
  // =========================================================================
  await suite.test('Suite 1: Multi-Underscore Store IDs in Backup Regex & Listing', async (t) => {
    const tmpBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_challenger2_backup_'));
    BackupManager.resetInstanceForTesting();
    const backupMgr = BackupManager.getInstance(tmpBackupDir);
    const listBackupsForStore = (storeId: string) => backupMgr.listBackups(storeId);

    try {
      // 1.1 Regex validation with validateRestoreTarget
      await t.test('test_validateRestoreTarget_multi_underscore_store_ids', () => {
        const pkpFilename = 'store_wroclaw_glowny_pkp_backup_2026-10-24_10-00-00_123_pre_import_mapal.db';

        // Must accept exact match
        assert.equal(
          validateRestoreTarget(pkpFilename, 'wroclaw_glowny_pkp'),
          true,
          'Multi-underscore store ID wroclaw_glowny_pkp must validate successfully'
        );

        // Must accept case-insensitive match
        assert.equal(
          validateRestoreTarget(pkpFilename, 'WROCLAW_GLOWNY_PKP'),
          true,
          'Case-insensitive comparison must succeed for multi-underscore store ID'
        );

        // Additional complex multi-underscore and hyphenated store IDs
        const complexFilenames = [
          { file: 'store_sbx_108_waw_centrum_backup_2026-10-24_10-00-00_123_manual.db', target: 'sbx_108_waw_centrum' },
          { file: 'store_poznan_stary_browar_pasa_backup_2026-10-24_10-00-00_123_post_import_aop.db', target: 'poznan_stary_browar_pasa' },
          { file: 'store_gdansk_glowny_dworzec_backup_2026-10-24_10-00-00_123_auto_startup.db', target: 'gdansk_glowny_dworzec' },
          { file: 'store_wroclaw-airport-terminal_backup_2026-10-24_10-00-00_123_manual.db', target: 'wroclaw-airport-terminal' },
        ];

        for (const { file, target } of complexFilenames) {
          assert.equal(
            validateRestoreTarget(file, target),
            true,
            `Multi-underscore target "${target}" must match backup file "${file}"`
          );
        }
      });

      // 1.2 Multi-underscore store backup listing and reason formatting
      await t.test('test_listBackups_filters_multi_underscore_store_ids_cleanly', () => {
        // Create genuine minimal SQLite database files in tmp directory
        const sampleDb = new SQL.Database();
        sampleDb.run('CREATE TABLE info (k TEXT, v TEXT);');
        const dbBinary = Buffer.from(sampleDb.export());
        sampleDb.close();

        const testFiles = [
          'store_wroclaw_glowny_pkp_backup_2026-10-24_10-00-00_123_pre_import_mapal.db',
          'store_wroclaw_glowny_backup_2026-10-24_10-00-00_123_pre_import_aop.db',
          'store_wroclaw_backup_2026-10-24_10-00-00_123_manual.db',
          'store_wroclaw_airport_backup_2026-10-24_10-00-00_123_post_import_schedules.db',
          'store_krakow_galeria_krakowska_backup_2026-10-24_10-00-00_123_pre_import_daily_kpi.db',
          'store_108120_janki_backup_2026-10-24_10-00-00_123_pre_vacuum.db',
        ];

        for (const filename of testFiles) {
          fs.writeFileSync(path.join(tmpBackupDir, filename), dbBinary);
        }

        // Test listBackupsForStore('wroclaw_glowny_pkp')
        const pkpBackups = listBackupsForStore('wroclaw_glowny_pkp');
        assert.equal(pkpBackups.length, 1, 'Should find exactly 1 backup for wroclaw_glowny_pkp');
        assert.equal(pkpBackups[0].filename, 'store_wroclaw_glowny_pkp_backup_2026-10-24_10-00-00_123_pre_import_mapal.db');
        assert.equal(pkpBackups[0].storeId, 'wroclaw_glowny_pkp');
        assert.equal(pkpBackups[0].reason, 'Przed importem MAPAL Fichajes');
        assert.equal(validateRestoreTarget(pkpBackups[0].filename, 'wroclaw_glowny_pkp'), true);

        // Test listBackupsForStore('wroclaw_glowny')
        const glownyBackups = listBackupsForStore('wroclaw_glowny');
        assert.equal(glownyBackups.length, 1, 'Should find exactly 1 backup for wroclaw_glowny');
        assert.equal(glownyBackups[0].filename, 'store_wroclaw_glowny_backup_2026-10-24_10-00-00_123_pre_import_aop.db');
        assert.equal(glownyBackups[0].storeId, 'wroclaw_glowny');
        assert.equal(glownyBackups[0].reason, 'Przed importem planu AOP');

        // Test listBackupsForStore('wroclaw')
        const wroclawBackups = listBackupsForStore('wroclaw');
        assert.equal(wroclawBackups.length, 1, 'Should find exactly 1 backup for wroclaw (no prefix capture)');
        assert.equal(wroclawBackups[0].filename, 'store_wroclaw_backup_2026-10-24_10-00-00_123_manual.db');
        assert.equal(wroclawBackups[0].storeId, 'wroclaw');
        assert.equal(wroclawBackups[0].reason, 'Ręczna kopia Store Managera');

        // Test listBackupsForStore('wroclaw_airport')
        const airportBackups = listBackupsForStore('wroclaw_airport');
        assert.equal(airportBackups.length, 1, 'Should find exactly 1 backup for wroclaw_airport');
        assert.equal(airportBackups[0].reason, 'Po imporcie grafików');

        // Test listBackupsForStore('krakow_galeria_krakowska')
        const krakowBackups = listBackupsForStore('krakow_galeria_krakowska');
        assert.equal(krakowBackups.length, 1, 'Should find exactly 1 backup for krakow_galeria_krakowska');
        assert.equal(krakowBackups[0].reason, 'Przed importem dziennych KPI');

        // Test Janki alias compatibility
        const jankiBackups108120 = listBackupsForStore('108120');
        assert.equal(jankiBackups108120.length, 1, '108120 query must find 108120_janki backup');
        const jankiBackups18120 = listBackupsForStore('18120');
        assert.equal(jankiBackups18120.length, 1, '18120 query must find 108120_janki backup');
      });
    } finally {
      BackupManager.resetInstanceForTesting();
      fs.rmSync(tmpBackupDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // SUITE 2: CROSS-STORE PROTECTION & COLLISION REJECTION
  // =========================================================================
  await suite.test('Suite 2: Cross-Store Protection & Prefix Collision Rejection', async (t) => {
    await t.test('test_validateRestoreTarget_rejects_cross_store_and_prefix_substrings', () => {
      const glownyFilename = 'store_wroclaw_glowny_backup_2026-10-24_10-00-00_123_manual.db';
      const pkpFilename = 'store_wroclaw_glowny_pkp_backup_2026-10-24_10-00-00_123_pre_import_mapal.db';

      // 1. Ensure wroclaw_glowny backup is rejected when target is wroclaw
      assert.equal(
        validateRestoreTarget(glownyFilename, 'wroclaw'),
        false,
        'Cross-store protection: store_wroclaw_glowny backup must be REJECTED for target "wroclaw"'
      );

      // 2. Ensure wroclaw_glowny backup is rejected when target is wroclaw_airport
      assert.equal(
        validateRestoreTarget(glownyFilename, 'wroclaw_airport'),
        false,
        'Cross-store protection: store_wroclaw_glowny backup must be REJECTED for target "wroclaw_airport"'
      );

      // 3. Ensure wroclaw_glowny backup is rejected when target is wroclaw_glowny_pkp
      assert.equal(
        validateRestoreTarget(glownyFilename, 'wroclaw_glowny_pkp'),
        false,
        'Cross-store protection: store_wroclaw_glowny backup must be REJECTED for target "wroclaw_glowny_pkp"'
      );

      // 4. Ensure wroclaw_glowny_pkp backup is rejected when target is wroclaw_glowny
      assert.equal(
        validateRestoreTarget(pkpFilename, 'wroclaw_glowny'),
        false,
        'Cross-store protection: store_wroclaw_glowny_pkp backup must be REJECTED for target "wroclaw_glowny"'
      );

      // 5. Ensure wroclaw backup is rejected when target is wroclaw_glowny
      assert.equal(
        validateRestoreTarget('store_wroclaw_backup_2026-10-24_10-00-00_123_manual.db', 'wroclaw_glowny'),
        false,
        'Cross-store protection: store_wroclaw backup must be REJECTED for target "wroclaw_glowny"'
      );
    });

    await t.test('test_inspectBackupBuffer_deep_store_inspection_rejects_cross_store_payloads', async () => {
      const tmpBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_challenger2_inspect_'));
      BackupManager.resetInstanceForTesting();
      const backupMgr = BackupManager.getInstance(tmpBackupDir);

      try {
        // Create SQLite database initialized with store_id = 'wroclaw_glowny' in app_settings
        const dbGlowny = new SQL.Database();
        dbGlowny.run(`
          CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
          CREATE TABLE glowny_tbl (val INTEGER);
          INSERT INTO app_settings VALUES ('store_name', 'Starbucks Wrocław Główny');
          INSERT INTO app_settings VALUES ('unit_code', '18220');
          INSERT INTO app_settings VALUES ('store_id', 'wroclaw_glowny');
          INSERT INTO glowny_tbl (val) VALUES (42);
        `);
        const glownyBuffer = Buffer.from(dbGlowny.export());
        dbGlowny.close();

        // 1. Inspect against wroclaw -> must reject
        const insp1 = await backupMgr.inspectBackupBuffer(glownyBuffer, 'wroclaw');
        assert.equal(insp1.isValid, true);
        assert.equal(insp1.isStoreMatch, false, 'wroclaw must NOT match wroclaw_glowny');
        assert.ok(insp1.warnings.some((w) => w.includes('Kopia zapasowa pochodzi z kawiarni')));

        // 2. Inspect against wroclaw_airport -> must reject
        const insp2 = await backupMgr.inspectBackupBuffer(glownyBuffer, 'wroclaw_airport');
        assert.equal(insp2.isValid, true);
        assert.equal(insp2.isStoreMatch, false, 'wroclaw_airport must NOT match wroclaw_glowny');

        // 3. Inspect against wroclaw_glowny -> must match
        const insp3 = await backupMgr.inspectBackupBuffer(glownyBuffer, 'wroclaw_glowny');
        assert.equal(insp3.isValid, true);
        assert.equal(insp3.isStoreMatch, true, 'wroclaw_glowny must match wroclaw_glowny');

        // 4. Inspect multi-underscore database: wroclaw_glowny_pkp
        const dbPkp = new SQL.Database();
        dbPkp.run(`
          CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
          INSERT INTO app_settings VALUES ('store_name', 'Starbucks Wrocław Dworzec PKP');
          INSERT INTO app_settings VALUES ('unit_code', '18225');
          INSERT INTO app_settings VALUES ('store_id', 'wroclaw_glowny_pkp');
        `);
        const pkpBuffer = Buffer.from(dbPkp.export());
        dbPkp.close();

        const inspPkpMatch = await backupMgr.inspectBackupBuffer(pkpBuffer, 'wroclaw_glowny_pkp');
        assert.equal(inspPkpMatch.isValid, true);
        assert.equal(inspPkpMatch.isStoreMatch, true, 'wroclaw_glowny_pkp must match wroclaw_glowny_pkp');

        const inspPkpMismatch = await backupMgr.inspectBackupBuffer(pkpBuffer, 'wroclaw_glowny');
        assert.equal(inspPkpMismatch.isValid, true);
        assert.equal(inspPkpMismatch.isStoreMatch, false, 'wroclaw_glowny_pkp must NOT match wroclaw_glowny');
      } finally {
        BackupManager.resetInstanceForTesting();
        fs.rmSync(tmpBackupDir, { recursive: true, force: true });
      }
    });

    await t.test('test_restoreBackup_enforces_safety_cutoff_against_cross_store_overwrites', async () => {
      const tmpTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_challenger2_restore_'));
      const tmpBackupDir = path.join(tmpTestDir, 'backups', 'db_backups');
      fs.mkdirSync(tmpBackupDir, { recursive: true });

      DatabaseManager.resetInstanceForTesting();
      BackupManager.resetInstanceForTesting();

      const dbManager = DatabaseManager.getInstance(tmpTestDir);
      const backupMgr = BackupManager.getInstance(tmpBackupDir);

      try {
        // Set up active store as 'wroclaw'
        await dbManager.switchStoreDatabase('wroclaw', { name: 'Starbucks Wrocław', unitCode: '18200' });
        const activePath = dbManager.getDbFilePath();
        assert.ok(fs.existsSync(activePath), 'Active store database must exist');

        // Create backup file from another store 'wroclaw_glowny'
        const foreignDb = new SQL.Database();
        foreignDb.run(`
          CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT);
          INSERT INTO app_settings VALUES ('store_name', 'Starbucks Wrocław Główny');
          INSERT INTO app_settings VALUES ('store_id', 'wroclaw_glowny');
        `);
        const foreignFilename = 'store_wroclaw_glowny_backup_2026-10-24_10-00-00_123_manual.db';
        fs.writeFileSync(path.join(tmpBackupDir, foreignFilename), Buffer.from(foreignDb.export()));
        foreignDb.close();

        // 1. Attempt unforced restore -> MUST be blocked by safety cutoff
        const restoreResult = await backupMgr.restoreBackup(foreignFilename, false);
        assert.equal(restoreResult.success, false, 'Restore without force must be blocked');
        assert.ok(
          restoreResult.message.includes('Odcięcie bezpieczeństwa'),
          `Message must mention safety cutoff: ${restoreResult.message}`
        );

        // 2. Attempt forced restore -> allowed with explicit force flag
        const forcedResult = await backupMgr.restoreBackup(foreignFilename, true);
        assert.equal(forcedResult.success, true, 'Forced restore must be accepted');
      } finally {
        DatabaseManager.resetInstanceForTesting();
        BackupManager.resetInstanceForTesting();
        fs.rmSync(tmpTestDir, { recursive: true, force: true });
      }
    });
  });

  // =========================================================================
  // SUITE 3: SHUTDOWN PERSISTENCE & DIRTY WRITE FLUSH IN STORECONNECTIONPOOL
  // =========================================================================
  await suite.test('Suite 3: StoreConnectionPool Synchronous Dirty Flush on Shutdown', async (t) => {
    const tmpStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_challenger2_shutdown_'));

    try {
      const pool = new StoreConnectionPool(8);
      const storeIds = [
        'store_wroclaw_glowny',
        'store_wroclaw_glowny_pkp',
        'store_poznan_posnania',
        'store_gdansk_forum',
        'store_krakow_bonarka',
      ];

      const initialFiles = new Map<string, string>();

      // 1. Create 5 store databases on disk and add them to the pool
      for (const storeId of storeIds) {
        const filePath = path.join(tmpStorageDir, `${storeId}.db`);
        const db = new SQL.Database();
        db.run(`
          CREATE TABLE employees (id INTEGER PRIMARY KEY, name TEXT);
          INSERT INTO employees VALUES (1, 'Initial Employee ${storeId}');
        `);
        const binary = Buffer.from(db.export());
        fs.writeFileSync(filePath, binary);
        initialFiles.set(storeId, filePath);

        // Put clean into pool
        pool.put(storeId, db, filePath, false);
      }

      assert.equal(pool.size(), 5, 'Pool should contain 5 active stores');

      // 2. Perform in-memory modifications on all 5 databases
      for (const storeId of storeIds) {
        const db = pool.get(storeId)!;
        assert.ok(db, `Database for ${storeId} must exist in pool`);

        // Execute in-memory writes
        db.run(`INSERT INTO employees VALUES (2, 'Dirty Flush Candidate ${storeId}');`);

        // Verify in-memory state has 2 rows
        const res = db.exec("SELECT COUNT(*) FROM employees;");
        assert.equal(res[0].values[0][0], 2, 'In-memory database must reflect 2 rows');

        // Verify disk file still has only 1 row before debounce/flush
        const preDiskDb = new SQL.Database(fs.readFileSync(initialFiles.get(storeId)!));
        const preDiskRes = preDiskDb.exec("SELECT COUNT(*) FROM employees;");
        assert.equal(preDiskRes[0].values[0][0], 1, 'Disk file must remain untouched before flush');
        preDiskDb.close();

        // 3. Mark store dirty with a 60,000ms (60s) debounce timer
        // This simulates in-flight background edits that have NOT timed out yet
        pool.markDirty(storeId, 60000);

        const entry = pool.getEntry(storeId)!;
        assert.equal(entry.isDirty, true, `Store ${storeId} must be flagged isDirty: true`);
        assert.ok(entry.debounceTimer !== null, `Store ${storeId} must have an active debounce timer`);
      }

      // 4. Trigger shutdown flush via pool.persistAll()
      // This MUST synchronously flush all 5 dirty stores to disk and cancel all debounce timers
      const startTime = Date.now();
      pool.persistAll();
      const elapsedMs = Date.now() - startTime;

      // Assert it finished instantaneously (synchronously, well below 60s)
      assert.ok(
        elapsedMs < 1000,
        `persistAll() must execute synchronously without waiting for debounce timer (took ${elapsedMs}ms)`
      );

      // 5. Assert memory flags and timer state for all stores
      for (const storeId of storeIds) {
        const entry = pool.getEntry(storeId)!;
        assert.equal(entry.isDirty, false, `Store ${storeId} must be cleared: isDirty = false`);
        assert.equal(entry.debounceTimer, null, `Store ${storeId} debounceTimer must be cleared to null`);
      }

      // 6. Assert disk durability: load each database fresh from disk to simulate app restart
      for (const storeId of storeIds) {
        const diskBinary = fs.readFileSync(initialFiles.get(storeId)!);
        const diskDb = new SQL.Database(diskBinary);

        const res = diskDb.exec("SELECT id, name FROM employees ORDER BY id;");
        assert.equal(res.length, 1, 'Table employees must exist on disk');
        assert.equal(res[0].values.length, 2, `Store ${storeId} on disk must contain exactly 2 rows`);
        assert.equal(res[0].values[1][1], `Dirty Flush Candidate ${storeId}`);

        diskDb.close();
      }

      // 7. Test closeAll() behavior during application exit (will-quit)
      // Inject new dirty edits into 2 stores
      const storeA = storeIds[0];
      const storeB = storeIds[1];
      const dbA = pool.get(storeA)!;
      const dbB = pool.get(storeB)!;

      dbA.run("INSERT INTO employees VALUES (3, 'CloseAll Final Flush A');");
      dbB.run("INSERT INTO employees VALUES (3, 'CloseAll Final Flush B');");

      pool.markDirty(storeA, 60000);
      pool.markDirty(storeB, 60000);

      // Call closeAll()
      pool.closeAll();

      assert.equal(pool.size(), 0, 'closeAll() must clear all pool entries');

      // Verify disk files received the updates from closeAll()
      const diskDbA = new SQL.Database(fs.readFileSync(initialFiles.get(storeA)!));
      const resA = diskDbA.exec("SELECT COUNT(*) FROM employees;");
      assert.equal(resA[0].values[0][0], 3, 'storeA on disk must have 3 rows after closeAll()');
      diskDbA.close();

      const diskDbB = new SQL.Database(fs.readFileSync(initialFiles.get(storeB)!));
      const resB = diskDbB.exec("SELECT COUNT(*) FROM employees;");
      assert.equal(resB[0].values[0][0], 3, 'storeB on disk must have 3 rows after closeAll()');
      diskDbB.close();
    } finally {
      fs.rmSync(tmpStorageDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // SUITE 4: WORKSPACE BACKUP TEARDOWN HYGIENE AUDIT
  // =========================================================================
  await suite.test('Suite 4: Workspace Backup Directory Hygiene Post-Teardown', async (t) => {
    await t.test('test_no_untracked_test_backups_leaked_into_workspace', () => {
      if (fs.existsSync(workspaceBackupDir)) {
        const currentWorkspaceFiles = fs.readdirSync(workspaceBackupDir);

        for (const file of currentWorkspaceFiles) {
          // If a file was not in baseline, check if it looks like a test artifact
          if (!baselineWorkspaceFiles.has(file)) {
            assert.fail(
              `Leaked backup file detected in workspace backups/db_backups/: "${file}". All test safety backups must reside in temporary storage.`
            );
          }
        }
      }
    });
  });
});
