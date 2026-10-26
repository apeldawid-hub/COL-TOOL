import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import initSqlJs, { Database } from 'sql.js';
// Safe dynamic resolution of electron app in both packaged Electron and standalone Node/tsx test runners
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

export interface DatabaseStatus {
  dbPath: string;
  exists: boolean;
  sizeBytes: number;
  lastModified: string;
  backupsCount: number;
  latestBackup?: DatabaseBackupRecord;
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

/**
 * Waliduje czy plik kopii zapasowej jest przypisany do docelowej kawiarni
 */
export function validateRestoreTarget(backupFilename: string, targetStoreId: string): boolean {
  if (!backupFilename || !targetStoreId) return false;
  const safeTarget = targetStoreId.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
  // Wyodrębnij ID kawiarni z nazwy pliku za pomocą delimitera _backup_; fallback dla plików testowych/legacy
  const match = backupFilename.match(/^store_(.+?)_backup_/) || backupFilename.match(/^store_([^_]+)_/);
  if (!match) return false;
  const parsedStoreId = match[1].toLowerCase();

  if (parsedStoreId === safeTarget) return true;

  // Równoważność aliasów kawiarni Warszawa Janki: 108120, 18120, 108120_janki
  const isJankiAlias = (id: string) => id === '108120' || id === '18120' || id === '108120_janki';
  if (isJankiAlias(parsedStoreId) && isJankiAlias(safeTarget)) {
    return true;
  }

  return false;
}

export class BackupManager {
  private static instance: BackupManager;
  private backupDir: string;
  private maxKeepPerStore: number = 15;
  private SQL: any = null;

  public constructor(customBackupDir?: string) {
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
    } else if (customBackupDir && BackupManager.instance.backupDir !== customBackupDir) {
      BackupManager.instance.backupDir = customBackupDir;
      BackupManager.instance.ensureDirExists();
    }
    return BackupManager.instance;
  }

  public static resetInstanceForTesting(): void {
    BackupManager.instance = null as any;
  }

  private ensureDirExists(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  private sanitizeId(id: string): string {
    return (id || 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }

  /**
   * Generuje unikalną nazwę pliku kopii zapasowej dedykowaną dla danej kawiarni
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
   * Tworzy kopię zapasową bazy SQLite dedykowaną dla aktywnej kawiarni
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

      // Wyodrębnij ID kawiarni z nazwy pliku za pomocą delimitera _backup_
      const storeMatch = file.match(/^store_(.+?)_backup_/);
      if (storeMatch) {
        const fileStoreId = storeMatch[1].toLowerCase();
        const isFileJanki = fileStoreId === '108120' || fileStoreId === '18120' || fileStoreId === '108120_janki';

        if (fileStoreId === safeActiveId || (isJanki && isFileJanki)) {
          belongsToStore = true;
          parsedStoreId = fileStoreId;
        }
      } else if (isJanki && file.startsWith('tplh_forecast_')) {
        // Wsteczna kompatybilność: stare kopie tplh_forecast_ przypisujemy do Janki (108120)
        belongsToStore = true;
        isLegacy = true;
        parsedStoreId = '108120';
      } else if (file.startsWith('store_')) {
        // Fallback dla starszych lub testowych plików bez członu _backup_
        const fallbackMatch = file.match(/^store_([^_]+)_/);
        if (fallbackMatch) {
          const fileStoreId = fallbackMatch[1].toLowerCase();
          const isFileJanki = fileStoreId === '108120' || fileStoreId === '18120' || fileStoreId === '108120_janki';
          if (fileStoreId === safeActiveId || (isJanki && isFileJanki)) {
            belongsToStore = true;
            parsedStoreId = fileStoreId;
          }
        }
      }

      if (!belongsToStore) continue;

      const fullPath = path.join(this.backupDir, file);
      try {
        const stat = fs.statSync(fullPath);
        const reason = this.parseReasonFromFilename(file);
        const date = stat.mtime;

        const formattedDate = date.toLocaleString('pl-PL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        backups.push({
          filename: file,
          filePath: fullPath,
          sizeBytes: stat.size,
          timestamp: date.toISOString(),
          formattedDate,
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
    const backupStore = { storeId: '', storeName: '', unitCode: '', mpk: '' };

    try {
      inspectDb = new this.SQL.Database(nodeBuf);

      // Odczyt tabeli app_settings
      try {
        const stmt = inspectDb!.prepare("SELECT key, value FROM app_settings WHERE key IN ('store_name', 'unit_code', 'store_mpk', 'store_id')");
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
          const stmtStores = inspectDb!.prepare('SELECT store_code, store_name FROM stores LIMIT 1');
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
    const isJankiAlias = (id: string) => id === '108120' || id === '18120' || id === '108120_janki';
    const isMatch = safeTarget === safeBackup ||
      (isJankiAlias(safeTarget) && (isJankiAlias(safeBackup) || backupStore.unitCode === '18120' || backupStore.mpk === '108120'));

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
   * Przywraca bazę danych bezpośrednio z bufora binarnego (np. wgrany w Onboardingu)
   */
  public async restoreFromBuffer(buffer: ArrayBuffer | Buffer, forceRestore: boolean = false): Promise<{ success: boolean; message: string; inspection?: RestoreInspectionResult }> {
    const dbManager = DatabaseManager.getInstance();
    const currentStoreId = dbManager.getCurrentStoreId() || '108120';
    const dbFilePath = dbManager.getDbFilePath();

    const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    const inspection = await this.inspectBackupBuffer(nodeBuffer, currentStoreId);

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

    fs.writeFileSync(dbFilePath, nodeBuffer);
    dbManager.reloadFromDisk();

    console.log(`🔄 [BackupManager] Przywrócono bazę kawiarni [${currentStoreId}] z bufora (${(nodeBuffer.length / (1024 * 1024)).toFixed(2)} MB).`);

    return {
      success: true,
      message: `Pomyślnie przywrócono bazę danych ze wskazanego pliku (${(nodeBuffer.length / (1024 * 1024)).toFixed(2)} MB).`,
      inspection,
    };
  }

  /**
   * Pobiera aktualny status bazy danych i podsumowanie kopii zapasowych
   */
  public getDatabaseStatus(filterStoreId?: string): DatabaseStatus {
    const dbManager = DatabaseManager.getInstance();
    const dbFilePath = dbManager.getDbFilePath();
    const exists = fs.existsSync(dbFilePath);

    let sizeBytes = 0;
    let lastModified = '';

    if (exists) {
      const stat = fs.statSync(dbFilePath);
      sizeBytes = stat.size;
      lastModified = stat.mtime.toLocaleString('pl-PL');
    }

    const backups = this.listBackups(filterStoreId);

    return {
      dbPath: dbFilePath,
      exists,
      sizeBytes,
      lastModified,
      backupsCount: backups.length,
      latestBackup: backups[0],
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

  /**
   * Automatyczny backup przy starcie aplikacji (max 1x na 6 godzin)
   */
  public checkAndPerformStartupBackup(): void {
    try {
      const dbManager = DatabaseManager.getInstance();
      const currentStoreId = dbManager.getCurrentStoreId() || '108120';
      const backups = this.listBackups(currentStoreId);
      const now = Date.now();
      const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

      const shouldBackup = backups.length === 0 || (now - new Date(backups[0].timestamp).getTime() > SIX_HOURS_MS);

      if (shouldBackup) {
        this.createBackup('auto_startup', currentStoreId);
      }
    } catch (err) {
      console.error('Błąd podczas wykonywania automatycznego backupu startowego:', err);
    }
  }

  private parseReasonFromFilename(filename: string): string {
    // 1. Dopasowanie ze standardowego wzorca: store_<storeId>_backup_<timestamp>_<reason>.db
    const storeMatch = filename.match(/^store_.+?_backup_\d{4}-\d{2}-\d{2}(?:_\d{2}-\d{2}-\d{2})?(?:_\d{3})?_(.+?)\.db$/);
    if (storeMatch) {
      return this.formatReason(storeMatch[1]);
    }

    // 2. Wzorzec dla plików legacy: tplh_forecast_<timestamp>_<reason>.db
    const tplhMatch = filename.match(/^tplh_forecast_\d{4}-\d{2}-\d{2}(?:_\d{2}-\d{2}-\d{2})?(?:_\d{3})?_(.+?)\.db$/);
    if (tplhMatch) {
      return this.formatReason(tplhMatch[1]);
    }

    // 3. Fallback dla nietypowych nazw
    const name = filename.replace('.db', '');
    const parts = name.split('_');
    if (name.startsWith('tplh_forecast_') && parts.length >= 4) {
      const raw = parts.slice(3).join('_');
      return this.formatReason(raw);
    }
    if (name.startsWith('store_') && parts.length >= 6) {
      const raw = parts.slice(5).join(' ');
      return this.formatReason(raw);
    }
    return 'ręczna';
  }

  private formatReason(raw: string): string {
    switch (raw) {
      case 'manual':
        return 'Ręczna kopia Store Managera';
      case 'auto_startup':
        return 'Automatyczny backup startowy';
      case 'pre_version':
      case 'pre_version_publish':
        return 'Przed publikacją wersji grafiku';
      case 'pre_import':
      case 'pre_import_mapal':
        return 'Przed importem MAPAL Fichajes';
      case 'post_import_mapal':
        return 'Po imporcie MAPAL Fichajes';
      case 'pre_import_aop':
        return 'Przed importem planu AOP';
      case 'post_import_aop':
        return 'Po imporcie planu AOP';
      case 'pre_import_schedules':
        return 'Przed importem grafików';
      case 'post_import_schedules':
        return 'Po imporcie grafików';
      case 'pre_import_daily_kpi':
        return 'Przed importem dziennych KPI';
      case 'post_import_daily_kpi':
        return 'Po imporcie dziennych KPI';
      case 'pre_restore_safety':
        return 'Kopia ratunkowa przed przywracaniem';
      case 'pre_vacuum':
      case 'pre_optimize_vacuum':
        return 'Przed optymalizacją VACUUM';
      default:
        return raw.replace(/_/g, ' ');
    }
  }
}
