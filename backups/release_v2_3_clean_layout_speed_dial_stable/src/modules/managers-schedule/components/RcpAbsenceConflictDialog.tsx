import React from 'react';
import { RcpAbsenceConflict } from '../../../types';
import {
  AlertTriangle,
  X,
  Clock,
  Building2,
  Calendar,
  User,
  Info,
  ShieldAlert
} from 'lucide-react';

interface RcpAbsenceConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: RcpAbsenceConflict[];
  monthName: string;
  year: number;
}

export const RcpAbsenceConflictDialog: React.FC<RcpAbsenceConflictDialogProps> = ({
  isOpen,
  onClose,
  conflicts,
  monthName,
  year
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div className="bg-white rounded-3xl shadow-2xl border border-rose-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* NAGŁÓWEK */}
        <div className="px-6 py-4 bg-rose-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-800 text-rose-200 shadow-inner">
              <ShieldAlert className="w-6 h-6 text-rose-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">
                  Kolizja Logowania RCP z Absencją (L4 / H)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-800 text-rose-200 text-xs font-bold border border-rose-700">
                  {conflicts.length} {conflicts.length === 1 ? 'przypadek' : 'przypadki'}
                </span>
              </div>
              <p className="text-xs text-rose-200/90 mt-0.5">
                Wykryto rejestrację godzin pracy w systemie w dniach zadeklarowanego urlopu lub zwolnienia lekarskiego
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-rose-800/50 hover:bg-rose-800 text-rose-200 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TREŚĆ OSTRZEŻENIA */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-stone-50">
          {/* BANER INFORMACYJNY */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-950 space-y-2">
            <div className="font-bold flex items-center gap-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Dlaczego pojawia się ten komunikat?</span>
            </div>
            <p className="text-[11px] text-amber-900/90 leading-relaxed">
              System porównał zarejestrowane logowania w systemie <strong>MAPAL Fichajes</strong> z matrycą grafiku managerskiego za <strong>{monthName} {year}</strong>.
              Dla poniższych dni pracownicy mają w systemie zarejestrowany fizyczny czas pracy, mimo że w grafiku oznaczono nieobecność:
            </p>
            <ul className="list-disc pl-5 text-[11px] text-amber-900/90 space-y-1">
              <li>
                <strong>Błąd w grafiku</strong>: Pracownik odwołał urlop lub zamienił dyżur, ale zmiana nie została uaktualniona w matrycy miesiąca.
              </li>
              <li>
                <strong>Faktyczne logowanie podczas absencji</strong>: Pracownik zalogował się do systemu (w kawiarni macierzystej lub na wsparciu), będąc na urlopie lub zwolnieniu lekarskim L4.
              </li>
            </ul>
          </div>

          {/* LISTA KOLIZJI */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Szczegółowa lista wykrytych niezgodności:
            </div>

            <div className="divide-y divide-rose-100 bg-white rounded-2xl border border-rose-200 shadow-xs overflow-hidden">
              {conflicts.map((c, idx) => (
                <div key={`conflict-${c.employeeId}-${c.day}-${idx}`} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-rose-50/30 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 text-sm">{c.employeeName}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-200 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-stone-500" />
                        <span>Dzień {c.day} ({c.date})</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
                      <div className="flex items-center gap-1">
                        <span className="text-stone-400">Status w grafiku:</span>
                        <span className={`px-1.5 py-0.5 rounded font-black text-[11px] ${
                          c.shiftCode === 'H' 
                            ? 'bg-sky-100 text-sky-900 border border-sky-300' 
                            : 'bg-rose-100 text-rose-900 border border-rose-300'
                        }`}>
                          {c.shiftName}
                        </span>
                      </div>

                      {c.unitName && (
                        <div className="flex items-center gap-1 text-stone-500">
                          <Building2 className="w-3.5 h-3.5 text-stone-400" />
                          <span className="text-[11px]">{c.unitName} ({c.unitCode || '384'})</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-stone-400 uppercase font-semibold">Zalogowany czas (RCP)</div>
                      <div className="text-sm font-black text-rose-700 flex items-center justify-end gap-1">
                        <Clock className="w-3.5 h-3.5 text-rose-600" />
                        <span>{c.rcpHours.toFixed(2)} h</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* WSKAZÓWKA ZALECANEGO DZIAŁANIA */}
          <div className="p-3 bg-stone-100 rounded-xl border border-stone-200 flex items-center gap-2.5 text-[11px] text-stone-600">
            <Info className="w-4 h-4 text-[#006241] shrink-0" />
            <span>
              <strong>Zalecenie SM</strong>: Jeżeli logowanie było prawidłowe, zmień w grafiku kod <strong>{conflicts[0]?.shiftCode}</strong> na właściwą zmianę roboczą (np. AM, PM, SAM lub SUP), aby godziny nie dublowały się w rozliczeniu.
            </span>
          </div>
        </div>

        {/* STOPKA */}
        <div className="px-6 py-3.5 bg-white border-t border-stone-200 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
          >
            Zamknij powiadomienie
          </button>
        </div>
      </div>
    </div>
  );
};
