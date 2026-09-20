import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Save, RotateCcw, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { FloorRuleDay } from '../../../types';

interface FloorHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
}

const DEFAULT_FLOOR_RULES: FloorRuleDay[] = [
  { day_id: 'monday', day_name: 'Poniedziałek', shifts_count: 5, hours_per_shift: 8.0, total_day_hours: 40.0 },
  { day_id: 'tuesday', day_name: 'Wtorek', shifts_count: 5, hours_per_shift: 8.0, total_day_hours: 40.0 },
  { day_id: 'wednesday', day_name: 'Środa', shifts_count: 5, hours_per_shift: 8.0, total_day_hours: 40.0 },
  { day_id: 'thursday', day_name: 'Czwartek', shifts_count: 5, hours_per_shift: 8.0, total_day_hours: 40.0 },
  { day_id: 'friday', day_name: 'Piątek', shifts_count: 5, hours_per_shift: 8.0, total_day_hours: 40.0 },
  { day_id: 'saturday', day_name: 'Sobota', shifts_count: 5, hours_per_shift: 8.0, total_day_hours: 40.0 },
  { day_id: 'sunday', day_name: 'Niedziela', shifts_count: 4, hours_per_shift: 8.0, total_day_hours: 32.0 },
];

export const FloorHoursModal: React.FC<FloorHoursModalProps> = ({
  isOpen,
  onClose,
  onSaveSuccess,
}) => {
  const [rules, setRules] = useState<FloorRuleDay[]>(DEFAULT_FLOOR_RULES);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadFloorRules();
    }
  }, [isOpen]);

  const loadFloorRules = async () => {
    setIsLoading(true);
    setSuccessMessage(false);
    try {
      if ((window as any).api?.getFloorRules) {
        const data = await (window as any).api.getFloorRules();
        if (data && data.length > 0) {
          setRules(data);
          return;
        }
      }
      setRules(DEFAULT_FLOOR_RULES);
    } catch (err) {
      console.error('Błąd pobierania reguł Floor Hours:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (
    idx: number,
    field: 'shifts_count' | 'hours_per_shift',
    val: number
  ) => {
    setRules((prev) => {
      const updated = [...prev];
      const row = { ...updated[idx] };

      if (field === 'shifts_count') {
        row.shifts_count = Math.max(1, Math.round(val || 1));
      } else if (field === 'hours_per_shift') {
        row.hours_per_shift = Math.max(1, val || 8.0);
      }

      row.total_day_hours = Number((row.shifts_count * row.hours_per_shift).toFixed(1));
      updated[idx] = row;
      return updated;
    });
  };

  const handleResetDefaults = () => {
    setRules(DEFAULT_FLOOR_RULES);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMessage(false);
    try {
      if ((window as any).api?.saveFloorRules) {
        await (window as any).api.saveFloorRules(rules);
        setSuccessMessage(true);
        onSaveSuccess();
        setTimeout(() => setSuccessMessage(false), 3500);
      }
    } catch (err) {
      console.error('Błąd zapisu reguł Floor Hours:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const totalWeekly = rules.reduce((acc, r) => acc + (r.total_day_hours || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-[#D0DCD6] rounded-3xl max-w-2xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Nagłówek */}
        <div className="p-6 border-b border-[#E2E8E5] flex items-center justify-between shrink-0 bg-[#F4F7F5]">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
              <ShieldAlert className="w-6 h-6 text-[#006241]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#1E3932] flex items-center gap-2">
                Konfiguracja Bariery Floor Hours
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
                  Lokal 384
                </span>
              </h3>
              <p className="text-xs text-[#5C6F68]">
                Minimalna dopuszczalna obsada grafiku zabezpieczająca operacje kawiarni.
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

        {/* Zawartość */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Informacja operacyjna */}
          <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-start space-x-3">
            <Clock className="w-5 h-5 text-[#006241] shrink-0 mt-0.5" />
            <div className="text-xs text-[#1E3932] leading-relaxed">
              <strong>Złota reguła Starbucks:</strong> Pełny tydzień (7 dni) standardowo wymaga{' '}
              <strong>272.0 h</strong> (Pn–Sob po 5 zmian x 8h = 40h/dzień, Niedziela 4 zmiany x 8h = 32h).
              Wszelkie modyfikacje zostaną uwzględnione w kalkulatorze HANW oraz tygodniach niepełnych.
            </div>
          </div>

          {/* Tabela Dni */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-[#5C6F68]">Ładowanie parametrów...</div>
          ) : (
            <div className="border border-[#E2E8E5] rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F4F7F5] text-[#006241] uppercase font-black tracking-wider border-b border-[#E2E8E5]">
                    <th className="py-3 px-4">Dzień Tygodnia</th>
                    <th className="py-3 px-3 text-center">Liczba Zmian</th>
                    <th className="py-3 px-3 text-center">Godz./Zmianę</th>
                    <th className="py-3 px-4 text-right">Suma Dnia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F0]">
                  {rules.map((r, idx) => (
                    <tr key={r.day_id} className="hover:bg-[#F0F5F2] transition-colors">
                      <td className="py-3 px-4 font-black text-[#1E3932]">
                        {r.day_name}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          max="15"
                          value={r.shifts_count}
                          onChange={(e) =>
                            handleFieldChange(idx, 'shifts_count', Number(e.target.value))
                          }
                          className="w-16 px-2 py-1 bg-white border border-[#D0DCD6] focus:border-[#006241] rounded-lg text-center font-black text-[#1E3932] focus:outline-none"
                        />
                      </td>

                      <td className="py-3 px-3 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="4"
                          max="12"
                          value={r.hours_per_shift}
                          onChange={(e) =>
                            handleFieldChange(idx, 'hours_per_shift', Number(e.target.value))
                          }
                          className="w-16 px-2 py-1 bg-white border border-[#D0DCD6] focus:border-[#006241] rounded-lg text-center font-black text-[#1E3932] focus:outline-none"
                        />
                      </td>

                      <td className="py-3 px-4 text-right font-black text-[#006241] text-sm">
                        {r.total_day_hours.toFixed(1)} h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stopka z podsumowaniem i zapisem */}
        <div className="p-5 border-t border-[#E2E8E5] bg-[#F7F9F8] flex items-center justify-between shrink-0">
          <div>
            <span className="text-xs text-[#5C6F68] block font-bold">
              Łączne Floor Hours pełnego tygodnia:
            </span>
            <div className="text-2xl font-black text-[#006241]">
              {totalWeekly.toFixed(1)} h <span className="text-xs font-semibold text-[#5C6F68]">/ tydzień</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {successMessage && (
              <span className="text-xs font-bold text-[#006241] flex items-center gap-1 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-[#00754A]" />
                Zapisano!
              </span>
            )}

            <button
              onClick={handleResetDefaults}
              title="Przywróć domyślne 272h"
              className="px-3.5 py-2 rounded-xl bg-white border border-[#D0DCD6] hover:bg-[#E8F5E9] text-[#5C6F68] hover:text-[#006241] font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Domyślne (272h)</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-[#006241] hover:bg-[#00754A] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Zapisywanie...' : 'Zapisz Reguły'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
