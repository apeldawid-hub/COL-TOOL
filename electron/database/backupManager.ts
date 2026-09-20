import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { DatabaseManager } from './db';

export interface DatabaseBackupRecord {
  filename: string;
  filePath: string;
  sizeBytes: number;
  timestamp: string;
  formattedDate: string;
  reason: string;
}

export interface DatabaseStatus {
  dbPath: string;
  exists: boolean;
  sizeBytes: number;
  lastModified: string;
  backupsCount: number;
  latestBackup?: DatabaseBackupRecord;
}

export class BackupManager {
  private static instance: BackupManager;
  private backupDir: string;
  private maxKeep: number = 15;

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

  /**
   * Tworzy kopię zapasową bazy SQLite wraz z automatyczną rotacją
   */
  public createBackup(reason: string = 'manual'): {
    success: boolean;
    filename: string;
    filePath: string;
    sizeBytes: number;
    timestamp: string;
    reason: string;
    message: string;
  } {
    this.ensureDirExists();
    const dbManager = DatabaseManager.getInstance();

    // 1. Wymuszenie zapisu aktualnego stanu bazy na dysk
    dbManager.persist();

    const dbFilePath = dbManager.getDbFilePath();
    if (!fs.existsSync(dbFilePath)) {
      throw new Error(`Plik bazy danych nie istnieje: ${dbFilePath}`);
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const filename = `tplh_forecast_${timestampStr}_${safeReason}.db`;
    const targetPath = path.join(this.backupDir, filename);

    // 2. Kopiowanie pliku
    fs.copyFileSync(dbFilePath, targetPath);

    const stat = fs.statSync(targetPath);

    // 3. Rotacja starych kopii
    this.rotateBackups(this.maxKeep);

    console.log(`💾 Utworzono kopię zapasową bazy danych: ${filename} (${(stat.size / 1024).toFixed(1)} KB, powód: ${reason})`);

    return {
      success: true,
      filename,
      filePath: targetPath,
      sizeBytes: stat.size,
      timestamp: now.toISOString(),
      reason,
      message: `Pomyślnie utworzono kopię zapasową bazy (${(stat.size / 1024).toFixed(1)} KB).`
    };
  }

  /**
   * Zwraca listę wszystkich kopii zapasowych posortowanych od najnowszych
   */
  public listBackups(): DatabaseBackupRecord[] {
    this.ensureDirExists();
    const files = fs.readdirSync(this.backupDir);
    const backups: DatabaseBackupRecord[] = [];

    for (const file of files) {
      if (!file.endsWith('.db') || !file.startsWith('tplh_forecast_')) continue;

      const fullPath = path.join(this.backupDir, file);
      try {
        const stat = fs.statSync(fullPath);

        // Parsowanie powodu z nazwy pliku: tplh_forecast_YYYY-MM-DD_HH-mm-ss_reason.db
        let reason = 'ręczna';
        const parts = file.replace('.db', '').split('_');
        if (parts.length >= 4) {
          const rawReason = parts.slice(3).join('_');
          reason = this.formatReason(rawReason);
        }

        const date = stat.mtime;
        const formattedDate = date.toLocaleString('pl-PL', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        backups.push({
          filename: file,
          filePath: fullPath,
          sizeBytes: stat.size,
          timestamp: date.toISOString(),
          formattedDate,
          reason
        });
      } catch (err) {
        console.warn('Nie udało się odczytać pliku backupu:', file, err);
      }
    }

    // Sortowanie od najnowszych do najstarszych
    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Przywraca wskazaną kopię zapasową (z automatyczną kopią ratunkową stanu bieżącego)
   */
  public restoreBackup(filename: string): { success: boolean; message: string } {
    this.ensureDirExists();
    const backupPath = path.join(this.backupDir, filename);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Kopia zapasowa o nazwie ${filename} nie istnieje w katalogu backupów.`);
    }

    const dbManager = DatabaseManager.getInstance();
    const dbFilePath = dbManager.getDbFilePath();

    // 1. Bezpieczeństwo: Kopia ratunkowa aktualnej bazy przed nadpisaniem
    if (fs.existsSync(dbFilePath)) {
      try {
        this.createBackup('pre_restore_safety');
      } catch (e) {
        console.warn('Ostrzeżenie: Nie udało się utworzyć kopii ratunkowej przed przywracaniem:', e);
      }
    }

    // 2. Nadpisanie bazy plikiem z kopii
    fs.copyFileSync(backupPath, dbFilePath);

    // 3. Przeładowanie bazy w silniku SQLite
    dbManager.reloadFromDisk();

    console.log(`🔄 Przywrócono bazę danych z pliku: ${filename}`);

    return {
      success: true,
      message: `Pomyślnie przywrócono bazę danych z kopii: ${filename}. Dane zostały odświeżone.`
    };
  }

  /**
   * Pobiera aktualny status bazy danych i podsumowanie kopii zapasowych
   */
  public getDatabaseStatus(): DatabaseStatus {
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

    const backups = this.listBackups();

    return {
      dbPath: dbFilePath,
      exists,
      sizeBytes,
      lastModified,
      backupsCount: backups.length,
      latestBackup: backups[0]
    };
  }

  /**
   * Rotacja: usuwa najstarsze kopie zapasowe, jeśli przekraczają limit maxKeep
   */
  private rotateBackups(maxKeep: number): number {
    const backups = this.listBackups();
    if (backups.length <= maxKeep) return 0;

    const toDelete = backups.slice(maxKeep);
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
      console.log(`🧹 Usunięto ${deletedCount} najstarszych kopii zapasowych (limit: ${maxKeep}).`);
    }

    return deletedCount;
  }

  /**
   * Automatyczny backup przy starcie aplikacji (max 1x na 6 godzin)
   */
  public checkAndPerformStartupBackup(): void {
    try {
      const backups = this.listBackups();
      const now = Date.now();
      const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

      const shouldBackup = backups.length === 0 || (now - new Date(backups[0].timestamp).getTime() > SIX_HOURS_MS);

      if (shouldBackup) {
        this.createBackup('auto_startup');
      }
    } catch (err) {
      console.error('Błąd podczas wykonywania automatycznego backupu startowego:', err);
    }
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
      case 'pre_restore_safety':
        return 'Kopia ratunkowa przed przywracaniem';
      default:
        return raw.replace(/_/g, ' ');
    }
  }
}
