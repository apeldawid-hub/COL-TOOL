import React, { useState } from 'react';
import { Sparkles, X, Check, Clock, Target } from 'lucide-react';
import { WeeklyCalculatedRow } from '../../../types';

interface MondayProjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: WeeklyCalculatedRow;
  onSaveTrx: (weekKey: string, trx: number | null) => Promise<void>;
  onSaveScheduledHours?: (weekKey: string, hours: number | null) => Promise<void>;
}

export const MondayProjectionModal: React.FC<MondayProjectionModalProps> = ({
  isOpen,
  onClose,
  row,
  onSaveTrx,
  onSaveScheduledHours,
}) => {
  const p = row.mondayProjection;

  const [baristaHoursInput, setBaristaHoursInput] = useState<string>(
    p?.projectedBaristaHours !== undefined && p.projectedBaristaHours < 100
      ? String(p.projectedBaristaHours)
      : '24'
  );

  const [totalTrxInput, setTotalTrxInput] = useState<string>(
    p?.fullWeekProjectedTrx ? String(p.fullWeekProjectedTrx) : (p?.planTrx ? String(p.planTrx) : '')
  );

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !p) return null;

  const baristasVal = parseFloat(baristaHoursInput) || 0;
  const mondayTotalHours = Number((p.projectedMgrHours + baristasVal).toFixed(1));
  const fullWeekHours = Number((p.loggedHoursDays1to6 + mondayTotalHours).toFixed(1));

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const trxVal = totalTrxInput.trim() === '' ? null : Number(totalTrxInput);
      await onSaveTrx(row.week.week_key, isNaN(trxVal as number) ? null : trxVal);

      if (onSaveScheduledHours) {
        await onSaveScheduledHours(row.week.week_key, fullWeekHours);
      }
      onClose();
    } catch (err) {
      console.error('Błąd zapisu danych Flash Forecast:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-[#E2E8E5] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Nagłówek */}
        <div className="px-5 py-3.5 bg-[#1E3932] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-800/80 border border-emerald-600 flex items-center justify-center text-emerald-300">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">
                  Flash Forecast — Poniedziałek ({p.date})
                </h3>
                <span className="text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-full">
                  {row.week.week_num_in_month}
                </span>
              </div>
              <p className="text-[11px] text-stone-300 mt-0.5">
                Domknięcie estymacji do planowania grafiku W+2
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-stone-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Zawartość formularza */}
        <div className="p-5 space-y-4">
          {/* 1. Godziny Poniedziałku */}
          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#006241]" />
                Godziny na dziś (Poniedziałek)
              </label>
              <span className="text-xs font-black text-[#006241]">
                Dziś: {mondayTotalHours}h
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-white rounded-lg border border-stone-200 text-center">
                <span className="text-[10px] text-stone-500 font-bold block uppercase">Menedżerowie</span>
                <span className="text-xs font-black text-stone-800">+{p.projectedMgrHours} h</span>
              </div>

              <div className="p-2 bg-white rounded-lg border border-stone-200 flex flex-col justify-center">
                <span className="text-[10px] text-stone-500 font-bold block uppercase text-center">Barisci (z grafiku)</span>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={baristaHoursInput}
                    onChange={(e) => setBaristaHoursInput(e.target.value)}
                    className="w-16 px-1.5 py-0.5 bg-amber-50 border border-amber-300 rounded font-black text-xs text-amber-950 text-center focus:outline-hidden focus:ring-1 focus:ring-[#006241]"
                  />
                  <span className="text-xs font-bold text-stone-600">h</span>
                </div>
              </div>
            </div>

            {/* Szybkie presety godzin baristów */}
            <div className="flex items-center justify-between pt-1 text-[10px]">
              <span className="text-stone-500 font-medium">Szybki wybór:</span>
              <div className="flex items-center gap-1.5">
                {['16', '24', '28', '32'].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBaristaHoursInput(val)}
                    className={`px-2 py-0.5 rounded border transition-colors cursor-pointer font-bold ${
                      baristaHoursInput === val
                        ? 'bg-[#006241] text-white border-[#006241]'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    +{val}h
                  </button>
                ))}
              </div>
            </div>

            {p.loggedHoursDays1to6 > 0 && (
              <div className="text-[10px] text-stone-500 border-t border-stone-200 pt-1.5 flex justify-between">
                <span>Logowania z 6 dni (Wt–Nd): <strong>{p.loggedHoursDays1to6}h</strong></span>
                <span>Razem tydzień: <strong className="text-stone-800">{fullWeekHours}h</strong></span>
              </div>
            )}
          </div>

          {/* 2. Szacowane transakcje tygodnia (TRX) */}
          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-purple-700" />
                Szacowane transakcje tygodnia (TRX)
              </label>
              <span className="text-[10px] text-stone-500 font-medium">
                Plan AOP: <strong>{p.planTrx}</strong>
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                value={totalTrxInput}
                onChange={(e) => setTotalTrxInput(e.target.value)}
                placeholder={String(p.planTrx)}
                className="w-full pl-3 pr-14 py-2 bg-white border border-stone-300 rounded-lg text-sm font-black text-stone-900 focus:outline-hidden focus:ring-1 focus:ring-[#006241]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400 pointer-events-none">
                TRX
              </span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-stone-500">
              <span>Domyślnie: plan AOP tygodnia</span>
              {p.actualTrxDays1to6 ? (
                <span>Dotychczas 6 dni: <strong>{p.actualTrxDays1to6} TRX</strong></span>
              ) : null}
            </div>
          </div>

          {/* Mała notatka systemowa */}
          <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200/80 flex items-center gap-2 text-[11px] text-emerald-900 leading-snug">
            <Check className="w-3.5 h-3.5 text-[#006241] shrink-0" />
            <span>
              We wtorek rano po imporcie MAPAL Fichajes estymacja zostanie automatycznie zastąpiona oficjalnymi danymi.
            </span>
          </div>
        </div>

        {/* Przyciski akcji */}
        <div className="px-5 py-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Anuluj
          </button>

          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-lg bg-[#006241] hover:bg-[#00754A] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Zapisywanie...' : 'Zatwierdź estymację'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
