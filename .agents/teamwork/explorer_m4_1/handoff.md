# Handoff Report — Feature F10: BIP-39 Mnemonic Generator & Checksum Validator

**Agent:** `m4_fleet_explorer_1` (Cryptography & TypeScript Explorer)  
**Milestone:** Milestone 4 (Master Hardening & Disaster Recovery)  
**Target Feature:** Feature F10 — Zero-Dependency BIP-39 24-Word Disaster Recovery Engine  
**Working Directory:** `/Users/dawidapel/COL Tool/.agents/teamwork/explorer_m4_1`  
**Date:** 2026-10-26  

---

## 1. Observation

### 1.1 Existing Codebase Cryptographic & Architectural Patterns
1. **Module & Runtime Setup**:
   - `src/services/security/licensingService.ts`:
     - Line 13: `import crypto from 'crypto';`
     - Lines 44–66: `timingSafeStringEqual(a: string, b: string): boolean` combines Node `crypto.timingSafeEqual` with a constant-time bitwise XOR accumulator fallback (`diff |= a.charCodeAt(i) ^ b.charCodeAt(i)`).
   - `src/services/security/encryptionService.ts`:
     - Line 15: `import crypto from 'crypto';`
     - Lines 85–89: `canonicalSha256(data: any): string` calculates SHA-256 via `crypto.createHash('sha256')`.
     - Lines 94–105: `StoreKeyCache` caches keys in RAM and provides `.clear()` with zeroization.
   - `electron/preload.ts`:
     - Lines 278–295: Exposes IPC methods via `window.api` / `window.electronAPI`.
   - `package.json`:
     - Lines 12–13: Scripts `"test": "node --import tsx --test \"tests/**/*.test.ts\""` and `"test:security": "node --import tsx --test \"tests/security/**/*.test.ts\""`.
     - Zero third-party BIP-39 library currently installed (`dependencies` has only `clsx`, `electron-updater`, `lucide-react`, `react`, `react-dom`, `recharts`, `sql.js`, `tailwind-merge`, `xlsx`). Adding heavy npm dependencies like `bip39` with older Node polyfills would bloat the bundle and create supply-chain risks.

### 1.2 Mathematical & Bitwise Verification of BIP-39 Specification
The BIP-0039 standard for 24 words specifies:
- **Entropy ($ENT$)**: 256 bits (32 bytes).
- **Checksum Length ($CS$)**: $CS = ENT / 32 = 256 / 32 = 8$ bits (1 byte).
- **Checksum Value**: First 8 bits (byte 0) of $\text{SHA-256}(ENT)$.
- **Combined Payload**: $ENT + CS = 256 + 8 = 264$ bits (33 bytes).
- **Word Chunk Size**: 11 bits ($2^{11} = 2,048$ possible values, matching the 2,048 words in the BIP-39 dictionary).
- **Word Count**: $264 / 11 = 24$ words.

### 1.3 Validation Against Official BIP-39 Test Vectors
We verified the mathematical bit-slicing and checksum logic directly against the official Bitcoin Core / Trezor BIP-39 reference vectors using Node.js:
1. **All-Zero 256-bit Entropy Vector**:
   - `ENT = 0000000000000000000000000000000000000000000000000000000000000000` (32 bytes of `0x00`)
   - $\text{SHA-256}(ENT)[0] = 0x66 = 01100110_2$ (decimal 102)
   - Words 0 to 22 (first 23 chunks of 11 zeros): `abandon` (index 0)
   - Word 23 (3 zeros of entropy + 8 bits of checksum $01100110_2$): decimal 102 = `art`
   - Canonical Mnemonic: `abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art`
   - Verified in Node: **100% Match**.
2. **All-Ones 256-bit Entropy Vector**:
   - `ENT = ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` (32 bytes of `0xFF`)
   - $\text{SHA-256}(ENT)[0] = 0xAF = 10101111_2$ (decimal 175)
   - Words 0 to 22 (first 23 chunks of 11 ones): `zoo` (index 2047)
   - Word 23 (3 ones of entropy + 8 bits of checksum $10101111_2$): $(7 \ll 8) | 175 = 1792 + 175 = 1967$ = `vote`
   - Canonical Mnemonic: `zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo vote`
   - Verified in Node: **100% Match**.
3. **PBKDF2-HMAC-SHA512 Seed Derivation**:
   - Mnemonic: `23 x abandon + art`
   - Salt: `"mnemonicTREZOR"` (passphrase `"TREZOR"`, 2048 iterations, 64-byte key)
   - Derived Seed: `bda85446c68413707090a52022edd26a1c9462295029f2e60cd7c4f2bbd3097170af7a4d73245cafa9c3cca8d561a7c3de6f5d4a10be8ed2a5e608d68f92fcc8`
   - Verified in Node: **100% Match**.
4. **Fuzz Testing**:
   - 1,000 randomized 256-bit round-trip cycles ($ENT \rightarrow \text{Mnemonic} \rightarrow ENT_{recovered}$) executed in Node.js with 1,000/1,000 (100%) bit-for-bit parity.

---

## 2. Logic Chain

### 2.1 Dictionary Architecture & Bundle Size Optimization (`bip39Wordlist.ts`)
1. **Canonical Wordlist**:
   The BIP-39 English dictionary contains exactly 2,048 words sorted strictly alphabetically, starting with `abandon` (index 0) and ending with `zoo` (index 2047).
2. **Size and Packaging**:
   - Stored as a single space-separated string or frozen array of string literals, the raw payload is ~11.5 KB.
   - When compiled with Vite/Rollup and gzipped, it compresses to ~3.8 KB.
   - It requires **zero external npm dependencies**, zero build-time polyfills, and zero network calls.
3. **Lookup Complexity**:
   - **Forward Lookup ($Index \rightarrow Word$)**:
     Direct array indexing `BIP39_ENGLISH_WORDLIST[index]` is strictly $O(1)$ (< 2 nanoseconds in V8).
   - **Reverse Lookup ($Word \rightarrow Index$)**:
     On module initialization, a `Map<string, number>` (`WORD_INDEX_MAP`) is constructed:
     ```typescript
     const WORD_INDEX_MAP = new Map<string, number>();
     for (let i = 0; i < BIP39_ENGLISH_WORDLIST.length; i++) {
       WORD_INDEX_MAP.set(BIP39_ENGLISH_WORDLIST[i], i);
     }
     ```
     `WORD_INDEX_MAP.get(word)` provides $O(1)$ constant-time lookup and existence checking (< 5 nanoseconds). Total heap memory for the Map is < 120 KB.

### 2.2 Mnemonic Generation Algorithm (`generateMasterRecoveryMnemonic`)
1. Generate 32 bytes (256 bits) of cryptographically secure random entropy using CSPRNG:
   `crypto.randomBytes(32)` (or `crypto.getRandomValues(new Uint8Array(32))`).
2. Compute SHA-256 of the 32-byte entropy:
   `const hash = crypto.createHash('sha256').update(entropy).digest()`.
3. Extract the first byte (`hash[0]`) as the 8-bit checksum.
4. Construct the 33-byte (264-bit) combined payload:
   `payload = new Uint8Array(33); payload.set(entropy, 0); payload[32] = hash[0];`
5. Extract twenty-four 11-bit chunks:
   For word $k \in [0..23]$, bit position $p = k \times 11$:
   Byte index $b = \lfloor p / 8 \rfloor$, bit offset $o = p \bmod 8$.
   Read 3 bytes from $payload[b..b+2]$:
   `val = (payload[b] << 16) | (payload[b+1] << 8) | payload[b+2]`
   Shift right by $(13 - o)$ and mask with $0x7FF$ ($2047$):
   $Index_k = (val \gg (13 - o)) \ \& \ 0x7FF$.
6. Map each $Index_k$ to `BIP39_ENGLISH_WORDLIST[Index_k]`, and join with a single space `' '`.

### 2.3 Mnemonic Validation & Recovery Algorithm (`validateRecoveryMnemonic`)
1. **Defensive Input Sanitization**:
   - Check `typeof mnemonic === 'string' && mnemonic.trim().length > 0`.
   - Normalize: `.trim().toLowerCase().normalize('NFKD')`.
   - Split on whitespace: `.split(/\s+/)` to gracefully absorb multiple spaces, tabs, and newlines.
2. **Word Count Validation**:
   - Enforce strictly `words.length === 24`. Any other length (0, 12, 15, 18, 23, 25 words) is rejected with `{ valid: false, error: 'Invalid mnemonic length: expected 24 words, received <count>' }`.
3. **Word Dictionary Membership**:
   - For each word $w_i$, lookup `idx = WORD_INDEX_MAP.get(w_i)`.
   - If `idx === undefined`, immediately return `{ valid: false, error: 'Invalid word at position ${i + 1}: \'${w_i}\' is not in BIP-39 dictionary' }`.
4. **Payload Reconstruction**:
   - Initialize `payload = new Uint8Array(33)`.
   - For each word $k \in [0..23]$ with index $I_k \in [0..2047]$:
     Bit position $p = k \times 11$, byte index $b = \lfloor p / 8 \rfloor$, offset $o = p \bmod 8$.
     Bitwise write $I_k$ shifted by $(13 - o)$ into `payload[b]`, `payload[b+1]`, and `payload[b+2]`.
5. **Entropy & Checksum Extraction**:
   - Extract entropy: `entropy = payload.subarray(0, 32)` (32 bytes = 256 bits).
   - Extract embedded checksum: `embeddedChecksum = payload[32]` (8 bits).
6. **Constant-Time Cryptographic Verification**:
   - Compute `hash = crypto.createHash('sha256').update(entropy).digest()`.
   - Extract `computedChecksum = hash[0]`.
   - Verify equality using constant-time comparison:
     `(embeddedChecksum ^ computedChecksum) === 0` (or `crypto.timingSafeEqual(Buffer.from([embeddedChecksum]), Buffer.from([computedChecksum]))`).
   - If mismatch: return `{ valid: false, error: 'Invalid checksum: mnemonic verification failed' }`.
   - If match: return `{ valid: true, entropy, hexEntropy: Buffer.from(entropy).toString('hex') }`.

### 2.4 Seed Derivation Algorithm (`mnemonicToSeed`)
- Input: `mnemonic: string`, optional `passphrase?: string`.
- Normalize mnemonic to NFKD.
- Salt is `"mnemonic"` + `(passphrase || '').normalize('NFKD')`.
- Derive 64-byte binary seed via `crypto.pbkdf2Sync(mnemonicNorm, salt, 2048, 64, 'sha512')`.
- Return 64-byte `Uint8Array`.

---

## 3. Caveats

1. **Cross-Environment Crypto Execution**:
   - In Node.js (test runner) and Electron Main Process, `import crypto from 'crypto'` provides synchronous `randomBytes`, `createHash('sha256')`, and `pbkdf2Sync`.
   - In the Electron Renderer process (browser context), if Node integration is isolated, `crypto.getRandomValues()` and Web Crypto `subtle.digest()` are standard. However, because `MasterRecoveryService` is intended for administrative master credential recovery, it can either run in the Electron Main process via IPC (`crypto:verify-master-credential`) or use a cross-environment adapter that transparently leverages `crypto` in Node/Electron and `globalThis.crypto` in browser.
2. **Memory Zeroization Limits in JavaScript**:
   - In V8, JavaScript strings are immutable and cannot be overwritten in RAM.
   - However, raw binary buffers (`Uint8Array` / `Buffer`) **can** and **must** be zeroized:
     Calling `entropy.fill(0)` and `payload.fill(0)` after seed derivation or validation prevents lingering entropy in the heap.
3. **Canonical Wordlist Ordering**:
   - The 2,048 words must strictly match the exact official BIP-0039 English wordlist. If any word is transposed, missing, or altered, recovery phrases generated by standard Bitcoin/Ethereum hardware wallets (or third-party tools) will fail to validate or produce incorrect entropy.
4. **Strict 24-Word Enforcement**:
   - While BIP-39 allows 12, 15, 18, 21, or 24 words, Starbucks Master Fleet HQ enterprise security standardizes exclusively on **24 words (256-bit entropy)** to guarantee high-entropy disaster recovery. The validator must strictly enforce 24 words and reject 12-word phrases with an explicit error.

---

## 4. Conclusion & Implementation Blueprint

Feature F10 should be implemented across two clean, zero-dependency modules:
1. `src/services/security/bip39Wordlist.ts`: Contains the canonical 2,048 English wordlist, frozen array export, and cached $O(1)$ reverse lookup map.
2. `src/services/security/masterRecoveryService.ts`: Contains `generateMasterRecoveryMnemonic()`, `validateRecoveryMnemonic()`, `mnemonicToEntropy()`, `entropyToMnemonic()`, and `mnemonicToSeed()`.

### 4.1 Interface Contract
```typescript
export interface MnemonicValidationResult {
  valid: boolean;
  entropy?: Uint8Array;
  hexEntropy?: string;
  error?: string;
}

export interface IMasterRecoveryService {
  generateMasterRecoveryMnemonic(): string;
  validateRecoveryMnemonic(mnemonic: string): MnemonicValidationResult;
  entropyToMnemonic(entropy: Uint8Array): string;
  mnemonicToEntropy(mnemonic: string): Uint8Array;
  mnemonicToSeed(mnemonic: string, passphrase?: string): Uint8Array;
}
```

### 4.2 Blueprint: `src/services/security/bip39Wordlist.ts`
```typescript
/**
 * Canonical BIP-39 English Wordlist (2,048 words)
 * Zero-dependency, immutable, O(1) forward and reverse lookup.
 */

// Delimited string of all 2,048 official BIP-39 English words
const RAW_BIP39_ENGLISH_WORDLIST =
  "abandon ability able about above absent absorb abstract absurd abuse " +
  "access accident account accuse achieve acid acoustic acquire across act " +
  "action actor actress actual adapt add addict address adjust admit " +
  "adult advance advice aerobic affair afford afraid again age agent " +
  "... [all 2,048 words strictly in alphabetical order] ... " +
  "zebra zero zone zoo";

export const BIP39_ENGLISH_WORDLIST: readonly string[] = Object.freeze(
  RAW_BIP39_ENGLISH_WORDLIST.trim().split(/\s+/)
);

/**
 * Precomputed O(1) reverse lookup map: word -> 11-bit index (0..2047)
 */
export const BIP39_WORD_INDEX_MAP: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  for (let i = 0; i < BIP39_ENGLISH_WORDLIST.length; i++) {
    map.set(BIP39_ENGLISH_WORDLIST[i], i);
  }
  return map;
})();
```

### 4.3 Blueprint: `src/services/security/masterRecoveryService.ts`
```typescript
import crypto from 'crypto';
import { BIP39_ENGLISH_WORDLIST, BIP39_WORD_INDEX_MAP } from './bip39Wordlist';

export interface MnemonicValidationResult {
  valid: boolean;
  entropy?: Uint8Array;
  hexEntropy?: string;
  error?: string;
}

export class MasterRecoveryService {
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

  /**
   * Generates a 24-word BIP-39 mnemonic from 256 bits of CSPRNG entropy.
   */
  public static generateMasterRecoveryMnemonic(): string {
    const entropy = this.getSecureRandomBytes(32);
    try {
      return this.entropyToMnemonic(entropy);
    } finally {
      entropy.fill(0); // In-memory zeroization
    }
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

  /**
   * Validates a 24-word mnemonic and extracts the 256-bit entropy.
   */
  public static validateRecoveryMnemonic(mnemonic: string): MnemonicValidationResult {
    if (typeof mnemonic !== 'string' || !mnemonic.trim()) {
      return { valid: false, error: 'Mnemonic phrase must be a non-empty string' };
    }

    const normalized = mnemonic.trim().toLowerCase().normalize('NFKD');
    const words = normalized.split(/\s+/);

    if (words.length !== 24) {
      return {
        valid: false,
        error: `Invalid mnemonic length: expected 24 words, received ${words.length}`,
      };
    }

    const indices: number[] = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const idx = BIP39_WORD_INDEX_MAP.get(w);
      if (idx === undefined) {
        return {
          valid: false,
          error: `Invalid word at position ${i + 1}: '${w}' is not in BIP-39 dictionary`,
        };
      }
      indices.push(idx);
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
      return { valid: false, error: 'Invalid checksum: mnemonic verification failed' };
    }

    return {
      valid: true,
      entropy,
      hexEntropy: Buffer.from(entropy).toString('hex'),
    };
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

  /**
   * Derives a 512-bit (64-byte) seed using PBKDF2-HMAC-SHA512 (2,048 rounds).
   */
  public static mnemonicToSeed(mnemonic: string, passphrase: string = ''): Uint8Array {
    const validation = this.validateRecoveryMnemonic(mnemonic);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid mnemonic phrase');
    }

    const mnemonicNorm = mnemonic.trim().toLowerCase().normalize('NFKD');
    const saltNorm = `mnemonic${passphrase.normalize('NFKD')}`;
    const seedBuffer = crypto.pbkdf2Sync(mnemonicNorm, saltNorm, 2048, 64, 'sha512');
    return new Uint8Array(seedBuffer);
  }
}
```

---

## 5. Verification Method

To independently verify the implementation, the test suite `tests/security/master_recovery_bip39.test.ts` should be executed via:
```bash
npm run test:security
# or specifically:
node --import tsx --test "tests/security/master_recovery_bip39.test.ts"
```

The test suite must verify the following 10 test cases:
1. `test_f10_canonical_256bit_zero_vector`:
   256 bits of `0x00` produces 23 x `abandon` + `art`.
2. `test_f10_canonical_256bit_ones_vector`:
   256 bits of `0xFF` produces 23 x `zoo` + `vote`.
3. `test_f10_official_pbkdf2_seed_derivation`:
   23 x `abandon` + `art` with passphrase `"TREZOR"` matches `bda85446c68413707090a52022edd26a1c9462295029f2e60cd7c4f2bbd3097170af7a4d73245cafa9c3cca8d561a7c3de6f5d4a10be8ed2a5e608d68f92fcc8`.
4. `test_f10_1000_roundtrip_fuzz_cycles`:
   1,000 randomized CSPRNG entropy instances round-trip through `entropyToMnemonic` and `validateRecoveryMnemonic` with 100% bit-exact parity.
5. `test_f10_tampered_checksum_rejection`:
   Modifying the 24th word (or any single word) is rejected with `'Invalid checksum: mnemonic verification failed'`.
6. `test_f10_word_swapping_rejection`:
   Swapping two adjacent words is rejected by the SHA-256 checksum with > 99.6% probability.
7. `test_f10_unknown_word_rejection`:
   Inserting a non-BIP-39 word (e.g. `'starbucks'`, `'latte'`, `'foobar'`) fails at the dictionary lookup stage with exact word and position identified.
8. `test_f10_word_count_boundaries`:
   Phrases of 0, 1, 12, 23, and 25 words are rejected with length errors.
9. `test_f10_whitespace_and_case_tolerance`:
   Input with uppercase letters, tabs, trailing spaces, and multiple inter-word spaces validates successfully.
10. `test_f10_zeroization_after_extraction`:
    Intermediate buffers are cleanly zeroized.
