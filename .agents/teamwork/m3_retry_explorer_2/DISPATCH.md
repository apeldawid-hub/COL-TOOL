## 2026-10-24T07:53:59Z
You are M3 Retry Explorer 2: Schema Reconciliation & Medical Sanitization.
Your working directory is: /Users/dawidapel/COL Tool/.agents/teamwork/m3_retry_explorer_2
Project root: /Users/dawidapel/COL Tool
Master Request: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Master Architectural Spec: /Users/dawidapel/COL Tool/PROJECT.md
Gate Status: /Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_1/GATE_STATUS.md

MISSION:
Investigate and design a precise, production-grade code fix for Defect Area 2 from Milestone 3 Gate Iteration 1:
1. Schema divergence between `src/services/security/vaultService.ts` and `firestore.rules`:
   - Currently, `vaultService.ts` packages payloads into `{ docId, storeId, unitCode, vaultType, encryptedPayload: 'enc:v1:...', schemaVersion, recordCount, checksum, updatedAt, updatedBy }`.
   - Meanwhile, `firestore.rules` `isValidVaultDocument()` expected top-level fields `version`, `iv`, `tag`, `ciphertext`, and rejected string timestamps.
   - Design the exact aligned document structure in `vaultService.ts` AND the corresponding updates in `firestore.rules`.
   - Recommended aligned structure for `vaultService.ts`:
     Unpack envelope fields into top-level properties so both top-level metadata AND the canonical `encryptedPayload` envelope string are present:
     `{ docId, storeId, unitCode, vaultType, version: 'v1', keyId, iv, tag, ciphertext, encryptedPayload, schemaVersion: 'v1', recordCount, checksum, updatedAt, updatedBy }`.
   - In `firestore.rules`, update `isValidVaultDocument()` to accept this aligned structure, and ensure `updatedAt` allows `request.resource.data.updatedAt is timestamp || (request.resource.data.updatedAt is string && request.resource.data.updatedAt.size() > 0)`.
   - Reconcile Telemetry Status Schema: Ensure `buildTelemetryStatus()` in `vaultService.ts` includes `docId: 'status'`, `status: syncState.status || 'online'`, and compatible `updatedAt`.
2. Substring collisions in `classifyField()` in `vaultService.ts`:
   - Currently uses `.includes('l4')` or `.includes('rate')`, causing false positive matches on `col4`, `level4`, `corporate_id`, `generate_timestamp`, `operate_mode`.
   - Design strict word-boundary matching using regex:
     * L4/Health: `/(?:^|_)(?:l4|sick|health|medical)(?:_|$)/i`
     * Rate/Compensation: `/(?:^|_)(?:hourly_rate|hourlyrate|salary|bonus_rate|rate_pln)(?:_|$)/i`
3. Medical leave leak in `sanitizeForPublicSchedule()` in `vaultService.ts`:
   - Ensure it handles both snake_case and camelCase: `key.toLowerCase().replace(/_/g, '') === 'shiftcode' && (value === 'L4' || value === 'l4')` and replaces with `'PL'`.
4. Checksum verification in `unpackageGenericVault()`:
   - When computed SHA-256 does not match `vaultDoc.checksum`, ensure it properly throws an error or returns `{ success: false, error: 'Checksum mismatch: payload corrupted' }`.

You are READ-ONLY. DO NOT edit source code files. Write your complete, detailed analysis, line-by-line diffs/code snippets, and step-by-step fix blueprint to `/Users/dawidapel/COL Tool/.agents/teamwork/m3_retry_explorer_2/handoff.md`.
Update your `progress.md` after completing each step.
When complete, send a message to orchestrator with your findings and handoff path.
