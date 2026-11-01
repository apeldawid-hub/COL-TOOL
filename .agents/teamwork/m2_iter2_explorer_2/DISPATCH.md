# DISPATCH: Milestone 2 Iteration 2 — Explorer 2 (ProfilePolicyService & FleetService Defense Hardening)

## 2026-10-26T20:53:00Z

### Target Agent
- Role: M2 Iter2 Explorer 2: ProfilePolicyService & FleetService Defense Hardening
- TypeName: `teamwork_preview_explorer`
- Working Directory: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_2`

### Mandatory Reading
- `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md` (Read fully first)
- `/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_4/SCOPE.md`
- Challengers' feedback:
  * `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_challenger_1/handoff.md`
  * `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_challenger_2/handoff.md`

### Task Description
Challenger 1 and Challenger 2 identified unhandled TypeErrors and missing field vulnerabilities:
1. **Null Dereference in `ProfilePolicyService.canSwitchToStore`**:
   - Location: `src/services/security/profilePolicyService.ts:85-86`.
   - Passing `assignedStoreIds` as `null` bypasses default parameter `[]` and throws `TypeError: Cannot read properties of null (reading 'some')`.
   - Solution: Add strict defensive guard:
     `if (!Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) return false;`
2. **Unhandled TypeError and Payload Inconsistency in `FleetService.applyKillSwitch`**:
   - Location: `src/services/admin/fleetService.ts:263-267`.
   - Calling `payload.storeId.toUpperCase()` when `payload.storeId` is undefined or passed as `(payload as any).targetStoreId` throws unhandled TypeError.
   - Solution: Extract storeId defensively:
     `const targetId = String(payload?.storeId || (payload as any)?.targetStoreId || '').trim();`
     `const challenge = String(payload?.confirmationChallenge || '').trim().toUpperCase();`
     `const expectedChallenge = 'REVOKE ' + targetId.toUpperCase();`
     `if (!targetId || challenge !== expectedChallenge) return { success: false, error: ... };`
   - Also ensure `applyKillSwitch` dispatches `sbx:license-revoked` via `window.dispatchEvent` if `typeof window !== 'undefined'`.

Analyze `src/services/security/profilePolicyService.ts` and `src/services/admin/fleetService.ts` and produce detailed code diff recommendations in:
`/Users/dawidapel/COL Tool/.agents/teamwork/m2_iter2_explorer_2/report.md`
And summary handoff in `handoff.md`.
