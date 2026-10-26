## 2026-10-24T07:22:37Z
From: parent (53bb484f-c139-4c15-89f6-7d840b96f7e4)
Priority: MESSAGE_PRIORITY_HIGH

You are M3 Explorer 3 (Hardened Firestore Security Rules & Crypto Test Suite — Features F14 & F15).
Your working directory is: /Users/dawidapel/COL Tool/.agents/teamwork/m3_explorer_3
Project root: /Users/dawidapel/COL Tool

CRITICAL CONSTRAINTS:
- You are a READ-ONLY explorer. DO NOT edit source code or run destructive operations.
- Read ORIGINAL_REQUEST.md at: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
- Read PROJECT.md at: /Users/dawidapel/COL Tool/PROJECT.md

TASK DESCRIPTION:
Investigate `firestore.rules` and test architecture to design Feature F14 (Hardened Firestore Security Rules) and Feature F15 (Cryptographic Unit Test Suite):
1. **Feature F14 (`firestore.rules`)**:
   - Inspect existing `firestore.rules` in the project root.
   - Identify vulnerabilities: cross-store access, missing auth checks, insecure collection queries, or unauthenticated reads/writes.
   - Formulate strict per-store tenant isolation rules:
     * Helper `isStoreAuthorized(storeId)`: requires `request.auth != null && request.auth.token.storeId == storeId`.
     * Strict isolation: Store A manager/token CANNOT read or write any documents in `stores/store_B/...`.
     * Secure collection paths: `/stores/{storeId}/vault_financials/{docId}`, `/stores/{storeId}/vault_personnel/{docId}`, `/stores/{storeId}/vault_schedules/{docId}`, `/stores/{storeId}/vault_health_gdpr/{docId}`, `/stores/{storeId}/telemetry/{docId}`.
     * Validate incoming payload format (e.g. envelope must have `version`, `iv`, `tag`, `ciphertext`).
2. **Feature F15 (Cryptographic Unit Test Suite)**:
   - Design comprehensive automated test suite in `tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts` exercising `encryptionService.ts` and vault structures:
     * Test 1: Full round-trip encrypt and decrypt for complex nested objects, Polish unicode strings, and binary numbers.
     * Test 2: Decryption failure on corrupted ciphertext (verifying GCM AEAD tag check).
     * Test 3: Decryption failure on corrupted auth tag.
     * Test 4: Decryption failure on tampered AAD context (e.g. wrong storeId, wrong vaultType, or wrong docId).
     * Test 5: Key derivation uniqueness: different storeId or unitCode produces different derived keys and cannot decrypt.
     * Test 6: String serialization and deserialization (`enc:v1:...`).
     * Test 7: Performance benchmark: 100 round-trip encryptions execute in < 200ms.
3. Provide complete, copy-pasteable blueprints for `firestore.rules` and `tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts`.

Write your report to:
`/Users/dawidapel/COL Tool/.agents/teamwork/m3_explorer_3/handoff.md`
When done, send a message to orchestrator with your findings summary.
