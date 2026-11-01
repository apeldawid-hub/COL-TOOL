# DISPATCH: Milestone 2 — Challenger 2 (Kill-Switch, Key Zeroization & Catalog Scalability Challenge)

## 2026-10-26T20:40:00Z

### Target Agent
- Role: M2 Challenger 2: Kill-Switch, Key Zeroization & Catalog Scalability Challenge
- TypeName: `teamwork_preview_challenger`
- Working Directory: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_challenger_2`

### Mandatory Reading
- `/Users/dawidapel/COL Tool/ORIGINAL_REQUEST.md` (Read fully first)
- `/Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_4/SCOPE.md` (Features F4, F5, F6)
- `/Users/dawidapel/COL Tool/.agents/teamwork/m2_fleet_worker_1/handoff.md`

### Challenge Mandate
Empirically stress test the Kill-Switch, Key Zeroization, and Catalog Scalability:
1. **Kill-Switch Challenge**:
   - Test `FleetService.executeKillSwitch` with invalid confirmation strings (e.g. `revoke 108120`, `REVOKE`, `REVOKE 108121`, trailing spaces, lowercase, empty). Confirm that only exact `REVOKE <STORE_ID>` succeeds.
   - Verify that upon revocation, `StoreKeyCache.hasStoreKey(storeId)` returns false and the memory key is completely zeroized/deleted.
2. **Catalog Scalability & Search Stress**:
   - Test `FleetService.getStores` with all 104+ stores in `STARBUCKS_STORES_CATALOG`.
   - Test diacritics insensitivity across Polish special characters (ą, ć, ę, ł, ń, ó, ś, ź, ż): e.g. "krakow" matches "Kraków", "lodz" matches "Łódź", "poznan" matches "Poznań", "gdansk" matches "Gdańsk".
   - Test rapid sequential filtering and provisioning under concurrent requests.
3. **Execution Verification**:
   - Run `npm run test:security` and your challenge test script.
   - Run `npm run build`.

State your verdict clearly in `handoff.md` as either **APPROVE** or **REQUEST_CHANGES**.
