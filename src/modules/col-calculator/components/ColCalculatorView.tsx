import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ColSheetTab,
  ColStoreInfo,
  ColKpiTargetEst,
  ColManagerItem,
  ColCrewUopItem,
  ColCrewUzItem,
  ColOtherItem
} from '../types/colTypes';
import { ColEngine } from '../services/colEngine';
import { ColSpreadsheetGrid } from './ColSpreadsheetGrid';
import { ColBonusSheet } from './ColBonusSheet';
import { ColVacationReserveSheet } from './ColVacationReserveSheet';
import { ColDaneSheet } from './ColDaneSheet';
import { ColFieldsDescriptionSheet } from './ColFieldsDescriptionSheet';
import { ColUserGuideSheet } from './ColUserGuideSheet';
import { ManagerScheduleEngine } from '../../managers-schedule/services/managerScheduleEngine';
import {
  Calculator,
  RotateCcw,
  FileSpreadsheet,
  Award,
  Calendar,
  Database,
  BookOpen,
  HelpCircle,
  RefreshCw
} from 'lucide-react';

import { ModuleDateBar, POLISH_MONTHS } from '../../../components/ModuleDateBar';
import { SystemClock } from '../../../services/systemClock';

interface ColCalculatorViewProps {
  selectedYear?: number;
  selectedMonth?: string;
}

export const ColCalculatorView: React.FC<ColCalculatorViewProps> = ({
  selectedYear,
  selectedMonth
}) => {
  const currentNow = SystemClock.now();
  const [activeYear, setActiveYear] = useState<number>(selectedYear || currentNow.year);
  const [activeMonth, setActiveMonth] = useState<string>(selectedMonth || currentNow.monthName);

  const [activeTab, setActiveTab] = useState<ColSheetTab>('CALCULATOR');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const monthNum = useMemo(() => {
    const idx = POLISH_MONTHS.indexOf(activeMonth);
    return idx >= 0 ? idx + 1 : currentNow.monthIndex + 1;
  }, [activeMonth, currentNow.monthIndex]);

  const nominalHours = useMemo(() => {
    return ManagerScheduleEngine.calculateMonthNorms(activeYear, monthNum).fullTimeNominalHours || 176;
  }, [activeYear, monthNum]);

  const [storeInfo, setStoreInfo] = useState<ColStoreInfo>({
    storeCode: '18120',
    storeName: 'SBX Warszawa Janki',
    month: activeMonth.toUpperCase(),
    year: activeYear,
    openDays: 30,
    fullContractHours: nominalHours
  });

  const [kpis, setKpis] = useState<ColKpiTargetEst>({
    salesTarget: 0,
    salesEst: 0,
    salesAop: 0,
    trxTarget: 0,
    trxEst: 0,
    trxAop: 0,
    avgDailyOpeningHours: 14,
    nonCoverageHolidayTarget: 0,
    nonCoverageHolidayEst: 0,
    nonCoverageSickTarget: 0,
    nonCoverageSickEst: 0,
    nonCoverageTrainingTarget: 0,
    matrixPlan: 'Plan A',
    tplhTarget: 6.6,
    whatIfTplhImprovement: 7.0
  });

  const [managers, setManagers] = useState<ColManagerItem[]>([]);
  const [crewUop, setCrewUop] = useState<ColCrewUopItem[]>([]);
  const [crewUz, setCrewUz] = useState<ColCrewUzItem[]>([]);
  const [otherCosts, setOtherCosts] = useState<ColOtherItem[]>([
    { id: 'oth-1', label: 'Medical examination ryczałt', planVal: 150, estVal: 150 },
    { id: 'oth-2', label: 'Bonus "Recommend a friend" (netto)', planVal: 0, estVal: 0 },
    { id: 'oth-3', label: 'Bonus SSV No Area', planVal: 0, estVal: 0, ratePct: 0.001 },
    { id: 'oth-4', label: 'Bonus CREW', planVal: 0, estVal: 0, ratePct: 0.002 },
    { id: 'oth-5', label: 'Wyksięgowanie PFRON Manager', planVal: 0, estVal: 0 },
    { id: 'oth-6', label: 'Wyksięgowanie PFRON Crew', planVal: 0, estVal: 0 },
    { id: 'oth-7', label: 'ADP', planVal: 600, estVal: 600 },
    { id: 'oth-8', label: 'Other (Koszty HR, corrections from previous month etc.)', planVal: 0, estVal: 0 },
    { id: 'oth-9', label: 'PPK', planVal: 0, estVal: 0, extraMeta: { ppkMgr: 0, ppkCrew: 0 } },
    { id: 'oth-10', label: 'Drivers', planVal: 0, estVal: 0, extraMeta: { costPerDrop: 14 } }
  ]);

  // Ładowanie i łączenie danych z Modułu 2 (Grafik Managerski) oraz Modułu 1 (AOP)
  const loadBridgeData = useCallback(async () => {
    setIsLoading(true);
    try {
      setStoreInfo({
        storeCode: '18120',
        storeName: 'SBX Warszawa Janki',
        month: activeMonth.toUpperCase(),
        year: activeYear,
        openDays: 30,
        fullContractHours: nominalHours
      });

      let loadedManagers: ColManagerItem[] = [];
      let totalHolidayH = 0;
      let totalSickH = 0;

      if (typeof window !== 'undefined' && (window as any).api?.getManagerScheduleData) {
        const [scheduleData, aopPlan] = await Promise.all([
          (window as any).api.getManagerScheduleData(activeYear, monthNum),
          (window as any).api.getAopPlan ? (window as any).api.getAopPlan(activeYear, activeMonth) : Promise.resolve(null)
        ]);

        const planSalesAop = aopPlan?.plan_sales || 280000;
        const planTrxAop = aopPlan?.plan_trx || 10830;
        const targetTplhAop = aopPlan?.target_tplh || 6.70;

        if (scheduleData && scheduleData.employees) {
          const calcSchedule = ManagerScheduleEngine.calculateMonthData(
            activeYear,
            monthNum,
            scheduleData.employees,
            scheduleData.shiftDefinitions || [],
            scheduleData.shifts || [],
            scheduleData.events || [],
            scheduleData.monthlyNormRecord,
            scheduleData.boundaryShifts,
            scheduleData.rcpLogs,
            scheduleData.hasCompleteRcpLogs
          );

          loadedManagers = calcSchedule.rows.map((row) => {
            const emp = row.employee;
            const fullNominal = calcSchedule.fullTimeNominalHours || nominalHours;
            const hourlyRate = emp.hourly_rate ?? 0;
            const baseSalary = hourlyRate > 0
              ? Math.round(hourlyRate * fullNominal)
              : (emp.role === 'STORE MANAGER' || emp.role === 'SM')
              ? 7200
              : (emp.role.includes('ASSISTANT') || emp.role === 'ASM')
              ? 6300
              : 5600;

            const shortRole = emp.role === 'STORE MANAGER' ? 'SM' : emp.role.includes('ASSISTANT') ? 'ASM' : 'SSV';

            let planWork = 0;
            let planSick = 0;
            let planHoliday = 0;
            let estWorkFromRcp = 0;

            const empRcpLogs = scheduleData.rcpLogs?.[emp.id];

            for (let day = 1; day <= (calcSchedule.totalDays || 30); day++) {
              const s = row.shifts?.[day];
              const code = s?.shift_code;
              const shiftHours = s?.hours || 0;

              if (code === 'H') {
                planHoliday += shiftHours || (emp.contract_hours_ratio * 8);
              } else if (code === 'L4' || code === 'L') {
                planSick += shiftHours || (emp.contract_hours_ratio * 8);
              } else if (code && code !== 'OFF') {
                planWork += shiftHours;
              }

              // Estymacja z logowań RCP: jeśli w danym dniu zalogowano godziny w systemie MAPAL, użyj RCP
              if (empRcpLogs && empRcpLogs[day] && typeof empRcpLogs[day].hours === 'number' && empRcpLogs[day].hours > 0) {
                estWorkFromRcp += empRcpLogs[day].hours;
              } else if (code && !['OFF', 'H', 'L4', 'L'].includes(code)) {
                estWorkFromRcp += shiftHours;
              }
            }

            totalHolidayH += planHoliday;
            totalSickH += planSick;

            return {
              id: `mgr-${emp.id}`,
              name: emp.name,
              position: shortRole as any,
              contractRatio: emp.contract_hours_ratio,
              baseSalary,
              planWorkHours: Number(planWork.toFixed(1)),
              planSickHours: Number(planSick.toFixed(1)),
              planHolidayHours: Number(planHoliday.toFixed(1)),
              planBonus: 0,
              isDisability: false,
              estWorkHours: Number(estWorkFromRcp.toFixed(1)),
              estSickHours: Number(planSick.toFixed(1)),
              estHolidayHours: Number(planHoliday.toFixed(1)),
              estBonus: 0,
              storeCostRatio: 1
            };
          });
        }

        // Dodaj wiersze specjalne
        const specialRows: ColManagerItem[] = [
          {
            id: 'mgr-maternity',
            name: 'Manager Maternity',
            position: 'Manager Maternity',
            contractRatio: 0,
            baseSalary: 0,
            planWorkHours: 0,
            planSickHours: 0,
            planHolidayHours: 0,
            planBonus: 0,
            isDisability: false,
            estWorkHours: 0,
            estSickHours: 0,
            estHolidayHours: 0,
            estBonus: 0,
            storeCostRatio: 1,
            isSpecialRow: true
          },
          {
            id: 'mgr-bench',
            name: 'Manager Bench',
            position: 'Manager Bench',
            contractRatio: 0,
            baseSalary: 0,
            planWorkHours: 0,
            planSickHours: 0,
            planHolidayHours: 0,
            planBonus: 0,
            isDisability: false,
            estWorkHours: 0,
            estSickHours: 0,
            estHolidayHours: 0,
            estBonus: 0,
            storeCostRatio: 1,
            isSpecialRow: true
          },
          {
            id: 'mgr-dm-costs',
            name: 'DM costs',
            position: 'DM costs',
            contractRatio: 0,
            baseSalary: 0,
            planWorkHours: 0,
            planSickHours: 0,
            planHolidayHours: 0,
            planBonus: 0,
            isDisability: false,
            estWorkHours: 0,
            estSickHours: 0,
            estHolidayHours: 0,
            estBonus: 0,
            storeCostRatio: 1,
            isSpecialRow: true
          },
          {
            id: 'mgr-dos-accrual',
            name: 'DOS+ accrual',
            position: 'DOS+ accrual',
            contractRatio: 0,
            baseSalary: 0,
            planWorkHours: 0,
            planSickHours: 0,
            planHolidayHours: 0,
            planBonus: 0,
            isDisability: false,
            estWorkHours: 0,
            estSickHours: 0,
            estHolidayHours: 0,
            estBonus: 0,
            storeCostRatio: 1,
            isSpecialRow: true
          },
          {
            id: 'mgr-holiday-accrual',
            name: 'Holiday accrual',
            position: 'Holiday accrual',
            contractRatio: 0,
            baseSalary: 0,
            planWorkHours: 0,
            planSickHours: 0,
            planHolidayHours: 0,
            planBonus: 0,
            isDisability: false,
            estWorkHours: 0,
            estSickHours: 0,
            estHolidayHours: 0,
            estBonus: 0,
            storeCostRatio: 1,
            isSpecialRow: true
          }
        ];

        setManagers([...loadedManagers, ...specialRows]);

        // Aktualizuj KPI z AOP
        setKpis(prev => ({
          ...prev,
          salesAop: planSalesAop,
          trxAop: planTrxAop,
          tplhAop: targetTplhAop,
          salesTarget: planSalesAop,
          trxTarget: planTrxAop,
          tplhTarget: targetTplhAop,
          salesEst: aopPlan?.actual_sales || planSalesAop,
          trxEst: aopPlan?.actual_trx || planTrxAop,
          tplhEst: targetTplhAop,
          nonCoverageHolidayTarget: totalHolidayH,
          nonCoverageHolidayEst: totalHolidayH,
          nonCoverageSickTarget: totalSickH,
          nonCoverageSickEst: totalSickH
        }));
      }
    } catch (err) {
      console.error('Błąd ładowania bridge grafiku menedżerskiego:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeYear, activeMonth, monthNum, nominalHours]);

  useEffect(() => {
    loadBridgeData();
  }, [loadBridgeData]);

  // Recalculate summary in real-time
  const summary = useMemo(() => {
    return ColEngine.calculate(storeInfo, kpis, managers, crewUop, crewUz, otherCosts);
  }, [storeInfo, kpis, managers, crewUop, crewUz, otherCosts]);

  const updateKpis = (updates: Partial<ColKpiTargetEst>) => {
    setKpis(prev => ({ ...prev, ...updates }));
  };

  const updateManager = (id: string, updates: Partial<ColManagerItem>) => {
    setManagers(prev => prev.map(m => (m.id === id ? { ...m, ...updates } : m)));
  };

  const updateCrewUop = (id: string, updates: Partial<ColCrewUopItem>) => {
    setCrewUop(prev => prev.map(u => (u.id === id ? { ...u, ...updates } : u)));
  };

  const handleAddCrewUop = () => {
    const newId = `uop-${Date.now()}`;
    setCrewUop(prev => [
      ...prev,
      {
        id: newId,
        name: '',
        position: 'B',
        contractRatio: 0.75,
        hourlyRate: 30.5,
        planWorkHours: 0,
        planSickHours: 0,
        planHolidayHours: 0,
        isDisability: false,
        estWorkHours: 0,
        estSickHours: 0,
        estHolidayHours: 0,
        estBonus: 0
      }
    ]);
  };

  const handleRemoveCrewUop = (id: string) => {
    setCrewUop(prev => prev.filter(u => u.id !== id));
  };

  const updateCrewUz = (id: string, updates: Partial<ColCrewUzItem>) => {
    setCrewUz(prev => prev.map(z => (z.id === id ? { ...z, ...updates } : z)));
  };

  const handleAddCrewUz = () => {
    const newId = `uz-${Date.now()}`;
    setCrewUz(prev => [
      ...prev,
      {
        id: newId,
        name: '',
        position: 'B',
        hourlyRate: 30.5,
        planWorkHours: 0,
        estWorkHours: 0,
        bonus: 0
      }
    ]);
  };

  const handleRemoveCrewUz = (id: string) => {
    setCrewUz(prev => prev.filter(z => z.id !== id));
  };

  const updateOtherCost = (id: string, updates: Partial<ColOtherItem>) => {
    setOtherCosts(prev => prev.map(o => (o.id === id ? { ...o, ...updates } : o)));
  };

  const handleClearAll = () => {
    if (confirm('Czy na pewno chcesz wyczyścić wszystkie wprowadzone dane załogi i zresetować kalkulator?')) {
      setCrewUop([]);
      setCrewUz([]);
      loadBridgeData();
    }
  };

  const tabs: { key: ColSheetTab; label: string; icon: React.ReactNode }[] = [
    { key: 'CALCULATOR', label: 'CALCULATOR', icon: <Calculator className="w-3.5 h-3.5" /> },
    { key: 'BONUS', label: 'BONUS', icon: <Award className="w-3.5 h-3.5" /> },
    { key: 'Rezerwa urlopowa', label: 'Rezerwa urlopowa', icon: <Calendar className="w-3.5 h-3.5" /> },
    { key: 'DANE', label: 'DANE', icon: <Database className="w-3.5 h-3.5" /> },
    { key: 'Fields Description', label: 'Fields Description', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { key: 'USER GUIDE', label: 'USER GUIDE', icon: <HelpCircle className="w-3.5 h-3.5" /> }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-white dark:bg-zinc-950 overflow-hidden select-text">
      {/* Top Controls Bar with ModuleDateBar */}
      <div className="bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#006241] text-white rounded shadow-xs">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                COL Calculator — Starbucks 18120 Janki
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                Kalkulacja i controlling kosztów pracy (Cost of Labor)
              </p>
            </div>
          </div>
        </div>

        {/* Module Date Bar (LM, MTD, NM, Selektor Roku/Miesiąca) */}
        <ModuleDateBar
          year={activeYear}
          month={activeMonth}
          onPeriodChange={(y, m) => {
            setActiveYear(y);
            setActiveMonth(m);
          }}
          className="border-none shadow-none bg-transparent p-0"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={loadBridgeData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors shadow-xs cursor-pointer active:scale-95"
            title="Przeładuj i zsynchronizuj godziny z Grafikiem Managerskim"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Synchronizuj</span>
          </button>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-xs cursor-pointer active:scale-95"
            title="Wyczyść wprowadzone dane załogi"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Wyczyść załogę</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Active Sheet */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'CALCULATOR' && (
          <ColSpreadsheetGrid
            storeInfo={storeInfo}
            kpis={kpis}
            managers={managers}
            crewUop={crewUop}
            crewUz={crewUz}
            otherCosts={otherCosts}
            summary={summary}
            onUpdateKpis={updateKpis}
            onUpdateManager={updateManager}
            onUpdateCrewUop={updateCrewUop}
            onAddCrewUop={handleAddCrewUop}
            onRemoveCrewUop={handleRemoveCrewUop}
            onUpdateCrewUz={updateCrewUz}
            onAddCrewUz={handleAddCrewUz}
            onRemoveCrewUz={handleRemoveCrewUz}
            onUpdateOtherCost={updateOtherCost}
          />
        )}
        {activeTab === 'BONUS' && <ColBonusSheet />}
        {activeTab === 'Rezerwa urlopowa' && <ColVacationReserveSheet managers={managers} />}
        {activeTab === 'DANE' && <ColDaneSheet />}
        {activeTab === 'Fields Description' && <ColFieldsDescriptionSheet />}
        {activeTab === 'USER GUIDE' && <ColUserGuideSheet />}
      </div>

      {/* Excel Bottom Sheet Tab Bar */}
      <div className="bg-slate-200 dark:bg-zinc-900 border-t border-slate-300 dark:border-zinc-800 px-3 py-1 flex items-center gap-1 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mr-2">
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>ARKUSZE:</span>
        </div>
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium transition-all rounded-t border-t border-x ${
                isActive
                  ? 'bg-white dark:bg-zinc-800 text-[#006241] dark:text-emerald-400 font-bold border-slate-300 dark:border-zinc-700 shadow-xs -mb-[5px] pb-2 z-10'
                  : 'bg-slate-100 dark:bg-zinc-850 text-slate-600 dark:text-zinc-400 border-transparent hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
