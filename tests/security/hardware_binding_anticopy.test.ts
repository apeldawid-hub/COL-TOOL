/**
 * Starbucks Operations Suite — Milestone 1 Security Test Suite
 * File: tests/security/hardware_binding_anticopy.test.ts
 *
 * Scope: Features F2 & F3 — Hardware Fingerprint Gathering & Anti-Copying Enforcement
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { HardwareIdManager } from '../../electron/security/hardwareIdManager';
import {
  LicensingService,
  ILicensingStorageProvider,
  IHardwareFingerprintProvider,
} from '../../src/services/security/licensingService';
import { StoreKeyCache } from '../../src/services/security/encryptionService';

test('M1-F2/F3: Hardware Identity & Anti-Copying Enforcement', async (t) => {
  const storeId = '108120';
  const masterSecret = 'sbx_test_master_secret_2026';

  // --------------------------------------------------------------------------
  // 1. Hardware Fingerprint Consistency & Determinism
  // --------------------------------------------------------------------------
  await t.test('test_f2_hardware_fingerprint_deterministic_stability', () => {
    const hwManager = HardwareIdManager.getInstance();
    hwManager.clearCache();

    // First invocation
    const fp1 = hwManager.getHardwareFingerprint();
    assert.match(fp1, /^[a-f0-9]{64}$/, 'Fingerprint must be 64-character SHA-256 hex string');

    // 100 consecutive invocations on the same host must be identical
    for (let i = 0; i < 100; i++) {
      const fpNext = hwManager.getHardwareFingerprint();
      assert.equal(fpNext, fp1, `Fingerprint drifted at iteration ${i}`);
    }
  });

  await t.test('test_f2_test_environment_override', () => {
    const hwManager = HardwareIdManager.getInstance();
    const mockFingerprint = 'f'.repeat(64);

    process.env.SBX_TEST_HARDWARE_FINGERPRINT = mockFingerprint;
    hwManager.clearCache();

    assert.equal(
      hwManager.getHardwareFingerprint(),
      mockFingerprint,
      'HardwareIdManager must respect SBX_TEST_HARDWARE_FINGERPRINT'
    );

    delete process.env.SBX_TEST_HARDWARE_FINGERPRINT;
    hwManager.clearCache();
  });

  await t.test('test_f2_hardware_components_harvesting', () => {
    const hwManager = HardwareIdManager.getInstance();
    hwManager.clearCache();
    const components = hwManager.getHardwareComponents();

    assert.ok(components.platform.length > 0, 'Platform must be present');
    assert.ok(components.arch.length > 0, 'Arch must be present');
    assert.ok(components.systemUuid.length > 0, 'System UUID must be present');
    assert.ok(components.cpuModel.length > 0, 'CPU model must be present');
    assert.ok(components.cpuCores > 0, 'CPU core count must be greater than 0');
    assert.ok(components.primaryMac.length > 0, 'Primary MAC must be resolved');
    assert.ok(components.hostname.length > 0, 'Hostname must be present');
  });

  // --------------------------------------------------------------------------
  // 2. Station Activation Round-Trip (Valid Key + Hardware Binding)
  // --------------------------------------------------------------------------
  await t.test('test_f3_station_activation_round_trip', async () => {
    let savedLicenseStr: string | null = null;
    const mockHw = '1'.repeat(64);

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str: string) => {
        savedLicenseStr = str;
        return true;
      },
      loadLicense: async () => savedLicenseStr,
      revokeLicense: async () => {
        savedLicenseStr = null;
        return true;
      },
    };

    const mockHwProvider: IHardwareFingerprintProvider = {
      getFingerprint: async () => mockHw,
    };

    const service = new LicensingService(mockStorage, mockHwProvider, masterSecret);

    // Generate valid key
    const validKey = service.generateActivationKey(storeId, 'STORE_CLIENT');

    // Activate station
    const activationRes = await service.activateStation(validKey, storeId);
    assert.equal(activationRes.success, true, 'Activation must succeed with valid key and store');
    assert.ok(activationRes.license, 'ActiveLicenseRecord must be returned');
    assert.equal(activationRes.license?.storeId, storeId);
    assert.equal(activationRes.license?.hardwareFingerprint, mockHw);

    // Verify station status
    const status = await service.verifyStationHardwareLock();
    assert.equal(status.status, 'ACTIVATED', 'Station status must be ACTIVATED');
    assert.equal(status.isActivated, true);
    assert.equal(status.hardwareMismatch, false);
    assert.equal(status.revoked, false);

    // isStationActivated check
    const isActivated = await service.isStationActivated();
    assert.equal(isActivated, true);
  });

  // --------------------------------------------------------------------------
  // 3. Anti-Cloning & Machine Migration Rejection (Hardware Mismatch)
  // --------------------------------------------------------------------------
  await t.test('test_f3_anti_cloning_machine_migration_rejection', async () => {
    const hwA = 'a'.repeat(64);
    const hwB = 'b'.repeat(64);

    let savedLicenseStr: string | null = null;
    let currentHostHw = hwA;

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str: string) => {
        savedLicenseStr = str;
        return true;
      },
      loadLicense: async () => savedLicenseStr,
      revokeLicense: async () => {
        savedLicenseStr = null;
        return true;
      },
    };

    const mockHwProvider: IHardwareFingerprintProvider = {
      getFingerprint: async () => currentHostHw,
    };

    const service = new LicensingService(mockStorage, mockHwProvider, masterSecret);

    // 1. Activate on Machine A
    const key = service.generateActivationKey(storeId, 'STORE_CLIENT');
    currentHostHw = hwA;
    const activationRes = await service.activateStation(key, storeId);
    assert.equal(activationRes.success, true, 'Activation on Machine A must succeed');

    // 2. Verification on Machine A succeeds
    const statusOnMachineA = await service.verifyStationHardwareLock();
    assert.equal(statusOnMachineA.status, 'ACTIVATED');
    assert.equal(statusOnMachineA.isActivated, true);
    assert.equal(statusOnMachineA.hardwareMismatch, false);

    // 3. Machine Migration: Simulate app files cloned to Machine B
    currentHostHw = hwB;
    const statusOnMachineB = await service.verifyStationHardwareLock();

    assert.equal(
      statusOnMachineB.status,
      'HARDWARE_LOCKOUT',
      'Machine B must enter HARDWARE_LOCKOUT'
    );
    assert.equal(
      statusOnMachineB.hardwareMismatch,
      true,
      'Machine B must report hardwareMismatch === true'
    );
    assert.equal(
      statusOnMachineB.isActivated,
      false,
      'Station on Machine B must not be permitted to operate'
    );

    const isActivatedOnB = await service.isStationActivated();
    assert.equal(isActivatedOnB, false);
  });

  // --------------------------------------------------------------------------
  // 4. Tampered Signature Detection
  // --------------------------------------------------------------------------
  await t.test('test_f3_tampered_signature_detection', async () => {
    const hw = 'c'.repeat(64);
    const tamperedLicense = {
      version: 'v1',
      key: 'SBX-108120-01A4F8B2C9013D7E-7F2A9B8C1D',
      storeId: '108120',
      tier: 'STORE_CLIENT',
      hardwareFingerprint: hw,
      activatedAt: new Date().toISOString(),
      signature: 'BAD_FORGED_SIGNATURE_99999999999999999999999999999999',
      revoked: false,
    };

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async () => true,
      loadLicense: async () => JSON.stringify(tamperedLicense),
      revokeLicense: async () => true,
    };

    const mockHwProvider: IHardwareFingerprintProvider = {
      getFingerprint: async () => hw,
    };

    const service = new LicensingService(mockStorage, mockHwProvider, masterSecret);

    const status = await service.verifyStationHardwareLock();
    assert.equal(
      status.status,
      'TAMPER_DETECTED',
      'Tampered signature must trigger TAMPER_DETECTED status'
    );
    assert.equal(status.isActivated, false);
    assert.ok(status.error?.includes('Podpis') || status.error?.includes('modyfikację'));
  });

  await t.test('test_f3_tampered_store_id_in_license_envelope', async () => {
    const hw = 'd'.repeat(64);
    let savedLicenseStr: string | null = null;

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str: string) => {
        savedLicenseStr = str;
        return true;
      },
      loadLicense: async () => savedLicenseStr,
      revokeLicense: async () => true,
    };

    const mockHwProvider: IHardwareFingerprintProvider = {
      getFingerprint: async () => hw,
    };

    const service = new LicensingService(mockStorage, mockHwProvider, masterSecret);
    const key = service.generateActivationKey('108120', 'STORE_CLIENT');
    await service.activateStation(key, '108120');

    // Attacker modifies storeId in the JSON envelope
    const parsed = JSON.parse(savedLicenseStr!);
    parsed.storeId = '108999'; // Tampering storeId
    savedLicenseStr = JSON.stringify(parsed);

    const status = await service.verifyStationHardwareLock();
    assert.equal(
      status.status,
      'TAMPER_DETECTED',
      'Tampered storeId in active license envelope must fail cryptographic HMAC check'
    );
    assert.equal(status.isActivated, false);
  });

  // --------------------------------------------------------------------------
  // 5. License Revocation (Kill-Switch)
  // --------------------------------------------------------------------------
  await t.test('test_f3_license_revocation_returns_unactivated', async () => {
    let savedLicenseStr: string | null = null;
    const hw = 'e'.repeat(64);

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str: string) => {
        savedLicenseStr = str;
        return true;
      },
      loadLicense: async () => savedLicenseStr,
      revokeLicense: async () => {
        savedLicenseStr = null;
        return true;
      },
    };

    const mockHwProvider: IHardwareFingerprintProvider = {
      getFingerprint: async () => hw,
    };

    const service = new LicensingService(mockStorage, mockHwProvider, masterSecret);
    const key = service.generateActivationKey(storeId, 'STORE_CLIENT');
    await service.activateStation(key, storeId);

    // Confirm activated
    assert.equal(await service.isStationActivated(), true);

    // Revoke license
    await service.revokeLicense('Station decommissioned');

    // After revocation, license file is wiped -> returns UNACTIVATED
    const status = await service.verifyStationHardwareLock();
    assert.equal(status.status, 'UNACTIVATED');
    assert.equal(status.isActivated, false);
    assert.equal(await service.isStationActivated(), false);
  });

  await t.test('test_f3_persisted_revoked_envelope_triggers_hardware_lockout', async () => {
    let savedLicenseStr: string | null = null;
    const hw = 'f'.repeat(64);

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str: string) => {
        savedLicenseStr = str;
        return true;
      },
      loadLicense: async () => savedLicenseStr,
      revokeLicense: async () => true, // Preserves envelope file with revoked: true
    };

    const mockHwProvider: IHardwareFingerprintProvider = {
      getFingerprint: async () => hw,
    };

    const service = new LicensingService(mockStorage, mockHwProvider, masterSecret);
    const key = service.generateActivationKey(storeId, 'STORE_CLIENT');
    await service.activateStation(key, storeId);

    // Revoke license (saves revoked envelope with sealed REVOKED status)
    await service.revokeLicense('Remote kill-switch');

    // Verification must detect valid signature with revoked: true -> HARDWARE_LOCKOUT
    const status = await service.verifyStationHardwareLock();
    assert.equal(status.status, 'HARDWARE_LOCKOUT');
    assert.equal(status.revoked, true);
    assert.equal(status.isActivated, false);
  });

  // --------------------------------------------------------------------------
  // 6. In-Memory Key Zeroization on Lockout
  // --------------------------------------------------------------------------
  await t.test('test_f3_in_memory_key_zeroization_on_lockout', () => {
    // 1. Populate StoreKeyCache with cryptographic key buffer
    const mockKey = Buffer.from('0123456789abcdef0123456789abcdef', 'utf8');
    StoreKeyCache.set('108120', '18120', 'hash_01', mockKey);
    assert.equal(StoreKeyCache.size(), 1, 'Cache must contain 1 active SEK');

    // 2. Execute zeroization protocol
    StoreKeyCache.clear();

    // 3. Verify cache is empty and buffer is wiped
    assert.equal(StoreKeyCache.size(), 0, 'Cache must be empty after clear()');

    // Check that memory was zeroized (Buffer.fill(0))
    const isAllZeros = mockKey.every((byte) => byte === 0);
    assert.equal(isAllZeros, true, 'Key buffer in memory must be overwritten with zeros');
  });
});
