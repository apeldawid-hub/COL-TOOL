# Survey Report: Licensing & Hardware-Bound Activation Engine (R1) & Master Hardening and Disaster Recovery (R4)

**Platform**: Starbucks Operations Suite (Electron + React + Vite + TypeScript)  
**Investigator**: Survey Explorer 1 (`survey_fleet_explorer_1`)  
**Timestamp**: 2026-10-26T16:30:00Z  
**Target Scope**: 
1. Licensing & Hardware-Bound Activation Engine (R1)
2. Master Hardening & Disaster Recovery (R4)
3. Interface Contracts & IPC Bridges

---

## Executive Summary

This report delivers an exhaustive architectural survey of the existing security, cryptography, IPC messaging, and recovery mechanisms in the Starbucks Operations Suite, alongside detailed production specifications for:
1. **Licensing & Hardware-Bound Activation Engine (`src/services/security/licensingService.ts`)**: Generating and validating cryptographically signed activation keys (`SBX-<storeId>-<randomHex>-<checksum>`), gathering deterministic hardware fingerprints across macOS, Windows, and Linux via Electron Main IPC, and enforcing anti-tamper hardware locks.
2. **Master Hardening & Disaster Recovery (`src/services/security/masterRecoveryService.ts`)**: Designing a zero-dependency BIP-39 24-word mnemonic generator and validator for master seed reconstruction, implementing in-memory key zeroization (`Buffer.fill(0)`) on inactivity timeouts, and establishing a rate-limited, timing-safe Electron IPC bridge for master credential verification.

---

## 1. Audit of Current Security & Cryptographic Codebase

### 1.1 Existing Security Services (`src/services/security/`)
| File | Size (Bytes) | Role & Status | Key Cryptographic Primitives |
| :--- | :--- | :--- | :--- |
| `src/services/security/encryptionService.ts` | 16,455 | Client-side AES-256-GCM encryption engine (Feature F12) | AES-256-GCM, PBKDF2-HMAC-SHA256 (600,000 iterations), RFC 8785 canonical JSON, `StoreKeyCache` with in-memory zeroization (`key.fill(0)`) |
| `src/services/security/vaultService.ts` | 26,428 | Data classification & Firestore packaging (Feature F13) | Tiers 1-3 classification, AAD Context Binding (`${storeId}:${vaultType}:${docId}`), canonical payload envelopes |
| `src/services/security/cloudMigrationService.ts` | 40,577 | Local-to-cloud migration pipeline | SQLite extraction, bulk AES-256 encryption, rollback mechanisms |
| `src/services/security/parityVerificationService.ts` | 15,320 | Cloud-vs-local cryptographic parity check | SHA-256 canonical hashing, cryptographic certificate generation |
| `electron/security/vaultKeyManager.ts` | 5,311 | Host OS Keychain & safeStorage management | Electron `safeStorage`, `master_seed.enc` storage, main-process PBKDF2 key derivation offload |
| `electron/database/backupManager.ts` | 21,160 | SQLite database backup & restore manager | Per-store partition backups, 15-backup FIFO rotation, SHA-256 digest validation, store target matching |

### 1.2 Identified Architectural Gaps
1. **No Hardware Binding in Current Authentication**:
   - In `src/services/auth/authService.ts` (lines 54–61), `getDeviceFingerprint()` currently generates a random client-side string stored in `localStorage` (`sbx_device_uuid`):
     ```typescript
     public static getDeviceFingerprint(): string {
       let uuid = localStorage.getItem(STORAGE_DEVICE_UUID_KEY);
       if (!uuid) {
         uuid = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
         localStorage.setItem(STORAGE_DEVICE_UUID_KEY, uuid);
       }
       return uuid;
     }
     ```
   - **Vulnerability**: This ID is non-deterministic. If `localStorage` is cleared or copied to an unauthorized computer, the hardware identity is either regenerated or duplicated without detecting the hardware migration.
2. **Absence of Licensing Engine**:
   - No `licensingService.ts` or license validation exists. Store instances can currently be initialized simply by entering values in `OnboardingWizardView.tsx`.
3. **Absence of Disaster Recovery & Seed Phrase Mechanism**:
   - If `userData/security/master_seed.enc` or the macOS Keychain is corrupted or reset, there is currently no emergency mnemonic recovery mechanism (BIP-39) to restore master decryption keys.
4. **Renderer-Heavy Credential Handling**:
   - User roles and login sessions are checked primarily in React state and `localStorage`. Credential validation lacks an Electron main-process IPC bridge with constant-time comparison and rate limiting.

---

## 2. Licensing & Hardware-Bound Activation Engine (R1)

### 2.1 Deterministic Hardware Identity Gathering in Electron
To enforce a hardware lock that prevents copying the application database (`~/Library/Application Support/Starbucks Operations Suite/store_${id}.db`) to unauthorized machines, hardware identity must be gathered deterministically from immutable host parameters in the Electron Main process.

#### Main Process vs Renderer Process Capabilities:
- **Renderer Process (React/Vite)**: Operates with `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: false`. The renderer has no access to `child_process.execSync` and cannot inspect motherboards, BIOS, or system UUIDs.
- **Electron Main Process (`electron/main.ts`)**: Runs in full Node.js with native OS APIs (`node:os`, `node:child_process`, `node:crypto`).

#### Multi-Platform Hardware Identity Harvesting:
| OS Platform | Primary Hardware Anchor | Command / API | Fallback Anchor |
| :--- | :--- | :--- | :--- |
| **macOS** | Motherboard `IOPlatformUUID` | `ioreg -rd1 -c IOPlatformExpertDevice \| awk '/IOPlatformUUID/ { split($0, a, "\""); print a[4] }'` | Primary MAC (`en0`) + CPU Model + Hostname |
| **Windows** | System UUID / MachineGuid | `powershell -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"` or registry `HKLM:\SOFTWARE\Microsoft\Cryptography\MachineGuid` | Primary MAC + CPU ProcessorId + Hostname |
| **Linux** | `/etc/machine-id` | `fs.readFileSync('/etc/machine-id', 'utf8')` or `/var/lib/dbus/machine-id` | `/sys/class/dmi/id/product_uuid` + MAC |

#### Canonical Hardware Fingerprint Derivation:
```typescript
/**
 * In electron/security/hardwareIdManager.ts
 */
export function computeHardwareFingerprint(): string {
  const platform = process.platform;
  let rawUuid = '';

  try {
    if (platform === 'darwin') {
      rawUuid = execSync('ioreg -rd1 -c IOPlatformExpertDevice', { encoding: 'utf8', timeout: 2000 })
        .split('\n')
        .find(line => line.includes('IOPlatformUUID'))
        ?.split('"')[3] || '';
    } else if (platform === 'win32') {
      rawUuid = execSync('powershell.exe -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"', { encoding: 'utf8', timeout: 2000 }).trim();
    } else {
      if (fs.existsSync('/etc/machine-id')) {
        rawUuid = fs.readFileSync('/etc/machine-id', 'utf8').trim();
      }
    }
  } catch (err) {
    console.warn('[HardwareIdManager] Błąd odczytu systemowego UUID, fallback do sygnatury platformy:', err);
  }

  // Uzupełnienie o parametry CPU, MAC i nazwę hosta
  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model || 'UNKNOWN_CPU';
  const cpuCores = cpus.length;
  const hostname = os.hostname();
  
  // Pobranie pierwszego zewnętrznego adresu MAC
  const netInterfaces = os.networkInterfaces();
  let primaryMac = '00:00:00:00:00:00';
  for (const name of Object.keys(netInterfaces)) {
    const iface = netInterfaces[name]?.find(i => !i.internal && i.mac && i.mac !== '00:00:00:00:00:00');
    if (iface) {
      primaryMac = iface.mac;
      break;
    }
  }

  const rawFingerprint = [
    `OS:${platform}`,
    `UUID:${rawUuid.trim().toLowerCase()}`,
    `CPU:${cpuModel.trim()}:${cpuCores}`,
    `MAC:${primaryMac.toLowerCase()}`,
    `HOST:${hostname.trim().toLowerCase()}`
  ].join('##');

  // Deterministyczny skrót HMAC-SHA256 z wewnętrznym pepperem aplikacji
  const HW_PEPPER = 'sbx_hw_anchor_pepper_v1_2026';
  return crypto.createHmac('sha256', HW_PEPPER).update(rawFingerprint, 'utf8').digest('hex');
}
```

### 2.2 Activation Key Cryptographic Design (`SBX-<storeId>-<randomHex>-<checksum>`)

#### Format Specification:
Format: `SBX-<storeId>-<randomHex>-<checksum>`
- **Prefix**: Fixed namespace `SBX` (Starbucks Operations Suite).
- **Store ID (`<storeId>`)**: Unit code or store identifier (e.g. `108120`, `108150`, `HQ01`), alphanumeric 3–12 chars.
- **Random Hex (`<randomHex>`)**: 16 uppercase hexadecimal characters (8 cryptographically secure random bytes = 64 bits of entropy).
  - Byte 0: License Tier Flag (`01` = Store Client, `02` = Regional Supervisor, `FF` = Fleet Master HQ).
  - Bytes 1–3: Issue Date (Days since epoch in hex, enabling license aging/audit).
  - Bytes 4–7: High-entropy CSPRNG random bytes (`crypto.randomBytes(4)`).
- **Checksum (`<checksum>`)**: 10 uppercase hexadecimal characters.
  - Derived via HMAC-SHA256:
    $$\text{Payload} = \text{"SBX:"} \parallel \text{storeId.toUpperCase()} \parallel \text{":"} \parallel \text{randomHex.toUpperCase()}$$
    $$\text{HMAC} = \text{HMAC-SHA256}(\text{MASTER\_SIGNING\_KEY}, \text{Payload})$$
    $$\text{Checksum} = \text{HMAC}[0..9] \quad (\text{first 10 hex characters})$$

#### Key Verification Algorithm:
1. Validate format matching regex: `/^SBX-([A-Z0-9_]{3,12})-([A-F0-9]{16})-([A-F0-9]{10})$/i`.
2. Extract `storeId`, `randomHex`, and `providedChecksum`.
3. Ensure `storeId` matches the unit being activated (or is authorized for Fleet Master).
4. Recompute expected checksum using `MASTER_SIGNING_KEY`.
5. Perform constant-time verification using `crypto.timingSafeEqual`:
   ```typescript
   export function verifyKeyChecksum(storeId: string, randomHex: string, checksum: string, masterKey: string): boolean {
     const payload = `SBX:${storeId.toUpperCase()}:${randomHex.toUpperCase()}`;
     const expectedChecksum = crypto
       .createHmac('sha256', masterKey)
       .update(payload, 'utf8')
       .digest('hex')
       .substring(0, 10)
       .toUpperCase();

     const a = Buffer.from(checksum.toUpperCase(), 'utf8');
     const b = Buffer.from(expectedChecksum, 'utf8');
     if (a.length !== b.length) return false;
     return crypto.timingSafeEqual(a, b);
   }
   ```

### 2.3 Hardware Binding & Anti-Tamper Enforcement
When a key is activated:
1. **Activation Record**:
   ```typescript
   export interface ActiveLicenseRecord {
     version: 'v1';
     licenseKey: string;
     storeId: string;
     tier: 'STORE_CLIENT' | 'FLEET_MASTER';
     hardwareFingerprint: string;
     activatedAt: string;
     deviceInfo: {
       platform: string;
       hostname: string;
     };
     signature: string; // HMAC-SHA256(licenseKey + hardwareFingerprint + activatedAt)
   }
   ```
2. **Multi-Layered Tamper-Proof Storage**:
   - **Layer 1 (Host OS Keychain via Electron `safeStorage`)**: Saved to `userData/security/license.enc`.
     Because `safeStorage` uses the local user's OS Keychain (macOS) or DPAPI (Windows), copying the `userData` directory to another physical machine makes `license.enc` mathematically undecryptable by the destination OS.
   - **Layer 2 (Cryptographic Hardware Lock)**:
     On application startup (before mounting store databases):
     ```typescript
     const license = await licensingService.getActiveLicense();
     const currentHw = await api.getHardwareFingerprint();
     
     if (license.hardwareFingerprint !== currentHw) {
       // Invalidate in-memory keys
       StoreKeyCache.clear();
       throw new HardwareMismatchError('Niezautoryzowane urządzenie. Wykryto próbę uruchomienia bazy na innej stacji roboczej.');
     }
     ```
   - **Layer 3 (Database Integrity Binding)**:
     The store SQLite database metadata records the bound `hardware_fingerprint_hash`. Mismatches trigger an immediate hard lockout and require re-activation from Fleet Master HQ.

---

## 3. Master Hardening & Disaster Recovery (R4)

### 3.1 BIP-39 Mnemonic Phrase Generator & Validator (`src/services/security/masterRecoveryService.ts`)

#### Cryptographic Standard:
- **Entropy**: 256 bits (32 bytes) of cryptographically secure random bytes (`crypto.randomBytes(32)`).
- **Checksum**: First 8 bits ($256 / 32 = 8$) of $\text{SHA-256}(\text{Entropy})$.
- **Total Payload**: $256 + 8 = 264$ bits.
- **Word Decomposition**: $264 / 11 = 24$ words.
- **Wordlist**: Standard English BIP-39 dictionary containing exactly 2,048 words (`src/services/security/bip39Wordlist.ts`).

#### Algorithmic Implementation Design:
```typescript
/**
 * src/services/security/masterRecoveryService.ts
 */
import crypto from 'crypto';
import { BIP39_ENGLISH_WORDLIST } from './bip39Wordlist';

export interface RecoveryPhraseResult {
  mnemonic: string;
  words: string[];
  entropyHex: string;
  checksumBits: string;
  createdAt: string;
}

export interface MnemonicValidationResult {
  isValid: boolean;
  entropy?: Buffer;
  error?: string;
}

export class MasterRecoveryService {
  /**
   * Generuje 24-słowny zestaw odzyskiwania awaryjnego (BIP-39 standard)
   */
  public static generate24WordMnemonic(): RecoveryPhraseResult {
    const entropy = crypto.randomBytes(32); // 256-bit entropy
    const hash = crypto.createHash('sha256').update(entropy).digest();
    const checksumByte = hash[0]; // First 8 bits of SHA-256

    // Budowanie 264-bitowego ciągu binarnego
    let bitString = '';
    for (let i = 0; i < entropy.length; i++) {
      bitString += entropy[i].toString(2).padStart(8, '0');
    }
    bitString += checksumByte.toString(2).padStart(8, '0');

    // Podział na 24 grupy po 11 bitów
    const words: string[] = [];
    for (let i = 0; i < 24; i++) {
      const bitChunk = bitString.substring(i * 11, (i + 1) * 11);
      const wordIndex = parseInt(bitChunk, 2);
      words.push(BIP39_ENGLISH_WORDLIST[wordIndex]);
    }

    return {
      mnemonic: words.join(' '),
      words,
      entropyHex: entropy.toString('hex'),
      checksumBits: checksumByte.toString(2).padStart(8, '0'),
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Waliduje 24-słowny ciąg odzyskiwania, weryfikując słownik oraz sumę kontrolną
   */
  public static validateMnemonic(mnemonic: string): MnemonicValidationResult {
    if (!mnemonic || typeof mnemonic !== 'string') {
      return { isValid: false, error: 'Brak frazy mnemonicznej.' };
    }

    const words = mnemonic.trim().toLowerCase().split(/\s+/);
    if (words.length !== 24) {
      return { isValid: false, error: `Niepoprawna liczba słów: oczekiwano 24, otrzymano ${words.length}.` };
    }

    // Weryfikacja słownika i konwersja na bity
    let bitString = '';
    for (const word of words) {
      const index = BIP39_ENGLISH_WORDLIST.indexOf(word);
      if (index === -1) {
        return { isValid: false, error: `Słowo "${word}" nie występuje w oficjalnym słowniku BIP-39.` };
      }
      bitString += index.toString(2).padStart(11, '0');
    }

    // Podział na 256 bitów entropii i 8 bitów sumy kontrolnej
    const entropyBits = bitString.substring(0, 256);
    const checksumBits = bitString.substring(256, 264);

    const entropyBytes = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      const byteChunk = entropyBits.substring(i * 8, (i + 1) * 8);
      entropyBytes[i] = parseInt(byteChunk, 2);
    }

    const expectedHash = crypto.createHash('sha256').update(entropyBytes).digest();
    const expectedChecksumBits = expectedHash[0].toString(2).padStart(8, '0');

    if (checksumBits !== expectedChecksumBits) {
      return { isValid: false, error: 'Błąd sumy kontrolnej frazy BIP-39 (uszkodzony ciąg słów).' };
    }

    return { isValid: true, entropy: entropyBytes };
  }

  /**
   * Rekonstruuje Master Seed dla VaultKeyManager w razie utraty Keychain
   */
  public static reconstructMasterSeed(mnemonic: string, passphrase: string = ''): Buffer {
    const validation = this.validateMnemonic(mnemonic);
    if (!validation.isValid || !validation.entropy) {
      throw new Error(validation.error || 'Niepoprawna fraza mnemoniczna.');
    }

    // BIP-39 standardowa derywacja klucza seed (PBKDF2-HMAC-SHA512, 2048 iteracji)
    const salt = Buffer.from('mnemonic' + passphrase, 'utf8');
    return crypto.pbkdf2Sync(mnemonic.normalize('NFKD'), salt, 2048, 64, 'sha512');
  }
}
```

### 3.2 In-Memory Key Zeroization on Inactivity Timeout
To protect decrypted keys in memory when a Store Manager or Fleet Director leaves the station unattended:
1. **Activity Monitoring**:
   - `InactivityService` tracks mouse, keyboard, and touch interactions on `window`.
   - Timeout period: Default 15 minutes (configurable: 5 to 60 minutes).
2. **Zeroization Execution**:
   - Node `Buffer.prototype.fill(0)` provides guaranteed memory overwriting of key material.
   - On inactivity trigger:
     ```typescript
     export function performEmergencyZeroization(): void {
       // 1. Czyszczenie cache SEK w rendererze
       StoreKeyCache.clear(); // encryptionService.ts wykonuje entry.key.fill(0)
       
       // 2. Zerowanie kluczy w procesie głównym Electron
       const api = (window as any).api || (window as any).electronAPI;
       if (api?.cryptoZeroizeKeys) {
         api.cryptoZeroizeKeys().catch(console.error);
       }

       // 3. Zablokowanie stanu sesji w UI
       window.dispatchEvent(new CustomEvent('sbx:session-timeout-lock'));
     }
     ```
3. **Lock Screen Overlay**:
   - Blurs all underlying financial/schedule views.
   - Requires corporate PIN or 2FA OTP re-authentication to re-derive the SEK and resume work.

### 3.3 Electron IPC Bridge for Master Credential Verification
Master credentials (Master Passphrase, PIN, and Recovery Mnemonic) must **never** be compared directly in the renderer process (where DevTools or scripts could alter `if (entered === expected)` branches).

#### IPC Protocol:
- **Renderer Call**: `api.cryptoVerifyMasterCredential(credentialType, secret)`
- **Main Process Handler** (`electron/main.ts`):
  1. **Constant-time string comparison**: `crypto.timingSafeEqual()`.
  2. **Rate Limiting & Anti-Brute-Force**:
     - Maximum 5 attempts per 15-minute sliding window.
     - On 5 consecutive failures, enforce a 15-minute hardware lockout.
     - Log all attempts to `CrashLogManager` and `SecurityAuditLog`.

---

## 4. Current vs Proposed IPC Bridges in Electron

### 4.1 Comparison Table
| IPC Channel | Direction | Status | Purpose & Parameters |
| :--- | :--- | :--- | :--- |
| `crypto:is-safe-storage-available` | Renderer $\rightarrow$ Main | **Existing** | Verifies OS Keychain / DPAPI availability |
| `crypto:get-master-passphrase` | Renderer $\rightarrow$ Main | **Existing** | Obtains or generates master seed |
| `crypto:derive-store-key` | Renderer $\rightarrow$ Main | **Existing** | Executes 600k PBKDF2 iterations in main process |
| `crypto:safe-storage-encrypt` | Renderer $\rightarrow$ Main | **Existing** | Encrypts string using `safeStorage` |
| `crypto:safe-storage-decrypt` | Renderer $\rightarrow$ Main | **Existing** | Decrypts base64 string using `safeStorage` |
| `system:get-hardware-fingerprint` | Renderer $\rightarrow$ Main | **Proposed** | Returns deterministic HMAC-SHA256 hardware anchor |
| `license:get-active-license` | Renderer $\rightarrow$ Main | **Proposed** | Reads and verifies `license.enc` against host hardware |
| `license:activate-station` | Renderer $\rightarrow$ Main | **Proposed** | Validates key, binds hardware, saves encrypted license |
| `crypto:verify-master-credential` | Renderer $\rightarrow$ Main | **Proposed** | Constant-time rate-limited verification of PIN/master password |
| `crypto:zeroize-keys` | Renderer $\rightarrow$ Main | **Proposed** | Flushes and fills with zero all cached master secrets in memory |
| `recovery:verify-mnemonic` | Renderer $\rightarrow$ Main | **Proposed** | Validates 24-word BIP-39 phrase and restores `master_seed.enc` |

### 4.2 Updated `IElectronAPI` Interface Contract
```typescript
// Proposed additions to electron/preload.ts & src/types/electron.d.ts
export interface IElectronSecurityAPI {
  // Hardware & Licensing
  getHardwareFingerprint: () => Promise<string>;
  getActiveLicense: () => Promise<{
    isActivated: boolean;
    tier?: 'STORE_CLIENT' | 'FLEET_MASTER';
    storeId?: string;
    licenseKey?: string;
    activatedAt?: string;
    error?: string;
  }>;
  activateStation: (payload: {
    storeId: string;
    activationKey: string;
  }) => Promise<{
    success: boolean;
    tier?: string;
    message: string;
  }>;
  
  // Master Hardening & Recovery
  cryptoVerifyMasterCredential: (
    credentialType: 'MASTER_PASSPHRASE' | 'PIN' | 'RECOVERY_MNEMONIC',
    secret: string
  ) => Promise<{
    success: boolean;
    remainingAttempts?: number;
    lockoutUntil?: string;
    error?: string;
  }>;
  cryptoZeroizeKeys: () => Promise<boolean>;
  recoveryRestoreFromMnemonic: (
    mnemonic: string,
    newPassphrase?: string
  ) => Promise<{
    success: boolean;
    message: string;
  }>;
}
```

---

## 5. Architectural Recommendations & Implementation Roadmap

### 5.1 Recommendation 1: Decoupled Licensing Engine (`src/services/security/licensingService.ts`)
- Implement `LicensingService` with static methods:
  - `generateActivationKey(storeId, tier, masterSigningKey)`
  - `validateKeyFormat(key)`
  - `verifyKeySignature(key, storeId, masterSigningKey)`
  - `activateLicense(storeId, key)`
  - `verifyHardwareLock()`
- Make `verifyKeyChecksum` pure and offline-testable with zero UI dependencies, allowing full unit-test coverage in `tests/e2e/tier1-feature-coverage/`.

### 5.2 Recommendation 2: Zero-Dependency BIP-39 Implementation
- Avoid third-party crypto-currency packages (e.g. `bip39`, `bitcoinjs-lib`) which bring heavy Node polyfill issues, native compilation requirements, and supply-chain attack surfaces.
- Embed the 2,048-word English dictionary directly in `src/services/security/bip39Wordlist.ts` (~18 KB).
- Implement pure bitwise conversion using standard Node `crypto` / WebCrypto.

### 5.3 Recommendation 3: Startup Guard in `src/App.tsx`
- In `src/App.tsx`, introduce a pre-onboarding security check:
  1. `const license = await licensingService.getActiveLicense();`
  2. If `!license.isActivated`, open `ActivationModal` immediately before any store data or onboarding is rendered.
  3. If `license.hardwareMismatch`, display the anti-theft Hardware Lock screen.

---

## 6. Verification & Test Plan

1. **Activation Key Generation & Verification Unit Tests**:
   - Format compliance: `SBX-<storeId>-<randomHex>-<checksum>`.
   - Tamper resilience: modifying 1 character in `storeId`, `randomHex`, or `checksum` fails verification.
   - Cross-store protection: Key generated for `108120` is rejected when entered for store `108150`.
2. **Deterministic Hardware Fingerprint Tests**:
   - Successive invocations on the same host yield identical 64-hex SHA-256 strings.
   - In simulated host migration (altered MAC / UUID), license check throws `HARDWARE_MISMATCH`.
3. **BIP-39 Mnemonic Tests**:
   - 24 words generated produce exact 264 bits (256 bits entropy + 8 bits checksum).
   - Word count mismatch (< 24 or > 24) is rejected.
   - Invalid dictionary word is detected and reported.
   - Altered word fails checksum verification.
   - Valid phrase reconstructs exact 32-byte master seed.
4. **Memory Zeroization Tests**:
   - Inactivity trigger flushes `StoreKeyCache` and verifies all buffers have `[0, 0, ..., 0]`.

---
*Report compiled by Survey Explorer 1 (`survey_fleet_explorer_1`)*
