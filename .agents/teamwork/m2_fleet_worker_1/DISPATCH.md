# DISPATCH: Milestone 2 — Dual-Profile Runtime Architecture & Fleet Master Dashboard

## 2026-10-26T20:04:00Z

### Target Agent
- Role: M2 Worker: Dual-Profile Runtime, Fleet Master Dashboard & Store Client Architecture
- TypeName: `teamwork_preview_worker`
- Working Directory: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_worker_1`

### Mandatory Reading
- `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md` (Read fully first)
- `/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_4/SCOPE.md` (Features F4, F5, F6)
- Explorer Reports & Blueprints:
  * `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_explorer_1/report.md`
  * `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_explorer_2/report.md`
  * `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_explorer_3/report.md`

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Objective & Scope of Work
Implement Milestone 2: Dual-Profile Runtime Architecture (Master Fleet HQ vs Store Client), Fleet Master Control Center Dashboard, Store Client Hardened View with CloudSyncIndicator, and strict profile-based navigation pruning.

1. **Fleet Types (`src/types/fleet.ts`)**:
   - Define `FleetStoreRecord`, `FleetSummaryStats`, `FleetAuditLogEntry`, `FleetStoreHealth`, `FleetSyncState`, `FleetParityState`, `FleetAuditAction`.
2. **Auth Context (`src/context/AuthContext.tsx`)**:
   - Introduce `AuthContext` as the single source of truth for runtime profile: `appMode: 'FLEET_MASTER' | 'STORE_CLIENT'`, `assignedStoreIds: string[]`, `activeLicense`, `verifyStationHardwareLock()`.
   - Update `src/main.tsx` so `<AuthProvider>` wraps `<StoreProvider>`.
3. **Store Context Hardening (`src/context/StoreContext.tsx`) & Service (`src/services/storeService.ts`)**:
   - In `StoreContext`, consume `useAuth()`. When `appMode === 'STORE_CLIENT'`, filter `availableStores` strictly to `assignedStoreIds`.
   - Guard `switchStore()`: throw/reject when attempting to switch to an unassigned store in `STORE_CLIENT` mode.
   - Auto-converge on mount: if current store is not in `assignedStoreIds`, switch automatically to assigned store.
   - In `StoreService`, add safe store lookup and prevent custom store creation in `STORE_CLIENT` mode.
4. **Fleet Master Dashboard (`src/components/admin/FleetMasterDashboard.tsx`)**:
   - Multi-store catalog view for 100+ stores (`STARBUCKS_STORES_CATALOG`).
   - Diacritics-insensitive search (Polish city/store names), filtering by district/status/health.
   - Summary metric cards (Total Stores, Active Licenses, Healthy/Warning/Offline, Revoked Kill-Switch).
   - License Provisioning Modal: generate signed keys (`LicensingService.generateActivationKey`), display key, self-contained SVG QR code (`src/components/admin/QrCodeSvg.tsx` - NO external npm dependency!).
   - Kill-Switch Revocation Modal: 2-step verification challenge requiring explicit typing of `REVOKE <storeId>`, selecting reason, zeroizing RAM keys (`StoreKeyCache.clear()`), and recording audit entry.
   - Audit trail table showing past actions (key generation, activations, revocations).
   - Export capability: Export fleet audit and store inventory to CSV / JSON.
   - Switch-to-Store: DM can jump directly into inspecting any store.
5. **Store Client Hardened View & Cloud Sync Indicator**:
   - Create `src/components/StoreClientView.tsx`: dedicated retail station view, locked store badge (`ShieldCheck`, `Lock`), clean summary cards for retail modules, stripped developer options.
   - Create `src/components/sync/CloudSyncIndicator.tsx`: friendly retail sync indicator ("Zsynchronizowano z Centralą", "Wysyłanie zmian...", "Oczekiwanie na sieć", pulse animation, last sync tooltip).
6. **Navigation & Touchpoint Pruning**:
   - `src/components/Header.tsx` & `src/components/Sidebar.tsx`: When `appMode === 'STORE_CLIENT'`, replace interactive store dropdown button with static, non-clickable verified store badge. When `appMode === 'FLEET_MASTER'`, render `Centrala Floty (100+)` navigation tab.
   - `src/components/StoreSwitcherModal.tsx`: Return null or block opening when in `STORE_CLIENT` mode.
   - `src/components/DatabaseBackupModal.tsx` & `src/components/UnifiedSettingsModal.tsx`: In `STORE_CLIENT` mode, hide destructive/developer options (Clean Slate database reset, manual DB wipe/restore, raw database telemetry). Preserve in `FLEET_MASTER` mode.
7. **App Routing (`src/App.tsx`)**:
   - Extend `AppModule` to include `'fleet_master'`.
   - In `FLEET_MASTER` mode, route `activeModule === 'fleet_master'` to `<FleetMasterDashboard />`.
8. **Automated Security Tests**:
   - Implement `tests/security/dual_profile_isolation.test.ts` covering:
     * `STORE_CLIENT` restricts `availableStores` to assigned store ID.
     * `STORE_CLIENT` rejects switching to unauthorized store ID.
     * `FLEET_MASTER` allows unrestricted access and switching across 100+ stores.
     * Kill-switch revocation propagates and zeroes keys.
     * Profile policy correctly prunes developer/destructive features.
   - Verify all tests pass: `npm run test:security`.
   - Verify clean TypeScript build: `npm run build`.

### Deliverables
- All source files compiled and passing tests.
- `handoff.md` in `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_worker_1/handoff.md` with full Observation, Logic Chain, Caveats, Conclusion, and Verification results (commands + stdout).
