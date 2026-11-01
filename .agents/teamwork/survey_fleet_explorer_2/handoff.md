# Handoff Report: Dual-Profile Runtime Architecture (Master HQ vs Store Client) (R2)

**From**: Survey Explorer 2 (`survey_fleet_explorer_2`)  
**To**: Orchestrator (`bc820f6a-3865-4f82-8517-3240379a0b72`)  
**Date**: 2026-10-26T16:50:00Z  
**Handoff Type**: Hard (Investigation & Technical Survey Complete)  

---

### 1. Observation

1. **Current Profile & Store Selection**:
   - `src/services/storeService.ts` (lines 56–95) exposes `getAllStores()`, which merges `STARBUCKS_STORES_CATALOG` (`src/constants/starbucksStores.ts`, 1527 lines, 100+ stores across Poland) with custom stores without checking user role or station license.
   - `src/context/StoreContext.tsx` (lines 20–22, 54–69) exposes `availableStores` (all 100+ stores) and `switchStore(id)` to any client view.
   - `src/components/Header.tsx` (lines 158–173) and `src/components/Sidebar.tsx` (lines 181–207) attach `openStoreSwitcher()` to the store badge, opening `StoreSwitcherModal.tsx`.
   - In `StoreSwitcherModal.tsx` (lines 43, 88–160), any user on any store laptop can currently browse, search, and switch to any other Starbucks store in Poland, or add custom stores.

2. **Developer & Dangerous Options Exposed to Store Users**:
   - `src/components/DatabaseBackupModal.tsx` (lines 185–302) includes `handleCleanSlateReset` (reset to clean slate / wipe DB), `handleImportHistoricalPackage` (overwrite from IMPORT/), and raw database buffer restore.
   - `src/components/UnifiedSettingsModal.tsx` (lines 74–85, 1906, 2185–2193, 2296–2356) contains:
     * Tab `firebase_fleet`: mounts `<FirebaseFleetPanel />` displaying telemetry for all installations across the country.
     * Tab `testing_guide`: mounts developer test instructions.
     * Tab `system`: includes buttons for manual SQLite VACUUM, PRAGMA integrity check, and "Przełącz lub Dodaj Kawiarnię...".

3. **Current View Routing in `src/App.tsx`**:
   - `src/App.tsx` (lines 55–150, 548–560, 604–740) currently evaluates only onboarding completion and login session. It has **no station activation gate** before login, no concept of `appMode: 'FLEET_MASTER' | 'STORE_CLIENT'`, and unconditionally mounts all developer modals (lines 752–834).
   - In `PROJECT.md` line 10, `AuthContext` is specified in the State & Context Layer, but is not yet implemented as a standalone React context.

4. **Peer Explorer Alignment**:
   - Explorer 1 (`survey_fleet_explorer_1/survey_report.md`): Defined activation key format `SBX-<storeId>-<randomHex>-<checksum>`, hardware fingerprint derivation via Electron Main IPC (`getHardwareFingerprint()`), and `ActiveLicenseRecord` containing `tier: 'STORE_CLIENT' | 'FLEET_MASTER'`.
   - Explorer 3 (`survey_fleet_explorer_3/progress.md`): Investigating 2FA corporate auth, ActivationModal, and automated test runners.

---

### 2. Logic Chain

1. **Premise**: In an autonomous retail environment with 100+ stores, a store station must operate in a strictly bounded tenant box (`STORE_CLIENT`) to prevent cross-store confusion, accidental store switching, or data leaks.
2. **Premise**: District Managers and corporate executives require a global macro view (`FLEET_MASTER`) with full visibility over all 100+ units, license provisioning tools, remote Kill-Switches, and release monitoring.
3. **Inference**: Bifurcating the runtime via `appMode: 'FLEET_MASTER' | 'STORE_CLIENT'` cleanly resolves both requirements without duplicating the core business modules (Modules 1–4 remain identical and store-keyed).
4. **Inference**:
   - In `STORE_CLIENT` mode:
     * `StoreContext.availableStores` is filtered strictly to `assignedStoreIds` (e.g. `['108120']`).
     * The store badge in `Header.tsx` and `Sidebar.tsx` becomes a non-clickable verified badge (or opens read-only `StoreStationInfoModal`), removing `StoreSwitcherModal`.
     * Developer tabs (`firebase_fleet`, `testing_guide`) and destructive database buttons (clean slate, manual restore) are pruned from the UI.
     * A friendly `CloudSyncIndicator` widget provides simple one-click sync status and triggers `SyncEngine.flushOutbox()`.
     * `StoreClientView.tsx` wraps the store workspace with distraction-free back-office ergonomics.
   - In `FLEET_MASTER` mode:
     * Unlocks the new `FleetMasterDashboard.tsx` (`src/components/admin/FleetMasterDashboard.tsx`) with 100+ stores catalog, license generator modal, remote Kill-Switch revocation, and audit trail.
     * Retains the full 100+ stores switcher to allow the Master to inspect any store's operational modules.

---

### 3. Caveats

1. **Multi-Store District Managers**: Some users (e.g. District Managers traveling between stores) may need access to 2–5 stores on a single laptop without being in full Fleet Master mode. The architecture accommodates this by supporting `assignedStoreIds: string[]`.
2. **Offline First**: All `STORE_CLIENT` UI restrictions must function 100% offline without requiring continuous contact with Firebase. The hardware lock and license are validated against local Electron `safeStorage`.
3. **No Direct Code Modifications**: Per design mode instructions, no application source code files have been altered during this survey.

---

### 4. Conclusion

The dual-profile runtime architecture is technically sound, highly localized, and ready for immediate implementation. It introduces:
- A new `AuthContext.tsx` managing `appMode`, station activation, and session.
- A scoped refactor of `StoreContext.tsx` and `storeService.ts` to enforce `assignedStoreIds`.
- A dedicated `FleetMasterDashboard.tsx` for HQ and District Managers.
- A hardened `StoreClientView.tsx` with friendly `CloudSyncIndicator.tsx` and purged developer options for Store Managers.
- Full inventory of files to modify and create detailed in `survey_report.md`.

---

### 5. Verification Method

To independently verify the survey observations and implementation plan:
1. Inspect store catalog size:
   ```bash
   node -e "import('./src/constants/starbucksStores.ts').then(m => console.log('Store count:', m.STARBUCKS_STORES_CATALOG.length))"
   ```
2. Verify existing store switcher open triggers in `src/components/Header.tsx` (lines 158–173) and `src/components/Sidebar.tsx` (lines 181–207).
3. Verify developer tabs in `src/components/UnifiedSettingsModal.tsx` (lines 74–85, 1906).
4. Verify destructive reset handler in `src/components/DatabaseBackupModal.tsx` (lines 279–302).
5. Review the comprehensive report at:
   `/Users/dawidapel/COL Tool/.agents/teamwork/survey_fleet_explorer_2/survey_report.md`.
