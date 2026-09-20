import React, { useState } from 'react';
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
  onUpdateShift: (empId: number, day: number, code: string) => Promise<void>;
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
    currentDisposition?: string;
  } | null>(null);

  const [violationPrompt, setViolationPrompt] = useState<{
    empId: number;
    empName: string;
    day: number;
    dayName?: string;
    attemptedCode: string;
    violation: LaborLawViolation;
  } | null>(null);

  const [editingEventDay, setEditingEventDay] = useState<number | null>(null);
  const [eventInputText, setEventInputText] = useState('');

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
      <div className="overflow-x-auto max-h-[750px] relative scrollbar-thin">
        <table className="w-full text-xs border-collapse">
          {/* NAGŁÓWEK TABELI */}
          <thead className="sticky top-0 z-30 bg-[#F7F9F8] shadow-xs">
            {/* Wiersz 1: Dni miesiąca */}
            <tr className="border-b border-[#E2E8E5]">
              {/* Kolumny stałe po lewej: Pinned with exact widths */}
              <th className="sticky left-0 z-40 bg-[#F7F9F8] px-2.5 py-2.5 text-left font-semibold text-stone-600 w-[56px] min-w-[56px] max-w-[56px] border-r border-[#E2E8E5]">
                Etat
              </th>
              <th className="sticky left-[56px] z-40 bg-[#F7F9F8] px-3 py-2.5 text-left font-semibold text-stone-800 w-[176px] min-w-[176px] max-w-[176px] border-r border-[#E2E8E5]">
                MANAGER
              </th>
              <th className="sticky left-[232px] z-40 bg-[#F7F9F8] px-3 py-2.5 text-left font-semibold text-stone-600 w-[176px] min-w-[176px] max-w-[176px] border-r-2 border-stone-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]">
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
              <th className="sticky left-0 z-40 bg-[#EEF3F0] px-2 py-1 text-left font-black text-stone-500 w-[56px] min-w-[56px] max-w-[56px] border-r border-[#D0DCD6] uppercase tracking-tighter">
                STATUS
              </th>
              <th className="sticky left-[56px] z-40 bg-[#EEF3F0] px-3 py-1 text-left font-bold text-[#1E3932] w-[352px] min-w-[352px] max-w-[352px] border-r-2 border-stone-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)]" colSpan={2}>
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
                  <td className={`sticky left-0 z-20 px-2.5 py-2 text-xs font-semibold text-stone-600 border-r border-[#E2E8E5] w-[56px] min-w-[56px] max-w-[56px] ${rowBg}`}>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      isFullTime ? 'bg-stone-100 text-stone-700' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {row.employee.contract_type}
                    </span>
                  </td>

                  {/* Kolumna 2: Manager (ze statusem KP i szybkim podglądem bilansu) */}
                  <td className={`sticky left-[56px] z-20 px-3 py-2 border-r border-[#E2E8E5] w-[176px] min-w-[176px] max-w-[176px] ${rowBg}`}>
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
                  <td className={`sticky left-[232px] z-20 px-3 py-2 text-[11px] text-stone-600 border-r-2 border-stone-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.12)] w-[176px] min-w-[176px] max-w-[176px] truncate ${rowBg}`} title={row.employee.role}>
                    {row.employee.role}
                  </td>

                  {/* Komórki dni (1..30/31) ze zmianami i dyspozycją */}
                  {data.daySummaries.map(d => {
                    const shift = row.shifts[d.day];
                    const shiftCode = shift ? shift.shift_code : 'OFF';
                    const disposition = shift?.disposition || 'OFF';
                    const hasDispo = disposition && disposition !== 'OFF';
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
                      cellTitle += ` • Dyspozycja: ${disposition}`;
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

                    return (
                      <td
                        key={`cell-${row.employee.id}-${d.day}`}
                        onClick={() => {
                          if (isReadOnly) return;
                          setActivePicker({
                            empId: row.employee.id,
                            empName: row.employee.name,
                            day: d.day,
                            currentCode: shiftCode,
                            currentDisposition: disposition
                          });
                        }}
                        className={`p-1 text-center border-r border-[#E2E8E5] transition-colors select-none relative min-w-[50px] max-w-[58px] ${
                          isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-emerald-100/60'
                        } ${cellBg}`}
                        title={cellTitle}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {/* DYSPOZYCYJNOŚĆ INNA NIŻ OFF: WYŚWIETLA SIĘ PO LEWEJ STRONIE KWADRATU */}
                          {hasDispo && (
                            <span
                              className={`px-1 py-0.5 rounded text-[10px] font-black border leading-none shrink-0 tracking-tight uppercase shadow-2xs transition-transform hover:scale-110 ${
                                disposition === 'M'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : disposition === 'Z'
                                  ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                  : disposition === 'FULL'
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : 'bg-stone-200 text-stone-800 border-stone-300'
                              }`}
                              title={`Zgłoszona dyspozycyjność pracownika: ${disposition}`}
                            >
                              {disposition}
                            </span>
                          )}

                          {/* GŁÓWNY KWADRAT ZMIANY */}
                          <div className="relative inline-block shrink-0">
                            <span className={`inline-flex items-center justify-center w-8 h-7 text-xs rounded-lg border transition-transform hover:scale-105 active:scale-95 ${badgeClass} ${
                              hasDayViolation ? 'ring-2 ring-rose-500 ring-offset-1 border-rose-400' : ''
                            } ${rcpConflict ? 'ring-2 ring-amber-500 ring-offset-1 border-amber-500 shadow-xs' : ''}`}>
                              {shiftCode}
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
              <td className="sticky left-0 z-20 px-3 py-2 font-bold text-amber-950 bg-amber-100 border-r-2 border-amber-300 w-[408px] min-w-[408px] max-w-[408px]" colSpan={3}>
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
              <td className="sticky left-0 z-20 px-3 py-2 bg-[#1E3932] border-r-2 border-emerald-700 text-emerald-300 font-bold w-[408px] min-w-[408px] max-w-[408px]" colSpan={3}>
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
            currentDisposition={activePicker.currentDisposition}
            shiftDefinitions={data.shiftDefinitions}
            onSelectDisposition={async (newDispo) => {
              if (onUpdateDisposition) {
                await onUpdateDisposition(activePicker.empId, activePicker.day, newDispo);
                setActivePicker(prev => prev ? { ...prev, currentDisposition: newDispo } : null);
              }
            }}
            onSelectShift={async (newCode) => {
              // Pre-flight walidacja Kodeksu Pracy przed zatwierdzeniem zmiany
              const testResult = ManagerScheduleEngine.testShiftCompliance(
                data.year,
                data.month,
                activePicker.empId,
                activePicker.day,
                newCode,
                data.rows,
                data.shiftDefinitions,
                boundaryShifts
              );

              if (!testResult.isValid && testResult.primaryViolation) {
                // Zamykamy popover i wyświetlamy dialog ostrzegawczy z powodem naruszenia KP
                setViolationPrompt({
                  empId: activePicker.empId,
                  empName: activePicker.empName,
                  day: activePicker.day,
                  dayName: daySummary?.dayName,
                  attemptedCode: newCode,
                  violation: testResult.primaryViolation
                });
                setActivePicker(null);
                return;
              }

              // Zmiana zgodna z Kodeksem Pracy — zapisujemy natychmiast
              await onUpdateShift(activePicker.empId, activePicker.day, newCode);
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
          violation={violationPrompt.violation}
          onCancel={() => setViolationPrompt(null)}
          onForceAssign={async () => {
            await onUpdateShift(violationPrompt.empId, violationPrompt.day, violationPrompt.attemptedCode);
            setViolationPrompt(null);
          }}
        />
      )}
    </div>
  );
};
