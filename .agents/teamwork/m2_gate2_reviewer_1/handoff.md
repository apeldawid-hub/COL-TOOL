# Review & Adversarial Challenge Report: Milestone 2 Gate 2

**Agent**: M2 Gate 2 Reviewer 1 (`teamwork_preview_reviewer`)  
**Roles**: Reviewer, Adversarial Critic  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_gate2_reviewer_1`  
**Date**: 2026-10-26T21:19:00Z  
**Verdict**: **APPROVE**  

---

## 1. Observation

Direct empirical observations across the codebase, test execution, and adversarial evaluations:

1. **Least-Privilege Initialization in `src/services/storeService.ts`**:
   - Lines 31–37:
     ```typescript
     private static runtimeSecurityProfile: {
       appMode: AppRuntimeMode | string;
       assignedStoreIds: string[];
     } = {
       appMode: 'STORE_CLIENT',
       assignedStoreIds: [],
     };
     ```
   - Lines 39–47:
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
   - Confirmed: Defaults to `STORE_CLIENT` with an empty assigned stores array `[]`.

2. **Fail-Closed Authorization Guards in `src/services/storeService.ts`**:
   - In `setCurrentStore` (lines 272–283):
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
   - In `addCustomStore` (lines 481–486):
     ```typescript
     const effectiveMode = securityContext?.appMode ?? this.runtimeSecurityProfile.appMode;
     const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
     if (!isFleetMaster) {
       logger.warn('SECURITY', `[Access Denied] Dodawanie własnych kawiarni jest zablokowane na stacji klienckiej.`);
       throw new Error('UnauthorizedStoreCreationError: Niedozwolone w trybie STORE_CLIENT — dodawanie kawiarni zablokowane.');
     }
     ```
   - In `removeCustomStore` (lines 545–550):
     ```typescript
     const effectiveMode = securityContext?.appMode ?? this.runtimeSecurityProfile.appMode;
     const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER';
     if (!isFleetMaster) {
       logger.warn('SECURITY', `[Access Denied] Usuwanie kawiarni jest zablokowane na stacji klienckiej.`);
       throw new Error('UnauthorizedStoreRemovalError: Niedozwolone w trybie STORE_CLIENT — usuwanie kawiarni zablokowane.');
     }
     ```
   - Confirmed: Lowercase `'store_client'`, empty strings, missing modes, or non-whitelisted strings are strictly denied.

3. **Safe Headless Execution in `src/services/storeService.ts`**:
   - Every `localStorage` call is guarded with `typeof localStorage !== 'undefined'` (lines 64, 188, 203, 310, 420, 501, 554).
   - Every `window` call is guarded with `typeof window !== 'undefined'` (lines 296, 323, 367, 404, 433, 511, 520, 563, 572).
   - `CustomEvent` dispatches are guarded with `typeof CustomEvent !== 'undefined'` (lines 298, 369) or enclosed in `try { ... } catch {}` (lines 435, 522, 574).
   - Executing `StoreService` methods directly in raw Node.js produces zero `ReferenceError` crashes.

4. **Defensive Guards in `src/services/security/profilePolicyService.ts`**:
   - In `canSwitchToStore` (lines 72–94):
     ```typescript
     if (!targetStoreId || typeof targetStoreId !== 'string' || !targetStoreId.trim()) {
       return false;
     }
     if (mode === 'FLEET_MASTER') {
       return true;
     }
     if (!Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) {
       return false;
     }
     const normalizedTarget = targetStoreId.toLowerCase().trim();
     return assignedStoreIds.some(
       (id) => typeof id === 'string' && Boolean(id.trim()) && id.toLowerCase().trim() === normalizedTarget
     );
     ```
   - In `filterStoresForProfile` (lines 99–129):
     Explicit checks `!Array.isArray(stores)` and `!Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0` guarantee that `null`, `undefined`, non-array objects, and arrays with malformed items never cause `TypeError` crashes.

5. **Defensive Sanitization in `src/services/admin/fleetService.ts`**:
   - In `applyKillSwitch` (lines 264–278):
     Validates `payload`, normalizes `targetId` via `String(payload.storeId || payload.targetStoreId || '').trim()`, and normalizes `confirmationChallenge` via `String(payload.confirmationChallenge || '').trim().toUpperCase()`.
   - In `getRequiredChallengeCode` (lines 417–420):
     `const id = String(storeId || '').trim(); return id ? 'REVOKE ' + id.toUpperCase() : '';` safely handles `null`, `undefined`, and whitespace strings.
   - In `executeKillSwitch` (line 575): returns `action: 'KILL_SWITCH_REVOKE'`, strictly matching the `FleetAuditAction` type.
   - Both methods dispatch `sbx:license-revoked` guarded by `typeof window !== 'undefined'`.

6. **Automated Test Suite & Build Output**:
   - Command: `npm run test:security`
     ```
     ℹ tests 86
     ℹ suites 0
     ℹ pass 86
     ℹ fail 0
     ℹ cancelled 0
     ℹ skipped 0
     ℹ todo 0
     ℹ duration_ms 1979.21475
     ```
     Exit code: 0.
   - Command: `npm run build`
     ```
     > starbucks-operations-suite@2.8.70 build
     > tsc && vite build
     ...
     ✓ built in 2.92s
     ✓ built in 180ms
     ✓ built in 23ms
     ```
     Exit code: 0.

7. **Independent Adversarial Probe via Node.js**:
   - Ran custom node stress tests checking:
     - `canSwitchToStore(null, null, null)` -> `false` (no throw)
     - `canSwitchToStore('STORE_CLIENT', '108120', [null, undefined, 123, '108120'])` -> `true`
     - `filterStoresForProfile(null, 'STORE_CLIENT', null)` -> `[]` (no throw)
     - `getRequiredChallengeCode(null)` -> `""` (no throw)
     - `StoreService.setCurrentStore(storeZloteTarasy)` with default profile -> throws `UnauthorizedStoreSwitchError`
     - `StoreService.setCurrentStore(storeZloteTarasy, { appMode: 'store_client' })` -> throws `UnauthorizedStoreSwitchError`
     - `StoreService.addCustomStore(storeRogue)` with default profile -> throws `UnauthorizedStoreCreationError`
     - Headless `StoreService.setCurrentStore(storeJanki, { appMode: 'FLEET_MASTER' })` -> passes without `ReferenceError`.

---

## 2. Logic Chain

1. **Least-Privilege Enforcement**:
   - By initializing `StoreService.runtimeSecurityProfile` with `{ appMode: 'STORE_CLIENT', assignedStoreIds: [] }` (Observation 1), unauthenticated, default, or background calls operate with retail station isolation, preventing unintentional fleet-wide elevation.

2. **Tamper-Proof Fail-Closed Authorization**:
   - Inverted checks (e.g. `if (effectiveMode === 'STORE_CLIENT')`) are inherently vulnerable to non-exact strings like `'store_client'` or `'OPERATOR'`. Replacing them with whitelist checks `const isFleetMaster = String(effectiveMode || '').trim().toUpperCase() === 'FLEET_MASTER'` (Observation 2) guarantees that only explicit `FLEET_MASTER` sessions can switch unassigned stores or mutate custom stores. All other modes fail closed to retail boundaries.

3. **Headless & SSR Runtime Stability**:
   - Node.js environments (such as unit test runners or CLI scripts) do not expose browser globals. By strictly checking `typeof window !== 'undefined'`, `typeof localStorage !== 'undefined'`, and `typeof CustomEvent !== 'undefined'` (Observation 3), the codebase executes deterministically without `ReferenceError` crashes or polluted stderr output.

4. **Input Boundary Resilience in Policies**:
   - Default argument assignment in JavaScript does not trigger on `null`. By adding explicit `Array.isArray` guards and filtering non-string elements (Observation 4), `ProfilePolicyService` avoids `TypeError: Cannot read properties of null (reading 'some')`, safely rejecting invalid payloads without crashing the process.

5. **Kill-Switch Robustness & Audit Alignment**:
   - Normalizing `storeId`/`targetStoreId` and confirmation challenges (Observation 5) allows the administrative Kill-Switch to withstand malformed inputs while enforcing exact authorization phrases. Harmonizing the return action to `'KILL_SWITCH_REVOKE'` maintains audit log integrity and schema compliance.

6. **Integrity & Verification**:
   - Observations 6 and 7 verify that no facade implementations, dummy checks, or hardcoded test bypasses exist. Production code implements genuine logic, all 86 unit and integration tests pass, and TypeScript builds cleanly without errors.

---

## 3. Caveats

- **Scope Boundary**: Milestone 2 governs runtime profile segregation, Store Client restriction, and Fleet Master control. Hardware fingerprinting and activation keys were audited under Milestone 1. Corporate 2FA (`LoginView.tsx`) and BIP-39 disaster recovery (`masterRecoveryService.ts`) are scheduled for Milestones 3 and 4, respectively.
- **Custom Stores Restriction**: Non-`FLEET_MASTER` callers cannot add or remove custom stores via `StoreService`. This is an intentional security design choice to prevent rogue store injection on backroom client stations.

---

## 4. Conclusion

**Verdict: APPROVE**

The security hardening and architectural remediations applied to `src/services/storeService.ts`, `src/services/security/profilePolicyService.ts`, and `src/services/admin/fleetService.ts` fulfill all Milestone 2 security requirements:
- Least-privilege initialization is enforced by default (`STORE_CLIENT`, `[]`).
- Authorization is strictly fail-closed whitelist based on `'FLEET_MASTER'`.
- All browser global accesses are fully guarded for headless Node.js execution.
- Input validation in `ProfilePolicyService` and `FleetService` handles `null`, empty, and non-array parameters gracefully without unhandled exceptions.
- 86/86 security tests pass cleanly, and the production build compiles with zero TypeScript or Vite errors.
- No integrity violations, facade implementations, or bypasses were found.

---

## 5. Verification Method

To independently verify these results:

1. **Security Test Suite**:
   ```bash
   npm run test:security
   ```
   *Expected Output*: 86 tests pass, 0 fail, exit code 0.

2. **Production Build**:
   ```bash
   npm run build
   ```
   *Expected Output*: `tsc` and Vite build complete cleanly with 0 errors, exit code 0.

3. **Headless & Adversarial Stress Probe**:
   ```bash
   node --import tsx -e "
   import { ProfilePolicyService } from './src/services/security/profilePolicyService.ts';
   import { StoreService } from './src/services/storeService.ts';
   import { FleetService } from './src/services/admin/fleetService.ts';
   import assert from 'node:assert/strict';

   assert.equal(ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', null), false);
   assert.deepEqual(ProfilePolicyService.filterStoresForProfile(null, 'STORE_CLIENT', null), []);
   assert.equal(FleetService.getRequiredChallengeCode(null), '');
   assert.deepEqual(StoreService.getRuntimeSecurityProfile(), { appMode: 'STORE_CLIENT', assignedStoreIds: [] });
   "
   ```
   *Expected Output*: Script completes without error, exit code 0.
