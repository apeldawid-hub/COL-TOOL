/**
 * Starbucks Operations Suite — Enterprise Licensing & Hardware-Bound Activation Engine
 * src/services/security/licensingService.ts
 *
 * Implements:
 * - Canonical key format: SBX-<storeId>-<randomHex>-<checksum>
 * - 64-bit entropy with deterministic tier encoding ('STORE_CLIENT' | 'FLEET_MASTER')
 * - HMAC-SHA256 signature tag with constant-time equality
 * - Deterministic hardware binding and anti-tamper envelope verification
 * - Cross-environment resilience (Electron Main/Renderer, Node test runner, Browser)
 */

import crypto from 'crypto';
import type {
  LicenseTier,
  StationLicenseStatus,
  ActivationKeyData,
  ActiveLicenseRecord,
  KeyValidationResult,
  ActivationResult,
  LicenseStatusResult,
  ILicensingStorageProvider,
  IHardwareFingerprintProvider,
  ILicensingService,
} from '../../types/licensing';

export type {
  LicenseTier,
  StationLicenseStatus,
  ActivationKeyData,
  ActiveLicenseRecord,
  KeyValidationResult,
  ActivationResult,
  LicenseStatusResult,
  ILicensingStorageProvider,
  IHardwareFingerprintProvider,
  ILicensingService,
};

/**
 * Constant-time string equality check to prevent side-channel timing attacks.
 * Uses crypto.timingSafeEqual when available, with a bitwise XOR accumulator fallback.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;

  if (typeof crypto !== 'undefined' && typeof (crypto as any).timingSafeEqual === 'function') {
    try {
      const bufA = Buffer.from(a, 'utf8');
      const bufB = Buffer.from(b, 'utf8');
      if (bufA.length === bufB.length) {
        return (crypto as any).timingSafeEqual(bufA, bufB);
      }
    } catch {
      // Fall through to constant-time loop
    }
  }

  // Strict constant-time XOR accumulator loop
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Default Storage Provider using Electron IPC via window.api with localStorage and memory fallback.
 */
export class ElectronIpcStorageProvider implements ILicensingStorageProvider {
  private memoryFallback: string | null = null;

  public async saveLicense(payload: string): Promise<boolean> {
    this.memoryFallback = payload;
    const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;
    if (api?.saveLicense) {
      try {
        const res = await api.saveLicense(payload);
        return typeof res === 'boolean' ? res : (res?.success ?? true);
      } catch (err) {
        console.warn('[LicensingService] Błąd zapisu przez IPC, używam fallbacku:', err);
      }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('sbx_active_license_envelope', payload);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }

  public async loadLicense(): Promise<string | null> {
    const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;
    if (api?.loadLicense) {
      try {
        const res = await api.loadLicense();
        if (typeof res === 'string') return res;
        if (res?.data) return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      } catch (err) {
        console.warn('[LicensingService] Błąd odczytu przez IPC, używam fallbacku:', err);
      }
    }
    if (this.memoryFallback) {
      return this.memoryFallback;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem('sbx_active_license_envelope');
      } catch {
        return null;
      }
    }
    return null;
  }

  public async revokeLicense(_reason?: string): Promise<boolean> {
    this.memoryFallback = null;
    const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;
    if (api?.revokeLicense) {
      try {
        await api.revokeLicense();
      } catch (err) {
        console.warn('[LicensingService] Błąd unieważnienia przez IPC:', err);
      }
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('sbx_active_license_envelope');
      } catch {}
    }
    return true;
  }
}

/**
 * Default Hardware Fingerprint Provider.
 */
export class DefaultHardwareProvider implements IHardwareFingerprintProvider {
  public async getFingerprint(): Promise<string> {
    // 1. Electron Preload API in Renderer
    const api = typeof window !== 'undefined' ? (window as any).api || (window as any).electronAPI : null;
    if (api?.getHardwareFingerprint) {
      try {
        const hw = await api.getHardwareFingerprint();
        if (hw && typeof hw === 'string') return hw.trim().toLowerCase();
      } catch (err) {
        console.warn('[LicensingService] Błąd pobierania odcisku przez IPC:', err);
      }
    }

    // 2. Headless Test Environment Override
    if (typeof process !== 'undefined' && process.env?.SBX_TEST_HARDWARE_FINGERPRINT) {
      return process.env.SBX_TEST_HARDWARE_FINGERPRINT.trim().toLowerCase();
    }

    // 3. Node.js direct resolution (in test suites)
    try {
      const { HardwareIdManager } = await import('../../../electron/security/hardwareIdManager');
      return HardwareIdManager.getInstance().getHardwareFingerprint();
    } catch (_) {}

    // 4. Browser preview fallback
    if (typeof localStorage !== 'undefined') {
      try {
        let cached = localStorage.getItem('sbx_station_hw_fingerprint');
        if (!cached) {
          const seed = `hw_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
          cached = crypto.createHash('sha256').update(seed, 'utf8').digest('hex');
          localStorage.setItem('sbx_station_hw_fingerprint', cached);
        }
        return cached;
      } catch {}
    }

    return '0000000000000000000000000000000000000000000000000000000000000000';
  }
}

export class LicensingService implements ILicensingService {
  private static instance: LicensingService | null = null;
  public static readonly CANONICAL_KEY_REGEX = /^SBX-([A-Z0-9_]{3,16})-([A-F0-9]{16})-([A-F0-9]{10})$/i;
  public static readonly DEFAULT_MASTER_SIGNING_SECRET = 'sbx_ent_lic_sign_v1_starbucks_ops_2026';

  private storageProvider: ILicensingStorageProvider;
  private hardwareProvider: IHardwareFingerprintProvider;
  private signingSecret: string;
  private cachedLicense: ActiveLicenseRecord | null = null;

  public constructor(
    storageProvider?: ILicensingStorageProvider,
    hardwareProvider?: IHardwareFingerprintProvider,
    signingSecret?: string
  ) {
    this.storageProvider = storageProvider || new ElectronIpcStorageProvider();
    this.hardwareProvider = hardwareProvider || new DefaultHardwareProvider();
    this.signingSecret =
      signingSecret ||
      (typeof process !== 'undefined' ? process.env?.SBX_LICENSING_SECRET : undefined) ||
      LicensingService.DEFAULT_MASTER_SIGNING_SECRET;
  }

  public static getInstance(): LicensingService {
    if (!this.instance) {
      this.instance = new LicensingService();
    }
    return this.instance;
  }

  public static resetInstance(): void {
    this.instance = null;
  }

  // =========================================================================
  // KEY GENERATION & FORMAT VALIDATION
  // =========================================================================

  /**
   * Generates a canonical signed activation key.
   * Format: SBX-<storeId>-<randomHex>-<checksum>
   * - 64-bit entropy (16 hex chars)
   * - Byte 0 encodes tier: '01' for STORE_CLIENT, 'FF' for FLEET_MASTER
   * - Bytes 1..7 are CSPRNG entropy
   * - Checksum: 10 hex characters HMAC-SHA256 of `SBX:<tier>:<storeId>:<randomHex>`
   */
  public generateActivationKey(
    storeId: string,
    tier: LicenseTier = 'STORE_CLIENT',
    customSecret?: string
  ): string {
    if (!storeId || typeof storeId !== 'string') {
      throw new Error('Invalid store identifier: storeId is required');
    }

    const normStoreId = storeId.trim().toUpperCase();
    if (!/^[A-Z0-9_]{3,16}$/.test(normStoreId)) {
      throw new Error(
        `Invalid store identifier format: "${storeId}". Expected 3-16 alphanumeric characters or underscore.`
      );
    }

    const tierByte = tier === 'FLEET_MASTER' ? 'FF' : '01';
    const entropyHex = crypto.randomBytes(7).toString('hex').toUpperCase();
    const randomHex = `${tierByte}${entropyHex}`; // Exactly 16 chars

    const payload = `SBX:${tier}:${normStoreId}:${randomHex}`;
    const secret = customSecret || this.signingSecret;
    const hmac = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex').toUpperCase();
    const checksum = hmac.substring(0, 10); // 10 chars

    return `SBX-${normStoreId}-${randomHex}-${checksum}`;
  }

  public static generateActivationKey(
    storeId: string,
    tier: LicenseTier = 'STORE_CLIENT',
    customSecret?: string
  ): string {
    return this.getInstance().generateActivationKey(storeId, tier, customSecret);
  }

  /**
   * Validates syntactic format of key and extracts metadata.
   */
  public validateKeyFormat(key: string): KeyValidationResult {
    if (!key || typeof key !== 'string' || key.length > 128) {
      return { valid: false, error: 'Key exceeds maximum length or is invalid' };
    }

    const trimmed = key.trim().toUpperCase();
    const match = LicensingService.CANONICAL_KEY_REGEX.exec(trimmed);

    if (!match) {
      return {
        valid: false,
        error: 'Nieprawidłowy format klucza. Oczekiwano SBX-<storeId>-<randomHex>-<checksum>.',
      };
    }

    const storeId = match[1];
    const randomHex = match[2];
    const checksum = match[3];

    // Decode tier from Byte 0 of randomHex
    const tierByte = randomHex.substring(0, 2);
    const tier: LicenseTier = tierByte === 'FF' || tierByte === '02' ? 'FLEET_MASTER' : 'STORE_CLIENT';

    const data: ActivationKeyData = {
      storeId,
      randomHex,
      checksum,
      fullKey: trimmed,
      tier,
    };

    return {
      valid: true,
      storeId,
      tier,
      randomHex,
      checksum,
      data,
    };
  }

  public static validateKeyFormat(key: string): KeyValidationResult {
    return this.getInstance().validateKeyFormat(key);
  }

  /**
   * Verifies the cryptographic HMAC-SHA256 signature tag of the key using constant-time comparison.
   */
  public verifyKeySignature(
    key: string,
    expectedStoreId?: string,
    customSecret?: string
  ): boolean {
    const format = this.validateKeyFormat(key);
    if (!format.valid || !format.data) return false;

    const { storeId, randomHex, checksum, tier } = format.data;
    const normStoreId = storeId.trim().toUpperCase();
    const normTier = tier;

    // Optional store ID matching with strict boundary checks
    if (expectedStoreId !== undefined && expectedStoreId !== null) {
      if (typeof expectedStoreId !== 'string') return false;
      const normExpected = expectedStoreId.trim().toUpperCase();
      if (normExpected.length === 0) return false;
      if (
        normStoreId !== normExpected &&
        !(
          normTier === 'FLEET_MASTER' &&
          (normExpected === 'HQ_MASTER' ||
            normExpected === 'FLEET_HQ' ||
            normExpected === 'HQ_FLEET' ||
            normStoreId === 'HQ_MASTER' ||
            normStoreId === 'FLEET_HQ' ||
            normStoreId === 'HQ_FLEET')
        )
      ) {
        return false;
      }
    }

    const payload = `SBX:${tier}:${normStoreId}:${randomHex}`;
    const secret = customSecret || this.signingSecret;
    const hmac = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex').toUpperCase();
    const expectedChecksum = hmac.substring(0, 10);

    return timingSafeStringEqual(checksum, expectedChecksum);
  }

  public static verifyKeySignature(
    key: string,
    expectedStoreId?: string,
    customSecret?: string
  ): boolean {
    return this.getInstance().verifyKeySignature(key, expectedStoreId, customSecret);
  }

  // =========================================================================
  // HARDWARE FINGERPRINTING & STATION ACTIVATION
  // =========================================================================

  /**
   * Retrieves deterministic host hardware fingerprint.
   */
  public async getHardwareFingerprint(): Promise<string> {
    return await this.hardwareProvider.getFingerprint();
  }

  public static async getHardwareFingerprint(): Promise<string> {
    return await this.getInstance().getHardwareFingerprint();
  }

  /**
   * Constructs canonical envelope payload string to be cryptographically signed with HMAC-SHA256.
   * Seals key, storeId, tier, hardwareFingerprint, activatedAt, and revocation status into HMAC digest.
   */
  private computeEnvelopePayload(license: ActiveLicenseRecord): string {
    return (
      'ACT:v1:' +
      license.key +
      ':' +
      license.storeId +
      ':' +
      license.tier +
      ':' +
      license.hardwareFingerprint +
      ':' +
      license.activatedAt +
      ':' +
      (license.revoked === true ? 'REVOKED' : 'ACTIVE')
    );
  }

  /**
   * Activates the station with a valid signed activation key and seals it to hardware.
   */
  public async activateStation(key: string, expectedStoreId?: string): Promise<ActivationResult> {
    const format = this.validateKeyFormat(key);
    if (!format.valid || !format.data) {
      return { success: false, errorCode: 'INVALID_FORMAT', error: format.error };
    }

    if (!this.verifyKeySignature(key, expectedStoreId)) {
      return {
        success: false,
        errorCode: 'INVALID_SIGNATURE',
        error: 'Podpis kryptograficzny klucza licencyjnego jest niepoprawny.',
      };
    }

    const hwFingerprint = await this.getHardwareFingerprint();
    const activatedAt = new Date().toISOString();

    const license: ActiveLicenseRecord = {
      version: 'v1',
      key: format.data.fullKey,
      storeId: format.data.storeId,
      tier: format.data.tier,
      hardwareFingerprint: hwFingerprint,
      activatedAt,
      signature: '',
      revoked: false,
    };

    // Compute envelope HMAC signature
    const envelopePayload = this.computeEnvelopePayload(license);
    const envelopeSig = crypto
      .createHmac('sha256', this.signingSecret)
      .update(envelopePayload, 'utf8')
      .digest('hex');

    license.signature = envelopeSig;

    const saved = await this.storageProvider.saveLicense(JSON.stringify(license));
    if (!saved) {
      return {
        success: false,
        errorCode: 'STORAGE_ERROR',
        error: 'Nie udało się zapisać zaszyfrowanej licencji w magazynie bezpiecznym.',
      };
    }

    this.cachedLicense = license;
    return { success: true, license };
  }

  public static async activateStation(key: string, expectedStoreId?: string): Promise<ActivationResult> {
    return await this.getInstance().activateStation(key, expectedStoreId);
  }

  /**
   * Convenience alias for activateStation(key, expectedStoreId)
   */
  public async activate(key: string, expectedStoreId?: string): Promise<ActivationResult> {
    return this.activateStation(key, expectedStoreId);
  }

  public static async activate(key: string, expectedStoreId?: string): Promise<ActivationResult> {
    return await this.getInstance().activate(key, expectedStoreId);
  }

  /**
   * Retrieves active license record and validates its cryptographic seal.
   */
  public async getActiveLicense(): Promise<ActiveLicenseRecord | null> {
    const status = await this.verifyStationHardwareLock();
    if (status.status === 'ACTIVATED') {
      return status.license || null;
    }
    // If hardware mismatch or revoked, still return license if signature is valid
    if (status.status === 'HARDWARE_LOCKOUT' && status.license) {
      return status.license;
    }
    return null;
  }

  public static async getActiveLicense(): Promise<ActiveLicenseRecord | null> {
    return await this.getInstance().getActiveLicense();
  }

  /**
   * Verifies station activation status, checks hardware lock, and detects tampering.
   */
  public async verifyStationHardwareLock(): Promise<LicenseStatusResult> {
    const raw = await this.storageProvider.loadLicense();
    if (!raw) {
      this.cachedLicense = null;
      return {
        status: 'UNACTIVATED',
        isActivated: false,
        hardwareMismatch: false,
        revoked: false,
      };
    }

    let license: ActiveLicenseRecord;
    try {
      license = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return {
        status: 'TAMPER_DETECTED',
        isActivated: false,
        hardwareMismatch: false,
        revoked: false,
        error: 'Błąd deserializacji pliku licencji.',
      };
    }

    if (
      !license ||
      typeof license !== 'object' ||
      typeof license.key !== 'string' ||
      typeof license.storeId !== 'string' ||
      (license.tier !== 'STORE_CLIENT' && license.tier !== 'FLEET_MASTER') ||
      typeof license.hardwareFingerprint !== 'string' ||
      typeof license.activatedAt !== 'string' ||
      typeof license.signature !== 'string'
    ) {
      return {
        status: 'TAMPER_DETECTED',
        isActivated: false,
        hardwareMismatch: false,
        revoked: false,
        license,
        error: 'Koperta licencyjna ma uszkodzoną, niepełną lub zmanipulowaną strukturę pól.',
      };
    }

    // Verify envelope HMAC signature
    const envelopePayload = this.computeEnvelopePayload(license);
    const expectedSig = crypto
      .createHmac('sha256', this.signingSecret)
      .update(envelopePayload, 'utf8')
      .digest('hex');

    if (!timingSafeStringEqual(license.signature, expectedSig)) {
      console.warn('⚠️ [LicensingService] Wykryto manipulację w kopercie licencji (Signature mismatch).');
      return {
        status: 'TAMPER_DETECTED',
        isActivated: false,
        hardwareMismatch: false,
        revoked: false,
        license,
        error: 'Podpis cyfrowy koperty licencji jest niepoprawny (wykryto modyfikację danych).',
      };
    }

    // Check revocation status
    if (license.revoked) {
      return {
        status: 'HARDWARE_LOCKOUT',
        isActivated: false,
        hardwareMismatch: false,
        revoked: true,
        license,
        error: license.revokeReason || 'Licencja dla tej stacji została wycofana (Kill-Switch).',
      };
    }

    // Verify hardware binding
    const currentHw = await this.getHardwareFingerprint();
    if (license.hardwareFingerprint.toLowerCase() !== currentHw.toLowerCase()) {
      return {
        status: 'HARDWARE_LOCKOUT',
        isActivated: false,
        hardwareMismatch: true,
        revoked: false,
        license,
        error: 'Wykryto próbę uruchomienia bazy na nieautoryzowanym sprzęcie (Hardware Mismatch).',
      };
    }

    this.cachedLicense = license;
    return {
      status: 'ACTIVATED',
      isActivated: true,
      hardwareMismatch: false,
      revoked: false,
      license,
    };
  }

  public static async verifyStationHardwareLock(): Promise<LicenseStatusResult> {
    return await this.getInstance().verifyStationHardwareLock();
  }

  /**
   * Returns true only if station is activated, matches current hardware, and is not revoked.
   */
  public async isStationActivated(): Promise<boolean> {
    const status = await this.verifyStationHardwareLock();
    return status.status === 'ACTIVATED';
  }

  public static async isStationActivated(): Promise<boolean> {
    return await this.getInstance().isStationActivated();
  }

  /**
   * Convenience alias for isStationActivated()
   */
  public async isActivated(): Promise<boolean> {
    return this.isStationActivated();
  }

  public static async isActivated(): Promise<boolean> {
    return await this.getInstance().isActivated();
  }

  /**
   * Flushes in-memory decrypted license cache (Tier 2 RAM Zeroization)
   */
  public clearDecryptedKeyCache(): void {
    this.cachedLicense = null;
  }

  public static clearDecryptedKeyCache(): void {
    this.getInstance().clearDecryptedKeyCache();
  }

  /**
   * Revokes the active license (Kill-Switch).
   */
  public async revokeLicense(reason: string = 'Wycofanie przez administratora floty'): Promise<void> {
    const raw = await this.storageProvider.loadLicense();
    if (raw) {
      try {
        const license: ActiveLicenseRecord = typeof raw === 'string' ? JSON.parse(raw) : raw;
        license.revoked = true;
        license.revokedAt = new Date().toISOString();
        license.revokeReason = reason;
        const envelopePayload = this.computeEnvelopePayload(license);
        license.signature = crypto
          .createHmac('sha256', this.signingSecret)
          .update(envelopePayload, 'utf8')
          .digest('hex');
        await this.storageProvider.saveLicense(JSON.stringify(license));
      } catch (_) {}
    }

    await this.storageProvider.revokeLicense(reason);
    this.cachedLicense = null;

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('sbx:license-revoked', { detail: { reason } }));
      } catch (_) {}
    }
  }

  public static async revokeLicense(reason?: string): Promise<void> {
    return await this.getInstance().revokeLicense(reason);
  }
}

// Export singleton instance as requested
export const licensingService = LicensingService.getInstance();
