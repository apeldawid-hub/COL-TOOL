import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  ShieldAlert,
  Target,
  Clock,
  Save,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Sparkles,
  Briefcase,
  Plus,
  Trash2,
} from 'lucide-react';
import { AopPlanRecord, NcRuleRecord } from '../../../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'aop' | 'nc';
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
  onSaveSuccess: () => void;
}

const DEFAULT_NC_RULES: NcRuleRecord[] = [
  { id: 'sm_admin', name: 'Administracja Store Managera (SM)', category: 'Zarządzanie', monthly_hours: 20.0, is_mandatory: true },
  { id: 'barista_training', name: 'Szkolenia Baristyczne & Onboarding', category: 'Rozwój', monthly_hours: 12.0, is_mandatory: true },
  { id: 'inventory', name: 'Inwentaryzacja Miesięczna & Audyt', category: 'Operacje', monthly_hours: 6.0, is_mandatory: true },
  { id: 'team_meeting', name: 'Zebranie Załogi Kawiarni', category: 'Zespół', monthly_hours: 4.0, is_mandatory: true },
  { id: 'deep_clean', name: 'Głębokie Czyszczenie Sprzętu (Deep Clean)', category: 'Czystość', monthly_hours: 8.0, is_mandatory: true },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'aop',
  selectedYear,
  availableYears,
  onYearChange,
  onSaveSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'aop' | 'nc'>(initialTab);
  // Tryb wpisywania godzin NC: miesięcznie lub tygodniowo
  const [ncInputMode, setNcInputMode] = useState<'monthly' | 'weekly'>('monthly');

  // Stan AOP
  const [aopPlans, setAopPlans] = useState<AopPlanRecord[]>([]);
  const [isAopLoading, setIsAopLoading] = useState(false);
  const [isAopSaving, setIsAopSaving] = useState(false);
  const [aopSuccess, setAopSuccess] = useState(false);
  const [bulkTplh, setBulkTplh] = useState<string>('6.70');

  // Stan Godzin NC (Non-Coverage)
  const [ncRules, setNcRules] = useState<NcRuleRecord[]>(DEFAULT_NC_RULES);
  const [isNcLoading, setIsNcLoading] = useState(false);
  const [isNcSaving, setIsNcSaving] = useState(false);
  const [ncSuccess, setNcSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadAopPlans(selectedYear);
      loadNcRules();
    }
  }, [isOpen, initialTab, selectedYear]);

  // Ładowanie Godzin NC
  const loadNcRules = async () => {
    setIsNcLoading(true);
    setNcSuccess(false);
    try {
      if ((window as any).api?.getNcRules) {
        const data = await (window as any).api.getNcRules();
        if (data && data.length > 0) {
          setNcRules(data);
          return;
        }
      }
      setNcRules(DEFAULT_NC_RULES);
    } catch (err) {
      console.error('Błąd pobierania reguł NC:', err);
    } finally {
      setIsNcLoading(false);
    }
  };

  // Zapis reguł NC
  const handleSaveNcRules = async () => {
    setIsNcSaving(true);
    try {
      if ((window as any).api?.saveNcRules) {
        await (window as any).api.saveNcRules(ncRules);
        setNcSuccess(true);
        onSaveSuccess();
        setTimeout(() => setNcSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Błąd zapisu reguł NC:', err);
    } finally {
      setIsNcSaving(false);
    }
  };

  const handleNcHoursChange = (id: string, val: string) => {
    const num = Number(val);
    setNcRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, monthly_hours: isNaN(num) ? 0 : num } : r))
    );
  };

  const handleAddNcRule = () => {
    const newId = `custom_${Date.now()}`;
    setNcRules((prev) => [
      ...prev,
      {
        id: newId,
        name: 'Nowa pozycja NC',
        category: 'Operacje',
        monthly_hours: 4.0,
        is_mandatory: true,
      },
    ]);
  };

  const handleDeleteNcRule = (id: string) => {
    setNcRules((prev) => prev.filter((r) => r.id !== id));
  };

  // Ładowanie AOP
  const loadAopPlans = async (yr: number) => {
    setIsAopLoading(true);
    setAopSuccess(false);
    try {
      if ((window as any).api?.getAopPlansForYear) {
        const data = await (window as any).api.getAopPlansForYear(yr);
        if (data && data.length > 0) {
          setAopPlans(data);
          return;
        }
      }
    } catch (err) {
      console.error('Błąd pobierania planu AOP:', err);
    } finally {
      setIsAopLoading(false);
    }
  };

  // Obsługa zmian w AOP
  const handleAopChange = (idx: number, field: 'plan_trx' | 'target_tplh', value: number) => {
    setAopPlans((prev) => {
      const updated = [...prev];
      const curr = { ...updated[idx] };
      if (field === 'plan_trx') curr.plan_trx = value;
      else if (field === 'target_tplh') curr.target_tplh = value;

      const tplh = curr.target_tplh > 0 ? curr.target_tplh : 6.7;
      curr.labor_budget = Number((curr.plan_trx / tplh).toFixed(1));
      curr.avg_weekly_hours = Number((curr.labor_budget / (curr.weeks_count || 5)).toFixed(1));
      updated[idx] = curr;
      return updated;
    });
  };

  const handleApplyBulkTplh = () => {
    const val = parseFloat(bulkTplh.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;
    setAopPlans((prev) =>
      prev.map((p) => {
        const laborBudget = Number((p.plan_trx / val).toFixed(1));
        const avgWeekly = Number((laborBudget / (p.weeks_count || 5)).toFixed(1));
        return {
          ...p,
          target_tplh: val,
          labor_budget: laborBudget,
          avg_weekly_hours: avgWeekly,
        };
      })
    );
  };

  const handleSaveAop = async () => {
    setIsAopSaving(true);
    setAopSuccess(false);
    try {
      if ((window as any).api?.saveYearlyAop) {
        await (window as any).api.saveYearlyAop(aopPlans);
        setAopSuccess(true);
        onSaveSuccess();
        setTimeout(() => setAopSuccess(false), 3500);
      }
    } catch (err) {
      console.error('Błąd zapisu planu AOP:', err);
    } finally {
      setIsAopSaving(false);
    }
  };

  if (!isOpen) return null;

  const totalTrxYear = aopPlans.reduce((acc, p) => acc + (p.plan_trx || 0), 0);
  const totalHoursYear = aopPlans.reduce((acc, p) => acc + (p.labor_budget || 0), 0);
  const avgTplhYear = totalHoursYear > 0 ? (totalTrxYear / totalHoursYear).toFixed(2) : '6.70';
  const totalNcHoursMonth = ncRules.reduce((acc, r) => acc + (r.monthly_hours || 0), 0);
  const avgWeeklyNcHours = Number((totalNcHoursMonth / 4.33).toFixed(1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-[#D0DCD6] rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
        {/* Nagłówek Okna */}
        <div className="p-6 border-b border-[#E2E8E5] flex items-center justify-between shrink-0 bg-[#F4F7F5]">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
              <Settings className="w-6 h-6 text-[#006241]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#1E3932] flex items-center gap-2">
                Konfiguracja Parametrów Kawiarni
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
                  108120 Janki (384)
                </span>
              </h3>
              <p className="text-xs text-[#5C6F68]">
                Zarządzaj rocznym planem AOP oraz godzinami Non-Coverage (NC).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[#E8ECE9] text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#D0DCD6] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Zakładki */}
        <div className="flex border-b border-[#E2E8E5] bg-[#F9FAF9] px-6 shrink-0">
          <button
            onClick={() => setActiveTab('aop')}
            className={`flex items-center space-x-2 py-3.5 px-4 font-black text-xs border-b-2 transition-all ${
              activeTab === 'aop'
                ? 'border-[#006241] text-[#006241] bg-white'
                : 'border-transparent text-[#5C6F68] hover:text-[#1E3932]'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Baza Planu AOP ({selectedYear})</span>
          </button>

          <button
            onClick={() => setActiveTab('nc')}
            className={`flex items-center space-x-2 py-3.5 px-4 font-black text-xs border-b-2 transition-all ${
              activeTab === 'nc'
                ? 'border-[#006241] text-[#006241] bg-white'
                : 'border-transparent text-[#5C6F68] hover:text-[#1E3932]'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Godziny NC (Non-Coverage)</span>
          </button>
        </div>

        {/* Zawartość Zakładki 2: Plan AOP */}
        {activeTab === 'aop' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Pasek akcji AOP */}
            <div className="px-6 py-3 bg-[#F9FAF9] border-b border-[#E2E8E5] flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-lg border border-[#D0DCD6]">
                  <Calendar className="w-3.5 h-3.5 text-[#006241]" />
                  <span className="font-bold text-[#5C6F68]">Rok:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => onYearChange(Number(e.target.value))}
                    className="bg-transparent font-black text-[#1E3932] focus:outline-none cursor-pointer"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-[#5C6F68]">Cel TPLH dla roku:</span>
                  <input
                    type="number"
                    step="0.05"
                    value={bulkTplh}
                    onChange={(e) => setBulkTplh(e.target.value)}
                    className="w-16 px-2 py-0.5 bg-white border border-[#D0DCD6] rounded text-center font-bold text-[#1E3932] focus:outline-none"
                  />
                  <button
                    onClick={handleApplyBulkTplh}
                    className="px-2.5 py-1 bg-white hover:bg-[#E8F5E9] text-[#006241] font-bold rounded border border-[#C8E6C9] shadow-xs text-[11px]"
                  >
                    Ustaw dla 12 msc
                  </button>
                </div>
              </div>

              {aopSuccess && (
                <span className="text-xs font-bold text-[#006241] flex items-center gap-1 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-[#00754A]" /> Zapisano AOP!
                </span>
              )}
            </div>

            {/* Tabela AOP */}
            <div className="p-6 overflow-y-auto flex-1">
              {isAopLoading ? (
                <div className="py-12 text-center text-xs text-[#5C6F68]">Ładowanie AOP...</div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F4F7F5] text-[#006241] uppercase font-black tracking-wider border-b border-[#E2E8E5]">
                      <th className="py-2.5 px-3">Miesiąc</th>
                      <th className="py-2.5 px-2 text-center">Tyg.</th>
                      <th className="py-2.5 px-3 text-right">Plan TRX</th>
                      <th className="py-2.5 px-3 text-right">Cel TPLH</th>
                      <th className="py-2.5 px-3 text-right">Budżet Godzin</th>
                      <th className="py-2.5 px-3 text-right">Śr. Tyg.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F0]">
                    {aopPlans.map((p, idx) => (
                      <tr key={p.key} className="hover:bg-[#F0F5F2] transition-colors">
                        <td className="py-2.5 px-3 font-black text-[#1E3932]">{p.month}</td>
                        <td className="py-2.5 px-2 text-center font-bold text-[#5C6F68]">{p.weeks_count}</td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="50"
                            value={p.plan_trx}
                            onChange={(e) =>
                              handleAopChange(idx, 'plan_trx', Number(e.target.value) || 0)
                            }
                            className="w-24 px-2 py-0.5 bg-white border border-[#D0DCD6] rounded text-right font-black text-[#1E3932]"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            step="0.05"
                            value={p.target_tplh}
                            onChange={(e) =>
                              handleAopChange(idx, 'target_tplh', Number(e.target.value) || 6.7)
                            }
                            className="w-16 px-2 py-0.5 bg-white border border-[#D0DCD6] rounded text-right font-black text-[#006241]"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-[#1E3932]">
                          {p.labor_budget?.toLocaleString('pl-PL')} h
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#5C6F68]">
                          {p.avg_weekly_hours?.toFixed(1)} h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Stopka AOP */}
            <div className="p-4 border-t border-[#E2E8E5] bg-[#F7F9F8] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-6 text-xs">
                <div>
                  <span className="text-[#5C6F68] block text-[10px] font-bold">TRX Roku:</span>
                  <span className="font-black text-sm text-[#1E3932]">{totalTrxYear.toLocaleString('pl-PL')}</span>
                </div>
                <div>
                  <span className="text-[#5C6F68] block text-[10px] font-bold">Śr. TPLH:</span>
                  <span className="font-black text-sm text-[#006241]">{avgTplhYear}</span>
                </div>
                <div>
                  <span className="text-[#5C6F68] block text-[10px] font-bold">Budżet Roku:</span>
                  <span className="font-black text-sm text-[#1E3932]">{totalHoursYear.toLocaleString('pl-PL')} h</span>
                </div>
              </div>
              <button
                onClick={handleSaveAop}
                disabled={isAopSaving}
                className="px-5 py-2 bg-[#006241] hover:bg-[#00754A] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> {isAopSaving ? 'Zapisywanie...' : 'Zapisz Plan AOP'}
              </button>
            </div>
          </div>
        )}

        {/* Zawartość Zakładki 3: Godziny NC (Non-Coverage) */}
        {activeTab === 'nc' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Pasek informacyjny NC */}
            <div className="p-4 bg-[#F9FAF9] border-b border-[#E2E8E5] flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center space-x-2 text-[#5C6F68]">
                <Briefcase className="w-4 h-4 text-[#006241]" />
                <span>
                  Godziny <strong>Non-Coverage (NC)</strong> to gwarantowane godziny nieobsługowe (zarządzanie, szkolenia, inwentaryzacje) wliczane do budżetu AOP.
                </span>
              </div>
              <button
                onClick={handleAddNcRule}
                className="px-3 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Dodaj Zadaniową Pozycję NC
              </button>
            </div>

            {/* Lista pozycji NC */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isNcLoading ? (
                <div className="py-12 text-center text-[#5C6F68] text-sm">
                  Ładowanie konfiguracji NC...
                </div>
              ) : (
                <>
                  {/* Przełącznik trybu wpisywania: miesięcznie / tygodniowo */}
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs text-[#5C6F68] font-medium">Tryb wpisywania godzin NC:</span>
                    <div className="flex items-center bg-[#F4F7F5] rounded-xl border border-[#E2E8E5] p-0.5">
                      <button
                        type="button"
                        onClick={() => setNcInputMode('monthly')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all ${
                          ncInputMode === 'monthly'
                            ? 'bg-[#006241] text-white shadow-xs'
                            : 'text-[#5C6F68] hover:text-[#1E3932]'
                        }`}
                      >
                        📅 Miesięcznie
                      </button>
                      <button
                        type="button"
                        onClick={() => setNcInputMode('weekly')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all ${
                          ncInputMode === 'weekly'
                            ? 'bg-[#006241] text-white shadow-xs'
                            : 'text-[#5C6F68] hover:text-[#1E3932]'
                        }`}
                      >
                        📆 Tygodniowo
                      </button>
                    </div>
                  </div>

                  <div className="border border-[#E2E8E5] rounded-2xl overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F4F7F5] text-[#006241] uppercase font-black tracking-wider border-b border-[#E2E8E5]">
                        <th className="py-2.5 px-4">Zadanie / Obszar NC</th>
                        <th className="py-2.5 px-3">Kategoria</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">
                          {ncInputMode === 'monthly' ? 'Pula Miesięczna (h)' : 'Pula Tygodniowa (h)'}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          {ncInputMode === 'monthly' ? 'Śr. Tygodniowo (~h)' : 'Miesięcznie (~h)'}
                        </th>
                        <th className="py-2.5 px-3 text-center">Akcje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEF2F0]">
                      {ncRules.map((rule) => {
                        const monthlyHours = rule.monthly_hours || 0;
                        const weeklyApprox = Number((monthlyHours / 4.33).toFixed(1));
                        // Wartość wyświetlana w polu wpisywania (zależna od trybu)
                        const inputValue = ncInputMode === 'monthly' ? monthlyHours : weeklyApprox;
                        // Wartość pochodna wyświetlana w kolumnie obliczonej
                        const derivedValue = ncInputMode === 'monthly' ? weeklyApprox : monthlyHours;
                        return (
                          <tr key={rule.id} className="hover:bg-[#F0F5F2] transition-colors">
                            <td className="py-2.5 px-4 font-black text-[#1E3932]">
                              <input
                                type="text"
                                value={rule.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNcRules((prev) =>
                                    prev.map((r) => (r.id === rule.id ? { ...r, name: val } : r))
                                  );
                                }}
                                className="w-full px-2 py-1 bg-white border border-[#D0DCD6] focus:border-[#006241] rounded-lg font-bold text-[#1E3932] focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={rule.category}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setNcRules((prev) =>
                                    prev.map((r) => (r.id === rule.id ? { ...r, category: val } : r))
                                  );
                                }}
                                className="w-28 px-2 py-1 bg-white border border-[#D0DCD6] focus:border-[#006241] rounded-lg text-[#5C6F68] font-medium focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setNcRules((prev) =>
                                    prev.map((r) =>
                                      r.id === rule.id ? { ...r, is_mandatory: !r.is_mandatory } : r
                                    )
                                  );
                                }}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black transition-colors ${
                                  rule.is_mandatory
                                    ? 'bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]'
                                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                                }`}
                              >
                                {rule.is_mandatory ? 'Stała (AOP)' : 'Opcjonalna'}
                              </button>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                value={inputValue}
                                onChange={(e) => {
                                  const raw = parseFloat(e.target.value);
                                  if (isNaN(raw)) return;
                                  // Zawsze zapisujemy monthly_hours — przeliczamy z trybu
                                  const newMonthly = ncInputMode === 'monthly'
                                    ? raw
                                    : Number((raw * 4.33).toFixed(1));
                                  handleNcHoursChange(rule.id, String(newMonthly));
                                }}
                                className="w-20 px-2 py-1 bg-white border border-[#D0DCD6] focus:border-[#006241] rounded-lg text-right font-black text-[#006241] focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-[#5C6F68]">
                              ~{derivedValue} h
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleDeleteNcRule(rule.id)}
                                title="Usuń pozycję"
                                className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </>
              )}

              {/* Box kontekstowy */}
              <div className="p-4 rounded-2xl bg-[#F0F5F2] border border-[#C8E6C9] flex items-start gap-3 text-xs">
                <Sparkles className="w-5 h-5 text-[#006241] shrink-0 mt-0.5" />
                <div className="text-[#1E3932] space-y-1">
                  <p className="font-bold">Wpływ na Silnik Równoważenia i Grafik SM:</p>
                  <p className="text-[#5C6F68] leading-relaxed">
                    Suma godzin NC (np. {totalNcHoursMonth.toFixed(1)} h/miesiąc = ~{(totalNcHoursMonth / 4.33).toFixed(1)} h/tydz.) jest automatycznie rezerwowana w budżecie robocizny AOP.
                    Grafik barowy (Coverage) nie może być planowany kosztem tych godzin, a pozostała część budżetu podlega podziałowi na tygodnie i weryfikacji z barierą Floor Hours (32h/dzień × liczba dni).
                  </p>
                </div>
              </div>
            </div>

            {/* Stopka NC */}
            <div className="p-4 border-t border-[#E2E8E5] bg-[#F7F9F8] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-6 text-xs">
                <div>
                  <span className="text-[#5C6F68] block text-[10px] font-bold">Miesięczna Pula NC:</span>
                  <span className="font-black text-sm text-[#006241]">{totalNcHoursMonth.toFixed(1)} h</span>
                </div>
                <div>
                  <span className="text-[#5C6F68] block text-[10px] font-bold">Średnio na Tydzień:</span>
                  <span className="font-black text-sm text-[#1E3932]">~{avgWeeklyNcHours.toFixed(1)} h/tydz.</span>
                </div>
                <div>
                  <span className="text-[#5C6F68] block text-[10px] font-bold">Zdefiniowanych Pozycji:</span>
                  <span className="font-black text-sm text-[#5C6F68]">{ncRules.length}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {ncSuccess && (
                  <span className="text-xs font-bold text-[#006241] flex items-center gap-1 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-[#00754A]" /> Zapisano reguły NC!
                  </span>
                )}
                <button
                  onClick={() => setNcRules(DEFAULT_NC_RULES)}
                  className="px-3.5 py-2 rounded-xl bg-white border border-[#D0DCD6] hover:bg-[#E8F5E9] text-[#5C6F68] hover:text-[#006241] font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Domyślne NC
                </button>
                <button
                  onClick={handleSaveNcRules}
                  disabled={isNcSaving}
                  className="px-5 py-2 bg-[#006241] hover:bg-[#00754A] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> {isNcSaving ? 'Zapisywanie...' : 'Zapisz Reguły NC'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
