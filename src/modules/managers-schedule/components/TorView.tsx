import React, { useState, useEffect, useCallback } from 'react';
import { TorQuarterData } from '../../../types';
import { TorEngine } from '../services/torEngine';
import { ManagerExcelExport } from '../services/managerExcelExport';
import { formatManagerRole } from '../services/managerScheduleEngine';
import {
  Calendar,
  Clock,
  FileSpreadsheet,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Scale
} from 'lucide-react';

interface TorViewProps {
  currentYear?: number;
  currentMonth?: number;
}

export const TorView: React.FC<TorViewProps> = ({
  currentYear = 2026,
  currentMonth = 9
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(
    TorEngine.getQuarterFromMonth(currentMonth)
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [torData, setTorData] = useState<TorQuarterData | null>(null);

  const loadTorData = useCallback(async () => {
    try {
      setIsLoading(true);
      if ((window as any).api?.getTorQuarterData) {
        const res = await (window as any).api.getTorQuarterData(selectedYear, selectedQuarter);
        const calculated = TorEngine.calculateQuarterData(
          selectedYear,
          selectedQuarter,
          res.employees || [],
          res.shifts || [],
          res.monthlyNorms || {},
          res.actualRcpByMonth,
          res.hasActualRcpByMonth
        );
        setTorData(calculated);
      }
    } catch (err) {
      console.error('Błąd ładowania danych TOR:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedQuarter]);

  useEffect(() => {
    loadTorData();
  }, [loadTorData]);

  const handleExportExcel = () => {
    if (!torData) return;
    ManagerExcelExport.exportTorToExcel(torData);
  };

  // Statystyki kwartalne
  const overtimeCount = torData ? torData.rows.filter(r => r.quarterStatus === 'nadgodziny').length : 0;
  const undertimeCount = torData ? torData.rows.filter(r => r.quarterStatus === 'niedogodziny').length : 0;
  const okCount = torData ? torData.rows.filter(r => r.quarterStatus === 'OK').length : 0;

  return (
    <div className="space-y-6">
      {/* PASEK NAWIGACJI I KONTROLI TOR */}
      <div className="bg-white rounded-2xl p-5 border border-[#E2E8E5] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#006241]">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-stone-900 tracking-tight">
                  Trzymiesięczny Okres Rozliczeniowy (TOR)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#006241] text-white">
                  {torData?.quarterName || `Q${selectedQuarter}`}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Art. 129 § 1 Kodeksu Pracy — Rozliczenie salda godzin, urlopów (H) i chorobowego (L4) w kwartale
              </p>
            </div>
          </div>
        </div>

        {/* PRZEŁĄCZNIK KWARTAŁÓW I ROKU */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selektor Roku */}
          <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200">
            <button
              onClick={() => setSelectedYear(prev => prev - 1)}
              className="p-1.5 hover:bg-white rounded-lg text-stone-600 transition-colors cursor-pointer"
              title="Poprzedni rok"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-black text-stone-800 tracking-wide">
              {selectedYear}
            </span>
            <button
              onClick={() => setSelectedYear(prev => prev + 1)}
              className="p-1.5 hover:bg-white rounded-lg text-stone-600 transition-colors cursor-pointer"
              title="Następny rok"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Przyciski Kwartałów Q1 - Q4 */}
          <div className="flex items-center bg-stone-100 rounded-xl p-1 border border-stone-200">
            {([1, 2, 3, 4] as const).map(q => {
              const isActive = selectedQuarter === q;
              const labels = ['Q1 (I–III)', 'Q2 (IV–VI)', 'Q3 (VII–IX)', 'Q4 (X–XII)'];
              return (
                <button
                  key={q}
                  onClick={() => setSelectedQuarter(q)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#006241] text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                  }`}
                >
                  {labels[q - 1]}
                </button>
              );
            })}
          </div>

          {/* Odśwież */}
          <button
            onClick={loadTorData}
            disabled={isLoading}
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl border border-stone-200 transition-colors cursor-pointer disabled:opacity-50"
            title="Odśwież dane TOR"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {/* Eksport Excel */}
          <button
            onClick={handleExportExcel}
            disabled={!torData || isLoading}
            className="px-3.5 py-2 bg-[#006241] hover:bg-[#1E3932] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Pobierz arkusz kalkulacyjny Excel dla tego kwartału"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#CBA258]" />
            <span>Eksportuj TOR (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* KAFELKI PODSUMOWANIA KWARTAŁU */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Kafelek 1: Łączny Bilans Kwartału */}
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8E5] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">Saldo Kwartału (Zespół)</span>
            <div className={`p-1.5 rounded-lg ${
              (torData?.totalTeamBalance || 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${
              (torData?.totalTeamBalance || 0) >= 0 ? 'text-[#006241]' : 'text-rose-600'
            }`}>
              {(torData?.totalTeamBalance || 0) >= 0 ? `+${torData?.totalTeamBalance || 0}` : `${torData?.totalTeamBalance || 0}`} h
            </span>
            <span className="text-[11px] font-semibold text-stone-500">
              {(torData?.totalTeamBalance || 0) >= 0 ? 'Bilans zrównoważony' : 'Niedogodziny zespołu'}
            </span>
          </div>
        </div>

        {/* Kafelek 2: Wypracowane godziny RCP */}
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8E5] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">Godziny na sali (RCP)</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">
              {torData?.totalTeamRcp || 0} h
            </span>
            <span className="text-[11px] font-semibold text-stone-500">
              dyżury menedżerskie
            </span>
          </div>
        </div>

        {/* Kafelek 3: Urlopy i L4 (wliczone do etatu) */}
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8E5] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">Absencje w etacie (H + L4)</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">
              {((torData?.totalTeamH || 0) + (torData?.totalTeamL4 || 0)).toFixed(1)} h
            </span>
            <span className="text-[11px] font-medium text-stone-500">
              H: {torData?.totalTeamH || 0}h • L4: {torData?.totalTeamL4 || 0}h
            </span>
          </div>
        </div>

        {/* Kafelek 4: Statusy Menedżerów */}
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8E5] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500">Statusy Zespołu ({torData?.rows.length || 0} osób)</span>
            <div className="p-1.5 rounded-lg bg-stone-100 text-stone-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold" title="Bilans zgodny lub lekka nadwyżka">
              {okCount} OK
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-bold" title="Nadgodziny kwartalne">
              {overtimeCount} Nadgodziny
            </span>
            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-xs font-bold" title="Niedogodziny kwartalne">
              {undertimeCount} Niedogodziny
            </span>
          </div>
        </div>
      </div>

      {/* GŁÓWNA TABELA TOR */}
      <div className="bg-white rounded-2xl border border-[#E2E8E5] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              {/* Wiersz 1: Główne bloki (Miesiąc 1, Miesiąc 2, Miesiąc 3, Podsumowanie) */}
              <tr className="bg-[#1E3932] text-white font-bold border-b border-emerald-800">
                <th className="sticky left-0 z-30 bg-[#1E3932] px-3.5 py-3 w-[180px] min-w-[180px] border-r border-emerald-800">
                  <span className="text-emerald-300 font-bold uppercase tracking-wider text-[11px]">
                    MANAGER
                  </span>
                </th>
                <th className="bg-[#1E3932] px-2.5 py-3 w-[60px] min-w-[60px] text-center border-r border-emerald-800">
                  <span className="text-emerald-300 font-bold uppercase tracking-wider text-[10px]">
                    ETAT
                  </span>
                </th>

                {torData?.monthNames.map((mName, idx) => (
                  <th
                    key={`m-header-${idx}`}
                    colSpan={4}
                    className="px-3 py-2 text-center border-r border-emerald-800 bg-[#1E3932]"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-black text-white text-xs uppercase tracking-wider">
                        {mName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-800/80 text-emerald-200 text-[10px] font-semibold border border-emerald-700">
                        Norma: {torData.monthNorms[idx]}h
                      </span>
                    </div>
                  </th>
                ))}

                {/* Kolumny podsumowania kwartału */}
                <th
                  colSpan={5}
                  className="px-3 py-2 text-center bg-[#006241] text-white border-l border-emerald-700 font-black tracking-wider uppercase text-[11px]"
                >
                  PODSUMOWANIE KWARTAŁU
                </th>
              </tr>

              {/* Wiersz 2: Kolumny szczegółowe */}
              <tr className="bg-stone-50 text-stone-600 font-bold border-b border-[#E2E8E5] text-[10px] uppercase">
                <th className="sticky left-0 z-20 bg-stone-50 px-3.5 py-2.5 border-r border-[#E2E8E5] text-stone-700">
                  Imię i Nazwisko
                </th>
                <th className="px-2 py-2 text-center border-r border-stone-200 text-stone-500">
                  Wymiar
                </th>

                {/* 3 Bloki Miesięcy: DOKŁADNIE 3 KOLUMNY RCP, H, L4 ORAZ BILANS */}
                {[0, 1, 2].map(mIdx => (
                  <React.Fragment key={`sub-m-${mIdx}`}>
                    <th className="px-2.5 py-2 text-center border-r border-stone-200 w-16 text-stone-800 font-black" title="Godziny wypracowane na sali / dyżury (RCP)">
                      RCP (h)
                    </th>
                    <th className="px-2.5 py-2 text-center border-r border-stone-200 w-14 text-sky-800 font-black" title="Godziny urlopu wypoczynkowego (H) — w dni robocze wg etatu">
                      H (h)
                    </th>
                    <th className="px-2.5 py-2 text-center border-r border-stone-200 w-14 text-rose-800 font-black" title="Godziny zwolnienia lekarskiego (L4) — w dni robocze wg etatu. Choroba w trakcie urlopu liczy się do L4!">
                      L4 (h)
                    </th>
                    <th className="px-2.5 py-2 text-center border-r border-stone-300 w-16 bg-emerald-50/40 text-[#006241] font-black" title="Suma wypracowana względem normy miesiąca">
                      Bilans
                    </th>
                  </React.Fragment>
                ))}

                {/* Podsumowanie kwartału */}
                {torData?.monthNames.map((mName, idx) => (
                  <th key={`bal-col-${idx}`} className="px-2.5 py-2 text-center border-r border-stone-200 w-16 bg-stone-100 text-stone-700">
                    {mName.substring(0, 3)}
                  </th>
                ))}
                <th className="px-3 py-2 text-center border-r border-stone-200 w-24 bg-emerald-100/60 text-[#006241] font-black">
                  TOTAL (+/-)
                </th>
                <th className="px-3 py-2 text-center w-28 bg-emerald-100/60 text-stone-800 font-black">
                  STATUS
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#E2E8E5]">
              {torData?.rows.map((row, rIdx) => {
                const isOver = row.quarterStatus === 'nadgodziny';
                const isUnder = row.quarterStatus === 'niedogodziny';
                const rowBg = rIdx % 2 === 0 ? 'bg-white' : 'bg-stone-50/40';

                return (
                  <tr key={row.employee.id} className={`${rowBg} hover:bg-emerald-50/30 transition-colors`}>
                    {/* Sticky Manager Info */}
                    <td className={`sticky left-0 z-10 px-3.5 py-2.5 border-r border-[#E2E8E5] font-bold text-stone-900 ${rowBg}`}>
                      <div className="flex flex-col">
                        <span className="truncate">{row.employee.name}</span>
                        <span className="text-[10px] font-bold text-stone-500 truncate">{formatManagerRole(row.employee.role)}</span>
                      </div>
                    </td>

                    {/* Kolumna ETAT */}
                    <td className={`px-2.5 py-2 text-center border-r border-stone-200 text-xs font-semibold text-stone-600 ${rowBg}`}>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                        row.employee.contract_type === 'FULL' ? 'bg-stone-100 text-stone-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {row.employee.contract_type}
                      </span>
                    </td>

                    {/* 3 Bloki Miesięcy: DOKŁADNIE 3 KOLUMNY RCP, H, L4 ORAZ BILANS */}
                    {row.months.map((m, mIdx) => (
                      <React.Fragment key={`m-data-${row.employee.id}-${mIdx}`}>
                        <td
                          className="px-2.5 py-2 text-center border-r border-stone-200 font-bold text-stone-800 text-[11px] select-none"
                          title={!m.isActiveInMonth ? "Pracownik nie był w składzie w tym miesiącu" : m.isRcpFromActuals ? "Godziny RCP zarejestrowane w systemie MAPAL (nieedytowalne)" : "Planowane godziny dyżurów z grafiku"}
                        >
                          {!m.isActiveInMonth ? (
                            <span className="text-stone-300 font-normal">-</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <span>{m.rcpHours > 0 ? `${m.rcpHours}h` : '-'}</span>
                              {m.isRcpFromActuals && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Zarejestrowane logowania w systemie MAPAL" />
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2.5 py-2 text-center border-r border-stone-200 text-sky-800 font-bold text-[11px]">
                          {!m.isActiveInMonth ? <span className="text-stone-300 font-normal">-</span> : (m.hHours > 0 ? `${m.hHours}h` : '-')}
                        </td>
                        <td className="px-2.5 py-2 text-center border-r border-stone-200 text-rose-800 font-bold text-[11px]">
                          {!m.isActiveInMonth ? <span className="text-stone-300 font-normal">-</span> : (m.l4Hours > 0 ? `${m.l4Hours}h` : '-')}
                        </td>
                        <td className="px-2.5 py-2 text-center border-r border-stone-300 bg-emerald-50/20 text-[11px]">
                          {!m.isActiveInMonth ? (
                            <span className="px-1.5 py-0.5 rounded-md font-medium text-[10px] bg-stone-100 text-stone-400" title="Poza składem w tym miesiącu">
                              -
                            </span>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] ${
                              m.balanceHours > 0
                                ? 'bg-blue-50 text-blue-700'
                                : m.balanceHours < 0
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-stone-100 text-stone-600'
                            }`}>
                              {m.balanceHours >= 0 ? `+${m.balanceHours}` : `${m.balanceHours}`}
                            </span>
                          )}
                        </td>
                      </React.Fragment>
                    ))}

                    {/* Podsumowanie Kwartału */}
                    {row.months.map((m, mIdx) => (
                      <td key={`sub-bal-${mIdx}`} className="px-2.5 py-2 text-center border-r border-stone-200 text-[11px] font-bold bg-stone-50/60 text-stone-700">
                        {!m.isActiveInMonth ? <span className="text-stone-400 font-normal">-</span> : (m.balanceHours >= 0 ? `+${m.balanceHours}` : `${m.balanceHours}`)}
                      </td>
                    ))}

                    {/* Total Saldo */}
                    <td className="px-3 py-2 text-center border-r border-stone-200 font-black text-xs bg-emerald-50/40">
                      <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${
                        isOver
                          ? 'bg-blue-100 text-blue-800'
                          : isUnder
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-[#006241]'
                      }`}>
                        {row.quarterTotalBalance >= 0 ? `+${row.quarterTotalBalance} h` : `${row.quarterTotalBalance} h`}
                      </span>
                    </td>

                    {/* Status Kwartału */}
                    <td className="px-3 py-2 text-center text-xs">
                      {row.quarterStatus === 'OK' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#006241] border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          OK
                        </span>
                      )}
                      {row.quarterStatus === 'nadgodziny' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                          <TrendingUp className="w-3 h-3 text-blue-600" />
                          Nadgodziny
                        </span>
                      )}
                      {row.quarterStatus === 'niedogodziny' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Niedogodziny
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* WIERSZ PODSUMOWANIA ZESPOŁU */}
              <tr className="bg-[#1E3932] text-white font-bold border-t-2 border-emerald-700">
                <td className="sticky left-0 z-20 px-3.5 py-3 bg-[#1E3932] border-r border-emerald-800 text-emerald-300 font-black">
                  PODSUMOWANIE ZESPOŁU
                </td>
                <td className="px-2.5 py-3 text-center border-r border-emerald-800 text-emerald-200 text-xs font-semibold">
                  7 os.
                </td>

                {/* Sumy per miesiąc: RCP, H, L4, Bilans */}
                {[0, 1, 2].map(mIdx => {
                  let mRcp = 0;
                  let mH_h = 0;
                  let mL4_h = 0;
                  let mBal = 0;
                  if (torData) {
                    for (const r of torData.rows) {
                      mRcp += r.months[mIdx].rcpHours;
                      mH_h += r.months[mIdx].hHours;
                      mL4_h += r.months[mIdx].l4Hours;
                      mBal += r.months[mIdx].balanceHours;
                    }
                  }
                  return (
                    <React.Fragment key={`tot-m-${mIdx}`}>
                      <td className="px-2.5 py-3 text-center border-r border-emerald-800 text-white font-bold">
                        {mRcp.toFixed(1)}h
                      </td>
                      <td className="px-2 py-3 text-center border-r border-emerald-800 text-sky-300 font-bold">
                        {mH_h.toFixed(1)}h
                      </td>
                      <td className="px-2 py-3 text-center border-r border-emerald-800 text-rose-300 font-bold">
                        {mL4_h.toFixed(1)}h
                      </td>
                      <td className="px-2.5 py-3 text-center border-r border-emerald-800 text-emerald-200 font-black">
                        {mBal >= 0 ? `+${mBal.toFixed(1)}` : mBal.toFixed(1)}h
                      </td>
                    </React.Fragment>
                  );
                })}

                {/* Sumy kwartalne per miesiąc */}
                {[0, 1, 2].map(mIdx => {
                  let mBal = 0;
                  if (torData) {
                    for (const r of torData.rows) {
                      mBal += r.months[mIdx].balanceHours;
                    }
                  }
                  return (
                    <td key={`tot-sub-bal-${mIdx}`} className="px-2.5 py-2 text-center border-r border-emerald-900 font-black text-white text-[11px]">
                      {mBal >= 0 ? `+${mBal.toFixed(1)}` : mBal.toFixed(1)}
                    </td>
                  );
                })}

                {/* Łączne saldo kwartału zespołu */}
                <td className="px-3 py-2 text-center border-r border-emerald-800 font-black text-xs text-[#CBA258]">
                  {torData ? (torData.totalTeamBalance >= 0 ? `+${torData.totalTeamBalance}` : `${torData.totalTeamBalance}`) : '0.0'} h
                </td>

                <td className="px-3 py-2 text-center text-xs font-black text-emerald-200">
                  {torData && torData.totalTeamBalance >= 0 ? 'STATUS OK' : 'DEFICYT'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
