import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CalendarCheck,
  ShieldCheck,
  RotateCcw,
  Users,
  Layers,
  ArrowRight,
  TrendingUp,
  Info,
  Scale,
  Calendar,
  Coffee,
  Check,
  Copy,
  MessageSquare,
  Building2,
  Send,
  HelpCircle,
  MapPin
} from 'lucide-react';
import {
  ManagerScheduleMonthData,
  ManagerScheduleShift,
  ManagerEmployee
} from '../../../types/index';
import {
  InterStoreSupportEngine,
  InterStoreSupportRequest,
  SupportCandidateOption,
  InterStoreSupportAnalysis
} from '../services/interStoreSupportEngine';

interface InterStoreSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ManagerScheduleMonthData;
  onApplySupportShifts: (shiftsToUpdate: ManagerScheduleShift[], successMessage: string) => Promise<void>;
  prevMonthShifts?: ManagerScheduleShift[];
}

const COMMON_STORES = [
  { code: '323', name: 'Nowy Świat' },
  { code: '341', name: 'Sadyba Best Mall' },
  { code: '756', name: 'San Park Mysiadło' },
  { code: '327', name: 'Westfield Arkadia' },
  { code: '381', name: 'Złote Tarasy' },
  { code: '383', name: 'Westfield Mokotów' },
  { code: '394', name: 'Plac Unii' }
];

export const InterStoreSupportModal: React.FC<InterStoreSupportModalProps> = ({
  isOpen,
  onClose,
  data,
  onApplySupportShifts,
  prevMonthShifts = []
}) => {
  const daysInMonth = useMemo(() => new Date(data.year, data.month, 0).getDate(), [data.year, data.month]);

  // Formularz zapotrzebowania
  const [targetDay, setTargetDay] = useState<number>(1);
  const [shiftCode, setShiftCode] = useState<'SAM' | 'SPM' | 'SUP'>('SPM');
  const [selectedStoreCode, setSelectedStoreCode] = useState<string>('323');
  const [customStoreName, setCustomStoreName] = useState<string>('Nowy Świat');
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [copiedOptionId, setCopiedOptionId] = useState<string | null>(null);

  // Wyliczenie nazwy i kodu wybranej kawiarni
  const currentStore = useMemo(() => {
    const found = COMMON_STORES.find(s => s.code === selectedStoreCode);
    if (found) return { code: found.code, name: found.name };
    return { code: selectedStoreCode || 'EXT', name: customStoreName || 'Inna kawiarnia' };
  }, [selectedStoreCode, customStoreName]);

  // Zapytanie analityczne do silnika
  const analysis: InterStoreSupportAnalysis = useMemo(() => {
    const request: InterStoreSupportRequest = {
      targetDay,
      shiftCode,
      targetStoreName: currentStore.name,
      targetStoreCode: currentStore.code,
      customHours: shiftCode === 'SUP' ? 8.0 : (shiftCode === 'SAM' ? 8.0 : 8.0)
    };

    return InterStoreSupportEngine.findSupportOptions(data, request, prevMonthShifts);
  }, [data, targetDay, shiftCode, currentStore, prevMonthShifts]);

  if (!isOpen) return null;

  // Obsługa kopiowania wiadomości do schowka
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedOptionId(id);
    setTimeout(() => setCopiedOptionId(null), 3000);
  };

  // Zatwierdzenie i aplikacja wybranego wariantu wsparcia
  const handleApplyOption = async (option: SupportCandidateOption) => {
    const confirm = window.confirm(
      `🤝 Czy na pewno chcesz zatwierdzić ten wariant wsparcia dla ${currentStore.name} w dniu ${analysis.targetDayName}?\n\n` +
      `Wydelegowany pracownik: ${option.dispatchedEmployee.name} (${option.dispatchedShiftCode})\n` +
      `${option.description}`
    );
    if (!confirm) return;

    setIsApplying(true);
    try {
      // Przygotuj zaktualizowane obiekty zmian na podstawie diffs
      const updatedShifts: ManagerScheduleShift[] = [];

      for (const diff of option.diffs) {
        // Znajdź istniejący shift w data.rows
        let existingShift: ManagerScheduleShift | undefined;
        data.rows.forEach(r => {
          if (r.employee.id === diff.employeeId && r.shifts[diff.day]) {
            existingShift = r.shifts[diff.day];
          }
        });

        const updated: ManagerScheduleShift = {
          year: data.year,
          month: data.month,
          day: diff.day,
          date: `${data.year}-${String(data.month).padStart(2, '0')}-${String(diff.day).padStart(2, '0')}`,
          employee_id: diff.employeeId,
          shift_code: diff.newShiftCode,
          hours: diff.hours,
          notes: diff.notes || (existingShift ? existingShift.notes : undefined),
          disposition: existingShift ? existingShift.disposition : undefined
        };

        updatedShifts.push(updated);
      }

      const successMsg = `Wydelegowano wsparcie (${option.dispatchedShiftCode}) dla ${option.dispatchedEmployee.name} w ${currentStore.name} na dzień ${diffDayStr(option.diffs[0]?.day || targetDay)}.`;
      await onApplySupportShifts(updatedShifts, successMsg);
      onClose();
    } catch (err) {
      console.error('Błąd zapisywania wsparcia:', err);
      alert('Wystąpił błąd podczas zapisywania wsparcia w grafiku.');
    } finally {
      setIsApplying(false);
    }
  };

  const diffDayStr = (d: number) => `${d}.${String(data.month).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E2E8E5] w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* NAGŁÓWEK MODALA */}
        <div className="bg-gradient-to-r from-[#006241] via-[#00754A] to-emerald-800 text-white p-5 sm:px-7 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
              <Building2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <span>Asystent Wsparcia Międzykawiarnianego</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-900/60 text-[10px] font-bold uppercase tracking-wider border border-white/20">
                  Inter-Store Support Dispatcher
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Starbucks 108120 Janki ➔ Oddawanie dyżurów do innych kawiarni bez naruszania bazy lokalu i Kodeksu Pracy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* GŁÓWNA ZAWARTOŚĆ */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-stone-50/50">
          
          {/* SEKCJA 1: FORMULARZ ZAPOTRZEBOWANIA Z OBCEJ KAWIARNI */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-[#006241]" />
                <span>Parametry Poszukiwanego Wsparcia</span>
              </div>
              <span className="text-[11px] text-stone-400">
                Wybierz dzień, typ dyżuru oraz kawiarnię, która poprosiła o pomoc
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* 1. Wybór Dnia Miesiąca */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#006241]" />
                  <span>Dzień Miesiąca ({data.monthName} {data.year}):</span>
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={targetDay}
                    onChange={e => setTargetDay(parseInt(e.target.value, 10))}
                    className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-black text-stone-800 focus:bg-white focus:border-[#006241] focus:ring-1 focus:ring-[#006241] transition"
                  >
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const d = i + 1;
                      const dateObj = new Date(data.year, data.month - 1, d);
                      const dow = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sob'][dateObj.getDay()];
                      return (
                        <option key={d} value={d}>
                          Dzień {d} ({dow}) • {d}.{String(data.month).padStart(2, '0')}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* 2. Typ Zmiany Wsparcia */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#006241]" />
                  <span>Typ Zmiany na Wsparciu:</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setShiftCode('SAM')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer ${
                      shiftCode === 'SAM'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    SAM (Otwarcie)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftCode('SPM')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer ${
                      shiftCode === 'SPM'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    SPM (Zamknięcie)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftCode('SUP')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer ${
                      shiftCode === 'SUP'
                        ? 'bg-indigo-700 text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    SUP (Środek/Bar)
                  </button>
                </div>
              </div>

              {/* 3. Kawiarnia Docelowa */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#006241]" />
                  <span>Kawiarnia Docelowa (Gdzie oddajemy):</span>
                </label>
                <select
                  value={selectedStoreCode}
                  onChange={e => {
                    setSelectedStoreCode(e.target.value);
                    const found = COMMON_STORES.find(s => s.code === e.target.value);
                    if (found) setCustomStoreName(found.name);
                  }}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-black text-stone-800 focus:bg-white focus:border-[#006241] focus:ring-1 focus:ring-[#006241] transition"
                >
                  {COMMON_STORES.map(s => (
                    <option key={s.code} value={s.code}>
                      📍 {s.code} SBX {s.name}
                    </option>
                  ))}
                  <option value="CUSTOM">✏️ Inna kawiarnia (Wpisz ręcznie)...</option>
                </select>
              </div>

            </div>

            {selectedStoreCode === 'CUSTOM' && (
              <div className="pt-1 flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Wpisz nazwę lokalu, np. 399 Galeria Północna"
                  value={customStoreName}
                  onChange={e => setCustomStoreName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 focus:bg-white focus:border-[#006241]"
                />
              </div>
            )}
          </div>

          {/* SEKCJA 2: WYNIKI ANALIZY I WARIANTY WSPARCIA */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[#006241] text-white flex items-center justify-center font-black text-xs shadow-xs">
                  {analysis.options.length}
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                    <span>Znalezione Warianty Wsparcia dla: <strong>{currentStore.name}</strong></span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#006241] text-[10px] font-black border border-emerald-300">
                      {analysis.targetDayName}
                    </span>
                  </h3>
                  <p className="text-xs text-stone-500">
                    Każdy wariant w 100% chroni bazę lokalu Janki (1 AM + 1 PM) oraz odpoczynek 11h Kodeksu Pracy.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-stone-400">
                <ShieldCheck className="w-4 h-4 text-[#006241]" />
                <span>100% Zgodne z KP</span>
              </div>
            </div>

            {analysis.options.length > 0 ? (
              <div className="space-y-3.5">
                {analysis.options.map(opt => {
                  const isCopiedSM = copiedOptionId === `sm_${opt.id}`;
                  const isCopiedEmp = copiedOptionId === `emp_${opt.id}`;

                  let badgeColor = 'bg-emerald-100 text-[#006241] border-emerald-300';
                  if (opt.scenarioType === 'internal_swap') badgeColor = 'bg-amber-100 text-amber-900 border-amber-300';
                  else if (opt.scenarioType === 'compensatory_rotation') badgeColor = 'bg-blue-100 text-blue-900 border-blue-300';

                  return (
                    <div
                      key={opt.id}
                      className="bg-white rounded-2xl p-4 border border-stone-200 hover:border-emerald-300 shadow-xs transition-all space-y-3.5"
                    >
                      {/* NAGŁÓWEK WARIANTU */}
                      <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${badgeColor}`}>
                              {opt.title}
                            </span>
                            <span className="text-xs font-black text-stone-900">
                              Oddelegowany: {opt.dispatchedEmployee.name} ({opt.dispatchedEmployee.role})
                            </span>
                          </div>
                          <p className="text-xs text-stone-600 leading-relaxed">
                            {opt.description}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-[10px] font-bold text-stone-400 uppercase">Nowy Dyżur</div>
                          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-950 font-black text-xs border border-indigo-300">
                            {opt.dispatchedShiftCode} ({opt.dispatchedShiftHours}h)
                          </span>
                        </div>
                      </div>

                      {/* PODGLĄD ZMIAN W GRAFIKU (DIFF) */}
                      <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 space-y-2">
                        <div className="text-[10px] font-black uppercase text-stone-500 tracking-wider flex items-center gap-1.5">
                          <Layers className="w-3 h-3 text-[#006241]" />
                          <span>Modyfikacje w Grafiku Miesiąca (Diff):</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {opt.diffs.map((d, dIdx) => (
                            <div key={dIdx} className="bg-white p-2.5 rounded-lg border border-stone-200 text-xs flex items-center justify-between">
                              <div>
                                <div className="font-bold text-stone-900">{d.employeeName}</div>
                                <div className="text-[10px] text-stone-500">
                                  Dzień {d.day}.{String(data.month).padStart(2, '0')} • {d.notes}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 font-black">
                                <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 text-[10px]">
                                  {d.prevShiftCode}
                                </span>
                                <ArrowRight className="w-3 h-3 text-stone-400" />
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[#006241] border border-emerald-300 text-[10px]">
                                  {d.newShiftCode} ({d.hours}h)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* STOPKA KARTY: WIADOMOŚCI I AKCJA ZASTOSOWANIA */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Kopiuj do SM */}
                          <button
                            onClick={() => handleCopyText(opt.copyMessageStoreManager, `sm_${opt.id}`)}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#006241]" />
                            <span>{isCopiedSM ? '✅ Skopiowano do SM' : 'Kopiuj wiadomość do SM'}</span>
                          </button>

                          {/* Kopiuj do Pracownika */}
                          <button
                            onClick={() => handleCopyText(opt.copyMessageEmployee, `emp_${opt.id}`)}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5 text-stone-500" />
                            <span>{isCopiedEmp ? '✅ Skopiowano do pracownika' : 'Kopiuj dla pracownika'}</span>
                          </button>
                        </div>

                        {/* Przycisk Zastosowania */}
                        <button
                          onClick={() => handleApplyOption(opt)}
                          disabled={isApplying}
                          className="px-4 py-2 bg-[#006241] hover:bg-[#00754A] text-white font-black text-xs rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Zastosuj i Wpisz do Grafiku</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 space-y-2">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <div className="text-sm font-black text-stone-900">Brak możliwości bezpiecznego wydelegowania wsparcia</div>
                <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                  {analysis.blockers[0] || 'Wszyscy pozostali menedżerowie mają zaplanowane obowiązkowe dyżury w Jankach, urlopy lub naruszyliby 11h odpoczynku dobowego.'}
                </p>
              </div>
            )}
          </div>

        </div>

        {/* STOPKA MODALA */}
        <div className="bg-white p-4 sm:px-7 border-t border-[#E2E8E5] flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-700 font-bold text-xs transition cursor-pointer"
          >
            Zamknij
          </button>

          <div className="text-xs text-stone-400 italic">
            Obsługa wsparć zasilana silnikiem Kodeksu Pracy i zintegrowana z rozliczeniem kwartalnym TOR
          </div>
        </div>

      </div>
    </div>
  );
};
