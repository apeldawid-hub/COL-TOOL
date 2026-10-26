// src/components/LoginView.tsx
import React, { useState, useEffect } from 'react';
import { 
  Store, 
  ArrowRight, 
  Mail, 
  User, 
  Shield, 
  ChevronsUpDown, 
  KeyRound, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Laptop, 
  UserPlus, 
  Sparkles,
  Lock
} from 'lucide-react';
import { APP_VERSION, APP_SHORT_NAME } from '../version';
import { useStore } from '../context/StoreContext';
import { StoreSwitcherModal } from './StoreSwitcherModal';
import { AuthService, AuthUserSession } from '../services/auth/authService';
import { AdminService } from '../services/admin/adminService';
import { AppUserRole } from '../types/admin';

interface LoginViewProps {
  onLogin: (userName?: string, session?: AuthUserSession) => void;
}

type AuthTab = 'store_manager' | 'partner_2fa' | 'register_partner';

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const { currentStore } = useStore();
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AuthTab>('store_manager');

  // Stan dla 2FA
  const [email2Fa, setEmail2Fa] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stan dla formularza rejestracji
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<AppUserRole>('BARISTA');
  const [regNote, setRegNote] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  const deviceName = AuthService.getDeviceName();
  const smUser = AdminService.getUsers().find(u => u.role === 'STORE_MANAGER' && u.isActive);
  const smDisplayName = smUser?.fullName || localStorage.getItem('sbx_user_name') || 'Store Manager';
  const smDisplayEmail = smUser?.email || localStorage.getItem('sbx_user_email') || (currentStore.unitCode ? `manager.${currentStore.unitCode}@amrest.eu` : 'manager@amrest.eu');

  // Czyszczenie komunikatów przy zmianie zakładki
  useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [activeTab]);

  // Obsługa natychmiastowego logowania Store Managera (Dawid Apel)
  const handleStoreManagerLogin = () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const session = AuthService.quickLoginStoreManager(currentStore.unitCode);
      setTimeout(() => {
        onLogin(`${session.fullName} (SM)`, session);
      }, 200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Błąd logowania Store Managera.');
      setIsSubmitting(false);
    }
  };

  // Krok 1: Wysłanie kodu 2FA na firmowy e-mail
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await AuthService.request2FaOtp(email2Fa, currentStore.unitCode);
      if (res.success) {
        setIsOtpSent(true);
        setSuccessMessage(res.message);
        if (res.simulatedCode) {
          setSimulatedCode(res.simulatedCode);
        }
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Wystąpił błąd podczas wysyłania kodu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Krok 2: Weryfikacja kodu 2FA
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await AuthService.verify2FaOtp(email2Fa, otpCode);
      if (res.success && res.session) {
        setSuccessMessage('Pomyślna weryfikacja 2FA! Logowanie...');
        setTimeout(() => {
          onLogin(`${res.session!.fullName} (${res.session!.role})`, res.session);
        }, 300);
      } else {
        setErrorMessage(res.message || 'Niepoprawny kod weryfikacyjny.');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Błąd weryfikacji kodu.');
      setIsSubmitting(false);
    }
  };

  // Wysłanie wniosku o rejestrację nowego pracownika / urządzenia
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res = await AuthService.registerPartner({
        storeUnitCode: currentStore.unitCode,
        fullName: regFullName,
        email: regEmail,
        requestedRole: regRole,
        requestNote: regNote,
      });

      if (res.success) {
        setRegSuccess(true);
        setSuccessMessage(res.message);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Nie udało się przesłać zgłoszenia.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F7F5] flex flex-col justify-between select-none relative overflow-hidden">
      {/* Ozdobne tła z gradientami i rozmyciem */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#006241]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#CBA258]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-72 h-72 bg-[#1E3932]/5 rounded-full blur-2xl pointer-events-none" />

      {/* Pasek górny (Top Bar) */}
      <header className="px-8 py-5 flex items-center justify-between relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-[#006241] flex items-center justify-center text-white shadow-sm ring-2 ring-[#006241]/20">
            <span className="text-xl">☕</span>
          </div>
          <div>
            <span className="font-black text-sm tracking-wider text-[#1E3932] block">
              STARBUCKS
            </span>
            <span className="text-[11px] font-bold text-[#5C6F68]">Operations Suite</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsStoreModalOpen(true)}
          title="Kliknij, aby zmienić kawiarnię"
          className="flex items-center space-x-2 bg-white/90 hover:bg-emerald-50 backdrop-blur-xs px-3.5 py-1.5 rounded-full border border-[#D0DCD6] hover:border-emerald-300 text-xs shadow-2xs cursor-pointer transition-all group"
        >
          <Store className="w-3.5 h-3.5 text-[#CBA258] group-hover:scale-105 transition-transform" />
          <span className="font-bold text-[#1E3932] group-hover:text-[#006241]">{currentStore.shortName}</span>
          <span className="text-stone-300">•</span>
          <span className="text-stone-500">Kod: <strong className="text-stone-800">{currentStore.unitCode}</strong></span>
          <ChevronsUpDown className="w-3 h-3 text-stone-400 group-hover:text-[#006241] transition-colors" />
        </button>
      </header>

      {/* Główny kontener logowania */}
      <main className="flex-1 flex items-center justify-center px-4 py-6 relative z-10">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-xl border border-[#E2E8E5] p-6 md:p-8 relative overflow-hidden">
          {/* Ozdobny pasek na górze karty */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#006241] via-[#00754A] to-[#CBA258]" />

          {/* Logo i Nagłówek */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#1E3932] flex items-center justify-center text-white shadow-lg mb-3 ring-4 ring-[#006241]/10">
              <span className="text-3xl">☕</span>
            </div>

            <h2 className="text-xl font-black text-[#1E3932] tracking-tight">
              Starbucks Operations Suite
            </h2>
            <p className="text-xs text-[#5C6F68] mt-1 font-medium">
              Zintegrowana platforma operacyjna • Bezpieczeństwo Zero-Leak
            </p>
          </div>

          {/* Nawigacja Zakładek (Tabs) */}
          <div className="flex bg-stone-100 p-1 rounded-2xl mb-6 text-xs font-bold text-stone-600 border border-stone-200">
            <button
              type="button"
              onClick={() => setActiveTab('store_manager')}
              className={`flex-1 py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'store_manager'
                  ? 'bg-white text-[#006241] shadow-xs'
                  : 'hover:text-stone-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Store Manager</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('partner_2fa')}
              className={`flex-1 py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'partner_2fa'
                  ? 'bg-white text-[#006241] shadow-xs'
                  : 'hover:text-stone-900'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Logowanie 2FA</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register_partner')}
              className={`flex-1 py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'register_partner'
                  ? 'bg-white text-[#006241] shadow-xs'
                  : 'hover:text-stone-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Nowe konto</span>
            </button>
          </div>

          {/* Komunikaty Błędów / Sukcesu */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{successMessage}</span>
                {simulatedCode && (
                  <div className="mt-2 bg-emerald-100/70 p-2 rounded-xl text-emerald-950 font-mono text-center font-bold tracking-widest text-sm border border-emerald-300">
                    KOD TESTOWY: {simulatedCode}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ZAKŁADKA 1: SZYBKIE WEJŚCIE STORE MANAGERA */}
          {activeTab === 'store_manager' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-[#F8FAF9] rounded-2xl p-4 border border-[#E2E8E5] space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Kierownik Kawiarni:</span>
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-stone-500" />
                    {smDisplayName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Rola systemowa:</span>
                  <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-emerald-600" />
                    Store Manager (SM) • Pełny Dostęp
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Stacja robocza:</span>
                  <span className="font-medium text-stone-700 flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 text-stone-400" />
                    {deviceName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">E-mail służbowy:</span>
                  <span className="font-mono text-stone-600 text-[11px] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-stone-400" />
                    {smDisplayEmail}
                  </span>
                </div>
              </div>

              <div className="bg-amber-50/70 rounded-2xl p-3 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Zweryfikowana stacja robocza na zapleczu kawiarni <strong>{currentStore.name}</strong>. Pełne uprawnienia do skarbców stawek, P&L oraz zatwierdzania wniosków.
                </span>
              </div>

              <button
                type="button"
                onClick={handleStoreManagerLogin}
                disabled={isSubmitting}
                className="w-full bg-[#006241] hover:bg-[#00754A] active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 group cursor-pointer"
              >
                <span>{isSubmitting ? 'Uwierzytelnianie...' : 'Wejdź jako Store Manager'}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          )}

          {/* ZAKŁADKA 2: LOGOWANIE DWUETAPOWE 2FA */}
          {activeTab === 'partner_2fa' && (
            <div className="space-y-4 animate-fadeIn">
              {!isOtpSent ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Służbowy adres e-mail pracownika (@amrest.eu / @starbucks.com):
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email2Fa}
                        onChange={(e) => setEmail2Fa(e.target.value)}
                        placeholder="np. jan.kowalski@amrest.eu"
                        className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#006241] focus:bg-white transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Weryfikacja dwuetapowa wyśle 6-cyfrowy kod autoryzacyjny na podaną skrzynkę.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !email2Fa}
                    className="w-full bg-[#006241] hover:bg-[#00754A] active:scale-[0.99] disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Wysyłanie...' : 'Wyślij kod weryfikacyjny 2FA'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-stone-500 block text-[10px]">Wysłano na adres:</span>
                      <strong className="text-stone-800 font-mono text-[11px]">{email2Fa}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOtpSent(false);
                        setOtpCode('');
                        setSimulatedCode(null);
                      }}
                      className="text-[#006241] hover:underline font-bold text-[11px] cursor-pointer"
                    >
                      Zmień e-mail
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                      Wpisz 6-cyfrowy kod z wiadomości e-mail:
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="000000"
                        className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-center font-mono text-lg font-bold tracking-widest text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#006241] focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || otpCode.length !== 6}
                    className="w-full bg-[#006241] hover:bg-[#00754A] active:scale-[0.99] disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 group cursor-pointer text-xs"
                  >
                    <span>{isSubmitting ? 'Weryfikacja...' : 'Zaloguj i odblokuj pulpit'}</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ZAKŁADKA 3: REJESTRACJA NOWEGO KONTA / WNIOSEK DO STORE MANAGERA */}
          {activeTab === 'register_partner' && (
            <div className="space-y-4 animate-fadeIn">
              {regSuccess ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-stone-900">Wniosek przesłany pomyślnie!</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
                      Store Manager (Dawid Apel) otrzymał Twoje zgłoszenie. Po zatwierdzeniu roli i uprawnień na zapleczu będziesz mógł zalogować się z tego urządzenia.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRegSuccess(false);
                      setActiveTab('partner_2fa');
                      setEmail2Fa(regEmail);
                    }}
                    className="bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer"
                  >
                    Przejdź do logowania
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Imię i Nazwisko pracownika:
                    </label>
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="np. Piotr Wiśniewski"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006241] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Firmowy adres e-mail (@amrest.eu / @starbucks.com):
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="piotr.wisniewski@amrest.eu"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006241] focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-stone-700 mb-1">
                        Wnioskowana rola:
                      </label>
                      <select
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value as AppUserRole)}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#006241]"
                      >
                        <option value="BARISTA">Barista</option>
                        <option value="SHIFT_SUPERVISOR">Shift Supervisor (SSV)</option>
                        <option value="ASSISTANT_STORE_MANAGER">Assistant Store Mgr (ASM)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-stone-700 mb-1">
                        Kawiarnia:
                      </label>
                      <input
                        type="text"
                        disabled
                        value={`${currentStore.unitCode} (${currentStore.shortName})`}
                        className="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl font-bold text-stone-600 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      Powód / notatka dla Store Managera:
                    </label>
                    <input
                      type="text"
                      value={regNote}
                      onChange={(e) => setRegNote(e.target.value)}
                      placeholder="np. Nowy partner, szkolenie T1-T10, dostęp do grafiku"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006241] focus:bg-white"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || !regFullName || !regEmail}
                      className="w-full bg-[#006241] hover:bg-[#00754A] active:scale-[0.99] disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? 'Przesyłanie wniosku...' : 'Wyślij wniosek do Store Managera'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Stopka z informacją o prawach i wersji */}
      <footer className="px-8 py-4 text-center text-xs text-stone-400 relative z-10 space-y-0.5">
        <p className="font-medium text-stone-500 text-xs">
          Starbucks Operations Suite ® • All Rights Reserved
        </p>
        <p className="text-[11px] font-semibold tracking-wider text-stone-400/80">
          {APP_SHORT_NAME} v{APP_VERSION}
        </p>
      </footer>

      {/* Modal wyboru kawiarni */}
      <StoreSwitcherModal
        isOpen={isStoreModalOpen}
        onClose={() => setIsStoreModalOpen(false)}
      />
    </div>
  );
};
