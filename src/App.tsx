import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { ModulePlaceholderView } from './components/ModulePlaceholderView';
import { DatabaseBackupModal } from './components/DatabaseBackupModal';
import { AppUpdateModal } from './components/AppUpdateModal';
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
  // Stan sesji logowania (aplikacja startuje z ekranem logowania)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loggedInUser, setLoggedInUser] = useState<string>('Store Manager (SM)');

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
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
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
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        onOpenSettings={() => {
          setIsSettingsOpen(true);
        }}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
        onRefresh={loadMonthData}
        isLoading={isLoading}
        onLogout={() => {
          setIsLoggedIn(false);
          setActiveModule('dashboard');
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
            <DashboardView
              onNavigate={setActiveModule}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
            />
          )}

          {/* MODUŁ 2: MANAGERS SCHEDULE */}
          {activeModule === 'managers_schedule' && (
            <ManagerScheduleView
              currentYear={selectedYear}
              currentMonthName={selectedMonth}
            />
          )}

          {/* MODUŁ 1: TPLH FORECAST & LABOR BALANCING */}
          {activeModule === 'labor_forecast' && (
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
          )}

          {/* MODUŁ 3: SZKOLENIA (STARBUCKS TRAINING SUITE) */}
          {activeModule === 'trainings' && (
            <TrainingsView
              selectedYear={selectedYear}
              selectedMonth={DEFAULT_MONTHS.indexOf(selectedMonth) + 1}
            />
          )}

          {/* MODUŁ 4: COL CALCULATOR (REPLIKA 1:1 EXCEL) */}
          {activeModule === 'col_calculator' && (
            <ColCalculatorView
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
            />
          )}

          {/* SCRATCH MODUŁY W PRZYGOTOWANIU: ANALIZA, IBS & IMS */}
          {(activeModule === 'analytics' || activeModule === 'ibs_ims') && (
            <ModulePlaceholderView
              module={activeModule}
              onNavigate={setActiveModule}
            />
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
    </div>
  );
};
