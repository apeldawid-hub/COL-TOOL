# BRIEFING — 2026-10-24T08:09:00Z

## Mission
Investigate and design a production-grade code fix for Defect Area 2 (Schema Reconciliation, Substring Collisions, Medical Sanitization, Checksum Verification) between vaultService.ts and firestore.rules.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis, handoff
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m3_retry_explorer_2
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: Milestone 3 Retry - Area 2

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / modify source code files
- Analysis, exact line-by-line diffs/blueprints written to handoff.md in working directory
- Output must strictly resolve all 4 sub-issues in Defect Area 2

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: 2026-10-24T08:09:00Z

## Investigation State
- **Explored paths**: `src/services/security/vaultService.ts`, `firestore.rules`, `src/services/security/encryptionService.ts`, `tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts`, `tests/e2e/tier5-adversarial/m3_challenger_vault_packaging_and_tenant_isolation.test.ts`, `tests/e2e/tier2-boundary-corner/b13_payload_classification_boundaries.test.ts`
- **Key findings**:
  1. Aligned schema: Unpack envelope fields (`version: 'v1'`, `keyId`, `iv`, `tag`, `ciphertext`) into top-level properties of `EncryptedVaultDocument` while keeping canonical `encryptedPayload: envelope.serialized`.
  2. Rules update: Update `isValidVaultDocument()` and `isValidStoreTelemetry()` in `firestore.rules` to accept string or timestamp (`data.updatedAt is timestamp || (data.updatedAt is string && data.updatedAt.size() > 0)`), allow optional envelope & routing fields (`encryptedPayload`, `schemaVersion`, `clientVersion`, `unitCode`, `period`, `staffGroup`, `weekKey`).
  3. Telemetry alignment: Add `docId: 'status'`, `status: params.status || (params.syncState === 'syncing' ? 'syncing' : params.syncState === 'offline' ? 'offline' : params.syncState === 'error' ? 'error' : 'idle')` to `PlaintextTelemetryDocument` and `buildTelemetryStatus()`.
  4. Word boundary regex: Normalizing keys via `camelCase -> snake_case` and applying `/(?:^|_)(?:l4|sick|health|medical|disability|diagnosis|sanepid)(?:_|$)/i` eliminates all substring false positives (`col4`, `level4`, `corporate_id`, `generate_timestamp`, `operate_mode`) while preserving genuine classification.
  5. Medical leave sanitization: Normalizing key and value allows sanitizing `shift_code`, `shiftCode`, `ShiftCode` with values `'L4'`, `'l4'`, or trimmed `' l4 '` to `'ABSENCE'` (or `'PL'`).
  6. Checksum mismatch: In `unpackageGenericVault()`, throw an explicit `Error` (`Checksum mismatch: payload corrupted for document ${doc.docId}`) when `recalculatedChecksum !== doc.checksum`.
- **Unexplored areas**: None for Defect Area 2. Ready for final synthesis and handoff.

## Key Decisions Made
- Maintain backward compatibility with existing tests by retaining `encryptedPayload` as a string property on `EncryptedVaultDocument` while exposing top-level cryptographic parameters.
- Provide clear guidance on `'ABSENCE'` (existing test expectation) vs `'PL'` (dispatch prompt note) in `sanitizeForPublicSchedule`.
- Formulate complete, copy-paste ready diffs and unit test suites for the Worker.

## Artifact Index
- DISPATCH.md — Received mission assignment
- BRIEFING.md — Persistent context & memory
- progress.md — Liveness heartbeat & step tracking
- handoff.md — Final 5-component handoff report
