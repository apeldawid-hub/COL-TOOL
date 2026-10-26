import test from 'node:test';
import assert from 'node:assert/strict';
import { ParityVerificationService } from '../../../src/services/security/parityVerificationService';

test('B17: Parity Verification & Drift Boundaries (Genuine Service)', async (t) => {
  const storeId = '108150';
  const unitCode = '18150';
  const service = new ParityVerificationService();

  // 1. Floating Point Precision Drift (IEEE 754)
  await t.test('test_b17_floating_point_precision_drift_detected', async () => {
    const local = { metrics: [{ id: 'm1', tplh: 6.7 }] };
    const cloud = { metrics: [{ id: 'm1', tplh: 6.7000001 }] };

    const report = await service.compareDatasets(storeId, local, cloud, unitCode);
    assert.equal(report.isParityVerified, false);
    assert.equal(report.certificate, undefined);
  });

  // 2. Array Element Order Drift (Sequencing Matters in Schedules)
  await t.test('test_b17_array_element_order_drift_detected', async () => {
    const local = { shifts: [{ id: 's1' }, { id: 's2' }] };
    const cloud = { shifts: [{ id: 's2' }, { id: 's1' }] };

    const report = await service.compareDatasets(storeId, local, cloud, unitCode);
    assert.equal(report.isParityVerified, false);
  });

  // 3. Extra Unexpected Ghost Table in Cloud
  await t.test('test_b17_extra_unexpected_table_in_cloud_detected', async () => {
    const local: Record<string, any[]> = {
      schedules: [{ id: 1 }],
    };
    const cloud: Record<string, any[]> = {
      schedules: [{ id: 1 }],
      unexpected_ghost_table: [{ id: 999 }],
    };

    const report = await service.compareDatasets(storeId, local, cloud, unitCode);
    assert.equal(report.isParityVerified, false);
    const ghostMismatch = report.mismatches.find((m) => m.table === 'unexpected_ghost_table');
    assert.ok(ghostMismatch, 'Must flag unexpected table in cloud');
  });

  // 4. Missing Table in Cloud
  await t.test('test_b17_missing_table_in_cloud_detected', async () => {
    const local: Record<string, any[]> = {
      schedules: [{ id: 1 }],
      training_partners: [{ id: 10 }],
    };
    const cloud: Record<string, any[]> = {
      schedules: [{ id: 1 }],
    };

    const report = await service.compareDatasets(storeId, local, cloud, unitCode);
    assert.equal(report.isParityVerified, false);
    const missingMismatch = report.mismatches.find((m) => m.table === 'training_partners');
    assert.ok(missingMismatch, 'Must flag missing table in cloud');
  });

  // 5. ISO Timestamp String vs Epoch Milliseconds Drift
  await t.test('test_b17_iso_timestamp_vs_epoch_detected', async () => {
    const local = { sync: [{ id: 'sync1', updated: '2026-09-15T00:00:00.000Z' }] };
    const cloud = { sync: [{ id: 'sync1', updated: 1789430400000 }] };

    const report = await service.compareDatasets(storeId, local, cloud, unitCode);
    assert.equal(report.isParityVerified, false);
  });

  // 6. Polish Diacritics and Unicode NFC Normalization
  await t.test('test_b17_polish_diacritics_unicode_normalization', async () => {
    const local = {
      employees: [{ id: 1, name: 'Zażółć gęślą jaźń', city: 'Świętochłowice' }],
    };
    // Decomposed NFD vs precomposed NFC
    const cloud = {
      employees: [{ id: 1, name: 'Zażółć gęślą jaźń'.normalize('NFC'), city: 'Świętochłowice'.normalize('NFC') }],
    };

    const report = await service.compareDatasets(storeId, local, cloud, unitCode);
    assert.equal(report.isParityVerified, true, 'Properly normalized Polish strings must verify 100% parity');
  });

  // 7. Empty Store Parity Verification
  await t.test('test_b17_empty_store_parity_verified', async () => {
    const local: Record<string, any[]> = {};
    const cloud: Record<string, any[]> = {};

    const report = await service.compareDatasets(storeId, local, cloud, unitCode);
    assert.equal(report.isParityVerified, true);
    assert.equal(report.localRecordsCount, 0);
    assert.equal(report.cloudRecordsCount, 0);
    assert.ok(report.certificate);
  });
});
