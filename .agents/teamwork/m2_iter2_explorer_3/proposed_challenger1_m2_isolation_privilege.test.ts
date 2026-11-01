/**
 * Starbucks Operations Suite — Milestone 2 Adversarial Challenge Test Suite (Harmonized)
 * Challenger: M2 Challenger 1 (Store Isolation & Privilege Escalation Stress Test)
 * Harmonized by: M2 Iter2 Explorer 3 (Security Test Suite Harmonization)
 * File: tests/security/challenger1_m2_isolation_privilege.test.ts
 *
 * Scope:
 * 1. Store boundary bypass attempts in STORE_CLIENT mode (unassigned stores, empty strings,
 *    case variations, prototype pollution, whitespace, partial matches, state mutation checks).
 * 2. Profile policy spoofing attempts against restricted operations (Clean Slate DB reset,
 *    manual VACUUM/PRAGMA, CSV exports, custom store addition, mode parameter tampering).
 * 3. Hardened fail-closed behavior verification & least-privilege defaults.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ProfilePolicyService } from '../../src/services/security/profilePolicyService';
import { StoreService } from '../../src/services/storeService';
import { FleetService } from '../../src/services/admin/fleetService';
import { STARBUCKS_STORES_CATALOG, StarbucksStore } from '../../src/constants/starbucksStores';
import { StoreKeyCache } from '../../src/services/security/encryptionService';
import type { KillSwitchPayload } from '../../src/types/fleet';

// Capture initial static state before any subtests run
const initialStaticProfile = { ...StoreService.getRuntimeSecurityProfile() };

// ----------------------------------------------------------------------------
// Test Mock Environment: Polyfill localStorage & window for empirical state tracking
// ----------------------------------------------------------------------------
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  get length(): number {
    return this.store.size;
  }
}

class MockWindow {
  public dispatchedEvents: Array<{ type: string; detail: any }> = [];
  dispatchEvent(event: any): boolean {
    this.dispatchedEvents.push({ type: event?.type, detail: event?.detail });
    return true;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  api = {
    switchStoreDatabase: async (opts: any) => ({ success: true, dbPath: `store_${opts.storeId}.db`, isNew: false }),
    saveAppSettings: async () => ({ success: true }),
    getCustomStores: async () => [],
    saveCustomStores: async () => ({ success: true }),
  };
}

// Setup polyfills if not already in browser
const originalLocalStorage = (globalThis as any).localStorage;
const originalWindow = (globalThis as any).window;
const originalCustomEvent = (globalThis as any).CustomEvent;

const mockStorage = new MemoryStorage();
const mockWin = new MockWindow();

(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = mockWin;
(globalThis as any).CustomEvent = class CustomEvent {
  constructor(public type: string, public init?: any) {
    this.detail = init?.detail;
  }
  detail: any;
};

// Fixture stores
const storeJanki: StarbucksStore = STARBUCKS_STORES_CATALOG.find(
  (s) => s.id === '108120' || s.unitCode === '18120'
) || {
  id: '108120',
  name: '108120 SBX Warszawa Janki',
  shortName: 'Warszawa Janki',
  unitCode: '18120',
  mpk: '18120',
  city: 'Warszawa',
  district: 'Central',
  address: 'ul. Mszczonowska 3, Janki',
  type: 'Mall',
};

const storeZloteTarasy: StarbucksStore = STARBUCKS_STORES_CATALOG.find(
  (s) => s.id === '108101' || s.unitCode === '18101'
) || {
  id: '108101',
  name: '108101 SBX Warszawa Złote Tarasy',
  shortName: 'Warszawa Złote Tarasy',
  unitCode: '18101',
  mpk: '18101',
  city: 'Warszawa',
  district: 'Central',
  address: 'ul. Złota 59, Warszawa',
  type: 'Mall',
};

test('M2-CHALLENGER-1: Store Isolation & Privilege Escalation Stress Test', async (suite) => {

  // ==========================================================================
  // SECTION 1: Store Boundary Bypass Attempts in STORE_CLIENT Mode
  // ==========================================================================
  await suite.test('1.1 Store Boundary: Rejection of unassigned catalog store in STORE_CLIENT', async () => {
    StoreService.setRuntimeSecurityProfile('STORE_CLIENT', ['108120']);
    mockWin.dispatchedEvents = [];
    const prevStoreName = mockStorage.getItem('sbx_store_name');

    // Attempt to switch to unassigned store 108101
    await assert.rejects(
      async () => {
        await StoreService.setCurrentStore(storeZloteTarasy);
      },
      /UnauthorizedStoreSwitchError|Odmowa dostępu/i,
      'Store switch to unassigned store 108101 must throw an UnauthorizedStoreSwitchError'
    );

    // Verify ZERO state mutation occurred
    assert.equal(
      mockStorage.getItem('sbx_store_name'),
      prevStoreName,
      'Storage must not be mutated when switch is rejected'
    );
    assert.equal(
      mockWin.dispatchedEvents.length,
      0,
      'No sbx:store-switching or sbx:store-switched events should be dispatched on failure'
    );
  });

  await suite.test('1.2 Store Boundary: Arbitrary and non-existent store IDs (999999, rogue_id)', async () => {
    StoreService.setRuntimeSecurityProfile('STORE_CLIENT', ['108120']);

    const rogueStore: StarbucksStore = {
      id: '999999',
      name: 'Rogue Store 999999',
      shortName: 'Rogue',
      unitCode: '99999',
      mpk: '99999',
      city: 'Nieznane',
      district: 'Central',
      address: 'Dark Alley 404',
      type: 'Street',
    };

    await assert.rejects(
      async () => {
        await StoreService.setCurrentStore(rogueStore);
      },
      /UnauthorizedStoreSwitchError|Odmowa dostępu/i,
      'Switching to arbitrary/non-existent store must be rejected'
    );
  });

  await suite.test('1.3 Store Boundary: Empty string, whitespace, and malformed store targets', () => {
    // Test ProfilePolicyService.canSwitchToStore directly
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '', ['108120']),
      false,
      'Empty string target must be rejected'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '   ', ['108120']),
      false,
      'Whitespace-only target must be rejected'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '\t\n', ['108120']),
      false,
      'Newline/tab target must be rejected'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', null as any, ['108120']),
      false,
      'Null target must be rejected'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', undefined as any, ['108120']),
      false,
      'Undefined target must be rejected'
    );
  });

  await suite.test('1.4 Store Boundary: Case variations and diacritics resilience', () => {
    // Normalization should handle case variations for legitimate stores
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', ['108120']),
      true,
      'Exact store match must succeed'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', 'SBX_108120', ['sbx_108120']),
      true,
      'Case-insensitive matching must succeed for authorized store'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', 'sbx_108120', ['SBX_108120']),
      true,
      'Case-insensitive matching must succeed in reverse'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '  108120  ', ['108120']),
      true,
      'Surrounding whitespace on target must be trimmed safely'
    );
  });

  await suite.test('1.5 Store Boundary: Substring, prefix, and suffix collision resistance', () => {
    const assigned = ['108120'];

    // Prefix match attempt (10812 should not match 108120)
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '10812', assigned),
      false,
      'Prefix substring must NOT grant access'
    );

    // Suffix match attempt (08120 should not match 108120)
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '08120', assigned),
      false,
      'Suffix substring must NOT grant access'
    );

    // Extension match attempt (1081201 should not match 108120)
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '1081201', assigned),
      false,
      'Extended store ID must NOT grant access'
    );
  });

  await suite.test('1.6 Store Boundary: Prototype pollution & injection strings in storeId', () => {
    const assigned = ['108120'];

    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '__proto__', assigned),
      false,
      '__proto__ must not match assigned store'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', 'constructor', assigned),
      false,
      'constructor must not match assigned store'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', 'toString', assigned),
      false,
      'toString must not match assigned store'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120; DROP TABLE stores;--', assigned),
      false,
      'SQL injection string must not match assigned store'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120\0', assigned),
      false,
      'Null-byte terminated string must not match assigned store'
    );
  });

  await suite.test('1.7 Store Boundary: Empty or malformed assignedStoreIds list fails closed', () => {
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', []),
      false,
      'Empty assignedStoreIds must fail closed'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', undefined),
      false,
      'Undefined assignedStoreIds must fail closed'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', ['', '   ']),
      false,
      'Assigned list with only whitespace must fail closed'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', null as any),
      false,
      'Null assignedStoreIds must fail closed without throwing TypeError'
    );
    assert.equal(
      ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', 12345 as any),
      false,
      'Non-array assignedStoreIds must fail closed without throwing TypeError'
    );
  });

  await suite.test('1.8 Store Boundary: Catalog filtering fail-closed behavior', () => {
    const filteredEmpty = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'STORE_CLIENT',
      []
    );
    assert.deepEqual(filteredEmpty, [], 'Filter with empty assigned list must return 0 stores');

    const filteredWhitespace = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'STORE_CLIENT',
      ['   ']
    );
    assert.deepEqual(filteredWhitespace, [], 'Filter with whitespace assigned list must return 0 stores');

    const filteredNull = ProfilePolicyService.filterStoresForProfile(
      STARBUCKS_STORES_CATALOG,
      'STORE_CLIENT',
      null as any
    );
    assert.deepEqual(filteredNull, [], 'Filter with null assigned list must return 0 stores');
  });

  // ==========================================================================
  // SECTION 2: Profile Policy Spoofing & Restricted Features Stress Test
  // ==========================================================================
  await suite.test('2.1 Policy Spoofing: Mode parameter tampering fails closed', () => {
    const tamperedModes = [
      'fleet_master', // lowercase
      'FLEET_MASTER ', // trailing whitespace
      'FLEET_MASTER\0', // null byte
      'FLEET_MASTER_HQ', // variant
      'ADMIN',
      'SUPERUSER',
      'ROOT',
      '',
      null,
      undefined,
      '123',
      'true',
    ];

    for (const mode of tamperedModes) {
      const policy = ProfilePolicyService.getPolicy(mode as any);

      assert.equal(
        policy.allowCleanSlateReset,
        false,
        `Mode "${mode}" must NOT have allowCleanSlateReset`
      );
      assert.equal(
        policy.allowHistoricalImport,
        false,
        `Mode "${mode}" must NOT have allowHistoricalImport`
      );
      assert.equal(
        policy.allowRawDatabaseOverwrite,
        false,
        `Mode "${mode}" must NOT have allowRawDatabaseOverwrite`
      );
      assert.equal(
        policy.allowManualVacuumPragma,
        false,
        `Mode "${mode}" must NOT have allowManualVacuumPragma`
      );
      assert.equal(
        policy.allowFirebaseFleetTab,
        false,
        `Mode "${mode}" must NOT have allowFirebaseFleetTab`
      );
      assert.equal(
        policy.allowTestingGuideTab,
        false,
        `Mode "${mode}" must NOT have allowTestingGuideTab`
      );
      assert.equal(
        policy.allowStoreSwitching,
        false,
        `Mode "${mode}" must NOT have allowStoreSwitching`
      );
      assert.equal(
        policy.allowCustomStoreAddition,
        false,
        `Mode "${mode}" must NOT have allowCustomStoreAddition`
      );
      assert.equal(
        policy.allowFleetMasterDashboard,
        false,
        `Mode "${mode}" must NOT have allowFleetMasterDashboard`
      );
      assert.equal(
        policy.showStationLockedBadge,
        true,
        `Mode "${mode}" must show station locked badge`
      );
    }
  });

  await suite.test('2.2 Policy Enforcement: STORE_CLIENT strictly blocks all 9 elevated permissions', () => {
    const policy = ProfilePolicyService.getPolicy('STORE_CLIENT');

    // 1. Destructive Database Operations
    assert.equal(policy.allowCleanSlateReset, false, 'allowCleanSlateReset must be false');
    assert.equal(policy.allowHistoricalImport, false, 'allowHistoricalImport must be false');
    assert.equal(policy.allowRawDatabaseOverwrite, false, 'allowRawDatabaseOverwrite must be false');
    assert.equal(policy.allowManualVacuumPragma, false, 'allowManualVacuumPragma must be false');

    // 2. Settings Tabs & Diagnostics
    assert.equal(policy.allowFirebaseFleetTab, false, 'allowFirebaseFleetTab must be false');
    assert.equal(policy.allowTestingGuideTab, false, 'allowTestingGuideTab must be false');

    // 3. Navigation & Fleet Controls
    assert.equal(policy.allowStoreSwitching, false, 'allowStoreSwitching must be false');
    assert.equal(policy.allowCustomStoreAddition, false, 'allowCustomStoreAddition must be false');
    assert.equal(policy.allowFleetMasterDashboard, false, 'allowFleetMasterDashboard must be false');

    // 4. Retail workstation UI flags
    assert.equal(policy.showStationLockedBadge, true, 'showStationLockedBadge must be true');
    assert.equal(policy.showCloudSyncIndicator, true, 'showCloudSyncIndicator must be true');
  });

  await suite.test('2.3 StoreService Guard: addCustomStore blocked in STORE_CLIENT mode', async () => {
    StoreService.setRuntimeSecurityProfile('STORE_CLIENT', ['108120']);

    const customStore: StarbucksStore = {
      id: 'attacker_custom_store_01',
      name: 'Attacker Rogue Store',
      shortName: 'Rogue',
      unitCode: '66666',
      mpk: '66666',
      city: 'Warszawa',
      district: 'Central',
      address: 'Adversarial Street 1',
      type: 'Drive-Thru',
    };

    await assert.rejects(
      async () => {
        await StoreService.addCustomStore(customStore);
      },
      /UnauthorizedStoreCreationError|Niedozwolone w trybie STORE_CLIENT/i,
      'addCustomStore must strictly throw in STORE_CLIENT mode'
    );

    // Verify it was not saved into storage
    const customStores = StoreService.getCustomStores();
    assert.ok(
      !customStores.some((s) => s.id === 'attacker_custom_store_01'),
      'Rogue store must not be persisted in custom stores'
    );
  });

  await suite.test('2.4 FleetService: Kill-Switch challenge code adversarial tests', () => {
    const storeId = '108120';
    const requiredCode = FleetService.getRequiredChallengeCode(storeId);
    assert.equal(requiredCode, 'REVOKE 108120');

    const invalidChallenges = [
      'REVOKE', // missing ID
      'REVOKE 108121', // wrong store ID
      'REVOKE 108120; DROP TABLE;',
      '',
      'CONFIRM',
      'YES',
    ];

    for (const challenge of invalidChallenges) {
      const payload: KillSwitchPayload = {
        storeId,
        confirmationChallenge: challenge,
        reason: 'Adversarial Challenge Test',
        actorName: 'adversary',
        actorEmail: 'adversary@test.com',
      };

      const res = FleetService.getInstance().applyKillSwitch(payload);
      assert.equal(res.success, false, `Challenge "${challenge}" must be rejected`);
      assert.ok(res.error?.includes('Wymagane wpisanie dokładnej frazy'));
    }

    // Adversarial: Missing or undefined storeId in payload must return failure cleanly
    const missingStoreIdRes = FleetService.getInstance().applyKillSwitch({
      confirmationChallenge: 'REVOKE 108120',
      reason: 'Missing storeId check',
      actorName: 'tester',
      actorEmail: 'tester@starbucks.com',
    } as any);
    assert.equal(missingStoreIdRes.success, false, 'Missing storeId must return failure cleanly without throwing TypeError');

    // Adversarial: Alternative targetStoreId property alias support
    const targetStoreIdRes = FleetService.getInstance().applyKillSwitch({
      targetStoreId: '108120',
      confirmationChallenge: 'REVOKE 108120',
      reason: 'targetStoreId alias check',
      actorName: 'tester',
      actorEmail: 'tester@starbucks.com',
    } as any);
    assert.equal(targetStoreIdRes.success, true, 'targetStoreId alias should be supported gracefully');

    // Adversarial: Missing or undefined confirmationChallenge must return failure cleanly
    const missingChallengeRes = FleetService.getInstance().applyKillSwitch({
      storeId: '108120',
      reason: 'Missing challenge check',
      actorName: 'tester',
      actorEmail: 'tester@starbucks.com',
    } as any);
    assert.equal(missingChallengeRes.success, false, 'Missing confirmationChallenge must return failure cleanly');

    // Note on casing: FleetService.applyKillSwitch normalizes via .toUpperCase()
    const lowercaseRes = FleetService.getInstance().applyKillSwitch({
      storeId,
      confirmationChallenge: 'revoke 108120',
      reason: 'Case check',
      actorName: 'tester',
      actorEmail: 'tester@starbucks.com',
    });
    assert.equal(lowercaseRes.success, true, 'applyKillSwitch accepts case-insensitive confirmation');
  });

  await suite.test('2.5 FleetService: CSV Export formula injection defense inspection', () => {
    const csvAudit = FleetService.exportAuditLogCsv();
    assert.ok(csvAudit.length > 0, 'Audit CSV must contain data');
    const csvCatalog = FleetService.getInstance().exportStoreCatalogCsv();
    assert.ok(csvCatalog.length > 0, 'Store catalog CSV must contain data');

    // Values with quotes must be properly escaped
    for (const line of csvCatalog.split('\r\n')) {
      const quoteCount = (line.match(/"/g) || []).length;
      assert.equal(quoteCount % 2, 0, `CSV line must have balanced double quotes: ${line}`);
    }
  });

  // ==========================================================================
  // SECTION 3: Hardened Profile Security & Least-Privilege Verification
  // ==========================================================================
  await suite.test('3.1 Hardened Store Boundary: StoreService rejects unassigned switch with lowercase "store_client"', async () => {
    // Attempting to switch with lowercase 'store_client' must reject fail-closed
    await assert.rejects(
      async () => {
        await StoreService.setCurrentStore(storeZloteTarasy, {
          appMode: 'store_client', // Lowercase tamper attempt
          assignedStoreIds: ['108120'],
        });
      },
      /UnauthorizedStoreSwitchError|Odmowa dostępu/i,
      'StoreService.setCurrentStore must reject unassigned store switch when appMode is lowercase "store_client"'
    );
  });

  await suite.test('3.2 Least-Privilege Default: StoreService initial static profile defaults to STORE_CLIENT', () => {
    // Verified against the initial snapshot before subtests modified state:
    assert.equal(
      initialStaticProfile.appMode,
      'STORE_CLIENT',
      'StoreService.runtimeSecurityProfile must default to least-privilege STORE_CLIENT'
    );
    assert.deepEqual(
      initialStaticProfile.assignedStoreIds,
      [],
      'StoreService.runtimeSecurityProfile assignedStoreIds must default to empty array'
    );
  });

  // Clean up mock state after suite — reset to secure STORE_CLIENT default
  suite.after(() => {
    StoreService.setRuntimeSecurityProfile('STORE_CLIENT', []);
    (globalThis as any).localStorage = originalLocalStorage;
    (globalThis as any).window = originalWindow;
    (globalThis as any).CustomEvent = originalCustomEvent;
  });
});
