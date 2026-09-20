import React, { useState } from 'react';
import { ShiftDefinition } from '../../../types';
import { X, Clock, Sun, Moon, Briefcase, CalendarOff, Check, UserCheck } from 'lucide-react';

interface ShiftPickerPopoverProps {
  currentShiftCode: string;
  currentDisposition?: string;
  shiftDefinitions: ShiftDefinition[];
  day: number;
  dayName?: string;
  isSunday?: boolean;
  isTradingSunday?: boolean;
  isHoliday?: boolean;
  holidayName?: string;
  isWeekend?: boolean;
  employeeContractRatio?: number;
  managerName: string;
  onSelectShift: (code: string) => void;
  onSelectDisposition?: (disposition: string) => void;
  onClose: () => void;
}

const DISPO_PRESETS = [
  { code: 'OFF', label: 'Brak / Wolne', desc: 'Domyślna niedostępność' },
  { code: 'M', label: 'Rano (M)', desc: '07:00 – 15:00' },
  { code: 'Z', label: 'Wieczór (Z)', desc: '14:30 – 22:30' },
  { code: 'FULL', label: 'Pełna (FULL)', desc: '07:00 – 22:30' },
];

export const ShiftPickerPopover: React.FC<ShiftPickerPopoverProps> = ({
  currentShiftCode,
  currentDisposition = 'OFF',
  shiftDefinitions,
  day,
  dayName,
  isSunday = false,
  isTradingSunday = false,
  isHoliday = false,
  holidayName,
  isWeekend = false,
  employeeContractRatio = 1.0,
  managerName,
  onSelectShift,
  onSelectDisposition,
  onClose
}) => {
  const [selectedDispo, setSelectedDispo] = useState<string>(currentDisposition || 'OFF');

  // Sprawdzenie czy zmiana jest dozwolona wyłącznie w niedziele
  const isShiftSundayOnly = (s: ShiftDefinition): boolean => {
    return Boolean(
      s.is_sunday_only ||
      s.name.toLowerCase().includes('niedziel') ||
      ['AMN', 'PMN'].includes(s.code)
    );
  };

  // Grupowanie zmian wg kategorii
  const coverageShifts = shiftDefinitions.filter(s => s.category === 'coverage' || (!s.is_nc && !s.is_absence && s.category !== 'dispo'));
  const ncShifts = shiftDefinitions.filter(s => s.is_nc || s.category === 'nc');
  const absenceShifts = shiftDefinitions.filter(s => s.is_absence || s.category === 'absence');
  const dispoShifts = shiftDefinitions.filter(s => s.category === 'dispo');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-[#E2E8E5] w-full max-w-xl overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Nagłówek okienka */}
        <div className="bg-[#1E3932] text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-300 font-medium flex items-center gap-2 flex-wrap">
              <span>Wybór Zmiany • Dzień {day} {dayName ? `(${dayName})` : ''}</span>
              {isHoliday ? (
                <span className="bg-rose-500 text-white font-black px-2 py-0.5 rounded-sm text-[10px] flex items-center gap-1 shadow-2xs">
                  🇵🇱 ŚWIĘTO: {holidayName || 'Ustawowo Wolne'}
                </span>
              ) : isTradingSunday ? (
                <span className="bg-emerald-500 text-white font-black px-2 py-0.5 rounded-sm text-[10px] flex items-center gap-1 shadow-2xs">
                  🛒 NIEDZIELA HANDLOWA
                </span>
              ) : isSunday ? (
                <span className="bg-amber-400 text-amber-950 font-black px-1.5 py-0.2 rounded-sm text-[10px]">
                  NIEDZIELA WOLNA OD PRACY
                </span>
              ) : isWeekend ? (
                <span className="bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded-sm text-[10px]">
                  SOBOTA (Dzień wolny KP)
                </span>
              ) : (
                <span className="text-[10px] text-emerald-200/80">
                  Dzień roboczy
                </span>
              )}
            </div>
            <div className="text-base font-semibold mt-0.5 flex items-center gap-2">
              <span>{managerName}</span>
              <span className="text-xs font-normal text-emerald-200 bg-white/10 px-2 py-0.5 rounded-md">
                Etat: {(employeeContractRatio * 100).toFixed(0)}% (dobowo {(8.0 * employeeContractRatio).toFixed(1)}h)
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 max-h-[75vh] overflow-y-auto space-y-5">
          {/* SEKCJA DYSPOZYCYJNOŚCI MENEDŻERA */}
          <div className="bg-stone-50/90 p-3.5 rounded-xl border border-stone-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1E3932] uppercase tracking-wider">
                <UserCheck className="w-4 h-4 text-[#006241]" />
                <span>Dyspozycyjność Menedżera (Dzień {day})</span>
              </div>
              <span className="text-[11px] text-stone-600">
                Wybrana: <strong className="text-[#006241] font-bold">{selectedDispo}</strong>
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {DISPO_PRESETS.map(d => {
                const isDispoSelected = selectedDispo === d.code;
                return (
                  <button
                    key={d.code}
                    type="button"
                    onClick={async () => {
                      setSelectedDispo(d.code);
                      if (onSelectDisposition) {
                        await onSelectDisposition(d.code);
                      }
                    }}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                      isDispoSelected
                        ? 'bg-[#006241] text-white border-[#006241] shadow-xs font-bold ring-2 ring-[#006241]/30'
                        : 'bg-white hover:bg-stone-100 border-stone-300 text-stone-800'
                    }`}
                  >
                    <div className="text-xs font-black">{d.code}</div>
                    <div className={`text-[10px] truncate ${isDispoSelected ? 'text-emerald-100' : 'text-stone-500'}`}>
                      {d.label}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-stone-500 mt-2 leading-tight">
              💡 Dyspozycyjność inna niż <strong>OFF</strong> wyświetla się po lewej stronie kwadratu dnia w grafiku.
            </p>
          </div>

          {/* Sekcja 1: Floor / Coverage (Obsługa sali i baru) */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#006241] uppercase tracking-wider mb-2.5">
              <Sun className="w-3.5 h-3.5" />
              <span>Coverage & Sala / Bar</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {coverageShifts.map(s => {
                const isSelected = s.code === currentShiftCode;
                const isSundayOnly = isShiftSundayOnly(s);
                const isBlocked = !isSunday && isSundayOnly;
                const isExternalSupport = ['SUP', 'SAM', 'SPM'].includes(s.code);

                if (isBlocked) {
                  return (
                    <div
                      key={s.code}
                      className="flex items-start justify-between p-2.5 rounded-xl border border-stone-200 bg-stone-100/70 opacity-45 cursor-not-allowed select-none"
                      title={`Zmiana ${s.code} (${s.name}) może być wybrana wyłącznie w niedzielę.`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-stone-500">{s.code}</span>
                          <span className="text-[11px] text-stone-400 font-medium">{s.hours}h</span>
                        </div>
                        <div className="text-xs text-stone-500 truncate max-w-[130px]" title={s.name}>
                          {s.name}
                        </div>
                        <span className="inline-block mt-1 text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded-md border border-amber-200">
                          🔒 Tylko w niedziele
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={s.code}
                    onClick={() => {
                      onSelectShift(s.code);
                      onClose();
                    }}
                    className={`flex items-start justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#006241] bg-emerald-50/80 ring-2 ring-[#006241]/20 shadow-xs'
                        : isSunday && isSundayOnly
                        ? 'border-amber-400 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-500'
                        : 'border-stone-200 hover:border-[#006241]/50 hover:bg-stone-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-[#1E3932]">{s.code}</span>
                        <span className="text-[11px] text-stone-500 font-medium">{s.hours}h</span>
                      </div>
                      <div className="text-xs text-stone-600 truncate max-w-[130px]" title={s.name}>
                        {s.name}
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {s.start_time} – {s.end_time}
                      </div>
                      {isSunday && isSundayOnly && (
                        <span className="inline-block mt-1 text-[9px] font-black text-amber-900 bg-amber-200/90 px-1.5 py-0.5 rounded-md border border-amber-300">
                          ☀️ Zmiana Niedzielna
                        </span>
                      )}
                      {isExternalSupport && (
                        <span className="inline-block mt-1 text-[9px] font-bold text-lime-900 bg-lime-100 px-1.5 py-0.5 rounded-md border border-lime-200" title="Wsparcie w innej kawiarni — liczy się do etatu, nie liczy się do obsady Janki">
                          🏢 Wsparcie inna kawiarnia
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#006241] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sekcja 2: Non-Coverage / Zadania Specjalne */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-800 uppercase tracking-wider mb-2.5">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Non-Coverage & Zadania Menedżerskie</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ncShifts.map(s => {
                const isSelected = s.code === currentShiftCode;
                return (
                  <button
                    key={s.code}
                    onClick={() => {
                      onSelectShift(s.code);
                      onClose();
                    }}
                    className={`flex items-start justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/80 ring-2 ring-purple-600/20 shadow-xs'
                        : 'border-stone-200 hover:border-purple-400 hover:bg-purple-50/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-purple-900">{s.code}</span>
                        <span className="text-[11px] text-purple-600 font-medium">{s.hours}h</span>
                      </div>
                      <div className="text-xs text-stone-600 truncate max-w-[130px]" title={s.name}>
                        {s.name}
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {s.start_time} – {s.end_time}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-purple-700 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sekcja 3: Dni Wolne & Nieobecności */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2.5">
              <CalendarOff className="w-3.5 h-3.5" />
              <span>Dni Wolne, Urlopy i Zwolnienia</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {absenceShifts.map(s => {
                const isSelected = s.code === currentShiftCode;
                const ratio = employeeContractRatio || 1.0;
                const dailyEtathours = Number((8.0 * ratio).toFixed(1));
                const isNonWorking = isWeekend || isHoliday;

                let displayHours = '0h';
                let subBadge = 'Dzień wolny';
                let subBadgeColor = 'text-stone-500';

                if (s.code === 'OFF') {
                  displayHours = '0h';
                  subBadge = 'Dzień wolny';
                  subBadgeColor = 'text-stone-500';
                } else if (s.code === 'H') {
                  if (isNonWorking) {
                    displayHours = '0h';
                    subBadge = isHoliday ? `Święto (${holidayName || 'wolne'})` : 'Weekend (bez godzin)';
                    subBadgeColor = 'text-rose-600 font-bold';
                  } else {
                    displayHours = `${dailyEtathours}h`;
                    subBadge = ratio < 1 ? `Etat ${(ratio * 100).toFixed(0)}%` : 'Pełny etat (8h)';
                    subBadgeColor = 'text-sky-700 font-semibold';
                  }
                } else if (s.code === 'L4') {
                  if (isNonWorking) {
                    displayHours = '0h';
                    subBadge = isHoliday ? `Święto (${holidayName || 'wolne'})` : 'Weekend (dzień wolny)';
                    subBadgeColor = 'text-stone-500';
                  } else {
                    displayHours = `${dailyEtathours}h`;
                    subBadge = ratio < 1 ? `Etat ${(ratio * 100).toFixed(0)}%` : 'Pełny etat (8h)';
                    subBadgeColor = 'text-red-700 font-semibold';
                  }
                } else {
                  displayHours = `${s.hours}h`;
                  subBadge = `${s.hours}h`;
                }

                return (
                  <button
                    key={s.code}
                    onClick={() => {
                      onSelectShift(s.code);
                      onClose();
                    }}
                    className={`flex items-start justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      s.code === 'OFF'
                        ? 'bg-stone-50 border-stone-300 hover:bg-stone-100'
                        : s.code === 'H'
                        ? 'bg-sky-50/90 border-sky-300 hover:bg-sky-100 ring-offset-1'
                        : 'bg-red-50/90 border-red-300 hover:bg-red-100 ring-offset-1'
                    } ${isSelected ? 'ring-2 ring-[#006241]' : ''}`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-stone-900">{s.code}</span>
                        <span className="text-xs font-black text-[#1E3932]">{displayHours}</span>
                      </div>
                      <div className="text-xs text-stone-700 font-medium">{s.name}</div>
                      <div className={`text-[9px] mt-1 leading-tight ${subBadgeColor}`}>
                        {subBadge}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#006241] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sekcja 4: Dyspozycje (przy układaniu) */}
          {dispoShifts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Dyspozycje (Planowanie)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {dispoShifts.map(s => {
                  const isSelected = s.code === currentShiftCode;
                  return (
                    <button
                      key={s.code}
                      onClick={() => {
                        onSelectShift(s.code);
                        onClose();
                      }}
                      className={`p-2.5 rounded-xl border border-dashed border-stone-300 hover:border-stone-400 text-left transition-all ${
                        isSelected ? 'bg-slate-100 border-slate-500 font-bold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold text-xs text-slate-700">{s.code}</div>
                      <div className="text-[11px] text-slate-500">{s.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Dolny pasek */}
        <div className="bg-stone-50 px-5 py-3 border-t border-stone-200 flex justify-between items-center text-xs text-stone-500">
          <span>Kliknij kafelek zmiany, aby przypisać do grafiku.</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-200 font-medium"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
