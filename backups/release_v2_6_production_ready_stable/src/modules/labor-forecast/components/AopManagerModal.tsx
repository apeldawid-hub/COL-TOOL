import React, { useState, useEffect } from 'react';
import { X, Target, Save, CheckCircle2, RotateCcw, Sparkles, TrendingUp, Calendar } from 'lucide-react';
import { AopPlanRecord } from '../../../types';

interface AopManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
  onSaveSuccess: () => void;
}

export const AopManagerModal: React.FC<AopManagerModalProps> = ({
  isOpen,
  onClose,
  selectedYear,
  availableYears,
  onYearChange,
  onSaveSuccess,
}) => {
  const [aopYear, setAopYear] = useState<number>(selectedYear);
  const [plans, setPlans] = useState<AopPlanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bulkTplh, setBulkTplh] = useState<string>('6.70');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAopYear(selectedYear);
      loadYearlyPlans(selectedYear);
    }
  }, [isOpen, selectedYear]);

  const handleYearChange = (newYear: number) => {
    setAopYear(newYear);
    loadYearlyPlans(newYear);
  };

  const loadYearlyPlans = async (yr: number) => {
    setIsLoading(true);
    setSaveSuccessMsg(false);
    try {
      if ((window as any).api?.getAopPlansForYear) {
        const data = await (window as any).api.getAopPlansForYear(yr);
        if (data && data.length > 0) {
          setPlans(data);
          return;
        }
      }
      // Fallback
      const defaultMonths = [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
      ];
      const mock = defaultMonths.map((m, idx) => ({
        key: `${yr}_${m}`,
        year: yr,
        month: m,
        month_code: `M${String(idx + 1).padStart(2, '0')}`,
        weeks_count: [2, 5, 8, 11].includes(idx) ? 6 : 5,
        plan_trx: 10800,
        target_tplh: 6.70,
        labor_budget: Number((10800 / 6.70).toFixed(1)),
        avg_weekly_hours: Number(((10800 / 6.70) / 5).toFixed(1)),
      }));
      setPlans(mock);
    } catch (err) {
      console.error('Błąd pobierania planu AOP:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (idx: number, field: 'plan_trx' | 'target_tplh', value: number) => {
    setPlans((prev) => {
      const updated = [...prev];
      const curr = { ...updated[idx] };

      if (field === 'plan_trx') {
        curr.plan_trx = value;
      } else if (field === 'target_tplh') {
        curr.target_tplh = value;
      }

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

    setPlans((prev) =>
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

  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(false);

    try {
      if ((window as any).api?.saveYearlyAop) {
        await (window as any).api.saveYearlyAop(plans);
        setSaveSuccessMsg(true);
        if (aopYear === selectedYear) {
          onSaveSuccess();
        }
        setTimeout(() => {
          setSaveSuccessMsg(false);
        }, 4000);
      }
    } catch (err) {
      console.error('Błąd zapisu rocznego AOP:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Podsumowanie roczne
  const totalTrxYear = plans.reduce((acc, p) => acc + (p.plan_trx || 0), 0);
  const totalHoursYear = plans.reduce((acc, p) => acc + (p.labor_budget || 0), 0);
  const avgTplhYear = totalHoursYear > 0 ? (totalTrxYear / totalHoursYear).toFixed(2) : '6.70';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-[#D0DCD6] rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
        {/* Nagłówek okna */}
        <div className="p-6 border-b border-[#E2E8E5] flex items-center justify-between shrink-0 bg-[#F4F7F5]">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
              <Target className="w-6 h-6 text-[#006241]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#1E3932] flex items-center gap-2">
                Moduł Planowania AOP (Annual Operating Plan)
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
                  Lokal 18120
                </span>
              </h3>
              <p className="text-xs text-[#5C6F68]">
                Wprowadzaj i modyfikuj cele sprzedażowe TRX oraz wskaźniki TPLH na poszczególne miesiące.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            {/* Wybór Roku */}
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-[#D0DCD6] shadow-xs">
              <Calendar className="w-4 h-4 text-[#006241]" />
              <span className="text-xs font-bold text-[#5C6F68]">Rok do edycji:</span>
              <select
                value={aopYear}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="bg-transparent text-sm font-black text-[#1E3932] focus:outline-none cursor-pointer"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            {aopYear !== selectedYear && (
              <div className="flex items-center gap-2 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-xs">
                <span className="text-amber-900 font-bold">
                  Edycja planu {aopYear} (pulpit: {selectedYear})
                </span>
                {onYearChange && (
                  <button
                    type="button"
                    onClick={() => onYearChange(aopYear)}
                    className="text-blue-700 hover:text-blue-900 underline font-black text-[11px] cursor-pointer"
                    title="Przełącz również główny ekran kawiarni na ten rok"
                  >
                    Przełącz pulpit na {aopYear}
                  </button>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-[#E8ECE9] text-[#5C6F68] hover:text-[#1E3932] hover:bg-[#D0DCD6] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Pasek Szybkich Akcji Hurtowych */}
        <div className="px-6 py-3 bg-[#F9FAF9] border-b border-[#E2E8E5] flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#5C6F68]">Ustaw cel TPLH dla całego roku:</span>
            <input
              type="number"
              step="0.05"
              value={bulkTplh}
              onChange={(e) => setBulkTplh(e.target.value)}
              className="w-16 px-2 py-1 bg-white border border-[#D0DCD6] rounded-lg text-center font-bold text-[#1E3932] focus:border-[#006241] focus:outline-none"
            />
            <button
              onClick={handleApplyBulkTplh}
              className="px-3 py-1 bg-white hover:bg-[#E8F5E9] text-[#006241] font-bold rounded-lg border border-[#C8E6C9] shadow-xs transition-colors flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Zastosuj do 12 miesięcy
            </button>
          </div>

          <div className="flex items-center space-x-3">
            {saveSuccessMsg && (
              <span className="text-[#006241] font-bold flex items-center gap-1.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-[#00754A]" />
                Zapisano pomyślnie w bazie!
              </span>
            )}
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="px-4 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Zapisywanie...' : 'Zapisz Plan AOP'}</span>
            </button>
          </div>
        </div>

        {/* Tabela Miesięcy AOP */}
        <div className="overflow-y-auto p-6 flex-1">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-[#5C6F68]">Ładowanie planu AOP...</div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F4F7F5] text-[#006241] uppercase font-black tracking-wider border-b border-[#E2E8E5]">
                  <th className="py-3 px-4">Miesiąc</th>
                  <th className="py-3 px-3 text-center">Tygodni</th>
                  <th className="py-3 px-4 text-right">Plan TRX</th>
                  <th className="py-3 px-4 text-right">Cel TPLH</th>
                  <th className="py-3 px-4 text-right">Budżet Godzin AOP</th>
                  <th className="py-3 px-4 text-right">Śr. Tyg. Godziny</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F0]">
                {plans.map((p, idx) => (
                  <tr key={p.key} className="hover:bg-[#F0F5F2] transition-colors">
                    <td className="py-3 px-4 font-black text-[#1E3932] flex items-center gap-2">
                      <span className="w-8 py-0.5 rounded bg-[#E8ECE9] text-center font-extrabold text-[11px] text-[#5C6F68]">
                        {p.month_code}
                      </span>
                      <span>{p.month}</span>
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-[#5C6F68]">
                      {p.weeks_count}
                    </td>

                    {/* Plan TRX (Edytowalne) */}
                    <td className="py-3 px-4 text-right">
                      <input
                        type="number"
                        step="50"
                        value={p.plan_trx}
                        onChange={(e) =>
                          handleFieldChange(idx, 'plan_trx', Number(e.target.value) || 0)
                        }
                        className="w-28 px-2.5 py-1 bg-white border border-[#D0DCD6] focus:border-[#006241] focus:ring-1 focus:ring-[#006241] rounded-lg text-right font-black text-[#1E3932] text-xs shadow-2xs focus:outline-none"
                      />
                    </td>

                    {/* Cel TPLH (Edytowalne) */}
                    <td className="py-3 px-4 text-right">
                      <input
                        type="number"
                        step="0.05"
                        value={p.target_tplh}
                        onChange={(e) =>
                          handleFieldChange(idx, 'target_tplh', Number(e.target.value) || 6.7)
                        }
                        className="w-20 px-2.5 py-1 bg-white border border-[#D0DCD6] focus:border-[#006241] focus:ring-1 focus:ring-[#006241] rounded-lg text-right font-black text-[#006241] text-xs shadow-2xs focus:outline-none"
                      />
                    </td>

                    {/* Budżet Godzin AOP (Wyliczany automatycznie) */}
                    <td className="py-3 px-4 text-right font-black text-[#1E3932]">
                      {p.labor_budget?.toLocaleString('pl-PL')} h
                    </td>

                    {/* Średnia Tygodniowa */}
                    <td className="py-3 px-4 text-right font-bold text-[#5C6F68]">
                      {p.avg_weekly_hours?.toFixed(1)} h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Podsumowanie Roczne na Dole */}
        <div className="p-4 border-t border-[#E2E8E5] bg-[#F7F9F8] flex justify-between items-center text-xs text-[#1E3932] shrink-0">
          <div className="flex items-center space-x-6">
            <div>
              <span className="text-[#5C6F68] block text-[10px] uppercase font-bold">
                Łączny Plan TRX ({selectedYear}):
              </span>
              <span className="font-black text-sm text-[#1E3932]">
                {totalTrxYear.toLocaleString('pl-PL')}
              </span>
            </div>
            <div>
              <span className="text-[#5C6F68] block text-[10px] uppercase font-bold">
                Średni Cel TPLH Roku:
              </span>
              <span className="font-black text-sm text-[#006241]">{avgTplhYear}</span>
            </div>
            <div>
              <span className="text-[#5C6F68] block text-[10px] uppercase font-bold">
                Roczny Budżet Robocizny:
              </span>
              <span className="font-black text-sm text-[#1E3932]">
                {totalHoursYear.toLocaleString('pl-PL')} h
              </span>
            </div>
          </div>

          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-5 py-2 bg-[#006241] hover:bg-[#00754A] text-white font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Zapisywanie...' : 'Zatwierdź i Zapisz'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
