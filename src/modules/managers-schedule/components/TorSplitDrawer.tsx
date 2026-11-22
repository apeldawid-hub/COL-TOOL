import React, { useState, useEffect, useCallback } from 'react';
import { TorQuarterData } from '../../../types';
import { TorEngine } from '../services/torEngine';
import { formatManagerRole } from '../services/managerScheduleEngine';
import {
  X,
  Scale,
  RefreshCw,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface TorSplitDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  onOpenFullTor: () => void;
}

export const TorSplitDrawer: React.FC<TorSplitDrawerProps> = ({
  isOpen,
  onClose,
  year,
  month,
  onOpenFullTor
}) => {
  const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(
    TorEngine.getQuarterFromMonth(month)
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [torData, setTorData] = useState<TorQuarterData | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      if ((window as any).api?.getTorQuarterData) {
        const res = await (window as any).api.getTorQuarterData(year, selectedQuarter);
        const calculated = TorEngine.calculateQuarterData(
          year,
          selectedQuarter,
          res.employees || [],
          res.shifts || [],
          res.monthlyNorms || {},
          res.actualRcpByMonth,
          res.hasActualRcpByMonth,
          res.maxRcpDayByMonth
        );
        setTorData(calculated);
      }
    } catch (err) {
      console.error('Błąd ładowania danych w drawerze TOR:', err);
    } finally {
      setIsLoading(false);
    }
  }, [year, selectedQuarter]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none animate-fade-in">
      {/* Tło półprzezroczyste */}
      <div
        className="absolute inset-0 bg-stone-900/20 backdrop-blur-2xs pointer-events-auto"
        onClick={onClose}
      />

      {/* Panel boczny */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10 pointer-events-auto">
        <div className="w-screen max-w-md xl:max-w-lg bg-white shadow-2xl border-l border-[#E2E8E5] flex flex-col animate-slide-in-right">
          
          {/* Nagłówek */}
          <div className="bg-[#1E3932] text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-700/50 rounded-xl border border-emerald-500/30">
                <Scale className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <span>Inspektor TOR (Split-Screen)</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 text-[10px] font-black border border-emerald-400/30">
                    Q{selectedQuarter} {year}
                  </span>
                </h3>
                <p className="text-[11px] text-emerald-200/80 mt-0.5">
                  Trzymiesięczny Okres Rozliczeniowy • Live Bilans
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={isLoading}
                className="p-1.5 text-stone-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Odśwież dane TOR"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-stone-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Przełącznik Kwartałów Q1-Q4 */}
          <div className="flex items-center justify-between px-5 py-2.5 bg-stone-50 border-b border-stone-200 text-xs">
            <span className="font-bold text-stone-600 uppercase tracking-wider text-[10px]">Wybierz kwartał:</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-stone-200 shadow-2xs">
              {([1, 2, 3, 4] as const).map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setSelectedQuarter(q)}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                    selectedQuarter === q
                      ? 'bg-[#006241] text-white shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  Q{q}
                </button>
              ))}
            </div>
          </div>

          {/* Zawartość scrollowalna */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {isLoading ? (
              <div className="py-20 text-center text-stone-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#006241]" />
                <p className="text-xs font-semibold">Kalkulacja bilansu kwartalnego TOR...</p>
              </div>
            ) : torData ? (
              <>
                {/* Karty podsumowania kwartału */}
                {(() => {
                  const teamNominal = torData.rows.reduce((sum, r) => sum + r.months.reduce((s, m) => s + m.normHours, 0), 0);
                  const teamWorked = torData.totalTeamHours;

                  return (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                        <div className="text-[10px] font-bold text-stone-500 uppercase">Norma Kwartału</div>
                        <div className="text-base font-black text-stone-900 mt-0.5">
                          {teamNominal.toFixed(1)}h
                        </div>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                        <div className="text-[10px] font-bold text-emerald-800 uppercase">Wykonanie / Plan</div>
                        <div className="text-base font-black text-emerald-950 mt-0.5">
                          {teamWorked.toFixed(1)}h
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Tabela menedżerów */}
                <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="bg-stone-100 px-3 py-2 border-b border-stone-200 flex items-center justify-between text-[11px] font-bold text-stone-700">
                    <span>Menedżer</span>
                    <span>Bilans Q{selectedQuarter}</span>
                  </div>

                  <div className="divide-y divide-stone-100">
                    {torData.rows.map(r => {
                      const delta = r.quarterTotalBalance;
                      const quarterWorked = r.months.reduce((sum, m) => sum + m.totalHours, 0);
                      const quarterNominal = r.months.reduce((sum, m) => sum + m.normHours, 0);
                      const isOk = Math.abs(delta) <= 4.0;
                      const isOver = delta > 4.0;

                      return (
                        <div
                          key={r.employee.id}
                          className="px-3 py-2.5 flex items-center justify-between hover:bg-stone-50/80 transition-colors"
                        >
                          <div>
                            <div className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                              <span>{r.employee.name}</span>
                              <span className="text-[10px] font-medium text-stone-500">
                                ({formatManagerRole(r.employee.role)})
                              </span>
                            </div>
                            <div className="text-[10px] text-stone-500 mt-0.5">
                              Plan: <strong>{quarterWorked.toFixed(1)}h</strong> / {quarterNominal}h
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-black inline-flex items-center gap-1 ${
                                isOk
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : isOver
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-rose-100 text-rose-900 border border-rose-300'
                              }`}
                            >
                              {delta > 0 ? `+${delta.toFixed(1)}h` : `${delta.toFixed(1)}h`}
                            </span>
                            <div className="text-[9px] text-stone-500 mt-0.5 font-medium">
                              {isOk ? 'Idealny bilans' : isOver ? 'Nadgodziny' : 'Niedogodziny'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Wskazówka operacyjna */}
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-600 space-y-1">
                  <div className="font-bold text-stone-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#006241]" />
                    <span>Zasada Równoważenia Kwartału (art. 129 KP)</span>
                  </div>
                  <p className="text-[10px] leading-relaxed">
                    Nadgodziny lub niedogodziny z pierwszych miesięcy kwartału powinny zostać wyrównane do 0.0h w ostatnim miesiącu okresu.
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {/* Stopka z przejściem do pełnego widoku */}
          <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3">
            <span className="text-[11px] text-stone-500">
              Chcesz rozliczyć raport RCP lub wyeksportować Excel?
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFullTor();
              }}
              className="px-3.5 py-2 bg-[#006241] text-white hover:bg-[#1E3932] rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <span>Pełny moduł TOR</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
