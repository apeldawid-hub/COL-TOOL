## 2026-10-24T11:43:10Z
You are M4 Worker 1 (Local-to-Cloud Migration Bridge & Parity Verification Engine).
Your working directory is: /Users/dawidapel/COL Tool/.agents/teamwork/m4_worker_1

MANDATORY FIRST STEP:
Read /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md before doing any work.
Also read /Users/dawidapel/COL Tool/PROJECT.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your task is to implement Features F16 and F17 for Milestone 4:
1. Feature F16: Zero-Data-Loss Local-to-Cloud Migration Pipeline:
   - Implement `src/services/security/cloudMigrationService.ts`.
   - Comprehensive blueprint is already designed and provided in `/Users/dawidapel/COL Tool/.agents/teamwork/m4_explorer_1/handoff.md` (lines 300-1230) and `/Users/dawidapel/COL Tool/.agents/teamwork/m4_explorer_3/handoff.md`.
   - 6-Phase Pipeline:
     * Phase 1: Pre-flight snapshot backup via `BackupManager.getInstance().createBackup('pre_migration', storeId)` (Step 0).
     * Phase 2: SQLite table extraction across all 19 local tables (non-destructive read-only).
     * Phase 3: Domain classification and vault packaging via `VaultService` into 4 encrypted vaults (`vault_financials`, `vault_personnel`, `vault_schedules`, `vault_health_gdpr`) + 1 unencrypted telemetry document (`telemetry/status`).
     * Phase 4: Client-side AES-256-GCM encryption with bound AAD context `${storeId}:${vaultType}:${docId}`.
     * Phase 5: Cloud batch upload (max 100 documents per batch) with 3-retry exponential backoff.
     * Phase 6: Migration completion receipt recording (`data/migration_receipt_${safeId}.json`).
   - Atomic Rollback: Read-only access ensures local SQLite database is 100% untouched upon failure; pre-flight backup is strictly preserved; returns typed error without corrupting state.
   - Test Dependency Injection: Supports `ILocalDatabaseExtractor`, `IBackupProvider`, `ICloudVaultUploader`, `IMigrationProgressSink`, `rawTables`, `customFetch`, `dryRun` options so headless Node tests execute in < 500ms.

2. Feature F17: Bi-Directional Cryptographic Parity Verification:
   - Implement `src/services/security/parityVerificationService.ts`.
   - Comprehensive blueprint is provided in `/Users/dawidapel/COL Tool/.agents/teamwork/m4_explorer_3/handoff.md` and `/Users/dawidapel/COL Tool/.agents/teamwork/m4_explorer_1/handoff.md`.
   - Canonical SHA-256 (RFC 8785) per-record and per-table digests (Merkle roots).
   - Deep structural bi-directional comparison (local vs cloud and cloud vs local).
   - Detects row count mismatches, missing rows, extra rows, tampered values, IEEE 754 float drift, array order drift, and schema differences.
   - Generates cryptographically signed HMAC-SHA256 Parity Certificate on 100% match.

3. Electron IPC Integration:
   - Register IPC handlers in `electron/main.ts` and expose in `electron/preload.ts`:
     * `migration:execute-store-migration`
     * `migration:verify-store-parity`
     * `migration:extract-store-tables`
     * `migration:get-receipt`

4. Test Suite Remediation (Eradicate Facades in F16, F17, B16, B17):
   - Replace the synthetic dummy test files with genuine implementations that directly import and test `CloudMigrationService` and `ParityVerificationService`:
     * `tests/e2e/tier1-feature-coverage/f16_migration_pipeline.test.ts` (use blueprint in `m4_explorer_3/handoff.md` Section 4.2)
     * `tests/e2e/tier1-feature-coverage/f17_parity_verification.test.ts` (use blueprint in `m4_explorer_3/handoff.md` Section 4.3)
     * `tests/e2e/tier2-boundary-corner/b16_migration_fault_boundaries.test.ts` (use blueprint in `m4_explorer_3/handoff.md` Section 4.4)
     * `tests/e2e/tier2-boundary-corner/b17_parity_drift_boundaries.test.ts` (use blueprint in `m4_explorer_3/handoff.md` Section 4.5)

5. Verification:
   - Run `npm run build` — must exit 0 cleanly with zero errors.
   - Run `npx tsx --test "tests/e2e/**/*.test.ts"` — all automated tests (370+) must pass!

Write your completion report to `/Users/dawidapel/COL Tool/.agents/teamwork/m4_worker_1/handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
When finished, send a message back to the orchestrator with your results and status.
