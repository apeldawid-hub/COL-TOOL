# ⚡ Samonaprawialny Rejestr Kontraktów IPC i Tabel SQLite
> **Plik generowany automatycznie przez `scripts/generate-contracts-doc.js`**  
> Ostatnia synchronizacja: `2026-11-06T23:09:05.167Z` (Zawsze zgodny ze stanem faktycznym w kodzie).

---

## 📡 1. Kontrakty Mostu IPC (`window.api.*` — `IElectronAPI`)
Łącznie wykrytych metod IPC w `electron/preload.ts`: **143**.

| Metoda IPC | Opcjonalna | Podpis Typu | Kategoria / Uwagi |
| :--- | :---: | :--- | :--- |
| `window.api.getAopPlan` | Nie | `(year: number, month: string) => Promise<any>` | — |
| `window.api.getAvailableYears` | Nie | `() => Promise<number[]>` | — |
| `window.api.getMonthsForYear` | Nie | `(year: number) => Promise<string[]>` | — |
| `window.api.getWeeksForMonth` | Nie | `(year: number, month: string) => Promise<any[]>` | — |
| `window.api.getActualHoursForMonth` | Nie | `(year: number, month: string) => Promise<Record<string, number>>` | — |
| `window.api.getWeeklyActualTrxMap` | Nie | `(year: number, month: string) => Promise<Record<string, number \| null>>` | — |
| `window.api.getDailyKpiActualsMap` | Tak | `(year: number, monthNum: number) => Promise<Record<string, { trx: number; salesNet: number; hours: number; tplh: number; agc: number; deliveryTrx: number }>>` | — |
| `window.api.getDailyActualHoursMap` | Tak | `(year: number, monthNum: number) => Promise<Record<string, number>>` | — |
| `window.api.saveWeeklyTrx` | Nie | `(weekKey: string, trx: number \| null) => Promise<boolean>` | — |
| `window.api.getWeeklyScheduledHoursMap` | Nie | `(year: number, month: string) => Promise<Record<string, number>>` | — |
| `window.api.saveWeeklyScheduledHours` | Nie | `(weekKey: string, hours: number \| null) => Promise<boolean>` | — |
| `window.api.getLaborRecords` | Nie | `(weekKey: string) => Promise<any[]>` | — |
| `window.api.getAopPlansForYear` | Nie | `(year: number) => Promise<any[]>` | — |
| `window.api.getAllHistoricalAopPlans` | Nie | `() => Promise<any[]>` | — |
| `window.api.saveAopPlan` | Nie | `(plan: any) => Promise<boolean>` | — |
| `window.api.saveYearlyAop` | Nie | `(plans: any[]) => Promise<boolean>` | — |
| `window.api.getFloorRules` | Nie | `() => Promise<any[]>` | — |
| `window.api.saveFloorRules` | Nie | `(rules: any[]) => Promise<boolean>` | — |
| `window.api.getNcRules` | Nie | `() => Promise<any[]>` | — |
| `window.api.saveNcRules` | Nie | `(rules: any[]) => Promise<boolean>` | — |
| `window.api.getDayOfWeekStats` | Nie | `() => Promise<any[]>` | — |
| `window.api.openFileDialog` | Nie | `() => Promise<string \| null>` | — |
| `window.api.importFichajesFile` | Nie | `(filePath: string) => Promise<{ success: boolean; importedCount: number; message: string; reportType?: string }>` | — |
| `window.api.importFichajesBuffer` | Nie | `(buffer: ArrayBuffer) => Promise<{ success: boolean; importedCount: number; message: string; reportType?: string }>` | — |
| `window.api.importReportFile` | Nie | `(filePath: string) => Promise<{ success: boolean; importedCount: number; message: string; reportType?: string; reportTypeName?: string }>` | — |
| `window.api.importReportBuffer` | Nie | `(buffer: ArrayBuffer) => Promise<{ success: boolean; importedCount: number; message: string; reportType?: string; reportTypeName?: string }>` | — |
| `window.api.parseReportFile` | Nie | `(filePath: string) => Promise<any>` | — |
| `window.api.parseReportBuffer` | Nie | `(buffer: ArrayBuffer) => Promise<any>` | — |
| `window.api.commitAopImport` | Nie | `(payload: { year: number; months: any[] }) => Promise<{ success: boolean; message: string; reportType: string; importedCount: number }>` | — |
| `window.api.commitMapalImport` | Nie | `(payload: { records: any[] }) => Promise<{ success: boolean; message: string; reportType: string; importedCount: number }>` | — |
| `window.api.commitScheduleImport` | Nie | `(payload: { scheduleData: any }) => Promise<{ success: boolean; message: string; reportType: string; importedCount: number }>` | — |
| `window.api.commitMultipleSchedulesImport` | Nie | `(payload: { schedules: any[] }) => Promise<{ success: boolean; message: string; reportType: string; totalMonths: number; totalShifts: number; totalEvents: number }>` | — |
| `window.api.commitDailyKpiImport` | Nie | `(payload: { dailyKpiData: any }) => Promise<{ success: boolean; message: string; reportType: string; importedCount: number }>` | — |
| `window.api.getSystemTime` | Nie | `() => Promise<{ iso: string; timestamp: string; hours: number; minutes: number; seconds: number; day: number; month: number; year: number }>` | — |
| `window.api.getAppSettings` | Nie | `() => Promise<{ settings: Record<string, string>; hasCompletedOnboarding: boolean; hasExistingData: boolean }>` | — |
| `window.api.saveAppSettings` | Nie | `(settings: Record<string, string>) => Promise<boolean>` | — |
| `window.api.switchStoreDatabase` | Tak | `(` | — |
| `window.api.storeIdOrPayload` | Nie | `string \| { storeId: string; storeInfo?: any },` | — |
| `window.api.storeInfo` | Tak | `any` | — |
| `window.api.getCurrentStoreDbInfo` | Tak | `() => Promise<{ storeId: string; dbFilePath: string }>` | — |
| `window.api.getCustomStores` | Tak | `() => Promise<any[]>` | — |
| `window.api.saveCustomStores` | Tak | `(stores: any[]) => Promise<boolean>` | — |
| `window.api.onRefreshData` | Nie | `(callback: () => void) => void` | — |
| `window.api.getManagerScheduleData` | Nie | `(year: number, month: number) => Promise<{` | Moduł 2: Managers Schedule |
| `window.api.employees` | Nie | `any[]` | — |
| `window.api.shiftDefinitions` | Nie | `any[]` | — |
| `window.api.shifts` | Nie | `any[]` | — |
| `window.api.events` | Nie | `any[]` | — |
| `window.api.monthlyNorm` | Tak | `any` | — |
| `window.api.boundaryShifts` | Tak | `any` | — |
| `window.api.rcpLogs` | Tak | `Record<number, Record<number, { hours: number; unitCode?: string; unitName?: string }>>` | — |
| `window.api.hasCompleteRcpLogs` | Tak | `boolean` | — |
| `window.api.saveManagerShift` | Nie | `(shift: any) => Promise<boolean>` | — |
| `window.api.saveBatchManagerShifts` | Nie | `(payload: { year: number; month: number; shifts: any[] }) => Promise<boolean>` | — |
| `window.api.saveManagerDisposition` | Nie | `(payload: { year: number; month: number; day: number; date: string; employee_id: number; disposition: string }) => Promise<boolean>` | — |
| `window.api.saveBatchManagerDispositions` | Nie | `(payload: { year: number; month: number; items: Array<{ day: number; employee_id: number; disposition: string; date?: string }> }) => Promise<boolean>` | — |
| `window.api.saveManagerEvent` | Nie | `(event: any) => Promise<boolean>` | — |
| `window.api.manageEmployees` | Nie | `(payload: any) => Promise<boolean>` | — |
| `window.api.saveManagerEmployees` | Tak | `(payload: any) => Promise<boolean>` | — |
| `window.api.copyRosterFromPreviousMonth` | Nie | `(year: number, month: number) => Promise<any[]>` | — |
| `window.api.getShiftDefinitions` | Nie | `() => Promise<any[]>` | — |
| `window.api.saveShiftDefinitions` | Nie | `(shifts: any[]) => Promise<boolean>` | — |
| `window.api.deleteShiftDefinition` | Nie | `(code: string) => Promise<boolean>` | — |
| `window.api.getScheduleVersions` | Nie | `(year: number, month: number) => Promise<any[]>` | — |
| `window.api.saveScheduleVersion` | Nie | `(payload: any) => Promise<boolean>` | — |
| `window.api.restoreScheduleVersion` | Nie | `(versionId: number) => Promise<boolean>` | — |
| `window.api.saveMonthlyNorm` | Nie | `(norm: any) => Promise<boolean>` | — |
| `window.api.resetMonthlyNorm` | Nie | `(year: number, month: number) => Promise<boolean>` | — |
| `window.api.getTorQuarterData` | Nie | `(year: number, quarter: number) => Promise<{` | — |
| `window.api.employees` | Nie | `any[]` | — |
| `window.api.shifts` | Nie | `any[]` | — |
| `window.api.monthlyNorms` | Nie | `Record<number, any>` | — |
| `window.api.months` | Nie | `number[]` | — |
| `window.api.actualRcpByMonth` | Tak | `Record<number, Record<number, number>>` | — |
| `window.api.hasActualRcpByMonth` | Tak | `Record<number, boolean>` | — |
| `window.api.createDatabaseBackup` | Nie | `(reason?: string, explicitStoreId?: string) => Promise<{ success: boolean; filename: string; filePath: string; sizeBytes: number; timestamp: string; reason: string; message: string; storeId?: string; sha256?: string }>` | Backupy bazy danych SQLite |
| `window.api.getDatabaseBackups` | Nie | `(filterStoreId?: string) => Promise<Array<{ filename: string; filePath: string; sizeBytes: number; timestamp: string; formattedDate: string; reason: string; storeId?: string; sha256?: string; isLegacy?: boolean }>>` | — |
| `window.api.restoreDatabaseBackup` | Nie | `(filename: string, forceRestore?: boolean) => Promise<{ success: boolean; message: string; inspection?: any }>` | — |
| `window.api.restoreDatabaseBackupBuffer` | Nie | `(buffer: ArrayBuffer, forceRestore?: boolean) => Promise<{ success: boolean; message: string; inspection?: any }>` | — |
| `window.api.getDatabaseStatus` | Nie | `(filterStoreId?: string) => Promise<{ dbPath: string; exists: boolean; sizeBytes: number; lastModified: string; backupsCount: number; latestBackup?: any }>` | — |
| `window.api.checkDatabaseHealth` | Nie | `() => Promise<any>` | — |
| `window.api.optimizeDatabase` | Nie | `() => Promise<any>` | — |
| `window.api.exportHistoricalPackage` | Nie | `(customTargetDir?: string) => Promise<{ success: boolean; message: string; details?: any }>` | Moduł Centrum Danych & Paczek Historycznych (Clean Slate & Import Hub) |
| `window.api.importHistoricalPackage` | Nie | `(customSourceDir?: string) => Promise<{ success: boolean; message: string; details?: any }>` | — |
| `window.api.resetToCleanSlate` | Nie | `() => Promise<{ success: boolean; message: string }>` | — |
| `window.api.getTrainingPartners` | Nie | `() => Promise<any[]>` | Moduł 3: Szkolenia (Starbucks Training Suite) |
| `window.api.saveTrainingPartner` | Nie | `(partner: any) => Promise<number>` | — |
| `window.api.deleteTrainingPartner` | Nie | `(id: number) => Promise<boolean>` | — |
| `window.api.getTrainingShifts` | Nie | `(partnerId?: number) => Promise<any[]>` | — |
| `window.api.saveTrainingShiftsBatch` | Nie | `(partnerId: number, shifts: any[]) => Promise<boolean>` | — |
| `window.api.updateTrainingShift` | Nie | `(shift: any) => Promise<boolean>` | — |
| `window.api.getTrainingSkillChecks` | Nie | `(partnerId?: number) => Promise<any[]>` | — |
| `window.api.saveTrainingSkillCheck` | Nie | `(check: any) => Promise<number>` | — |
| `window.api.getAppVersionInfo` | Nie | `() => Promise<{` | System Auto-Aktualizacji (electron-updater) |
| `window.api.version` | Nie | `string` | — |
| `window.api.electronVersion` | Nie | `string` | — |
| `window.api.chromeVersion` | Nie | `string` | — |
| `window.api.nodeVersion` | Nie | `string` | — |
| `window.api.platform` | Nie | `string` | — |
| `window.api.arch` | Nie | `string` | — |
| `window.api.isPackaged` | Nie | `boolean` | — |
| `window.api.checkForUpdates` | Nie | `() => Promise<{ success: boolean; isDev?: boolean; updateInfo?: any; error?: string; message?: string }>` | — |
| `window.api.downloadUpdate` | Nie | `() => Promise<{ success: boolean; error?: string }>` | — |
| `window.api.quitAndInstallUpdate` | Nie | `() => Promise<void>` | — |
| `window.api.getUpdateStatus` | Nie | `() => Promise<any>` | — |
| `window.api.onUpdaterEvent` | Nie | `(callback: (payload: any) => void) => () => void` | — |
| `window.api.openExternalUrl` | Nie | `(url: string) => Promise<boolean>` | — |
| `window.api.setZoomFactor` | Nie | `(factor: number) => boolean` | Skalowanie interfejsu (UI Zoom) |
| `window.api.getZoomFactor` | Nie | `() => number` | — |
| `window.api.logError` | Nie | `(payload: { level: 'DEBUG' \| 'INFO' \| 'WARN' \| 'ERROR' \| 'FATAL'; source: string; message: string; stack?: string; metadata?: any }) => Promise<boolean>` | System Diagnostyki, Czarnej Skrzynki i Zgłaszania Błędów |
| `window.api.getRecentLogs` | Nie | `(limit?: number) => Promise<any[]>` | — |
| `window.api.openLogsFolder` | Nie | `() => Promise<boolean>` | — |
| `window.api.saveBugReport` | Nie | `(payload: any) => Promise<{ success: boolean; filePath: string; reportId: string; message: string }>` | — |
| `window.api.exportDiagnosticPackage` | Nie | `(customTargetDir?: string) => Promise<{ success: boolean; filePath: string; message: string }>` | — |
| `window.api.submitGitHubIssue` | Nie | `(payload: any) => Promise<{ success: boolean; mode: 'api' \| 'browser'; issueUrl?: string; issueNumber?: number; message: string }>` | — |
| `window.api.cryptoIsSafeStorageAvailable` | Tak | `() => Promise<boolean>` | Feature F12: Bezpieczeństwo i szyfrowanie AES-256-GCM / safeStorage |
| `window.api.cryptoGetMasterPassphrase` | Tak | `() => Promise<string>` | — |
| `window.api.cryptoDeriveStoreKey` | Tak | `(storeId: string, unitCode: string) => Promise<string>` | — |
| `window.api.cryptoSafeStorageEncrypt` | Tak | `(plaintext: string) => Promise<{ success: boolean; data?: string; error?: string }>` | — |
| `window.api.cryptoSafeStorageDecrypt` | Tak | `(encryptedBase64: string) => Promise<{ success: boolean; data?: string; error?: string }>` | — |
| `window.api.cryptoZeroizeKeys` | Tak | `() => Promise<{ success: boolean; zeroizedCount: number }>` | — |
| `window.api.canPromptTouchID` | Tak | `() => Promise<boolean>` | Biometria Touch ID (macOS) |
| `window.api.promptTouchID` | Tak | `(reason?: string) => Promise<{ success: boolean; error?: string }>` | — |
| `window.api.executeStoreMigration` | Tak | `(options: any) => Promise<any>` | Feature F16 & F17: Zero-Data-Loss Local-to-Cloud Migration & Parity Verification |
| `window.api.verifyStoreParity` | Tak | `(storeId: string, options?: any) => Promise<any>` | — |
| `window.api.extractStoreTables` | Tak | `(storeId: string) => Promise<any>` | — |
| `window.api.getMigrationReceipt` | Tak | `(storeId: string) => Promise<any>` | — |
| `window.api.pullStoreData` | Tak | `(storeId: string, options?: any) => Promise<any>` | — |
| `window.api.getHardwareFingerprint` | Tak | `() => Promise<string>` | Milestone 1: Licensing & Hardware-Bound Activation Engine |
| `window.api.saveLicense` | Tak | `(payload: string) => Promise<boolean>` | — |
| `window.api.loadLicense` | Tak | `() => Promise<string \| null>` | — |
| `window.api.revokeLicense` | Tak | `() => Promise<boolean>` | — |
| `window.api.verifyMasterCredential` | Tak | `(credential: string) => Promise<any>` | Milestone 4: Feature F11 — Master Credential & Sliding-Window Rate Limiter |
| `window.api.getMasterCredentialStatus` | Tak | `() => Promise<any>` | — |
| `window.api.realtimePublishEvent` | Tak | `(input: any) => Promise<any>` | Feature F18: Real-time Cloud Transport Layer (Step 1 & Step 3) |
| `window.api.realtimePollOnce` | Tak | `(storeId: string) => Promise<any>` | — |
| `window.api.realtimeApplyInboundEvent` | Tak | `(event: any) => Promise<any>` | — |
| `window.api.createCloudSnapshot` | Tak | `(options: any) => Promise<any>` | Feature F19: Cloud Snapshots & 3-Tier Collision Guard |
| `window.api.listCloudSnapshots` | Tak | `(storeId: string) => Promise<any>` | — |
| `window.api.checkSnapshotCollisions` | Tak | `(storeId: string, snapshotCreatedAt: string) => Promise<any>` | — |
| `window.api.restoreCloudSnapshotSelective` | Tak | `(options: any) => Promise<any>` | — |
| `window.api.onStoreRestored` | Tak | `(callback: (event: any, data: any) => void) => void` | — |
| `window.api.removeStoreRestoredListener` | Tak | `(callback: (event: any, data: any) => void) => void` | — |

---

## 🗄️ 2. Schemat Tabel Bazy SQLite (`store_${safeId}.db`)
Łącznie wykrytych tabel w `electron/database/db.ts`: **19**.

### Tabela: `app_settings`
```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: `stores`
```sql
CREATE TABLE IF NOT EXISTS stores (
  store_code TEXT PRIMARY KEY,
  store_name TEXT NOT NULL,
  weekly_floor_hours REAL DEFAULT 272.0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: `aop_plans`
```sql
CREATE TABLE IF NOT EXISTS aop_plans (
  key TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  month TEXT NOT NULL,
  month_code TEXT NOT NULL,
  weeks_count INTEGER NOT NULL,
  plan_trx INTEGER NOT NULL,
  target_tplh REAL NOT NULL,
  labor_budget REAL NOT NULL,
  avg_weekly_hours REAL NOT NULL,
  plan_sales REAL,
  actual_sales REAL,
  actual_trx INTEGER,
  actual_tplh REAL,
  plan_agc REAL,
  actual_agc REAL,
  plan_col_pln REAL,
  plan_col_percent REAL,
  plan_cos_pln REAL,
  plan_cos_percent REAL,
  plan_ops_profit REAL
);
```

### Tabela: `calendar_weeks`
```sql
CREATE TABLE IF NOT EXISTS calendar_weeks (
  week_key TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  month_name TEXT NOT NULL,
  week_num_in_month TEXT NOT NULL,
  days_count INTEGER NOT NULL,
  week_type TEXT NOT NULL,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  floor_hours REAL NOT NULL,
  day_weight REAL NOT NULL
);
```

### Tabela: `labor_actuals_log`
```sql
CREATE TABLE IF NOT EXISTS labor_actuals_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  year INTEGER NOT NULL,
  month TEXT NOT NULL,
  week TEXT NOT NULL,
  week_key TEXT NOT NULL,
  day_of_week TEXT,
  employee TEXT NOT NULL,
  category TEXT,
  contract_type TEXT,
  computable_time REAL NOT NULL,
  unit_code TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: `weekly_actual_trx`
```sql
CREATE TABLE IF NOT EXISTS weekly_actual_trx (
  week_key TEXT PRIMARY KEY,
  actual_trx INTEGER,
  manual_hours_override REAL,
  scheduled_hours REAL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: `floor_rules`
```sql
CREATE TABLE IF NOT EXISTS floor_rules (
  day_id TEXT PRIMARY KEY,
  day_name TEXT NOT NULL,
  shifts_count INTEGER NOT NULL,
  hours_per_shift REAL NOT NULL,
  total_day_hours REAL NOT NULL
);
```

### Tabela: `nc_rules`
```sql
CREATE TABLE IF NOT EXISTS nc_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  monthly_hours REAL NOT NULL,
  is_mandatory INTEGER DEFAULT 1
);
```

### Tabela: `manager_employees`
```sql
CREATE TABLE IF NOT EXISTS manager_employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  contract_hours_ratio REAL NOT NULL,
  hourly_rate REAL DEFAULT 0.0,
  monthly_salary REAL DEFAULT 0.0,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: `shift_definitions`
```sql
CREATE TABLE IF NOT EXISTS shift_definitions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  hours REAL NOT NULL,
  is_nc INTEGER NOT NULL DEFAULT 0,
  is_absence INTEGER NOT NULL DEFAULT 0,
  color_bg TEXT,
  color_text TEXT,
  category TEXT DEFAULT 'coverage',
  is_sunday_only INTEGER DEFAULT 0
);
```

### Tabela: `manager_schedule_shifts`
```sql
CREATE TABLE IF NOT EXISTS manager_schedule_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  date TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  shift_code TEXT NOT NULL,
  hours REAL NOT NULL,
  notes TEXT,
  disposition TEXT DEFAULT '',
  custom_start_time TEXT,
  custom_end_time TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(year, month, day, employee_id)
);
```

### Tabela: `manager_schedule_events`
```sql
CREATE TABLE IF NOT EXISTS manager_schedule_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  day INTEGER NOT NULL,
  date TEXT NOT NULL,
  event_text TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(year, month, day)
);
```

### Tabela: `manager_schedule_versions`
```sql
CREATE TABLE IF NOT EXISTS manager_schedule_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  version_num INTEGER NOT NULL,
  version_type TEXT NOT NULL, -- 'draft' | 'published' | 'post_publication_edit',
  title TEXT NOT NULL,
  description TEXT,
  shifts_json TEXT NOT NULL,
  events_json TEXT,
  is_published INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: `manager_monthly_norms`
```sql
CREATE TABLE IF NOT EXISTS manager_monthly_norms (
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  working_days INTEGER NOT NULL,
  off_days INTEGER NOT NULL,
  full_time_hours REAL NOT NULL,
  is_custom INTEGER DEFAULT 0,
  notes TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(year, month)
);
```

### Tabela: `manager_monthly_roster`
```sql
CREATE TABLE IF NOT EXISTS manager_monthly_roster (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  contract_hours_ratio REAL NOT NULL,
  hourly_rate REAL DEFAULT 0.0,
  monthly_salary REAL DEFAULT 0.0,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(year, month, employee_id)
);
```

### Tabela: `training_partners`
```sql
CREATE TABLE IF NOT EXISTS training_partners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hire_date TEXT NOT NULL,
  current_program TEXT NOT NULL DEFAULT 'first_30',
  assigned_trainer_id INTEGER,
  assigned_trainer_name TEXT,
  store_manager_name TEXT DEFAULT 'Dawid Apel',
  sanepid_valid_until TEXT,
  bhp_completed_date TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: `training_shifts`
```sql
CREATE TABLE IF NOT EXISTS training_shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL,
  shift_code TEXT NOT NULL,
  title TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '08:00',
  end_time TEXT NOT NULL DEFAULT '12:00',
  barista_hours_t REAL NOT NULL DEFAULT 4.0,
  trainer_hours_t REAL NOT NULL DEFAULT 0.0,
  sm_hours_t REAL NOT NULL DEFAULT 0.0,
  status TEXT NOT NULL DEFAULT 'planned',
  trainer_name TEXT,
  station TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: `training_skill_checks`
```sql
CREATE TABLE IF NOT EXISTS training_skill_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  partner_id INTEGER NOT NULL,
  check_type TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  examiner_name TEXT NOT NULL,
  examiner_role TEXT NOT NULL DEFAULT 'SM',
  is_passed INTEGER NOT NULL DEFAULT 1,
  score_pct REAL DEFAULT 100.0,
  criteria_results TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela: `daily_kpi_actuals_log`
```sql
CREATE TABLE IF NOT EXISTS daily_kpi_actuals_log (
  date TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  month_name TEXT NOT NULL,
  day_of_month INTEGER NOT NULL,
  day_label TEXT,
  week_key TEXT,
  sales_net REAL NOT NULL,
  trx INTEGER NOT NULL,
  agc REAL NOT NULL,
  hours REAL NOT NULL,
  tplh REAL NOT NULL,
  delivery_trx INTEGER DEFAULT 0,
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

