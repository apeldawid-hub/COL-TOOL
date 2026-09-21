import React, { useState } from 'react';
import { AppModule } from '../types';
import {
  Sparkles,
  ArrowRight,
  LayoutDashboard,
  BarChart3,
  CalendarDays,
  Eye,
  Lock,
  CheckCircle2,
} from 'lucide-react';

interface ComingSoonOverlayWrapperProps {
  module: AppModule;
  title: string;
  subtitle: string;
  description: string;
  features?: string[];
  onNavigate: (module: AppModule) => void;
  children: React.ReactNode;
}

export const ComingSoonOverlayWrapper: React.FC<ComingSoonOverlayWrapperProps> = ({
  title,
  subtitle,
  description,
  features,
  onNavigate,
  children,
}) => {
  const [isPreviewUnlocked, setIsPreviewUnlocked] = useState<boolean>(false);

  return (
    <div className="relative w-full min-h-[calc(100vh-140px)] select-none">
      {/* Podkładowy komponent modułu — rozmyty lub odblokowany */}
      <div
        className={`transition-all duration-500 ease-in-out ${
          isPreviewUnlocked
            ? 'filter-none pointer-events-auto opacity-100'
            : 'filter blur-[7px] brightness-[0.85] contrast-[0.95] pointer-events-none select-none opacity-50'
        }`}
      >
        {children}
      </div>

      {/* Pływający pasek informacyjny przy włączonym podglądzie */}
      {isPreviewUnlocked && (
        <div className="fixed top-20 right-8 z-40 bg-[#08100C]/90 backdrop-blur-md border border-amber-500/40 text-amber-200 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 text-xs animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-1.5 font-bold">
            <Eye className="w-4 h-4 text-amber-400" />
            <span>Tryb Podglądu Roboczego</span>
          </div>
          <button
            onClick={() => setIsPreviewUnlocked(false)}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-xl text-[11px] transition-colors cursor-pointer flex items-center gap-1"
          >
            <Lock className="w-3 h-3" />
            Zablokuj widok
          </button>
        </div>
      )}

      {/* Nakładka Frosted Glass Overlay 'WKRÓTCE' */}
      {!isPreviewUnlocked && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 min-h-[600px] animate-in fade-in duration-300">
          <div className="relative w-full max-w-2xl bg-[#08100C]/90 backdrop-blur-2xl border border-emerald-500/30 rounded-3xl p-8 md:p-10 shadow-2xl shadow-black/80 text-white overflow-hidden text-center space-y-6">
            {/* Ozdobny blask w tle */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#006241]/40 rounded-full blur-[90px] pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-[#CBA258]/20 rounded-full blur-[90px] pointer-events-none" />

            {/* Ikona i Badge */}
            <div className="relative z-10 flex flex-col items-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#006241] to-[#004d33] border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-lg shadow-emerald-950/80">
                <Sparkles className="w-8 h-8 text-[#CBA258] animate-pulse" />
              </div>

              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-[#CBA258]/15 text-[#CBA258] border border-[#CBA258]/30 tracking-wide uppercase">
                <Lock className="w-3.5 h-3.5" />
                <span>Moduł w Przygotowaniu • Wkrótce Dostępny</span>
              </div>
            </div>

            {/* Tytuł i Opis */}
            <div className="relative z-10 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400/80 block">
                {subtitle}
              </span>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                {title}
              </h2>
              <p className="text-xs md:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed pt-1">
                {description}
              </p>
            </div>

            {/* Cechy i Korzyści */}
            {features && features.length > 0 && (
              <div className="relative z-10 pt-4 border-t border-emerald-900/40 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {features.map((feat, idx) => (
                    <div
                      key={idx}
                      className="flex items-center space-x-2.5 p-2.5 bg-emerald-950/40 border border-emerald-800/30 rounded-xl text-xs text-slate-200"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Przyciski Akcji */}
            <div className="relative z-10 pt-4 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => onNavigate('labor_forecast')}
                className="px-5 py-2.5 bg-[#006241] hover:bg-[#00754A] text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/60 transition-all cursor-pointer flex items-center gap-2 hover:scale-[1.02]"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Otwórz TPLH Forecast</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onNavigate('managers_schedule')}
                className="px-5 py-2.5 bg-[#121a15] hover:bg-[#1a261f] border border-emerald-700/40 text-emerald-200 hover:text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <CalendarDays className="w-4 h-4 text-emerald-400" />
                <span>Otwórz Grafik MGR</span>
              </button>

              <button
                onClick={() => onNavigate('dashboard')}
                className="px-4 py-2.5 bg-stone-900/80 hover:bg-stone-800 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-stone-700/50 transition-colors flex items-center gap-1.5"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Pulpit Główny</span>
              </button>
            </div>

            {/* Przycisk Podglądu Roboczego */}
            <div className="relative z-10 pt-2">
              <button
                onClick={() => setIsPreviewUnlocked(true)}
                className="text-[11px] font-semibold text-slate-400 hover:text-amber-300 underline underline-offset-4 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Zobacz wczesny podgląd roboczy tego modułu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
