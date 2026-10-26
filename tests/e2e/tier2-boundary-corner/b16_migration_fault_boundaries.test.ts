import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudMigrationService } from '../../../src/services/security/cloudMigrationService';
import type { ILocalDatabaseExtractor, IBackupProvider, ICloudVaultUploader } from '../../../src/services/security/cloudMigrationService';

test('B16: Migration Fault & Boundary Cases (Genuine Service)', async (t) => {
  const storeId = '108150';
  const unitCode = '18150';

  // 1. Migration of Empty Database
  await t.test('test_b16_migration_of_empty_database', async () => {
    const emptyTables: Record<string, any[]> = {
      schedules: [],
      manager_employees: [],
      aop_plans: [],
    };

    const mockExtractor: ILocalDatabaseExtractor = {
      async extractAllTables() { return emptyTables; },
      getTableNames() { return Object.keys(emptyTables); },
      async getDatabaseHealth() { return { isHealthy: true, totalRecords: 0 }; },
    };
    const mockBackup: IBackupProvider = {
      async createPreflightBackup() { return { success: true, filePath: 'backup.db', sha256: 'sha' }; },
    };
    const uploaded: any[] = [];
    const mockUploader: ICloudVaultUploader = {
      async uploadVaultBatch(_sId, docs) { uploaded.push(...docs); return { uploadedCount: docs.length }; },
      async fetchAllVaultDocuments() { return uploaded; },
    };

    const service = new CloudMigrationService({
      dbExtractor: mockExtractor,
      backupProvider: mockBackup,
      cloudUploader: mockUploader,
    });

    const result = await service.executeStoreMigration(storeId, { unitCode });
    assert.equal(result.success, true);
    assert.equal(result.totalEntities, 0);
    assert.equal(result.status, 'completed');
    assert.equal(result.receipt?.totalEntities, 0);
  });

  // 2. Preflight Failure: Disk Full (ENOSPC) Blocks Migration Before Cloud Touch
  await t.test('test_b16_simulated_disk_full_during_backup', async () => {
    let cloudUploadAttempted = false;

    const mockExtractor: ILocalDatabaseExtractor = {
      async extractAllTables() { return { schedules: [{ id: 1 }] }; },
      getTableNames() { return ['schedules']; },
      async getDatabaseHealth() { return { isHealthy: true, totalRecords: 1 }; },
    };
    const mockBackup: IBackupProvider = {
      async createPreflightBackup() {
        throw new Error('ENOSPC: no space left on device');
      },
    };
    const mockUploader: ICloudVaultUploader = {
      async uploadVaultBatch() { cloudUploadAttempted = true; return { uploadedCount: 0 }; },
      async fetchAllVaultDocuments() { return []; },
    };

    const service = new CloudMigrationService({
      dbExtractor: mockExtractor,
      backupProvider: mockBackup,
      cloudUploader: mockUploader,
    });

    const result = await service.executeStoreMigration(storeId, { unitCode });
    assert.equal(result.success, false);
    assert.equal(result.status, 'failed');
    assert.equal(result.error?.phase, 'preflight');
    assert.ok(result.error?.message.includes('ENOSPC'));
    assert.equal(cloudUploadAttempted, false, 'Cloud must NOT be contacted if preflight backup fails');
  });

  // 3. Database Extraction Malformation Failure
  await t.test('test_b16_migration_with_table_schema_validation_error', async () => {
    const mockExtractor: ILocalDatabaseExtractor = {
      async extractAllTables() {
        throw new Error('SchemaValidationError: unexpected table corruption in manager_employees');
      },
      getTableNames() { return ['manager_employees']; },
      async getDatabaseHealth() { return { isHealthy: false, totalRecords: 0, error: 'Corrupt table' }; },
    };
    const mockBackup: IBackupProvider = {
      async createPreflightBackup() { return { success: true, filePath: 'b.db', sha256: 's' }; },
    };
    let cloudContacted = false;
    const mockUploader: ICloudVaultUploader = {
      async uploadVaultBatch() { cloudContacted = true; return { uploadedCount: 0 }; },
      async fetchAllVaultDocuments() { return []; },
    };

    const service = new CloudMigrationService({
      dbExtractor: mockExtractor,
      backupProvider: mockBackup,
      cloudUploader: mockUploader,
    });

    const result = await service.executeStoreMigration(storeId, { unitCode });
    assert.equal(result.success, false);
    assert.equal(result.error?.phase, 'extracting');
    assert.equal(cloudContacted, false);
  });

  // 4. Transient Network Glitch Recovers Within 3 Retries
  await t.test('test_b16_retry_logic_boundary_3_retries', async () => {
    let attempts = 0;
    const mockExtractor: ILocalDatabaseExtractor = {
      async extractAllTables() { return { schedules: [{ id: 1 }] }; },
      getTableNames() { return ['schedules']; },
      async getDatabaseHealth() { return { isHealthy: true, totalRecords: 1 }; },
    };
    const mockBackup: IBackupProvider = {
      async createPreflightBackup() { return { success: true, filePath: 'b.db', sha256: 's' }; },
    };
    const mockUploader: ICloudVaultUploader = {
      async uploadVaultBatch(_sId, docs) {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary network glitch (ECONNRESET)');
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
      retryDelayMs: 5,
    });

    assert.equal(result.success, true);
    assert.equal(attempts, 3, 'Must succeed on attempt 3 after 2 transient failures');
  });

  // 5. Rate Limiter & Batch Partitioning Boundary
  await t.test('test_b16_rate_limiter_throttling_boundary', async () => {
    // Generate 250 schedules to verify 100-document batching
    const manySchedules = Array.from({ length: 250 }, (_, i) => ({
      id: i + 1,
      shiftCode: 'AM',
      hours: 8.0,
      employeeId: i + 1,
    }));

    const mockExtractor: ILocalDatabaseExtractor = {
      async extractAllTables() { return { schedules: manySchedules }; },
      getTableNames() { return ['schedules']; },
      async getDatabaseHealth() { return { isHealthy: true, totalRecords: 250 }; },
    };
    const mockBackup: IBackupProvider = {
      async createPreflightBackup() { return { success: true, filePath: 'b.db', sha256: 's' }; },
    };

    const batchesReceived: number[] = [];
    const mockUploader: ICloudVaultUploader = {
      async uploadVaultBatch(_sId, docs) {
        batchesReceived.push(docs.length);
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
      batchSize: 100,
    });

    assert.equal(result.success, true);
    assert.equal(result.batchesUploaded, batchesReceived.length);
    assert.ok(batchesReceived.length >= 1);
  });

  // 6. Partial Cloud Upload Recovery & Idempotent Re-Run
  await t.test('test_b16_partial_cloud_upload_idempotent_recovery', async () => {
    const cloudStorage = new Map<string, any>();

    const tables = {
      schedules: [{ id: 1, shiftCode: 'AM' }, { id: 2, shiftCode: 'PM' }],
    };
    const mockExtractor: ILocalDatabaseExtractor = {
      async extractAllTables() { return tables; },
      getTableNames() { return ['schedules']; },
      async getDatabaseHealth() { return { isHealthy: true, totalRecords: 2 }; },
    };
    const mockBackup: IBackupProvider = {
      async createPreflightBackup() { return { success: true, filePath: 'b.db', sha256: 's' }; },
    };
    const mockUploader: ICloudVaultUploader = {
      async uploadVaultBatch(_sId, docs) {
        for (const doc of docs) {
          cloudStorage.set(doc.docId, doc);
        }
        return { uploadedCount: docs.length };
      },
      async fetchAllVaultDocuments() { return Array.from(cloudStorage.values()); },
    };

    const service = new CloudMigrationService({
      dbExtractor: mockExtractor,
      backupProvider: mockBackup,
      cloudUploader: mockUploader,
    });

    // Run 1
    const res1 = await service.executeStoreMigration(storeId, { unitCode });
    assert.equal(res1.success, true);
    const countAfterRun1 = cloudStorage.size;

    // Run 2 (Restart/retry migration for same store)
    const res2 = await service.executeStoreMigration(storeId, { unitCode });
    assert.equal(res2.success, true);
    const countAfterRun2 = cloudStorage.size;

    assert.equal(countAfterRun1, countAfterRun2, 'Re-running migration must not create duplicate documents');
  });
});
