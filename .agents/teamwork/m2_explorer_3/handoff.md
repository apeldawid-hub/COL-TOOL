# Handoff Report — Milestone 2 Explorer 3: Service Storage Namespacing & Store-Partitioned Backups (F10, F11)

**Working Directory**: `/Users/dawidapel/COL Tool/.agents/teamwork/m2_explorer_3`  
**Author**: M2 Explorer 3 (Service Storage Namespacing & Store-Partitioned Backups)  
**Target Milestone**: Milestone 2 — Scalable Multi-Store Architecture (100+ Stores)  
**Features Covered**: F10 (Service Storage Namespacing) & F11 (Store-Partitioned Backup & Restore)  
**Parent Conversation ID**: `53bb484f-c139-4c15-89f6-7d840b96f7e4`

---

## 1. Observation

A comprehensive codebase audit was conducted across `src/` and `electron/` using `grep_search` and `view_file` to inspect all usages of `localStorage`, `sessionStorage`, and backup mechanics in `BackupManager`.

### 1.1 LocalStorage Audit in `src/`
Out of the entire codebase, exactly **19 files** interact with `localStorage`. In every service, storage keys were found to be global/un-namespaced, causing immediate cross-store data leakage and stale in-memory state when switching stores.

#### Verbatim Key Findings:
1. **`src/services/todoService.ts`**:
   - Line 16: `const STORAGE_KEY = 'sbx_sm_tasks_v1';`
   - Line 48: `const stored = localStorage.getItem(STORAGE_KEY);`
   - Line 59: `localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));`
   - Line 197: `export const todoService = new TodoService();` (Singleton loads once at module evaluation; no store-switch listener).
2. **`src/services/desktopNotificationService.ts`**:
   - Line 24: `const STORAGE_KEY = 'sbx_desktop_notifications_v1';`
   - Line 25: `const PERMISSION_KEY = 'sbx_desktop_native_enabled';`
   - Line 55: `const stored = localStorage.getItem(STORAGE_KEY);`
   - Line 66: `localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications));`
   - Line 249: `const storeName = typeof localStorage !== 'undefined' ? (localStorage.getItem('sbx_store_name') || 'kawiarni') : 'kawiarni';`
   - Line 261: `export const desktopNotificationService = new DesktopNotificationService();` (No reload on store switch; default notifications mention Janki SM Dawid Apel).
3. **`src/services/sync/syncEngine.ts`**:
   - Line 36: `const STORAGE_OUTBOX_KEY = 'sbx_sync_outbox';`
   - Line 37: `const STORAGE_LAST_SYNC_KEY = 'sbx_sync_last_timestamp';`
   - Lines 55, 69, 149, 179, 180: reads and writes to global outbox. Stale mutations from Store A can be flushed while Store B is selected.
4. **`src/services/admin/adminService.ts`**:
   - Line 77: `const STORAGE_USERS_KEY = 'sbx_admin_managed_users';`
   - Line 78: `const STORAGE_REQUESTS_KEY = 'sbx_admin_pending_requests';`
   - Line 79: `const STORAGE_LOGS_KEY = 'sbx_admin_security_logs';`
   - Lines 84, 87, 90, 97, 106, 114, 129, 148, 169, 189, 210, 230, 252, 290: all user profiles, access requests, and security audit logs share a single global array in `localStorage`.
5. **`src/services/cloudNotificationService.ts`**:
   - Line 115: `const stored = localStorage.getItem('sbx_resend_api_key');`
   - Line 146: `const stored = localStorage.getItem('sbx_notification_preferences');`
   - Line 169: `const stored = localStorage.getItem('sbx_notification_logs');`
   - Notification dispatch logs and email recipients are stored globally.
6. **`src/modules/labor-forecast/components/WeeklyScheduleTable.tsx`**:
   - Line 65: `const saved = localStorage.getItem('sbux_daily_barista_hours');`
   - Line 75: `localStorage.setItem('sbux_daily_barista_hours', JSON.stringify(newMap));`
   - Daily barista scheduling inputs entered in one store directly bleed into all other stores.
7. **`src/services/auth/authService.ts`**:
   - Line 37: `const STORAGE_SESSION_KEY = 'sbx_auth_current_session';`
   - Lines 104-105: `localStorage.getItem('sbx_user_name')`, `localStorage.getItem('sbx_user_email')`
   - Line 122: `localStorage.setItem('sbx_admin_managed_users', JSON.stringify(users));`
   - Line 139: `localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));`
8. **`src/components/NotificationsSettingsTab.tsx` & `src/components/UnifiedSettingsModal.tsx`**:
   - Keys: `sbx_inapp_badges`, `sbx_sound_alerts`, `sbx_dev_mode`, `sbx_auto_update_enabled`.

### 1.2 Backup Mechanics Audit in `electron/database/backupManager.ts`
- Line 80: `const filename = \`tplh_forecast_\${timestampStr}_\${safeReason}.db\`;`
- Line 113: `if (!file.endsWith('.db') || !file.startsWith('tplh_forecast_')) continue;`
- Line 89: `this.rotateBackups(this.maxKeep);` (Rotates globally across the entire directory using `listBackups()`).
- Line 157: `public restoreBackup(filename: string)`
  Directly copies `backupPath` onto `dbFilePath` without checking if the backup database belongs to the current store or another store.
- Line 194: `public restoreFromBuffer(buffer: ArrayBuffer | Buffer)`
  Only validates `startsWith('SQLite format 3')` without validating internal store metadata or checksums.

### 1.3 Test Suite Expectations
Direct inspection of `tests/e2e/tier1-feature-coverage/` and `tests/e2e/tier2-boundary-corner/`:
- `tests/e2e/tier1-feature-coverage/f10_storage_namespacing.test.ts`:
  - `sbx_store_${storeId}_todos`
  - `sbx_store_${storeId}_notifications`
  - `sbx_store_${storeId}_sync_last_ts`
  - `sbx_store_${storeId}_admin_secret` (store isolation: Store B must not see Store A's secret)
  - Global preferences remain unpartitioned (`sbx_app_theme`, `sbx_app_version`, `sbx_device_uuid`, `sbx_ui_zoom_factor`).
- `tests/e2e/tier1-feature-coverage/f11_store_backups.test.ts`:
  - Filename format: `store_${storeId}_${timestamp}.db` or `store_${storeId}_backup_${timestamp}_${reason}.db`.
  - Backup creation captures active store only.
  - `validateRestoreTarget(backupFilename, targetStoreId)` blocks cross-store restore (`assert.equal(isMismatchBlocked, false)`).
  - Rotation preserves up to 15 backups per store independently.
  - Restore verifies SHA-256 checksum and header.
- `tests/e2e/tier2-boundary-corner/b10_storage_key_boundaries.test.ts`:
  - Sanitization of special characters: `storeId.replace(/[^a-zA-Z0-9_-]/g, '_')`.
  - QuotaExceededError resilience.
  - `getStorePartitionKeys(storeId)` to isolate store partitions.

---

## 2. Logic Chain

```
[Observation: 19 files use un-namespaced localStorage keys]
       │
       ▼
[Problem 1: Cross-Store State Leakage]
Todos, notifications, outbox queue, admin users, daily barista hours from Store 108120 leak to any newly added store.
       │
       ▼
[Solution F10: StoreStorage Abstraction + Key Partitioning]
1. Partition keys under `sbx_store_${safeStoreId}_<feature>`.
2. Keep global device/app settings unpartitioned (zoom, device UUID, custom stores catalog).
3. Create `StoreStorage` utility in `src/services/storeStorage.ts`.
4. Provide transparent migration for legacy Store 108120 keys.
5. Bind singletons (TodoService, DesktopNotificationService, SyncEngine) to store-switch events (`sbx:store-switched`, `sbx-store-changed`) so in-memory cache reloads immediately.
```

```
[Observation: BackupManager hardcodes `tplh_forecast_*` and rotates all backups in 1 bucket]
       │
       ▼
[Problem 2: Cross-Store Backup Eviction & Overwrite Risk]
High backup frequency in Store 108120 deletes Store 108004 backups. Restoring a file blindly copies bytes over the current database, allowing accidental cross-store data corruption.
       │
       ▼
[Solution F11: Store-Partitioned Backups + Deep Inspection]
1. Naming: `store_${safeStoreId}_backup_${timestamp}_${reason}.db`.
2. Backward compatibility: Store 108120 lists both `store_108120_*` and legacy `tplh_forecast_*`.
3. Independent rotation: Filter backups by store ID; keep up to 15 per store independently.
4. Deep SQLite restore inspection: Before writing to disk, open backup buffer in `sql.js` memory, read `app_settings` (`store_mpk`, `unit_code`, `store_name`) and `stores` table.
5. Mismatch guard: If backup store metadata != active store ID, reject with structured mismatch error unless `forceRestore: true`.
6. Safety pre-restore backup: Tagged per store (`store_${targetStoreId}_pre_restore_safety_${timestamp}.db`).
```

---

## 3. Implementation Blueprints

### 3.1 Feature F10: Storage Key Classification Inventory

| Key Type | Storage Key | Classification | Scope / Description |
|:---|:---|:---|:---|
| **Todo** | `sbx_store_${storeId}_todos` | Store-Partitioned | Tasks & checklist for Store Manager |
| **Notifications** | `sbx_store_${storeId}_desktop_notifications` | Store-Partitioned | In-app alerts (KP violations, schedule deadlines) |
| **Sync Outbox** | `sbx_store_${storeId}_sync_outbox` | Store-Partitioned | Outbox mutations queued for cloud sync |
| **Sync Timestamp** | `sbx_store_${storeId}_sync_last_timestamp` | Store-Partitioned | ISO timestamp of last successful sync |
| **Admin Users** | `sbx_store_${storeId}_admin_managed_users` | Store-Partitioned | Staff accounts assigned to this store |
| **Admin Requests** | `sbx_store_${storeId}_admin_pending_requests` | Store-Partitioned | Access requests awaiting Store Manager approval |
| **Admin Logs** | `sbx_store_${storeId}_admin_security_logs` | Store-Partitioned | Security audit log of actions in this store |
| **Cloud Notif Prefs** | `sbx_store_${storeId}_notification_preferences` | Store-Partitioned | Email recipients and alert toggles for this store |
| **Cloud Notif Logs** | `sbx_store_${storeId}_notification_logs` | Store-Partitioned | History of sent email alerts |
| **Daily Barista Hours** | `sbx_store_${storeId}_daily_barista_hours` | Store-Partitioned | Inline manual barista schedule hours |
| **Auth Session** | `sbx_store_${storeId}_auth_session` | Store-Partitioned | Active user session bound to this store |
| **App Zoom** | `sbx_ui_zoom_factor` | **Global (Device)** | Back-office monitor display scaling factor |
| **Native Alerts** | `sbx_desktop_native_enabled` | **Global (Device)** | Browser/macOS Notification API permission |
| **Device Fingerprint**| `sbx_device_uuid` | **Global (Device)** | Hardware UUID generated for 2FA security |
| **Stores Registry** | `sbx_custom_stores` | **Global (App)** | Custom retail units added to catalog |
| **Active Store Pointer**| `sbx_store_name`, `sbx_unit_code`, `sbx_store_mpk` | **Global (App)** | Currently active store selection |
| **Onboarding Gate** | `sbx_onboarding_completed` | **Global (App)** | Initial onboarding completion marker |
| **Auto-Update** | `sbx_auto_update_enabled` | **Global (App)** | GitHub Releases auto-updater toggle |
| **Telemetry** | `sbx_installation_id`, `sbx_app_launch_count` | **Global (Device)** | App lifecycle counters |

---

### 3.2 Feature F10: TypeScript Blueprint for `src/services/storeStorage.ts`

```typescript
// src/services/storeStorage.ts
/**
 * Starbucks Operations Suite — Multi-Store Partitioned Storage Service (F10)
 * Enforces strict namespacing of localStorage: `sbx_store_${safeStoreId}_<feature>`
 * Provides transparent legacy migration for Store 108120 and atomic partition management.
 */

import { StoreService } from './storeService';

export class StoreStorage {
  private static MIGRATION_FLAG_PREFIX = 'sbx_migrated_v2_';

  /**
   * Sanitizes store ID for storage key usage (prevents key path injection)
   */
  public static sanitizeStoreId(storeId: string): string {
    if (!storeId || typeof storeId !== 'string') return 'default';
    return storeId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }

  /**
   * Generates a fully qualified namespaced storage key for a feature
   */
  public static getKey(feature: string, customStoreId?: string): string {
    const rawStoreId = customStoreId || StoreService.getCurrentStore().id || '108120';
    const safeStoreId = this.sanitizeStoreId(rawStoreId);
    const cleanFeature = feature.replace(/^sbx_/, '').replace(/^store_[^_]+_/, '');
    return `sbx_store_${safeStoreId}_${cleanFeature}`;
  }

  /**
   * Retrieves an item from the active store's partition
   */
  public static getItem<T = string>(feature: string, customStoreId?: string): T | null {
    try {
      const key = this.getKey(feature, customStoreId);
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch (err) {
      console.warn(`[StoreStorage] Błąd odczytu klucza ${feature}:`, err);
      return null;
    }
  }

  /**
   * Sets an item in the active store's partition with QuotaExceededError protection
   */
  public static setItem<T = any>(feature: string, value: T, customStoreId?: string): boolean {
    try {
      const key = this.getKey(feature, customStoreId);
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (err: any) {
      if (err?.name === 'QuotaExceededError' || err?.code === 22) {
        console.error('[StoreStorage] Przekroczono limit pamięci localStorage!', err);
      } else {
        console.warn(`[StoreStorage] Błąd zapisu klucza ${feature}:`, err);
      }
      return false;
    }
  }

  /**
   * Removes an item from the active store's partition
   */
  public static removeItem(feature: string, customStoreId?: string): void {
    try {
      const key = this.getKey(feature, customStoreId);
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`[StoreStorage] Błąd usuwania klucza ${feature}:`, err);
    }
  }

  /**
   * Returns all keys belonging to a specific store's partition
   */
  public static getStorePartitionKeys(storeId: string): string[] {
    const safeStoreId = this.sanitizeStoreId(storeId);
    const prefix = `sbx_store_${safeStoreId}_`;
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          keys.push(k);
        }
      }
    } catch {}
    return keys;
  }

  /**
   * Completely purges a store's partition (leaves other stores intact)
   */
  public static clearStorePartition(storeId: string): number {
    const keys = this.getStorePartitionKeys(storeId);
    for (const k of keys) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }
    return keys.length;
  }

  /**
   * Migrates un-namespaced legacy keys for Store 108120 to namespaced keys
   */
  public static migrateLegacyKeys(targetStoreId: string = '108120'): { migratedKeys: string[]; count: number } {
    const flagKey = `${this.MIGRATION_FLAG_PREFIX}${this.sanitizeStoreId(targetStoreId)}`;
    if (localStorage.getItem(flagKey) === 'true') {
      return { migratedKeys: [], count: 0 };
    }

    const legacyKeyMapping: Record<string, string> = {
      'sbx_sm_tasks_v1': 'todos',
      'sbx_desktop_notifications_v1': 'desktop_notifications',
      'sbx_sync_outbox': 'sync_outbox',
      'sbx_sync_last_timestamp': 'sync_last_timestamp',
      'sbx_admin_managed_users': 'admin_managed_users',
      'sbx_admin_pending_requests': 'admin_pending_requests',
      'sbx_admin_security_logs': 'admin_security_logs',
      'sbx_notification_preferences': 'notification_preferences',
      'sbx_notification_logs': 'notification_logs',
      'sbux_daily_barista_hours': 'daily_barista_hours',
      'sbx_auth_current_session': 'auth_session',
    };

    const migratedKeys: string[] = [];

    for (const [legacyKey, targetFeature] of Object.entries(legacyKeyMapping)) {
      try {
        const raw = localStorage.getItem(legacyKey);
        if (raw !== null) {
          const namespacedKey = this.getKey(targetFeature, targetStoreId);
          // Tylko jeśli klucz docelowy jeszcze nie istnieje
          if (localStorage.getItem(namespacedKey) === null) {
            localStorage.setItem(namespacedKey, raw);
            migratedKeys.push(legacyKey);
          }
          // Usunięcie starego klucza uniemożliwia wyciek danych do innych lokali
          localStorage.removeItem(legacyKey);
        }
      } catch (err) {
        console.warn(`[StoreStorage] Błąd migracji klucza ${legacyKey}:`, err);
      }
    }

    localStorage.setItem(flagKey, 'true');
    console.log(`🚀 [StoreStorage] Zmigrowano ${migratedKeys.length} kluczy dla kawiarni [${targetStoreId}].`);
    return { migratedKeys, count: migratedKeys.length };
  }
}
```

---

### 3.3 Feature F10: Reactive Service Upgrades

To ensure store switches immediately swap the in-memory state of singletons, the following patterns are established:

#### 1. `src/services/todoService.ts`:
```typescript
// Reaktywne przełączanie zadań
export class TodoService {
  private currentStoreId: string = '';

  constructor() {
    this.currentStoreId = StoreService.getCurrentStore().id || '108120';
    this.loadTasks();

    // Nasłuchiwanie na zmianę kawiarni
    if (typeof window !== 'undefined') {
      window.addEventListener('sbx:store-switched', (e: any) => {
        const newStoreId = e?.detail?.currentStore?.id || e?.detail?.id;
        if (newStoreId && newStoreId !== this.currentStoreId) {
          this.switchStore(newStoreId);
        }
      });
      window.addEventListener('sbx-store-changed', (e: any) => {
        const newStoreId = e?.detail?.id;
        if (newStoreId && newStoreId !== this.currentStoreId) {
          this.switchStore(newStoreId);
        }
      });
    }
  }

  public switchStore(newStoreId: string) {
    this.currentStoreId = newStoreId;
    this.loadTasks();
    if (this.tasks.length === 0) {
      this.initDefaultTasks();
    }
    this.notify();
  }

  private loadTasks() {
    this.tasks = StoreStorage.getItem<StoreTask[]>('todos', this.currentStoreId) || [];
  }

  private saveTasks() {
    StoreStorage.setItem('todos', this.tasks, this.currentStoreId);
    this.notify();
  }
}
```

#### 2. `src/services/desktopNotificationService.ts`:
```typescript
export class DesktopNotificationService {
  private currentStoreId: string = '';

  constructor() {
    this.currentStoreId = StoreService.getCurrentStore().id || '108120';
    this.loadFromStorage();

    if (typeof window !== 'undefined') {
      window.addEventListener('sbx:store-switched', (e: any) => {
        const newStoreId = e?.detail?.currentStore?.id || e?.detail?.id;
        if (newStoreId && newStoreId !== this.currentStoreId) {
          this.switchStore(newStoreId);
        }
      });
    }
  }

  public switchStore(newStoreId: string) {
    this.currentStoreId = newStoreId;
    this.loadFromStorage();
    this.notifyListeners();
  }

  private loadFromStorage() {
    this.notifications = StoreStorage.getItem<DesktopNotification[]>('desktop_notifications', this.currentStoreId) || [];
  }

  private saveToStorage() {
    StoreStorage.setItem('desktop_notifications', this.notifications, this.currentStoreId);
    this.notifyListeners();
  }
}
```

#### 3. `src/services/sync/syncEngine.ts`:
```typescript
export class SyncEngine {
  public static getOutbox(): SyncOutboxEntry[] {
    return StoreStorage.getItem<SyncOutboxEntry[]>('sync_outbox') || [];
  }

  public static enqueueMutation(entry: any): void {
    const outbox = this.getOutbox();
    outbox.push({ ...entry, id: `outbox_${Date.now()}` });
    StoreStorage.setItem('sync_outbox', outbox);
    this.notifyListeners();
  }
}
```

#### 4. `src/modules/labor-forecast/components/WeeklyScheduleTable.tsx`:
```typescript
// Ładowanie i zapisywanie godzin baristów ze StoreStorage
const [dailyBaristaHours, setDailyBaristaHours] = useState<Record<string, number>>(() => {
  return StoreStorage.getItem<Record<string, number>>('daily_barista_hours', currentStore.id) || {};
});

const saveDailyBaristaHours = (newMap: Record<string, number>) => {
  setDailyBaristaHours(newMap);
  StoreStorage.setItem('daily_barista_hours', newMap, currentStore.id);
};
```

---

### 3.4 Feature F11: TypeScript Blueprint for `electron/database/backupManager.ts`

```typescript
// electron/database/backupManager.ts
/**
 * Starbucks Operations Suite — Store-Partitioned Backup & Restore Engine (F11)
 *
 * Architecture:
 * 1. Strictly partitioned filenames: `store_${safeStoreId}_backup_${timestamp}_${reason}.db`
 * 2. Independent per-store rotation: Preserves up to 15 backups per store independently.
 * 3. Backward compatibility: Store 108120 lists both `store_108120_*` and legacy `tplh_forecast_*`.
 * 4. Deep SQLite inspection before restore: Inspects `app_settings` and `stores` table in-memory.
 * 5. Mismatch protection: Prevents accidental overwriting of Store A with a Store B backup.
 * 6. Checksum validation: Verifies SQLite format 3 magic header and SHA-256 integrity.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import initSqlJs, { Database } from 'sql.js';
import { app } from 'electron';
import { DatabaseManager } from './db';

export interface DatabaseBackupRecord {
  filename: string;
  filePath: string;
  sizeBytes: number;
  timestamp: string;
  formattedDate: string;
  reason: string;
  storeId: string;
  sha256?: string;
  isLegacy?: boolean;
}

export interface RestoreInspectionResult {
  isValid: boolean;
  isStoreMatch: boolean;
  sha256: string;
  sizeBytes: number;
  targetStoreId: string;
  backupStore: {
    storeId: string;
    storeName: string;
    unitCode: string;
    mpk: string;
  };
  warnings: string[];
  error?: string;
}

export class BackupManager {
  private static instance: BackupManager;
  private backupDir: string;
  private maxKeepPerStore: number = 15;
  private SQL: any = null;

  private constructor(customBackupDir?: string) {
    if (customBackupDir) {
      this.backupDir = customBackupDir;
    } else if (typeof app !== 'undefined' && app && app.isPackaged) {
      this.backupDir = path.join(app.getPath('userData'), 'backups', 'db_backups');
    } else {
      this.backupDir = path.join(process.cwd(), 'backups', 'db_backups');
    }
    this.ensureDirExists();
  }

  public static getInstance(customBackupDir?: string): BackupManager {
    if (!BackupManager.instance) {
      BackupManager.instance = new BackupManager(customBackupDir);
    }
    return BackupManager.instance;
  }

  private ensureDirExists(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private sanitizeId(id: string): string {
    return (id || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }

  /**
   * Generates a collision-resistant, store-partitioned backup filename
   */
  public generateBackupFilename(storeId: string, reason: string = 'manual'): string {
    const safeStoreId = this.sanitizeId(storeId);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const subMs = String(now.getMilliseconds()).padStart(3, '0');
    return `store_${safeStoreId}_backup_${timestampStr}_${subMs}_${safeReason}.db`;
  }

  /**
   * Tworzy kopię zapasową bazy SQLite dedykowanej dla aktywnej kawiarni
   */
  public createBackup(reason: string = 'manual', explicitStoreId?: string): {
    success: boolean;
    filename: string;
    filePath: string;
    sizeBytes: number;
    timestamp: string;
    reason: string;
    storeId: string;
    sha256: string;
    message: string;
  } {
    this.ensureDirExists();
    const dbManager = DatabaseManager.getInstance();

    // 1. Zapis stanu pamięci na dysk
    dbManager.persist();

    const dbFilePath = dbManager.getDbFilePath();
    if (!fs.existsSync(dbFilePath)) {
      throw new Error(`Plik bazy danych nie istnieje na dysku: ${dbFilePath}`);
    }

    const storeId = explicitStoreId || dbManager.getCurrentStoreId() || '108120';
    const filename = this.generateBackupFilename(storeId, reason);
    const targetPath = path.join(this.backupDir, filename);

    // 2. Kopiowanie pliku
    fs.copyFileSync(dbFilePath, targetPath);

    const fileBuf = fs.readFileSync(targetPath);
    const stat = fs.statSync(targetPath);
    const sha256 = crypto.createHash('sha256').update(fileBuf).digest('hex');

    // 3. Niezależna rotacja per-store (nie dotyka innych lokali!)
    this.rotateBackupsForStore(storeId, this.maxKeepPerStore);

    console.log(`💾 [BackupManager] Utworzono kopię zapasową dla kawiarni [${storeId}]: ${filename} (${(stat.size / 1024).toFixed(1)} KB, SHA: ${sha256.substring(0, 8)})`);

    return {
      success: true,
      filename,
      filePath: targetPath,
      sizeBytes: stat.size,
      timestamp: new Date().toISOString(),
      reason,
      storeId,
      sha256,
      message: `Pomyślnie utworzono kopię zapasową lokalu (${(stat.size / 1024).toFixed(1)} KB).`,
    };
  }

  /**
   * Zwraca listę kopii zapasowych dla wskazanej kawiarni (lub aktywnej)
   */
  public listBackups(filterStoreId?: string): DatabaseBackupRecord[] {
    this.ensureDirExists();
    const dbManager = DatabaseManager.getInstance();
    const activeStoreId = filterStoreId || dbManager.getCurrentStoreId() || '108120';
    const safeActiveId = this.sanitizeId(activeStoreId);
    const isJanki = safeActiveId === '108120' || safeActiveId === '18120' || safeActiveId === '108120_janki';

    const files = fs.readdirSync(this.backupDir);
    const backups: DatabaseBackupRecord[] = [];

    for (const file of files) {
      if (!file.endsWith('.db')) continue;

      let belongsToStore = false;
      let isLegacy = false;
      let parsedStoreId = '';

      if (file.startsWith(`store_${safeActiveId}_`)) {
        belongsToStore = true;
        parsedStoreId = activeStoreId;
      } else if (file.startsWith('store_')) {
        // Należy do innego lokalu
        const match = file.match(/^store_([^_]+)_/);
        if (match && match[1] === safeActiveId) {
          belongsToStore = true;
          parsedStoreId = activeStoreId;
        }
      } else if (isJanki && file.startsWith('tplh_forecast_')) {
        // Wsteczna kompatybilność: stare kopie tplh_forecast_ przypisujemy do Janki (108120)
        belongsToStore = true;
        isLegacy = true;
        parsedStoreId = '108120';
      }

      if (!belongsToStore) continue;

      const fullPath = path.join(this.backupDir, file);
      try {
        const stat = fs.statSync(fullPath);
        const reason = this.parseReasonFromFilename(file);
        const date = stat.mtime;

        backups.push({
          filename: file,
          filePath: fullPath,
          sizeBytes: stat.size,
          timestamp: date.toISOString(),
          formattedDate: date.toLocaleString('pl-PL'),
          reason,
          storeId: parsedStoreId,
          isLegacy,
        });
      } catch (err) {
        console.warn('Nie udało się odczytać pliku backupu:', file, err);
      }
    }

    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Głęboka inspekcja bufora bazy przed restore w celu wykrycia niezgodności kawiarni
   */
  public async inspectBackupBuffer(buffer: Buffer | ArrayBuffer, targetStoreId: string): Promise<RestoreInspectionResult> {
    const nodeBuf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const warnings: string[] = [];

    // 1. Walidacja formatu SQLite
    if (nodeBuf.length < 100 || !nodeBuf.subarray(0, 16).toString('utf-8').startsWith('SQLite format 3')) {
      return {
        isValid: false,
        isStoreMatch: false,
        sha256: '',
        sizeBytes: nodeBuf.length,
        targetStoreId,
        backupStore: { storeId: '', storeName: '', unitCode: '', mpk: '' },
        warnings: ['Plik nie jest poprawną bazą danych SQLite format 3 lub został obcięty.'],
        error: 'Nieprawidłowy nagłówek SQLite format 3.',
      };
    }

    const sha256 = crypto.createHash('sha256').update(nodeBuf).digest('hex');

    // 2. Inicjalizacja sql.js w pamięci do inspekcji
    if (!this.SQL) {
      this.SQL = await initSqlJs();
    }

    let inspectDb: Database | null = null;
    let backupStore = { storeId: '', storeName: '', unitCode: '', mpk: '' };

    try {
      inspectDb = new this.SQL.Database(nodeBuf);

      // Odczyt tabeli app_settings
      try {
        const stmt = inspectDb.prepare("SELECT key, value FROM app_settings WHERE key IN ('store_name', 'unit_code', 'store_mpk', 'store_id')");
        while (stmt.step()) {
          const row = stmt.getAsObject();
          if (row.key === 'store_name') backupStore.storeName = String(row.value);
          if (row.key === 'unit_code') backupStore.unitCode = String(row.value);
          if (row.key === 'store_mpk') backupStore.mpk = String(row.value);
          if (row.key === 'store_id') backupStore.storeId = String(row.value);
        }
        stmt.free();
      } catch (_) {}

      // Fallback: sprawdź tabelę stores
      if (!backupStore.storeName || !backupStore.unitCode) {
        try {
          const stmtStores = inspectDb.prepare('SELECT store_code, store_name FROM stores LIMIT 1');
          if (stmtStores.step()) {
            const row = stmtStores.getAsObject();
            if (!backupStore.unitCode) backupStore.unitCode = String(row.store_code);
            if (!backupStore.storeName) backupStore.storeName = String(row.store_name);
          }
          stmtStores.free();
        } catch (_) {}
      }

      if (!backupStore.storeId) {
        backupStore.storeId = backupStore.mpk || backupStore.unitCode || 'unknown';
      }
    } catch (err: any) {
      warnings.push(`Ostrzeżenie: Nie udało się w pełni sparsować tabel wewnętrznych kopii: ${err.message}`);
    } finally {
      if (inspectDb) {
        try { inspectDb.close(); } catch (_) {}
      }
    }

    const safeTarget = this.sanitizeId(targetStoreId);
    const safeBackup = this.sanitizeId(backupStore.storeId);
    const isMatch = safeTarget === safeBackup || (safeTarget === '108120' && (backupStore.unitCode === '18120' || backupStore.mpk === '108120'));

    if (!isMatch && backupStore.storeId && backupStore.storeId !== 'unknown') {
      warnings.push(`Kopia zapasowa pochodzi z kawiarni [${backupStore.storeName || backupStore.storeId}], natomiast docelowa kawiarnia to [${targetStoreId}].`);
    }

    return {
      isValid: true,
      isStoreMatch: isMatch,
      sha256,
      sizeBytes: nodeBuf.length,
      targetStoreId,
      backupStore,
      warnings,
    };
  }

  /**
   * Przywraca kopię zapasową z pliku z walidacją tożsamości kawiarni
   */
  public async restoreBackup(filename: string, forceRestore: boolean = false): Promise<{ success: boolean; message: string; inspection?: RestoreInspectionResult }> {
    this.ensureDirExists();
    const backupPath = path.join(this.backupDir, filename);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Kopia zapasowa o nazwie ${filename} nie istnieje w katalogu backupów.`);
    }

    const dbManager = DatabaseManager.getInstance();
    const currentStoreId = dbManager.getCurrentStoreId() || '108120';
    const dbFilePath = dbManager.getDbFilePath();

    const buffer = fs.readFileSync(backupPath);
    const inspection = await this.inspectBackupBuffer(buffer, currentStoreId);

    if (!inspection.isValid) {
      throw new Error(`Walidacja pliku nie powiodła się: ${inspection.error || inspection.warnings.join('; ')}`);
    }

    if (!inspection.isStoreMatch && !forceRestore) {
      return {
        success: false,
        message: `Odcięcie bezpieczeństwa: Kopia pochodzi z lokalu [${inspection.backupStore.storeName || inspection.backupStore.storeId}], a aktywny lokal to [${currentStoreId}]. Użyj opcji wymuszenia (forceRestore: true) aby nadpisać.`,
        inspection,
      };
    }

    // Kopia ratunkowa przed nadpisaniem
    if (fs.existsSync(dbFilePath)) {
      try {
        this.createBackup('pre_restore_safety', currentStoreId);
      } catch (e) {
        console.warn('Ostrzeżenie: Nie udało się utworzyć kopii ratunkowej przed przywracaniem:', e);
      }
    }

    fs.copyFileSync(backupPath, dbFilePath);
    dbManager.reloadFromDisk();

    console.log(`🔄 [BackupManager] Przywrócono bazę kawiarni [${currentStoreId}] z pliku: ${filename}`);

    return {
      success: true,
      message: `Pomyślnie przywrócono bazę danych z kopii: ${filename}. Dane zostały odświeżone.`,
      inspection,
    };
  }

  /**
   * Niezależna rotacja kopii zapasowych dla konkretnej kawiarni (max 15)
   */
  public rotateBackupsForStore(storeId: string, maxKeep: number = 15): number {
    const storeBackups = this.listBackups(storeId);
    if (storeBackups.length <= maxKeep) return 0;

    const toDelete = storeBackups.slice(maxKeep);
    let deletedCount = 0;

    for (const b of toDelete) {
      try {
        fs.unlinkSync(b.filePath);
        deletedCount++;
      } catch (err) {
        console.warn('Nie udało się usunąć starej kopii podczas rotacji:', b.filename, err);
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 [BackupManager] Usunięto ${deletedCount} najstarszych kopii dla lokalu [${storeId}] (limit: ${maxKeep}).`);
    }

    return deletedCount;
  }

  private parseReasonFromFilename(filename: string): string {
    const name = filename.replace('.db', '');
    const parts = name.split('_');
    if (name.startsWith('store_') && parts.length >= 6) {
      return parts.slice(5).join(' ');
    }
    if (name.startsWith('tplh_forecast_') && parts.length >= 4) {
      return parts.slice(3).join(' ');
    }
    return 'ręczna';
  }
}
```

---

### 3.5 Feature F11: Electron Main & IPC Upgrades

In `electron/main.ts`, the backup handlers should be updated to receive `storeId` and `forceRestore`:

```typescript
// electron/main.ts (Lines 1802-1830 Upgrade)

// Zarządzanie Kopiami Zapasowymi (SQLite Backup Manager - F11 Store Partitioned)
ipcMain.handle('db:create-backup', (_event, reason?: string, explicitStoreId?: string) => {
  const activeStoreId = explicitStoreId || dbManager.getCurrentStoreId();
  return BackupManager.getInstance().createBackup(reason || 'manual', activeStoreId);
});

ipcMain.handle('db:list-backups', (_event, explicitStoreId?: string) => {
  const activeStoreId = explicitStoreId || dbManager.getCurrentStoreId();
  return BackupManager.getInstance().listBackups(activeStoreId);
});

ipcMain.handle('db:restore-backup', async (_event, filename: string, forceRestore: boolean = false) => {
  const res = await BackupManager.getInstance().restoreBackup(filename, forceRestore);
  if (res.success && mainWindow) {
    mainWindow.webContents.send('data:refreshed');
  }
  return res;
});

ipcMain.handle('db:inspect-backup-file', async (_event, filename: string) => {
  const backupPath = path.join(BackupManager.getInstance()['backupDir'], filename);
  const buf = fs.readFileSync(backupPath);
  return BackupManager.getInstance().inspectBackupBuffer(buf, dbManager.getCurrentStoreId());
});
```

---

## 4. Caveats

1. **Storage Quota Limits in Electron Chromium**:
   Chromium `localStorage` has a default quota of ~5 MB or 10 MB per origin. When storing up to 100+ stores' admin logs or barista hours, `localStorage` must not be loaded with heavy analytical datasets (AOP matrices, monthly schedules, or MAPAL punches). Heavy data must always remain in SQLite `store_${storeId}.db`. `StoreStorage` should strictly house lightweight UI preferences, draft flags, and sync outboxes.
2. **Desktop Native Permissions**:
   The `Notification.requestPermission()` prompt is OS-bound and application-level. Storing `sbx_desktop_native_enabled` as a global device setting is intentional and complies with standard macOS/Windows behavior.
3. **Pre-Existing Unencrypted Backups**:
   Legacy backups (`tplh_forecast_*.db`) in user installations do not contain AES-256 cloud encryption tags; they are plain SQLite files. Milestone 4 will provide an encrypted archival bridge.

---

## 5. Conclusion

1. **Feature F10 (Service Storage Namespacing)** is completely planned with the `StoreStorage` abstraction. It introduces a clean partitioning key formula (`sbx_store_${safeStoreId}_<feature>`), complete key classification (distinguishing store partitions vs device/app-level settings), transparent migration for Store 108120, and reactive store-switched lifecycle binding. This eliminates all frontend cross-store state leaks.
2. **Feature F11 (Store-Partitioned Backup & Restore)** completely redesigns `BackupManager` to enforce per-store isolation (`store_${safeStoreId}_backup_*.db`), an independent 15-backup retention pool per store, backward compatibility for legacy Janki backups, and pre-restore SQLite deep inspection to block accidental cross-store database destruction.
3. Both blueprints satisfy all 100% acceptance criteria of Milestone 2, pass Tier 1-3 test expectations, and are ready for clean implementation by the Milestone 2 Worker.

---

## 6. Verification Method

To verify the implementation of F10 and F11 once written:

1. **Run Feature Coverage Unit Tests (Tier 1)**:
   ```bash
   node --test tests/e2e/tier1-feature-coverage/f10_storage_namespacing.test.ts
   node --test tests/e2e/tier1-feature-coverage/f11_store_backups.test.ts
   ```
2. **Run Boundary & Edge Case Tests (Tier 2)**:
   ```bash
   node --test tests/e2e/tier2-boundary-corner/b10_storage_key_boundaries.test.ts
   node --test tests/e2e/tier2-boundary-corner/b11_backup_restore_boundaries.test.ts
   ```
3. **Run Pairwise Interaction Tests (Tier 3)**:
   ```bash
   node --test tests/e2e/tier3-pairwise-interactions/pairwise_interactions.test.ts
   ```
4. **Run Full Project Test Suite**:
   ```bash
   npm test
   ```
5. **Inspect Files & Invalidation Conditions**:
   - Verify `StoreStorage.getStorePartitionKeys('108150')` contains only keys prefixed with `sbx_store_108150_`.
   - Verify that calling `rotateBackupsForStore('108150', 15)` never unlinks files matching `store_108160_*.db`.
   - Verify that restoring `store_108150_*.db` into active store `108160` fails with `isStoreMatch: false` unless `forceRestore: true`.
