// src/services/sync/inboundSyncConsumer.ts
/**
 * Starbucks Operations Suite — Inbound Sync Consumer (Feature F18 / Step 3)
 * Architektura Multi-Store Fleet
 *
 * Odpowiada za:
 * 1. Odbiór przychodzących zdarzeń czasu rzeczywistego z chmury Firestore (`CloudRealtimeTransport`).
 * 2. Natychmiastowe zreplikowanie (Inbound Mirror) zdarzenia w lokalnej bazie SQLite `store_${id}.db`.
 * 3. Eliminację duplikatów (Deduplication) oraz ochronę przed echem (Echo Cancellation).
 * 4. Powiadamianie komponentów UI o nadejściu zewnętrznych zmian.
 */

import { CloudRealtimeTransport, StoreRealtimeEvent } from './cloudRealtimeTransport';
import { StoreService } from '../storeService';

export interface InboundApplicationResult {
  success: boolean;
  applied: boolean;
  eventId: string;
  error?: string;
}

export class InboundSyncConsumer {
  private static isInitialized = false;
  private static activeStoreId: string | null = null;
  private static unsubscribeTransport: (() => void) | null = null;
  private static appliedEventIds = new Set<string>();
  private static appliedListeners = new Set<(event: StoreRealtimeEvent) => void>();
  private static mockDbExecutor: ((event: StoreRealtimeEvent) => Promise<boolean>) | null = null;

  /**
   * Pozwala wstrzyknąć niestandardowy executor bazy danych (np. do testów jednostkowych w Node.js)
   */
  public static setMockDbExecutor(fn: ((event: StoreRealtimeEvent) => Promise<boolean>) | null): void {
    this.mockDbExecutor = fn;
  }

  /**
   * Inicjalizuje konsumpcję zdarzeń dla wybranej kawiarni
   */
  public static init(storeId?: string): void {
    const targetStoreId = storeId || StoreService.getCurrentStore()?.id || '108120';

    if (this.isInitialized && this.activeStoreId === targetStoreId) {
      return;
    }

    this.destroy();

    this.isInitialized = true;
    this.activeStoreId = targetStoreId;

    this.unsubscribeTransport = CloudRealtimeTransport.subscribeToStore(
      targetStoreId,
      async (event: StoreRealtimeEvent) => {
        await this.processInboundEvent(event);
      }
    );
  }

  /**
   * Przetwarza pojedyncze przychodzące zdarzenie i aplikuje je w SQLite
   */
  public static async processInboundEvent(event: StoreRealtimeEvent): Promise<InboundApplicationResult> {
    if (!event || !event.eventId) {
      return { success: false, applied: false, eventId: '', error: 'Brak eventId' };
    }

    // Deduplikacja: Odrzuć jeśli zdarzenie było już wcześniej przetworzone
    if (this.appliedEventIds.has(event.eventId)) {
      return { success: true, applied: false, eventId: event.eventId };
    }

    this.appliedEventIds.add(event.eventId);

    // Ogranicz wielkość zbioru cache do 5000 identyfikatorów
    if (this.appliedEventIds.size > 5000) {
      const firstItems = Array.from(this.appliedEventIds).slice(0, 1000);
      for (const id of firstItems) {
        this.appliedEventIds.delete(id);
      }
    }

    let applied = false;

    // 1. Wykonanie przez mock executora (np. w testach)
    if (this.mockDbExecutor) {
      try {
        applied = await this.mockDbExecutor(event);
      } catch (err: any) {
        return { success: false, applied: false, eventId: event.eventId, error: err?.message };
      }
    } else {
      // 2. Aplikowanie przez most IPC w Electronie
      const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;
      if (api?.realtimeApplyInboundEvent) {
        try {
          const res = await api.realtimeApplyInboundEvent(event);
          applied = Boolean(res?.applied ?? res?.success);
        } catch (err: any) {
          console.error('[InboundSyncConsumer] Błąd wywołania realtimeApplyInboundEvent:', err);
          return { success: false, applied: false, eventId: event.eventId, error: err?.message };
        }
      }
    }

    // 3. Rozgłoszenie do subskrybentów UI
    for (const listener of this.appliedListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[InboundSyncConsumer] Błąd powiadomienia listenera:', err);
      }
    }

    return { success: true, applied, eventId: event.eventId };
  }

  /**
   * Rejestruje nasłuchiwacz na przetworzone zdarzenia (dla komponentów UI)
   */
  public static onEventApplied(callback: (event: StoreRealtimeEvent) => void): () => void {
    this.appliedListeners.add(callback);
    return () => {
      this.appliedListeners.delete(callback);
    };
  }

  /**
   * Zwraca liczbę zaaplikowanych dotąd zdarzeń
   */
  public static getAppliedEventsCount(): number {
    return this.appliedEventIds.size;
  }

  /**
   * Resetuje stan wewnętrzny serwisu (do testów)
   */
  public static destroy(): void {
    if (this.unsubscribeTransport) {
      this.unsubscribeTransport();
      this.unsubscribeTransport = null;
    }
    this.isInitialized = false;
    this.activeStoreId = null;
    this.appliedEventIds.clear();
    this.appliedListeners.clear();
    this.mockDbExecutor = null;
  }
}
