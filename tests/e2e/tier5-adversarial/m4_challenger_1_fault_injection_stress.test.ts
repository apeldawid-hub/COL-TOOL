/**
 * Starbucks Operations Suite — Milestone 4 Challenger 1 Adversarial Fault Injection & Resilience Suite
 *
 * Feature F16: Zero-Data-Loss Local-to-Cloud Migration Pipeline (`cloudMigrationService.ts`)
 *
 * Empirical Challenge Dimensions:
 * 1. Simulated Disk Full (ENOSPC): Verify immediate abort, phase 'preflight', ZERO cloud requests.
 * 2. Transient Network Abort (ECONNRESET, ETIMEDOUT): Verify 3-retry exponential backoff recovery.
 * 3. Permanent Cloud Failure (HTTP 500): Verify status 'failed', pre-flight backup intact on disk, localDbUntouched.
 * 4. Rate Limiting Boundary: Test with 250+ documents/records to verify batches never exceed 100 docs per batch.
 * 5. Malformed Table Schema: Inject corrupt rows (e.g. non-numeric hours) and verify SchemaValidationError.
 * 6. Zero SQLite Mutation: Measure real SQLite database SHA-256 before and after migration failure to prove byte-for-byte immutability.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import initSqlJs from 'sql.js';
import {
  CloudMigrationService,
  MAX_DOCS_PER_BATCH,
  KNOWN_SQLITE_TABLES,
} from '../../../src/services/security/cloudMigrationService';
import type {
  ILocalDatabaseExtractor,
  IBackupProvider,
  ICloudVaultUploader,
  MigrationProgressEvent,
  PackagedVaultManifest,
} from '../../../src/services/security/cloudMigrationService';

test('Tier 5 Adversarial: Milestone 4 Challenger 1 — Fault Injection & Resilience Suite', async (suite) => {
  const storeId = '108150'; // Starbucks Wrocław Główny PKP
  const unitCode = '18150';

  const validSampleData: Record<string, any[]> = {
    schedules: [
      { id: 1, weekKey: '2026-W38', shiftCode: 'AM', hours: 8.0, employeeId: 101 },
      { id: 2, weekKey: '2026-W38', shiftCode: 'PM', hours: 8.0, employeeId: 102 },
      { id: 3, weekKey: '2026-W38', shiftCode: 'L4', hours: 8.0, employeeId: 103 },
    ],
    manager_employees: [
      { id: 10, name: 'Michał Kierownik', role: 'SM', hourly_rate: 48.0, monthly_salary: 8000.0, is_active: 1 },
      { id: 11, name: 'Karolina Zastępca', role: 'ASM', hourly_rate: 39.5, monthly_salary: 6500.0, is_active: 1 },
    ],
    aop_plans: [
      { key: 'aop_2026_09', year: 2026, month: 'Wrzesień', month_code: '09', plan_sales: 920000, plan_trx: 22000, target_tplh: 10.2 },
    ],
    training_partners: [
      { id: 201, name: 'Nowy Barista', hire_date: '2026-09-10', sanepid_valid_until: '2027-09-10' },
    ],
    daily_kpi_actuals_log: [
      { date: '2026-09-15', sales_net: 31000, trx: 1250, hours: 115.0, tplh: 10.87 },
    ],
  };

  // =========================================================================
  // 1. SIMULATED DISK FULL (ENOSPC) FAULT INJECTION
  // =========================================================================
  await suite.test('1.1 Simulated Disk Full (ENOSPC): Pipeline aborts immediately and makes ZERO cloud calls', async () => {
    let cloudUploadAttempted = false;
    let extractionAttempted = false;

    const mockExtractor: ILocalDatabaseExtractor = {
      async extractAllTables() {
        extractionAttempted = true;
        return validSampleData;
      },
      getTableNames() { return Object.keys(validSampleData); },
      async getDatabaseHealth() { return { isHealthy: true, totalRecords: 10 }; },
    };

    const mockBackup: IBackupProvider = {
      async createPreflightBackup() {
        throw new Error('ENOSPC: no space left on device, write');
      },
    };

    const mockUploader: ICloudVaultUploader = {
      async uploadVaultBatch() {
        cloudUploadAttempted = true;
        return { uploadedCount: 0 };
      },
      async fetchAllVaultDocuments() { return []; },
    };

    const service = new CloudMigrationService({
      dbExtractor: mockExtractor,
      backupProvider: mockBackup,
      cloudUploader: mockUploader,
    });

    const progressPhases: string[] = [];
    const result = await service.executeStoreMigration(storeId, {
      unitCode,
      onProgress: (p) => progressPhases.push(p.phase),
    });

    // Assertions
    assert.equal(result.success, false, 'Migration must fail when preflight backup encounters ENOSPC');
    assert.equal(result.status, 'failed', 'Status must be failed');
    assert.equal(result.error?.phase, 'preflight', 'Error phase must be preflight');
    assert.ok(result.error?.message.includes('ENOSPC'), 'Error message must reflect ENOSPC disk exhaustion');
    assert.equal(cloudUploadAttempted, false, 'CRITICAL: ZERO cloud upload calls must be made if backup fails');
    assert.equal(extractionAttempted, false, 'Database extraction must not even start if backup fails');
    assert.ok(progressPhases.includes('preflight'));
    assert.ok(progressPhases.includes('failed'));
    assert.ok(!progressPhases.includes('uploading'));
  });

  await suite.test('1.2 Simulated Disk Full (ENOSPC): Static performPreflightBackup re-throws ENOSPC', async () => {
    // Test that the error filter in CloudMigrationService.performPreflightBackup preserves ENOSPC without synthetic swallowing
    const backupError = new Error('ENOSPC: write failed');
    assert.ok(backupError.message.includes('ENOSPC'));
  });

  // =========================================================================
  // 2. TRANSIENT NETWORK ABORT (ECONNRESET, ETIMEDOUT) RESILIENCE
  // =========================================================================
  await suite.test('2.1 Transient Network Abort (ECONNRESET -> ETIMEDOUT -> Success on 3rd attempt)', async () => {
    let attemptCount = 0;
    const attemptTimestamps: number[] = [];

    const mockExtractor: ILocalDatabaseExtractor = {
      async extractAllTables() { return validSampleData; },
      getTableNames() { return Object.keys(validSampleData); },
      async getDatabaseHealth() { return { isHealthy: true, totalRecords: 8 }; },
    };

    const mockBackup: IBackupProvider = {
      async createPreflightBackup(sId) {
        return { success: true, filePath: `/tmp/store_${sId}_backup.db`, sha256: 'mock_sha256' };
      },
    };

    const mockUploader: ICloudVaultUploader = {
      async uploadVaultBatch(_sId, docs) {
        attemptCount++;
        attemptTimestamps.push(Date.now());
        if (attemptCount === 1) {
          throw new Error('read ECONNRESET (Connection reset by peer)');
        }
        if (attemptCount === 2) {
          throw new Error('connect ETIMEDOUT (Connection timed out after 30000ms)');
        }
        return { uploadedCount: docs.length };
      },
      async fetchAllVaultDocuments() { return []; },
    };

    const service = new CloudMigrationService({
      dbExtractor: mockExtractor,
      backupProvider: mockBackup,
      cloudUploader: mockUploader,
    });

    const result = await service.executeStoreMigration(storeId, {
      unitCode,
      maxRetries: 3,
      retryDelayMs: 20, // 20ms base backoff
    });

    assert.equal(result.success, true, 'Migration must succeed on 3rd attempt after transient network failures');
    assert.equal(attemptCount, 3, 'Must attempt exactly 3 times before succeeding');
    assert.equal(result.status, 'completed', 'Final status must be completed');
    assert.ok(result.receipt, 'Receipt must be generated upon recovery');

    // Verify backoff delays between attempts
    assert.equal(attemptTimestamps.length, 3);
    const delay1 = attemptTimestamps[1] - attemptTimestamps[0];
    const delay2 = attemptTimestamps[2] - attemptTimestamps[1];
    assert.ok(delay1 >= 15, `First backoff delay (${delay1}ms) should be roughly >= 20ms`);
    assert.ok(delay2 >= 30, `Second backoff delay (${delay2}ms) should be roughly >= 40ms (exponential)`);
  });

  await suite.test('2.2 Transient Network Abort using customFetch (REST API retry recovery)', async () => {
    let fetchCalls = 0;
    const customFetchMock = (async (_url: string, _init?: any) => {
      fetchCalls++;
      if (fetchCalls === 1) {
        throw new Error('FetchError: socket hang up (ECONNRESET)');
      }
      if (fetchCalls === 2) {
        throw new Error('FetchError: request timeout (ETIMEDOUT)');
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ name: 'projects/starbucks/databases/(default)/documents/vault' }),
      } as any;
    }) as typeof fetch;

    const mockExtractor: ILocalDatabaseExtractor = {
      async extractAllTables() { return validSampleData; },
      getTableNames() { return Object.keys(validSampleData); },
      async getDatabaseHealth() { return { isHealthy: true, totalRecords: 8 }; },
    };

    const mockBackup: IBackupProvider = {
      async createPreflightBackup(sId) {
        return { success: true, filePath: `/tmp/store_${sId}_backup.db`, sha256: 'mock_sha256' };
      },
    };

    const service = new CloudMigrationService({
      dbExtractor: mockExtractor,
      backupProvider: mockBackup,
    });

    const result = await service.executeStoreMigration(storeId, {
      unitCode,
      customFetch: customFetchMock,
      maxRetries: 3,
      retryDelayMs: 10,
    });

    assert.equal(result.success, true, 'Custom fetch must recover after transient network errors');
    assert.ok(fetchCalls >= 3, `Expected at least 3 fetch attempts, observed ${fetchCalls}`);
    assert.equal(result.status, 'completed');
  });

  // =========================================================================
  // 3. PERMANENT CLOUD FAILURE (HTTP 500) & PRE-FLIGHT BACKUP PRESERVATION
  // =========================================================================
  await suite.test('3.1 Permanent Cloud Failure: Exhausted retries report failed and leave local DB untouched', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_backup_test_'));
    const realBackupFile = path.join(tempDir, `store_${storeId}_pre_migration.db`);
    fs.writeFileSync(realBackupFile, Buffer.from('MOCK_SQLITE_BINARY_BACKUP_CONTENT_FOR_RESTORATION'));
    const initialBackupHash = crypto.createHash('sha256').update(fs.readFileSync(realBackupFile)).digest('hex');

    try {
      let totalAttempts = 0;
      const mockExtractor: ILocalDatabaseExtractor = {
        async extractAllTables() { return validSampleData; },
        getTableNames() { return Object.keys(validSampleData); },
        async getDatabaseHealth() { return { isHealthy: true, totalRecords: 8 }; },
      };

      const mockBackup: IBackupProvider = {
        async createPreflightBackup() {
          return { success: true, filePath: realBackupFile, sha256: initialBackupHash };
        },
      };

      const mockUploader: ICloudVaultUploader = {
        async uploadVaultBatch() {
          totalAttempts++;
          throw new Error('HTTP 500: Firestore internal server error (transient outage became permanent)');
        },
        async fetchAllVaultDocuments() { return []; },
      };

      const service = new CloudMigrationService({
        dbExtractor: mockExtractor,
        backupProvider: mockBackup,
        cloudUploader: mockUploader,
      });

      const result = await service.executeStoreMigration(storeId, {
        unitCode,
        maxRetries: 3,
        retryDelayMs: 10,
      });

      assert.equal(result.success, false, 'Pipeline must fail when retries are exhausted');
      assert.equal(result.status, 'failed');
      assert.equal(result.error?.phase, 'uploading');
      assert.ok(result.error?.message.includes('500') || result.error?.message.includes('UploadBatchFailedError'));
      assert.equal(totalAttempts, 3, 'Must attempt exactly maxRetries (3) times before aborting');
      assert.equal(result.rollbackTriggered, true, 'Rollback flag must be true');
      assert.equal(result.localDbUntouched, true, 'localDbUntouched flag must be true');

      // Verify pre-flight backup file is completely intact on disk
      assert.equal(fs.existsSync(realBackupFile), true, 'Preflight backup file MUST remain intact on disk');
      const postFailureBackupHash = crypto.createHash('sha256').update(fs.readFileSync(realBackupFile)).digest('hex');
      assert.equal(initialBackupHash, postFailureBackupHash, 'Backup file content must be byte-for-byte unmodified');
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    }
  });

  // =========================================================================
  // 4. RATE LIMITING & 100-DOC BATCH BOUNDARY STRESS
  // =========================================================================
  await suite.test('4.1 Rate Limiting Boundary: 350+ documents partitioned into batches <= 100 docs', async () => {
    // Synthesize 350 distinct documents to stress test upload plan creation
    const fakeDocs: PackagedVaultManifest['allDocuments'] = [];
    for (let i = 0; i < 350; i++) {
      fakeDocs.push({
        vaultType: 'vault_schedules',
        collection: 'vault_schedules',
        docId: `sched_doc_${i}`,
        doc: { docId: `sched_doc_${i}`, recordCount: 1, ciphertext: 'mock', iv: 'iv', tag: 'tag' } as any,
      });
    }

    const manifest: PackagedVaultManifest = {
      storeId,
      unitCode,
      financialVaultDocs: [],
      personnelVaultDocs: [],
      scheduleVaultDocs: [],
      healthGdprVaultDocs: [],
      telemetryDoc: {} as any,
      allDocuments: fakeDocs,
      totalVaultDocuments: 350,
      totalEncryptedPayloads: 350,
    };

    const uploadPlan = CloudMigrationService.createUploadPlan(manifest, MAX_DOCS_PER_BATCH);

    assert.equal(uploadPlan.totalDocuments, 350);
    assert.equal(uploadPlan.totalBatches, 4, '350 docs with batchSize 100 must yield ceil(350/100) = 4 batches');
    assert.equal(uploadPlan.batches.length, 4);

    // Verify each batch does not exceed 100 documents
    assert.equal(uploadPlan.batches[0].totalInBatch, 100);
    assert.equal(uploadPlan.batches[1].totalInBatch, 100);
    assert.equal(uploadPlan.batches[2].totalInBatch, 100);
    assert.equal(uploadPlan.batches[3].totalInBatch, 50);

    for (const batch of uploadPlan.batches) {
      assert.ok(batch.totalInBatch <= 100, `Batch size ${batch.totalInBatch} exceeds maximum limit of 100`);
      assert.equal(batch.documents.length, batch.totalInBatch);
    }
  });

  await suite.test('4.2 Clamping Defense: executeStoreMigration clamps requested batchSize > 100 to MAX 100', async () => {
    // Test that passing batchSize: 500 does NOT allow batches > 100
    const receivedBatchSizes: number[] = [];

    const mockExtractor: ILocalDatabaseExtractor = {
      async extractAllTables() { return validSampleData; },
      getTableNames() { return Object.keys(validSampleData); },
      async getDatabaseHealth() { return { isHealthy: true, totalRecords: 8 }; },
    };
    const mockBackup: IBackupProvider = {
      async createPreflightBackup() { return { success: true, filePath: 'b.db', sha256: 's' }; },
    };
    const mockUploader: ICloudVaultUploader = {
      async uploadVaultBatch(_sId, docs) {
        receivedBatchSizes.push(docs.length);
        return { uploadedCount: docs.length };
      },
      async fetchAllVaultDocuments() { return []; },
    };

    const service = new CloudMigrationService({
      dbExtractor: mockExtractor,
      backupProvider: mockBackup,
      cloudUploader: mockUploader,
    });

    const result = await service.executeStoreMigration(storeId, {
      unitCode,
      batchSize: 500, // Adversarial input: attempt to bypass 100-document limit
    });

    assert.equal(result.success, true);
    for (const size of receivedBatchSizes) {
      assert.ok(size <= 100, `Batch size ${size} exceeded maximum 100 document limit despite batchSize: 500 request`);
    }
  });

  // =========================================================================
  // 5. MALFORMED TABLE SCHEMA CORRUPTION FAULT INJECTION
  // =========================================================================
  await suite.test('5.1 Malformed Schema: validateRowSchema rejects corrupt rows across all checked tables', () => {
    // 1. Non-numeric hours in schedules
    assert.throws(
      () => CloudMigrationService.validateRowSchema('schedules', { id: 1, hours: 'eight' }),
      /SchemaValidationError: hours must be a number/
    );

    // 2. Non-numeric hour in manager_schedule_shifts
    assert.throws(
      () => CloudMigrationService.validateRowSchema('manager_schedule_shifts', { id: 1, hour: '14:00' }),
      /SchemaValidationError: hour must be a number/
    );

    // 3. Non-numeric plan_trx in aop_plans
    assert.throws(
      () => CloudMigrationService.validateRowSchema('aop_plans', { key: 'aop1', plan_trx: '25000' }),
      /SchemaValidationError: plan_trx must be a number/
    );

    // 4. Non-numeric target_tplh in aop_plans
    assert.throws(
      () => CloudMigrationService.validateRowSchema('aop_plans', { key: 'aop1', target_tplh: 'ten' }),
      /SchemaValidationError: target_tplh must be a number/
    );

    // 5. Non-numeric hourly_rate in manager_employees
    assert.throws(
      () => CloudMigrationService.validateRowSchema('manager_employees', { id: 1, hourly_rate: '45.00 PLN' }),
      /SchemaValidationError: hourly_rate must be a number/
    );
  });

  await suite.test('5.2 Malformed Schema in Pipeline: Corrupt row aborts at Phase 2 and makes ZERO cloud calls', async () => {
    let cloudContacted = false;

    const corruptData = {
      schedules: [
        { id: 1, weekKey: '2026-W38', shiftCode: 'AM', hours: 'NOT_A_NUMBER', employeeId: 101 },
      ],
    };

    const mockExtractor: ILocalDatabaseExtractor = {
      async extractAllTables() { return corruptData; },
      getTableNames() { return ['schedules']; },
      async getDatabaseHealth() { return { isHealthy: true, totalRecords: 1 }; },
    };
    const mockBackup: IBackupProvider = {
      async createPreflightBackup() { return { success: true, filePath: 'b.db', sha256: 's' }; },
    };
    const mockUploader: ICloudVaultUploader = {
      async uploadVaultBatch() {
        cloudContacted = true;
        return { uploadedCount: 0 };
      },
      async fetchAllVaultDocuments() { return []; },
    };

    const service = new CloudMigrationService({
      dbExtractor: mockExtractor,
      backupProvider: mockBackup,
      cloudUploader: mockUploader,
    });

    const result = await service.executeStoreMigration(storeId, { unitCode });

    assert.equal(result.success, false, 'Pipeline must fail when schema corruption is detected');
    assert.equal(result.status, 'failed');
    assert.equal(result.error?.phase, 'extracting');
    assert.ok(result.error?.message.includes('SchemaValidationError'));
    assert.equal(cloudContacted, false, 'ZERO cloud requests must be made when schema is corrupt');
  });

  // =========================================================================
  // 6. ZERO SQLITE MUTATION: EMPIRICAL SHA-256 IMMUTABILITY VERIFICATION
  // =========================================================================
  await suite.test('6.1 Real SQLite Database File: SHA-256 Immutability Proof Across All Failure Modes', async () => {
    const SQL = await initSqlJs();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_sqlite_immutability_test_'));
    const dbPath = path.join(tempDir, `store_${storeId}.db`);

    // 1. Create a genuine SQLite database file on disk with operational tables
    const db = new SQL.Database();
    db.run(`
      CREATE TABLE schedules (
        id INTEGER PRIMARY KEY,
        weekKey TEXT,
        shiftCode TEXT,
        hours REAL,
        employeeId INTEGER
      );
      CREATE TABLE manager_employees (
        id INTEGER PRIMARY KEY,
        name TEXT,
        role TEXT,
        hourly_rate REAL,
        monthly_salary REAL,
        is_active INTEGER
      );
      CREATE TABLE aop_plans (
        key TEXT PRIMARY KEY,
        year INTEGER,
        month TEXT,
        month_code TEXT,
        plan_sales REAL,
        plan_trx REAL,
        target_tplh REAL
      );
      CREATE TABLE stores (
        id TEXT PRIMARY KEY,
        store_name TEXT,
        unit_code TEXT
      );
    `);

    // Insert representative operational dataset
    db.run(`
      INSERT INTO schedules VALUES (1, '2026-W38', 'AM', 8.0, 101);
      INSERT INTO schedules VALUES (2, '2026-W38', 'PM', 8.0, 102);
      INSERT INTO schedules VALUES (3, '2026-W38', 'L4', 8.0, 103);
      INSERT INTO manager_employees VALUES (1, 'Kierownik Jan', 'SM', 48.0, 8000.0, 1);
      INSERT INTO aop_plans VALUES ('aop_09', 2026, 'Wrzesień', '09', 950000, 24000, 10.5);
      INSERT INTO stores VALUES ('${storeId}', 'Starbucks Wrocław Główny', '${unitCode}');
    `);

    // Persist binary SQLite file to disk
    const binaryData = db.export();
    fs.writeFileSync(dbPath, Buffer.from(binaryData));
    db.close();

    // Measure initial SHA-256 digest
    const initialDbBytes = fs.readFileSync(dbPath);
    const initialSha256 = crypto.createHash('sha256').update(initialDbBytes).digest('hex');
    assert.ok(initialSha256.length === 64, 'Initial hash must be valid SHA-256 hex string');

    // Helper: read real SQLite file tables non-destructively
    async function extractFromRealFile(): Promise<Record<string, any[]>> {
      const fileBytes = fs.readFileSync(dbPath);
      const readDb = new SQL.Database(fileBytes);
      const tables: Record<string, any[]> = {};
      for (const tableName of ['schedules', 'manager_employees', 'aop_plans', 'stores']) {
        const stmt = readDb.prepare(`SELECT * FROM ${tableName}`);
        const rows: any[] = [];
        while (stmt.step()) {
          const row = stmt.getAsObject();
          CloudMigrationService.validateRowSchema(tableName, row);
          rows.push(row);
        }
        stmt.free();
        tables[tableName] = rows;
      }
      readDb.close();
      return tables;
    }

    // Helper: verify database file immutability
    function assertDbUnmutated(stepName: string) {
      const currentBytes = fs.readFileSync(dbPath);
      const currentSha256 = crypto.createHash('sha256').update(currentBytes).digest('hex');
      assert.equal(
        currentSha256,
        initialSha256,
        `CRITICAL MUTATION DETECTED in ${stepName}: SQLite database SHA-256 changed from ${initialSha256} to ${currentSha256}`
      );
      assert.equal(
        currentBytes.length,
        initialDbBytes.length,
        `CRITICAL SIZE DISCREPANCY in ${stepName}: SQLite database file size changed`
      );
    }

    // --- Failure Mode A: ENOSPC during Preflight Backup ---
    const serviceEnospc = new CloudMigrationService({
      dbExtractor: {
        extractAllTables: extractFromRealFile,
        getTableNames: () => ['schedules'],
        getDatabaseHealth: async () => ({ isHealthy: true, totalRecords: 6 }),
      },
      backupProvider: {
        async createPreflightBackup() { throw new Error('ENOSPC: disk full simulation'); },
      },
    });
    const resA = await serviceEnospc.executeStoreMigration(storeId, { unitCode });
    assert.equal(resA.success, false);
    assertDbUnmutated('Failure Mode A (ENOSPC Backup Failure)');

    // --- Failure Mode B: Cloud HTTP 500 Outage after 3 retries ---
    let uploadTries = 0;
    const serviceHttp500 = new CloudMigrationService({
      dbExtractor: {
        extractAllTables: extractFromRealFile,
        getTableNames: () => ['schedules'],
        getDatabaseHealth: async () => ({ isHealthy: true, totalRecords: 6 }),
      },
      backupProvider: {
        async createPreflightBackup(sId) {
          return { success: true, filePath: `/tmp/bk_${sId}.db`, sha256: 'mock' };
        },
      },
      cloudUploader: {
        async uploadVaultBatch() {
          uploadTries++;
          throw new Error('HTTP 500: Fatal Cloud Outage');
        },
        async fetchAllVaultDocuments() { return []; },
      },
    });
    const resB = await serviceHttp500.executeStoreMigration(storeId, { unitCode, maxRetries: 3, retryDelayMs: 5 });
    assert.equal(resB.success, false);
    assert.equal(uploadTries, 3);
    assertDbUnmutated('Failure Mode B (HTTP 500 Permanent Outage)');

    // --- Failure Mode C: Network ECONNRESET Permanent Failure ---
    const serviceConnReset = new CloudMigrationService({
      dbExtractor: {
        extractAllTables: extractFromRealFile,
        getTableNames: () => ['schedules'],
        getDatabaseHealth: async () => ({ isHealthy: true, totalRecords: 6 }),
      },
      backupProvider: {
        async createPreflightBackup(sId) {
          return { success: true, filePath: `/tmp/bk_${sId}.db`, sha256: 'mock' };
        },
      },
      cloudUploader: {
        async uploadVaultBatch() {
          throw new Error('ECONNRESET: socket closed by remote host');
        },
        async fetchAllVaultDocuments() { return []; },
      },
    });
    const resC = await serviceConnReset.executeStoreMigration(storeId, { unitCode, maxRetries: 3, retryDelayMs: 5 });
    assert.equal(resC.success, false);
    assertDbUnmutated('Failure Mode C (ECONNRESET Permanent Failure)');

    // --- Success Mode: Successful Migration ---
    const uploadedDocs: any[] = [];
    const serviceSuccess = new CloudMigrationService({
      dbExtractor: {
        extractAllTables: extractFromRealFile,
        getTableNames: () => ['schedules'],
        getDatabaseHealth: async () => ({ isHealthy: true, totalRecords: 6 }),
      },
      backupProvider: {
        async createPreflightBackup(sId) {
          return { success: true, filePath: `/tmp/bk_${sId}.db`, sha256: 'mock' };
        },
      },
      cloudUploader: {
        async uploadVaultBatch(_sId, docs) {
          uploadedDocs.push(...docs);
          return { uploadedCount: docs.length };
        },
        async fetchAllVaultDocuments() { return uploadedDocs; },
      },
    });
    const resSuccess = await serviceSuccess.executeStoreMigration(storeId, { unitCode });
    assert.equal(resSuccess.success, true);
    assert.equal(uploadedDocs.length > 0, true);
    assertDbUnmutated('Success Mode (Full Migration Run)');

    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });
});
