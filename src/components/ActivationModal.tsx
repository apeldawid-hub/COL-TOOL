// src/components/ActivationModal.tsx
/**
 * Starbucks Operations Suite — Pre-Login Station Activation Gate Modal
 * Feature F7 (Milestone 3)
 *
 * Implements:
 * - High-priority blocking overlay (z-[99998]) preventing access before station activation.
 * - Non-dismissible: cannot be closed via Escape, backdrop clicks, or close buttons.
 * - Smart input parser: accepts raw canonical key, JSON license envelopes, QR URLs, or instruction emails.
 * - Hardware Identity summary snippet with 1-click clipboard copy for DM provisioning.
 * - Submits via useAuth().activateStation(key) with feedback, error states, and auto-transition.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, 
  KeyRound, 
  CheckCircle2, 
  Copy, 
  Check, 
  Laptop, 
  AlertTriangle, 
  Sparkles, 
  ArrowRight, 
  Loader2, 
  ClipboardPaste,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LicensingService } from '../services/security/licensingService';
import type { ActiveLicenseRecord, LicenseStatusResult } from '../types/licensing';
import { ErrorBoundary } from './ErrorBoundary';

export interface ParsedActivationInput {
  cleanKey: string | null;
  formatSource: 'RAW' | 'QR_URL' | 'JSON_ENVELOPE' | 'INSTRUCTION_TEXT' | null;
  storeId?: string;
  tier?: 'STORE_CLIENT' | 'FLEET_MASTER';
  isValidFormat: boolean;
  key?: string;
  payload?: any;
  isJsonEnvelope?: boolean;
}

/**
 * Robust parser that extracts and validates activation keys from various user input formats:
 * - Canonical raw key: SBX-<storeId>-<randomHex>-<checksum>
 * - JSON envelope: {"key": "SBX-..."}
 * - QR code URL: sbx://activate?key=SBX-... or https://...?key=SBX-...
 * - Email / instruction text: "Twój klucz: SBX-... wklej w programie"
 */
export function parseActivationInput(raw: string): ParsedActivationInput {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return { cleanKey: null, key: '', formatSource: null, isValidFormat: false };
  }

  const trimmed = raw.trim();

  // 1. JSON Envelope Paste — fail-closed parsing
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const candidate = parsed.key || parsed.activationKey || parsed.fullKey;
        if (typeof candidate === 'string' && LicensingService.CANONICAL_KEY_REGEX.test(candidate.trim())) {
          const clean = candidate.trim().toUpperCase();
          const meta = LicensingService.validateKeyFormat(clean);
          if (meta.valid) {
            return {
              cleanKey: clean,
              key: clean,
              formatSource: 'JSON_ENVELOPE',
              storeId: meta.storeId,
              tier: meta.tier,
              isValidFormat: true,
              payload: parsed,
              isJsonEnvelope: true,
            };
          }
        }
      }
      return {
        cleanKey: null,
        key: '',
        formatSource: 'JSON_ENVELOPE',
        storeId: '',
        isValidFormat: false,
        payload: typeof parsed === 'object' ? parsed : null,
        isJsonEnvelope: true,
      };
    } catch (_) {
      return {
        cleanKey: null,
        key: '',
        formatSource: 'JSON_ENVELOPE',
        storeId: '',
        isValidFormat: false,
        payload: null,
        isJsonEnvelope: true,
      };
    }
  }

  // 2. QR Code URL / Deep Link Paste (e.g. sbx://activate?key=SBX-... or starbucks://...)
  if (trimmed.includes('://') || trimmed.includes('key=')) {
    const urlMatch = trimmed.match(/key=([A-Z0-9_\-]+)/i) || trimmed.match(/(?:^|[^\w-])(SBX-[A-Z0-9_]{3,16}-[A-F0-9]{16}-[A-F0-9]{10})(?![A-F0-9])/i);
    if (urlMatch && urlMatch[1] && LicensingService.CANONICAL_KEY_REGEX.test(urlMatch[1])) {
      const clean = urlMatch[1].trim().toUpperCase();
      const meta = LicensingService.validateKeyFormat(clean);
      if (meta.valid) {
        return {
          cleanKey: clean,
          key: clean,
          formatSource: 'QR_URL',
          storeId: meta.storeId,
          tier: meta.tier,
          isValidFormat: true,
        };
      }
    }
  }

  // 3. Instruction Text / Email Paste containing the key
  const textMatch = trimmed.match(/(?:^|[^\w-])SBX-([A-Z0-9_]{3,16})-([A-F0-9]{16})-([A-F0-9]{10})(?![A-F0-9])/i);
  if (textMatch) {
    const clean = `SBX-${textMatch[1]}-${textMatch[2]}-${textMatch[3]}`.toUpperCase();
    const meta = LicensingService.validateKeyFormat(clean);
    return {
      cleanKey: clean,
      key: clean,
      formatSource: trimmed.length > 50 ? 'INSTRUCTION_TEXT' : 'RAW',
      storeId: meta.storeId,
      tier: meta.tier,
      isValidFormat: meta.valid,
    };
  }

  return { cleanKey: trimmed.toUpperCase(), key: trimmed.toUpperCase(), formatSource: null, isValidFormat: false };
}

export interface ActivationModalProps {
  /** Explicit control over modal visibility (defaults to true if station is unactivated) */
  isOpen?: boolean;
  /** Callback fired immediately after successful hardware binding and persistence */
  onActivationSuccess?: (license: ActiveLicenseRecord) => void;
  /** Optional custom hardware status (falls back to useAuth().licenseStatus) */
  licenseStatus?: LicenseStatusResult | null;
  /** Enforces matching a specific expected store ID if specified */
  expectedStoreId?: string;
  /** Presentation layout: 'blocking_modal' (overlay) or 'fullscreen_gate' (standalone) */
  presentationMode?: 'blocking_modal' | 'fullscreen_gate';
}

export const ActivationModalContent: React.FC<ActivationModalProps> = ({
  isOpen = true,
  onActivationSuccess,
  licenseStatus: propsStatus,
  expectedStoreId,
}) => {
  const { isStationActivated, licenseStatus: authStatus, activateStation } = useAuth();
  const currentStatus = propsStatus || authStatus;

  const [rawInput, setRawInput] = useState('');
  const [parsed, setParsed] = useState<ParsedActivationInput>({
    cleanKey: null,
    formatSource: null,
    isValidFormat: false,
  });

  const [hwFingerprint, setHwFingerprint] = useState<string>('Pobieranie...');
  const [hwDetails, setHwDetails] = useState<{ os?: string; host?: string; cpu?: string }>({});
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [copiedHw, setCopiedHw] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successLicense, setSuccessLicense] = useState<ActiveLicenseRecord | null>(null);

  // Harvest hardware info for District Manager provisioning display
  useEffect(() => {
    let isMounted = true;
    const fetchHw = async () => {
      try {
        const fp = await LicensingService.getInstance().getHardwareFingerprint();
        if (isMounted) {
          setHwFingerprint(fp);
          const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Desktop';
          let osName = 'macOS (Zaplecze)';
          if (ua.includes('Windows')) osName = 'Windows Desktop';
          else if (ua.includes('Linux')) osName = 'Linux Client';
          setHwDetails({
            os: osName,
            host: typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'local',
          });
        }
      } catch (err) {
        if (isMounted) setHwFingerprint('hw_err_unable_to_read');
      }
    };
    fetchHw();
    return () => { isMounted = false; };
  }, []);

  // Update parsed state when raw input changes
  const handleInputChange = (val: string) => {
    setRawInput(val);
    setErrorMessage(null);
    const result = parseActivationInput(val);
    setParsed(result);
  };

  // Smart Clipboard Paste Handler
  const handlePasteFromClipboard = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          handleInputChange(text);
        }
      }
    } catch (_) {}
  };

  // Copy hardware snippet for DM
  const handleCopyHwFingerprint = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        const payload = `Starbucks Station Hardware ID:\nFingerprint: ${hwFingerprint}\nOS: ${hwDetails.os || 'Desktop'}\nTimestamp: ${new Date().toISOString()}`;
        await navigator.clipboard.writeText(payload);
        setCopiedHw(true);
        setTimeout(() => setCopiedHw(false), 2500);
      }
    } catch (_) {}
  };

  // Prevent Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Submission handler
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed.cleanKey || !parsed.isValidFormat) {
      setErrorMessage('Wprowadź prawidłowy klucz aktywacyjny w formacie SBX-<storeId>-<randomHex>-<checksum>.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await activateStation(parsed.cleanKey, expectedStoreId);
      if (res.success && res.license) {
        setSuccessLicense(res.license);
        if (onActivationSuccess) {
          onActivationSuccess(res.license);
        }
      } else {
        setErrorMessage(res.error || 'Nie udało się aktywować stacji. Sprawdź poprawność klucza.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Błąd komunikacji podczas wiązania licencji ze sprzętem.');
      setIsSubmitting(false);
    }
  };

  if (!isOpen || isStationActivated) {
    return null;
  }

  // Derive status badge content
  let statusBadge = {
    title: 'Wymagana aktywacja stacji',
    desc: 'Stacja robocza nie posiada aktywnej licencji operacyjnej.',
    color: 'bg-amber-500/15 border-amber-500/30 text-amber-700',
    icon: KeyRound,
  };

  if (currentStatus?.status === 'HARDWARE_LOCKOUT') {
    if (currentStatus.revoked) {
      statusBadge = {
        title: 'Licencja wycofana (Kill-Switch)',
        desc: 'Dostęp do stacji został zdalnie unieważniony przez Administratora Floty.',
        color: 'bg-rose-500/15 border-rose-500/30 text-rose-700',
        icon: ShieldAlert,
      };
    } else {
      statusBadge = {
        title: 'Niezgodność sprzętowa (Hardware Mismatch)',
        desc: 'Wykryto przeniesienie bazy na inny komputer bez autoryzacji.',
        color: 'bg-orange-500/15 border-orange-500/30 text-orange-700',
        icon: AlertTriangle,
      };
    }
  } else if (currentStatus?.status === 'TAMPER_DETECTED') {
    statusBadge = {
      title: 'Wykryto naruszenie integralności',
      desc: 'Plik licencji został zmodyfikowany lub uszkodzony (niepoprawny podpis HMAC).',
      color: 'bg-red-500/15 border-red-500/30 text-red-700',
      icon: ShieldAlert,
    };
  }

  return (
    <div 
      className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-[#0B1E17]/95 backdrop-blur-xl select-none animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Starbucks Gradient Accent */}
        <div className="h-2.5 bg-gradient-to-r from-[#006241] via-[#00754A] to-[#CBA258]" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#1E3932] border-2 border-[#CBA258] flex items-center justify-center shadow-lg text-2xl shrink-0">
              ☕
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-stone-900 uppercase">
                  Starbucks Operations Suite
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200">
                  Security Gate
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Pre-Login Station Activation & Hardware Binding
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div className={`p-4 rounded-2xl border flex items-start gap-3 ${statusBadge.color}`}>
            <statusBadge.icon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="block font-bold">{statusBadge.title}</strong>
              <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">{statusBadge.desc}</p>
            </div>
          </div>

          {/* Success Screen */}
          {successLicense ? (
            <div className="py-6 text-center space-y-4 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">Stacja Robocza Aktywowana!</h3>
                <p className="text-xs text-stone-600 mt-1">
                  Pomyślnie powiązano bezpieczny magazyn sprzętowy dla kawiarni:
                </p>
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono font-bold text-emerald-800">
                  <span>Lokal: {successLicense.storeId}</span>
                  <span>•</span>
                  <span>Profil: {successLicense.tier}</span>
                </div>
              </div>
              <p className="text-[11px] text-stone-400">
                Pulpit za chwilę odblokuje dostęp do logowania...
              </p>
            </div>
          ) : (
            /* Activation Key Entry Form */
            <form onSubmit={handleActivate} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#006241]" />
                    Klucz Aktywacyjny Stacji (Kryptograficzny):
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="text-[11px] font-semibold text-[#006241] hover:text-[#00754A] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    Wklej ze schowka
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={rawInput}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="SBX-18120-01A1B2C3D4E5F678-ABCDEF1234"
                    disabled={isSubmitting}
                    className={`w-full py-3.5 px-4 bg-stone-50 border rounded-2xl font-mono text-sm tracking-wide font-bold transition-all outline-none ${
                      parsed.isValidFormat
                        ? 'border-emerald-500 bg-emerald-50/20 text-emerald-900 focus:ring-2 focus:ring-emerald-500/30'
                        : rawInput.trim()
                        ? 'border-stone-300 focus:border-[#006241] focus:ring-2 focus:ring-[#006241]/20 focus:bg-white text-stone-900'
                        : 'border-stone-300 focus:border-[#006241] focus:ring-2 focus:ring-[#006241]/20 focus:bg-white text-stone-900'
                    }`}
                  />
                  {parsed.isValidFormat && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600">
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {/* Live Parsing Feedback */}
                {parsed.isValidFormat && (
                  <div className="mt-2 flex items-center justify-between text-[11px] px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      Format poprawny • Lokal: <strong className="font-mono">{parsed.storeId}</strong>
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-bold">
                      {parsed.tier || 'STORE_CLIENT'}
                    </span>
                  </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <div className="mt-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="font-medium leading-relaxed">{errorMessage}</span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !parsed.isValidFormat}
                className="w-full py-4 px-6 bg-[#006241] hover:bg-[#00754A] disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Weryfikacja kryptograficzna i wiązanie ze sprzętem...</span>
                  </>
                ) : (
                  <>
                    <span>Aktywuj i powiąż stację ze sprzętem</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Collapsible Hardware Diagnostics Footer */}
          <div className="pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="w-full flex items-center justify-between text-xs text-stone-500 hover:text-stone-800 py-1 font-medium transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5" />
                Identyfikator sprzętowy stacji roboczej (Hardware Diagnostics)
              </span>
              {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showDiagnostics && (
              <div className="mt-3 p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5 text-xs animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Odcisk sprzętowy (Fingerprint):</span>
                  <button
                    type="button"
                    onClick={handleCopyHwFingerprint}
                    className="text-[#006241] hover:underline font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    {copiedHw ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedHw ? 'Skopiowano ID' : 'Kopiuj dla District Managera'}
                  </button>
                </div>
                <div className="p-2 bg-white rounded-xl border border-stone-200 font-mono text-[11px] text-stone-700 break-all select-all">
                  {hwFingerprint}
                </div>
                <p className="text-[10px] text-stone-400 leading-relaxed">
                  Przekaż ten identyfikator swojemu District Managerowi lub IT AmRest w celu wygenerowania dedykowanego klucza aktywacyjnego dla tej stacji.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ActivationModal: React.FC<ActivationModalProps> = (props) => {
  return (
    <ErrorBoundary moduleName="Station Activation Gate" fallbackTitle="Błąd w bramce aktywacyjnej stacji">
      <ActivationModalContent {...props} />
    </ErrorBoundary>
  );
};
