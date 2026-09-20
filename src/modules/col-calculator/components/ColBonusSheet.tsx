import React, { useState } from 'react';
import { Award, TrendingUp, Percent } from 'lucide-react';

export const ColBonusSheet: React.FC = () => {
  const [salesAop, setSalesAop] = useState<number>(310000);
  const [salesActual, setSalesActual] = useState<number>(315000);
  const [profitAop, setProfitAop] = useState<number>(45000);
  const [profitActual, setProfitActual] = useState<number>(47000);

  const salesIndex = salesAop > 0 ? salesActual / salesAop : 0;
  const profitIndex = profitAop > 0 ? profitActual / profitAop : 0;

  // Bonus lookup function based on BONUS sheet rows 20..36
  const getCapPct = (index: number) => {
    if (index >= 1.10) return 0.75;
    if (index >= 1.09) return 0.73;
    if (index >= 1.08) return 0.70;
    if (index >= 1.07) return 0.68;
    if (index >= 1.06) return 0.65;
    if (index >= 1.05) return 0.63;
    if (index >= 1.04) return 0.60;
    if (index >= 1.03) return 0.58;
    if (index >= 1.02) return 0.55;
    if (index >= 1.01) return 0.53;
    if (index >= 1.00) return 0.50;
    if (index >= 0.99) return 0.33;
    if (index >= 0.98) return 0.23;
    if (index >= 0.97) return 0.18;
    if (index >= 0.96) return 0.13;
    if (index >= 0.95) return 0.10;
    return 0.0;
  };

  const salesCapPct = getCapPct(salesIndex);
  const profitCapPct = getCapPct(profitIndex);
  const totalCapPct = salesCapPct + profitCapPct;

  const caps = {
    SM: 2250,
    ASM: 1000,
    'SSV-PM': 700,
    'SSV-FM': 700
  };

  const fmtPln = (val: number) =>
    new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' zł';

  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-zinc-950 overflow-y-auto font-sans text-xs">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-[#007343] text-white p-4 rounded-lg shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-amber-300" />
            <div>
              <h2 className="text-base font-bold">ARKUSZ: BONUS (Kalkulator Premii Kierowników)</h2>
              <p className="text-emerald-200 text-xs">
                Wyliczanie premii menedżerskich na podstawie realizacji celów Sprzedaży (Sales) i Zysku Operacyjnego (Ops Profit)
              </p>
            </div>
          </div>
          <span className="bg-black/20 text-white font-mono px-3 py-1 rounded text-xs border border-white/10">
            Maks. łączna premia: 150% Cap
          </span>
        </div>

        {/* Dynamic Inputs & Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Filar 1: Sprzedaż */}
          <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
              <span className="font-bold text-slate-800 dark:text-zinc-200 uppercase text-xs">
                1. Filar Sprzedaży (Sales vs AOP)
              </span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                Waga: 50% Cap bazowego
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500">Sales Cel (AOP PLN):</label>
                <input
                  type="number"
                  value={salesAop}
                  onChange={e => setSalesAop(parseFloat(e.target.value) || 0)}
                  className="w-full text-right font-bold bg-[#ffffcc] text-slate-900 border border-amber-300 rounded p-1.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Sales Wykonanie (PLN):</label>
                <input
                  type="number"
                  value={salesActual}
                  onChange={e => setSalesActual(parseFloat(e.target.value) || 0)}
                  className="w-full text-right font-bold bg-[#ffffcc] text-slate-900 border border-amber-300 rounded p-1.5"
                />
              </div>
            </div>
            <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-800 p-2 rounded text-[11px]">
              <span className="text-slate-600 dark:text-zinc-400">Index realizacji:</span>
              <span className="font-bold text-slate-800 dark:text-zinc-200">
                {(salesIndex * 100).toFixed(1)}% ({salesIndex.toFixed(2)})
              </span>
            </div>
            <div className="flex justify-between items-center bg-emerald-50/60 dark:bg-emerald-950/30 p-2 rounded text-[11px]">
              <span className="font-semibold text-emerald-900 dark:text-emerald-300">% Capu z filaru:</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400 text-xs">
                {(salesCapPct * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Filar 2: Rentowność (Ops Profit) */}
          <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
              <span className="font-bold text-slate-800 dark:text-zinc-200 uppercase text-xs">
                2. Filar Rentowności (Ops Profit vs AOP)
              </span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                Waga: 50% Cap bazowego
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500">Ops Profit Cel (AOP PLN):</label>
                <input
                  type="number"
                  value={profitAop}
                  onChange={e => setProfitAop(parseFloat(e.target.value) || 0)}
                  className="w-full text-right font-bold bg-[#ffffcc] text-slate-900 border border-amber-300 rounded p-1.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Ops Profit Wykonanie (PLN):</label>
                <input
                  type="number"
                  value={profitActual}
                  onChange={e => setProfitActual(parseFloat(e.target.value) || 0)}
                  className="w-full text-right font-bold bg-[#ffffcc] text-slate-900 border border-amber-300 rounded p-1.5"
                />
              </div>
            </div>
            <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-800 p-2 rounded text-[11px]">
              <span className="text-slate-600 dark:text-zinc-400">Index realizacji:</span>
              <span className="font-bold text-slate-800 dark:text-zinc-200">
                {(profitIndex * 100).toFixed(1)}% ({profitIndex.toFixed(2)})
              </span>
            </div>
            <div className="flex justify-between items-center bg-emerald-50/60 dark:bg-emerald-950/30 p-2 rounded text-[11px]">
              <span className="font-semibold text-emerald-900 dark:text-emerald-300">% Capu z filaru:</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400 text-xs">
                {(profitCapPct * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Tabela Wynikowa Premii per Stanowisko */}
        <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="bg-slate-100 dark:bg-zinc-800 px-4 py-2 font-bold text-slate-800 dark:text-zinc-200 uppercase text-xs flex justify-between">
            <span>Sugerowane Premie Kierowników (Łączny % Capu: {(totalCapPct * 100).toFixed(0)}%)</span>
            <span className="text-slate-500 text-[11px]">Wzór: Cap × (Filar Sales + Filar Profit)</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-850/50 text-slate-600 dark:text-zinc-400">
                <th className="p-3">Stanowisko</th>
                <th className="p-3 text-right">Limit Maksymalny (Cap)</th>
                <th className="p-3 text-right">Premia ze Sprzedaży</th>
                <th className="p-3 text-right">Premia z Zysku</th>
                <th className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                  ŁĄCZNA SUGEROWANA PREMIA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {Object.entries(caps).map(([pos, cap]) => {
                const bSales = cap * salesCapPct;
                const bProfit = cap * profitCapPct;
                const bTotal = bSales + bProfit;
                return (
                  <tr key={pos} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                    <td className="p-3 font-bold text-slate-800 dark:text-zinc-200">{pos}</td>
                    <td className="p-3 text-right font-mono text-slate-600 dark:text-zinc-400">{fmtPln(cap)}</td>
                    <td className="p-3 text-right font-mono">{fmtPln(bSales)}</td>
                    <td className="p-3 text-right font-mono">{fmtPln(bProfit)}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                      {totalCapPct > 0 ? fmtPln(bTotal) : 'brak premii'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tabela Progowania Cap z Arkusza Excel */}
        <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 p-4 space-y-2">
          <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-xs uppercase">
            Tabela Progowania % Capu (Odzwierciedlenie zakresu F20:J36)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700">
              <span className="text-slate-500">≥ 110% celu:</span> <strong className="text-emerald-600">75% Cap</strong> (Maks. 150%)
            </div>
            <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700">
              <span className="text-slate-500">105% celu:</span> <strong className="text-emerald-600">63% Cap</strong>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700">
              <span className="text-slate-500">100% celu (Plan):</span> <strong className="text-emerald-600">50% Cap</strong> (100% bazowy)
            </div>
            <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700">
              <span className="text-slate-500">&lt; 94% celu:</span> <strong className="text-red-600">0% Cap</strong> (brak premii)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
