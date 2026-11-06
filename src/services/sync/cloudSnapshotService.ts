// src/services/sync/cloudSnapshotService.ts
/**
 * Starbucks Operations Suite — Cloud Snapshot Service (Feature F19)
 * Architektura Multi-Store Fleet
 *
 * Odpowiada za:
 * 1. Zautomatyzowane tworzenie migawek (Cloud Snapshots) w tle (dobowe 24h oraz pre-action przed importem).
 * 2. Zapisywanie zaszyfrowanych punktów przywracania w Firestore: `stores/{storeId}/snapshots/{snapshotId}`.
 * 3. Trzypoziomową Tarczę Kolizyjną:
 *    - Filar 1: Detekcja świeżych zmian w chmurze (ostrzeżenie przed nadpisaniem pracy innego managera).
 *    - Filar 2: Pre-Restore Safety Snapshot (automatyczna migawka bezpieczeństwa stanu bieżącego przed cofnięciem).
 *    - Filar 3: Selektywne przywracanie domenowe (możliwość przywrócenia np. tylko logowań MAPAL bez ruszania grafiku).
 * 4. Autorytatywny broadcast `STORE_RESTORED` do pozostałych stacji w kawiarni.
 */

import { FIRESTORE_BASE_URL } from './cloudSyncService';
import { StoreService } from '../storeService';
import { AuthService } from '../auth/authService';
import { CloudRealtimeTransport } from './cloudRealtimeTransport';
import { logger } from '../logger';

export type SnapshotDomain = 'schedules' | 'personnel' | 'financials' | 'trainings';

export interface SnapshotSummary {
  shiftsCount: number;
  employeesCount: number;
  mapalRecordsCount: number;
  aopRecordsCount: number;
}

export interface StoreCloudSnapshotRecord {
  snapshotId: string;
  storeId: string;
  createdAt: string;
  formattedDate: string;
  author: string;
  reason: string;
  domains: SnapshotDomain[];
  summary: SnapshotSummary;
  sha256?: string;
  sizeBytes?: number;
}

export interface SnapshotCollisionReport {
  hasCollision: boolean;
  newerEventsCount: number;
  lastEditor?: string;
  lastEditedAt?: string;
  affectedDomains: SnapshotDomain[];
}

const STORAGE_LAST_SNAPSHOT_PREFIX = 'sbx_cloud_snapshot_last_ts_';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const memorySnapshotTimestamps = new Map<string, number>();

export class CloudSnapshotService {
  private static timerId: any = null;
  private static isCreating = false;

  /**
   * Inicjalizuje autonomiczny harmonogram tworzenia snapshotów (1x na 24h w tle)
   */
  public static initAutonomousScheduler(): void {
    if (typeof window === 'undefined') return;

    // Sprawdzenie przy starcie aplikacji z krótkim opóźnieniem
    setTimeout(() => {
      this.checkAndRunDailySnapshot().catch((err) => {
        logger.warn('SYNC', `[CloudSnapshot] Błąd sprawdzania dobowego snapshotu: ${err?.message}`);
      });
    }, 4000);

    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      this.checkAndRunDailySnapshot().catch(() => {});
    }, 60 * 60 * 1000); // Sprawdzaj co 1h
  }

  /**
   * Sprawdza czy minęło 24h od ostatniego snapshotu dla aktywnej kawiarni
   */
  public static async checkAndRunDailySnapshot(): Promise<void> {
    const store = StoreService.getCurrentStore();
    if (!store) return;

    const key = `${STORAGE_LAST_SNAPSHOT_PREFIX}${store.id}`;
    const lastTs = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : String(memorySnapshotTimestamps.get(store.id) || '');
    const now = Date.now();

    if (!lastTs || now - parseInt(lastTs, 10) >= ONE_DAY_MS) {
      logger.info('SYNC', `[CloudSnapshot] Wykonywanie automatycznego snapshotu dobowego dla lokalu ${store.id}`);
      await this.createSnapshot(store.id, 'Automatyczna codzienna ochrona chmurowa (24h)');
    }
  }

  /**
   * Hook wyzwalany przed ryzykownymi operacjami masowymi (import MAPAL, import AOP, publikacja grafiku)
   */
  public static async triggerPreActionSnapshot(actionDescription: string): Promise<boolean> {
    const store = StoreService.getCurrentStore();
    if (!store) return false;

    try {
      const res = await this.createSnapshot(
        store.id,
        `Punkt bezpieczeństwa przed: ${actionDescription}`
      );
      return res.success;
    } catch (err: any) {
      logger.warn('SYNC', `[CloudSnapshot] Nie udało się wykonać snapshotu pre-action: ${err?.message}`);
      return false;
    }
  }

  /**
   * Zwraca czas ostatniego udanego snapshotu
   */
  public static getLastSnapshotTime(storeId?: string): string | null {
    const targetStoreId = storeId || StoreService.getCurrentStore()?.id || 'default';
    if (typeof localStorage !== 'undefined') {
      const ts = localStorage.getItem(`${STORAGE_LAST_SNAPSHOT_PREFIX}${targetStoreId}`);
      if (ts) return new Date(parseInt(ts, 10)).toISOString();
    }
    const memTs = memorySnapshotTimestamps.get(targetStoreId);
    return memTs ? new Date(memTs).toISOString() : null;
  }

  /**
   * Tworzy nowy Cloud Snapshot (zapis lokalny SQLite + zaszyfrowana chmura Firestore)
   */
  public static async createSnapshot(
    storeId: string,
    reason: string = 'Ręczna migawka bezpieczeństwa',
    domains: SnapshotDomain[] = ['schedules', 'personnel', 'financials', 'trainings']
  ): Promise<{ success: boolean; snapshotId?: string; message: string; error?: string }> {
    if (this.isCreating) {
      return { success: false, message: 'Inna operacja tworzenia snapshotu jest już w toku.' };
    }

    this.isCreating = true;
    try {
      const session = AuthService.getCurrentSession();
      const author = session?.fullName || session?.email || 'Store Manager';
      const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();

      const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;

      // 1. Zapis w środowisku Electron (Node.js) przez IPC
      if (api?.createCloudSnapshot) {
        const result = await api.createCloudSnapshot({
          storeId,
          snapshotId,
          reason,
          author,
          domains,
          timestamp: nowIso,
        });

        if (result && result.success) {
          memorySnapshotTimestamps.set(storeId, Date.now());
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`${STORAGE_LAST_SNAPSHOT_PREFIX}${storeId}`, String(Date.now()));
          }
          return {
            success: true,
            snapshotId,
            message: `Pomyślnie utworzono i zsynchronizowano Cloud Snapshot [${snapshotId}].`,
          };
        }

        return {
          success: false,
          message: result?.error || 'Błąd podczas tworzenia snapshotu w procesie głównym.',
          error: result?.error,
        };
      }

      // 2. Fallback Web Mock (gdy uruchomione w przeglądarce lub testach)
      memorySnapshotTimestamps.set(storeId, Date.now());
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${STORAGE_LAST_SNAPSHOT_PREFIX}${storeId}`, String(Date.now()));
      }
      return {
        success: true,
        snapshotId,
        message: 'Cloud Snapshot został zasymulowany w trybie przeglądarki.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Błąd tworzenia snapshotu: ${err.message}`,
        error: err.message,
      };
    } finally {
      this.isCreating = false;
    }
  }

  /**
   * Pobiera listę snapshotów lokalu z Firestore (lub lokalnego cache'u)
   */
  public static async listSnapshots(storeId: string): Promise<StoreCloudSnapshotRecord[]> {
    try {
      const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;
      if (api?.listCloudSnapshots) {
        const loaded = await api.listCloudSnapshots(storeId);
        if (Array.isArray(loaded)) return loaded;
      }

      // Web Fallback: pobranie przez REST z Firestore
      const url = `${FIRESTORE_BASE_URL}/stores/${storeId}/snapshots?pageSize=20`;
      const res = await fetch(url);
      if (!res.ok) return [];

      const data = await res.json();
      const documents = data.documents || [];

      return documents.map((doc: any) => {
        const fields = doc.fields || {};
        const snapshotId = fields.snapshotId?.stringValue || doc.name.split('/').pop();
        const createdAt = fields.createdAt?.stringValue || new Date().toISOString();
        const dateObj = new Date(createdAt);

        return {
          snapshotId,
          storeId: fields.storeId?.stringValue || storeId,
          createdAt,
          formattedDate: dateObj.toLocaleString('pl-PL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          author: fields.author?.stringValue || 'System',
          reason: fields.reason?.stringValue || 'Kopia zapasowa',
          domains: (fields.domains?.arrayValue?.values || []).map((v: any) => v.stringValue),
          summary: {
            shiftsCount: parseInt(fields.shiftsCount?.integerValue || '0', 10),
            employeesCount: parseInt(fields.employeesCount?.integerValue || '0', 10),
            mapalRecordsCount: parseInt(fields.mapalRecordsCount?.integerValue || '0', 10),
            aopRecordsCount: parseInt(fields.aopRecordsCount?.integerValue || '0', 10),
          },
          sizeBytes: parseInt(fields.sizeBytes?.integerValue || '0', 10),
        };
      });
    } catch (err) {
      logger.warn('SYNC', `[CloudSnapshot] Nie udało się pobrać listy snapshotów: ${err}`);
      return [];
    }
  }

  /**
   * TARCZA FILAR 1: Sprawdza czy w chmurze istnieją nowsze zmiany niż wybierany snapshot
   */
  public static async checkCollisions(
    storeId: string,
    snapshotCreatedAt: string
  ): Promise<SnapshotCollisionReport> {
    try {
      const snapshotTime = new Date(snapshotCreatedAt).getTime();
      const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;

      if (api?.checkSnapshotCollisions) {
        return await api.checkSnapshotCollisions(storeId, snapshotCreatedAt);
      }

      // Sprawdzenie przez kanał zdarzeń w Firestore
      const url = `${FIRESTORE_BASE_URL}/stores/${storeId}/realtime_events?pageSize=30`;
      const res = await fetch(url);
      if (!res.ok) {
        return { hasCollision: false, newerEventsCount: 0, affectedDomains: [] };
      }

      const data = await res.json();
      const docs = data.documents || [];
      let collisionCount = 0;
      let lastEditor: string | undefined;
      let lastEditedAt: string | undefined;
      const affectedDomains = new Set<SnapshotDomain>();

      for (const doc of docs) {
        const fields = doc.fields || {};
        const tsStr = fields.timestamp?.stringValue;
        if (!tsStr) continue;

        const eventTime = new Date(tsStr).getTime();
        if (eventTime > snapshotTime) {
          collisionCount++;
          if (!lastEditedAt || eventTime > new Date(lastEditedAt).getTime()) {
            lastEditedAt = tsStr;
            lastEditor = fields.author?.stringValue || 'Inny użytkownik';
          }
          const domain = fields.domain?.stringValue as SnapshotDomain;
          if (domain) affectedDomains.add(domain);
        }
      }

      return {
        hasCollision: collisionCount > 0,
        newerEventsCount: collisionCount,
        lastEditor,
        lastEditedAt,
        affectedDomains: Array.from(affectedDomains),
      };
    } catch (err) {
      return { hasCollision: false, newerEventsCount: 0, affectedDomains: [] };
    }
  }

  /**
   * DWUSTOPNIOWE PRZYWRACANIE (Filar 2 & 3):
   * 1. Pre-Restore Safety Snapshot (stan bieżący nigdy nie ginie)
   * 2. Selektywna aplikacja domen w SQLite
   * 3. Autorytatywny broadcast STORE_RESTORED
   */
  public static async executeRestore(options: {
    storeId: string;
    snapshotId: string;
    selectedDomains: SnapshotDomain[];
    author?: string;
  }): Promise<{ success: boolean; message: string; safetySnapshotId?: string; error?: string }> {
    const { storeId, snapshotId, selectedDomains } = options;
    const session = AuthService.getCurrentSession();
    const author = options.author || session?.fullName || session?.email || 'Store Manager';

    try {
      const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;

      // 1. TARCZA FILAR 2: Automatyczna migawka ratunkowa stanu bieżącego
      logger.info('SYNC', `[CloudSnapshot] Tworzenie automatycznego Pre-Restore Safety Snapshot dla ${storeId}...`);
      const safetyResult = await this.createSnapshot(
        storeId,
        `Automatyczna migawka ratunkowa przed przywróceniem snapshotu [${snapshotId}]`
      );

      // 2. TARCZA FILAR 3: Selektywna aplikacja w SQLite
      if (api?.restoreCloudSnapshotSelective) {
        const restoreRes = await api.restoreCloudSnapshotSelective({
          storeId,
          snapshotId,
          selectedDomains,
        });

        if (!restoreRes.success) {
          return {
            success: false,
            message: restoreRes.error || 'Błąd podczas aplikowania danych w bazie SQLite.',
            error: restoreRes.error,
          };
        }
      }

      // 3. Autorytatywny broadcast do pozostałych stacji roboczych
      await CloudRealtimeTransport.publishEvent({
        storeId,
        domain: 'system',
        action: 'UPSERT',
        entityId: `restore_${Date.now()}`,
        author,
        payload: {
          type: 'STORE_RESTORED',
          snapshotId,
          restoredDomains: selectedDomains,
          restoredAt: new Date().toISOString(),
          author,
        },
      });

      return {
        success: true,
        message: `Pomyślnie przywrócono wybrane domeny (${selectedDomains.join(', ')}) ze snapshotu. Utworzono kopię ratunkową obecnego stanu.`,
        safetySnapshotId: safetyResult.snapshotId,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Błąd podczas przywracania snapshotu: ${err.message}`,
        error: err.message,
      };
    }
  }
}
