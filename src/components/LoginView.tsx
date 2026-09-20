import React, { useState } from 'react';
import { Store, ArrowRight, Mail, User, Shield } from 'lucide-react';
import { APP_VERSION, APP_SHORT_NAME } from '../version';

interface LoginViewProps {
  onLogin: (userName?: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  // Odczyt skonfigurowanych danych lokalu i użytkownika z konfiguracji początkowej
  const storeName = (() => {
    try {
      return localStorage.getItem('sbx_store_name') || '108120 SBX Warszawa Janki';
    } catch {
      return '108120 SBX Warszawa Janki';
    }
  })();

  const unitCode = (() => {
    try {
      return localStorage.getItem('sbx_unit_code') || '18120';
    } catch {
      return '18120';
    }
  })();

  const configuredUserName = (() => {
    try {
      return localStorage.getItem('sbx_user_name') || '';
    } catch {
      return '';
    }
  })();

  const configuredUserEmail = (() => {
    try {
      return localStorage.getItem('sbx_user_email') || '';
    } catch {
      return '';
    }
  })();

  const configuredRoleLabel = (() => {
    try {
      const r = localStorage.getItem('sbx_user_role');
      if (r && r.includes('ASM')) return 'Assistant Store Manager (ASM)';
      return 'Store Manager (SM)';
    } catch {
      return 'Store Manager (SM)';
    }
  })();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      const roleAbbr = configuredRoleLabel.includes('ASM') ? 'ASM' : 'SM';
      const finalUser = configuredUserName ? `${configuredUserName} (${roleAbbr})` : configuredRoleLabel;
      onLogin(finalUser);
    }, 250);
  };

  return (
    <div className="min-h-screen w-full bg-[#F4F7F5] flex flex-col justify-between select-none relative overflow-hidden">
      {/* Ozdobne tła z gradientami i rozmyciem */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#006241]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#CBA258]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-72 h-72 bg-[#1E3932]/5 rounded-full blur-2xl pointer-events-none" />

      {/* Pasek górny (Subtle Top Bar) */}
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

        <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-xs px-3.5 py-1.5 rounded-full border border-[#D0DCD6] text-xs shadow-2xs">
          <Store className="w-3.5 h-3.5 text-[#CBA258]" />
          <span className="font-bold text-[#1E3932]">{storeName}</span>
          <span className="text-stone-300">•</span>
          <span className="text-stone-500">Kod: <strong>{unitCode}</strong></span>
        </div>
      </header>

      {/* Główny kontener logowania */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-[#E2E8E5] p-8 md:p-10 relative overflow-hidden">
          {/* Ozdobny zielony pasek na górze karty */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#006241] via-[#00754A] to-[#CBA258]" />

          {/* Logo i Nagłówek */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-[#1E3932] flex items-center justify-center text-white shadow-lg mb-4 ring-4 ring-[#006241]/10">
              <span className="text-4xl">☕</span>
            </div>

            <h2 className="text-2xl font-black text-[#1E3932] tracking-tight">
              Starbucks Operations Suite
            </h2>
            <p className="text-xs text-[#5C6F68] mt-1.5 font-medium">
              Zintegrowany pulpit operacyjny kierownictwa kawiarni
            </p>
          </div>

          {/* Formularz logowania z danymi skonfigurowanej sesji */}
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div className="bg-[#F8FAF9] rounded-2xl p-5 border border-[#E2E8E5] space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500 font-medium">Lokalizacja:</span>
                <span className="font-bold text-[#1E3932] flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#006241]" />
                  {storeName}
                </span>
              </div>

              {configuredUserName && (
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Kierownik:</span>
                  <span className="font-bold text-stone-900 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-stone-500" />
                    {configuredUserName}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-stone-500 font-medium">Rola:</span>
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-emerald-600" />
                  {configuredRoleLabel}
                </span>
              </div>

              {configuredUserEmail && (
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Adres e-mail:</span>
                  <span className="font-mono text-stone-600 text-[11px] flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-stone-400" />
                    {configuredUserEmail}
                  </span>
                </div>
              )}
            </div>

            {/* Przycisk Logowania */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#006241] hover:bg-[#00754A] active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 group cursor-pointer"
            >
              <span>{isSubmitting ? 'Logowanie...' : 'Zaloguj do systemu'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>
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
    </div>
  );
};
