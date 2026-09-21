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
import { ManagerScheduleEngine, formatManagerRole } from '../services/managerScheduleEngine';
import { AlertTriangle, CheckCircle2, MessageSquare, Edit3, Calendar, Users, TrendingUp, ChevronLeft, ChevronRight, PanelLeft, PanelRight, Columns, Eye, EyeOff } from 'lucide-react';

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

  // Funkcja pomocnicza generująca inicjały menedżera
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Stany zwijania/rozwijania paneli bocznych (domyślnie zwinięte dla maksymalnej przestrzeni)
  const [isLeftExpanded, setIsLeftExpanded] = useState<boolean>(false);
  const [isRightExpanded, setIsRightExpanded] = useState<boolean>(false);

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

    // Wyznacz wysokość nagłówka thead
    const thead = container.querySelector('thead');
    const stickyTopHeight = thead ? (thead.getBoundingClientRect().bottom - containerRect.top) : 80;

    const visibleLeft = containerRect.left;
    const visibleRight = containerRect.right;
    const visibleTop = containerRect.top + stickyTopHeight;
    const visibleBottom = containerRect.bottom;

    let deltaX = 0;
    if (cellRect.left < visibleLeft) {
      deltaX = cellRect.left - visibleLeft - 10;
    } else if (cellRect.right > visibleRight) {
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
        <table
          className="w-full text-xs border-collapse table-fixed"
          style={{
            minWidth: isLeftExpanded
              ? (isRightExpanded ? '1380px' : '1240px')
              : (isRightExpanded ? '1220px' : '1080px')
          }}
        >
          {/* KOLUMNY — SZTYWNE ROZMIARY DLA PEŁNEJ RÓWNOMIERNOŚCI I PŁYNNEGO ROZWIJANIA */}
          <colgroup>
            <col style={{ width: isLeftExpanded ? '200px' : '44px' }} />
            {data.daySummaries.map(d => (
              <col key={`col-day-${d.day}`} style={{ width: '32px' }} />
            ))}
            {isRightExpanded ? (
              <>
                <col style={{ width: '34px' }} />
                <col style={{ width: '46px' }} />
                <col style={{ width: '40px' }} />
                <col style={{ width: '32px' }} />
                <col style={{ width: '52px' }} />
              </>
            ) : (
              <col style={{ width: '56px' }} />
            )}
          </colgroup>

          {/* NAGŁÓWEK TABELI */}
          <thead className="sticky top-0 z-40 bg-[#F7F9F8] shadow-xs">
            {/* Wiersz 1: Dni miesiąca & Nagłówki kolumn */}
            <tr className="border-b border-[#E2E8E5]">
              {/* Kolumna Menedżerów po lewej (Rozwijana / Zwinięta) */}
              {isLeftExpanded ? (
                <th
                  onClick={() => setIsLeftExpanded(false)}
                  className="bg-[#EEF3F0] hover:bg-stone-200/80 cursor-pointer px-2.5 py-2 text-left font-bold text-[#006241] w-[200px] min-w-[200px] max-w-[200px] border-r-2 border-stone-300 text-xs transition-colors select-none group"
                  title="Kliknij, aby zwinąć kolumnę menedżerów do 44px"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Users className="w-4 h-4 text-[#006241] shrink-0" />
                      <span className="font-extrabold text-stone-900 truncate">Menedżerowie</span>
                    </div>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9.5px] font-bold text-stone-600 bg-white hover:bg-stone-100 rounded border border-stone-300 shadow-2xs group-hover:bg-emerald-50 group-hover:text-[#006241] group-hover:border-emerald-300 transition-colors shrink-0">
                      <ChevronLeft className="w-3 h-3 text-stone-500 group-hover:text-[#006241]" />
                      Zwiń
                    </span>
                  </div>
                </th>
              ) : (
                <th
                  onClick={() => setIsLeftExpanded(true)}
                  className="bg-[#EEF3F0] hover:bg-emerald-100/70 cursor-pointer px-1 py-2 text-center font-bold text-[#006241] w-[44px] min-w-[44px] max-w-[44px] border-r-2 border-stone-300 text-[10px] transition-colors select-none group"
                  title="Kliknij, aby rozwinąć dane menedżerów (Imię, Rola, Wymiar etatu, Stawka)"
                >
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <div className="flex items-center gap-0.5">
                      <Users className="w-3.5 h-3.5 text-[#006241]" />
                      <ChevronRight className="w-3 h-3 text-stone-400 group-hover:text-[#006241] transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <span className="text-[8px] font-black tracking-tighter text-[#006241]">MGR ›</span>
                  </div>
                </th>
              )}

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
                    className={`px-0.5 py-1 text-center font-bold min-w-[30px] md:min-w-[33px] xl:min-w-[36px] border-r border-[#E2E8E5] transition-colors ${headerBg}`}
                    title={d.isHoliday ? `Święto: ${d.holidayName}` : d.isTradingSunday ? 'Niedziela Handlowa' : ''}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-semibold text-stone-500">
                        {d.dayName}
                      </span>
                      <span className={`text-[11px] ${
                        d.isHoliday ? 'text-rose-900 font-black' : d.isTradingSunday ? 'text-emerald-950 font-black scale-105' : d.isWeekend ? 'text-amber-950 font-black' : 'text-stone-800 font-bold'
                      }`}>
                        {d.day}
                      </span>
                    </div>
                  </th>
                );
              })}

              {/* Podsumowania wiersza po prawej (Rozwijane do 5 kolumn / Zwinięte do 1 kolumny) */}
              {isRightExpanded ? (
                <>
                  <th
                    onClick={() => setIsRightExpanded(false)}
                    className="bg-[#EEF3F0] hover:bg-stone-200 cursor-pointer px-1 py-1 text-center font-bold text-stone-800 min-w-[34px] text-[9px] border-l-2 border-[#D0DCD6] border-r border-[#E2E8E5] select-none group"
                    title={`Dni wolne od pracy (norma: ${data.offDaysNorm}) — Kliknij, aby zwinąć podsumowanie`}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span>OFF</span>
                    </div>
                  </th>
                  <th
                    onClick={() => setIsRightExpanded(false)}
                    className="bg-[#EEF3F0] hover:bg-stone-200 cursor-pointer px-1 py-1 text-center font-bold text-stone-800 min-w-[46px] text-[9px] border-r border-[#E2E8E5] select-none"
                    title="Łącznie wypracowane godziny w miesiącu — Kliknij, aby zwinąć podsumowanie"
                  >
                    Wyprac.
                  </th>
                  <th
                    onClick={() => setIsRightExpanded(false)}
                    className="bg-[#EEF3F0] hover:bg-stone-200 cursor-pointer px-1 py-1 text-center font-bold text-stone-800 min-w-[40px] text-[9px] border-r border-[#E2E8E5] select-none"
                    title="Norma godzinowa dla danego wymiaru etatu — Kliknij, aby zwinąć podsumowanie"
                  >
                    Norma
                  </th>
                  <th
                    onClick={() => setIsRightExpanded(false)}
                    className="bg-[#EEF3F0] hover:bg-stone-200 cursor-pointer px-0.5 py-1 text-center font-bold text-stone-800 min-w-[32px] text-[9px] border-r border-[#E2E8E5] select-none"
                    title="Procent realizacji normy — Kliknij, aby zwinąć podsumowanie"
                  >
                    %
                  </th>
                  <th
                    onClick={() => setIsRightExpanded(false)}
                    className="bg-[#EEF3F0] hover:bg-emerald-100 cursor-pointer px-1 py-1 text-center font-bold text-stone-800 min-w-[52px] text-[9px] select-none group"
                    title="Bilans godzin w stosunku do normy etatu — Kliknij, aby zwinąć do 1 kolumny"
                  >
                    <div className="flex items-center justify-center gap-0.5 text-[#006241]">
                      <span className="font-extrabold">Bilans</span>
                      <ChevronRight className="w-3 h-3 text-stone-500 group-hover:text-[#006241] transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </th>
                </>
              ) : (
                <th
                  onClick={() => setIsRightExpanded(true)}
                  className="bg-[#EEF3F0] hover:bg-emerald-100 cursor-pointer px-1 py-1 text-center font-bold text-stone-900 min-w-[56px] text-[9px] border-l-2 border-[#D0DCD6] transition-colors select-none group"
                  title="Kliknij, aby rozwinąć 5 pełnych kolumn podsumowania (OFF, Wyprac., Norma, %, Bilans)"
                >
                  <div className="flex items-center justify-center gap-0.5">
                    <ChevronLeft className="w-3 h-3 text-[#006241] group-hover:text-emerald-700 transition-transform group-hover:-translate-x-0.5" />
                    <span className="font-black text-[#006241]">Bilans</span>
                  </div>
                </th>
              )}
            </tr>

            {/* Wiersz 2: Kalendarz Dni Wolnych od Pracy & Niedziel Handlowych na Matrycy */}
            <tr className="border-b-2 border-stone-300 bg-[#EEF3F0] text-[9px] select-none">
              {isLeftExpanded ? (
                <th
                  onClick={() => setIsLeftExpanded(false)}
                  className="bg-[#EEF3F0] hover:bg-stone-200/80 cursor-pointer px-2 py-1 text-left font-bold text-stone-500 w-[200px] min-w-[200px] max-w-[200px] border-r-2 border-stone-300 text-[9.5px] uppercase tracking-wider select-none truncate"
                  title="Kliknij, aby zwinąć"
                >
                  Status Kalendarza
                </th>
              ) : (
                <th
                  onClick={() => setIsLeftExpanded(true)}
                  className="bg-[#EEF3F0] hover:bg-emerald-100/70 cursor-pointer px-0.5 py-1 text-center font-black text-stone-500 w-[44px] min-w-[44px] max-w-[44px] border-r-2 border-stone-300 uppercase tracking-tighter text-[7.5px] select-none"
                  title="Kalendarz i statusy (Kliknij, aby rozwinąć menedżerów)"
                >
                  CAL
                </th>
              )}

              {/* Dni miesiąca (1..30/31) — statusy na matrycy */}
              {data.daySummaries.map(d => {
                if (d.isHoliday) {
                  return (
                    <th
                      key={`status-day-${d.day}`}
                      className="px-0.5 py-1 text-center bg-rose-100 text-rose-950 font-black border-r border-rose-300 min-w-[30px] md:min-w-[33px] xl:min-w-[36px]"
                      title={`Święto ustawowo wolne od pracy: ${d.holidayName}`}
                    >
                      <span className="inline-block px-0.5 py-0.5 rounded bg-rose-600 text-white text-[7.5px] font-black tracking-tight uppercase shadow-2xs" title={d.holidayName}>
                        ŚW.
                      </span>
                    </th>
                  );
                }

                if (d.isTradingSunday) {
                  return (
                    <th
                      key={`status-day-${d.day}`}
                      className="px-0.5 py-1 text-center bg-emerald-100 text-emerald-950 font-black border-r border-emerald-400 min-w-[30px] md:min-w-[33px] xl:min-w-[36px]"
                      title="Niedziela Handlowa — handel dozwolony, centrum i kawiarnia otwarte"
                    >
                      <span className="inline-block px-0.5 py-0.5 rounded bg-emerald-700 text-white text-[7.5px] font-black tracking-tight uppercase shadow-2xs animate-pulse">
                        🛒 H
                      </span>
                    </th>
                  );
                }

                if (d.isSunday) {
                  return (
                    <th
                      key={`status-day-${d.day}`}
                      className="px-0.5 py-1 text-center bg-amber-100/70 text-amber-950 font-bold border-r border-amber-300 min-w-[30px] md:min-w-[33px] xl:min-w-[36px]"
                      title="Niedziela niehandlowa — dzień ustawowo wolny od pracy"
                    >
                      <span className="inline-block px-0.5 py-0.5 rounded bg-amber-200 text-amber-950 text-[7.5px] font-bold tracking-tight">
                        WOL
                      </span>
                    </th>
                  );
                }

                if (d.isWeekend) {
                  return (
                    <th
                      key={`status-day-${d.day}`}
                      className="px-0.5 py-1 text-center bg-amber-50 text-amber-900 font-semibold border-r border-amber-200 min-w-[30px] md:min-w-[33px] xl:min-w-[36px]"
                      title="Sobota — dzień wolny (przeciętnie 5-dniowy tydzień pracy)"
                    >
                      <span className="inline-block px-0.5 py-0.5 rounded bg-stone-200 text-stone-700 text-[7.5px] font-bold">
                        SOB
                      </span>
                    </th>
                  );
                }

                return (
                  <th
                    key={`status-day-${d.day}`}
                    className="px-0.5 py-1 text-center bg-[#F7F9F8] text-stone-400 font-normal border-r border-[#E2E8E5] min-w-[30px] md:min-w-[33px] xl:min-w-[36px]"
                    title="Dzień roboczy"
                  >
                    <span className="text-[7.5px] text-stone-400">Praca</span>
                  </th>
                );
              })}

              {isRightExpanded ? (
                <th
                  onClick={() => setIsRightExpanded(false)}
                  className="bg-[#EEF3F0] border-l-2 border-[#D0DCD6] cursor-pointer hover:bg-stone-200"
                  colSpan={5}
                  title="Kliknij, aby zwinąć podsumowanie"
                />
              ) : (
                <th
                  onClick={() => setIsRightExpanded(true)}
                  className="bg-[#EEF3F0] border-l-2 border-[#D0DCD6] px-1 py-1 text-center font-bold text-stone-400 text-[8px] cursor-pointer select-none hover:bg-stone-200"
                  title="Kliknij, aby rozwinąć podsumowanie"
                >
                  +/-
                </th>
              )}
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
                  {/* Kolumna Menedżera po lewej (Rozwijana / Zwinięta) */}
                  {isLeftExpanded ? (
                    <td
                      onClick={() => setIsLeftExpanded(false)}
                      className={`px-2 py-1 text-left border-r-2 border-stone-300 w-[200px] min-w-[200px] max-w-[200px] cursor-pointer hover:bg-stone-100/60 transition-colors select-none ${rowBg}`}
                      title="Kliknij, aby zwinąć kolumnę menedżerów"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`inline-flex items-center justify-center w-5 h-5 shrink-0 rounded-full text-[8.5px] font-black shadow-2xs ${
                            formatManagerRole(row.employee.role) === 'SM'
                              ? 'bg-[#006241] text-white ring-1 ring-emerald-600'
                              : formatManagerRole(row.employee.role) === 'ASM'
                              ? 'bg-[#1E3932] text-emerald-300 ring-1 ring-emerald-700'
                              : 'bg-stone-200 text-stone-800'
                          }`}>
                            {getInitials(row.employee.name)}
                          </span>
                          <div className="min-w-0 flex flex-col">
                            <span className="font-bold text-stone-900 truncate text-[11px] leading-tight">
                              {row.employee.name}
                            </span>
                            <div className="flex items-center gap-1 text-[9px] text-stone-500 leading-none mt-0.5">
                              <span className="font-bold text-[#006241]">
                                {formatManagerRole(row.employee.role)}
                              </span>
                              <span>•</span>
                              <span>{row.employee.contract_type === 'FULL' ? '1.00' : (row.employee.contract_type === 'PART_3_4' ? '0.75' : '0.50')}</span>
                              {row.employee.monthly_salary && row.employee.monthly_salary > 0 ? (
                                <>
                                  <span>•</span>
                                  <span className="font-medium" title={`Wynagrodzenie miesięczne: ${Math.round(row.employee.monthly_salary * (row.employee.contract_hours_ratio || 1.0)).toLocaleString('pl-PL')} zł/mc`}>
                                    {Math.round(row.employee.monthly_salary * (row.employee.contract_hours_ratio || 1.0)).toLocaleString('pl-PL')} zł
                                  </span>
                                </>
                              ) : row.employee.hourly_rate && row.employee.hourly_rate > 0 ? (
                                <>
                                  <span>•</span>
                                  <span className="font-medium">{row.employee.hourly_rate.toFixed(0)} zł/h</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {hasViolations && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenComplianceModal?.();
                            }}
                            className="w-3.5 h-3.5 shrink-0 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center text-[8px] font-black cursor-pointer animate-pulse shadow-2xs"
                            title={`⚠️ ${row.violations.length} naruszeń KP (kliknij, aby sprawdzić)`}
                          >
                            !
                          </button>
                        )}
                      </div>
                    </td>
                  ) : (
                    <td
                      onClick={() => setIsLeftExpanded(true)}
                      className={`px-0.5 py-1 text-center border-r-2 border-stone-300 w-[44px] min-w-[44px] max-w-[44px] cursor-pointer hover:bg-emerald-50/70 transition-colors select-none ${rowBg}`}
                      title={`Kliknij, aby rozwinąć dane menedżera\n${row.employee.name} — ${formatManagerRole(row.employee.role)} (${row.employee.contract_type === 'FULL' ? '1.00' : (row.employee.contract_type === 'PART_3_4' ? '0.75' : '0.50')})${row.employee.monthly_salary ? ` • ${Math.round(row.employee.monthly_salary * (row.employee.contract_hours_ratio || 1.0)).toLocaleString('pl-PL')} zł/mc` : (row.employee.hourly_rate ? ` • ${row.employee.hourly_rate.toFixed(2)} zł/h` : '')}`}
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[8.5px] font-black shadow-2xs ${
                          formatManagerRole(row.employee.role) === 'SM'
                            ? 'bg-[#006241] text-white ring-1 ring-emerald-600'
                            : formatManagerRole(row.employee.role) === 'ASM'
                            ? 'bg-[#1E3932] text-emerald-300 ring-1 ring-emerald-700'
                            : 'bg-stone-200 text-stone-800'
                        }`}>
                          {getInitials(row.employee.name)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <span className="text-[7.5px] font-bold text-[#006241] leading-none">
                            {formatManagerRole(row.employee.role)}
                          </span>
                          {hasViolations && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          )}
                        </div>
                      </div>
                    </td>
                  )}

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
                        className={`p-0.5 text-center border-r border-[#E2E8E5] transition-all select-none relative min-w-[30px] md:min-w-[33px] xl:min-w-[36px] ${
                          isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-emerald-100/60'
                        } ${cellBg} ${
                          isSelected ? 'ring-2 ring-[#006241] ring-offset-2 ring-offset-white z-10 shadow-md bg-emerald-100/80 font-bold' : ''
                        }`}
                        title={cellTitle}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          {/* DYSPOZYCYJNOŚĆ INNA NIŻ DOMYŚLNA FULL: WYŚWIETLA SIĘ PO LEWEJ STRONIE KWADRATU */}
                          {hasDispo && (
                            <span
                              className={`px-0.5 py-0.2 rounded text-[8px] font-black border leading-none shrink-0 tracking-tight uppercase shadow-2xs transition-transform hover:scale-110 ${
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
                              {disposition === 'M' ? 'A' : disposition === 'Z' ? 'P' : disposition}
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
                              className={`inline-flex items-center justify-center w-7 h-6 text-[10.5px] rounded-md border transition-transform hover:scale-105 active:scale-95 cursor-pointer ${badgeClass} ${
                                hasDayViolation ? 'ring-2 ring-rose-500 ring-offset-1 border-rose-400' : ''
                              } ${rcpConflict ? 'ring-2 ring-amber-500 ring-offset-1 border-amber-500 shadow-xs' : ''} ${
                                isSelected ? 'ring-1 ring-[#006241] ring-offset-1 font-black shadow-xs' : ''
                              }`}
                            >
                              {isCustomTime || isCustomDuration ? (
                                <div className="flex flex-col items-center justify-center leading-none">
                                  <span className="text-[9px] font-black leading-tight">{shiftCode}</span>
                                  <span className="text-[7px] font-extrabold opacity-90 leading-none tracking-tighter" title={isCustomTime ? `${shiftStartTime} – ${shiftEndTime}` : `${shift?.hours}h`}>
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
                                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-600 border border-white flex items-center justify-center text-[7px] text-white font-black animate-pulse shadow-xs"
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
                                className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-amber-500 hover:bg-amber-600 border border-white flex items-center justify-center text-[7px] text-white font-black cursor-pointer animate-bounce shadow-xs transition-transform hover:scale-125 z-10"
                                title={`⚠️ KOLIZJA RCP: Zarejestrowano ${rcpConflict.rcpHours}h w ${rcpConflict.unitName || 'Starbucks'} w trakcie ${rcpConflict.shiftCode}!\nKliknij ikonę ⚡, aby otworzyć szczegóły.`}
                              >
                                ⚡
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}

                  {/* Podsumowania wiersza po prawej (5 kolumn lub 1 kolumna) */}
                  {isRightExpanded ? (
                    <>
                      {/* Podsumowanie: Dni OFF */}
                      <td className="px-1 py-1 text-center border-l-2 border-[#D0DCD6] border-r border-[#E2E8E5] bg-[#F7F9F8] min-w-[34px]">
                        <span className={`inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                          isOffValid ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900 ring-1 ring-amber-400'
                        }`}>
                          {row.totalOffDays}
                        </span>
                      </td>

                      {/* Podsumowanie: Wypracowane Godziny */}
                      <td className="px-1 py-1 text-center font-black text-stone-900 border-r border-[#E2E8E5] bg-[#F7F9F8] text-[10.5px] min-w-[46px]">
                        {row.totalWorkedHours.toFixed(1)}h
                      </td>

                      {/* Podsumowanie: Norma */}
                      <td className="px-1 py-1 text-center font-medium text-stone-600 border-r border-[#E2E8E5] bg-[#F7F9F8] text-[10px] min-w-[40px]">
                        {row.nominalHours.toFixed(0)}h
                      </td>

                      {/* Podsumowanie: % Realizacji */}
                      <td className="px-0.5 py-1 text-center text-stone-700 border-r border-[#E2E8E5] bg-[#F7F9F8] text-[10px] font-bold min-w-[32px]">
                        {row.nominalHours > 0 ? `${((row.totalWorkedHours / row.nominalHours) * 100).toFixed(0)}%` : '—'}
                      </td>

                      {/* Podsumowanie: Bilans */}
                      <td className="px-1 py-1 text-center bg-[#F7F9F8] min-w-[46px]">
                        <span className={`inline-flex items-center justify-center px-1 py-0.2 rounded text-[10.5px] font-black ${
                          hasOvertime
                            ? 'bg-blue-100 text-blue-900'
                            : hasDeficit
                            ? 'bg-rose-100 text-rose-900'
                            : 'bg-stone-100 text-stone-700'
                        }`}>
                          {hasOvertime ? `+${row.balanceHours.toFixed(1)}h` : `${row.balanceHours.toFixed(1)}h`}
                        </span>
                      </td>
                    </>
                  ) : (
                    <td
                      onClick={() => setIsRightExpanded(true)}
                      className="px-1 py-1 text-center bg-[#F7F9F8] border-l-2 border-[#D0DCD6] min-w-[50px] cursor-pointer hover:bg-emerald-50/70 transition-colors select-none"
                      title={`Kliknij, aby rozwinąć pełne 5 kolumn podsumowania\nWypracowane: ${row.totalWorkedHours.toFixed(1)}h / Norma: ${row.nominalHours.toFixed(0)}h (${((row.totalWorkedHours / (row.nominalHours || 1)) * 100).toFixed(0)}%)\nDni OFF: ${row.totalOffDays}\nBilans: ${row.balanceHours > 0 ? `+${row.balanceHours.toFixed(1)}h` : `${row.balanceHours.toFixed(1)}h`}`}
                    >
                      <span className={`inline-flex items-center justify-center px-1 py-0.2 rounded text-[10.5px] font-black ${
                        hasOvertime
                          ? 'bg-blue-100 text-blue-900'
                          : hasDeficit
                          ? 'bg-rose-100 text-rose-900'
                          : 'bg-stone-100 text-stone-700'
                      }`}>
                        {hasOvertime ? `+${row.balanceHours.toFixed(1)}h` : `${row.balanceHours.toFixed(1)}h`}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}

            {/* WIERSZ: WAŻNE WYDARZENIA */}
            <tr className="bg-amber-50 border-t-2 border-amber-200">
              {isLeftExpanded ? (
                <td
                  onClick={() => setIsLeftExpanded(false)}
                  className="px-2 py-1 font-bold text-amber-950 bg-amber-100 border-r-2 border-amber-300 text-[11px] w-[200px] min-w-[200px] max-w-[200px] cursor-pointer hover:bg-amber-200/80 transition-colors select-none align-middle"
                  title="Kliknij, aby zwinąć"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="truncate">Wydarzenia / Notatki</span>
                    </div>
                    <ChevronLeft className="w-3 h-3 text-amber-700 shrink-0" />
                  </div>
                </td>
              ) : (
                <td
                  onClick={() => setIsLeftExpanded(true)}
                  className="px-0.5 py-1 font-bold text-amber-950 bg-amber-100 border-r-2 border-amber-300 text-center w-[44px] min-w-[44px] max-w-[44px] cursor-pointer hover:bg-amber-200 transition-colors select-none align-middle"
                  title="Wydarzenia i notatki operacyjne (Kliknij, aby rozwinąć)"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
                    <span
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                      className="text-[8px] font-black uppercase text-amber-800 tracking-wider select-none leading-none"
                    >
                      WYDARZENIA
                    </span>
                  </div>
                </td>
              )}

              {data.daySummaries.map(d => {
                const eventText = d.eventText;
                const isEditing = editingEventDay === d.day;

                return (
                  <td
                    key={`event-${d.day}`}
                    className="p-0.5 text-center border-r border-[#E2E8E5] align-top bg-amber-50/50 overflow-hidden"
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
                        className={`group relative h-28 max-h-28 w-full p-0.5 rounded transition-colors flex flex-col items-center justify-start overflow-hidden ${
                          isReadOnly ? 'cursor-default' : 'cursor-pointer'
                        } ${
                          eventText
                            ? 'bg-amber-100/90 text-amber-950 font-medium hover:bg-amber-200 border border-amber-300/60 shadow-2xs'
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
                          <div
                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                            className="h-full w-full flex items-center justify-start text-[9px] font-semibold text-amber-950 truncate tracking-tight py-1 px-0.5 select-none leading-none"
                          >
                            {eventText}
                          </div>
                        ) : !isReadOnly ? (
                          <div className="h-full flex items-center justify-center">
                            <Edit3 className="w-2.5 h-2.5 mx-auto opacity-0 group-hover:opacity-100 text-amber-600 transition-opacity" />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </td>
                );
              })}

              {isRightExpanded ? (
                <td
                  onClick={() => setIsRightExpanded(false)}
                  className="bg-amber-100 hover:bg-amber-200 border-l-2 border-amber-300 text-center text-[10px] text-amber-950 font-black px-1 py-1 cursor-pointer select-none transition-colors group"
                  colSpan={5}
                  title="Kliknij, aby zwinąć podsumowanie do 1 kolumny"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Podsumowanie</span>
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-amber-200/80 group-hover:bg-amber-300 rounded text-[9px] font-bold text-amber-900 border border-amber-400">
                      Zwiń <ChevronRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </td>
              ) : (
                <td
                  onClick={() => setIsRightExpanded(true)}
                  className="bg-amber-100 hover:bg-amber-200 border-l-2 border-amber-300 text-center text-[9px] text-amber-950 font-black px-1 py-1 cursor-pointer select-none transition-colors group"
                  title="Kliknij, aby rozwinąć 5 kolumn podsumowania"
                >
                  <div className="flex items-center justify-center gap-0.5 text-amber-900">
                    <ChevronLeft className="w-2.5 h-2.5 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Bilans</span>
                  </div>
                </td>
              )}
            </tr>

            {/* WIERSZ: OBSADA DZIENNA (PODSUMOWANIE POKRYCIA) */}
            <tr className="bg-[#1E3932] text-white font-semibold">
              {isLeftExpanded ? (
                <td
                  onClick={() => setIsLeftExpanded(false)}
                  className="px-2 py-1 bg-[#1E3932] border-r-2 border-emerald-700 text-emerald-300 font-bold text-[11px] w-[200px] min-w-[200px] max-w-[200px] cursor-pointer hover:bg-[#25463e] transition-colors select-none"
                  title="Kliknij, aby zwinąć kolumnę menedżerów"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">Obsada (Dziennie)</span>
                    <ChevronLeft className="w-3 h-3 text-emerald-300 shrink-0" />
                  </div>
                </td>
              ) : (
                <td
                  onClick={() => setIsLeftExpanded(true)}
                  className="px-0.5 py-1 bg-[#1E3932] border-r-2 border-emerald-700 text-emerald-300 font-bold text-center w-[44px] min-w-[44px] max-w-[44px] cursor-pointer hover:bg-[#25463e] transition-colors select-none"
                  title="Obsada dzienna menedżerów (Kliknij, aby rozwinąć menedżerów)"
                >
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span className="text-[7.5px] font-black text-emerald-300 uppercase tracking-tighter">OBS</span>
                  </div>
                </td>
              )}

              {data.daySummaries.map(d => {
                const isAmOk = d.hasOpeningCoverage;
                const isPmOk = d.hasClosingCoverage;
                const extSupportCount = d.externalSupportManagers?.length || 0;

                return (
                  <td
                    key={`cov-${d.day}`}
                    className="p-0.5 text-center border-r border-emerald-900/60 bg-[#1E3932] min-w-[30px] md:min-w-[33px] xl:min-w-[36px]"
                    title={`Dzień ${d.day}: ${d.totalManagersWorking} menedżerów pracujących w Janki.${extSupportCount > 0 ? ` Wsparcie na innych kawiarniach (${extSupportCount}): ${d.externalSupportManagers?.join(', ')}.` : ''} Otwarcia: ${d.openingManagers.join(', ') || 'BRAK'}. Zamknięcia: ${d.closingManagers.join(', ') || 'BRAK'}`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-[11px] font-bold text-white leading-none">
                        {d.totalManagersWorking}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isAmOk ? 'bg-emerald-400' : 'bg-rose-500 ring-1 ring-white'}`} title={isAmOk ? 'Otwarcie obsadzone' : 'BRAK OTWARCIA!'} />
                        <span className={`w-1.5 h-1.5 rounded-full ${isPmOk ? 'bg-amber-400' : 'bg-rose-500 ring-1 ring-white'}`} title={isPmOk ? 'Zamknięcie obsadzone' : 'BRAK ZAMKNIĘCIA!'} />
                      </div>
                      {extSupportCount > 0 && (
                        <span 
                          className="text-[7px] leading-none px-0.5 py-0.2 rounded bg-lime-800 text-lime-200 font-bold border border-lime-600 mt-0.5" 
                          title={`Wsparcie poza kawiarnią Janki:\n${d.externalSupportManagers?.join('\n')}`}
                        >
                          +{extSupportCount}
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}

              {/* Stopka sumaryczna zespołu (5 kolumn lub 1 kolumna) */}
              {isRightExpanded ? (
                <>
                  <td
                    onClick={() => setIsRightExpanded(false)}
                    className="bg-[#1E3932] hover:bg-[#25463e] cursor-pointer px-1 py-1 text-center text-emerald-300 border-l-2 border-emerald-700 border-r border-emerald-900 text-[8.5px] font-bold min-w-[34px] select-none"
                    title="Kliknij, aby zwinąć"
                  >
                    Min.{data.offDaysNorm}
                  </td>
                  <td
                    onClick={() => setIsRightExpanded(false)}
                    className="bg-[#1E3932] hover:bg-[#25463e] cursor-pointer px-1 py-1 text-center text-white font-black border-r border-emerald-900 text-[10.5px] min-w-[46px] select-none"
                    title="Kliknij, aby zwinąć"
                  >
                    {data.totalTeamHours.toFixed(0)}h
                  </td>
                  <td
                    onClick={() => setIsRightExpanded(false)}
                    className="bg-[#1E3932] hover:bg-[#25463e] cursor-pointer px-1 py-1 text-center text-emerald-200 border-r border-emerald-900 text-[8.5px] min-w-[40px] select-none"
                    title="Kliknij, aby zwinąć"
                  >
                    Średnia
                  </td>
                  <td
                    onClick={() => setIsRightExpanded(false)}
                    className="bg-[#1E3932] hover:bg-[#25463e] cursor-pointer px-0.5 py-1 text-center text-white font-bold text-[10px] border-r border-emerald-900 min-w-[32px] select-none"
                    title="Kliknij, aby zwinąć"
                  >
                    {data.averageCoveragePercent.toFixed(0)}%
                  </td>
                  <td
                    onClick={() => setIsRightExpanded(false)}
                    className="bg-[#1E3932] px-1 py-1 text-center text-emerald-300 font-black text-[10.5px] min-w-[46px] cursor-pointer hover:bg-[#25463e] select-none"
                    title="Bilans łączny zespołu — Kliknij, aby zwinąć do 1 kolumny"
                  >
                    {(() => {
                      const totalTeamBalance = data.rows.reduce((sum, r) => sum + r.balanceHours, 0);
                      return totalTeamBalance > 0 ? `+${totalTeamBalance.toFixed(0)}h` : `${totalTeamBalance.toFixed(0)}h`;
                    })()}
                  </td>
                </>
              ) : (
                <td
                  onClick={() => setIsRightExpanded(true)}
                  className="bg-[#1E3932] px-1 py-1 text-center text-emerald-300 font-bold text-[10.5px] border-l-2 border-emerald-700 cursor-pointer hover:bg-[#25463e] select-none"
                  title="Kliknij, aby rozwinąć pełne 5 kolumn podsumowania zespołu"
                >
                  {(() => {
                    const totalTeamBalance = data.rows.reduce((sum, r) => sum + r.balanceHours, 0);
                    return totalTeamBalance > 0 ? `+${totalTeamBalance.toFixed(0)}h` : `${totalTeamBalance.toFixed(0)}h`;
                  })()}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {/* PASEK POMOCNICZY NAWIGACJI KLAWIATURĄ ORAZ SZYBKIE PRZEŁĄCZNIKI ROZWIJANIA/ZWIJANIA */}
      <div className="bg-[#F7F9F8] border-t border-[#E2E8E5] px-4 py-2 flex items-center justify-between text-xs text-stone-600 select-none flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Szybkie przyciski rozwijania/zwijania paneli */}
          <div className="flex items-center gap-1.5 mr-2">
            <button
              type="button"
              onClick={() => setIsLeftExpanded(!isLeftExpanded)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer shadow-2xs ${
                isLeftExpanded
                  ? 'bg-emerald-700 text-white border-emerald-800'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
              }`}
              title={isLeftExpanded ? 'Zwiń kolumnę menedżerów do wąskiej (42px)' : 'Rozwiń pełną kolumnę menedżerów (190px)'}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Menedżerowie:</span>
              <span className="font-extrabold">{isLeftExpanded ? 'Rozwinięte ▾' : 'Zwinięte ▸'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRightExpanded(!isRightExpanded)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer shadow-2xs ${
                isRightExpanded
                  ? 'bg-emerald-700 text-white border-emerald-800'
                  : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
              }`}
              title={isRightExpanded ? 'Zwiń podsumowanie do 1 kolumny (Bilans)' : 'Rozwiń pełne 5 kolumn podsumowania (OFF, Wyprac., Norma, %, Bilans)'}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Podsumowanie:</span>
              <span className="font-extrabold">{isRightExpanded ? '5 kolumn ▾' : '1 kolumna ▸'}</span>
            </button>
          </div>

          <span className="text-stone-300">•</span>
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
