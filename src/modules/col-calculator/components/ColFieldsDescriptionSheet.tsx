import React, { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';

export const ColFieldsDescriptionSheet: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const metrics = [
    { num: 19, name: 'Mgmt %', unit: '%', desc: 'Całkowite koszty managerów jako % od sprzedaży (dane z P&L: wynagrodzenie, ZUS, bonusy, wakacje, zwolnienia lekarskie, kafeteria, rezerwy)', formula: 'Col Managers / Sales' },
    { num: 20, name: 'Crew %', unit: '%', desc: 'Całkowite koszty crew (HOH, BOH, UZ, delivery zatrudniane przez AmRest) jako % od sprzedaży', formula: 'Col Crew / Sales' },
    { num: 21, name: 'Delivery %', unit: '%', desc: 'Koszty kierowców delivery (osoby na działalności świadczące usługi na rzecz AmRest: UberEats, Glovo itp.) jako % od sprzedaży', formula: 'Col Delivery / Sales' },
    { num: 22, name: 'TOTAL COL %', unit: '%', desc: 'Łączne koszty pracy (Cost of Labor) jako % od sprzedaży (dane z P&L)', formula: 'Total COL / Sales' },
    { num: 23, name: 'Total MPT', unit: 'min/trans', desc: 'Wskaźnik efektywności managerów i crew liczony jako łączna ilość minut pracy przypadająca na jedną transakcję', formula: '(Godziny MGR + Godziny Crew - Godziny Delivery) × 60 / Trans' },
    { num: 24, name: 'Sales per total working hours (SPLH)', unit: 'PLN/h', desc: 'Średnia wartość sprzedaży przypadająca na jedną przepracowaną godzinę crew oraz managerów', formula: 'Sales / (Total Crew Hours + Total Manager Hours)' },
    { num: 25, name: 'TPLH (Total)', unit: 'trans/h', desc: 'Transakcje na roboczogodzinę kawiarni (Transactions Per Labor Hour)', formula: 'Trans / (Total Crew Hours + Total Manager Hours)' },
    { num: 26, name: 'TPLH (Coverage)', unit: 'trans/h', desc: 'Transakcje na roboczogodzinę na stanowiskach operacyjnych (po wyłączeniu szkoleń i absencji)', formula: 'Trans / (Total Hours - Non-Coverage - Training)' },
    { num: 27, name: 'Working Hours Budget', unit: 'h', desc: 'Dozwolony budżet godzin przy zaplanowanej liczbie transakcji i docelowym TPLH', formula: 'Trans / TPLH Target' },
    { num: 35, name: 'Crew MPT', unit: 'min/trans', desc: 'Średnia ilość minut pracy załogi (crew) przypadająca na jedną transakcję', formula: '(Crew Hours - Delivery Hours) × 60 / Trans' },
    { num: 44, name: 'Total crew working hours', unit: 'h', desc: 'Łączne godziny przepracowane crew (HOH & FOH, umowy zlecenia, godziny nocne, nadgodziny)', formula: 'Godziny HOH/FOH + UZ + Nocne + Nadliczbowe' },
    { num: 52, name: 'Total crew non working hours', unit: 'h', desc: 'Łączne godziny nieprzepracowane załogi (urlopy wypoczynkowe, okolicznościowe, L4 płatne przez pracodawcę)', formula: 'Urlop + L4 płatne + Nieobecności' },
    { num: 59, name: 'Overtime hours', unit: 'h', desc: 'Godziny nadliczbowe crew (ponad miesięczny wymiar czasu pracy)', formula: 'Godziny ponad etat' },
    { num: 61, name: 'Undertime hours', unit: 'h', desc: 'Niedogodziny (godziny niedopracowane względem umowy o pracę, za które pracodawca musi zapłacić)', formula: 'Etat - Godziny wypracowane' },
    { num: 63, name: 'Base wage', unit: 'PLN/h', desc: 'Średnia stawka crew na godzinę przepracowaną brutto z ZUS', formula: 'Wynagrodzenie podstawowe brutto / Godziny przepracowane' },
    { num: 66, name: 'Extra payment for lowest wages', unit: 'PLN', desc: 'Dopłata wyrównawcza do minimalnego wynagrodzenia gwarantowanego przez państwo w danym miesiącu', formula: 'Automatyczne podwyższenie do stawki minimalnej' }
  ];

  const filtered = metrics.filter(
    m =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.formula.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 p-6 bg-slate-50 dark:bg-zinc-950 overflow-y-auto font-sans text-xs">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Banner */}
        <div className="bg-[#007343] text-white p-4 rounded-lg shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-amber-300" />
            <div>
              <h2 className="text-base font-bold">ARKUSZ: Fields Description (Słownik Wskaźników COL Report i DOS+)</h2>
              <p className="text-emerald-200 text-xs">
                Oficjalne definicje, jednostki miary oraz formuły matematyczne controllingu Starbucks / AmRest
              </p>
            </div>
          </div>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-emerald-200" />
            <input
              type="text"
              placeholder="Szukaj wskaźnika lub formuły..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2 py-1 text-xs border border-emerald-400/40 rounded bg-emerald-950/50 text-white placeholder-emerald-200/60"
            />
          </div>
        </div>

        {/* Tabela Wskaźników */}
        <div className="border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-850/50 text-slate-600 dark:text-zinc-400 font-semibold text-[11px]">
                <th className="p-3 w-16 text-center">Nr</th>
                <th className="p-3 w-48">Nazwa Wskaźnika</th>
                <th className="p-3 w-20 text-center">Jednostka</th>
                <th className="p-3">Co oznacza? (Opis merytoryczny)</th>
                <th className="p-3 w-64 font-mono">Formuła obliczeniowa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filtered.map(m => (
                <tr key={m.num} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                  <td className="p-3 text-center font-mono text-slate-400">{m.num}</td>
                  <td className="p-3 font-bold text-slate-800 dark:text-zinc-200">{m.name}</td>
                  <td className="p-3 text-center font-mono text-slate-500 bg-slate-50/50 dark:bg-zinc-800/30 rounded">
                    {m.unit}
                  </td>
                  <td className="p-3 text-slate-600 dark:text-zinc-400">{m.desc}</td>
                  <td className="p-3 font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 text-[11px]">
                    {m.formula}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
