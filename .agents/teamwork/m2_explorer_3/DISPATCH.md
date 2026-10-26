# DISPATCH — Milestone 2 Explorer 3: Service Storage Namespacing & Store-Partitioned Backups (F10, F11)

## Mission
Investigate and design exact implementation blueprints for Features F10 and F11:
1. **F10 (Service Storage Namespacing)**:
   - Inspect all services utilizing `localStorage`:
     * `src/services/todoService.ts`
     * `src/services/desktopNotificationService.ts`
     * `src/services/syncEngine.ts`
     * `src/services/adminService.ts`
     * Any other services storing user preferences or draft states.
   - Enforce partitioning of keys using the convention `sbx_store_${storeId}_<feature>` (e.g., `sbx_store_108120_todos`, `sbx_store_108120_notifications_config`).
   - Implement transparent migration of legacy un-namespaced keys for Store 108120 to namespaced keys.
   - Ensure switching stores switches the effective storage scope immediately.
2. **F11 (Store-Partitioned Backup & Restore)**:
   - Inspect `electron/database/backupManager.ts` and `electron/main.ts` backup handlers.
   - Ensure backups are strictly named and partitioned per-store (`store_${storeId}_backup_${timestamp}.db`).
   - Implement restore validation: When restoring a backup file, inspect the target store metadata inside the backup to ensure the user cannot accidentally restore a Store A backup into Store B's database file without explicit warning/confirmation.
   - Ensure backup rotation (keeping up to 15 backups) is enforced independently per store.

## Reference Documents
- `/Users/dawidapel/COL Tool/.agents/teamwork/ORIGINAL_REQUEST.md` (MUST read first)
- `/Users/dawidapel/COL Tool/PROJECT.md`
- `/Users/dawidapel/COL Tool/electron/database/backupManager.ts`
- `/Users/dawidapel/COL Tool/src/services/`

## Deliverables
Write `/Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_3/handoff.md` with:
- Audit of all unpartitioned `localStorage` keys across `src/services/`
- Migration strategy and utility functions for namespaced storage access
- Exact code blueprint for store-isolated backups and restore validation in `backupManager.ts`


## 2026-10-24T02:48:24Z
Received activation dispatch:
Investigate src/services/ (Todo, Notification, SyncEngine, Admin) and electron/database/backupManager.ts. Design the exact implementation blueprint for Features F10 and F11:
- Namespacing localStorage by `sbx_store_${storeId}_*` and legacy key migration.
- Store-isolated backups (`store_${storeId}_*.db`) and restore validation.
Write your findings and code blueprints to /Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_3/handoff.md. Then notify parent via send_message.
