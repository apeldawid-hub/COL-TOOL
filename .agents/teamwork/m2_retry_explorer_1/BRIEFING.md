# BRIEFING — 2026-10-24T06:58:00Z

## Mission
Investigate and design a clean, robust solution for importing `electron/database/db.ts` across both packaged Electron (Vite bundled) and standalone Node.js (`npx tsx --test`) environments, fix `migrateLegacyTplhDatabase` backupDir resolution, and produce copy-pasteable blueprints for `db.ts` and `m2_stress_challenge.test.ts`.

## 🔒 My Identity
- Archetype: explorer
- Roles: Teamwork explorer (Read-only investigation & synthesis)
- Working directory: /Users/dawidapel/COL Tool/.agents/teamwork/m2_retry_explorer_1
- Original parent: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Milestone: M2 Retry Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / edit source code directly
- Must check ORIGINAL_REQUEST.md, PROJECT.md, Reviewer 1 Handoff, Auditor Handoff
- Investigate `import { app } from 'electron'` vs standalone Node/tsx
- Investigate `db.ts` storageDir & backupDir in `migrateLegacyTplhDatabase`
- Provide complete copy-pasteable blueprint for `db.ts` and `m2_stress_challenge.test.ts`

## Current Parent
- Conversation ID: 53bb484f-c139-4c15-89f6-7d840b96f7e4
- Updated: 2026-10-24T06:58:00Z

## Investigation State
- **Explored paths**:
  - `electron/database/db.ts`
  - `electron/database/backupManager.ts`
  - `electron/main.ts`
  - `tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts`
  - `tests/e2e/tier5-adversarial/m2_challenger_concurrency_stress.test.ts`
  - `vite.config.ts`, `tsconfig.json`, `package.json`
- **Key findings**:
  1. Static `import { app } from 'electron'` in `db.ts:5` and `backupManager.ts:5` throws uncatchable instantiation `SyntaxError: The requested module 'electron' does not provide an export named 'app'` when executed via `tsx` because outside Electron, `node_modules/electron/index.js` exports a binary path string.
  2. In both files, all usages of `app` already use defensive checks: `typeof app !== 'undefined' && app && app.isPackaged` and `app?.getPath ? app.getPath('userData') : process.cwd()`. Replacing the static import with safe dynamic resolution `const electronModule = typeof require === 'function' ? require('electron') : undefined; app = (typeof electronModule === 'object' && electronModule !== null && 'app' in electronModule) ? electronModule.app : undefined;` makes `app === undefined` in standalone Node/tsx without error, while resolving to the true `app` instance in Electron runtime.
  3. `DatabaseManager.migrateLegacyTplhDatabase` hardcodes `path.join(process.cwd(), 'backups', 'db_backups')` instead of scoping to `this.storageDir`. When executed in unit/adversarial tests with custom temp dirs (`tmpStorageDir`), backups leaked into the git workspace `backups/db_backups/`. Scoping `backupDir` to `customBackupDir || (this.storageDir !== path.join(process.cwd(), 'data') ? path.join(this.storageDir, 'backups', 'db_backups') : ...)` isolates test backups inside the disposable temporary directory.
  4. `validateRestoreTarget` regex in `backupManager.ts:50` and line 180 stops at the first underscore (`^store_([^_]+)_`), breaking for store IDs with underscores (`108120_janki`, `wroclaw_glowny`). Changing to `^store_(.+?)_backup_` fixes restore target matching.
  5. `BackupManager.parseReasonFromFilename` corrupts reason for multi-part store IDs; regex matching resolves it cleanly.
  6. `electron/main.ts:1980` lacks `dbManager.getConnectionPool().persistAll()` on `before-quit`.
- **Unexplored areas**: None for M2 database / test runner scope.

## Key Decisions Made
- Confirmed dynamic resolution pattern compiles cleanly with `tsc` and Vite, and passes `tsx --test`.
- Prepared exact line-numbered blueprints for `db.ts`, `backupManager.ts`, `main.ts`, and `m2_stress_challenge.test.ts`.

## Artifact Index
- DISPATCH.md — Initial dispatch message
- BRIEFING.md — Persistent context & state
- progress.md — Liveness heartbeat & progress log
- handoff.md — 5-component final handoff report
