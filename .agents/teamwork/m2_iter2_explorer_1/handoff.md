# Milestone 2 Iteration 2 Handoff Report: StoreService Guard & Default Profile Hardening

**Agent**: M2 Iteration 2 — Explorer 1 (`teamwork_preview_explorer`)  
**Role**: StoreService Guard & Default Profile Hardening  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_1`  
**Target File**: `/Users/dawidapel/COL Tool/src/services/storeService.ts`  
**Date**: 2026-10-26  
**Type**: Hard Handoff  

---

## 1. Observation

### 1.1 Direct File Observations & Code Citations

1. **Inverted & Case-Sensitive Guard in `StoreService.setCurrentStore`** (`src/services/storeService.ts:264–276`):
   ```typescript
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
   - **Vulnerability**: Any variation of the mode string that is not strictly `=== 'STORE_CLIENT'` (such as `'store_client'`, `'STORE_CLIENT '`, or any untrusted string) evaluates `effectiveMode === 'STORE_CLIENT'` to `false`. The guard is bypassed entirely, mutating persistent storage and switching SQLite databases.

2. **Inverted Guard in `StoreService.addCustomStore`** (`src/services/storeService.ts:446–451`):
   ```typescript
   const effectiveMode = securityContext?.appMode || this.runtimeSecurityProfile.appMode;
   if (effectiveMode === 'STORE_CLIENT') {
     logger.warn('SECURITY', `[Access Denied] Dodawanie własnych kawiarni jest zablokowane na stacji klienckiej.`);
     throw new Error('UnauthorizedStoreCreationError: Niedozwolone w trybie STORE_CLIENT — dodawanie kawiarni zablokowane.');
   }
   ```
   - **Vulnerability**: Identical inverted check allows custom store addition and activation when `appMode: 'store_client'` is passed.

3. **Insecure Default Profile in `StoreService.runtimeSecurityProfile`** (`src/services/storeService.ts:31–37`):
   ```typescript
   private static runtimeSecurityProfile: {
     appMode: AppRuntimeMode | string;
     assignedStoreIds: string[];
   } = {
     appMode: 'FLEET_MASTER',
     assignedStoreIds: [],
   };
   ```
   - **Vulnerability**: If `setCurrentStore` or `addCustomStore` is invoked without a `securityContext`, `effectiveMode` defaults to `'FLEET_MASTER'`, granting unrestricted store hopping and store creation across the fleet.

4. **Unhandled Browser Globals in Headless Node Runs** (`src/services/storeService.ts`):
   - `window.dispatchEvent` (lines 290, 347, 352, 402, 478, 510) throws `ReferenceError: window is not defined`.
   - `(window as any).api` (lines 303, 377, 469, 501) throws `ReferenceError: window is not defined`.
   - `localStorage.getItem` and `localStorage.setItem` (lines 65, 187, 201, 296, 393, 465, 498) throw `ReferenceError: localStorage is not defined`.

### 1.2 Tool Commands & Verbatim Execution Results

1. **Reproduction Command for Store Boundary Bypass**:
   ```bash
   node --import tsx -e "
   import { StoreService } from './src/services/storeService';
   import { STARBUCKS_STORES_CATALOG } from './src/constants/starbucksStores';
   const storage = new Map();
   (globalThis as any).localStorage = { getItem: (k) => storage.get(k) || null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) };
   (globalThis as any).window = { dispatchEvent: () => true, api: { switchStoreDatabase: async (opts) => ({ success: true, dbPath: 'store_' + opts.storeId + '.db', isNew: false }), saveAppSettings: async () => ({ success: true }) } };
   (globalThis as any).CustomEvent = class { constructor(t, i) { this.type = t; this.detail = i?.detail; } };
   const store = STARBUCKS_STORES_CATALOG.find(s => s.id === '108101');
   StoreService.setCurrentStore(store, { appMode: 'store_client', assignedStoreIds: ['108120'] }).then((res) => {
     console.log('BYPASS RESULT:', res);
     console.log('Saved store:', storage.get('sbx_store_name'));
   });
   "
   ```
   **Output**:
   ```
   🏬 [StoreService] Przełączono bazę kawiarni: store_108101.db (nowa: false)
   [INFO] [STORE] Przełączono aktywną kawiarnię na: 108101 SBX Warszawa Blue City (Kod: 18101, MPK: 108101)
   BYPASS RESULT: { success: true, dbPath: 'store_108101.db', isNew: false }
   Saved store: 108101 SBX Warszawa Blue City
   ```

2. **Reproduction Command for Initial Static Profile**:
   ```bash
   node --import tsx -e "
   import { StoreService } from './src/services/storeService';
   console.log('Default:', StoreService.getRuntimeSecurityProfile());
   "
   ```
   **Output**:
   ```
   Default: { appMode: 'FLEET_MASTER', assignedStoreIds: [] }
   ```

3. **Reproduction Command for Headless Node ReferenceError**:
   ```bash
   node --import tsx -e "
   import { StoreService } from './src/services/storeService';
   StoreService.initStore().catch(e => console.error('CRASH:', e.message));
   "
   ```
   **Output**:
   ```
   CRASH: window is not defined
   ```

---

## 2. Logic Chain

1. **Access Control Principle**: In dual-profile architecture, privileges must be granted strictly through whitelist validation (fail-closed).
2. **Analysis of Current Guard**: The condition `if (effectiveMode === 'STORE_CLIENT')` is a blacklist check. If `effectiveMode` is lowercase `'store_client'`, has surrounding whitespace, or is an arbitrary string, the check evaluates to `false`.
3. **Inference**: Consequently, any unauthenticated or malformed string escapes the `STORE_CLIENT` branch and inherits unrestricted fleet privileges.
4. **Analysis of Default Static State**: `runtimeSecurityProfile` initializes statically to `FLEET_MASTER`. When callers omit `securityContext`, `effectiveMode` defaults to `'FLEET_MASTER'`.
5. **Inference**: This violates least privilege and allows unassigned store switching on unconfigured stations.
6. **Analysis of Node Execution**: Node.js does not provide `window` or `localStorage`. Direct calls throw `ReferenceError`, polluting test execution and causing valid calls to return `{ success: false }`.
7. **Conclusion**: `StoreService` requires:
   - Fail-closed validation (`!isFleetMaster`).
   - Initialization to `STORE_CLIENT` with `assignedStoreIds: []`.
   - Defensive environment checks (`typeof window !== 'undefined'`, `typeof localStorage !== 'undefined'`).

---

## 3. Caveats

1. **Downstream Test Alignment**: `tests/security/challenger1_m2_isolation_privilege.test.ts` contains empirical vulnerability discovery tests (subtests 3.1 & 3.2) that specifically assert that the vulnerability exists (`assert.equal(switchResult.success, true)` and `assert.equal(initialStaticProfile.appMode, 'FLEET_MASTER')`). Once the fix is applied, the test suite must be updated to assert rejection and least-privilege defaults.
2. **Onboarding Initialization**: During initial first-run onboarding (`OnboardingWizardView`), store assignment is configured for the first time. The activation flow or onboarding handler must forward appropriate credentials or activate station licensing.

---

## 4. Conclusion

The vulnerabilities identified by Challenger 1 in `src/services/storeService.ts` are fully confirmed and reproducible.

### Specific Changes Required:
1. **Fix Guard in `setCurrentStore` & `addCustomStore`**:
   Replace `if (effectiveMode === 'STORE_CLIENT')` with:
   ```typescript
   const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
   if (!isFleetMaster) {
     if (!this.isStoreAssigned(store, effectiveAssigned)) {
       throw new Error(`UnauthorizedStoreSwitchError: Odmowa dostępu — lokal "${store.name}" (${store.id}) nie jest przypisany do tej stacji roboczej.`);
     }
   }
   ```
   And in `addCustomStore`:
   ```typescript
   const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
   if (!isFleetMaster) {
     throw new Error('UnauthorizedStoreCreationError: Niedozwolone w trybie STORE_CLIENT — dodawanie kawiarni zablokowane.');
   }
   ```
2. **Fix Default Static Profile**:
   Change `StoreService.runtimeSecurityProfile` to initialize to:
   ```typescript
   private static runtimeSecurityProfile = {
     appMode: 'STORE_CLIENT',
     assignedStoreIds: [],
   };
   ```
3. **Guard Browser Globals**:
   Wrap all `localStorage` reads/writes with `typeof localStorage !== 'undefined'`.
   Wrap all `window.dispatchEvent` calls with `typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'`.
   Safely retrieve Electron IPC with `typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null`.
4. **Full Diff Blueprint**: Detailed unified diff patch is documented in `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_1/report.md`.

---

## 5. Verification Method

1. **Automated Security Test Suite**:
   ```bash
   npm run test:security
   ```
   *Expected Outcome*: 86/86 passing tests with zero `ReferenceError: window is not defined` or `ReferenceError: localStorage is not defined` console errors.
2. **Production Compilation**:
   ```bash
   npm run build
   ```
   *Expected Outcome*: Exit code 0, 0 TypeScript or Vite errors.
3. **Store Boundary Adversarial Check**:
   ```bash
   node --import tsx -e "
   import { StoreService } from './src/services/storeService';
   import { STARBUCKS_STORES_CATALOG } from './src/constants/starbucksStores';
   const store = STARBUCKS_STORES_CATALOG.find(s => s.id === '108101');
   StoreService.setCurrentStore(store, { appMode: 'store_client', assignedStoreIds: ['108120'] })
     .then(() => { console.error('FAIL: Guard bypassed!'); process.exit(1); })
     .catch((err) => { console.log('PASS: Successfully blocked with', err.name); });
   "
   ```
   *Expected Outcome*: `PASS: Successfully blocked with Error [UnauthorizedStoreSwitchError]`.
