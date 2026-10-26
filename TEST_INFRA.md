# TEST_INFRA.md — End-to-End Test Infrastructure Specification

## 1. Overview & Objective
This document defines the End-to-End (E2E) Opaque-Box Test Infrastructure for the **Starbucks Operations Suite** (supporting 100+ stores, Client-Side AES-256-GCM Cloud Vaults, and Zero-Data-Loss Migration). The test suite exercises the system exclusively through public APIs, persistent storage interfaces, inter-process communication (IPC) contracts, and standard user interactions without violating encapsulation or coupling to internal private states.

---

## 2. Test Architecture & Runner Invocation

### 2.1 Test Engine
- **Runtime**: Node.js (v24 LTS or higher)
- **Test Framework**: Native Node Test Runner (`node:test`, `node:assert/strict`) executed with TypeScript transpilation via `tsx`
- **Runner Command**:
  ```bash
  node --import tsx --test "tests/e2e/**/*.test.ts"
  ```
  or shorthand:
  ```bash
  npx tsx --test "tests/e2e/**/*.test.ts"
  ```
- **Exit Code Semantics**:
  - `0`: All tests passed cleanly.
  - Non-zero: One or more assertions failed or an unhandled exception occurred.

### 2.2 Directory Layout
```
tests/
└── e2e/
    ├── helpers/
    │   ├── cryptoSpec.ts          # Reference cryptographic engine (PBKDF2, AES-256-GCM, AAD, canonical JSON)
    │   ├── testHarness.ts         # In-memory storage harness, virtual Electron IPC, store registry mock
    │   └── firestoreRulesSpec.ts  # AST/Rule-level validator for tenant isolation & RBAC
    ├── tier1-feature-coverage/    # Tier 1: Feature Coverage (F1 to F18, >=5 tests each, 90 total)
    │   ├── f01_fallback_elimination.test.ts
    │   ├── f02_mock_purge.test.ts
    │   ├── f03_ai_filler_elimination.test.ts
    │   ├── f04_onboarding_wizard.test.ts
    │   ├── f05_parameterized_sql.test.ts
    │   ├── f06_db_naming_migration.test.ts
    │   ├── f07_lru_pool_mutex.test.ts
    │   ├── f08_store_registry_100.test.ts
    │   ├── f09_react_lifecycle_isolation.test.ts
    │   ├── f10_storage_namespacing.test.ts
    │   ├── f11_store_backups.test.ts
    │   ├── f12_aes256_encryption_engine.test.ts
    │   ├── f13_sensitive_payload_vault.test.ts
    │   ├── f14_firestore_rules_isolation.test.ts
    │   ├── f15_crypto_verification.test.ts
    │   ├── f16_migration_pipeline.test.ts
    │   ├── f17_parity_verification.test.ts
    │   └── f18_acceptance_hardening.test.ts
    ├── tier2-boundary-corner/     # Tier 2: Boundary & Corner Cases (F1 to F18, >=5 tests each, 90 total)
    │   ├── b01_fallback_boundaries.test.ts
    │   ├── b02_mock_data_boundaries.test.ts
    │   ├── b03_filler_text_boundaries.test.ts
    │   ├── b04_onboarding_boundaries.test.ts
    │   ├── b05_sql_boundaries.test.ts
    │   ├── b06_db_file_boundaries.test.ts
    │   ├── b07_lru_mutex_boundaries.test.ts
    │   ├── b08_registry_scale_boundaries.test.ts
    │   ├── b09_lifecycle_event_boundaries.test.ts
    │   ├── b10_storage_key_boundaries.test.ts
    │   ├── b11_backup_restore_boundaries.test.ts
    │   ├── b12_crypto_algorithm_boundaries.test.ts
    │   ├── b13_payload_classification_boundaries.test.ts
    │   ├── b14_rules_tenant_boundaries.test.ts
    │   ├── b15_crypto_edge_boundaries.test.ts
    │   ├── b16_migration_fault_boundaries.test.ts
    │   ├── b17_parity_drift_boundaries.test.ts
    │   └── b18_adversarial_stress_boundaries.test.ts
    ├── tier3-pairwise-interactions/ # Tier 3: Cross-Feature Combinations (>=18 pairwise tests)
    │   └── pairwise_interactions.test.ts
    └── tier4-real-world-scenarios/  # Tier 4: Complex Multi-Module Workloads (>=9 scenarios)
        └── real_world_scenarios.test.ts
```

---

## 3. Test Methodology

The test suite applies four formal verification methodologies:

### 3.1 Category-Partition Testing
Each input domain and operational parameter (e.g., store identifiers, cryptographic keys, role definitions, database state, payload sensitivities) is partitioned into equivalence classes:
- Valid vs. invalid store IDs (alphanumeric vs. special characters/traversals)
- Corporate vs. non-corporate email domains (`@amrest.eu`, `@starbucks.com` vs. generic)
- Classified sensitive payloads (salaries, P&L, health L4) vs. public schedule data
- Connection pool states (active, cached, evicted, locked)

### 3.2 Boundary Value Analysis (BVA)
Tests probe exact thresholds and boundary limits:
- Connection pool capacity: $N=7, 8, 9$ (LRU eviction triggered at 9)
- Store scaling: 1 store, 50 stores, 100 stores, 120 stores
- PBKDF2 iteration bounds: strict enforcement of 600,000 iterations
- Cryptographic dimensions: 96-bit (12-byte) IV, 128-bit (16-byte) AEAD tag, 256-bit key
- Schedule floor boundaries: 32.0 h/day, 224.0 h/week
- Backup rotation limit: 15 backups per store

### 3.3 Pairwise Interaction Testing (Combinatorial)
Testing multi-feature interaction pairs to verify that features compose orthogonally without interference:
- `F4 (Onboarding)` + `F6 (Uniform DB Naming)`: New store onboarding creates uniform `store_${id}.db`
- `F6 (DB Naming)` + `F7 (LRU Pool)`: Pool correctly balances handles across named store databases
- `F7 (LRU Pool)` + `F8 (Store Registry)`: Rapid switcher switches across 100 registered stores without handle exhaustion
- `F8 (Registry)` + `F9 (Lifecycle)`: Store switch triggers clean React unmount and `sbx:store-switching` event
- `F9 (Lifecycle)` + `F10 (Storage Namespacing)`: Switch resets memory and switches `sbx_store_${id}_*` partition
- `F10 (Storage Namespacing)` + `F11 (Partitioned Backups)`: Backup preserves store-specific namespace only
- `F11 (Backups)` + `F16 (Migration Pipeline)`: Migration triggers pre-flight store-isolated backup before cloud push
- `F12 (AES-256 Engine)` + `F13 (Sensitive Payload Vault)`: Classified payloads are encrypted with exact AAD format
- `F13 (Vault Packaging)` + `F14 (Firestore Rules)`: Encrypted payloads land in vaults protected by tenant rules
- `F14 (Firestore Rules)` + `F16 (Migration Upload)`: Batch migration pushes documents validated by tenant rules
- `F15 (Crypto Unit Tests)` + `F12 (Crypto Engine)`: Standard vector validation of AEAD properties
- `F16 (Migration Pipeline)` + `F17 (Parity Verification)`: Migration produces 100% SHA-256 parity certificate
- `F1 (No Fallback)` + `F4 (Onboarding)`: Fresh install with no fallback forces onboarding flow
- `F2 (Mock Purge)` + `F5 (Parameterized SQL)`: SQL queries for new store return zero fake/mock rows
- `F5 (Parameterized SQL)` + `F7 (LRU Mutex)`: Concurrent parameterized queries execute safely through mutex
- `F8 (Registry)` + `F11 (Backups)`: Backups for 100+ stores remain isolated and independently recoverable
- `F12 (Crypto Engine)` + `F17 (Parity Engine)`: Canonical JSON hashing ignores key order and verifies bitwise equality
- `F17 (Parity Engine)` + `F18 (Adversarial Hardening)`: Tampered cloud records fail parity check with cryptographic audit trail

### 3.4 Real-World Workloads & Scenarios
Application-level multi-step journeys simulating Store Manager, District Manager, and automated background sync workflows across active retail environments.

---

## 4. Coverage Thresholds & Target Matrix

| Tier | Focus | Test Count Target | Minimum Assertions |
|:---|:---|:---:|:---:|
| **Tier 1** | Feature Coverage (F1 to F18, >=5 each) | 90 | >= 180 |
| **Tier 2** | Boundary & Corner Cases (F1 to F18, >=5 each) | 90 | >= 180 |
| **Tier 3** | Cross-Feature Pairwise Interactions | 18 | >= 45 |
| **Tier 4** | Real-World Application Workloads | 9 | >= 36 |
| **Total** | **Comprehensive E2E Opaque-Box Suite** | **>= 207** | **>= 441** |

---

## 5. Pass/Fail & Verification Rules
1. Every test must derive its expected output from documented contracts in `PROJECT.md` and `ORIGINAL_REQUEST.md`.
2. Tests must be isolated and self-contained; no test may depend on state from another test.
3. Tests must be executable on standard macOS / Linux developer environments using `node --import tsx --test`.
