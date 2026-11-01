// src/components/security/SessionLockOverlay.tsx
/**
 * Starbucks Operations Suite — Session Inactivity Lock Screen Overlay
 * Feature F9 (Milestone 3)
 *
 * Implements:
 * - High z-index (z-[99999]) full-screen backdrop-blur lock screen when isLocked === true.
 * - Displays active store unit code, store name, and locked user profile.
 * - Cryptographic zeroization notice (informs operator that RAM encryption keys were wiped).
 * - Unlock form validating PIN (e.g. 1812) or user credentials to restore session.
 * - Logout / Switch user trigger.
 */

import React, { useState } from 'react';
import { Lock, ShieldAlert, KeyRound, ArrowRight, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';

interface SessionLockOverlayProps {
  onUnlockSuccess?: () => void;
}

export const SessionLockOverlay: React.FC<SessionLockOverlayProps> = ({ onUnlockSuccess }) => {
  const { isLocked, unlockSession, logout, currentSession } = useAuth();
  const { currentStore } = useStore();
  const [pinCode, setPinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLocked) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode.trim()) {
      setError('Wprowadź PIN lub hasło odblokowujące stację.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const ok = await unlockSession(pinCode);
      if (ok) {
        setPinCode('');
        if (onUnlockSuccess) onUnlockSuccess();
      } else {
        setError('Nieprawidłowy PIN lub hasło. Wpisz PIN zaplecza (1812) lub hasło użytkownika.');
      }
    } catch (err: any) {
      setError(err?.message || 'Błąd podczas weryfikacji poświadczeń.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[99999] bg-[#07130F]/95 backdrop-blur-2xl flex items-center justify-center p-4 select-none animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-[#0D201A] border border-emerald-800/40 rounded-3xl p-8 shadow-2xl shadow-emerald-950/80 flex flex-col items-center text-center">
        {/* Pulsing Lock Icon */}
        <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 shadow-inner relative">
          <Lock className="w-10 h-10 animate-pulse" />
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#0D201A] flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white tracking-tight">Stacja Zablokowana</h2>
        <p className="text-xs text-emerald-400/80 font-mono mt-1">
          {currentStore.name} ({currentStore.unitCode})
        </p>

        {/* Security Zeroization Notice */}
        <div className="w-full mt-4 p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-left flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-emerald-300/80 leading-relaxed">
            Auto-lock aktywny po 15 minutach bezczynności. Klucze szyfrujące w pamięci RAM zostały trwale wyzerowane (<code className="text-emerald-300 font-mono">0x00</code>).
          </p>
        </div>

        {/* User Identity */}
        <div className="w-full mt-4 py-2 px-3 bg-white/[0.03] border border-white/5 rounded-xl flex items-center justify-between text-xs">
          <span className="text-zinc-400">Zalogowany:</span>
          <span className="text-zinc-200 font-semibold">{currentSession?.fullName || 'Store Manager'}</span>
        </div>

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="w-full mt-6 space-y-4">
          <div>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
              <input
                type="password"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="Wprowadź PIN (np. 1812) lub hasło..."
                autoFocus
                className="w-full bg-[#07130F] border border-emerald-800/50 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-emerald-700/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
            </div>
            {error && (
              <div className="mt-2 text-xs text-rose-400 text-left font-medium flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? 'Weryfikacja...' : 'Odblokuj Stację'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Switch User / Logout Button */}
        <button
          onClick={logout}
          className="mt-5 text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          Przełącz użytkownika / Wyloguj
        </button>
      </div>
    </div>
  );
};
