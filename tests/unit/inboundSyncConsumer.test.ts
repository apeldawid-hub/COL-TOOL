import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { InboundSyncConsumer } from '../../src/services/sync/inboundSyncConsumer';
import { CloudRealtimeTransport, StoreRealtimeEvent } from '../../src/services/sync/cloudRealtimeTransport';

describe('InboundSyncConsumer - Synchronizacja Zwrotna do SQLite (Lustro Bazy)', () => {
  beforeEach(() => {
    InboundSyncConsumer.destroy();
    CloudRealtimeTransport._resetForTesting();
  });

  it('processInboundEvent przekazuje zdarzenie do wykonania w SQLite i zwraca applied: true', async () => {
    let capturedEvent: StoreRealtimeEvent | null = null;

    InboundSyncConsumer.setMockDbExecutor(async (event) => {
      capturedEvent = event;
      return true;
    });

    const event: StoreRealtimeEvent = {
      eventId: 'evt_incoming_101',
      storeId: '108120',
      domain: 'schedules',
      action: 'UPSERT',
      entityId: 'shift_2026_3_12_emp5',
      payload: {
        year: 2026,
        month: 3,
        day: 12,
        date: '2026-03-12',
        employee_id: 5,
        shift_code: 'PM',
        hours: 8.0,
      },
      author: 'kamil.kaminski@amrest.eu',
      originDeviceId: 'foreign_macbook_device',
      timestamp: new Date().toISOString(),
      version: 1,
    };

    const res = await InboundSyncConsumer.processInboundEvent(event);
    assert.equal(res.success, true);
    assert.equal(res.applied, true);
    assert.equal(res.eventId, 'evt_incoming_101');
    assert.ok(capturedEvent);
    assert.equal(capturedEvent.domain, 'schedules');
    assert.equal(capturedEvent.payload.shift_code, 'PM');
  });

  it('Deduplikacja odrzuca powtórnie nadesłane zdarzenie z tym samym eventId', async () => {
    let executionCount = 0;

    InboundSyncConsumer.setMockDbExecutor(async () => {
      executionCount++;
      return true;
    });

    const event: StoreRealtimeEvent = {
      eventId: 'evt_duplicate_test_202',
      storeId: '108120',
      domain: 'schedules',
      action: 'UPSERT',
      entityId: 'shift_2026_3_1_emp1',
      payload: { shift_code: 'AM', hours: 8.0 },
      author: 'manager',
      originDeviceId: 'other_device',
      timestamp: new Date().toISOString(),
      version: 1,
    };

    // Pierwsze wykonanie -> applied: true
    const res1 = await InboundSyncConsumer.processInboundEvent(event);
    assert.equal(res1.applied, true);
    assert.equal(executionCount, 1);

    // Drugie wykonanie tego samego zdarzenia -> deduplikacja, applied: false
    const res2 = await InboundSyncConsumer.processInboundEvent(event);
    assert.equal(res2.applied, false);
    assert.equal(executionCount, 1, 'Baza SQLite nie powinna być wywoływana powtórnie');
  });

  it('Powiadamia subskrybentów UI o nadejściu i zaaplikowaniu zmiany w SQLite', async () => {
    InboundSyncConsumer.setMockDbExecutor(async () => true);

    let notifiedEvent: StoreRealtimeEvent | null = null;
    const unsubscribe = InboundSyncConsumer.onEventApplied((evt) => {
      notifiedEvent = evt;
    });

    const event: StoreRealtimeEvent = {
      eventId: 'evt_notify_test_303',
      storeId: '108120',
      domain: 'schedules',
      action: 'UPSERT',
      entityId: 'shift_test_303',
      payload: { hours: 8.0 },
      author: 'author',
      originDeviceId: 'foreign_device',
      timestamp: new Date().toISOString(),
      version: 1,
    };

    await InboundSyncConsumer.processInboundEvent(event);

    assert.ok(notifiedEvent);
    assert.equal(notifiedEvent.eventId, 'evt_notify_test_303');

    unsubscribe();
  });
});
