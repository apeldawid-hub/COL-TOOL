import React from 'react';
import { LaborLawViolation, ShiftDefinition } from '../../../types';
import { ShieldAlert, AlertTriangle, ArrowLeft, Check, Scale } from 'lucide-react';

interface LaborLawViolationDialogProps {
  isOpen: boolean;
  employeeName: string;
  day: number;
  dayName?: string;
  attemptedShiftCode: string;
  attemptedShiftDef?: ShiftDefinition;
  violation: LaborLawViolation;
  onCancel: () => void;
  onForceAssign: () => void;
}

export const LaborLawViolationDialog: React.FC<LaborLawViolationDialogProps> = ({
  isOpen,
  employeeName,
  day,
  dayName,
  attemptedShiftCode,
  attemptedShiftDef,
  violation,
  onCancel,
  onForceAssign
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl border-2 border-rose-300 w-full max-w-lg overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* NAGŁÓWEK OSTRZEŻENIA */}
        <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-red-700 text-white p-5 flex items-center gap-3.5">
          <div className="p-3 bg-white/15 rounded-2xl backdrop-blur-xs flex-shrink-0">
            <ShieldAlert className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-rose-200 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              <span>Walidator Kodeksu Pracy</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white mt-0.5">
              Niezgodne z Kodeksem Pracy!
            </h2>
          </div>
        </div>

        {/* TREŚĆ OSTRZEŻENIA */}
        <div className="p-6 space-y-4">
          {/* Informacja o próbie przypisania */}
          <div className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-stone-400 font-medium">Pracownik:</span>
              <span className="font-bold text-stone-800 ml-1.5">{employeeName}</span>
            </div>
            <div>
              <span className="text-stone-400 font-medium">Termin:</span>
              <span className="font-bold text-stone-800 ml-1.5">Dzień {day} {dayName ? `(${dayName})` : ''}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-stone-400 font-medium">Zmiana:</span>
              <span className="font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 ml-1">
                {attemptedShiftCode} {attemptedShiftDef?.hours ? `(${attemptedShiftDef.hours}h)` : ''}
              </span>
            </div>
          </div>

          {/* Główna sekcja z powodem naruszenia */}
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4.5 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-rose-950">
                  {violation.title}
                </h3>
                <p className="text-xs text-rose-800 font-medium mt-1 leading-relaxed">
                  {violation.message}
                </p>
              </div>
            </div>

            {/* Szczegóły prawne / podstawa prawna */}
            {violation.details && (
              <div className="bg-white/80 rounded-xl p-2.5 border border-rose-200/80 text-[11px] text-stone-700">
                <span className="font-semibold text-rose-900 block mb-0.5">Podstawa prawna:</span>
                {violation.details}
              </div>
            )}
          </div>

          <p className="text-xs text-stone-500 leading-relaxed text-center px-2">
            Przepisy prawa pracy chronią zdrowie i bezpieczeństwo pracowników. Zaleca się wyznaczenie innej zmiany lub innego menedżera.
          </p>
        </div>

        {/* PRZYCISKI AKCJI */}
        <div className="p-5 bg-[#F7F9F8] border-t border-[#E2E8E5] flex items-center justify-between gap-3">
          {/* Przycisk bezpieczny: Anuluj */}
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl bg-[#006241] hover:bg-[#00754A] active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Anuluj (Wybierz inną zmianę)</span>
          </button>

          {/* Przycisk wymuszenia w sytuacjach awaryjnych */}
          <button
            onClick={onForceAssign}
            className="py-3 px-4 rounded-xl border border-rose-300 hover:border-rose-400 bg-white hover:bg-rose-50 text-rose-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Wymuszenie zapisu zmiany pomimo alertu KP (zostanie oznaczona w audycie)"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Wymuś mimo niezgodności</span>
          </button>
        </div>
      </div>
    </div>
  );
};
