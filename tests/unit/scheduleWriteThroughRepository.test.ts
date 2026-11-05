import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ScheduleWriteThroughRepository } from '../../src/services/sync/scheduleWriteThroughRepository';
import { CloudRealtimeTransport } from '../../src/services/sync/cloudRealtimeTransport';
import { SyncEngine } from '../../src/services/sync/syncEngine';

describe('ScheduleWriteThroughRepository - Mechanizm Write-Through', () => {
  beforeEach(() => {
    CloudRealtimeTransport._resetForTesting();
  });

  it('saveShift natychmiast rozgłasza zdarzenie do chmury przez CloudRealtimeTransport', async () => {
    let publishedEvent: any = null;

    const mockFetch = async (url: any, opts: any) => {
      publishedEvent = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as any;
    };

    CloudRealtimeTransport.setCustomFetch(mockFetch as any);

    const shift = {
      year: 2026,
      month: 3,
      day: 15,
      date: '2026-03-15',
      employee_id: 1,
      shift_code: 'AM',
      hours: 8.0,
      notes: 'Otwarcie kawiarni',
    };

    const success = await ScheduleWriteThroughRepository.saveShift(shift);
    assert.equal(success, true);

    // Dajemy mikrosekundę na asynchroniczne rozgłoszenie
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(publishedEvent, 'Zdarzenie powinno zostać wysłane do chmury');
    assert.equal(publishedEvent.fields.domain.stringValue, 'schedules');
    assert.equal(publishedEvent.fields.action.stringValue, 'UPSERT');
    assert.equal(publishedEvent.fields.entityId.stringValue, 'shift_2026_3_15_emp1');
  });

  it('saveBatchShifts rozgłasza paczkę zmian z domain: schedules', async () => {
    let publishedEvent: any = null;

    const mockFetch = async (url: any, opts: any) => {
      publishedEvent = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as any;
    };

    CloudRealtimeTransport.setCustomFetch(mockFetch as any);

    const batch = {
      year: 2026,
      month: 3,
      shifts: [
        {
          year: 2026,
          month: 3,
          day: 1,
          date: '2026-03-01',
          employee_id: 1,
          shift_code: 'AM',
          hours: 8.0,
        },
        {
          year: 2026,
          month: 3,
          day: 1,
          date: '2026-03-01',
          employee_id: 2,
          shift_code: 'PM',
          hours: 8.0,
        },
      ],
    };

    const success = await ScheduleWriteThroughRepository.saveBatchShifts(batch);
    assert.equal(success, true);

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(publishedEvent);
    assert.equal(publishedEvent.fields.domain.stringValue, 'schedules');
    assert.ok(publishedEvent.fields.entityId.stringValue.startsWith('batch_shifts_2026_3'));
  });

  it('saveTeam rozgłasza zmiany personelu z domain: personnel', async () => {
    let publishedEvent: any = null;

    const mockFetch = async (url: any, opts: any) => {
      publishedEvent = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as any;
    };

    CloudRealtimeTransport.setCustomFetch(mockFetch as any);

    const teamPayload = {
      year: 2026,
      month: 3,
      employees: [
        { id: 1, name: 'Jan Kowalski', role: 'STORE_MANAGER' },
        { id: 2, name: 'Anna Nowak', role: 'ASSISTANT_STORE_MANAGER' },
      ],
      propagateToFuture: true,
    };

    const success = await ScheduleWriteThroughRepository.saveTeam(teamPayload);
    assert.equal(success, true);

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(publishedEvent);
    assert.equal(publishedEvent.fields.domain.stringValue, 'personnel');
    assert.equal(publishedEvent.fields.entityId.stringValue, 'team_roster_2026_3');
  });
});
