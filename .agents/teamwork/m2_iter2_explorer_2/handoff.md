# Handoff Report: ProfilePolicyService & FleetService Defense Hardening (Milestone 2 Iteration 2)

**Agent**: M2 Iter2 Explorer 2 (`teamwork_preview_explorer`)  
**Role**: ProfilePolicyService & FleetService Defense Hardening  
**Target Path**: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_2/handoff.md`  
**Patch Artifact**: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_2/m2_defense_hardening.patch`  
**Report Artifact**: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_2/report.md`  

---

## 1. Observation

### Observation 1: Null Dereference in `ProfilePolicyService.canSwitchToStore`
- **Location**: `src/services/security/profilePolicyService.ts:85-86`
- **Code Quote**:
  ```typescript
  // STORE_CLIENT może pracować wyłącznie w ramach przypisanych jednostek
  const normalizedTarget = targetStoreId.toLowerCase().trim();
  return assignedStoreIds.some((id) => Boolean(id) && id.toLowerCase().trim() === normalizedTarget);
  ```
- **Direct Test Command**:
  ```bash
  node --import tsx -e "
  import { ProfilePolicyService } from './src/services/security/profilePolicyService';
  ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', null as any);
  "
  ```
- **Verbatim Error**:
  ```
  TypeError: Cannot read properties of null (reading 'some')
      at ProfilePolicyService.canSwitchToStore (/Users/dawidapel/COL Tool/src/services/security/profilePolicyService.ts:86:29)
  ```

### Observation 2: Unhandled TypeErrors in `FleetService.applyKillSwitch`
- **Location**: `src/services/admin/fleetService.ts:263-267`
- **Code Quote**:
  ```typescript
  public applyKillSwitch(payload: KillSwitchPayload): { success: boolean; error?: string } {
    const expectedChallenge = `REVOKE ${payload.storeId.toUpperCase()}`;
    if (payload.confirmationChallenge.trim().toUpperCase() !== expectedChallenge) {
      return { success: false, error: `Wymagane wpisanie dokładnej frazy: "${expectedChallenge}"` };
    }
  ```
- **Direct Test Commands & Errors**:
  1. *Missing / undefined payload*:
     `FleetService.getInstance().applyKillSwitch({} as any);`
     `TypeError: Cannot read properties of undefined (reading 'toUpperCase')`
  2. *Payload with `targetStoreId` instead of `storeId`*:
     `FleetService.getInstance().applyKillSwitch({ targetStoreId: '108120' } as any);`
     `TypeError: Cannot read properties of undefined (reading 'toUpperCase')`
  3. *Payload with missing `confirmationChallenge`*:
     `FleetService.getInstance().applyKillSwitch({ storeId: '108120' } as any);`
     `TypeError: Cannot read properties of undefined (reading 'trim')`
  4. *Null payload*:
     `FleetService.getInstance().applyKillSwitch(null as any);`
     `TypeError: Cannot read properties of null (reading 'storeId')`

### Observation 3: Missing `sbx:license-revoked` Event Dispatch in `applyKillSwitch`
- In `src/services/admin/fleetService.ts:296-306`, `applyKillSwitch` updates local license state and invalidates `StoreKeyCache`, but does not dispatch `window.dispatchEvent(new CustomEvent('sbx:license-revoked', ...))`.
- In contrast, `FleetService.executeKillSwitch` (lines 535–543) and `LicensingService.revokeLicense` (line 620) dispatch `sbx:license-revoked`, which `AuthContext.tsx:179` listens for to lock the station and clear session memory.

### Observation 4: Unhandled TypeError in `FleetService.getRequiredChallengeCode`
- In `src/services/admin/fleetService.ts:390-392`:
  ```typescript
  public static getRequiredChallengeCode(storeId: string): string {
    return `REVOKE ${storeId.toUpperCase()}`;
  }
  ```
  Calling `FleetService.getRequiredChallengeCode(null as any)` throws:
  `TypeError: Cannot read properties of null (reading 'toUpperCase')`.

---

## 2. Logic Chain

1. **Step 1 (From Observation 1)**: In TypeScript / JavaScript, default arguments (such as `assignedStoreIds: string[] = []`) only execute when the argument is strictly `undefined`. Passing `null` leaves `assignedStoreIds = null`, leading directly to `null.some(...)` throwing `TypeError: Cannot read properties of null (reading 'some')`.
2. **Step 2 (From Observation 1 & 2)**: Both `canSwitchToStore` and `applyKillSwitch` are gatekeepers of security decisions (store boundary authorization and emergency station revocation). When unexpected, null, or alternate parameters are passed, throwing unhandled `TypeError` crashes the calling execution context or unhandled promise chain rather than failing closed.
3. **Step 3 (From Observation 2)**: Callers and test runners frequently represent store identifiers as `targetStoreId` or `storeId`, and confirmation strings can be omitted or malformed. Accessing `payload.storeId.toUpperCase()` without a nullish-coalescing check (`payload.storeId || payload.targetStoreId`) or checking `confirmationChallenge` with `String(...).trim().toUpperCase()` causes immediate crashes.
4. **Step 4 (From Observation 3)**: A critical functional requirement of the Kill-Switch mechanism is instantaneous UI lockdown and session termination across all active browser windows and components (`AuthContext`). Omitting `window.dispatchEvent('sbx:license-revoked')` prevents client-side listeners from responding immediately.
5. **Step 5 (From Observation 4)**: The helper `getRequiredChallengeCode` is public and static; if invoked with null or empty input, it must return an empty string or handle gracefully rather than crashing.
6. **Conclusion**: Introducing defensive guards (`!Array.isArray(assignedStoreIds)`), safe payload string extraction, empty target prevention, and event dispatch completely closes all discovered runtime crash vectors and enforces fail-closed security.

---

## 3. Caveats

- **Case-Insensitive Kill-Switch UX**: Normalizing `confirmationChallenge` via `.trim().toUpperCase()` permits operators to type `revoke 108120` or include whitespace. This aligns with `FleetService.executeKillSwitch`, but requires exact letter-by-letter matching of the store identifier.
- **Read-Only Scope**: In adherence to explorer archetype guidelines, no production application files in `src/` were modified. All recommended changes are formalized in `m2_defense_hardening.patch` and `report.md` for Worker execution.

---

## 4. Conclusion

The identified unhandled exceptions are reproducible and represent critical defense gaps in input validation and event notification.
The recommended remediations:
1. In `src/services/security/profilePolicyService.ts`:
   - Add `if (!Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) return false;` to `canSwitchToStore`.
   - Add `if (!Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) return [];` and `if (!Array.isArray(stores)) return [];` to `filterStoresForProfile`.
2. In `src/services/admin/fleetService.ts`:
   - Defensively validate `payload` presence in `applyKillSwitch`.
   - Extract `targetId = String(payload.storeId || (payload as any).targetStoreId || '').trim()`.
   - Reject empty `targetId` with error: `'Nie podano identyfikatora lokalu dla operacji Kill-Switch.'`.
   - Safely compare `challenge = String(payload.confirmationChallenge || '').trim().toUpperCase()` with `expectedChallenge = 'REVOKE ' + targetId.toUpperCase()`.
   - Dispatch `sbx:license-revoked` window CustomEvent on success.
   - Harden `getRequiredChallengeCode(storeId)` to safely handle null/undefined.

These changes are fully prepared in `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_2/m2_defense_hardening.patch`.

---

## 5. Verification Method

To independently verify the recommendations:

1. **Verify Security Test Suite**:
   ```bash
   npm run test:security
   ```
   *Expected outcome*: 86 tests pass, 0 suites fail, exit code 0.
2. **Verify Production Compilation**:
   ```bash
   npm run build
   ```
   *Expected outcome*: Vite builds client environment and Electron processes cleanly with 0 TypeScript errors.
3. **Run Adversarial Input Assertions**:
   ```bash
   node --import tsx -e "
   import { ProfilePolicyService } from './src/services/security/profilePolicyService';
   import { FleetService } from './src/services/admin/fleetService';
   import assert from 'node:assert/strict';

   // Test null / malformed inputs to ProfilePolicyService
   assert.equal(ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', null as any), false);
   assert.equal(ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', undefined), false);
   assert.equal(ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', {} as any), false);

   // Test null / malformed inputs to FleetService.applyKillSwitch
   const s = FleetService.getInstance();
   assert.equal(s.applyKillSwitch(null as any).success, false);
   assert.equal(s.applyKillSwitch({} as any).success, false);
   assert.equal(s.applyKillSwitch({ storeId: '108120' } as any).success, false);
   assert.equal(s.applyKillSwitch({ targetStoreId: '108120' } as any).success, false);
   assert.equal(s.applyKillSwitch({ storeId: '', confirmationChallenge: 'REVOKE ' } as any).success, false);
   "
   ```
   *Expected outcome*: Zero thrown exceptions, all assertions pass.
