import React from 'react';
import {
  ColStoreInfo,
  ColKpiTargetEst,
  ColManagerItem,
  ColCrewUopItem,
  ColCrewUzItem,
  ColOtherItem,
  ColCalculatedSummary
} from '../types/colTypes';
import { Sparkles, Plus, Trash2, Link as LinkIcon, Info } from 'lucide-react';

interface ColSpreadsheetGridProps {
  storeInfo: ColStoreInfo;
  kpis: ColKpiTargetEst;
  managers: ColManagerItem[];
  crewUop: ColCrewUopItem[];
  crewUz: ColCrewUzItem[];
  otherCosts: ColOtherItem[];
  summary: ColCalculatedSummary;
  onUpdateKpis: (kpis: Partial<ColKpiTargetEst>) => void;
  onUpdateManager: (id: string, updates: Partial<ColManagerItem>) => void;
  onUpdateCrewUop: (id: string, updates: Partial<ColCrewUopItem>) => void;
  onAddCrewUop: () => void;
  onRemoveCrewUop: (id: string) => void;
  onUpdateCrewUz: (id: string, updates: Partial<ColCrewUzItem>) => void;
  onAddCrewUz: () => void;
  onRemoveCrewUz: (id: string) => void;
  onUpdateOtherCost: (id: string, updates: Partial<ColOtherItem>) => void;
}

export const ColSpreadsheetGrid: React.FC<ColSpreadsheetGridProps> = ({
  storeInfo,
  kpis,
  managers,
  crewUop,
  crewUz,
  otherCosts,
  summary,
  onUpdateKpis,
  onUpdateManager,
  onUpdateCrewUop,
  onAddCrewUop,
  onRemoveCrewUop,
  onUpdateCrewUz,
  onAddCrewUz,
  onRemoveCrewUz,
  onUpdateOtherCost
}) => {
  const fmtPln = (val: number) =>
    new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' zł';

  const fmtPct = (val: number) =>
    (val * 100).toFixed(2) + '%';

  const fmtNum = (val: number, decimals = 1) =>
    new Intl.NumberFormat('pl-PL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);

  return (
    <div className="flex flex-col h-full bg-[#f4f7f5] dark:bg-zinc-950 font-sans text-xs select-text overflow-hidden">
      {/* Top Banner: 3 Filary (AOP, Target, Estymacja) */}
      <div className="bg-[#006241] text-white px-4 py-2 flex flex-wrap items-center justify-between border-b border-[#004d33] shrink-0 shadow-sm gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-emerald-200">KAWIARNIA:</span>
            <span className="font-bold text-sm bg-black/20 px-2 py-0.5 rounded text-white border border-white/10">
              {storeInfo.storeName} ({storeInfo.storeCode})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-200 text-[11px]">MIESIĄC:</span>
            <span className="font-semibold bg-white/10 px-2 py-0.5 rounded">
              {storeInfo.month} {storeInfo.year}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded text-[11px] border border-white/10">
            <span className="text-emerald-200">NOMINAŁ:</span>
            <span className="font-bold text-amber-300">{storeInfo.fullContractHours} h</span>
          </div>
        </div>

        {/* 3 Pillars Summary Badges */}
        <div className="flex items-center gap-2 text-[11px]">
          {/* Pillar 1: AOP */}
          <div className="flex items-center gap-1.5 bg-slate-900/70 px-2.5 py-1 rounded border border-slate-600/50">
            <span className="text-slate-300 font-bold uppercase text-[10px] bg-slate-700 px-1 py-0.2 rounded">AOP</span>
            <span className="text-slate-200">{fmtPln(kpis.salesAop || 0)}</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-300 font-bold">{fmtPct(summary.colAopPct)}</span>
          </div>

          {/* Pillar 2: TARGET */}
          <div className="flex items-center gap-1.5 bg-emerald-950/80 px-2.5 py-1 rounded border border-emerald-400/40">
            <span className="text-emerald-200 font-bold uppercase text-[10px] bg-emerald-800 px-1 py-0.2 rounded">TARGET</span>
            <span className="text-white font-bold">{fmtPln(summary.colPlanTotal)}</span>
            <span className="text-amber-300 font-bold">({fmtPct(summary.colPlanPct)})</span>
            <span className="text-emerald-300 text-[10px]">TPLH {summary.tplhTotalPlan.toFixed(2)}</span>
          </div>

          {/* Pillar 3: ESTYMACJA */}
          <div className="flex items-center gap-1.5 bg-indigo-950/80 px-2.5 py-1 rounded border border-indigo-400/40">
            <span className="text-indigo-200 font-bold uppercase text-[10px] bg-indigo-800 px-1 py-0.2 rounded">ESTYMACJA</span>
            <span className="text-white font-bold">{fmtPln(summary.colEstTotal)}</span>
            <span className="text-indigo-300 font-bold">({fmtPct(summary.colEstPct)})</span>
            <span className="text-indigo-200 text-[10px]">TPLH {summary.tplhTotalEst.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Main Split Body: Left Panel (B..F) & Right Panel (H..BS) */}
      <div className="flex-1 flex overflow-hidden">
        {/* ========================================================================= */}
        {/* LEWY PANEL: Wskaźniki, P&L, Budżet (Cols B..F)                           */}
        {/* ========================================================================= */}
        <div className="w-[490px] shrink-0 border-r border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col overflow-y-auto">
          {/* Table Header B..F: 3 Filary */}
          <div className="sticky top-0 z-20 grid grid-cols-12 bg-[#007343] text-white font-bold text-[10px] py-1.5 px-2 border-b border-emerald-800 shadow-xs gap-1">
            <div className="col-span-3 uppercase tracking-wide flex items-center">WSKAŹNIK</div>
            <div className="col-span-3 text-right bg-slate-800/60 px-1.5 py-0.5 rounded text-slate-200">AOP (ROCZNY)</div>
            <div className="col-span-3 text-right bg-emerald-900/60 px-1.5 py-0.5 rounded text-emerald-100">TARGET (PLAN)</div>
            <div className="col-span-3 text-right bg-indigo-900/60 px-1.5 py-0.5 rounded text-indigo-100">ESTYMACJA (RCP)</div>
          </div>

          <div className="p-2 space-y-2.5 text-[11px]">
            {/* SPRZEDAŻ I TRANSAKCJE */}
            <div className="border border-slate-200 dark:border-zinc-800 rounded bg-slate-50/50 dark:bg-zinc-800/30 p-2 space-y-1.5">
              <div className="grid grid-cols-12 items-center gap-1 py-0.5">
                <span className="col-span-3 font-semibold text-slate-700 dark:text-zinc-300 text-[11px]">SALES</span>
                <div className="col-span-3 text-right font-medium text-slate-600 dark:text-zinc-400 text-[10px] bg-slate-100 dark:bg-zinc-800/60 py-0.5 px-1 rounded">
                  {fmtPln(kpis.salesAop || 0)}
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    value={kpis.salesTarget}
                    onChange={e => onUpdateKpis({ salesTarget: parseFloat(e.target.value) || 0 })}
                    className="w-full text-right font-bold bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5 text-[11px] focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    value={kpis.salesEst}
                    onChange={e => onUpdateKpis({ salesEst: parseFloat(e.target.value) || 0 })}
                    className="w-full text-right font-bold bg-[#ffffcc] text-slate-900 border border-indigo-300 rounded px-1 py-0.5 text-[11px] focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 items-center gap-1 py-0.5">
                <span className="col-span-3 font-semibold text-slate-700 dark:text-zinc-300 text-[11px]">TRX</span>
                <div className="col-span-3 text-right font-medium text-slate-600 dark:text-zinc-400 text-[10px] bg-slate-100 dark:bg-zinc-800/60 py-0.5 px-1 rounded">
                  {fmtNum(kpis.trxAop || 0, 0)}
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    value={kpis.trxTarget}
                    onChange={e => onUpdateKpis({ trxTarget: parseFloat(e.target.value) || 0 })}
                    className="w-full text-right font-bold bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5 text-[11px] focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    value={kpis.trxEst}
                    onChange={e => onUpdateKpis({ trxEst: parseFloat(e.target.value) || 0 })}
                    className="w-full text-right font-bold bg-[#ffffcc] text-slate-900 border border-indigo-300 rounded px-1 py-0.5 text-[11px] focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* GŁÓWNY BOX COL */}
            <div className="border-2 border-[#007343] rounded bg-emerald-50/40 dark:bg-emerald-950/20 p-2 space-y-1.5">
              <div className="grid grid-cols-12 items-center gap-1">
                <span className="col-span-3 font-bold text-emerald-900 dark:text-emerald-300 text-[11px]">TOTAL COL</span>
                <span className="col-span-3 text-right font-semibold text-slate-700 dark:text-zinc-300 text-[10px]">
                  {fmtPln(summary.colAopTotal)}
                </span>
                <span className="col-span-3 text-right font-extrabold text-emerald-800 dark:text-emerald-400 text-[11px]">
                  {fmtPln(summary.colPlanTotal)}
                </span>
                <span className="col-span-3 text-right font-extrabold text-indigo-800 dark:text-indigo-400 text-[11px]">
                  {fmtPln(summary.colEstTotal)}
                </span>
              </div>

              <div className="grid grid-cols-12 items-center gap-1 pt-1 border-t border-emerald-200 dark:border-emerald-800/40">
                <span className="col-span-3 font-bold text-emerald-900 dark:text-emerald-300 text-[11px]">COL %</span>
                <span className="col-span-3 text-right font-bold text-slate-700 dark:text-zinc-300 text-[11px]">
                  {fmtPct(summary.colAopPct)}
                </span>
                <span className="col-span-3 text-right font-black text-amber-700 dark:text-amber-400 text-xs">
                  {fmtPct(summary.colPlanPct)}
                </span>
                <span className="col-span-3 text-right font-black text-indigo-700 dark:text-indigo-400 text-xs">
                  {fmtPct(summary.colEstPct)}
                </span>
              </div>

              <div className="grid grid-cols-12 items-center gap-1 text-[10px] text-slate-500 pt-0.5">
                <span className="col-span-3">FIXED COL</span>
                <span className="col-span-3 text-right font-medium">{fmtPln(summary.fixedColAop)}</span>
                <span className="col-span-3 text-right font-medium">{fmtPln(summary.fixedColPlan)}</span>
                <span className="col-span-3 text-right font-medium">{fmtPln(summary.fixedColEst)}</span>
              </div>

              {/* Wariancje / Odchylenia vs AOP */}
              <div className="pt-1 border-t border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Estymacja vs AOP:</span>
                <span className={`font-bold ${summary.deltaEstVsAopPln <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {summary.deltaEstVsAopPln > 0 ? '+' : ''}{fmtPln(summary.deltaEstVsAopPln)} ({summary.deltaEstVsAopPct > 0 ? '+' : ''}{summary.deltaEstVsAopPct.toFixed(2)} pp)
                </span>
              </div>
            </div>

            {/* GODZINY PRACY I TPLH */}
            <div className="border border-slate-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 p-2 space-y-1">
              <div className="grid grid-cols-12 items-center gap-1 py-0.5">
                <span className="col-span-3 text-slate-600 dark:text-zinc-400 text-[10px]">MGR HOURS</span>
                <span className="col-span-3 text-right font-medium text-slate-600 dark:text-zinc-400 text-[10px]">{summary.managerHoursAop} h</span>
                <span className="col-span-3 text-right font-semibold text-[10px]">{summary.managerHoursPlan} h</span>
                <span className="col-span-3 text-right font-semibold text-indigo-600 dark:text-indigo-400 text-[10px]">{summary.managerHoursEst} h</span>
              </div>
              <div className="grid grid-cols-12 items-center gap-1 py-0.5">
                <span className="col-span-3 text-slate-600 dark:text-zinc-400 text-[10px]">CREW HOURS</span>
                <span className="col-span-3 text-right font-medium text-slate-600 dark:text-zinc-400 text-[10px]">{fmtNum(summary.crewHoursAop, 1)} h</span>
                <span className="col-span-3 text-right font-semibold text-[10px]">{summary.crewHoursPlan} h</span>
                <span className="col-span-3 text-right font-semibold text-indigo-600 dark:text-indigo-400 text-[10px]">{summary.crewHoursEst} h</span>
              </div>
              <div className="grid grid-cols-12 items-center gap-1 py-1 border-t border-slate-200 dark:border-zinc-800 font-bold">
                <span className="col-span-3 text-slate-800 dark:text-zinc-200 text-[10px]">TOTAL HOURS</span>
                <span className="col-span-3 text-right text-slate-600 dark:text-zinc-400 text-[10px]">{fmtNum(summary.totalWorkingHoursAop, 1)} h</span>
                <span className="col-span-3 text-right text-emerald-700 dark:text-emerald-400 text-[10px]">{summary.totalWorkingHoursPlan} h</span>
                <span className="col-span-3 text-right text-indigo-700 dark:text-indigo-400 text-[10px]">{summary.totalWorkingHoursEst} h</span>
              </div>
              <div className="grid grid-cols-12 items-center gap-1 py-0.5 bg-emerald-50/50 dark:bg-emerald-950/20 px-1 rounded">
                <span className="col-span-3 font-semibold text-emerald-900 dark:text-emerald-300 text-[10px]">TPLH (Total)</span>
                <span className="col-span-3 text-right font-medium text-slate-600 dark:text-zinc-400 text-[10px]">{summary.tplhTotalAop.toFixed(2)}</span>
                <span className="col-span-3 text-right font-bold text-emerald-700 dark:text-emerald-400 text-[10px]">{summary.tplhTotalPlan.toFixed(2)}</span>
                <span className="col-span-3 text-right font-bold text-indigo-700 dark:text-indigo-400 text-[10px]">{summary.tplhTotalEst.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-12 items-center gap-1 py-0.5 px-1">
                <span className="col-span-3 text-slate-600 dark:text-zinc-400 text-[10px]">TPLH (Cov.)</span>
                <span className="col-span-3 text-right font-medium text-[10px]">{summary.tplhCoverageAop.toFixed(2)}</span>
                <span className="col-span-3 text-right font-medium text-[10px]">{summary.tplhCoveragePlan.toFixed(2)}</span>
                <span className="col-span-3 text-right font-medium text-indigo-600 dark:text-indigo-400 text-[10px]">{summary.tplhCoverageEst.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-12 items-center gap-1 py-0.5 px-1">
                <span className="col-span-3 text-slate-600 dark:text-zinc-400 text-[10px]">CEL TPLH</span>
                <div className="col-span-3 text-right font-medium text-slate-500 text-[10px]">{summary.tplhTotalAop.toFixed(2)}</div>
                <div className="col-span-6">
                  <input
                    type="number"
                    step="0.1"
                    value={kpis.tplhTarget}
                    onChange={e => onUpdateKpis({ tplhTarget: parseFloat(e.target.value) || 0 })}
                    className="w-full text-right font-bold bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5 text-[10px]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 items-center gap-1 py-0.5 px-1 bg-amber-50/50 dark:bg-amber-950/20 rounded">
                <span className="col-span-3 font-semibold text-amber-900 dark:text-amber-300 text-[10px]">BUDŻET (h)</span>
                <span className="col-span-3 text-right font-medium text-slate-600 text-[10px]">{fmtNum(summary.budgetWorkingHoursAop, 1)} h</span>
                <span className="col-span-3 text-right font-bold text-amber-700 dark:text-amber-400 text-[10px]">{fmtNum(summary.budgetWorkingHours, 1)} h</span>
                <span className="col-span-3 text-right font-bold text-indigo-700 dark:text-indigo-400 text-[10px]">{summary.totalWorkingHoursEst} h</span>
              </div>
            </div>

            {/* WHAT-IF SIMULATOR */}
            <div className="border border-indigo-200 dark:border-indigo-900/40 rounded bg-indigo-50/40 dark:bg-indigo-950/20 p-2 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-indigo-900 dark:text-indigo-300 text-[10px] uppercase">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Symulator Poprawy TPLH (What-If)
              </div>
              <div className="grid grid-cols-12 items-center text-[10px]">
                <span className="col-span-6 text-indigo-800 dark:text-indigo-300">Symulowany TPLH:</span>
                <div className="col-span-6">
                  <input
                    type="number"
                    step="0.1"
                    value={kpis.whatIfTplhImprovement}
                    onChange={e => onUpdateKpis({ whatIfTplhImprovement: parseFloat(e.target.value) || 0 })}
                    className="w-full text-right font-bold bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1.5 py-0.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 items-center text-[10px] font-semibold text-indigo-950 dark:text-indigo-200">
                <span className="col-span-6">Oszczędność COL:</span>
                <span className="col-span-6 text-right font-bold text-emerald-600 dark:text-emerald-400">
                  +{fmtPln(summary.whatIfColSavings)}
                </span>
              </div>
              <div className="grid grid-cols-12 items-center text-[10px] text-indigo-900 dark:text-indigo-300">
                <span className="col-span-6">Wpływ na COL %:</span>
                <span className="col-span-6 text-right font-bold text-emerald-600 dark:text-emerald-400">
                  -{summary.whatIfColPctInfluence.toFixed(2)} pp
                </span>
              </div>
            </div>

            {/* ROZBICIE LINII P&L */}
            <div className="border border-slate-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 overflow-hidden">
              <div className="bg-slate-100 dark:bg-zinc-800 px-2 py-1 font-bold text-slate-800 dark:text-zinc-200 text-[10px] uppercase border-b border-slate-200 dark:border-zinc-700 flex justify-between">
                <span>Rozbicie Linii P&L</span>
                <span className="text-[9px] text-slate-500 font-normal">Plan vs Estymacja</span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-zinc-800 text-[10px]">
                {/* Manager */}
                <div className="p-1.5 bg-slate-50/40 dark:bg-zinc-855/50 space-y-1">
                  <div className="grid grid-cols-12 font-bold text-slate-800 dark:text-zinc-200">
                    <span className="col-span-6">1. MANAGER</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.totalManagerPlan)}</span>
                    <span className="col-span-3 text-right text-indigo-600 dark:text-indigo-400">{fmtPln(summary.totalManagerEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-500 pl-2">
                    <span className="col-span-6">Payroll Manager</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.payrollManagerPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.payrollManagerEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-500 pl-2">
                    <span className="col-span-6">Bonus Manager</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.bonusManagerPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.bonusManagerEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-500 pl-2">
                    <span className="col-span-6">Social Contribution (ZUS+PPK)</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.socialManagerPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.socialManagerEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-500 pl-2">
                    <span className="col-span-6">Disability Fund (PFRON)</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.pfronManagerPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.pfronManagerEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-500 pl-2">
                    <span className="col-span-6">Social Fund (FGŚP+FP)</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.socialFundManagerPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.socialFundManagerEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-500 pl-2">
                    <span className="col-span-6">Other Manager (Comp&Ben)</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.otherManagerPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.otherManagerEst)}</span>
                  </div>
                </div>

                {/* Crew */}
                <div className="p-1.5 bg-slate-50/40 dark:bg-zinc-855/50 space-y-1">
                  <div className="grid grid-cols-12 font-bold text-slate-800 dark:text-zinc-200">
                    <span className="col-span-6">2. CREW</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.totalCrewPlan)}</span>
                    <span className="col-span-3 text-right text-indigo-600 dark:text-indigo-400">{fmtPln(summary.totalCrewEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-500 pl-2">
                    <span className="col-span-6">Payroll Crew</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.payrollCrewPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.payrollCrewEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-400 pl-4 text-[9px]">
                    <span className="col-span-6">• Basic Salary Crew (UoP)</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.basicSalaryCrewPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.basicSalaryCrewEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-400 pl-4 text-[9px]">
                    <span className="col-span-6">• Working Clothes Equiv.</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.workingClothesEquivalentPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.workingClothesEquivalentEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-400 pl-4 text-[9px]">
                    <span className="col-span-6">• Civil Contracts (UZ)</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.civilContractsSalariesPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.civilContractsSalariesEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-500 pl-2">
                    <span className="col-span-6">Bonus Crew</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.bonusCrewPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.bonusCrewEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-500 pl-2">
                    <span className="col-span-6">Social Contribution Crew</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.socialCrewPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.socialCrewEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-500 pl-2">
                    <span className="col-span-6">Disability Fund Crew</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.pfronCrewPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.pfronCrewEst)}</span>
                  </div>
                  <div className="grid grid-cols-12 text-slate-500 pl-2">
                    <span className="col-span-6">Other Crew (ADP, Medycyna)</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.otherCrewPlan)}</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.otherCrewEst)}</span>
                  </div>
                </div>

                {/* Drivers */}
                <div className="p-1.5 space-y-1">
                  <div className="grid grid-cols-12 font-bold text-slate-800 dark:text-zinc-200">
                    <span className="col-span-6">3. DRIVERS (Dostawy)</span>
                    <span className="col-span-3 text-right">{fmtPln(summary.driversPlan)}</span>
                    <span className="col-span-3 text-right text-indigo-600 dark:text-indigo-400">{fmtPln(summary.driversEst)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PRAWY PANEL: Tabele Personelu & Kosztów (Cols H..BS)                      */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-zinc-950 p-3 space-y-6">
          {/* TABELA 1: KADRA KIEROWNICZA (MANAGER) */}
          <div className="border border-slate-300 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="bg-[#007343] text-white px-3 py-1.5 font-bold flex items-center justify-between">
              <span className="uppercase tracking-wide text-xs">
                1. MANAGER TARGET & ESTIMATION (Kadra Kierownicza — {managers.filter(m => !m.isSpecialRow).length} Menedżerów z Grafiku)
              </span>
              <span className="text-[11px] font-normal text-emerald-200">
                Godziny pracy, urlopów (H) i zwolnień (L4) wczytane automatycznie z Modułu 2
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse text-left">
                <thead>
                  <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-b border-slate-200 dark:border-zinc-700 font-semibold">
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-36">Imię i Nazwisko</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-16 text-center">Stanowisko</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-14 text-right">Etat</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-24 text-right">Stawka brutto</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-16 text-right bg-emerald-50/70 dark:bg-emerald-950/20 font-bold">Plan h</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-14 text-right bg-emerald-50/70 dark:bg-emerald-950/20">L4 h</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-14 text-right bg-emerald-50/70 dark:bg-emerald-950/20">Urlop h</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-16 text-right bg-amber-50/70 dark:bg-amber-950/20">Bonus Plan</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-12 text-center">ON</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-16 text-right bg-emerald-50/70 dark:bg-emerald-950/20 font-bold">Rzecz. h</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-14 text-right bg-emerald-50/70 dark:bg-emerald-950/20">Est L4</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-14 text-right bg-emerald-50/70 dark:bg-emerald-950/20">Est Urlop</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-16 text-right bg-amber-50/70 dark:bg-amber-950/20">Bonus Est</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-20 text-right font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50/40">COL Target</th>
                    <th className="p-1.5 text-right font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50/40">COL Est</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {managers.map(m => (
                    <tr key={m.id} className={m.isSpecialRow ? 'bg-slate-50/60 dark:bg-zinc-850/60 font-medium italic' : 'hover:bg-slate-50 dark:hover:bg-zinc-850'}>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 font-medium">
                        {m.name}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-center font-semibold text-slate-600 dark:text-zinc-400">
                        {m.position}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right">
                        {m.contractRatio > 0 ? m.contractRatio.toFixed(2) : '-'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right font-mono">
                        {m.baseSalary > 0 ? (
                          <input
                            type="number"
                            value={m.baseSalary}
                            onChange={e => onUpdateManager(m.id, { baseSalary: parseFloat(e.target.value) || 0 })}
                            className="w-20 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5"
                          />
                        ) : '-'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right font-bold text-emerald-900 dark:text-emerald-300 bg-emerald-50/30">
                        {!m.isSpecialRow ? (
                          <span>{m.planWorkHours} h</span>
                        ) : '-'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right text-slate-700 dark:text-zinc-300 bg-emerald-50/30">
                        {!m.isSpecialRow ? (
                          <span>{m.planSickHours} h</span>
                        ) : '-'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right text-slate-700 dark:text-zinc-300 bg-emerald-50/30">
                        {!m.isSpecialRow ? (
                          <span>{m.planHolidayHours} h</span>
                        ) : '-'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30">
                        <input
                          type="number"
                          value={m.planBonus}
                          onChange={e => onUpdateManager(m.id, { planBonus: parseFloat(e.target.value) || 0 })}
                          className="w-16 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-center">
                        {!m.isSpecialRow ? (
                          <input
                            type="checkbox"
                            checked={m.isDisability}
                            onChange={e => onUpdateManager(m.id, { isDisability: e.target.checked })}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                        ) : '-'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right font-bold text-emerald-900 dark:text-emerald-300 bg-emerald-50/30">
                        {!m.isSpecialRow ? (
                          <span>{m.estWorkHours} h</span>
                        ) : '-'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right text-slate-700 dark:text-zinc-300 bg-emerald-50/30">
                        {!m.isSpecialRow ? (
                          <span>{m.estSickHours} h</span>
                        ) : '-'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right text-slate-700 dark:text-zinc-300 bg-emerald-50/30">
                        {!m.isSpecialRow ? (
                          <span>{m.estHolidayHours} h</span>
                        ) : '-'}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30">
                        <input
                          type="number"
                          value={m.estBonus}
                          onChange={e => onUpdateManager(m.id, { estBonus: parseFloat(e.target.value) || 0 })}
                          className="w-16 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right font-mono font-semibold text-slate-700 dark:text-zinc-300 bg-emerald-50/20">
                        {fmtPln(m.position === 'Holiday accrual' ? m.baseSalary : m.position === 'DM costs' ? m.planBonus * 1.1693 : m.baseSalary > 0 ? (m.contractRatio * m.baseSalary * 1.1948) : 0)}
                      </td>
                      <td className="p-1.5 text-right font-mono font-semibold text-slate-700 dark:text-zinc-300 bg-emerald-50/20">
                        {fmtPln(m.position === 'Holiday accrual' ? m.estBonus : m.position === 'DM costs' ? m.estBonus * 1.1693 : m.baseSalary > 0 ? (m.contractRatio * m.baseSalary * 1.1948) : 0)}
                      </td>
                    </tr>
                  ))}
                  {/* TOTAL ROW */}
                  <tr className="bg-emerald-100/60 dark:bg-emerald-950/40 font-bold border-t-2 border-emerald-600 text-emerald-950 dark:text-emerald-200">
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800" colSpan={2}>
                      MANAGER TOTAL
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {managers.filter(m => !m.isSpecialRow).reduce((acc, m) => acc + m.contractRatio, 0).toFixed(2)}
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right font-mono">
                      -
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {summary.managerHoursPlan} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {managers.reduce((acc, m) => acc + (m.planSickHours || 0), 0)} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {managers.reduce((acc, m) => acc + (m.planHolidayHours || 0), 0)} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">-</td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-center">-</td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {summary.managerHoursEst} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {managers.reduce((acc, m) => acc + (m.estSickHours || 0), 0)} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {managers.reduce((acc, m) => acc + (m.estHolidayHours || 0), 0)} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">-</td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right font-black text-emerald-900 dark:text-emerald-300">
                      {fmtPln(summary.totalManagerPlan)}
                    </td>
                    <td className="p-2 text-right font-black text-emerald-900 dark:text-emerald-300">
                      {fmtPln(summary.totalManagerEst)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* TABELA 2: CREW UMOWA O PRACĘ (UoP) */}
          <div className="border border-slate-300 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="bg-[#007343] text-white px-3 py-1.5 font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-wide text-xs">2. CREW UMOWA O PRACĘ (UoP)</span>
                <span className="text-[11px] font-normal text-emerald-200">
                  ({crewUop.length} pracowników)
                </span>
              </div>
              <button
                onClick={onAddCrewUop}
                className="flex items-center gap-1 bg-emerald-800 hover:bg-emerald-700 text-white px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-600 transition-colors shadow-2xs"
              >
                <Plus className="w-3 h-3" />
                <span>Dodaj pracownika UoP</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse text-left">
                <thead>
                  <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-b border-slate-200 dark:border-zinc-700 font-semibold">
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-40">Imię i Nazwisko</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-16 text-center">Stanowisko</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-14 text-right">Etat</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-24 text-right">Stawka h brutto</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-16 text-right bg-amber-50/70 dark:bg-amber-950/20">Plan h</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-14 text-right bg-amber-50/70 dark:bg-amber-950/20">L4 h</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-14 text-right bg-amber-50/70 dark:bg-amber-950/20">Urlop h</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-20 text-center">ALERT</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-16 text-right bg-amber-50/70 dark:bg-amber-950/20">Rzecz. h</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-14 text-right bg-amber-50/70 dark:bg-amber-950/20">Est L4</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-14 text-right bg-amber-50/70 dark:bg-amber-950/20">Est Urlop</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-20 text-right font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50/40">COL Target</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-20 text-right font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50/40">COL Est</th>
                    <th className="p-1.5 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {crewUop.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="p-4 text-center text-slate-400 italic">
                        Brak pracowników na umowie o pracę. Kliknij „Dodaj pracownika UoP”, aby wprowadzić dane.
                      </td>
                    </tr>
                  ) : (
                    crewUop.map(u => {
                      const fullEtatH = u.contractRatio * storeInfo.fullContractHours;
                      const planSumH = u.planWorkHours + u.planSickHours + u.planHolidayHours;
                      const isUndertime = planSumH > 0 && planSumH < fullEtatH;
                      const isOvertime = planSumH > fullEtatH;

                      const effRate = u.hourlyRate;
                      const tCost = effRate * u.planWorkHours * 1.1948 + u.planWorkHours * 0.85 + u.contractRatio * 200;
                      const eCost = effRate * u.estWorkHours * 1.1948 + u.estWorkHours * 0.85 + u.contractRatio * 200;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700">
                            <input
                              type="text"
                              value={u.name}
                              placeholder="Imię i Nazwisko"
                              onChange={e => onUpdateCrewUop(u.id, { name: e.target.value })}
                              className="w-full bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1.5 py-0.5 font-medium"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-center">
                            <select
                              value={u.position}
                              onChange={e => onUpdateCrewUop(u.id, { position: e.target.value as any })}
                              className="bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5 font-semibold text-[10px]"
                            >
                              <option value="B">B</option>
                              <option value="BT">BT</option>
                              <option value="BARISTA">BARISTA</option>
                              <option value="KP">KP</option>
                              <option value="LOBBY">LOBBY</option>
                            </select>
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right">
                            <input
                              type="number"
                              step="0.25"
                              value={u.contractRatio}
                              onChange={e => onUpdateCrewUop(u.id, { contractRatio: parseFloat(e.target.value) || 0 })}
                              className="w-14 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right font-mono">
                            <input
                              type="number"
                              step="0.05"
                              value={u.hourlyRate}
                              onChange={e => onUpdateCrewUop(u.id, { hourlyRate: parseFloat(e.target.value) || 0 })}
                              className="w-20 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30">
                            <input
                              type="number"
                              value={u.planWorkHours}
                              onChange={e => onUpdateCrewUop(u.id, { planWorkHours: parseFloat(e.target.value) || 0 })}
                              className="w-14 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5 font-semibold"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30">
                            <input
                              type="number"
                              value={u.planSickHours}
                              onChange={e => onUpdateCrewUop(u.id, { planSickHours: parseFloat(e.target.value) || 0 })}
                              className="w-12 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30">
                            <input
                              type="number"
                              value={u.planHolidayHours}
                              onChange={e => onUpdateCrewUop(u.id, { planHolidayHours: parseFloat(e.target.value) || 0 })}
                              className="w-12 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-center">
                            {isUndertime && (
                              <span className="bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                NIEDOGODZINY
                              </span>
                            )}
                            {isOvertime && (
                              <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                NADGODZINY
                              </span>
                            )}
                            {!isUndertime && !isOvertime && (
                              <span className="text-emerald-600 font-bold text-[10px]">OK</span>
                            )}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30">
                            <input
                              type="number"
                              value={u.estWorkHours}
                              onChange={e => onUpdateCrewUop(u.id, { estWorkHours: parseFloat(e.target.value) || 0 })}
                              className="w-14 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5 font-semibold"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30">
                            <input
                              type="number"
                              value={u.estSickHours}
                              onChange={e => onUpdateCrewUop(u.id, { estSickHours: parseFloat(e.target.value) || 0 })}
                              className="w-12 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30">
                            <input
                              type="number"
                              value={u.estHolidayHours}
                              onChange={e => onUpdateCrewUop(u.id, { estHolidayHours: parseFloat(e.target.value) || 0 })}
                              className="w-12 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right font-mono font-semibold text-slate-700 dark:text-zinc-300 bg-emerald-50/20">
                            {fmtPln(tCost)}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right font-mono font-semibold text-slate-700 dark:text-zinc-300 bg-emerald-50/20">
                            {fmtPln(eCost)}
                          </td>
                          <td className="p-1 text-center">
                            <button
                              onClick={() => onRemoveCrewUop(u.id)}
                              className="text-slate-400 hover:text-red-600 transition-colors p-1"
                              title="Usuń pracownika"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {/* TOTAL ROW */}
                  <tr className="bg-emerald-100/60 dark:bg-emerald-950/40 font-bold border-t-2 border-emerald-600 text-emerald-950 dark:text-emerald-200">
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800" colSpan={2}>
                      UMOWA O PRACĘ TOTAL
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {crewUop.reduce((acc, u) => acc + u.contractRatio, 0).toFixed(2)}
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right font-mono">-</td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {summary.crewUopHoursPlan} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {crewUop.reduce((acc, u) => acc + (u.planSickHours || 0), 0)} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {crewUop.reduce((acc, u) => acc + (u.planHolidayHours || 0), 0)} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-center">-</td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {summary.crewUopHoursEst} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {crewUop.reduce((acc, u) => acc + (u.estSickHours || 0), 0)} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {crewUop.reduce((acc, u) => acc + (u.estHolidayHours || 0), 0)} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right font-black text-emerald-900 dark:text-emerald-300">
                      {fmtPln(summary.basicSalaryCrewPlan + summary.workingClothesEquivalentPlan + summary.socialCrewPlan)}
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right font-black text-emerald-900 dark:text-emerald-300">
                      {fmtPln(summary.basicSalaryCrewEst + summary.workingClothesEquivalentEst + summary.socialCrewEst)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* TABELA 3: CREW UMOWA ZLECENIE (UZ) */}
          <div className="border border-slate-300 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="bg-[#007343] text-white px-3 py-1.5 font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-wide text-xs">3. CREW UMOWA ZLECENIE (UZ)</span>
                <span className="text-[11px] font-normal text-emerald-200">
                  ({crewUz.length} Zleceniobiorców — Human Rent: {((summary.crewUzHoursPlan / storeInfo.fullContractHours)).toFixed(2)} FTE)
                </span>
              </div>
              <button
                onClick={onAddCrewUz}
                className="flex items-center gap-1 bg-emerald-800 hover:bg-emerald-700 text-white px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-600 transition-colors shadow-2xs"
              >
                <Plus className="w-3 h-3" />
                <span>Dodaj zleceniobiorcę UZ</span>
              </button>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-[11px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-b border-slate-200 dark:border-zinc-700 font-semibold">
                  <tr>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-44">Imię i Nazwisko</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-16 text-center">Stanowisko</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-24 text-right">Stawka h brutto</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-20 text-right bg-amber-50/70 dark:bg-amber-950/20">Plan h</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-20 text-right bg-amber-50/70 dark:bg-amber-950/20">Rzecz. h</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-16 text-right bg-amber-50/70 dark:bg-amber-950/20">Bonus</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-24 text-right font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50/40">COL Target</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-24 text-right font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50/40">COL Est</th>
                    <th className="p-1.5 w-8 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {crewUz.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-slate-400 italic">
                        Brak zleceniobiorców na ten miesiąc. Kliknij „Dodaj zleceniobiorcę UZ”, aby dodać baristę.
                      </td>
                    </tr>
                  ) : (
                    crewUz.map(z => {
                      const tCost = z.hourlyRate * z.planWorkHours;
                      const eCost = z.hourlyRate * z.estWorkHours;

                      return (
                        <tr key={z.id} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700">
                            <input
                              type="text"
                              value={z.name}
                              placeholder="Imię i Nazwisko"
                              onChange={e => onUpdateCrewUz(z.id, { name: e.target.value })}
                              className="w-full bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1.5 py-0.5 font-medium"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-center">
                            <select
                              value={z.position}
                              onChange={e => onUpdateCrewUz(z.id, { position: e.target.value as any })}
                              className="bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5 font-semibold text-[10px]"
                            >
                              <option value="B">B</option>
                              <option value="BT">BT</option>
                              <option value="BARISTA">BARISTA</option>
                              <option value="KP">KP</option>
                              <option value="LOBBY">LOBBY</option>
                            </select>
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right font-mono">
                            <input
                              type="number"
                              step="0.05"
                              value={z.hourlyRate}
                              onChange={e => onUpdateCrewUz(z.id, { hourlyRate: parseFloat(e.target.value) || 0 })}
                              className="w-20 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30">
                            <input
                              type="number"
                              value={z.planWorkHours}
                              onChange={e => onUpdateCrewUz(z.id, { planWorkHours: parseFloat(e.target.value) || 0 })}
                              className="w-16 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5 font-semibold"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30">
                            <input
                              type="number"
                              value={z.estWorkHours}
                              onChange={e => onUpdateCrewUz(z.id, { estWorkHours: parseFloat(e.target.value) || 0 })}
                              className="w-16 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5 font-semibold"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30">
                            <input
                              type="number"
                              value={z.bonus}
                              onChange={e => onUpdateCrewUz(z.id, { bonus: parseFloat(e.target.value) || 0 })}
                              className="w-16 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right font-mono font-semibold text-slate-700 dark:text-zinc-300 bg-emerald-50/20">
                            {fmtPln(tCost)}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right font-mono font-semibold text-slate-700 dark:text-zinc-300 bg-emerald-50/20">
                            {fmtPln(eCost)}
                          </td>
                          <td className="p-1 text-center">
                            <button
                              onClick={() => onRemoveCrewUz(z.id)}
                              className="text-slate-400 hover:text-red-600 transition-colors p-1"
                              title="Usuń zleceniobiorcę"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {/* TOTAL ROW */}
                  <tr className="sticky bottom-0 bg-emerald-100/90 dark:bg-emerald-950 font-bold border-t-2 border-emerald-600 text-emerald-950 dark:text-emerald-200 shadow-xs">
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800" colSpan={3}>
                      HUMAN RENT TOTAL (UZ)
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {summary.crewUzHoursPlan} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {summary.crewUzHoursEst} h
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right">
                      {crewUz.reduce((acc, z) => acc + (z.bonus || 0), 0)} zł
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right font-black text-emerald-900 dark:text-emerald-300">
                      {fmtPln(summary.civilContractsSalariesPlan)}
                    </td>
                    <td className="p-2 border-r border-emerald-300 dark:border-emerald-800 text-right font-black text-emerald-900 dark:text-emerald-300">
                      {fmtPln(summary.civilContractsSalariesEst)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* TABELA 4: OTHER COSTS & DRIVERS */}
          <div className="border border-slate-300 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="bg-[#007343] text-white px-3 py-1.5 font-bold flex items-center justify-between">
              <span className="uppercase tracking-wide text-xs">4. OTHER COSTS & DRIVERS (Koszty Inne i Dostawy)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse text-left">
                <thead>
                  <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-b border-slate-200 dark:border-zinc-700 font-semibold">
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-80">Pozycja Kosztowa</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-28 text-right bg-amber-50/70 dark:bg-amber-950/20">Wartość Plan</th>
                    <th className="p-1.5 border-r border-slate-200 dark:border-zinc-700 w-28 text-right bg-amber-50/70 dark:bg-amber-950/20">Wartość Est</th>
                    <th className="p-1.5 text-slate-500 pl-4">Opis / Formuła kalkulacji</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {otherCosts.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 font-medium">
                        {o.label}
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30 font-mono">
                        <input
                          type="number"
                          value={o.planVal}
                          onChange={e => onUpdateOtherCost(o.id, { planVal: parseFloat(e.target.value) || 0 })}
                          className="w-24 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1.5 py-0.5"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200 dark:border-zinc-700 text-right bg-amber-50/30 font-mono">
                        <input
                          type="number"
                          value={o.estVal}
                          onChange={e => onUpdateOtherCost(o.id, { estVal: parseFloat(e.target.value) || 0 })}
                          className="w-24 text-right bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1.5 py-0.5"
                        />
                      </td>
                      <td className="p-1.5 text-slate-500 dark:text-zinc-400 pl-4 text-[10px]">
                        {o.label === 'Drivers' && 'Liczba transakcji delivery × 14 zł (Cost per drop)'}
                        {o.label === 'Bonus CREW' && 'Sugerowany budżet: 0.2% Sprzedaży (Sales × 0.002)'}
                        {o.label === 'Bonus SSV No Area' && 'Sugerowany budżet: 0.1% Sprzedaży (Sales × 0.001)'}
                        {o.label === 'Medical examination ryczałt' && 'Ryczałt za badania Sanepid / medycyny pracy'}
                        {o.label === 'ADP' && 'Miesięczny koszt obsługi kadrowo-płacowej systemu ADP'}
                        {o.label === 'PPK' && 'Pracownicze Plany Kapitałowe (Manager + Crew)'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
