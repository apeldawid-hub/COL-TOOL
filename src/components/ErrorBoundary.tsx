// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  AlertOctagon,
  RefreshCw,
  Copy,
  Bug,
  Home,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react';
import { logger } from '../services/logger';
import { BugReporterModal } from './BugReporterModal';

interface Props {
  children: ReactNode;
  moduleName?: string;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showTechnicalDetails: boolean;
  isBugModalOpen: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showTechnicalDetails: false,
      isBugModalOpen: false,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    const moduleName = this.props.moduleName || 'ReactUI';

    logger.fatal(
      `ErrorBoundary:${moduleName}`,
      `Przechwycono błąd renderowania: ${error.message}`,
      error.stack,
      {
        componentStack: errorInfo.componentStack,
        moduleName,
      }
    );

    // Cicha automatyczna telemetria do GitHub Issues (bez przeszkadzania użytkownikowi)
    logger.submitGitHubIssue({
      category: 'CRASH',
      moduleName,
      userDescription: `Automatycznie przechwycona awaria modułu: ${error.message}`,
      errorStack: error.stack,
      isAutomatic: true,
    }).catch(() => {});
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showTechnicalDetails: false,
      copied: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleCopyError = async () => {
    const errorText = `=========================================
STARBUCKS OPERATIONS SUITE — RAPORT AWARII
=========================================
Moduł:      ${this.props.moduleName || 'Główny'}
Błąd:       ${this.state.error?.message || 'Nieznany błąd'}
Czas:       ${new Date().toLocaleString('pl-PL')}

STACK TRACE:
${this.state.error?.stack || 'Brak stack trace'}

COMPONENT STACK:
${this.state.errorInfo?.componentStack || 'Brak component stack'}
=========================================`;

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    } catch {}
  };

  render() {
    if (this.state.hasError) {
      const moduleName = this.props.moduleName || 'Starbucks Operations Suite';
      const errorMessage = this.state.error?.message || 'Wystąpił nieoczekiwany błąd podczas renderowania.';

      return (
        <div className="w-full h-full min-h-[500px] flex items-center justify-center p-6 bg-[#090f0c] text-slate-100 animate-in fade-in duration-300">
          <div className="max-w-xl w-full bg-[#121a15] border border-emerald-900/60 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            {/* Tło akcentu */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#006241]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3.5 bg-rose-950/80 border border-rose-700/60 rounded-2xl text-rose-400 shrink-0 shadow-lg shadow-rose-950/40">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold px-2.5 py-0.5 bg-rose-950/60 text-rose-300 border border-rose-800/40 rounded-full uppercase tracking-wider">
                    Tarcza Awaryjna
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{moduleName}</span>
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">
                  {this.props.fallbackTitle || 'Coś poszło nie tak'}
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Aplikacja bezpiecznie zatrzymała renderowanie modułu. Twoje dane w bazie SQLite są nienaruszone i bezpieczne.
                </p>
              </div>
            </div>

            {/* Error banner */}
            <div className="bg-[#19241e] border border-emerald-900/40 rounded-2xl p-4 mb-5 text-xs">
              <div className="font-semibold text-rose-300 flex items-center gap-2 mb-1">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Komunikat błędu:</span>
              </div>
              <p className="font-mono text-[11px] text-slate-300 bg-[#0c1310] p-2.5 rounded-xl border border-emerald-950 break-words">
                {errorMessage}
              </p>
            </div>

            {/* Zwijane szczegóły techniczne */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => this.setState({ showTechnicalDetails: !this.state.showTechnicalDetails })}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>{this.state.showTechnicalDetails ? 'Ukryj szczegóły techniczne' : 'Pokaż szczegóły techniczne (Stack trace)'}</span>
                {this.state.showTechnicalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {this.state.showTechnicalDetails && (
                <div className="mt-3 p-3 bg-[#080d0a] border border-emerald-950 rounded-2xl max-h-48 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-2">
                  <div>
                    <strong className="text-slate-300">Stack Trace:</strong>
                    <pre className="mt-1 whitespace-pre-wrap text-rose-300/80">
                      {this.state.error?.stack || 'Brak stosu wywołań'}
                    </pre>
                  </div>
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <strong className="text-slate-300">Drzewo komponentu:</strong>
                      <pre className="mt-1 whitespace-pre-wrap text-slate-400">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Przyciski akcji */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-emerald-900/30">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2.5 bg-gradient-to-r from-[#006241] to-[#00754A] hover:from-[#00754A] hover:to-[#00875A] text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Odśwież moduł</span>
              </button>

              <button
                type="button"
                onClick={this.handleCopyError}
                className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all border border-slate-700/60"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{this.state.copied ? 'Skopiowano!' : 'Kopiuj błąd'}</span>
              </button>

              <button
                type="button"
                onClick={() => this.setState({ isBugModalOpen: true })}
                className="px-3.5 py-2.5 bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/50 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
              >
                <Bug className="w-3.5 h-3.5" />
                <span>Zgłoś uwagę</span>
              </button>
            </div>
          </div>

          {/* Modal zgłaszania błędu */}
          <BugReporterModal
            isOpen={this.state.isBugModalOpen}
            onClose={() => this.setState({ isBugModalOpen: false })}
            initialError={{
              message: this.state.error?.message,
              stack: this.state.error?.stack,
              moduleName: this.props.moduleName,
            }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
