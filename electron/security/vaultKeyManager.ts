/**
 * Starbucks Operations Suite — Electron Main Process Vault Key Manager
 *
 * Integrates with Electron `safeStorage` (OS Keychain / DPAPI / Secret Service).
 * Protects Master Encryption Passphrase on the host operating system.
 */

import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class VaultKeyManager {
  private static instance: VaultKeyManager | null = null;
  private cachedMasterPassphrase: string | null = null;
  private securityDir: string;
  private seedFilePath: string;

  private constructor() {
    const userData = app?.getPath ? app.getPath('userData') : process.cwd();
    this.securityDir = path.join(userData, 'security');
    this.seedFilePath = path.join(this.securityDir, 'master_seed.enc');
  }

  public static getInstance(): VaultKeyManager {
    if (!this.instance) {
      this.instance = new VaultKeyManager();
    }
    return this.instance;
  }

  /**
   * Checks whether OS keychain / DPAPI encryption is available.
   */
  public isSafeStorageAvailable(): boolean {
    try {
      return typeof safeStorage !== 'undefined' && safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Obtains or generates the master vault passphrase.
   * Encrypted via OS Keychain (safeStorage) when available.
   */
  public async getOrCreateMasterPassphrase(): Promise<string> {
    if (this.cachedMasterPassphrase) {
      return this.cachedMasterPassphrase;
    }

    if (!fs.existsSync(this.securityDir)) {
      fs.mkdirSync(this.securityDir, { recursive: true });
    }

    // 1. Try reading existing encrypted seed
    if (fs.existsSync(this.seedFilePath)) {
      try {
        const encryptedBuf = fs.readFileSync(this.seedFilePath);
        if (this.isSafeStorageAvailable()) {
          const decrypted = safeStorage.decryptString(encryptedBuf);
          if (decrypted && decrypted.length >= 32) {
            this.cachedMasterPassphrase = decrypted;
            return decrypted;
          }
        } else {
          // Fallback if encrypted without safeStorage or safeStorage became unavailable
          const fallbackDecoded = encryptedBuf.toString('utf8');
          if (fallbackDecoded.startsWith('plain:')) {
            this.cachedMasterPassphrase = fallbackDecoded.slice(6);
            return this.cachedMasterPassphrase;
          }
        }
      } catch (err) {
        console.error('[VaultKeyManager] Nie udało się odszyfrować master_seed.enc:', err);
      }
    }

    // 2. Generate fresh high-entropy master secret
    const newSecret = crypto.randomBytes(32).toString('hex');

    try {
      if (this.isSafeStorageAvailable()) {
        const encrypted = safeStorage.encryptString(newSecret);
        fs.writeFileSync(this.seedFilePath, encrypted);
        console.log('🔒 [VaultKeyManager] Pomyślnie zainicjalizowano master seed w OS Keychain (safeStorage)');
      } else {
        // Fallback for headless / unsupported environments
        const fallbackPayload = `plain:${newSecret}`;
        fs.writeFileSync(this.seedFilePath, Buffer.from(fallbackPayload, 'utf8'), { mode: 0o600 });
        console.warn('⚠️ [VaultKeyManager] safeStorage niedostępne — zapisano zabezpieczony lokalny klucz fallback');
      }
      this.cachedMasterPassphrase = newSecret;
      return newSecret;
    } catch (err) {
      console.error('[VaultKeyManager] Błąd zapisu master seed:', err);
      // Memory-only fallback
      this.cachedMasterPassphrase = process.env.SBX_MASTER_PASSPHRASE || 'sbx_default_master_passphrase';
      return this.cachedMasterPassphrase;
    }
  }

  /**
   * Derives SEK for a given store in the main process.
   * Offloads 600,000 PBKDF2 iterations from the UI renderer process.
   */
  public async deriveStoreKey(storeId: string, unitCode: string): Promise<string> {
    const masterPassphrase = await this.getOrCreateMasterPassphrase();
    const saltStr = `sbx_vault_salt_v1_${storeId}_${unitCode}`;
    const salt = crypto.createHash('sha256').update(saltStr, 'utf8').digest();

    const sek = crypto.pbkdf2Sync(masterPassphrase, salt, 600000, 32, 'sha256');
    return sek.toString('base64');
  }

  /**
   * Encrypts arbitrary string using safeStorage.
   */
  public encryptString(plainText: string): { success: boolean; data?: string; error?: string } {
    try {
      if (!this.isSafeStorageAvailable()) {
        return { success: false, error: 'safeStorage is not available on this platform' };
      }
      const encrypted = safeStorage.encryptString(plainText);
      return { success: true, data: encrypted.toString('base64') };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Decrypts safeStorage base64 string.
   */
  public decryptString(encryptedBase64: string): { success: boolean; data?: string; error?: string } {
    try {
      if (!this.isSafeStorageAvailable()) {
        return { success: false, error: 'safeStorage is not available on this platform' };
      }
      const buf = Buffer.from(encryptedBase64, 'base64');
      const decrypted = safeStorage.decryptString(buf);
      return { success: true, data: decrypted };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
