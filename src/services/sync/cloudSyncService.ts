// src/services/sync/cloudSyncService.ts
/**
 * Starbucks Operations Suite — Real-time Google Cloud Firestore Synchronization Service
 * Project: starbucks-ops-suite
 *
 * Implements bidirectional synchronization (Browser-Safe, Zero-Leak):
 * - Push: Dispatches SQLite tables extraction & encryption to Electron main via IPC.
 * - Pull: Dispatches Firestore vault unpackaging & decryption to Electron main via IPC.
 * - Health Check: Direct Web fetch to test Firestore connectivity and measure latency.
 */

import { StoreStorage } from '../storeStorage';
import { AuthService } from '../auth/authService';

export const FIRESTORE_PROJECT_ID = 'starbucks-ops-suite';
export const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

export interface CloudHealthStatus {
  isConnected: boolean;
  latencyMs: number;
  projectId: string;
  lastChecked: string;
  error?: string;
}

export interface SyncOperationResult {
  success: boolean;
  message: string;
  recordsCount?: number;
  timestamp: string;
  error?: string;
}

export class CloudSyncService {
  private static isOperating = false;

  /**
   * Automatycznie alokuje i rejestruje izolowany obszar kawiarni w chmurze Firestore.
   * Tworzy strukturę `stores/{storeId}/meta/profile` z metadanymi i stanem kawiarni.
   */
  public static async provisionStoreCloudArea(store: {
    id: string;
    name: string;
    shortName: string;
    unitCode: string;
    mpk: string;
    city: string;
    district: string;
    address: string;
    type: string;
  }): Promise<SyncOperationResult> {
    try {
      const url = `${FIRESTORE_BASE_URL}/stores/${store.id}/meta/profile`;
      const body = {
        fields: {
          storeId: { stringValue: store.id },
          name: { stringValue: store.name },
          shortName: { stringValue: store.shortName },
          unitCode: { stringValue: store.unitCode },
          mpk: { stringValue: store.mpk },
          city: { stringValue: store.city },
          district: { stringValue: store.district },
          address: { stringValue: store.address },
          type: { stringValue: store.type },
          provisionedAt: { stringValue: new Date().toISOString() },
          status: { stringValue: 'ACTIVE' },
        },
      };

      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return {
          success: true,
          message: `Pomyślnie wydzielono i zarejestrowano obszar kawiarni [${store.id} - ${store.shortName}] w chmurze Google Cloud.`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        message: `Nie udało się zarejestrować kawiarni w chmurze (HTTP ${res.status}).`,
        timestamp: new Date().toISOString(),
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Błąd sieciowy podczas alokacji kawiarni w chmurze: ${err.message}`,
        timestamp: new Date().toISOString(),
        error: err.message,
      };
    }
  }

  /**
   * Sprawdza status połączenia z chmurą Google Cloud Firestore (czysty web fetch bez modułów Node)
   */
  public static async checkCloudConnection(): Promise<CloudHealthStatus> {
    const startTime = performance.now();
    try {
      const url = `${FIRESTORE_BASE_URL}/cloud_access_requests?pageSize=1`;
      const res = await fetch(url, { method: 'GET' });
      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok) {
        return {
          isConnected: true,
          latencyMs,
          projectId: FIRESTORE_PROJECT_ID,
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        isConnected: false,
        latencyMs,
        projectId: FIRESTORE_PROJECT_ID,
        lastChecked: new Date().toISOString(),
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        isConnected: false,
        latencyMs: Math.round(performance.now() - startTime),
        projectId: FIRESTORE_PROJECT_ID,
        lastChecked: new Date().toISOString(),
        error: err.message || 'Brak łączności sieciowej z Google Cloud.',
      };
    }
  }

  /**
   * Wypycha całą bazę lokalną kawiarni do chmury Google Cloud Firestore (Push)
   * Wykonanie w procesie głównym Electron (Node.js) przez IPC — bezpieczne dla przeglądarki.
   */
  public static async pushStoreToCloud(storeId: string, operatorName?: string): Promise<SyncOperationResult> {
    if (this.isOperating) {
      return { success: false, message: 'Inna operacja synchronizacji jest już w toku.', timestamp: new Date().toISOString() };
    }

    this.isOperating = true;
    try {
      const session = AuthService.getCurrentSession();
      const operatorUid = operatorName || session?.email || 'dawid.apel@amrest.eu';

      const api = typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null;
      if (!api?.executeStoreMigration) {
        return {
          success: false,
          message: 'Funkcja synchronizacji wymaga natywnego środowiska aplikacji desktopowej.',
          timestamp: new Date().toISOString(),
        };
      }

      const result = await api.executeStoreMigration({
        storeId,
        projectId: FIRESTORE_PROJECT_ID,
        operatorUid,
        batchSize: 50,
        maxRetries: 3,
      });

      if (result && result.success) {
        StoreStorage.setItem('sync_last_push_ts', new Date().toISOString(), storeId);
        const count = result.receipt?.totalEntities || 0;
        const vaults = result.receipt?.encryptedPayloadsCount || 0;
        return {
          success: true,
          message: `Pomyślnie zsynchronizowano bazę kawiarni [${storeId}] z chmurą Google Cloud. Wysłano ${count} rekordów w ${vaults} zaszyfrowanych sejfach.`,
          recordsCount: count,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        message: result?.error?.message || 'Błąd podczas wysyłania danych do chmury.',
        timestamp: new Date().toISOString(),
        error: result?.error?.message,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Błąd zapisu w Google Cloud: ${err.message}`,
        timestamp: new Date().toISOString(),
        error: err.message,
      };
    } finally {
      this.isOperating = false;
    }
  }

  /**
   * Pobiera sejfy kawiarni z chmury Firestore, odszyfrowuje w Electronie i nawadnia lokalną bazę (Pull)
   */
  public static async pullStoreFromCloud(storeId: string): Promise<SyncOperationResult> {
    if (this.isOperating) {
      return { success: false, message: 'Inna operacja synchronizacji jest już w toku.', timestamp: new Date().toISOString() };
    }

    this.isOperating = true;
    try {
      const api = typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null;
      if (!api?.pullStoreData) {
        return {
          success: false,
          message: 'Pobieranie z chmury wymaga uruchomienia w aplikacji desktopowej.',
          timestamp: new Date().toISOString(),
        };
      }

      const result = await api.pullStoreData(storeId);
      if (result && result.success) {
        if (result.unpackedData) {
          const { personnel, schedules, financials } = result.unpackedData;
          if (personnel?.managers) {
            StoreStorage.setItem('cached_manager_employees', personnel.managers, storeId);
          }
          if (personnel?.trainingPartners) {
            StoreStorage.setItem('cached_training_partners', personnel.trainingPartners, storeId);
          }
          if (schedules?.shifts) {
            StoreStorage.setItem('cached_schedule_shifts', schedules.shifts, storeId);
          }
          if (financials?.aopPlans) {
            StoreStorage.setItem('cached_aop_plans', financials.aopPlans, storeId);
          }
        }

        StoreStorage.setItem('sync_last_pull_ts', new Date().toISOString(), storeId);

        return {
          success: true,
          message: result.message || `Pomyślnie pobrano dane kawiarni [${storeId}] z Google Cloud.`,
          recordsCount: result.recordsCount || 0,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        message: result?.message || 'Błąd podczas pobierania danych z chmury.',
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Błąd pobierania danych z Google Cloud: ${err.message}`,
        timestamp: new Date().toISOString(),
        error: err.message,
      };
    } finally {
      this.isOperating = false;
    }
  }
}
