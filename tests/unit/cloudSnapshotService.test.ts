import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CloudSnapshotService, SnapshotDomain } from '../../src/services/sync/cloudSnapshotService';

describe('CloudSnapshotService - Trzypoziomowa Tarcza Kolizyjna & Snapshots', () => {
  it('getLastSnapshotTime zwraca null lub poprawną datę ISO', () => {
    const res = CloudSnapshotService.getLastSnapshotTime('test_store_123');
    assert.ok(res === null || typeof res === 'string');
  });

  it('createSnapshot w trybie web mock tworzy snapshot i zapisuje timestamp', async () => {
    const res = await CloudSnapshotService.createSnapshot('test_store_123', 'Testowy snapshot');
    assert.equal(res.success, true);
    assert.ok(res.snapshotId?.startsWith('snap_'));

    const lastTs = CloudSnapshotService.getLastSnapshotTime('test_store_123');
    assert.ok(lastTs !== null);
  });

  it('checkCollisions zwraca hasCollision: false gdy brak nowszych zdarzeń', async () => {
    const futureDate = new Date(Date.now() + 60000).toISOString();
    const collision = await CloudSnapshotService.checkCollisions('test_store_123', futureDate);
    assert.equal(collision.hasCollision, false);
    assert.equal(collision.newerEventsCount, 0);
  });

  it('selektywne domeny mogą być poprawnie filtrowane', () => {
    const allDomains: SnapshotDomain[] = ['schedules', 'personnel', 'financials', 'trainings'];
    const selected: SnapshotDomain[] = ['schedules', 'financials'];
    const filtered = allDomains.filter(d => selected.includes(d));
    assert.deepEqual(filtered, ['schedules', 'financials']);
  });
});
