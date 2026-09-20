import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'path';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;

export interface AppVersionInfo {
  version: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  isPackaged: boolean;
}

export class AppUpdater {
  private static instance: AppUpdater;
  private mainWindow: BrowserWindow | null = null;
  private checkIntervalTimer: NodeJS.Timeout | null = null;
  private readonly SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  private updateStatus: {
    status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
    versionInfo?: any;
    progress?: {
      percent: number;
      bytesPerSecond: number;
      transferred: number;
      total: number;
    };
    error?: string;
  } = { status: 'idle' };

  private constructor() {
    this.configureUpdater();
    this.registerIpcHandlers();
  }

  public static getInstance(): AppUpdater {
    if (!AppUpdater.instance) {
      AppUpdater.instance = new AppUpdater();
    }
    return AppUpdater.instance;
  }

  public setMainWindow(win: BrowserWindow) {
    this.mainWindow = win;
    // Po podpięciu okna głównego uruchom cykl sprawdzania w tle
    this.startBackgroundCheckCycle();
  }

  private sendToRenderer(channel: string, payload: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }

  /**
   * Uruchamia automatyczne sprawdzanie przy starcie oraz cykliczne co 6 godzin
   */
  public startBackgroundCheckCycle() {
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = null;
    }

    // 1. Sprawdzenie przy starcie aplikacji (po 4 sekundach od uruchomienia okna)
    setTimeout(() => {
      console.log('🚀 [AutoUpdater] Uruchamianie cichego sprawdzenia aktualizacji przy starcie...');
      this.silentCheckForUpdates();
    }, 4000);

    // 2. Cykliczne sprawdzanie w tle co 6 godzin
    this.checkIntervalTimer = setInterval(() => {
      console.log('⏰ [AutoUpdater] Uruchamianie cyklicznego sprawdzenia w tle (co 6h)...');
      this.silentCheckForUpdates();
    }, this.SIX_HOURS_MS);
  }

  private async silentCheckForUpdates() {
    if (!app.isPackaged) {
      console.log('ℹ️ [AutoUpdater] Tryb deweloperski — pomijanie automatycznego sprawdzania w tle.');
      return;
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      console.warn('⚠️ [AutoUpdater] Ciche sprawdzenie w tle nie powiodło się (brak sieci):', err);
    }
  }

  private configureUpdater() {
    // Bezpośrednia konfiguracja kanału aktualizacji dla apeldawid-hub/COL-TOOL
    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'apeldawid-hub',
        repo: 'COL-TOOL'
      });
    } catch (e) {
      console.warn('⚠️ [AutoUpdater] Błąd setFeedURL:', e);
    }

    // Nie pobieraj automatycznie w tle - daj użytkownikowi kontrolę w UI
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      console.log('🔄 [AutoUpdater] Sprawdzanie dostępności aktualizacji...');
      this.updateStatus = { status: 'checking' };
      this.sendToRenderer('app:updater-event', {
        event: 'checking-for-update',
        status: 'checking'
      });
    });

    autoUpdater.on('update-available', (info) => {
      console.log('✨ [AutoUpdater] Dostępna nowa wersja:', info.version);
      this.updateStatus = {
        status: 'available',
        versionInfo: info
      };

      // Powiadomienie renderera (zielona kropka w pasku bocznym)
      this.sendToRenderer('app:updater-event', {
        event: 'update-available',
        status: 'available',
        info: {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes || 'Nowa wersja Starbucks Operations Suite z usprawnieniami i poprawkami.',
        }
      });

      // Natywne powiadomienie macOS
      try {
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: '☕ Dostępna nowa wersja Starbucks Operations Suite',
            body: `Wydano nową wersję v${info.version}. Kliknij tutaj lub w Centrum Aktualizacji w aplikacji, aby ją pobrać.`,
            silent: false
          });

          notification.on('click', () => {
            if (this.mainWindow) {
              if (this.mainWindow.isMinimized()) this.mainWindow.restore();
              this.mainWindow.focus();
              this.sendToRenderer('app:open-update-modal', {});
            }
          });

          notification.show();
        }
      } catch (notifErr) {
        console.warn('⚠️ [AutoUpdater] Nie udało się wyświetlić powiadomienia systemowego:', notifErr);
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('✅ [AutoUpdater] Aplikacja jest aktualna:', info?.version || app.getVersion());
      this.updateStatus = {
        status: 'not-available',
        versionInfo: info
      };
      this.sendToRenderer('app:updater-event', {
        event: 'update-not-available',
        status: 'not-available',
        info: {
          version: app.getVersion()
        }
      });
    });

    autoUpdater.on('error', (err) => {
      console.error('❌ [AutoUpdater] Błąd aktualizacji:', err);
      const errMsg = err?.message || 'Wystąpił nieznany błąd podczas sprawdzania aktualizacji.';
      this.updateStatus = {
        status: 'error',
        error: errMsg
      };
      this.sendToRenderer('app:updater-event', {
        event: 'error',
        status: 'error',
        error: errMsg
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent * 10) / 10;
      this.updateStatus = {
        status: 'downloading',
        progress: {
          percent,
          bytesPerSecond: progressObj.bytesPerSecond,
          transferred: progressObj.transferred,
          total: progressObj.total
        }
      };
      this.sendToRenderer('app:updater-event', {
        event: 'download-progress',
        status: 'downloading',
        progress: this.updateStatus.progress
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('🎉 [AutoUpdater] Aktualizacja została pobrana i jest gotowa do instalacji:', info.version);
      this.updateStatus = {
        status: 'downloaded',
        versionInfo: info
      };
      this.sendToRenderer('app:updater-event', {
        event: 'update-downloaded',
        status: 'downloaded',
        info
      });

      // Powiadomienie o gotowości do instalacji
      try {
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: '🎉 Aktualizacja pobrana!',
            body: `Wersja v${info.version} jest gotowa do zainstalowania. Zrestartuj aplikację, aby zastosować zmiany.`,
            silent: false
          });
          notification.show();
        }
      } catch (e) {
        // Ignoruj błąd powiadomienia
      }
    });
  }

  private registerIpcHandlers() {
    // Pobranie informacji o wersji
    ipcMain.handle('app:get-version-info', (): AppVersionInfo => {
      return {
        version: app.getVersion(),
        electronVersion: process.versions.electron || 'unknown',
        chromeVersion: process.versions.chrome || 'unknown',
        nodeVersion: process.versions.node || 'unknown',
        platform: process.platform,
        arch: process.arch,
        isPackaged: app.isPackaged
      };
    });

    // Sprawdzenie dostępności aktualizacji
    ipcMain.handle('app:check-for-updates', async () => {
      if (!app.isPackaged) {
        return {
          success: false,
          isDev: true,
          message: 'Sprawdzanie automatycznych aktualizacji jest dostępne w zainstalowanej wersji produkcyjnej (.app / .dmg).'
        };
      }

      try {
        const result = await autoUpdater.checkForUpdates();
        return {
          success: true,
          updateInfo: result?.updateInfo
        };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Błąd podczas komunikacji z serwerem aktualizacji.'
        };
      }
    });

    // Pobranie aktualizacji
    ipcMain.handle('app:download-update', async () => {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message };
      }
    });

    // Restart i instalacja
    ipcMain.handle('app:quit-and-install', () => {
      autoUpdater.quitAndInstall(false, true);
    });

    // Pobranie aktualnego stanu
    ipcMain.handle('app:get-update-status', () => {
      return this.updateStatus;
    });
  }
}
