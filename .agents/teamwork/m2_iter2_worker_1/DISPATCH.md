# DISPATCH: Milestone 2 Iteration 2 — Worker 1 (Remediation & Defense Hardening)

## 2026-10-26T21:04:00Z

### Target Agent
- Role: M2 Iter2 Worker: Code Fixes, Defense Hardening & Test Harmonization
- TypeName: `teamwork_preview_worker`
- Working Directory: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_worker_1`

### Mandatory Reading
- `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md` (Read fully first)
- `/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_4/SCOPE.md`
- Explorer Reports & Blueprints:
  * `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_1/report.md`
  * `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_2/report.md`
  * `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_2/m2_defense_hardening.patch`
  * `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_3/report.md`
  * `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_3/proposed_challenger1_m2_isolation_privilege.test.ts`
  * `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_3/proposed_dual_profile_isolation.test.ts`

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Objective & Scope of Changes

1. **`src/services/storeService.ts`**:
   - Change static `runtimeSecurityProfile` initialization from `FLEET_MASTER` to least-privilege `STORE_CLIENT`:
     ```typescript
     private static runtimeSecurityProfile: {
       appMode: AppRuntimeMode | string;
       assignedStoreIds: string[];
     } = {
       appMode: 'STORE_CLIENT',
       assignedStoreIds: [],
     };
     ```
   - In `setCurrentStore`: replace the inverted `if (effectiveMode === 'STORE_CLIENT')` with a strict fail-closed check:
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
   - In `addCustomStore` and `removeCustomStore`: enforce identical check: only `isFleetMaster` may add or remove custom stores.
   - Guard `window.dispatchEvent`, `localStorage`, and `CustomEvent` accesses with `typeof window !== 'undefined'`, `typeof localStorage !== 'undefined'`, and `typeof CustomEvent !== 'undefined'` to ensure clean headless Node test execution without warnings.

2. **`src/services/security/profilePolicyService.ts`**:
   - In `canSwitchToStore`: guard against `null` or non-array `assignedStoreIds`:
     ```typescript
     if (!Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) {
       return false;
     }
     ```
   - In `filterStoresForProfile`: add defensive checks ensuring `assignedStoreIds` is an array.

3. **`src/services/admin/fleetService.ts`**:
   - In `applyKillSwitch`: extract `targetId` defensively:
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
   - In `applyKillSwitch`: if `typeof window !== 'undefined' && typeof CustomEvent !== 'undefined'`, dispatch `sbx:license-revoked` event to trigger instant station lockdown in `AuthContext`.
   - In `getRequiredChallengeCode`: guard against empty/null store ID.

4. **Test Suite Harmonization**:
   - Update `tests/security/challenger1_m2_isolation_privilege.test.ts` using the harmonized file from `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_3/proposed_challenger1_m2_isolation_privilege.test.ts`.
   - Update `tests/security/dual_profile_isolation.test.ts` using the harmonized file from `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_3/proposed_dual_profile_isolation.test.ts`.

5. **Verification**:
   - Run `npm run test:security` and ensure all 86/86 tests pass with 0 failures and 0 unhandled exceptions.
   - Run `npm run build` and ensure clean compilation with 0 TypeScript/Vite errors.

### Deliverables
- `handoff.md` in `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_worker_1/handoff.md` with full 5-component report (Observation, Logic Chain, Caveats, Conclusion, Verification output).
