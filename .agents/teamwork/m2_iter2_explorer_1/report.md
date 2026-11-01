# Investigation & Hardening Report: StoreService Guard, Default Profile & Headless Node Safety

**Agent**: M2 Iteration 2 — Explorer 1 (`teamwork_preview_explorer`)  
**Role**: StoreService Guard & Default Profile Hardening  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_1`  
**Target File**: `/Users/dawidapel/COL Tool/src/services/storeService.ts`  
**Date**: 2026-10-26  

---

## Executive Summary

During Milestone 2 security verification, Challenger 1 discovered a critical store boundary bypass in `src/services/storeService.ts`: retail workstation sessions in `STORE_CLIENT` mode can escape their store boundaries and hopper arbitrarily across the 132-store fleet, or inject unauthorized custom stores, simply by supplying a lowercase or non-canonical mode string (such as `appMode: 'store_client'`). Furthermore, `StoreService.runtimeSecurityProfile` initializes statically to elevated `appMode: 'FLEET_MASTER'`, violating the principle of least privilege, and direct accesses to browser globals (`window.dispatchEvent`, `localStorage`) trigger unhandled `ReferenceError` crashes during headless Node.js execution.

This report documents the exhaustive empirical analysis, root causes, reproduction evidence, and provides an exact, production-ready diff blueprint to harden `src/services/storeService.ts`.

---

## 1. Vulnerability 1: Inverted & Case-Sensitive Profile Check (Store Boundary Bypass)

### 1.1 Observation & Code Citation
- **File**: `src/services/storeService.ts`
- **Lines 264–276** (`setCurrentStore`):
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
- **Lines 446–451** (`addCustomStore`):
  ```typescript
  const effectiveMode = securityContext?.appMode || this.runtimeSecurityProfile.appMode;
  if (effectiveMode === 'STORE_CLIENT') {
    logger.warn('SECURITY', `[Access Denied] Dodawanie własnych kawiarni jest zablokowane na stacji klienckiej.`);
    throw new Error('UnauthorizedStoreCreationError: Niedozwolone w trybie STORE_CLIENT — dodawanie kawiarni zablokowane.');
  }
  ```

### 1.2 Root Cause Analysis
The guard uses an **inverted, blacklist-style equality check**: `if (effectiveMode === 'STORE_CLIENT')`.
In security architecture, access control must follow the **fail-closed** (whitelist) model:
- Only an explicit, canonical `FLEET_MASTER` credential should grant unrestricted fleet-wide switching or store creation.
- Any other value (`'store_client'`, `'STORE_CLIENT '`, `'CLIENT'`, `undefined`, `null`, `''`, `'OPERATOR'`, etc.) evaluates `effectiveMode === 'STORE_CLIENT'` to `false`.
- Consequently, the execution jumps straight past the security block into the persistent store switching logic, overwriting `localStorage` (`sbx_store_name`, `sbx_unit_code`, etc.) and directing Electron IPC to switch to an unassigned store's SQLite database (`store_${id}.db`).

### 1.3 Empirical Verification & Reproduction
Executing an adversarial switch in Node.js with mock browser storage:
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

const store = STARBUCKS_STORES_CATALOG.find(s => s.id === '108101');
StoreService.setCurrentStore(store, { appMode: 'store_client', assignedStoreIds: ['108120'] })
  .then((res) => {
    console.log('BYPASS RESULT:', res);
    console.log('Saved store:', storage.get('sbx_store_name'));
  })
  .catch((err) => console.log('BLOCKED:', err.message));
"
```
**Observed Execution Output**:
```
🏬 [StoreService] Przełączono bazę kawiarni: store_108101.db (nowa: false)
[INFO] [STORE] Przełączono aktywną kawiarnię na: 108101 SBX Warszawa Blue City (Kod: 18101, MPK: 108101)
BYPASS RESULT: { success: true, dbPath: 'store_108101.db', isNew: false }
Saved store: 108101 SBX Warszawa Blue City
```
Similarly, executing `StoreService.addCustomStore(customStore, false, { appMode: 'store_client' })`:
```
ADD CUSTOM STORE BYPASS RESULT: { success: true }
Saved custom stores: [
  {
    "id": "attacker_custom_store_01",
    "name": "Attacker Rogue Store",
    "unitCode": "66666",
    ...
  }
]
```
The guard is completely bypassed in both cases.

### 1.4 Remediation Requirement
Enforce a strict, case-insensitive, trimmed whitelist check:
```typescript
const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
if (!isFleetMaster) {
  if (!this.isStoreAssigned(store, effectiveAssigned)) {
    logger.warn('SECURITY', `[Access Denied] Zablokowano próbę zmiany kawiarni na ${store.name} (${store.id}) na stacji klienckiej.`, {
      storeId: store.id,
      assignedStoreIds: effectiveAssigned,
    });
    throw new Error(`UnauthorizedStoreSwitchError: Odmowa dostępu — lokal "${store.name}" (${store.id}) nie jest przypisany do tej stacji roboczej.`);
  }
}
```
And in `addCustomStore`:
```typescript
const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
if (!isFleetMaster) {
  logger.warn('SECURITY', `[Access Denied] Dodawanie własnych kawiarni jest zablokowane na stacji klienckiej.`);
  throw new Error('UnauthorizedStoreCreationError: Niedozwolone w trybie STORE_CLIENT — dodawanie kawiarni zablokowane.');
}
```

---

## 2. Vulnerability 2: Fail-Open Default State in `StoreService.runtimeSecurityProfile`

### 2.1 Observation & Code Citation
- **File**: `src/services/storeService.ts`
- **Lines 31–37**:
  ```typescript
  private static runtimeSecurityProfile: {
    appMode: AppRuntimeMode | string;
    assignedStoreIds: string[];
  } = {
    appMode: 'FLEET_MASTER',
    assignedStoreIds: [],
  };
  ```

### 2.2 Root Cause Analysis
`StoreService.runtimeSecurityProfile` acts as the system-wide fallback state for all store operations when a method is called without an explicit `securityContext`.
By defaulting to `appMode: 'FLEET_MASTER'`:
1. If any background worker, external hook, or unhardened UI caller invokes `StoreService.setCurrentStore(store)` without passing `{ appMode, assignedStoreIds }`, the service assumes the caller is Fleet Master HQ.
2. In contrast, `AuthContext` (lines 48–56) and `ProfilePolicyService` default to least-privilege `STORE_CLIENT`. This creates an architectural impedance mismatch where UI components believe they are running in restricted mode, but the underlying service layer defaults open.

### 2.3 Empirical Verification
```bash
node --import tsx -e "
import { StoreService } from './src/services/storeService';
console.log('Current default profile:', StoreService.getRuntimeSecurityProfile());
"
```
**Observed Execution Output**:
```
Current default profile: { appMode: 'FLEET_MASTER', assignedStoreIds: [] }
```

### 2.4 Remediation Requirement
Initialize `runtimeSecurityProfile` strictly to least-privilege `STORE_CLIENT`:
```typescript
private static runtimeSecurityProfile: {
  appMode: AppRuntimeMode | string;
  assignedStoreIds: string[];
} = {
  appMode: 'STORE_CLIENT',
  assignedStoreIds: [],
};
```
And harden `setRuntimeSecurityProfile`:
```typescript
public static setRuntimeSecurityProfile(
  appMode: AppRuntimeMode | string,
  assignedStoreIds: string[] = []
): void {
  this.runtimeSecurityProfile = {
    appMode: appMode || 'STORE_CLIENT',
    assignedStoreIds: Array.isArray(assignedStoreIds) ? assignedStoreIds : [],
  };
}
```

---

## 3. Vulnerability 3: Headless Node Environment Crashes & ReferenceErrors

### 3.1 Observation & Code Citation
In `src/services/storeService.ts`, several methods directly dereference browser globals without checking if the code is executing in a headless Node.js context (such as unit test runners, Electron main worker threads, or background CLI tasks):

1. **`localStorage` Accesses**:
   - Line 65 (`getCustomStores`): `localStorage.getItem(STORAGE_CUSTOM_STORES_KEY)`
   - Line 187–189 (`hasConfiguredStore`): `localStorage.getItem(STORAGE_STORE_NAME_KEY)`
   - Lines 201–203, 232–233 (`getCurrentStore`): multiple `localStorage.getItem`
   - Lines 296–300 (`setCurrentStore`): multiple `localStorage.setItem`
   - Line 393 (`initStore`): `localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, ...)`
   - Line 465 (`addCustomStore`): `localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, ...)`
   - Line 498 (`removeCustomStore`): `localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, ...)`

2. **`window` and `window.dispatchEvent` Accesses**:
   - Line 290 (`setCurrentStore`): `window.dispatchEvent(new CustomEvent('sbx:store-switching', ...))`
   - Line 303 (`setCurrentStore`): `(window as any).api || (window as any).electronAPI`
   - Line 347, 352 (`setCurrentStore`): `window.dispatchEvent(new CustomEvent('sbx:store-switched', ...))`
   - Line 377 (`initStore`): `(window as any).api || (window as any).electronAPI`
   - Line 402 (`initStore`): `window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'))`
   - Line 469 (`addCustomStore`): `(window as any).api || (window as any).electronAPI`
   - Line 478 (`addCustomStore`): `window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'))`
   - Line 501 (`removeCustomStore`): `(window as any).api || (window as any).electronAPI`
   - Line 510 (`removeCustomStore`): `window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'))`

### 3.2 Empirical Verification
Running in clean Node.js (`node --import tsx`):
- `StoreService.getCurrentStore()`:
  ```
  Błąd odczytu aktualnej kawiarni z localStorage: ReferenceError: localStorage is not defined
      at StoreService.getCurrentStore (/Users/dawidapel/COL Tool/src/services/storeService.ts:201:25)
  ```
- `StoreService.initStore()`:
  ```
  initStore rejected: ReferenceError: window is not defined
      at StoreService.initStore (/Users/dawidapel/COL Tool/src/services/storeService.ts:377:21)
  ```
- `StoreService.setCurrentStore(store)`:
  ```
  Błąd zmiany kawiarni w StoreService: ReferenceError: window is not defined
      at StoreService.setCurrentStore (/Users/dawidapel/COL Tool/src/services/storeService.ts:290:7)
  ```
  And returns `{ success: false }` even when the store switch was completely valid.

### 3.3 Remediation Requirement
1. **Guard `localStorage`**:
   - In `getCustomStores`, `hasConfiguredStore`, and `getCurrentStore`: Check `if (typeof localStorage === 'undefined')` and return safe defaults (`[]`, `false`, default empty store) immediately without triggering catch blocks.
   - In `setCurrentStore`, `initStore`, `addCustomStore`, and `removeCustomStore`: Wrap all `localStorage.setItem` in `if (typeof localStorage !== 'undefined') { try { ... } catch {} }`.
2. **Guard `window` and Electron API**:
   - Replace raw `(window as any).api || (window as any).electronAPI` with:
     ```typescript
     const apiObj = typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null;
     ```
3. **Guard `window.dispatchEvent` and `CustomEvent`**:
   - Ensure event emission checks both `typeof window !== 'undefined'` and `typeof window.dispatchEvent === 'function'`.
   - Protect `new CustomEvent(...)` against environments where `CustomEvent` is undefined:
     ```typescript
     if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
       try {
         if (typeof CustomEvent !== 'undefined') {
           window.dispatchEvent(new CustomEvent(name, { detail }));
         } else {
           window.dispatchEvent({ type: name, detail } as any);
         }
       } catch (eventErr) {
         console.warn(`[StoreService] Failed to dispatch event "${name}":`, eventErr);
       }
     }
     ```

---

## 4. Additional Defensive Hardening

### 4.1 `isStoreAssigned` Array Safety
In `StoreService.isStoreAssigned`:
```typescript
public static isStoreAssigned(store: StarbucksStore, assignedStoreIds: string[]): boolean {
  if (!assignedStoreIds || !Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) return false;
  const normalizedAssigned = assignedStoreIds
    .filter(Boolean)
    .map((id) => String(id).trim().toLowerCase());

  const matches = (candidate?: string) =>
    Boolean(candidate && normalizedAssigned.includes(String(candidate).trim().toLowerCase()));

  return matches(store.id) || matches(store.unitCode) || matches(store.mpk);
}
```
Defends against `null`, non-array objects, and non-string IDs.

### 4.2 `getAvailableStoresForProfile` Fail-Closed Check
Lines 158–165:
```typescript
public static getAvailableStoresForProfile(
  mode: AppRuntimeMode | string,
  assignedStoreIds: string[] = []
): StarbucksStore[] {
  const allStores = this.getAllStores();
  const isFleetMaster = String(mode || '').trim().toUpperCase() === 'FLEET_MASTER';
  if (isFleetMaster) {
    return allStores;
  }
  // Rest of restricted filtering...
```
Ensures that case variations (e.g. `'fleet_master'`) are normalized and unknown modes fail closed.

### 4.3 `removeCustomStore` Security Guard
Prevent unauthorized removal of custom stores in `STORE_CLIENT` mode:
```typescript
public static async removeCustomStore(
  storeId: string,
  securityContext?: { appMode: AppRuntimeMode | string }
): Promise<void> {
  const effectiveMode = securityContext?.appMode ?? this.runtimeSecurityProfile.appMode;
  const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
  if (!isFleetMaster) {
    logger.warn('SECURITY', `[Access Denied] Usuwanie kawiarni jest zablokowane na stacji klienckiej.`);
    throw new Error('UnauthorizedStoreRemovalError: Niedozwolone w trybie STORE_CLIENT — usuwanie kawiarni zablokowane.');
  }
  // Safe storage removal...
```

### 4.4 `addCustomStore` Forwarding `FLEET_MASTER` Context on Activation
In `addCustomStore`, line 482 currently calls:
```typescript
if (activate) {
  return await this.setCurrentStore(storeToSave);
}
```
If `runtimeSecurityProfile` is `STORE_CLIENT`, and the newly added custom store is not yet in `assignedStoreIds`, calling `setCurrentStore` without security context would block its activation!
Fix: Forward the validated `FLEET_MASTER` security context:
```typescript
if (activate) {
  return await this.setCurrentStore(storeToSave, { appMode: 'FLEET_MASTER' });
}
```

---

## 5. Downstream Impact & Test Suite Alignment

### 5.1 Test Suite Updates Needed in `tests/security/challenger1_m2_isolation_privilege.test.ts`
Challenger 1 added empirical vulnerability verification tests that asserted the vulnerability existed:
1. **Subtest 3.1** (`Vulnerability Discovery: StoreService setCurrentStore bypass with lowercase appMode`):
   Currently asserts `assert.equal(switchResult.success, true)`.
   Once hardened, this call will reject with `UnauthorizedStoreSwitchError`.
   **Update**: Change to assert rejection:
   ```typescript
   await assert.rejects(
     async () => {
       await StoreService.setCurrentStore(storeZloteTarasy, {
         appMode: 'store_client',
         assignedStoreIds: ['108120'],
       });
     },
     /UnauthorizedStoreSwitchError|Odmowa dostępu/i,
     'StoreService.setCurrentStore must reject unassigned store switch when appMode is lowercase "store_client"'
   );
   ```
2. **Subtest 3.2** (`Vulnerability Discovery: StoreService initial static profile is FLEET_MASTER`):
   Currently asserts `assert.equal(initialStaticProfile.appMode, 'FLEET_MASTER')`.
   Once hardened, initial static profile will be `'STORE_CLIENT'`.
   **Update**: Change to:
   ```typescript
   assert.equal(
     initialStaticProfile.appMode,
     'STORE_CLIENT',
     'StoreService.runtimeSecurityProfile must initialize to least-privilege STORE_CLIENT'
   );
   ```

### 5.2 Elimination of Node Test Console Pollution
Currently, running `npm run test:security` outputs multiple red `ReferenceError: localStorage is not defined` and `ReferenceError: window is not defined` stack traces to stderr during `dual_profile_isolation.test.ts`. Applying the headless guards eliminates these spurious errors entirely.

---

## 6. Complete Implementation Blueprint (Diff Patch)

Below is the exact diff blueprint for the implementer/worker to apply to `src/services/storeService.ts`:

```diff
--- a/src/services/storeService.ts
+++ b/src/services/storeService.ts
@@ -31,18 +31,18 @@ export class StoreService {
   private static runtimeSecurityProfile: {
     appMode: AppRuntimeMode | string;
     assignedStoreIds: string[];
   } = {
-    appMode: 'FLEET_MASTER',
+    appMode: 'STORE_CLIENT',
     assignedStoreIds: [],
   };
 
   public static setRuntimeSecurityProfile(
     appMode: AppRuntimeMode | string,
     assignedStoreIds: string[] = []
   ): void {
     this.runtimeSecurityProfile = {
-      appMode,
-      assignedStoreIds,
+      appMode: appMode || 'STORE_CLIENT',
+      assignedStoreIds: Array.isArray(assignedStoreIds) ? assignedStoreIds : [],
     };
   }
 
@@ -62,6 +62,7 @@ export class StoreService {
    * Zwraca listę własnych kawiarni dodanych przez użytkownika
    */
   public static getCustomStores(): StarbucksStore[] {
+    if (typeof localStorage === 'undefined') return [];
     try {
       const data = localStorage.getItem(STORAGE_CUSTOM_STORES_KEY);
       if (data) {
@@ -140,11 +141,11 @@ export class StoreService {
    * Sprawdza, czy dana kawiarnia pasuje do listy przypisanych identyfikatorów (id, unitCode, mpk)
    */
   public static isStoreAssigned(store: StarbucksStore, assignedStoreIds: string[]): boolean {
-    if (!assignedStoreIds || assignedStoreIds.length === 0) return false;
+    if (!assignedStoreIds || !Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) return false;
     const normalizedAssigned = assignedStoreIds
       .filter(Boolean)
-      .map((id) => id.trim().toLowerCase());
+      .map((id) => String(id).trim().toLowerCase());
 
     const matches = (candidate?: string) =>
-      Boolean(candidate && normalizedAssigned.includes(candidate.trim().toLowerCase()));
+      Boolean(candidate && normalizedAssigned.includes(String(candidate).trim().toLowerCase()));
 
     return matches(store.id) || matches(store.unitCode) || matches(store.mpk);
   }
@@ -158,8 +159,9 @@ export class StoreService {
   public static getAvailableStoresForProfile(
     mode: AppRuntimeMode | string,
     assignedStoreIds: string[] = []
   ): StarbucksStore[] {
     const allStores = this.getAllStores();
-    if (mode === 'FLEET_MASTER') {
+    const isFleetMaster = String(mode || '').trim().toUpperCase() === 'FLEET_MASTER';
+    if (isFleetMaster) {
       return allStores;
     }
 
@@ -183,6 +185,7 @@ export class StoreService {
    * Sprawdza czy użytkownik skonfigurował już kawiarnię (zakończył onboarding)
    */
   public static hasConfiguredStore(): boolean {
+    if (typeof localStorage === 'undefined') return false;
     try {
       const savedName = localStorage.getItem(STORAGE_STORE_NAME_KEY)?.trim();
       const savedUnitCode = localStorage.getItem(STORAGE_UNIT_CODE_KEY)?.trim();
@@ -197,6 +200,7 @@ export class StoreService {
    * Zwraca aktualnie aktywną kawiarnię
    */
   public static getCurrentStore(): StarbucksStore {
+    if (typeof localStorage !== 'undefined') {
       try {
         const savedName = localStorage.getItem(STORAGE_STORE_NAME_KEY);
         const savedUnitCode = localStorage.getItem(STORAGE_UNIT_CODE_KEY);
@@ -237,7 +241,8 @@ export class StoreService {
         }
       } catch (e) {
         console.warn('Błąd odczytu aktualnej kawiarni z localStorage:', e);
       }
+    }
 
     // Gdy brak zapisanej kawiarni (stan początkowy przed ukończeniem kreatora konfiguracji)
     return {
@@ -261,12 +266,13 @@ export class StoreService {
     store: StarbucksStore,
     securityContext?: { appMode: AppRuntimeMode | string; assignedStoreIds?: string[] }
   ): Promise<{ success: boolean; isNew?: boolean; error?: string }> {
-    const effectiveMode = securityContext?.appMode || this.runtimeSecurityProfile.appMode;
-    const effectiveAssigned = securityContext?.assignedStoreIds || this.runtimeSecurityProfile.assignedStoreIds;
+    const effectiveMode = securityContext?.appMode ?? this.runtimeSecurityProfile.appMode;
+    const effectiveAssigned = securityContext?.assignedStoreIds ?? this.runtimeSecurityProfile.assignedStoreIds;
 
-    // Security Guard: Prevent store hopping in STORE_CLIENT mode
-    if (effectiveMode === 'STORE_CLIENT') {
+    // Fail-Closed Security Guard: Only explicit FLEET_MASTER can switch to any store.
+    // All other modes (STORE_CLIENT, lowercase 'store_client', or tampered values) are restricted.
+    const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
+    if (!isFleetMaster) {
       if (!this.isStoreAssigned(store, effectiveAssigned)) {
         logger.warn('SECURITY', `[Access Denied] Zablokowano próbę zmiany kawiarni na ${store.name} (${store.id}) na stacji klienckiej.`, {
           storeId: store.id,
@@ -287,20 +293,31 @@ export class StoreService {
         fromStoreId: prevStore.id,
         toStoreId: store.id,
         timestamp: Date.now(),
       };
-      window.dispatchEvent(
-        new CustomEvent('sbx:store-switching', {
-          detail: switchingDetail,
-        })
-      );
-
-      localStorage.setItem(STORAGE_STORE_NAME_KEY, store.name);
-      localStorage.setItem(STORAGE_UNIT_CODE_KEY, store.unitCode);
-      localStorage.setItem(STORAGE_STORE_MPK_KEY, store.mpk);
-      localStorage.setItem(STORAGE_STORE_DISTRICT_KEY, store.district);
-      localStorage.setItem(STORAGE_STORE_CITY_KEY, store.city);
+      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
+        try {
+          if (typeof CustomEvent !== 'undefined') {
+            window.dispatchEvent(
+              new CustomEvent('sbx:store-switching', { detail: switchingDetail })
+            );
+          } else {
+            window.dispatchEvent({ type: 'sbx:store-switching', detail: switchingDetail } as any);
+          }
+        } catch (eventErr) {
+          console.warn('[StoreService] Failed to dispatch sbx:store-switching event:', eventErr);
+        }
+      }
+
+      if (typeof localStorage !== 'undefined') {
+        try {
+          localStorage.setItem(STORAGE_STORE_NAME_KEY, store.name);
+          localStorage.setItem(STORAGE_UNIT_CODE_KEY, store.unitCode);
+          localStorage.setItem(STORAGE_STORE_MPK_KEY, store.mpk);
+          localStorage.setItem(STORAGE_STORE_DISTRICT_KEY, store.district);
+          localStorage.setItem(STORAGE_STORE_CITY_KEY, store.city);
+        } catch (storageErr) {
+          console.warn('[StoreService] Failed to persist store to localStorage:', storageErr);
+        }
+      }
 
       // Przełączenie pliku bazy SQLite w Electronie na bazę tej kawiarni
-      const apiObj = (window as any).api || (window as any).electronAPI;
+      const apiObj = typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null;
       let switchResult: any = { success: true };
       if (apiObj?.switchStoreDatabase) {
@@ -344,14 +361,21 @@ export class StoreService {
         isNewDb: Boolean(switchResult?.isNew),
         timestamp: Date.now(),
       };
-      window.dispatchEvent(
-        new CustomEvent('sbx:store-switched', {
-          detail: switchedDetail,
-        })
-      );
-      window.dispatchEvent(
-        new CustomEvent('sbx-store-changed', {
-          detail: store,
-        })
-      );
+      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
+        try {
+          if (typeof CustomEvent !== 'undefined') {
+            window.dispatchEvent(
+              new CustomEvent('sbx:store-switched', { detail: switchedDetail })
+            );
+            window.dispatchEvent(
+              new CustomEvent('sbx-store-changed', { detail: store })
+            );
+          } else {
+            window.dispatchEvent({ type: 'sbx:store-switched', detail: switchedDetail } as any);
+            window.dispatchEvent({ type: 'sbx-store-changed', detail: store } as any);
+          }
+        } catch (eventErr) {
+          console.warn('[StoreService] Failed to dispatch store switched events:', eventErr);
+        }
+      }
 
       return switchResult;
@@ -374,7 +398,7 @@ export class StoreService {
       console.warn('Błąd migracji kluczy legacy w StoreStorage:', e);
     }
 
-    const apiObj = (window as any).api || (window as any).electronAPI;
+    const apiObj = typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null;
 
     // 1. Wczytanie własnych kawiarni z trwałego pliku na dysku w Electronie
     if (apiObj?.getCustomStores) {
@@ -390,7 +414,11 @@ export class StoreService {
           }
 
           const merged = Array.from(localMap.values());
-          localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(merged));
+          if (typeof localStorage !== 'undefined') {
+            try {
+              localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(merged));
+            } catch {}
+          }
           this.invalidateCache();
           
           // Zapewnij, że plik na dysku zawiera pełny zbiór
@@ -399,7 +427,11 @@ export class StoreService {
           }
 
           // Powiadom komponenty o zaktualizowaniu listy kawiarni
-          window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'));
+          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
+            try {
+              window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'));
+            } catch {}
+          }
         } else {
           // Jeśli na dysku pusto, ale w localStorage są zapisane kawiarnie — zrzuć je na dysk!
@@ -443,10 +475,11 @@ export class StoreService {
     activate = true,
     securityContext?: { appMode: AppRuntimeMode | string }
   ): Promise<{ success: boolean; isNew?: boolean; error?: string }> {
-    const effectiveMode = securityContext?.appMode || this.runtimeSecurityProfile.appMode;
-    if (effectiveMode === 'STORE_CLIENT') {
+    const effectiveMode = securityContext?.appMode ?? this.runtimeSecurityProfile.appMode;
+    const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
+    if (!isFleetMaster) {
       logger.warn('SECURITY', `[Access Denied] Dodawanie własnych kawiarni jest zablokowane na stacji klienckiej.`);
       throw new Error('UnauthorizedStoreCreationError: Niedozwolone w trybie STORE_CLIENT — dodawanie kawiarni zablokowane.');
     }
 
     try {
@@ -462,10 +495,14 @@ export class StoreService {
       }
 
       // 1. Zapis w localStorage
-      localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(customStores));
+      if (typeof localStorage !== 'undefined') {
+        try {
+          localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(customStores));
+        } catch (storageErr) {
+          console.warn('[StoreService] Failed to save custom stores to localStorage:', storageErr);
+        }
+      }
       this.invalidateCache();
 
       // 2. Trwały zapis na dysku w Electronie
-      const apiObj = (window as any).api || (window as any).electronAPI;
+      const apiObj = typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null;
       if (apiObj?.saveCustomStores) {
         try {
           await apiObj.saveCustomStores(customStores);
@@ -475,11 +512,15 @@ export class StoreService {
         }
       }
 
-      window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'));
+      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
+        try {
+          window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'));
+        } catch {}
+      }
 
       // 3. Aktywacja nowej kawiarni
       if (activate) {
-        return await this.setCurrentStore(storeToSave);
+        return await this.setCurrentStore(storeToSave, { appMode: 'FLEET_MASTER' });
       }
 
       return { success: true };
@@ -492,10 +533,23 @@ export class StoreService {
    * Usuwa własną kawiarnię z listy w localStorage oraz na dysku
    */
-  public static async removeCustomStore(storeId: string): Promise<void> {
+  public static async removeCustomStore(
+    storeId: string,
+    securityContext?: { appMode: AppRuntimeMode | string }
+  ): Promise<void> {
+    const effectiveMode = securityContext?.appMode ?? this.runtimeSecurityProfile.appMode;
+    const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
+    if (!isFleetMaster) {
+      logger.warn('SECURITY', `[Access Denied] Usuwanie kawiarni jest zablokowane na stacji klienckiej.`);
+      throw new Error('UnauthorizedStoreRemovalError: Niedozwolone w trybie STORE_CLIENT — usuwanie kawiarni zablokowane.');
+    }
+
     try {
       const customStores = this.getCustomStores().filter((s) => s.id !== storeId);
-      localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(customStores));
+      if (typeof localStorage !== 'undefined') {
+        try {
+          localStorage.setItem(STORAGE_CUSTOM_STORES_KEY, JSON.stringify(customStores));
+        } catch (storageErr) {
+          console.warn('[StoreService] Failed to update custom stores in localStorage:', storageErr);
+        }
+      }
       this.invalidateCache();
 
-      const apiObj = (window as any).api || (window as any).electronAPI;
+      const apiObj = typeof window !== 'undefined' ? ((window as any).api || (window as any).electronAPI) : null;
       if (apiObj?.saveCustomStores) {
         try {
           await apiObj.saveCustomStores(customStores);
@@ -507,7 +561,11 @@ export class StoreService {
         }
       }
 
-      window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'));
+      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
+        try {
+          window.dispatchEvent(new CustomEvent('sbx-stores-list-updated'));
+        } catch {}
+      }
     } catch (e) {
       console.error('Błąd usuwania kawiarni w StoreService:', e);
     }
```
