import React, { useState, useMemo } from 'react';
import {
  LaborLawViolation,
  LaborLawRuleType,
  ManagerEmployee
} from '../../../types';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Calendar,
  Sun,
  X,
  CheckCircle2,
  Filter,
  User,
  Info,
  ChevronRight
} from 'lucide-react';

interface LaborLawComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  violations: LaborLawViolation[];
  employees: ManagerEmployee[];
  monthName: string;
  year: number;
}

export const LaborLawComplianceModal: React.FC<LaborLawComplianceModalProps> = ({
  isOpen,
  onClose,
  violations,
  employees,
  monthName,
  year
}) => {
  const [selectedRule, setSelectedRule] = useState<string>('ALL');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ALL');

  // Filtrowane naruszenia
  const filteredViolations = useMemo(() => {
    return violations.filter(v => {
      const matchRule = selectedRule === 'ALL' || v.ruleType === selectedRule;
      const matchEmp = selectedEmployeeId === 'ALL' || String(v.employeeId) === selectedEmployeeId;
      return matchRule && matchEmp;
    });
  }, [violations, selectedRule, selectedEmployeeId]);

  // Statystyki wg reguł
  const ruleStats = useMemo(() => {
    return {
      daily_rest_11h: violations.filter(v => v.ruleType === 'daily_rest_11h').length,
      weekly_rest_35h: violations.filter(v => v.ruleType === 'weekly_rest_35h').length,
      max_daily_12h: violations.filter(v => v.ruleType === 'max_daily_12h').length,
      consecutive_sundays: violations.filter(v => v.ruleType === 'consecutive_sundays').length,
      sunday_shift_invalid: violations.filter(v => v.ruleType === 'sunday_shift_invalid').length
    };
  }, [violations]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E2E8E5] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* NAGŁÓWEK OKNA */}
        <div className="p-6 border-b border-[#E2E8E5] bg-[#F7F9F8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${
              violations.length === 0 ? 'bg-emerald-100 text-[#006241]' : 'bg-rose-100 text-rose-700'
            }`}>
              {violations.length === 0 ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-[#1E3932] flex items-center gap-2">
                Tarcza Kodeksu Pracy (KP)
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  violations.length === 0
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                  {violations.length === 0 ? '100% Zgodny' : `${violations.length} naruszeń`}
                </span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Weryfikacja 4 kluczowych norm prawnych grafiku • {monthName} {year}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PODSUMOWANIE 4 NORM PRACY (KAFELKI) */}
        <div className="p-6 border-b border-[#E2E8E5] bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Norma 1: 11h Odpoczynku */}
            <div
              onClick={() => setSelectedRule(selectedRule === 'daily_rest_11h' ? 'ALL' : 'daily_rest_11h')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                selectedRule === 'daily_rest_11h'
                  ? 'ring-2 ring-[#006241] border-[#006241]'
                  : 'hover:border-stone-400'
              } ${
                ruleStats.daily_rest_11h > 0
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                  : 'bg-[#F7F9F8] border-[#E2E8E5] text-stone-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  art. 132 § 1 KP
                </span>
                <Clock className={`w-4 h-4 ${ruleStats.daily_rest_11h > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
              </div>
              <div className="font-extrabold text-sm text-[#1E3932]">Min. 11h przerwy</div>
              <div className="text-[11px] text-stone-500 mt-0.5">między zmianami</div>
              <div className="mt-2 text-xs font-black">
                {ruleStats.daily_rest_11h === 0 ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Zgodne (0)
                  </span>
                ) : (
                  <span className="text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {ruleStats.daily_rest_11h} naruszeń
                  </span>
                )}
              </div>
            </div>

            {/* Norma 2: 35h Odpoczynku */}
            <div
              onClick={() => setSelectedRule(selectedRule === 'weekly_rest_35h' ? 'ALL' : 'weekly_rest_35h')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                selectedRule === 'weekly_rest_35h'
                  ? 'ring-2 ring-[#006241] border-[#006241]'
                  : 'hover:border-stone-400'
              } ${
                ruleStats.weekly_rest_35h > 0
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-[#F7F9F8] border-[#E2E8E5] text-stone-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  art. 133 § 1 KP
                </span>
                <Calendar className={`w-4 h-4 ${ruleStats.weekly_rest_35h > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
              </div>
              <div className="font-extrabold text-sm text-[#1E3932]">Min. 35h odpoczynku</div>
              <div className="text-[11px] text-stone-500 mt-0.5">nieprzerwanego w tyg.</div>
              <div className="mt-2 text-xs font-black">
                {ruleStats.weekly_rest_35h === 0 ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Zgodne (0)
                  </span>
                ) : (
                  <span className="text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {ruleStats.weekly_rest_35h} naruszeń
                  </span>
                )}
              </div>
            </div>

            {/* Norma 3: Max 12h Pracy */}
            <div
              onClick={() => setSelectedRule(selectedRule === 'max_daily_12h' ? 'ALL' : 'max_daily_12h')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                selectedRule === 'max_daily_12h'
                  ? 'ring-2 ring-[#006241] border-[#006241]'
                  : 'hover:border-stone-400'
              } ${
                ruleStats.max_daily_12h > 0
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                  : 'bg-[#F7F9F8] border-[#E2E8E5] text-stone-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  art. 135 KP
                </span>
                <Clock className={`w-4 h-4 ${ruleStats.max_daily_12h > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
              </div>
              <div className="font-extrabold text-sm text-[#1E3932]">Max. 12h w dobie</div>
              <div className="text-[11px] text-stone-500 mt-0.5">maksymalna zmiana</div>
              <div className="mt-2 text-xs font-black">
                {ruleStats.max_daily_12h === 0 ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Zgodne (0)
                  </span>
                ) : (
                  <span className="text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {ruleStats.max_daily_12h} naruszeń
                  </span>
                )}
              </div>
            </div>

            {/* Norma 4: Niedziele Pracujące */}
            <div
              onClick={() => setSelectedRule(selectedRule === 'consecutive_sundays' ? 'ALL' : 'consecutive_sundays')}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                selectedRule === 'consecutive_sundays'
                  ? 'ring-2 ring-[#006241] border-[#006241]'
                  : 'hover:border-stone-400'
              } ${
                ruleStats.consecutive_sundays > 0
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                  : 'bg-[#F7F9F8] border-[#E2E8E5] text-stone-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  art. 151^10 KP
                </span>
                <Sun className={`w-4 h-4 ${ruleStats.consecutive_sundays > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
              </div>
              <div className="font-extrabold text-sm text-[#1E3932]">Max. 3 niedziele</div>
              <div className="text-[11px] text-stone-500 mt-0.5">pod rząd w pracy</div>
              <div className="mt-2 text-xs font-black">
                {ruleStats.consecutive_sundays === 0 ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Zgodne (0)
                  </span>
                ) : (
                  <span className="text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> {ruleStats.consecutive_sundays} naruszeń
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FILTRY */}
        <div className="px-6 py-3 bg-[#F7F9F8] border-b border-[#E2E8E5] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-stone-600 font-semibold">
            <Filter className="w-4 h-4 text-[#006241]" />
            <span>Filtruj:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Wybór reguły */}
            <select
              value={selectedRule}
              onChange={e => setSelectedRule(e.target.value)}
              className="bg-white border border-[#E2E8E5] rounded-xl px-3 py-1.5 font-medium text-stone-700 focus:outline-hidden focus:border-[#006241]"
            >
              <option value="ALL">Wszystkie reguły ({violations.length})</option>
              <option value="daily_rest_11h">Min. 11h przerwy ({ruleStats.daily_rest_11h})</option>
              <option value="weekly_rest_35h">Min. 35h odpoczynku ({ruleStats.weekly_rest_35h})</option>
              <option value="max_daily_12h">Max. 12h w dobie ({ruleStats.max_daily_12h})</option>
              <option value="consecutive_sundays">Max. 3 niedziele ({ruleStats.consecutive_sundays})</option>
              {ruleStats.sunday_shift_invalid > 0 && (
                <option value="sunday_shift_invalid">Zmiana niedzielna poza Nd ({ruleStats.sunday_shift_invalid})</option>
              )}
            </select>

            {/* Wybór menedżera */}
            <select
              value={selectedEmployeeId}
              onChange={e => setSelectedEmployeeId(e.target.value)}
              className="bg-white border border-[#E2E8E5] rounded-xl px-3 py-1.5 font-medium text-stone-700 focus:outline-hidden focus:border-[#006241]"
            >
              <option value="ALL">Wszyscy menedżerowie</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>

            {(selectedRule !== 'ALL' || selectedEmployeeId !== 'ALL') && (
              <button
                onClick={() => {
                  setSelectedRule('ALL');
                  setSelectedEmployeeId('ALL');
                }}
                className="text-stone-500 hover:text-stone-900 underline ml-1"
              >
                Wyczyść filtry
              </button>
            )}
          </div>
        </div>

        {/* LISTA NARUSZEŃ LUB KOMUNIKAT O BRAKU */}
        <div className="p-6 overflow-y-auto max-h-[450px] space-y-3 scrollbar-thin">
          {filteredViolations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-stone-900">
                Brak wykrytych naruszeń
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                {violations.length === 0
                  ? 'Układ grafiku jest w pełni zgodny ze wszystkimi 4 analizowanymi normami polskiego Kodeksu Pracy.'
                  : 'Dla wybranych kryteriów filtrowania nie znaleziono żadnych naruszeń.'}
              </p>
            </div>
          ) : (
            filteredViolations.map(violation => {
              const isError = violation.severity === 'error';

              return (
                <div
                  key={violation.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isError
                      ? 'bg-rose-50/50 border-rose-200 hover:border-rose-300'
                      : 'bg-amber-50/50 border-amber-200 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                        isError ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-[#1E3932]">
                            {violation.employeeName}
                          </span>
                          <span className="text-stone-400">•</span>
                          <span className="text-xs font-bold text-stone-700 bg-white px-2 py-0.5 rounded-md border border-[#E2E8E5]">
                            Dzień {violation.day} {monthName}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isError ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {violation.ruleType === 'daily_rest_11h' ? 'Odpoczynek Dobowy' :
                             violation.ruleType === 'weekly_rest_35h' ? 'Odpoczynek Tygodniowy' :
                             violation.ruleType === 'max_daily_12h' ? 'Wymiar Dobowy' :
                             violation.ruleType === 'consecutive_sundays' ? 'Niedziele' : 'Zmiana Niedzielna'}
                          </span>
                        </div>

                        <div className="font-bold text-stone-900 text-xs mt-1">
                          {violation.title}
                        </div>

                        <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                          {violation.message}
                        </p>

                        {violation.details && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-white/80 border border-stone-200/80 text-[11px] text-stone-500 flex items-start gap-2">
                            <Info className="w-3.5 h-3.5 text-[#006241] shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold text-stone-700">Podstawa prawna: </span>
                              {violation.details}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* STOPKA */}
        <div className="p-4 border-t border-[#E2E8E5] bg-[#F7F9F8] flex items-center justify-between text-xs">
          <div className="text-stone-500">
            Kawiarnia <strong className="text-stone-700">108120 SBX Warszawa Janki</strong> • Kod 18120
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#006241] hover:bg-[#00754A] text-white rounded-xl font-bold shadow-xs transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
