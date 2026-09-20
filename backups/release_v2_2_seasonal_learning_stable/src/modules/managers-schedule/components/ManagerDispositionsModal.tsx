import React, { useState } from 'react';
import {
  ManagerScheduleMonthData,
  ManagerEmployee
} from '../../../types';
import {
  X,
  ClipboardPaste,
  Save,
  Sparkles,
  CheckCircle2,
  Calendar,
  AlertCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

interface ManagerDispositionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ManagerScheduleMonthData;
  onSaveBatch: (items: Array<{ day: number; employee_id: number; disposition: string }>) => Promise<void>;
  isReadOnly?: boolean;
}

type DispositionType = 'OFF' | 'M' | 'Z' | 'FULL';

export const ManagerDispositionsModal: React.FC<ManagerDispositionsModalProps> = ({
  isOpen,
  onClose,
  data,
  onSaveBatch,
  isReadOnly: customIsReadOnly
}) => {
  if (!isOpen) return null;

  const isReadOnly = Boolean(customIsReadOnly ?? data.isMonthClosed);

  // Stan lokalny matrycy dyspozycji: empId -> day -> disposition
  const [dispositions, setDispositions] = useState<Map<number, Map<number, DispositionType>>>(() => {
    const map = new Map<number, Map<number, DispositionType>>();
    for (const row of data.rows) {
      const empMap = new Map<number, DispositionType>();
      for (const d of data.daySummaries) {
        const shift = row.shifts[d.day];
        const dispo = (shift?.disposition as DispositionType) || 'OFF';
        empMap.set(d.day, dispo);
      }
      map.set(row.employee.id, empMap);
    }
    return map;
  });

  const [activeCell, setActiveCell] = useState<{ empId: number; day: number } | null>(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteTargetEmpId, setPasteTargetEmpId] = useState<number | 'ALL'>('ALL');
  const [pasteRawText, setPasteRawText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sprawdzenie czy nastąpiły jakiekolwiek zmiany względem stanu wejściowego
  const [hasChanges, setHasChanges] = useState(false);

  // Funkcja zmiany wartości komórki
  const updateCell = (empId: number, day: number, newDispo: DispositionType) => {
    if (isReadOnly) return;
    setDispositions(prev => {
      const next = new Map(prev);
      const empMap = new Map(next.get(empId) || []);
      empMap.set(day, newDispo);
      next.set(empId, empMap);
      return next;
    });
    setHasChanges(true);
    setSaveSuccess(false);
  };

  // Cykliczna zmiana po kliknięciu: OFF -> M -> Z -> FULL -> OFF
  const cycleCell = (empId: number, day: number) => {
    if (isReadOnly) return;
    const current = dispositions.get(empId)?.get(day) || 'OFF';
    const cycleMap: Record<DispositionType, DispositionType> = {
      OFF: 'M',
      M: 'Z',
      Z: 'FULL',
      FULL: 'OFF'
    };
    updateCell(empId, day, cycleMap[current] || 'M');
  };

  // Obsługa klawiatury dla zaznaczonej komórki
  const handleKeyDown = (e: React.KeyboardEvent, empId: number, day: number) => {
    if (isReadOnly) return;
    const key = e.key.toLowerCase();
    if (key === 'm') {
      updateCell(empId, day, 'M');
    } else if (key === 'z') {
      updateCell(empId, day, 'Z');
    } else if (key === 'f') {
      updateCell(empId, day, 'FULL');
    } else if (key === 'o' || key === 'delete' || key === 'backspace' || key === ' ') {
      updateCell(empId, day, 'OFF');
    } else if (e.key === 'ArrowRight') {
      if (day < data.daySummaries.length) {
        setActiveCell({ empId, day: day + 1 });
      }
    } else if (e.key === 'ArrowLeft') {
      if (day > 1) {
        setActiveCell({ empId, day: day - 1 });
      }
    }
  };

  // Parser wartości z tekstu (np. skopiowanych z Excela)
  const parseExcelValue = (raw: string): DispositionType => {
    const val = raw.trim().toLowerCase();
    if (!val || val === 'off' || val === 'w' || val === 'wolne' || val === 'wolny' || val === '-' || val === 'x' || val === '0') {
      return 'OFF';
    }
    if (val === 'm' || val.startsWith('rano') || val === 'am' || val === '1') {
      return 'M';
    }
    if (val === 'z' || val.startsWith('wiecz') || val.startsWith('zamk') || val === 'pm' || val === '2') {
      return 'Z';
    }
    if (val === 'full' || val === 'f' || val.includes('cał') || val.includes('cal') || val.includes('pełn') || val.includes('peln') || val.includes('dyspo') || val === '3' || val === '+') {
      return 'FULL';
    }
    return 'OFF';
  };

  // Zastosowanie wklejonego tekstu z Excela
  const applyPastedData = () => {
    if (isReadOnly || !pasteRawText.trim()) return;

    const lines = pasteRawText.trim().split(/\r?\n/);
    setDispositions(prev => {
      const next = new Map(prev);

      if (pasteTargetEmpId !== 'ALL') {
        // Wklejanie dla JEDNEGO konkretnego pracownika (weź pierwszą linię lub połącz wszystkie komórki rozdzielone tabulacją/spacjami)
        const lineTokens = lines.flatMap(l => l.split(/\t|,/)).map(t => t.trim()).filter(t => t.length > 0);
        const empMap = new Map(next.get(pasteTargetEmpId) || []);

        for (let i = 0; i < Math.min(lineTokens.length, data.daySummaries.length); i++) {
          const day = i + 1;
          const parsed = parseExcelValue(lineTokens[i]);
          empMap.set(day, parsed);
        }
        next.set(pasteTargetEmpId, empMap);
      } else {
        // Wklejanie dla CAŁEGO ZESPOŁU (każda linia to kolejny menedżer wg listy)
        const activeEmployees = data.employees.filter(e => e.is_active);
        for (let empIdx = 0; empIdx < Math.min(lines.length, activeEmployees.length); empIdx++) {
          const emp = activeEmployees[empIdx];
          const tokens = lines[empIdx].split(/\t|,/).map(t => t.trim());
          const empMap = new Map(next.get(emp.id) || []);

          for (let dayIdx = 0; dayIdx < Math.min(tokens.length, data.daySummaries.length); dayIdx++) {
            const day = dayIdx + 1;
            const parsed = parseExcelValue(tokens[dayIdx]);
            empMap.set(day, parsed);
          }
          next.set(emp.id, empMap);
        }
      }

      return next;
    });

    setHasChanges(true);
    setShowPasteModal(false);
    setPasteRawText('');
  };

  // Szybkie wypełnienie całego wiersza pracownika
  const fillEmployeeRow = (empId: number, dispo: DispositionType) => {
    if (isReadOnly) return;
    setDispositions(prev => {
      const next = new Map(prev);
      const empMap = new Map();
      for (const d of data.daySummaries) {
        empMap.set(d.day, dispo);
      }
      next.set(empId, empMap);
      return next;
    });
    setHasChanges(true);
  };

  // Zapis zbiorczy do bazy danych
  const handleSaveAll = async () => {
    if (isReadOnly) return;
    try {
      setIsSaving(true);
      const batchItems: Array<{ day: number; employee_id: number; disposition: string }> = [];

      for (const [empId, empMap] of dispositions.entries()) {
        for (const [day, dispo] of empMap.entries()) {
          batchItems.push({
            employee_id: empId,
            day,
            disposition: dispo
          });
        }
      }

      await onSaveBatch(batchItems);
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (error) {
      console.error('Błąd zapisu zbiorczego dyspozycji:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Obliczenie statystyk dyspozycji dla wiersza
  const getEmpStats = (empId: number) => {
    const empMap = dispositions.get(empId);
    let countM = 0;
    let countZ = 0;
    let countFull = 0;
    let countOff = 0;

    if (empMap) {
      for (const d of data.daySummaries) {
        const val = empMap.get(d.day) || 'OFF';
        if (val === 'M') countM++;
        else if (val === 'Z') countZ++;
        else if (val === 'FULL') countFull++;
        else countOff++;
      }
    }
    return { countM, countZ, countFull, countOff };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-[96vw] max-h-[94vh] flex flex-col overflow-hidden">
        
        {/* NAGŁÓWEK MODALU */}
        <div className="px-6 py-4 bg-[#1E3932] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#006241] text-emerald-200 shadow-inner">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">
                  Matryca Dyspozycyjności Menedżerów
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-200 text-xs font-bold border border-emerald-600">
                  {data.monthName} {data.year}
                </span>
                {isReadOnly && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-900/80 text-rose-200 text-xs font-bold border border-rose-700 flex items-center gap-1">
                    🔒 Miesiąc zamknięty (Tylko do odczytu)
                  </span>
                )}
                {!isReadOnly && hasChanges && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-xs font-black animate-pulse">
                    Niezapisane zmiany
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                {isReadOnly
                  ? 'Podgląd zadeklarowanych dyspozycji zespołu dla zamkniętego miesiąca.'
                  : 'Zbiorczy podgląd i edycja dyspozycji zespołu. Kliknij komórkę, aby zmienić dyspozycję, lub wklej dane z Excela.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* PRZYCISK: WKLEJ Z EXCELA */}
            {!isReadOnly && (
              <button
                onClick={() => {
                  setPasteRawText('');
                  setShowPasteModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
                title="Wklej skopiowane wiersze lub tabelę z arkusza Excel"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span>Wklej z Excela</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-700/50 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PASEK SZYBKIEJ LEGENDY I INSTRUKCJI KLAWISZOWEJ */}
        <div className="px-6 py-2.5 bg-[#F4F7F5] border-b border-[#E2E8E5] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-bold text-stone-700">Wartości dyspozycji:</span>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">M</span>
              <span className="text-stone-600 font-medium">Rano (Morning)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[11px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-2xs">Z</span>
              <span className="text-stone-600 font-medium">Zamknięcie (Closing)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">FULL</span>
              <span className="text-stone-600 font-medium">Pełna dyspozycja (Dowolna)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-stone-100 text-stone-500 border border-stone-300">OFF</span>
              <span className="text-stone-600">Dzień wolny / Brak dyspozycji</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-stone-500 bg-white px-3 py-1 rounded-xl border border-stone-200">
            <Sparkles className="w-3.5 h-3.5 text-[#006241]" />
            <span>
              Wskazówka: kliknij komórkę, aby przełączyć cyklicznie, lub użyj klawiszy <kbd className="px-1 py-0.5 bg-stone-100 border rounded font-mono font-bold">M</kbd>, <kbd className="px-1 py-0.5 bg-stone-100 border rounded font-mono font-bold">Z</kbd>, <kbd className="px-1 py-0.5 bg-stone-100 border rounded font-mono font-bold">F</kbd>, <kbd className="px-1 py-0.5 bg-stone-100 border rounded font-mono font-bold">O</kbd>.
            </span>
          </div>
        </div>

        {/* TABELA MATRYCY DYSPOZYCJI */}
        <div className="flex-1 overflow-auto p-4 bg-stone-50">
          <div className="bg-white rounded-2xl border border-stone-300 shadow-xs overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                {/* Wiersz 1: Dni miesiąca */}
                <tr className="bg-[#EEF3F0] text-stone-700 font-bold border-b border-[#D0DCD6]">
                  <th className="sticky left-0 z-30 bg-[#EEF3F0] px-3 py-2.5 text-left w-[180px] min-w-[180px] border-r border-[#D0DCD6]">
                    Menedżer
                  </th>
                  <th className="sticky left-[180px] z-30 bg-[#EEF3F0] px-2 py-2.5 text-center w-[120px] min-w-[120px] border-r-2 border-stone-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[10px] uppercase tracking-wider text-stone-600">
                    Bilans dyspozycji
                  </th>

                  {data.daySummaries.map(d => (
                    <th
                      key={`hdr-day-${d.day}`}
                      className={`px-1 py-1.5 text-center border-r border-[#E2E8E5] min-w-[38px] max-w-[42px] ${
                        d.isHoliday
                          ? 'bg-rose-100 text-rose-950 font-black'
                          : d.isTradingSunday
                          ? 'bg-emerald-100 text-emerald-950 font-black'
                          : d.isSunday
                          ? 'bg-amber-100/70 text-amber-950'
                          : d.isWeekend
                          ? 'bg-amber-50 text-amber-900'
                          : ''
                      }`}
                    >
                      <div className="text-[11px] font-black">{d.day}</div>
                      <div className="text-[9px] font-semibold text-stone-500">{d.dayName}</div>
                    </th>
                  ))}

                  <th className="px-3 py-2 text-center bg-[#EEF3F0] text-stone-600 text-[10px] uppercase min-w-[90px]">
                    Narzędzia
                  </th>
                </tr>

                {/* Wiersz 2: Status dni kalendarza */}
                <tr className="bg-[#F7F9F8] text-[8px] font-bold text-stone-500 border-b-2 border-stone-300 select-none">
                  <th className="sticky left-0 z-30 bg-[#F7F9F8] px-3 py-1 text-left border-r border-[#D0DCD6] uppercase text-stone-400">
                    Kalendarz
                  </th>
                  <th className="sticky left-[180px] z-30 bg-[#F7F9F8] border-r-2 border-stone-300" />

                  {data.daySummaries.map(d => (
                    <th
                      key={`sub-hdr-${d.day}`}
                      className="px-0.5 py-1 text-center border-r border-[#E2E8E5]"
                    >
                      {d.isHoliday ? (
                        <span className="text-rose-700 font-black" title={d.holidayName}>🇵🇱</span>
                      ) : d.isTradingSunday ? (
                        <span className="text-emerald-700 font-black" title="Niedziela Handlowa">🛒</span>
                      ) : d.isSunday ? (
                        <span className="text-amber-700" title="Niedziela wolna">Wol</span>
                      ) : d.isWeekend ? (
                        <span className="text-stone-500">Sob</span>
                      ) : (
                        <span className="text-stone-300">Praca</span>
                      )}
                    </th>
                  ))}

                  <th className="bg-[#F7F9F8]" />
                </tr>
              </thead>

              <tbody className="divide-y divide-[#E2E8E5]">
                {data.employees.filter(e => e.is_active).map((emp, empIdx) => {
                  const empMap = dispositions.get(emp.id);
                  const isEven = empIdx % 2 === 0;
                  const rowBg = isEven ? 'bg-white' : 'bg-[#FAFCFB]';
                  const stats = getEmpStats(emp.id);

                  return (
                    <tr key={emp.id} className={`${rowBg} hover:bg-emerald-50/30 transition-colors`}>
                      {/* Kolumna 1: Menedżer */}
                      <td className={`sticky left-0 z-20 px-3 py-2 border-r border-[#E2E8E5] ${rowBg}`}>
                        <div className="font-bold text-stone-900 truncate" title={emp.name}>
                          {emp.name}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-stone-500">
                          <span>{emp.role}</span>
                          <span>•</span>
                          <span className="font-semibold text-emerald-800">{emp.contract_type}</span>
                        </div>
                      </td>

                      {/* Kolumna 2: Mini-podsumowanie dyspozycji pracownika */}
                      <td className={`sticky left-[180px] z-20 px-2 py-1.5 border-r-2 border-stone-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-center ${rowBg}`}>
                        <div className="flex items-center justify-center gap-1 text-[10px]">
                          <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-900 font-black" title="Zgłoszone poranki (M)">
                            {stats.countM}M
                          </span>
                          <span className="px-1 py-0.2 rounded bg-indigo-100 text-indigo-900 font-black" title="Zgłoszone zamknięcia (Z)">
                            {stats.countZ}Z
                          </span>
                          <span className="px-1 py-0.2 rounded bg-emerald-100 text-emerald-900 font-black" title="Zgłoszona pełna dyspozycja (FULL)">
                            {stats.countFull}F
                          </span>
                          <span className="px-1 py-0.2 rounded bg-stone-100 text-stone-600 font-bold" title="Dni wolne (OFF)">
                            {stats.countOff}W
                          </span>
                        </div>
                      </td>

                      {/* Komórki dni 1..31 z dyspozycją */}
                      {data.daySummaries.map(d => {
                        const val = empMap?.get(d.day) || 'OFF';
                        const isSelected = activeCell?.empId === emp.id && activeCell?.day === d.day;

                        let badgeStyle = 'bg-stone-50 text-stone-400 border-stone-200 hover:border-stone-400';
                        if (val === 'M') {
                          badgeStyle = 'bg-amber-100 text-amber-950 border-amber-300 font-black shadow-2xs';
                        } else if (val === 'Z') {
                          badgeStyle = 'bg-indigo-100 text-indigo-950 border-indigo-300 font-black shadow-2xs';
                        } else if (val === 'FULL') {
                          badgeStyle = 'bg-emerald-100 text-emerald-950 border-emerald-300 font-black shadow-2xs';
                        }

                        return (
                          <td
                            key={`cell-${emp.id}-${d.day}`}
                            tabIndex={isReadOnly ? -1 : 0}
                            onClick={isReadOnly ? undefined : () => {
                              setActiveCell({ empId: emp.id, day: d.day });
                              cycleCell(emp.id, d.day);
                            }}
                            onFocus={isReadOnly ? undefined : () => setActiveCell({ empId: emp.id, day: d.day })}
                            onKeyDown={isReadOnly ? undefined : (e) => handleKeyDown(e, emp.id, d.day)}
                            className={`p-1 text-center border-r border-[#E2E8E5] transition-all min-w-[38px] max-w-[42px] focus:outline-hidden ${
                              isReadOnly ? 'cursor-default select-none' : 'cursor-pointer'
                            } ${
                              isSelected && !isReadOnly ? 'ring-2 ring-emerald-600 ring-inset bg-emerald-50' : ''
                            } ${
                              d.isHoliday ? 'bg-rose-50/20' : d.isSunday ? 'bg-amber-50/20' : d.isWeekend ? 'bg-amber-50/10' : ''
                            }`}
                            title={isReadOnly ? `${emp.name} • Dzień ${d.day}: ${val === 'OFF' ? 'Wolne / Brak' : val} (Tylko odczyt)` : `${emp.name} • Dzień ${d.day}: ${val === 'OFF' ? 'Wolne / Brak' : val} (Kliknij, aby przełączyć)`}
                          >
                            <span className={`inline-flex items-center justify-center w-7 h-6 rounded-md border text-[11px] ${isReadOnly ? '' : 'transition-transform hover:scale-110 active:scale-95'} ${badgeStyle}`}>
                              {val === 'OFF' ? '-' : val}
                            </span>
                          </td>
                        );
                      })}

                      {/* Szybkie narzędzia per wiersz */}
                      <td className="px-2 py-1 text-center bg-stone-50">
                        {isReadOnly ? (
                          <span className="text-[10px] text-stone-400 italic">Zablokowane</span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => fillEmployeeRow(emp.id, 'FULL')}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 transition-colors cursor-pointer"
                              title="Wypełnij cały miesiąc jako FULL dla tego menedżera"
                            >
                              FULL
                            </button>
                            <button
                              type="button"
                              onClick={() => fillEmployeeRow(emp.id, 'OFF')}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-200 hover:bg-stone-300 text-stone-700 transition-colors cursor-pointer"
                              title="Wyczyść wszystkie dyspozycje dla tego menedżera"
                            >
                              OFF
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPasteTargetEmpId(emp.id);
                                setPasteRawText('');
                                setShowPasteModal(true);
                              }}
                              className="p-1 rounded text-stone-500 hover:text-stone-900 hover:bg-stone-200 transition-colors cursor-pointer"
                              title="Wklej z Excela tylko dla tego pracownika"
                            >
                              <ClipboardPaste className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* DOLNA BELKA AKCJI I ZAPISU */}
        <div className="px-6 py-3.5 bg-white border-t border-[#E2E8E5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {isReadOnly ? (
              <div className="flex items-center gap-1.5 text-stone-600 font-semibold text-xs bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200">
                <span>🔒 Miesiąc jest zamknięty — edycja dyspozycji została zablokowana (tryb tylko do odczytu).</span>
              </div>
            ) : saveSuccess ? (
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Dyspozycje zostały pomyślnie zapisane! Zamykanie...</span>
              </div>
            ) : hasChanges ? (
              <div className="flex items-center gap-1.5 text-amber-800 font-semibold text-xs bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Wprowadzono zmiany w matrycy. Kliknij Zapisz, aby utrwalić w grafiku.</span>
              </div>
            ) : (
              <span className="text-xs text-stone-500">
                Wszystkie dyspozycje są aktualne i zsynchronizowane z bazą.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isReadOnly ? (
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Zamknij
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Anuluj
                </button>

                <button
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#006241] hover:bg-[#1E3932] text-white text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 hover:scale-105 active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Zapisywanie...' : 'Zapisz wszystkie dyspozycje'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* SUB-MODAL: INTELIGENTNE WKLEJANIE Z EXCELA */}
        {showPasteModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl overflow-hidden flex flex-col">
              <div className="px-6 py-4 bg-[#1E3932] text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ClipboardPaste className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold">Inteligentne Wklejanie z Excela</h3>
                </div>
                <button
                  onClick={() => setShowPasteModal(false)}
                  className="p-1 rounded-lg text-stone-300 hover:text-white hover:bg-stone-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Docelowy menedżer:
                  </label>
                  <select
                    value={pasteTargetEmpId}
                    onChange={e => {
                      const val = e.target.value;
                      setPasteTargetEmpId(val === 'ALL' ? 'ALL' : Number(val));
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-hidden focus:border-emerald-600 bg-white"
                  >
                    <option value="ALL">📋 Cały zespół (każdy wiersz tekstu = kolejny menedżer)</option>
                    {data.employees.filter(e => e.is_active).map(emp => (
                      <option key={emp.id} value={emp.id}>
                        👤 {emp.name} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-stone-700">
                      Wklej zawartość ze schowka (Ctrl+V):
                    </label>
                    <span className="text-[11px] text-stone-400">
                      Format rozdzielany tabulatorami z Excela
                    </span>
                  </div>
                  <textarea
                    autoFocus
                    rows={6}
                    value={pasteRawText}
                    onChange={e => setPasteRawText(e.target.value)}
                    placeholder="Wklej tutaj dane skopiowane z arkusza Excel (np. M	Z	FULL	OFF	M...)"
                    className="w-full p-3 rounded-xl border border-stone-300 text-xs font-mono focus:outline-hidden focus:border-emerald-600 bg-stone-50"
                  />
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-emerald-700" />
                    <span>Jak to działa?</span>
                  </div>
                  <p className="text-[11px] text-emerald-900 leading-relaxed">
                    System automatycznie rozpozna komórki rozdzielone tabulatorami (kolumny w Excelu) oraz znakami nowej linii (wiersze).
                    Oznaczenia takie jak <strong>M / Rano</strong>, <strong>Z / Zamknięcie</strong>, <strong>FULL / Cały</strong> oraz <strong>OFF / Wolne</strong> zostaną natychmiast zmapowane na odpowiednie dyspozycje.
                  </p>
                </div>
              </div>

              <div className="px-6 py-3.5 bg-stone-100 border-t border-stone-200 flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setShowPasteModal(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  onClick={applyPastedData}
                  disabled={!pasteRawText.trim()}
                  className="px-5 py-2 rounded-xl bg-[#006241] hover:bg-[#1E3932] text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>Zastosuj na matrycy</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
