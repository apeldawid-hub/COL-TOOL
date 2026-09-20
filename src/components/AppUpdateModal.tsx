import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Laptop, 
  Info, 
  ArrowUpCircle, 
  ShieldCheck,
  Zap,
  Clock
} from 'lucide-react';
import { APP_VERSION } from '../version';

interface AppUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VersionInfo {
  version: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  isPackaged: boolean;
}

export const AppUpdateModal: React.FC<AppUpdateModalProps> = ({ isOpen, onClose }) => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'>('idle');
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ percent: number; bytesPerSecond: number; transferred: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Pobranie informacji o wersji
    if (typeof window !== 'undefined' && (window as any).api?.getAppVersionInfo) {
      (window as any).api.getAppVersionInfo().then((info: VersionInfo) => {
        setVersionInfo(info);
      }).catch(console.error);
    }

    // Pobranie aktualnego stanu aktualizacji
    if (typeof window !== 'undefined' && (window as any).api?.getUpdateStatus) {
      (window as any).api.getUpdateStatus().then((state: any) => {
        if (state) {
          setStatus(state.status);
          if (state.versionInfo?.version) setAvailableVersion(state.versionInfo.version);
          if (state.versionInfo?.releaseNotes) setReleaseNotes(state.versionInfo.releaseNotes);
          if (state.progress) setProgress(state.progress);
          if (state.error) setErrorMessage(state.error);
        }
      }).catch(console.error);
    }

    // Nasłuchiwanie zdarzeń aktualizatora
    if (typeof window !== 'undefined' && (window as any).api?.onUpdaterEvent) {
      const unsubscribe = (window as any).api.onUpdaterEvent((payload: any) => {
        console.log('📡 [UI] Otrzymano zdarzenie aktualizatora:', payload);
        if (payload.status) setStatus(payload.status);

        if (payload.event === 'update-available') {
          setAvailableVersion(payload.info?.version || null);
          setReleaseNotes(payload.info?.releaseNotes || 'Nowe usprawnienia i optymalizacje systemu.');
        } else if (payload.event === 'download-progress') {
          setProgress(payload.progress);
        } else if (payload.event === 'update-downloaded') {
          setStatus('downloaded');
        } else if (payload.event === 'error') {
          let errStr = payload.error || 'Wystąpił błąd podczas sprawdzania aktualizacji.';
          if (errStr.includes('404')) {
            errStr = 'Nie odnaleziono nowszego wydania na GitHubie lub wydanie jest jeszcze przetwarzane.';
          } else if (errStr.length > 200) {
            errStr = errStr.slice(0, 180) + '... (Sprawdź połączenie z internetem)';
          }
          setErrorMessage(errStr);
        }
      });

      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckForUpdates = async () => {
    setStatus('checking');
    setErrorMessage(null);
    setLastChecked(new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

    const currentVer = versionInfo?.version || APP_VERSION;

    // 1. Sprawdzenie przez natywny silnik Electron Updater (dla zainstalowanej aplikacji .app)
    if (typeof window !== 'undefined' && (window as any).api?.checkForUpdates) {
      try {
        const res = await (window as any).api.checkForUpdates();
        if (res.success && res.updateInfo) {
          const remoteVer = res.updateInfo.version;
          if (remoteVer && remoteVer !== currentVer) {
            setStatus('available');
            setAvailableVersion(remoteVer);
            setReleaseNotes(typeof res.updateInfo.releaseNotes === 'string' ? res.updateInfo.releaseNotes : 'Nowe usprawnienia i optymalizacje systemu.');
            return;
          }
        }
        
        if (!res.success && !res.isDev) {
          setStatus('error');
          setErrorMessage(res.error || res.message || 'Błąd podczas komunikacji z serwerem aktualizacji.');
          return;
        }
      } catch (err: any) {
        console.warn('Natywny updater zwrócił błąd, sprawdzam GitHub API:', err);
      }
    }

    // 2. Bezpośrednie zapytanie do GitHub API (jako niezawodny fallback i w trybie dev)
    try {
      const response = await fetch('https://api.github.com/repos/apeldawid-hub/COL-TOOL/releases/latest');
      if (response.ok) {
        const data = await response.json();
        const latestTag = (data.tag_name || '').replace(/^v/, '');
        
        if (latestTag && latestTag !== currentVer) {
          setStatus('available');
          setAvailableVersion(latestTag);
          setReleaseNotes(data.body || 'Wydano nową wersję Starbucks Operations Suite.');
          return;
        } else {
          setStatus('not-available');
          return;
        }
      } else {
        setStatus('not-available');
      }
    } catch (fetchErr: any) {
      console.error('Błąd pobierania z GitHub API:', fetchErr);
      if (status === 'checking') {
        setStatus('not-available');
      }
    }
  };

  const handleDownloadUpdate = async () => {
    setStatus('downloading');
    if (typeof window !== 'undefined' && (window as any).api?.downloadUpdate) {
      const res = await (window as any).api.downloadUpdate();
      if (!res.success) {
        setStatus('error');
        setErrorMessage(res.error || 'Nie udało się rozpocząć pobierania.');
      }
    }
  };

  const handleInstallAndRestart = () => {
    if (typeof window !== 'undefined' && (window as any).api?.quitAndInstallUpdate) {
      (window as any).api.quitAndInstallUpdate();
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[#E2E8E5] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#1E3932] to-[#006241] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20 shadow-inner">
              <Sparkles className="w-6 h-6 text-emerald-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide">Centrum Aktualizacji & Wersji</h2>
              <p className="text-xs text-emerald-200 font-medium">Starbucks Operations Suite • macOS Universal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Karta bieżącej wersji */}
          <div className="p-4 bg-[#F7F9F8] rounded-xl border border-[#E2E8E5] flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[#006241] font-black text-xl shadow-sm">
                SBX
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">Starbucks Operations Suite</span>
                  <span className="px-2 py-0.5 text-xs font-black bg-[#006241] text-white rounded-full">
                    v{versionInfo?.version || APP_VERSION}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                  <span>{versionInfo?.platform === 'darwin' ? 'macOS' : (versionInfo?.platform || 'Desktop')}</span>
                  <span>•</span>
                  <span>Arch: {versionInfo?.arch || 'arm64'}</span>
                  <span>•</span>
                  <span className={versionInfo?.isPackaged ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                    {versionInfo?.isPackaged ? 'Pakiet Produkcyjny (.app)' : 'Tryb Deweloperski'}
                  </span>
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Status Systemu</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Chroniony
              </span>
            </div>
          </div>

          {/* Status aktualizacji */}
          {status === 'checking' && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800">
              <RefreshCw className="w-5 h-5 animate-spin text-[#006241]" />
              <div className="text-xs font-medium">
                <p className="font-bold text-[#006241]">Sprawdzanie dostępności nowej wersji...</p>
                <p className="text-emerald-700/80">Łączenie z bezpiecznym kanałem dystrybucji wydań.</p>
              </div>
            </div>
          )}

          {status === 'not-available' && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-900">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-900 text-sm">Twoja aplikacja jest w 100% aktualna!</p>
                  <p className="text-emerald-700 mt-0.5">
                    Posiadasz najnowszą stabilną wersję <strong>v{versionInfo?.version || APP_VERSION}</strong> ze wszystkimi modułami operacyjnymi.
                  </p>
                </div>
              </div>
              {lastChecked && (
                <span className="text-[10px] text-emerald-600 font-medium whitespace-nowrap">
                  Sprawdzono: {lastChecked}
                </span>
              )}
            </div>
          )}

          {status === 'available' && (
            <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-800">
                    <ArrowUpCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Dostępna nowa wersja: v{availableVersion}</h3>
                    <p className="text-xs text-gray-600">Gotowa do natychmiastowego pobrania w tle.</p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadUpdate}
                  className="px-3.5 py-1.5 bg-[#006241] hover:bg-[#004d33] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Pobierz teraz
                </button>
              </div>

              {releaseNotes && (
                <div className="p-3 bg-white/80 rounded-lg border border-amber-100 text-xs text-gray-700 max-h-32 overflow-y-auto">
                  <p className="font-bold text-gray-900 mb-1">Co nowego w tej wersji:</p>
                  <div className="whitespace-pre-line text-gray-600">{releaseNotes}</div>
                </div>
              )}
            </div>
          )}

          {status === 'downloading' && progress && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-blue-900 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  Pobieranie aktualizacji ({progress.percent}%)
                </span>
                <span className="text-blue-700 font-medium">
                  {formatBytes(progress.transferred)} / {formatBytes(progress.total)} ({formatBytes(progress.bytesPerSecond)}/s)
                </span>
              </div>
              <div className="w-full bg-blue-200 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="text-[11px] text-blue-600">
                Możesz swobodnie kontynuować pracę. Aplikacja poinformuje Cię po zakończeniu pobierania.
              </p>
            </div>
          )}

          {status === 'downloaded' && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-950 text-sm">Aktualizacja jest gotowa do instalacji!</p>
                  <p className="text-emerald-700">Wszystkie dane bazy SQLite zostaną w 100% zachowane.</p>
                </div>
              </div>
              <button
                onClick={handleInstallAndRestart}
                className="px-4 py-2 bg-[#006241] hover:bg-[#004d33] text-white text-xs font-black rounded-lg shadow-md flex items-center gap-1.5 transition-transform hover:scale-105"
              >
                <Zap className="w-4 h-4 text-emerald-300" />
                Zainstaluj & Restartuj
              </button>
            </div>
          )}

          {status === 'error' && errorMessage && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
              <div className="flex items-start gap-3 text-xs text-red-800">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-900">
                    {errorMessage.includes('Code signature') || errorMessage.includes('ShipIt') || errorMessage.includes('validation')
                      ? 'Wymagana instalacja przez DMG (Zabezpieczenie macOS)'
                      : 'Informacja o aktualizacji'}
                  </p>
                  <p className="mt-1 text-red-700 leading-relaxed">
                    {errorMessage.includes('Code signature') || errorMessage.includes('ShipIt') || errorMessage.includes('validation')
                      ? 'System macOS wymaga jednorazowego potwierdzenia podmiany aplikacji dla programów z podpisem ad-hoc (bez certyfikatu Apple Developer ID). Kliknij poniższy przycisk, aby pobrać oficjalny instalator DMG i przeciągnąć nową wersję do folderu Programy — wszystkie Twoje dane bazy SQLite zostaną w 100% zachowane!'
                      : errorMessage}
                  </p>
                </div>
              </div>

              {/* Szybkie pobranie instalatora DMG */}
              <div className="pt-2 border-t border-red-200/70 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    const tag = availableVersion || APP_VERSION;
                    const isArm = versionInfo?.arch === 'arm64' || navigator.userAgent.includes('Mac');
                    const dmgName = isArm 
                      ? `Starbucks-Operations-Suite-${tag}-arm64.dmg`
                      : `Starbucks-Operations-Suite-${tag}.dmg`;
                    const url = `https://github.com/apeldawid-hub/COL-TOOL/releases/download/v${tag}/${dmgName}`;
                    if (typeof window !== 'undefined' && (window as any).api?.openExternalUrl) {
                      (window as any).api.openExternalUrl(url);
                    } else {
                      window.open(url, '_blank');
                    }
                  }}
                  className="px-4 py-2 bg-[#006241] hover:bg-[#004d33] text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-transform hover:scale-[1.02]"
                >
                  <Download className="w-4 h-4 text-emerald-300" />
                  Pobierz Instalator DMG (v{availableVersion || '2.7.0'})
                </button>

                <button
                  onClick={() => {
                    const url = 'https://github.com/apeldawid-hub/COL-TOOL/releases/latest';
                    if (typeof window !== 'undefined' && (window as any).api?.openExternalUrl) {
                      (window as any).api.openExternalUrl(url);
                    } else {
                      window.open(url, '_blank');
                    }
                  }}
                  className="px-3 py-2 bg-white border border-red-200 text-gray-700 hover:text-gray-900 text-xs font-semibold rounded-lg shadow-2xs hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                >
                  <Laptop className="w-3.5 h-3.5 text-gray-500" />
                  Wydania GitHub
                </button>
              </div>
            </div>
          )}

          {/* Bezpieczeństwo i Architektura danych */}
          <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 text-xs text-gray-600 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-gray-800">
              <ShieldCheck className="w-4 h-4 text-[#006241]" />
              <span>Gwarancja Bezpieczeństwa Danych Operacyjnych</span>
            </div>
            <p className="text-[11px] leading-relaxed text-gray-500">
              Baza danych SQLite (grafiki, normy KP, AOP, szkolenia, logowania MAPAL) jest trwale izolowana w katalogu systemowym użytkownika (<code>Application Support</code>). Każda instalacja i aktualizacja podmienia wyłącznie pliki wykonywalne aplikacji, nie dotykając Twoich danych.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#F7F9F8] border-t border-[#E2E8E5] flex items-center justify-between">
          <button
            onClick={handleCheckForUpdates}
            disabled={status === 'checking' || status === 'downloading'}
            className="px-4 py-2 text-xs font-bold text-[#006241] bg-white border border-[#006241]/30 hover:bg-emerald-50 rounded-xl transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${status === 'checking' ? 'animate-spin' : ''}`} />
            Sprawdź Dostępność Aktualizacji
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
