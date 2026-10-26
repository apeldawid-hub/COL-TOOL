## 2026-10-24T08:10:00Z
You are M3 Remediation Worker 2 (`m3_worker_2`).
Your working directory is: /Users/dawidapel/COL Tool/.agents/teamwork/m3_worker_2
Project root: /Users/dawidapel/COL Tool
Master Request: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Master Architectural Spec: /Users/dawidapel/COL Tool/PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You have exclusive write ownership of the following files:
1. `src/services/security/encryptionService.ts`
2. `src/services/security/vaultService.ts`
3. `firestore.rules`
4. `tests/e2e/helpers/cryptoSpec.ts`
5. `tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts`
6. `tests/e2e/tier1-feature-coverage/f13_sensitive_payload_vault.test.ts`
7. `tests/e2e/tier2-boundary-corner/b13_payload_classification_boundaries.test.ts`
8. `tests/e2e/tier2-boundary-corner/b14_rules_tenant_boundaries.test.ts`

BLUEPRINT SPECIFICATIONS (Read all three before implementing):
1. Defect Area 1 (Crypto Engine & Key Derivation):
   - Blueprint: `/Users/dawidapel/COL Tool/.agents/teamwork/m3_retry_explorer_1/handoff.md`
   - Wire `encryptPayload` and `decryptPayload` to call `await deriveStoreKey(storeId, unitCode, passphrase)`.
   - Update `deriveStoreKey` to check `StoreKeyCache` first, then call `window.api?.cryptoDeriveStoreKey` if in Electron desktop, falling back cleanly to PBKDF2 `deriveStoreKeySync` for headless Node.
   - Implement memory hygiene with `Buffer.fill(0)` zeroization in `StoreKeyCache` on expiration, eviction (`MAX_ENTRIES = 256`), store invalidation, and clear.
   - Fix `canonicalJson` in `encryptionService.ts` and `cryptoSpec.ts`: filter out `undefined` properties in objects (`.filter(k => data[k] !== undefined)`), map `undefined` in arrays to `'null'`, format `Date` instances to ISO strings.
   - Add explicit test coverage in `f12_f15_cryptography.test.ts`.

2. Defect Area 2 (Schema Reconciliation & Medical Sanitization):
   - Blueprint: `/Users/dawidapel/COL Tool/.agents/teamwork/m3_retry_explorer_2/handoff.md`
   - In `src/services/security/vaultService.ts`, unpack envelope fields into top-level properties in `EncryptedVaultDocument` and `packageGenericVault`: `{ docId, storeId, unitCode, vaultType, version: 'v1', keyId, iv, tag, ciphertext, encryptedPayload: envelope.serialized, schemaVersion: 'v1', recordCount, checksum, updatedAt, updatedBy }`.
   - In `firestore.rules`, update `isValidVaultDocument()` and `isValidStoreTelemetry()` to accept timestamps or ISO strings via `(data.updatedAt is timestamp || (data.updatedAt is string && data.updatedAt.size() > 0))`, validate required top-level fields, and allow optional envelope fields.
   - Update `buildTelemetryStatus()` with `docId: 'status'`, `status: 'online' | ...`, and compatible `updatedAt`.
   - In `vaultService.ts`, fix `classifyField()` and `containsSensitiveFields()` using word-boundary regexes `/(?:^|_)(?:l4|sick|health|medical|disability|diagnosis|sanepid)(?:_|$)/i` and `/(?:^|_)(?:salary|hourly_rate|hourlyrate|bonus_rate|rate_pln|rate|bonus|payroll|iban)(?:_|$)/i` to prevent false positive substring collisions on `col4`, `level4`, `corporate_id`, `generate_timestamp`, `operate_mode`.
   - In `sanitizeForPublicSchedule()`, normalize keys and values so all variations (`shift_code`, `shiftCode`, `ShiftCode`) with values `'L4'`, `'l4'`, or trimmed `' l4 '` are obfuscated to `'ABSENCE'`.
   - In `unpackageGenericVault()`, throw explicit Error when computed SHA-256 does not match `doc.checksum`.

3. Defect Area 3 (Test Facade Elimination & Real Module Testing):
   - Blueprint: `/Users/dawidapel/COL Tool/.agents/teamwork/m3_retry_explorer_3/handoff.md`
   - In `f13_sensitive_payload_vault.test.ts`: eliminate all local mock closures. Directly import `VaultService`, create real domain models for all 4 vault collections, test end-to-end packaging/unpackaging, AEAD tampering rejection, and public schedule sanitization.
   - In `b13_payload_classification_boundaries.test.ts`: eliminate dummy mock closures. Directly import `VaultService` to test edge-case columns (`col4`, `level4`, `corporate_id`, `rate_pln`, mixed case `ShiftCode: 'l4'`), deep sensitivity scanning, checksum corruption failure, and 1 MiB document size boundary.
   - In `b14_rules_tenant_boundaries.test.ts`: eliminate mock closures. Read `firestore.rules` directly from disk and evaluate genuine rules expressions for tenant isolation, corporate email validation, token tampering, RBAC privilege separation, and immutability.

VERIFICATION COMMANDS:
- `npm run build` — must exit 0 cleanly.
- `npx tsx --test "tests/e2e/**/*.test.ts"` — all automated tests must pass 100%!
