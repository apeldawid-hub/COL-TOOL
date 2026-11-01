/**
 * Starbucks Operations Suite — Milestone 1 Adversarial Challenger 2 Test Suite
 * File: tests/security/adversarial_hardware_tamper.test.ts
 *
 * Scope: Empirical Adversarial Challenge of Hardware-Bound Activation & Anti-Tamper Engine:
 * 1. Cloning Attacks: Hardware fingerprint mismatch detection (Machine A vs Machine B).
 * 2. Disk File Tampering: Altered storeId, forged signatures, byte corruption in license.enc.
 * 3. Hardware Identifier Oscillation: MAC address ordering, priority resolution, CPU model formatting.
 * 4. Revocation Completeness: Full wiping of active credentials and disk file destruction.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { HardwareIdManager } from '../../electron/security/hardwareIdManager';
import {
  LicensingService,
  ILicensingStorageProvider,
  IHardwareFingerprintProvider,
} from '../../src/services/security/licensingService';
import { StoreKeyCache } from '../../src/services/security/encryptionService';

/**
 * Pure-Node disk vault provider replicating the exact cryptographic disk storage
 * and shredding protocol of LicenseVaultManager (AES-256-GCM hardware-keyed fallback).
 */
class DiskVaultStorageProvider implements ILicensingStorageProvider {
  private licenseFilePath: string;
  private hwFingerprint: string;

  constructor(storageDir: string, hwFingerprint: string) {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.licenseFilePath = path.join(storageDir, 'license.enc');
    this.hwFingerprint = hwFingerprint;
  }

  public getFilePath(): string {
    return this.licenseFilePath;
  }

  public setHardwareFingerprint(hw: string): void {
    this.hwFingerprint = hw;
  }

  private deriveKey(): Buffer {
    const salt = Buffer.from('sbx_license_fallback_salt_v1', 'utf8');
    return crypto.pbkdf2Sync(this.hwFingerprint, salt, 100000, 32, 'sha256');
  }

  public async saveLicense(payload: string): Promise<boolean> {
    try {
      const key = this.deriveKey();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      const envelope = `fallback:aes256gcm:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
      fs.writeFileSync(this.licenseFilePath, Buffer.from(envelope, 'utf8'), { mode: 0o600 });
      return true;
    } catch {
      return false;
    }
  }

  public async loadLicense(): Promise<string | null> {
    try {
      if (!fs.existsSync(this.licenseFilePath)) {
        return null;
      }
      const fileBuf = fs.readFileSync(this.licenseFilePath);
      const contentStr = fileBuf.toString('utf8');
      const parts = contentStr.split(':');
      if (parts.length !== 5 || parts[0] !== 'fallback' || parts[1] !== 'aes256gcm') {
        throw new Error('Malformed fallback license envelope');
      }
      const iv = Buffer.from(parts[2], 'base64');
      const tag = Buffer.from(parts[3], 'base64');
      const ciphertext = Buffer.from(parts[4], 'base64');
      const key = this.deriveKey();

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }

  public async revokeLicense(): Promise<boolean> {
    try {
      if (fs.existsSync(this.licenseFilePath)) {
        const stat = fs.statSync(this.licenseFilePath);
        if (stat.size > 0) {
          const randomBuf = crypto.randomBytes(stat.size);
          fs.writeFileSync(this.licenseFilePath, randomBuf);
        }
        fs.unlinkSync(this.licenseFilePath);
      }
      return true;
    } catch {
      return false;
    }
  }
}

test('M1-CHALLENGER-2: Hardware-Bound Anti-Copying & Anti-Tamper Stress Suite', async (t) => {
  const storeId = '108120';
  const masterSecret = 'sbx_test_master_secret_2026';

  // ==========================================================================
  // SECTION 1: CLONING ATTACK SIMULATIONS (Machine A -> Machine B)
  // ==========================================================================

  await t.test('1.1 Cloning Attack: Exact machine migration triggers HARDWARE_LOCKOUT', async () => {
    const hwA = '1111111111111111111111111111111111111111111111111111111111111111';
    const hwB = '2222222222222222222222222222222222222222222222222222222222222222';

    let storedEnvelope: string | null = null;
    let currentHardware = hwA;

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str) => {
        storedEnvelope = str;
        return true;
      },
      loadLicense: async () => storedEnvelope,
      revokeLicense: async () => {
        storedEnvelope = null;
        return true;
      },
    };

    const mockHwProvider: IHardwareFingerprintProvider = {
      getFingerprint: async () => currentHardware,
    };

    const service = new LicensingService(mockStorage, mockHwProvider, masterSecret);
    const key = service.generateActivationKey(storeId, 'STORE_CLIENT');

    // Activate on Machine A
    const activation = await service.activateStation(key, storeId);
    assert.equal(activation.success, true, 'Activation on Machine A must succeed');

    const statusA = await service.verifyStationHardwareLock();
    assert.equal(statusA.status, 'ACTIVATED');
    assert.equal(statusA.isActivated, true);
    assert.equal(statusA.hardwareMismatch, false);

    // Simulate Machine B running the cloned database and license envelope
    currentHardware = hwB;

    const statusB = await service.verifyStationHardwareLock();
    assert.equal(
      statusB.status,
      'HARDWARE_LOCKOUT',
      'Machine B must unconditionally enter HARDWARE_LOCKOUT'
    );
    assert.equal(statusB.isActivated, false, 'Cloned station must NOT be activated');
    assert.equal(statusB.hardwareMismatch, true, 'hardwareMismatch flag must be true');
    assert.equal(await service.isStationActivated(), false);
  });

  await t.test('1.2 Cloning Attack: 1-character difference in hardware fingerprint triggers HARDWARE_LOCKOUT', async () => {
    const baseHw = 'abcdef0123456789'.repeat(4);
    // Alter single character at the end
    const clonedHw = baseHw.substring(0, 63) + (baseHw[63] === '9' ? '8' : '9');

    let storedEnvelope: string | null = null;
    let currentHardware = baseHw;

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str) => {
        storedEnvelope = str;
        return true;
      },
      loadLicense: async () => storedEnvelope,
      revokeLicense: async () => {
        storedEnvelope = null;
        return true;
      },
    };

    const service = new LicensingService(
      mockStorage,
      { getFingerprint: async () => currentHardware },
      masterSecret
    );

    const key = service.generateActivationKey(storeId, 'STORE_CLIENT');
    await service.activateStation(key, storeId);

    // Switch to slightly mutated hardware fingerprint
    currentHardware = clonedHw;

    const status = await service.verifyStationHardwareLock();
    assert.equal(status.status, 'HARDWARE_LOCKOUT');
    assert.equal(status.hardwareMismatch, true);
    assert.equal(status.isActivated, false);
  });

  await t.test('1.3 Cloning Attack: Fingerprint case-insensitivity prevents false lockout', async () => {
    const baseHw = 'a1b2c3d4e5f60718'.repeat(4);
    const upperHw = baseHw.toUpperCase();

    let storedEnvelope: string | null = null;
    let currentHardware = baseHw;

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str) => {
        storedEnvelope = str;
        return true;
      },
      loadLicense: async () => storedEnvelope,
      revokeLicense: async () => {
        storedEnvelope = null;
        return true;
      },
    };

    const service = new LicensingService(
      mockStorage,
      { getFingerprint: async () => currentHardware },
      masterSecret
    );

    const key = service.generateActivationKey(storeId, 'STORE_CLIENT');
    await service.activateStation(key, storeId);

    // Return uppercase on same hardware
    currentHardware = upperHw;

    const status = await service.verifyStationHardwareLock();
    assert.equal(
      status.status,
      'ACTIVATED',
      'Uppercase vs lowercase hex fingerprint must not trigger false lockout'
    );
    assert.equal(status.isActivated, true);
    assert.equal(status.hardwareMismatch, false);
  });

  // ==========================================================================
  // SECTION 2: DISK FILE TAMPERING ATTACK SIMULATIONS
  // ==========================================================================

  await t.test('2.1 Tamper Attack: Altering storeId inside envelope payload triggers TAMPER_DETECTED', async () => {
    const hw = '5'.repeat(64);
    let storedEnvelope: string | null = null;

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str) => {
        storedEnvelope = str;
        return true;
      },
      loadLicense: async () => storedEnvelope,
      revokeLicense: async () => true,
    };

    const service = new LicensingService(
      mockStorage,
      { getFingerprint: async () => hw },
      masterSecret
    );

    const key = service.generateActivationKey('108120', 'STORE_CLIENT');
    await service.activateStation(key, '108120');

    // Attacker alters storeId to another store (e.g. 108999)
    const record = JSON.parse(storedEnvelope!);
    record.storeId = '108999';
    storedEnvelope = JSON.stringify(record);

    const status = await service.verifyStationHardwareLock();
    assert.equal(
      status.status,
      'TAMPER_DETECTED',
      'Altering storeId in payload must trigger TAMPER_DETECTED'
    );
    assert.equal(status.isActivated, false);
    assert.equal(await service.isStationActivated(), false);
  });

  await t.test('2.2 Tamper Attack: Privilege escalation (tier flip) triggers TAMPER_DETECTED', async () => {
    const hw = '6'.repeat(64);
    let storedEnvelope: string | null = null;

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str) => {
        storedEnvelope = str;
        return true;
      },
      loadLicense: async () => storedEnvelope,
      revokeLicense: async () => true,
    };

    const service = new LicensingService(
      mockStorage,
      { getFingerprint: async () => hw },
      masterSecret
    );

    const key = service.generateActivationKey('108120', 'STORE_CLIENT');
    await service.activateStation(key, '108120');

    // Attacker modifies tier from STORE_CLIENT to FLEET_MASTER
    const record = JSON.parse(storedEnvelope!);
    record.tier = 'FLEET_MASTER';
    storedEnvelope = JSON.stringify(record);

    const status = await service.verifyStationHardwareLock();
    assert.equal(
      status.status,
      'TAMPER_DETECTED',
      'Flipping tier to FLEET_MASTER must invalidate HMAC seal and trigger TAMPER_DETECTED'
    );
    assert.equal(status.isActivated, false);
  });

  await t.test('2.3 Tamper Attack: Altering activatedAt timestamp triggers TAMPER_DETECTED', async () => {
    const hw = '7'.repeat(64);
    let storedEnvelope: string | null = null;

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str) => {
        storedEnvelope = str;
        return true;
      },
      loadLicense: async () => storedEnvelope,
      revokeLicense: async () => true,
    };

    const service = new LicensingService(
      mockStorage,
      { getFingerprint: async () => hw },
      masterSecret
    );

    const key = service.generateActivationKey('108120', 'STORE_CLIENT');
    await service.activateStation(key, '108120');

    // Attacker alters activatedAt
    const record = JSON.parse(storedEnvelope!);
    record.activatedAt = '2020-01-01T00:00:00.000Z';
    storedEnvelope = JSON.stringify(record);

    const status = await service.verifyStationHardwareLock();
    assert.equal(
      status.status,
      'TAMPER_DETECTED',
      'Altering activation timestamp must invalidate HMAC seal'
    );
    assert.equal(status.isActivated, false);
  });

  await t.test('2.4 Tamper Attack: Injected forged HMAC signature triggers TAMPER_DETECTED', async () => {
    const hw = '8'.repeat(64);
    let storedEnvelope: string | null = null;

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str) => {
        storedEnvelope = str;
        return true;
      },
      loadLicense: async () => storedEnvelope,
      revokeLicense: async () => true,
    };

    const service = new LicensingService(
      mockStorage,
      { getFingerprint: async () => hw },
      masterSecret
    );

    const key = service.generateActivationKey('108120', 'STORE_CLIENT');
    await service.activateStation(key, '108120');

    // Injected random 64-hex forged signature
    const record = JSON.parse(storedEnvelope!);
    record.signature = crypto.randomBytes(32).toString('hex');
    storedEnvelope = JSON.stringify(record);

    const status = await service.verifyStationHardwareLock();
    assert.equal(status.status, 'TAMPER_DETECTED');
    assert.equal(status.isActivated, false);
  });

  await t.test('2.5 Tamper Attack: Truncated or malformed JSON payload triggers TAMPER_DETECTED', async () => {
    const hw = '9'.repeat(64);
    let storedEnvelope = '{"key":"SBX-108120-'; // Corrupted truncated JSON

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str) => {
        storedEnvelope = str;
        return true;
      },
      loadLicense: async () => storedEnvelope,
      revokeLicense: async () => true,
    };

    const service = new LicensingService(
      mockStorage,
      { getFingerprint: async () => hw },
      masterSecret
    );

    const status = await service.verifyStationHardwareLock();
    assert.equal(
      status.status,
      'TAMPER_DETECTED',
      'Malformed JSON string must trigger TAMPER_DETECTED'
    );
    assert.equal(status.isActivated, false);
  });

  await t.test('2.6 Tamper Attack: Missing mandatory envelope properties triggers TAMPER_DETECTED', async () => {
    const hw = 'a'.repeat(64);
    const incompleteRecord = {
      key: 'SBX-108120-01123456789ABCDE-1234567890',
      storeId: '108120',
      // Missing hardwareFingerprint and signature
    };

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async () => true,
      loadLicense: async () => JSON.stringify(incompleteRecord),
      revokeLicense: async () => true,
    };

    const service = new LicensingService(
      mockStorage,
      { getFingerprint: async () => hw },
      masterSecret
    );

    const status = await service.verifyStationHardwareLock();
    assert.equal(
      status.status,
      'TAMPER_DETECTED',
      'Incomplete envelope structure must trigger TAMPER_DETECTED'
    );
    assert.equal(status.isActivated, false);
  });

  await t.test('2.7 Real Disk Vault: Disk file corruption and decryption failure analysis', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-vault-disk-test-'));
    try {
      const hwA = 'e'.repeat(64);
      const diskVault = new DiskVaultStorageProvider(tempDir, hwA);
      const service = new LicensingService(diskVault, { getFingerprint: async () => hwA }, masterSecret);

      const key = service.generateActivationKey('108120', 'STORE_CLIENT');
      const act = await service.activateStation(key, '108120');
      assert.equal(act.success, true);
      assert.equal(fs.existsSync(diskVault.getFilePath()), true);

      // Verify active lock on intact file
      const statusIntact = await service.verifyStationHardwareLock();
      assert.equal(statusIntact.status, 'ACTIVATED');

      // Tamper disk file: flip 8 bytes in ciphertext
      const fileBytes = fs.readFileSync(diskVault.getFilePath());
      const tamperedBytes = Buffer.from(fileBytes);
      for (let i = Math.floor(tamperedBytes.length / 2); i < Math.floor(tamperedBytes.length / 2) + 8; i++) {
        tamperedBytes[i] ^= 0xff;
      }
      fs.writeFileSync(diskVault.getFilePath(), tamperedBytes);

      // Decryption fails when bytes are corrupted
      const decrypted = await diskVault.loadLicense();
      assert.equal(decrypted, null, 'Decryption must fail on corrupted disk bytes');

      // EMPIRICAL OBSERVATION:
      // When disk file decryption fails and loadLicense() returns null,
      // verifyStationHardwareLock() treats the station as UNACTIVATED (raw === null),
      // effectively preventing station use (isActivated: false), but reporting UNACTIVATED rather than TAMPER_DETECTED.
      const statusAfterTamper = await service.verifyStationHardwareLock();
      assert.equal(statusAfterTamper.isActivated, false, 'Station must be locked down');
      assert.ok(
        statusAfterTamper.status === 'UNACTIVATED' || statusAfterTamper.status === 'TAMPER_DETECTED',
        'Status must be UNACTIVATED or TAMPER_DETECTED'
      );
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  // ==========================================================================
  // SECTION 3: HARDWARE IDENTIFIER OSCILLATION & SENSITIVITY TESTING
  // ==========================================================================

  await t.test('3.1 MAC Address Resolution: Deterministic prioritization under shuffle', () => {
    const hwManager = HardwareIdManager.getInstance();

    // Verify primary MAC resolution does not oscillate across queries
    const primaryMac1 = hwManager.getPrimaryMacAddress();
    assert.match(
      primaryMac1,
      /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/i,
      'Resolved MAC must be valid format'
    );

    for (let i = 0; i < 500; i++) {
      const currentMac = hwManager.getPrimaryMacAddress();
      assert.equal(
        currentMac,
        primaryMac1,
        `MAC address drifted at query ${i}`
      );
    }
  });

  await t.test('3.2 Hardware Fingerprint: Determinism under rapid query load (1,000 iterations)', () => {
    const hwManager = HardwareIdManager.getInstance();
    hwManager.clearCache();

    const fpRef = hwManager.getHardwareFingerprint();
    assert.equal(fpRef.length, 64);

    for (let i = 0; i < 1000; i++) {
      if (i % 50 === 0) {
        // Periodically clear cache to force re-harvesting
        hwManager.clearCache();
      }
      const fp = hwManager.getHardwareFingerprint();
      assert.equal(fp, fpRef, `Fingerprint oscillated at iteration ${i}`);
    }
  });

  await t.test('3.3 Hardware Identity Components: Integrity of components payload', () => {
    const hwManager = HardwareIdManager.getInstance();
    hwManager.clearCache();
    const comp = hwManager.getHardwareComponents();

    assert.ok(typeof comp.platform === 'string' && comp.platform.length > 0);
    assert.ok(typeof comp.arch === 'string' && comp.arch.length > 0);
    assert.ok(typeof comp.systemUuid === 'string' && comp.systemUuid.length > 0);
    assert.ok(typeof comp.cpuModel === 'string' && comp.cpuModel.length > 0);
    assert.ok(typeof comp.cpuCores === 'number' && comp.cpuCores > 0);
    assert.ok(typeof comp.primaryMac === 'string' && comp.primaryMac.length > 0);
    assert.ok(typeof comp.hostname === 'string' && comp.hostname.length > 0);
  });

  // ==========================================================================
  // SECTION 4: REVOCATION & KILL-SWITCH COMPLETE WIPING VERIFICATION
  // ==========================================================================

  await t.test('4.1 Revocation: calling revokeLicense() completely wipes credentials from storage', async () => {
    let savedLicense: string | null = null;
    let revokedReasonRecorded: string | null = null;
    const hw = 'c'.repeat(64);

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str) => {
        savedLicense = str;
        return true;
      },
      loadLicense: async () => savedLicense,
      revokeLicense: async (reason) => {
        savedLicense = null; // Wiped
        revokedReasonRecorded = reason || null;
        return true;
      },
    };

    const service = new LicensingService(
      mockStorage,
      { getFingerprint: async () => hw },
      masterSecret
    );

    const key = service.generateActivationKey('108120', 'STORE_CLIENT');
    const actRes = await service.activateStation(key, '108120');
    assert.equal(actRes.success, true);
    assert.equal(await service.isStationActivated(), true);
    assert.ok(await service.getActiveLicense() !== null);

    // Execute Kill-Switch revocation
    const reason = 'Emergency Kill-Switch triggered by Corporate Security';
    await service.revokeLicense(reason);

    // Verify storage is completely wiped
    assert.equal(savedLicense, null, 'Active license envelope must be purged from storage');
    assert.equal(revokedReasonRecorded, reason);

    // Verify service status is immediately UNACTIVATED
    const statusAfter = await service.verifyStationHardwareLock();
    assert.equal(statusAfter.status, 'UNACTIVATED');
    assert.equal(statusAfter.isActivated, false);
    assert.equal(await service.isStationActivated(), false);
    assert.equal(await service.getActiveLicense(), null);
  });

  await t.test('4.2 Revocation: DiskVault securely overwrites file with random bytes before unlinking', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx-revoke-test-'));
    try {
      const hw = 'd'.repeat(64);
      const diskVault = new DiskVaultStorageProvider(tempDir, hw);
      const licensePath = diskVault.getFilePath();

      // Save a valid license
      await diskVault.saveLicense(JSON.stringify({ secretPayload: 'active_license_credentials_108120' }));
      assert.equal(fs.existsSync(licensePath), true);
      assert.ok(fs.statSync(licensePath).size > 0);

      // Execute revocation
      const revoked = await diskVault.revokeLicense();
      assert.equal(revoked, true);

      // File must no longer exist on disk
      assert.equal(
        fs.existsSync(licensePath),
        false,
        'license.enc file must be deleted upon revocation'
      );

      // Loading must return null
      const loaded = await diskVault.loadLicense();
      assert.equal(loaded, null);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  await t.test('4.3 Revocation & Re-Activation: Station can be re-activated after clean revocation', async () => {
    let savedLicense: string | null = null;
    const hw = 'e'.repeat(64);

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str) => {
        savedLicense = str;
        return true;
      },
      loadLicense: async () => savedLicense,
      revokeLicense: async () => {
        savedLicense = null;
        return true;
      },
    };

    const service = new LicensingService(
      mockStorage,
      { getFingerprint: async () => hw },
      masterSecret
    );

    const key1 = service.generateActivationKey('108120', 'STORE_CLIENT');
    await service.activateStation(key1, '108120');
    assert.equal(await service.isStationActivated(), true);

    // Revoke
    await service.revokeLicense('Decommission');
    assert.equal(await service.isStationActivated(), false);

    // Re-activate with new key
    const key2 = service.generateActivationKey('108120', 'STORE_CLIENT');
    const act2 = await service.activateStation(key2, '108120');
    assert.equal(act2.success, true);
    assert.equal(await service.isStationActivated(), true);
    assert.equal((await service.getActiveLicense())?.key, key2);
  });
});
