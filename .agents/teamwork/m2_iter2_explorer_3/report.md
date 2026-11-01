# Security Test Suite Harmonization Report — Milestone 2 Iteration 2

**Agent**: M2 Iter2 Explorer 3 (`teamwork_preview_explorer`)  
**Role**: Security Test Suite Harmonization  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_3`  
**Date**: 2026-10-26  

---

## 1. Executive Summary

This investigation analyzed the security test suites `tests/security/dual_profile_isolation.test.ts` and `tests/security/challenger1_m2_isolation_privilege.test.ts` to resolve the 3 test failures documented by Challenger 2 and harmonize test assertions with the hardened fail-closed security architecture. When the remediations from Explorer 1 (`StoreService` fail-closed guards & `STORE_CLIENT` default) and Explorer 2 (`ProfilePolicyService` null defense & `FleetService` payload normalization) are applied alongside this harmonization plan, all 86 security tests across all 6 test suites will pass cleanly with 0 failures and 0 headless runtime warnings.

---

## 2. In-Depth Analysis of the 3 Challenger 2 Failures

### 2.1 Failure 1: `1.7 Store Boundary: Empty or malformed assignedStoreIds list fails closed`
- **Location**: `tests/security/challenger1_m2_isolation_privilege.test.ts:274-301`
- **Underlying Code**: `src/services/security/profilePolicyService.ts:85-86`
- **Observed Error in Challenger 2 Run**:
  ```
  ✖ 1.7 Store Boundary: Empty or malformed assignedStoreIds list fails closed (0.188291ms)
    TypeError: Cannot read properties of null (reading 'some')
        at ProfilePolicyService.canSwitchToStore (src/services/security/profilePolicyService.ts:86:29)
  ```
- **Root Cause**:
  `ProfilePolicyService.canSwitchToStore` declared default parameter `assignedStoreIds: string[] = []`. In JavaScript/TypeScript, default arguments trigger ONLY when the caller passes `undefined`; passing `null` assigns `null` directly. Calling `assignedStoreIds.some(...)` subsequently threw an unhandled `TypeError`.
  In Challenger 1's test file, this was originally an unhandled call, which was later temporarily wrapped in a `try...catch` expecting `err instanceof TypeError` to demonstrate the bug.
- **Harmonization Requirement**:
  Once Explorer 2 adds `if (!Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) return false;`, `canSwitchToStore` returns `false` cleanly. Test 1.7 must remove the temporary `try...catch` wrapper and directly assert:
  ```typescript
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
  ```

---

### 2.2 Failure 2: `2.4 FleetService: Kill-Switch challenge code adversarial tests`
- **Location**: `tests/security/challenger1_m2_isolation_privilege.test.ts:448-486`
- **Underlying Code**: `src/services/admin/fleetService.ts:263-267`
- **Observed Error in Challenger 2 Run**:
  ```
  ✖ 2.4 FleetService: Kill-Switch challenge code adversarial tests (0.509125ms)
    TypeError: Cannot read properties of undefined (reading 'toUpperCase')
        at FleetService.applyKillSwitch (src/services/admin/fleetService.ts:264:57)
  ```
- **Root Cause**:
  In `FleetService.applyKillSwitch`, line 264 executed:
  `const expectedChallenge = 'REVOKE ' + payload.storeId.toUpperCase();`
  `if (payload.confirmationChallenge.trim().toUpperCase() !== expectedChallenge)`
  When adversarial tests invoked `applyKillSwitch` with:
  1. Undefined or missing `payload.storeId`,
  2. Alternative `targetStoreId` property (which is used in `executeKillSwitch` and `dual_profile_isolation.test.ts:306`),
  3. Undefined `payload.confirmationChallenge`,
  the method crashed with `TypeError: Cannot read properties of undefined (reading 'toUpperCase')` or `(reading 'trim')` rather than returning a structured error response `{ success: false, error: '...' }`.
- **Harmonization Requirement**:
  Once Explorer 2 hardens `applyKillSwitch` to defensively extract:
  ```typescript
  const targetId = String(payload?.storeId || (payload as any)?.targetStoreId || '').trim();
  if (!targetId) {
    return { success: false, error: 'Nie podano identyfikatora lokalu dla operacji Kill-Switch.' };
  }
  const challenge = String(payload?.confirmationChallenge || '').trim().toUpperCase();
  const expectedChallenge = `REVOKE ${targetId.toUpperCase()}`;
  if (challenge !== expectedChallenge) {
    return { success: false, error: `Wymagane wpisanie dokładnej frazy: "${expectedChallenge}"` };
  }
  ```
  Test 2.4 must be expanded to assert that missing `storeId`, `targetStoreId` aliases, and missing `confirmationChallenge` all return structured failure objects gracefully without throwing unhandled exceptions.

---

### 2.3 Failure 3: `3.2 Vulnerability Discovery: StoreService default runtime profile is FLEET_MASTER` (and 3.1)
- **Location**: `tests/security/challenger1_m2_isolation_privilege.test.ts:503-526`
- **Underlying Code**: `src/services/storeService.ts:31-37` and `src/services/storeService.ts:268-276`
- **Observed Inverted Assertions**:
  ```typescript
  // Test 3.1
  assert.equal(
    switchResult.success,
    true,
    'Demonstrates critical vulnerability: StoreService.setCurrentStore allows unassigned store switch when appMode is lowercase "store_client"'
  );

  // Test 3.2
  assert.equal(
    initialStaticProfile.appMode,
    'FLEET_MASTER',
    'Demonstrates vulnerability: StoreService.runtimeSecurityProfile initializes to FLEET_MASTER instead of least-privilege STORE_CLIENT'
  );
  ```
- **Root Cause & Test Collision**:
  Challenger 1 authored Section 3 as a proof-of-vulnerability demonstration. These tests asserted that the security flaws were PRESENT in the unhardened code:
  1. Test 3.1 asserted that bypassing with lowercase `'store_client'` SUCCEEDED (`switchResult.success === true`).
  2. Test 3.2 asserted that `initialStaticProfile.appMode` initialized to `'FLEET_MASTER'`.
  When Explorer 1 fixes `StoreService` to:
  - Enforce fail-closed check: `const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER'; if (!isFleetMaster) { throw ... }`
  - Default `runtimeSecurityProfile` to `{ appMode: 'STORE_CLIENT', assignedStoreIds: [] }`
  Both tests will immediately FAIL if they continue asserting the old vulnerable behavior!
  - Test 3.1 will throw `UnauthorizedStoreSwitchError` instead of returning `{ success: true }`.
  - Test 3.2 will find `initialStaticProfile.appMode === 'STORE_CLIENT'` and fail the assertion `assert.equal(initialStaticProfile.appMode, 'FLEET_MASTER')`.
- **Harmonization Requirement**:
  Section 3 must be converted from an adversarial flaw proof into a permanent regression barrier:
  - Test 3.1 must assert `assert.rejects(...)` with `/UnauthorizedStoreSwitchError|Odmowa dostępu/i`.
  - Test 3.2 must assert `assert.equal(initialStaticProfile.appMode, 'STORE_CLIENT')` and `assert.deepEqual(initialStaticProfile.assignedStoreIds, [])`.

---

## 3. Headless Node.js Warnings & State Pollution

### 3.1 `ReferenceError: localStorage is not defined` and `ReferenceError: window is not defined`
When `dual_profile_isolation.test.ts` was executed in headless Node.js, the test harness output the following noisy stack traces:
```
Błąd odczytu aktualnej kawiarni z localStorage: ReferenceError: localStorage is not defined
    at StoreService.getCurrentStore (src/services/storeService.ts:201:25)
    at StoreService.setCurrentStore (src/services/storeService.ts:280:30)
Błąd zmiany kawiarni w StoreService: ReferenceError: window is not defined
    at StoreService.setCurrentStore (src/services/storeService.ts:290:7)
Błąd odczytu sbx_custom_stores: ReferenceError: localStorage is not defined
    at StoreService.getCustomStores (src/services/storeService.ts:65:20)
```
- **Remediation in `StoreService` (Explorer 1)**:
  `StoreService` must guard all global accesses with `typeof window !== 'undefined'` and `typeof localStorage !== 'undefined'`.
- **Remediation in `dual_profile_isolation.test.ts` (Explorer 3)**:
  To allow `dual_profile_isolation.test.ts` to actively test and verify browser events (such as `sbx:license-revoked` and `sbx:store-switched`), `dual_profile_isolation.test.ts` must install lightweight mock implementations of `MemoryStorage` and `MockWindow` if `typeof window === 'undefined'`, and safely restore original globals in `t.after()`.
  This enables Test 6.2 to actively assert:
  ```typescript
  assert.equal(eventFired, true, 'sbx:license-revoked event must be dispatched to window');
  assert.equal(eventDetail?.storeId, storeJanki.id);
  ```

### 3.2 Cross-Suite Profile State Pollution
In `dual_profile_isolation.test.ts`, lines 174 and 200 reset `StoreService.setRuntimeSecurityProfile('FLEET_MASTER')`.
In `challenger1_m2_isolation_privilege.test.ts`, line 530 reset `StoreService.setRuntimeSecurityProfile('FLEET_MASTER')`.
- **Hazard**:
  Leaving `StoreService` in `'FLEET_MASTER'` pollutes the process environment for subsequent test suites.
- **Harmonization**:
  Both test suites must reset to least-privilege `StoreService.setRuntimeSecurityProfile('STORE_CLIENT', [])` in their teardown hooks (`after()` / `t.after()`).

---

## 4. Comprehensive Harmonization Blueprint

### 4.1 Changes to `tests/security/challenger1_m2_isolation_privilege.test.ts`

```typescript
// 1. In Test 1.7 (Lines 290-301):
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

// 2. In Test 1.8 (Line 317):
const filteredNull = ProfilePolicyService.filterStoresForProfile(
  STARBUCKS_STORES_CATALOG,
  'STORE_CLIENT',
  null as any
);
assert.deepEqual(filteredNull, [], 'Filter with null assigned list must return 0 stores');

// 3. In Test 2.4 (Lines 475-485):
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

// 4. In Section 3 (Lines 500-526):
await suite.test('3.1 Hardened Store Boundary: StoreService rejects unassigned switch with lowercase "store_client"', async () => {
  await assert.rejects(
    async () => {
      await StoreService.setCurrentStore(storeZloteTarasy, {
        appMode: 'store_client', // Lowercase bypass attempt
        assignedStoreIds: ['108120'],
      });
    },
    /UnauthorizedStoreSwitchError|Odmowa dostępu/i,
    'StoreService.setCurrentStore must reject unassigned store switch when appMode is lowercase "store_client"'
  );
});

await suite.test('3.2 Least-Privilege Default: StoreService initial static profile defaults to STORE_CLIENT', () => {
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

// 5. In Teardown (Line 530):
suite.after(() => {
  StoreService.setRuntimeSecurityProfile('STORE_CLIENT', []);
  (globalThis as any).localStorage = originalLocalStorage;
  (globalThis as any).window = originalWindow;
  (globalThis as any).CustomEvent = originalCustomEvent;
});
```

---

### 4.2 Changes to `tests/security/dual_profile_isolation.test.ts`

```typescript
// 1. Polyfill/Mock Environment Setup at top of file:
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

// 2. In Test 2.3 (Line 127):
const nullAssigned = ProfilePolicyService.filterStoresForProfile(
  STARBUCKS_STORES_CATALOG,
  'STORE_CLIENT',
  null as any
);
assert.deepEqual(nullAssigned, [], 'Store Client with null assigned stores must fail closed');

// 3. In Test 3.1 (Line 153):
assert.equal(
  ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', null as any),
  false,
  'Store Client must fail closed on null assignedStoreIds'
);

// 4. In Test 3.2 & 3.3 (Lines 174 & 200):
StoreService.setRuntimeSecurityProfile('STORE_CLIENT', []);

// 5. In Test 6.2 (Lines 368-373):
if (typeof window !== 'undefined') {
  assert.equal(eventFired, true, 'sbx:license-revoked event must be dispatched to window');
  assert.equal(eventDetail?.storeId, storeJanki.id, 'Dispatched event must include target storeId');
  if (window.removeEventListener) {
    window.removeEventListener('sbx:license-revoked', eventHandler);
  }
}

// 6. Teardown hook at end of suite:
t.after(() => {
  StoreService.setRuntimeSecurityProfile('STORE_CLIENT', []);
  (globalThis as any).localStorage = originalLocalStorage;
  (globalThis as any).window = originalWindow;
  (globalThis as any).CustomEvent = originalCustomEvent;
});
```

---

## 5. Artifact Reference

All proposed modifications are available as drop-in replacement files and a unified patch in this explorer's working directory:
1. `proposed_challenger1_m2_isolation_privilege.test.ts` — Full drop-in replacement for `tests/security/challenger1_m2_isolation_privilege.test.ts`.
2. `proposed_dual_profile_isolation.test.ts` — Full drop-in replacement for `tests/security/dual_profile_isolation.test.ts`.
3. `test_suite_harmonization.patch` — Unified diff patch that can be directly applied via `git apply`.

---

## 6. Expected Test Verification Matrix

| Test Suite | Total Tests | Expected Pass | Expected Fail |
| :--- | :---: | :---: | :---: |
| `tests/security/adversarial_hardware_tamper.test.ts` | 10 | 10 | 0 |
| `tests/security/hardware_binding_anticopy.test.ts` | 20 | 20 | 0 |
| `tests/security/licensing_adversarial_challenge.test.ts` | 9 | 9 | 0 |
| `tests/security/licensing_key_engine.test.ts` | 14 | 14 | 0 |
| `tests/security/dual_profile_isolation.test.ts` | 17 | 17 | 0 |
| `tests/security/challenger1_m2_isolation_privilege.test.ts` | 16 | 16 | 0 |
| **TOTAL SECURITY SUITE (`npm run test:security`)** | **86** | **86** | **0** |
