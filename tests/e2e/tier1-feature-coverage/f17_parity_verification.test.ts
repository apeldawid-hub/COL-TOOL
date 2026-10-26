import test from 'node:test';
import assert from 'node:assert/strict';
import { ParityVerificationService } from '../../../src/services/security/parityVerificationService';
import { canonicalSha256 } from '../../../src/services/security/encryptionService';
import { VaultService } from '../../../src/services/security/vaultService';

test('F17: Bi-Directional Cryptographic Parity Verification (Genuine Service)', async (t) => {
  const storeId = '108150';
  const unitCode = '18150';

  const localDatabase: Record<string, any[]> = {
    schedules: [
      { id: 1, shiftCode: 'AM', hours: 8.0, employeeId: 10 },
      { id: 2, shiftCode: 'PM', hours: 8.0, employeeId: 11 },
    ],
    manager_employees: [
      { id: 10, name: 'Jan Kowalski', role: 'SM', hourly_rate: 45.0 },
      { id: 11, name: 'Anna Nowak', role: 'ASM', hourly_rate: 38.0 },
    ],
    aop_plans: [
      { key: 'aop_2026_09', plan_sales: 850000, target_tplh: 9.85 },
    ],
  };

  const service = new ParityVerificationService();

  // 1. Canonical JSON Key-Order Independence
  await t.test('test_f17_canonical_json_sorting_guarantees_key_independence', () => {
    const objA = { z: 1, a: 2, m: { y: 10, b: 20 } };
    const objB = { a: 2, m: { b: 20, y: 10 }, z: 1 };

    const hashA = canonicalSha256(objA);
    const hashB = canonicalSha256(objB);

    assert.equal(hashA, hashB, 'Different key insertion order must produce identical canonical SHA-256');
  });

  // 2. 100% Parity Produces Signed Certificate
  await t.test('test_f17_100_percent_parity_produces_signed_certificate', async () => {
    const cloudDatabase = JSON.parse(JSON.stringify(localDatabase));

    const report = await service.compareDatasets(storeId, localDatabase, cloudDatabase, unitCode);
    assert.equal(report.isParityVerified, true);
    assert.equal(report.mismatches.length, 0);
    assert.equal(report.localCanonicalHash, report.cloudCanonicalHash);
    assert.ok(report.certificate);
    assert.equal(report.certificate?.storeId, storeId);
    assert.equal(report.certificate?.unitCode, unitCode);
    assert.equal(report.certificate?.verifiedRecordsCount, 5);
    assert.ok(report.certificate?.signature);
  });

  // 3. Detects Row Count Discrepancy
  await t.test('test_f17_detects_row_count_discrepancy', async () => {
    const cloudDatabase = JSON.parse(JSON.stringify(localDatabase));
    cloudDatabase.schedules.pop(); // Remove 1 schedule row in cloud

    const report = await service.compareDatasets(storeId, localDatabase, cloudDatabase, unitCode);
    assert.equal(report.isParityVerified, false);
    assert.equal(report.certificate, undefined);
    assert.ok(report.mismatches.length > 0);

    const countMismatch = report.mismatches.find((m) => m.table === 'schedules' && m.reason.includes('count'));
    assert.ok(countMismatch, 'Must report row count mismatch for schedules');
  });

  // 4. Detects Field-Level Value Tampering
  await t.test('test_f17_detects_field_level_value_tampering', async () => {
    const cloudDatabase = JSON.parse(JSON.stringify(localDatabase));
    cloudDatabase.manager_employees[0].hourly_rate = 45.5; // Tampered from 45.0

    const report = await service.compareDatasets(storeId, localDatabase, cloudDatabase, unitCode);
    assert.equal(report.isParityVerified, false);
    assert.notEqual(report.localCanonicalHash, report.cloudCanonicalHash);

    const fieldMismatch = report.mismatches.find((m) => m.table === 'manager_employees');
    assert.ok(fieldMismatch);
    assert.equal(fieldMismatch?.field, 'hourly_rate');
  });

  // 5. Parity Report Details Specific Mismatch Location
  await t.test('test_f17_parity_report_details_specific_mismatch_location', async () => {
    const cloudDatabase = JSON.parse(JSON.stringify(localDatabase));
    cloudDatabase.aop_plans[0].target_tplh = 9.90; // Tampered

    const report = await service.compareDatasets(storeId, localDatabase, cloudDatabase, unitCode);
    assert.equal(report.isParityVerified, false);

    const aopMismatch = report.mismatches.find((m) => m.table === 'aop_plans');
    assert.ok(aopMismatch);
    assert.equal(aopMismatch?.id, 'aop_2026_09');
    assert.equal(aopMismatch?.field, 'target_tplh');
    assert.equal(aopMismatch?.localValue, 9.85);
    assert.equal(aopMismatch?.cloudValue, 9.90);
  });

  // 6. verifyStoreParity: Evaluates parity when cloudTables is provided in options
  await t.test('test_f17_verifyStoreParity_evaluates_parity_correctly_when_cloudTables_provided', async () => {
    const cloudTables = JSON.parse(JSON.stringify(localDatabase));

    const reportMatch = await ParityVerificationService.verifyStoreParity(storeId, {
      unitCode,
      rawTables: localDatabase,
      cloudTables,
    });

    assert.equal(reportMatch.isParityVerified, true);
    assert.equal(reportMatch.mismatches.length, 0);
    assert.equal(reportMatch.localRecordsCount, 5);
    assert.equal(reportMatch.cloudRecordsCount, 5);
    assert.ok(reportMatch.certificate);
    assert.equal(reportMatch.certificate?.storeId, storeId);

    // Mismatched cloudTables evaluation
    const alteredCloudTables = JSON.parse(JSON.stringify(localDatabase));
    alteredCloudTables.schedules[0].hours = 4.0; // Tampered from 8.0

    const reportMismatch = await ParityVerificationService.verifyStoreParity(storeId, {
      unitCode,
      rawTables: localDatabase,
      cloudTables: alteredCloudTables,
    });

    assert.equal(reportMismatch.isParityVerified, false);
    assert.ok(reportMismatch.mismatches.length > 0);
    assert.equal(reportMismatch.certificate, undefined);
  });

  // 7. verifyStoreParity: Rejects self-certification when no cloud data is provided
  await t.test('test_f17_verifyStoreParity_rejects_self_certification_when_no_cloud_data_provided', async () => {
    // Calling verifyStoreParity without cloudTables and without cloudDocuments
    const report = await ParityVerificationService.verifyStoreParity(storeId, {
      unitCode,
      rawTables: localDatabase,
    });

    // Must NOT self-certify: must report false, 0 cloud records, and missing cloud tables
    assert.equal(report.isParityVerified, false, 'Must not self-certify when no cloud data is supplied');
    assert.equal(report.certificate, undefined, 'Must not issue certificate without cloud data');
    assert.equal(report.localRecordsCount, 5);
    assert.equal(report.cloudRecordsCount, 0);
    assert.ok(report.mismatches.length > 0, 'Must report mismatches for missing cloud data');

    // Confirm that local tables are reported as missing in cloud
    const missingTables = report.mismatches
      .filter((m) => m.id === 'table_missing')
      .map((m) => m.table);

    assert.ok(missingTables.includes('schedules'), 'schedules must be reported as missing in cloud');
    assert.ok(missingTables.includes('manager_employees'), 'manager_employees must be reported as missing in cloud');
    assert.ok(missingTables.includes('aop_plans'), 'aop_plans must be reported as missing in cloud');
  });

  // 8. verifyStoreParity: Unpacks cloudDocuments via VaultService and verifies parity
  await t.test('test_f17_verifyStoreParity_unpacks_cloudDocuments_via_VaultService_and_verifies_parity', async () => {
    // Package real AES-256-GCM encrypted vaults using VaultService
    const finRes = await VaultService.packageFinancialVault(storeId, unitCode, 'financials_test', {
      period: 'financials_test',
      aopPlans: localDatabase.aop_plans,
    });

    const persRes = await VaultService.packagePersonnelVault(storeId, unitCode, 'active_roster', 'roster_test', {
      staffGroup: 'active_roster',
      managers: localDatabase.manager_employees,
    });

    const schedRes = await VaultService.packageScheduleVault(storeId, unitCode, 'schedule_master', 'schedules_test', {
      weekKey: 'schedule_master',
      shifts: localDatabase.schedules,
    });

    const report = await ParityVerificationService.verifyStoreParity(storeId, {
      unitCode,
      rawTables: localDatabase,
      cloudDocuments: [finRes.doc, persRes.doc, schedRes.doc],
    });

    assert.equal(report.isParityVerified, true, 'Properly encrypted & unpacked cloudDocuments must verify 100% parity');
    assert.equal(report.mismatches.length, 0);
    assert.equal(report.localRecordsCount, 5);
    assert.equal(report.cloudRecordsCount, 5);
    assert.ok(report.certificate);
    assert.equal(report.certificate?.storeId, storeId);
  });
});

