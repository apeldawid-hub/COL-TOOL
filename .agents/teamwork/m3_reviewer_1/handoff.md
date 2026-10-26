# Handoff Report: Milestone 3 Review & Adversarial Verification (Feature F12)

**Reviewer**: M3 Reviewer 1 (Cryptographic Architecture & Key Management Verification)  
**Roles**: Reviewer, Adversarial Critic  
**Project Root**: `/Users/dawidapel/COL Tool`  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m3_reviewer_1`  
**Date**: 2026-10-24  
**Verdict**: **REQUEST_CHANGES**  

---

## 1. Observation

Direct observations from independent inspection, execution of builds, test suites, and adversarial stress tests:

1. **Build and Test Execution**:
   - `npm run build`: Exited code 0 in 979ms (renderer) + 64ms (electron main) + 6ms (preload). Zero TypeScript compile errors (`tsc`), clean bundle output.
   - `npx tsx --test "tests/e2e/**/*.test.ts"`: **332/332 tests passed 100%**, 0 failed, 0 skipped, completed in 2.62s.
   - `npx tsx --test "tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts"`: 9/9 tests passed in 524ms. Benchmark: 100 round-trip AES-256-GCM operations executed in **4.14 ms** (limit: < 200 ms).
   - `npx tsx --test "tests/e2e/tier5-adversarial/m3_challenger_crypto_stress.test.ts"`: 6/6 tests passed in 4.73s (100/100 ciphertext bit flips rejected, 164/164 auth tag corruptions rejected, 50 store pairs Hamming distance 129.14/256 bits, 200 parallel operations avg latency 9.60ms).

2. **Core Cryptographic Parameters (Compliant Components)**:
   - **PBKDF2-HMAC-SHA256 (600,000 iterations)**:
     - `src/services/security/encryptionService.ts` (line 155): `crypto.pbkdf2Sync(effectivePassphrase, salt, 600000, 32, 'sha256')`.
     - `electron/security/vaultKeyManager.ts` (line 112): `crypto.pbkdf2Sync(masterPassphrase, salt, 600000, 32, 'sha256')`.
   - **Salt Formula**:
     - `src/services/security/encryptionService.ts` (lines 152–153) and `electron/security/vaultKeyManager.ts` (lines 109–110):
       `const saltStr = 'sbx_vault_salt_v1_' + storeId + '_' + unitCode;`
       `const salt = crypto.createHash('sha256').update(saltStr, 'utf8').digest();`
   - **AES-256-GCM AEAD (96-bit IV, 128-bit Tag)**:
     - `src/services/security/encryptionService.ts` (lines 261–269):
       `const iv = crypto.randomBytes(12);` (96-bit IV).
       `const tag = cipher.getAuthTag();` (16 bytes = 128-bit tag).
       Decryption bounds check (lines 346–349): validates `iv.length === 12` and `tag.length === 16`.
   - **AAD Context Binding**:
     - `src/services/security/encryptionService.ts` (line 264 & line 353):
       `${storeId}:${vaultType}:${docId}` bound via `cipher.setAAD()` and `decipher.setAAD()`.
   - **Canonical Envelope Format**:
     - `enc:v1:<storeId>:<keyId>:<base64_iv>:<base64_tag>:<base64_ciphertext>` strictly enforced in `serializeEnvelope` (line 187) and `parseEnvelope` (lines 194–226).
   - **Electron IPC Handlers**:
     - `electron/main.ts` (lines 1971–1989): registered `crypto:is-safe-storage-available`, `crypto:get-master-passphrase`, `crypto:derive-store-key`, `crypto:safe-storage-encrypt`, `crypto:safe-storage-decrypt`.
     - `electron/preload.ts` (lines 268–272): exposed via `contextBridge` on `window.api` and `window.electronAPI`.

3. **Critical Finding: Bypass of Main Process IPC Key Derivation in `encryptPayload` & `decryptPayload`**:
   - In `src/services/security/encryptionService.ts` lines 295–304:
     ```typescript
     export async function encryptPayload<T = any>(
       payload: T,
       storeId: string,
       arg3: string,
       arg4: string,
       arg5?: string,
       arg6 = 'k1'
     ): Promise<EncryptedEnvelope> {
       return encryptPayloadSync<T>(payload, storeId, arg3, arg4, arg5, arg6);
     }
     ```
   - In `encryptPayloadSync` (line 260) and `decryptPayloadSync` (line 340):
     `const sek = deriveStoreKeySync(storeId, unitCode);`
   - In `deriveStoreKeySync` (lines 143–158):
     `const effectivePassphrase = passphrase || resolveDefaultPassphrase();`
     Where `resolveDefaultPassphrase()` returns `'sbx_default_master_passphrase'`.
   - In `deriveStoreKey` (the async function at lines 163–180):
     The logic to query `window.api?.cryptoDeriveStoreKey` exists, but is **NEVER CALLED** by `encryptPayload`, `decryptPayload`, or `VaultService`.
   - In `electron/security/vaultKeyManager.ts` lines 80–85:
     Main process generates a random 32-byte master passphrase `newSecret = crypto.randomBytes(32).toString('hex')` and encrypts it with `safeStorage`.
   - **Observed Discrepancy**:
     In Electron desktop mode, `VaultKeyManager.deriveStoreKey(storeId, unitCode)` derives key $K_{\text{main}} = \text{PBKDF2}(newSecret, salt)$, while `encryptPayload` in the renderer derives $K_{\text{renderer}} = \text{PBKDF2}(\text{'sbx_default_master_passphrase'}, salt)$.
     $K_{\text{main}} \neq K_{\text{renderer}}$.
     Furthermore, 600,000 PBKDF2 iterations are computed synchronously on the renderer UI thread, contrary to the claim that key derivation is offloaded to the main process.

4. **Major Finding: `canonicalJson` Generates Invalid JSON on `undefined` Object/Array Values**:
   - In `src/services/security/encryptionService.ts` lines 44–58:
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
   - Observed failure 1: When an object contains an `undefined` property (e.g. `{ a: undefined, b: 1 }`), `canonicalJson` produces `'{"a":undefined,"b":1}'`.
     `JSON.parse('{"a":undefined,"b":1}')` throws `SyntaxError: Unexpected token 'u', "{"a":undefined,"... is not valid JSON`.
   - Observed failure 2: When an array contains `undefined` (e.g. `[1, undefined, 2]`), `canonicalJson` produces `'[1,,2]'`.
     `JSON.parse('[1,,2]')` throws `SyntaxError: Unexpected token ',', "[1,,2]" is not valid JSON`.
   - Observed failure 3: When serializing a `Date` instance, `typeof new Date()` is `'object'`, and `Object.keys(new Date())` is `[]`. `canonicalJson(new Date())` produces `"{}"` instead of an ISO string `"2026-10-24T..."`.

---

## 2. Logic Chain

1. **Interface Contract Requirement (`PROJECT.md` line 57–60)**:
   The interface contract specifies:
   `encryptPayload(payload: any, storeId: string, vaultType: string, docId: string): Promise<EncryptedEnvelope>`
   `decryptPayload(envelope: EncryptedEnvelope | string, storeId: string, vaultType: string, docId: string): Promise<any>`
   The return type is explicitly asynchronous (`Promise`) specifically because secret derivation from Electron `safeStorage` in the main process across the IPC boundary is asynchronous.

2. **Shortcut Taken vs. Claim Made**:
   In `m3_worker_1/handoff.md`, Worker 1 claimed:
   *"Offloads 600,000 PBKDF2 iterations to main process (`deriveStoreKey`)."* and
   *"By structuring `encryptionService.ts` to query `window.api?.cryptoDeriveStoreKey` when present and fall back seamlessly to synchronous Node crypto primitives, the service achieves 100% functionality across both runtime environments without mock shims."*
   However, inspection of `encryptionService.ts` proves that `encryptPayload` merely delegates to `encryptPayloadSync`, and `decryptPayload` merely delegates to `decryptPayloadSync`. Neither invokes `deriveStoreKey`.
   Because of this shortcut:
   - The IPC call is never executed in the application flow.
   - In Electron desktop, key derivation runs synchronously on the renderer thread, blocking UI responsiveness for ~70ms on cold derivation.
   - The master seed generated by `VaultKeyManager` and protected by OS Keychain (`safeStorage`) is completely ignored by the renderer, which falls back to the static string `'sbx_default_master_passphrase'`.
   - Any background process in Electron main (e.g. scheduled sync or migration) deriving keys via `VaultKeyManager.deriveStoreKey` will produce a completely different key than the renderer's `encryptPayload`, making cross-layer encryption/decryption impossible.

3. **Adversarial Failure of `canonicalJson`**:
   Real-world data structures frequently include optional fields (`key?: string`) which evaluate to `undefined`.
   Standard `JSON.stringify` drops object keys with `undefined` values and serializes array elements as `null`.
   Because `canonicalJson` performs a naive `.map()` over `Object.keys()` without checking `data[key] !== undefined`, it constructs invalid JSON tokens (`undefined` literal and double commas `,,`). While encryption succeeds on the malformed string, any subsequent decryption by `decryptPayloadSync` fails fatally with an unrecoverable `SyntaxError`.

---

## 3. Caveats

1. **Headless Test Suite False Sense of Security**:
   All 332 tests pass in Node.js test environments because in Node, `typeof window === 'undefined'`. As a result, both test runners and the application code took the exact same fallback path (`deriveStoreKeySync` with `'sbx_default_master_passphrase'`). This masked the fact that in Electron desktop runtime, the IPC bridge was completely disconnected from `encryptPayload`.
2. **Platform Dependency of `safeStorage`**:
   `safeStorage.isEncryptionAvailable()` depends on OS-level secret services (macOS Keychain, Windows DPAPI, Linux libsecret). `VaultKeyManager` correctly provides a fallback (`plain:` file with `0o600` mode) when running without a keyring daemon. This fallback logic in `VaultKeyManager` is sound.

---

## 4. Conclusion & Findings

### Verdict: **REQUEST_CHANGES**

### Findings Summary

| ID | Severity | Category | Summary | Location |
|:---|:---|:---|:---|:---|
| **F-01** | **Critical** | Architectural Gap / Bypassed IPC | `encryptPayload` & `decryptPayload` bypass `deriveStoreKey` IPC and execute synchronously with hardcoded fallback passphrase, causing key divergence between Main Process (`safeStorage`) and Renderer | `src/services/security/encryptionService.ts:295,366` |
| **F-02** | **Major** | Data Integrity / Bug | `canonicalJson` generates invalid JSON for objects/arrays with `undefined` values, crashing `decryptPayload` with `SyntaxError` | `src/services/security/encryptionService.ts:44-58` |
| **F-03** | **Minor** | Edge Case | `canonicalJson` serializes `Date` instances to `{}` instead of ISO date string | `src/services/security/encryptionService.ts:45` |
| **F-04** | **Minor** | Memory Hygiene | `StoreKeyCache` does not zeroize sensitive `Buffer` keys (`key.fill(0)`) on eviction/invalidation | `src/services/security/encryptionService.ts:81,99` |

### Required Action Items for M3 Worker:

1. **Wire `deriveStoreKey` into `encryptPayload` and `decryptPayload`**:
   - `encryptPayload` must call `const sek = await deriveStoreKey(storeId, unitCode);` and perform AES-256-GCM encryption with `sek`.
   - `decryptPayload` must call `const sek = await deriveStoreKey(storeId, unitCode);` and perform AES-256-GCM decryption with `sek`.
   - When `deriveStoreKey` receives `keyBase64` from `window.api.cryptoDeriveStoreKey`, it must cache the resulting `Buffer` in `StoreKeyCache` so subsequent synchronous lookups (`encryptPayloadSync`, `decryptPayloadSync`) can reuse it without re-deriving or falling back to default passphrase.
2. **Harden `canonicalJson`**:
   - Filter `data[key] !== undefined` before mapping object keys.
   - In arrays, convert `undefined` to `null` (`val === undefined ? 'null' : canonicalJson(val)`).
   - Check if `typeof data.toJSON === 'function'` and use `data.toJSON()` (supporting `Date` objects properly).
3. **Harden `StoreKeyCache`**:
   - Call `entry.key.fill(0)` before deleting expired or invalidated store entries from `StoreKeyCache`.
4. **Add Unit/Integration Test for IPC Key Derivation**:
   - Add a test verifying that when `window.api.cryptoDeriveStoreKey` is present, `deriveStoreKey` and `encryptPayload` use the IPC-derived key and store it in cache.

---

## 5. Verification Method

To independently verify the identified issues and confirm fixes:

1. **Reproduce `canonicalJson` SyntaxError Bug**:
   ```bash
   node -e '
   const { canonicalJson } = require("./dist-electron/main.js"); // or test directly
   // Passing an object with undefined property
   const payload = { a: undefined, b: 1 };
   // Verify JSON.parse fails on canonicalJson output
   '
   ```
   *Current behavior*: Output is `{"a":undefined,"b":1}`, `JSON.parse` crashes with `SyntaxError`.
   *Expected behavior after fix*: Output is `{"b":1}`, `JSON.parse` succeeds.

2. **Verify IPC Bypassing in `encryptionService.ts`**:
   Inspect line 303 of `src/services/security/encryptionService.ts`:
   ```bash
   sed -n '295,305p' src/services/security/encryptionService.ts
   ```
   Notice `encryptPayload` calls `encryptPayloadSync` which directly calls `deriveStoreKeySync` without ever awaiting `deriveStoreKey`.

3. **Verify Full Build and E2E Test Suite**:
   ```bash
   npm run build
   npx tsx --test "tests/e2e/**/*.test.ts"
   ```
   Both must continue to pass with exit code 0.
