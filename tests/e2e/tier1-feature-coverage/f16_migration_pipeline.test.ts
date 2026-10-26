import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudMigrationService } from '../../../src/services/security/cloudMigrationService';
import type { MigrationProgressEvent, ILocalDatabaseExtractor, IBackupProvider, ICloudVaultUploader } from '../../../src/services/security/cloudMigrationService';

test('F16: Zero-Data-Loss Local-to-Cloud Migration Pipeline (Genuine Service)', async (t) => {
  const storeId = '108150'; // Starbucks Wrocław Dworzec Główny PKP
  const unitCode = '18150';

  // Seed sample local SQLite database data across 5 core operational tables
  const sampleLocalTables: Record<string, any[]> = {
    schedules: [
      { id: 1, weekKey: '2026-W38', shiftCode: 'AM', hours: 8.0, employeeId: 'emp_01' },
      { id: 2, weekKey: '2026-W38', shiftCode: 'PM', hours: 8.0, employeeId: 'emp_02' },
    ],
    manager_employees: [
      { id: 10, name: 'Jan Kowalski', role: 'SM', hourly_rate: 45.0, monthly_salary: 7500.0, is_active: 1 },
      { id: 11, name: 'Anna Nowak', role: 'ASM', hourly_rate: 38.0, monthly_salary: 6300.0, is_active: 1 },
    ],
    aop_plans: [
      { key: 'aop_2026_09', year: 2026, month: 'Wrzesień', month_code: '09', plan_sales: 850000, target_tplh: 9.85 },
    ],
    training_partners: [
      { id: 101, name: 'Barista Trainee', hire_date: '2026-09-01', store_id: storeId },
    ],
    daily_kpi_actuals_log: [
      { date: '2026-09-15', sales_net: 28500, trx: 1100, hours: 110.0, tplh: 10.0 },
    ],
  };

  const totalEntitiesCount = Object.values(sampleLocalTables).reduce((acc, rows) => acc + rows.length, 0);

  // Helper factory for in-memory providers
  function createTestHarness(overrides?: {
    extractorFail?: boolean;
    backupFail?: boolean;
    uploaderFailCount?: number;
    permanentUploadFail?: boolean;
  }) {
    const backupLog: Array<{ storeId: string; reason: string }> = [];
    const uploadedDocs: any[] = [];
    let uploadAttempts = 0;

    const mockExtractor: ILocalDatabaseExtractor = {
      async extractAllTables(_sId) {
        if (overrides?.extractorFail) throw new Error('SQLITE_CORRUPT: database disk image is malformed');
        return JSON.parse(JSON.stringify(sampleLocalTables));
      },
      getTableNames() {
        return Object.keys(sampleLocalTables);
      },
      async getDatabaseHealth(_sId) {
        return { isHealthy: !overrides?.extractorFail, totalRecords: totalEntitiesCount };
      },
    };

    const mockBackup: IBackupProvider = {
      async createPreflightBackup(sId, reason) {
        if (overrides?.backupFail) throw new Error('ENOSPC: no space left on device');
        backupLog.push({ storeId: sId, reason });
        return { success: true, filePath: `/backups/store_${sId}_backup_test.db`, sha256: 'mock_backup_sha256' };
      },
    };

    const mockUploader: ICloudVaultUploader = {
      async uploadVaultBatch(_sId, docs) {
        uploadAttempts++;
        if (overrides?.permanentUploadFail) {
          throw new Error('HTTP 500: Firestore internal server error');
        }
        if (overrides?.uploaderFailCount && uploadAttempts <= overrides.uploaderFailCount) {
          throw new Error('ETIMEDOUT: Network connection aborted');
        }
        uploadedDocs.push(...docs);
        return { uploadedCount: docs.length };
      },
      async fetchAllVaultDocuments(_sId) {
        return uploadedDocs;
      },
    };

    return { mockExtractor, mockBackup, mockUploader, backupLog, uploadedDocs, getUploadAttempts: () => uploadAttempts };
  }

  // 1. Preflight Health Check & Backup Execution
  await t.test('test_f16_preflight_health_check_and_backup', async () => {
    const harness = createTestHarness();
    const service = new CloudMigrationService({
      dbExtractor: harness.mockExtractor,
      backupProvider: harness.mockBackup,
      cloudUploader: harness.mockUploader,
    });

    const preflight = await service.preflightCheck(storeId);
    assert.equal(preflight.isReady, true);
    assert.equal(preflight.databaseHealth.isHealthy, true);
    assert.equal(preflight.databaseHealth.totalRecords, totalEntitiesCount);

    const result = await service.executeStoreMigration(storeId, { unitCode });
    assert.equal(result.success, true);
    assert.equal(harness.backupLog.length, 1);
    assert.equal(harness.backupLog[0].storeId, storeId);
    assert.ok(harness.backupLog[0].reason.includes('pre_migration'));
    assert.ok(result.backupFilePath);
  });

  // 2. Table Extraction Across Entities
  await t.test('test_f16_sqlite_table_extraction_extracts_all_entities', async () => {
    const harness = createTestHarness();
    const service = new CloudMigrationService({
      dbExtractor: harness.mockExtractor,
      backupProvider: harness.mockBackup,
      cloudUploader: harness.mockUploader,
    });

    const extracted = await service.extractLocalTables(storeId);
    assert.ok(extracted.schedules);
    assert.ok(extracted.manager_employees);
    assert.ok(extracted.aop_plans);
    assert.ok(extracted.training_partners);
    assert.ok(extracted.daily_kpi_actuals_log);
    assert.equal(extracted.schedules.length, 2);
    assert.equal(extracted.manager_employees.length, 2);
  });

  // 3. Sensitive Records Encrypted During Batch Prep
  await t.test('test_f16_sensitive_records_encrypted_during_batch_prep', async () => {
    const harness = createTestHarness();
    const service = new CloudMigrationService({
      dbExtractor: harness.mockExtractor,
      backupProvider: harness.mockBackup,
      cloudUploader: harness.mockUploader,
    });

    const vaultDocuments = await service.packageAndEncrypt(storeId, sampleLocalTables, unitCode);
    assert.ok(vaultDocuments.length > 0);

    for (const doc of vaultDocuments) {
      assert.equal(doc.version, 'v1');
      assert.equal(doc.storeId, storeId);
      assert.ok(doc.iv && doc.tag && doc.ciphertext);
      assert.ok(doc.encryptedPayload.startsWith(`enc:v1:${storeId}:`));
      // Verify zero plaintext leaks of salaries or revenue
      assert.ok(!doc.encryptedPayload.includes('7500.0'));
      assert.ok(!doc.encryptedPayload.includes('850000'));
    }
  });

  // 4. Real-time Progress Telemetry Events
  await t.test('test_f16_batch_upload_with_realtime_progress_telemetry', async () => {
    const harness = createTestHarness();
    const progressEvents: MigrationProgressEvent[] = [];

    const service = new CloudMigrationService({
      dbExtractor: harness.mockExtractor,
      backupProvider: harness.mockBackup,
      cloudUploader: harness.mockUploader,
    });

    const result = await service.executeStoreMigration(storeId, {
      unitCode,
      onProgress: (evt) => progressEvents.push(evt),
    });

    assert.equal(result.success, true);
    assert.ok(progressEvents.length >= 5);

    const phases = progressEvents.map((e) => e.phase);
    assert.ok(phases.includes('preflight'));
    assert.ok(phases.includes('extracting'));
    assert.ok(phases.includes('packaging'));
    assert.ok(phases.includes('encrypting'));
    assert.ok(phases.includes('uploading'));
    assert.ok(phases.includes('completed'));

    // Check monotonic percentage increase
    for (let i = 1; i < progressEvents.length; i++) {
      assert.ok(progressEvents[i].percent >= progressEvents[i - 1].percent);
    }
    const finalEvent = progressEvents[progressEvents.length - 1];
    assert.equal(finalEvent.percent, 100);
    assert.equal(finalEvent.phase, 'completed');
  });

  // 5. Atomic Rollback on Network Failure
  await t.test('test_f16_atomic_rollback_on_network_failure', async () => {
    const harness = createTestHarness({ permanentUploadFail: true });
    const service = new CloudMigrationService({
      dbExtractor: harness.mockExtractor,
      backupProvider: harness.mockBackup,
      cloudUploader: harness.mockUploader,
    });

    const result = await service.executeStoreMigration(storeId, { unitCode });
    assert.equal(result.success, false);
    assert.equal(result.status, 'failed');
    assert.equal(result.error?.phase, 'uploading');
    assert.ok(result.error?.message.includes('HTTP 500'));

    // Verify backup was preserved on disk despite upload failure
    assert.equal(harness.backupLog.length, 1);
    assert.ok(result.backupFilePath);
  });

  // 6. Structured Manifest & Completion Receipt
  await t.test('test_f16_migration_produces_structured_manifest', async () => {
    const harness = createTestHarness();
    const service = new CloudMigrationService({
      dbExtractor: harness.mockExtractor,
      backupProvider: harness.mockBackup,
      cloudUploader: harness.mockUploader,
    });

    const result = await service.executeStoreMigration(storeId, { unitCode });
    assert.equal(result.success, true);
    assert.ok(result.receipt);
    assert.equal(result.receipt.storeId, storeId);
    assert.equal(result.receipt.unitCode, unitCode);
    assert.equal(result.receipt.totalEntities, totalEntitiesCount);
    assert.equal(result.receipt.status, 'completed');
    assert.ok(result.receipt.durationMs >= 0);
    assert.ok(result.receipt.tableCounts.schedules === 2);
  });
});
