# BRIEFING — 2026-10-24T07:30:00Z

## Mission
Investigate firestore.rules and crypto test architecture to design Feature F14 (Hardened Firestore Security Rules) and Feature F15 (Cryptographic Unit Test Suite).

## 🔒 My Identity
- Archetype: explorer
- Roles: Security Rules Specialist, Cryptographic Test Engineer, Investigator
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m3_explorer_3
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: M3 (Cloud Vault & Security Hardening)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify project code directly
- Write only to working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m3_explorer_3/
- Provide complete, copy-pasteable blueprints for firestore.rules and tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: 2026-10-24T07:22:37Z

## Investigation State
- **Explored paths**:
  - `firestore.rules` (470 lines) & `firebase/firestore.rules` (470 lines)
  - `tests/e2e/helpers/firestoreRulesSpec.ts`
  - `tests/e2e/tier1-feature-coverage/f14_firestore_rules_isolation.test.ts`
  - `tests/e2e/helpers/cryptoSpec.ts`
  - `tests/e2e/tier1-feature-coverage/f12_aes256_encryption_engine.test.ts`
  - `tests/e2e/tier1-feature-coverage/f15_crypto_verification.test.ts`
  - `tests/e2e/tier2-boundary-corner/b12_crypto_algorithm_boundaries.test.ts`
  - `tests/e2e/tier2-boundary-corner/b14_rules_tenant_boundaries.test.ts`
  - `tests/e2e/tier2-boundary-corner/b15_crypto_edge_boundaries.test.ts`
  - `tests/e2e/tier1-feature-coverage/f18_acceptance_hardening.test.ts`
  - `package.json` test setup (native `node:test` executed via `npx tsx --test`)
- **Key findings**:
  - Critical vulnerability in current `firestore.rules`: `getUserRole(storeId)` and `isUserActive(storeId)` allowed any user with `role: 'STORE_MANAGER'` in token to access any store without verifying `request.auth.token.storeId == storeId`.
  - Missing `isStoreAuthorized(storeId)` helper in production rules.
  - Missing Cloud Vault collections: `vault_financials`, `vault_personnel`, `vault_schedules`, `vault_health_gdpr`, `telemetry`.
  - Missing payload structure validation on incoming encrypted envelopes (`version`, `iv`, `tag`, `ciphertext`).
  - Aggregate leak in `app_installations` where any authenticated user could read all workstation telemetry.
  - Hardcoded comment referencing store 108120 Janki.
  - In crypto testing, PBKDF2 600,000 iterations takes ~70ms per derivation. When keys are cached (as planned for `encryptionService.ts`), 100 AES-256-GCM round-trips take ~3.77ms, comfortably exceeding the < 200ms benchmark.
  - Designed and experimentally verified all 7 crypto test scenarios in `tests_scratch.ts` (100% pass in 1.6s).
  - Designed and verified hardened `proposed_firestore.rules` passing all `analyzeFirestoreRules` checks and F14 criteria.
- **Unexplored areas**: None — all required items investigated and proven.

## Key Decisions Made
- Architecture for `firestore.rules`: Enforce `isStoreAuthorized(storeId)` requiring `request.auth.token.storeId == storeId` across all store-scoped collections.
- Cloud Vault Schemas: Validate encrypted envelopes with `isValidVaultDocument(data, storeId, expectedVaultType)` checking 96-bit IV, 128-bit tag, version 'v1', and ciphertext bounds.
- Backwards compatibility: Retain operational paths (`public_schedule`, `managed_users`, `private_staff_vault`, `access_requests`, `executive_financial_vault`) while securing them with `isStoreAuthorized(storeId)`.
- Cryptography test suite: Full 7-test suite designed for `tests/e2e/tier1-feature-coverage/f12_f15_cryptography.test.ts` with sub-4ms 100-round-trip benchmark.

## Artifact Index
- `.agents/teamwork/m3_explorer_3/DISPATCH.md` — Incoming task dispatch
- `.agents/teamwork/m3_explorer_3/progress.md` — Liveness heartbeat
- `.agents/teamwork/m3_explorer_3/tests_scratch.ts` — Verified runnable crypto test suite
- `.agents/teamwork/m3_explorer_3/proposed_firestore.rules` — Verified hardened security rules
- `.agents/teamwork/m3_explorer_3/handoff.md` — Complete 5-component report with copy-pasteable blueprints
