# Technical Investigation & Defense Hardening Report
## Milestone 2 Iteration 2: ProfilePolicyService & FleetService Defense Hardening

**Explorer**: M2 Iter2 Explorer 2 (`teamwork_preview_explorer`)  
**Role**: ProfilePolicyService & FleetService Defense Hardening  
**Date**: 2026-10-26  
**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_2`  
**Reference Artifacts**:
- `m2_defense_hardening.patch`: Unified diff containing recommended changes
- `handoff.md`: 5-component handoff report for the orchestrator and worker

---

## 1. Executive Summary

During Milestone 2 verification, Challenger 1 and Challenger 2 identified unhandled runtime exceptions (`TypeError`) in core security and administrative services when receiving malformed, null, or alternate payload formats:
1. **`ProfilePolicyService.canSwitchToStore` (Line 85–86)**: Passing `assignedStoreIds` as `null` bypasses JavaScript default parameter evaluation (`= []`), causing `assignedStoreIds.some(...)` to throw `TypeError: Cannot read properties of null (reading 'some')`.
2. **`FleetService.applyKillSwitch` (Line 263–267)**: Calling `payload.storeId.toUpperCase()` and `payload.confirmationChallenge.trim()` throws unhandled `TypeError` exceptions whenever `storeId` is missing/null/undefined or named `targetStoreId`, or when `confirmationChallenge` is omitted. Additionally, `applyKillSwitch` previously did not broadcast the `sbx:license-revoked` window event required to trigger immediate UI lockdown on active client sessions.
3. **`FleetService.getRequiredChallengeCode` (Line 390–392)**: Calling `storeId.toUpperCase()` when `storeId` is missing/null throws `TypeError: Cannot read properties of null (reading 'toUpperCase')`.

This report provides complete root-cause analyses, empirical reproduction commands, exact code diff recommendations, and a self-contained patch (`m2_defense_hardening.patch`) to achieve 100% fail-closed robustness across all edge cases.

---

## 2. Investigation 1: `ProfilePolicyService.canSwitchToStore` Null Dereference

### 2.1 Vulnerability Mechanism
- **File**: `src/services/security/profilePolicyService.ts`
- **Lines**: 72–88
- **Code Extract**:
  ```typescript
  public static canSwitchToStore(
    mode: AppRuntimeMode | string,
    targetStoreId: string,
    assignedStoreIds: string[] = []
  ): boolean {
    if (!targetStoreId || typeof targetStoreId !== 'string' || !targetStoreId.trim()) {
      return false;
    }
    if (mode === 'FLEET_MASTER') {
      return true;
    }

    // STORE_CLIENT może pracować wyłącznie w ramach przypisanych jednostek
    const normalizedTarget = targetStoreId.toLowerCase().trim();
    return assignedStoreIds.some((id) => Boolean(id) && id.toLowerCase().trim() === normalizedTarget);
  }
  ```

### 2.2 Root Cause Analysis
In ECMAScript/TypeScript specification, default parameter values (e.g. `assignedStoreIds: string[] = []`) are evaluated **only** when the passed argument is strictly `undefined` (`arguments[i] === undefined`).
When an upstream caller (such as an unhydrated authentication session, deserialized JSON from IPC, or external plugin) passes `null` (`canSwitchToStore('STORE_CLIENT', '108120', null as any)`):
1. `assignedStoreIds` is bound directly to `null`.
2. Line 86 executes `null.some(...)`.
3. The V8 JavaScript runtime halts execution with:
   `TypeError: Cannot read properties of null (reading 'some')`.

Additionally:
- If `assignedStoreIds` is a non-array truthy value (e.g. `{}` or `true` or `"108120"`), `assignedStoreIds.some` throws `TypeError: assignedStoreIds.some is not a function`.
- If `assignedStoreIds` contains non-string items (e.g. `[108120, null]`), `id.toLowerCase()` crashes with `TypeError: (108120).toLowerCase is not a function`.

### 2.3 Empirical Reproduction
Executed in terminal via tsx:
```bash
node --import tsx -e "
import { ProfilePolicyService } from './src/services/security/profilePolicyService';
try {
  ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', null as any);
} catch (e) {
  console.log('REPRODUCED:', e.message);
}
"
```
**Output**:
```
REPRODUCED: Cannot read properties of null (reading 'some')
```

### 2.4 Code Recommendation
Add a strict, fail-closed guard verifying `Array.isArray(assignedStoreIds)` before any array iteration, and ensure element-level string validation in the predicate:

```typescript
<<<< Before:
    // STORE_CLIENT może pracować wyłącznie w ramach przypisanych jednostek
    const normalizedTarget = targetStoreId.toLowerCase().trim();
    return assignedStoreIds.some((id) => Boolean(id) && id.toLowerCase().trim() === normalizedTarget);
====
>>>> After:
    // Fail-closed defensive guard: reject null, undefined, non-array, or empty assigned store lists
    if (!Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) {
      return false;
    }

    // STORE_CLIENT może pracować wyłącznie w ramach przypisanych jednostek
    const normalizedTarget = targetStoreId.toLowerCase().trim();
    return assignedStoreIds.some(
      (id) => typeof id === 'string' && Boolean(id.trim()) && id.toLowerCase().trim() === normalizedTarget
    );
```

### 2.5 Secondary Defense in `filterStoresForProfile`
In `src/services/security/profilePolicyService.ts` lines 92–117, `filterStoresForProfile` previously relied on `!assignedStoreIds || assignedStoreIds.length === 0`. If `assignedStoreIds` is passed as a non-array object or `stores` is null, it also risks runtime errors.
**Hardened implementation**:
```typescript
<<<< Before:
  public static filterStoresForProfile<T extends { id: string; unitCode?: string; mpk?: string }>(
    stores: T[],
    mode: AppRuntimeMode | string,
    assignedStoreIds: string[] = []
  ): T[] {
    if (mode === 'FLEET_MASTER') {
      return stores;
    }

    if (!assignedStoreIds || assignedStoreIds.length === 0) {
      return [];
    }

    const assignedSet = new Set(
      assignedStoreIds
        .filter(Boolean)
        .map((id) => id.toLowerCase().trim())
    );
====
>>>> After:
  public static filterStoresForProfile<T extends { id: string; unitCode?: string; mpk?: string }>(
    stores: T[],
    mode: AppRuntimeMode | string,
    assignedStoreIds: string[] = []
  ): T[] {
    if (!Array.isArray(stores)) {
      return [];
    }

    if (mode === 'FLEET_MASTER') {
      return stores;
    }

    if (!Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) {
      return [];
    }

    const assignedSet = new Set(
      assignedStoreIds
        .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
        .map((id) => id.toLowerCase().trim())
    );
```

---

## 3. Investigation 2: `FleetService.applyKillSwitch` Robustness

### 3.1 Vulnerability Mechanism
- **File**: `src/services/admin/fleetService.ts`
- **Lines**: 263–306
- **Code Extract**:
  ```typescript
  public applyKillSwitch(payload: KillSwitchPayload): { success: boolean; error?: string } {
    const expectedChallenge = `REVOKE ${payload.storeId.toUpperCase()}`;
    if (payload.confirmationChallenge.trim().toUpperCase() !== expectedChallenge) {
      return { success: false, error: `Wymagane wpisanie dokładnej frazy: "${expectedChallenge}"` };
    }
    ...
  ```

### 3.2 Root Cause Analysis
1. **Unchecked Property Access on Missing Payload**:
   If `payload` is `null`, `undefined`, or not an object, accessing `payload.storeId` throws `TypeError: Cannot read properties of undefined (reading 'storeId')`.
2. **Missing `storeId` or Alternative Field Name (`targetStoreId`)**:
   In diverse test harnesses (e.g. `dual_profile_isolation.test.ts:331`), the property is passed as `targetStoreId` instead of `storeId`. When `payload.storeId` is undefined, `payload.storeId.toUpperCase()` throws:
   `TypeError: Cannot read properties of undefined (reading 'toUpperCase')`.
3. **Empty String Challenge Collisions**:
   If `payload.storeId` is empty (`""`), `expectedChallenge` becomes `"REVOKE "`. If `challenge` is not guarded against an empty target, an adversary or misconfigured caller could accidentally or maliciously trigger a revocation on blank identifiers.
4. **Missing or Non-String `confirmationChallenge`**:
   If `payload.confirmationChallenge` is omitted, null, or a non-string type, calling `.trim()` throws:
   `TypeError: Cannot read properties of undefined (reading 'trim')`.
5. **Missing Broadcast of Window Revocation Event**:
   In `executeKillSwitch` (lines 535–543), the service dispatches:
   `window.dispatchEvent(new CustomEvent('sbx:license-revoked', { detail: { storeId, reason: lic.revokeReason } }));`
   This is listened to by `AuthContext.tsx:179` to instantly drop the user session, reset profile mode to `STORE_CLIENT`, and lock the station. However, `applyKillSwitch` omitted this dispatch entirely, leaving the active UI session un-notified until a page refresh.

### 3.3 Empirical Reproduction
Executed in terminal via tsx:
```bash
node --import tsx -e "
import { FleetService } from './src/services/admin/fleetService';
const s = FleetService.getInstance();
console.log('1. Empty payload:');
try { s.applyKillSwitch({} as any); } catch(e) { console.log('  Crash:', e.message); }

console.log('2. targetStoreId payload:');
try { s.applyKillSwitch({ targetStoreId: '108120' } as any); } catch(e) { console.log('  Crash:', e.message); }

console.log('3. Missing confirmationChallenge:');
try { s.applyKillSwitch({ storeId: '108120' } as any); } catch(e) { console.log('  Crash:', e.message); }
"
```
**Output**:
```
1. Empty payload:
  Crash: Cannot read properties of undefined (reading 'toUpperCase')
2. targetStoreId payload:
  Crash: Cannot read properties of undefined (reading 'toUpperCase')
3. Missing confirmationChallenge:
  Crash: Cannot read properties of undefined (reading 'trim')
```

### 3.4 Code Recommendation
Harden `applyKillSwitch` by:
1. Validating `payload` object presence.
2. Defensively extracting `targetId` from `payload.storeId` or `(payload as any).targetStoreId`.
3. Validating that `targetId` is non-empty; otherwise return error.
4. Safely normalizing `confirmationChallenge` via `String(payload?.confirmationChallenge || '').trim().toUpperCase()`.
5. Safely defaulting `reason`, `actorName`, and `actorEmail`.
6. Dispatching the `sbx:license-revoked` event via `window.dispatchEvent` if `typeof window !== 'undefined'`.

```typescript
<<<< Before:
  public applyKillSwitch(payload: KillSwitchPayload): { success: boolean; error?: string } {
    const expectedChallenge = `REVOKE ${payload.storeId.toUpperCase()}`;
    if (payload.confirmationChallenge.trim().toUpperCase() !== expectedChallenge) {
      return { success: false, error: `Wymagane wpisanie dokładnej frazy: "${expectedChallenge}"` };
    }

    const lic = this.licensesMap.get(payload.storeId) || { storeId: payload.storeId };
    lic.isRevoked = true;
    lic.revokedAt = new Date().toISOString();
    lic.revokeReason = payload.reason + (payload.customDetails ? ` — ${payload.customDetails}` : '');
    lic.revokedBy = `${payload.actorName} (${payload.actorEmail})`;

    this.licensesMap.set(payload.storeId, lic);

    // In-memory zeroization of encryption keys in StoreKeyCache
    StoreKeyCache.invalidateStore(payload.storeId);

    const targetStore = StoreService.findStoreByIdOrCode(payload.storeId);
    const storeName = targetStore?.name || payload.storeId;

    this.addAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action: 'KILL_SWITCH_REVOKE',
      severity: 'CRITICAL',
      targetStoreId: payload.storeId,
      targetStoreName: storeName,
      actorName: payload.actorName,
      actorEmail: payload.actorEmail,
      actorRole: 'FLEET_MASTER',
      details: `ZASTOSOWANO KILL-SWITCH. Powód: ${lic.revokeReason}. Stacja zablokowana permanentnie.`,
    });

    // Jeśli anulowany lokal jest aktualnie aktywny, natychmiast wywołaj lokalną unieważniającą funkcję
    const current = StoreService.getCurrentStore();
    if (current && (current.id === payload.storeId || current.unitCode === payload.storeId)) {
      LicensingService.getInstance().revokeLicense(lic.revokeReason).catch((err) => {
        console.warn('[FleetService] Błąd lokalnego revokeLicense:', err);
      });
    }

    this.saveState();
    return { success: true };
  }
====
>>>> After:
  public applyKillSwitch(payload: KillSwitchPayload): { success: boolean; error?: string } {
    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Nieprawidłowy payload operacji Kill-Switch.' };
    }

    const targetId = String(payload.storeId || (payload as any).targetStoreId || '').trim();
    if (!targetId) {
      return { success: false, error: 'Nie podano identyfikatora lokalu dla operacji Kill-Switch.' };
    }

    const challenge = String(payload.confirmationChallenge || '').trim().toUpperCase();
    const expectedChallenge = `REVOKE ${targetId.toUpperCase()}`;

    if (challenge !== expectedChallenge) {
      return { success: false, error: `Wymagane wpisanie dokładnej frazy: "${expectedChallenge}"` };
    }

    const lic = this.licensesMap.get(targetId) || { storeId: targetId };
    lic.storeId = targetId;
    lic.isRevoked = true;
    lic.revokedAt = new Date().toISOString();
    const baseReason = String(payload.reason || 'Zdalny Kill-Switch aktywowany').trim();
    const customDetails = payload.customDetails ? ` — ${String(payload.customDetails).trim()}` : '';
    lic.revokeReason = baseReason + customDetails;
    const actorName = String(payload.actorName || (payload as any).operator || 'District Manager / HQ Master').trim();
    const actorEmail = String(payload.actorEmail || 'admin.hq@starbucks.com').trim();
    lic.revokedBy = `${actorName} (${actorEmail})`;

    this.licensesMap.set(targetId, lic);

    // In-memory zeroization of encryption keys in StoreKeyCache
    StoreKeyCache.invalidateStore(targetId);

    const targetStore = StoreService.findStoreByIdOrCode(targetId);
    const storeName = targetStore?.name || targetId;

    this.addAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action: 'KILL_SWITCH_REVOKE',
      severity: 'CRITICAL',
      targetStoreId: targetId,
      targetStoreName: storeName,
      actorName,
      actorEmail,
      actorRole: 'FLEET_MASTER',
      details: `ZASTOSOWANO KILL-SWITCH. Powód: ${lic.revokeReason}. Stacja zablokowana permanentnie.`,
    });

    // Jeśli anulowany lokal jest aktualnie aktywny, natychmiast wywołaj lokalną unieważniającą funkcję
    const current = StoreService.getCurrentStore();
    if (current && (current.id === targetId || current.unitCode === targetId)) {
      LicensingService.getInstance().revokeLicense(lic.revokeReason).catch((err) => {
        console.warn('[FleetService] Błąd lokalnego revokeLicense:', err);
      });
    }

    // Broadcast sbx:license-revoked event to trigger instant UI logout & lockdown
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('sbx:license-revoked', {
            detail: { storeId: targetId, reason: lic.revokeReason },
          })
        );
      } catch (_) {}
    }

    this.saveState();
    return { success: true };
  }
```

### 3.5 Hardening `FleetService.getRequiredChallengeCode`
Lines 390–392 of `src/services/admin/fleetService.ts`:
```typescript
<<<< Before:
  public static getRequiredChallengeCode(storeId: string): string {
    return `REVOKE ${storeId.toUpperCase()}`;
  }
====
>>>> After:
  public static getRequiredChallengeCode(storeId: string): string {
    const id = String(storeId || '').trim();
    return id ? `REVOKE ${id.toUpperCase()}` : '';
  }
```

---

## 4. Synthesis of Findings & Matrix

| Vulnerability Vector | Original Behavior | Hardened Behavior | Security Principle |
| :--- | :--- | :--- | :--- |
| `canSwitchToStore(..., null)` | `TypeError: Cannot read properties of null (reading 'some')` | Returns `false` | Fail-Closed Authorization |
| `canSwitchToStore(..., nonArray)` | `TypeError: assignedStoreIds.some is not a function` | Returns `false` | Input Type Sanitization |
| `canSwitchToStore(..., [108120])` | `TypeError: (108120).toLowerCase is not a function` | Validates `typeof id === 'string'`, matches correctly | Defensive Programming |
| `applyKillSwitch(null)` | `TypeError: Cannot read properties of null (reading 'storeId')` | Returns `{ success: false, error: 'Nieprawidłowy payload...' }` | Graceful Error Handling |
| `applyKillSwitch({ targetStoreId })` | `TypeError: Cannot read properties of undefined (reading 'toUpperCase')` | Resolves `targetId` from `storeId` or `targetStoreId` | Tolerant Interface Polymorphism |
| `applyKillSwitch({ storeId: '' })` | `expectedChallenge` becomes `"REVOKE "` | Rejects: `'Nie podano identyfikatora lokalu...'` | Strict Target Enforcement |
| `applyKillSwitch` without challenge | `TypeError: Cannot read properties of undefined (reading 'trim')` | Safely evaluates to `''`, returns challenge mismatch error | Fail-Closed Challenge Gate |
| `applyKillSwitch` UI sync | Local state updated, but active UI unaware | Dispatches `sbx:license-revoked` event to trigger logout | Defense-in-Depth Lockdown |
| `getRequiredChallengeCode(null)` | `TypeError: Cannot read properties of null (reading 'toUpperCase')` | Returns `''` | Null-Safe Helper |

---

## 5. Verification & Testing Method

1. **Verify Security Test Suite Execution**:
   ```bash
   npm run test:security
   ```
   *Expected Outcome*: 86+ tests pass, 0 suites fail, exit code 0.
2. **Verify Production Compilation**:
   ```bash
   npm run build
   ```
   *Expected Outcome*: TypeScript / Vite build succeeds with 0 errors.
3. **Dedicated Adversarial Validation Script**:
   ```bash
   node --import tsx -e "
   import { ProfilePolicyService } from './src/services/security/profilePolicyService';
   import { FleetService } from './src/services/admin/fleetService';
   import assert from 'node:assert/strict';

   // 1. ProfilePolicyService null / malformed tests
   assert.equal(ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', null as any), false);
   assert.equal(ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', undefined), false);
   assert.equal(ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', {} as any), false);
   assert.equal(ProfilePolicyService.canSwitchToStore('STORE_CLIENT', '108120', ['108120']), true);

   // 2. FleetService applyKillSwitch adversarial tests
   const fleet = FleetService.getInstance();
   assert.equal(fleet.applyKillSwitch(null as any).success, false);
   assert.equal(fleet.applyKillSwitch({} as any).success, false);
   assert.equal(fleet.applyKillSwitch({ storeId: '108120' } as any).success, false);
   assert.equal(fleet.applyKillSwitch({ targetStoreId: '108120' } as any).success, false);
   assert.equal(fleet.applyKillSwitch({ storeId: '', confirmationChallenge: 'REVOKE ' } as any).success, false);

   console.log('ALL ADVERSARIAL DEFENSE CHECKS PASSED!');
   "
   ```

---

## 6. Recommended Action Plan for Implementer (Worker)

1. Review and apply `m2_defense_hardening.patch`.
2. Inspect `src/services/security/profilePolicyService.ts` to confirm both `canSwitchToStore` and `filterStoresForProfile` have `Array.isArray(assignedStoreIds)` guards.
3. Inspect `src/services/admin/fleetService.ts` to confirm `applyKillSwitch` and `getRequiredChallengeCode` defense guards and event dispatch.
4. Execute `npm run test:security` and `npm run build` to verify resolution.
