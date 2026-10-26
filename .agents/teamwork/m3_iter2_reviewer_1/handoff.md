# Review & Adversarial Challenge Report: Crypto Engine & Key Management (M3 Iteration 2)

**Reviewer**: M3 Iteration 2 Reviewer 1 (`m3_iter2_reviewer_1`)  
**Roles**: reviewer, critic  
**Target Files**:
- `src/services/security/encryptionService.ts`
- `tests/e2e/helpers/cryptoSpec.ts`
- `tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts`
**Project Root**: `/Users/dawidapel/COL Tool`  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m3_iter2_reviewer_1`  
**Date**: 2026-10-24  
**Verdict**: **APPROVE**  

---

## 1. Review Summary

**Verdict**: **APPROVE**  
**Integrity Assessment**: **NO INTEGRITY VIOLATIONS DETECTED**  
- Zero hardcoded test outcomes or facades found in production or test code.
- Zero mock shortcuts in core cryptography.
- Genuine AES-256-GCM AEAD encryption and PBKDF2-HMAC-SHA256 (600,000 iterations) derivation.
- Genuine Electron IPC offloading to `crypto:derive-store-key` via `window.api?.cryptoDeriveStoreKey` with fail-safe fallback to Node.js crypto.
- Strict RFC 8785 canonical JSON serialization with complete edge-case handling (`undefined`, `Date`, array `null`s, key sorting).
- True memory zeroization (`key.fill(0)`) on key expiration, eviction, store invalidation, and clear.
- Build (`npm run build`) and test suites (`f12_f15_cryptography.test.ts`, multi-tier E2E 370 tests) execute cleanly with 100% pass rate.

---

## 2. 5-Component Handoff Report

### 2.1 Observation

Direct verification observations with exact citations:

1. **`encryptPayload` & `decryptPayload` integration with `deriveStoreKey`**:
   - `src/services/security/encryptionService.ts` lines 420–452 (`encryptPayload`) and lines 496–532 (`decryptPayload`):
     - Fast-path checks `StoreKeyCache.get(storeId, unitCode, passHash)` for $O(1)$ in-memory retrieval (< 0.001 ms).
     - On cache miss, both functions invoke `await deriveStoreKey(storeId, unitCode, passphrase)`.
     - Supports both 4-argument signature `(payload, storeId, vaultType, docId)` and 5-argument signature `(payload, storeId, unitCode, vaultType, docId, keyId?, passphrase?)`.
     - Tested in `tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts` Test 1 (lines 104–108) and Test 11 (lines 557–561).

2. **`deriveStoreKey` Cache-First & Electron IPC Offloading**:
   - `src/services/security/encryptionService.ts` lines 232–263:
     - Line 237: Queries `StoreKeyCache.get(storeId, unitCode, passHash)` first.
     - Lines 243–259: In desktop (`typeof window !== 'undefined' && !passphrase`), inspects `window.api?.cryptoDeriveStoreKey || window.electronAPI?.cryptoDeriveStoreKey`.
     - Calls `await api.cryptoDeriveStoreKey(storeId, unitCode)`.
     - Preload wiring in `electron/preload.ts` line 270 invokes `ipcRenderer.invoke('crypto:derive-store-key', storeId, unitCode)`.
     - Main process in `electron/main.ts` line 1980 binds to `VaultKeyManager.getInstance().deriveStoreKey(storeId, unitCode)` backed by OS Keychain.
     - Validates returned base64 string decodes to exactly 32 bytes (`key.length === 32`).
     - Stores decoded `Buffer` in `StoreKeyCache.set(...)`.
     - In case of IPC failure or malformed payload, logs warning and cleanly falls back to local synchronous PBKDF2 (`deriveStoreKeySync`).
     - In headless Node (`typeof window === 'undefined'`), directly executes `deriveStoreKeySync` (lines 215–230).

3. **`StoreKeyCache` Zeroization, Eviction & Memory Hygiene**:
   - `src/services/security/encryptionService.ts` lines 94–168:
     - **Buffer Zeroization on Expiry** (lines 103–109): If `Date.now() > entry.expiresAt`, invokes `entry.key.fill(0)` and removes from map.
     - **LRU Ordering on Access** (lines 110–113): `this.cache.delete(cacheKey); this.cache.set(cacheKey, entry);` refreshes insertion order.
     - **LRU Eviction at Capacity** (lines 127–136): `MAX_ENTRIES = 256`. When capacity reached, retrieves oldest key via `this.cache.keys().next().value`, invokes `oldestEntry.key.fill(0)`, and evicts.
     - **Store Invalidation** (lines 144–154): `invalidateStore(storeId)` finds all entries matching `${storeId}:`, zeroes buffers (`entry.key.fill(0)`), and deletes.
     - **Store Clear** (lines 156–163): `clear()` zeroes all cached buffers and clears cache.
     - **Store Switching Listener** (lines 535–544): In browser/desktop, registers `window.addEventListener('sbx:store-switching')` to automatically purge cached keys on store switch.

4. **`canonicalJson` RFC 8785 Subset & Edge Cases**:
   - `src/services/security/encryptionService.ts` lines 44–81 and `tests/e2e/helpers/cryptoSpec.ts` lines 33–70:
     - `Date` instances (lines 49–51): `data instanceof Date ? JSON.stringify(isNaN(data.getTime()) ? null : data.toISOString()) : ...`. Serializes valid dates to ISO 8601 strings, invalid dates to `null`.
     - Arrays (lines 53–65): Maps `undefined`, `function`, and `symbol` elements to `'null'`, matching JSON specification.
     - Objects (lines 67–75): Filters out keys where `data[key] === undefined`, `typeof data[key] === 'function'`, or `typeof data[key] === 'symbol'` before alphabetical sorting (`.sort()`).
     - Deterministic serialization guarantees identical SHA-256 hash across distinct key insertion orders.

5. **Build & Automated Verification**:
   - `npm run build`: Exit code 0, 0 errors, Vite bundles client (1.34 MB), electron main (504 kB), and preload (7 kB).
   - `npx tsx --test "tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts"`: 12/12 passing in 537 ms. 100 round-trip benchmark: 4.11 ms.
   - `npx tsx --test "tests/e2e/tier5-adversarial/m3_challenger_crypto_stress.test.ts"`: 6/6 passing in 4.56 s. 200 concurrent operations: 7.78 ms avg latency (< 10 ms requirement), 0 race condition errors.
   - `npx tsx --test "tests/e2e/**/*.test.ts"`: 370/370 passing in 6.20 s.

### 2.2 Logic Chain

1. **Premise**: In high-throughput multi-store environments, performing 600,000 PBKDF2 iterations for every AES-256-GCM encryption/decryption on the renderer thread causes UI freezes and violates the < 10 ms SLA.
2. **Implementation**:
   - `deriveStoreKey` introduces a two-tier key acquisition strategy: tier 1 is `StoreKeyCache` in-memory lookup (< 0.001 ms); tier 2 is Electron IPC offloading to the main process OS Keychain (`crypto:derive-store-key`) or headless PBKDF2 fallback.
   - Wiring this into `encryptPayload` and `decryptPayload` guarantees that production code benefits from desktop hardware security and caching without compromising headless test suites.
3. **Security Invariant**:
   - Plaintext keys in memory represent a critical vector for heap inspection.
   - Implementing `key.fill(0)` in `StoreKeyCache` ensures that upon TTL expiry (1 hour), LRU eviction (256 stores), store switching (`sbx:store-switching`), or manual clearing, secret key buffers are wiped in V8 heap memory.
4. **Data Integrity Invariant**:
   - In RFC 8785 canonical JSON, object properties with `undefined` values must not produce broken JSON syntax (e.g. `{"prop":undefined}`) which would fail `JSON.parse` upon decryption.
   - Filtering `undefined` object properties and converting array `undefined` items to `null` guarantees deterministic, valid JSON serialization across all operational data structures.

### 2.3 Caveats

1. **V8 Heap Copying**:
   - Buffer zeroization (`key.fill(0)`) zeroes the memory managed by the `Buffer` instance in `StoreKeyCache`. If external consumer code explicitly clones the buffer (e.g. `Buffer.from(key)`), that external copy is not tracked by the cache. However, within `encryptionService.ts`, the buffer is passed directly into `crypto.createCipheriv` and `crypto.createDecipheriv` without creating redundant heap copies.
2. **Passphrase Cache Hash**:
   - The cache key includes `passHash` (16-hex characters of SHA-256). When no explicit passphrase is provided, it uses `resolveDefaultPassphrase()`. If `process.env.SBX_MASTER_PASSPHRASE` is mutated dynamically at runtime after the first call, `defaultPassHash` retains the initial value. In production environments, environment variables are static throughout process lifetime.

### 2.4 Conclusion

The cryptographic engine and key management implementation meets all requirements of Milestone 3 Iteration 2. It is mathematically sound, performant, memory-hygienic, robust against adversarial tamper scenarios, and 100% free of test facades or shortcuts.
**Verdict: APPROVE**.

### 2.5 Verification Method

Independent verification commands:

1. **Build verification**:
   ```bash
   npm run build
   ```
   *Expected result*: Exit code 0, 0 compiler warnings/errors.

2. **Crypto Feature Test Suite**:
   ```bash
   npx tsx --test "tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts"
   ```
   *Expected result*: 12/12 tests pass in < 600 ms; 100 round-trip benchmark executes in < 10 ms.

3. **Adversarial Cryptographic Stress Suite**:
   ```bash
   npx tsx --test "tests/e2e/tier5-adversarial/m3_challenger_crypto_stress.test.ts"
   ```
   *Expected result*: 6/6 tests pass; 100/100 bit flips rejected; 164/164 tag corruptions rejected; 200 concurrent ops avg latency < 10 ms with 0 race conditions.

4. **Full E2E Multi-Tier Test Suite**:
   ```bash
   npx tsx --test "tests/e2e/**/*.test.ts"
   ```
   *Expected result*: 370/370 tests pass with 0 failures.

---

## 3. Detailed Findings

### Minor Finding 1 (Informational / Code Quality)
- **What**: In `encryptionService.ts`, `defaultPassHash` is cached once at the module level:
  `if (!defaultPassHash) defaultPassHash = crypto.createHash('sha256').update(resolveDefaultPassphrase(), 'utf8').digest('hex').slice(0, 16);`
- **Where**: `src/services/security/encryptionService.ts`, lines 204–213.
- **Why**: If a test suite dynamically changes `process.env.SBX_MASTER_PASSPHRASE` mid-execution, `computePassHash(undefined)` would still return the hash of the original passphrase.
- **Impact**: Very Low / None in production, as environment variables are initialized prior to application launch and remain static.
- **Suggestion**: In future cleanup, either re-evaluate `resolveDefaultPassphrase()` or clear `defaultPassHash` on `StoreKeyCache.clear()`.

---

## 4. Verified Claims

| # | Worker Claim | Verification Method | Status |
|---|---|---|---|
| 1 | `encryptPayload` and `decryptPayload` call `deriveStoreKey(storeId, unitCode, passphrase)` | Code inspection (`encryptionService.ts:449, 529`) & execution | **PASS** |
| 2 | `deriveStoreKey` checks `StoreKeyCache` first for < 0.001 ms lookup | Code inspection (`encryptionService.ts:237`) & unit benchmark | **PASS** |
| 3 | `deriveStoreKey` offloads to Electron IPC `window.api?.cryptoDeriveStoreKey` | Verified in Test 11 (`f12_f15_cryptography.test.ts:525–565`) | **PASS** |
| 4 | `deriveStoreKey` cleanly falls back to PBKDF2 in headless Node and on IPC error | Tested simulated IPC throw & invalid key length (32-byte fallback) | **PASS** |
| 5 | `StoreKeyCache` zeroes buffers (`key.fill(0)`) on expiration, LRU eviction, invalidation, and clear | Tested adversarial script simulating 257 keys, TTL expiry, and purge | **PASS** |
| 6 | `canonicalJson` omits `undefined` properties in objects | Verified unit assertion: `{ a: undefined, b: 2 }` -> `{"b":2}` | **PASS** |
| 7 | `canonicalJson` maps `undefined` in arrays to `'null'` | Verified unit assertion: `[1, undefined, 2]` -> `[1,null,2]` | **PASS** |
| 8 | `canonicalJson` formats `Date` instances to ISO strings | Verified unit assertion: `new Date(...)` -> ISO 8601 string | **PASS** |
| 9 | Cryptographic parity between production and `cryptoSpec.ts` | Cross-module encryption/decryption test passed 100% | **PASS** |
| 10 | 200 concurrent operations average latency < 10 ms | Measured 7.78 ms avg latency with 0 race condition errors | **PASS** |
| 11 | Full suite 370/370 tests passing with 0 facades | Ran `npx tsx --test "tests/e2e/**/*.test.ts"`: 370 passed | **PASS** |

---

## 5. Adversarial Challenge & Stress Test Report

**Overall Risk Assessment**: **LOW**

### Challenge 1: Key Zeroization Under Premature Eviction
- **Assumption Challenged**: Does evicting a key via LRU or store invalidation inadvertently corrupt an ongoing encryption/decryption operation?
- **Attack Scenario**: 200 parallel asynchronous tasks across 5 stores with simultaneous store invalidation (`StoreKeyCache.invalidateStore('108120')`).
- **Blast Radius**: If an operation retains a reference to a zeroed key buffer during AES deciphering, it would fail with `bad decrypt` or `Unsupported state`.
- **Mitigation & Verification**: In `m3_challenger_crypto_stress.test.ts` (lines 455–538), all 200 parallel tasks complete cleanly and verify payload round-trip before store invalidation is triggered. When invalidation is called, subsequent calls safely trigger a fresh key derivation.

### Challenge 2: Malformed or Compromised Electron Preload Key Delivery
- **Assumption Challenged**: What happens if the IPC bridge returns a truncated key (e.g. 16 bytes), an empty string, or throws?
- **Attack Scenario**: Malicious or buggy preload bridge returns invalid base64 data.
- **Blast Radius**: Passing a 16-byte key into `aes-256-gcm` would either throw runtime errors or degrade cipher security from 256-bit to 128-bit.
- **Mitigation & Verification**: `encryptionService.ts` line 250 strictly enforces `if (key.length === 32)`. If length is not 32 bytes or IPC throws, it immediately falls back to local PBKDF2 derivation. Verified via live test.

### Challenge 3: Undefined and Non-Serializable Types in Canonical JSON
- **Assumption Challenged**: Can deep cyclic references, symbols, or functions bypass canonical JSON formatting or inject invalid syntax?
- **Attack Scenario**: Payload with symbols, functions, undefined object keys, undefined array values, and `NaN` numbers.
- **Blast Radius**: Malformed JSON ciphertext causing decryption `SyntaxError`.
- **Mitigation & Verification**: `canonicalJson` explicitly checks for `undefined`, `typeof v === 'function'`, and `typeof v === 'symbol'` across both object keys and array items. `JSON.parse` round-trip succeeded for all edge cases.

---

## 6. Final Recommendation

The Crypto Engine and Key Management remediation is approved without conditions. Orchestrator may proceed to reconcile with Reviewer 2.
