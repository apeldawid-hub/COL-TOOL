## 2026-10-24T08:36:44Z
You are M4 Explorer 1: 6-Phase Cloud Migration Pipeline Architecture (Feature F16).
Your working directory is: /Users/dawidapel/COL Tool/.agents/teamwork/m4_explorer_1
Project root: /Users/dawidapel/COL Tool
Master Request: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
Master Architectural Spec: /Users/dawidapel/COL Tool/PROJECT.md
Gate Status: /Users/dawidapel/COL Tool/.agents/teamwork/orchestrator_1/GATE_STATUS.md

MISSION:
Investigate and design a production-grade implementation blueprint for Feature F16: Zero-Data-Loss Local-to-Cloud Migration Pipeline (`src/services/security/cloudMigrationService.ts`):
1. Review existing architecture:
   - `src/services/security/encryptionService.ts`
   - `src/services/security/vaultService.ts`
   - `src/services/database/backupManager.ts` & `src/services/database/db.ts`
   - `electron/main.ts` & IPC channels
2. Design the complete 6-phase migration pipeline:
   - Phase 1: Pre-flight snapshot backup. Invoke `BackupManager.createStoreBackup(storeId)` or IPC equivalent to ensure zero-loss fallback before touching cloud.
   - Phase 2: SQLite table extraction across all 19 local tables from `store_${safeId}.db` (schedules, shifts, employees, uop_crew, uz_crew, aop_plans, daily_kpi_logs, monthly_kpis, trainings, training_templates, settings, floor_rules, etc.).
   - Phase 3: Payload classification and packaging using `VaultService` (`packageFinancialVault`, `packagePersonnelVault`, `packageScheduleVault`, `packageHealthGdprVault`, `buildTelemetryStatus`).
   - Phase 4: Client-side AES-256-GCM encryption with AAD context binding `${storeId}:${vaultType}:${docId}`.
   - Phase 5: Cloud batch staging and upload to Firestore collections (`vault_financials`, `vault_personnel`, `vault_schedules`, `vault_health_gdpr`, `telemetry`).
   - Phase 6: Migration completion receipt generation and recording (`data/migration_receipt_${safeId}.json` or return value) with storeId, timestamp, recordCount, durationMs, and per-table summaries.
3. Design atomic rollback: if any phase fails (e.g. network timeout or encryption failure during batch upload), local SQLite database remains completely untouched and pre-flight backup is preserved.
4. Provide complete, drop-in TypeScript class and interface designs.

You are READ-ONLY. DO NOT edit source code files. Write your complete, detailed analysis and blueprints to `/Users/dawidapel/COL Tool/.agents/teamwork/m4_explorer_1/handoff.md`. Send a message to orchestrator when complete.
