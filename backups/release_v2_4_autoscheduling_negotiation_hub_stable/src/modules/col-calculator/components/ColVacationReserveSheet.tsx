import React, { useState } from 'react';
import { Calendar, DollarSign, Calculator, Info } from 'lucide-react';
import { ColManagerItem } from '../types/colTypes';

interface ColVacationReserveSheetProps {
  managers: ColManagerItem[];
}

interface VacationReserveRow {
  id: string;
  name: string;
  unusedDays: number;
  monthlySalary: number;
}

export const ColVacationReserveSheet: React.FC<ColVacationReserveSheetProps> = ({ managers }) => {
  // Initial unused vacation days from sheet Rezerwa urlopowa rows 87..101
  const initialDaysMap: Record<string, number> = {
    'Dawid Szeluga': 2,
    'Dawid Apel': 4,
    'Zuzanna Makowska': 1,
    'Weronika Bieńkowska': 4,
    'Nikola Studzińska': 4,
    'Kamil Kamiński': 0
  };

  const [reserveRows, setReserveRows] = useState<VacationReserveRow[]>(() => {
    return managers
      .filter(m => !m.isSpecialRow && m.name)
      .map(m => ({
        id: m.id,
        name: m.name,
        unusedDays: initialDaysMap[m.name] ?? 0,
        monthlySalary: m.baseSalary * m.contractRatio
      }));
  });

  const [prevMonthReserveBrutto, setPrevMonthReserveBrutto] = useState<number>(-127);

  const updateDays = (id: string, days: number) => {
    setReserveRows(prev => prev.map(r => (r.id === id ? { ...r, unusedDays: days } : r)));
  };

  // Calculations per row:
  // E = ROUND((D / 21) * C, 0)
  // F = ROUND(E * 0.195, 0)
  // G = E + F
  const calculatedRows = reserveRows.map(r => {
    const reserveBrutto = Math.round((r.monthlySalary / 21) * r.unusedDays);
    const zus = Math.round(reserveBrutto * 0.195);
    const total = reserveBrutto + zus;
    return {
      ...r,
      reserveBrutto,
      zus,
      total
    };
  });

  const sumSalary = calculatedRows.reduce((acc, r) => acc + r.monthlySalary, 0);
  const sumDays = calculatedRows.reduce((acc, r) => acc + r.unusedDays, 0);
  const sumReserveBrutto = calculatedRows.reduce((acc, r) => acc + r.reserveBrutto, 0);
  const sumZus = calculatedRows.reduce((acc, r) => acc + r.zus, 0);
  const currentMonthTotal = calculatedRows.reduce((acc, r) => acc + r.total, 0);

  // Prev month calculations
  const prevMonthZus = Math.round(prevMonthReserveBrutto * 0.195);
  const prevMonthTotal = prevMonthReserveBrutto + prevMonthZus;

  // Final amount for DOS+ report
  const finalAmountDos = currentMonthTotal - prevMonthTotal;

  const fmtPln = (val: number) =>
    new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val) + ' zł';

  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-zinc-950 overflow-y-auto font-sans text-xs">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-[#007343] text-white p-4 rounded-lg shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-amber-300" />
            <div>
              <h2 className="text-base font-bold">ARKUSZ: Rezerwa urlopowa (Niewykorzystane Urlopy Menedżerów)</h2>
              <p className="text-emerald-200 text-xs">
                Kalkulacja comiesięcznego księgowania rezerwy urlopowej (Konto 4051 oraz 4061011 ZUS) zasilającego Holiday Accrual w kalkulatorze
              </p>
            </div>
          </div>
          <div className="bg-black/20 text-white font-mono px-3 py-1.5 rounded text-right border border-white/10">
            <div className="text-[10px] text-emerald-200">Kwota do raportu DOS+:</div>
            <div className="text-base font-bold text-amber-300">{fmtPln(finalAmountDos)}</div>
          </div>
        </div>

        {/* Instrukcja z Excela */}
        <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-lg p-3 flex gap-3 items-start text-slate-700 dark:text-zinc-300 text-[11px]">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900 dark:text-blue-300">Zasady naliczania rezerwy urlopowej (Krok 1 - 3):</p>
            <p className="mt-0.5">
              1. Wprowadź ilość dni niewykorzystanego urlopu dla poszczególnych menedżerów w żółtych polach kolumny <em>C</em>.<br />
              2. Dzielnik stały wynosi <strong>21 dni roboczych</strong> (stawka dobowe: Płaca brutto / 21).<br />
              3. Narzut ZUS pracodawcy wynosi <strong>19.5%</strong>.<br />
              4. Ostateczna kwota do raportu DOS+ to różnica między rezerwą bieżącą a rezerwą z poprzedniego miesiąca.
            </p>
          </div>
        </div>

        {/* Tabela Rezerwy Urlopowej */}
        <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="bg-slate-100 dark:bg-zinc-800 px-4 py-2 font-bold text-slate-800 dark:text-zinc-200 uppercase text-xs">
            Narzędzie Kalkulacji Rezerwy Urlopowej (Odzwierciedlenie A86:G106)
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-850/50 text-slate-600 dark:text-zinc-400 font-semibold text-[11px]">
                <th className="p-2.5 w-12 text-center border-r border-slate-200 dark:border-zinc-700">lp.</th>
                <th className="p-2.5 border-r border-slate-200 dark:border-zinc-700">Nazwisko i Imię pracownika</th>
                <th className="p-2.5 w-36 text-right border-r border-slate-200 dark:border-zinc-700 bg-amber-50/70 dark:bg-amber-950/20">
                  Dni urlopu (żółte)
                </th>
                <th className="p-2.5 w-36 text-right border-r border-slate-200 dark:border-zinc-700">Płaca brutto (D)</th>
                <th className="p-2.5 w-36 text-right border-r border-slate-200 dark:border-zinc-700">
                  Kwota rezerwy (Konto 4051)
                </th>
                <th className="p-2.5 w-32 text-right border-r border-slate-200 dark:border-zinc-700">
                  Składka ZUS 19.5% (Konto 4061011)
                </th>
                <th className="p-2.5 w-36 text-right font-bold text-emerald-700 dark:text-emerald-400">
                  RAZEM Rezerwa (G)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {calculatedRows.map((r, idx) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                  <td className="p-2.5 text-center text-slate-400 border-r border-slate-200 dark:border-zinc-700">{idx + 1}</td>
                  <td className="p-2.5 font-medium text-slate-800 dark:text-zinc-200 border-r border-slate-200 dark:border-zinc-700">{r.name}</td>
                  <td className="p-2.5 text-right border-r border-slate-200 dark:border-zinc-700 bg-amber-50/30">
                    <input
                      type="number"
                      value={r.unusedDays}
                      onChange={e => updateDays(r.id, parseInt(e.target.value) || 0)}
                      className="w-16 text-right font-bold bg-[#ffffcc] text-slate-900 border border-amber-300 rounded px-1.5 py-0.5"
                    />
                  </td>
                  <td className="p-2.5 text-right font-mono border-r border-slate-200 dark:border-zinc-700">{fmtPln(r.monthlySalary)}</td>
                  <td className="p-2.5 text-right font-mono border-r border-slate-200 dark:border-zinc-700">{fmtPln(r.reserveBrutto)}</td>
                  <td className="p-2.5 text-right font-mono border-r border-slate-200 dark:border-zinc-700">{fmtPln(r.zus)}</td>
                  <td className="p-2.5 text-right font-mono font-bold text-emerald-800 dark:text-emerald-400">{fmtPln(r.total)}</td>
                </tr>
              ))}
              {/* SUMA RAZEM */}
              <tr className="bg-emerald-50 dark:bg-emerald-950/30 font-bold border-t-2 border-emerald-600 text-emerald-950 dark:text-emerald-200">
                <td className="p-3 border-r border-emerald-300 dark:border-emerald-800 text-center" colSpan={2}>
                  RAZEM (Nowa Rezerwa)
                </td>
                <td className="p-3 text-right border-r border-emerald-300 dark:border-emerald-800">{sumDays} dni</td>
                <td className="p-3 text-right font-mono border-r border-emerald-300 dark:border-emerald-800">{fmtPln(sumSalary)}</td>
                <td className="p-3 text-right font-mono border-r border-emerald-300 dark:border-emerald-800">{fmtPln(sumReserveBrutto)}</td>
                <td className="p-3 text-right font-mono border-r border-emerald-300 dark:border-emerald-800">{fmtPln(sumZus)}</td>
                <td className="p-3 text-right font-mono font-black text-emerald-800 dark:text-emerald-300 text-sm">
                  {fmtPln(currentMonthTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Rozliczenie z Poprzednim Miesiącem (Krok 2) */}
        <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs">
          <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-xs uppercase">
            Uzgodnienie Zmiany Rezerwy (Delta do raportu DOS+)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700 space-y-1">
              <span className="text-slate-500 text-[10px]">Wartość rezerwy z zeszłego miesiąca (brutto):</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={prevMonthReserveBrutto}
                  onChange={e => setPrevMonthReserveBrutto(parseFloat(e.target.value) || 0)}
                  className="w-full text-right font-bold bg-[#ffffcc] text-slate-900 border border-amber-300 rounded p-1.5"
                />
              </div>
              <div className="text-[10px] text-slate-500 text-right">
                ZUS 19.5%: {fmtPln(prevMonthZus)} | Razem: {fmtPln(prevMonthTotal)}
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700 space-y-1">
              <span className="text-slate-500 text-[10px]">Rezerwa z nowego miesiąca:</span>
              <div className="text-lg font-bold text-slate-800 dark:text-zinc-200 pt-1">
                {fmtPln(currentMonthTotal)}
              </div>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded border-2 border-emerald-600 space-y-1">
              <span className="text-emerald-800 dark:text-emerald-300 font-bold text-[10px] uppercase">
                Kwota do raportu DOS+ / P&L:
              </span>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                {fmtPln(finalAmountDos)}
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                (Trafiła do komórki Holiday Accrual L17 w CALCULATOR)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
