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
import { ManagerTeamModal } from './ManagerTeamModal';
import { LaborLawComplianceModal } from './LaborLawComplianceModal';
import { ShiftConfigModal } from './ShiftConfigModal';
import { ScheduleVersionModal } from './ScheduleVersionModal';
import { MonthNormEditModal } from './MonthNormEditModal';
import { TorView } from './TorView';
import { ManagerDispositionsModal } from './ManagerDispositionsModal';
import { RcpAbsenceConflictDialog } from './RcpAbsenceConflictDialog';
import {
  Calendar,
  Users,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  UserPlus,
  ShieldCheck,
  AlertCircle,
  ShieldAlert,
  Scale,
  Sliders,
  History,
  Edit3,
  ShoppingBag,
  Info,
  CalendarCheck,
  Lock,
  AlertTriangle
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
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [showShiftConfigModal, setShowShiftConfigModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showNormModal, setShowNormModal] = useState(false);
  const [showDispositionsModal, setShowDispositionsModal] = useState(false);
  const [showRcpConflictModal, setShowRcpConflictModal] = useState(false);

  // Załadowanie danych z bazy SQLite
  const loadScheduleData = useCallback(async () => {
    try {
      setIsLoading(true);
      if ((window as any).api?.getManagerScheduleData) {
        const res = await (window as any).api.getManagerScheduleData(selectedYear, selectedMonth);

        const employees: ManagerEmployee[] = res.employees || [];
        const shiftDefinitions: ShiftDefinition[] = res.shiftDefinitions || [];
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

  // Zapis / nadpisanie normy miesięcznej
  const handleSaveNorm = async (normPayload: any) => {
    if (isClosed) return;
    if ((window as any).api?.saveMonthlyNorm) {
      await (window as any).api.saveMonthlyNorm(normPayload);
      await loadScheduleData();
    }
  };

  // Przywrócenie domyślnej normy Kodeksu Pracy
  const handleResetNorm = async () => {
    if (isClosed) return;
    if ((window as any).api?.resetMonthlyNorm) {
      await (window as any).api.resetMonthlyNorm(selectedYear, selectedMonth);
      await loadScheduleData();
    }
  };

  // Aktualizacja pojedynczej zmiany
  const handleUpdateShift = async (empId: number, day: number, shiftCode: string) => {
    if (isClosed || !scheduleData) return;

    // Znajdź pracownika i wymiar etatu
    const employee = scheduleData.employees.find(e => e.id === empId);
    const empRatio = employee?.contract_hours_ratio || 1.0;

    // Znajdź definicję zmiany dla godzin
    const shiftDef = scheduleData.shiftDefinitions.find(s => s.code === shiftCode);
    let hours = shiftDef ? shiftDef.hours : (shiftCode === 'OFF' ? 0.0 : 8.0);
    
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
      hours
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

  // Zapis zmian w zespole
  const handleSaveTeam = async (employees: ManagerEmployee[]) => {
    if ((window as any).api?.manageEmployees) {
      await (window as any).api.manageEmployees(employees);
      await loadScheduleData();
    }
  };

  // Zapis zmian w katalogu zmian Starbucks
  const handleSaveShiftDefinitions = async (shifts: ShiftDefinition[]) => {
    if ((window as any).api?.saveShiftDefinitions) {
      await (window as any).api.saveShiftDefinitions(shifts);
      await loadScheduleData();
    }
  };

  // Usunięcie definicji zmiany
  const handleDeleteShiftDefinition = async (code: string) => {
    if ((window as any).api?.deleteShiftDefinition) {
      await (window as any).api.deleteShiftDefinition(code);
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

  // Weryfikacja braków obsady
  const coverageGapsCount = scheduleData?.daySummaries.filter(
    d => !d.hasOpeningCoverage || !d.hasClosingCoverage
  ).length || 0;

  // Status publikacji grafiku (reguła 7 dni art. 129 § 3 KP)
  const publicationStatus = ManagerScheduleEngine.getPublicationStatus(selectedYear, selectedMonth);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* GŁÓWNY PASEK KONTROLNY & SELEKTOR MIESIĄCA */}
      <div className="bg-white rounded-2xl p-5 border border-[#E2E8E5] shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Lewa strona: Wybór okresu */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-[#006241]">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
              Planowanie Grafiku Managerskiego
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <button
                onClick={handlePrevMonth}
                className="p-1 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                title="Poprzedni miesiąc"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="font-black text-lg text-[#1E3932] bg-transparent border-none focus:outline-hidden cursor-pointer hover:text-[#006241] transition-colors"
              >
                {POLISH_MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="font-bold text-base text-stone-600 bg-transparent border-none focus:outline-hidden cursor-pointer hover:text-[#006241] transition-colors"
              >
                {Array.from({ length: 16 }, (_, i) => 2021 + i).map(yr => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              <button
                onClick={handleNextMonth}
                className="p-1 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                title="Następny miesiąc"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {isClosed && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-100/90 text-amber-950 border border-amber-300 text-xs font-bold shadow-2xs ml-1">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Miesiąc zamknięty (Tylko do odczytu)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Środek: Przełącznik Widoków (Grafik Miesięczny vs TOR) */}
        <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-white text-[#006241] shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#006241]" />
            <span>Grafik Miesięczny</span>
          </button>
          <button
            onClick={() => setActiveTab('tor')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'tor'
                ? 'bg-white text-[#006241] shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-[#CBA258]" />
            <span>TOR (Okres Rozliczeniowy)</span>
          </button>
        </div>

        {/* Prawa strona: Przyciski akcji */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowVersionModal(true)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all ${
              publicationStatus.isPublished
                ? 'border-amber-300 hover:border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100'
                : 'border-[#E2E8E5] hover:border-[#006241] text-stone-700 hover:text-[#006241] bg-white hover:bg-stone-50'
            }`}
            title="Historia wersji i rejestr publikacji grafiku na 7 dni przed wejściem w życie"
          >
            <History className={`w-4 h-4 ${publicationStatus.isPublished ? 'text-amber-700' : 'text-[#006241]'}`} />
            <span>{publicationStatus.isPublished ? 'Opublikowany (Wersje)' : 'Historia Wersji'}</span>
          </button>

          <button
            onClick={() => setShowDispositionsModal(true)}
            className="px-3.5 py-2 rounded-xl border border-amber-300 hover:border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Otwórz zbiorczą matrycę dyspozycyjności menedżerów na dany miesiąc i wklejaj dane z Excela"
          >
            <CalendarCheck className="w-4 h-4 text-amber-700" />
            <span>Matryca Dyspozycji</span>
          </button>

          <button
            onClick={() => setShowShiftConfigModal(true)}
            className="px-3.5 py-2 rounded-xl border border-[#E2E8E5] hover:border-[#006241] text-stone-700 hover:text-[#006241] bg-white hover:bg-stone-50 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
            title="Konfiguruj katalog zmian Starbucks i reguły niedzielne"
          >
            <Sliders className="w-4 h-4 text-[#006241]" />
            <span>Katalog Zmian</span>
          </button>

          <button
            onClick={() => setShowTeamModal(true)}
            className="px-3.5 py-2 rounded-xl border border-[#E2E8E5] hover:border-[#006241] text-stone-700 hover:text-[#006241] bg-white hover:bg-stone-50 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
            title="Zarządzaj zespołem kierowniczym kawiarni"
          >
            <UserPlus className="w-4 h-4 text-[#006241]" />
            <span>Zespół Menedżerski</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl border border-emerald-300 hover:border-emerald-400 text-emerald-900 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
            title="Eksportuj grafik do formatu Microsoft Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#006241]" />
            <span>Eksportuj (.xlsx)</span>
          </button>

          <button
            onClick={loadScheduleData}
            className="p-2 rounded-xl border border-[#E2E8E5] text-stone-500 hover:text-stone-900 hover:bg-stone-50 shadow-2xs transition-colors"
            title="Przeładuj grafik"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* WIDOK TOR vs GRAFIK MIESIĘCZNY */}
      {activeTab === 'tor' ? (
        <TorView currentYear={selectedYear} currentMonth={selectedMonth} />
      ) : (
        <>
          {/* KARTY METRYK I KPI */}
          {scheduleData && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {/* Karta 1: Norma Miesiąca (Klikalna z możliwością edycji lub zablokowana) */}
              <div 
                onClick={isClosed ? undefined : () => setShowNormModal(true)}
                className={`bg-white p-4 rounded-2xl border border-[#E2E8E5] shadow-xs transition-all relative overflow-hidden ${
                  isClosed
                    ? 'cursor-default'
                    : 'hover:border-[#006241] hover:shadow-md cursor-pointer group'
                }`}
                title={
                  isClosed
                    ? 'Miesiąc zamknięty — edycja normy zablokowana'
                    : 'Kliknij, aby edytować normę godzinową lub dni robocze dla tego miesiąca'
                }
              >
                <div className="flex items-center justify-between text-stone-500 mb-1">
                  <span className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                    isClosed ? '' : 'group-hover:text-[#006241] transition-colors'
                  }`}>
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
                  {isClosed ? (
                    <div className="p-1 rounded-lg bg-stone-100 text-stone-400" title="Zablokowane">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="p-1 rounded-lg bg-stone-100 group-hover:bg-emerald-50 text-stone-500 group-hover:text-[#006241] transition-colors">
                      <Edit3 className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                <div className={`text-xl font-black text-stone-900 ${
                  isClosed ? '' : 'group-hover:text-[#006241] transition-colors'
                }`}>
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

          {/* BANER KALENDARZA DNI WOLNYCH I NIEDZIEL HANDLOWYCH */}
          {scheduleData && (
            <div className="bg-white rounded-2xl p-3.5 border border-[#E2E8E5] shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 font-bold text-stone-800">
                  <Calendar className="w-4 h-4 text-[#006241]" />
                  <span>Kalendarz miesiąca:</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-semibold text-[11px]">
                    {scheduleData.workingDays} dni roboczych
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-semibold text-[11px] border border-amber-200">
                    {scheduleData.offDaysNorm} dni wolnych (weekendy + święta)
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
                          title="Niedziela handlowa — centra handlowe i kawiarnia otwarte"
                        >
                          🛒 {tradingDay}.{String(scheduleData.month).padStart(2, '0')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-stone-400 italic">
                      Brak w tym miesiącu (wszystkie niedziele wolne)
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

              {/* Informacja o etacie dla H i L4 */}
              <div className="flex items-center gap-1.5 text-stone-500 text-[11px] bg-stone-50 px-2.5 py-1 rounded-xl border border-stone-200">
                <Info className="w-3.5 h-3.5 text-[#006241] shrink-0" />
                <span>
                  Urlop (H) i L4: <strong>8h × etat</strong> w dni robocze. W weekendy i święta: <strong>0h</strong>.
                </span>
              </div>
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

          {/* LEGENDA ZMIAN STARBUCKS I DYSPOZYCYJNOŚCI */}
          <div className="bg-[#F7F9F8] rounded-2xl p-4 border border-[#E2E8E5] text-xs text-stone-600 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-stone-700">Zmiany:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center font-bold text-[11px]">AM</span>
                <span>Opening (8h)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center font-bold text-[11px]">PM</span>
                <span>Closing (8h)</span>
              </div>
              <div className="flex items-center gap-1.5" title="Wsparcie w innej kawiarni — wlicza się do etatu, nie wlicza się do obsady Janki">
                <span className="w-6 h-5 rounded-md bg-green-100 text-green-800 border border-green-300 flex items-center justify-center font-bold text-[11px]">SAM</span>
                <span>Support AM (inna kawiarnia)</span>
              </div>
              <div className="flex items-center gap-1.5" title="Wsparcie w innej kawiarni — wlicza się do etatu, nie wlicza się do obsady Janki">
                <span className="w-6 h-5 rounded-md bg-yellow-100 text-yellow-800 border border-yellow-300 flex items-center justify-center font-bold text-[11px]">SPM</span>
                <span>Support PM (inna kawiarnia)</span>
              </div>
              <div className="flex items-center gap-1.5" title="Wsparcie w innej kawiarni — wlicza się do etatu, nie wlicza się do obsady Janki">
                <span className="w-6 h-5 rounded-md bg-lime-100 text-lime-800 border border-lime-300 flex items-center justify-center font-bold text-[11px]">SUP</span>
                <span>Support (inna kawiarnia)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-5 rounded-md bg-purple-100 text-purple-900 border border-purple-300 flex items-center justify-center font-bold text-[11px]">NC</span>
                <span>Non-Coverage (8h)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-5 rounded-md bg-sky-200 text-sky-900 border border-sky-400 flex items-center justify-center font-bold text-[11px]">H</span>
                <span>Urlop</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 flex items-center justify-center font-bold text-[11px]">L4</span>
                <span>Chorobowe (w etacie)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-6 h-5 rounded-md bg-stone-100 text-stone-600 border border-stone-300 flex items-center justify-center font-bold text-[11px]">OFF</span>
                <span>Wolne</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t sm:border-t-0 sm:border-l border-stone-300 pt-2 sm:pt-0 sm:pl-3">
              <span className="font-bold text-stone-700">Dyspozycja (po lewej):</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">M</span>
              <span className="text-[11px] text-stone-500">Rano</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300">Z</span>
              <span className="text-[11px] text-stone-500">Wieczór</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300">FULL</span>
              <span className="text-[11px] text-stone-500">Pełna</span>
            </div>
          </div>
        </>
      )}

      {/* MODAL ZARZĄDZANIA ZESPOŁEM */}
      {showTeamModal && scheduleData && (
        <ManagerTeamModal
          employees={scheduleData.employees}
          onSave={handleSaveTeam}
          onClose={() => setShowTeamModal(false)}
        />
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

      {/* MODAL KONFIGURACJI ZMIAN STARBUCKS */}
      {showShiftConfigModal && scheduleData && (
        <ShiftConfigModal
          shifts={scheduleData.shiftDefinitions}
          onSave={handleSaveShiftDefinitions}
          onDelete={handleDeleteShiftDefinition}
          onClose={() => setShowShiftConfigModal(false)}
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

      {/* MODAL EDYCJI NORMY MIESIĄCA (KODEKS PRACY) */}
      {showNormModal && scheduleData && (
        <MonthNormEditModal
          isOpen={showNormModal}
          onClose={() => setShowNormModal(false)}
          year={selectedYear}
          month={selectedMonth}
          monthName={scheduleData.monthName}
          currentNormRecord={monthlyNormRecord}
          onSaveNorm={handleSaveNorm}
          onResetNorm={handleResetNorm}
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
    </div>
  );
};
