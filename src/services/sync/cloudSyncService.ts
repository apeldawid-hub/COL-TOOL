// src/services/sync/cloudSyncService.ts
/**
 * Starbucks Operations Suite — Real-time Google Cloud Firestore Synchronization Service
 * Project: starbucks-ops-suite
 *
 * Implements bidirectional synchronization:
 * - Push: Packages SQLite tables & StoreStorage, encrypts sensitive data (AES-256-GCM) and pushes to Firestore.
 * - Pull: Fetches encrypted vaults from Firestore, unpacks & decrypts payloads, and hydrates local SQLite & StoreStorage.
 * - Health Check: Measures latency and verifies connectivity to Google Cloud Firestore.
 */

import { CloudMigrationService } from '../security/cloudMigrationService';
import { VaultService, EncryptedVaultDocument } from '../security/vaultService';
import { StoreStorage } from '../storeStorage';
import { AuthService } from '../auth/authService';

export const FIRESTORE_PROJECT_ID = 'starbucks-ops-suite';
export const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

/**
 * Rekurencyjnie konwertuje dokument Firestore REST API (v1) na czysty obiekt JavaScript
 */
export const parseFirestoreValue = (field: any): any => {
  if (field === null || field === undefined || typeof field !== 'object') {
    return field;
  }
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

export const parseFirestoreDocument = (doc: any): Record<string, any> => {
  if (!doc || !doc.fields) return {};
  const result: Record<string, any> = {};
  for (const [key, field] of Object.entries(doc.fields)) {
    result[key] = parseFirestoreValue(field);
  }
  return result;
};

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
   * Sprawdza status połączenia z chmurą Google Cloud Firestore
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
   */
  public static async pushStoreToCloud(storeId: string, operatorName?: string): Promise<SyncOperationResult> {
    if (this.isOperating) {
      return { success: false, message: 'Inna operacja synchronizacji jest już w toku.', timestamp: new Date().toISOString() };
    }

    this.isOperating = true;
    try {
      const session = AuthService.getCurrentSession();
      const operatorUid = operatorName || session?.email || 'dawid.apel@amrest.eu';

      const result = await CloudMigrationService.executeMigration({
        storeId,
        projectId: FIRESTORE_PROJECT_ID,
        operatorUid,
        batchSize: 50,
        maxRetries: 3,
      });

      if (result.success) {
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
        message: result.error?.message || 'Błąd podczas wysyłania danych do chmury.',
        timestamp: new Date().toISOString(),
        error: result.error?.message,
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
   * Pobiera sejfy kawiarni z chmury Firestore, odszyfrowuje i nawadnia lokalną bazę (Pull)
   */
  public static async pullStoreFromCloud(storeId: string): Promise<SyncOperationResult> {
    if (this.isOperating) {
      return { success: false, message: 'Inna operacja synchronizacji jest już w toku.', timestamp: new Date().toISOString() };
    }

    this.isOperating = true;
    try {
      const collections = [
        'vault_schedules',
        'vault_personnel',
        'vault_financials',
        'vault_health_gdpr',
      ];

      let totalImported = 0;
      const vaultDocuments: Record<string, any[]> = {};

      for (const col of collections) {
        const url = `${FIRESTORE_BASE_URL}/stores/${storeId}/${col}`;
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.documents && Array.isArray(data.documents)) {
              vaultDocuments[col] = data.documents.map((d: any) => parseFirestoreDocument(d));
            }
          }
        } catch (fetchErr) {
          console.warn(`[CloudSyncService] Błąd pobierania kolekcji ${col}:`, fetchErr);
        }
      }

      // 1. Odszyfrowanie i hydratacja Personelu
      if (vaultDocuments['vault_personnel']?.length) {
        for (const doc of vaultDocuments['vault_personnel']) {
          try {
            const unpacked = await VaultService.unpackagePersonnelVault(
              doc as EncryptedVaultDocument,
              storeId,
              storeId
            );
            if (unpacked?.payload) {
              const payload = unpacked.payload;
              if (Array.isArray(payload.managers)) {
                totalImported += payload.managers.length;
                StoreStorage.setItem('cached_manager_employees', payload.managers, storeId);
              }
              if (Array.isArray(payload.monthlyRosters)) {
                totalImported += payload.monthlyRosters.length;
                StoreStorage.setItem('cached_manager_monthly_roster', payload.monthlyRosters, storeId);
              }
              if (Array.isArray(payload.trainingPartners)) {
                totalImported += payload.trainingPartners.length;
                StoreStorage.setItem('cached_training_partners', payload.trainingPartners, storeId);
              }
            }
          } catch (unpackErr) {
            console.warn('[CloudSyncService] Nie udało się odszyfrować sejfu personelu:', unpackErr);
          }
        }
      }

      // 2. Odszyfrowanie i hydratacja Grafiku
      if (vaultDocuments['vault_schedules']?.length) {
        for (const doc of vaultDocuments['vault_schedules']) {
          try {
            const unpacked = await VaultService.unpackageScheduleVault(
              doc as EncryptedVaultDocument,
              storeId,
              storeId
            );
            if (unpacked?.payload) {
              const payload = unpacked.payload;
              if (Array.isArray(payload.shifts)) {
                totalImported += payload.shifts.length;
                StoreStorage.setItem('cached_schedule_shifts', payload.shifts, storeId);
              }
              if (Array.isArray(payload.versions)) {
                totalImported += payload.versions.length;
                StoreStorage.setItem('cached_schedule_versions', payload.versions, storeId);
              }
              if (Array.isArray(payload.trainingShifts)) {
                totalImported += payload.trainingShifts.length;
                StoreStorage.setItem('cached_training_shifts', payload.trainingShifts, storeId);
              }
            }
          } catch (unpackErr) {
            console.warn('[CloudSyncService] Nie udało się odszyfrować sejfu grafików:', unpackErr);
          }
        }
      }

      // 3. Odszyfrowanie i hydratacja Finansów AOP / P&L
      if (vaultDocuments['vault_financials']?.length) {
        for (const doc of vaultDocuments['vault_financials']) {
          try {
            const unpacked = await VaultService.unpackageFinancialVault(
              doc as EncryptedVaultDocument,
              storeId,
              storeId
            );
            if (unpacked?.payload) {
              const payload = unpacked.payload;
              if (Array.isArray(payload.aopPlans)) {
                totalImported += payload.aopPlans.length;
                StoreStorage.setItem('cached_aop_plans', payload.aopPlans, storeId);
              }
              if (Array.isArray(payload.dailyKpiLogs)) {
                totalImported += payload.dailyKpiLogs.length;
                StoreStorage.setItem('cached_daily_kpi_logs', payload.dailyKpiLogs, storeId);
              }
            }
          } catch (unpackErr) {
            console.warn('[CloudSyncService] Nie udało się odszyfrować sejfu finansowego:', unpackErr);
          }
        }
      }

      StoreStorage.setItem('sync_last_pull_ts', new Date().toISOString(), storeId);

      // Spróbuj zaktualizować SQLite w Electronie jeśli dostępny
      try {
        if (typeof window !== 'undefined' && (window as any).api?.hydrateFromCloud) {
          await (window as any).api.hydrateFromCloud(storeId, vaultDocuments);
        }
      } catch {}

      return {
        success: true,
        message: totalImported > 0
          ? `Pomyślnie pobrano i odszyfrowano ${totalImported} rekordów z Google Cloud Firestore dla kawiarni [${storeId}].`
          : `Połączono z Google Cloud Firestore (starbucks-ops-suite). Brak nowych danych w chmurze dla kawiarni [${storeId}].`,
        recordsCount: totalImported,
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
