import React, { useState, useEffect } from 'react';
import {
  AppModule,
  AopPlanRecord,
  NcRuleRecord,
  ShiftDefinition,
  ManagerEmployee,
  MonthlyNormRecord
} from '../types';
import { formatManagerRole } from '../modules/managers-schedule/services/managerScheduleEngine';
import {
  X,
  Settings,
  BarChart3,
  CalendarDays,
  GraduationCap,
  Calculator,
  Database,
  Store,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Award,
  Layers,
  Sparkles,
  Sliders,
  DollarSign,
  Briefcase,
  Users,
  Scale,
  ArrowUp,
  ArrowDown,
  Calendar,
  Info,
  Check,
  Bug,
} from 'lucide-react';
import { POLISH_MONTHS, AVAILABLE_YEARS } from './ModuleDateBar';
import { SystemClock } from '../services/systemClock';
import { ManagerScheduleEngine } from '../modules/managers-schedule/services/managerScheduleEngine';
import { DEFAULT_SHIFT_DEFINITIONS } from '../modules/managers-schedule/constants/defaultShifts';
import { APP_VERSION, APP_SHORT_NAME } from '../version';

export type SettingsTabId = 'labor_forecast' | 'managers_schedule' | 'trainings' | 'col_calculator' | 'system';

interface UnifiedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeModule: AppModule;
  selectedYear: number;
  selectedMonth: string;
  onRefreshData?: () => void;
  onOpenBackupModal?: () => void;
  onOpenUpdateModal?: () => void;
  hasUpdateAvailable?: boolean;
  onOpenBugReporter?: () => void;
  onRerunOnboarding?: () => void;
}

const DEFAULT_NC_RULES: NcRuleRecord[] = [
  { id: 'sm_admin', name: 'Administracja Store Managera (SM)', category: 'Zarządzanie', monthly_hours: 20.0, is_mandatory: true },
  { id: 'barista_training', name: 'Szkolenia Baristyczne & Onboarding', category: 'Rozwój', monthly_hours: 12.0, is_mandatory: true },
  { id: 'inventory', name: 'Inwentaryzacja Miesięczna & Audyt', category: 'Operacje', monthly_hours: 6.0, is_mandatory: true },
  { id: 'team_meeting', name: 'Zebranie Załogi Kawiarni', category: 'Zespół', monthly_hours: 4.0, is_mandatory: true },
  { id: 'deep_clean', name: 'Głębokie Czyszczenie Sprzętu (Deep Clean)', category: 'Czystość', monthly_hours: 8.0, is_mandatory: true },
];

export const UnifiedSettingsModal: React.FC<UnifiedSettingsModalProps> = ({
  isOpen,
  onClose,
  activeModule,
  selectedYear,
  selectedMonth,
  onRefreshData,
  onOpenBackupModal,
  onOpenUpdateModal,
  hasUpdateAvailable,
  onOpenBugReporter,
  onRerunOnboarding,
}) => {
  // Mapowanie aktywnego modułu na zakładkę ustawień (dynamiczne pozycjonowanie)
  const getInitialTab = (mod: AppModule): SettingsTabId => {
    switch (mod) {
      case 'labor_forecast':
        return 'labor_forecast';
      case 'managers_schedule':
        return 'managers_schedule';
      case 'trainings':
        return 'trainings';
      case 'col_calculator':
        return 'col_calculator';
      case 'dashboard':
      default:
        return 'system';
    }
  };

  const [activeTab, setActiveTab] = useState<SettingsTabId>(getInitialTab(activeModule));
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Sub-zakładki dla poszczególnych modułów
  const [mgrSubTab, setMgrSubTab] = useState<'shifts' | 'team' | 'norms' | 'law'>('shifts');
  const [laborSubTab, setLaborSubTab] = useState<'aop' | 'nc' | 'floor'>('aop');

  // Synchronizacja przy otwarciu na bazie aktualnie wyświetlanego modułu
  useEffect(() => {
    if (isOpen) {
      setActiveTab(getInitialTab(activeModule));
      setSaveSuccessMsg(null);
    }
  }, [isOpen, activeModule]);

  // Stan: Moduł 1 (AOP & NC)
  const [aopYear, setAopYear] = useState<number>(selectedYear);
  const [aopPlans, setAopPlans] = useState<AopPlanRecord[]>([]);
  const [bulkTplh, setBulkTplh] = useState<string>('6.70');
  const [isAopLoading, setIsAopLoading] = useState(false);
  const [ncRules, setNcRules] = useState<NcRuleRecord[]>(DEFAULT_NC_RULES);

  // Stan: Moduł 2 (Katalog Zmian, Zespół, Normy)
  const [shiftDefs, setShiftDefs] = useState<ShiftDefinition[]>(DEFAULT_SHIFT_DEFINITIONS);
  const [shiftsCategoryFilter, setShiftsCategoryFilter] = useState<string>('ALL');

  const [mgrYear, setMgrYear] = useState<number>(selectedYear);
  const [mgrMonth, setMgrMonth] = useState<number>(() => {
    const idx = POLISH_MONTHS.indexOf(selectedMonth);
    return idx >= 0 ? idx + 1 : 9;
  });
  const [employees, setEmployees] = useState<ManagerEmployee[]>([]);
  const [propagateToFuture, setPropagateToFuture] = useState<boolean>(true);

  // Normy KP
  const [normWorkingDays, setNormWorkingDays] = useState<number>(21);
  const [normOffDays, setNormOffDays] = useState<number>(9);
  const [normFullHours, setNormFullHours] = useState<number>(168);
  const [normNotes, setNormNotes] = useState<string>('');

  // Stan: Moduł 4 (Parametry COL)
  const [zusRate, setZusRate] = useState<number>(19.48);
  const [pfronRate, setPfronRate] = useState<number>(200);
  const [laundryCrewRate, setLaundryCrewRate] = useState<number>(0.85);
  const [smBonusCap, setSmBonusCap] = useState<number>(2250);
  const [asmBonusCap, setAsmBonusCap] = useState<number>(1000);
  const [ssvBonusCap, setSsvBonusCap] = useState<number>(700);

  // Pobieranie danych dla aktywnej zakładki
  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === 'labor_forecast') {
      loadAopPlans(aopYear);
      loadNcRules();
    } else if (activeTab === 'managers_schedule') {
      loadShifts();
      loadManagerData(mgrYear, mgrMonth);
    }
  }, [isOpen, activeTab, aopYear, mgrYear, mgrMonth]);

  const loadAopPlans = async (year: number) => {
    setIsAopLoading(true);
    try {
      if ((window as any).api?.getAopPlansForYear) {
        const plans = await (window as any).api.getAopPlansForYear(year);
        if (plans && plans.length > 0) {
          setAopPlans(plans);
          return;
        }
      }
      setAopPlans(
        POLISH_MONTHS.map((m, idx) => ({
          key: `${year}_${m}`,
          year,
          month: m,
          month_code: `M${String(idx + 1).padStart(2, '0')}`,
          weeks_count: idx % 2 === 0 ? 5 : 4,
          plan_trx: 10000 + idx * 300,
          target_tplh: 6.70,
          plan_sales: 180000 + idx * 8000,
          labor_budget: Math.round((10000 + idx * 300) / 6.70),
        }))
      );
    } catch (err) {
      console.error('Błąd ładowania planów AOP:', err);
    } finally {
      setIsAopLoading(false);
    }
  };

  const loadNcRules = async () => {
    try {
      if ((window as any).api?.getNcRules) {
        const rules = await (window as any).api.getNcRules();
        if (rules && rules.length > 0) {
          setNcRules(rules);
          return;
        }
      }
      setNcRules(DEFAULT_NC_RULES);
    } catch (err) {
      console.error('Błąd ładowania reguł NC:', err);
    }
  };

  const loadShifts = async () => {
    try {
      const apiObj = (window as any).api || (window as any).electronAPI;
      if (apiObj?.getShiftDefinitions) {
        const defs = await apiObj.getShiftDefinitions();
        if (defs && defs.length > 0) {
          setShiftDefs(defs);
          return;
        }
      }
      setShiftDefs(DEFAULT_SHIFT_DEFINITIONS);
    } catch (err) {
      console.error('Błąd ładowania katalogu zmian:', err);
      setShiftDefs(DEFAULT_SHIFT_DEFINITIONS);
    }
  };

  const loadManagerData = async (y: number, m: number) => {
    try {
      if ((window as any).api?.getManagerScheduleData) {
        const res = await (window as any).api.getManagerScheduleData(y, m);
        if (res?.employees) {
          setEmployees(res.employees);
        }
        if (res?.monthlyNorm) {
          setNormWorkingDays(Number(res.monthlyNorm.working_days));
          setNormOffDays(Number(res.monthlyNorm.off_days));
          setNormFullHours(Number(res.monthlyNorm.full_time_hours));
          setNormNotes(res.monthlyNorm.notes || '');
        } else {
          const official = ManagerScheduleEngine.calculateMonthNorms(y, m);
          setNormWorkingDays(official.workingDays);
          setNormOffDays(official.offDaysNorm);
          setNormFullHours(official.fullTimeNominalHours);
          setNormNotes('');
        }
      }
    } catch (err) {
      console.error('Błąd ładowania danych menedżerskich w ustawieniach:', err);
    }
  };

  // Zapis AOP
  const handleSaveAop = async () => {
    try {
      if ((window as any).api?.saveAopPlans) {
        await (window as any).api.saveAopPlans(aopPlans);
      }
      showFeedback('Zapisano pomyślnie budżety AOP');
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Błąd zapisu AOP:', err);
    }
  };

  // Zapis NC
  const handleSaveNc = async () => {
    try {
      if ((window as any).api?.saveNcRules) {
        await (window as any).api.saveNcRules(ncRules);
      }
      showFeedback('Zapisano reguły zadań stałych Non-Coverage (NC)');
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Błąd zapisu NC:', err);
    }
  };

  // Zapis Zmian
  const handleSaveShifts = async () => {
    try {
      if ((window as any).api?.saveShiftDefinitions) {
        await (window as any).api.saveShiftDefinitions(shiftDefs);
      }
      showFeedback('Zapisano katalog zmian Starbucks');
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Błąd zapisu katalogu zmian:', err);
    }
  };

  // Zapis Zespołu Menedżerskiego
  const handleSaveTeam = async () => {
    try {
      if ((window as any).api?.saveManagerEmployees) {
        await (window as any).api.saveManagerEmployees({
          year: mgrYear,
          month: mgrMonth,
          employees,
          propagateToFuture
        });
      }
      showFeedback(`Zapisano skład menedżerów na ${POLISH_MONTHS[mgrMonth - 1]} ${mgrYear}`);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Błąd zapisu zespołu menedżerów:', err);
    }
  };

  // Zapis Normy Miesiąca
  const handleSaveNorm = async () => {
    try {
      if ((window as any).api?.saveMonthlyNorm) {
        await (window as any).api.saveMonthlyNorm({
          year: mgrYear,
          month: mgrMonth,
          working_days: normWorkingDays,
          off_days: normOffDays,
          full_time_hours: normFullHours,
          notes: normNotes
        });
      }
      showFeedback(`Zapisano normę Kodeksu Pracy dla ${POLISH_MONTHS[mgrMonth - 1]} ${mgrYear}`);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Błąd zapisu normy miesiąca:', err);
    }
  };

  // Reset do oficjalnej normy KP
  const handleResetNorm = () => {
    const official = ManagerScheduleEngine.calculateMonthNorms(mgrYear, mgrMonth);
    setNormWorkingDays(official.workingDays);
    setNormOffDays(official.offDaysNorm);
    setNormFullHours(official.fullTimeNominalHours);
    setNormNotes('Przywrócono do domyślnych wyliczeń Kodeksu Pracy');
  };

  const showFeedback = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-6xl h-[90vh] max-h-[900px] flex flex-col overflow-hidden">
        {/* NAGŁÓWEK GŁÓWNY MODALU */}
        <div className="px-6 py-4 bg-[#1E3932] text-white flex items-center justify-between shrink-0 border-b border-[#006241]/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#006241] flex items-center justify-center text-white shadow-sm ring-2 ring-emerald-400/20">
              <Settings className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-black tracking-tight text-white">
                  Konfiguracja Platformy Operacyjnej
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                  108120 Janki (18120)
                </span>
              </div>
              <p className="text-xs text-emerald-200/80">
                Centralny hub parametrów systemowych, budżetów AOP, katalogu zmian, zespołu i norm Kodeksu Pracy.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FEEDBACK BANNER */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-800 font-bold animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{saveSuccessMsg}</span>
            </div>
            <span className="text-[10px] bg-emerald-200/60 px-2 py-0.5 rounded-md text-emerald-900">Zapisano w bazie SQLite</span>
          </div>
        )}

        {/* KONTENER GŁÓWNY: LEWY PASEK ZAKŁADEK + PRAWA PRZESTRZEŃ */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* LEWY PASEK KATEGORII USTAWIEŃ */}
          <div className="w-64 bg-[#F7F9F8] border-r border-stone-200 p-3 space-y-1.5 shrink-0 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Moduły Operacyjne
              </div>

              {/* TAB 1: TPLH & AOP */}
              <button
                onClick={() => setActiveTab('labor_forecast')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'labor_forecast'
                    ? 'bg-[#006241] text-white shadow-xs'
                    : 'text-stone-700 hover:bg-stone-200/70'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <BarChart3 className={`w-4 h-4 ${activeTab === 'labor_forecast' ? 'text-white' : 'text-[#006241]'}`} />
                  <span>TPLH & AOP / NC</span>
                </div>
                {activeModule === 'labor_forecast' && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    activeTab === 'labor_forecast' ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    Aktywny
                  </span>
                )}
              </button>

              {/* TAB 2: Grafik Managerski */}
              <button
                onClick={() => setActiveTab('managers_schedule')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'managers_schedule'
                    ? 'bg-[#006241] text-white shadow-xs'
                    : 'text-stone-700 hover:bg-stone-200/70'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <CalendarDays className={`w-4 h-4 ${activeTab === 'managers_schedule' ? 'text-white' : 'text-[#006241]'}`} />
                  <span>Grafik & Zmiany</span>
                </div>
                {activeModule === 'managers_schedule' && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    activeTab === 'managers_schedule' ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    Aktywny
                  </span>
                )}
              </button>

              {/* TAB 3: Szkolenia */}
              <button
                onClick={() => setActiveTab('trainings')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'trainings'
                    ? 'bg-[#006241] text-white shadow-xs'
                    : 'text-stone-700 hover:bg-stone-200/70'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <GraduationCap className={`w-4 h-4 ${activeTab === 'trainings' ? 'text-white' : 'text-[#006241]'}`} />
                  <span>Szkolenia & Standardy</span>
                </div>
                {activeModule === 'trainings' && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    activeTab === 'trainings' ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    Aktywny
                  </span>
                )}
              </button>

              {/* TAB 4: COL Calculator */}
              <button
                onClick={() => setActiveTab('col_calculator')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'col_calculator'
                    ? 'bg-[#006241] text-white shadow-xs'
                    : 'text-stone-700 hover:bg-stone-200/70'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Calculator className={`w-4 h-4 ${activeTab === 'col_calculator' ? 'text-white' : 'text-[#006241]'}`} />
                  <span>COL P&L & Stawki</span>
                </div>
                {activeModule === 'col_calculator' && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    activeTab === 'col_calculator' ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    Aktywny
                  </span>
                )}
              </button>

              {/* TAB 5: Baza Danych & Kawiarnia */}
              <div className="pt-3">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  System & Lokalne
                </div>
                <button
                  onClick={() => setActiveTab('system')}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                    activeTab === 'system'
                      ? 'bg-[#006241] text-white shadow-xs'
                      : 'text-stone-700 hover:bg-stone-200/70'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Database className={`w-4 h-4 ${activeTab === 'system' ? 'text-white' : 'text-[#006241]'}`} />
                    <span>Baza & Kawiarnia</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Stopka lewego paska */}
            <div className="p-3 bg-white rounded-2xl border border-stone-200 text-[11px] text-stone-500 space-y-1">
              <div className="font-bold text-stone-800 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-[#CBA258]" />
                108120 Warszawa Janki
              </div>
              <div>Baza: SQLite (WASM)</div>
              <div className="text-[10px] text-emerald-700 font-bold">Wszystkie moduły zsynchronizowane</div>
            </div>
          </div>

          {/* PRAWA SEKCJA TREŚCI KONFIGURACYJNEJ */}
          <div className="flex-1 overflow-y-auto p-6 bg-white space-y-6">
            {/* ======================================================== */}
            {/* ZAKŁADKA 1: TPLH FORECAST & AOP */}
            {/* ======================================================== */}
            {activeTab === 'labor_forecast' && (
              <div className="space-y-5">
                {/* Pigułki sub-zakładek */}
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <div className="flex items-center space-x-2 bg-stone-100 p-1 rounded-xl">
                    <button
                      onClick={() => setLaborSubTab('aop')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        laborSubTab === 'aop' ? 'bg-white text-[#006241] shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Budżety AOP (2021–2036)
                    </button>
                    <button
                      onClick={() => setLaborSubTab('nc')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        laborSubTab === 'nc' ? 'bg-white text-[#006241] shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Zadania Stałe & Non-Coverage (NC)
                    </button>
                    <button
                      onClick={() => setLaborSubTab('floor')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        laborSubTab === 'floor' ? 'bg-white text-[#006241] shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Reguły Floor Hours (32h)
                    </button>
                  </div>

                  {laborSubTab === 'aop' && (
                    <div className="flex items-center gap-2">
                      <select
                        value={aopYear}
                        onChange={(e) => setAopYear(Number(e.target.value))}
                        className="bg-stone-50 border border-stone-300 text-stone-900 text-xs font-bold rounded-xl px-3 py-1.5 cursor-pointer"
                      >
                        {AVAILABLE_YEARS.map((y) => (
                          <option key={y} value={y}>
                            Rok AOP: {y}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleSaveAop}
                        className="px-3.5 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        Zapisz AOP
                      </button>
                    </div>
                  )}

                  {laborSubTab === 'nc' && (
                    <button
                      onClick={handleSaveNc}
                      className="px-3.5 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      Zapisz Reguły NC
                    </button>
                  )}
                </div>

                {/* Sub-zakładka AOP */}
                {laborSubTab === 'aop' && (
                  <div className="space-y-4">
                    {/* Masowa zmiana TPLH */}
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Sparkles className="w-5 h-5 text-emerald-700" />
                        <div>
                          <span className="text-xs font-bold text-emerald-950 block">
                            Masowe ustawienie celu TPLH dla całego roku {aopYear}
                          </span>
                          <span className="text-[11px] text-emerald-800">
                            Zastosuj jednolity cel TPLH dla wszystkich 12 miesięcy roku.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="0.05"
                          value={bulkTplh}
                          onChange={(e) => setBulkTplh(e.target.value)}
                          className="w-20 bg-white border border-emerald-300 rounded-xl px-2.5 py-1 text-xs font-bold text-center text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#006241]"
                        />
                        <button
                          onClick={() => {
                            const val = parseFloat(bulkTplh);
                            if (!isNaN(val) && val > 0) {
                              setAopPlans(aopPlans.map(p => ({ ...p, target_tplh: val, labor_budget: Math.round(p.plan_trx / val) })));
                            }
                          }}
                          className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                        >
                          Zastosuj
                        </button>
                      </div>
                    </div>

                    {/* Tabela AOP */}
                    <div className="border border-stone-200 rounded-2xl overflow-hidden shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200">
                          <tr>
                            <th className="px-3.5 py-2.5">Miesiąc</th>
                            <th className="px-3 py-2.5">Tygodnie</th>
                            <th className="px-3 py-2.5">Plan TRX</th>
                            <th className="px-3 py-2.5">Cel TPLH</th>
                            <th className="px-3 py-2.5">Plan Sprzedaż (PLN)</th>
                            <th className="px-3 py-2.5 text-right">Budżet Robocizny (h)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {aopPlans.map((plan, idx) => (
                            <tr key={plan.month} className="hover:bg-stone-50/80">
                              <td className="px-3.5 py-2 font-bold text-stone-900">{plan.month}</td>
                              <td className="px-3 py-2 text-stone-600">{plan.weeks_count} tyg.</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={plan.plan_trx}
                                  onChange={(e) => {
                                    const trx = Number(e.target.value);
                                    const updated = [...aopPlans];
                                    updated[idx] = {
                                      ...plan,
                                      plan_trx: trx,
                                      labor_budget: plan.target_tplh > 0 ? Math.round(trx / plan.target_tplh) : 0,
                                    };
                                    setAopPlans(updated);
                                  }}
                                  className="w-24 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs font-medium text-stone-900"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.05"
                                  value={plan.target_tplh}
                                  onChange={(e) => {
                                    const tplh = Number(e.target.value);
                                    const updated = [...aopPlans];
                                    updated[idx] = {
                                      ...plan,
                                      target_tplh: tplh,
                                      labor_budget: tplh > 0 ? Math.round(plan.plan_trx / tplh) : 0,
                                    };
                                    setAopPlans(updated);
                                  }}
                                  className="w-20 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold text-[#006241]"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  value={plan.plan_sales || 0}
                                  onChange={(e) => {
                                    const sales = Number(e.target.value);
                                    const updated = [...aopPlans];
                                    updated[idx] = { ...plan, plan_sales: sales };
                                    setAopPlans(updated);
                                  }}
                                  className="w-28 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs font-medium text-stone-900"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-black text-stone-900">
                                {plan.labor_budget?.toFixed(0)} h
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sub-zakładka NC */}
                {laborSubTab === 'nc' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-stone-500">
                        Zadania administracyjne i operacyjne menedżerów oraz baristów rozliczane poza dobową podłogą Floor.
                      </p>
                      <button
                        onClick={() => {
                          const newId = `nc_${Date.now()}`;
                          setNcRules([
                            ...ncRules,
                            { id: newId, name: 'Nowe Zadanie NC', category: 'Operacje', monthly_hours: 4.0, is_mandatory: false }
                          ]);
                        }}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Dodaj Zadanie NC
                      </button>
                    </div>

                    <div className="space-y-2">
                      {ncRules.map((r, rIdx) => (
                        <div key={r.id || rIdx} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={r.name}
                              onChange={(e) => {
                                const updated = [...ncRules];
                                updated[rIdx] = { ...r, name: e.target.value };
                                setNcRules(updated);
                              }}
                              className="bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-bold text-stone-900 w-72"
                            />
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-200 text-stone-700 font-bold uppercase">
                              {r.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-stone-600 font-medium">Miesięcznie:</span>
                              <input
                                type="number"
                                step="0.5"
                                value={r.monthly_hours}
                                onChange={(e) => {
                                  const updated = [...ncRules];
                                  updated[rIdx] = { ...r, monthly_hours: Number(e.target.value) };
                                  setNcRules(updated);
                                }}
                                className="w-20 bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs font-bold text-stone-900 text-center"
                              />
                              <span className="text-xs font-bold text-stone-700">h</span>
                            </div>

                            <button
                              onClick={() => setNcRules(ncRules.filter((_, i) => i !== rIdx))}
                              className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                              title="Usuń regułę"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-zakładka Floor */}
                {laborSubTab === 'floor' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-[#006241]" />
                        <h4 className="text-sm font-bold text-stone-900">Standard Ochrony Floor Hours</h4>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        Kawiarnia 108120 Janki posiada nienaruszalną bazę Floor: <strong>32.0h na dobę</strong> (1 MGR + 1 Barista rano / AM + 1 MGR + 1 Barista wieczorem / PM), co stanowi <strong>224.0h w pełnym tygodniu 7-dniowym</strong>.
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                        <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                          <span className="text-[10px] text-stone-500 font-bold block uppercase">Floor Dobowy</span>
                          <span className="text-base font-black text-stone-900">32.0 h</span>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                          <span className="text-[10px] text-stone-500 font-bold block uppercase">Floor Tygodniowy</span>
                          <span className="text-base font-black text-stone-900">224.0 h</span>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                          <span className="text-[10px] text-stone-500 font-bold block uppercase">Obsada AM</span>
                          <span className="text-base font-black text-[#006241]">1 MGR + 1 BAR</span>
                        </div>
                        <div className="p-2.5 bg-white rounded-xl border border-stone-200">
                          <span className="text-[10px] text-stone-500 font-bold block uppercase">Obsada PM</span>
                          <span className="text-base font-black text-[#006241]">1 MGR + 1 BAR</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* ZAKŁADKA 2: MANAGERS SCHEDULE (GRAFIK) */}
            {/* ======================================================== */}
            {activeTab === 'managers_schedule' && (
              <div className="space-y-5">
                {/* Pigułki sub-zakładek */}
                <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                  <div className="flex items-center space-x-2 bg-stone-100 p-1 rounded-xl">
                    <button
                      onClick={() => setMgrSubTab('shifts')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        mgrSubTab === 'shifts' ? 'bg-white text-[#006241] shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Katalog Zmian Starbucks
                    </button>
                    <button
                      onClick={() => setMgrSubTab('team')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        mgrSubTab === 'team' ? 'bg-white text-[#006241] shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Skład Zespołu & Etaty
                    </button>
                    <button
                      onClick={() => setMgrSubTab('norms')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        mgrSubTab === 'norms' ? 'bg-white text-[#006241] shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Normy Miesięczne KP
                    </button>
                    <button
                      onClick={() => setMgrSubTab('law')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        mgrSubTab === 'law' ? 'bg-white text-[#006241] shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Tarcza Kodeksu Pracy
                    </button>
                  </div>

                  {mgrSubTab === 'shifts' && (
                    <button
                      onClick={handleSaveShifts}
                      className="px-3.5 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      Zapisz Katalog Zmian
                    </button>
                  )}

                  {mgrSubTab === 'team' && (
                    <button
                      onClick={handleSaveTeam}
                      className="px-3.5 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      Zapisz Skład Zespołu
                    </button>
                  )}

                  {mgrSubTab === 'norms' && (
                    <button
                      onClick={handleSaveNorm}
                      className="px-3.5 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      Zapisz Normę Miesiąca
                    </button>
                  )}
                </div>

                {/* Sub-zakładka: Katalog Zmian */}
                {mgrSubTab === 'shifts' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {['ALL', 'coverage', 'nc', 'absence'].map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setShiftsCategoryFilter(cat)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                              shiftsCategoryFilter === cat
                                ? 'bg-stone-800 text-white'
                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                          >
                            {cat === 'ALL' ? 'Wszystkie' : cat === 'coverage' ? 'Obsługa' : cat === 'nc' ? 'Non-Coverage' : 'Absencje'}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          const newShift: ShiftDefinition = {
                            code: `Z${shiftDefs.length + 1}`,
                            name: 'Nowa Zmiana',
                            start_time: '08:00',
                            end_time: '16:00',
                            hours: 8.0,
                            is_nc: 0,
                            is_absence: 0,
                            category: 'coverage',
                            is_sunday_only: 0,
                            color_bg: 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          };
                          setShiftDefs([...shiftDefs, newShift]);
                        }}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Nowa Zmiana
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                      {shiftDefs
                        .filter(s => shiftsCategoryFilter === 'ALL' || s.category === shiftsCategoryFilter)
                        .map((shift, sIdx) => (
                          <div key={shift.code || sIdx} className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={shift.code}
                                  onChange={(e) => {
                                    const updated = [...shiftDefs];
                                    updated[sIdx] = { ...shift, code: e.target.value.toUpperCase() };
                                    setShiftDefs(updated);
                                  }}
                                  className="w-16 bg-white border border-stone-300 rounded-lg px-2 py-0.5 text-xs font-black font-mono text-center text-stone-900"
                                />
                                <input
                                  type="text"
                                  value={shift.name}
                                  onChange={(e) => {
                                    const updated = [...shiftDefs];
                                    updated[sIdx] = { ...shift, name: e.target.value };
                                    setShiftDefs(updated);
                                  }}
                                  className="w-44 bg-white border border-stone-300 rounded-lg px-2 py-0.5 text-xs font-bold text-stone-900"
                                />
                              </div>

                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  step="0.5"
                                  value={shift.hours}
                                  onChange={(e) => {
                                    const updated = [...shiftDefs];
                                    updated[sIdx] = { ...shift, hours: Number(e.target.value) };
                                    setShiftDefs(updated);
                                  }}
                                  className="w-16 bg-white border border-stone-300 rounded-lg px-2 py-0.5 text-xs font-black text-center text-[#006241]"
                                />
                                <span className="text-xs font-bold text-stone-600">h</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <label className="text-[10px] font-bold text-stone-500 block mb-0.5">Start:</label>
                                <input
                                  type="text"
                                  value={shift.start_time}
                                  onChange={(e) => {
                                    const updated = [...shiftDefs];
                                    updated[sIdx] = { ...shift, start_time: e.target.value };
                                    setShiftDefs(updated);
                                  }}
                                  className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-900 text-center font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-stone-500 block mb-0.5">Koniec:</label>
                                <input
                                  type="text"
                                  value={shift.end_time}
                                  onChange={(e) => {
                                    const updated = [...shiftDefs];
                                    updated[sIdx] = { ...shift, end_time: e.target.value };
                                    setShiftDefs(updated);
                                  }}
                                  className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-900 text-center font-mono"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-stone-500 block mb-0.5">Kategoria:</label>
                                <select
                                  value={shift.category || 'coverage'}
                                  onChange={(e) => {
                                    const cat = e.target.value as 'coverage' | 'nc' | 'absence';
                                    const updated = [...shiftDefs];
                                    updated[sIdx] = {
                                      ...shift,
                                      category: cat,
                                      is_nc: cat === 'nc' ? 1 : 0,
                                      is_absence: cat === 'absence' ? 1 : 0
                                    };
                                    setShiftDefs(updated);
                                  }}
                                  className="w-full bg-white border border-stone-200 rounded-lg px-1 py-1 text-xs text-stone-900 font-bold"
                                >
                                  <option value="coverage">Obsługa</option>
                                  <option value="nc">Non-Cov</option>
                                  <option value="absence">Absencja</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Sub-zakładka: Skład Zespołu */}
                {mgrSubTab === 'team' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <select
                          value={mgrYear}
                          onChange={(e) => setMgrYear(Number(e.target.value))}
                          className="bg-stone-50 border border-stone-300 text-stone-900 text-xs font-bold rounded-xl px-3 py-1.5 cursor-pointer"
                        >
                          {AVAILABLE_YEARS.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        <select
                          value={mgrMonth}
                          onChange={(e) => setMgrMonth(Number(e.target.value))}
                          className="bg-stone-50 border border-stone-300 text-stone-900 text-xs font-bold rounded-xl px-3 py-1.5 cursor-pointer"
                        >
                          {POLISH_MONTHS.map((m, idx) => (
                            <option key={m} value={idx + 1}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-stone-600 font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={propagateToFuture}
                            onChange={(e) => setPropagateToFuture(e.target.checked)}
                            className="rounded text-[#006241]"
                          />
                          Propaguj zmiany na kolejne miesiące
                        </label>

                        <button
                          onClick={() => {
                            const newEmp: ManagerEmployee = {
                              id: 0,
                              name: 'Nowy Menedżer',
                              role: 'SSV',
                              contract_type: 'FULL',
                              contract_hours_ratio: 1.0,
                              hourly_rate: 32.5,
                              sort_order: employees.length + 1,
                              is_active: 1
                            };
                            setEmployees([...employees, newEmp]);
                          }}
                          className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Dodaj Menedżera
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {employees.map((emp, eIdx) => (
                        <div key={emp.id || eIdx} className="flex items-center justify-between p-3 bg-stone-50 rounded-2xl border border-stone-200">
                          <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-full bg-stone-200 text-stone-700 text-xs font-bold flex items-center justify-center font-mono">
                              {eIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={emp.name}
                              onChange={(e) => {
                                const updated = [...employees];
                                updated[eIdx] = { ...emp, name: e.target.value };
                                setEmployees(updated);
                              }}
                              className="bg-white border border-stone-300 rounded-lg px-2.5 py-1 text-xs font-bold text-stone-900 w-48"
                            />
                            <select
                              value={formatManagerRole(emp.role)}
                              onChange={(e) => {
                                const updated = [...employees];
                                updated[eIdx] = { ...emp, role: e.target.value };
                                setEmployees(updated);
                              }}
                              className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs font-bold text-[#006241]"
                            >
                              <option value="SM">SM (Customer & Sales Manager)</option>
                              <option value="ASM">ASM (People Manager)</option>
                              <option value="SSV">SSV (Shift Supervisor)</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-stone-500 font-medium">Etat:</span>
                              <select
                                value={emp.contract_type}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const ratio = val === 'FULL' ? 1.0 : val === '0.75' ? 0.75 : val === '0.5' ? 0.5 : 0.25;
                                  const updated = [...employees];
                                  updated[eIdx] = { ...emp, contract_type: val, contract_hours_ratio: ratio };
                                  setEmployees(updated);
                                }}
                                className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs font-bold text-stone-900"
                              >
                                <option value="FULL">1.0 (Pełny)</option>
                                <option value="0.75">0.75 (3/4)</option>
                                <option value="0.5">0.50 (1/2)</option>
                                <option value="0.25">0.25 (1/4)</option>
                              </select>
                            </div>

                            <div className="flex items-center gap-1">
                              <span className="text-xs text-stone-500 font-medium">Stawka:</span>
                              <input
                                type="number"
                                step="0.5"
                                value={emp.hourly_rate || 32.5}
                                onChange={(e) => {
                                  const updated = [...employees];
                                  updated[eIdx] = { ...emp, hourly_rate: Number(e.target.value) };
                                  setEmployees(updated);
                                }}
                                className="w-18 bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs font-bold text-stone-900 text-center"
                              />
                              <span className="text-xs font-bold text-stone-600">zł/h</span>
                            </div>

                            <button
                              onClick={() => setEmployees(employees.filter((_, i) => i !== eIdx))}
                              className="p-1 text-stone-400 hover:text-rose-600 transition-colors"
                              title="Usuń ze składu"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-zakładka: Normy Miesięczne KP */}
                {mgrSubTab === 'norms' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <select
                          value={mgrYear}
                          onChange={(e) => setMgrYear(Number(e.target.value))}
                          className="bg-stone-50 border border-stone-300 text-stone-900 text-xs font-bold rounded-xl px-3 py-1.5 cursor-pointer"
                        >
                          {AVAILABLE_YEARS.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                        <select
                          value={mgrMonth}
                          onChange={(e) => setMgrMonth(Number(e.target.value))}
                          className="bg-stone-50 border border-stone-300 text-stone-900 text-xs font-bold rounded-xl px-3 py-1.5 cursor-pointer"
                        >
                          {POLISH_MONTHS.map((m, idx) => (
                            <option key={m} value={idx + 1}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={handleResetNorm}
                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Przywróć domyślną normę KP
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                        <label className="text-[10px] font-bold text-stone-500 uppercase block">Dni robocze:</label>
                        <input
                          type="number"
                          value={normWorkingDays}
                          onChange={(e) => setNormWorkingDays(Number(e.target.value))}
                          className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-lg font-black text-stone-900"
                        />
                      </div>

                      <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                        <label className="text-[10px] font-bold text-stone-500 uppercase block">Dni wolne (norma):</label>
                        <input
                          type="number"
                          value={normOffDays}
                          onChange={(e) => setNormOffDays(Number(e.target.value))}
                          className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-lg font-black text-stone-900"
                        />
                      </div>

                      <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                        <label className="text-[10px] font-bold text-stone-500 uppercase block">Nominał etatu (h):</label>
                        <input
                          type="number"
                          value={normFullHours}
                          onChange={(e) => setNormFullHours(Number(e.target.value))}
                          className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-lg font-black text-[#006241]"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                      <label className="text-[10px] font-bold text-stone-500 uppercase block">Notatki / Powód zmiany:</label>
                      <input
                        type="text"
                        value={normNotes}
                        onChange={(e) => setNormNotes(e.target.value)}
                        placeholder="np. korekta świąteczna, porozumienie zakładowe..."
                        className="w-full bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-900"
                      />
                    </div>
                  </div>
                )}

                {/* Sub-zakładka: Tarcza KP */}
                {mgrSubTab === 'law' && (
                  <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#006241]" />
                      Tarcza Kodeksu Pracy — Parametry Ochronne
                    </h4>
                    <ul className="text-xs text-stone-600 space-y-2 list-disc list-inside">
                      <li><strong>Odpoczynek dobowy</strong>: minimum 11 godzin nieprzerwanie (art. 132 KP).</li>
                      <li><strong>Odpoczynek tygodniowy</strong>: minimum 35 godzin nieprzerwanie (art. 133 KP).</li>
                      <li><strong>Maksymalny wymiar dobowy</strong>: 12 godzin (art. 135 KP).</li>
                      <li><strong>Zasada 4. niedzieli</strong>: co najmniej 1 wolna niedziela na 4 kolejne (art. 151¹⁰ KP).</li>
                      <li><strong>Rozliczenie urlopu H i L4</strong>: wyłącznie w dni robocze, 0.0h w weekendy i święta (art. 154² § 1 KP).</li>
                      <li><strong>Reguła pierwszeństwa L4 nad H</strong>: zachorowanie w urlopie anuluje H i zalicza L4 (art. 166 KP).</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* ZAKŁADKA 3: SZKOLENIA */}
            {/* ======================================================== */}
            {activeTab === 'trainings' && (
              <div className="space-y-6">
                <div className="border-b border-stone-200 pb-4">
                  <h3 className="text-lg font-black text-stone-900">
                    Standardy Szkoleniowe Starbucks Training Suite
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Struktura programu First 30, Zmiany T (Non-Coverage) oraz kryteria egzaminów Skill Check.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">Nowy Barista (T)</span>
                    <span className="text-2xl font-black text-emerald-950 block mt-1">38h 45m</span>
                    <p className="text-xs text-emerald-800/80 mt-1">
                      Łączny czas nauki praktycznej baristy w ramach bloków T1–T10.
                    </p>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                    <span className="text-[10px] font-bold text-amber-800 uppercase block">Barista Trener BT (T)</span>
                    <span className="text-2xl font-black text-amber-950 block mt-1">14h 15m</span>
                    <p className="text-xs text-amber-800/80 mt-1">
                      Dedykowany czas trenera na instruktaż i model 4-etapowy.
                    </p>
                  </div>

                  <div className="p-4 bg-stone-100 rounded-2xl border border-stone-200">
                    <span className="text-[10px] font-bold text-stone-600 uppercase block">Store Manager SM (T)</span>
                    <span className="text-2xl font-black text-stone-900 block mt-1">3h 30m</span>
                    <p className="text-xs text-stone-600 mt-1">
                      Powitanie, odprawy feedbackowe oraz egzamin końcowy i Green Pin.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                  <h4 className="text-xs font-bold text-stone-900 uppercase">Cyfrowe Egzaminy Skill Check</h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Wszystkie arkusze egzaminacyjne posiadają próg zdawalności <strong>80%</strong>. Pozytywne ukończenie odblokowuje certyfikat oraz awans w kamieniach milowych <em>The Barista Journey</em>.
                  </p>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* ZAKŁADKA 4: COL CALCULATOR */}
            {/* ======================================================== */}
            {activeTab === 'col_calculator' && (
              <div className="space-y-6">
                <div className="border-b border-stone-200 pb-4">
                  <h3 className="text-lg font-black text-stone-900">
                    Parametry Finansowe P&L & Narzuty COL
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Narzuty pracodawcy, stawki PFRON, ekwiwalenty odzieżowe i progi premiowe.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                    <h4 className="text-xs font-bold text-stone-900 uppercase">Narzuty Pracodawcy & Podatki</h4>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-700">ZUS Pracodawcy (emeryt., rent., wypadk., FP, FGŚP):</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={zusRate}
                          onChange={(e) => setZusRate(Number(e.target.value))}
                          className="w-18 bg-white border border-stone-300 rounded-lg px-2 py-1 font-bold text-stone-900 text-center"
                        />
                        <span className="font-bold">%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-700">Wpłata PFRON na pełny etat:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={pfronRate}
                          onChange={(e) => setPfronRate(Number(e.target.value))}
                          className="w-18 bg-white border border-stone-300 rounded-lg px-2 py-1 font-bold text-stone-900 text-center"
                        />
                        <span className="font-bold">zł</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-700">Ekwiwalent odzieżowy i pranie (załoga):</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.05"
                          value={laundryCrewRate}
                          onChange={(e) => setLaundryCrewRate(Number(e.target.value))}
                          className="w-18 bg-white border border-stone-300 rounded-lg px-2 py-1 font-bold text-stone-900 text-center"
                        />
                        <span className="font-bold">zł/h</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                    <h4 className="text-xs font-bold text-stone-900 uppercase">Limity Premii Managerskich (BONUS)</h4>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-700">Store Manager (SM) Cap:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={smBonusCap}
                          onChange={(e) => setSmBonusCap(Number(e.target.value))}
                          className="w-20 bg-white border border-stone-300 rounded-lg px-2 py-1 font-bold text-stone-900 text-center"
                        />
                        <span className="font-bold">zł</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-700">Assistant Store Manager (ASM) Cap:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={asmBonusCap}
                          onChange={(e) => setAsmBonusCap(Number(e.target.value))}
                          className="w-20 bg-white border border-stone-300 rounded-lg px-2 py-1 font-bold text-stone-900 text-center"
                        />
                        <span className="font-bold">zł</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-700">Shift Supervisor (SSV) Cap:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={ssvBonusCap}
                          onChange={(e) => setSsvBonusCap(Number(e.target.value))}
                          className="w-20 bg-white border border-stone-300 rounded-lg px-2 py-1 font-bold text-stone-900 text-center"
                        />
                        <span className="font-bold">zł</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* ZAKŁADKA 5: SYSTEM & BAZA */}
            {/* ======================================================== */}
            {activeTab === 'system' && (() => {
              const currentStoreName = (() => {
                try { return localStorage.getItem('sbx_store_name') || '108120 SBX Warszawa Janki'; } catch { return '108120 SBX Warszawa Janki'; }
              })();
              const currentUnitCode = (() => {
                try { return localStorage.getItem('sbx_unit_code') || '18120'; } catch { return '18120'; }
              })();
              const currentUserName = (() => {
                try { return localStorage.getItem('sbx_user_name') || 'Nie podano'; } catch { return 'Nie podano'; }
              })();
              const currentUserEmail = (() => {
                try { return localStorage.getItem('sbx_user_email') || 'Brak'; } catch { return 'Brak'; }
              })();
              const currentUserRole = (() => {
                try { return localStorage.getItem('sbx_user_role') || 'Store Manager (SM)'; } catch { return 'Store Manager (SM)'; }
              })();

              return (
                <div className="space-y-6">
                  <div className="border-b border-stone-200 pb-4">
                    <h3 className="text-lg font-black text-stone-900">
                      Ustawienia Systemowe & Baza Danych
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Diagnostyka silnika SQLite, integracja ewidencji MAPAL oraz parametry jednostki operacyjnej.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Karta 1: Dane Kawiarni i Użytkownika */}
                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <Store className="w-5 h-5 text-[#006241]" />
                        <h4 className="text-sm font-bold text-stone-900">Jednostka & Profil Operacyjny</h4>
                      </div>
                      <div className="text-xs space-y-1.5 text-stone-600">
                        <div className="flex justify-between">
                          <span className="text-stone-500">Kawiarnia:</span>
                          <strong className="text-stone-900">{currentStoreName}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Kod jednostki (Unit Code):</span>
                          <strong className="text-stone-900">{currentUnitCode}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Zalogowany Kierownik:</span>
                          <strong className="text-[#006241]">{currentUserName}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Rola w systemie:</span>
                          <span className="font-semibold text-stone-800">{currentUserRole}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Służbowy e-mail:</span>
                          <span className="font-mono text-stone-700 text-[11px]">{currentUserEmail}</span>
                        </div>
                      </div>
                    </div>

                    {/* Karta 2: Baza Operacyjna & MAPAL */}
                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <h4 className="text-sm font-bold text-stone-900">Baza Operacyjna & Integracje</h4>
                      </div>
                      <div className="text-xs space-y-2 text-stone-600">
                        <div className="flex items-center justify-between">
                          <span className="text-stone-500">Baza Danych:</span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md font-bold text-[10px] flex items-center gap-1">
                            <Database className="w-3 h-3 text-emerald-600" />
                            SQLite Desktop (Aktywna)
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-stone-500">Ewidencja MAPAL:</span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-300 rounded-md font-bold text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" />
                            Zsynchronizowana
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-stone-500">Baza Floor Hours:</span>
                          <span className="font-bold text-stone-800">32.0 h / dobę (224.0 h / tydz.)</span>
                        </div>
                      </div>
                    </div>

                    {/* Karta 3: Kopie Zapasowe SQLite */}
                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-[#006241]" />
                        <h4 className="text-sm font-bold text-stone-900">Kopie Zapasowe SQLite</h4>
                      </div>
                      <p className="text-xs text-stone-600">
                        Zarządzaj migawkami bazy danych przed importami raportów lub przywracaj punkty zapisu.
                      </p>
                      {onOpenBackupModal && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenBackupModal();
                          }}
                          className="w-full py-2 px-3 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Database className="w-4 h-4" />
                          <span>Otwórz Menedżer Kopii</span>
                        </button>
                      )}
                    </div>

                    {/* Karta 4: Aktualizacje Systemu */}
                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-emerald-600" />
                          <h4 className="text-sm font-bold text-stone-900">Aktualizacje Aplikacji</h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                          v{APP_VERSION}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600">
                        Sprawdź dostępność nowych wydań i pobierz najnowsze pakiety usprawnień.
                      </p>
                      {onOpenUpdateModal && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenUpdateModal();
                          }}
                          className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>{hasUpdateAvailable ? 'Dostępna nowa wersja!' : 'Centrum Aktualizacji'}</span>
                        </button>
                      )}
                    </div>

                    {/* Karta 5: Zgłaszanie Błędów & Diagnostyka */}
                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <Bug className="w-5 h-5 text-amber-600" />
                        <h4 className="text-sm font-bold text-stone-900">Zgłoś Błąd / Diagnostyka</h4>
                      </div>
                      <p className="text-xs text-stone-600">
                        Wyślij zgłoszenie z automatycznym dołączeniem logów Czarnej Skrzynki.
                      </p>
                      {onOpenBugReporter && (
                        <button
                          onClick={() => {
                            onClose();
                            onOpenBugReporter();
                          }}
                          className="w-full py-2 px-3 bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Bug className="w-4 h-4" />
                          <span>Zgłoś Uwagi / Problem</span>
                        </button>
                      )}
                    </div>

                    {/* Karta 6: Kreator Startowy */}
                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-5 h-5 text-[#006241]" />
                        <h4 className="text-sm font-bold text-stone-900">Kreator Pierwszego Uruchomienia</h4>
                      </div>
                      <p className="text-xs text-stone-600">
                        Uruchom ponownie pełny kreator konfiguracji kawiarni i importu danych.
                      </p>
                      {onRerunOnboarding && (
                        <button
                          onClick={() => {
                            onClose();
                            onRerunOnboarding();
                          }}
                          className="w-full py-2 px-3 bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-stone-300"
                        >
                          <RotateCcw className="w-4 h-4 text-[#006241]" />
                          <span>Uruchom Kreator Startowy</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
