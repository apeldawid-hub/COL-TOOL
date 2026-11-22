import React, { useState, useMemo } from 'react';
import {
  ManagerScheduleMonthData,
  ManagerScheduleShift,
  ManagerEmployee
} from '../../../types';
import { formatManagerRole, ManagerScheduleEngine } from '../services/managerScheduleEngine';
import {
  X,
  AlertTriangle,
  UserX,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  PhoneCall,
  Clock,
  Copy,
  Check
} from 'lucide-react';

interface L4CrisisModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ManagerScheduleMonthData;
  boundaryShifts?: {
    prevMonthShifts?: ManagerScheduleShift[];
    nextMonthShifts?: ManagerScheduleShift[];
  };
  initialDay?: number;
  initialEmpId?: number;
  onApplyReplacement: (
    absentEmpId: number,
    replacementEmpId: number,
    day: number,
    shiftCode: string
  ) => Promise<void>;
  onOpenSupportModal?: () => void;
}

interface ReplacementCandidate {
  employee: ManagerEmployee;
  currentShiftCode: string;
  isOff: boolean;
  isNc: boolean;
  compliant: boolean;
  violationReason?: string;
  currentBalance: number;
  projectedBalance: number;
  score: number;
}

export const L4CrisisModal: React.FC<L4CrisisModalProps> = ({
  isOpen,
  onClose,
  data,
  boundaryShifts,
  initialDay = 1,
  initialEmpId,
  onApplyReplacement,
  onOpenSupportModal
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(initialDay);
  const [selectedEmpId, setSelectedEmpId] = useState<number>(
    initialEmpId || (data.employees[0]?.id ?? 1)
  );
  const [targetShiftCode, setTargetShiftCode] = useState<string>('AM');
  const [copiedSms, setCopiedSms] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Aktualny dyżur nieobecnego pracownika
  const absentRow = useMemo(() => {
    return data.rows.find(r => r.employee.id === selectedEmpId);
  }, [data.rows, selectedEmpId]);

  const currentAbsentShift = absentRow?.shifts[selectedDay];

  // Automatyczne ustawienie targetShiftCode wg dyżuru jaki chory miał zaplanowany
  React.useEffect(() => {
    if (currentAbsentShift && currentAbsentShift.shift_code !== 'OFF' && currentAbsentShift.shift_code !== 'L4') {
      setTargetShiftCode(currentAbsentShift.shift_code);
    }
  }, [currentAbsentShift]);

  // Kandydaci na zastępstwo
  const candidates: ReplacementCandidate[] = useMemo(() => {
    const list: ReplacementCandidate[] = [];
    const isSunday = new Date(data.year, data.month - 1, selectedDay).getDay() === 0;

    data.rows.forEach(r => {
      if (r.employee.id === selectedEmpId) return; // Pomijamy osobę chorą

      const curShift = r.shifts[selectedDay];
      const curCode = curShift ? curShift.shift_code : 'OFF';
      const isOff = curCode === 'OFF';
      const isNc = ['NC', 'BT', 'T', 'MEE', 'PRE'].includes(curCode);

      // Pre-flight test zgodności z Kodeksem Pracy dla wybranej zmiany
      let codeToTest = targetShiftCode;
      if (isSunday && codeToTest === 'AM' && data.shiftDefinitions.some(s => s.code === 'AMN')) codeToTest = 'AMN';
      if (isSunday && codeToTest === 'PM' && data.shiftDefinitions.some(s => s.code === 'PMN')) codeToTest = 'PMN';

      const testResult = ManagerScheduleEngine.testShiftCompliance(
        data.year,
        data.month,
        r.employee.id,
        selectedDay,
        codeToTest,
        data.rows,
        data.shiftDefinitions,
        boundaryShifts
      );

      const nominal = r.nominalHours || 160;
      const worked = r.totalWorkedHours || 0;
      const currentBalance = r.balanceHours ?? (worked - nominal);
      const shiftDef = data.shiftDefinitions.find(s => s.code === codeToTest);
      const shiftHours = shiftDef?.hours || 8.0;
      const projectedBalance = currentBalance + shiftHours;

      // Scoring kandydata
      let score = 0;
      if (isOff) score += 100;
      else if (isNc) score += 50;
      else score -= 80; // już ma dyżur na sali

      if (!testResult.isValid) {
        score -= 1000;
      } else {
        score += 50;
      }

      // Premiowanie menedżerów z niedogodzinami (zmniejszanie luki do etatu)
      if (currentBalance < 0) {
        score += Math.abs(currentBalance) * 4;
      } else if (currentBalance > 4.0) {
        score -= currentBalance * 3; // nie generujmy nadmiernych nadgodzin
      }

      list.push({
        employee: r.employee,
        currentShiftCode: curCode,
        isOff,
        isNc,
        compliant: testResult.isValid,
        violationReason: testResult.primaryViolation?.message,
        currentBalance,
        projectedBalance,
        score
      });
    });

    return list.sort((a, b) => b.score - a.score);
  }, [data, selectedDay, selectedEmpId, targetShiftCode, boundaryShifts]);

  // Obsługa zatwierdzenia zastępstwa
  const handleAssign = async (cand: ReplacementCandidate) => {
    try {
      setIsSubmitting(true);
      await onApplyReplacement(selectedEmpId, cand.employee.id, selectedDay, targetShiftCode);
      onClose();
    } catch (err) {
      console.error('Błąd zatwierdzenia zastępstwa:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generowanie SMS dla wsparcia międzykawiarnianego
  const smsText = useMemo(() => {
    const absentName = absentRow?.employee.name || 'Menedżer';
    return `Cześć! W kawiarni Starbucks mamy nagłą absencję L4 (${absentName}) w dniu ${selectedDay}.${data.month}.${data.year} na zmianę ${targetShiftCode} (8h). Czy macie możliwość delegacji wsparcia menedżerskiego (SUP)? Daj znać!`;
  }, [absentRow, selectedDay, data, targetShiftCode]);

  const handleCopySms = () => {
    navigator.clipboard?.writeText(smsText);
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 3000);
  };

  if (!isOpen) return null;

  const daySummary = data.daySummaries.find(d => d.day === selectedDay);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4 animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-2xl overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Nagłówek */}
        <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-rose-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-700/60 rounded-xl border border-rose-500/40 shadow-inner">
              <AlertTriangle className="w-5 h-5 text-rose-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-rose-100">
                  Asystent Kryzysowy L4 & Zastępstw Awaryjnych
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-600/60 text-white text-[10px] font-bold border border-rose-400/40">
                  1-Click Solver
                </span>
              </div>
              <p className="text-[11px] text-rose-200/90 mt-0.5">
                Błyskawiczny dobór zastępstwa bez naruszenia 11h/35h Kodeksu Pracy i z minimalizacją nadgodzin
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-rose-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formularz kontekstu: Dzień, Osoba chora, Zmiana */}
        <div className="bg-stone-50 border-b border-stone-200 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
              Dzień awarii
            </label>
            <select
              value={selectedDay}
              onChange={e => setSelectedDay(parseInt(e.target.value, 10))}
              className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 focus:ring-2 focus:ring-rose-500"
            >
              {data.daySummaries.map(d => (
                <option key={d.day} value={d.day}>
                  Dzień {d.day} ({d.dayName})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
              Nieobecny menedżer (L4)
            </label>
            <select
              value={selectedEmpId}
              onChange={e => setSelectedEmpId(parseInt(e.target.value, 10))}
              className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 focus:ring-2 focus:ring-rose-500"
            >
              {data.employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} ({formatManagerRole(e.role)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
              Dyżur do obsadzenia
            </label>
            <select
              value={targetShiftCode}
              onChange={e => setTargetShiftCode(e.target.value)}
              className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 font-bold text-stone-900 focus:ring-2 focus:ring-rose-500"
            >
              <option value="AM">Rano (AM: 07:00–15:00)</option>
              <option value="PM">Wieczór (PM: 14:30–22:30)</option>
              <option value="SUP">Wsparcie (SUP / 8h)</option>
              <option value="MIB">Międzyzmiana (MIB)</option>
            </select>
          </div>
        </div>

        {/* Lista Kandydatów z Rankingu */}
        <div className="p-5 max-h-[50vh] overflow-y-auto space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Rekomendowani Zastępcy (Dzień {selectedDay}, {daySummary?.dayName}):</span>
            </h4>
            <span className="text-[10px] text-stone-500 font-medium">
              Sortowanie: zgodność KP ➔ brak nadgodzin ➔ status OFF
            </span>
          </div>

          {candidates.map((cand, idx) => {
            const isTop = idx === 0 && cand.compliant;

            return (
              <div
                key={cand.employee.id}
                className={`border rounded-xl p-3.5 transition-all flex items-center justify-between gap-3 ${
                  isTop
                    ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400 shadow-xs'
                    : cand.compliant
                    ? 'bg-white border-stone-200 hover:border-stone-300'
                    : 'bg-stone-50 border-stone-200 opacity-60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-stone-900">{cand.employee.name}</span>
                    <span className="text-[10px] text-stone-500 font-medium">
                      ({formatManagerRole(cand.employee.role)})
                    </span>

                    {isTop && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wide">
                        🥇 Rekomendacja AI
                      </span>
                    )}

                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        cand.isOff
                          ? 'bg-stone-200 text-stone-800'
                          : cand.isNc
                          ? 'bg-purple-100 text-purple-900'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      Dziś: {cand.currentShiftCode}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-[11px] text-stone-600 flex-wrap">
                    <span>
                      Bilans m-ca: <strong>{cand.currentBalance > 0 ? `+${cand.currentBalance.toFixed(1)}h` : `${cand.currentBalance.toFixed(1)}h`}</strong>
                      {' ➔ '}
                      <strong className={cand.projectedBalance > 4.0 ? 'text-amber-700' : 'text-emerald-700'}>
                        {cand.projectedBalance > 0 ? `+${cand.projectedBalance.toFixed(1)}h` : `${cand.projectedBalance.toFixed(1)}h`}
                      </strong>
                    </span>

                    <span className="text-stone-300">•</span>

                    {cand.compliant ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1 text-[10px]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>100% Zgodny z Kodeksem Pracy (11h/35h OK)</span>
                      </span>
                    ) : (
                      <span className="text-rose-600 font-semibold flex items-center gap-1 text-[10px]">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{cand.violationReason || 'Naruszenie Kodeksu Pracy'}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handleAssign(cand)}
                    disabled={isSubmitting || !cand.compliant}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                      isTop
                        ? 'bg-[#006241] text-white hover:bg-[#1E3932] ring-2 ring-emerald-300'
                        : cand.compliant
                        ? 'bg-stone-800 text-white hover:bg-stone-900'
                        : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    }`}
                  >
                    <span>Obsadź</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Opcja wsparcia z dystryktu */}
          <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                <PhoneCall className="w-4 h-4 text-amber-700" />
                <span>Brak rąk w lokalu? Zwróć się o wsparcie w dystrykcie</span>
              </div>
              <button
                type="button"
                onClick={handleCopySms}
                className="px-2.5 py-1 bg-white border border-amber-300 hover:border-amber-400 rounded-lg text-amber-900 text-[11px] font-bold flex items-center gap-1 shadow-2xs"
              >
                {copiedSms ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSms ? 'Skopiowano SMS!' : 'Kopiuj gotowy SMS'}</span>
              </button>
            </div>
            <p className="text-[11px] text-amber-900/80 leading-relaxed font-mono bg-white/70 p-2 rounded-lg border border-amber-200/60">
              "{smsText}"
            </p>
          </div>
        </div>

        {/* Stopka */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <span className="text-[11px] text-stone-500">
            Zatwierdzenie automatycznie nada choremu status L4 i przypisze dyżur zastępcy.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold transition-all"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
