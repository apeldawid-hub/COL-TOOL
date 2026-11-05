// src/services/admin/fleetService.ts
/**
 * Starbucks Operations Suite — Enterprise Fleet Management Service
 * Aggregates 100+ stores catalog, licensing status, cloud telemetry,
 * cryptographic key provisioning, emergency kill-switch controls, and security audit log.
 */

import { StarbucksStore, normalizeDiacritics } from '../../constants/starbucksStores';
import { StoreService } from '../storeService';
import { LicensingService } from '../security/licensingService';
import { StoreKeyCache } from '../security/storeKeyCache';
import { firebaseTelemetryService } from '../firebaseTelemetryService';
import { APP_VERSION } from '../../version';
import type {
  FleetStoreRecord,
  FleetStoreHealth,
  FleetSummaryStats,
  FleetAuditRecord,
  ProvisionLicensePayload,
  KillSwitchPayload,
  FleetFilterState,
} from '../../types/fleet';

const STORAGE_KEY_FLEET_LICENSES = 'sbx_fleet_licenses_registry_v1';
const STORAGE_KEY_FLEET_AUDIT = 'sbx_fleet_security_audit_v1';

export class FleetService {
  private static instance: FleetService | null = null;
  private listeners: Array<() => void> = [];

  private licensesMap: Map<string, any> = new Map();
  private auditLogs: FleetAuditRecord[] = [];

  private constructor() {
    this.loadState();
  }

  public static getInstance(): FleetService {
    if (!this.instance) {
      this.instance = new FleetService();
    }
    return this.instance;
  }

  private loadState(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const storedLic = localStorage.getItem(STORAGE_KEY_FLEET_LICENSES);
        if (storedLic) {
          const arr = JSON.parse(storedLic);
          arr.forEach((item: any) => this.licensesMap.set(item.storeId, item));
        }

        // Domyślny klucz testowy floty powiązany z test@amrest.eu (108120 SBX Warszawa Janki)
        if (!this.licensesMap.has('108120')) {
          this.licensesMap.set('108120', {
            storeId: '108120',
            tier: 'STORE_CLIENT',
            licenseKey: 'SBX-108120-011E77C6C797E064-5FC6793A15',
            provisionedAt: '2026-01-01T08:00:00.000Z',
            validityDays: 0,
            authorizedManagerName: 'Tester AmRest (Fleet QA)',
            authorizedManagerEmail: 'test@amrest.eu',
            requireHardwareLock: true,
            notes: 'Oficjalny klucz testowy floty dla test@amrest.eu (Kawiarnia 108120 SBX Warszawa Janki)',
            isRevoked: false,
          });
        }

        // Klucz nadrzędny Fleet Master HQ
        if (!this.licensesMap.has('FLEET_MASTER')) {
          this.licensesMap.set('FLEET_MASTER', {
            storeId: 'FLEET_MASTER',
            tier: 'FLEET_MASTER',
            licenseKey: 'SBX-FLEET_MASTER-FF763C5C190691E1-F976B4D7D4',
            provisionedAt: '2026-01-01T08:00:00.000Z',
            validityDays: 0,
            authorizedManagerName: 'Tester AmRest (Fleet Master HQ)',
            authorizedManagerEmail: 'test@amrest.eu',
            requireHardwareLock: false,
            notes: 'Nadrzędny klucz testowy Fleet Master HQ dla test@amrest.eu',
            isRevoked: false,
          });
        }
        const storedAudit = localStorage.getItem(STORAGE_KEY_FLEET_AUDIT);
        if (storedAudit) {
          this.auditLogs = JSON.parse(storedAudit);
        }
      }
    } catch (e) {
      console.warn('[FleetService] Błąd wczytywania stanu floty:', e);
    }
  }

  private saveState(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          STORAGE_KEY_FLEET_LICENSES,
          JSON.stringify(Array.from(this.licensesMap.values()))
        );
        localStorage.setItem(STORAGE_KEY_FLEET_AUDIT, JSON.stringify(this.auditLogs));
      }
    } catch (e) {
      console.warn('[FleetService] Błąd zapisu stanu floty:', e);
    }
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('[FleetService] Błąd powiadomienia subskrybenta:', err);
      }
    });
  }

  /**
   * Zwraca zagregowane rekordy wszystkich 100+ lokali
   */
  public getFleetStores(): FleetStoreRecord[] {
    const rawStores = StoreService.getAllStores();
    let telemetryRecords: any[] = [];
    try {
      telemetryRecords = firebaseTelemetryService.getCachedInstallations() || [];
    } catch {
      telemetryRecords = [];
    }
    const now = Date.now();

    return rawStores.map((store) => {
      const lic = this.licensesMap.get(store.id);
      const tele = telemetryRecords.find(
        (t) => t.unitCode === store.unitCode || (t.storeName && store.shortName && t.storeName.includes(store.shortName))
      );

      const isRevoked = lic?.isRevoked === true;
      const isUnprovisioned = !lic;

      let lastHeartbeatMs = 0;
      if (tele?.lastSeenAt) {
        lastHeartbeatMs = new Date(tele.lastSeenAt).getTime();
      } else if (lic?.activatedAt || lic?.provisionedAt) {
        lastHeartbeatMs = new Date(lic.activatedAt || lic.provisionedAt).getTime();
      }

      const diffMinutes = lastHeartbeatMs > 0 ? (now - lastHeartbeatMs) / (1000 * 60) : 99999;
      const isOnline = lastHeartbeatMs > 0 && diffMinutes < 120;
      const appVer = tele?.appVersion || (lic ? APP_VERSION : undefined);
      const isOutdated = appVer ? appVer !== APP_VERSION : false;

      // Wyliczanie stanu zdrowia
      let health: FleetStoreHealth = 'healthy';
      let healthReason: string | undefined;

      if (isRevoked) {
        health = 'revoked';
        healthReason = lic?.revokeReason || 'Zdalny Kill-Switch aktywowany';
      } else if (isUnprovisioned) {
        health = 'unprovisioned';
        healthReason = 'Brak aktywnego klucza licencyjnego';
      } else if (!isOnline) {
        health = 'offline';
        healthReason = lastHeartbeatMs > 0 ? `Brak łączności od ${Math.round(diffMinutes / 60)}h` : 'Brak danych telemetrycznych';
      } else if (isOutdated) {
        health = 'warning';
        healthReason = `Wersja ${appVer} (wymagana: ${APP_VERSION})`;
      }

      return {
        id: store.id,
        unitCode: store.unitCode,
        mpk: store.mpk,
        name: store.name,
        shortName: store.shortName,
        city: store.city,
        district: store.district,
        address: store.address,
        type: store.type,
        isCustom: store.isCustom,

        licenseKey: lic?.licenseKey,
        licenseTier: lic?.tier || 'STORE_CLIENT',
        licenseStatus: isRevoked
          ? 'REVOKED'
          : isUnprovisioned
          ? 'UNPROVISIONED'
          : 'ACTIVE',
        hardwareFingerprint: lic?.hardwareFingerprint || tele?.installId,
        activatedAt: lic?.activatedAt || lic?.provisionedAt,
        expiresAt: lic?.expiresAt,
        isKillSwitchRevoked: isRevoked,
        revokedAt: lic?.revokedAt,
        revokeReason: lic?.revokeReason,
        revokedBy: lic?.revokedBy,

        health,
        healthReason,
        syncState: isOnline ? 'synced' : 'offline',
        parityState: lic ? 'verified' : 'unverified',
        pendingChangesCount: 0,
        lastHeartbeatAt: tele?.lastSeenAt || lic?.activatedAt || lic?.provisionedAt,
        lastSyncAt: tele?.lastSeenAt || lic?.activatedAt,
        appVersion: appVer,
        isVersionOutdated: isOutdated,
        platform: tele?.platform || 'macOS Desktop (Zaplecze)',
        databaseSizeBytes: 2457600, // ~2.4MB domyślna baza SQLite

        activeStaffCount: 14,
        openAlertsCount: health === 'warning' ? 1 : 0,
        weeklyFloorHoursBase: 224.0,
      };
    });
  }

  /**
   * Zwraca podsumowanie KPI floty
   */
  public getSummaryStats(): FleetSummaryStats {
    const stores = this.getFleetStores();
    return {
      totalStores: stores.length,
      activeLicensedStores: stores.filter((s) => s.licenseStatus === 'ACTIVE').length,
      onlineNowStores: stores.filter((s) => s.health === 'healthy' || (s.health === 'warning' && !s.healthReason?.includes('Brak łączności'))).length,
      warningStores: stores.filter((s) => s.health === 'warning').length,
      offlineStores: stores.filter((s) => s.health === 'offline').length,
      revokedStores: stores.filter((s) => s.health === 'revoked').length,
      unprovisionedStores: stores.filter((s) => s.health === 'unprovisioned').length,
      outdatedBuildsCount: stores.filter((s) => s.isVersionOutdated).length,
      parityVerifiedCount: stores.filter((s) => s.parityState === 'verified').length,
    };
  }

  /**
   * Generuje i rejestruje nowy klucz licencyjny
   */
  public provisionLicense(payload: ProvisionLicensePayload): { success: boolean; key: string; error?: string } {
    try {
      const licensingService = LicensingService.getInstance();
      const key = licensingService.generateActivationKey(payload.storeId, payload.tier);

      const targetStore = StoreService.findStoreByIdOrCode(payload.storeId);
      const storeName = targetStore?.name || payload.storeId;

      const record = {
        storeId: payload.storeId,
        tier: payload.tier,
        licenseKey: key,
        provisionedAt: new Date().toISOString(),
        validityDays: payload.validityDays,
        expiresAt: payload.validityDays > 0
          ? new Date(Date.now() + payload.validityDays * 86400000).toISOString()
          : undefined,
        authorizedManagerName: payload.authorizedManagerName,
        authorizedManagerEmail: payload.authorizedManagerEmail,
        requireHardwareLock: payload.requireHardwareLock,
        notes: payload.notes,
        isRevoked: false,
      };

      this.licensesMap.set(payload.storeId, record);

      this.addAuditLog({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        action: 'KEY_GENERATED',
        severity: 'INFO',
        targetStoreId: payload.storeId,
        targetStoreName: storeName,
        actorName: 'District Manager / HQ Master',
        actorEmail: 'admin.hq@starbucks.com',
        actorRole: 'FLEET_MASTER',
        details: `Wygenerowano klucz ${key} (${payload.tier}) dla ${payload.authorizedManagerName} (${payload.authorizedManagerEmail}). Ważność: ${payload.validityDays > 0 ? payload.validityDays + ' dni' : 'Bezterminowo'}.`,
      });

      this.saveState();
      return { success: true, key };
    } catch (err: any) {
      return { success: false, key: '', error: err?.message || 'Błąd generowania klucza' };
    }
  }

  /**
   * Zastosowanie awaryjnego Kill-Switcha
   */
  public applyKillSwitch(payload: KillSwitchPayload): { success: boolean; error?: string } {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Nieprawidłowy payload operacji Kill-Switch.' };
    }

    const targetId = String(payload.storeId || (payload as any).targetStoreId || '').trim();
    if (!targetId) {
      return { success: false, error: 'Nie podano identyfikatora lokalu dla operacji Kill-Switch.' };
    }

    const challenge = String(payload.confirmationChallenge || '').trim().toUpperCase();
    const expectedChallenge = `REVOKE ${targetId.toUpperCase()}`;

    if (challenge !== expectedChallenge) {
      return { success: false, error: `Wymagane wpisanie dokładnej frazy: "${expectedChallenge}"` };
    }

    const lic = this.licensesMap.get(targetId) || { storeId: targetId };
    lic.storeId = targetId;
    lic.isRevoked = true;
    lic.revokedAt = new Date().toISOString();
    const baseReason = String(payload.reason || 'Zdalny Kill-Switch aktywowany').trim();
    const customDetails = payload.customDetails ? ` — ${String(payload.customDetails).trim()}` : '';
    lic.revokeReason = baseReason + customDetails;
    const actorName = String(payload.actorName || (payload as any).operator || 'District Manager / HQ Master').trim();
    const actorEmail = String(payload.actorEmail || 'admin.hq@starbucks.com').trim();
    lic.revokedBy = `${actorName} (${actorEmail})`;

    this.licensesMap.set(targetId, lic);

    // In-memory zeroization of encryption keys in StoreKeyCache
    StoreKeyCache.invalidateStore(targetId);

    const targetStore = StoreService.findStoreByIdOrCode(targetId);
    const storeName = targetStore?.name || targetId;

    this.addAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action: 'KILL_SWITCH_REVOKE',
      severity: 'CRITICAL',
      targetStoreId: targetId,
      targetStoreName: storeName,
      actorName,
      actorEmail,
      actorRole: 'FLEET_MASTER',
      details: `ZASTOSOWANO KILL-SWITCH. Powód: ${lic.revokeReason}. Stacja zablokowana permanentnie.`,
    });

    // Jeśli anulowany lokal jest aktualnie aktywny, natychmiast wywołaj lokalną unieważniającą funkcję
    const current = StoreService.getCurrentStore();
    if (current && (current.id === targetId || current.unitCode === targetId)) {
      LicensingService.getInstance().revokeLicense(lic.revokeReason).catch((err) => {
        console.warn('[FleetService] Błąd lokalnego revokeLicense:', err);
      });
    }

    // Broadcast sbx:license-revoked event to trigger instant UI logout & lockdown
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('sbx:license-revoked', {
            detail: { storeId: targetId, reason: lic.revokeReason },
          })
        );
      } catch (_) {}
    }

    this.saveState();
    return { success: true };
  }

  /**
   * Przywrócenie stacji po zawieszeniu
   */
  public restoreStation(storeId: string, actorName: string, actorEmail: string): { success: boolean } {
    const lic = this.licensesMap.get(storeId);
    if (lic) {
      lic.isRevoked = false;
      delete lic.revokedAt;
      delete lic.revokeReason;
      delete lic.revokedBy;
      this.licensesMap.set(storeId, lic);
    }

    const targetStore = StoreService.findStoreByIdOrCode(storeId);
    this.addAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action: 'STATION_RESTORED',
      severity: 'WARNING',
      targetStoreId: storeId,
      targetStoreName: targetStore?.name || storeId,
      actorName,
      actorEmail,
      actorRole: 'FLEET_MASTER',
      details: 'Przywrócono autoryzację stacji i odblokowano dostęp.',
    });

    this.saveState();
    return { success: true };
  }

  public addAuditLog(entry: FleetAuditRecord): void {
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
  }

  public getAuditLogs(): FleetAuditRecord[] {
    return [...this.auditLogs];
  }

  public exportAuditLogsCsv(): string {
    const headers = ['ID', 'Data i Czas', 'Zdarzenie', 'Waga', 'ID Lokalu', 'Nazwa Lokalu', 'Aktor', 'Email', 'Rola', 'Szczegóły'];
    const rows = this.auditLogs.map((log) => [
      log.id,
      log.timestamp,
      log.action,
      log.severity,
      log.targetStoreId,
      `"${(log.targetStoreName || '').replace(/"/g, '""')}"`,
      `"${(log.actorName || '').replace(/"/g, '""')}"`,
      log.actorEmail || '',
      log.actorRole || '',
      `"${(log.details || '').replace(/"/g, '""')}"`,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  public exportStoreCatalogCsv(): string {
    const headers = ['ID', 'Unit Code', 'MPK', 'Nazwa', 'Miasto', 'Dystrykt', 'Typ', 'Status Licencji', 'Zdrowie', 'Klucz Licencji'];
    const stores = this.getFleetStores();
    const rows = stores.map((s) => [
      s.id,
      s.unitCode,
      s.mpk,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.city || '').replace(/"/g, '""')}"`,
      `"${(s.district || '').replace(/"/g, '""')}"`,
      s.type,
      s.licenseStatus,
      s.health,
      s.licenseKey || '',
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  public exportStoreCatalogJson(): string {
    const stores = this.getFleetStores();
    return JSON.stringify(stores, null, 2);
  }

  public static getRequiredChallengeCode(storeId: string): string {
    const id = String(storeId || '').trim();
    return id ? `REVOKE ${id.toUpperCase()}` : '';
  }

  public getRequiredChallengeCode(storeId: string): string {
    return FleetService.getRequiredChallengeCode(storeId);
  }

  public getStoreRecord(storeId: string): FleetStoreRecord | undefined {
    return this.getFleetStores().find(
      (s) => s.id === storeId || s.unitCode === storeId || s.mpk === storeId
    );
  }

  public static getStoreRecord(storeId: string): FleetStoreRecord | undefined {
    return this.getInstance().getStoreRecord(storeId);
  }

  public static getAllStoresFleet(): FleetStoreRecord[] {
    return this.getInstance().getFleetStores();
  }

  public static getFleetSummary(): any {
    const s = this.getInstance().getSummaryStats();
    return {
      ...s,
      activeStores: s.activeLicensedStores,
      pendingLicenses: s.unprovisionedStores,
    };
  }

  public static getAuditLog(): FleetAuditRecord[] {
    return this.getInstance().getAuditLogs();
  }

  public static exportAuditLogCsv(): string {
    return this.getInstance().exportAuditLogsCsv();
  }

  public filterStores(filter: {
    query?: string;
    healthFilter?: string;
    districtFilter?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  }): FleetStoreRecord[] {
    let list = this.getFleetStores();

    if (filter.query && filter.query.trim()) {
      const q = normalizeDiacritics(filter.query.trim().toLowerCase());
      list = list.filter((s) => {
        const name = normalizeDiacritics((s.name || '').toLowerCase());
        const city = normalizeDiacritics((s.city || '').toLowerCase());
        const unit = (s.unitCode || '').toLowerCase();
        const id = (s.id || '').toLowerCase();
        return name.includes(q) || city.includes(q) || unit.includes(q) || id.includes(q);
      });
    }

    if (filter.healthFilter && filter.healthFilter !== 'ALL') {
      list = list.filter((s) => s.health.toUpperCase() === filter.healthFilter!.toUpperCase());
    }

    if (filter.districtFilter && filter.districtFilter !== 'ALL') {
      list = list.filter((s) => s.district === filter.districtFilter);
    }

    if (filter.sortBy === 'name') {
      list.sort((a, b) =>
        filter.sortDirection === 'desc'
          ? b.name.localeCompare(a.name)
          : a.name.localeCompare(b.name)
      );
    } else if (filter.sortBy === 'unitCode') {
      list.sort((a, b) =>
        filter.sortDirection === 'desc'
          ? b.unitCode.localeCompare(a.unitCode)
          : a.unitCode.localeCompare(b.unitCode)
      );
    }

    return list;
  }

  public static filterStores(filter: any): FleetStoreRecord[] {
    return this.getInstance().filterStores(filter);
  }

  public static async provisionLicense(payload: any): Promise<any> {
    const targetStoreId = payload.storeId || payload.targetStoreId;
    const result = this.getInstance().provisionLicense({
      storeId: targetStoreId,
      tier: payload.tier || 'STORE_CLIENT',
      authorizedManagerName: payload.issuedBy || payload.authorizedManagerName || 'HQ Admin',
      authorizedManagerEmail: payload.authorizedManagerEmail || 'admin.hq@starbucks.com',
      validityDays: payload.validityDays || 0,
      requireHardwareLock: payload.requireHardwareLock !== false,
      notes: payload.notes,
    });
    return {
      success: result.success,
      licenseKey: result.key,
      storeId: targetStoreId,
      error: result.error,
    };
  }

  public async executeKillSwitch(
    store: StarbucksStore | { id: string },
    payload: any
  ): Promise<any> {
    const storeId = store.id || payload.targetStoreId || payload.storeId;
    const expected = FleetService.getRequiredChallengeCode(storeId);
    const challenge = (payload.confirmationChallenge || '').trim().toUpperCase();

    if (challenge !== expected) {
      throw new Error(`KillSwitchVerificationError: Niepoprawny kod potwierdzenia autoryzacji. Wymagane wpisanie: "${expected}"`);
    }

    // In-memory RAM key zeroization
    StoreKeyCache.invalidateStore(storeId);

    const lic = this.licensesMap.get(storeId) || { storeId };
    lic.isRevoked = true;
    lic.revokedAt = new Date().toISOString();
    lic.revokeReason = payload.reason || 'Zdalny Kill-Switch aktywowany';
    lic.revokedBy = payload.operator || payload.actorName || 'HQ Security';
    this.licensesMap.set(storeId, lic);

    const auditEntry: FleetAuditRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: lic.revokedAt,
      action: 'KILL_SWITCH_REVOKE',
      severity: 'CRITICAL',
      targetStoreId: storeId,
      targetStoreName: (store as any).name || storeId,
      actorName: payload.operator || payload.actorName || 'HQ Admin',
      actorEmail: payload.actorEmail || 'admin.hq@starbucks.com',
      actorRole: 'FLEET_MASTER',
      details: `ZASTOSOWANO KILL-SWITCH. Powód: ${lic.revokeReason}. Wyczyszczono klucze RAM i zablokowano stację.`,
    };

    this.addAuditLog(auditEntry);
    this.saveState();

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('sbx:license-revoked', {
            detail: { storeId, reason: lic.revokeReason },
          })
        );
      } catch (_) {}
    }

    return {
      id: auditEntry.id,
      action: 'KILL_SWITCH_REVOKE',
      targetStoreId: storeId,
      operator: auditEntry.actorName,
      success: true,
      timestamp: auditEntry.timestamp,
    };
  }

  public static async executeKillSwitch(
    store: StarbucksStore | { id: string },
    payload: any
  ): Promise<any> {
    return this.getInstance().executeKillSwitch(store, payload);
  }
}

export const fleetService = FleetService.getInstance();
