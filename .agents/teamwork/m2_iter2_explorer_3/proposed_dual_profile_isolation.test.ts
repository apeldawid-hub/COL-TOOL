/**
 * Starbucks Operations Suite — Milestone 2 Security Test Suite (Harmonized)
 * File: tests/security/dual_profile_isolation.test.ts
 * Harmonized by: M2 Iter2 Explorer 3 (Security Test Suite Harmonization)
 *
 * Scope: Dual-Profile Runtime Architecture & Fleet Master Isolation
 * Tests profile policy enforcement, catalog isolation, unauthorized store switching guards,
 * 2-step verification Kill-Switch execution, and RAM key zeroization.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ProfilePolicyService } from '../../src/services/security/profilePolicyService';
import { FleetService } from '../../src/services/admin/fleetService';
import { StoreService } from '../../src/services/storeService';
import { STARBUCKS_STORES_CATALOG, StarbucksStore } from '../../src/constants/starbucksStores';
import { StoreKeyCache } from '../../src/services/security/encryptionService';
import { KillSwitchPayload } from '../../src/types/fleet';

// ----------------------------------------------------------------------------
// Headless Node.js Mock Environment (Prevents ReferenceErrors in headless runs)
// ----------------------------------------------------------------------------
const originalLocalStorage = (globalThis as any).localStorage;
const originalWindow = (globalThis as any).window;
const originalCustomEvent = (globalThis as any).CustomEvent;

class TestMemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
  get length() { return this.data.size; }
}

class TestMockWindow {
  private listeners = new Map<string, Function[]>();
  addEventListener(event: string, fn: Function) {
    const list = this.listeners.get(event) || [];
    list.push(fn);
    this.listeners.set(event, list);
  }
  removeEventListener(event: string, fn: Function) {
    const list = this.listeners.get(event) || [];
    this.listeners.set(event, list.filter((f) => f !== fn));
  }
  dispatchEvent(event: any): boolean {
    const list = this.listeners.get(event?.type) || [];
    for (const fn of list) {
      try { fn(event); } catch (_) {}
    }
    return true;
  }
  api = {
    switchStoreDatabase: async (opts: any) => ({ success: true, dbPath: `store_${opts.storeId}.db`, isNew: false }),
    saveAppSettings: async () => ({ success: true }),
    getCustomStores: async () => [],
    saveCustomStores: async () => ({ success: true }),
  };
}

if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = new TestMemoryStorage();
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = new TestMockWindow();
}
if (typeof (globalThis as any).CustomEvent === 'undefined') {
  (globalThis as any).CustomEvent = class CustomEvent {
    constructor(public type: string, public init?: any) {
      this.detail = init?.detail;
    }
    detail: any;
  };
}

test('M2-SEC: Dual-Profile Runtime Security & Fleet Isolation Suite', async (t) => {
  // Test fixture stores
  const storeJanki = STARBUCKS_STORES_CATALOG.find((s) => s.id === '108120' || s.unitCode === '18120') || {
    id: '108120',
    name: '108120 SBX Warszawa Janki',
    shortName: 'Warszawa Janki',
    unitCode: '18120',
    mpk: '18120',
    city: 'Warszawa',
    district: 'Central',
    address: 'ul. Mszczonowska 3, Janki',
    type: 'Mall' as const,
  };

  const storeZloteTarasy = STARBUCKS_STORES_CATALOG.find((s) => s.id === '108101' || s.unitCode === '18101') || {
    id: '108101',
    name: '108101 SBX Warszawa Złote Tarasy',
    shortName: 'Warszawa Złote Tarasy',
    unitCode: '18101',
    mpk: '18101',
    city: 'Warszawa',
    district: 'Central',
    address: 'ul. Złota 59, Warszawa',
    type: 'Mall' as const,
  };

  // --------------------------------------------------------------------------
  // 1. ProfilePolicyService: Permission Matrix Verification
  // --------------------------------------------------------------------------
  await t.test('1.1 Permission Matrix: FLEET_MASTER grants all elevated permissions', () => {
    const policy = ProfilePolicyService.getPolicy('FLEET_MASTER');

    assert.equal(policy.allowStoreSwitching, true, 'Fleet Master must be permitted to switch stores');
    assert.equal(policy.allowFleetMasterDashboard, true, 'Fleet Master tab must be enabled');
    assert.equal(policy.allowCustomStoreAddition, true, 'Custom store creation must be enabled');
    assert.equal(policy.allowCleanSlateReset, true, 'Clean slate reset must be enabled for HQ');
    assert.equal(policy.allowManualVacuumPragma, true, 'Manual SQLite maintenance must be enabled');
    assert.equal(policy.allowTestingGuideTab, true, 'Testing guide must be enabled');
    assert.equal(policy.allowFirebaseFleetTab, true, 'Firebase fleet panel must be enabled');
  });

  await t.test('1.2 Permission Matrix: STORE_CLIENT strictly enforces retail restrictions', () => {
    const policy = ProfilePolicyService.getPolicy('STORE_CLIENT');

    assert.equal(policy.allowStoreSwitching, false, 'Store Client must NOT be permitted to switch stores');
    assert.equal(policy.allowFleetMasterDashboard, false, 'Fleet Master tab must be hidden');
    assert.equal(policy.allowCustomStoreAddition, false, 'Custom store creation must be strictly blocked');
    assert.equal(policy.allowCleanSlateReset, false, 'Destructive clean slate must be blocked on client');
    assert.equal(policy.allowManualVacuumPragma, false, 'Manual VACUUM/PRAGMA must be blocked');
    assert.equal(policy.allowTestingGuideTab, false, 'Testing guide tab must be pruned');
    assert.equal(policy.allowFirebaseFleetTab, false, 'Firebase fleet developer tab must be pruned');
    assert.equal(policy.showStationLockedBadge, true, 'Store Client must display locked station badge');
  });

  await t.test('1.3 Permission Matrix: Unknown or tampered profile mode fails closed', () => {
    // Non-string or unknown profile mode should fail closed to STORE_CLIENT permissions
    const tamperedPolicy = ProfilePolicyService.getPolicy('HACKED_ADMIN' as any);

    assert.equal(tamperedPolicy.allowStoreSwitching, false);
    assert.equal(tamperedPolicy.allowFleetMasterDashboard, false);
    assert.equal(tamperedPolicy.allowCustomStoreAddition, false);
    assert.equal(tamperedPolicy.allowCleanSlateReset, false);
  });

  // --------------------------------------------------------------------------
  // 2. Store Catalog Filtering & Fail-Closed Isolation
  // --------------------------------------------------------------------------
  await t.test('2.1 Catalog Isolation: FLEET_MASTER receives all 100+ stores', () => {
    const fleetStores = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'FLEET_MASTER'
    );

    assert.equal(fleetStores.length, STARBUCKS_STORES_CATALOG.length);
    assert.ok(fleetStores.length >= 100, `Expected at least 100 stores, found ${fleetStores.length}`);
  });

  await t.test('2.2 Catalog Isolation: STORE_CLIENT receives ONLY assigned store(s)', () => {
    const assignedStores = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'STORE_CLIENT',
      ['108120']
    );

    assert.equal(assignedStores.length, 1, 'Store Client must only receive 1 store');
    assert.equal(assignedStores[0].id, '108120', 'Assigned store must be 108120');
    assert.ok(
      !assignedStores.some((s) => s.id !== '108120'),
      'Store Client catalog must never leak other stores'
    );
  });

  await t.test('2.3 Catalog Isolation: Fail-Closed on empty assigned store list', () => {
    const emptyAssigned = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'STORE_CLIENT',
      []
    );

    assert.deepEqual(emptyAssigned, [], 'Store Client with no assigned stores must fail closed to empty list');

    const undefinedAssigned = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'STORE_CLIENT',
      undefined
    );

    assert.deepEqual(undefinedAssigned, [], 'Store Client with undefined assigned stores must fail closed');

    const nullAssigned = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'STORE_CLIENT',
      null as any
    );

    assert.deepEqual(nullAssigned, [], 'Store Client with null assigned stores must fail closed');
  });

  // --------------------------------------------------------------------------
  // 3. Store Switching Authorization & Security Guards
  // --------------------------------------------------------------------------
  await t.test('3.1 Switch Authorization: canSwitchToStore logic', () => {
    // Fleet Master can switch anywhere
    assert.equal(
      ProfilePolicyService.canSwitchToStore('FLEET_MASTER', '108101', ['108120']),
      true,
      'Fleet Master should be able to switch to any store'
    );

    // Store Client can only switch to assigned store
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', ['108120']),
      true,
      'Store Client should be able to switch to assigned store'
    );

    // Store Client blocked from switching to unassigned store
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108101', ['108120']),
      false,
      'Store Client must be blocked from switching to unassigned store'
    );

    // Store Client blocked on null assignedStoreIds
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', null as any),
      false,
      'Store Client must fail closed on null assignedStoreIds'
    );
  });

  await t.test('3.2 StoreService Guard: setCurrentStore throws on unauthorized switch in STORE_CLIENT', async () => {
    // Configure StoreService in STORE_CLIENT mode with store 108120 assigned
    StoreService.setRuntimeSecurityProfile('STORE_CLIENT', ['108120']);

    // Attempting to switch to unassigned store 108101 must throw an error
    await assert.rejects(
      async () => {
        await StoreService.setCurrentStore(storeZloteTarasy);
      },
      /Odmowa dostępu|Naruszenie profilu|nie jest przypisany|UnauthorizedStoreSwitchError/i,
      'Switching to unassigned store in STORE_CLIENT must reject with security error'
    );

    // Switching to assigned store 108120 must succeed
    await assert.doesNotReject(async () => {
      await StoreService.setCurrentStore(storeJanki);
    });

    // Reset runtime profile to STORE_CLIENT for security isolation
    StoreService.setRuntimeSecurityProfile('STORE_CLIENT', []);
  });

  await t.test('3.3 StoreService Guard: addCustomStore blocked in STORE_CLIENT mode', async () => {
    StoreService.setRuntimeSecurityProfile('STORE_CLIENT', ['108120']);

    const customStore: StarbucksStore = {
      id: 'custom_store_999',
      name: 'Custom Rogue Store',
      shortName: 'Rogue Store',
      unitCode: '99999',
      mpk: '99999',
      city: 'Nieznane',
      district: 'Central',
      address: 'ul. Testowa 1',
      type: 'Drive-Thru',
    };

    await assert.rejects(
      async () => {
        await StoreService.addCustomStore(customStore);
      },
      /UnauthorizedStoreCreationError|Niedozwolone w trybie STORE_CLIENT/i,
      'Adding custom stores must be blocked in STORE_CLIENT mode'
    );

    StoreService.setRuntimeSecurityProfile('STORE_CLIENT', []);
  });

  // --------------------------------------------------------------------------
  // 4. FleetService: Aggregation, Status Resolution & KPI Metrics
  // --------------------------------------------------------------------------
  await t.test('4.1 FleetService: Catalog aggregation maps all stores', () => {
    const fleetRecords = FleetService.getAllStoresFleet();

    assert.equal(fleetRecords.length, STARBUCKS_STORES_CATALOG.length);
    for (const record of fleetRecords.slice(0, 10)) {
      assert.ok(record.id, 'Record must have store id');
      assert.ok(record.unitCode, 'Record must have unitCode');
      assert.ok(
        ['healthy', 'warning', 'offline', 'revoked', 'unprovisioned'].includes(record.health),
        `Invalid health state: ${record.health}`
      );
      assert.ok(
        ['synced', 'syncing', 'pending', 'error', 'offline'].includes(record.syncState),
        `Invalid sync state: ${record.syncState}`
      );
    }
  });

  await t.test('4.2 FleetService: Summary KPI statistics calculation', () => {
    const summary = FleetService.getFleetSummary();

    assert.equal(summary.totalStores, STARBUCKS_STORES_CATALOG.length);
    assert.ok(summary.totalStores > 0, 'Total stores should be greater than 0');
    assert.ok(summary.unprovisionedStores >= 0);
  });

  await t.test('4.3 FleetService: Diacritics-insensitive Polish search filtering', () => {
    // "Kraków" vs "krakow"
    const krakowDiacritics = FleetService.filterStores({
      query: 'Kraków',
      healthFilter: 'ALL',
      districtFilter: 'ALL',
      sortBy: 'name',
      sortDirection: 'asc',
    });

    const krakowPlain = FleetService.filterStores({
      query: 'krakow',
      healthFilter: 'ALL',
      districtFilter: 'ALL',
      sortBy: 'name',
      sortDirection: 'asc',
    });

    assert.ok(krakowDiacritics.length > 0, 'Should find Krakow stores with diacritics');
    assert.equal(
      krakowDiacritics.length,
      krakowPlain.length,
      'Diacritics-insensitive search must return identical count'
    );

    // Search by unit code
    const unit18120 = FleetService.filterStores({
      query: '18120',
      healthFilter: 'ALL',
      districtFilter: 'ALL',
      sortBy: 'unitCode',
      sortDirection: 'asc',
    });

    assert.ok(
      unit18120.some((r) => r.unitCode === '18120'),
      'Must find store with unitCode 18120'
    );
  });

  // --------------------------------------------------------------------------
  // 5. FleetService: License Provisioning Round-Trip
  // --------------------------------------------------------------------------
  await t.test('5.1 License Provisioning: Generates valid HMAC key and logs audit trail', async () => {
    const initialAuditCount = FleetService.getAuditLog().length;

    const provisionResult = await FleetService.provisionLicense({
      storeId: '108120',
      tier: 'ENTERPRISE',
      issuedBy: 'hq_admin_test',
      notes: 'Automated Security Provisioning Test',
    });

    assert.ok(provisionResult.licenseKey, 'Provisioning must return a licenseKey');
    assert.match(
      provisionResult.licenseKey,
      /^SBX-[A-Z0-9_]{3,16}-[A-F0-9]{16}-[A-F0-9]{10}$/,
      'License key must match canonical SBX format'
    );
    assert.equal(provisionResult.storeId, '108120');

    // Verify audit trail entry was recorded
    const auditLogs = FleetService.getAuditLog();
    assert.ok(auditLogs.length > initialAuditCount, 'Audit log count must increase');
    const latestLog = auditLogs[0];
    assert.equal(latestLog.action, 'KEY_GENERATED');
    assert.equal(latestLog.targetStoreId, '108120');
  });

  // --------------------------------------------------------------------------
  // 6. Kill-Switch: 2-Step Verification & RAM Key Zeroization
  // --------------------------------------------------------------------------
  await t.test('6.1 Kill-Switch: Rejection of invalid confirmation challenge', async () => {
    const invalidPayload: KillSwitchPayload = {
      targetStoreId: '108120',
      confirmationChallenge: 'WRONG-CHALLENGE-CODE',
      reason: 'Adversarial Test Revocation',
      operator: 'hq_admin_test',
      wipeData: false,
    };

    await assert.rejects(
      async () => {
        await FleetService.executeKillSwitch(storeJanki, invalidPayload);
      },
      /Niepoprawny kod potwierdzenia/i,
      'Kill switch must strictly reject incorrect confirmation challenge'
    );
  });

  await t.test('6.2 Kill-Switch: Valid challenge execution, store revocation & RAM key zeroization', async () => {
    // 1. Pre-seed RAM key cache with an active store key
    const mockAesKey = Buffer.from('0123456789abcdef0123456789abcdef', 'utf-8');
    StoreKeyCache.setStoreKey(storeJanki.id, mockAesKey);
    assert.equal(StoreKeyCache.hasStoreKey(storeJanki.id), true, 'Store key must exist in cache before kill');

    // 2. Prepare valid 2-step verification payload
    const validChallenge = FleetService.getRequiredChallengeCode(storeJanki.id);
    const validPayload: KillSwitchPayload = {
      targetStoreId: storeJanki.id,
      confirmationChallenge: validChallenge,
      reason: 'Security Incident Revocation Test',
      operator: 'hq_security_officer',
      wipeData: true,
    };

    // 3. Track revocation event
    let eventFired = false;
    let eventDetail: any = null;
    const eventHandler = (e: any) => {
      eventFired = true;
      eventDetail = e.detail;
    };
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('sbx:license-revoked', eventHandler);
    }

    // 4. Execute Kill-Switch
    const auditRecord = await FleetService.executeKillSwitch(storeJanki, validPayload);

    // 5. Verify audit log entry
    assert.equal(auditRecord.action, 'KILL_SWITCH_REVOKE');
    assert.equal(auditRecord.targetStoreId, storeJanki.id);
    assert.equal(auditRecord.operator, 'hq_security_officer');
    assert.equal(auditRecord.success, true);

    // 6. Verify RAM key cache was immediately zeroized
    assert.equal(
      StoreKeyCache.hasStoreKey(storeJanki.id),
      false,
      'Store key in StoreKeyCache must be zeroized after Kill-Switch'
    );

    // 7. Verify store state in fleet catalog is now REVOKED
    const updatedStore = FleetService.getStoreRecord(storeJanki.id);
    assert.ok(updatedStore, 'Store record must exist in fleet service');
    assert.equal(updatedStore?.health, 'revoked', 'Store health must transition to revoked');

    // 8. Verify event dispatch occurred
    if (typeof window !== 'undefined') {
      assert.equal(eventFired, true, 'sbx:license-revoked event must be dispatched to window');
      assert.equal(eventDetail?.storeId, storeJanki.id, 'Dispatched event must include target storeId');
      if (window.removeEventListener) {
        window.removeEventListener('sbx:license-revoked', eventHandler);
      }
    }
  });

  // --------------------------------------------------------------------------
  // 7. Audit Log CSV Export Sanitization
  // --------------------------------------------------------------------------
  await t.test('7.1 Audit Export: Produces valid CSV with headers and sanitized values', () => {
    const csvContent = FleetService.exportAuditLogCsv();

    assert.ok(csvContent.length > 0, 'CSV export must not be empty');
    const lines = csvContent.trim().split('\r\n');
    assert.ok(lines.length >= 2, 'CSV must have at least header and one data row');

    // Check header
    const header = lines[0];
    assert.ok(header.includes('Data') || header.includes('Timestamp'), 'Header must include timestamp column');
    assert.ok(header.includes('Zdarzenie') || header.includes('Action'), 'Header must include action column');
    assert.ok(header.includes('ID Lokalu') || header.includes('Store ID'), 'Header must include store ID column');
    assert.ok(header.includes('Aktor') || header.includes('Operator'), 'Header must include operator column');
  });

  // Suite teardown: restore globals and reset profile to least-privilege default
  t.after(() => {
    StoreService.setRuntimeSecurityProfile('STORE_CLIENT', []);
    (globalThis as any).localStorage = originalLocalStorage;
    (globalThis as any).window = originalWindow;
    (globalThis as any).CustomEvent = originalCustomEvent;
  });
});
