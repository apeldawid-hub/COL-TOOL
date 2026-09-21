import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { OnboardingWizardView } from './components/OnboardingWizardView';
import { DashboardView } from './components/DashboardView';
import { ModulePlaceholderView } from './components/ModulePlaceholderView';
import { DatabaseBackupModal } from './components/DatabaseBackupModal';
import { AppUpdateModal } from './components/AppUpdateModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BugReporterModal } from './components/BugReporterModal';
import {
  LaborForecastView,
  ImportModal,
  CalculationEngine
} from './modules/labor-forecast';
import { ManagerScheduleView } from './modules/managers-schedule';
import { TrainingsView } from './modules/trainings';
import { ColCalculatorView } from './modules/col-calculator';
import { ModuleDateBar } from './components/ModuleDateBar';
import { UnifiedSettingsModal } from './components/UnifiedSettingsModal';
import { ComingSoonOverlayWrapper } from './components/ComingSoonOverlayWrapper';
import {
  AppModule,
  AopPlanRecord,
  WeekRecord,
  MonthlyCalculationSummary,
  NcRuleRecord,
  ManagerScheduleShift,
  ShiftDefinition,
  ManagerEmployee,
  WeeklyCalculatedRow,
} from './types';

import { SystemClock } from './services/systemClock';
import { useSystemClock } from './hooks/useSystemClock';

// Domyślna lista miesięcy po polsku
const DEFAULT_MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

export const App: React.FC = () => {
  // Stan pierwszego uruchomienia / Menu Startowego (Onboarding)
  // null = trwa weryfikacja z bazą SQLite / ustawieniami, true = ukończono, false = nowe uruchomienie
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(() => {
    try {
      if (localStorage.getItem('sbx_onboarding_completed') === 'true') {
        return true;
      }
    } catch {}
    return null;
  });

  // Weryfikacja i synchronizacja konfiguracji początkowej z bazą SQLite
  useEffect(() => {
    let isMounted = true;
    const checkOnboardingState = async () => {
      try {
        const apiObj = (window as any).api || (window as any).electronAPI;
        if (apiObj?.getAppSettings) {
          const res = await apiObj.getAppSettings();
          if (res && isMounted) {
            const { settings, hasCompletedOnboarding: isCompleted, hasExistingData } = res;
            if (isCompleted || hasExistingData) {
              setHasCompletedOnboarding(true);
              try {
                localStorage.setItem('sbx_onboarding_completed', 'true');
                if (settings?.store_name) localStorage.setItem('sbx_store_name', settings.store_name);
                if (settings?.unit_code) localStorage.setItem('sbx_unit_code', settings.unit_code);
                if (settings?.user_name) localStorage.setItem('sbx_user_name', settings.user_name);
                if (settings?.user_role) localStorage.setItem('sbx_user_role', settings.user_role);
                if (settings?.user_email) localStorage.setItem('sbx_user_email', settings.user_email);
              } catch {}

              if (settings?.user_name && settings?.user_role) {
                setLoggedInUser(`${settings.user_name} (${settings.user_role.replace(/[^A-Z]/g, '')})`);
              } else if (settings?.user_role) {
                setLoggedInUser(settings.user_role);
              }
              return;
            } else {
              setHasCompletedOnboarding(false);
              return;
            }
          }
        }
      } catch (err) {
        console.error('Błąd weryfikacji app_settings z bazy:', err);
      }

      if (isMounted) {
        try {
          setHasCompletedOnboarding(localStorage.getItem('sbx_onboarding_completed') === 'true');
        } catch {
          setHasCompletedOnboarding(false);
        }
      }
    };

    checkOnboardingState();
    return () => {
      isMounted = false;
    };
  }, []);

  // Stan sesji logowania (aplikacja startuje z ekranem logowania lub kreatorem)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loggedInUser, setLoggedInUser] = useState<string>(() => {
    try {
      const savedName = localStorage.getItem('sbx_user_name');
      const savedRole = localStorage.getItem('sbx_user_role');
      if (savedName && savedRole) return `${savedName} (${savedRole.replace(/[^A-Z]/g, '')})`;
      if (savedRole) return savedRole;
    } catch {}
    return 'Store Manager (SM)';
  });

  // Aktywny moduł aplikacji (domyślnie 'dashboard' po zalogowaniu)
  const [activeModule, setActiveModule] = useState<AppModule>('dashboard');

  // Stan zwinięcia paska bocznego (sidebar) — domyślnie zwinięty po zalogowaniu
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);

  // Systemowy zegar pracujący cicho w tle (niewidoczny w UI)
  const systemClock = useSystemClock();

  const [selectedYear, setSelectedYear] = useState<number>(() => SystemClock.now().year);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => SystemClock.now().monthName);
  const [availableYears, setAvailableYears] = useState<number[]>([2026]);
  const [availableMonths, setAvailableMonths] = useState<string[]>(DEFAULT_MONTHS);

  const [aopPlan, setAopPlan] = useState<AopPlanRecord | null>(null);
  const [weeks, setWeeks] = useState<WeekRecord[]>([]);
  const [actualHoursMap, setActualHoursMap] = useState<Record<string, number>>({});
  const [weeklyTrxMap, setWeeklyTrxMap] = useState<Record<string, number | null>>({});
  const [scheduledHoursMap, setScheduledHoursMap] = useState<Record<string, number>>({});
  const [targetWeekKeyOverride, setTargetWeekKeyOverride] = useState<string | null>(null);
  const [historicalPlans, setHistoricalPlans] = useState<AopPlanRecord[]>([]);
  const [ncRules, setNcRules] = useState<NcRuleRecord[]>([]);
  const [dayOfWeekStats, setDayOfWeekStats] = useState<any[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<'floor_safe' | 'balanced' | 'growth'>('balanced');

  // Stan grafiku menedżerskiego dla integracji z Modułem 1 (Labor Forecast)
  const [managerShifts, setManagerShifts] = useState<ManagerScheduleShift[]>([]);
  const [shiftDefinitions, setShiftDefinitions] = useState<ShiftDefinition[]>([]);
  const [managerEmployees, setManagerEmployees] = useState<ManagerEmployee[]>([]);
  const [activeBridgeWeekRow, setActiveBridgeWeekRow] = useState<WeeklyCalculatedRow | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBugReporterOpen, setIsBugReporterOpen] = useState<boolean>(false);
  const [activeViewerWeek, setActiveViewerWeek] = useState<{
    key: string;
    label: string;
  } | null>(null);

  // Inicjalizacja listy lat
  useEffect(() => {
    const initYears = async () => {
      if ((window as any).api?.getAvailableYears) {
        try {
          const yrs = await (window as any).api.getAvailableYears();
          if (yrs && yrs.length > 0) setAvailableYears(yrs);
        } catch (err) {
          console.error('Błąd pobierania lat:', err);
        }
      }
    };
    initYears();

    // Nasłuchiwanie automatycznych aktualizacji w tle
    if (typeof window !== 'undefined' && (window as any).api?.onUpdaterEvent) {
      const unsubscribe = (window as any).api.onUpdaterEvent((payload: any) => {
        if (payload.status === 'available' || payload.status === 'downloaded') {
          setHasUpdateAvailable(true);
        } else if (payload.status === 'not-available') {
          setHasUpdateAvailable(false);
        }
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, []);

  // Załadowanie danych dla wybranego roku i miesiąca
  const loadMonthData = useCallback(async () => {
    setIsLoading(true);
    try {
      if ((window as any).api?.getAopPlan) {
        const monthNum = DEFAULT_MONTHS.indexOf(selectedMonth) + 1;
        const [plan, loadedWeeks, hours, trx, sched, allPlans, loadedNcRules, loadedDayStats, mgrData] = await Promise.all([
          (window as any).api.getAopPlan(selectedYear, selectedMonth),
          (window as any).api.getWeeksForMonth(selectedYear, selectedMonth),
          (window as any).api.getActualHoursForMonth(selectedYear, selectedMonth),
          (window as any).api.getWeeklyActualTrxMap(selectedYear, selectedMonth),
          (window as any).api.getWeeklyScheduledHoursMap
            ? (window as any).api.getWeeklyScheduledHoursMap(selectedYear, selectedMonth)
            : Promise.resolve({}),
          (window as any).api.getAllHistoricalAopPlans
            ? (window as any).api.getAllHistoricalAopPlans()
            : (window as any).api.getAopPlansForYear
            ? (window as any).api.getAopPlansForYear(selectedYear)
            : Promise.resolve([]),
          (window as any).api.getNcRules
            ? (window as any).api.getNcRules()
            : Promise.resolve([]),
          (window as any).api.getDayOfWeekStats
            ? (window as any).api.getDayOfWeekStats()
            : Promise.resolve([]),
          (window as any).api.getManagerScheduleData
            ? (window as any).api.getManagerScheduleData(selectedYear, monthNum)
            : Promise.resolve(null),
        ]);

        if (plan) {
          setAopPlan(plan);
        } else {
          setAopPlan({
            key: `${selectedYear}_${selectedMonth}`,
            year: selectedYear,
            month: selectedMonth,
            month_code: `M${String(DEFAULT_MONTHS.indexOf(selectedMonth) + 1).padStart(2, '0')}`,
            weeks_count: loadedWeeks ? loadedWeeks.length : 5,
            plan_trx: 0,
            target_tplh: 6.7,
            labor_budget: 0,
            avg_weekly_hours: 0,
            plan_sales: 0
          });
        }
        if (loadedWeeks) setWeeks(loadedWeeks);
        if (hours) setActualHoursMap(hours);
        if (trx) setWeeklyTrxMap(trx);
        if (sched) setScheduledHoursMap(sched);
        if (allPlans) setHistoricalPlans(allPlans);
        if (loadedNcRules && loadedNcRules.length > 0) setNcRules(loadedNcRules);
        if (loadedDayStats) setDayOfWeekStats(loadedDayStats);
        if (mgrData) {
          const allShifts: ManagerScheduleShift[] = [
            ...(mgrData.boundaryShifts?.prevMonthShifts || []),
            ...(mgrData.shifts || []),
            ...(mgrData.boundaryShifts?.nextMonthShifts || []),
          ];
          setManagerShifts(allShifts);
          if (mgrData.shiftDefinitions) setShiftDefinitions(mgrData.shiftDefinitions);
          if (mgrData.employees) setManagerEmployees(mgrData.employees);
        }
      } else {
        // Mock fallback do testów w przeglądarce
        console.warn('Uruchomiono poza Electronem - używanie mockowych danych demonstracyjnych.');
        const mockPlan: AopPlanRecord = {
          key: `${selectedYear}_${selectedMonth}`,
          year: selectedYear,
          month: selectedMonth,
          month_code: 'M09',
          weeks_count: 5,
          plan_trx: 10830,
          target_tplh: 6.7,
          labor_budget: 1616.4,
          avg_weekly_hours: 323.3,
        };
        const mockWeeks: WeekRecord[] = [
          {
            week_key: `${selectedYear}_${selectedMonth}_W1`,
            year: selectedYear,
            month_name: selectedMonth,
            week_num_in_month: 'W1',
            days_count: 7,
            week_type: 'Pełny (7 dni)',
            date_from: '01.09',
            date_to: '07.09',
            floor_hours: 272.0,
            day_weight: 0.23333,
          },
          {
            week_key: `${selectedYear}_${selectedMonth}_W2`,
            year: selectedYear,
            month_name: selectedMonth,
            week_num_in_month: 'W2',
            days_count: 7,
            week_type: 'Pełny (7 dni)',
            date_from: '08.09',
            date_to: '14.09',
            floor_hours: 272.0,
            day_weight: 0.23333,
          },
          {
            week_key: `${selectedYear}_${selectedMonth}_W3`,
            year: selectedYear,
            month_name: selectedMonth,
            week_num_in_month: 'W3',
            days_count: 7,
            week_type: 'Pełny (7 dni)',
            date_from: '15.09',
            date_to: '21.09',
            floor_hours: 272.0,
            day_weight: 0.23333,
          },
          {
            week_key: `${selectedYear}_${selectedMonth}_W4`,
            year: selectedYear,
            month_name: selectedMonth,
            week_num_in_month: 'W4',
            days_count: 7,
            week_type: 'Pełny (7 dni)',
            date_from: '22.09',
            date_to: '28.09',
            floor_hours: 272.0,
            day_weight: 0.23333,
          },
          {
            week_key: `${selectedYear}_${selectedMonth}_W5`,
            year: selectedYear,
            month_name: selectedMonth,
            week_num_in_month: 'W5',
            days_count: 2,
            week_type: 'Niepełny (2 dni)',
            date_from: '29.09',
            date_to: '30.09',
            floor_hours: 80.0,
            day_weight: 0.06667,
          },
        ];
        setAopPlan(mockPlan);
        setWeeks(mockWeeks);
        setActualHoursMap({
          [`${selectedYear}_${selectedMonth}_W1`]: 333.9,
          [`${selectedYear}_${selectedMonth}_W2`]: 43.4,
        });
        setWeeklyTrxMap({
          [`${selectedYear}_${selectedMonth}_W1`]: 2050,
        });
      }
    } catch (err) {
      console.error('Błąd ładowania danych miesiąca:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    loadMonthData();

    // Nasłuchiwanie na odświeżenie danych z Electrona
    if ((window as any).api?.onRefreshData) {
      (window as any).api.onRefreshData(() => {
        loadMonthData();
      });
    }
  }, [loadMonthData, activeModule]);

  // Zapisanie wprowadzonych przez Store Managera transakcji TRX
  const handleSaveTrx = async (weekKey: string, trx: number | null) => {
    setWeeklyTrxMap((prev) => ({
      ...prev,
      [weekKey]: trx,
    }));

    if ((window as any).api?.saveWeeklyTrx) {
      try {
        await (window as any).api.saveWeeklyTrx(weekKey, trx);
      } catch (err) {
        console.error('Błąd zapisu TRX:', err);
      }
    }
  };

  // Zapisanie wprowadzonych przez Store Managera zaplanowanych godzin (Scheduled Hours)
  const handleSaveScheduledHours = async (weekKey: string, hours: number | null) => {
    setScheduledHoursMap((prev) => {
      const copy = { ...prev };
      if (hours === null || hours <= 0) {
        delete copy[weekKey];
      } else {
        copy[weekKey] = hours;
      }
      return copy;
    });

    if ((window as any).api?.saveWeeklyScheduledHours) {
      try {
        await (window as any).api.saveWeeklyScheduledHours(weekKey, hours);
      } catch (err) {
        console.error('Błąd zapisu zaplanowanych godzin:', err);
      }
    }
  };

  // Wyliczanie metryk
  let summary: MonthlyCalculationSummary | null = null;
  if (aopPlan && weeks.length > 0) {
    summary = CalculationEngine.calculateMonth(
      aopPlan,
      weeks,
      weeklyTrxMap,
      actualHoursMap,
      scheduledHoursMap,
      targetWeekKeyOverride,
      historicalPlans,
      ncRules,
      dayOfWeekStats,
      managerShifts,
      shiftDefinitions,
      managerEmployees
    );

    if (summary && summary.trendLearning) {
      summary.trendLearning.activeStrategy = selectedStrategy;
    }
  }

  // 0. Ekran Ładowania Startowego (Weryfikacja bazy danych i profilu)
  if (hasCompletedOnboarding === null) {
    return (
      <div className="h-screen w-screen bg-[#1E3932] flex flex-col items-center justify-center select-none text-white">
        <div className="w-16 h-16 rounded-2xl bg-[#006241] flex items-center justify-center text-3xl shadow-xl animate-pulse mb-4 ring-4 ring-white/10">
          ☕
        </div>
        <h1 className="text-xl font-black tracking-tight text-white">Starbucks Operations Suite</h1>
        <p className="text-xs text-emerald-200/70 mt-1 font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Inicjalizacja pulpitu operacyjnego...
        </p>
      </div>
    );
  }

  // 1. Ekran Powitalny / Menu Startowe (Pierwsze uruchomienie po instalacji)
  if (!hasCompletedOnboarding) {
    return (
      <OnboardingWizardView
        onComplete={(config) => {
          try {
            localStorage.setItem('sbx_onboarding_completed', 'true');
            localStorage.setItem('sbx_store_name', config.storeName);
            localStorage.setItem('sbx_unit_code', config.unitCode);
            localStorage.setItem('sbx_user_name', config.userName);
            localStorage.setItem('sbx_user_role', config.role);
            localStorage.setItem('sbx_user_email', config.userEmail);
          } catch {}

          const apiObj = (window as any).api || (window as any).electronAPI;
          if (apiObj?.saveAppSettings) {
            apiObj.saveAppSettings({
              sbx_onboarding_completed: 'true',
              onboarding_completed: 'true',
              store_name: config.storeName,
              unit_code: config.unitCode,
              user_name: config.userName,
              user_role: config.role,
              user_email: config.userEmail,
            }).catch(console.error);
          }

          setLoggedInUser(config.userName ? `${config.userName} (${config.role.replace(/[^A-Z]/g, '')})` : config.role);
          setHasCompletedOnboarding(true);
          setIsLoggedIn(true);
          setActiveModule('dashboard');
          loadMonthData();

          if (config.dataSourceOption === 'A') {
            setIsImportModalOpen(true);
          } else if (config.dataSourceOption === 'B') {
            setIsBackupModalOpen(true);
          }
        }}
      />
    );
  }

  // 2. Standardowy Ekran Logowania (kolejne uruchomienia)
  if (!isLoggedIn) {
    return (
      <LoginView
        onLogin={(role) => {
          if (role) setLoggedInUser(role);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  return (
    <div className="h-screen w-screen bg-[#F4F7F5] flex overflow-hidden select-none">
      {/* Wysuwany Pasek Boczny po lewej */}
        <Sidebar
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          onRefresh={loadMonthData}
          isLoading={isLoading}
          onLogout={() => {
            setIsLoggedIn(false);
            setLoggedInUser('Store Manager (SM)');
          }}
        />

      {/* Prawa strona: Header + Główna Przestrzeń Robocza */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          activeModule={activeModule}
          userName={loggedInUser}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
        />

        <main className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 md:px-5 py-4 pb-24 w-full">
          {/* GŁÓWNY PULPIT PO ZALOGOWANIU */}
          {activeModule === 'dashboard' && (
            <ErrorBoundary moduleName="Dashboard" fallbackTitle="Błąd w pulpicie głównym">
              <DashboardView
                onNavigate={setActiveModule}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
              />
            </ErrorBoundary>
          )}

          {/* MODUŁ 2: MANAGERS SCHEDULE */}
          {activeModule === 'managers_schedule' && (
            <ErrorBoundary moduleName="Managers Schedule" fallbackTitle="Błąd w module Grafiku Managerskiego">
              <ManagerScheduleView
                currentYear={selectedYear}
                currentMonthName={selectedMonth}
              />
            </ErrorBoundary>
          )}

          {/* MODUŁ 1: TPLH FORECAST & LABOR BALANCING */}
          {activeModule === 'labor_forecast' && (
            <ErrorBoundary moduleName="Labor Forecast" fallbackTitle="Błąd w module TPLH Forecast & Labor">
              <LaborForecastView
                currentYear={selectedYear}
                currentMonthName={selectedMonth}
                aopPlan={aopPlan}
                summary={summary}
                weeks={weeks}
                onPeriodChange={(y, m) => {
                  setSelectedYear(y);
                  setSelectedMonth(m);
                  setTargetWeekKeyOverride(null);
                }}
                onSaveTrx={handleSaveTrx}
                onSaveScheduledHours={handleSaveScheduledHours}
                onSelectTargetWeek={(key) => setTargetWeekKeyOverride(key)}
                onRefresh={loadMonthData}
                selectedStrategy={selectedStrategy}
                onSelectStrategy={setSelectedStrategy}
                managerShifts={managerShifts}
                shiftDefinitions={shiftDefinitions}
                managerEmployees={managerEmployees}
              />
            </ErrorBoundary>
          )}

          {/* MODUŁ 3: SZKOLENIA (STARBUCKS TRAINING SUITE) */}
          {activeModule === 'trainings' && (
            <ErrorBoundary moduleName="Trainings Suite" fallbackTitle="Błąd w module Szkoleń">
              <ComingSoonOverlayWrapper
                module="trainings"
                title="Szkolenia & Barista Certifications"
                subtitle="Moduł 3: Starbucks Training Suite"
                description="Zarządzanie ścieżką wdrożeniową First 30 (Zmiany T1–T10), The Barista Journey, cyfrowe arkusze egzaminacyjne Skill Check oraz monitoring godzin szkoleniowych z budżetu Non-Coverage."
                features={[
                  'Matryca kompetencji i certyfikacji partnerów',
                  'Harmonogram zmian First 30 (T1–T10) i B90/B180',
                  'Cyfrowe arkusze Skill Check z weryfikacją standardów',
                  'Ewidencja godzin z budżetu Non-Coverage (NC)'
                ]}
                onNavigate={setActiveModule}
              >
                <TrainingsView
                  selectedYear={selectedYear}
                  selectedMonth={DEFAULT_MONTHS.indexOf(selectedMonth) + 1}
                />
              </ComingSoonOverlayWrapper>
            </ErrorBoundary>
          )}

          {/* MODUŁ 4: COL CALCULATOR (REPLIKA 1:1 EXCEL) */}
          {activeModule === 'col_calculator' && (
            <ErrorBoundary moduleName="COL Calculator" fallbackTitle="Błąd w kalkulatorze COL">
              <ComingSoonOverlayWrapper
                module="col_calculator"
                title="COL Calculator (Cost of Labor)"
                subtitle="Moduł 4: Kalkulator Kosztu Robocizny i Rentowności P&L"
                description="Kalkulator kosztów pracy integrujący stawki godzinowe menedżerów i baristów, narzuty pracodawcy ZUS 19.48%, linie Equity P&L, premie oraz symulacje rentowności grafiku w czasie rzeczywistym."
                features={[
                  'Kalkulacja procentowego kosztu robocizny (COL % vs Sales)',
                  'Wycena ułożonego grafiku menedżerów i baristów',
                  'Automatyczne narzuty ZUS 19.48%, PPK i rezerwa urlopowa',
                  'Symulator What-If i wskaźnik SPLH (Sales Per Labor Hour)'
                ]}
                onNavigate={setActiveModule}
              >
                <ColCalculatorView
                  selectedYear={selectedYear}
                  selectedMonth={selectedMonth}
                />
              </ComingSoonOverlayWrapper>
            </ErrorBoundary>
          )}

          {/* SCRATCH MODUŁY W PRZYGOTOWANIU: ANALIZA, IBS & IMS */}
          {(activeModule === 'analytics' || activeModule === 'ibs_ims') && (
            <ErrorBoundary moduleName="Analytics / Scratch" fallbackTitle="Błąd w module pomocniczym">
              <ComingSoonOverlayWrapper
                module={activeModule}
                title={activeModule === 'analytics' ? 'Analiza Biznesowa & Efektywność (BI)' : 'IBS & IMS (Inventory & Supply Chain)'}
                subtitle={activeModule === 'analytics' ? 'Moduł 5: Zaawansowane Raportowanie' : 'Moduł 6: Gospodarka Magazynowa i Zamówienia'}
                description={activeModule === 'analytics'
                  ? 'Kompleksowy moduł analityczny łączący transakcje, wielkości koszyka, mix produktowy oraz koszty robocizny w dynamicznych wizualizacjach wielomiesięcznych.'
                  : 'Integracja z systemem zamówień Starbucks (IBS/IMS), prognozowanie zużycia surowców i opakowań w powiązaniu z ruchem transakcyjnym.'}
                features={activeModule === 'analytics' ? [
                  'Analiza TPLH w ujęciu dobowym i szczytów Peak Hours',
                  'Porównania realizacji budżetów AOP rok do roku (YoY)',
                  'Korelacja obsady grafiku z Customer Connection Score',
                  'Wielowymiarowy eksport raportów do arkuszy Excel (.xlsx)'
                ] : [
                  'Kalkulator zamówień cyklicznych dostaw i surowców',
                  'Kontrola stanów magazynowych i inwentaryzacji (Inv)',
                  'Predykcja zużycia surowców wg prognoz AOP',
                  'Rejestr strat (Waste) i powiadomienia o przydatności'
                ]}
                onNavigate={setActiveModule}
              >
                <ModulePlaceholderView
                  module={activeModule}
                  onNavigate={setActiveModule}
                />
              </ComingSoonOverlayWrapper>
            </ErrorBoundary>
          )}
        </main>
      </div>

      {/* Okno Modalne Importu MAPAL (Sidebar) */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          loadMonthData();
          setIsImportModalOpen(false);
        }}
      />

      {/* Centralne Okno Ustawień Konfiguracji */}
      <UnifiedSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeModule={activeModule}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        onRefreshData={() => {
          loadMonthData();
        }}
        onOpenBackupModal={() => {
          setIsBackupModalOpen(true);
        }}
        onOpenUpdateModal={() => {
          setIsUpdateModalOpen(true);
        }}
        hasUpdateAvailable={hasUpdateAvailable}
        onOpenBugReporter={() => {
          setIsBugReporterOpen(true);
        }}
        onRerunOnboarding={() => {
          setHasCompletedOnboarding(false);
          setIsSettingsOpen(false);
        }}
      />

      {/* Okno Modalne Kopii Zapasowych Bazy Danych SQLite */}
      <DatabaseBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onRestoreSuccess={() => {
          loadMonthData();
          setIsBackupModalOpen(false);
        }}
      />

      {/* Okno Modalne Centrum Aktualizacji i Wersji */}
      <AppUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
      />

      {/* Okno Modalne Zgłaszania Błędów i Czarnej Skrzynki */}
      <BugReporterModal
        isOpen={isBugReporterOpen}
        onClose={() => setIsBugReporterOpen(false)}
        initialError={{
          moduleName: activeModule === 'labor_forecast' ? 'Labor Forecast' :
                      activeModule === 'managers_schedule' ? 'Managers Schedule' :
                      activeModule === 'trainings' ? 'Trainings Suite' :
                      activeModule === 'col_calculator' ? 'COL Calculator' : 'System Core',
        }}
      />
    </div>
  );
};
