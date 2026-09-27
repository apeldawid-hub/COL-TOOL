// src/components/FeatureInfoButton.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Info, X, Sparkles, ShieldCheck, HelpCircle } from 'lucide-react';
import { useTutorial } from '../context/TutorialContext';

export interface FeatureInfoProps {
  title: string;
  category?: 'TPLH & ROBOCIZNA' | 'KODEKS PRACY' | 'AI & OPTYMALIZACJA' | 'FINANSE & TOR' | 'OPERACJE' | 'STANDARDY';
  description: string;
  details?: string[];
  rules?: string[];
  tips?: string;
  className?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  badgeLabel?: string;
}

export const FeatureInfoButton: React.FC<FeatureInfoProps> = ({
  title,
  category = 'OPERACJE',
  description,
  details,
  rules,
  tips,
  className = '',
  placement = 'bottom',
  badgeLabel
}) => {
  const { isTutorialMode } = useTutorial();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Zamykanie przy kliknięciu poza popoverem
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Ukryj jeśli tryb samouczka jest wyłączony
  if (!isTutorialMode) return null;

  const getCategoryBadgeColor = () => {
    switch (category) {
      case 'KODEKS PRACY':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'TPLH & ROBOCIZNA':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'AI & OPTYMALIZACJA':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'FINANSE & TOR':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'STANDARDY':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      default:
        return 'bg-stone-500/20 text-stone-300 border-stone-500/40';
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title={`Wyjaśnienie funkcji: ${title}`}
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full transition-all cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
          isOpen
            ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 scale-110'
            : 'bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-400/40 hover:scale-105'
        }`}
      >
        <span className="text-[10px] font-black leading-none select-none">i</span>
      </button>

      {/* POPOVER INFORMACYJNY */}
      {isOpen && (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className={`absolute z-50 w-80 sm:w-96 p-4 rounded-2xl bg-[#0f1d16]/95 backdrop-blur-xl border border-emerald-500/40 text-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left ${
            placement === 'top'
              ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
              : placement === 'left'
              ? 'right-full mr-2 top-1/2 -translate-y-1/2'
              : placement === 'right'
              ? 'left-full ml-2 top-1/2 -translate-y-1/2'
              : 'top-full mt-2 left-1/2 -translate-x-1/2'
          }`}
          style={{ maxWidth: 'min(90vw, 420px)' }}
        >
          {/* Header Popoveru */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-emerald-900/50">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border ${getCategoryBadgeColor()}`}>
                  {category}
                </span>
                {badgeLabel && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-emerald-200 font-semibold">
                    {badgeLabel}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-black text-white leading-tight flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{title}</span>
              </h4>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Główny opis funkcji */}
          <div className="py-2.5 text-xs text-slate-300 leading-relaxed">
            <p>{description}</p>
          </div>

          {/* Punkty "Jak to działa" */}
          {details && details.length > 0 && (
            <div className="py-2 border-t border-emerald-900/40 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                Jak to działa:
              </span>
              <ul className="space-y-1 text-[11px] text-slate-300">
                {details.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reguły biznesowe / Kodeks Pracy */}
          {rules && rules.length > 0 && (
            <div className="py-2 border-t border-emerald-900/40 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                <span>Reguły & Standardy:</span>
              </span>
              <ul className="space-y-1 text-[11px] text-amber-100/90">
                {rules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold shrink-0">✓</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Wskazówka dla Store Managera */}
          {tips && (
            <div className="mt-2.5 p-2 bg-[#16271f] border border-emerald-700/40 rounded-xl text-[11px] text-emerald-200 flex items-start gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Wskazówka SM:</strong> {tips}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
