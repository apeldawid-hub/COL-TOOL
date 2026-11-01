# Handoff Report: Dual-Profile Runtime Architecture & Profile Differentiation (R2)

**Agent**: `m2_fleet_explorer_1` (Explorer 1, Milestone 2)  
**Parent Orchestrator ID**: `bc820f6a-3865-4f82-8517-3240379a0b72`  
**Date**: 2026-10-26T19:08:00Z  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_explorer_1`  

---

## 1. Observation

1. **Licensing Infrastructure (M1 Complete)**:
   - File: `src/services/security/licensingService.ts` lines 245–248 encodes `tierByte = tier === 'FLEET_MASTER' ? 'FF' : '01'` and generates canonical signed keys `SBX-<storeId>-<randomHex>-<checksum>`.
   - File: `src/services/security/licensingService.ts` lines 478–577 implements `verifyStationHardwareLock()`, returning `status: 'ACTIVATED' | 'HARDWARE_LOCKOUT' | 'TAMPER_DETECTED' | 'UNACTIVATED'` along with `ActiveLicenseRecord` containing `tier: LicenseTier` and `storeId: string`.
   - Electron IPC channels registered in `electron/main.ts` lines 1996–2010: `system:get-hardware-fingerprint`, `licensing:save-license`, `licensing:load-license`, and `licensing:revoke-license`.
   - Running `npm run test:security` executes 53 tests in `tests/security/` with 53 passing and 0 failing in 549ms.

2. **Absence of AuthContext**:
   - `find_by_name` for `*AuthContext*` returned 0 results.
   - Authentication is currently fragmented: `src/services/auth/authService.ts` manages local sessions, but there is no React context coordinating station activation, licensing tier, and runtime profile.

3. **Unrestricted Store Catalog & Switching**:
   - In `src/services/storeService.ts` lines 56–95, `getAllStores()` unconditionally merges `STARBUCKS_STORES_CATALOG` (104 stores) with custom stores without checking user profile or station identity.
   - In `src/context/StoreContext.tsx` lines 21–22, `availableStores` initializes with `StoreService.getAllStores()`, and `switchStore(storeOrId)` (lines 54–69) permits switching to any store without boundary checks.

4. **UI Touchpoints for Store Switching**:
   - In `src/components/Header.tsx` lines 158–172, a `<button onClick={openStoreSwitcher}>` renders `ChevronsUpDown` and opens `StoreSwitcherModal` for all users.
   - In `src/components/Sidebar.tsx` lines 181–207, both expanded and collapsed views mount interactive `<button onClick={openStoreSwitcher}>`.
   - In `src/components/StoreSwitcherModal.tsx` lines 38–44 and 88–122, all available stores and an "ADD_NEW" custom store tab are rendered.

5. **App Routing in `src/App.tsx`**:
   - Lines 139: `activeModule` is typed as `AppModule` (`dashboard`, `labor_forecast`, `managers_schedule`, `trainings`, `col_calculator`, `analytics`, `ibs_ims`).
   - Lines 604–740: Module views are rendered in `<main>` directly keyed by `currentStore.id`.
   - Neither `FleetMasterDashboard.tsx` nor `StoreClientView.tsx` exist yet in the codebase.

---

## 2. Logic Chain

1. **State Ownership (Observation 2 & Observation 3)**:
   - Station activation status, license cryptographic seal, hardware lock, and license tier (`FLEET_MASTER` vs `STORE_CLIENT`) are authorization and device identity properties, not retail store catalog properties.
   - Therefore, `appMode: 'FLEET_MASTER' | 'STORE_CLIENT'` and `assignedStoreIds: string[]` belong in a dedicated `AuthContext.tsx`.
   - Mounting `AuthProvider` above `StoreProvider` in `src/main.tsx` allows `StoreContext` to consume `useAuth()` to dynamically filter `availableStores` and enforce store access boundaries.

2. **Initialization Workflow (Observation 1)**:
   - On app launch, `AuthContext` initializes `appMode` synchronously from `localStorage['sbx_app_mode'] || 'STORE_CLIENT'` (least-privilege default) to prevent UI flash.
   - In `useEffect`, it invokes `licensingService.verifyStationHardwareLock()`. If `status === 'ACTIVATED'`, it inspects `license.tier`:
     - If `'FLEET_MASTER'`: sets `appMode = 'FLEET_MASTER'`, `assignedStoreIds = []`.
     - If `'STORE_CLIENT'`: sets `appMode = 'STORE_CLIENT'`, `assignedStoreIds = [license.storeId]`.
   - If revoked or hardware mismatch, it locks the station and triggers session cleanup.

3. **Store Isolation & Convergence (Observation 3)**:
   - In `STORE_CLIENT` mode, `StoreContext.availableStores` must filter `StoreService.getAllStores()` by `assignedStoreIds` matching multi-key identifiers (`id`, `unitCode`, `mpk`).
   - If `currentStore` does not match `assignedStoreIds`, `StoreContext` automatically converges on startup by switching to the assigned store.
   - `StoreService.setCurrentStore()` and `addCustomStore()` are guarded to reject cross-store switching or custom store creation in `STORE_CLIENT` mode.

4. **UI Locking & Disabling (Observation 4)**:
   - In `STORE_CLIENT` mode, `Header.tsx` and `Sidebar.tsx` replace the interactive `<button onClick={openStoreSwitcher}>` and `ChevronsUpDown` with a verified store badge (`ShieldCheck`, `Lock`, `cursor-default`, emerald styling).
   - `StoreSwitcherModal.tsx` returns `null` or refuses to open if `isStoreClient` is true.

5. **App Routing (Observation 5)**:
   - `AppModule` is extended to include `'fleet_master'`.
   - In `FLEET_MASTER` mode, `Sidebar.tsx` injects the `Centrala Floty (100+)` navigation item, and `App.tsx` routes to `<FleetMasterDashboard />`, which allows provisioning keys, kill-switch revocation, and switching into individual store operational views.
   - In `STORE_CLIENT` mode, the app renders `<StoreClientView />` locked to the assigned store with the friendly `<CloudSyncIndicator />` and all developer tabs (`firebase_fleet`, `testing_guide`, VACUUM/PRAGMA, Clean Slate) stripped.

---

## 3. Caveats

1. **Development & Headless Testing**:
   - In headless test environments where Electron IPC (`window.api`) is absent, `AuthContext` relies on `localStorage` or `process.env.SBX_TEST_LICENSE_TIER` fallback.
2. **First Launch (Unactivated Stations)**:
   - When a station is unactivated, it defaults to `STORE_CLIENT` mode with `assignedStoreIds: []`. The full station activation modal (`ActivationModal.tsx`) is scheduled for Milestone 3, but pre-activation checks in M2 must prevent access to unassigned stores.
3. **Source Code Write Restriction**:
   - This investigation operated strictly in read-only mode. No application source code was modified. All designs and diff blueprints are provided in `report.md`.

---

## 4. Conclusion

The dual-profile runtime architecture can be cleanly and robustly implemented without breaking backwards compatibility. `AuthContext.tsx` must be introduced as the single source of truth for `appMode` and licensing tier, while `StoreContext.tsx` consumes it to lock `availableStores`, `Header.tsx`, `Sidebar.tsx`, and `StoreSwitcherModal.tsx`. App routing in `src/App.tsx` cleanly branches between `<FleetMasterDashboard />` (HQ command center) and `<StoreClientView />` (hardened retail workspace with `<CloudSyncIndicator />`).

---

## 5. Verification Method

To verify the proposed implementation once coded:

1. **Automated Security Tests**:
   - Run `npm run test:security` to confirm all 53 existing M1 licensing tests pass.
   - Add and run `tests/security/dual_profile_isolation.test.ts` testing:
     - `STORE_CLIENT` rejects `switchStore()` to unassigned store ID.
     - `availableStores` in `STORE_CLIENT` contains only the licensed store.
     - `FLEET_MASTER` allows unrestricted store switching across all 100+ units.
2. **Build Verification**:
   - Run `npm run build` (`tsc && vite build`) to confirm zero TypeScript compilation errors or packaging issues.
3. **UI Verification**:
   - Inspect `Header.tsx` and `Sidebar.tsx` to verify non-clickable verified store station badge rendering when `appMode === 'STORE_CLIENT'`.
