# DISPATCH: Milestone 2 — Challenger 1 (Store Isolation & Privilege Escalation Stress Test)

## 2026-10-26T20:40:00Z

### Target Agent
- Role: M2 Challenger 1: Store Isolation & Privilege Escalation Stress Test
- TypeName: `teamwork_preview_challenger`
- Working Directory: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_challenger_1`

### Mandatory Reading
- `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md` (Read fully first)
- `/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_4/SCOPE.md` (Features F4, F5, F6)
- `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_worker_1/handoff.md`

### Challenge Mandate
Empirically stress test the Store Isolation and Privilege Escalation defenses:
1. **Store Boundary Bypass Attempt**:
   - Write a test script or adversarial test suite that attempts to invoke `storeService.setCurrentStore` or `context.switchStore` in `STORE_CLIENT` mode to unassigned store IDs (e.g. `108121`, `999999`, empty string, prototype pollution, case variations).
   - Verify that unauthorized store switches are rejected and throw errors without mutating state.
2. **Profile Policy Spoofing Attempt**:
   - Attempt to call restricted operations (e.g. `clean_slate_db`, `manual_vacuum`, `export_fleet_csv`) while `appMode === 'STORE_CLIENT'`.
   - Verify that `ProfilePolicyService` returns false and guards block the execution.
3. **Execution Verification**:
   - Run `npm run test:security` and your challenge test script.
   - Run `npm run build`.

State your verdict clearly in `handoff.md` as either **APPROVE** or **REQUEST_CHANGES**.
