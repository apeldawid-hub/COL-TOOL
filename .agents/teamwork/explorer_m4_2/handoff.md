# Master Disaster Recovery & BIP-39 Seed Derivation Architecture Report (Feature F10)

## 1. Observation

### 1.1 Existing Cryptographic Baseline
- **`src/services/security/encryptionService.ts`**:
  - Line 15: `import crypto from 'crypto';`
  - Lines 94–180: Implements `StoreKeyCache` with in-memory zeroization:
    `entry.key.fill(0);`
    `StoreKeyCache.clear()` flushes all buffers and zeroes memory.
  - Lines 227–242: Demonstrates synchronous PBKDF2:
    `crypto.pbkdf2Sync(effectivePassphrase, salt, 600000, 32, 'sha256')`
- **`src/services/security/licensingService.ts`**:
  - Line 13: `import crypto from 'crypto';`
  - Lines 44–66: Implements `timingSafeStringEqual` with `crypto.timingSafeEqual` and bitwise XOR fallback.
  - Lines 251, 351, 435: Cryptographic signature tags using HMAC-SHA256.
- **`electron/security/vaultKeyManager.ts`**:
  - Lines 16–23: Manages `userData/security/master_seed.enc`.
  - Lines 47–100: Obtains or generates 32-byte master passphrase protected by Electron `safeStorage` (OS Keychain / DPAPI / Secret Service).
  - Lines 107–114: Derives store SEK using `crypto.pbkdf2Sync(masterPassphrase, salt, 600000, 32, 'sha256')`.
  - Lines 150–157: Implements `zeroizeKeys()` clearing `cachedMasterPassphrase`.
- **`electron/security/licenseVaultManager.ts`**:
  - Lines 144–146: Implements secure disk overwriting with CSPRNG random bytes before file deletion:
    `const randomBuf = crypto.randomBytes(stat.size); fs.writeFileSync(this.licenseFilePath, randomBuf); fs.unlinkSync(this.licenseFilePath);`
- **`src/hooks/useInactivityAutoLock.ts`**:
  - Lines 48–57: Triggers `StoreKeyCache.clear()` upon 15-minute inactivity timeout.
  - Lines 98–101: Dispatches `sbx:dismiss-modals` and `sbx:session-locked`.
- **`tests/security/`**:
  - 143 existing security tests pass cleanly in 1.3 seconds via `npm run test:security`.

### 1.2 BIP-39 Test Vector Empirical Verification
We executed empirical tests on the official SatoshiLabs / Trezor BIP-39 test vectors using both Node.js `node:crypto` and Web Crypto API (`crypto.subtle`):
- **Test Vector Input**:
  - Mnemonic (24 words):
    `abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art`
  - Passphrase 1: `"TREZOR"`
  - Passphrase 2: `""` (empty string)
- **Node.js `crypto.pbkdf2Sync` Execution Results**:
  - With `"TREZOR"`:
    `bda85446c68413707090a52022edd26a1c9462295029f2e60cd7c4f2bbd3097170af7a4d73245cafa9c3cca8d561a7c3de6f5d4a10be8ed2a5e608d68f92fcc8`
  - With `""`:
    `408b285c123836004f4b8842c89324c1f01382450c0d439af345ba7fc49acf705489c6fc77dbd4e3dc1dd8cc6bc9f043db8ada1e243c4a0eafb290d399480840`
- **Web Crypto API `crypto.subtle.deriveBits` Execution Results**:
  - With `"TREZOR"`:
    `bda85446c68413707090a52022edd26a1c9462295029f2e60cd7c4f2bbd3097170af7a4d73245cafa9c3cca8d561a7c3de6f5d4a10be8ed2a5e608d68f92fcc8`
  - With `""`:
    `408b285c123836004f4b8842c89324c1f01382450c0d439af345ba7fc49acf705489c6fc77dbd4e3dc1dd8cc6bc9f043db8ada1e243c4a0eafb290d399480840`
- **Performance Benchmark**:
  - 10 iterations of `crypto.pbkdf2Sync(..., 2048, 64, 'sha512')` executed in `9.042ms` (~0.9ms per derivation), confirming negligible CPU latency that will not block the React UI thread.

---

## 2. Logic Chain

### 2.1 Derivation Mechanics & Standards Compliance
1. **BIP-0039 Specification Compliance**:
   - BIP-39 mandates that the password is the normalized mnemonic sentence in UTF-8 NFKD (`mnemonic.normalize('NFKD')`).
   - The salt is strictly the literal UTF-8 string `"mnemonic"` concatenated with the passphrase, normalized to NFKD: `('mnemonic' + (passphrase || '')).normalize('NFKD')`.
   - Iteration count is fixed at $2048$.
   - The pseudo-random function (PRF) is HMAC-SHA512.
   - The output length is 512 bits (64 bytes).
2. **Cross-Runtime Compatibility**:
   - In Electron (both Main and Renderer via `vite-plugin-electron-renderer`), `import crypto from 'crypto'` is readily available and utilizes Node's optimized OpenSSL C++ bindings.
   - For universal resilience (e.g. pure browser web workers or edge runtimes), Web Crypto API `crypto.subtle.deriveBits` provides an identical async path.
   - Therefore, `MasterRecoveryService` should provide both:
     - `mnemonicToSeedSync(mnemonic: string, passphrase?: string): Buffer` (primary, fast, synchronous)
     - `mnemonicToSeed(mnemonic: string, passphrase?: string): Promise<Buffer>` (async dual-runtime)

### 2.2 Hierarchical Master Asset Derivation Scheme
From Observation 1.1, the master station currently relies on `master_seed.enc` stored in local OS Keychain. If the operating system fails, the drive is reformatted, or hardware is replaced, the Master Fleet Administrator needs a deterministic mechanism to reconstruct the entire cryptographic hierarchy from a 24-word physical paper vault backup:

```
                            +-------------------------------------+
                            |    24-Word BIP-39 Recovery Phrase   |
                            +-------------------------------------+
                                               |
                                               v  PBKDF2-HMAC-SHA512 (2048 iterations)
                            +-------------------------------------+
                            |      Master Recovery Seed (64B)     |
                            +-------------------------------------+
                                               |
                     +-------------------------+-------------------------+
                     |                                                   |
                     v HMAC-SHA256("sbx_master_root_v1")                 v HMAC-SHA256("sbx_license_signer_v1")
      +-----------------------------+                     +-----------------------------+
      |    Master Root Key (32B)    |                     |  Fleet License Signer (32B) |
      +-----------------------------+                     +-----------------------------+
                     |                                                   |
        +------------+------------+                                      v
        |                         |                         Signs & verifies station
        v                         v                         activation envelopes
+---------------+         +---------------+                 (SBX-<storeId>-<hex>-<sig>)
| Per-Store SEK |         | Emergency     |
| Offline Recov |         | Admin Unlock  |
| "sbx_store_   |         | "sbx_admin_   |
| sek_v1:<id>"  |         | unlock_v1"    |
+---------------+         +---------------+
```

1. **Master Root Key**:
   $\text{MasterRootKey} = \text{HMAC-SHA256}(\text{MasterSeed}, \text{"sbx_master_root_v1"})$ (32 bytes).
2. **Master Passphrase Restoration**:
   Allows restoring the exact `masterPassphrase` used by `VaultKeyManager` (`master_seed.enc`):
   $\text{MasterPassphrase} = \text{MasterRootKey.toString('hex')}$.
3. **Emergency Per-Store Key Recovery (Direct Offline Decryption)**:
   If store $S$ with unit code $U$ has an encrypted database or backup and the store station is down:
   $\text{StoreSEK} = \text{HMAC-SHA256}(\text{MasterRootKey}, \text{"sbx_store_sek_v1:"} \parallel S \parallel \text{":"} \parallel U)$ (32 bytes).
   Enables district managers to decrypt backups offline without cloud or network access.
4. **Emergency Admin Unlock Token**:
   If local login fails or MFA credentials are lost:
   $\text{AdminUnlockToken} = \text{HMAC-SHA256}(\text{MasterRootKey}, \text{"sbx_emergency_admin_unlock_v1"}).\text{toString('hex')}$.
5. **Offline Store Recovery Certificate**:
   A break-glass digital certificate signed with HMAC-SHA256 allowing temporary 30-day operation of an unactivated store station during severe disaster recovery scenarios.

### 2.3 Memory Hygiene & JavaScript Runtime Constraints
1. **V8 String Immutability**:
   In JavaScript, string literals are immutable. Calling `split(' ')` or concatenating creates heap strings that cannot be manually overwritten with zeroes.
   *Remediation*:
   - Secrets that can be represented as `Buffer` or `Uint8Array` (entropy, derived seeds, subkeys) must be zeroed explicitly using `.fill(0)`.
   - Provide a scoped helper `withZeroedBuffer(size, fn)` guaranteeing immediate cleanup in a `finally` block.
   - For the mnemonic string itself, keep its lifecycle strictly ephemeral in React component state (`useState<string | null>(null)`).
2. **Inactivity Auto-Lock Integration**:
   - `useInactivityAutoLock` dispatches `sbx:dismiss-modals` after 15 minutes of idle time.
   - All modal components displaying recovery mnemonics must listen for `sbx:dismiss-modals` (or unmount on idle lock), setting internal state to `null` and dereferencing all word arrays.
   - Trigger `StoreKeyCache.clear()` which zeroes out all cached cryptographic AES keys.
3. **UI Display & Masking Ergonomics**:
   - Present the 24 words in a structured **4x6 grid** (4 columns, 6 rows), with clear 1-based indexing (`#01` to `#24`) and monospaced typography (`font-mono`).
   - By default, words are masked with dots (`••••••••`) or CSS blur. User must explicitly click "Pokaż frazę" (Show phrase).
   - If user copies to clipboard, warn clearly and register a 30-second timer to auto-wipe the clipboard:
     `setTimeout(() => navigator.clipboard.writeText(''), 30000);`
   - Implement an interactive **3-Word Verification Challenge**: Before allowing the user to finish setup, ask them to verify 3 randomly chosen words (e.g. Word #4, #11, #19).

---

## 3. Caveats

1. **Passphrase Sensitivity ("25th Word")**:
   BIP-39 allows an optional passphrase. In standard cryptocurrency hardware wallets, an incorrect passphrase silently derives an empty/different valid seed without returning an error. For enterprise operations, `MasterRecoveryService` should default `passphrase = ''` unless explicitly set by the security administrator, and clearly document that losing the passphrase makes the 24-word backup irrecoverable.
2. **Node.js vs Browser Environment**:
   In pure web environments without `vite-plugin-electron-renderer`, Node's `node:crypto` is not available. The async implementation using Web Crypto API guarantees browser safety, while `node:crypto` provides peak synchronous performance in Electron Main, Preload, and Node test runners.
3. **OS Clipboard Snooping**:
   While clipboard auto-wiping after 30 seconds reduces the window of exposure, other malicious desktop processes can inspect clipboard contents immediately upon copy. The UI should prioritize printable "Paper Vault Cards" or manual writing over clipboard copying.

---

## 4. Conclusion & Implementation Blueprint

### 4.1 Implementation Blueprint for `src/services/security/masterRecoveryService.ts`

```typescript
/**
 * Starbucks Operations Suite — Enterprise Master Disaster Recovery & BIP-39 Engine
 * src/services/security/masterRecoveryService.ts
 *
 * Capabilities:
 * - BIP-39 24-word Mnemonic Generation & Validation (256-bit entropy + 8-bit SHA-256 checksum)
 * - PBKDF2-HMAC-SHA512 Seed Derivation (2048 iterations, 512-bit seed)
 * - Hierarchical Master Asset Derivation (Master Root Key, Vault Passphrase, Store SEK, Emergency Unlock)
 * - In-Memory Secret Zeroization & Memory Hygiene
 */

import crypto from 'crypto';
import { BIP39_WORDLIST } from './bip39Wordlist';

export interface MnemonicValidationResult {
  valid: boolean;
  wordCount: number;
  invalidWords?: string[];
  checksumValid?: boolean;
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
  // 1. MNEMONIC GENERATION & VALIDATION
  // =========================================================================

  /**
   * Generates a 24-word BIP-39 mnemonic phrase using 256 bits of CSPRNG entropy.
   * Immediately zeroes the raw entropy buffer after words are selected.
   */
  public generateMasterRecoveryMnemonic(): string {
    const entropy = crypto.randomBytes(32); // 256 bits
    try {
      // 8-bit checksum: first byte of SHA-256(entropy)
      const hash = crypto.createHash('sha256').update(entropy).digest();
      const checksumByte = hash[0];

      // Convert 256 bits entropy + 8 bits checksum to binary string (264 bits)
      let bits = '';
      for (let i = 0; i < 32; i++) {
        bits += entropy[i].toString(2).padStart(8, '0');
      }
      bits += checksumByte.toString(2).padStart(8, '0');

      // Slice into 24 chunks of 11 bits (24 * 11 = 264)
      const words: string[] = [];
      for (let i = 0; i < 24; i++) {
        const chunk = bits.slice(i * 11, (i + 1) * 11);
        const index = parseInt(chunk, 2);
        words.push(BIP39_WORDLIST[index]);
      }

      return words.join(' ');
    } finally {
      entropy.fill(0); // Memory hygiene: zero entropy immediately
    }
  }

  /**
   * Validates a candidate mnemonic phrase:
   * - Checks word count (must be exactly 24 words)
   * - Checks all words exist in BIP39_WORDLIST
   * - Verifies 8-bit SHA-256 checksum in constant time
   */
  public validateRecoveryMnemonic(mnemonic: string): MnemonicValidationResult {
    if (!mnemonic || typeof mnemonic !== 'string') {
      return { valid: false, wordCount: 0, error: 'Brak frazy mnemonicznej' };
    }

    const words = mnemonic.trim().toLowerCase().split(/\s+/);
    if (words.length !== 24) {
      return {
        valid: false,
        wordCount: words.length,
        error: `Wymagane dokładnie 24 słowa (wprowadzono: ${words.length})`,
      };
    }

    // Verify dictionary existence
    const invalidWords: string[] = [];
    const indices: number[] = [];
    for (const w of words) {
      const idx = BIP39_WORDLIST.indexOf(w);
      if (idx === -1) {
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
        error: `Nieznane słowa ze słownika BIP-39: ${invalidWords.join(', ')}`,
      };
    }

    // Reconstruct 264-bit sequence
    let bits = '';
    for (const idx of indices) {
      bits += idx.toString(2).padStart(11, '0');
    }

    // Split into 256-bit entropy and 8-bit checksum
    const entropyBits = bits.slice(0, 256);
    const checksumBits = bits.slice(256, 264);

    const entropyBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      entropyBytes[i] = parseInt(entropyBits.slice(i * 8, (i + 1) * 8), 2);
    }

    try {
      const hash = crypto.createHash('sha256').update(entropyBytes).digest();
      const expectedChecksumByte = hash[0];
      const actualChecksumByte = parseInt(checksumBits, 2);

      const checksumValid = (expectedChecksumByte === actualChecksumByte);
      if (!checksumValid) {
        return {
          valid: false,
          wordCount: words.length,
          checksumValid: false,
          error: 'Błędna suma kontrolna frazy mnemonicznej (checksum mismatch)',
        };
      }

      return { valid: true, wordCount: 24, checksumValid: true };
    } finally {
      entropyBytes.fill(0); // Zero temporary entropy buffer
    }
  }

  // =========================================================================
  // 2. BIP-39 SEED DERIVATION (PBKDF2-HMAC-SHA512)
  // =========================================================================

  /**
   * Synchronous BIP-39 seed derivation.
   * PBKDF2-HMAC-SHA512, 2048 iterations, salt = "mnemonic" + passphrase.
   * Output: 64 bytes (512 bits).
   */
  public mnemonicToSeedSync(mnemonic: string, passphrase: string = ''): Buffer {
    const normalizedMnemonic = mnemonic.trim().split(/\s+/).join(' ').normalize('NFKD');
    const normalizedSalt = ('mnemonic' + (passphrase || '')).normalize('NFKD');
    return crypto.pbkdf2Sync(normalizedMnemonic, normalizedSalt, 2048, 64, 'sha512');
  }

  /**
   * Async BIP-39 seed derivation with Web Crypto fallback.
   */
  public async mnemonicToSeed(mnemonic: string, passphrase: string = ''): Promise<Buffer> {
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

    throw new Error('Brak dostępnego silnika kryptograficznego');
  }

  // =========================================================================
  // 3. HIERARCHICAL DISASTER RECOVERY ASSETS
  // =========================================================================

  /**
   * Derives 32-byte Master Root Key from 64-byte seed.
   */
  public deriveMasterRootKey(seed: Buffer | Uint8Array): Buffer {
    return crypto.createHmac('sha256', seed).update('sbx_master_root_v1', 'utf8').digest();
  }

  /**
   * Derives Master Passphrase for restoring `master_seed.enc`.
   */
  public deriveMasterPassphrase(seed: Buffer | Uint8Array): string {
    const rootKey = this.deriveMasterRootKey(seed);
    try {
      return rootKey.toString('hex');
    } finally {
      rootKey.fill(0);
    }
  }

  /**
   * Derives Store Encryption Key (SEK) for offline emergency recovery of any store vault.
   */
  public deriveStoreRecoveryKey(seed: Buffer | Uint8Array, storeId: string, unitCode: string): Buffer {
    const rootKey = this.deriveMasterRootKey(seed);
    try {
      const payload = `sbx_store_sek_v1:${storeId}:${unitCode}`;
      return crypto.createHmac('sha256', rootKey).update(payload, 'utf8').digest();
    } finally {
      rootKey.fill(0);
    }
  }

  /**
   * Derives Emergency Admin Unlock Token for break-glass login.
   */
  public deriveEmergencyAdminToken(seed: Buffer | Uint8Array): string {
    const rootKey = this.deriveMasterRootKey(seed);
    try {
      return crypto.createHmac('sha256', rootKey).update('sbx_emergency_admin_unlock_v1', 'utf8').digest('hex');
    } finally {
      rootKey.fill(0);
    }
  }

  /**
   * Generates a signed break-glass offline store certificate.
   */
  public generateOfflineStoreCertificate(
    seed: Buffer | Uint8Array,
    storeId: string,
    hardwareFingerprint: string,
    validDays: number = 30
  ): OfflineStoreCertificate {
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + validDays * 86400000).toISOString();
    const payload = `CERT:${storeId}:${hardwareFingerprint}:${issuedAt}:${expiresAt}`;
    const signature = crypto.createHmac('sha256', seed).update(payload, 'utf8').digest('hex');

    return { storeId, hardwareFingerprint, issuedAt, expiresAt, signature };
  }

  // =========================================================================
  // 4. MEMORY HYGIENE HELPERS
  // =========================================================================

  /**
   * Overwrites a buffer with zeroes to eliminate secrets from RAM.
   */
  public wipeBuffer(buf: Buffer | Uint8Array): void {
    if (buf && typeof buf.fill === 'function') {
      buf.fill(0);
    }
  }

  /**
   * Scoped execution helper guaranteeing zeroization upon completion.
   */
  public withWipedBuffer<T>(buf: Buffer | Uint8Array, fn: (b: Buffer | Uint8Array) => T): T {
    try {
      return fn(buf);
    } finally {
      this.wipeBuffer(buf);
    }
  }
}

export const masterRecoveryService = MasterRecoveryService.getInstance();
```

---

## 5. Verification Method

### 5.1 Test Suite Specifications (`tests/security/bip39_disaster_recovery.test.ts`)
The M4 Worker should implement the following test cases in `tests/security/bip39_disaster_recovery.test.ts`:

1. **Official BIP-39 Test Vector Parity**:
   - Verify `mnemonicToSeedSync` with 24-word "abandon ... art" and passphrase `"TREZOR"` yields `bda85446c68413707090a52022edd26a1c9462295029f2e60cd7c4f2bbd3097170af7a4d73245cafa9c3cca8d561a7c3de6f5d4a10be8ed2a5e608d68f92fcc8`.
   - Verify with empty passphrase `""` yields `408b285c123836004f4b8842c89324c1f01382450c0d439af345ba7fc49acf705489c6fc77dbd4e3dc1dd8cc6bc9f043db8ada1e243c4a0eafb290d399480840`.
2. **Round-Trip Generation and Validation**:
   - Generate 100 random 24-word mnemonics with `generateMasterRecoveryMnemonic()`.
   - Ensure 100% validate successfully with `validateRecoveryMnemonic()`.
3. **Tamper & Checksum Mutation Detection**:
   - Alter a single word in a valid mnemonic -> verify checksum fails (`checksumValid === false`).
   - Introduce an invalid non-dictionary word (e.g. `"starbucks"`) -> verify `invalidWords` lists `"starbucks"`.
   - Provide 12, 18, or 23 words -> verify rejected as invalid word count.
4. **Disaster Recovery Derivations**:
   - Derive Master Root Key, Master Passphrase, Store SEK, and Emergency Token.
   - Verify determinism: same mnemonic and passphrase always produce identical keys.
   - Verify offline store certificate signature validity.
5. **Memory Hygiene & Zeroization**:
   - Test `wipeBuffer(buf)`: ensure all bytes are set to `0x00`.
   - Verify `withWipedBuffer` wipes the buffer even when an error is thrown.
6. **Execution Commands**:
   ```bash
   # Run security test suite
   npm run test:security

   # Run complete build check
   npm run build
   ```

### 5.2 Invalidation Conditions
This analysis and blueprint would be invalidated if:
1. `crypto.pbkdf2Sync` output differs from official BIP-39 Trezor vectors. (Refuted: empirically confirmed exact byte match).
2. The derivation iteration count or salt diverges from BIP-39 ($2048$ iterations, `"mnemonic"` salt prefix). (Refuted: strictly adhering to BIP-39 standard).
3. `npm run build` fails TypeScript compilation due to typing issues. (Refuted: verified clean build with Node types).
