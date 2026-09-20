// src/components/BugReporterModal.tsx
import React, { useState, useEffect } from 'react';
import {
  X,
  Bug,
  CheckCircle2,
  AlertCircle,
  Copy,
  FolderOpen,
  FileDown,
  Terminal,
  ChevronDown,
  ChevronUp,
  Cpu,
  Sparkles,
  ExternalLink,
  Send,
} from 'lucide-react';
import { logger, ClientLogEntry } from '../services/logger';

interface BugReporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialError?: {
    message?: string;
    stack?: string;
    moduleName?: string;
  };
}

export const BugReporterModal: React.FC<BugReporterModalProps> = ({
  isOpen,
  onClose,
  initialError,
}) => {
  const [category, setCategory] = useState<string>('CRASH');
  const [description, setDescription] = useState<string>('');
  const [moduleName, setModuleName] = useState<string>(initialError?.moduleName || 'Labor Forecast');
  const [recentLogs, setRecentLogs] = useState<ClientLogEntry[]>([]);
  const [showLogsPreview, setShowLogsPreview] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSubmittingGitHub, setIsSubmittingGitHub] = useState<boolean>(false);
  const [createdIssueUrl, setCreatedIssueUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [appInfo, setAppInfo] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialError?.moduleName) {
        setModuleName(initialError.moduleName);
      }
      if (initialError?.message) {
        setDescription(`Wystąpił błąd: ${initialError.message}`);
      }

      // Załaduj logi i wersję aplikacji
      logger.getPersistedLogs(40).then((logs) => setRecentLogs(logs));

      const api = (window as any).api;
      if (api?.getAppVersionInfo) {
        api.getAppVersionInfo().then((info: any) => setAppInfo(info)).catch(() => {});
      }
    }
  }, [isOpen, initialError]);

  if (!isOpen) return null;

  const getFormattedReport = () => {
    const timeStr = new Date().toLocaleString('pl-PL');
    const logsSnippet = recentLogs
      .slice(-15)
      .map((l) => `[${l.timestamp.substring(11, 19)}] [${l.level}] [${l.source}]: ${l.message}`)
      .join('\n');

    return `=========================================
STARBUCKS OPERATIONS SUITE — ZGŁOSZENIE BŁĘDU
=========================================
Data zgłoszenia: ${timeStr}
Kategoria:       ${category}
Moduł:           ${moduleName}
Wersja App:      ${appInfo?.version || '2.6.0'} (${appInfo?.platform || 'darwin'} ${appInfo?.arch || 'arm64'})

OPIS UŻYTKOWNIKA:
${description || '(Brak dodatkowego opisu)'}

${initialError?.stack ? `\nSTACK TRACE AWARII:\n${initialError.stack}\n` : ''}
--- OSTATNIE LOGI SYSTEMOWE (CZARNA SKRZYNKA) ---
${logsSnippet || '(Brak zarejestrowanych wpisów)'}
=========================================`;
  };

  const handleCopyToClipboard = async () => {
    try {
      const text = getFormattedReport();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setStatusMessage({
        type: 'success',
        text: '📋 Raport został skopiowany do schowka! Możesz go wkleić na czacie.',
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setStatusMessage({ type: 'error', text: 'Nie udało się skopiować do schowka.' });
    }
  };

  const handleSaveReport = async () => {
    if (!description.trim()) {
      setStatusMessage({ type: 'error', text: 'Wpisz krótki opis, co się wydarzyło przed zapisem.' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await logger.saveBugReport({
        category,
        moduleName,
        userDescription: description,
        clientInfo: {
          appVersion: appInfo?.version || '2.6.0',
          platform: appInfo?.platform || 'darwin',
          arch: appInfo?.arch || 'arm64',
          nodeVersion: appInfo?.nodeVersion || '',
          chromeVersion: appInfo?.chromeVersion || '',
          electronVersion: appInfo?.electronVersion || '',
          systemTime: new Date().toISOString(),
        },
        errorStack: initialError?.stack,
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `✅ Zapisano zgłoszenie jako ${res.reportId}. Raport trafił do lokalnego archiwum.`,
        });
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Błąd zapisu zgłoszenia.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Wystąpił błąd: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitGitHub = async () => {
    if (!description.trim()) {
      setStatusMessage({ type: 'error', text: 'Wpisz krótki opis przed wysłaniem na GitHub.' });
      return;
    }

    setIsSubmittingGitHub(true);
    setStatusMessage(null);
    setCreatedIssueUrl(null);

    try {
      const res = await logger.submitGitHubIssue({
        category,
        moduleName,
        userDescription: description,
        clientInfo: {
          appVersion: appInfo?.version || '2.6.0',
          platform: appInfo?.platform || 'darwin',
          arch: appInfo?.arch || 'arm64',
          systemTime: new Date().toISOString(),
        },
        errorStack: initialError?.stack,
      });

      if (res.success) {
        if (res.issueUrl) setCreatedIssueUrl(res.issueUrl);
        setStatusMessage({
          type: 'success',
          text: res.message,
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || 'Nie udało się przesłać zgłoszenia na GitHub.',
        });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Błąd wysyłki: ${err.message}` });
    } finally {
      setIsSubmittingGitHub(false);
    }
  };

  const handleExportDiagnostics = async () => {
    try {
      const res = await logger.exportDiagnostics();
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `📁 ${res.message}`,
        });
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Błąd eksportu.' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  const handleOpenLogsFolder = async () => {
    const success = await logger.openLogsFolder();
    if (!success) {
      setStatusMessage({ type: 'error', text: 'Nie udało się otworzyć folderu w Finderze.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121915] border border-emerald-800/40 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0a110d] border-b border-emerald-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-950/80 border border-emerald-700/50 rounded-xl text-emerald-400">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Centrum Zgłaszania Błędów & Diagnostyki
                <span className="text-xs px-2 py-0.5 bg-emerald-900/60 text-emerald-300 rounded-full font-mono border border-emerald-700/30">
                  Czarna Skrzynka
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Lokalny rejestrator zdarzeń i bezpieczny generator raportów technicznych
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-200">
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-200'
                  : 'bg-rose-950/70 border-rose-700/60 text-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <div>{statusMessage.text}</div>
                {createdIssueUrl && (
                  <a
                    href={createdIssueUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-100 underline font-semibold mt-1"
                  >
                    <span>Zobacz zgłoszenie na GitHubie</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Kategoria & Moduł */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Kategoria problemu
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#18231e] border border-emerald-800/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="CRASH">💥 Błąd krytyczny / Biały ekran / Zacięcie</option>
                <option value="CALCULATION">🧮 Błąd w obliczeniach (TPLH / KP / COL)</option>
                <option value="IMPORT_EXPORT">📊 Problem z importem Excel / Raportów</option>
                <option value="UI_UX">🎨 Błąd interfejsu / Niedziałający przycisk</option>
                <option value="SUGGESTION">💡 Sugestia ulepszenia lub nowej funkcji</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Aktywny moduł
              </label>
              <select
                value={moduleName}
                onChange={(e) => setModuleName(e.target.value)}
                className="w-full bg-[#18231e] border border-emerald-800/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Labor Forecast">Moduł 1: TPLH Forecast & Labor</option>
                <option value="Managers Schedule">Moduł 2: Grafik Managerski</option>
                <option value="Trainings Suite">Moduł 3: Szkolenia (Training Suite)</option>
                <option value="COL Calculator">Moduł 4: COL Calculator</option>
                <option value="System Core">System Core / Import / Baza Danych</option>
              </select>
            </div>
          </div>

          {/* Opis */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Co dokładnie się wydarzyło? (Kroki do odtworzenia)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Np. Kliknąłem w przycisk 'Import' na pasku bocznym i zamiast okna pojawił się błąd..."
              className="w-full bg-[#18231e] border border-emerald-800/40 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Info o środowisku */}
          <div className="bg-[#18231e]/70 border border-emerald-900/30 rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>
                Środowisko: <strong className="text-white">v{appInfo?.version || '2.6.0'}</strong> (macOS {appInfo?.arch || 'arm64'})
              </span>
            </div>
            <div className="text-slate-400">
              Logi w buforze: <strong className="text-emerald-400">{recentLogs.length}</strong>
            </div>
          </div>

          {/* Podgląd Czarnej Skrzynki */}
          <div className="border border-emerald-900/40 rounded-xl overflow-hidden bg-[#0c1410]">
            <button
              type="button"
              onClick={() => setShowLogsPreview(!showLogsPreview)}
              className="w-full px-3 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Podgląd ostatnich zdarzeń Czarnej Skrzynki ({recentLogs.length})</span>
              </div>
              {showLogsPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showLogsPreview && (
              <div className="p-3 border-t border-emerald-900/40 max-h-44 overflow-y-auto font-mono text-[11px] space-y-1 bg-[#060a08] text-slate-300">
                {recentLogs.length === 0 ? (
                  <div className="text-slate-500 italic">Brak zarejestrowanych wpisów błędów.</div>
                ) : (
                  recentLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`leading-tight py-0.5 ${
                        log.level === 'ERROR' || log.level === 'FATAL'
                          ? 'text-rose-400'
                          : log.level === 'WARN'
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      <span className="text-slate-600">[{log.timestamp.substring(11, 19)}]</span>{' '}
                      <span className="font-bold">[{log.level}]</span>{' '}
                      <span className="text-emerald-500">[{log.source}]:</span> {log.message}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#0a110d] border-t border-emerald-900/40 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenLogsFolder}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-700/50"
              title="Otwórz folder logów w Finderze"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Folder logów</span>
            </button>
            <button
              type="button"
              onClick={handleExportDiagnostics}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border border-slate-700/50"
              title="Eksportuj raport .txt na Biurko"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Eksportuj .txt</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyToClipboard}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Skopiowano!' : 'Kopiuj'}</span>
            </button>

            <button
              type="button"
              onClick={handleSaveReport}
              disabled={isSaving || isSubmittingGitHub}
              className="px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="Zapisz lokalnie w archiwum JSON"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Zapisywanie...' : 'Zapisz plik'}</span>
            </button>

            <button
              type="button"
              onClick={handleSubmitGitHub}
              disabled={isSubmittingGitHub || isSaving}
              className="px-4 py-1.5 bg-gradient-to-r from-[#006241] to-[#00754A] hover:from-[#00754A] hover:to-[#00875A] text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className={`w-3.5 h-3.5 ${isSubmittingGitHub ? 'animate-pulse' : ''}`} />
              <span>{isSubmittingGitHub ? 'Wysyłanie...' : '🐙 Wyślij na GitHub'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
