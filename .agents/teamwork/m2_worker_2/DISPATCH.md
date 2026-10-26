## 2026-10-24T07:01:10Z
You are M2 Worker 2 (Milestone 2 Remediation Worker).
Your working directory is: /Users/dawidapel/COL Tool/.agents/teamwork/m2_worker_2
Project root: /Users/dawidapel/COL Tool

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

READ FIRST:
- ORIGINAL_REQUEST.md: /Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/dawidapel/COL Tool/PROJECT.md
- Reviewer 1 Handoff: /Users/dawidapel/COL Tool/.agents/teamwork/m2_reviewer_1/handoff.md
- Auditor Handoff: /Users/dawidapel/COL Tool/.agents/teamwork/m2_auditor_1/handoff.md
- Explorer 1 Blueprint: /Users/dawidapel/COL Tool/.agents/teamwork/m2_retry_explorer_1/handoff.md
- Explorer 2 Blueprint: /Users/dawidapel/COL Tool/.agents/teamwork/m2_retry_explorer_2/handoff.md
- Explorer 3 Blueprint: /Users/dawidapel/COL Tool/.agents/teamwork/m2_retry_explorer_3/handoff.md

FILE WRITE OWNERSHIP:
You have exclusive write access to:
- `electron/database/db.ts`
- `electron/database/backupManager.ts`
- `electron/main.ts`
- `tests/e2e/tier5-adversarial/m2_stress_challenge.test.ts` (and helpers if needed)

TASK OBJECTIVES:
Apply the remediations designed by the 3 Retry Explorers to resolve all issues identified by Reviewer 1:

1. **`electron/database/db.ts` & `electron/database/backupManager.ts` (Headless Test Compatibility)**:
   - In both files, replace static `import { app } from 'electron';` with safe dynamic resolution so Node.js can import them outside Electron without `SyntaxError: The requested module 'electron' does not provide an export named 'app'`:
     ```ts
     let app: any;
     try {
       // eslint-disable-next-line @typescript-eslint/no-require-imports
       const electronModule = typeof require === 'function' ? require('electron') : undefined;
       app = (typeof electronModule === 'object' && electronModule !== null && 'app' in electronModule)
         ? electronModule.app
         : undefined;
     } catch {
       app = undefined;
     }
     ```
   - In `db.ts:442-445` (`migrateLegacyTplhDatabase`), scope backup directory to `customBackupDir || (this.storageDir !== path.join(process.cwd(), 'data') ? path.join(this.storageDir, 'backups', 'db_backups') : path.join(process.cwd(), 'backups', 'db_backups'))` to prevent test workspace pollution.

2. **`electron/database/backupManager.ts` (Store ID Regex & Multi-Part Underscore Support)**:
   - In `validateRestoreTarget` (lines 50 & 180) and `listBackupsForStore`:
     Use `backupFilename.match(/^store_(.+?)_backup_/)` with fallback to `^store_([^_]+)_` for legacy files, and normalize Janki aliases (`108120`, `18120`, `108120_janki`).
   - In `parseReasonFromFilename`:
     Use regex `^store_.+?_backup_\d{4}-\d{2}-\d{2}(?:_\d{2}-\d{2}-\d{2})?(?:_\d{3})?_(.+?)\.db$` instead of naive slicing by underscore, so reasons for store IDs like `108120_janki` or `wroclaw_glowny` are parsed cleanly.
   - Update `formatReason` mapping to cover all real Starbucks importer reasons.

3. **`electron/main.ts` (App Shutdown Persistence & Dirty Write Flush)**:
   - Add `flushAllStoreDatabases(reason)` calling both `dbManager.getConnectionPool().persistAll()` and `dbManager.persist()`.
   - Wire it into `app.on('window-all-closed')`, `app.on('before-quit')`, and `process.on('uncaughtException')`.
   - Add `app.on('will-quit')` calling `dbManager.getConnectionPool().closeAll()` when all windows are closed.
   - Add graceful signal handling for `SIGINT` and `SIGTERM`.

4. **Verification**:
   - Run `npm run build` — must exit 0 cleanly with zero TypeScript errors.
   - Run `npx tsx --test "tests/e2e/**/*.test.ts"` — must execute without syntax errors and all tests must pass 100%!
   - Document commands, exit codes, and test outputs in your handoff report.
