import { contextBridge, ipcRenderer, webFrame } from 'electron';

export interface IElectronAPI {
  getAopPlan: (year: number, month: string) => Promise<any>;
  getAvailableYears: () => Promise<number[]>;
  getMonthsForYear: (year: number) => Promise<string[]>;
  getWeeksForMonth: (year: number, month: string) => Promise<any[]>;
  getActualHoursForMonth: (year: number, month: string) => Promise<Record<string, number>>;
  getWeeklyActualTrxMap: (year: number, month: string) => Promise<Record<string, number | null>>;
  getDailyKpiActualsMap?: (year: number, monthNum: number) => Promise<Record<string, { trx: number; salesNet: number; hours: number; tplh: number; agc: number; deliveryTrx: number }>>;
  getDailyActualHoursMap?: (year: number, monthNum: number) => Promise<Record<string, number>>;
  saveWeeklyTrx: (weekKey: string, trx: number | null) => Promise<boolean>;
  getWeeklyScheduledHoursMap: (year: number, month: string) => Promise<Record<string, number>>;
  saveWeeklyScheduledHours: (weekKey: string, hours: number | null) => Promise<boolean>;
  getLaborRecords: (weekKey: string) => Promise<any[]>;
  getAopPlansForYear: (year: number) => Promise<any[]>;
  getAllHistoricalAopPlans: () => Promise<any[]>;
  saveAopPlan: (plan: any) => Promise<boolean>;
  saveYearlyAop: (plans: any[]) => Promise<boolean>;
  getFloorRules: () => Promise<any[]>;
  saveFloorRules: (rules: any[]) => Promise<boolean>;
  getNcRules: () => Promise<any[]>;
  saveNcRules: (rules: any[]) => Promise<boolean>;
  getDayOfWeekStats: () => Promise<any[]>;
  openFileDialog: () => Promise<string | null>;
  importFichajesFile: (filePath: string) => Promise<{ success: boolean; importedCount: number; message: string; reportType?: string }>;
  importFichajesBuffer: (buffer: ArrayBuffer) => Promise<{ success: boolean; importedCount: number; message: string; reportType?: string }>;
  importReportFile: (filePath: string) => Promise<{ success: boolean; importedCount: number; message: string; reportType?: string; reportTypeName?: string }>;
  importReportBuffer: (buffer: ArrayBuffer) => Promise<{ success: boolean; importedCount: number; message: string; reportType?: string; reportTypeName?: string }>;
  parseReportFile: (filePath: string) => Promise<any>;
  parseReportBuffer: (buffer: ArrayBuffer) => Promise<any>;
  commitAopImport: (payload: { year: number; months: any[] }) => Promise<{ success: boolean; message: string; reportType: string; importedCount: number }>;
  commitMapalImport: (payload: { records: any[] }) => Promise<{ success: boolean; message: string; reportType: string; importedCount: number }>;
  commitScheduleImport: (payload: { scheduleData: any }) => Promise<{ success: boolean; message: string; reportType: string; importedCount: number }>;
  commitMultipleSchedulesImport: (payload: { schedules: any[] }) => Promise<{ success: boolean; message: string; reportType: string; totalMonths: number; totalShifts: number; totalEvents: number }>;
  commitDailyKpiImport: (payload: { dailyKpiData: any }) => Promise<{ success: boolean; message: string; reportType: string; importedCount: number }>;
  getSystemTime: () => Promise<{ iso: string; timestamp: string; hours: number; minutes: number; seconds: number; day: number; month: number; year: number }>;
  getAppSettings: () => Promise<{ settings: Record<string, string>; hasCompletedOnboarding: boolean; hasExistingData: boolean }>;
  saveAppSettings: (settings: Record<string, string>) => Promise<boolean>;
  switchStoreDatabase?: (
    storeIdOrPayload: string | { storeId: string; storeInfo?: any },
    storeInfo?: any
  ) => Promise<{ success: boolean; isNew: boolean; dbPath: string; storeId: string }>;
  getCurrentStoreDbInfo?: () => Promise<{ storeId: string; dbFilePath: string }>;
  getCustomStores?: () => Promise<any[]>;
  saveCustomStores?: (stores: any[]) => Promise<boolean>;
  onRefreshData: (callback: () => void) => void;
  // Moduł 2: Managers Schedule
  getManagerScheduleData: (year: number, month: number) => Promise<{
    employees: any[];
    shiftDefinitions: any[];
    shifts: any[];
    events: any[];
    monthlyNorm?: any;
    boundaryShifts?: any;
    rcpLogs?: Record<number, Record<number, { hours: number; unitCode?: string; unitName?: string }>>;
    hasCompleteRcpLogs?: boolean;
  }>;
  saveManagerShift: (shift: any) => Promise<boolean>;
  saveBatchManagerShifts: (payload: { year: number; month: number; shifts: any[] }) => Promise<boolean>;
  saveManagerDisposition: (payload: { year: number; month: number; day: number; date: string; employee_id: number; disposition: string }) => Promise<boolean>;
  saveBatchManagerDispositions: (payload: { year: number; month: number; items: Array<{ day: number; employee_id: number; disposition: string; date?: string }> }) => Promise<boolean>;
  saveManagerEvent: (event: any) => Promise<boolean>;
  manageEmployees: (payload: any) => Promise<boolean>;
  saveManagerEmployees?: (payload: any) => Promise<boolean>;
  copyRosterFromPreviousMonth: (year: number, month: number) => Promise<any[]>;
  getShiftDefinitions: () => Promise<any[]>;
  saveShiftDefinitions: (shifts: any[]) => Promise<boolean>;
  deleteShiftDefinition: (code: string) => Promise<boolean>;
  getScheduleVersions: (year: number, month: number) => Promise<any[]>;
  saveScheduleVersion: (payload: any) => Promise<boolean>;
  restoreScheduleVersion: (versionId: number) => Promise<boolean>;
  saveMonthlyNorm: (norm: any) => Promise<boolean>;
  resetMonthlyNorm: (year: number, month: number) => Promise<boolean>;
  getTorQuarterData: (year: number, quarter: number) => Promise<{
    employees: any[];
    shifts: any[];
    monthlyNorms: Record<number, any>;
    months: number[];
    actualRcpByMonth?: Record<number, Record<number, number>>;
    hasActualRcpByMonth?: Record<number, boolean>;
  }>;
  // Backupy bazy danych SQLite
  createDatabaseBackup: (reason?: string, explicitStoreId?: string) => Promise<{ success: boolean; filename: string; filePath: string; sizeBytes: number; timestamp: string; reason: string; message: string; storeId?: string; sha256?: string }>;
  getDatabaseBackups: (filterStoreId?: string) => Promise<Array<{ filename: string; filePath: string; sizeBytes: number; timestamp: string; formattedDate: string; reason: string; storeId?: string; sha256?: string; isLegacy?: boolean }>>;
  restoreDatabaseBackup: (filename: string, forceRestore?: boolean) => Promise<{ success: boolean; message: string; inspection?: any }>;
  restoreDatabaseBackupBuffer: (buffer: ArrayBuffer, forceRestore?: boolean) => Promise<{ success: boolean; message: string; inspection?: any }>;
  getDatabaseStatus: (filterStoreId?: string) => Promise<{ dbPath: string; exists: boolean; sizeBytes: number; lastModified: string; backupsCount: number; latestBackup?: any }>;
  checkDatabaseHealth: () => Promise<any>;
  optimizeDatabase: () => Promise<any>;
  // Moduł Centrum Danych & Paczek Historycznych (Clean Slate & Import Hub)
  exportHistoricalPackage: (customTargetDir?: string) => Promise<{ success: boolean; message: string; details?: any }>;
  importHistoricalPackage: (customSourceDir?: string) => Promise<{ success: boolean; message: string; details?: any }>;
  resetToCleanSlate: () => Promise<{ success: boolean; message: string }>;
  // Moduł 3: Szkolenia (Starbucks Training Suite)
  getTrainingPartners: () => Promise<any[]>;
  saveTrainingPartner: (partner: any) => Promise<number>;
  deleteTrainingPartner: (id: number) => Promise<boolean>;
  getTrainingShifts: (partnerId?: number) => Promise<any[]>;
  saveTrainingShiftsBatch: (partnerId: number, shifts: any[]) => Promise<boolean>;
  updateTrainingShift: (shift: any) => Promise<boolean>;
  getTrainingSkillChecks: (partnerId?: number) => Promise<any[]>;
  saveTrainingSkillCheck: (check: any) => Promise<number>;
  // System Auto-Aktualizacji (electron-updater)
  getAppVersionInfo: () => Promise<{
    version: string;
    electronVersion: string;
    chromeVersion: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    isPackaged: boolean;
  }>;
  checkForUpdates: () => Promise<{ success: boolean; isDev?: boolean; updateInfo?: any; error?: string; message?: string }>;
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
  quitAndInstallUpdate: () => Promise<void>;
  getUpdateStatus: () => Promise<any>;
  onUpdaterEvent: (callback: (payload: any) => void) => () => void;
  openExternalUrl: (url: string) => Promise<boolean>;
  // Skalowanie interfejsu (UI Zoom)
  setZoomFactor: (factor: number) => boolean;
  getZoomFactor: () => number;
  // System Diagnostyki, Czarnej Skrzynki i Zgłaszania Błędów
  logError: (payload: { level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'; source: string; message: string; stack?: string; metadata?: any }) => Promise<boolean>;
  getRecentLogs: (limit?: number) => Promise<any[]>;
  openLogsFolder: () => Promise<boolean>;
  saveBugReport: (payload: any) => Promise<{ success: boolean; filePath: string; reportId: string; message: string }>;
  exportDiagnosticPackage: (customTargetDir?: string) => Promise<{ success: boolean; filePath: string; message: string }>;
  submitGitHubIssue: (payload: any) => Promise<{ success: boolean; mode: 'api' | 'browser'; issueUrl?: string; issueNumber?: number; message: string }>;
  // Feature F12: Bezpieczeństwo i szyfrowanie AES-256-GCM / safeStorage
  cryptoIsSafeStorageAvailable?: () => Promise<boolean>;
  cryptoGetMasterPassphrase?: () => Promise<string>;
  cryptoDeriveStoreKey?: (storeId: string, unitCode: string) => Promise<string>;
  cryptoSafeStorageEncrypt?: (plaintext: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  cryptoSafeStorageDecrypt?: (encryptedBase64: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  // Feature F16 & F17: Zero-Data-Loss Local-to-Cloud Migration & Parity Verification
  executeStoreMigration?: (options: any) => Promise<any>;
  verifyStoreParity?: (storeId: string, options?: any) => Promise<any>;
  extractStoreTables?: (storeId: string) => Promise<any>;
  getMigrationReceipt?: (storeId: string) => Promise<any>;
}

const api: IElectronAPI = {
  getAopPlan: (year, month) => ipcRenderer.invoke('db:get-aop-plan', year, month),
  getAvailableYears: () => ipcRenderer.invoke('db:get-available-years'),
  getMonthsForYear: (year) => ipcRenderer.invoke('db:get-months-for-year', year),
  getWeeksForMonth: (year, month) => ipcRenderer.invoke('db:get-weeks-for-month', year, month),
  getActualHoursForMonth: (year, month) => ipcRenderer.invoke('db:get-actual-hours-for-month', year, month),
  getWeeklyActualTrxMap: (year, month) => ipcRenderer.invoke('db:get-weekly-actual-trx-map', year, month),
  getDailyKpiActualsMap: (year, monthNum) => ipcRenderer.invoke('db:get-daily-kpi-actuals-map', year, monthNum),
  getDailyActualHoursMap: (year, monthNum) => ipcRenderer.invoke('db:get-daily-actual-hours-map', year, monthNum),
  saveWeeklyTrx: (weekKey, trx) => ipcRenderer.invoke('db:save-weekly-trx', weekKey, trx),
  getWeeklyScheduledHoursMap: (year, month) => ipcRenderer.invoke('db:get-weekly-scheduled-hours-map', year, month),
  saveWeeklyScheduledHours: (weekKey, hours) => ipcRenderer.invoke('db:save-weekly-scheduled-hours', weekKey, hours),
  getLaborRecords: (weekKey) => ipcRenderer.invoke('db:get-labor-records', weekKey),
  getAopPlansForYear: (year) => ipcRenderer.invoke('db:get-aop-plans-for-year', year),
  getAllHistoricalAopPlans: () => ipcRenderer.invoke('db:get-all-historical-aop-plans'),
  saveAopPlan: (plan) => ipcRenderer.invoke('db:save-aop-plan', plan),
  saveYearlyAop: (plans) => ipcRenderer.invoke('db:save-yearly-aop', plans),
  getFloorRules: () => ipcRenderer.invoke('db:get-floor-rules'),
  saveFloorRules: (rules) => ipcRenderer.invoke('db:save-floor-rules', rules),
  getNcRules: () => ipcRenderer.invoke('db:get-nc-rules'),
  saveNcRules: (rules) => ipcRenderer.invoke('db:save-nc-rules', rules),
  getDayOfWeekStats: () => ipcRenderer.invoke('db:get-day-of-week-stats'),
  openFileDialog: () => ipcRenderer.invoke('dialog:open-file'),
  importFichajesFile: (filePath) => ipcRenderer.invoke('import:report-file', filePath),
  importFichajesBuffer: (buffer) => ipcRenderer.invoke('import:report-buffer', buffer),
  importReportFile: (filePath) => ipcRenderer.invoke('import:report-file', filePath),
  importReportBuffer: (buffer) => ipcRenderer.invoke('import:report-buffer', buffer),
  parseReportFile: (filePath) => ipcRenderer.invoke('import:parse-report-file', filePath),
  parseReportBuffer: (buffer) => ipcRenderer.invoke('import:parse-report-buffer', buffer),
  commitAopImport: (payload) => ipcRenderer.invoke('import:commit-aop', payload),
  commitMapalImport: (payload) => ipcRenderer.invoke('import:commit-mapal', payload),
  commitScheduleImport: (payload) => ipcRenderer.invoke('import:commit-schedule', payload),
  commitMultipleSchedulesImport: (payload) => ipcRenderer.invoke('import:commit-multiple-schedules', payload),
  commitDailyKpiImport: (payload) => ipcRenderer.invoke('import:commit-daily-kpi', payload),
  getSystemTime: () => ipcRenderer.invoke('system:get-time'),
  getAppSettings: () => ipcRenderer.invoke('app:get-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('app:save-settings', settings),
  onRefreshData: (callback) => {
    ipcRenderer.on('data:refreshed', () => callback());
  },
  // Moduł 2: Managers Schedule
  getManagerScheduleData: (year, month) => ipcRenderer.invoke('db:get-manager-schedule-data', year, month),
  saveManagerShift: (shift) => ipcRenderer.invoke('db:save-manager-shift', shift),
  saveBatchManagerShifts: (payload) => ipcRenderer.invoke('db:save-batch-manager-shifts', payload),
  saveManagerDisposition: (payload) => ipcRenderer.invoke('db:save-manager-disposition', payload),
  saveBatchManagerDispositions: (payload) => ipcRenderer.invoke('db:save-batch-manager-dispositions', payload),
  saveManagerEvent: (event) => ipcRenderer.invoke('db:save-manager-event', event),
  manageEmployees: (payload) => ipcRenderer.invoke('db:manage-employees', payload),
  saveManagerEmployees: (payload) => ipcRenderer.invoke('db:manage-employees', payload),
  copyRosterFromPreviousMonth: (year: number, month: number) => ipcRenderer.invoke('db:copy-roster-from-previous-month', year, month),
  getShiftDefinitions: () => ipcRenderer.invoke('db:get-shift-definitions'),
  saveShiftDefinitions: (shifts) => ipcRenderer.invoke('db:save-shift-definitions', shifts),
  deleteShiftDefinition: (code) => ipcRenderer.invoke('db:delete-shift-definition', code),
  getScheduleVersions: (year, month) => ipcRenderer.invoke('db:get-schedule-versions', year, month),
  saveScheduleVersion: (payload) => ipcRenderer.invoke('db:save-schedule-version', payload),
  restoreScheduleVersion: (versionId) => ipcRenderer.invoke('db:restore-schedule-version', versionId),
  saveMonthlyNorm: (norm) => ipcRenderer.invoke('db:save-monthly-norm', norm),
  resetMonthlyNorm: (year, month) => ipcRenderer.invoke('db:reset-monthly-norm', year, month),
  getTorQuarterData: (year, quarter) => ipcRenderer.invoke('db:get-tor-quarter-data', year, quarter),
  // Backupy bazy danych SQLite
  createDatabaseBackup: (reason, explicitStoreId) => ipcRenderer.invoke('db:create-backup', reason, explicitStoreId),
  getDatabaseBackups: (filterStoreId) => ipcRenderer.invoke('db:list-backups', filterStoreId),
  restoreDatabaseBackup: (filename, forceRestore) => ipcRenderer.invoke('db:restore-backup', filename, forceRestore),
  restoreDatabaseBackupBuffer: (buffer, forceRestore) => ipcRenderer.invoke('db:restore-backup-buffer', buffer, forceRestore),
  getDatabaseStatus: (filterStoreId) => ipcRenderer.invoke('db:get-database-status', filterStoreId),
  checkDatabaseHealth: () => ipcRenderer.invoke('db:check-health'),
  optimizeDatabase: () => ipcRenderer.invoke('db:optimize'),
  // Moduł Centrum Danych & Paczek Historycznych (Clean Slate & Import Hub)
  exportHistoricalPackage: (customTargetDir?: string) => ipcRenderer.invoke('db:export-historical-package', customTargetDir),
  importHistoricalPackage: (customSourceDir?: string) => ipcRenderer.invoke('db:import-historical-package', customSourceDir),
  resetToCleanSlate: () => ipcRenderer.invoke('db:reset-to-clean-slate'),
  switchStoreDatabase: (
    arg1: string | { storeId: string; storeInfo?: any },
    arg2?: any
  ) => {
    if (typeof arg1 === 'string') {
      return ipcRenderer.invoke('store:switch-database', arg1, arg2);
    }
    return ipcRenderer.invoke('store:switch-database', arg1);
  },
  getCurrentStoreDbInfo: () => ipcRenderer.invoke('store:get-current-db-info'),
  getCustomStores: () => ipcRenderer.invoke('store:get-custom-stores'),
  saveCustomStores: (stores: any[]) => ipcRenderer.invoke('store:save-custom-stores', stores),
  // Moduł 3: Szkolenia (Starbucks Training Suite)
  getTrainingPartners: () => ipcRenderer.invoke('db:get-training-partners'),
  saveTrainingPartner: (partner) => ipcRenderer.invoke('db:save-training-partner', partner),
  deleteTrainingPartner: (id) => ipcRenderer.invoke('db:delete-training-partner', id),
  getTrainingShifts: (partnerId) => ipcRenderer.invoke('db:get-training-shifts', partnerId),
  saveTrainingShiftsBatch: (partnerId, shifts) => ipcRenderer.invoke('db:save-training-shifts-batch', partnerId, shifts),
  updateTrainingShift: (shift) => ipcRenderer.invoke('db:update-training-shift', shift),
  getTrainingSkillChecks: (partnerId) => ipcRenderer.invoke('db:get-training-skill-checks', partnerId),
  saveTrainingSkillCheck: (check) => ipcRenderer.invoke('db:save-training-skill-check', check),
  // System Auto-Aktualizacji (electron-updater)
  getAppVersionInfo: () => ipcRenderer.invoke('app:get-version-info'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('app:download-update'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('app:quit-and-install'),
  getUpdateStatus: () => ipcRenderer.invoke('app:get-update-status'),
  onUpdaterEvent: (callback) => {
    const subscription = (_event: any, payload: any) => callback(payload);
    ipcRenderer.on('app:updater-event', subscription);
    return () => {
      ipcRenderer.removeListener('app:updater-event', subscription);
    };
  },
  openExternalUrl: (url) => ipcRenderer.invoke('system:open-external', url),
  // Skalowanie interfejsu (UI Zoom)
  setZoomFactor: (factor: number) => {
    try {
      webFrame.setZoomFactor(factor);
      return true;
    } catch {
      return false;
    }
  },
  getZoomFactor: () => {
    try {
      return webFrame.getZoomFactor();
    } catch {
      return 1.0;
    }
  },
  // System Diagnostyki, Czarnej Skrzynki i Zgłaszania Błędów
  logError: (payload) => ipcRenderer.invoke('logger:log', payload),
  getRecentLogs: (limit) => ipcRenderer.invoke('logger:get-recent-logs', limit),
  openLogsFolder: () => ipcRenderer.invoke('logger:open-logs-folder'),
  saveBugReport: (payload) => ipcRenderer.invoke('logger:save-bug-report', payload),
  exportDiagnosticPackage: (customTargetDir) => ipcRenderer.invoke('logger:export-diagnostics', customTargetDir),
  submitGitHubIssue: (payload) => ipcRenderer.invoke('github:submit-issue', payload),
  // Feature F12: Bezpieczeństwo i szyfrowanie AES-256-GCM / safeStorage
  cryptoIsSafeStorageAvailable: () => ipcRenderer.invoke('crypto:is-safe-storage-available'),
  cryptoGetMasterPassphrase: () => ipcRenderer.invoke('crypto:get-master-passphrase'),
  cryptoDeriveStoreKey: (storeId, unitCode) => ipcRenderer.invoke('crypto:derive-store-key', storeId, unitCode),
  cryptoSafeStorageEncrypt: (plaintext) => ipcRenderer.invoke('crypto:safe-storage-encrypt', plaintext),
  cryptoSafeStorageDecrypt: (encryptedBase64) => ipcRenderer.invoke('crypto:safe-storage-decrypt', encryptedBase64),
  // Feature F16 & F17: Zero-Data-Loss Local-to-Cloud Migration & Parity Verification
  executeStoreMigration: (options) => ipcRenderer.invoke('migration:execute-store-migration', options),
  verifyStoreParity: (storeId, options) => ipcRenderer.invoke('migration:verify-store-parity', storeId, options),
  extractStoreTables: (storeId) => ipcRenderer.invoke('migration:extract-store-tables', storeId),
  getMigrationReceipt: (storeId) => ipcRenderer.invoke('migration:get-receipt', storeId),
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('electronAPI', api);

