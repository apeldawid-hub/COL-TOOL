/**
 * Starbucks Operations Suite — Enterprise Master Disaster Recovery & BIP-39 Engine
 * File: src/services/security/masterRecoveryService.ts
 *
 * Responsibilities:
 * 1. Zero-dependency BIP-39 24-word Mnemonic Generation & Validation
 *    (256 bits CSPRNG entropy + 8 bits SHA-256 checksum = 264 bits -> 24 words).
 * 2. Constant-time checksum verification to prevent timing leaks.
 * 3. PBKDF2-HMAC-SHA512 seed derivation (2,048 rounds, 512-bit binary seed).
 * 4. Hierarchical disaster recovery key derivation (Master Root Key, Master Passphrase, Store SEK, Emergency Token).
 * 5. Memory hygiene & buffer zeroization.
 */

import crypto from 'crypto';
import { BIP39_ENGLISH_WORDLIST, BIP39_WORD_INDEX_MAP } from './bip39Wordlist';

export interface MnemonicValidationResult {
  valid: boolean;
  wordCount?: number;
  invalidWords?: string[];
  checksumValid?: boolean;
  entropy?: Uint8Array;
  hexEntropy?: string;
  error?: string;
}

export interface OfflineStoreCertificate {
  storeId: string;
  hardwareFingerprint: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export class MasterRecoveryService {
  private static instance: MasterRecoveryService | null = null;

  public static getInstance(): MasterRecoveryService {
    if (!this.instance) {
      this.instance = new MasterRecoveryService();
    }
    return this.instance;
  }

  // =========================================================================
  // 1. SECURE RANDOM & HASH PRIMITIVES
  // =========================================================================

  private static getSecureRandomBytes(length: number): Uint8Array {
    if (typeof crypto !== 'undefined') {
      if (typeof (crypto as any).randomBytes === 'function') {
        return new Uint8Array((crypto as any).randomBytes(length));
      }
      if (typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        return bytes;
      }
    }
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
      const bytes = new Uint8Array(length);
      globalThis.crypto.getRandomValues(bytes);
      return bytes;
    }
    throw new Error('[Security] No secure random number generator available');
  }

  private static sha256(data: Uint8Array): Uint8Array {
    const hash = crypto.createHash('sha256').update(Buffer.from(data)).digest();
    return new Uint8Array(hash);
  }

  // =========================================================================
  // 2. MNEMONIC GENERATION & VALIDATION
  // =========================================================================

  /**
   * Generates a 24-word BIP-39 mnemonic from 256 bits of CSPRNG entropy.
   * Immediately zeroes the raw entropy buffer after words are selected.
   */
  public static generateMasterRecoveryMnemonic(): string {
    const entropy = this.getSecureRandomBytes(32);
    try {
      return this.entropyToMnemonic(entropy);
    } finally {
      entropy.fill(0); // Memory hygiene
    }
  }

  public generateMasterRecoveryMnemonic(): string {
    return MasterRecoveryService.generateMasterRecoveryMnemonic();
  }

  /**
   * Converts 256 bits (32 bytes) of entropy into a 24-word BIP-39 mnemonic.
   */
  public static entropyToMnemonic(entropy: Uint8Array): string {
    if (!entropy || entropy.length !== 32) {
      throw new Error('Entropy must be exactly 32 bytes (256 bits)');
    }

    const hash = this.sha256(entropy);
    const checksum = hash[0]; // First 8 bits

    const payload = new Uint8Array(33);
    payload.set(entropy, 0);
    payload[32] = checksum;

    const words: string[] = [];
    for (let k = 0; k < 24; k++) {
      const bitPos = k * 11;
      const bytePos = Math.floor(bitPos / 8);
      const bitOffset = bitPos % 8;

      const b0 = payload[bytePos];
      const b1 = bytePos + 1 < 33 ? payload[bytePos + 1] : 0;
      const b2 = bytePos + 2 < 33 ? payload[bytePos + 2] : 0;

      const val = (b0 << 16) | (b1 << 8) | b2;
      const index = (val >> (13 - bitOffset)) & 0x7ff;
      words.push(BIP39_ENGLISH_WORDLIST[index]);
    }

    payload.fill(0);
    return words.join(' ');
  }

  public entropyToMnemonic(entropy: Uint8Array): string {
    return MasterRecoveryService.entropyToMnemonic(entropy);
  }

  /**
   * Validates a candidate 24-word mnemonic and extracts the 256-bit entropy.
   * - Strict defensive sanitization: NFKD normalization, lowercased, split on whitespace.
   * - Strict length check: exactly 24 words.
   * - Strict dictionary check: every word must exist in BIP39_ENGLISH_WORDLIST.
   * - Constant-time SHA-256 checksum verification: (embedded ^ computed) === 0.
   */
  public static validateRecoveryMnemonic(mnemonic: string): MnemonicValidationResult {
    if (typeof mnemonic !== 'string' || !mnemonic.trim()) {
      return { valid: false, wordCount: 0, error: 'Mnemonic phrase must be a non-empty string' };
    }

    const normalized = mnemonic.trim().toLowerCase().normalize('NFKD');
    const words = normalized.split(/\s+/);

    if (words.length !== 24) {
      return {
        valid: false,
        wordCount: words.length,
        error: `Invalid mnemonic length: expected 24 words, received ${words.length}`,
      };
    }

    const invalidWords: string[] = [];
    const indices: number[] = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const idx = BIP39_WORD_INDEX_MAP.get(w);
      if (idx === undefined) {
        invalidWords.push(w);
      } else {
        indices.push(idx);
      }
    }

    if (invalidWords.length > 0) {
      return {
        valid: false,
        wordCount: words.length,
        invalidWords,
        error: `Invalid word in BIP-39 dictionary: ${invalidWords.join(', ')}`,
      };
    }

    // Reconstruct 264 bits (33 bytes)
    const payload = new Uint8Array(33);
    for (let k = 0; k < 24; k++) {
      const idx = indices[k];
      const bitPos = k * 11;
      const bytePos = Math.floor(bitPos / 8);
      const bitOffset = bitPos % 8;

      const val = idx << (13 - bitOffset);
      payload[bytePos] |= (val >> 16) & 0xff;
      if (bytePos + 1 < 33) payload[bytePos + 1] |= (val >> 8) & 0xff;
      if (bytePos + 2 < 33) payload[bytePos + 2] |= val & 0xff;
    }

    const entropy = new Uint8Array(payload.subarray(0, 32));
    const embeddedChecksum = payload[32];
    payload.fill(0);

    const hash = this.sha256(entropy);
    const computedChecksum = hash[0];

    // Constant-time comparison
    const diff = embeddedChecksum ^ computedChecksum;
    if (diff !== 0) {
      entropy.fill(0);
      return {
        valid: false,
        wordCount: 24,
        checksumValid: false,
        error: 'Invalid checksum: mnemonic verification failed',
      };
    }

    return {
      valid: true,
      wordCount: 24,
      checksumValid: true,
      entropy,
      hexEntropy: Buffer.from(entropy).toString('hex'),
    };
  }

  public validateRecoveryMnemonic(mnemonic: string): MnemonicValidationResult {
    return MasterRecoveryService.validateRecoveryMnemonic(mnemonic);
  }

  /**
   * Extracts verified entropy from a 24-word mnemonic, throwing if invalid.
   */
  public static mnemonicToEntropy(mnemonic: string): Uint8Array {
    const res = this.validateRecoveryMnemonic(mnemonic);
    if (!res.valid || !res.entropy) {
      throw new Error(res.error || 'Failed to extract entropy from mnemonic');
    }
    return res.entropy;
  }

  public mnemonicToEntropy(mnemonic: string): Uint8Array {
    return MasterRecoveryService.mnemonicToEntropy(mnemonic);
  }

  // =========================================================================
  // 3. BIP-39 SEED DERIVATION (PBKDF2-HMAC-SHA512)
  // =========================================================================

  /**
   * Synchronous BIP-39 seed derivation.
   * PBKDF2-HMAC-SHA512, 2048 iterations, salt = "mnemonic" + passphrase.
   * Output: 64 bytes (512 bits) Buffer.
   */
  public static mnemonicToSeedSync(mnemonic: string, passphrase: string = ''): Buffer {
    const validation = this.validateRecoveryMnemonic(mnemonic);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid mnemonic phrase');
    }

    const normalizedMnemonic = mnemonic.trim().split(/\s+/).join(' ').normalize('NFKD');
    const normalizedSalt = ('mnemonic' + (passphrase || '')).normalize('NFKD');
    return crypto.pbkdf2Sync(normalizedMnemonic, normalizedSalt, 2048, 64, 'sha512');
  }

  public mnemonicToSeedSync(mnemonic: string, passphrase: string = ''): Buffer {
    return MasterRecoveryService.mnemonicToSeedSync(mnemonic, passphrase);
  }

  /**
   * Async BIP-39 seed derivation with Web Crypto API fallback.
   */
  public static async mnemonicToSeed(mnemonic: string, passphrase: string = ''): Promise<Buffer> {
    const validation = this.validateRecoveryMnemonic(mnemonic);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid mnemonic phrase');
    }

    const normalizedMnemonic = mnemonic.trim().split(/\s+/).join(' ').normalize('NFKD');
    const normalizedSalt = ('mnemonic' + (passphrase || '')).normalize('NFKD');

    if (typeof crypto !== 'undefined' && typeof crypto.pbkdf2 === 'function') {
      return new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(normalizedMnemonic, normalizedSalt, 2048, 64, 'sha512', (err, derivedKey) => {
          if (err) reject(err);
          else resolve(derivedKey);
        });
      });
    }

    // Web Crypto API fallback
    if (typeof globalThis.crypto?.subtle !== 'undefined') {
      const enc = new TextEncoder();
      const keyMaterial = await globalThis.crypto.subtle.importKey(
        'raw',
        enc.encode(normalizedMnemonic),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const bits = await globalThis.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: enc.encode(normalizedSalt),
          iterations: 2048,
          hash: 'SHA-512',
        },
        keyMaterial,
        512
      );
      return Buffer.from(bits);
    }

    throw new Error('No cryptographic engine available for PBKDF2');
  }

  public async mnemonicToSeed(mnemonic: string, passphrase: string = ''): Promise<Buffer> {
    return MasterRecoveryService.mnemonicToSeed(mnemonic, passphrase);
  }

  // =========================================================================
  // 4. HIERARCHICAL MASTER DISASTER RECOVERY ASSETS
  // =========================================================================

  /**
   * Derives 32-byte Master Root Key from 64-byte seed.
   */
  public static deriveMasterRootKey(seed: Buffer | Uint8Array): Buffer {
    return crypto.createHmac('sha256', Buffer.from(seed)).update('sbx_master_root_v1', 'utf8').digest();
  }

  public deriveMasterRootKey(seed: Buffer | Uint8Array): Buffer {
    return MasterRecoveryService.deriveMasterRootKey(seed);
  }

  /**
   * Derives Master Passphrase for restoring master_seed.enc.
   */
  public static deriveMasterPassphrase(seed: Buffer | Uint8Array): string {
    const rootKey = this.deriveMasterRootKey(seed);
    try {
      return rootKey.toString('hex');
    } finally {
      rootKey.fill(0);
    }
  }

  public deriveMasterPassphrase(seed: Buffer | Uint8Array): string {
    return MasterRecoveryService.deriveMasterPassphrase(seed);
  }

  /**
   * Derives Store Encryption Key (SEK) for offline emergency recovery of any store vault.
   */
  public static deriveStoreRecoveryKey(
    seed: Buffer | Uint8Array,
    storeId: string,
    unitCode: string
  ): Buffer {
    const rootKey = this.deriveMasterRootKey(seed);
    try {
      const payload = `sbx_store_sek_v1:${storeId}:${unitCode}`;
      return crypto.createHmac('sha256', rootKey).update(payload, 'utf8').digest();
    } finally {
      rootKey.fill(0);
    }
  }

  public deriveStoreRecoveryKey(seed: Buffer | Uint8Array, storeId: string, unitCode: string): Buffer {
    return MasterRecoveryService.deriveStoreRecoveryKey(seed, storeId, unitCode);
  }

  /**
   * Derives Emergency Admin Unlock Token for break-glass login.
   */
  public static deriveEmergencyAdminToken(seed: Buffer | Uint8Array): string {
    const rootKey = this.deriveMasterRootKey(seed);
    try {
      return crypto.createHmac('sha256', rootKey).update('sbx_emergency_admin_unlock_v1', 'utf8').digest('hex');
    } finally {
      rootKey.fill(0);
    }
  }

  public deriveEmergencyAdminToken(seed: Buffer | Uint8Array): string {
    return MasterRecoveryService.deriveEmergencyAdminToken(seed);
  }

  /**
   * Generates a signed break-glass offline store certificate.
   */
  public static generateOfflineStoreCertificate(
    seed: Buffer | Uint8Array,
    storeId: string,
    hardwareFingerprint: string,
    validDays: number = 30
  ): OfflineStoreCertificate {
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + validDays * 86400000).toISOString();
    const payload = `CERT:${storeId}:${hardwareFingerprint}:${issuedAt}:${expiresAt}`;
    const signature = crypto.createHmac('sha256', Buffer.from(seed)).update(payload, 'utf8').digest('hex');

    return { storeId, hardwareFingerprint, issuedAt, expiresAt, signature };
  }

  public generateOfflineStoreCertificate(
    seed: Buffer | Uint8Array,
    storeId: string,
    hardwareFingerprint: string,
    validDays: number = 30
  ): OfflineStoreCertificate {
    return MasterRecoveryService.generateOfflineStoreCertificate(seed, storeId, hardwareFingerprint, validDays);
  }

  // =========================================================================
  // 5. MEMORY HYGIENE HELPERS
  // =========================================================================

  /**
   * Overwrites a buffer with zeroes to eliminate secrets from RAM.
   */
  public static wipeBuffer(buf: Buffer | Uint8Array): void {
    if (buf && typeof buf.fill === 'function') {
      buf.fill(0);
    }
  }

  public wipeBuffer(buf: Buffer | Uint8Array): void {
    MasterRecoveryService.wipeBuffer(buf);
  }

  /**
   * Scoped execution helper guaranteeing zeroization upon completion.
   */
  public static withWipedBuffer<T>(buf: Buffer | Uint8Array, fn: (b: Buffer | Uint8Array) => T): T {
    try {
      return fn(buf);
    } finally {
      this.wipeBuffer(buf);
    }
  }

  public withWipedBuffer<T>(buf: Buffer | Uint8Array, fn: (b: Buffer | Uint8Array) => T): T {
    return MasterRecoveryService.withWipedBuffer(buf, fn);
  }
}

export const masterRecoveryService = MasterRecoveryService.getInstance();
