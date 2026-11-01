/**
 * Starbucks Operations Suite — License Vault Manager
 * File: electron/security/licenseVaultManager.ts
 *
 * Responsibilities:
 * 1. Manage encrypted license envelope in userData/security/license.enc (POSIX 0o600).
 * 2. Primary: Electron safeStorage (OS Keychain / DPAPI / Secret Service).
 * 3. Fallback: Hardware-keyed AES-256-GCM if desktop safeStorage is unavailable.
 * 4. Methods: saveLicense, loadLicense, revokeLicense.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { HardwareIdManager } from './hardwareIdManager';

let electronApp: any = null;
let electronSafeStorage: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const electron = typeof require === 'function' ? require('electron') : null;
  if (electron && typeof electron === 'object') {
    electronApp = electron.app;
    electronSafeStorage = electron.safeStorage;
  }
} catch {
  // Running outside Electron runtime
}

export class LicenseVaultManager {
  private static instance: LicenseVaultManager | null = null;
  private securityDir: string;
  private licenseFilePath: string;

  public constructor(customSecurityDir?: string) {
    if (customSecurityDir) {
      this.securityDir = customSecurityDir;
    } else {
      let baseDir = process.env.APPDATA || process.env.HOME || process.cwd();
      try {
        if (electronApp?.getPath) {
          baseDir = electronApp.getPath('userData');
        }
      } catch (_) {}
      this.securityDir = path.join(baseDir, 'security');
    }
    this.licenseFilePath = path.join(this.securityDir, 'license.enc');
  }

  public static getInstance(): LicenseVaultManager {
    if (!this.instance) {
      this.instance = new LicenseVaultManager();
    }
    return this.instance;
  }

  public getLicenseFilePath(): string {
    return this.licenseFilePath;
  }

  /**
   * Checks whether Electron safeStorage encryption is available on this host.
   */
  public isSafeStorageAvailable(): boolean {
    try {
      return (
        typeof electronSafeStorage !== 'undefined' &&
        electronSafeStorage !== null &&
        typeof electronSafeStorage.isEncryptionAvailable === 'function' &&
        electronSafeStorage.isEncryptionAvailable()
      );
    } catch {
      return false;
    }
  }

  /**
   * Saves and encrypts the active license record to disk.
   */
  public async saveLicense(payload: string): Promise<boolean> {
    try {
      if (!fs.existsSync(this.securityDir)) {
        fs.mkdirSync(this.securityDir, { recursive: true });
      }

      const strPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);

      if (this.isSafeStorageAvailable()) {
        const encryptedBuf = electronSafeStorage.encryptString(strPayload);
        fs.writeFileSync(this.licenseFilePath, encryptedBuf, { mode: 0o600 });
      } else {
        // Fallback: Hardware-keyed AES-256-GCM
        const fallbackEnvelope = this.encryptFallback(strPayload);
        fs.writeFileSync(this.licenseFilePath, Buffer.from(fallbackEnvelope, 'utf8'), { mode: 0o600 });
      }

      return true;
    } catch (err) {
      console.error('[LicenseVaultManager] Błąd zapisu licencji:', err);
      return false;
    }
  }

  /**
   * Loads and decrypts the active license record from disk.
   */
  public async loadLicense(): Promise<string | null> {
    try {
      if (!fs.existsSync(this.licenseFilePath)) {
        return null;
      }

      const fileBuf = fs.readFileSync(this.licenseFilePath);

      // Check for hardware-keyed AES-256-GCM fallback envelope
      const contentStr = fileBuf.toString('utf8');
      if (contentStr.startsWith('fallback:aes256gcm:')) {
        return this.decryptFallback(contentStr);
      }

      // Standard safeStorage decryption
      if (this.isSafeStorageAvailable()) {
        const decryptedStr = electronSafeStorage.decryptString(fileBuf);
        return decryptedStr && decryptedStr.length > 0 ? decryptedStr : null;
      }

      console.warn('[LicenseVaultManager] safeStorage niedostępne, a plik zapisano w formacie safeStorage.');
      return null;
    } catch (err) {
      console.error('[LicenseVaultManager] Błąd odszyfrowania licencji:', err);
      return null;
    }
  }

  /**
   * Revokes the license: wipes the file content with random bytes and deletes it.
   */
  public async revokeLicense(): Promise<boolean> {
    try {
      if (fs.existsSync(this.licenseFilePath)) {
        try {
          const stat = fs.statSync(this.licenseFilePath);
          if (stat.size > 0) {
            const randomBuf = crypto.randomBytes(stat.size);
            fs.writeFileSync(this.licenseFilePath, randomBuf);
          }
        } catch (_) {}
        fs.unlinkSync(this.licenseFilePath);
      }
      return true;
    } catch (err) {
      console.error('[LicenseVaultManager] Błąd unieważniania licencji:', err);
      return false;
    }
  }

  // =========================================================================
  // HARDWARE-KEYED AES-256-GCM FALLBACK
  // =========================================================================

  private deriveFallbackKey(): Buffer {
    const hwFingerprint = HardwareIdManager.getInstance().getHardwareFingerprint();
    const salt = Buffer.from('sbx_license_fallback_salt_v1', 'utf8');
    return crypto.pbkdf2Sync(hwFingerprint, salt, 100000, 32, 'sha256');
  }

  private encryptFallback(plaintext: string): string {
    const key = this.deriveFallbackKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `fallback:aes256gcm:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private decryptFallback(envelope: string): string {
    const parts = envelope.split(':');
    if (parts.length !== 5 || parts[0] !== 'fallback' || parts[1] !== 'aes256gcm') {
      throw new Error('Malformed fallback license envelope');
    }
    const iv = Buffer.from(parts[2], 'base64');
    const tag = Buffer.from(parts[3], 'base64');
    const ciphertext = Buffer.from(parts[4], 'base64');
    const key = this.deriveFallbackKey();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}

// Export singleton instance as requested
export const licenseVaultManager = LicenseVaultManager.getInstance();
