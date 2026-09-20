// src/services/logger.ts

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface ClientLogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  stack?: string;
  metadata?: Record<string, any>;
}

class ClientLogger {
  private static instance: ClientLogger;
  private memoryBuffer: ClientLogEntry[] = [];
  private readonly MAX_BUFFER = 100;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ClientLogger {
    if (!ClientLogger.instance) {
      ClientLogger.instance = new ClientLogger();
    }
    return ClientLogger.instance;
  }

  public init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Przechwytywanie nieobsłużonych błędów JS w oknie przeglądarki / renderera
    window.addEventListener('error', (event) => {
      this.error('Window:onerror', event.message, event.error?.stack, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Przechwytywanie nieobsłużonych Promise Rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      this.error('Window:unhandledrejection', `Unhandled Promise Rejection: ${msg}`, stack);
    });

    this.info('ClientLogger', 'System rejestracji logów i Czarnej Skrzynki został pomyślnie uruchomiony.');
  }

  private sanitize(str: string): string {
    if (!str) return '';
    // Ukrywanie ewentualnych ścieżek użytkownika /Users/...
    return str.replace(/\/Users\/[^/\s]+/g, '/Users/[USER]');
  }

  public log(level: LogLevel, source: string, message: string, stack?: string, metadata?: Record<string, any>) {
    const timestamp = new Date().toISOString();
    const cleanMsg = this.sanitize(message);
    const cleanStack = stack ? this.sanitize(stack) : undefined;

    const entry: ClientLogEntry = {
      timestamp,
      level,
      source,
      message: cleanMsg,
      stack: cleanStack,
      metadata,
    };

    // Bufor podręczny w pamięci
    this.memoryBuffer.push(entry);
    if (this.memoryBuffer.length > this.MAX_BUFFER) {
      this.memoryBuffer.shift();
    }

    // Wysyłka do procesu głównego Electron (zapis do trwałego pliku)
    try {
      const api = (window as any).api;
      if (api?.logError) {
        api.logError({
          level,
          source,
          message: cleanMsg,
          stack: cleanStack,
          metadata,
        });
      }
    } catch {}

    // Wypisanie do konsoli developerskiej
    const consolePrefix = `[${level}] [${source}]`;
    if (level === 'ERROR' || level === 'FATAL') {
      console.error(consolePrefix, cleanMsg, cleanStack || '');
    } else if (level === 'WARN') {
      console.warn(consolePrefix, cleanMsg);
    } else {
      console.log(consolePrefix, cleanMsg);
    }
  }

  public debug(source: string, message: string, metadata?: Record<string, any>) {
    this.log('DEBUG', source, message, undefined, metadata);
  }

  public info(source: string, message: string, metadata?: Record<string, any>) {
    this.log('INFO', source, message, undefined, metadata);
  }

  public warn(source: string, message: string, metadata?: Record<string, any>) {
    this.log('WARN', source, message, undefined, metadata);
  }

  public error(source: string, message: string, stack?: string, metadata?: Record<string, any>) {
    this.log('ERROR', source, message, stack, metadata);
  }

  public fatal(source: string, message: string, stack?: string, metadata?: Record<string, any>) {
    this.log('FATAL', source, message, stack, metadata);
  }

  public getRecentLogs(): ClientLogEntry[] {
    return [...this.memoryBuffer];
  }

  public async getPersistedLogs(limit = 100): Promise<ClientLogEntry[]> {
    try {
      const api = (window as any).api;
      if (api?.getRecentLogs) {
        return await api.getRecentLogs(limit);
      }
    } catch {}
    return this.getRecentLogs();
  }

  public async openLogsFolder(): Promise<boolean> {
    try {
      const api = (window as any).api;
      if (api?.openLogsFolder) {
        return await api.openLogsFolder();
      }
    } catch {}
    return false;
  }

  public async saveBugReport(payload: {
    category: string;
    userDescription: string;
    moduleName?: string;
    clientInfo?: any;
    errorStack?: string;
  }) {
    const api = (window as any).api;
    if (api?.saveBugReport) {
      return await api.saveBugReport({
        ...payload,
        customLogs: this.memoryBuffer,
      });
    }
    return { success: false, message: 'Brak API Electron do zapisu zgłoszenia' };
  }

  public async exportDiagnostics() {
    const api = (window as any).api;
    if (api?.exportDiagnosticPackage) {
      return await api.exportDiagnosticPackage();
    }
    return { success: false, message: 'Brak API Electron do eksportu diagnostyki' };
  }

  public async submitGitHubIssue(payload: {
    category: string;
    userDescription: string;
    moduleName?: string;
    clientInfo?: any;
    errorStack?: string;
    token?: string;
    isAutomatic?: boolean;
  }): Promise<{
    success: boolean;
    mode: 'api' | 'browser';
    issueUrl?: string;
    issueNumber?: number;
    message: string;
  }> {
    const api = (window as any).api;
    if (api?.submitGitHubIssue) {
      return await api.submitGitHubIssue({
        ...payload,
        customLogs: this.memoryBuffer,
      });
    }
    return {
      success: false,
      mode: 'browser',
      message: 'Brak API Electron do wysyłania zgłoszeń na GitHub',
    };
  }
}

export const logger = ClientLogger.getInstance();
