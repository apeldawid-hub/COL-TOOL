import React, { useState } from 'react';
import { Database, Search, Building2, ShieldCheck, DollarSign } from 'lucide-react';

export const ColDaneSheet: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const monthsData = [
    { name: 'STYCZEŃ', days: 21, hours: 168, minRate: 27.77, nightBonus: 5.55 },
    { name: 'LUTY', days: 20, hours: 160, minRate: 29.16, nightBonus: 5.83 },
    { name: 'MARZEC', days: 21, hours: 168, minRate: 27.77, nightBonus: 5.55 },
    { name: 'KWIECIEŃ', days: 21, hours: 168, minRate: 27.77, nightBonus: 5.55 },
    { name: 'MAJ', days: 20, hours: 160, minRate: 29.16, nightBonus: 5.83 },
    { name: 'CZERWIEC', days: 20, hours: 160, minRate: 29.16, nightBonus: 5.83 },
    { name: 'LIPIEC', days: 23, hours: 184, minRate: 25.36, nightBonus: 5.07 },
    { name: 'SIERPIEŃ', days: 20, hours: 160, minRate: 29.16, nightBonus: 5.83 },
    { name: 'WRZESIEŃ', days: 22, hours: 176, minRate: 26.51, nightBonus: 5.30 },
    { name: 'PAŹDZIERNIK', days: 23, hours: 184, minRate: 25.36, nightBonus: 5.07 },
    { name: 'LISTOPAD', days: 18, hours: 144, minRate: 32.40, nightBonus: 6.48 },
    { name: 'GRUDZIEŃ', days: 20, hours: 160, minRate: 29.16, nightBonus: 5.83 }
  ];

  const managerRyczałty = [
    { role: 'SM (Store Manager)', etat: 1.0, equiv: '300 zł', pfron: '200 zł', compBen: '300 zł', jpa: '367 zł' },
    { role: 'ASM (Assistant SM)', etat: 0.75, equiv: '300 zł', pfron: '200 zł', compBen: '250 zł', jpa: '-' },
    { role: 'SSV-PM (Shift Supervisor)', etat: 0.5, equiv: '350 zł', pfron: '200 zł', compBen: '200 zł', jpa: '-' },
    { role: 'SSV-FM (Shift Supervisor)', etat: 0.25, equiv: '350 zł', pfron: '200 zł', compBen: '200 zł', jpa: '-' },
    { role: 'SSV (Shift Supervisor)', etat: 1.0, equiv: '350 zł', pfron: '200 zł', compBen: '200 zł', jpa: '-' },
    { role: 'BARISTA / BT (Załoga)', etat: 1.0, equiv: '0.85 zł / h', pfron: '200 zł', compBen: '-', jpa: '-' }
  ];

  const storesSample = [
    { mpk: '108120', name: 'SBX Warszawa Janki' },
    { mpk: '108001', name: 'SBX Warszawa Al. Jerozolimskie' },
    { mpk: '108002', name: 'SBX Warszawa Zodiak' },
    { mpk: '108004', name: 'SBX Warszawa Nowy Swiat' },
    { mpk: '108026', name: 'SBX Warszawa Zebra Tower' },
    { mpk: '108040', name: 'SBX Warszawa WFC' },
    { mpk: '108046', name: 'SBX Warszawa Sadyba' },
    { mpk: '108063', name: 'SBX Warszawa Arkadia' },
    { mpk: '108098', name: 'SBX Warszawa Rzeczypospolitej' },
    { mpk: '108111', name: 'SBX Warszawa Pulawska' },
    { mpk: '108115', name: 'SBX Warszawa Galeria Polnocna' },
    { mpk: '108153', name: 'SBX Warszawa Elektrownia Powisle' },
    { mpk: '108161', name: 'SBX Piaseczno SanPark' }
  ];

  const filteredStores = storesSample.filter(
    s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.mpk.includes(searchTerm)
  );

  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-zinc-950 overflow-y-auto font-sans text-xs">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-[#007343] text-white p-4 rounded-lg shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-amber-300" />
            <div>
              <h2 className="text-base font-bold">ARKUSZ: DANE (Centralne Parametry i Słowniki)</h2>
              <p className="text-emerald-200 text-xs">
                Wymiary etatu, minimalne stawki godzinowe, dodatki nocne, narzuty ZUS pracodawcy i katalog kawiarni
              </p>
            </div>
          </div>
          <span className="bg-black/20 text-white font-mono px-3 py-1 rounded text-xs border border-white/10">
            Jednostka: 108120 Janki
          </span>
        </div>

        {/* Sekcja 1: Tabela Miesięcy i Czasu Pracy */}
        <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="bg-slate-100 dark:bg-zinc-800 px-4 py-2 font-bold text-slate-800 dark:text-zinc-200 uppercase text-xs">
            Nominały Czasu Pracy i Minimalne Stawki Godzinowe w 2025 roku (Zakres J1:N14)
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-850/50 text-slate-600 dark:text-zinc-400 font-semibold text-[11px]">
                <th className="p-2.5">Miesiąc</th>
                <th className="p-2.5 text-right">Liczba dni roboczych</th>
                <th className="p-2.5 text-right">Nominał etatu (h)</th>
                <th className="p-2.5 text-right">Min. stawka godzinowa</th>
                <th className="p-2.5 text-right">Dodatek nocny (+20%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {monthsData.map(m => (
                <tr key={m.name} className={m.name === 'WRZESIEŃ' ? 'bg-emerald-50/60 dark:bg-emerald-950/40 font-bold' : 'hover:bg-slate-50 dark:hover:bg-zinc-850'}>
                  <td className="p-2.5 flex items-center gap-2">
                    {m.name === 'WRZESIEŃ' && <span className="w-2 h-2 rounded-full bg-emerald-600"></span>}
                    {m.name}
                  </td>
                  <td className="p-2.5 text-right font-mono">{m.days} dni</td>
                  <td className="p-2.5 text-right font-mono">{m.hours} h</td>
                  <td className="p-2.5 text-right font-mono">{m.minRate.toFixed(2)} zł/h</td>
                  <td className="p-2.5 text-right font-mono text-slate-500">{m.nightBonus.toFixed(2)} zł/h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sekcja 2: Składki ZUS i Narzuty Pracodawcy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs">
            <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-xs uppercase flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Narzuty ZUS Pracodawcy (AmRest)
            </h3>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-600 dark:text-zinc-400">Ubezpieczenie Emerytalne:</span>
                <span className="font-mono font-bold">9.76%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-600 dark:text-zinc-400">Ubezpieczenie Rentowe:</span>
                <span className="font-mono font-bold">6.50%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-600 dark:text-zinc-400">Ubezpieczenie Wypadkowe:</span>
                <span className="font-mono font-bold">0.67%</span>
              </div>
              <div className="flex justify-between py-1.5 bg-emerald-50 dark:bg-emerald-950/30 px-2 rounded font-semibold text-emerald-900 dark:text-emerald-300">
                <span>Razem Social Insurance:</span>
                <span className="font-mono font-black">16.93%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-600 dark:text-zinc-400">Fundusz Pracy (FP):</span>
                <span className="font-mono font-bold">2.45%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-slate-600 dark:text-zinc-400">FGŚP:</span>
                <span className="font-mono font-bold">0.10%</span>
              </div>
              <div className="flex justify-between py-1.5 bg-amber-50 dark:bg-amber-950/30 px-2 rounded font-bold text-amber-900 dark:text-amber-300">
                <span>ŁĄCZNE SKŁADKI PRACODAWCY:</span>
                <span className="font-mono font-black">19.48%</span>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs">
            <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-xs uppercase flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Świadczenia Pozapłacowe i Ryczałty
            </h3>
            <div className="space-y-1.5 text-[11px]">
              {managerRyczałty.map(r => (
                <div key={r.role} className="flex justify-between py-1 border-b border-slate-100 dark:border-zinc-800 text-[10px]">
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">{r.role}</span>
                  <div className="space-x-2 text-slate-500 font-mono">
                    <span>Odzież: {r.equiv}</span>
                    <span>PFRON: {r.pfron}</span>
                    {r.compBen !== '-' && <span>C&B: {r.compBen}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sekcja 3: Katalog Kawiarni Starbucks w Polsce */}
        <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-xs uppercase flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              Katalog Kawiarni Starbucks Polska (Baza MPK z SAP)
            </h3>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filtruj kawiarnię lub MPK..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2 py-1 text-xs border border-slate-200 dark:border-zinc-700 rounded bg-slate-50 dark:bg-zinc-800"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {filteredStores.map(s => (
              <div
                key={s.mpk}
                className={`p-2 rounded border text-[11px] flex justify-between items-center ${
                  s.mpk === '108120'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 font-bold text-emerald-900 dark:text-emerald-200'
                    : 'border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850'
                }`}
              >
                <span>{s.name}</span>
                <span className="font-mono text-slate-500 text-[10px]">{s.mpk}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
