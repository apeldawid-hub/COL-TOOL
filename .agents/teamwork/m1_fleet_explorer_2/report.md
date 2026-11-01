# Technical Architecture & Implementation Blueprint: Electron Hardware Identity & IPC Layer

**Component**: Electron Hardware Identity (`hardwareIdManager.ts`), SafeStorage License Vault, and Preload/Main IPC Layer  
**Milestone**: Milestone 1 — Licensing & Hardware-Bound Activation Engine  
**Author**: M1 Explorer 2 (`m1_fleet_explorer_2`)  
**Timestamp**: 2026-10-26T16:45:00Z  
**Target Files**:
- `electron/security/hardwareIdManager.ts` (New file)
- `electron/preload.ts` (Update existing)
- `electron/main.ts` (Update existing)
- `electron/security/vaultKeyManager.ts` (Reference / coexistence)
- `src/types/electron.d.ts` (Type synchronization)

---

## 1. Executive Summary & Architectural Overview

Milestone 1 introduces the **Hardware-Bound Activation Engine** to ensure that Starbucks Operations Suite instances deployed to store stations cannot have their application databases (`store_${id}.db`) or configuration data cloned and run on unauthorized laptops.

To achieve cryptographic non-repudiation and hardware binding without external hardware dongles, this layer operates directly in the Electron Main process to harvest **immutable, host-level machine identity parameters** that are invisible or inaccessible to sandboxed browser environments:
1. **Multi-Platform Motherboard / System UUID**:
   - macOS: `IOPlatformUUID` via `ioreg -rd1 -c IOPlatformExpertDevice` (fallback `sysctl -n kern.uuid`).
   - Windows: `MachineGuid` via `reg query "HKLM\SOFTWARE\Microsoft\Cryptography" /v MachineGuid` (fallback CIM UUID via PowerShell).
   - Linux: `/etc/machine-id` or `/var/lib/dbus/machine-id` (fallback `/sys/class/dmi/id/product_uuid`).
2. **Deterministic Primary Network Interface MAC**:
   - Filtered against internal, loopback, and virtual/ad-hoc adapters (`awdl0`, `utun*`, `docker0`, `veth*`).
   - Deterministically sorted so that multi-NIC machines always yield the identical primary MAC address.
3. **Hardware Sizing Anchors**:
   - Host CPU model and core count (`os.cpus()`).
   - Host machine network node name (`os.hostname()`).
4. **Deterministic SHA-256 Fingerprint**:
   - Canonical pipe-delimited payload hashed with SHA-256 (64 hex characters) and application salt prefix.
5. **Headless / Test / Browser Fallback**:
   - Transparent test overrides via `process.env.SBX_TEST_HARDWARE_FINGERPRINT`.
   - Pure Node.js execution support outside Electron runtime (`node --import tsx --test`).
   - Browser mock fallback for Vite web preview mode.
6. **Encrypted License Vault (`userData/security/license.enc`)**:
   - Backed by Electron `safeStorage` (macOS Keychain Services, Windows DPAPI, Linux Secret Service).
   - Tamper-evident: copying `license.enc` to another computer causes OS-level decryption failure.
   - Fallback to hardware-keyed AES-256-GCM if OS Keychain is unavailable.
7. **IPC Channels in `main.ts` & `preload.ts`**:
   - `system:get-hardware-fingerprint`
   - `licensing:save-license`
   - `licensing:load-license`
   - `licensing:revoke-license`

---

## 2. Multi-Platform Hardware Harvesting Engine (`electron/security/hardwareIdManager.ts`)

### 2.1 Hardware Identity Parameters Comparison

| Platform | Primary Anchor | Retrieval Mechanism | Latency | Resilience to OS Updates |
| :--- | :--- | :--- | :--- | :--- |
| **macOS (`darwin`)** | Motherboard `IOPlatformUUID` | `ioreg -rd1 -c IOPlatformExpertDevice` | ~25 ms | **Permanent** (burned into Apple Silicon / SMC motherboard) |
| macOS Fallback | Kernel UUID | `sysctl -n kern.uuid` | ~5 ms | Resets on reboot/kernel update; used only if `ioreg` is blocked |
| **Windows (`win32`)** | OS `MachineGuid` | `reg query "HKLM\SOFTWARE\Microsoft\Cryptography" /v MachineGuid` | ~15 ms | **Permanent** across reboots, unique per Windows installation |
| Windows Fallback | System UUID (BIOS/CIM) | `powershell.exe -NoProfile -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"` | ~400 ms | **Permanent** (motherboard UUID) |
| **Linux (`linux`)** | Systemd Machine ID | Read `/etc/machine-id` or `/var/lib/dbus/machine-id` | < 1 ms | **Permanent** (created at OS install) |
| Linux Fallback | DMI Product UUID | Read `/sys/class/dmi/id/product_uuid` | < 1 ms | **Permanent** (BIOS DMI table) |

---

### 2.2 Primary MAC Address Harvesting & Normalization

#### The Multi-NIC Non-Determinism Problem:
Laptops routinely have multiple network adapters:
- Built-in Wi-Fi (`en0`)
- Apple Wireless Direct Link / AirDrop (`awdl0` / `llw0`)
- VPN & tunnel devices (`utun0`, `utun1`, `tailscale0`)
- Virtual machine bridges (`bridge0`, `docker0`, `vboxnet0`)

If an algorithm simply calls `Object.values(os.networkInterfaces())[0]`, the order returned by the OS can vary depending on which adapter was active first at boot time.

#### Deterministic Selection Algorithm:
1. Exclude all internal adapters (`iface.internal === true`) and loopbacks (`mac === '00:00:00:00:00:00'`).
2. Exclude known ephemeral or virtual interface name prefixes:
   `['awdl', 'llw', 'utun', 'tun', 'tap', 'docker', 'veth', 'vbox', 'vmnet', 'tailscale', 'wireguard']`.
3. Prioritize standard physical interface names:
   - High Priority: `['en0', 'eth0', 'wlan0', 'ethernet', 'wi-fi']`
   - Medium Priority: `en[1-9]`, `eth[1-9]`, `wlan[1-9]`
4. If multiple candidates exist, sort candidates alphabetically by interface name and pick the lowest-indexed interface.
5. Always normalize MAC address format: lowercase, trimmed, with colon separators (e.g. `86:fe:2a:f8:9c:9b`).

---

### 2.3 Complete Source Code Specification: `electron/security/hardwareIdManager.ts`

```typescript
/**
 * Starbucks Operations Suite — Hardware Identity Manager
 * File: electron/security/hardwareIdManager.ts
 *
 * Responsibilities:
 * 1. Harvest immutable machine identity across macOS, Windows, and Linux.
 * 2. Deterministically resolve primary physical MAC address.
 * 3. Generate canonical SHA-256 hardware fingerprint.
 * 4. Provide robust fallbacks for CI/CD test runners, headless environments, and browser preview.
 */

import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

export interface HardwareComponents {
  platform: string;
  arch: string;
  systemUuid: string;
  cpuModel: string;
  cpuCores: number;
  primaryMac: string;
  hostname: string;
  isFallback: boolean;
}

export class HardwareIdManager {
  private static instance: HardwareIdManager | null = null;
  private cachedFingerprint: string | null = null;
  private cachedComponents: HardwareComponents | null = null;

  // Application pepper to prevent pre-computed rainbow table lookups
  private static readonly FINGERPRINT_SALT = 'sbx_hw_anchor_pepper_v1_2026';

  private constructor() {}

  public static getInstance(): HardwareIdManager {
    if (!this.instance) {
      this.instance = new HardwareIdManager();
    }
    return this.instance;
  }

  /**
   * Resets cached fingerprint and components.
   * Useful in automated testing when mocking environment variables or hardware.
   */
  public resetCache(): void {
    this.cachedFingerprint = null;
    this.cachedComponents = null;
  }

  /**
   * Computes or returns the cached 64-hex SHA-256 deterministic hardware fingerprint.
   */
  public getHardwareFingerprint(): string {
    if (this.cachedFingerprint) {
      return this.cachedFingerprint;
    }

    // 1. Check for explicit test environment override (e.g. in Vitest / CI)
    if (process.env.SBX_TEST_HARDWARE_FINGERPRINT) {
      const testFp = process.env.SBX_TEST_HARDWARE_FINGERPRINT.trim().toLowerCase();
      if (/^[a-f0-9]{64}$/.test(testFp)) {
        this.cachedFingerprint = testFp;
        return testFp;
      }
    }

    // 2. Harvest raw hardware components
    const components = this.harvestHardwareComponents();
    this.cachedComponents = components;

    // 3. Build canonical normalized representation
    const canonicalPayload = [
      `OS:${components.platform}`,
      `ARCH:${components.arch}`,
      `UUID:${components.systemUuid.toLowerCase()}`,
      `CPU:${components.cpuModel}:${components.cpuCores}`,
      `MAC:${components.primaryMac.toLowerCase()}`,
      `HOST:${components.hostname.toLowerCase()}`,
    ].join('##');

    // 4. Compute deterministic SHA-256 hash with internal salt
    const sha256 = crypto
      .createHmac('sha256', HardwareIdManager.FINGERPRINT_SALT)
      .update(canonicalPayload, 'utf8')
      .digest('hex');

    this.cachedFingerprint = sha256;
    return sha256;
  }

  /**
   * Returns individual harvested hardware components for diagnostics and audit logs.
   */
  public getHardwareComponents(): HardwareComponents {
    if (!this.cachedComponents) {
      this.getHardwareFingerprint();
    }
    return this.cachedComponents!;
  }

  /**
   * Harvests low-level hardware identity across supported platforms.
   */
  private harvestHardwareComponents(): HardwareComponents {
    const platform = process.platform;
    const arch = process.arch;
    let systemUuid = '';
    let isFallback = false;

    try {
      if (platform === 'darwin') {
        systemUuid = this.getMacSystemUuid();
      } else if (platform === 'win32') {
        systemUuid = this.getWindowsSystemUuid();
      } else if (platform === 'linux') {
        systemUuid = this.getLinuxSystemUuid();
      }
    } catch (err) {
      console.warn('[HardwareIdManager] Primary UUID harvesting failed, engaging fallback:', err);
      isFallback = true;
    }

    // If OS-level UUID harvesting yielded nothing, construct fallback
    if (!systemUuid || systemUuid.trim().length === 0) {
      systemUuid = this.getSyntheticFallbackUuid();
      isFallback = true;
    }

    const cpus = os.cpus() || [];
    const cpuModel = cpus[0]?.model ? cpus[0].model.trim() : 'UNKNOWN_CPU';
    const cpuCores = cpus.length || 1;
    const hostname = os.hostname() ? os.hostname().trim().toLowerCase() : 'unknown-host';
    const primaryMac = this.getPrimaryMacAddress();

    return {
      platform,
      arch,
      systemUuid: systemUuid.trim(),
      cpuModel,
      cpuCores,
      primaryMac,
      hostname,
      isFallback,
    };
  }

  /**
   * macOS: Harvest IOPlatformUUID from IOKit registry.
   */
  private getMacSystemUuid(): string {
    try {
      const output = execSync('ioreg -rd1 -c IOPlatformExpertDevice', {
        encoding: 'utf8',
        timeout: 2500,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch (err) {
      // Fallback: kern.uuid via sysctl
      try {
        const sysctlOutput = execSync('sysctl -n kern.uuid', {
          encoding: 'utf8',
          timeout: 1000,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
        if (sysctlOutput && sysctlOutput.trim().length > 0) {
          return sysctlOutput.trim();
        }
      } catch (_) {}
    }
    return '';
  }

  /**
   * Windows: Harvest MachineGuid from Windows Registry, fallback to CIM UUID.
   */
  private getWindowsSystemUuid(): string {
    try {
      // Fast path: registry query (<15 ms)
      const regOutput = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const match = regOutput.match(/MachineGuid\s+REG_SZ\s+([a-f0-9\-]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch (_) {
      // Fallback: PowerShell CIM query
      try {
        const psOutput = execSync(
          'powershell.exe -NoProfile -NonInteractive -Command "(Get-CimInstance -Class Win32_ComputerSystemProduct).UUID"',
          { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }
        );
        if (psOutput && psOutput.trim().length > 0) {
          return psOutput.trim();
        }
      } catch (_) {}
    }
    return '';
  }

  /**
   * Linux: Read systemd machine-id or dbus machine-id.
   */
  private getLinuxSystemUuid(): string {
    const paths = [
      '/etc/machine-id',
      '/var/lib/dbus/machine-id',
      '/sys/class/dmi/id/product_uuid',
    ];

    for (const filePath of paths) {
      try {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8').trim();
          if (content.length > 0) {
            return content;
          }
        }
      } catch (_) {}
    }
    return '';
  }

  /**
   * Synthetic fallback UUID for environments without OS-level UUIDs (e.g. minimal Docker containers).
   */
  private getSyntheticFallbackUuid(): string {
    const seed = `${os.platform()}-${os.arch()}-${os.hostname()}-${os.userInfo().username}`;
    return crypto.createHash('sha256').update(seed, 'utf8').digest('hex').substring(0, 32);
  }

  /**
   * Extracts the primary physical network MAC address deterministically.
   */
  public getPrimaryMacAddress(): string {
    const interfaces = os.networkInterfaces();
    if (!interfaces) {
      return '00:00:00:00:00:00';
    }

    interface Candidate {
      name: string;
      mac: string;
      priority: number;
    }

    const candidates: Candidate[] = [];
    const preferredNames = ['en0', 'eth0', 'wlan0', 'ethernet', 'wi-fi'];
    const ignoredPrefixes = [
      'awdl',
      'llw',
      'utun',
      'tun',
      'tap',
      'docker',
      'veth',
      'vbox',
      'vmnet',
      'tailscale',
      'wireguard',
      'lo',
    ];

    for (const [name, infos] of Object.entries(interfaces)) {
      if (!infos) continue;

      const lowerName = name.toLowerCase();
      if (ignoredPrefixes.some((p) => lowerName.startsWith(p))) {
        continue;
      }

      for (const info of infos) {
        if (info.internal) continue;
        if (!info.mac || info.mac === '00:00:00:00:00:00') continue;

        let priority = 100;
        const matchedIndex = preferredNames.indexOf(lowerName);
        if (matchedIndex !== -1) {
          priority = matchedIndex; // 0 for en0, 1 for eth0, etc.
        } else if (/^(en|eth|wlan)[0-9]+$/i.test(lowerName)) {
          priority = 50;
        }

        candidates.push({
          name: lowerName,
          mac: info.mac.toLowerCase(),
          priority,
        });
      }
    }

    if (candidates.length === 0) {
      return '00:00:00:00:00:00';
    }

    // Sort by priority ascending, then by interface name alphabetically
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.name.localeCompare(b.name);
    });

    return candidates[0].mac;
  }
}
```

---

## 3. SafeStorage Integration & License Storage (`license.enc`)

### 3.1 License Record & Vault Envelopes

The activation record saved to disk must contain the active license key, store binding, hardware fingerprint, issue/activation dates, and cryptographic HMAC signature.

```typescript
export interface ActiveLicenseRecord {
  version: 'v1';
  licenseKey: string;
  storeId: string;
  tier: 'STORE_CLIENT' | 'FLEET_MASTER';
  hardwareFingerprint: string;
  activatedAt: string;
  expiresAt?: string;
  deviceInfo: {
    platform: string;
    hostname: string;
    arch: string;
  };
  signature: string;
  revoked: boolean;
}
```

### 3.2 File System Architecture: `userData/security/license.enc`
- **Location**:
  - macOS: `~/Library/Application Support/Starbucks Operations Suite/security/license.enc`
  - Windows: `%APPDATA%\Starbucks Operations Suite\security\license.enc`
  - Linux: `~/.config/Starbucks Operations Suite/security/license.enc`
- **File Permissions**:
  - POSIX file mode: `0o600` (read/write by application user only).
- **Physical Machine Anti-Cloning Protection**:
  1. `safeStorage.encryptString()` uses the OS User Keychain (macOS) or DPAPI (Windows).
  2. If the user copies the entire application support folder to another laptop or USB drive, calling `safeStorage.decryptString()` on the destination computer fails at the OS layer (`Decryption failed`).
  3. Even if the file could somehow be decrypted, `licenseRecord.hardwareFingerprint` will not match `HardwareIdManager.getHardwareFingerprint()` on the destination machine, causing an immediate station lockout.

### 3.3 SafeStorage Fallback Strategy (Headless / Non-Keychain Environments)
If `safeStorage.isEncryptionAvailable()` returns `false` (e.g. running in test scripts or a headless server without Secret Service):
1. Compute an AES-256-GCM encryption key from the hardware fingerprint:
   $$\text{FallbackKey} = \text{PBKDF2-HMAC-SHA256}(\text{hardwareFingerprint}, \text{salt}=\text{"sbx_license_fallback_salt"}, \text{iterations}=100000, 32)$$
2. Encrypt the payload using AES-256-GCM with a 12-byte random IV.
3. Save with prefix: `fallback:aes256gcm:<iv_base64>:<tag_base64>:<ciphertext_base64>`.
4. **Security Property**: Because the fallback key is derived directly from the host machine's hardware fingerprint, moving `license.enc` to a different machine still cannot be decrypted!

### 3.4 License Vault Manager Implementation: `electron/security/licenseVaultManager.ts`

```typescript
/**
 * Starbucks Operations Suite — License Vault Manager
 * File: electron/security/licenseVaultManager.ts
 */

import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { HardwareIdManager } from './hardwareIdManager';

export class LicenseVaultManager {
  private static instance: LicenseVaultManager | null = null;
  private securityDir: string;
  private licenseFilePath: string;

  private constructor() {
    const userData = app?.getPath ? app.getPath('userData') : process.cwd();
    this.securityDir = path.join(userData, 'security');
    this.licenseFilePath = path.join(this.securityDir, 'license.enc');
  }

  public static getInstance(): LicenseVaultManager {
    if (!this.instance) {
      this.instance = new LicenseVaultManager();
    }
    return this.instance;
  }

  private isSafeStorageAvailable(): boolean {
    try {
      return typeof safeStorage !== 'undefined' && safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Saves and encrypts the active license record to disk.
   */
  public saveLicense(licenseData: any): { success: boolean; error?: string } {
    try {
      if (!fs.existsSync(this.securityDir)) {
        fs.mkdirSync(this.securityDir, { recursive: true });
      }

      const jsonStr = typeof licenseData === 'string' ? licenseData : JSON.stringify(licenseData);

      if (this.isSafeStorageAvailable()) {
        const encryptedBuf = safeStorage.encryptString(jsonStr);
        fs.writeFileSync(this.licenseFilePath, encryptedBuf, { mode: 0o600 });
      } else {
        // Fallback: Hardware-bound AES-256-GCM
        const encryptedFallback = this.encryptFallback(jsonStr);
        fs.writeFileSync(this.licenseFilePath, Buffer.from(encryptedFallback, 'utf8'), { mode: 0o600 });
      }

      return { success: true };
    } catch (err: any) {
      console.error('[LicenseVaultManager] Błąd zapisu licencji:', err);
      return { success: false, error: err.message || 'Błąd zapisu pliku licencji.' };
    }
  }

  /**
   * Loads and decrypts the active license record from disk.
   */
  public loadLicense(): { success: boolean; data: any; error?: string } {
    try {
      if (!fs.existsSync(this.licenseFilePath)) {
        return { success: true, data: null };
      }

      const fileBuf = fs.readFileSync(this.licenseFilePath);

      // Check for fallback envelope
      const contentStr = fileBuf.toString('utf8');
      if (contentStr.startsWith('fallback:aes256gcm:')) {
        const decryptedStr = this.decryptFallback(contentStr);
        const data = JSON.parse(decryptedStr);
        return { success: true, data };
      }

      // Standard safeStorage decryption
      if (this.isSafeStorageAvailable()) {
        const decryptedStr = safeStorage.decryptString(fileBuf);
        if (!decryptedStr) {
          return { success: false, data: null, error: 'DECRYPTION_EMPTY' };
        }
        const data = JSON.parse(decryptedStr);
        return { success: true, data };
      }

      return {
        success: false,
        data: null,
        error: 'SAFE_STORAGE_UNAVAILABLE_ON_EXISTING_LICENSE',
      };
    } catch (err: any) {
      console.error('[LicenseVaultManager] Błąd odszyfrowania licencji:', err);
      return {
        success: false,
        data: null,
        error: 'DECRYPTION_FAILED',
      };
    }
  }

  /**
   * Revokes the license: securely wipes the file contents with random bytes then deletes it.
   */
  public revokeLicense(): { success: boolean; error?: string } {
    try {
      if (fs.existsSync(this.licenseFilePath)) {
        const stat = fs.statSync(this.licenseFilePath);
        // Secure overwrite
        const randomBytes = crypto.randomBytes(stat.size);
        fs.writeFileSync(this.licenseFilePath, randomBytes);
        fs.unlinkSync(this.licenseFilePath);
      }
      return { success: true };
    } catch (err: any) {
      console.error('[LicenseVaultManager] Błąd usuwania pliku licencji:', err);
      return { success: false, error: err.message };
    }
  }

  // --- Fallback Cryptography ---
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
```

---

## 4. Preload & Main IPC Layer Specification

### 4.1 Interface Additions to `electron/preload.ts`

```typescript
export interface IElectronAPI {
  // Existing methods ...

  // =========================================================================
  // Milestone 1: Licensing & Hardware-Bound Activation Engine IPC
  // =========================================================================
  getHardwareFingerprint: () => Promise<string>;
  saveLicense: (licenseData: any) => Promise<{ success: boolean; error?: string }>;
  loadLicense: () => Promise<{ success: boolean; data: any; error?: string }>;
  revokeLicense: () => Promise<{ success: boolean; error?: string }>;
}
```

Implementation in `electron/preload.ts`:
```typescript
const api: IElectronAPI = {
  // Existing mappings ...

  // Milestone 1: Licensing & Hardware-Bound Activation Engine
  getHardwareFingerprint: () => ipcRenderer.invoke('system:get-hardware-fingerprint'),
  saveLicense: (licenseData) => ipcRenderer.invoke('licensing:save-license', licenseData),
  loadLicense: () => ipcRenderer.invoke('licensing:load-license'),
  revokeLicense: () => ipcRenderer.invoke('licensing:revoke-license'),
};
```

---

### 4.2 Main Process Handlers in `electron/main.ts`

To be placed in `setupIpcHandlers()` within `electron/main.ts`:

```typescript
  // =========================================================================
  // Milestone 1: Licensing & Hardware-Bound Activation Engine IPC Handlers
  // =========================================================================

  ipcMain.handle('system:get-hardware-fingerprint', async () => {
    try {
      const { HardwareIdManager } = await import('./security/hardwareIdManager');
      return HardwareIdManager.getInstance().getHardwareFingerprint();
    } catch (err: any) {
      console.error('[IPC:system:get-hardware-fingerprint] Error:', err);
      throw new Error(`Failed to compute hardware fingerprint: ${err.message}`);
    }
  });

  ipcMain.handle('licensing:save-license', async (_event, licenseData: any) => {
    try {
      const { LicenseVaultManager } = await import('./security/licenseVaultManager');
      return LicenseVaultManager.getInstance().saveLicense(licenseData);
    } catch (err: any) {
      console.error('[IPC:licensing:save-license] Error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('licensing:load-license', async () => {
    try {
      const { LicenseVaultManager } = await import('./security/licenseVaultManager');
      return LicenseVaultManager.getInstance().loadLicense();
    } catch (err: any) {
      console.error('[IPC:licensing:load-license] Error:', err);
      return { success: false, data: null, error: err.message };
    }
  });

  ipcMain.handle('licensing:revoke-license', async () => {
    try {
      const { LicenseVaultManager } = await import('./security/licenseVaultManager');
      return LicenseVaultManager.getInstance().revokeLicense();
    } catch (err: any) {
      console.error('[IPC:licensing:revoke-license] Error:', err);
      return { success: false, error: err.message };
    }
  });
```

---

## 5. Renderer & Browser Fallback Strategy (`src/services/security/licensingService.ts`)

In web browser dev mode (`http://localhost:5173`) where Electron IPC (`window.api`) is unavailable, `licensingService.ts` must not crash:

```typescript
export async function resolveHardwareFingerprint(): Promise<string> {
  // 1. Electron IPC Context (Desktop App)
  if (typeof window !== 'undefined') {
    const api = (window as any).api || (window as any).electronAPI;
    if (api?.getHardwareFingerprint && typeof api.getHardwareFingerprint === 'function') {
      try {
        return await api.getHardwareFingerprint();
      } catch (err) {
        console.warn('[LicensingService] IPC getHardwareFingerprint failed:', err);
      }
    }
  }

  // 2. Headless Node / Test Runner Context
  if (typeof process !== 'undefined' && process.env?.SBX_TEST_HARDWARE_FINGERPRINT) {
    return process.env.SBX_TEST_HARDWARE_FINGERPRINT.trim().toLowerCase();
  }

  // 3. Web Browser Fallback (Vite Dev Server)
  if (typeof window !== 'undefined' && window.localStorage) {
    const BROWSER_DEV_KEY = 'sbx_dev_browser_hardware_fingerprint';
    let devFp = localStorage.getItem(BROWSER_DEV_KEY);
    if (!devFp) {
      // Deterministic browser seed
      const browserData = [
        navigator.userAgent,
        navigator.language,
        window.screen.width,
        window.screen.height,
        window.screen.colorDepth,
      ].join('::');

      // Use Web Crypto API in browser
      const encoder = new TextEncoder();
      const hashBuf = await window.crypto.subtle.digest('SHA-256', encoder.encode(browserData));
      devFp = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      localStorage.setItem(BROWSER_DEV_KEY, devFp);
    }
    return devFp;
  }

  // Fallback default
  return '0000000000000000000000000000000000000000000000000000000000000000';
}
```

---

## 6. Security Analysis & Threat Model

| Threat Scenario | Vector | Mitigation Mechanism |
| :--- | :--- | :--- |
| **Database & App Theft** | Malicious user copies `~/Library/Application Support/Starbucks Operations Suite` to personal laptop | **Mitigated**: `safeStorage.decryptString()` fails on destination laptop due to Keychain/DPAPI machine key barrier. If bypassed, `hardwareFingerprint` mismatch locks station. |
| **Network Interface Swapping** | User unplugs Ethernet or toggles Wi-Fi | **Mitigated**: MAC selection prioritizes `en0`/`eth0` and sorts remaining interfaces alphabetically. System UUID + CPU Model + Hostname remain stable. |
| **Virtual Machine Cloning** | Cloned VM instance | **Mitigated**: Hypervisors generate new DMI / IOPlatformUUID upon cloning unless manually forged. System MAC changes upon network adapter regeneration. |
| **Memory Dump Inspection** | Attacker attempts to read decrypted license key from memory | **Mitigated**: License envelope is loaded on-demand. Key material is cleared on session inactivity lock (`StoreKeyCache.clear()`). |
| **IPC Injection Attack** | Renderer script attempts to forge hardware fingerprint | **Mitigated**: Renderer does NOT supply its own fingerprint to `saveLicense` or `getHardwareFingerprint`; Main process harvests hardware directly from Node OS APIs. |

---

## 7. Verification & Testing Plan

### 7.1 Automated Unit Tests (`tests/security/hardwareIdManager.test.ts`)
1. **Determinism Verification**:
   - Calling `getHardwareFingerprint()` 100 consecutive times yields the identical 64-character lowercase hex string.
2. **Component Integrity**:
   - Verify that `platform`, `arch`, `cpuModel`, `cpuCores`, `primaryMac`, and `hostname` are populated and non-empty.
3. **Primary MAC Prioritization**:
   - Mock `os.networkInterfaces()` with `['utun0', 'awdl0', 'en0', 'docker0']` -> Verify `en0` MAC is selected.
4. **Environment Override**:
   - Set `process.env.SBX_TEST_HARDWARE_FINGERPRINT = 'abcd...64chars'` -> Verify returned fingerprint equals mock value.
5. **SafeStorage Encryption Round-Trip**:
   - Save license envelope -> Load license envelope -> Assert deep equality.
6. **Anti-Cloning Simulation**:
   - Save license on Mock Hardware A -> Attempt to verify on Mock Hardware B -> Assert `HARDWARE_MISMATCH` rejection.

### 7.2 Native Test Command
```bash
node --import tsx --test tests/security/hardwareIdManager.test.ts
```

---

*Report prepared by M1 Explorer 2 (`m1_fleet_explorer_2`) for Milestone 1 Orchestrator.*
