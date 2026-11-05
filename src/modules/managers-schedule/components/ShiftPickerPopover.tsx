import React, { useState, useMemo } from 'react';
import { ShiftDefinition, ManagerScheduleMonthData, ManagerScheduleShift } from '../../../types';
import { SmartSwapEngine, SmartSwapCandidate, SmartSwapChange } from '../services/smartSwapEngine';
import { X, Clock, Sun, Moon, Briefcase, CalendarOff, Check, UserCheck, Plus, Minus, Sparkles, Search, ArrowRightLeft, ShieldCheck, AlertCircle } from 'lucide-react';

interface ShiftPickerPopoverProps {
  currentShiftCode: string;
  currentHours?: number;
  currentStartTime?: string;
  currentEndTime?: string;
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
  empId?: number;
  scheduleData?: ManagerScheduleMonthData;
  boundaryShifts?: {
    prevMonthShifts?: ManagerScheduleShift[];
    nextMonthShifts?: ManagerScheduleShift[];
  };
  onApplySwap?: (changes: SmartSwapChange[], summary: string) => Promise<void>;
  onSelectShift: (code: string, customHours?: number, customStartTime?: string, customEndTime?: string) => void;
  onSelectDisposition?: (disposition: string) => void;
  onClose: () => void;
}

const DISPO_PRESETS = [
  { code: '', label: 'Domyślna (FULL)', desc: 'Brak ograniczeń' },
  { code: 'AM', label: 'Rano (AM)', desc: '07:00 – 15:00' },
  { code: 'PM', label: 'Wieczór (PM)', desc: '14:30 – 22:30' },
  { code: 'OFF', label: 'Prośba o wolne (OFF)', desc: 'Niedostępność / Wolne' },
];

const FLEXIBLE_SHIFT_CODES = new Set(['NC', 'SAM', 'SPM', 'SUP', 'MIB', 'MID', 'MI4']);
const HOUR_PRESETS = [4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
const START_TIME_PRESETS = ['07:00', '08:00', '08:30', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '14:30'];

function parseTimeToMinutes(t?: string): number {
  if (!t) return 0;
  const parts = t.split(':');
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function formatMinutesToTime(mins: number): string {
  const norm = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addHoursToTime(startTime: string, hours: number): string {
  const startMins = parseTimeToMinutes(startTime);
  const addMins = Math.round(hours * 60);
  return formatMinutesToTime(startMins + addMins);
}

function diffTimesInHours(startTime: string, endTime: string): number {
  const startMins = parseTimeToMinutes(startTime);
  let endMins = parseTimeToMinutes(endTime);
  if (endMins <= startMins) {
    endMins += 1440;
  }
  return Number(((endMins - startMins) / 60).toFixed(1));
}

export const ShiftPickerPopover: React.FC<ShiftPickerPopoverProps> = ({
  currentShiftCode,
  currentHours,
  currentStartTime,
  currentEndTime,
  currentDisposition = '',
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
  empId,
  scheduleData,
  boundaryShifts,
  onApplySwap,
  onSelectShift,
  onSelectDisposition,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'shifts' | 'smart_swap'>('shifts');
  const [isApplyingSwap, setIsApplyingSwap] = useState(false);

  // Obliczenie wariantów zamiany parzystej AI
  const swapCandidates = useMemo(() => {
    if (!empId || !scheduleData) return [];
    return SmartSwapEngine.findSmartSwapCandidates(
      scheduleData.year,
      scheduleData.month,
      day,
      empId,
      scheduleData,
      boundaryShifts
    );
  }, [empId, scheduleData, day, boundaryShifts]);

  const rawInitDispo = currentDisposition || '';
  const initialDispo = rawInitDispo === 'FULL' ? '' : rawInitDispo;
  const [selectedDispo, setSelectedDispo] = useState<string>(initialDispo);
  const [selectedShiftCode, setSelectedShiftCode] = useState<string>(currentShiftCode || 'OFF');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const initialDef = shiftDefinitions.find(s => s.code === currentShiftCode);
  const [selectedHours, setSelectedHours] = useState<number>(
    currentHours !== undefined ? currentHours : (initialDef ? initialDef.hours : 8.0)
  );
  const [selectedStartTime, setSelectedStartTime] = useState<string>(
    currentStartTime || initialDef?.start_time || '08:00'
  );
  const [selectedEndTime, setSelectedEndTime] = useState<string>(
    currentEndTime || initialDef?.end_time || (currentStartTime ? addHoursToTime(currentStartTime, selectedHours) : '16:00')
  );

  const handleStartTimeChange = (newStart: string) => {
    setSelectedStartTime(newStart);
    setSelectedEndTime(addHoursToTime(newStart, selectedHours));
  };

  const handleEndTimeChange = (newEnd: string) => {
    setSelectedEndTime(newEnd);
    const diffH = diffTimesInHours(selectedStartTime, newEnd);
    if (diffH > 0 && diffH <= 24) {
      setSelectedHours(diffH);
    }
  };

  const handleHoursChange = (newH: number) => {
    const boundedH = Math.max(1.0, Math.min(16.0, Number(newH.toFixed(1))));
    setSelectedHours(boundedH);
    setSelectedEndTime(addHoursToTime(selectedStartTime, boundedH));
  };

  const handleShiftStartTime = (deltaMinutes: number) => {
    const currentMins = parseTimeToMinutes(selectedStartTime);
    const newStart = formatMinutesToTime(currentMins + deltaMinutes);
    handleStartTimeChange(newStart);
  };

  const handleShiftClick = (s: ShiftDefinition) => {
    setSelectedShiftCode(s.code);
    const defHours = s.hours || 8.0;
    if (s.code !== selectedShiftCode) {
      setSelectedHours(defHours);
      const newStart = s.start_time || '08:00';
      setSelectedStartTime(newStart);
      setSelectedEndTime(s.end_time || addHoursToTime(newStart, defHours));
    }
    // Dla standardowych zmian natychmiastowe przypisanie
    if (!FLEXIBLE_SHIFT_CODES.has(s.code)) {
      onSelectShift(s.code, defHours, s.start_time, s.end_time);
      onClose();
    }
  };

  const handleShiftDoubleClick = (s: ShiftDefinition) => {
    onSelectShift(s.code, s.hours || 8.0, s.start_time, s.end_time);
    onClose();
  };

  const handleApplyCustom = () => {
    onSelectShift(
      selectedShiftCode,
      Number(selectedHours.toFixed(1)),
      selectedStartTime,
      selectedEndTime
    );
    onClose();
  };

  // Sprawdzenie czy zmiana jest dozwolona wyłącznie w niedziele
  const isShiftSundayOnly = (s: ShiftDefinition): boolean => {
    return Boolean(
      s.is_sunday_only ||
      s.name.toLowerCase().includes('niedziel') ||
      ['AMN', 'PMN'].includes(s.code)
    );
  };

  // Filtrowanie zmian wg wyszukiwarki
  const filteredShifts = useMemo(() => {
    if (!searchQuery.trim()) return shiftDefinitions;
    const q = searchQuery.toLowerCase().trim();
    return shiftDefinitions.filter(s =>
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.category && s.category.toLowerCase().includes(q))
    );
  }, [shiftDefinitions, searchQuery]);

  // Grupowanie zmian wg kategorii
  const coverageShifts = filteredShifts.filter(s => s.category === 'coverage' || (!s.is_nc && !s.is_absence && s.category !== 'dispo'));
  const ncShifts = filteredShifts.filter(s => s.is_nc || s.category === 'nc');
  const absenceShifts = filteredShifts.filter(s => s.is_absence || s.category === 'absence');
  const dispoShifts = filteredShifts.filter(s => s.category === 'dispo');

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

        {/* Pasek zakładek: Katalog Zmian vs Smart Swap AI */}
        <div className="flex border-b border-stone-200 bg-stone-100/70 px-5 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('shifts')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-t border-x ${
              activeTab === 'shifts'
                ? 'bg-white text-[#1E3932] border-stone-200 -mb-px shadow-xs'
                : 'text-stone-500 hover:text-stone-800 border-transparent hover:bg-stone-200/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Katalog Zmian & Godziny</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('smart_swap')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-t border-x ${
              activeTab === 'smart_swap'
                ? 'bg-white text-[#006241] border-stone-200 -mb-px shadow-xs'
                : 'text-emerald-700 hover:text-emerald-900 border-transparent hover:bg-emerald-100/50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Smart Swap AI</span>
            {swapCandidates.length > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded-full text-[10px] font-black shadow-2xs">
                {swapCandidates.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'smart_swap' ? (
          <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4">
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#006241] text-white flex items-center justify-center shrink-0 shadow-xs font-bold">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-[#1E3932] flex items-center gap-2">
                  <span>Asystent Wymiany Parzystej dla: {managerName} (Dzień {day})</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-black">
                    Aktualnie: {currentShiftCode} ({currentHours || 8}h)
                  </span>
                </h4>
                <p className="text-[11px] text-stone-600 mt-0.5 leading-relaxed">
                  AI przeszukało grafik zespołu i wyselekcjonowało bezkolizyjne warianty zamiany. Każda propozycja zachowuje 100% Kodeksu Pracy (11h/35h) oraz zerowy bilans etatów w TOR (0.0h).
                </p>
              </div>
            </div>

            {swapCandidates.length === 0 ? (
              <div className="py-10 text-center bg-stone-50 rounded-xl border border-dashed border-stone-300 p-6">
                <AlertCircle className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                <h5 className="text-xs font-bold text-stone-700">Brak bezkolizyjnych zamian parzystych</h5>
                <p className="text-[11px] text-stone-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  W wybranym dniu żaden inny menedżer nie posiada pasującego dyżuru lub zamiana naruszyłaby 11h odpoczynku dobowego bądź serię niedziel.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {swapCandidates.map(cand => (
                  <div
                    key={cand.id}
                    className="bg-white border border-stone-200 hover:border-emerald-500 rounded-xl p-4 transition-all shadow-xs hover:shadow-md space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                          {cand.targetEmployeeName.charAt(0)}
                        </span>
                        <div>
                          <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                            <span>{cand.targetEmployeeName}</span>
                            <span className="text-[10px] text-stone-500 font-medium">({cand.targetRole})</span>
                          </div>
                          <div className="text-[10px] text-stone-500">
                            {cand.type === 'same_day' ? 'Zamiana dyżurów w tym samym dniu' : `Zamiana krzyżowa (Dzień ${cand.primaryDay} ↔ Dzień ${cand.compensatingDay})`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {cand.containsVacation && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                            ⚠️ Przesunięcie H
                          </span>
                        )}
                        {cand.containsAdmin && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-bold">
                            📋 Przesunięcie NC
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold">
                          {cand.tag}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>100% KP • Δ 0.0h</span>
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-stone-700 font-medium">
                      {cand.description}
                    </p>

                    {/* Szczegóły zmian */}
                    <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-200 text-xs space-y-1 font-mono">
                      {cand.changes.map((ch, idx) => (
                        <div key={idx} className="flex items-center justify-between text-stone-700 text-[11px]">
                          <span className="font-sans font-semibold text-stone-800">
                            {ch.employeeName} (Dzień {ch.day}):
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-stone-400 line-through">{ch.prevShiftCode}</span>
                            <span>➔</span>
                            <strong className="text-[#006241]">{ch.newShiftCode}</strong>
                            <span className="text-[10px] text-stone-500 font-sans">({ch.hours}h)</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-stone-500 italic max-w-xs truncate" title={cand.explanation}>
                        {cand.explanation}
                      </span>
                      <button
                        type="button"
                        disabled={isApplyingSwap || !onApplySwap}
                        onClick={async () => {
                          if (!onApplySwap) return;
                          setIsApplyingSwap(true);
                          try {
                            await onApplySwap(cand.changes, cand.description);
                            onClose();
                          } finally {
                            setIsApplyingSwap(false);
                          }
                        }}
                        className="px-3 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-lg transition-all shadow-xs hover:shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>{isApplyingSwap ? 'Zapisywanie...' : '⚡ Zastosuj Zamianę 1-Klik'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="p-5 max-h-[75vh] overflow-y-auto space-y-5">
          {/* SEKCJA DYSPOZYCYJNOŚCI MENEDŻERA */}
          <div className="bg-stone-50/90 p-3.5 rounded-xl border border-stone-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1E3932] uppercase tracking-wider">
                <UserCheck className="w-4 h-4 text-[#006241]" />
                <span>Dyspozycyjność Menedżera (Dzień {day})</span>
              </div>
              <span className="text-[11px] text-stone-600">
                Wybrana:{' '}
                <strong
                  className={`font-black px-1.5 py-0.5 rounded ${
                    selectedDispo === 'OFF'
                      ? 'bg-rose-100 text-rose-950 border border-rose-300'
                      : selectedDispo === 'AM' || selectedDispo === 'M'
                      ? 'bg-amber-100 text-amber-950 border border-amber-300'
                      : selectedDispo === 'PM' || selectedDispo === 'Z'
                      ? 'bg-indigo-100 text-indigo-950 border border-indigo-300'
                      : 'bg-stone-200 text-stone-800 border border-stone-300'
                  }`}
                >
                  {selectedDispo === 'OFF'
                    ? 'Prośba o wolne (OFF)'
                    : selectedDispo === 'AM' || selectedDispo === 'M'
                    ? 'Rano (AM)'
                    : selectedDispo === 'PM' || selectedDispo === 'Z'
                    ? 'Wieczór (PM)'
                    : 'Domyślna (FULL)'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Grupa Puste/FULL, AM, PM */}
              <div className="grid grid-cols-3 gap-2 flex-1">
                {DISPO_PRESETS.filter(d => d.code !== 'OFF').map(d => {
                  const isDispoSelected =
                    selectedDispo === d.code ||
                    (d.code === '' && (selectedDispo === '' || selectedDispo === 'FULL')) ||
                    (d.code === 'AM' && selectedDispo === 'M') ||
                    (d.code === 'PM' && selectedDispo === 'Z');
                  return (
                    <button
                      key={d.code || 'DEFAULT'}
                      type="button"
                      onClick={async () => {
                        setSelectedDispo(d.code);
                        if (onSelectDisposition) {
                          await onSelectDisposition(d.code);
                        }
                      }}
                      className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                        isDispoSelected
                          ? d.code === ''
                            ? 'bg-[#1E3932] text-white border-[#1E3932] shadow-xs font-bold ring-2 ring-[#1E3932]/30'
                            : d.code === 'AM'
                            ? 'bg-amber-600 text-white border-amber-700 shadow-xs font-bold ring-2 ring-amber-400/30'
                            : 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-bold ring-2 ring-indigo-400/30'
                          : 'bg-white hover:bg-stone-100 border-stone-300 text-stone-800'
                      }`}
                    >
                      <div className="text-xs font-black">{d.code || 'FULL'}</div>
                      <div className={`text-[9px] truncate ${isDispoSelected ? 'text-white/90' : 'text-stone-500'}`}>
                        {d.label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Separator */}
              <div className="h-10 w-px bg-stone-300 shrink-0" />

              {/* Rozdzielony Przycisk OFF w Czerwieni */}
              {DISPO_PRESETS.filter(d => d.code === 'OFF').map(d => {
                const isDispoSelected = selectedDispo === 'OFF';
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
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer min-w-[95px] ${
                      isDispoSelected
                        ? 'bg-rose-600 text-white border-rose-700 shadow-md font-black ring-2 ring-rose-400'
                        : 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-900 font-bold'
                    }`}
                  >
                    <div className="text-xs font-black">OFF</div>
                    <div className={`text-[9px] truncate ${isDispoSelected ? 'text-rose-100' : 'text-rose-700'}`}>
                      Prośba o wolne
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-stone-500 mt-2 leading-tight">
              💡 Puste okienko to domyślna pełna dostępność. Wprowadzone preferencje (<strong>M</strong>, <strong>Z</strong> oraz <span className="text-rose-700 font-bold">OFF</span>) wyświetlają się po lewej stronie kwadratu dnia w grafiku.
            </p>
          </div>

          {/* PASEK WYSZUKIWANIA ZMIAN */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Wyszukaj zmianę po kodzie lub nazwie (np. AM, PM, SUP, NC, Urlop, Szkolenie)..."
              className="w-full pl-9 pr-8 py-2 bg-stone-50 hover:bg-white focus:bg-white border border-stone-300 focus:border-[#006241] rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#006241]/20 transition-all shadow-2xs font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 rounded-full hover:bg-stone-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sekcja 1: Floor / Coverage (Obsługa sali i baru) */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#006241] uppercase tracking-wider mb-2.5">
              <Sun className="w-3.5 h-3.5" />
              <span>Coverage & Sala / Bar</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {coverageShifts.map(s => {
                const isSelected = s.code === selectedShiftCode;
                const isSundayOnly = isShiftSundayOnly(s);
                const isBlocked = !isSunday && isSundayOnly;
                const isExternalSupport = ['SUP', 'SAM', 'SPM'].includes(s.code);
                const isFlexible = FLEXIBLE_SHIFT_CODES.has(s.code);

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
                    type="button"
                    onClick={() => handleShiftClick(s)}
                    onDoubleClick={() => handleShiftDoubleClick(s)}
                    className={`flex items-start justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
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
                        {isFlexible && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-300">
                            ±h
                          </span>
                        )}
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
                const isSelected = s.code === selectedShiftCode;
                const isFlexible = FLEXIBLE_SHIFT_CODES.has(s.code);
                return (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => handleShiftClick(s)}
                    onDoubleClick={() => handleShiftDoubleClick(s)}
                    className={`flex items-start justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/80 ring-2 ring-purple-600/20 shadow-xs'
                        : 'border-stone-200 hover:border-purple-400 hover:bg-purple-50/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-purple-900">{s.code}</span>
                        <span className="text-[11px] text-purple-600 font-medium">{s.hours}h</span>
                        {isFlexible && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-100 text-purple-800 font-extrabold border border-purple-300">
                            ±h
                          </span>
                        )}
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

        {/* PANEL DOSTOSOWANIA GODZIN I CZASU TRWANIA (OD – DO) DLA ZMIAN ELASTYCZNYCH */}
        {FLEXIBLE_SHIFT_CODES.has(selectedShiftCode) && (
          <div className="bg-emerald-50/95 border-t-2 border-emerald-600 p-4 animate-fade-in shadow-xs space-y-3">
            {/* Wiersz 1: Nagłówek i przycisk Zastosuj */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-[#006241] text-white text-xs font-black tracking-wider uppercase">
                    {selectedShiftCode}
                  </span>
                  <span className="text-xs font-bold text-[#1E3932]">
                    Dostosuj godziny pracy i wymiar (Od – Do)
                  </span>
                  <span className="text-[11px] text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-full font-bold border border-emerald-300">
                    {selectedStartTime} – {selectedEndTime} ({selectedHours.toFixed(1)}h)
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 mt-1">
                  Ustaw godzinę rozpoczęcia ("od której") i zakończenia ("do której") lub wybierz szybki preset.
                </div>
              </div>

              {/* Przycisk potwierdzenia */}
              <button
                type="button"
                onClick={handleApplyCustom}
                className="px-4 py-2 bg-[#006241] hover:bg-[#00754A] active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Check className="w-4 h-4" />
                <span>Zastosuj {selectedShiftCode} ({selectedStartTime} – {selectedEndTime}, {selectedHours.toFixed(1)}h)</span>
              </button>
            </div>

            {/* Wiersz 2: Kontrolki Od / Do oraz Stepper Wymiaru */}
            <div className="flex flex-wrap items-center gap-3 bg-white/95 p-2.5 rounded-xl border border-emerald-200">
              {/* Kontrolka OD */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-stone-700">Od:</span>
                <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleShiftStartTime(-30)}
                    className="px-1.5 py-1 text-[11px] text-stone-600 hover:bg-stone-100 border-r border-stone-200 font-bold"
                    title="Cofnij o 30 minut"
                  >
                    -30m
                  </button>
                  <input
                    type="time"
                    value={selectedStartTime}
                    onChange={e => handleStartTimeChange(e.target.value)}
                    className="px-2 py-1 text-xs font-black text-[#1E3932] text-center focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleShiftStartTime(30)}
                    className="px-1.5 py-1 text-[11px] text-stone-600 hover:bg-stone-100 border-l border-stone-200 font-bold"
                    title="Przesuń o 30 minut w przód"
                  >
                    +30m
                  </button>
                </div>
              </div>

              <span className="text-stone-400 font-bold text-xs">➔</span>

              {/* Kontrolka DO */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-stone-700">Do:</span>
                <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                  <input
                    type="time"
                    value={selectedEndTime}
                    onChange={e => handleEndTimeChange(e.target.value)}
                    className="px-2 py-1 text-xs font-black text-[#1E3932] text-center focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="h-5 w-px bg-emerald-200 mx-1 hidden sm:block" />

              {/* Stepper wymiaru godzinowego */}
              <div className="flex items-center gap-1.5 sm:ml-auto">
                <span className="text-xs font-bold text-stone-700">Wymiar:</span>
                <div className="flex items-center gap-1 bg-white border border-stone-300 rounded-lg p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleHoursChange(selectedHours - 0.5)}
                    className="p-1 hover:bg-stone-100 rounded text-stone-700 transition-colors cursor-pointer"
                    title="Odejmij 0.5h"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 text-xs font-black text-[#1E3932] min-w-[36px] text-center">
                    {selectedHours.toFixed(1)}h
                  </span>
                  <button
                    type="button"
                    onClick={() => handleHoursChange(selectedHours + 0.5)}
                    className="p-1 hover:bg-stone-100 rounded text-stone-700 transition-colors cursor-pointer"
                    title="Dodaj 0.5h"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Wiersz 3: Szybkie presety godziny startu */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-tight mr-1">
                Start (od której):
              </span>
              {START_TIME_PRESETS.map(presetTime => {
                const isStartActive = selectedStartTime === presetTime;
                return (
                  <button
                    key={presetTime}
                    type="button"
                    onClick={() => handleStartTimeChange(presetTime)}
                    className={`px-2 py-0.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      isStartActive
                        ? 'bg-[#006241] text-white border-[#006241] shadow-xs ring-2 ring-[#006241]/20 font-black'
                        : 'bg-white text-stone-700 border-stone-300 hover:bg-emerald-100/50 hover:border-emerald-400'
                    }`}
                  >
                    {presetTime}
                  </button>
                );
              })}
            </div>

            {/* Wiersz 4: Szybkie presety wymiaru */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-tight mr-1">
                Wymiar (ile godzin):
              </span>
              {HOUR_PRESETS.map(presetH => {
                const isPresetActive = Math.abs(selectedHours - presetH) < 0.01;
                return (
                  <button
                    key={presetH}
                    type="button"
                    onClick={() => handleHoursChange(presetH)}
                    className={`px-2.5 py-0.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      isPresetActive
                        ? 'bg-[#006241] text-white border-[#006241] shadow-xs ring-2 ring-[#006241]/20 font-black'
                        : 'bg-white text-stone-700 border-stone-300 hover:bg-emerald-100/50 hover:border-emerald-400'
                    }`}
                  >
                    {presetH.toFixed(1)}h
                  </button>
                );
              })}
            </div>
          </div>
        )}
          </>
        )}

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
