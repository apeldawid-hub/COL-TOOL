// src/services/firebaseTelemetryService.ts
import { APP_VERSION } from '../version';

export interface FirebaseInstallationRecord {
  id: string;
  installId: string;
  appVersion: string;
  installedAt: string;
  lastSeenAt: string;
  platform: string;
  storeName: string;
  unitCode: string;
  userName: string;
  userRole: string;
  userEmail: string;
  launchCount: number;
  status: 'active' | 'outdated' | 'inactive';
  notes?: string;
}

export interface FirebaseConfig {
  projectId: string;
  apiKey?: string;
  collectionName: string;
  isEnabled: boolean;
}

const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  projectId: 'starbucks-ops-suite',
  apiKey: '',
  collectionName: 'app_installations',
  isEnabled: true,
};

const STORAGE_KEY_CONFIG = 'sbx_firebase_config_v1';
const STORAGE_KEY_INSTALLS = 'sbx_firebase_local_installations_cache';
const STORAGE_KEY_INSTALL_ID = 'sbx_installation_id';
const STORAGE_KEY_LAUNCH_COUNT = 'sbx_app_launch_count';

class FirebaseTelemetryService {
  private config: FirebaseConfig = DEFAULT_FIREBASE_CONFIG;
  private localCache: FirebaseInstallationRecord[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadConfig();
    this.loadCache();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  public loadConfig(): FirebaseConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (stored) {
        this.config = { ...DEFAULT_FIREBASE_CONFIG, ...JSON.parse(stored) };
      } else {
        this.config = DEFAULT_FIREBASE_CONFIG;
      }
    } catch {
      this.config = DEFAULT_FIREBASE_CONFIG;
    }
    return this.config;
  }

  public saveConfig(cfg: Partial<FirebaseConfig>) {
    this.config = { ...this.config, ...cfg };
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    } catch {}
    this.notify();
  }

  public getConfig(): FirebaseConfig {
    return { ...this.config };
  }

  private loadCache(): FirebaseInstallationRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_INSTALLS);
      if (stored) {
        this.localCache = JSON.parse(stored);
      } else {
        this.localCache = this.getDefaultLocalData();
      }
    } catch {
      this.localCache = this.getDefaultLocalData();
    }
    return this.localCache;
  }

  private saveCache() {
    try {
      localStorage.setItem(STORAGE_KEY_INSTALLS, JSON.stringify(this.localCache));
    } catch {}
    this.notify();
  }

  private getDefaultLocalData(): FirebaseInstallationRecord[] {
    return [];
  }

  public getOrCreateInstallId(): string {
    let installId = localStorage.getItem(STORAGE_KEY_INSTALL_ID);
    if (!installId) {
      installId = `SBX-MAC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      localStorage.setItem(STORAGE_KEY_INSTALL_ID, installId);
    }
    return installId;
  }

  public getLaunchCount(): number {
    try {
      return parseInt(localStorage.getItem(STORAGE_KEY_LAUNCH_COUNT) || '1', 10);
    } catch {
      return 1;
    }
  }

  public incrementLaunchCount(): number {
    const count = this.getLaunchCount() + 1;
    try {
      localStorage.setItem(STORAGE_KEY_LAUNCH_COUNT, String(count));
    } catch {}
    return count;
  }

  /**
   * Zapisuje lub aktualizuje bieżące urządzenie (Heartbeat & Telemetria)
   */
  public async recordOrUpdateHeartbeat(): Promise<{ success: boolean; record: FirebaseInstallationRecord }> {
    const installId = this.getOrCreateInstallId();
    const launchCount = this.incrementLaunchCount();
    const now = new Date().toISOString();

    const storeName = localStorage.getItem('sbx_store_name') || '';
    const unitCode = localStorage.getItem('sbx_unit_code') || '';
    const userName = localStorage.getItem('sbx_user_name') || 'Użytkownik';
    const userRole = localStorage.getItem('sbx_user_role') || 'Partner';
    const userEmail = localStorage.getItem('sbx_user_email') || '';
    const platform = typeof navigator !== 'undefined'
      ? `${navigator.platform || 'macOS'} (${navigator.userAgent.includes('Macintosh') ? 'Apple Mac' : 'Desktop'})`
      : 'macOS Apple Mac';

    const existing = this.localCache.find((r) => r.installId === installId);
    const installedAt = existing ? existing.installedAt : now;

    const record: FirebaseInstallationRecord = {
      id: installId,
      installId,
      appVersion: APP_VERSION,
      installedAt,
      lastSeenAt: now,
      platform,
      storeName,
      unitCode,
      userName,
      userRole,
      userEmail,
      launchCount,
      status: 'active',
      notes: existing?.notes || 'Bieżące stanowisko operacyjne',
    };

    // Aktualizacja w lokalnej pamięci
    const idx = this.localCache.findIndex((r) => r.installId === installId);
    if (idx >= 0) {
      this.localCache[idx] = record;
    } else {
      this.localCache.unshift(record);
    }
    this.saveCache();

    // Jeśli skonfigurowano Firestore REST API, wykonaj wysyłkę w tle
    if (this.config.isEnabled && this.config.projectId && this.config.projectId !== 'starbucks-ops-suite') {
      try {
        await this.syncToFirestore(record);
      } catch (err) {
        console.warn('⚠️ [FirebaseTelemetry] Synchronizacja Firestore w tle nie powiodła się:', err);
      }
    }

    return { success: true, record };
  }

  /**
   * Wysyłka rekordu do Firestore przez REST API
   */
  private async syncToFirestore(record: FirebaseInstallationRecord): Promise<void> {
    const url = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/(default)/documents/${this.config.collectionName}/${record.installId}`;
    const payload = {
      fields: {
        installId: { stringValue: record.installId },
        appVersion: { stringValue: record.appVersion },
        installedAt: { stringValue: record.installedAt },
        lastSeenAt: { stringValue: record.lastSeenAt },
        platform: { stringValue: record.platform },
        storeName: { stringValue: record.storeName },
        unitCode: { stringValue: record.unitCode },
        userName: { stringValue: record.userName },
        userRole: { stringValue: record.userRole },
        userEmail: { stringValue: record.userEmail },
        launchCount: { integerValue: String(record.launchCount) },
        status: { stringValue: record.status },
        notes: { stringValue: record.notes || '' },
      },
    };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${res.status}`);
    }
  }

  /**
   * Pobranie wszystkich instalacji z bazy
   */
  public async fetchInstallations(): Promise<FirebaseInstallationRecord[]> {
    if (!this.config.isEnabled || !this.config.projectId || this.config.projectId === 'starbucks-ops-suite') {
      return [...this.localCache];
    }

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/(default)/documents/${this.config.collectionName}`;
      const res = await fetch(url);
      if (!res.ok) {
        return [...this.localCache];
      }

      const data = await res.json();
      if (data.documents && Array.isArray(data.documents)) {
        const remoteRecords: FirebaseInstallationRecord[] = data.documents.map((doc: any) => {
          const f = doc.fields || {};
          const id = doc.name.split('/').pop() || '';
          return {
            id,
            installId: f.installId?.stringValue || id,
            appVersion: f.appVersion?.stringValue || 'v1.0.0',
            installedAt: f.installedAt?.stringValue || new Date().toISOString(),
            lastSeenAt: f.lastSeenAt?.stringValue || new Date().toISOString(),
            platform: f.platform?.stringValue || 'macOS',
            storeName: f.storeName?.stringValue || 'SBX Store',
            unitCode: f.unitCode?.stringValue || '',
            userName: f.userName?.stringValue || 'Manager',
            userRole: f.userRole?.stringValue || 'SM',
            userEmail: f.userEmail?.stringValue || '',
            launchCount: parseInt(f.launchCount?.integerValue || '1', 10),
            status: f.status?.stringValue === 'outdated' ? 'outdated' : 'active',
            notes: f.notes?.stringValue || '',
          };
        });

        this.localCache = remoteRecords;
        this.saveCache();
        return remoteRecords;
      }
    } catch (err) {
      console.warn('⚠️ [FirebaseTelemetry] Błąd pobierania bazy z Firestore:', err);
    }

    return [...this.localCache];
  }

  public getCachedInstallations(): FirebaseInstallationRecord[] {
    return [...this.localCache];
  }

  public deleteInstallation(installId: string) {
    this.localCache = this.localCache.filter((r) => r.installId !== installId);
    this.saveCache();
  }

  public addManualDevice(record: FirebaseInstallationRecord) {
    this.localCache = [record, ...this.localCache.filter((r) => r.installId !== record.installId)];
    this.saveCache();
  }
}

export const firebaseTelemetryService = new FirebaseTelemetryService();
