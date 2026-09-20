import { app, shell } from 'electron';
import path from 'path';
import fs from 'fs';

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  source: string;
  message: string;
  stack?: string;
  metadata?: Record<string, any>;
}

export interface BugReportPayload {
  category: string;
  userDescription: string;
  moduleName?: string;
  clientInfo?: {
    appVersion: string;
    platform: string;
    arch: string;
    nodeVersion: string;
    chromeVersion: string;
    electronVersion: string;
    systemTime: string;
    userProfile?: string;
  };
  errorStack?: string;
  customLogs?: LogEntry[];
}

export class CrashLogManager {
  private static instance: CrashLogManager;
  private logsDir: string;
  private reportsDir: string;
  private inMemoryLogs: LogEntry[] = [];
  private readonly MAX_IN_MEMORY = 300;

  private constructor() {
    try {
      const userData = app?.getPath ? app.getPath('userData') : process.cwd();
      this.logsDir = path.join(userData, 'logs');
      this.reportsDir = path.join(userData, 'bug_reports');
    } catch {
      this.logsDir = path.join(process.cwd(), 'logs');
      this.reportsDir = path.join(process.cwd(), 'bug_reports');
    }

    this.ensureDirs();
    this.cleanOldLogs(14); // 14 dni retencji
  }

  public static getInstance(): CrashLogManager {
    if (!CrashLogManager.instance) {
      CrashLogManager.instance = new CrashLogManager();
    }
    return CrashLogManager.instance;
  }

  private ensureDirs() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  private sanitize(str: string): string {
    if (!str) return '';
    try {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      if (home && home.length > 3) {
        return str.split(home).join('[USER_HOME]');
      }
    } catch {}
    return str;
  }

  public log(
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL',
    source: string,
    message: string,
    stack?: string,
    metadata?: Record<string, any>
  ): void {
    const timestamp = new Date().toISOString();
    const cleanMessage = this.sanitize(message);
    const cleanStack = stack ? this.sanitize(stack) : undefined;

    const entry: LogEntry = {
      timestamp,
      level,
      source,
      message: cleanMessage,
      stack: cleanStack,
      metadata,
    };

    // 1. Zapis do bufora w pamięci
    this.inMemoryLogs.push(entry);
    if (this.inMemoryLogs.length > this.MAX_IN_MEMORY) {
      this.inMemoryLogs.shift();
    }

    // 2. Konsola
    const consoleMsg = `[${timestamp}] [${level}] [${source}] ${cleanMessage}`;
    if (level === 'ERROR' || level === 'FATAL') {
      console.error(consoleMsg, cleanStack || '');
    } else if (level === 'WARN') {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }

    // 3. Zapis do pliku dziennego
    try {
      this.ensureDirs();
      const dateStr = timestamp.substring(0, 10); // YYYY-MM-DD
      const logFilePath = path.join(this.logsDir, `app-${dateStr}.log`);

      let logLine = `[${timestamp}] [${level}] [${source}] ${cleanMessage}\n`;
      if (cleanStack) {
        logLine += `  STACK: ${cleanStack.replace(/\n/g, '\n  ')}\n`;
      }
      if (metadata && Object.keys(metadata).length > 0) {
        logLine += `  META: ${JSON.stringify(metadata)}\n`;
      }

      fs.appendFileSync(logFilePath, logLine, 'utf-8');
    } catch (err) {
      console.error('Błąd zapisu do pliku logu:', err);
    }
  }

  public getRecentLogs(limit = 100): LogEntry[] {
    if (this.inMemoryLogs.length >= limit) {
      return this.inMemoryLogs.slice(-limit);
    }

    // Jeśli w pamięci mamy mało, doładujmy z pliku dzisiejszego logu
    try {
      const todayStr = new Date().toISOString().substring(0, 10);
      const logFilePath = path.join(this.logsDir, `app-${todayStr}.log`);
      if (fs.existsSync(logFilePath)) {
        return this.inMemoryLogs;
      }
    } catch {}

    return this.inMemoryLogs;
  }

  public getLogsDirectory(): string {
    return this.logsDir;
  }

  public async openLogsFolder(): Promise<boolean> {
    try {
      this.ensureDirs();
      const res = await shell.openPath(this.logsDir);
      return !res;
    } catch (err) {
      this.log('ERROR', 'CrashLogManager', 'Nie udało się otworzyć folderu logów', String(err));
      return false;
    }
  }

  public async saveBugReport(payload: BugReportPayload): Promise<{
    success: boolean;
    filePath: string;
    reportId: string;
    message: string;
  }> {
    try {
      this.ensureDirs();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportId = `BUG-${Date.now().toString(36).toUpperCase()}`;
      const filename = `report-${reportId}-${timestamp}.json`;
      const filePath = path.join(this.reportsDir, filename);

      const logsToInclude = payload.customLogs && payload.customLogs.length > 0 
        ? payload.customLogs 
        : this.getRecentLogs(50);

      const fullReport = {
        reportId,
        createdAt: new Date().toISOString(),
        category: payload.category,
        moduleName: payload.moduleName || 'General',
        userDescription: payload.userDescription,
        clientInfo: payload.clientInfo,
        errorStack: payload.errorStack ? this.sanitize(payload.errorStack) : undefined,
        recentLogs: logsToInclude,
      };

      fs.writeFileSync(filePath, JSON.stringify(fullReport, null, 2), 'utf-8');

      this.log('INFO', 'CrashLogManager', `Zapisano zgłoszenie błędu ${reportId} do ${filename}`);

      return {
        success: true,
        filePath,
        reportId,
        message: `Pomyślnie utworzono zgłoszenie ${reportId}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log('ERROR', 'CrashLogManager', 'Błąd tworzenia zgłoszenia błędu', msg);
      return {
        success: false,
        filePath: '',
        reportId: '',
        message: `Nie udało się zapisać zgłoszenia: ${msg}`,
      };
    }
  }

  public async exportDiagnosticPackage(customTargetDir?: string): Promise<{
    success: boolean;
    filePath: string;
    message: string;
  }> {
    try {
      const desktopDir = customTargetDir || app.getPath('desktop');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outFilename = `SBX_Diagnostics_${timestamp}.txt`;
      const outPath = path.join(desktopDir, outFilename);

      const logs = this.getRecentLogs(150);
      const appInfo = {
        version: app.getVersion(),
        platform: process.platform,
        arch: process.arch,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
        time: new Date().toISOString(),
      };

      let content = `=======================================================\n`;
      content += `STARBUCKS OPERATIONS SUITE — RAPORT DIAGNOSTYCZNY\n`;
      content += `=======================================================\n`;
      content += `Data wygenerowania: ${appInfo.time}\n`;
      content += `Wersja aplikacji:   ${appInfo.version}\n`;
      content += `System operacyjny:  macOS ${appInfo.arch} (${appInfo.platform})\n`;
      content += `Środowisko:         Electron ${appInfo.electron} / Chrome ${appInfo.chrome} / Node ${appInfo.node}\n`;
      content += `=======================================================\n\n`;
      content += `--- OSTATNIE ZDARZENIA I LOGI BŁĘDÓW (${logs.length} wpisów) ---\n\n`;

      for (const log of logs) {
        content += `[${log.timestamp}] [${log.level}] [${log.source}] ${log.message}\n`;
        if (log.stack) {
          content += `  STACK: ${log.stack}\n`;
        }
        if (log.metadata) {
          content += `  META: ${JSON.stringify(log.metadata)}\n`;
        }
        content += `\n`;
      }

      fs.writeFileSync(outPath, content, 'utf-8');

      return {
        success: true,
        filePath: outPath,
        message: `Wyeksportowano pakiet diagnostyczny do pliku: ${outFilename}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        filePath: '',
        message: `Błąd eksportu diagnostyki: ${msg}`,
      };
    }
  }

  private cleanOldLogs(maxDaysRetention: number) {
    try {
      this.ensureDirs();
      const now = Date.now();
      const maxAgeMs = maxDaysRetention * 24 * 60 * 60 * 1000;

      const files = fs.readdirSync(this.logsDir);
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        const filePath = path.join(this.logsDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      console.warn('Błąd czyszczenia starych logów:', err);
    }
  }
}
