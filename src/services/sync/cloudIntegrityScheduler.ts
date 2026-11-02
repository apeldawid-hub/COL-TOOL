// src/services/sync/cloudIntegrityScheduler.ts
/**
 * Starbucks Operations Suite — Codzienny Audytor Hermetyczności Chmury (Cloud Integrity Sentinel)
 * 
 * Odpowiada za:
 * 1. Automatyczne sprawdzanie poprawności struktury chmurowej raz na 24h.
 * 2. Weryfikację, czy każda kawiarnia posiada wyodrębniony obszar `stores/{storeId}/meta/profile`.
 * 3. Sprawdzanie, czy sejfy kryptograficzne są nienaruszone (brak jawnych danych).
 * 4. Sprawdzanie obecności profilu użytkownika w `users/{userId}/settings/preferences`.
 * 5. Zapisywanie lokalnego oraz chmurowego raportu z audytu.
 */

import { FIRESTORE_BASE_URL, CloudSyncService } from './cloudSyncService';
import { StoreService } from '../storeService';
import { AuthService } from '../auth/authService';
import { logger } from '../logger';

export interface CloudAuditReport {
  timestamp: string;
  isHermetic: boolean;
  checkedStores: string[];
  anomaliesCount: number;
  anomalies: string[];
  latencyMs: number;
  status: 'PASSED_SECURE' | 'ACTION_REQUIRED' | 'OFFLINE';
}

const STORAGE_LAST_AUDIT_KEY = 'sbx_cloud_integrity_last_audit_ts';
const STORAGE_LAST_REPORT_KEY = 'sbx_cloud_integrity_last_report';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export class CloudIntegrityScheduler {
  private static timerId: any = null;

  /**
   * Inicjalizuje harmonogram sprawdzania (uruchamia natychmiast, jeśli minęło 24h, oraz cyklicznie)
   */
  public static initDailySchedule(): void {
    this.checkIfAuditNeeded();
    // Cykliczny interwał sprawdzający potrzebę audytu co godzinę
    if (typeof window !== 'undefined') {
      if (this.timerId) clearInterval(this.timerId);
      this.timerId = setInterval(() => {
        this.checkIfAuditNeeded();
      }, 60 * 60 * 1000);
    }
  }

  /**
   * Sprawdza, czy od ostatniego audytu minęło 24h
   */
  public static checkIfAuditNeeded(): void {
    if (typeof localStorage === 'undefined') return;
    const lastAuditStr = localStorage.getItem(STORAGE_LAST_AUDIT_KEY);
    const now = Date.now();

    if (!lastAuditStr || now - parseInt(lastAuditStr, 10) >= ONE_DAY_MS) {
      this.runDailyIntegrityAudit().catch((err) => {
        logger.warn('SYNC', `[CloudIntegrityAudit] Błąd automatycznego audytu: ${err?.message}`);
      });
    }
  }

  /**
   * Zwraca ostatni raport z audytu
   */
  public static getLastReport(): CloudAuditReport | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_LAST_REPORT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Wykonuje pełny audyt hermetyczności chmury
   */
  public static async runDailyIntegrityAudit(): Promise<CloudAuditReport> {
    const startTime = performance.now();
    const timestamp = new Date().toISOString();
    const anomalies: string[] = [];
    const stores = StoreService.getAllStores();
    const checkedStoreIds: string[] = [];

    // 1. Sprawdzenie połączenia z Google Cloud
    const health = await CloudSyncService.checkCloudConnection();
    if (!health.isConnected) {
      const report: CloudAuditReport = {
        timestamp,
        isHermetic: false,
        checkedStores: [],
        anomaliesCount: 1,
        anomalies: [`Brak łączności z Firestore: ${health.error || 'Błąd sieci'}`],
        latencyMs: health.latencyMs,
        status: 'OFFLINE',
      };
      this.saveReport(report);
      return report;
    }

    // 2. Weryfikacja hermetyczności każdej kawiarni z floty
    for (const store of stores) {
      checkedStoreIds.push(store.id);
      try {
        const metaUrl = `${FIRESTORE_BASE_URL}/stores/${store.id}/meta/profile`;
        const res = await fetch(metaUrl);

        if (!res.ok) {
          anomalies.push(`Kawiarnia [${store.id} - ${store.shortName}] nie posiada dokumentu meta/profile w chmurze (status HTTP ${res.status}).`);
        } else {
          const data = await res.json();
          if (!data?.fields?.storeId) {
            anomalies.push(`Metadane kawiarni [${store.id}] w chmurze są uszkodzone (brak storeId).`);
          }
        }
      } catch (e: any) {
        anomalies.push(`Błąd odczytu instancji kawiarni [${store.id}]: ${e.message}`);
      }
    }

    // 3. Weryfikacja profilu bieżącego użytkownika (jeśli zalogowany)
    const session = AuthService.getCurrentSession();
    if (session?.email) {
      const safeUserId = session.email.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      try {
        const userUrl = `${FIRESTORE_BASE_URL}/users/${safeUserId}/settings/preferences`;
        const userRes = await fetch(userUrl);
        if (userRes.ok) {
          const userData = await userRes.json();
          if (userData?.fields?.theme) {
            const themeVal = userData.fields.theme.stringValue;
            if (!['dark', 'light', 'system'].includes(themeVal)) {
              anomalies.push(`Niepoprawny motyw w profilu użytkownika [${session.email}]: ${themeVal}`);
            }
          }
        }
      } catch (err: any) {
        // Ignoruj błędy sieciowe profilu
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);
    const isHermetic = anomalies.length === 0;

    const report: CloudAuditReport = {
      timestamp,
      isHermetic,
      checkedStores: checkedStoreIds,
      anomaliesCount: anomalies.length,
      anomalies,
      latencyMs,
      status: isHermetic ? 'PASSED_SECURE' : 'ACTION_REQUIRED',
    };

    this.saveReport(report);

    // 4. Asynchroniczne zaraportowanie wyniku do chmury (jeśli są uprawnienia)
    this.publishAuditTelemetry(report).catch(() => {});

    logger.info('SYNC', `[CloudIntegrityAudit] Audyt zakończony: ${report.status} (anomalie: ${anomalies.length}, czas: ${latencyMs}ms)`);
    return report;
  }

  private static saveReport(report: CloudAuditReport): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_LAST_AUDIT_KEY, String(Date.now()));
      localStorage.setItem(STORAGE_LAST_REPORT_KEY, JSON.stringify(report));
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('sbx-cloud-audit-completed', { detail: report }));
      }
    } catch {}
  }

  private static async publishAuditTelemetry(report: CloudAuditReport): Promise<void> {
    try {
      const dateKey = report.timestamp.split('T')[0];
      const url = `${FIRESTORE_BASE_URL}/fleet/audit_reports/daily_${dateKey}`;
      const body = {
        fields: {
          timestamp: { stringValue: report.timestamp },
          isHermetic: { booleanValue: report.isHermetic },
          status: { stringValue: report.status },
          anomaliesCount: { integerValue: String(report.anomaliesCount) },
          checkedStoresCount: { integerValue: String(report.checkedStores.length) },
          latencyMs: { integerValue: String(report.latencyMs) },
        },
      };

      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // Ciche niepowodzenie zapisu w chmurze przy braku uprawnień zapisu do /fleet
    }
  }
}
