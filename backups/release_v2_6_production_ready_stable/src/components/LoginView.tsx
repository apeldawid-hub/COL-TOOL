import React, { useState } from 'react';
import { Store, ShieldCheck, Database, ArrowRight, Sparkles, Coffee, UserCheck } from 'lucide-react';

interface LoginViewProps {
  onLogin: (userName?: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [selectedRole, setSelectedRole] = useState<'SM' | 'DM' | 'ASM'>('SM');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      onLogin(selectedRole === 'SM' ? 'Store Manager (SM)' : selectedRole === 'DM' ? 'District Manager (DM)' : 'Assistant Store Manager (ASM)');
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
          <span className="font-bold text-[#1E3932]">108120 Janki</span>
          <span className="text-stone-300">•</span>
          <span className="text-stone-500">Kod: <strong>18120</strong></span>
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

          {/* Wybór profilu logowania */}
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-[#5C6F68] uppercase tracking-wider mb-2">
                Wybierz Profil Operacyjny
              </label>

              <div className="grid grid-cols-3 gap-2 p-1 bg-[#F0F4F2] rounded-2xl border border-[#D0DCD6]">
                <button
                  type="button"
                  onClick={() => setSelectedRole('SM')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                    selectedRole === 'SM'
                      ? 'bg-[#006241] text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Store Mgr (SM)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole('ASM')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                    selectedRole === 'ASM'
                      ? 'bg-[#006241] text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Asystent (ASM)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedRole('DM')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 ${
                    selectedRole === 'DM'
                      ? 'bg-[#006241] text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#CBA258]" />
                  <span>District Mgr</span>
                </button>
              </div>
            </div>

            {/* Informacja o kawiarni */}
            <div className="bg-[#F8FAF9] rounded-2xl p-4 border border-[#E2E8E5] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-500 font-medium">Lokalizacja domyślna:</span>
                <span className="font-bold text-[#1E3932] flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-[#006241]" />
                  108120 SBX Warszawa Janki
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500 font-medium">Baza operacyjna:</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <Database className="w-3 h-3 text-emerald-600" />
                  SQLite WebAssembly (Aktywna)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500 font-medium">Połączenie MAPAL:</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Zweryfikowane (4 346 logowań)
                </span>
              </div>
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

      {/* Stopka z informacją o wersji */}
      <footer className="px-8 py-4 text-center text-xs text-stone-400 relative z-10">
        <p>Starbucks Operations Suite • Wersja v2.2 (Seasonal AI & Labor Management)</p>
        <p className="text-[11px] text-stone-400 mt-0.5">Dedykowane środowisko desktopowe dla kawiarni 108120 Janki</p>
      </footer>
    </div>
  );
};
