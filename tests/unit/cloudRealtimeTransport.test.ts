import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CloudRealtimeTransport,
  StoreRealtimeEvent,
  formatFirestoreValue,
  parseFirestoreValue,
} from '../../src/services/sync/cloudRealtimeTransport';

describe('CloudRealtimeTransport - Warstwa Transportu w Czasie Rzeczywistym', () => {
  beforeEach(() => {
    CloudRealtimeTransport._resetForTesting();
  });

  it('formatFirestoreValue i parseFirestoreValue poprawnie konwertują typy danych', () => {
    const original = {
      text: 'hello',
      numInt: 42,
      numFloat: 3.14,
      flag: true,
      empty: null,
      list: ['a', 123],
    };

    const formatted = formatFirestoreValue(original);
    assert.equal(formatted.mapValue.fields.text.stringValue, 'hello');
    assert.equal(formatted.mapValue.fields.numInt.integerValue, '42');
    assert.equal(formatted.mapValue.fields.numFloat.doubleValue, 3.14);
    assert.equal(formatted.mapValue.fields.flag.booleanValue, true);
    assert.equal(formatted.mapValue.fields.empty.nullValue, null);
    assert.equal(formatted.mapValue.fields.list.arrayValue.values.length, 2);

    const parsed = parseFirestoreValue(formatted);
    assert.deepEqual(parsed, original);
  });

  it('Publikacja zdarzenia wysyła poprawny payload PATCH do Firestore', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    const mockFetch = async (url: any, opts: any) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as any;
    };

    CloudRealtimeTransport.setCustomFetch(mockFetch as any);

    const result = await CloudRealtimeTransport.publishEvent({
      storeId: '108120',
      domain: 'schedules',
      action: 'UPSERT',
      entityId: 'shift_2026_03_12_mgr1',
      payload: { shiftCode: 'AM', hours: 8 },
      author: 'dawid.apel@amrest.eu',
    });

    assert.equal(result.success, true);
    assert.ok(result.eventId?.startsWith('evt_'));
    assert.ok(capturedUrl.includes('/stores/108120/realtime_events/'));
    assert.equal(capturedBody.fields.storeId.stringValue, '108120');
    assert.equal(capturedBody.fields.domain.stringValue, 'schedules');
    assert.equal(capturedBody.fields.action.stringValue, 'UPSERT');
    assert.equal(capturedBody.fields.entityId.stringValue, 'shift_2026_03_12_mgr1');
  });

  it('Echo Cancellation odrzuca zdarzenia pochodzące z tego samego urządzenia', async () => {
    // 1. Publikujemy zdarzenie z tego urządzenia
    const mockFetchPublish = async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as any);

    CloudRealtimeTransport.setCustomFetch(mockFetchPublish as any);

    const pubResult = await CloudRealtimeTransport.publishEvent({
      storeId: '108120',
      domain: 'schedules',
      action: 'UPSERT',
      entityId: 'shift_test_echo',
      payload: { test: true },
    });

    assert.ok(pubResult.eventId);

    // 2. Symulujemy, że runQuery zwraca właśnie opublikowane zdarzenie
    const mockRunQuery = async () => {
      return {
        ok: true,
        json: async () => [
          {
            document: {
              name: `projects/starbucks-ops-suite/databases/(default)/documents/stores/108120/realtime_events/${pubResult.eventId}`,
              fields: {
                eventId: { stringValue: pubResult.eventId },
                storeId: { stringValue: '108120' },
                domain: { stringValue: 'schedules' },
                action: { stringValue: 'UPSERT' },
                entityId: { stringValue: 'shift_test_echo' },
                originDeviceId: { stringValue: 'test_local_device' },
                timestamp: { stringValue: new Date().toISOString() },
                version: { integerValue: '1' },
              },
            },
          },
        ],
      } as any;
    };

    CloudRealtimeTransport.setCustomFetch(mockRunQuery as any);

    const receivedEvents = await CloudRealtimeTransport.pollOnce('108120');
    // Zdarzenie powinno zostać pominięte (Echo Cancellation)
    assert.equal(receivedEvents.length, 0, 'Własne zdarzenie powinno zostać odrzucone przez Echo Cancellation');
  });

  it('Odbiera i przekazuje zdarzenia od innych stacji (obcy originDeviceId)', async () => {
    const foreignEventId = 'evt_foreign_999';
    const mockRunQuery = async () => {
      return {
        ok: true,
        json: async () => [
          {
            document: {
              name: `projects/starbucks-ops-suite/databases/(default)/documents/stores/108120/realtime_events/${foreignEventId}`,
              fields: {
                eventId: { stringValue: foreignEventId },
                storeId: { stringValue: '108120' },
                domain: { stringValue: 'schedules' },
                action: { stringValue: 'UPSERT' },
                entityId: { stringValue: 'shift_foreign_1' },
                payload: {
                  mapValue: {
                    fields: {
                      shiftCode: { stringValue: 'PM' },
                      hours: { integerValue: '8' },
                    },
                  },
                },
                originDeviceId: { stringValue: 'foreign_macbook_device_id_99' },
                timestamp: { stringValue: new Date().toISOString() },
                version: { integerValue: '1' },
              },
            },
          },
        ],
      } as any;
    };

    CloudRealtimeTransport.setCustomFetch(mockRunQuery as any);

    const received = await CloudRealtimeTransport.pollOnce('108120');
    assert.equal(received.length, 1);
    assert.equal(received[0].eventId, foreignEventId);
    assert.equal(received[0].domain, 'schedules');
    assert.equal(received[0].payload.shiftCode, 'PM');
    assert.equal(received[0].payload.hours, 8);
    assert.equal(CloudRealtimeTransport.getConnectionState(), 'CONNECTED');
  });
});
