// src/types/fleet.ts
/**
 * Starbucks Operations Suite — Enterprise Fleet Master Types
 * Defines data structures for multi-store fleet management, licensing provisioning,
 * emergency kill-switch controls, and security audit trails.
 */

import type { LicenseTier } from './licensing';

export type FleetStoreHealth = 'healthy' | 'warning' | 'offline' | 'revoked' | 'unprovisioned';
export type FleetSyncState = 'synced' | 'syncing' | 'pending' | 'error' | 'offline';
export type FleetParityState = 'verified' | 'mismatch' | 'unverified';

export type FleetAuditAction =
  | 'KEY_GENERATED'
  | 'STATION_ACTIVATED'
  | 'STATION_SUSPENDED'
  | 'STATION_RESTORED'
  | 'KILL_SWITCH_REVOKE'
  | 'HARDWARE_MISMATCH_DETECTED'
  | 'TAMPER_DETECTED'
  | 'LOGIN_2FA_SUCCESS'
  | 'LOGIN_FAILED'
  | 'PARITY_VERIFIED'
  | 'PARITY_MISMATCH'
  | 'REMOTE_MAINTENANCE'
  | 'OTA_UPDATE_PUSHED';

export interface FleetStoreRecord {
  // 1. Static Store Identity (from STARBUCKS_STORES_CATALOG)
  id: string;               // e.g. '108120'
  unitCode: string;         // e.g. '18120'
  mpk: string;              // e.g. '108120'
  name: string;             // e.g. '108120 SBX Warszawa Janki'
  shortName: string;        // e.g. '108120 Janki'
  city: string;             // e.g. 'Warszawa / Janki'
  district: string;         // e.g. 'Dystrykt Warszawa'
  address: string;          // e.g. 'pl. Szwedzki 20, 05-090 Janki...'
  type: 'Mall' | 'Street' | 'Drive-Thru' | 'Office' | 'Travel';
  isCustom?: boolean;

  // 2. Licensing & Hardware Binding
  licenseKey?: string;
  licenseTier?: LicenseTier;
  licenseStatus: 'ACTIVE' | 'REVOKED' | 'UNPROVISIONED' | 'EXPIRED' | 'SUSPENDED';
  hardwareFingerprint?: string;
  activatedAt?: string;
  expiresAt?: string;
  isKillSwitchRevoked: boolean;
  revokedAt?: string;
  revokeReason?: string;
  revokedBy?: string;

  // 3. Real-Time Telemetry & Health
  health: FleetStoreHealth;
  healthReason?: string;
  syncState: FleetSyncState;
  parityState: FleetParityState;
  pendingChangesCount: number;
  lastHeartbeatAt?: string;
  lastSyncAt?: string;
  appVersion?: string;
  isVersionOutdated?: boolean;
  platform?: string;
  databaseSizeBytes?: number;

  // 4. Store Operations Snapshot
  activeStaffCount?: number;
  openAlertsCount?: number;
  weeklyFloorHoursBase?: number; // 224.0h base
}

export interface FleetSummaryStats {
  totalStores: number;
  activeLicensedStores: number;
  onlineNowStores: number;
  warningStores: number;
  offlineStores: number;
  revokedStores: number;
  unprovisionedStores: number;
  outdatedBuildsCount: number;
  parityVerifiedCount: number;
}

export interface FleetAuditRecord {
  id: string;
  timestamp: string;
  action: FleetAuditAction;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  targetStoreId: string;
  targetStoreName: string;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  details: string;
  hardwareFingerprint?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

export interface ProvisionLicensePayload {
  storeId: string;
  tier: LicenseTier;
  validityDays: number;
  requireHardwareLock: boolean;
  authorizedManagerName: string;
  authorizedManagerEmail: string;
  notes?: string;
}

export interface KillSwitchPayload {
  storeId: string;
  reason: string;
  customDetails?: string;
  actorName: string;
  actorEmail: string;
  confirmationChallenge: string; // Must match `REVOKE <storeId>`
}

export interface FleetFilterState {
  searchQuery: string;
  selectedDistrict: string;   // 'ALL' | specific district
  selectedCity: string;       // 'ALL' | specific city
  storeType: string;          // 'ALL' | store type
  healthFilter: 'ALL' | FleetStoreHealth;
  syncFilter: 'ALL' | FleetSyncState;
  sortBy: 'unitCode' | 'name' | 'city' | 'health' | 'sync' | 'version' | 'heartbeat';
  sortDirection: 'asc' | 'desc';
  viewMode: 'table' | 'grid';
}
