# Handoff Report — M2 Fleet Explorer 3

**Agent**: `m2_fleet_explorer_3`  
**Milestone**: Milestone 2 — Dual-Profile Runtime Architecture & Fleet Master Dashboard  
**Task**: Implementation strategy for Store Client View, UI/navigation pruning, and automated profile isolation tests  
**Type**: Hard Handoff (Task Complete)  

---

## 1. Observation
1. **`DatabaseBackupModal.tsx`**:
   - Lines 493–536: Contains `confirmCleanSlate` state and UI dialog triggering `handleCleanSlateReset` (lines 279–302), which invokes Electron IPC `resetToCleanSlate` and completely wipes operational tables.
   - Lines 442–490 & 768–787: Contains `confirmHistoricalImport` state and button "Wgraj z ./IMPORT/" triggering `handleImportHistoricalPackage` (lines 254–277), overwriting local store tables with raw package data.
   - Lines 705–810: Section "Centrum Paczek Danych & Instalacji (Folder ./IMPORT)" exposes raw table export to `./IMPORT/` (`handleExportPackage`, lines 185–205) and clean slate reset.
   - Lines 956–963: Table row action exposes raw file restore button ("Przywróć") directly to store users.
2. **`UnifiedSettingsModal.tsx`**:
   - Line 82 & Lines 713–732: Tab `'firebase_fleet'` displays button "Flota & Instalacje". Line 1905 renders `<FirebaseFleetPanel />`, displaying telemetry for all machines nationwide.
   - Line 83 & Lines 687–704: Tab `'testing_guide'` displays button "Samouczek & Pilotaż". Line 1697 renders developer test checklists.
   - Lines 2185–2193: System tab displays button "Przełącz lub Dodaj Kawiarnię..." (`openStoreSwitcher`), permitting unrestricted store hopping.
   - Lines 2325–2343: Displays manual developer buttons: "Test Spójności" (`PRAGMA integrity_check`) and "Optymalizuj (VACUUM)".
3. **`SyncEngine` (`src/services/sync/syncEngine.ts`)**:
   - Lines 28–35 & 63–89: Implements `SyncStatus` (`isOnline`, `pendingCount`, `lastSyncAt`, `syncState`, `message`).
   - Lines 94–100 & 159–185: Provides `subscribe()` and `flushOutbox()` to push pending changes to cloud vaults.
4. **Security Test Suite (`tests/security/`)**:
   - `package.json` line 13 configures `"test:security": "node --import tsx --test \"tests/security/**/*.test.ts\""`.
   - Running `npm run test:security` runs 53 tests in ~550ms with 100% pass rate.

---

## 2. Logic Chain
1. From Observation 1: Exposing `handleCleanSlateReset`, `handleImportHistoricalPackage`, and raw package export on backroom store laptops creates catastrophic operational risk of accidental data wiping or uncontrolled database corruption.
2. From Observation 2: Exposing `firebase_fleet`, `testing_guide`, manual PRAGMA/VACUUM buttons, and store switching in store client settings breaches enterprise tenant boundaries and creates cognitive friction for retail employees.
3. Therefore, introducing a dedicated `ProfilePolicyService` (`src/services/security/profilePolicyService.ts`) with fail-safe defaults to `'STORE_CLIENT'` guarantees that all destructive and developer options are disabled by default unless explicitly operating in verified `'FLEET_MASTER'` profile.
4. From Observation 3: `SyncEngine` already contains full outbox state tracking and subscription hooks. Building `src/components/sync/CloudSyncIndicator.tsx` as a pure visual consumer enables 1-click cloud synchronization with 5 clear states (Synced, Syncing, Pending, Offline, Error).
5. From Observation 4: Encapsulating the store backroom experience within `StoreClientView.tsx` with a verified store badge (Store Name, Unit Code, City, Locked Shield) and no dropdown selector locks the workstation strictly to its assigned store.
6. The test runner setup (`node --import tsx --test`) allows comprehensive, zero-dependency unit tests in `tests/security/profile_isolation.test.ts` to test store filtering, switching prevention, and visibility flags without browser or Electron dependencies.

---

## 3. Caveats
- Assumptions:
  * In `STORE_CLIENT` mode, single-store laptops will have exactly 1 assigned store ID (`assignedStoreIds = [storeId]`), while cluster managers may have a small array (e.g. 2–3 assigned stores).
  * Auto-maintenance in SQLite (VACUUM on startup and PRAGMA integrity check) runs automatically in the background via `databaseHealthService`, so removing manual buttons does not compromise database health.
- Areas not investigated:
  * Electron native menu bar items (e.g. macOS Top Menu "File" -> "Switch Store"). These should be verified during Electron preload hardening.

---

## 4. Conclusion
The implementation strategy is fully specified and ready for worker implementation:
1. `src/components/StoreClientView.tsx`: Complete code blueprint delivered with backroom layout, locked store badge, compliance pills, and 5-module navigation.
2. `src/components/sync/CloudSyncIndicator.tsx`: Complete code blueprint delivered integrating with `SyncEngine` and offering 5 clear operational states with 1-click flush.
3. UI Pruning: Exact line-by-line modifications specified for `DatabaseBackupModal.tsx` and `UnifiedSettingsModal.tsx` using `ProfilePolicyService`.
4. Automated Unit Tests: Complete `tests/security/profile_isolation.test.ts` suite delivered covering store catalog filtering, switching prevention, and profile policy flags.

---

## 5. Verification Method
1. **Automated Test Execution**:
   - Run: `npm run test:security`
   - Expected Result: All 53 existing tests + new `profile_isolation.test.ts` pass cleanly (0 failures).
2. **Build Verification**:
   - Run: `npm run build` (`tsc && vite build`)
   - Expected Result: TypeScript compiles without type errors, Vite produces production bundle in `dist/`.
3. **Inspection Verification**:
   - Inspect `DatabaseBackupModal.tsx` in `STORE_CLIENT` mode: confirm absence of Clean Slate button, Import Historical Package card, and raw export.
   - Inspect `UnifiedSettingsModal.tsx` in `STORE_CLIENT` mode: confirm absence of `firebase_fleet` and `testing_guide` tabs, absence of store switcher button, and absence of manual VACUUM/PRAGMA buttons.
