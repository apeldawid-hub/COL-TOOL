// src/services/sync/syncEngine.ts
/**
 * Starbucks Operations Suite — Local-First Hybrid Sync Engine (Zero-Leak)
 * 108120 SBX Warszawa Janki (Unit 18120)
 *
 * Zasady architektury:
 * 1. Local-First: Zapis do lokalnej bazy danych SQLite / pamięci podręcznej ma priorytet (0 ms latencji).
 * 2. Pełne działanie offline w kawiarni w CH Janki przy braku połączenia internetowego.
 * 3. Zero-Leak: Pracownicy z rolą inną niż Store Manager (SM) lub District Manager (DM)
 *    nigdy nie wysyłają żądań do skarbców stawek i P&L (executive_financial_vault).
 * 4. Asynchroniczna kolejka Outbox: Zmiany grafiku są buforowane i synchronizowane w tle.
 */

import { AuthService, AuthUserSession } from '../auth/authService';

export interface SyncOutboxEntry {
  id: string;
  storeUnitCode: string;
  vaultType: 'public_schedule' | 'private_staff_vault' | 'executive_financial_vault';
  entityId: string;
  action: 'UPSERT' | 'DELETE';
  payload: any;
  queuedAt: string;
  retryCount: number;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
}

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  syncState: 'idle' | 'syncing' | 'error' | 'offline';
  message: string;
}

const STORAGE_OUTBOX_KEY = 'sbx_sync_outbox';
const STORAGE_LAST_SYNC_KEY = 'sbx_sync_last_timestamp';

export class SyncEngine {
  private static isSyncing = false;
  private static listeners: Array<(status: SyncStatus) => void> = [];

  /**
   * Sprawdza status łączności sieciowej
   */
  public static isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Pobiera bieżącą kolejkę Outbox
   */
  public static getOutbox(): SyncOutboxEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_OUTBOX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Zwraca aktualny stan synchronizacji
   */
  public static getStatus(): SyncStatus {
    const outbox = this.getOutbox();
    const pendingCount = outbox.filter(item => item.status === 'PENDING').length;
    const online = this.isOnline();
    const lastSync = localStorage.getItem(STORAGE_LAST_SYNC_KEY);

    let syncState: SyncStatus['syncState'] = 'idle';
    let message = 'Synchronizacja aktualna';

    if (!online) {
      syncState = 'offline';
      message = 'Tryb Offline — zmiany zapisywane lokalnie na dysku';
    } else if (this.isSyncing) {
      syncState = 'syncing';
      message = `Synchronizacja danych z chmurą (${pendingCount} w kolejce)...`;
    } else if (pendingCount > 0) {
      message = `Oczekuje ${pendingCount} zmian do synchronizacji`;
    }

    return {
      isOnline: online,
      pendingCount,
      lastSyncAt: lastSync,
      syncState,
      message,
    };
  }

  /**
   * Rejestruje obserwatora stanu synchronizacji
   */
  public static subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.getStatus());
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private static notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(fn => {
      try {
        fn(status);
      } catch (err) {
        console.error('Błąd powiadomienia subskrybenta synchronizacji:', err);
      }
    });
  }

  /**
   * Dodaje operację do kolejki outbox (Zero-Leak)
   */
  public static enqueueMutation(entry: {
    storeUnitCode: string;
    vaultType: SyncOutboxEntry['vaultType'];
    entityId: string;
    action: 'UPSERT' | 'DELETE';
    payload: any;
  }): void {
    const session = AuthService.getCurrentSession();

    // Rygorystyczna blokada Zero-Leak przed dodaniem wrażliwych danych
    if (entry.vaultType === 'executive_financial_vault') {
      if (!session || (session.role !== 'STORE_MANAGER' && session.role !== 'DISTRICT_MANAGER')) {
        console.warn('Zero-Leak Sentinel: Zablokowano próbę synchronizacji skarbca finansowego przez nieuprawnioną rolę.');
        return;
      }
    }

    const outbox = this.getOutbox();
    const newEntry: SyncOutboxEntry = {
      id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      storeUnitCode: entry.storeUnitCode,
      vaultType: entry.vaultType,
      entityId: entry.entityId,
      action: entry.action,
      payload: entry.payload,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      status: 'PENDING',
    };

    outbox.push(newEntry);
    localStorage.setItem(STORAGE_OUTBOX_KEY, JSON.stringify(outbox));
    this.notifyListeners();

    // Jeśli jesteśmy online, zainicjuj próbę wypchnięcia zmian
    if (this.isOnline()) {
      this.flushOutbox();
    }
  }

  /**
   * Opróżnia kolejkę outbox wysyłając dane do chmury
   */
  public static async flushOutbox(): Promise<void> {
    if (this.isSyncing || !this.isOnline()) return;

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const outbox = this.getOutbox();
      const pendingItems = outbox.filter(item => item.status === 'PENDING');

      for (const item of pendingItems) {
        // Symulacja asynchronicznego zapisu w chmurze Firestore
        await new Promise(resolve => setTimeout(resolve, 80));
        item.status = 'SYNCED';
      }

      // Usuń pomyślnie zsynchronizowane wpisy, zachowując czystą bazę
      const remaining = outbox.filter(item => item.status !== 'SYNCED');
      localStorage.setItem(STORAGE_OUTBOX_KEY, JSON.stringify(remaining));
      localStorage.setItem(STORAGE_LAST_SYNC_KEY, new Date().toISOString());
    } catch (err) {
      console.error('Błąd podczas opróżniania kolejki synchronizacji:', err);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }
}
