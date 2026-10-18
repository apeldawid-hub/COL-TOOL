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
  CheckSquare,
  BookOpen,
  Mail,
  Loader2,
  Bell,
  Laptop,
  Flame,
  Activity,
  Zap,
  RefreshCw,
  ShieldAlert,
  Monitor,
  ZoomIn,
  ZoomOut,
  History,
  ArrowRight,
  Cloud,
} from 'lucide-react';
import { useTutorial } from '../context/TutorialContext';
import { useStore } from '../context/StoreContext';
import { POLISH_MONTHS, AVAILABLE_YEARS } from './ModuleDateBar';
import { SystemClock } from '../services/systemClock';
import { ManagerScheduleEngine } from '../modules/managers-schedule/services/managerScheduleEngine';
import { DEFAULT_SHIFT_DEFINITIONS } from '../modules/managers-schedule/constants/defaultShifts';
import { APP_VERSION, APP_SHORT_NAME } from '../version';
import { cloudNotificationService } from '../services/cloudNotificationService';
import { NotificationsSettingsTab } from './NotificationsSettingsTab';
import { FirebaseFleetPanel } from './FirebaseFleetPanel';
import { databaseHealthService } from '../services/databaseHealthService';
import { DatabaseHealthStatus } from '../types';
import { zoomService, ZOOM_PRESETS } from '../services/zoomService';

export type SettingsTabId =
  | 'labor_forecast'
  | 'managers_schedule'
  | 'trainings'
  | 'col_calculator'
  | 'notifications_app'
  | 'notifications_email'
  | 'notifications'
  | 'firebase_fleet'
  | 'testing_guide'
  | 'appearance'
  | 'system';

interface UnifiedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeModule: AppModule;
  selectedYear: number;
  selectedMonth: string;
  initialTab?: SettingsTabId;
  onRefreshData?: () => void;
  onOpenBackupModal?: () => void;
  onOpenCloudDocsModal?: () => void;
  onOpenUpdateModal?: () => void;
  hasUpdateAvailable?: boolean;
  onOpenBugReporter?: () => void;
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
  initialTab,
  onRefreshData,
  onOpenBackupModal,
  onOpenCloudDocsModal,
  onOpenUpdateModal,
  hasUpdateAvailable,
  onOpenBugReporter,
}) => {
  const { currentStore, openStoreSwitcher } = useStore();

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

  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab || getInitialTab(activeModule));
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Weryfikacja uprawnień deweloperskich / administratorskich
  const isDeveloper = (() => {
    try {
      if (import.meta.env.DEV) return true;
      const userEmail = (localStorage.getItem('sbx_user_email') || '').toLowerCase();
      const userRole = (localStorage.getItem('sbx_user_role') || '').toUpperCase();
      const isDevMode = localStorage.getItem('sbx_dev_mode') === 'true';
      return (
        userEmail === 'apeldawid@gmail.com' ||
        isDevMode ||
        userRole === 'DEV' ||
        userRole === 'ADMIN' ||
        userRole === 'DM'
      );
    } catch {
      return false;
    }
  })();

  // Hook trybu samouczka i przewodnika pilotażu kawiarni
  const { isTutorialMode, setTutorialMode, toggleTutorialMode, openGuideModal, openModelTour } = useTutorial();

  // Sub-zakładki dla poszczególnych modułów
  const [mgrSubTab, setMgrSubTab] = useState<'shifts' | 'team' | 'norms' | 'law'>('shifts');
  const [laborSubTab, setLaborSubTab] = useState<'aop' | 'nc' | 'floor'>('aop');

  // Synchronizacja przy otwarciu na bazie aktualnie wyświetlanego modułu lub initialTab
  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      } else {
        setActiveTab(getInitialTab(activeModule));
      }
      setSaveSuccessMsg(null);
    }
  }, [isOpen, activeModule, initialTab]);

  // Stan: Diagnostyka i Zdrowie Bazy SQLite
  const [dbHealth, setDbHealth] = useState<DatabaseHealthStatus | null>(() => databaseHealthService.getHealth());
  const [isCheckingDbHealth, setIsCheckingDbHealth] = useState<boolean>(false);
  const [isOptimizingDb, setIsOptimizingDb] = useState<boolean>(false);
  const [dbHealthActionMsg, setDbHealthActionMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      databaseHealthService.checkHealth().then(setDbHealth).catch(() => {});
    }
  }, [isOpen]);

  const handleCheckDbIntegrity = async () => {
    setIsCheckingDbHealth(true);
    setDbHealthActionMsg(null);
    try {
      const res = await databaseHealthService.checkHealth();
      setDbHealth(res);
      setDbHealthActionMsg(`Test spójności: ${res.integrity === 'ok' ? 'Baza jest w 100% spójna ✓' : res.integrityMessage}`);
    } catch (err: any) {
      setDbHealthActionMsg(`Błąd: ${err.message}`);
    } finally {
      setIsCheckingDbHealth(false);
    }
  };

  const handleOptimizeDb = async () => {
    setIsOptimizingDb(true);
    setDbHealthActionMsg(null);
    try {
      const res = await databaseHealthService.optimizeDatabase();
      if (res.health) setDbHealth(res.health);
      setDbHealthActionMsg(res.message);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setDbHealthActionMsg(`Błąd: ${err.message}`);
    } finally {
      setIsOptimizingDb(false);
    }
  };

  // Stan: Skalowanie Interfejsu (UI Zoom)
  const [currentZoom, setCurrentZoom] = useState<number>(() => zoomService.getZoom());

  useEffect(() => {
    const unsubscribe = zoomService.subscribe((zoom) => {
      setCurrentZoom(zoom);
    });
    return () => unsubscribe();
  }, []);

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

  // Stan: Powiadomienia Chmurowe (Resend API)
  const [resendApiKey, setResendApiKey] = useState<string>(() => cloudNotificationService.getApiKey());
  const [isSendingTestEmail, setIsSendingTestEmail] = useState<boolean>(false);
  const [testEmailStatus, setTestEmailStatus] = useState<{ success: boolean; msg: string } | null>(null);

  const handleSaveApiKey = () => {
    cloudNotificationService.setApiKey(resendApiKey);
    setSaveSuccessMsg('Zapisano klucz Resend API w konfiguracji!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleSendTestEmail = async () => {
    const userEmail = localStorage.getItem('sbx_user_email') || 'kontakt@amrest.eu';
    setIsSendingTestEmail(true);
    setTestEmailStatus(null);
    try {
      const res = await cloudNotificationService.sendTestNotification(userEmail);
      if (res.success) {
        setTestEmailStatus({ success: true, msg: `Wysłano e-mail testowy na adres: ${userEmail}!` });
      } else {
        setTestEmailStatus({ success: false, msg: res.error || 'Nie udało się wysłać e-maila testowego.' });
      }
    } catch (err: any) {
      setTestEmailStatus({ success: false, msg: err.message || 'Błąd wysyłki e-mail.' });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

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

              {/* KATEGORIA: POWIADOMIENIA I ALERTY */}
              <div className="pt-2">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Powiadomienia & Komunikacja
                </div>

                {/* TAB: Powiadomienia w Aplikacji (Desktop & macOS) */}
                <button
                  onClick={() => setActiveTab('notifications_app')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer mb-1 ${
                    activeTab === 'notifications_app'
                      ? 'bg-[#1E3932] text-white shadow-xs'
                      : 'text-stone-700 hover:bg-stone-200/70'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Laptop className={`w-4 h-4 ${activeTab === 'notifications_app' ? 'text-[#CBA258]' : 'text-[#006241]'}`} />
                    <span>W Aplikacji & Desktop</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    activeTab === 'notifications_app' ? 'bg-emerald-900 text-emerald-200' : 'bg-stone-200 text-stone-600'
                  }`}>
                    macOS
                  </span>
                </button>

                {/* TAB: Powiadomienia E-mail (Chmura Resend) */}
                <button
                  onClick={() => setActiveTab('notifications_email')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                    activeTab === 'notifications_email'
                      ? 'bg-[#006241] text-white shadow-xs'
                      : 'text-stone-700 hover:bg-stone-200/70'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Mail className={`w-4 h-4 ${activeTab === 'notifications_email' ? 'text-white' : 'text-[#CBA258]'}`} />
                    <span>Powiadomienia E-mail</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    activeTab === 'notifications_email' ? 'bg-emerald-900 text-emerald-200' : 'bg-stone-200 text-stone-600'
                  }`}>
                    Resend
                  </span>
                </button>
              </div>

              {/* TAB 5: Samouczek & Przewodnik Kawiarni */}
              <button
                onClick={() => setActiveTab('testing_guide')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
                  activeTab === 'testing_guide'
                    ? 'bg-[#006241] text-white shadow-xs'
                    : 'text-stone-700 hover:bg-stone-200/70'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <BookOpen className={`w-4 h-4 ${activeTab === 'testing_guide' ? 'text-white' : 'text-amber-600'}`} />
                  <span>Samouczek & Pilotaż</span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                  isTutorialMode ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-stone-200 text-stone-600'
                }`}>
                  {isTutorialMode ? 'WŁ' : 'WYŁ'}
                </span>
              </button>

              {/* TAB 6: Baza Danych & Kawiarnia */}
              <div className="pt-3">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  {isDeveloper ? 'System & Baza Floty' : 'System & Lokalne'}
                </div>

                {/* TAB: Baza Floty & Instalacje Firebase — WIDOCZNY WYŁĄCZNIE W WERSJI DEWELOPERSKIEJ / ADMIN */}
                {isDeveloper && (
                  <button
                    onClick={() => setActiveTab('firebase_fleet')}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer mb-1 ${
                      activeTab === 'firebase_fleet'
                        ? 'bg-[#1E3932] text-white shadow-xs'
                        : 'text-stone-700 hover:bg-stone-200/70'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Flame className={`w-4 h-4 ${activeTab === 'firebase_fleet' ? 'text-amber-400' : 'text-amber-500'}`} />
                      <span>Flota & Instalacje</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                      activeTab === 'firebase_fleet' ? 'bg-amber-950 text-amber-300' : 'bg-amber-100 text-amber-900'
                    }`}>
                      Dev / Firebase
                    </span>
                  </button>
                )}

                {/* TAB: Skalowanie & Wygląd (UI Zoom) */}
                <button
                  onClick={() => setActiveTab('appearance')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer mb-1 ${
                    activeTab === 'appearance'
                      ? 'bg-[#006241] text-white shadow-xs'
                      : 'text-stone-700 hover:bg-stone-200/70'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Monitor className={`w-4 h-4 ${activeTab === 'appearance' ? 'text-white' : 'text-[#006241]'}`} />
                    <span>Skalowanie & Wygląd</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold font-mono ${
                    activeTab === 'appearance' ? 'bg-emerald-900 text-emerald-200' : 'bg-stone-200 text-stone-700'
                  }`}>
                    {Math.round(currentZoom * 100)}%
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('system')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
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
                              monthly_salary: 0,
                              hourly_rate: 0,
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
                              <span className="text-xs text-stone-500 font-medium">Wynagr. (1.0):</span>
                              <input
                                type="number"
                                step="50"
                                min="0"
                                value={emp.monthly_salary !== undefined && emp.monthly_salary !== null ? (emp.monthly_salary === 0 ? '' : emp.monthly_salary) : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                                  const updated = [...employees];
                                  updated[eIdx] = { 
                                    ...emp, 
                                    monthly_salary: val,
                                    hourly_rate: val > 0 ? Number((val / 168).toFixed(2)) : 0
                                  };
                                  setEmployees(updated);
                                }}
                                placeholder="0"
                                className="w-24 bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs font-bold text-stone-900 text-center"
                              />
                              <span className="text-xs font-bold text-stone-600">zł/mc</span>
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
            {/* ZAKŁADKA 5: SAMOUCZEK & PRZEWODNIK PILOTAŻU KAWIARNI */}
            {/* ======================================================== */}
            {activeTab === 'testing_guide' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="border-b border-stone-200 pb-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-stone-900">
                        Samouczek & Przewodnik Pilotażu Kawiarni
                      </h3>
                      <span className="px-2 py-0.5 text-[10px] font-black bg-amber-400 text-amber-950 rounded-full uppercase">
                        Pilotaż Janki
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Zarządzaj trybem samouczka oraz przeglądaj instrukcje operacyjne dla gotowych Modułów 1 i 2.
                    </p>
                  </div>

                  {/* Przełącznik Główny Trybu Samouczka */}
                  <div className="flex items-center gap-3 bg-stone-100 p-1.5 px-3 rounded-2xl border border-stone-200">
                    <span className="text-xs font-bold text-stone-700">Tryb Samouczka:</span>
                    <button
                      type="button"
                      onClick={toggleTutorialMode}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isTutorialMode ? 'bg-[#006241]' : 'bg-stone-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isTutorialMode ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className={`text-xs font-black ${isTutorialMode ? 'text-[#006241]' : 'text-stone-400'}`}>
                      {isTutorialMode ? 'WŁĄCZONY' : 'WYŁĄCZONY'}
                    </span>
                  </div>
                </div>

                {/* Status Trybu Samouczka & Ikonki (i) */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  isTutorialMode
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-stone-50 border-stone-200 text-stone-700'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                      isTutorialMode ? 'bg-emerald-500 text-slate-950 shadow-xs' : 'bg-stone-200 text-stone-500'
                    }`}>
                      i
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="font-black text-sm flex items-center gap-2">
                        <span>{isTutorialMode ? 'Ikonki Informacyjne (i) są AKTYWNE' : 'Ikonki Informacyjne (i) są WYŁĄCZONE'}</span>
                        {isTutorialMode && (
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full font-bold">
                            Zalecane
                          </span>
                        )}
                      </div>
                      <p className="mt-1 leading-relaxed text-stone-600">
                        {isTutorialMode
                          ? 'W widokach Modułu 1 (TPLH) i Modułu 2 (Grafik) obok każdej większej funkcji wyświetlana jest klikalna ikonka (i), w której możesz przeczytać jak działa dana funkcja i jakich reguł Starbucks / Kodeksu Pracy przestrzega.'
                          : 'Aplikacja działa w trybie minimalistycznym bez dodatkowych ikonek (i). W każdej chwili możesz je ponownie włączyć jednym kliknięciem.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* BANER URUCHOMIENIA ANIMOWANEGO SAMOUCZKA MODELOWEGO */}
                <div className="p-4 bg-gradient-to-r from-[#1E3932] via-[#0f2d22] to-[#0a1e16] rounded-2xl border border-emerald-500/40 text-white flex items-center justify-between gap-4 shadow-md flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/30 shrink-0">
                      <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">Animowany Samouczek Interaktywny (5 Scen)</h4>
                      <p className="text-[11px] text-emerald-200/80 mt-0.5">
                        Uruchom dynamiczną prezentację modelową TPLH, ochrony Floor 32h, 4 Tarcz KP i generatora AI.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openModelTour(1);
                    }}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>▶ Uruchom Animację Modelową</span>
                  </button>
                </div>

                {/* 4 KAFLE PRZEWODNIKA DO OTWARCIA W MODALU */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                    Interaktywne Sekcje Przewodnika Pilotażowego
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Karta 1: Moduł 1 TPLH */}
                    <div className="p-4 bg-stone-50 hover:bg-emerald-50/40 transition-all rounded-2xl border border-stone-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-[#006241]" />
                            <span className="text-xs font-black text-stone-900">Moduł 1: TPLH & Robocizna</span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md">
                            v1.0 Gotowy
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 mt-2 leading-relaxed">
                          Poznaj mechanizmy predykcji MTD Velocity, bazę Floor Hours (32h/dzień), pulę Flex dla baristów oraz algorytm Flash Forecast Poniedziałek.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          openModelTour(1, 'tplh');
                        }}
                        className="w-full py-2 bg-[#006241] hover:bg-[#00754A] text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Otwórz Samouczek TPLH (5 Scen) ➔</span>
                      </button>
                    </div>

                    {/* Karta 2: Moduł 2 Grafik */}
                    <div className="p-4 bg-stone-50 hover:bg-emerald-50/40 transition-all rounded-2xl border border-stone-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-[#006241]" />
                            <span className="text-xs font-black text-stone-900">Moduł 2: Managers Schedule</span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md">
                            v1.0 Gotowy
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 mt-2 leading-relaxed">
                          Sprawdź 4 Tarcze Kodeksu Pracy, silnik AutoScheduling AI (20k prób), asystenta kompromisów WhatsApp, Smart Paste z Excela oraz rozliczenie TOR.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          openModelTour(1, 'schedule');
                        }}
                        className="w-full py-2 bg-[#006241] hover:bg-[#00754A] text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Otwórz Samouczek Grafiku (6 Scen) ➔</span>
                      </button>
                    </div>

                    {/* Karta 3: Samouczek Ustawień */}
                    <div className="p-4 bg-stone-50 hover:bg-amber-50/40 transition-all rounded-2xl border border-stone-200 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-amber-600" />
                            <span className="text-xs font-black text-stone-900">Samouczek Ustawień & Importu</span>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-900 font-bold rounded-md">
                            6 Scen
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 mt-2 leading-relaxed">
                          Poznaj wszystkie opcje konfiguracyjne: AOP, Non-Coverage, Floor Hours, katalog zmian, skład 7 kierowników, normy KP 10 lat, COL ZUS 19.48% oraz kopie SQLite.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          openModelTour(1, 'settings');
                        }}
                        className="w-full py-2 bg-[#006241] hover:bg-[#00754A] text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>Otwórz Samouczek Ustawień ➔</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* ZAKŁADKI: POWIADOMIENIA W APLIKACJI & E-MAIL (RESEND) */}
            {/* ======================================================== */}
            {activeTab === 'notifications_app' && (
              <NotificationsSettingsTab initialMode="desktop" onRefreshData={onRefreshData} />
            )}
            {activeTab === 'notifications_email' && (
              <NotificationsSettingsTab initialMode="email" onRefreshData={onRefreshData} />
            )}
            {activeTab === 'notifications' && (
              <NotificationsSettingsTab initialMode="desktop" onRefreshData={onRefreshData} />
            )}

            {/* ======================================================== */}
            {/* ZAKŁADKA: FLOTA & BAZA INSTALACJI (FIREBASE FIRESTORE — TYLKO DEV) */}
            {/* ======================================================== */}
            {isDeveloper && activeTab === 'firebase_fleet' && (
              <FirebaseFleetPanel />
            )}

            {/* ======================================================== */}
            {/* ZAKŁADKA: SKALOWANIE & WYGLĄD INTERFEJSU (UI ZOOM) */}
            {/* ======================================================== */}
            {activeTab === 'appearance' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="border-b border-stone-200 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-[#006241]" />
                        <span>Skalowanie Interfejsu & Gęstość Widoku (UI Zoom)</span>
                      </h3>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Dostosuj optymalną skalę renderowania (70% – 135%) do rozdzielczości ekranu (MacBook 13"/14", monitor biurowy 24"-27", ekrany 4K).
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-500 font-bold">Bieżąca skala:</span>
                      <span className="px-3 py-1 rounded-xl bg-[#006241] text-white text-sm font-black font-mono shadow-xs">
                        {Math.round(currentZoom * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Główny panel suwaka i presetów */}
                <div className="p-6 bg-gradient-to-br from-stone-50 via-white to-emerald-50/20 rounded-3xl border border-stone-200 shadow-xs space-y-6">
                  {/* Suwak płynnej regulacji */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                        <Sliders className="w-4 h-4 text-[#006241]" />
                        <span>Płynna regulacja powiększenia</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => zoomService.zoomOut(0.05)}
                          className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl text-stone-800 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                          title="Pomniejsz o 5% (Cmd + -)"
                        >
                          -5%
                        </button>
                        <button
                          type="button"
                          onClick={() => zoomService.resetZoom()}
                          className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl text-stone-800 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                          title="Przywróć 100% (Cmd + 0)"
                        >
                          100% (Reset)
                        </button>
                        <button
                          type="button"
                          onClick={() => zoomService.zoomIn(0.05)}
                          className="px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl text-stone-800 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                          title="Powiększ o 5% (Cmd + +)"
                        >
                          +5%
                        </button>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                        <span className="flex items-center gap-1">
                          <ZoomOut className="w-4 h-4 text-stone-400" />
                          <span>70% (Minimalne)</span>
                        </span>
                        <span className="text-[#006241] font-black text-base font-mono">
                          {Math.round(currentZoom * 100)}%
                        </span>
                        <span className="flex items-center gap-1">
                          <span>135% (Maksymalne)</span>
                          <ZoomIn className="w-4 h-4 text-stone-400" />
                        </span>
                      </div>

                      <input
                        type="range"
                        min="70"
                        max="135"
                        step="1"
                        value={Math.round(currentZoom * 100)}
                        onChange={(e) => zoomService.setZoom(parseInt(e.target.value, 10) / 100)}
                        className="w-full accent-[#006241] cursor-pointer h-2 bg-stone-200 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Kafelki rekomendowanych presetów */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-stone-700">
                      Rekomendowane Presety wg Typu Wyświetlacza
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { val: 0.75, label: '75%', desc: 'Monitory 4K & Ultrawide' },
                        { val: 0.85, label: '85%', desc: 'Biurowy 24" – 27"' },
                        { val: 0.90, label: '90%', desc: 'Laptop 15" – 16"' },
                        { val: 1.00, label: '100%', desc: 'Domyślny Starbucks 1:1' },
                        { val: 1.10, label: '110%', desc: 'Komfortowy / Większy' },
                        { val: 1.15, label: '115%', desc: 'MacBook Air / Pro 13"' },
                        { val: 1.25, label: '125%', desc: 'Maksymalna czytelność' },
                        { val: 1.35, label: '135%', desc: 'Powiększenie dla prezentacji' },
                      ].map((item) => {
                        const isCurrent = Math.abs(currentZoom - item.val) < 0.02;
                        return (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() => zoomService.setZoom(item.val)}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-[#006241] text-white border-[#006241] shadow-md ring-2 ring-emerald-500/20'
                                : 'bg-white hover:bg-stone-50 text-stone-800 border-stone-200 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-black font-mono ${isCurrent ? 'text-white' : 'text-stone-900'}`}>
                                {item.label}
                              </span>
                              {isCurrent && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                              )}
                            </div>
                            <p className={`text-[10px] mt-1 line-clamp-1 ${isCurrent ? 'text-emerald-100' : 'text-stone-500'}`}>
                              {item.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Sekcja Podglądu na żywo (Live Interactive Preview) */}
                <div className="p-5 bg-stone-50 rounded-3xl border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#CBA258]" />
                      <span>Podgląd Renderowania Elementów w Bieżącej Skali</span>
                    </span>
                    <span className="text-[11px] text-stone-500">
                      Wszystkie moduły skalują się bez utraty ostrości czcionek i ikon
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Przykładowy kafelek AOP */}
                    <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-stone-500">
                        <span>Budżet TPLH (W+2)</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[#006241] text-[10px] font-mono font-black">6.70 Cel</span>
                      </div>
                      <div className="text-lg font-black text-stone-900 font-mono">2 140.5 h</div>
                      <div className="text-[10px] text-stone-500 flex justify-between">
                        <span>Transakcje (TRX):</span>
                        <strong className="text-stone-800">14 340</strong>
                      </div>
                    </div>

                    {/* Przykładowa zmiana grafiku */}
                    <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-stone-500">
                        <span>Dyżur Menedżerski</span>
                        <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 text-[10px] font-mono">08:00 - 16:30</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-xl bg-[#006241] text-white text-xs font-black">AM 8h</span>
                        <span className="text-xs font-bold text-stone-800">Kierownik Zmiany</span>
                      </div>
                      <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Odpoczynek 11h Kodeksu Pracy zachowany</span>
                      </div>
                    </div>

                    {/* Skróty Klawiszowe */}
                    <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-2xs space-y-2">
                      <div className="text-[11px] font-bold text-stone-500">Skróty Klawiaturowe (Globalne)</div>
                      <div className="text-xs space-y-1 text-stone-700">
                        <div className="flex justify-between items-center">
                          <span>Powiększ (+5%):</span>
                          <kbd className="px-1.5 py-0.5 bg-stone-100 border border-stone-300 rounded text-[10px] font-mono font-bold">Cmd +</kbd>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Pomniejsz (-5%):</span>
                          <kbd className="px-1.5 py-0.5 bg-stone-100 border border-stone-300 rounded text-[10px] font-mono font-bold">Cmd -</kbd>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Reset (100%):</span>
                          <kbd className="px-1.5 py-0.5 bg-stone-100 border border-stone-300 rounded text-[10px] font-mono font-bold">Cmd 0</kbd>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* ZAKŁADKA 6: SYSTEM & BAZA */}
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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Store className="w-5 h-5 text-[#006241]" />
                          <h4 className="text-sm font-bold text-stone-900">Jednostka & Profil Operacyjny</h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-[#006241] font-bold border border-emerald-300">
                          Lokal Aktywny
                        </span>
                      </div>
                      <div className="text-xs space-y-1.5 text-stone-600">
                        <div className="flex justify-between">
                          <span className="text-stone-500">Kawiarnia:</span>
                          <strong className="text-stone-900">{currentStore.name}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Kod jednostki (Unit Code):</span>
                          <strong className="text-stone-900">{currentStore.unitCode}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Kod MPK:</span>
                          <strong className="text-stone-900">{currentStore.mpk}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Miasto / Dystrykt:</span>
                          <span className="text-stone-800">{currentStore.city} • {currentStore.district}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-stone-200">
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

                      <button
                        onClick={openStoreSwitcher}
                        className="w-full mt-2.5 px-3 py-2 bg-white hover:bg-emerald-50 border border-stone-300 hover:border-[#006241] text-[#006241] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs group"
                      >
                        <Store className="w-3.5 h-3.5 text-[#CBA258]" />
                        <span>Przełącz lub Dodaj Kawiarnię...</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>

                    {/* Karta Skalowania Interfejsu & Gęstości Widoku (UI Zoom) */}
                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between pb-2 border-b border-stone-200/80">
                          <div className="flex items-center gap-2">
                            <Monitor className="w-5 h-5 text-[#006241]" />
                            <h4 className="text-sm font-bold text-stone-900">Skalowanie Interfejsu (UI Zoom)</h4>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-[#006241] text-white text-[11px] font-black font-mono">
                            {Math.round(currentZoom * 100)}%
                          </span>
                        </div>

                        <p className="text-xs text-stone-500 mt-2">
                          Dostosuj skalę do ekranu (MacBook 13" vs monitor biurowy 27").
                        </p>

                        {/* Suwak regulacji */}
                        <div className="mt-3 space-y-2 bg-white p-3 rounded-xl border border-stone-200">
                          <div className="flex items-center justify-between text-[11px] font-bold text-stone-600">
                            <span className="flex items-center gap-1">
                              <ZoomOut className="w-3 h-3 text-stone-400" />
                              <span>70%</span>
                            </span>
                            <span className="text-[#006241] font-black text-xs font-mono">
                              {Math.round(currentZoom * 100)}%
                            </span>
                            <span className="flex items-center gap-1">
                              <span>135%</span>
                              <ZoomIn className="w-3 h-3 text-stone-400" />
                            </span>
                          </div>

                          <input
                            type="range"
                            min="70"
                            max="135"
                            step="1"
                            value={Math.round(currentZoom * 100)}
                            onChange={(e) => zoomService.setZoom(parseInt(e.target.value, 10) / 100)}
                            className="w-full accent-[#006241] cursor-pointer"
                          />

                          {/* Przyciski Presetów */}
                          <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-stone-100">
                            {[0.80, 0.90, 1.00, 1.10, 1.25].map((val) => {
                              const isCurrent = Math.abs(currentZoom - val) < 0.02;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => zoomService.setZoom(val)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                    isCurrent
                                      ? 'bg-[#006241] text-white'
                                      : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                                  }`}
                                >
                                  {Math.round(val * 100)}%
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Stopka z przyciskami krokowymi i skrótami */}
                      <div className="pt-2 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => zoomService.zoomOut(0.05)}
                            className="px-2 py-1 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg text-stone-800 text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                            title="Pomniejsz o 5% (Cmd + -)"
                          >
                            -5%
                          </button>
                          <button
                            type="button"
                            onClick={() => zoomService.resetZoom()}
                            className="px-2 py-1 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg text-stone-800 text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                            title="Przywróć 100% (Cmd + 0)"
                          >
                            100%
                          </button>
                          <button
                            type="button"
                            onClick={() => zoomService.zoomIn(0.05)}
                            className="px-2 py-1 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg text-stone-800 text-[11px] font-bold shadow-2xs transition-colors cursor-pointer"
                            title="Powiększ o 5% (Cmd + +)"
                          >
                            +5%
                          </button>
                        </div>

                        <span className="text-[10px] text-stone-400 font-mono">
                          Skróty: <kbd className="font-bold">Cmd +/-/0</kbd>
                        </span>
                      </div>
                    </div>

                    {/* Karta 2: Autodiagnostyka & Zdrowie Bazy SQLite (PRAGMA integrity_check & VACUUM) */}
                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3.5 col-span-1 md:col-span-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-[#006241] border border-emerald-200 shadow-2xs">
                            <Activity className="w-4 h-4 text-[#006241]" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                              <span>Autodiagnostyka & Zdrowie Bazy SQLite</span>
                              {dbHealth?.integrity === 'ok' ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-[#006241] text-[10px] font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  100% Spójna (OK)
                                </span>
                              ) : dbHealth ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-bold">
                                  Błąd Spójności
                                </span>
                              ) : null}
                            </h4>
                            <p className="text-[11px] text-stone-500 mt-0.5">
                              Test integralności PRAGMA integrity_check, optymalizacja pamięci podręcznej VACUUM i stan kopii.
                            </p>
                          </div>
                        </div>

                        {/* Przyciski szybkiej diagnostyki i VACUUM */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={handleCheckDbIntegrity}
                            disabled={isCheckingDbHealth}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 text-xs font-bold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Uruchamia PRAGMA integrity_check"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 text-stone-500 ${isCheckingDbHealth ? 'animate-spin' : ''}`} />
                            <span>{isCheckingDbHealth ? 'Testowanie...' : 'Test Spójności'}</span>
                          </button>

                          <button
                            onClick={handleOptimizeDb}
                            disabled={isOptimizingDb}
                            className="px-2.5 py-1.5 rounded-xl bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Uruchamia VACUUM oraz PRAGMA optimize"
                          >
                            <Zap className={`w-3.5 h-3.5 text-[#CBA258] ${isOptimizingDb ? 'animate-bounce' : ''}`} />
                            <span>{isOptimizingDb ? 'Optymalizowanie...' : 'Optymalizuj (VACUUM)'}</span>
                          </button>

                          {onOpenBackupModal && (
                            <button
                              onClick={() => {
                                onClose();
                                onOpenBackupModal();
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Database className="w-3.5 h-3.5 text-stone-300" />
                              <span>Menedżer Kopii</span>
                            </button>
                          )}

                          {onOpenCloudDocsModal && (
                            <button
                              onClick={() => {
                                onClose();
                                onOpenCloudDocsModal();
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                              title="Dokumenty bez danych wrażliwych zsynchronizowane z chmurą Firebase"
                            >
                              <Cloud className="w-3.5 h-3.5 text-blue-200" />
                              <span>Dokumenty Chmury (Firebase)</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Komunikat z wykonanej akcji */}
                      {dbHealthActionMsg && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between animate-in fade-in">
                          <span>{dbHealthActionMsg}</span>
                          <button onClick={() => setDbHealthActionMsg(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold">✕</button>
                        </div>
                      )}

                      {/* Ostrzeżenie o zaległej kopii */}
                      {dbHealth?.isBackupOverdue && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2 animate-in fade-in">
                          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong>Zalecana kopia bezpieczeństwa:</strong> Od ostatniego zapisu minęło{' '}
                            {dbHealth.daysSinceLastBackup !== undefined ? `${dbHealth.daysSinceLastBackup} dni (zalecane max 7 dni).` : 'nieznana liczba dni (brak kopii).'}
                          </div>
                        </div>
                      )}

                      {/* Metryki */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                          <span className="text-[10px] text-stone-400 font-bold uppercase block">Rozmiar Bazy</span>
                          <span className="font-black text-stone-900 text-sm">{dbHealth?.sizeFormatted || '—'}</span>
                          <span className="text-[10px] text-stone-500 block mt-0.5">{dbHealth?.pageCount || 0} stron</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                          <span className="text-[10px] text-stone-400 font-bold uppercase block">Pofragmentowane</span>
                          <div className="flex items-center gap-1">
                            <span className="font-black text-stone-900 text-sm">{dbHealth?.wastedFormatted || '0.0 KB'}</span>
                            {dbHealth?.wastedBytes && dbHealth.wastedBytes > 128 * 1024 ? (
                              <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 font-bold">VACUUM</span>
                            ) : null}
                          </div>
                          <span className="text-[10px] text-stone-500 block mt-0.5">Freelist: {dbHealth?.freelistCount || 0} stron</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                          <span className="text-[10px] text-stone-400 font-bold uppercase block">Zarchiwizowane Wiersze</span>
                          <span className="font-black text-emerald-800 text-sm">{dbHealth?.totalRecordsCount.toLocaleString('pl-PL') || '—'}</span>
                          <span className="text-[10px] text-stone-500 block mt-0.5">15 tabel operacyjnych</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                          <span className="text-[10px] text-stone-400 font-bold uppercase block">Kopie Zapasowe</span>
                          <span className="font-black text-stone-900 text-sm">{dbHealth?.backupsCount || 0} kopii</span>
                          <span className="text-[10px] text-stone-500 block mt-0.5">Ostatnia: {dbHealth?.lastBackupFormatted?.split(',')[0] || 'brak'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Karta 4: Aktualizacje Online */}
                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-[#006241]" />
                          <h4 className="text-sm font-bold text-stone-900">Aktualizacje Online (OTA)</h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-[#006241] font-bold rounded-md">
                          {localStorage.getItem('sbx_auto_update_enabled') !== 'false' ? 'Auto-Update: WŁ' : 'Auto-Update: WYŁ'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600">
                        Aplikacja automatycznie w tle pobiera mikropatche OTA i instaluje nowe funkcje bez utraty danych SQLite.
                      </p>
                      {onOpenUpdateModal && (
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              onClose();
                              onOpenUpdateModal();
                            }}
                            className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>{hasUpdateAvailable ? 'Dostępna nowa wersja!' : 'Centrum Aktualizacji & Auto-Update'}</span>
                          </button>

                          <button
                            onClick={() => {
                              onClose();
                              onOpenUpdateModal();
                            }}
                            className="w-full py-1.5 px-3 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-[11px] font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <History className="w-3.5 h-3.5 text-[#006241]" />
                            <span>Otwórz Dziennik Zmian & Co Nowego ➔</span>
                          </button>
                        </div>
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

                    {/* Karta 6: Profil Operacyjny & Skrót do Powiadomień */}
                    <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className="w-5 h-5 text-[#006241]" />
                          <h4 className="text-sm font-bold text-stone-900">Powiadomienia & E-mail</h4>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-[#006241] font-bold rounded-md">
                          Resend Cloud ✓
                        </span>
                      </div>

                      <div className="text-xs text-stone-600 space-y-1.5 bg-white p-3 rounded-xl border border-stone-200">
                        <div className="flex justify-between">
                          <span className="text-stone-500">Adres e-mail powiadomień:</span>
                          <strong className="text-stone-900 font-mono text-[11px]">
                            {localStorage.getItem('sbx_user_email') || 'apeldawid@gmail.com'}
                          </strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Alerty Kodeksu Pracy:</span>
                          <span className="text-emerald-700 font-bold">Aktywne ✓</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-500">Publikacja Grafiku (7 dni):</span>
                          <span className="text-emerald-700 font-bold">Aktywne ✓</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setActiveTab('notifications')}
                        className="w-full py-2 px-3 bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Bell className="w-3.5 h-3.5 text-[#CBA258]" />
                        <span>Otwórz Centrum Powiadomień & Studio Szablonów ➔</span>
                      </button>
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
