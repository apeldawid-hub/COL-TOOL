// src/components/ActivationModal.tsx
/**
 * Starbucks Operations Suite — Pre-Login Station Activation & Device Enrollment Gate
 * Implements the 4-step Store Manager Onboarding Workflow:
 * 1. Fresh app launch on SM laptop (unactivated state)
 * 2. Registration with corporate @amrest.eu / @starbucks.com email & 6-digit OTP verification
 * 3. Pending Approval state: laptop binds hardware fingerprint and waits for manager approval
 * 4. Automatic activation once Managing Director / Fleet Master approves the request
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronUp,
  Mail,
  User,
  Clock,
  RefreshCw,
  Send,
  XCircle,
  Lock,
  Building2,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LicensingService, licensingService } from '../services/security/licensingService';
import type { ActiveLicenseRecord, LicenseStatusResult } from '../types/licensing';
import { ErrorBoundary } from './ErrorBoundary';
import { enrollmentService } from '../services/admin/enrollmentService';
import { AppUserRole, PendingAccessRequest } from '../types/admin';
import { AuthService } from '../services/auth/authService';

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

type OnboardingStep = 'REGISTER' | 'VERIFY_OTP' | 'PENDING_APPROVAL' | 'MANUAL_KEY';

export const ActivationModal: React.FC<ActivationModalProps> = ({
  isOpen = true,
  onActivationSuccess,
  licenseStatus,
  expectedStoreId,
  presentationMode = 'blocking_modal',
}) => {
  const { activateStation, isStationActivated, licenseStatus: contextStatus } = useAuth();
  const currentStatus = licenseStatus || contextStatus;

  // Główny krok procesu
  const [step, setStep] = useState<OnboardingStep>('REGISTER');

  // Dane rejestracyjne kierownika
  const [fullName, setFullName] = useState<string>(() => localStorage.getItem('sbx_user_name') || '');
  const [email, setEmail] = useState<string>(() => localStorage.getItem('sbx_user_email') || '');
  const [role, setRole] = useState<AppUserRole>('STORE_MANAGER');
  const [requestNote, setRequestNote] = useState<string>('');

  // 6-cyfrowy kod weryfikacyjny (OTP)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpTimerSeconds, setOtpTimerSeconds] = useState<number>(300);
  const [simulatedOtpCode, setSimulatedOtpCode] = useState<string | null>(null);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Stan zgłoszenia w toku
  const [pendingRequest, setPendingRequest] = useState<PendingAccessRequest | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  // Formularz wprowadzania ręcznego klucza (dla wstecznej kompatybilności / admina)
  const [rawInput, setRawInput] = useState('');
  const [parsed, setParsed] = useState<ParsedActivationInput>({ cleanKey: null, key: '', formatSource: null, isValidFormat: false });

  // Stan ogólny
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successLicense, setSuccessLicense] = useState<ActiveLicenseRecord | null>(null);
  const [approvedNotification, setApprovedNotification] = useState<string | null>(null);

  // Hardware snapshot
  const [hwFingerprint, setHwFingerprint] = useState<string>('Pobieranie...');
  const deviceName = AuthService.getDeviceName();

  // Inicjalizacja: sprawdzenie czy dla tego laptopa istnieje już oczekujący wniosek
  useEffect(() => {
    let isMounted = true;
    const checkExistingEnrollment = async () => {
      try {
        const hw = await licensingService.getHardwareFingerprint();
        if (isMounted) setHwFingerprint(hw);

        const existing = await enrollmentService.getCurrentDeviceEnrollment();
        if (existing && isMounted) {
          setPendingRequest(existing);
          if (existing.status === 'PENDING') {
            setStep('PENDING_APPROVAL');
            setFullName(existing.fullName);
            setEmail(existing.email);
            setRole(existing.requestedRole);
          } else if (existing.status === 'APPROVED' && existing.assignedLicenseKey) {
            // Automatyczna aktywacja jeśli wniosek został już zatwierdzony w tle
            handleAutoActivate(existing);
          }
        }
      } catch (err) {
        console.warn('[ActivationModal] Błąd inicjalizacji wniosku:', err);
      }
    };

    checkExistingEnrollment();
    return () => {
      isMounted = false;
    };
  }, []);

  // Odliczanie czasu ważności kodu OTP (5 min)
  useEffect(() => {
    if (step !== 'VERIFY_OTP') return;
    const timer = setInterval(() => {
      setOtpTimerSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  // Automatyczne odpytywanie o status wniosku co 5 sekund w stanie PENDING_APPROVAL
  useEffect(() => {
    if (step !== 'PENDING_APPROVAL' || !pendingRequest || isStationActivated) return;

    const interval = setInterval(async () => {
      try {
        const latest = await enrollmentService.getCurrentDeviceEnrollment();
        if (latest) {
          setPendingRequest(latest);
          if (latest.status === 'APPROVED' && latest.assignedLicenseKey) {
            handleAutoActivate(latest);
          }
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [step, pendingRequest, isStationActivated]);

  // Automatyczna aktywacja po zatwierdzeniu przez Managera Zarządzającego
  const handleAutoActivate = async (approvedReq: PendingAccessRequest) => {
    if (!approvedReq.assignedLicenseKey) return;
    setIsSubmitting(true);
    setApprovedNotification(
      `🎉 Dostęp zatwierdzony! Przydzielono: ${approvedReq.assignedStoreName || approvedReq.assignedStoreId || 'Kawiarnia'}. Aktywuję stację...`
    );

    try {
      const res = await activateStation(approvedReq.assignedLicenseKey, approvedReq.assignedStoreId);
      if (res.success && res.license) {
        // Zapisz dane użytkownika i kawiarni
        try {
          localStorage.setItem('sbx_user_name', approvedReq.fullName);
          localStorage.setItem('sbx_user_email', approvedReq.email);
          localStorage.setItem('sbx_user_role', approvedReq.assignedRole || approvedReq.requestedRole);
          if (approvedReq.assignedStoreId) localStorage.setItem('sbx_unit_code', approvedReq.assignedStoreId);
          if (approvedReq.assignedStoreName) localStorage.setItem('sbx_store_name', approvedReq.assignedStoreName);
          localStorage.setItem('sbx_onboarding_completed', 'true');
        } catch {}

        setSuccessLicense(res.license);
        setTimeout(() => {
          if (onActivationSuccess) onActivationSuccess(res.license!);
        }, 1200);
      } else {
        setErrorMessage(res.error || 'Błąd wiązania licencji z urządzeniem.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Błąd automatycznej aktywacji.');
      setIsSubmitting(false);
    }
  };

  // Krok 1 ➔ 2: Wysłanie kodu OTP na maila
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Wprowadź swoje Imię i Nazwisko.');
      return;
    }

    if (!email.trim()) {
      setErrorMessage('Wprowadź służbowy adres e-mail @amrest.eu lub @starbucks.com.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await enrollmentService.requestEmailOtp(email);
      if (res.success) {
        setStep('VERIFY_OTP');
        setOtpDigits(['', '', '', '', '', '']);
        setOtpTimerSeconds(300);
        if (res.simulatedCode) {
          setSimulatedOtpCode(res.simulatedCode);
        }
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 150);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Wystąpił błąd podczas wysyłania kodu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Obsługa wpisywania 6 cyfr OTP
  const handleOtpDigitChange = (index: number, val: string) => {
    const numeric = val.replace(/[^0-9]/g, '');
    const next = [...otpDigits];
    if (!numeric) {
      next[index] = '';
      setOtpDigits(next);
      return;
    }
    next[index] = numeric.slice(-1);
    setOtpDigits(next);

    if (index < 5 && numeric) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setOtpDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIdx]?.focus();
  };

  // Krok 2 ➔ 3: Weryfikacja kodu OTP i wysłanie wniosku urządzenia
  const handleVerifyOtpAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setErrorMessage('Wprowadź pełny 6-cyfrowy kod z wiadomości e-mail.');
      return;
    }

    setIsSubmitting(true);
    try {
      const verifyRes = enrollmentService.verifyEmailOtp(email, code);
      if (!verifyRes.success) {
        setErrorMessage(verifyRes.message);
        setIsSubmitting(false);
        return;
      }

      // Sukces weryfikacji maila ➔ Utworzenie zgłoszenia laptopa
      const submitRes = await enrollmentService.submitEnrollmentRequest({
        fullName,
        email,
        requestedRole: role,
        requestNote,
      });

      if (submitRes.success && submitRes.request) {
        setPendingRequest(submitRes.request);
        setStep('PENDING_APPROVAL');
      } else {
        setErrorMessage(submitRes.message || 'Nie udało się zarejestrować wniosku urządzenia.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Błąd rejestracji wniosku.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ręczne sprawdzenie statusu przez użytkownika
  const handleManualCheckStatus = async () => {
    setIsCheckingStatus(true);
    setErrorMessage(null);
    try {
      const latest = await enrollmentService.getCurrentDeviceEnrollment();
      if (latest) {
        setPendingRequest(latest);
        if (latest.status === 'APPROVED' && latest.assignedLicenseKey) {
          handleAutoActivate(latest);
        } else if (latest.status === 'REJECTED') {
          setErrorMessage(`Twój wniosek został odrzucony: ${latest.rejectionReason || 'Skontaktuj się z Managerem Zarządzającym.'}`);
        } else {
          // Nadal PENDING
        }
      }
    } catch (err: any) {
      setErrorMessage('Błąd sprawdzania statusu.');
    } finally {
      setTimeout(() => setIsCheckingStatus(false), 500);
    }
  };

  // Kopiowanie tokenu wniosku
  const handleCopyPairingToken = () => {
    if (!pendingRequest?.pairingToken) return;
    navigator.clipboard?.writeText(pendingRequest.pairingToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Obsługa wprowadzania bezpośredniego klucza SBX-
  const handleManualActivate = async (e: React.FormEvent) => {
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
        if (onActivationSuccess) onActivationSuccess(res.license);
      } else {
        setErrorMessage(res.error || 'Nie udało się aktywować stacji.');
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
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#006241]/10 text-[#006241] border border-[#006241]/20 font-mono">
                  {step === 'PENDING_APPROVAL' ? 'Oczekiwanie' : 'Rejestracja SM'}
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Konfiguracja stanowiska i dostęp do danych kawiarni
              </p>
            </div>
          </div>

          {/* Sukces powiadomienia */}
          {approvedNotification && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 animate-in fade-in">
              <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 animate-bounce" />
              <div className="text-xs font-semibold">{approvedNotification}</div>
            </div>
          )}

          {/* Błędy */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 animate-in fade-in">
              <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs font-medium">{errorMessage}</div>
            </div>
          )}

          {/* =================================================================== */}
          {/* KROK 1: FORMULARZ REJESTRACJI KIEROWNIKA */}
          {/* =================================================================== */}
          {step === 'REGISTER' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80">
                <h3 className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-[#006241]" />
                  Rejestracja Kierownika na tym laptopie
                </h3>
                <p className="text-[11px] text-stone-500">
                  Wprowadź swoje dane oraz firmowy adres e-mail. Na podaną skrzynkę prześlemy 6-cyfrowy kod weryfikacyjny.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Imię i Nazwisko:</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="np. Jan Kowalski"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#006241] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Służbowy e-mail pracowniczy:</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jan.kowalski@amrest.eu"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#006241] focus:border-transparent"
                  />
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                </div>
                <p className="text-[10px] text-stone-500 mt-1">Dozwolone domeny: @amrest.eu oraz @starbucks.com</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Stanowisko:</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as AppUserRole)}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#006241]"
                  >
                    <option value="STORE_MANAGER">Store Manager (SM)</option>
                    <option value="ASSISTANT_STORE_MANAGER">Assistant Store Manager (ASM)</option>
                    <option value="DISTRICT_MANAGER">District Manager (DM)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Komputer:</label>
                  <div className="w-full px-3 py-2.5 rounded-xl bg-stone-100 border border-stone-200 text-xs text-stone-600 truncate flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span className="truncate">{deviceName}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-[#006241] hover:bg-[#00754A] transition-all cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Wysyłam kod weryfikacyjny...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Wyślij kod weryfikacyjny na e-mail
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setStep('MANUAL_KEY')}
                  className="text-[11px] text-stone-500 hover:text-stone-800 underline cursor-pointer"
                >
                  Masz bezpośredni klucz licencyjny SBX-...? Wprowadź ręcznie
                </button>
              </div>
            </form>
          )}

          {/* =================================================================== */}
          {/* KROK 2: WERYFIKACJA 6-CYFROWEGO KODU Z E-MAILA */}
          {/* =================================================================== */}
          {step === 'VERIFY_OTP' && (
            <form onSubmit={handleVerifyOtpAndSubmit} className="space-y-5">
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs mb-1">
                  <Mail className="w-4 h-4 text-[#006241]" />
                  Wysłano kod na: <span className="font-mono underline">{email}</span>
                </div>
                <p className="text-[11px] text-emerald-800/80">
                  Otwórz swoją skrzynkę e-mail i przepisz 6-cyfrowy kod autoryzacyjny, aby powiązać ten komputer z Twoim kontem.
                </p>
              </div>

              {simulatedOtpCode && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between">
                  <span>🛠️ <strong>Tryb testowy/demo:</strong> Twój kod to: <code className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-amber-300">{simulatedOtpCode}</code></span>
                  <button
                    type="button"
                    onClick={() => {
                      const arr = simulatedOtpCode.split('');
                      setOtpDigits(arr);
                    }}
                    className="text-[10px] font-bold underline cursor-pointer text-amber-800"
                  >
                    Wstaw kod
                  </button>
                </div>
              )}

              {/* Pola na 6 cyfr */}
              <div>
                <label className="block text-xs font-bold text-stone-700 text-center mb-2">
                  Przepisz 6-cyfrowy kod z wiadomości:
                </label>
                <div className="flex justify-center gap-2.5 sm:gap-3" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-mono font-black text-stone-900 bg-stone-50 border-2 border-stone-300 rounded-xl focus:border-[#006241] focus:bg-white focus:outline-none transition-all"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 text-[11px] text-stone-500 px-1">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    Ważność: {Math.floor(otpTimerSeconds / 60)}:{(otpTimerSeconds % 60).toString().padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={isSubmitting}
                    className="text-[#006241] font-bold hover:underline cursor-pointer"
                  >
                    Wyślij kod ponownie
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('REGISTER')}
                  className="w-1/3 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  Wróć
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || otpDigits.join('').length !== 6}
                  className="w-2/3 py-3 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-[#006241] hover:bg-[#00754A] cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Potwierdź i zarejestruj laptop
                </button>
              </div>
            </form>
          )}

          {/* =================================================================== */}
          {/* KROK 3: OCZEKIWANIE NA AKCEPTACJĘ PRZEZ MANAGERA ZARZĄDZAJĄCEGO */}
          {/* =================================================================== */}
          {step === 'PENDING_APPROVAL' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-300/80 text-amber-900">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-200/80 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
                    <Clock className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-950">
                      Oczekiwanie na przydzielenie dostępu
                    </h3>
                    <p className="text-[11px] text-amber-900/90 mt-1 leading-relaxed">
                      Twój adres e-mail został zweryfikowany. Zgłoszenie dla tego laptopa zostało przekazane do Managera Zarządzającego.
                    </p>
                  </div>
                </div>
              </div>

              {/* Karta szczegółów urządzenia */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-stone-200/70">
                  <span className="text-stone-500 font-medium">Kierownik:</span>
                  <span className="font-bold text-stone-900">{pendingRequest?.fullName || fullName} ({pendingRequest?.requestedRole || role})</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-200/70">
                  <span className="text-stone-500 font-medium">Potwierdzony e-mail:</span>
                  <span className="font-bold text-[#006241] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {pendingRequest?.email || email}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-stone-200/70">
                  <span className="text-stone-500 font-medium">Urządzenie:</span>
                  <span className="font-bold text-stone-800 flex items-center gap-1">
                    <Laptop className="w-3.5 h-3.5 text-stone-500" />
                    {pendingRequest?.deviceName || deviceName}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-stone-500 font-medium">Kod zgłoszenia:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-stone-300 text-stone-900">
                      {pendingRequest?.pairingToken || 'REQ-PENDING'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPairingToken}
                      className="text-[10px] text-[#006241] font-bold underline cursor-pointer"
                    >
                      {copiedToken ? 'Skopiowano!' : 'Kopiuj'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Informacja o auto-odblokowaniu */}
              <div className="text-center space-y-1">
                <p className="text-[11px] text-stone-500">
                  Aplikacja odpytuje system w tle. Gdy Manager zatwierdzi wniosek i przydzieli kawiarnię, pulpit odblokuje się automatycznie.
                </p>
              </div>

              {/* Przyciski kontrolne */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleManualCheckStatus}
                  disabled={isCheckingStatus || isSubmitting}
                  className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-[#006241] hover:bg-[#00754A] cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                  {isCheckingStatus ? 'Sprawdzam status...' : 'Sprawdź status dostępu'}
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    enrollmentService.cancelCurrentEnrollment();
                    setPendingRequest(null);
                    setStep('REGISTER');
                  }}
                  className="text-[11px] text-stone-400 hover:text-stone-700 underline cursor-pointer"
                >
                  Anuluj zgłoszenie i zmień dane
                </button>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* KROK 4: WPISANIE RĘCZNEGO KLUCZA SBX- (FALLBACK DLA ADMINA / AWARYJNY) */}
          {/* =================================================================== */}
          {step === 'MANUAL_KEY' && (
            <form onSubmit={handleManualActivate} className="space-y-4 animate-in fade-in">
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <h3 className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-2 mb-1">
                  <KeyRound className="w-4 h-4 text-[#CBA258]" />
                  Ręczna aktywacja stacji kluczem
                </h3>
                <p className="text-[11px] text-stone-500">
                  Wklej bezpośredni klucz licencyjny wygenerowany przez Managera Zarządzającego.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Klucz licencyjny (SBX-...):</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={rawInput}
                    onChange={(e) => {
                      setRawInput(e.target.value);
                      setParsed(parseActivationInput(e.target.value));
                    }}
                    placeholder="SBX-108120-XXXXXXXX-YYYY"
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-300 font-mono text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#006241]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const text = await navigator.clipboard?.readText();
                      if (text) {
                        setRawInput(text);
                        setParsed(parseActivationInput(text));
                      }
                    }}
                    className="absolute right-2 top-2 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md text-[10px] font-bold cursor-pointer"
                  >
                    Wklej
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('REGISTER')}
                  className="w-1/3 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-50 cursor-pointer"
                >
                  Wróć
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !parsed.isValidFormat}
                  className="w-2/3 py-3 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-[#006241] hover:bg-[#00754A] cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Aktywuj kluczem
                </button>
              </div>
            </form>
          )}

          {/* Footer Security Note */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400">
            <span>Hardware ID: {hwFingerprint.slice(0, 16)}...</span>
            <span className="font-semibold text-stone-500">Starbucks Enterprise Guard</span>
          </div>
        </div>
      </div>
    </div>
  );
};
