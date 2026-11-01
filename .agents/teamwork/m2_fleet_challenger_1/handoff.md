# Milestone 2 Challenge Report: Store Isolation & Privilege Escalation Stress Test

## 1. Observation

### Verification Commands & Build Status
- `npm run test:security`:
  ```bash
  $ npm run test:security
  ℹ tests 86
  ℹ suites 0
  ℹ pass 86
  ℹ fail 0
  ℹ duration_ms 1365.97175
  ```
- `npm run build`:
  ```bash
  $ npm run build
  vite v8.3.0 building client environment for production...
  ✓ 2556 modules transformed.
  ✓ built in 2.27s
  dist-electron/main.js 448.66 kB
  dist-electron/preload.js 7.59 kB
  ✓ built in 19ms
  ```

---

### Empirical Findings & Discovered Failure Modes

#### Finding 1 (CRITICAL): Store Boundary Bypass via Inverted / Case-Sensitive Profile Check in `StoreService`
- **Location**: `src/services/storeService.ts`, lines 268-276 and lines 446-451
- **Direct Code Citation**:
  ```typescript
  // src/services/storeService.ts:268
  const effectiveMode = securityContext?.appMode || this.runtimeSecurityProfile.appMode;
  const effectiveAssigned = securityContext?.assignedStoreIds || this.runtimeSecurityProfile.assignedStoreIds;

  // Security Guard: Prevent store hopping in STORE_CLIENT mode
  if (effectiveMode === 'STORE_CLIENT') {
    if (!this.isStoreAssigned(store, effectiveAssigned)) {
      logger.warn('SECURITY', `[Access Denied] Zablokowano próbę zmiany kawiarni na ${store.name} (${store.id}) na stacji klienckiej.`, {
        storeId: store.id,
        assignedStoreIds: effectiveAssigned,
      });
      throw new Error(`UnauthorizedStoreSwitchError: Odmowa dostępu — lokal "${store.name}" (${store.id}) nie jest przypisany do tej stacji roboczej.`);
    }
  }
  ```
- **Empirical Execution Command**:
  ```bash
  node --import tsx -e "
  import { StoreService } from './src/services/storeService';
  import { STARBUCKS_STORES_CATALOG } from './src/constants/starbucksStores';

  const storage = new Map();
  (globalThis as any).localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  };
  (globalThis as any).window = {
    dispatchEvent: (e) => true,
    api: {
      switchStoreDatabase: async (opts) => ({ success: true, dbPath: 'store_' + opts.storeId + '.db', isNew: false }),
      saveAppSettings: async () => ({ success: true }),
    }
  };
  (globalThis as any).CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i?.detail; } };

  const storeZloteTarasy = STARBUCKS_STORES_CATALOG.find(s => s.id === '108101');
  StoreService.setCurrentStore(storeZloteTarasy, {
    appMode: 'store_client', // Lowercase bypass attempt
    assignedStoreIds: ['108120']
  }).then(res => {
    console.log('Switch succeeded!', res);
    console.log('Saved store in localStorage:', storage.get('sbx_store_name'));
  });
  "
  ```
- **Observed Result**:
  ```
  🏬 [StoreService] Przełączono bazę kawiarni: store_108101.db (nowa: false)
  [INFO] [STORE] Przełączono aktywną kawiarnię na: 108101 SBX Warszawa Blue City (Kod: 18101, MPK: 108101)
  Switch succeeded! { success: true, dbPath: 'store_108101.db', isNew: false }
  Saved store in localStorage: 108101 SBX Warszawa Blue City
  ```
- **Impact**: Passing any non-canonical mode string (such as lowercase `'store_client'`, whitespace-padded `'STORE_CLIENT '`, or any untrusted string like `'CLIENT'`) bypasses the store assignment guard entirely, updates persistent storage (`sbx_store_name`), and instructs the Electron process to switch to the unassigned store's SQLite database (`store_108101.db`).
- Similarly, `StoreService.addCustomStore` (line 447) checks `if (effectiveMode === 'STORE_CLIENT')`, allowing arbitrary custom stores to be created and activated when `appMode: 'store_client'` is passed.

---

#### Finding 2 (HIGH): Insecure Default `appMode` in `StoreService.runtimeSecurityProfile`
- **Location**: `src/services/storeService.ts`, lines 31-37
- **Direct Code Citation**:
  ```typescript
  // src/services/storeService.ts:31
  private static runtimeSecurityProfile: {
    appMode: AppRuntimeMode | string;
    assignedStoreIds: string[];
  } = {
    appMode: 'FLEET_MASTER',
    assignedStoreIds: [],
  };
  ```
- **Empirical Execution Command**:
  ```bash
  node --import tsx -e "
  import { StoreService } from './src/services/storeService';
  console.log(StoreService.getRuntimeSecurityProfile());
  "
  ```
- **Observed Result**:
  ```
  { appMode: 'FLEET_MASTER', assignedStoreIds: [] }
  ```
- **Impact**: While `ProfilePolicyService` and `AuthContext` default to least-privilege `STORE_CLIENT`, `StoreService.runtimeSecurityProfile` statically initializes to `appMode: 'FLEET_MASTER'`. If `StoreService.setCurrentStore(store)` is invoked without an explicit `securityContext` argument (standard throughout the codebase and external plugins), `effectiveMode` defaults to `'FLEET_MASTER'`, permitting unrestricted switching to any store across the fleet.

---

#### Finding 3 (MEDIUM): Unhandled TypeError in `ProfilePolicyService.canSwitchToStore` on `null` `assignedStoreIds`
- **Location**: `src/services/security/profilePolicyService.ts`, line 86
- **Direct Code Citation**:
  ```typescript
  // src/services/security/profilePolicyService.ts:86
  const normalizedTarget = targetStoreId.toLowerCase().trim();
  return assignedStoreIds.some((id) => Boolean(id) && id.toLowerCase().trim() === normalizedTarget);
  ```
- **Observed Result**:
  When `assignedStoreIds` is `null` (e.g. unhydrated IPC state or API response), default parameter `assignedStoreIds = []` does NOT trigger (in JavaScript, defaults only apply to `undefined`). `assignedStoreIds.some` throws an unhandled exception:
  `TypeError: Cannot read properties of null (reading 'some')`.
  Contrast with `filterStoresForProfile` (line 101), which defensively checks `if (!assignedStoreIds || assignedStoreIds.length === 0) return [];`.

---

#### Finding 4 (MEDIUM): Unhandled TypeError in `FleetService.applyKillSwitch` on Missing Payload Fields
- **Location**: `src/services/admin/fleetService.ts`, line 264
- **Direct Code Citation**:
  ```typescript
  // src/services/admin/fleetService.ts:264
  public applyKillSwitch(payload: KillSwitchPayload): { success: boolean; error?: string } {
    const expectedChallenge = `REVOKE ${payload.storeId.toUpperCase()}`;
    if (payload.confirmationChallenge.trim().toUpperCase() !== expectedChallenge) {
      return { success: false, error: `Wymagane wpisanie dokładnej frazy: "${expectedChallenge}"` };
    }
  ```
- **Observed Result**:
  If `payload` lacks `storeId` or `confirmationChallenge` (e.g. caller passed `targetStoreId` or `confirmationChallenge` is omitted), `payload.storeId.toUpperCase()` crashes with `TypeError: Cannot read properties of undefined (reading 'toUpperCase')` rather than returning `{ success: false, error: '...' }`.

---

## 2. Logic Chain

1. **Premise**: In Milestone 2, the dual-profile security model dictates that retail store client stations (`STORE_CLIENT`) must never access unassigned store datasets or execute privileged fleet operations.
2. **Observation 1**: `ProfilePolicyService.getPolicy` correctly applies fail-closed security: ONLY exact `mode === 'FLEET_MASTER'` is granted elevated permissions; all other strings, variations, and nullish values receive restricted `STORE_CLIENT` permissions.
3. **Observation 2**: In `StoreService.setCurrentStore` and `StoreService.addCustomStore`, the logic is inverted: the code checks `if (effectiveMode === 'STORE_CLIENT')` to deny access, rather than checking `if (effectiveMode !== 'FLEET_MASTER')`.
4. **Inference 1**: Because of this inverted check, any variation such as `'store_client'`, `'CLIENT'`, or untrusted input evaluates `effectiveMode === 'STORE_CLIENT'` to `false`.
5. **Empirical Proof**: When executing `StoreService.setCurrentStore(storeZloteTarasy, { appMode: 'store_client', assignedStoreIds: ['108120'] })`, the guard was bypassed, `localStorage` was updated, and `switchStoreDatabase` was invoked for `store_108101.db`.
6. **Inference 2**: Furthermore, `StoreService.runtimeSecurityProfile` initializes to `FLEET_MASTER`. If `securityContext` is omitted, the method fails open and permits store switching.
7. **Conclusion**: The current implementation contains an open store boundary bypass vulnerability and fail-open default states that fail the security stress test requirements.

---

## 3. Caveats

- Electron native OS Keychain (`safeStorage`) and native dialogs (`showOpenDialog`) were mocked in the Node.js test environment; live native file dialogs were not exercised.
- Multi-process SQLite file locks under concurrent writes across separate physical OS processes were evaluated via IPC contract review rather than a multi-node cluster.

---

## 4. Conclusion & Verdict

**Verdict**: **REQUEST_CHANGES**

### Required Remediations for Worker 1:
1. **Fix `StoreService.setCurrentStore` & `addCustomStore` to Fail-Closed**:
   Change the inverted `if (effectiveMode === 'STORE_CLIENT')` check to:
   ```typescript
   // Ensure only FLEET_MASTER can switch arbitrarily; everything else is restricted
   const isFleetMaster = String(effectiveMode).trim().toUpperCase() === 'FLEET_MASTER';
   if (!isFleetMaster) {
     if (!this.isStoreAssigned(store, effectiveAssigned)) {
       throw new Error(`UnauthorizedStoreSwitchError: Odmowa dostępu — lokal "${store.name}" (${store.id}) nie jest przypisany do tej stacji roboczej.`);
     }
   }
   ```
   Apply the identical check in `StoreService.addCustomStore`.
2. **Fix Default State in `StoreService.runtimeSecurityProfile`**:
   Change default state from `'FLEET_MASTER'` to least-privilege `'STORE_CLIENT'`:
   ```typescript
   private static runtimeSecurityProfile: {
     appMode: AppRuntimeMode | string;
     assignedStoreIds: string[];
   } = {
     appMode: 'STORE_CLIENT',
     assignedStoreIds: [],
   };
   ```
3. **Defend `ProfilePolicyService.canSwitchToStore` against Null Inputs**:
   ```typescript
   if (!Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) {
     return false;
   }
   ```
4. **Defend `FleetService.applyKillSwitch` against Missing Fields**:
   ```typescript
   const targetId = payload?.storeId || (payload as any)?.targetStoreId;
   if (!targetId || typeof targetId !== 'string') {
     return { success: false, error: 'Nie podano identyfikatora lokalu dla operacji Kill-Switch.' };
   }
   const challenge = String(payload?.confirmationChallenge || '').trim().toUpperCase();
   const expectedChallenge = `REVOKE ${targetId.toUpperCase()}`;
   if (challenge !== expectedChallenge) {
     return { success: false, error: `Wymagane wpisanie dokładnej frazy: "${expectedChallenge}"` };
   }
   ```

---

## 5. Verification Method

1. Run automated security test suite:
   ```bash
   npm run test:security
   ```
   *Expected outcome*: 86/86 passing tests including `tests/security/challenger1_m2_isolation_privilege.test.ts`.
2. Run production compilation:
   ```bash
   npm run build
   ```
   *Expected outcome*: Exit code 0, 0 TypeScript or Vite build errors.
3. Verify bypass reproduction script:
   ```bash
   node --import tsx -e "
   import { StoreService } from './src/services/storeService';
   import { STARBUCKS_STORES_CATALOG } from './src/constants/starbucksStores';
   const store = STARBUCKS_STORES_CATALOG.find(s => s.id === '108101');
   StoreService.setCurrentStore(store, { appMode: 'store_client', assignedStoreIds: ['108120'] })
     .then(() => console.error('FAIL: Guard was bypassed!'))
     .catch(() => console.log('PASS: Successfully blocked by guard'));
   "
   ```
