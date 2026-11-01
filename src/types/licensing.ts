/**
 * Starbucks Operations Suite — Enterprise Licensing Types
 * File: src/types/licensing.ts
 */

export type LicenseTier = 'STORE_CLIENT' | 'FLEET_MASTER';

export type StationLicenseStatus = 'ACTIVATED' | 'UNACTIVATED' | 'HARDWARE_LOCKOUT' | 'TAMPER_DETECTED';

export interface ActivationKeyData {
  storeId: string;
  randomHex: string;
  checksum: string;
  fullKey: string;
  tier: LicenseTier;
}

export interface ActiveLicenseRecord {
  version: 'v1';
  key: string;
  storeId: string;
  tier: LicenseTier;
  hardwareFingerprint: string;
  activatedAt: string;
  expiresAt?: string;
  signature: string;
  revoked: boolean;
  revokedAt?: string;
  revokeReason?: string;
}

export interface KeyValidationResult {
  valid: boolean;
  storeId?: string;
  tier?: LicenseTier;
  randomHex?: string;
  checksum?: string;
  error?: string;
  data?: ActivationKeyData;
}

export interface ActivationResult {
  success: boolean;
  license?: ActiveLicenseRecord;
  error?: string;
  errorCode?: 
    | 'INVALID_FORMAT' 
    | 'INVALID_SIGNATURE' 
    | 'STORE_MISMATCH' 
    | 'HARDWARE_MISMATCH' 
    | 'STORAGE_ERROR' 
    | 'ALREADY_REVOKED';
}

export interface LicenseStatusResult {
  status: StationLicenseStatus;
  isActivated: boolean;
  hardwareMismatch: boolean;
  revoked: boolean;
  license?: ActiveLicenseRecord;
  error?: string;
}

export interface ILicensingStorageProvider {
  saveLicense(payload: string): Promise<boolean>;
  loadLicense(): Promise<string | null>;
  revokeLicense(reason?: string): Promise<boolean>;
}

export interface IHardwareFingerprintProvider {
  getFingerprint(): Promise<string>;
}

export interface ILicensingService {
  generateActivationKey(storeId: string, tier?: LicenseTier): string;
  validateKeyFormat(key: string): KeyValidationResult;
  verifyKeySignature(key: string, expectedStoreId?: string, customSecret?: string): boolean;
  getHardwareFingerprint(): Promise<string>;
  activateStation(key: string, expectedStoreId?: string): Promise<ActivationResult>;
  activate(key: string, expectedStoreId?: string): Promise<ActivationResult>;
  getActiveLicense(): Promise<ActiveLicenseRecord | null>;
  isStationActivated(): Promise<boolean>;
  isActivated(): Promise<boolean>;
  revokeLicense(reason?: string): Promise<void>;
  verifyStationHardwareLock(): Promise<LicenseStatusResult>;
  clearDecryptedKeyCache(): void;
}
