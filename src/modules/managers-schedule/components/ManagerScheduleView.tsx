import React, { useState, useEffect, useCallback } from 'react';
import {
  ManagerEmployee,
  ShiftDefinition,
  ManagerScheduleShift,
  ManagerScheduleMonthData,
  MonthlyNormRecord
} from '../../../types';
import {
  ManagerScheduleEngine,
  POLISH_MONTH_NAMES
} from '../services/managerScheduleEngine';
import { ManagerExcelExport } from '../services/managerExcelExport';
import { ManagerScheduleGrid } from './ManagerScheduleGrid';
import { LaborLawComplianceModal } from './LaborLawComplianceModal';
import { ScheduleVersionModal } from './ScheduleVersionModal';
import { TorView } from './TorView';
import { ManagerDispositionsModal } from './ManagerDispositionsModal';
import { RcpAbsenceConflictDialog } from './RcpAbsenceConflictDialog';
import { AutoScheduleModal } from './AutoScheduleModal';
import { AutoScheduleWidget } from './AutoScheduleWidget';
import { InterStoreSupportModal } from './InterStoreSupportModal';
import { AutoScheduleResult } from '../services/autoSchedulerEngine';
import { DEFAULT_SHIFT_DEFINITIONS } from '../constants/defaultShifts';
import { SystemClock } from '../../../services/systemClock';
import {
  Calendar,
  Users,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  ShieldAlert,
  Scale,
  History,
  Edit3,
  ShoppingBag,
  CalendarCheck,
  Lock,
  AlertTriangle,
  Sparkles
} from 'lucide-react';

interface ManagerScheduleViewProps {
  currentYear?: number;
  currentMonthName?: string;
}

export const ManagerScheduleView: React.FC<ManagerScheduleViewProps> = ({
  currentYear = 2026,
  currentMonthName = 'Wrzesień'
}) => {
  // Parsowanie miesiąca na liczbę 1..12
  const getMonthNumber = (name: string): number => {
    const idx = POLISH_MONTH_NAMES.indexOf(name);
    return idx >= 0 ? idx + 1 : 9;
  };

  const [activeTab, setActiveTab] = useState<'schedule' | 'tor'>('schedule');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonthNumber(currentMonthName));

  const [isLoading, setIsLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState<ManagerScheduleMonthData | null>(null);
  const [monthlyNormRecord, setMonthlyNormRecord] = useState<MonthlyNormRecord | null>(null);
  const [boundaryShifts, setBoundaryShifts] = useState<{
    prevMonthShifts?: ManagerScheduleShift[];
    nextMonthShifts?: ManagerScheduleShift[];
  } | undefined>();
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showDispositionsModal, setShowDispositionsModal] = useState(false);
  const [showRcpConflictModal, setShowRcpConflictModal] = useState(false);
  const [showAutoScheduleModal, setShowAutoScheduleModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [autoScheduleProposal, setAutoScheduleProposal] = useState<AutoScheduleResult | null>(null);

  // Załadowanie danych z bazy SQLite
  const loadScheduleData = useCallback(async () => {
    try {
      setIsLoading(true);
      if ((window as any).api?.getManagerScheduleData) {
        const res = await (window as any).api.getManagerScheduleData(selectedYear, selectedMonth);

        const employees: ManagerEmployee[] = res.employees || [];
        const shiftDefinitions: ShiftDefinition[] =
          res.shiftDefinitions && res.shiftDefinitions.length > 0
            ? res.shiftDefinitions
            : DEFAULT_SHIFT_DEFINITIONS;
        const shifts: ManagerScheduleShift[] = res.shifts || [];
        const events: { day: number; event_text: string }[] = res.events || [];
        const normRecord: MonthlyNormRecord | null = res.monthlyNorm || null;

        setMonthlyNormRecord(normRecord);
        setBoundaryShifts(res.boundaryShifts);

        const calculated = ManagerScheduleEngine.calculateMonthData(
          selectedYear,
          selectedMonth,
          employees,
          shiftDefinitions,
          shifts,
          events,
          normRecord,
          res.boundaryShifts,
          res.rcpLogs,
          res.hasCompleteRcpLogs
        );

        setScheduleData(calculated);
      }
    } catch (error) {
      console.error('Błąd ładowania grafiku managerskiego:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadScheduleData();
  }, [loadScheduleData]);

  // Weryfikacja czy przeglądany miesiąc jest zamknięty (przeszły względem czasu rzeczywistego)
  const isClosed = Boolean(
    scheduleData?.isMonthClosed ?? ManagerScheduleEngine.isMonthClosed(selectedYear, selectedMonth)
  );



  // Aktualizacja pojedynczej zmiany
  const handleUpdateShift = async (
    empId: number,
    day: number,
    shiftCode: string,
    customHours?: number,
    customStartTime?: string,
    customEndTime?: string
  ) => {
    if (isClosed || !scheduleData) return;

    // Znajdź pracownika i wymiar etatu
    const employee = scheduleData.employees.find(e => e.id === empId);
    const empRatio = employee?.contract_hours_ratio || 1.0;

    // Znajdź definicję zmiany dla godzin
    const shiftDef = scheduleData.shiftDefinitions.find(s => s.code === shiftCode);
    let hours = customHours !== undefined ? customHours : (shiftDef ? shiftDef.hours : (shiftCode === 'OFF' ? 0.0 : 8.0));
    
    // L4 i H wliczają się do etatu w wymiarze dobowym etatu pracownika,
    // ALE w weekendy i święta państwowe urlop H oraz L4 nie liczą się do godzin etatu (0.0h)
    if (shiftCode === 'L4' || shiftCode === 'H') {
      const daySummary = scheduleData.daySummaries.find(d => d.day === day);
      const isNonWorking = daySummary?.isNonWorkingDay ?? (daySummary?.isWeekend || daySummary?.isHoliday);
      hours = isNonWorking ? 0.0 : Number((8.0 * empRatio).toFixed(1));
    }

    // Ostrzeżenie o kolizji, jeżeli pracownik ma zalogowane godziny RCP w systemie MAPAL
    if ((shiftCode === 'L4' || shiftCode === 'H') && scheduleData?.rcpLogs?.[empId]?.[day]?.hours) {
      const logged = scheduleData.rcpLogs[empId][day];
      if (logged.hours > 0) {
        const emp = scheduleData.employees.find(e => e.id === empId);
        const proceed = window.confirm(
          `⚠️ OSTRZEŻENIE O KOLIZJI RCP:\n\n` +
          `Pracownik ${emp?.name || 'Menedżer'} posiada zarejestrowane ${logged.hours}h pracy w systemie MAPAL ` +
          `w dniu ${day}.${String(selectedMonth).padStart(2, '0')}.${selectedYear} ` +
          `(Lokal: ${logged.unitName || logged.unitCode || 'Starbucks'}).\n\n` +
          `Czy na pewno chcesz przypisać kod absencji "${shiftCode}"? Zostanie wygenerowany alert kolizji RCP vs Absencja.`
        );
        if (!proceed) {
          return;
        }
      }
    }

    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const shiftPayload = {
      year: selectedYear,
      month: selectedMonth,
      day,
      date: dateStr,
      employee_id: empId,
      shift_code: shiftCode,
      hours,
      custom_start_time: customStartTime || null,
      custom_end_time: customEndTime || null
    };

    if ((window as any).api?.saveManagerShift) {
      await (window as any).api.saveManagerShift(shiftPayload);
      await loadScheduleData();
    }
  };

  // Aktualizacja deklarowanej dyspozycyjności menedżera
  const handleUpdateDisposition = async (empId: number, day: number, disposition: string) => {
    if (isClosed) return;
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dispoPayload = {
      year: selectedYear,
      month: selectedMonth,
      day,
      date: dateStr,
      employee_id: empId,
      disposition
    };

    if ((window as any).api?.saveManagerDisposition) {
      await (window as any).api.saveManagerDisposition(dispoPayload);
      await loadScheduleData();
    }
  };

  // Zbiorczy zapis dyspozycji z matrycy / Excela
  const handleSaveBatchDispositions = async (items: Array<{ day: number; employee_id: number; disposition: string }>) => {
    if (isClosed) return;
    if ((window as any).api?.saveBatchManagerDispositions) {
      await (window as any).api.saveBatchManagerDispositions({
        year: selectedYear,
        month: selectedMonth,
        items
      });
      await loadScheduleData();
    }
  };

  // Zastosowanie wygenerowanego grafiku AutoScheduling
  const handleApplyAutoSchedule = async (generatedShifts: ManagerScheduleShift[]) => {
    if (isClosed) return;
    if ((window as any).api?.saveBatchManagerShifts) {
      await (window as any).api.saveBatchManagerShifts({
        year: selectedYear,
        month: selectedMonth,
        shifts: generatedShifts
      });
    } else if ((window as any).api?.saveManagerShift) {
      // Fallback: zapis w pętli
      for (const s of generatedShifts) {
        await (window as any).api.saveManagerShift(s);
      }
    }
    await loadScheduleData();
  };

  // Zastosowanie wybranego wariantu wsparcia międzykawiarnianego
  const handleApplySupportShifts = async (shiftsToUpdate: ManagerScheduleShift[], successMessage: string) => {
    if (isClosed || !scheduleData) return;
    try {
      if ((window as any).api?.saveBatchManagerShifts) {
        await (window as any).api.saveBatchManagerShifts({
          year: selectedYear,
          month: selectedMonth,
          shifts: shiftsToUpdate
        });
      } else if ((window as any).api?.saveManagerShift) {
        for (const s of shiftsToUpdate) {
          await (window as any).api.saveManagerShift(s);
        }
      }
      await loadScheduleData();
      alert(`✅ Zastosowano zmiany wsparcia w grafiku!\n${successMessage}`);
    } catch (error) {
      console.error('Błąd zapisu zmian wsparcia międzykawiarnianego:', error);
      alert('❌ Wystąpił błąd podczas zapisywania zmian wsparcia w bazie danych.');
    }
  };

  // Aktualizacja notatki / wydarzenia dziennego
  const handleUpdateEvent = async (day: number, text: string) => {
    if (isClosed) return;
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const eventPayload = {
      year: selectedYear,
      month: selectedMonth,
      day,
      date: dateStr,
      event_text: text
    };

    if ((window as any).api?.saveManagerEvent) {
      await (window as any).api.saveManagerEvent(eventPayload);
      await loadScheduleData();
    }
  };



  // Eksport do Excel
  const handleExportExcel = () => {
    if (!scheduleData) return;
    ManagerExcelExport.exportToExcel(scheduleData);
  };

  // Nawigacja miesiącami
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(y => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear(y => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const handleCurrentMonth = () => {
    const now = SystemClock.now();
    setSelectedYear(now.year);
    setSelectedMonth(now.monthIndex + 1);
  };

  // Weryfikacja braków obsady
  const coverageGapsCount = scheduleData?.daySummaries.filter(
    d => !d.hasOpeningCoverage || !d.hasClosingCoverage
  ).length || 0;

  // Status publikacji grafiku (reguła 7 dni art. 129 § 3 KP)
  const publicationStatus = ManagerScheduleEngine.getPublicationStatus(selectedYear, selectedMonth);

  return (
    <div className="space-y-4 animate-fade-in w-full">
      {/* WIDOK TOR vs GRAFIK MIESIĘCZNY (BEZ ZBĘDNYCH PASKÓW GÓRNYCH) */}
      {activeTab === 'tor' ? (
        <TorView currentYear={selectedYear} currentMonth={selectedMonth} />
      ) : (
        <>
          {/* BANER KALENDARZA MIESIĄCA (DNI ROBOCZE, WOLNE, ŚWIĘTA, NIEDZIELE HANDLOWE) */}
          {scheduleData && (
            <div className="bg-white rounded-2xl p-3.5 border border-[#E2E8E5] shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 font-bold text-stone-800">
                  <Calendar className="w-4 h-4 text-[#006241]" />
                  <span>Kalendarz miesiąca:</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-md bg-stone-100 text-stone-800 font-bold text-[11px] border border-stone-200">
                    {scheduleData.workingDays} dni roboczych
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 font-bold text-[11px] border border-amber-200">
                    {scheduleData.offDaysNorm} dni wolnych
                  </span>
                </div>

                {/* Niedziele Handlowe */}
                <div className="flex items-center gap-1.5 pl-2 border-l border-stone-200">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="font-semibold text-stone-700">Niedziele Handlowe:</span>
                  {(scheduleData.tradingSundaysList && scheduleData.tradingSundaysList.length > 0) ? (
                    <div className="flex items-center gap-1">
                      {scheduleData.tradingSundaysList.map(tradingDay => (
                        <span
                          key={`ts-${tradingDay}`}
                          className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-black text-[11px] border border-emerald-300 shadow-2xs"
                          title="Niedziela handlowa — kawiarnia i CH otwarte"
                        >
                          🛒 {tradingDay}.{String(scheduleData.month).padStart(2, '0')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-stone-400 italic">
                      Brak w tym miesiącu
                    </span>
                  )}
                </div>

                {/* Święta państwowe */}
                {Boolean(scheduleData.holidaysList && scheduleData.holidaysList.length > 0) && (
                  <div className="flex items-center gap-1.5 pl-2 border-l border-stone-200">
                    <span className="font-semibold text-rose-900 flex items-center gap-1">
                      <span>🇵🇱 Święta:</span>
                    </span>
                    <div className="flex items-center gap-1">
                      {scheduleData.holidaysList!.map(item => (
                        <span
                          key={`hol-${item.day}`}
                          className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 font-bold text-[11px] border border-rose-300"
                          title={`Ustawowo wolny od pracy: ${item.name}`}
                        >
                          {item.day}.{String(scheduleData.month).padStart(2, '0')} {item.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BANER KONFLIKTÓW RCP VS L4 / H (MAPAL VS GRAFIK) */}
          {scheduleData && scheduleData.rcpConflicts && scheduleData.rcpConflicts.length > 0 && (
            <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-amber-950">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0 animate-bounce">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-black flex items-center gap-2">
                    <span>Wykryto {scheduleData.rcpConflicts.length} {scheduleData.rcpConflicts.length === 1 ? 'kolizję' : 'kolizje'} RCP z zaplanowaną absencją (L4 / Urlop H)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-black tracking-wide uppercase border border-amber-300">
                      MAPAL vs Grafik
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                    W systemie MAPAL zarejestrowano godziny pracy menedżera w dniu, w którym zaplanowano zwolnienie lekarskie lub urlop. Może to oznaczać błąd w grafiku lub faktyczne logowanie pracownika w czasie absencji.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRcpConflictModal(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs hover:shadow flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Pokaż szczegóły kolizji ({scheduleData.rcpConflicts.length})</span>
              </button>
            </div>
          )}

          {/* GŁÓWNA SIATKA GRAFIKU */}
          {scheduleData && (
            <ManagerScheduleGrid
              data={scheduleData}
              onUpdateShift={handleUpdateShift}
              onUpdateDisposition={handleUpdateDisposition}
              onUpdateEvent={handleUpdateEvent}
              onOpenComplianceModal={() => setShowComplianceModal(true)}
              onOpenConflictModal={() => setShowRcpConflictModal(true)}
              boundaryShifts={boundaryShifts}
              isReadOnly={isClosed}
            />
          )}

          {/* KARTY METRYK I KPI (WIDŻETY NA DOLE) */}
          {scheduleData && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 pt-1">
              {/* Karta 1: Norma Miesiąca */}
              <div className="bg-white p-4 rounded-2xl border border-[#E2E8E5] shadow-xs">
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <span>Norma Miesiąca</span>
                    {scheduleData.isCustomNorm ? (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-sm bg-amber-200 text-amber-900 border border-amber-300" title="Norma została ręcznie zmodyfikowana">
                        Korekta
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-stone-400">
                        KP
                      </span>
                    )}
                  </span>
                  <Scale className="w-4 h-4 text-[#006241]" />
                </div>
                <div className="text-xl font-black text-stone-900">
                  {scheduleData.fullTimeNominalHours} h
                </div>
                <div className="text-[11px] text-stone-400 mt-1">
                  {scheduleData.workingDays} dni rob. • {scheduleData.offDaysNorm} dni OFF
                </div>
              </div>

              {/* Karta 2: Godziny Zespołu */}
              <div className="bg-white p-4 rounded-2xl border border-[#E2E8E5] shadow-xs">
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Godziny Zespołu</span>
                  <Clock className="w-4 h-4 text-[#006241]" />
                </div>
                <div className="text-xl font-black text-stone-900">
                  {scheduleData.totalTeamHours} h
                </div>
                <div className="text-[11px] text-stone-400 mt-1">
                  {scheduleData.employees.length} menedżerów
                </div>
              </div>

              {/* Karta 3: Średnie Pokrycie */}
              <div className="bg-white p-4 rounded-2xl border border-[#E2E8E5] shadow-xs">
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Średnie Pokrycie</span>
                  <TrendingUp className="w-4 h-4 text-[#006241]" />
                </div>
                <div className="text-xl font-black text-stone-900">
                  {scheduleData.averageCoveragePercent}%
                </div>
                <div className="text-[11px] text-stone-400 mt-1">
                  Realizacja norm etatów
                </div>
              </div>

              {/* Karta 4: Dni Wolne (Norma) */}
              <div className="bg-white p-4 rounded-2xl border border-[#E2E8E5] shadow-xs">
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Min. Dni Wolnych</span>
                  <Users className="w-4 h-4 text-stone-500" />
                </div>
                <div className="text-xl font-black text-stone-900">
                  {scheduleData.offDaysNorm} dni
                </div>
                <div className="text-[11px] text-stone-400 mt-1">
                  Norma kodeksowa
                </div>
              </div>

              {/* Karta 5: Pokrycie Zmian Kluczowych */}
              <div className={`p-4 rounded-2xl border shadow-xs ${
                coverageGapsCount === 0
                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Obsada AM/PM</span>
                  {coverageGapsCount === 0 ? (
                    <ShieldCheck className="w-4 h-4 text-[#006241]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                </div>
                <div className="text-xl font-black">
                  {coverageGapsCount === 0 ? '100% Pokrycia' : `${coverageGapsCount} dni z luką`}
                </div>
                <div className="text-[11px] mt-1 opacity-80">
                  {coverageGapsCount === 0 ? 'Otwarcie i zamknięcie' : 'Wymaga uzupełnienia!'}
                </div>
              </div>

              {/* Karta 6: Tarcza Kodeksu Pracy (Interaktywna) */}
              <div
                onClick={() => setShowComplianceModal(true)}
                className={`p-4 rounded-2xl border shadow-xs cursor-pointer transition-all hover:scale-[1.02] ${
                  scheduleData.totalViolationsCount > 0
                    ? 'bg-rose-50 border-rose-300 text-rose-900 hover:border-rose-400'
                    : 'bg-emerald-50/60 border-emerald-300 text-emerald-900 hover:border-emerald-400'
                }`}
                title="Kliknij, aby otworzyć Tarczę Kodeksu Pracy i sprawdzić 4 normy prawne"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider">Kodeks Pracy</span>
                  {scheduleData.totalViolationsCount > 0 ? (
                    <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-[#006241]" />
                  )}
                </div>
                <div className="text-xl font-black flex items-center gap-1.5">
                  {scheduleData.totalViolationsCount === 0 ? (
                    '100% Zgodny'
                  ) : (
                    <span className="text-rose-700">
                      {scheduleData.totalViolationsCount} {scheduleData.totalViolationsCount === 1 ? 'alert' : 'alerty'} KP
                    </span>
                  )}
                </div>
                <div className="text-[11px] mt-1 opacity-80 flex items-center justify-between">
                  <span>{scheduleData.totalViolationsCount === 0 ? '4 normy spełnione' : 'Kliknij szczegóły ➔'}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL WERYFIKACJI NORM KODEKSU PRACY */}
      {showComplianceModal && scheduleData && (
        <LaborLawComplianceModal
          isOpen={showComplianceModal}
          onClose={() => setShowComplianceModal(false)}
          violations={scheduleData.violations}
          employees={scheduleData.employees}
          monthName={scheduleData.monthName}
          year={scheduleData.year}
        />
      )}

      {/* MODAL HISTORII WERSJI I PUBLIKACJI (ART. 129 § 3 KP) */}
      {showVersionModal && scheduleData && (
        <ScheduleVersionModal
          isOpen={showVersionModal}
          onClose={() => setShowVersionModal(false)}
          year={selectedYear}
          month={selectedMonth}
          monthName={scheduleData.monthName}
          onVersionRestored={loadScheduleData}
        />
      )}

      {/* MODAL ZBIORCZEJ MATRYCY DYSPOZYCJI I IMPORTU Z EXCELA */}
      {showDispositionsModal && scheduleData && (
        <ManagerDispositionsModal
          isOpen={showDispositionsModal}
          onClose={() => setShowDispositionsModal(false)}
          data={scheduleData}
          onSaveBatch={handleSaveBatchDispositions}
          isReadOnly={isClosed}
        />
      )}

      {/* MODAL KONFLIKTÓW RCP VS L4 / H (MAPAL VS GRAFIK) */}
      {showRcpConflictModal && scheduleData && (
        <RcpAbsenceConflictDialog
          isOpen={showRcpConflictModal}
          onClose={() => setShowRcpConflictModal(false)}
          conflicts={scheduleData.rcpConflicts || []}
          monthName={scheduleData.monthName}
          year={scheduleData.year}
        />
      )}

      {/* PŁYWAJĄCY STARBUCKS SCHEDULE HUB (PRAWA STRONA EKRANU) */}
      {scheduleData && (
        <AutoScheduleWidget
          data={scheduleData}
          onApplySchedule={handleApplyAutoSchedule}
          prevMonthShifts={boundaryShifts?.prevMonthShifts}
          disabled={isClosed}
          onOpenProposalModal={res => {
            setAutoScheduleProposal(res);
            setShowAutoScheduleModal(true);
          }}
          onOpenDispositionsModal={() => setShowDispositionsModal(true)}
          onOpenSupportModal={() => setShowSupportModal(true)}
          onOpenVersionModal={() => setShowVersionModal(true)}
          onExportExcel={handleExportExcel}
          onToggleTorView={() => setActiveTab(prev => (prev === 'schedule' ? 'tor' : 'schedule'))}
          isTorActive={activeTab === 'tor'}
          isPublished={publicationStatus.isPublished}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onCurrentMonth={handleCurrentMonth}
          onRefresh={loadScheduleData}
        />
      )}

      {/* MODAL AUTOSCHEDULING (PODGLĄD I PROPOZYCJA GRAFIKU) */}
      {showAutoScheduleModal && scheduleData && (
        <AutoScheduleModal
          isOpen={showAutoScheduleModal}
          onClose={() => setShowAutoScheduleModal(false)}
          data={scheduleData}
          onApplySchedule={handleApplyAutoSchedule}
          prevMonthShifts={boundaryShifts?.prevMonthShifts}
          initialResult={autoScheduleProposal}
          onOpenDispositions={() => {
            setShowAutoScheduleModal(false);
            setShowDispositionsModal(true);
          }}
        />
      )}

      {/* MODAL ASYSTENTA WSPARCIA MIĘDZYKAWIARNIANEGO (ODDAWANIE I ZAMIANY ZMIAN) */}
      {showSupportModal && scheduleData && (
        <InterStoreSupportModal
          isOpen={showSupportModal}
          onClose={() => setShowSupportModal(false)}
          data={scheduleData}
          prevMonthShifts={boundaryShifts?.prevMonthShifts}
          onApplySupportShifts={handleApplySupportShifts}
        />
      )}
    </div>
  );
};
