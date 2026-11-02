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

    // 1. Sprawdzenie przy starcie aplikacji (po 3 sekundach)
    setTimeout(() => {
      console.log('🚀 [AutoUpdater] Uruchamianie cichego sprawdzenia aktualizacji przy starcie...');
      this.silentCheckForUpdates();
    }, 3000);

    // 2. Cykliczne sprawdzanie w tle co 2 godziny
    this.checkIntervalTimer = setInterval(() => {
      console.log('⏰ [AutoUpdater] Uruchamianie cyklicznego sprawdzenia w tle (co 2h)...');
      this.silentCheckForUpdates();
    }, 2 * 60 * 60 * 1000);
  }

  /**
   * Ciche sprawdzenie i automatyczne pobranie mikropatcha OTA w tle (Zero-Click Auto-Update)
   */
  public async silentCheckForUpdates() {
    if (!app.isPackaged) {
      console.log('ℹ️ [AutoUpdater] Tryb deweloperski — auto-aktualizacja OTA wyłączona.');
      return;
    }

    try {
      const release = await this.fetchLatestReleaseFromGitHub();
      if (!release || release.version === app.getVersion()) {
        console.log(`✅ [AutoUpdater] Aplikacja jest w najnowszej wersji v${app.getVersion()}.`);
        return;
      }

      console.log(`⚡ [AutoUpdater] Wykryto nową wersję v${release.version} (obecna: v${app.getVersion()})`);
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

      // Jeśli wydanie zawiera mikropatch OTA, pobierz go cicho w tle do folderu staging
      const stagedDir = path.join(app.getPath('userData'), 'pending_update');
      fs.mkdirSync(stagedDir, { recursive: true });
      const stagedZipPath = path.join(stagedDir, `sos-patch-${release.version}.zip`);
      const manifestPath = path.join(stagedDir, 'pending_patch.json');

      // Jeśli już pobrano tę samą wersję, tylko załaduj manifest
      if (fs.existsSync(manifestPath) && fs.existsSync(stagedZipPath)) {
        try {
          const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          if (existing.version === release.version && existing.ready) {
            this.updateStatus = { status: 'downloaded', versionInfo: release };
            this.downloadedZipPath = stagedZipPath;
            this.sendToRenderer('app:updater-event', {
              event: 'update-downloaded-ready',
              status: 'downloaded',
              info: release
            });
            return;
          }
        } catch (_) {}
      }

      console.log(`📥 [AutoUpdater] Rozpoczynam automatyczne pobieranie mikropatcha OTA (${release.sizeMB || 12} MB) do: ${stagedZipPath}`);
      await this.downloadCustomZip(release.downloadUrl, stagedZipPath);

      // Zapisz manifest gotowości patcha do nałożenia przy wyjściu lub restarcie
      const manifest = {
        version: release.version,
        zipPath: stagedZipPath,
        downloadedAt: new Date().toISOString(),
        ready: true,
        isPatch: release.isPatch
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      this.updateStatus = {
        status: 'downloaded',
        versionInfo: release
      };
      this.downloadedZipPath = stagedZipPath;

      console.log(`🎉 [AutoUpdater] Mikropatch v${release.version} pobrany i gotowy do automatycznej instalacji.`);

      this.sendToRenderer('app:updater-event', {
        event: 'update-downloaded-ready',
        status: 'downloaded',
        info: release
      });

      if (Notification.isSupported()) {
        try {
          const notif = new Notification({
            title: 'Starbucks Operations Suite',
            body: `Pobrano aktualizację v${release.version}. Zostanie zainstalowana automatycznie przy wyjściu lub restarcie.`,
            silent: true
          });
          notif.show();
        } catch (_) {}
      }
    } catch (err) {
      console.warn('⚠️ [AutoUpdater] Ciche sprawdzenie/pobranie w tle nie powiodło się:', err);
    }
  }

  /**
   * Sprawdza i wdraża pobrany mikropatch OTA natychmiast przy starcie aplikacji (jeśli poprzednio nie dokończono restartu)
   */
  public checkAndApplyPendingPatchOnStartup(): boolean {
    try {
      const stagedDir = path.join(app.getPath('userData'), 'pending_update');
      const manifestPath = path.join(stagedDir, 'pending_patch.json');
      if (!fs.existsSync(manifestPath)) return false;

      const raw = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw);
      if (!manifest.ready || !manifest.zipPath || !fs.existsSync(manifest.zipPath)) {
        return false;
      }

      console.log(`⚡ [AutoUpdater] Znaleziono pobrany patch v${manifest.version} z poprzedniej sesji. Aplikuję i restartuję...`);
      fs.unlinkSync(manifestPath);

      return this.applyHotPatch(manifest.zipPath, true);
    } catch (err) {
      console.error('❌ [AutoUpdater] Błąd sprawdzania patcha przy starcie:', err);
      return false;
    }
  }

  /**
   * Sprawdza i wdraża pobrany mikropatch OTA bez restartu w momencie, gdy użytkownik zamyka aplikację
   */
  public checkAndApplyPendingPatchOnQuit(): boolean {
    try {
      const stagedDir = path.join(app.getPath('userData'), 'pending_update');
      const manifestPath = path.join(stagedDir, 'pending_patch.json');
      if (!fs.existsSync(manifestPath)) return false;

      const raw = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw);
      if (!manifest.ready || !manifest.zipPath || !fs.existsSync(manifest.zipPath)) {
        return false;
      }

      console.log(`⚡ [AutoUpdater] Wykryto oczekujący mikropatch v${manifest.version}. Wdrażam automatycznie przy zamykaniu...`);
      fs.unlinkSync(manifestPath);

      // Uruchom podmianę asara bez restartowania programu (aplikacja właśnie się zamyka)
      return this.applyHotPatch(manifest.zipPath, false);
    } catch (err) {
      console.error('❌ [AutoUpdater] Błąd podczas nakładania patcha przy wyjściu:', err);
      return false;
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
    isPatch: boolean;
    sizeMB?: number;
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
              const assets = release.assets || [];
              
              // 1. Sprawdź czy jest dostępny szybki mikropatch OTA (sos-patch-*.zip)
              const patchAsset = assets.find((a: any) => a.name.startsWith('sos-patch-') && a.name.endsWith('.zip'));
              
              if (patchAsset) {
                const sizeMB = patchAsset.size ? +(patchAsset.size / (1024 * 1024)).toFixed(2) : 1.5;
                return resolve({
                  version,
                  releaseDate: release.published_at || new Date().toISOString(),
                  releaseNotes: release.body || '⚡ Błyskawiczny patch OTA z usprawnieniami systemu.',
                  downloadUrl: patchAsset.browser_download_url,
                  zipName: patchAsset.name,
                  isPatch: true,
                  sizeMB
                });
              }

              // 2. Fallback do pełnego archiwum .zip macOS
              let matchedAsset = assets.find((a: any) => 
                isArm ? a.name.includes('arm64-mac.zip') : (a.name.includes('-mac.zip') && !a.name.includes('arm64'))
              );

              if (!matchedAsset) {
                matchedAsset = assets.find((a: any) => a.name.endsWith('-mac.zip') || a.name.endsWith('.zip'));
              }

              const downloadUrl = matchedAsset 
                ? matchedAsset.browser_download_url 
                : `https://github.com/apeldawid-hub/COL-TOOL/releases/download/v${version}/Starbucks-Operations-Suite-${version}-${isArm ? 'arm64-' : ''}mac.zip`;

              const sizeMB = matchedAsset?.size ? +(matchedAsset.size / (1024 * 1024)).toFixed(1) : 85;

              resolve({
                version,
                releaseDate: release.published_at || new Date().toISOString(),
                releaseNotes: release.body || 'Nowa wersja Starbucks Operations Suite z usprawnieniami.',
                downloadUrl,
                zipName: matchedAsset ? matchedAsset.name : `sos-update-${version}.zip`,
                isPatch: false,
                sizeMB
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
  public async downloadCustomZip(url: string, customTargetPath?: string): Promise<string> {
    const isPatch = url.includes('sos-patch-') || !!this.updateStatus.versionInfo?.isPatch;
    const tempZipPath = customTargetPath || path.join(app.getPath('temp'), isPatch ? `sos-patch-${Date.now()}.zip` : `sos-update-${Date.now()}.zip`);
    fs.mkdirSync(path.dirname(tempZipPath), { recursive: true });
    this.downloadedZipPath = tempZipPath;
    const currentVersionInfo = this.updateStatus.versionInfo;

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
                versionInfo: currentVersionInfo,
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
                versionInfo: currentVersionInfo
              };
              this.sendToRenderer('app:updater-event', {
                event: 'update-downloaded',
                status: 'downloaded',
                info: currentVersionInfo
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
   * Błyskawiczne nałożenie mikropatcha OTA (podmiana app.asar lub folderu zasobów w tle)
   */
  public applyHotPatch(zipPath: string, relaunch: boolean = true): boolean {
    try {
      console.log('⚡ [Hot-Patch] Przygotowywanie instalacji patcha OTA:', zipPath, 'relaunch:', relaunch);

      // Wyznacz ścieżkę do bieżącego pakietu .app
      const execPath = process.execPath;
      const appMatch = execPath.match(/^(.+?\.app)(\/Contents\/MacOS\/.*)?$/);
      const appBundlePath = appMatch ? appMatch[1] : path.resolve(execPath, '../../..');
      const resourcesDir = path.join(appBundlePath, 'Contents/Resources');

      const tempExtractDir = path.join(app.getPath('temp'), `sos_patch_extract_${Date.now()}`);
      const scriptPath = path.join(app.getPath('temp'), `sos_patch_apply_${Date.now()}.sh`);
      const currentPid = process.pid;

      const relaunchBlock = relaunch ? `
echo "Uruchamiam zaktualizowaną aplikację: $APP_PATH"
sleep 0.2
open -n "$APP_PATH" || open "$APP_PATH"
` : 'echo "Zaktualizowano bez ponownego uruchamiania (aplikacja zamykana przez użytkownika)."';

      const bashScript = `#!/usr/bin/env bash
set -x
exec > /tmp/sos_patch.log 2>&1

PID=${currentPid}
ZIP_PATH="${zipPath}"
APP_PATH="${appBundlePath}"
RESOURCES_DIR="${resourcesDir}"
EXTRACT_DIR="${tempExtractDir}"

echo "Rozpoczynam patchowanie dla PID $PID..."

# 1. Czekaj na zakończenie bieżącego procesu aplikacji
while kill -0 $PID 2>/dev/null; do
  sleep 0.1
done

echo "Proces zakończony. Rozpakowuję patch $ZIP_PATH..."

# 2. Rozpakuj mikropatch
mkdir -p "$EXTRACT_DIR"
unzip -q -o "$ZIP_PATH" -d "$EXTRACT_DIR"

# 3. Podmień app.asar lub pliki zasobów
if [ -f "$EXTRACT_DIR/app.asar" ]; then
  echo "Podmieniam app.asar..."
  rm -f "$RESOURCES_DIR/app.asar"
  cp "$EXTRACT_DIR/app.asar" "$RESOURCES_DIR/app.asar"
fi

if [ -d "$RESOURCES_DIR/app" ] && [ -d "$EXTRACT_DIR/dist" ]; then
  echo "Podmieniam folder app..."
  cp -R "$EXTRACT_DIR/dist" "$RESOURCES_DIR/app/"
  cp -R "$EXTRACT_DIR/dist-electron" "$RESOURCES_DIR/app/"
  [ -f "$EXTRACT_DIR/package.json" ] && cp -f "$EXTRACT_DIR/package.json" "$RESOURCES_DIR/app/package.json"
fi

# 4. Zdejmij flagę kwarantanny macOS Gatekeeper
xattr -rd com.apple.quarantine "$APP_PATH" 2>/dev/null || true

# 5. Posprzątaj pliki tymczasowe
rm -rf "$EXTRACT_DIR" "$ZIP_PATH"

${relaunchBlock}
`;

      fs.writeFileSync(scriptPath, bashScript, { mode: 0o755 });

      console.log('🚀 [Hot-Patch] Uruchamianie bezpiecznego skryptu podmiany:', scriptPath);

      const child = spawn('/bin/bash', [scriptPath], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();

      if (relaunch) {
        // Zakończ natychmiast obecny proces jeśli to natychmiastowy restart
        app.exit(0);
      }
      return true;
    } catch (err) {
      console.error('❌ [Hot-Patch] Błąd przygotowania patcha:', err);
      return false;
    }
  }

  /**
   * Automatyczna podmiana aplikacji i restart na macOS
   */
  public executeInPlaceMacUpdate(): boolean {
    if (!this.downloadedZipPath || !fs.existsSync(this.downloadedZipPath)) {
      console.error('Brak pobranego pliku aktualizacji ZIP.');
      return false;
    }

    const zipPath = this.downloadedZipPath;
    const zipName = path.basename(zipPath);

    // 1. Sprawdź czy to mikropatch OTA
    let isPatch = this.updateStatus.versionInfo?.isPatch || zipName.includes('patch');
    
    // Jeśli nie jesteśmy pewni, zbadaj zawartość zipa
    if (!isPatch) {
      try {
        const { execSync } = require('child_process');
        const listOutput = execSync(`unzip -l "${zipPath}" | head -n 15`).toString();
        if (listOutput.includes('app.asar') || listOutput.includes('dist-electron') || !listOutput.includes('.app/')) {
          isPatch = true;
        }
      } catch (_) {}
    }

    if (isPatch) {
      console.log('⚡ [AutoUpdater] Wykryto paczkę Hot-Patch OTA, stosuję szybkie nałożenie...');
      return this.applyHotPatch(zipPath);
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
set -x
exec > /tmp/sos_update_full.log 2>&1

PID=${currentPid}
ZIP_PATH="${zipPath}"
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
  sleep 0.2
  open -n "$APP_PATH" || open "$APP_PATH"
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

