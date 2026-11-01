# Milestone 2 Review & Adversarial Audit Report: Architecture, Profile Policy & UI Pruning

**Reviewer**: M2 Reviewer 1 (Role: Architecture, Profile Policy & UI Pruning Review)  
**Target Work Product**: Milestone 2 Deliverables by `m2_fleet_worker_1`  
**Verdict**: **APPROVE**  
**Overall Risk Assessment**: **LOW**

---

## 1. Observation

### 1.1 Direct Code Inspection
1. **Architecture & Profile Policy Engine** (`src/services/security/profilePolicyService.ts` lines 31-118):
   - `ProfilePolicyService.getPolicy(mode)` explicitly checks `if (mode === 'FLEET_MASTER')` and returns the 12 elevated permission flags. Any other value (including `'STORE_CLIENT'`, `null`, `undefined`, or arbitrary strings) falls through to the fail-safe least-privilege matrix (`allowCleanSlateReset: false`, `allowStoreSwitching: false`, `allowManualVacuumPragma: false`, `allowFirebaseFleetTab: false`, etc.).
   - `ProfilePolicyService.canSwitchToStore(mode, targetStoreId, assignedStoreIds)` (lines 72-87) returns `false` if `targetStoreId` is blank or invalid, returns `true` for `FLEET_MASTER`, and strictly verifies `assignedStoreIds.some(...)` with normalized comparison for `STORE_CLIENT`.
   - `ProfilePolicyService.filterStoresForProfile` (lines 92-117) returns `[]` (fail-closed) if `assignedStoreIds` is empty or undefined for `STORE_CLIENT`.
2. **Authentication & Runtime Profile Source of Truth** (`src/context/AuthContext.tsx` lines 46-187):
   - `appMode` defaults to `'STORE_CLIENT'`.
   - On component mount (`useEffect` lines 97-163), `licensingService.verifyStationHardwareLock()` is invoked asynchronously. If the hardware lock is invalid, revoked, tampered with, or unactivated, `appMode` is forced to `'STORE_CLIENT'` and `assignedStoreIds` is cleared to `[]`.
   - Broadcast listener for `sbx:license-revoked` (lines 168-180) catches real-time Kill-Switch events, deactivates station state, resets `appMode` to `'STORE_CLIENT'`, and logs out the active session via `AuthService.logout()`.
3. **Store Client Isolation & Anti-Hopping Guards** (`src/services/storeService.ts` & `src/context/StoreContext.tsx`):
   - In `StoreService.setCurrentStore` (lines 268-276): If `effectiveMode === 'STORE_CLIENT'` and the target store is not assigned, it throws:
     `UnauthorizedStoreSwitchError: Odmowa dostępu — lokal "${store.name}" (${store.id}) nie jest przypisany do tej stacji roboczej.`
   - In `StoreService.addCustomStore` (lines 447-450): If `effectiveMode === 'STORE_CLIENT'`, it throws:
     `UnauthorizedStoreCreationError: Niedozwolone w trybie STORE_CLIENT — dodawanie kawiarni zablokowane.`
   - In `StoreContext.tsx` (lines 71-84): Auto-convergence detects if `currentStore` does not match `assignedStoreIds` in `STORE_CLIENT` mode and immediately auto-converges to the assigned store.
4. **Hardened Store Client View & Retail Ergonomics** (`src/components/StoreClientView.tsx` & `src/components/sync/CloudSyncIndicator.tsx`):
   - `StoreClientView.tsx` renders a read-only verified store station badge (`<ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />`, `<Lock className="w-3 h-3 text-emerald-600/70 ml-0.5 shrink-0" />`) with no click handler or dropdown trigger.
   - `MODULE_NAV` (lines 59-65) exposes only 5 store operations (`dashboard`, `labor_forecast`, `managers_schedule`, `trainings`, `col_calculator`); `fleet_master` is completely absent from the client menu.
   - Floor compliance indicator (32.0h/dzień, 224h/tydz) and planning month pill are prominently displayed.
   - `CloudSyncIndicator.tsx` subscribes directly to `SyncEngine.subscribe()` and displays friendly status states (Offline, Syncing, Synced with relative timestamp, Pending outbox count with 1-click flush).
5. **UI & Navigation Pruning in Modals and Shell**:
   - `src/components/Header.tsx` (lines 161-194): Replaces store switcher button with static locked badge when `isStoreClient`.
   - `src/components/Sidebar.tsx` (lines 140-145, 198-250): Restricts `FLEET_MASTER_NAV_ITEM` to `isFleetMaster`; replaces store switcher with static badge in both expanded and collapsed sidebars when `isStoreClient`.
   - `src/components/StoreSwitcherModal.tsx` (line 207): Includes fail-closed guard `if (!isOpen || isStoreClient) return null;`.
   - `src/components/DatabaseBackupModal.tsx` (lines 711-830): Hides Clean Slate reset, historical import, and raw cloud migration behind `policy.allowCleanSlateReset || policy.allowHistoricalImport`. In `STORE_CLIENT` mode, renders a locked informational card (`Automatyczna Ochrona Danych Kawiarni`).
   - `src/components/UnifiedSettingsModal.tsx` (lines 692, 720, 1704, 1912, 2192, 2342): Prunes `testing_guide` and `firebase_fleet` tabs; replaces store switcher button with locked station badge; replaces manual VACUUM/PRAGMA controls with automatic SQLite status badge.
6. **Application Routing** (`src/App.tsx` lines 145-150, 575-580, 821-848):
   - In `renderMainContent()`, `<FleetMasterDashboard />` renders only if `activeModule === 'fleet_master' && isFleetMaster`.
   - When `isStoreClient` is true, an auto-redirect hook redirects `activeModule` back to `'dashboard'` if it ever equals `'fleet_master'`.
   - The top-level layout cleanly branches: `if (isStoreClient)` renders `<StoreClientView ...>` and wraps modals.
7. **Integrity & Anti-Cheat Audit**:
   - Verified that cryptographic keys in `fleetService.ts` are generated via `LicensingService.generateActivationKey` using real HMAC-SHA256 and CSPRNG entropy.
   - Verified that `executeKillSwitch` performs real in-memory RAM key zeroization via `StoreKeyCache.invalidateStore(storeId)` (`Buffer.fill(0)`).
   - Verified `QrCodeSvg.tsx` generates a pure 25x25 SVG matrix without external dependencies or facade placeholders.
   - Confirmed 0 hardcoded test bypasses, dummy facades, or skipped validations.

---

## 2. Review Findings & Verification

### Verified Claims
- **Claim 1: Dual-profile runtime isolation enforces least privilege**  
  *Method*: Verified `ProfilePolicyService.getPolicy` with multiple inputs (`'STORE_CLIENT'`, `'FLEET_MASTER'`, `'HACKED'`, `null`, `undefined`). Confirmed fail-closed behavior.  
  *Status*: **PASS**
- **Claim 2: Store Client cannot switch to unassigned stores**  
  *Method*: Verified `StoreService.setCurrentStore` throws `UnauthorizedStoreSwitchError` when in `STORE_CLIENT` mode with unassigned store ID; verified `StoreSwitcherModal` returns `null` when `isStoreClient` is true.  
  *Status*: **PASS**
- **Claim 3: Destructive database and developer tools are stripped in Store Client**  
  *Method*: Inspected `DatabaseBackupModal.tsx`, `UnifiedSettingsModal.tsx`, and `Header.tsx`. Confirmed that Clean Slate, manual VACUUM/PRAGMA, `testing_guide`, and `firebase_fleet` are inaccessible in `STORE_CLIENT` mode.  
  *Status*: **PASS**
- **Claim 4: Kill-Switch enforces 2-step verification and RAM key zeroization**  
  *Method*: Tested in `dual_profile_isolation.test.ts` (subtests 6.1 and 6.2); verified `StoreKeyCache.hasStoreKey(storeId)` transitions from `true` to `false` upon revocation, and invalid challenge strings are rejected.  
  *Status*: **PASS**
- **Claim 5: Automated security test suite and TypeScript production build compile cleanly**  
  *Method*: Executed `npm run test:security` (70/70 pass, 0 fail in 2.15s) and `npm run build` (tsc + vite build completed with 0 errors in 2.83s).  
  *Status*: **PASS**

### Minor Observations & Recommendations
1. **[Minor] Non-DOM Window Reference in Headless Node Test Runner**:
   - *Location*: `src/services/storeService.ts` (lines 290, 347)
   - *Observation*: `StoreService.setCurrentStore` dispatches `window.dispatchEvent(new CustomEvent('sbx:store-switching', ...))` without guarding `if (typeof window !== 'undefined')`. In a headless Node.js test environment (outside Electron/browser), this triggers a caught `ReferenceError: window is not defined` and returns `{ success: false }`.
   - *Recommendation*: While safe in Electron, wrapping `window.dispatchEvent` with `if (typeof window !== 'undefined')` (as done in `fleetService.ts` line 535) will clean up Node.js test console warnings.
2. **[Minor] Pre-Validation Hydration from LocalStorage**:
   - *Location*: `src/context/AuthContext.tsx` (lines 50-54)
   - *Observation*: Initial state hydrates `appMode` from `localStorage.getItem('sbx_app_mode')` before the asynchronous `licensingService.verifyStationHardwareLock()` resolves. Although `verifyStationHardwareLock()` immediately overrides `appMode` on mount if unauthorized, defaulting strictly to `'STORE_CLIENT'` without reading `localStorage` for elevated mode provides even tighter defense-in-depth against client-side tampering.

---

## 3. Adversarial Challenge Report

### Challenge 1: LocalStorage Profile Tampering
- **Assumption Challenged**: An attacker modifying `localStorage.setItem('sbx_app_mode', 'FLEET_MASTER')` in browser DevTools could unlock Fleet Master capabilities.
- **Attack Scenario**: Attacker sets `sbx_app_mode` to `'FLEET_MASTER'` and refreshes the application.
- **Blast Radius Analysis**: Upon reload, `useEffect` executes `licensingService.verifyStationHardwareLock()`. If the machine does not have a valid cryptographic license signed for `FLEET_MASTER` bound to the hardware fingerprint, `status.status` evaluates to `UNACTIVATED` or `HARDWARE_LOCKOUT`. Line 136/151 immediately resets `appMode` to `'STORE_CLIENT'` and overwrites `localStorage.setItem('sbx_app_mode', 'STORE_CLIENT')`. Furthermore, `FleetMasterDashboard` cannot perform licensing actions without valid HMAC master credentials.
- **Mitigation Assessment**: Existing defense is robust and fail-closed.

### Challenge 2: Store Hopping via Direct IPC or Storage Manipulation
- **Assumption Challenged**: An operator at Store A could switch the store selector to inspect Store B's P&L and labor data.
- **Attack Scenario**: Operator opens DevTools console and calls `StoreService.setCurrentStore(storeB)` or alters `sbx_store_mpk` in `localStorage`.
- **Blast Radius Analysis**:
  1. `StoreService.setCurrentStore` throws `UnauthorizedStoreSwitchError` before modifying state or database bindings.
  2. If `localStorage` is directly modified, `StoreContext`'s auto-convergence `useEffect` detects that `isStoreAssigned(currentStore, assignedStoreIds)` is `false` and forces `setCurrentStore` back to the hardware-assigned store (`assignedStoreIds[0]`).
- **Mitigation Assessment**: Double-layered protection (service guard + context auto-convergence) effectively neutralizes store hopping.

### Challenge 3: In-Memory Key Persistence Post-Revocation
- **Assumption Challenged**: Even if a station is revoked via Kill-Switch, cached AES keys in memory could allow decrypting existing database backups.
- **Attack Scenario**: HQ issues a remote Kill-Switch while a compromised laptop is connected to the network.
- **Blast Radius Analysis**: `FleetService.executeKillSwitch` immediately calls `StoreKeyCache.invalidateStore(storeId)` before emitting the revocation event. `StoreKeyCache.clear()` and `invalidateStore()` call `Buffer.fill(0)` on the secret key in RAM. In addition, `AuthContext` handles `sbx:license-revoked` by logging out the user and revoking local license storage.
- **Mitigation Assessment**: Verified in test 6.2; zeroization prevents cryptographic key recovery from process memory dumps.

---

## 4. Logic Chain

1. **Requirement Check**: The orchestrator and SCOPE.md mandated Features F4, F5, F6: Dual-profile runtime segregation (`FLEET_MASTER` vs `STORE_CLIENT`), 100+ stores catalog aggregation, license provisioning modal, 2-step Kill-Switch modal with RAM key zeroization, hardened `StoreClientView.tsx` with friendly `CloudSyncIndicator.tsx`, navigation pruning across all touchpoints, and automated security tests.
2. **Code Verification**: Each of the 12 target files was read and verified. The permission matrix in `ProfilePolicyService` is strictly fail-closed. `StoreService` and `StoreContext` enforce store isolation and auto-convergence. All destructive actions in `DatabaseBackupModal` and developer tabs in `UnifiedSettingsModal` are conditionally excluded.
3. **Execution Verification**: Running `npm run test:security` executed all 70 test cases with 0 failures in 2.15 seconds. Running `npm run build` executed `tsc && vite build`, compiling client and Electron bundles with 0 errors in 2.83 seconds.
4. **Integrity Verification**: No hardcoded mocks, facade functions, or test shortcuts were found. All cryptographic and security features use genuine implementations.
5. **Conclusion**: The implementation meets all architectural, security, and functional standards for Milestone 2.

---

## 5. Caveats
- Electron native dialogs (`electronAPI.showOpenDialog`) and hardware fingerprinting via Keychain are tested using deterministic test fixtures in headless Node environments.
- Live Firebase cloud sync was validated against the local `SyncEngine` event contract without requiring an active remote network connection.

---

## 6. Conclusion

Milestone 2 implementation is **APPROVED**. The codebase provides strict dual-profile segregation, robust store client isolation, fail-closed permission enforcement, retail workstation ergonomics, complete navigation pruning, real-time Kill-Switch RAM key zeroization, and a 100% passing automated test suite.

---

## 7. Verification Method

To independently reproduce this verification:
1. Run the automated security test suite:
   ```bash
   npm run test:security
   ```
   *Expected result*: `ℹ pass 70`, `ℹ fail 0`, exit code 0.
2. Run the production build:
   ```bash
   npm run build
   ```
   *Expected result*: Exit code 0 with client, electron main, and preload bundles generated cleanly.
3. Inspect key source implementations:
   - `src/services/security/profilePolicyService.ts`
   - `src/context/AuthContext.tsx`
   - `src/services/storeService.ts`
   - `src/context/StoreContext.tsx`
   - `src/components/StoreClientView.tsx`
   - `src/components/sync/CloudSyncIndicator.tsx`
   - `tests/security/dual_profile_isolation.test.ts`
