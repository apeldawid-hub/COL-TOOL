/**
 * Starbucks Operations Suite — Client-Side AES-256-GCM Encryption Engine (Feature F12)
 *
 * Cryptographic Specifications:
 * - Cipher: AES-256-GCM (Authenticated Encryption with Associated Data)
 * - Key Derivation: PBKDF2-HMAC-SHA256 (600,000 iterations, 256-bit output)
 * - Deterministic Salt: SHA-256("sbx_vault_salt_v1_" + storeId + "_" + unitCode)
 * - Nonce (IV): 96-bit (12 bytes) cryptographically random bytes per encryption
 * - Auth Tag: 128-bit (16 bytes) GCM authentication tag
 * - AAD Context Binding: `${storeId}:${vaultType}:${docId}`
 * - Canonical Payload Format: RFC 8785 canonical JSON
 * - Serialized Envelope: `enc:v1:<storeId>:<keyId>:<base64_iv>:<base64_tag>:<base64_ciphertext>`
 */

import crypto from 'crypto';
import { StoreService } from '../storeService';

export interface EncryptedEnvelope {
  version: 'v1';
  storeId: string;
  keyId: string;
  iv: string; // base64 (12 bytes / 96-bit)
  tag: string; // base64 (16 bytes / 128-bit)
  ciphertext: string; // base64
  aadContext?: string;
  serialized: string;
}

export interface EncryptionOptions {
  unitCode?: string;
  keyId?: string;
  passphrase?: string;
}

export interface DecryptionOptions {
  unitCode?: string;
  passphrase?: string;
}

/**
 * Deterministic Canonical JSON serialization (RFC 8785 subset).
 * Guarantees identical byte representation regardless of object key insertion order.
 */
export function canonicalJson(data: any): string {
  if (data === null || typeof data !== 'object') {
    return JSON.stringify(data);
  }

  if (data instanceof Date) {
    return JSON.stringify(isNaN(data.getTime()) ? null : data.toISOString());
  }

  if (Array.isArray(data)) {
    return (
      '[' +
      data
        .map((v) =>
          v === undefined || typeof v === 'function' || typeof v === 'symbol'
            ? 'null'
            : canonicalJson(v)
        )
        .join(',') +
      ']'
    );
  }

  const sortedKeys = Object.keys(data)
    .filter(
      (key) =>
        data[key] !== undefined &&
        typeof data[key] !== 'function' &&
        typeof data[key] !== 'symbol'
    )
    .sort();

  const pairs = sortedKeys.map((key) => {
    return JSON.stringify(key) + ':' + canonicalJson(data[key]);
  });
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes SHA-256 hash of canonical JSON string.
 */
export function canonicalSha256(data: any): string {
  const jsonStr = canonicalJson(data);
  return crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
}

/**
 * In-memory Store Encryption Key (SEK) cache to avoid redundant 600,000 PBKDF2 iterations.
 * Key format: `${storeId}:${unitCode}:${passphraseHash}`
 */
export class StoreKeyCache {
  private static cache = new Map<string, { key: Buffer; expiresAt: number }>();
  private static readonly TTL_MS = 60 * 60 * 1000; // 1 hour
  private static readonly MAX_ENTRIES = 256;

  public static get(storeId: string, unitCode: string, passphraseHash: string): Buffer | null {
    const cacheKey = `${storeId}:${unitCode}:${passphraseHash}`;
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      if (entry.key) {
        entry.key.fill(0);
      }
      this.cache.delete(cacheKey);
      return null;
    }
    // Refresh LRU order on access
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, entry);
    return entry.key;
  }

  public static set(storeId: string, unitCode: string, passphraseHash: string, key: Buffer): void {
    const cacheKey = `${storeId}:${unitCode}:${passphraseHash}`;
    const existing = this.cache.get(cacheKey);
    if (existing && existing.key !== key) {
      if (existing.key) {
        existing.key.fill(0);
      }
      this.cache.delete(cacheKey);
    }

    // LRU eviction if cache size exceeds capacity
    if (this.cache.size >= this.MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const oldestEntry = this.cache.get(oldestKey);
        if (oldestEntry?.key) {
          oldestEntry.key.fill(0);
        }
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, {
      key,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  public static invalidateStore(storeId: string): void {
    const prefix = `${storeId}:`;
    for (const [k, entry] of this.cache.entries()) {
      if (k.startsWith(prefix)) {
        if (entry?.key) {
          entry.key.fill(0);
        }
        this.cache.delete(k);
      }
    }
  }

  public static clear(): void {
    for (const entry of this.cache.values()) {
      if (entry?.key) {
        entry.key.fill(0);
      }
    }
    this.cache.clear();
  }

  public static size(): number {
    return this.cache.size;
  }
}

/**
 * Resolves default master passphrase based on execution environment.
 */
function resolveDefaultPassphrase(): string {
  if (typeof process !== 'undefined' && process.env?.SBX_MASTER_PASSPHRASE) {
    return process.env.SBX_MASTER_PASSPHRASE;
  }
  return 'sbx_default_master_passphrase';
}

/**
 * Resolves unit code for a given store ID from store service if not provided.
 */
export function resolveUnitCode(storeId: string, explicitUnitCode?: string): string {
  if (explicitUnitCode && explicitUnitCode.trim()) {
    return explicitUnitCode.trim();
  }
  if (typeof localStorage !== 'undefined' || typeof window !== 'undefined') {
    try {
      const store = StoreService.findStoreByIdOrCode(storeId);
      if (store?.unitCode) {
        return store.unitCode;
      }
    } catch {
      // In headless test environments StoreService may have uninitialized storage
    }
  }
  return storeId;
}

/**
 * Derives Store Encryption Key (SEK) synchronously using PBKDF2-HMAC-SHA256 (600,000 iterations).
 * Salt = SHA-256("sbx_vault_salt_v1_" + storeId + "_" + unitCode)
 */
let defaultPassHash: string | null = null;
function computePassHash(passphrase?: string): string {
  if (!passphrase) {
    if (!defaultPassHash) {
      defaultPassHash = crypto.createHash('sha256').update(resolveDefaultPassphrase(), 'utf8').digest('hex').slice(0, 16);
    }
    return defaultPassHash;
  }
  return crypto.createHash('sha256').update(passphrase, 'utf8').digest('hex').slice(0, 16);
}

export function deriveStoreKeySync(storeId: string, unitCode: string, passphrase?: string): Buffer {
  const effectivePassphrase = passphrase || resolveDefaultPassphrase();
  const passHash = computePassHash(effectivePassphrase);

  const cached = StoreKeyCache.get(storeId, unitCode, passHash);
  if (cached) {
    return cached;
  }

  const saltStr = `sbx_vault_salt_v1_${storeId}_${unitCode}`;
  const salt = crypto.createHash('sha256').update(saltStr, 'utf8').digest();

  const key = crypto.pbkdf2Sync(effectivePassphrase, salt, 600000, 32, 'sha256');
  StoreKeyCache.set(storeId, unitCode, passHash, key);
  return key;
}

export async function deriveStoreKey(storeId: string, unitCode: string, passphrase?: string): Promise<Buffer> {
  const effectivePassphrase = passphrase || resolveDefaultPassphrase();
  const passHash = computePassHash(effectivePassphrase);

  // 1. Check StoreKeyCache first for immediate cache hit (< 0.001 ms)
  const cached = StoreKeyCache.get(storeId, unitCode, passHash);
  if (cached) {
    return cached;
  }

  // 2. If running in Electron with main-process IPC available and no explicit custom passphrase
  if (typeof window !== 'undefined' && !passphrase) {
    const api = (window as any).api || (window as any).electronAPI;
    if (api?.cryptoDeriveStoreKey && typeof api.cryptoDeriveStoreKey === 'function') {
      try {
        const keyBase64 = await api.cryptoDeriveStoreKey(storeId, unitCode);
        if (keyBase64 && typeof keyBase64 === 'string') {
          const key = Buffer.from(keyBase64, 'base64');
          if (key.length === 32) {
            StoreKeyCache.set(storeId, unitCode, passHash, key);
            return key;
          }
        }
      } catch (err) {
        console.warn('[EncryptionService] Błąd IPC cryptoDeriveStoreKey, fallback do Node crypto:', err);
      }
    }
  }

  // 3. Fallback to local synchronous PBKDF2 derivation (headless Node / non-Electron)
  return deriveStoreKeySync(storeId, unitCode, passphrase);
}

/**
 * Serializes an EncryptedEnvelope object into the canonical 7-segment string format:
 * `enc:v1:<storeId>:<keyId>:<base64_iv>:<base64_tag>:<base64_ciphertext>`
 */
export function serializeEnvelope(envelope: EncryptedEnvelope): string {
  return `enc:${envelope.version}:${envelope.storeId}:${envelope.keyId}:${envelope.iv}:${envelope.tag}:${envelope.ciphertext}`;
}

/**
 * Parses and validates an encrypted envelope string.
 * Throws an Error matching /Malformed/i or /Store ID mismatch/i if invalid.
 */
export function parseEnvelope(encoded: string): EncryptedEnvelope {
  if (typeof encoded !== 'string' || !encoded.trim()) {
    throw new Error(`Malformed envelope format: payload is empty or not a string`);
  }

  const parts = encoded.trim().split(':');
  if (parts.length !== 7) {
    throw new Error(`Malformed envelope format: expected 7 colon-separated parts, received ${parts.length} in '${encoded}'`);
  }

  const [prefix, version, storeId, keyId, iv, tag, ciphertext] = parts;

  if (prefix !== 'enc') {
    throw new Error(`Malformed envelope format: expected prefix 'enc', received '${prefix}'`);
  }

  if (version !== 'v1') {
    throw new Error(`Malformed envelope format: unsupported envelope version '${version}'`);
  }

  if (!storeId || !keyId || !iv || !tag || !ciphertext) {
    throw new Error(`Malformed envelope format: contains empty segment fields`);
  }

  return {
    version: 'v1',
    storeId,
    keyId,
    iv,
    tag,
    ciphertext,
    serialized: encoded.trim(),
  };
}

/**
 * Internal AES-256-GCM cipher executor.
 */
function executeEncryption<T = any>(
  payload: T,
  storeId: string,
  vaultType: string,
  docId: string,
  keyId: string,
  sek: Buffer
): EncryptedEnvelope {
  const iv = crypto.randomBytes(12); // 96-bit IV per NIST SP 800-38D
  const cipher = crypto.createCipheriv('aes-256-gcm', sek, iv);

  const aadContext = `${storeId}:${vaultType}:${docId}`;
  cipher.setAAD(Buffer.from(aadContext, 'utf8'));

  const plaintext = Buffer.from(canonicalJson(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag(); // 128-bit authentication tag

  const b64Iv = iv.toString('base64');
  const b64Tag = tag.toString('base64');
  const b64Cipher = ciphertext.toString('base64');

  const envelope: EncryptedEnvelope = {
    version: 'v1',
    storeId,
    keyId,
    iv: b64Iv,
    tag: b64Tag,
    ciphertext: b64Cipher,
    aadContext,
    serialized: '',
  };
  envelope.serialized = serializeEnvelope(envelope);

  return envelope;
}

/**
 * Internal AES-256-GCM decipher executor.
 */
function executeDecryption<T = any>(
  envelope: EncryptedEnvelope,
  storeId: string,
  vaultType: string,
  docId: string,
  sek: Buffer
): T {
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  if (iv.length !== 12) {
    throw new Error(`Invalid initialization vector length: expected 12 bytes (96-bit), got ${iv.length} bytes`);
  }
  if (tag.length !== 16) {
    throw new Error(`Invalid authentication tag length: expected 16 bytes (128-bit), got ${tag.length} bytes`);
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', sek, iv);
  const aad = Buffer.from(`${storeId}:${vaultType}:${docId}`, 'utf8');
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}

/**
 * Synchronous encryption helper.
 */
export function encryptPayloadSync<T = any>(
  payload: T,
  storeId: string,
  arg3: string,
  arg4: string,
  arg5?: string,
  arg6 = 'k1'
): EncryptedEnvelope {
  let unitCode: string;
  let vaultType: string;
  let docId: string;
  let keyId = arg6;

  if (arg5 !== undefined && typeof arg5 === 'string' && arg5.length > 0) {
    unitCode = arg3;
    vaultType = arg4;
    docId = arg5;
    if (arg6 !== 'k1') keyId = arg6;
  } else {
    unitCode = resolveUnitCode(storeId);
    vaultType = arg3;
    docId = arg4;
    if (arg5) keyId = arg5;
  }

  const sek = deriveStoreKeySync(storeId, unitCode);
  return executeEncryption(payload, storeId, vaultType, docId, keyId, sek);
}

/**
 * Encrypts a payload asynchronously using AES-256-GCM with AAD context binding.
 * Derives Store Encryption Key (SEK) via `deriveStoreKey`, ensuring Electron IPC and safeStorage integration.
 * Supports both 4-argument signature `(payload, storeId, vaultType, docId)`
 * and 5-argument signature `(payload, storeId, unitCode, vaultType, docId, keyId?)`.
 */
export async function encryptPayload<T = any>(
  payload: T,
  storeId: string,
  arg3: string,
  arg4: string,
  arg5?: string,
  arg6 = 'k1',
  passphrase?: string
): Promise<EncryptedEnvelope> {
  let unitCode: string;
  let vaultType: string;
  let docId: string;
  let keyId = arg6;

  if (arg5 !== undefined && typeof arg5 === 'string' && arg5.length > 0) {
    unitCode = arg3;
    vaultType = arg4;
    docId = arg5;
    if (arg6 !== 'k1') keyId = arg6;
  } else {
    unitCode = resolveUnitCode(storeId);
    vaultType = arg3;
    docId = arg4;
    if (arg5) keyId = arg5;
  }

  const passHash = computePassHash(passphrase);
  let sek = StoreKeyCache.get(storeId, unitCode, passHash);
  if (!sek) {
    sek = await deriveStoreKey(storeId, unitCode, passphrase);
  }
  return executeEncryption(payload, storeId, vaultType, docId, keyId, sek);
}

/**
 * Synchronous decryption helper.
 */
export function decryptPayloadSync<T = any>(
  envelopeOrSerialized: EncryptedEnvelope | string,
  storeId: string,
  arg3: string,
  arg4: string,
  arg5?: string
): T {
  const envelope = typeof envelopeOrSerialized === 'string'
    ? parseEnvelope(envelopeOrSerialized)
    : envelopeOrSerialized;

  if (envelope.storeId !== storeId) {
    throw new Error(`Store ID mismatch in envelope: expected ${storeId}, got ${envelope.storeId}`);
  }

  let unitCode: string;
  let vaultType: string;
  let docId: string;

  if (arg5 !== undefined && typeof arg5 === 'string' && arg5.length > 0) {
    unitCode = arg3;
    vaultType = arg4;
    docId = arg5;
  } else {
    unitCode = resolveUnitCode(storeId);
    vaultType = arg3;
    docId = arg4;
  }

  const sek = deriveStoreKeySync(storeId, unitCode);
  return executeDecryption<T>(envelope, storeId, vaultType, docId, sek);
}

/**
 * Decrypts an encrypted envelope asynchronously, verifying AAD context and authentication tag.
 * Derives Store Encryption Key (SEK) via `deriveStoreKey`, ensuring Electron IPC and safeStorage integration.
 * Supports both 4-argument signature `(envelope, storeId, vaultType, docId)`
 * and 5-argument signature `(envelope, storeId, unitCode, vaultType, docId)`.
 */
export async function decryptPayload<T = any>(
  envelopeOrSerialized: EncryptedEnvelope | string,
  storeId: string,
  arg3: string,
  arg4: string,
  arg5?: string,
  passphrase?: string
): Promise<T> {
  const envelope = typeof envelopeOrSerialized === 'string'
    ? parseEnvelope(envelopeOrSerialized)
    : envelopeOrSerialized;

  if (envelope.storeId !== storeId) {
    throw new Error(`Store ID mismatch in envelope: expected ${storeId}, got ${envelope.storeId}`);
  }

  let unitCode: string;
  let vaultType: string;
  let docId: string;

  if (arg5 !== undefined && typeof arg5 === 'string' && arg5.length > 0) {
    unitCode = arg3;
    vaultType = arg4;
    docId = arg5;
  } else {
    unitCode = resolveUnitCode(storeId);
    vaultType = arg3;
    docId = arg4;
  }

  const passHash = computePassHash(passphrase);
  let sek = StoreKeyCache.get(storeId, unitCode, passHash);
  if (!sek) {
    sek = await deriveStoreKey(storeId, unitCode, passphrase);
  }
  return executeDecryption<T>(envelope, storeId, vaultType, docId, sek);
}

// Event listener for store switching to invalidate in-memory key cache
if (typeof window !== 'undefined') {
  window.addEventListener('sbx:store-switching', (event: any) => {
    const fromStoreId = event?.detail?.fromStoreId;
    if (fromStoreId) {
      StoreKeyCache.invalidateStore(fromStoreId);
    } else {
      StoreKeyCache.clear();
    }
  });
}
