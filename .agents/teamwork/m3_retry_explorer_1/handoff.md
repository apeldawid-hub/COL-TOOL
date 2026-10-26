# Handoff Report: Milestone 3 Retry Explorer 1 — Crypto Engine & Key Derivation (Defect Area 1)

**Agent**: M3 Retry Explorer 1 (`m3_retry_explorer_1`)  
**Mission**: Investigate and design a production-grade, zero-defect code fix for Defect Area 1 from Milestone 3 Gate Iteration 1.  
**Project Root**: `/Users/dawidapel/COL Tool`  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m3_retry_explorer_1`  
**Date**: 2026-10-24  
**Status**: COMPLETE (Ready for Implementation by Worker)

---

## 1. Observation

Direct observations from source code inspection, IPC boundary tracing, test execution, and benchmark profiling:

### 1.1 Bypassed IPC Key Derivation in `encryptionService.ts`
- **File**: `src/services/security/encryptionService.ts` (lines 295–304 & 366–374):
  ```typescript
  295: export async function encryptPayload<T = any>(
  296:   payload: T,
  297:   storeId: string,
  298:   arg3: string,
  299:   arg4: string,
  300:   arg5?: string,
  301:   arg6 = 'k1'
  302: ): Promise<EncryptedEnvelope> {
  303:   return encryptPayloadSync<T>(payload, storeId, arg3, arg4, arg5, arg6);
  304: }
  ...
  366: export async function decryptPayload<T = any>(
  367:   envelopeOrSerialized: EncryptedEnvelope | string,
  368:   storeId: string,
  369:   arg3: string,
  370:   arg4: string,
  371:   arg5?: string
  372: ): Promise<T> {
  373:   return decryptPayloadSync<T>(envelopeOrSerialized, storeId, arg3, arg4, arg5);
  374: }
  ```
- **File**: `src/services/security/encryptionService.ts` (lines 260 & 340):
  Both `encryptPayloadSync` and `decryptPayloadSync` call:
  ```typescript
  260: const sek = deriveStoreKeySync(storeId, unitCode);
  ...
  340: const sek = deriveStoreKeySync(storeId, unitCode);
  ```
- **File**: `src/services/security/encryptionService.ts` (lines 143–158):
  `deriveStoreKeySync` resolves:
  ```typescript
  144: const effectivePassphrase = passphrase || resolveDefaultPassphrase();
  ```
  Where `resolveDefaultPassphrase()` returns `'sbx_default_master_passphrase'` (line 116).
- **File**: `src/services/security/encryptionService.ts` (lines 163–180):
  The asynchronous function `deriveStoreKey`:
  ```typescript
  163: export async function deriveStoreKey(storeId: string, unitCode: string, passphrase?: string): Promise<Buffer> {
  164:   // If running in Electron with main-process key management available
  165:   if (typeof window !== 'undefined') {
  166:     const api = (window as any).api || (window as any).electronAPI;
  167:     if (api?.cryptoDeriveStoreKey && !passphrase) {
  168:       try {
  169:         const keyBase64 = await api.cryptoDeriveStoreKey(storeId, unitCode);
  170:         if (keyBase64) {
  171:           return Buffer.from(keyBase64, 'base64');
  172:         }
  173:       } catch (err) {
  174:         console.warn('[EncryptionService] Błąd IPC cryptoDeriveStoreKey, fallback do Node crypto:', err);
  175:       }
  176:     }
  177:   }
  178: 
  179:   return deriveStoreKeySync(storeId, unitCode, passphrase);
  180: }
  ```
  **Direct Observation**: `deriveStoreKey` was **never called** by `encryptPayload`, `decryptPayload`, or `vaultService.ts`. As a result, in the Electron desktop environment:
  1. The UI renderer process derives keys synchronously via 600,000 PBKDF2 iterations using the fallback string `'sbx_default_master_passphrase'`.
  2. The high-entropy OS Keychain master secret managed by `VaultKeyManager` (`electron/security/vaultKeyManager.ts`) via Electron `safeStorage` is completely bypassed.
  3. `StoreKeyCache` was not checked first inside `deriveStoreKey`, nor was the base64 result returned from IPC cached in `StoreKeyCache`.

### 1.2 Memory Hygiene in `StoreKeyCache`
- **File**: `src/services/security/encryptionService.ts` (lines 72–107):
  ```typescript
  72: export class StoreKeyCache {
  73:   private static cache = new Map<string, { key: Buffer; expiresAt: number }>();
  ...
  81:       this.cache.delete(cacheKey);
  ...
  99:         this.cache.delete(k);
  ...
  105:     this.cache.clear();
  ```
  **Direct Observation**: When keys expire, stores are invalidated, or the cache is cleared, `Buffer` objects are dropped without zeroization (`key.fill(0)`). Furthermore, there is no maximum capacity or LRU eviction guard, allowing unbounded map growth across long-running desktop sessions.

### 1.3 `canonicalJson` SyntaxError on `undefined` and Incorrect `Date` Formatting
- **File**: `src/services/security/encryptionService.ts` (lines 44–58):
  ```typescript
  44: export function canonicalJson(data: any): string {
  45:   if (data === null || typeof data !== 'object') {
  46:     return JSON.stringify(data);
  47:   }
  48: 
  49:   if (Array.isArray(data)) {
  50:     return '[' + data.map(canonicalJson).join(',') + ']';
  51:   }
  52: 
  53:   const sortedKeys = Object.keys(data).sort();
  54:   const pairs = sortedKeys.map((key) => {
  55:     return JSON.stringify(key) + ':' + canonicalJson(data[key]);
  56:   });
  57:   return '{' + pairs.join(',') + '}';
  58: }
  ```
  **Direct Observations from Execution**:
  1. For an object `{ a: undefined, b: 1 }`:
     `Object.keys(data)` yields `['a', 'b']`. `canonicalJson(undefined)` returns `undefined`. `pairs` yields `['"a":undefined', '"b":1']`. Result: `'{"a":undefined,"b":1}'`. Calling `JSON.parse('{"a":undefined,"b":1}')` throws:
     `SyntaxError: Unexpected token 'u', "{"a":undefined,"... is not valid JSON`.
  2. For an array `[1, undefined, 2]`:
     `data.map(canonicalJson)` yields `['1', undefined, '2']`. `.join(',')` converts `undefined` to empty string `""`. Result: `'[1,,2]'`. Calling `JSON.parse('[1,,2]')` throws:
     `SyntaxError: Unexpected token ',', "[1,,2]" is not valid JSON`.
  3. For a `Date` instance `new Date('2026-03-01T00:00:00.000Z')`:
     `typeof new Date() === 'object'`. `Object.keys(new Date())` is `[]`. Result is `"{}"` instead of `"2026-03-01T00:00:00.000Z"`.
  4. Identical flawed code exists in `tests/e2e/helpers/cryptoSpec.ts` (lines 33–47).

### 1.4 IPC Channel Compatibility Verification
- **File**: `electron/main.ts` (lines 1979–1981):
  ```typescript
  ipcMain.handle('crypto:derive-store-key', async (_event, storeId: string, unitCode: string) => {
    return VaultKeyManager.getInstance().deriveStoreKey(storeId, unitCode);
  });
  ```
- **File**: `electron/preload.ts` (line 270):
  ```typescript
  cryptoDeriveStoreKey: (storeId, unitCode) => ipcRenderer.invoke('crypto:derive-store-key', storeId, unitCode),
  ```
  Exposed on both `window.api` and `window.electronAPI` (lines 275–276).
- **File**: `electron/security/vaultKeyManager.ts` (lines 107–114):
  ```typescript
  public async deriveStoreKey(storeId: string, unitCode: string): Promise<string> {
    const masterPassphrase = await this.getOrCreateMasterPassphrase();
    const saltStr = `sbx_vault_salt_v1_${storeId}_${unitCode}`;
    const salt = crypto.createHash('sha256').update(saltStr, 'utf8').digest();

    const sek = crypto.pbkdf2Sync(masterPassphrase, salt, 600000, 32, 'sha256');
    return sek.toString('base64');
  }
  ```
  **Direct Observation**: The channel name `'crypto:derive-store-key'`, parameters `(storeId: string, unitCode: string)`, and return type (base64-encoded 32-byte key string) are 100% compatible.

### 1.5 Benchmark & Performance Profiling
- Executed `npx tsx --test "tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts"`:
  - 100 round-trip AES-256-GCM operations executed in **4.17 ms** (threshold: < 200 ms).
  - Executed micro-benchmark with async/await cipher pipeline: 100 iterations took **3.32 ms**.
  - Confirms that async `encryptPayload` and `decryptPayload` with cache hits achieve < 0.05 ms per operation, far exceeding performance requirements.

---

## 2. Logic Chain

1. **Root Cause of Key Divergence (Observation 1.1)**:
   In `encryptionService.ts`, `encryptPayload` delegates directly to `encryptPayloadSync`.
   `encryptPayloadSync` invokes `deriveStoreKeySync(storeId, unitCode)`.
   Because no passphrase is passed in production calls, `deriveStoreKeySync` uses `resolveDefaultPassphrase()` (`'sbx_default_master_passphrase'`).
   Meanwhile, Electron's Main Process initializes `VaultKeyManager`, which creates an OS Keychain encrypted random 32-byte seed (`newSecret = crypto.randomBytes(32).toString('hex')`).
   Because the renderer never invokes `cryptoDeriveStoreKey` via IPC, the renderer and main process derive different keys:
   $$K_{\text{renderer}} = \text{PBKDF2}(\text{'sbx_default_master_passphrase'}, \text{salt}) \neq K_{\text{main}} = \text{PBKDF2}(K_{\text{OS Keychain}}, \text{salt})$$
   This causes key divergence and forces 600,000 PBKDF2 iterations onto the renderer main thread.

2. **Resolution Architecture for Key Derivation**:
   - `deriveStoreKey(storeId, unitCode, passphrase)` must first check `StoreKeyCache`.
   - On cache miss:
     - If running in Electron (`typeof window !== 'undefined'`) and no custom passphrase is requested (`!passphrase`), call `window.api.cryptoDeriveStoreKey(storeId, unitCode)` via IPC.
     - Decode the returned base64 string into a 32-byte `Buffer`, store it in `StoreKeyCache`, and return it.
     - If IPC is unavailable, throws an error, or if running in headless Node, fall back cleanly to `deriveStoreKeySync(storeId, unitCode, passphrase)`.
   - `encryptPayload` and `decryptPayload` must call `await deriveStoreKey(storeId, unitCode, passphrase)`.
   - Because `deriveStoreKey` caches the derived key in `StoreKeyCache`, any subsequent call to `deriveStoreKey` or `deriveStoreKeySync` hits the cache synchronously with $O(1)$ latency.

3. **Memory Hygiene & Buffer Zeroization (Observation 1.2)**:
   - Secret Encryption Keys (SEK) held in memory represent sensitive material.
   - When cache entries expire (`Date.now() > entry.expiresAt`), are evicted due to LRU capacity limits (`cache.size >= MAX_ENTRIES`), are invalidated (`invalidateStore`), or the cache is cleared (`clear()`), `entry.key.fill(0)` must be called before removal from `Map`.
   - Adding LRU eviction with `MAX_ENTRIES = 256` prevents memory leaks across long sessions.

4. **JSON Invalidation via `canonicalJson` (Observation 1.3)**:
   - Standard JSON specifications (RFC 8259) and `JSON.stringify` omit object properties whose value is `undefined`.
   - Array items with `undefined` values serialize to `null` to preserve index positions.
   - `Date` objects have a built-in `.toISOString()` representation (e.g. `"2026-03-01T00:00:00.000Z"`).
   - In `canonicalJson`:
     - If `data instanceof Date`: return `JSON.stringify(isNaN(data.getTime()) ? null : data.toISOString())`.
     - In arrays: map elements using `v === undefined || typeof v === 'function' || typeof v === 'symbol' ? 'null' : canonicalJson(v)`.
     - In objects: filter keys using `.filter(k => data[k] !== undefined && typeof data[k] !== 'function' && typeof data[k] !== 'symbol')` before `.sort()`.
   - This ensures valid RFC 8785 JSON representation, eliminating all `SyntaxError` failures upon decryption.

5. **Eliminating Code Duplication via Reusable Executors**:
   - Extracting `executeEncryption` and `executeDecryption` internal helpers encapsulates cipher initialization, AAD binding, IV generation, authentication tag verification, and JSON parsing.
   - Both sync (`encryptPayloadSync`, `decryptPayloadSync`) and async (`encryptPayload`, `decryptPayload`) share the exact same cryptographic core without duplication.

---

## 3. Caveats

1. **Headless Test Runtimes**:
   In headless test environments (such as `npx tsx --test`), `window` is `undefined`. `deriveStoreKey` immediately falls back to `deriveStoreKeySync` with PBKDF2. To thoroughly test the IPC branch, a dedicated test using a mocked `window.api.cryptoDeriveStoreKey` must be included in `f12_f15_cryptography.test.ts`.
2. **Synchronous Callers (`encryptPayloadSync`) in Electron Desktop**:
   If `encryptPayloadSync` is called on a completely cold cache in Electron desktop before `deriveStoreKey` or `encryptPayload` has run for that store, it will compute PBKDF2 locally using `resolveDefaultPassphrase()`. To avoid this, application initialization (e.g. store loading) should call `await deriveStoreKey(storeId, unitCode)` once to pre-warm `StoreKeyCache`.
3. **Invalid Dates**:
   If a `Date` object is created with invalid input (e.g. `new Date(NaN)`), `.toISOString()` throws a `RangeError`. The implementation safely checks `isNaN(data.getTime()) ? null : data.toISOString()`, returning `"null"` matching `JSON.stringify` behavior.

---

## 4. Conclusion & Precise Code Blueprint

### Verdict: **READY FOR IMPLEMENTATION**
The investigation is complete. Below are the exact, line-by-line file modifications for the implementer worker.

---

### 4.1 Target File 1: `src/services/security/encryptionService.ts`

#### Change 1: `canonicalJson` (lines 44–58)
**Before**:
```typescript
export function canonicalJson(data: any): string {
  if (data === null || typeof data !== 'object') {
    return JSON.stringify(data);
  }

  if (Array.isArray(data)) {
    return '[' + data.map(canonicalJson).join(',') + ']';
  }

  const sortedKeys = Object.keys(data).sort();
  const pairs = sortedKeys.map((key) => {
    return JSON.stringify(key) + ':' + canonicalJson(data[key]);
  });
  return '{' + pairs.join(',') + '}';
}
```

**After**:
```typescript
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
```

---

#### Change 2: `StoreKeyCache` Zeroization & LRU Eviction (lines 72–107)
**Before**:
```typescript
export class StoreKeyCache {
  private static cache = new Map<string, { key: Buffer; expiresAt: number }>();
  private static readonly TTL_MS = 60 * 60 * 1000; // 1 hour

  public static get(storeId: string, unitCode: string, passphraseHash: string): Buffer | null {
    const cacheKey = `${storeId}:${unitCode}:${passphraseHash}`;
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return null;
    }
    return entry.key;
  }

  public static set(storeId: string, unitCode: string, passphraseHash: string, key: Buffer): void {
    const cacheKey = `${storeId}:${unitCode}:${passphraseHash}`;
    this.cache.set(cacheKey, {
      key,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  public static invalidateStore(storeId: string): void {
    const prefix = `${storeId}:`;
    for (const k of this.cache.keys()) {
      if (k.startsWith(prefix)) {
        this.cache.delete(k);
      }
    }
  }

  public static clear(): void {
    this.cache.clear();
  }
}
```

**After**:
```typescript
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
```

---

#### Change 3: `deriveStoreKey` & `deriveStoreKeySync` (lines 140–180)
**Before**:
```typescript
export function deriveStoreKeySync(storeId: string, unitCode: string, passphrase?: string): Buffer {
  const effectivePassphrase = passphrase || resolveDefaultPassphrase();
  const passHash = crypto.createHash('sha256').update(effectivePassphrase, 'utf8').digest('hex').slice(0, 16);

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
  // If running in Electron with main-process key management available
  if (typeof window !== 'undefined') {
    const api = (window as any).api || (window as any).electronAPI;
    if (api?.cryptoDeriveStoreKey && !passphrase) {
      try {
        const keyBase64 = await api.cryptoDeriveStoreKey(storeId, unitCode);
        if (keyBase64) {
          return Buffer.from(keyBase64, 'base64');
        }
      } catch (err) {
        console.warn('[EncryptionService] Błąd IPC cryptoDeriveStoreKey, fallback do Node crypto:', err);
      }
    }
  }

  return deriveStoreKeySync(storeId, unitCode, passphrase);
}
```

**After**:
```typescript
function computePassHash(passphrase?: string): string {
  const effective = passphrase || resolveDefaultPassphrase();
  return crypto.createHash('sha256').update(effective, 'utf8').digest('hex').slice(0, 16);
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
```

---

#### Change 4: Reusable Cipher Executors & Async `encryptPayload` / `decryptPayload` (lines 230–374)
**After**:
```typescript
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

  const sek = await deriveStoreKey(storeId, unitCode, passphrase);
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

  const sek = await deriveStoreKey(storeId, unitCode, passphrase);
  return executeDecryption<T>(envelope, storeId, vaultType, docId, sek);
}
```

---

### 4.2 Target File 2: `tests/e2e/helpers/cryptoSpec.ts`
Update `canonicalJson` (lines 33–47) to match production implementation:
```typescript
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
```

---

### 4.3 Target File 3: `tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts`
Add explicit tests for:
1. `canonicalJson` edge cases (`undefined` properties in objects omitted, `undefined` in arrays serialized as `null`, `Date` serialized as ISO string).
2. `StoreKeyCache` buffer zeroization upon eviction and clear.
3. IPC offloading when `window.api.cryptoDeriveStoreKey` is present.

```typescript
  // Test 9: Canonical JSON edge cases (undefined omission, array null conversion, Date ISO serialization)
  await t.test('Test 9: Canonical JSON edge cases (undefined, Date, array nulls)', () => {
    // 1. Undefined property in object must be omitted
    const objWithUndef = { b: 2, a: undefined, c: 'valid' };
    const serializedObj = canonicalJson(objWithUndef);
    assert.equal(serializedObj, '{"b":2,"c":"valid"}');
    assert.deepEqual(JSON.parse(serializedObj), { b: 2, c: 'valid' });

    // 2. Undefined in array must serialize to null
    const arrWithUndef = [1, undefined, 'text', null];
    const serializedArr = canonicalJson(arrWithUndef);
    assert.equal(serializedArr, '[1,null,"text",null]');
    assert.deepEqual(JSON.parse(serializedArr), [1, null, 'text', null]);

    // 3. Date instance must serialize to ISO string
    const testDate = new Date('2026-03-01T14:30:00.000Z');
    const serializedDate = canonicalJson(testDate);
    assert.equal(serializedDate, '"2026-03-01T14:30:00.000Z"');

    // 4. Nested complex structure with mixed edge cases
    const complexStructure = {
      timestamp: testDate,
      optionalNote: undefined,
      items: [100, undefined, 200],
      nestedObj: {
        active: true,
        skipped: undefined,
      },
    };
    const serializedComplex = canonicalJson(complexStructure);
    const parsedComplex = JSON.parse(serializedComplex);
    assert.equal(parsedComplex.timestamp, '2026-03-01T14:30:00.000Z');
    assert.equal('optionalNote' in parsedComplex, false);
    assert.deepEqual(parsedComplex.items, [100, null, 200]);
    assert.deepEqual(parsedComplex.nestedObj, { active: true });
  });

  // Test 10: StoreKeyCache memory hygiene & buffer zeroization
  await t.test('Test 10: StoreKeyCache zeroization on invalidation and clear', () => {
    const testStoreId = '108198';
    const testUnitCode = '18198';
    const testPassHash = 'test_hash_01';

    const secretKeyBuf = Buffer.alloc(32, 0x42);
    StoreKeyCache.set(testStoreId, testUnitCode, testPassHash, secretKeyBuf);

    assert.equal(StoreKeyCache.get(testStoreId, testUnitCode, testPassHash)?.equals(Buffer.alloc(32, 0x42)), true);

    // Invalidate store -> buffer must be zeroized
    StoreKeyCache.invalidateStore(testStoreId);
    assert.equal(secretKeyBuf.equals(Buffer.alloc(32, 0x00)), true, 'Evicted buffer must be zero-filled');
    assert.equal(StoreKeyCache.get(testStoreId, testUnitCode, testPassHash), null);
  });

  // Test 11: Electron IPC key derivation integration & caching
  await t.test('Test 11: IPC key derivation offloading via window.api.cryptoDeriveStoreKey', async () => {
    const mockStoreId = '108199';
    const mockUnitCode = '18199';
    const mockKeyBytes = crypto.randomBytes(32);
    let ipcCalls = 0;

    // Simulate Electron renderer environment with window.api
    (globalThis as any).window = {
      api: {
        cryptoDeriveStoreKey: async (sId: string, uCode: string) => {
          ipcCalls++;
          assert.equal(sId, mockStoreId);
          assert.equal(uCode, mockUnitCode);
          return mockKeyBytes.toString('base64');
        },
      },
    };

    try {
      StoreKeyCache.invalidateStore(mockStoreId);

      // First call -> invokes IPC
      const key1 = await deriveStoreKey(mockStoreId, mockUnitCode);
      assert.equal(ipcCalls, 1, 'Cache miss must trigger IPC exactly once');
      assert.deepEqual(key1, mockKeyBytes);

      // Second call -> hits StoreKeyCache, zero additional IPC calls
      const key2 = await deriveStoreKey(mockStoreId, mockUnitCode);
      assert.equal(ipcCalls, 1, 'Subsequent call must hit StoreKeyCache');
      assert.deepEqual(key2, mockKeyBytes);

      // Async encryption and decryption round-trip using IPC key
      const payload = { encryptedSecret: 'ipc_safe_storage_value' };
      const env = await encryptPayload(payload, mockStoreId, mockUnitCode, 'vault_test', 'doc_01');
      const dec = await decryptPayload(env, mockStoreId, mockUnitCode, 'vault_test', 'doc_01');
      assert.deepEqual(dec, payload);
    } finally {
      delete (globalThis as any).window;
      StoreKeyCache.invalidateStore(mockStoreId);
    }
  });
```

---

## 5. Verification Method

To independently verify the implementation:

1. **Verify `canonicalJson` SyntaxError Bug Resolution**:
   ```bash
   node -e '
   const { canonicalJson } = require("./src/services/security/encryptionService.ts");
   const obj = { a: undefined, b: 1, date: new Date("2026-03-01T00:00:00Z"), arr: [1, undefined, 2] };
   const res = canonicalJson(obj);
   console.log("Output:", res);
   JSON.parse(res); // Must not throw
   console.log("JSON.parse verified successfully!");
   '
   ```

2. **Verify Cryptography Unit Test Suite & Benchmark**:
   ```bash
   npx tsx --test "tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts"
   ```
   **Expected Result**: All 11 tests pass in < 600ms; 100 round-trip benchmark takes < 5 ms.

3. **Verify Adversarial Fuzzing & Concurrency Stress Test**:
   ```bash
   npx tsx --test "tests/e2e/tier5-adversarial/m3_challenger_crypto_stress.test.ts"
   ```
   **Expected Result**: All 6 tests pass; 100/100 bit flips rejected, 164/164 tag corruptions rejected, 200 concurrent ops avg latency < 10ms.

4. **Verify Boundary Tests**:
   ```bash
   npx tsx --test "tests/e2e/tier2-boundary-corner/b12_crypto_algorithm_boundaries.test.ts" "tests/e2e/tier2-boundary-corner/b15_crypto_edge_boundaries.test.ts"
   ```
   **Expected Result**: All 12 tests pass.

5. **Verify Full Application Build**:
   ```bash
   npm run build
   ```
   **Expected Result**: Clean compilation with 0 TypeScript errors across renderer, electron main, and preload.
