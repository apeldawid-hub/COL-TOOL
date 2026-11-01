/**
 * Starbucks Operations Suite — Hardware Identity Manager
 * File: electron/security/hardwareIdManager.ts
 *
 * Responsibilities:
 * 1. Harvest immutable machine identity across macOS, Windows, and Linux.
 * 2. Deterministically resolve primary physical MAC address.
 * 3. Generate canonical SHA-256 hardware fingerprint with salt 'sbx_hw_anchor_v1_'.
 * 4. Provide robust fallbacks for CI/CD test runners, headless environments, and browser preview.
 */

import os from 'os';
import fs from 'fs';
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

  // Salt pepper for hardware fingerprint derivation
  public static readonly FINGERPRINT_SALT = 'sbx_hw_anchor_v1_';

  public constructor() {}

  public static getInstance(): HardwareIdManager {
    if (!this.instance) {
      this.instance = new HardwareIdManager();
    }
    return this.instance;
  }

  /**
   * Resets cached fingerprint and components.
   * Essential for unit testing when simulating different hardware or environment variables.
   */
  public clearCache(): void {
    this.cachedFingerprint = null;
    this.cachedComponents = null;
  }

  public resetCache(): void {
    this.clearCache();
  }

  /**
   * Computes or returns the cached 64-hex SHA-256 deterministic hardware fingerprint.
   */
  public getHardwareFingerprint(): string {
    if (this.cachedFingerprint) {
      return this.cachedFingerprint;
    }

    // 1. Check for explicit test environment override (e.g. in Vitest / CI / node:test)
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

    // 4. Compute deterministic SHA-256 hash with salt 'sbx_hw_anchor_v1_'
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
   * macOS: Harvest IOPlatformUUID from IOKit registry via ioreg, with kern.uuid fallback.
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
    } catch (_) {
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
      const regOutput = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'ignore'] }
      );
      const match = regOutput.match(/MachineGuid\s+REG_SZ\s+([a-f0-9\-]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch (_) {
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
   * Synthetic fallback UUID for environments without OS-level UUIDs.
   */
  private getSyntheticFallbackUuid(): string {
    let username = 'user';
    try {
      username = os.userInfo().username;
    } catch (_) {}
    const seed = `${os.platform()}-${os.arch()}-${os.hostname()}-${username}`;
    return crypto.createHash('sha256').update(seed, 'utf8').digest('hex').substring(0, 32);
  }

  /**
   * Extracts primary physical network MAC address deterministically:
   * - Filters out internal, loopback (00:00:00:00:00:00), and ephemeral/virtual interfaces
   *   (awdl, llw, utun, tun, tap, docker, veth, vbox, vmnet, tailscale, wireguard, lo).
   * - Prioritizes en0, eth0, wlan0, ethernet, wi-fi.
   * - Deterministically sorts candidates alphabetically by name.
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
          priority = matchedIndex;
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

    candidates.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.name.localeCompare(b.name);
    });

    return candidates[0].mac;
  }
}

// Export singleton instance as requested
export const hardwareIdManager = HardwareIdManager.getInstance();
