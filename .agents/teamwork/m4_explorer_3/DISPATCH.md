## 2026-10-24T08:36:44Z
From: 53bb484f-c139-4c15-89f6-7d840b96f7e4 (Orchestrator)
Mission: Investigate and design the test blueprint and fault tolerance architecture for Milestone 4 (Features F16 & F17).
Focus areas:
1. Review existing test files:
   - tests/e2e/tier1-feature-coverage/f16_migration_pipeline.test.ts
   - tests/e2e/tier1-feature-coverage/f17_parity_verification.test.ts
   - tests/e2e/tier2-boundary-corner/b16_migration_fault_boundaries.test.ts
   - tests/e2e/tier2-boundary-corner/b17_parity_drift_boundaries.test.ts
2. Identify dummy mocks / facades in f16 / f17 / b16 / b17, design genuine replacements importing CloudMigrationService and ParityVerificationService.
3. Design fault-tolerance and boundary test scenarios:
   - Pre-flight failure (disk full, read-only storage) blocks migration before touching cloud.
   - Simulated network abort or API 500 during batch upload triggers atomic rollback, leaving local SQLite intact.
   - Partial cloud upload recovery / retry without duplicate documents.
   - Parity verification with tampered field, omitted row, schema drift, clean matching.
   - Real-time progress telemetry events (sbx:migration-progress with { phase, percent, currentTable, recordsMigrated, totalRecords }).
4. Ensure all designed tests execute fast (< 500 ms) in headless Node under npx tsx --test.
Read-only investigation.
