import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ManagerScheduleMonthData,
  ShiftDefinition,
  ManagerEmployee,
  LaborLawViolation,
  ManagerScheduleShift
} from '../../../types';
import { ShiftPickerPopover } from './ShiftPickerPopover';
import { LaborLawViolationDialog } from './LaborLawViolationDialog';
import { ManagerScheduleEngine } from '../services/managerScheduleEngine';
import { AlertTriangle, CheckCircle2, MessageSquare, Edit3, Calendar } from 'lucide-react';

interface ManagerScheduleGridProps {
  data: ManagerScheduleMonthData;
  onUpdateShift: (
    empId: number,
    day: number,
    code: string,
    customHours?: number,
    customStartTime?: string,
    customEndTime?: string
  ) => Promise<void>;
  onUpdateDisposition?: (empId: number, day: number, disposition: string) => Promise<void>;
  onUpdateEvent: (day: number, text: string) => Promise<void>;
  onOpenComplianceModal?: () => void;
  onOpenConflictModal?: () => void;
  boundaryShifts?: {
    prevMonthShifts?: ManagerScheduleShift[];
    nextMonthShifts?: ManagerScheduleShift[];
  };
  isReadOnly?: boolean;
}

export const ManagerScheduleGrid: React.FC<ManagerScheduleGridProps> = ({
  data,
  onUpdateShift,
  onUpdateDisposition,
  onUpdateEvent,
  onOpenComplianceModal,
  onOpenConflictModal,
  boundaryShifts,
  isReadOnly: customIsReadOnly
}) => {
  const isReadOnly = Boolean(customIsReadOnly ?? data.isMonthClosed);
  const [activePicker, setActivePicker] = useState<{
    empId: number;
    empName: string;
    day: number;
    currentCode: string;
    currentHours?: number;
    currentStartTime?: string;
    currentEndTime?: string;
    currentDisposition?: string;
  } | null>(null);

  const [violationPrompt, setViolationPrompt] = useState<{
    empId: number;
    empName: string;
    day: number;
    dayName?: string;
    attemptedCode: string;
    customHours?: number;
    customStartTime?: string;
    customEndTime?: string;
    violation: LaborLawViolation;
  } | null>(null);

  const [editingEventDay, setEditingEventDay] = useState<number | null>(null);
  const [eventInputText, setEventInputText] = useState('');

  // Stan aktywnej komórki wybranej klawiaturą lub kliknięciem myszy
  const [selectedCell, setSelectedCell] = useState<{ empId: number; day: number } | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Schowek dla kopiowania zmian (Ctrl+C / Ctrl+V)
  const [copiedShift, setCopiedShift] = useState<{
    shiftCode: string;
    customHours?: number;
    customStartTime?: string;
    customEndTime?: string;
    empName?: string;
  } | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);

  // Bezpośrednie przypisanie zmiany ze skrótu klawiszowego (A, P, N, O, H, L, Del) z pre-flight walidacją Kodeksu Pracy
  const handleKeyboardShiftAssign = useCallback(async (shiftCodeToAssign: string) => {
    if (isReadOnly || !selectedCell) return;
    const row = data.rows.find(r => r.employee.id === selectedCell.empId);
    if (!row) return;

    const daySummary = data.daySummaries.find(d => d.day === selectedCell.day);
    const isSunday = daySummary ? (daySummary.dayName === 'Nd' || new Date(data.year, data.month - 1, selectedCell.day).getDay() === 0) : false;

    let targetCode = shiftCodeToAssign;
    // W niedziele sprawdzamy czy użyć kodów dedykowanych niedzielnych (np. AMN, PMN)
    if (isSunday) {
      if (shiftCodeToAssign === 'AM' && data.shiftDefinitions.some(s => s.code === 'AMN')) {
        targetCode = 'AMN';
      } else if (shiftCodeToAssign === 'PM' && data.shiftDefinitions.some(s => s.code === 'PMN')) {
        targetCode = 'PMN';
      }
    }

    // Pre-flight walidacja Kodeksu Pracy
    const testResult = ManagerScheduleEngine.testShiftCompliance(
      data.year,
      data.month,
      selectedCell.empId,
      selectedCell.day,
      targetCode,
      data.rows,
      data.shiftDefinitions,
      boundaryShifts
    );

    if (!testResult.isValid && testResult.primaryViolation) {
      setViolationPrompt({
        empId: selectedCell.empId,
        empName: row.employee.name,
        day: selectedCell.day,
        dayName: daySummary?.dayName,
        attemptedCode: targetCode,
        violation: testResult.primaryViolation
      });
      return;
    }

    await onUpdateShift(selectedCell.empId, selectedCell.day, targetCode);
  }, [selectedCell, isReadOnly, data, boundaryShifts, onUpdateShift]);

  // Wklejenie skopiowanej zmiany (Ctrl+V) z pre-flight walidacją Kodeksu Pracy
  const handlePasteShift = useCallback(async (sourceShift: {
    shiftCode: string;
    customHours?: number;
    customStartTime?: string;
    customEndTime?: string;
  }) => {
    if (isReadOnly || !selectedCell) return;
    const row = data.rows.find(r => r.employee.id === selectedCell.empId);
    if (!row) return;

    const daySummary = data.daySummaries.find(d => d.day === selectedCell.day);
    const isSunday = daySummary ? (daySummary.dayName === 'Nd' || new Date(data.year, data.month - 1, selectedCell.day).getDay() === 0) : false;

    let targetCode = sourceShift.shiftCode;
    // W niedziele dostosowujemy kody powszednie AM/PM do AMN/PMN
    if (isSunday) {
      if (targetCode === 'AM' && data.shiftDefinitions.some(s => s.code === 'AMN')) targetCode = 'AMN';
      else if (targetCode === 'PM' && data.shiftDefinitions.some(s => s.code === 'PMN')) targetCode = 'PMN';
    } else {
      // W dni powszednie dostosowujemy kody niedzielne AMN/PMN do AM/PM
      if (targetCode === 'AMN') targetCode = 'AM';
      else if (targetCode === 'PMN') targetCode = 'PM';
    }

    // Pre-flight walidacja Kodeksu Pracy
    const testResult = ManagerScheduleEngine.testShiftCompliance(
      data.year,
      data.month,
      selectedCell.empId,
      selectedCell.day,
      targetCode,
      data.rows,
      data.shiftDefinitions,
      boundaryShifts,
      sourceShift.customHours,
      sourceShift.customStartTime,
      sourceShift.customEndTime
    );

    if (!testResult.isValid && testResult.primaryViolation) {
      setViolationPrompt({
        empId: selectedCell.empId,
        empName: row.employee.name,
        day: selectedCell.day,
        dayName: daySummary?.dayName,
        attemptedCode: targetCode,
        customHours: sourceShift.customHours,
        customStartTime: sourceShift.customStartTime,
        customEndTime: sourceShift.customEndTime,
        violation: testResult.primaryViolation
      });
      return;
    }

    await onUpdateShift(
      selectedCell.empId,
      selectedCell.day,
      targetCode,
      sourceShift.customHours,
      sourceShift.customStartTime,
      sourceShift.customEndTime
    );
  }, [selectedCell, isReadOnly, data, boundaryShifts, onUpdateShift]);

  // Globalna obsługa klawiatury dla matrycy grafiku
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignoruj, gdy użytkownik pisze w polu tekstowym lub otwarty jest dialog naruszenia KP
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        editingEventDay !== null ||
        violationPrompt !== null
      ) {
        return;
      }

      // Jeśli otwarty jest popover, pozwól mu obsłużyć Esc
      if (activePicker !== null) {
        if (e.key === 'Escape') {
          setActivePicker(null);
        }
        return;
      }

      // Jeśli żadna komórka nie jest zaznaczona, dowolna strzałka lub Tab zaznacza komórkę (1. pracownik, 1. dzień)
      if (!selectedCell) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
          e.preventDefault();
          if (data.rows.length > 0 && data.daySummaries.length > 0) {
            setSelectedCell({ empId: data.rows[0].employee.id, day: 1 });
          }
        }
        return;
      }

      const currentEmpIndex = data.rows.findIndex(r => r.employee.id === selectedCell.empId);
      if (currentEmpIndex === -1) return;

      const totalEmployees = data.rows.length;
      const daysCount = data.daySummaries.length;

      // Obsługa Kopiowania (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        const row = data.rows[currentEmpIndex];
        const shift = row?.shifts[selectedCell.day];
        const code = shift ? shift.shift_code : 'OFF';
        const toCopy = {
          shiftCode: code,
          customHours: shift?.hours,
          customStartTime: shift?.custom_start_time,
          customEndTime: shift?.custom_end_time,
          empName: row?.employee.name
        };
        setCopiedShift(toCopy);
        setCopiedFeedback(`Skopiowano: ${code}${shift?.hours ? ` (${shift.hours}h)` : ''}`);
        try {
          navigator.clipboard?.writeText(code);
        } catch (_) {}
        setTimeout(() => setCopiedFeedback(null), 2500);
        return;
      }

      // Obsługa Wklejania (Ctrl+V / Cmd+V)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        if (!isReadOnly) {
          e.preventDefault();
          if (copiedShift) {
            handlePasteShift(copiedShift);
          } else {
            // Próba odczytania ze schowka systemowego
            navigator.clipboard?.readText?.().then(text => {
              const cleanText = text.trim().toUpperCase();
              if (
                data.shiftDefinitions.some(s => s.code.toUpperCase() === cleanText) ||
                ['AM', 'PM', 'OFF', 'H', 'L4', 'NC', 'MIB', 'MID', 'AMN', 'PMN', 'SAM', 'SPM', 'SUP'].includes(cleanText)
              ) {
                handleKeyboardShiftAssign(cleanText);
              }
            }).catch(() => {});
          }
        }
        return;
      }

      // Nawigacja strzałkami
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentEmpIndex > 0) {
          setSelectedCell({ empId: data.rows[currentEmpIndex - 1].employee.id, day: selectedCell.day });
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentEmpIndex < totalEmployees - 1) {
          setSelectedCell({ empId: data.rows[currentEmpIndex + 1].employee.id, day: selectedCell.day });
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (selectedCell.day > 1) {
          setSelectedCell({ empId: selectedCell.empId, day: selectedCell.day - 1 });
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (selectedCell.day < daysCount) {
          setSelectedCell({ empId: selectedCell.empId, day: selectedCell.day + 1 });
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        setSelectedCell({ empId: selectedCell.empId, day: 1 });
      } else if (e.key === 'End') {
        e.preventDefault();
        setSelectedCell({ empId: selectedCell.empId, day: daysCount });
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          if (selectedCell.day > 1) {
            setSelectedCell({ empId: selectedCell.empId, day: selectedCell.day - 1 });
          } else if (currentEmpIndex > 0) {
            setSelectedCell({ empId: data.rows[currentEmpIndex - 1].employee.id, day: daysCount });
          }
        } else {
          if (selectedCell.day < daysCount) {
            setSelectedCell({ empId: selectedCell.empId, day: selectedCell.day + 1 });
          } else if (currentEmpIndex < totalEmployees - 1) {
            setSelectedCell({ empId: data.rows[currentEmpIndex + 1].employee.id, day: 1 });
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedCell(null);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!isReadOnly) {
          const row = data.rows[currentEmpIndex];
          const shift = row.shifts[selectedCell.day];
          setActivePicker({
            empId: selectedCell.empId,
            empName: row.employee.name,
            day: selectedCell.day,
            currentCode: shift ? shift.shift_code : 'OFF',
            currentHours: shift?.hours,
            currentStartTime: shift?.custom_start_time,
            currentEndTime: shift?.custom_end_time,
            currentDisposition: shift?.disposition || 'FULL'
          });
        }
      } else if (!isReadOnly && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Skróty klawiszowe szybkiej edycji
        const keyUpper = e.key.toUpperCase();
        if (keyUpper === 'A') {
          e.preventDefault();
          handleKeyboardShiftAssign('AM');
        } else if (keyUpper === 'P') {
          e.preventDefault();
          handleKeyboardShiftAssign('PM');
        } else if (keyUpper === 'N') {
          e.preventDefault();
          handleKeyboardShiftAssign('NC');
        } else if (keyUpper === 'O' || e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          handleKeyboardShiftAssign('OFF');
        } else if (keyUpper === 'H') {
          e.preventDefault();
          handleKeyboardShiftAssign('H');
        } else if (keyUpper === 'L') {
          e.preventDefault();
          handleKeyboardShiftAssign('L4');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCell, data, isReadOnly, editingEventDay, violationPrompt, activePicker, copiedShift, handleKeyboardShiftAssign, handlePasteShift]);

  // Inteligentne przewijanie do aktywnej komórki (z pełnym uwzględnieniem 408px lewych kolumn sticky)
  useEffect(() => {
    if (!selectedCell) return;
    const container = tableContainerRef.current;
    if (!container) return;

    const el = document.getElementById(`cell-${selectedCell.empId}-${selectedCell.day}`);
    if (!el) return;

    const containerRect = container.getBoundingClientRect();
    const cellRect = el.getBoundingClientRect();

    // Wyznacz dynamiczną szerokość 3 lewych kolumn sticky (Etat + Manager + Pozycja)
    const col3Header = container.querySelector('th:nth-child(3)') as HTMLElement | null;
    const stickyLeftWidth = col3Header ? (col3Header.getBoundingClientRect().right - containerRect.left) : 408;

    // Wyznacz wysokość nagłówka thead
    const thead = container.querySelector('thead');
    const stickyTopHeight = thead ? (thead.getBoundingClientRect().bottom - containerRect.top) : 80;

    const visibleLeft = containerRect.left + stickyLeftWidth;
    const visibleRight = containerRect.right;
    const visibleTop = containerRect.top + stickyTopHeight;
    const visibleBottom = containerRect.bottom;

    let deltaX = 0;
    if (cellRect.left < visibleLeft) {
      // Komórka jest schowana za kolumnami sticky z lewej strony -> przewiń w lewo, by odsłonić
      deltaX = cellRect.left - visibleLeft - 10;
    } else if (cellRect.right > visibleRight) {
      // Komórka wystaje za prawą krawędź kontenera -> przewiń w prawo
      deltaX = cellRect.right - visibleRight + 20;
    }

    let deltaY = 0;
    if (cellRect.top < visibleTop) {
      // Komórka schowana pod nagłówkiem thead
      deltaY = cellRect.top - visibleTop - 10;
    } else if (cellRect.bottom > visibleBottom) {
      // Komórka wystaje poza dolną krawędź kontenera
      deltaY = cellRect.bottom - visibleBottom + 20;
    }

    // Przewijaj TYLKO wtedy, gdy komórka rzeczywiście wychodzi poza widoczny obszar
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      container.scrollBy({
        left: deltaX,
        top: deltaY,
        behavior: 'smooth'
      });
    }
  }, [selectedCell]);

  // Słownik badge'y dla stylizacji kodów zmian
  const getShiftBadgeStyle = (code: string): string => {
    switch (code) {
      case 'AM':
      case 'SAM':
      case 'AMB':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
      case 'AMN':
        return 'bg-teal-100 text-teal-800 border-teal-300 font-semibold';
      case 'PM':
      case 'SPM':
      case 'PMB':
        return 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
      case 'PMN':
        return 'bg-orange-100 text-orange-900 border-orange-300 font-semibold';
      case 'SUP':
        return 'bg-lime-100 text-lime-800 border-lime-300 font-semibold';
      case 'MIB':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300 font-semibold';
      case 'MI4':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'NC':
      case 'BT':
      case 'PRE':
      case 'TAM':
      case 'TPM':
      case 'RET':
      case 'T':
      case 'MEE':
        return 'bg-purple-100 text-purple-900 border-purple-300 font-bold shadow-xs';
      case 'OFF':
        return 'bg-stone-100 text-stone-500 border-stone-200 font-medium';
      case 'H':
        return 'bg-sky-200 text-sky-900 border-sky-400 font-bold ring-1 ring-sky-300';
      case 'L4':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      default:
        return 'bg-stone-50 text-stone-600 border-stone-200';
    }
  };

  const handleStartEditEvent = (day: number, currentText: string = '') => {
    setEditingEventDay(day);
    setEventInputText(currentText);
  };

  const handleSaveEvent = async (day: number) => {
    await onUpdateEvent(day, eventInputText);
    setEditingEventDay(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-[#E2E8E5] overflow-hidden">
      <div ref={tableContainerRef} className="overflow-x-auto max-h-[750px] relative scrollbar-thin">
        <table className="w-full text-xs border-collapse">
          {/* NAGŁÓWEK TABELI */}
          <thead className="sticky top-0 z-40 bg-[#F7F9F8] shadow-xs">
            {/* Wiersz 1: Dni miesiąca */}
            <tr className="border-b border-[#E2E8E5]">
              {/* Kolumny stałe po lewej: Pinned with exact widths */}
              <th className="sticky left-0 z-50 bg-[#F7F9F8] px-2.5 py-2.5 text-left font-semibold text-stone-600 w-[56px] min-w-[56px] max-w-[56px] border-r border-[#E2E8E5]">
                Etat
              </th>
              <th className="sticky left-[56px] z-50 bg-[#F7F9F8] px-3 py-2.5 text-left font-semibold text-stone-800 w-[176px] min-w-[176px] max-w-[176px] border-r border-[#E2E8E5]">
                MANAGER
              </th>
              <th className="sticky left-[232px] z-50 bg-[#F7F9F8] px-3 py-2.5 text-left font-semibold text-stone-600 w-[176px] min-w-[176px] max-w-[176px] border-r-2 border-stone-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]">
                Pozycja
              </th>

              {/* Dni miesiąca (1..30/31) */}
              {data.daySummaries.map(d => {
                const headerBg = d.isHoliday
                  ? 'bg-rose-100 text-rose-950 border-rose-300'
                  : d.isTradingSunday
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-400 ring-1 ring-emerald-500/40 shadow-xs'
                  : d.isSunday
                  ? 'bg-amber-100/90 text-amber-950 border-amber-300'
                  : d.isWeekend
                  ? 'bg-amber-50 text-amber-950 font-black'
                  : 'bg-[#F7F9F8] text-stone-800';

                return (
                  <th
                    key={`day-${d.day}`}
                    className={`px-1 py-1.5 text-center font-bold min-w-[50px] max-w-[58px] border-r border-[#E2E8E5] transition-colors ${headerBg}`}
                    title={
                      d.isHoliday
                        ? `🇵🇱 ŚWIĘTO USTAWOWO WOLNE: ${d.holidayName}`
                        : d.isTradingSunday
                        ? `🛒 NIEDZIELA HANDLOWA — centrum handlowe i kawiarnia otwarte`
                        : d.isSunday
                        ? `Niedziela niehandlowa (ustawowo wolna)`
                        : d.isWeekend
                        ? `Sobota (dzień wolny)`
                        : `${d.day} ${data.monthName} (dzień roboczy)`
                    }
                  >
                    <div className="text-[13px] leading-tight font-black">{d.day}</div>
                    <div className={`text-[10px] uppercase font-bold flex items-center justify-center gap-0.5 ${
                      d.isTradingSunday ? 'text-emerald-900 font-black' : d.isHoliday ? 'text-rose-900 font-black' : d.isWeekend ? 'text-amber-800' : 'text-stone-400'
                    }`}>
                      {d.isTradingSunday && <span>🛒</span>}
                      {d.isHoliday && <span>🇵🇱</span>}
                      <span>{d.dayName}</span>
                    </div>
                  </th>
                );
              })}

              {/* Kolumny podsumowania po prawej (po Dniu 30/31, bez nakładania się na dni) */}
              <th className="bg-[#EEF3F0] px-3 py-2.5 text-center font-bold text-stone-700 min-w-[70px] border-l-2 border-[#D0DCD6] border-r border-[#E2E8E5]" title="Ilość dni wolnych (OFF)">
                Dni OFF
              </th>
              <th className="bg-[#EEF3F0] px-3 py-2.5 text-center font-bold text-stone-800 min-w-[95px] border-r border-[#E2E8E5]" title="Godziny wypracowane (w tym urlop)">
                Wypracowane
              </th>
              <th className="bg-[#EEF3F0] px-3 py-2.5 text-center font-bold text-stone-700 min-w-[75px] border-r border-[#E2E8E5]" title="Norma godzin Kodeksu Pracy dla etatu">
                Norma KP
              </th>
              <th className="bg-[#EEF3F0] px-3 py-2.5 text-center font-bold text-stone-900 min-w-[90px]" title="Bilans godzin w stosunku do normy etatu">
                Bilans (+/-)
              </th>
            </tr>

            {/* Wiersz 2: Kalendarz Dni Wolnych od Pracy & Niedziel Handlowych na Matrycy */}
            <tr className="border-b-2 border-stone-300 bg-[#EEF3F0] text-[9px] select-none">
              <th className="sticky left-0 z-50 bg-[#EEF3F0] px-2 py-1 text-left font-black text-stone-500 w-[56px] min-w-[56px] max-w-[56px] border-r border-[#D0DCD6] uppercase tracking-tighter">
                STATUS
              </th>
              <th className="sticky left-[56px] z-50 bg-[#EEF3F0] px-3 py-1 text-left font-bold text-[#1E3932] w-[352px] min-w-[352px] max-w-[352px] border-r-2 border-stone-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]" colSpan={2}>
                <div className="flex items-center gap-1.5 font-bold text-[#006241]">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Kalendarz dni i handlu</span>
                </div>
              </th>

              {/* Dni miesiąca (1..30/31) — statusy na matrycy */}
              {data.daySummaries.map(d => {
                if (d.isHoliday) {
                  return (
                    <th
                      key={`status-day-${d.day}`}
                      className="px-0.5 py-1 text-center bg-rose-100 text-rose-950 font-black border-r border-rose-300 min-w-[50px] max-w-[58px]"
                      title={`Święto ustawowo wolne od pracy: ${d.holidayName}`}
                    >
                      <span className="inline-block px-1 py-0.5 rounded bg-rose-600 text-white text-[8px] font-black tracking-tight uppercase shadow-2xs" title={d.holidayName}>
                        ŚWIĘTO
                      </span>
                    </th>
                  );
                }

                if (d.isTradingSunday) {
                  return (
                    <th
                      key={`status-day-${d.day}`}
                      className="px-0.5 py-1 text-center bg-emerald-100 text-emerald-950 font-black border-r border-emerald-400 min-w-[50px] max-w-[58px]"
                      title="Niedziela Handlowa — handel dozwolony, centrum i kawiarnia otwarte"
                    >
                      <span className="inline-block px-1 py-0.5 rounded bg-emerald-700 text-white text-[8px] font-black tracking-tight uppercase shadow-2xs animate-pulse">
                        🛒 HANDL.
                      </span>
                    </th>
                  );
                }

                if (d.isSunday) {
                  return (
                    <th
                      key={`status-day-${d.day}`}
                      className="px-0.5 py-1 text-center bg-amber-100/70 text-amber-950 font-bold border-r border-amber-300 min-w-[50px] max-w-[58px]"
                      title="Niedziela niehandlowa — dzień ustawowo wolny od pracy"
                    >
                      <span className="inline-block px-1 py-0.5 rounded bg-amber-200 text-amber-950 text-[8px] font-bold tracking-tight">
                        WOLNA
                      </span>
                    </th>
                  );
                }

                if (d.isWeekend) {
                  return (
                    <th
                      key={`status-day-${d.day}`}
                      className="px-0.5 py-1 text-center bg-amber-50 text-amber-900 font-semibold border-r border-amber-200 min-w-[50px] max-w-[58px]"
                      title="Sobota — dzień wolny (przeciętnie 5-dniowy tydzień pracy)"
                    >
                      <span className="inline-block px-1 py-0.5 rounded bg-stone-200 text-stone-700 text-[8px] font-bold">
                        SOB
                      </span>
                    </th>
                  );
                }

                return (
                  <th
                    key={`status-day-${d.day}`}
                    className="px-0.5 py-1 text-center bg-[#F7F9F8] text-stone-400 font-normal border-r border-[#E2E8E5] min-w-[50px] max-w-[58px]"
                    title="Dzień roboczy"
                  >
                    <span className="text-[8px] text-stone-400">Praca</span>
                  </th>
                );
              })}

              <th className="bg-[#EEF3F0] border-l-2 border-[#D0DCD6]" colSpan={4} />
            </tr>
          </thead>

          {/* CIAŁO TABELI — WIERSZE MENEDŻERÓW */}
          <tbody className="divide-y divide-[#E2E8E5]">
            {data.rows.map((row, idx) => {
              const isEven = idx % 2 === 0;
              const isFullTime = row.employee.contract_type === 'FULL';
              const isOffValid = row.totalOffDays >= data.offDaysNorm;
              const hasOvertime = row.balanceHours > 0;
              const hasDeficit = row.balanceHours < 0;
              const hasViolations = row.violations.length > 0;

              const rowBg = isEven ? 'bg-white' : 'bg-[#FAFCFB]';

              return (
                <tr
                  key={row.employee.id}
                  className={`hover:bg-emerald-50/40 transition-colors ${rowBg}`}
                >
                  {/* Kolumna 1: Etat */}
                  <td className={`sticky left-0 z-30 px-2.5 py-2 text-xs font-semibold text-stone-600 border-r border-[#E2E8E5] w-[56px] min-w-[56px] max-w-[56px] ${rowBg}`}>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      isFullTime ? 'bg-stone-100 text-stone-700' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {row.employee.contract_type}
                    </span>
                  </td>

                  {/* Kolumna 2: Manager (ze statusem KP i szybkim podglądem bilansu) */}
                  <td className={`sticky left-[56px] z-30 px-3 py-2 border-r border-[#E2E8E5] w-[176px] min-w-[176px] max-w-[176px] ${rowBg}`}>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-bold text-stone-900 truncate" title={row.employee.name}>
                        {row.employee.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {hasViolations && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenComplianceModal?.();
                            }}
                            className="px-1.5 py-0.5 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-black flex items-center gap-0.5 border border-rose-300 transition-colors cursor-pointer"
                            title={`⚠️ ${row.violations.length} naruszeń Kodeksu Pracy (kliknij, aby otworzyć Tarczę KP):\n${row.violations.map(v => '• ' + v.title).join('\n')}`}
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                            {row.violations.length} KP
                          </button>
                        )}
                        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                          hasOvertime ? 'bg-blue-50 text-blue-700' : hasDeficit ? 'bg-rose-50 text-rose-700' : 'bg-stone-100 text-stone-600'
                        }`}>
                          {hasOvertime ? `+${row.balanceHours.toFixed(1)}h` : `${row.balanceHours.toFixed(1)}h`}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Kolumna 3: Pozycja */}
                  <td className={`sticky left-[232px] z-30 px-3 py-2 text-[11px] text-stone-600 border-r-2 border-stone-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] w-[176px] min-w-[176px] max-w-[176px] truncate ${rowBg}`} title={row.employee.role}>
                    {row.employee.role}
                  </td>

                  {/* Komórki dni (1..30/31) ze zmianami i dyspozycją */}
                  {data.daySummaries.map(d => {
                    const shift = row.shifts[d.day];
                    const shiftCode = shift ? shift.shift_code : 'OFF';
                    const rawDispo = shift?.disposition || '';
                    const disposition = rawDispo === 'FULL' ? '' : rawDispo;
                    const hasDispo = disposition === 'AM' || disposition === 'PM' || disposition === 'OFF' || disposition === 'M' || disposition === 'Z';
                    const badgeClass = getShiftBadgeStyle(shiftCode);
                    const dayViolations = row.violationsByDay[d.day] || [];
                    const hasDayViolation = dayViolations.length > 0;
                    const rcpConflict = data.rcpConflicts?.find(c => c.employeeId === row.employee.id && c.day === d.day);

                    // Kolorystyka tła komórki w zależności od kalendarza dni wolnych i handlowych
                    const cellBg = d.isHoliday
                      ? 'bg-rose-50/40'
                      : d.isTradingSunday
                      ? 'bg-emerald-50/30'
                      : d.isSunday
                      ? 'bg-amber-50/25'
                      : d.isWeekend
                      ? 'bg-amber-50/15'
                      : '';

                    let cellTitle = `${row.employee.name} • Dzień ${d.day}: ${shiftCode} (${shift?.hours || 0}h)`;
                    if (hasDispo) {
                      const dispoLabel = disposition === 'OFF' ? 'Prośba o wolne (OFF)' : disposition === 'AM' || disposition === 'M' ? 'Rano (AM)' : disposition === 'PM' || disposition === 'Z' ? 'Wieczór (PM)' : disposition;
                      cellTitle += ` • Dyspozycja: ${dispoLabel}`;
                    }
                    if (d.isHoliday) {
                      cellTitle += ` • 🇵🇱 Święto: ${d.holidayName}`;
                    } else if (d.isTradingSunday) {
                      cellTitle += ` • 🛒 Niedziela Handlowa`;
                    } else if (d.isSunday) {
                      cellTitle += ` • Niedziela niehandlowa (wolna od pracy)`;
                    }
                    if (isReadOnly) {
                      cellTitle += ` • 🔒 Miesiąc zamknięty (tylko do odczytu)`;
                    } else {
                      cellTitle += ` — Kliknij, aby zmienić zmianę lub dyspozycję`;
                    }
                    if (hasDayViolation) {
                      cellTitle += `\n\n🚨 ALERTY KODEKSU PRACY:\n` + dayViolations.map(v => `• ${v.title}: ${v.message}`).join('\n');
                    }
                    if (rcpConflict) {
                      cellTitle += `\n\n⚠️ KOLIZJA Z LOGOWANIEM RCP (MAPAL):\nPracownik ma zarejestrowane ${rcpConflict.rcpHours}h pracy w ${rcpConflict.unitName || 'Starbucks'} w dniu zaplanowanego ${rcpConflict.shiftName} (${rcpConflict.shiftCode})!\nKliknij ikonę ⚡, aby otworzyć szczegóły.`;
                    }
                    const empRcp = data.rcpLogs?.[row.employee.id]?.[d.day];
                    if (empRcp && empRcp.hours > 0) {
                      if (empRcp.unitCode && empRcp.unitCode !== '384' && empRcp.unitCode !== '18120') {
                        cellTitle += `\n\n📍 Zalogowano wsparcie MAPAL: ${empRcp.hours}h w ${empRcp.unitName || 'innym lokalu'} (kod: ${empRcp.unitCode})`;
                      } else {
                        cellTitle += `\n\n📍 Zalogowano w MAPAL: ${empRcp.hours}h (108120 Janki)`;
                      }
                    }

                    const isSelected = selectedCell?.empId === row.employee.id && selectedCell?.day === d.day;
                    const shiftDef = data.shiftDefinitions.find(s => s.code === shiftCode);
                    const shiftStartTime = shift?.custom_start_time || shiftDef?.start_time;
                    const shiftEndTime = shift?.custom_end_time || shiftDef?.end_time;
                    const isCustomTime = Boolean(
                      (shift?.custom_start_time && shiftDef?.start_time && shift.custom_start_time !== shiftDef.start_time) ||
                      (shift?.custom_end_time && shiftDef?.end_time && shift.custom_end_time !== shiftDef.end_time)
                    );
                    const isCustomDuration = shiftCode !== 'OFF' && shift?.hours !== undefined && shiftDef?.hours !== undefined && Math.abs(shift.hours - shiftDef.hours) > 0.05;

                    if (shiftStartTime && shiftEndTime && shiftCode !== 'OFF') {
                      cellTitle += ` • Godziny: ${shiftStartTime} – ${shiftEndTime}`;
                    }

                    return (
                      <td
                        id={`cell-${row.employee.id}-${d.day}`}
                        key={`cell-${row.employee.id}-${d.day}`}
                        onClick={() => {
                          setSelectedCell({ empId: row.employee.id, day: d.day });
                          if (isReadOnly) return;
                          if (isSelected) {
                            setActivePicker({
                              empId: row.employee.id,
                              empName: row.employee.name,
                              day: d.day,
                              currentCode: shiftCode,
                              currentHours: shift?.hours,
                              currentStartTime: shift?.custom_start_time,
                              currentEndTime: shift?.custom_end_time,
                              currentDisposition: disposition
                            });
                          }
                        }}
                        onDoubleClick={() => {
                          if (isReadOnly) return;
                          setActivePicker({
                            empId: row.employee.id,
                            empName: row.employee.name,
                            day: d.day,
                            currentCode: shiftCode,
                            currentHours: shift?.hours,
                            currentStartTime: shift?.custom_start_time,
                            currentEndTime: shift?.custom_end_time,
                            currentDisposition: disposition
                          });
                        }}
                        className={`p-1 text-center border-r border-[#E2E8E5] transition-all select-none relative min-w-[50px] max-w-[58px] ${
                          isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-emerald-100/60'
                        } ${cellBg} ${
                          isSelected ? 'ring-2 ring-[#006241] ring-offset-2 ring-offset-white z-10 shadow-md bg-emerald-100/80 font-bold' : ''
                        }`}
                        title={cellTitle}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {/* DYSPOZYCYJNOŚĆ INNA NIŻ DOMYŚLNA FULL: WYŚWIETLA SIĘ PO LEWEJ STRONIE KWADRATU */}
                          {hasDispo && (
                            <span
                              className={`px-1 py-0.5 rounded text-[10px] font-black border leading-none shrink-0 tracking-tight uppercase shadow-2xs transition-transform hover:scale-110 ${
                                disposition === 'OFF'
                                  ? 'bg-rose-500 text-white border-rose-600 ring-1 ring-rose-300'
                                  : disposition === 'AM' || disposition === 'M'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : disposition === 'PM' || disposition === 'Z'
                                  ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              }`}
                              title={`Zgłoszona dyspozycyjność pracownika: ${
                                disposition === 'OFF'
                                  ? 'Prośba o wolne (OFF)'
                                  : disposition === 'AM' || disposition === 'M'
                                  ? 'Rano (AM)'
                                  : disposition === 'PM' || disposition === 'Z'
                                  ? 'Wieczór (PM)'
                                  : disposition
                              }`}
                            >
                              {disposition === 'M' ? 'AM' : disposition === 'Z' ? 'PM' : disposition}
                            </span>
                          )}

                          {/* GŁÓWNY KWADRAT ZMIANY */}
                          <div className="relative inline-block shrink-0">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCell({ empId: row.employee.id, day: d.day });
                                if (isReadOnly) return;
                                setActivePicker({
                                  empId: row.employee.id,
                                  empName: row.employee.name,
                                  day: d.day,
                                  currentCode: shiftCode,
                                  currentHours: shift?.hours,
                                  currentStartTime: shift?.custom_start_time,
                                  currentEndTime: shift?.custom_end_time,
                                  currentDisposition: disposition
                                });
                              }}
                              className={`inline-flex items-center justify-center w-8 h-7 text-xs rounded-lg border transition-transform hover:scale-105 active:scale-95 cursor-pointer ${badgeClass} ${
                                hasDayViolation ? 'ring-2 ring-rose-500 ring-offset-1 border-rose-400' : ''
                              } ${rcpConflict ? 'ring-2 ring-amber-500 ring-offset-1 border-amber-500 shadow-xs' : ''} ${
                                isSelected ? 'ring-1 ring-[#006241] ring-offset-1 font-black shadow-xs' : ''
                              }`}
                            >
                              {isCustomTime || isCustomDuration ? (
                                <div className="flex flex-col items-center justify-center leading-none">
                                  <span className="text-[10px] font-black leading-tight">{shiftCode}</span>
                                  <span className="text-[7.5px] font-extrabold opacity-90 leading-none mt-0.5 tracking-tighter" title={isCustomTime ? `${shiftStartTime} – ${shiftEndTime}` : `${shift?.hours}h`}>
                                    {isCustomTime && shift?.custom_start_time
                                      ? `${shift.custom_start_time.replace(/^0/, '')}-${(shift.custom_end_time || '').replace(/^0/, '')}`
                                      : `${shift?.hours}h`}
                                  </span>
                                </div>
                              ) : (
                                shiftCode
                              )}
                            </span>
                            {hasDayViolation && (
                              <span 
                                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-600 border border-white flex items-center justify-center text-[8px] text-white font-black animate-pulse shadow-xs"
                                title={dayViolations.map(v => v.title).join('\n')}
                              >
                                !
                              </span>
                            )}
                            {rcpConflict && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onOpenConflictModal) onOpenConflictModal();
                                }}
                                className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-500 hover:bg-amber-600 border border-white flex items-center justify-center text-[8px] text-white font-black cursor-pointer animate-bounce shadow-xs transition-transform hover:scale-125 z-10"
                                title={`⚠️ KOLIZJA RCP: Zarejestrowano ${rcpConflict.rcpHours}h w ${rcpConflict.unitName || 'Starbucks'} w trakcie ${rcpConflict.shiftCode}!\nKliknij, aby otworzyć szczegóły kolizji.`}
                              >
                                ⚡
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}

                  {/* Podsumowanie: Dni OFF */}
                  <td className="px-3 py-2 text-center border-l-2 border-[#D0DCD6] border-r border-[#E2E8E5] bg-[#F7F9F8]">
                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      isOffValid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 ring-1 ring-amber-400'
                    }`}>
                      {row.totalOffDays}
                    </span>
                  </td>

                  {/* Podsumowanie: Wypracowane Godziny */}
                  <td className="px-3 py-2 text-center font-bold text-stone-900 border-r border-[#E2E8E5] bg-[#F7F9F8]">
                    {row.totalWorkedHours.toFixed(1)} h
                  </td>

                  {/* Podsumowanie: Norma */}
                  <td className="px-3 py-2 text-center text-stone-600 border-r border-[#E2E8E5] bg-[#F7F9F8]">
                    {row.nominalHours.toFixed(1)} h
                  </td>

                  {/* Podsumowanie: Bilans */}
                  <td className="px-3 py-2 text-center bg-[#F7F9F8]">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                      hasOvertime
                        ? 'bg-blue-100 text-blue-800'
                        : hasDeficit
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-stone-100 text-stone-700'
                    }`}>
                      {hasOvertime ? `+${row.balanceHours.toFixed(1)} h` : `${row.balanceHours.toFixed(1)} h`}
                    </span>
                  </td>
                </tr>
              );
            })}

            {/* WIERSZ: WAŻNE WYDARZENIA */}
            <tr className="bg-amber-50 border-t-2 border-amber-200">
              <td className="sticky left-0 z-30 px-3 py-2 font-bold text-amber-950 bg-amber-100 border-r-2 border-amber-300 w-[408px] min-w-[408px] max-w-[408px]" colSpan={3}>
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
                  <span>Ważne wydarzenia / Notatki</span>
                </div>
              </td>

              {data.daySummaries.map(d => {
                const eventText = d.eventText;
                const isEditing = editingEventDay === d.day;

                return (
                  <td
                    key={`event-${d.day}`}
                    className="p-1 text-center border-r border-[#E2E8E5] align-top min-w-[50px] max-w-[58px] bg-amber-50/50"
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-1">
                        <textarea
                          autoFocus
                          rows={3}
                          value={eventInputText}
                          onChange={e => setEventInputText(e.target.value)}
                          className="w-44 p-1.5 text-xs rounded-lg border border-amber-400 bg-white shadow-lg z-50 fixed -translate-x-1/2"
                          placeholder="Wpisz wydarzenie..."
                        />
                        <div className="flex gap-1 justify-center z-50 fixed mt-20 -translate-x-1/2">
                          <button
                            onClick={() => handleSaveEvent(d.day)}
                            className="px-2 py-0.5 bg-[#006241] text-white rounded-md text-[10px] font-semibold"
                          >
                            Zapisz
                          </button>
                          <button
                            onClick={() => setEditingEventDay(null)}
                            className="px-2 py-0.5 bg-stone-300 text-stone-800 rounded-md text-[10px]"
                          >
                            Anuluj
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          if (isReadOnly) return;
                          handleStartEditEvent(d.day, eventText);
                        }}
                        className={`group relative min-h-[32px] p-1 rounded-md text-[10px] transition-colors ${
                          isReadOnly ? 'cursor-default' : 'cursor-pointer'
                        } ${
                          eventText
                            ? 'bg-amber-100/90 text-amber-950 font-medium hover:bg-amber-200'
                            : isReadOnly
                            ? 'text-stone-300'
                            : 'hover:bg-amber-100/40 text-stone-400'
                        }`}
                        title={
                          eventText
                            ? `${eventText}${isReadOnly ? ' (Miesiąc zamknięty — tylko do odczytu)' : ' (Kliknij, aby edytować)'}`
                            : isReadOnly
                            ? `Brak notatki (Miesiąc zamknięty)`
                            : `Dodaj notatkę na dzień ${d.day}`
                        }
                      >
                        {eventText ? (
                          <div className="line-clamp-2 leading-tight">
                            {eventText}
                          </div>
                        ) : !isReadOnly ? (
                          <Edit3 className="w-3 h-3 mx-auto opacity-0 group-hover:opacity-100 text-amber-600 transition-opacity" />
                        ) : null}
                      </div>
                    )}
                  </td>
                );
              })}

              <td className="bg-amber-100 border-l-2 border-amber-300 text-center text-xs text-amber-950 font-bold px-3 py-2" colSpan={4}>
                Podsumowanie Miesięczne
              </td>
            </tr>

            {/* WIERSZ: OBSADA DZIENNA (PODSUMOWANIE POKRYCIA) */}
            <tr className="bg-[#1E3932] text-white font-semibold">
              <td className="sticky left-0 z-30 px-3 py-2 bg-[#1E3932] border-r-2 border-emerald-700 text-emerald-300 font-bold w-[408px] min-w-[408px] max-w-[408px]" colSpan={3}>
                Obsada Menedżerska (Dziennie)
              </td>

              {data.daySummaries.map(d => {
                const isAmOk = d.hasOpeningCoverage;
                const isPmOk = d.hasClosingCoverage;
                const extSupportCount = d.externalSupportManagers?.length || 0;

                return (
                  <td
                    key={`cov-${d.day}`}
                    className="p-1 text-center border-r border-emerald-900/60 bg-[#1E3932] min-w-[50px] max-w-[58px]"
                    title={`Dzień ${d.day}: ${d.totalManagersWorking} menedżerów pracujących w Janki.${extSupportCount > 0 ? ` Wsparcie na innych kawiarniach (${extSupportCount}): ${d.externalSupportManagers?.join(', ')}.` : ''} Otwarcia: ${d.openingManagers.join(', ') || 'BRAK'}. Zamknięcia: ${d.closingManagers.join(', ') || 'BRAK'}`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xs font-bold text-white">
                        {d.totalManagersWorking}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <span className={`w-2 h-2 rounded-full ${isAmOk ? 'bg-emerald-400' : 'bg-rose-500 ring-1 ring-white'}`} title={isAmOk ? 'Otwarcie obsadzone' : 'BRAK OTWARCIA!'} />
                        <span className={`w-2 h-2 rounded-full ${isPmOk ? 'bg-amber-400' : 'bg-rose-500 ring-1 ring-white'}`} title={isPmOk ? 'Zamknięcie obsadzone' : 'BRAK ZAMKNIĘCIA!'} />
                      </div>
                      {extSupportCount > 0 && (
                        <span 
                          className="text-[8px] leading-tight px-1 py-0.2 rounded bg-lime-800 text-lime-200 font-bold border border-lime-600 mt-0.5" 
                          title={`Wsparcie poza kawiarnią Janki:\n${d.externalSupportManagers?.join('\n')}`}
                        >
                          +{extSupportCount} SUP
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}

              {/* Stopka sumaryczna zespołu */}
              <td className="bg-[#1E3932] px-3 py-2 text-center text-emerald-300 border-l-2 border-emerald-700 border-r border-emerald-900">
                Min. {data.offDaysNorm} dni
              </td>
              <td className="bg-[#1E3932] px-3 py-2 text-center text-white font-black border-r border-emerald-900">
                {data.totalTeamHours.toFixed(1)} h
              </td>
              <td className="bg-[#1E3932] px-3 py-2 text-center text-emerald-200 border-r border-emerald-900">
                Średnia
              </td>
              <td className="bg-[#1E3932] px-3 py-2 text-center text-white font-bold">
                {data.averageCoveragePercent.toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PASEK POMOCNICZY NAWIGACJI KLAWIATURĄ */}
      <div className="bg-[#F7F9F8] border-t border-[#E2E8E5] px-4 py-2 flex items-center justify-between text-xs text-stone-600 select-none">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-[#1E3932] flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-stone-200 text-stone-800 text-[10px] font-black border border-stone-300">
              ⌨️ KLAWIATURA
            </span>
          </span>
          <span className="text-stone-300">•</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-300 shadow-2xs text-[10px] font-bold">↑ ↓ ← →</kbd> Poruszanie się
          </span>
          <span className="text-stone-300">•</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-300 shadow-2xs text-[10px] font-bold">Tab</kbd> Następny dzień
          </span>
          <span className="text-stone-300">•</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs text-[10px] font-bold">A</kbd> AM
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs text-[10px] font-bold">P</kbd> PM
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs text-[10px] font-bold">N</kbd> NC
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-300 shadow-2xs text-[10px] font-bold">O / Del</kbd> OFF
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300 shadow-2xs text-[10px] font-bold">H</kbd> Urlop
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs text-[10px] font-bold">L</kbd> L4
          </span>
          <span className="text-stone-300">•</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-300 shadow-2xs text-[10px] font-bold">Ctrl+C</kbd> Kopiuj
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-300 shadow-2xs text-[10px] font-bold">Ctrl+V</kbd> Wklej
          </span>
          <span className="text-stone-300">•</span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-300 shadow-2xs text-[10px] font-bold">Enter / Spacja</kbd> Wszystkie
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-stone-300 shadow-2xs text-[10px] font-bold">Esc</kbd> Odznacz
          </span>
        </div>

        <div className="flex items-center gap-2">
          {copiedFeedback && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-[#006241] bg-emerald-100/90 px-2.5 py-1 rounded-xl border border-emerald-300 animate-fade-in shadow-2xs">
              <span>📋</span>
              <span>{copiedFeedback}</span>
            </div>
          )}

          {selectedCell && (() => {
            const selRow = data.rows.find(r => r.employee.id === selectedCell.empId);
            const selDaySummary = data.daySummaries.find(d => d.day === selectedCell.day);
            const selShift = selRow?.shifts[selectedCell.day];
            const code = selShift ? selShift.shift_code : 'OFF';
            return (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#006241] bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 shrink-0">
                <span>Wybrana komórka:</span>
                <strong className="text-[#1E3932]">{selRow?.employee.name}</strong>
                <span>•</span>
                <span>Dzień {selectedCell.day} ({selDaySummary?.dayName})</span>
                <span>•</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-200/80 text-emerald-950 font-black">{code}</span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* MODAL / POPOVER WYBORU ZMIANY I DYSPOZYCYJNOŚCI */}
      {activePicker && (() => {
        const daySummary = data.daySummaries.find(d => d.day === activePicker.day);
        const isSunday = daySummary ? (daySummary.dayName === 'Nd' || new Date(data.year, data.month - 1, activePicker.day).getDay() === 0) : false;
        const employee = data.employees.find(e => e.id === activePicker.empId);
        return (
          <ShiftPickerPopover
            day={activePicker.day}
            dayName={daySummary?.dayName}
            isSunday={isSunday}
            isTradingSunday={daySummary?.isTradingSunday}
            isHoliday={daySummary?.isHoliday}
            holidayName={daySummary?.holidayName}
            isWeekend={daySummary?.isWeekend}
            employeeContractRatio={employee?.contract_hours_ratio || 1.0}
            managerName={activePicker.empName}
            currentShiftCode={activePicker.currentCode}
            currentHours={activePicker.currentHours}
            currentStartTime={activePicker.currentStartTime}
            currentEndTime={activePicker.currentEndTime}
            currentDisposition={activePicker.currentDisposition}
            shiftDefinitions={data.shiftDefinitions}
            onSelectDisposition={async (newDispo) => {
              if (onUpdateDisposition) {
                await onUpdateDisposition(activePicker.empId, activePicker.day, newDispo);
                setActivePicker(prev => prev ? { ...prev, currentDisposition: newDispo } : null);
              }
            }}
            onSelectShift={async (newCode, customHours, customStartTime, customEndTime) => {
              // Pre-flight walidacja Kodeksu Pracy przed zatwierdzeniem zmiany
              const testResult = ManagerScheduleEngine.testShiftCompliance(
                data.year,
                data.month,
                activePicker.empId,
                activePicker.day,
                newCode,
                data.rows,
                data.shiftDefinitions,
                boundaryShifts,
                customHours,
                customStartTime,
                customEndTime
              );

              if (!testResult.isValid && testResult.primaryViolation) {
                // Zamykamy popover i wyświetlamy dialog ostrzegawczy z powodem naruszenia KP
                setViolationPrompt({
                  empId: activePicker.empId,
                  empName: activePicker.empName,
                  day: activePicker.day,
                  dayName: daySummary?.dayName,
                  attemptedCode: newCode,
                  customHours,
                  customStartTime,
                  customEndTime,
                  violation: testResult.primaryViolation
                });
                setActivePicker(null);
                return;
              }

              // Zmiana zgodna z Kodeksem Pracy — zapisujemy natychmiast
              await onUpdateShift(activePicker.empId, activePicker.day, newCode, customHours, customStartTime, customEndTime);
              setActivePicker(null);
            }}
            onClose={() => setActivePicker(null)}
          />
        );
      })()}

      {/* DIALOG OSTRZEGAWCZY PRZY PRÓBIE ZŁAMANIA KODEKSU PRACY */}
      {violationPrompt && (
        <LaborLawViolationDialog
          isOpen={true}
          employeeName={violationPrompt.empName}
          day={violationPrompt.day}
          dayName={violationPrompt.dayName}
          attemptedShiftCode={violationPrompt.attemptedCode}
          attemptedShiftDef={data.shiftDefinitions.find(s => s.code === violationPrompt.attemptedCode)}
          customHours={violationPrompt.customHours}
          customStartTime={violationPrompt.customStartTime}
          customEndTime={violationPrompt.customEndTime}
          violation={violationPrompt.violation}
          onCancel={() => setViolationPrompt(null)}
          onForceAssign={async () => {
            await onUpdateShift(
              violationPrompt.empId,
              violationPrompt.day,
              violationPrompt.attemptedCode,
              violationPrompt.customHours,
              violationPrompt.customStartTime,
              violationPrompt.customEndTime
            );
            setViolationPrompt(null);
          }}
        />
      )}
    </div>
  );
};
