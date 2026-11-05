// src/services/sync/cloudRealtimeTransport.ts
/**
 * Starbucks Operations Suite — Real-time Cloud Transport Layer (Feature F18 / Step 1)
 * Architektura Multi-Store Fleet
 *
 * Zapewnia warstwę transportową w czasie rzeczywistym między stacjami roboczymi kawiarni
 * a bazą Google Cloud Firestore (starbucks-ops-suite).
 *
 * Standardy:
 * 1. Kanał per lokal: `stores/{storeId}/realtime_events/{eventId}`.
 * 2. Echo Cancellation: automatyczne pomijanie własnych zdarzeń (originDeviceId).
 * 3. Adaptacyjne nasłuchiwanie: streaming/polling z natychmiastową reakcją i backoffem w trybie idle.
 * 4. Odporność sieciowa: płynne przełączanie między ONLINE, RECONNECTING i OFFLINE.
 * 5. Izolacja Zero-Leak: zdarzenia mogą przenosić zaszyfrowane ładunki AES-256-GCM.
 */

import { FIRESTORE_BASE_URL } from './cloudSyncService';
import { AuthService } from '../auth/authService';

export type RealtimeDomain = 'schedules' | 'personnel' | 'financials' | 'trainings' | 'system';
export type RealtimeAction = 'UPSERT' | 'DELETE';
export type RealtimeConnectionState = 'IDLE' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'OFFLINE' | 'ERROR';

export interface StoreRealtimeEvent<T = any> {
  eventId: string;
  storeId: string;
  domain: RealtimeDomain;
  action: RealtimeAction;
  entityId: string;
  payload: T;
  author: string;
  originDeviceId: string;
  timestamp: string; // ISO-8601
  version?: number;
}

export interface PublishEventInput<T = any> {
  storeId: string;
  domain: RealtimeDomain;
  action: RealtimeAction;
  entityId: string;
  payload: T;
  author?: string;
  version?: number;
}

export interface RealtimeTransportConfig {
  activePollIntervalMs?: number; // domyślnie 1500 ms w trybie aktywnym
  idlePollIntervalMs?: number;   // domyślnie 6000 ms w trybie bezczynności
  maxBatchSize?: number;         // maks. liczba zdarzeń w jednej paczce (domyślnie 50)
  customFetch?: typeof fetch;
}

export const parseFirestoreValue = (field: any): any => {
  if (field === null || field === undefined || typeof field !== 'object') return field;
  if ('stringValue' in field) return field.stringValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('integerValue' in field) return parseInt(field.integerValue, 10);
  if ('doubleValue' in field) return parseFloat(field.doubleValue);
  if ('nullValue' in field) return null;
  if ('arrayValue' in field) {
    const list = field.arrayValue?.values || [];
    return list.map(parseFirestoreValue);
  }
  if ('mapValue' in field) {
    const fields = field.mapValue?.fields || {};
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = parseFirestoreValue(v);
    }
    return obj;
  }
  return field;
};

export const formatFirestoreValue = (val: any): any => {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(formatFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = formatFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
};

export class CloudRealtimeTransport {
  private static activeStoreId: string | null = null;
  private static connectionState: RealtimeConnectionState = 'IDLE';
  private static pollTimer: any = null;
  private static lastTimestamp: string = new Date(Date.now() - 60000).toISOString();
  private static eventSubscribers = new Set<(event: StoreRealtimeEvent) => void>();
  private static statusSubscribers = new Set<(state: RealtimeConnectionState) => void>();
  private static seenEventIds = new Set<string>();
  private static customFetch: typeof fetch | null = null;
  private static config: RealtimeTransportConfig = {
    activePollIntervalMs: 1500,
    idlePollIntervalMs: 6000,
    maxBatchSize: 50,
  };

  /**
   * Konfiguruje niestandardowy silnik fetch (np. do testów jednostkowych)
   */
  public static setCustomFetch(fn: typeof fetch | null): void {
    this.customFetch = fn;
  }

  /**
   * Zwraca bieżący stan połączenia warstwy transportowej
   */
  public static getConnectionState(): RealtimeConnectionState {
    return this.connectionState;
  }

  /**
   * Zwraca ID aktywnej kawiarni nasłuchiwanej w chmurze
   */
  public static getActiveStoreId(): string | null {
    return this.activeStoreId;
  }

  /**
   * Subskrybuje zmiany stanu połączenia
   */
  public static onStatusChange(callback: (state: RealtimeConnectionState) => void): () => void {
    this.statusSubscribers.add(callback);
    callback(this.connectionState);
    return () => {
      this.statusSubscribers.delete(callback);
    };
  }

  /**
   * Subskrybuje strumień zdarzeń kawiarni w czasie rzeczywistym
   */
  public static subscribeToStore(
    storeId: string,
    onEvent: (event: StoreRealtimeEvent) => void
  ): () => void {
    this.eventSubscribers.add(onEvent);

    if (this.activeStoreId !== storeId) {
      this.startListening(storeId);
    }

    return () => {
      this.eventSubscribers.delete(onEvent);
      if (this.eventSubscribers.size === 0) {
        this.stopListening();
      }
    };
  }

  /**
   * Uruchamia pętlę nasłuchiwania w czasie rzeczywistym dla wybranej kawiarni
   */
  public static startListening(storeId: string, config?: RealtimeTransportConfig): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.activeStoreId = storeId;
    this.lastTimestamp = new Date(Date.now() - 30000).toISOString();
    this.seenEventIds.clear();
    this.setConnectionState('CONNECTING');

    this.scheduleNextPoll(100);
  }

  /**
   * Zatrzymuje pętlę nasłuchiwania
   */
  public static stopListening(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.activeStoreId = null;
    this.setConnectionState('DISCONNECTED');
  }

  /**
   * Publikuje nowe zdarzenie do kolejki czasu rzeczywistego w Firestore
   */
  public static async publishEvent<T = any>(
    input: PublishEventInput<T>
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    const fetchFn = this.customFetch || fetch;
    const deviceId = AuthService.getDeviceFingerprint();
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    const event: StoreRealtimeEvent<T> = {
      eventId,
      storeId: input.storeId,
      domain: input.domain,
      action: input.action,
      entityId: input.entityId,
      payload: input.payload,
      author: input.author || 'system_manager',
      originDeviceId: deviceId,
      timestamp,
      version: input.version || 1,
    };

    // Zarejestruj własny eventId w pamięci, aby odrzucić go natychmiast przy odbiorze (Echo Cancellation)
    this.seenEventIds.add(eventId);

    const docPayload = {
      fields: {
        eventId: { stringValue: event.eventId },
        storeId: { stringValue: event.storeId },
        domain: { stringValue: event.domain },
        action: { stringValue: event.action },
        entityId: { stringValue: event.entityId },
        payload: typeof event.payload === 'string'
          ? { stringValue: event.payload }
          : formatFirestoreValue(event.payload),
        author: { stringValue: event.author },
        originDeviceId: { stringValue: event.originDeviceId },
        timestamp: { stringValue: event.timestamp },
        version: { integerValue: String(event.version) },
      },
    };

    try {
      const url = `${FIRESTORE_BASE_URL}/stores/${input.storeId}/realtime_events/${eventId}`;
      const res = await fetchFn(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docPayload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Błąd HTTP');
        return { success: false, error: `Błąd publikacji [${res.status}]: ${errText}` };
      }

      // Po udanej publikacji wywołaj natychmiastowy cykl odpytania
      if (this.activeStoreId === input.storeId) {
        this.scheduleNextPoll(50);
      }

      return { success: true, eventId };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Nieznany błąd publikacji zdarzenia' };
    }
  }

  /**
   * Pojedynczy krok odpytania chmury o nowe zdarzenia po ostatnim znaczniku czasu
   */
  public static async pollOnce(storeId: string): Promise<StoreRealtimeEvent[]> {
    const fetchFn = this.customFetch || fetch;
    const currentDeviceId = AuthService.getDeviceFingerprint();

    // Query przez structuredQuery w Firestore REST
    const queryUrl = `${FIRESTORE_BASE_URL}/stores/${storeId}:runQuery`;
    const body = {
      structuredQuery: {
        from: [{ collectionId: 'realtime_events' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'timestamp' },
            op: 'GREATER_THAN',
            value: { stringValue: this.lastTimestamp },
          },
        },
        orderBy: [
          {
            field: { fieldPath: 'timestamp' },
            direction: 'ASCENDING',
          },
        ],
        limit: this.config.maxBatchSize || 50,
      },
    };

    try {
      const res = await fetchFn(queryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        // Fallback do standardowego listowania dokumentów, jeśli runQuery jest zablokowane
        return await this.fallbackListDocuments(storeId, fetchFn, currentDeviceId);
      }

      const results = await res.json();
      if (!Array.isArray(results)) {
        this.setConnectionState('CONNECTED');
        return [];
      }

      const events: StoreRealtimeEvent[] = [];

      for (const item of results) {
        const doc = item?.document;
        if (!doc || !doc.fields) continue;

        const event = this.mapDocumentToEvent(doc);
        if (!event) continue;

        // Aktualizuj kursor czasu
        if (event.timestamp > this.lastTimestamp) {
          this.lastTimestamp = event.timestamp;
        }

        // Echo Cancellation: Ignoruj własne zdarzenia wysłane z tej stacji
        if (event.originDeviceId === currentDeviceId || this.seenEventIds.has(event.eventId)) {
          this.seenEventIds.add(event.eventId);
          continue;
        }

        this.seenEventIds.add(event.eventId);
        events.push(event);
      }

      this.setConnectionState('CONNECTED');
      return events;
    } catch (err: any) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        this.setConnectionState('OFFLINE');
      } else {
        this.setConnectionState('ERROR');
      }
      return [];
    }
  }

  /**
   * Planuje następne odpytanie w pętli adaptacyjnej
   */
  private static scheduleNextPoll(delayMs: number): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);

    this.pollTimer = setTimeout(async () => {
      if (!this.activeStoreId) return;

      const events = await this.pollOnce(this.activeStoreId);

      // Rozgłoś nowe zdarzenia do subskrybentów
      if (events.length > 0) {
        for (const event of events) {
          for (const listener of this.eventSubscribers) {
            try {
              listener(event);
            } catch (err) {
              console.error('[CloudRealtimeTransport] Błąd subskrybenta:', err);
            }
          }
        }
      }

      // Adaptacyjny interwał: jeśli były zdarzenia -> szybki interwał; jeśli cisza -> interwał idle
      const nextInterval = events.length > 0
        ? (this.config.activePollIntervalMs || 1500)
        : (this.config.idlePollIntervalMs || 6000);

      this.scheduleNextPoll(nextInterval);
    }, delayMs);
  }

  /**
   * Fallback: pobranie dokumentów przez standardowe listowanie kolekcji
   */
  private static async fallbackListDocuments(
    storeId: string,
    fetchFn: typeof fetch,
    currentDeviceId: string
  ): Promise<StoreRealtimeEvent[]> {
    const listUrl = `${FIRESTORE_BASE_URL}/stores/${storeId}/realtime_events?pageSize=30`;
    const res = await fetchFn(listUrl, { method: 'GET' });
    if (!res.ok) {
      this.setConnectionState('ERROR');
      return [];
    }

    const data = await res.json();
    const docs = data?.documents || [];
    const events: StoreRealtimeEvent[] = [];

    for (const doc of docs) {
      if (!doc || !doc.fields) continue;
      const event = this.mapDocumentToEvent(doc);
      if (!event) continue;

      if (event.timestamp <= this.lastTimestamp) continue;
      this.lastTimestamp = event.timestamp;

      if (event.originDeviceId === currentDeviceId || this.seenEventIds.has(event.eventId)) {
        this.seenEventIds.add(event.eventId);
        continue;
      }

      this.seenEventIds.add(event.eventId);
      events.push(event);
    }

    this.setConnectionState('CONNECTED');
    return events;
  }

  /**
   * Mapuje surowy dokument Firestore REST na typed StoreRealtimeEvent
   */
  private static mapDocumentToEvent(doc: any): StoreRealtimeEvent | null {
    try {
      const f = doc.fields;
      const eventId = f.eventId?.stringValue || doc.name?.split('/')?.pop() || '';
      const storeId = f.storeId?.stringValue || '';
      const domain = (f.domain?.stringValue || 'system') as RealtimeDomain;
      const action = (f.action?.stringValue || 'UPSERT') as RealtimeAction;
      const entityId = f.entityId?.stringValue || '';
      const author = f.author?.stringValue || '';
      const originDeviceId = f.originDeviceId?.stringValue || '';
      const timestamp = f.timestamp?.stringValue || new Date().toISOString();
      const version = f.version?.integerValue ? parseInt(f.version.integerValue, 10) : 1;

      let payload: any = null;
      if (f.payload) {
        payload = parseFirestoreValue(f.payload);
      }

      return {
        eventId,
        storeId,
        domain,
        action,
        entityId,
        payload,
        author,
        originDeviceId,
        timestamp,
        version,
      };
    } catch {
      return null;
    }
  }

  /**
   * Ustawia stan połączenia i powiadamia subskrybentów
   */
  private static setConnectionState(newState: RealtimeConnectionState): void {
    if (this.connectionState === newState) return;
    this.connectionState = newState;
    for (const cb of this.statusSubscribers) {
      try {
        cb(newState);
      } catch {}
    }
  }

  /**
   * Resetuje stan wewnętrzny serwisu (do testów)
   */
  public static _resetForTesting(): void {
    this.stopListening();
    this.eventSubscribers.clear();
    this.statusSubscribers.clear();
    this.seenEventIds.clear();
    this.customFetch = null;
    this.connectionState = 'IDLE';
    this.lastTimestamp = new Date(Date.now() - 60000).toISOString();
  }
}
