// firebase/functions/src/index.ts
/**
 * Starbucks Operations Suite — Codzienna Automatyzacja Audytu Chmury (Cloud Integrity Sentinel)
 * 
 * Harmonogram: Codziennie o 03:00 UTC (Cloud Scheduler / Scheduled Function)
 * Cel:
 * 1. Weryfikacja hermetyczności struktury `stores/{storeId}/...` (Multi-Tenant Silo).
 * 2. Detekcja wycieków i nieautoryzowanych kolekcji płaskich.
 * 3. Sprawdzenie integralności sejfów kryptograficznych (AES-256-GCM envelope).
 * 4. Kontrola profili użytkowników w `users/{userId}/settings/preferences`.
 * 5. Rejestracja raportu z audytu w `/fleet/audit_reports/{date}`.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

const REQUIRED_VAULTS = [
  'vault_financials',
  'vault_personnel',
  'vault_schedules',
  'vault_health_gdpr',
];

export const verifyCloudHermeticityDaily = functions.pubsub
  .schedule('0 3 * * *') // Codziennie o 3:00 w nocy
  .timeZone('Europe/Warsaw')
  .onRun(async (context) => {
    const timestamp = new Date().toISOString();
    const anomalies: string[] = [];
    let checkedStoresCount = 0;
    let checkedVaultsCount = 0;
    let checkedUsersCount = 0;

    try {
      // 1. Sprawdzenie kolekcji głównej stores/
      const storesSnapshot = await db.collection('stores').get();
      checkedStoresCount = storesSnapshot.size;

      for (const storeDoc of storesSnapshot.docs) {
        const storeId = storeDoc.id;

        // A. Sprawdzenie dokumentu meta/profile
        const metaDoc = await db.doc(`stores/${storeId}/meta/profile`).get();
        if (!metaDoc.exists) {
          anomalies.push(`Kawiarnia [${storeId}] nie posiada dokumentu meta/profile.`);
        }

        // B. Sprawdzenie sejfów pod kątem poprawności szyfrowania
        for (const vaultName of REQUIRED_VAULTS) {
          const vaultDocs = await db.collection(`stores/${storeId}/${vaultName}`).limit(10).get();
          for (const doc of vaultDocs.docs) {
            checkedVaultsCount++;
            const data = doc.data();
            // Weryfikacja envelope AES-256-GCM
            if (!data.ciphertext || !data.iv || !data.tag) {
              anomalies.push(`Wyciek/Naruszenie: Dokument [${doc.id}] w stores/${storeId}/${vaultName} nie jest poprawnie zaszyfrowany (brak ciphertext/iv/tag)!`);
            }
            if (data.storeId && data.storeId !== storeId) {
              anomalies.push(`Krytyczne naruszenie Multi-Tenant: Dokument [${doc.id}] w stores/${storeId} ma pole storeId='${data.storeId}'!`);
            }
          }
        }
      }

      // 2. Sprawdzenie kolekcji users/ (Cross-Device Settings)
      const usersSnapshot = await db.collection('users').get();
      checkedUsersCount = usersSnapshot.size;

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const prefsDoc = await db.doc(`users/${userId}/settings/preferences`).get();
        if (prefsDoc.exists) {
          const prefs = prefsDoc.data();
          if (prefs?.theme && !['dark', 'light', 'system'].includes(prefs.theme)) {
            anomalies.push(`Nieprawidłowa wartość motywu w profilu użytkownika [${userId}]: ${prefs.theme}`);
          }
        }
      }

      // 3. Sprawdzenie nieautoryzowanych kolekcji płaskich w roocie
      const rootCollections = await db.listCollections();
      const allowedRoots = new Set(['stores', 'users', 'fleet', 'cloud_operational_docs', 'app_installations', 'cloud_access_requests']);
      for (const col of rootCollections) {
        if (!allowedRoots.has(col.id)) {
          anomalies.push(`Wykryto niedozwoloną kolekcję płaską w roocie: /${col.id} (zagrożenie dla modelu Multi-Tenant)!`);
        }
      }

      // 4. Zapis raportu z audytu w `/fleet/audit_reports/{date}`
      const reportDate = timestamp.split('T')[0];
      const isHermetic = anomalies.length === 0;

      await db.doc(`fleet/audit_reports/daily_${reportDate}`).set({
        runAt: timestamp,
        isHermetic,
        checkedStoresCount,
        checkedVaultsCount,
        checkedUsersCount,
        anomaliesCount: anomalies.length,
        anomalies,
        status: isHermetic ? 'PASSED_SECURE' : 'ACTION_REQUIRED',
      });

      console.log(`[CloudIntegrityAudit] Zakończono: ${isHermetic ? 'BEZBŁĘDNY' : 'WYKRYTO ANOMALIE (' + anomalies.length + ')'}`);
      return null;
    } catch (err: any) {
      console.error('[CloudIntegrityAudit] Błąd wykonania audytu:', err);
      await db.doc(`fleet/audit_reports/error_${Date.now()}`).set({
        runAt: timestamp,
        error: err.message,
        status: 'EXECUTION_FAILED',
      });
      return null;
    }
  });
