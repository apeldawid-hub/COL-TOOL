import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { spawn } from 'child_process';
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
  private downloadedZipPath: string | null = null;
  private targetDownloadUrl: string | null = null;

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
    this.startBackgroundCheckCycle();
  }

  private sendToRenderer(channel: string, payload: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }

  public startBackgroundCheckCycle() {
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = null;
    }

    // 1. Sprawdzenie przy starcie aplikacji (po 4 sekundach)
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
    if (!app.isPackaged) return;

    try {
      const release = await this.fetchLatestReleaseFromGitHub();
      if (release && release.version !== app.getVersion()) {
        this.updateStatus = {
          status: 'available',
          versionInfo: release
        };
        this.targetDownloadUrl = release.downloadUrl;
        this.sendToRenderer('app:updater-event', {
          event: 'update-available',
          status: 'available',
          info: release
        });
      }
    } catch (err) {
      console.warn('⚠️ [AutoUpdater] Ciche sprawdzenie w tle nie powiodło się:', err);
    }
  }

  private configureUpdater() {
    try {
      autoUpdater.logger = console;
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'apeldawid-hub',
        repo: 'COL-TOOL'
      });
    } catch (e) {
      console.warn('⚠️ [AutoUpdater] Błąd setFeedURL:', e);
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
  }

  /**
   * Pobiera informacje o najnowszym wydaniu bezpośrednio z GitHub API
   */
  public async fetchLatestReleaseFromGitHub(): Promise<{
    version: string;
    releaseDate: string;
    releaseNotes: string;
    downloadUrl: string;
    zipName: string;
  } | null> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/apeldawid-hub/COL-TOOL/releases/latest',
        method: 'GET',
        headers: {
          'User-Agent': 'Starbucks-Operations-Suite-Updater',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const release = JSON.parse(data);
              const rawTag = release.tag_name || '';
              const version = rawTag.replace(/^v/, '');
              const isArm = process.arch === 'arm64';
              
              // Poszukaj odpowiedniego archiwum .zip
              // Dla Apple Silicon: Starbucks-Operations-Suite-X.X.X-arm64-mac.zip
              // Dla Intel: Starbucks-Operations-Suite-X.X.X-mac.zip
              const assets = release.assets || [];
              let matchedAsset = assets.find((a: any) => 
                isArm ? a.name.includes('arm64-mac.zip') : (a.name.includes('-mac.zip') && !a.name.includes('arm64'))
              );

              if (!matchedAsset) {
                // Fallback do dowolnego .zip
                matchedAsset = assets.find((a: any) => a.name.endsWith('-mac.zip') || a.name.endsWith('.zip'));
              }

              const downloadUrl = matchedAsset 
                ? matchedAsset.browser_download_url 
                : `https://github.com/apeldawid-hub/COL-TOOL/releases/download/v${version}/Starbucks-Operations-Suite-${version}-${isArm ? 'arm64-' : ''}mac.zip`;

              resolve({
                version,
                releaseDate: release.published_at || new Date().toISOString(),
                releaseNotes: release.body || 'Nowa wersja Starbucks Operations Suite z usprawnieniami.',
                downloadUrl,
                zipName: matchedAsset ? matchedAsset.name : `sos-update-${version}.zip`
              });
            } catch (err) {
              reject(err);
            }
          } else {
            reject(new Error(`GitHub API HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  /**
   * Niezależne pobieranie paczki ZIP z postępem (Bypass dla macOS ShipIt)
   */
  public async downloadCustomZip(url: string): Promise<string> {
    const tempZipPath = path.join(app.getPath('temp'), `sos-update-${Date.now()}.zip`);
    this.downloadedZipPath = tempZipPath;

    return new Promise((resolve, reject) => {
      const followRedirects = (currentUrl: string, redirectCount = 0) => {
        if (redirectCount > 5) {
          return reject(new Error('Zbyt wiele przekierowań podczas pobierania aktualizacji.'));
        }

        const req = https.get(currentUrl, {
          headers: { 'User-Agent': 'Starbucks-Operations-Suite-Updater' }
        }, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return followRedirects(res.headers.location, redirectCount + 1);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Błąd pobierania pliku: HTTP ${res.statusCode}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let transferredBytes = 0;
          let lastTime = Date.now();
          let lastBytes = 0;

          const fileStream = fs.createWriteStream(tempZipPath);

          res.on('data', (chunk) => {
            transferredBytes += chunk.length;
            const now = Date.now();
            const elapsed = (now - lastTime) / 1000;

            if (elapsed >= 0.3 || transferredBytes === totalBytes) {
              const bytesPerSecond = elapsed > 0 ? Math.round((transferredBytes - lastBytes) / elapsed) : 0;
              const percent = totalBytes > 0 ? Math.round((transferredBytes / totalBytes) * 1000) / 10 : 0;

              this.updateStatus = {
                status: 'downloading',
                progress: {
                  percent,
                  bytesPerSecond,
                  transferred: transferredBytes,
                  total: totalBytes
                }
              };

              this.sendToRenderer('app:updater-event', {
                event: 'download-progress',
                status: 'downloading',
                progress: this.updateStatus.progress
              });

              lastTime = now;
              lastBytes = transferredBytes;
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => {
              this.updateStatus = {
                status: 'downloaded',
                versionInfo: this.updateStatus.versionInfo
              };
              this.sendToRenderer('app:updater-event', {
                event: 'update-downloaded',
                status: 'downloaded',
                info: this.updateStatus.versionInfo
              });
              resolve(tempZipPath);
            });
          });

          fileStream.on('error', (err) => {
            fs.unlink(tempZipPath, () => {});
            reject(err);
          });
        });

        req.on('error', (err) => {
          fs.unlink(tempZipPath, () => {});
          reject(err);
        });
      };

      followRedirects(url);
    });
  }

  /**
   * Automatyczna podmiana aplikacji i restart na macOS (Obejście Apple Developer ID)
   */
  public executeInPlaceMacUpdate(): boolean {
    if (!this.downloadedZipPath || !fs.existsSync(this.downloadedZipPath)) {
      console.error('Brak pobranego pliku aktualizacji ZIP.');
      return false;
    }

    try {
      // Wyznacz ścieżkę do bieżącego pakietu .app
      const execPath = process.execPath;
      const appMatch = execPath.match(/^(.+?\.app)(\/Contents\/MacOS\/.*)?$/);
      const appBundlePath = appMatch ? appMatch[1] : path.resolve(execPath, '../../..');

      const tempExtractDir = path.join(app.getPath('temp'), `sos_extract_${Date.now()}`);
      const scriptPath = path.join(app.getPath('temp'), `sos_updater_${Date.now()}.sh`);
      const currentPid = process.pid;

      const bashScript = `#!/usr/bin/env bash
PID=${currentPid}
ZIP_PATH="${this.downloadedZipPath}"
APP_PATH="${appBundlePath}"
EXTRACT_DIR="${tempExtractDir}"

# 1. Czekaj na zakończenie procesu aplikacji
while kill -0 $PID 2>/dev/null; do
  sleep 0.1
done

# 2. Rozpakuj nową wersję
mkdir -p "$EXTRACT_DIR"
unzip -q -o "$ZIP_PATH" -d "$EXTRACT_DIR"

# 3. Znajdź nową aplikację .app
NEW_APP=$(find "$EXTRACT_DIR" -maxdepth 2 -name "*.app" | head -n 1)

if [ -n "$NEW_APP" ] && [ -d "$NEW_APP" ]; then
  # 4. Zdejmij flagę kwarantanny macOS Gatekeeper
  xattr -rd com.apple.quarantine "$NEW_APP" 2>/dev/null || true
  
  # 5. Podmień pliki aplikacji
  rm -rf "$APP_PATH"
  mv "$NEW_APP" "$APP_PATH"
  
  # 6. Zdejmij kwarantannę z podmienionej aplikacji
  xattr -rd com.apple.quarantine "$APP_PATH" 2>/dev/null || true
  
  # 7. Posprzątaj pliki tymczasowe
  rm -rf "$EXTRACT_DIR" "$ZIP_PATH"
  
  # 8. Uruchom zaktualizowaną aplikację
  open "$APP_PATH"
fi
`;

      fs.writeFileSync(scriptPath, bashScript, { mode: 0o755 });

      console.log('🚀 [AutoUpdater] Uruchamianie niezależnego skryptu podmiany macOS:', scriptPath);

      const child = spawn('/bin/bash', [scriptPath], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();

      // Zakończ natychmiast proces obecnej aplikacji
      app.exit(0);
      return true;
    } catch (err) {
      console.error('Błąd podczas uruchamiania instalatora in-place:', err);
      return false;
    }
  }

  private registerIpcHandlers() {
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

    ipcMain.handle('app:check-for-updates', async () => {
      this.updateStatus = { status: 'checking' };
      try {
        const release = await this.fetchLatestReleaseFromGitHub();
        if (!release) {
          this.updateStatus = { status: 'not-available' };
          return { success: true, isDev: !app.isPackaged, message: 'Brak nowszych wydań.' };
        }

        const isNewer = release.version !== app.getVersion();
        this.targetDownloadUrl = release.downloadUrl;

        if (isNewer) {
          this.updateStatus = {
            status: 'available',
            versionInfo: release
          };
          return {
            success: true,
            updateInfo: {
              version: release.version,
              releaseDate: release.releaseDate,
              releaseNotes: release.releaseNotes
            }
          };
        } else {
          this.updateStatus = { status: 'not-available' };
          return {
            success: true,
            isDev: !app.isPackaged,
            message: 'Aplikacja jest aktualna.'
          };
        }
      } catch (err: any) {
        this.updateStatus = { status: 'error', error: err?.message };
        return {
          success: false,
          error: err?.message || 'Błąd komunikacji z serwerem wydań GitHub.'
        };
      }
    });

    ipcMain.handle('app:download-update', async () => {
      try {
        let url = this.targetDownloadUrl;
        if (!url) {
          const release = await this.fetchLatestReleaseFromGitHub();
          url = release?.downloadUrl || null;
        }

        if (!url) {
          throw new Error('Nie znaleziono adresu URL do pobrania paczki aktualizacji.');
        }

        this.updateStatus = { status: 'downloading' };
        await this.downloadCustomZip(url);
        return { success: true };
      } catch (err: any) {
        this.updateStatus = { status: 'error', error: err?.message };
        return { success: false, error: err?.message || 'Błąd pobierania paczki aktualizacji.' };
      }
    });

    ipcMain.handle('app:quit-and-install', () => {
      if (process.platform === 'darwin') {
        const success = this.executeInPlaceMacUpdate();
        if (!success) {
          // Fallback do standardowej metody
          autoUpdater.quitAndInstall(false, true);
        }
      } else {
        autoUpdater.quitAndInstall(false, true);
      }
    });

    ipcMain.handle('app:get-update-status', () => {
      return this.updateStatus;
    });
  }
}

