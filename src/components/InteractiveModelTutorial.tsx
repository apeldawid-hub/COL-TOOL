// src/components/InteractiveModelTutorial.tsx
import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CalendarDays,
  CalendarCheck,
  ShieldCheck,
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Copy,
  Check,
  Scale,
  MessageSquare,
  Zap,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  AlertTriangle,
  Info,
  FileText,
  History,
  RefreshCw,
  Search,
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  Sliders,
  SlidersHorizontal,
  Play,
  Layers,
  ArrowRight,
  Database,
  Store,
  GraduationCap,
  Calculator,
  Save
} from 'lucide-react';
import { useTutorial } from '../context/TutorialContext';

export const InteractiveModelTutorial: React.FC = () => {
  const {
    isModelTourOpen,
    closeModelTour,
    activeTourStep,
    activeTourModule
  } = useTutorial();
  
  // Wybór Modułu Samouczka: 'schedule' (Grafik), 'tplh' (TPLH Forecast) lub 'settings' (Ustawienia)
  const [moduleMode, setModuleMode] = useState<'schedule' | 'tplh' | 'settings'>(activeTourModule || 'schedule');

  // Krok w danym module (1..6 dla Grafiku, 1..5 dla TPLH, 1..3 dla Ustawień)
  const [tab, setTab] = useState<number>(activeTourStep || 1);

  useEffect(() => {
    if (activeTourModule) setModuleMode(activeTourModule);
    if (activeTourStep) setTab(activeTourStep);
  }, [activeTourStep, activeTourModule]);

  const maxSteps = moduleMode === 'schedule' ? 6 : moduleMode === 'tplh' ? 5 : 6;

  // =========================================================
  // MODUŁ 2 (GRAFIK): STANY SYMULACJI
  // =========================================================
  // Scena 1: Speed-Dial
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState<boolean>(true);
  const [selectedSpeedDialAction, setSelectedSpeedDialAction] = useState<string>('auto_ai');
  const [isAiSubmenuExpanded, setIsAiSubmenuExpanded] = useState<boolean>(true);

  // Scena 2: AutoScheduling AI
  const [aiMode, setAiMode] = useState<'smart_full' | 'fill_gaps'>('smart_full');
  const [aiState, setAiState] = useState<'idle' | 'running' | 'done'>('idle');
  const [aiPermutations, setAiPermutations] = useState<number>(0);
  const [aiProgress, setAiProgress] = useState<number>(0);

  const handleRunAi = (mode: 'smart_full' | 'fill_gaps') => {
    setAiMode(mode);
    setAiState('running');
    setAiPermutations(0);
    setAiProgress(0);

    let count = 0;
    const interval = setInterval(() => {
      count += 1000;
      setAiPermutations(Math.min(20000, count));
      setAiProgress(Math.min(100, (count / 20000) * 100));

      if (count >= 20000) {
        clearInterval(interval);
        setAiState('done');
      }
    }, 25);
  };

  // Scena 3: Asystent Wsparcia & WhatsApp
  const [activeCompromiseIndex, setActiveCompromiseIndex] = useState<number>(0);
  const [copiedMsg, setCopiedMsg] = useState<boolean>(false);
  const [compromiseApplied, setCompromiseApplied] = useState<boolean>(false);

  const compromises = [
    {
      id: 1,
      title: 'Wariant 1: Zamiana z Dawidem (Środa PM ➔ Czwartek PM)',
      desc: 'Dawid przejmuje czwartkowy dyżur PM (14:30–22:30). W zamian otrzymuje wolny piątek OFF (zapewniony pełny odpoczynek 16h).',
      gain: '✓ 11h odpoczynku zachowane • 0 niedogodzin',
      msg: `Cześć Dawid! ☕ W związku z planowaniem grafiku i ograniczeniem 11h odpoczynku po środowym zamknięciu PM, czy możemy zamienić Twój czwartkowy dyżur na PM (14:30–22:30)? W zamian otrzymasz wolny piątek OFF. Daj znać, dzięki! 🙌`
    },
    {
      id: 2,
      title: 'Wariant 2: Przesunięcie na dyżur wsparciowy MIB (09:00–17:00)',
      desc: 'Przesunięcie startu o 2.5h do przodu na 09:00 gwarantuje 10.5h odpoczynku + pokrycie szczytu barowego.',
      gain: '✓ Wzmocnienie baru w szczycie',
      msg: `Cześć! ☕ Czy pasuje Ci przesunięcie czwartkowego dyżuru na godziny 09:00–17:00 (MIB w szczycie)? Zapewni to płynną obsadę i komfortowy odpoczynek po środzie. Daj znać!`
    },
    {
      id: 3,
      title: 'Wariant 3: Wsparcie SUP z innej kawiarni (San Park 756)',
      desc: 'Pobranie menedżera ze wsparcia zewnętrznego na czwartek rano (06:30–15:00) bez obciążania zespołu Janki.',
      gain: '✓ 100% dyspozycyjności własnego zespołu',
      msg: `Dzień dobry! Zgłaszam zapotrzebowanie na wsparcie menedżerskie SUP do kawiarni 108120 Janki na czwartek 06:30–15:00. Czy dysponujecie wolnym menedżerem? Pozdrawiam, SM Janki.`
    }
  ];

  const handleCopyWhatsApp = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  // Scena 4: Popover zmian & Tarcza KP
  const [activeShiftCode, setActiveShiftCode] = useState<string>('AM');
  const [customHours, setCustomHours] = useState<number>(8.0);
  const [customStartTime, setCustomStartTime] = useState<string>('06:30');
  const [customEndTime, setCustomEndTime] = useState<string>('15:00');
  const [showKpViolationAlert, setShowKpViolationAlert] = useState<boolean>(true);

  const handleSelectShift = (code: string, start: string, end: string, h: number) => {
    setActiveShiftCode(code);
    setCustomStartTime(start);
    setCustomEndTime(end);
    setCustomHours(h);

    if (code === 'AM' || (code !== 'PM' && code !== 'OFF' && (start.startsWith('06') || start.startsWith('07') || start.startsWith('08')))) {
      setShowKpViolationAlert(true);
    } else {
      setShowKpViolationAlert(false);
    }
  };

  // Scena 5: Matryca dyspozycji & Smart Paste
  const [dispoGrid, setDispoGrid] = useState<{ [key: string]: string }>({
    'mgr_1_day_5': 'OFF',
    'mgr_1_day_6': 'OFF',
    'mgr_2_day_1': 'AM',
    'mgr_3_day_7': 'PM',
  });
  const [smartPasteActive, setSmartPasteActive] = useState<boolean>(false);

  const handleApplySmartPaste = () => {
    setSmartPasteActive(true);
    setTimeout(() => {
      setDispoGrid({
        'mgr_1_day_5': 'OFF',
        'mgr_1_day_6': 'OFF',
        'mgr_2_day_1': 'AM',
        'mgr_2_day_2': 'AM',
        'mgr_3_day_7': 'PM',
        'mgr_4_day_3': 'OFF',
        'mgr_5_day_5': 'PM',
        'mgr_6_day_6': 'OFF',
        'mgr_7_day_7': 'OFF'
      });
      setSmartPasteActive(false);
    }, 600);
  };

  // Scena 6: TOR
  const [activeTorInspector, setActiveTorInspector] = useState<string>('norm');
  const [torExportDone, setTorExportDone] = useState<boolean>(false);
  const [selectedQuarter, setSelectedQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q3');

  const handleExportTor = () => {
    setTorExportDone(true);
    setTimeout(() => setTorExportDone(false), 2500);
  };

  const torExplanations: { [key: string]: { title: string; desc: string; rule: string; badge: string } } = {
    'norm': {
      title: 'Kolumna: Norma (h) — Wymiar Czasu Pracy KP',
      desc: 'Oficjalny miesięczny wymiar czasu pracy wyliczony wg art. 130 § 2 Kodeksu Pracy. Każde święto państwowe występujące w innym dniu niż niedziela obniża wymiar o 8.0h.',
      rule: 'Norma = (Liczba tygodni × 40h) + (Dni wystające × 8h) - (Święta nie w niedziele × 8h)',
      badge: 'art. 130 § 2 KP'
    },
    'grafik': {
      title: 'Kolumna: Grafik (h) — Zaplanowane Roboczogodziny',
      desc: 'Suma godzin zaplanowanych w miesięcznym grafiku menedżerskim (uwzględnia zmiany dobowe, wsparcia SUP oraz godziny elastyczne).',
      rule: 'Grafik = Σ zaplanowanych dyżurów w danym miesiącu',
      badge: 'Plan Operacyjny'
    },
    'rcp': {
      title: 'Kolumna: RCP (h) — Zabezpieczone Logowania MAPAL',
      desc: 'Rzeczywisty czas pracy pobrany automatycznie z raportu MAPAL Fichajes. Uwzględnia wszystkie kawiarnie w Warszawie (w tym dyżury wsparciowe). Kolumna jest nienaruszalna i zablokowana przed manualną edycją.',
      rule: 'Zabezpieczone dane telemetryczne MAPAL',
      badge: 'MAPAL Fichajes'
    },
    'h': {
      title: 'Kolumna: H (h) — Urlop Wypoczynkowy',
      desc: 'Godziny urlopu wypoczynkowego. Zgodnie z art. 154² § 1 KP urlop udzielany jest wyłącznie w dniach roboczych pracownika. W weekendy i święta wynosi 0.0h.',
      rule: 'Dni robocze = 8.0h × etat pracownika (np. 6.0h dla 0.75). Weekendy = 0.0h.',
      badge: 'art. 154² § 1 KP'
    },
    'l4': {
      title: 'Kolumna: L4 (h) — Zwolnienie Lekarskie',
      desc: 'Chorobowe pracownika. Posiada bezwzględny priorytet nad zaplanowanym urlopem (art. 166 KP). Jeśli pracownik zachoruje w trakcie urlopu, godziny trafiają do L4, a pula urlopu nie zostaje zużyta.',
      rule: 'Pierwszeństwo L4 nad H • Rozliczenie wg wymiaru etatu',
      badge: 'art. 166 KP'
    },
    'balance': {
      title: 'Kolumna: Bilans / Saldo Kwartalne',
      desc: 'Ostateczne rozliczenie menedżera w 3-miesięcznym okresie rozliczeniowym. Wskazuje czy pracownik wypracował nadgodziny, czy wystąpiły niedogodziny wymagające zbilansowania.',
      rule: 'Bilans = (RCP + H + L4) - Norma KP',
      badge: 'Rozliczenie Kwartalne'
    }
  };

  // =========================================================
  // MODUŁ 1 (TPLH FORECAST): STANY SYMULACJI (REALNE DANE 108120 JANKI)
  // =========================================================
  // Scena 1 TPLH: Velocity & HANW
  const [tplhVelocityOption, setTplhVelocityOption] = useState<'high' | 'plan' | 'low'>('high');
  
  // Realny plan AOP kawiarni 108120 Janki (Wrzesień 2026: 10 830 TRX, Cel TPLH: 6.70)
  const aopBaseTrx = 10830;
  const aopTargetTplh = 6.70;
  const aopBaseLabor = Number((aopBaseTrx / aopTargetTplh).toFixed(1)); // 1616.4h

  const dynamicTplhData = React.useMemo(() => {
    let multiplier = 1.0;
    if (tplhVelocityOption === 'high') multiplier = 1.12; // +12% popyt
    if (tplhVelocityOption === 'low') multiplier = 0.90; // -10% spowolnienie

    const projectedTrx = Math.round(aopBaseTrx * multiplier);
    const earnedLaborHours = Number((projectedTrx / aopTargetTplh).toFixed(1));
    const deltaHours = Number((earnedLaborHours - aopBaseLabor).toFixed(1));
    const weeklyBudgetAvg = Number((earnedLaborHours / 4).toFixed(1));

    return {
      projectedTrx,
      earnedLaborHours,
      deltaHours,
      weeklyBudgetAvg,
      multiplier
    };
  }, [tplhVelocityOption]);

  // Scena 2 TPLH: Floor Hours (32h / dzień)
  const [floorSimHours, setFloorSimHours] = useState<number>(32.0);
  const [floorAttemptViolation, setFloorAttemptViolation] = useState<boolean>(false);

  const handleTestFloorCut = (hours: number) => {
    setFloorSimHours(hours);
    if (hours < 32.0) {
      setFloorAttemptViolation(true);
    } else {
      setFloorAttemptViolation(false);
    }
  };

  // Scena 3 TPLH: Flex Pool & Weekend Peak
  const [flexStrategy, setFlexStrategy] = useState<'weekend_boost' | 'flat' | 'cost_saving'>('weekend_boost');

  // Scena 4 TPLH: Manager Labor Bridge
  const [selectedBridgeWeek, setSelectedBridgeWeek] = useState<number>(3);

  // Scena 5 TPLH: Universal Import Auto-Detect
  const [importedReportType, setImportedReportType] = useState<'AOP' | 'MAPAL' | null>('AOP');

  if (!isModelTourOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/60 backdrop-blur-md animate-in fade-in duration-200 select-none font-sans">
      <div className="relative w-full max-w-5xl bg-[#fcfdfc] text-stone-900 rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[96vh]">
        
        {/* HEADER GŁÓWNY Z PRZEŁĄCZNIKIEM MODUŁÓW */}
        <div className="px-6 py-3.5 bg-white border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#006241] shadow-2xs">
              {moduleMode === 'schedule' ? (
                <CalendarDays className="w-5 h-5 text-[#006241]" />
              ) : moduleMode === 'tplh' ? (
                <BarChart3 className="w-5 h-5 text-[#006241]" />
              ) : (
                <Database className="w-5 h-5 text-[#006241]" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-stone-900">
                  {moduleMode === 'schedule'
                    ? 'Symulator Grafiku Managerskiego (Moduł 2)'
                    : moduleMode === 'tplh'
                    ? 'Symulator TPLH Forecast & Labor Balancing (Moduł 1)'
                    : 'Symulator Ustawień, Importu & Bezpieczeństwa SQLite'}
                </h3>
                <span className="text-[10px] px-2.5 py-0.5 font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded-full uppercase tracking-wider">
                  Krok {tab} z {maxSteps}
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium">
                108120 SBX Warszawa Janki • Wizualizacja 1:1 realnego interfejsu aplikacji
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* PRZEŁĄCZNIK 3 MODUŁÓW W SAMOUCZKU */}
            <div className="flex items-center p-1 bg-stone-100 rounded-2xl border border-stone-200">
              <button
                type="button"
                onClick={() => {
                  setModuleMode('schedule');
                  setTab(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  moduleMode === 'schedule'
                    ? 'bg-[#006241] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Grafik Managerski</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModuleMode('tplh');
                  setTab(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  moduleMode === 'tplh'
                    ? 'bg-[#006241] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>TPLH Forecast</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModuleMode('settings');
                  setTab(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  moduleMode === 'settings'
                    ? 'bg-[#006241] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Ustawienia & Import</span>
              </button>
            </div>

            <button
              type="button"
              onClick={closeModelTour}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PASEK ZAKŁADEK DLA AKTYWNEGO MODUŁU */}
        <div className="flex items-center justify-between px-6 py-2 bg-stone-50 border-b border-stone-200 text-xs gap-1.5 overflow-x-auto">
          {moduleMode === 'schedule' ? (
            // Zakładki Modułu 2 (Grafik)
            [
              { id: 1, label: '1. Speed-Dial Starbucks' },
              { id: 2, label: '2. AutoScheduling AI' },
              { id: 3, label: '3. Moduł Wsparcia (SUP)' },
              { id: 4, label: '4. Popover Zmian & Tarcza KP' },
              { id: 5, label: '5. Matryca Dyspozycji' },
              { id: 6, label: '6. Kwartalny TOR' }
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setTab(s.id)}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                  tab === s.id
                    ? 'bg-[#006241] text-white shadow-xs'
                    : s.id < tab
                    ? 'bg-emerald-50 text-[#006241] border border-emerald-200 hover:bg-emerald-100'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                  tab === s.id ? 'bg-white text-[#006241]' : tab > s.id ? 'bg-emerald-200 text-emerald-900' : 'bg-stone-100 text-stone-500'
                }`}>
                  {tab > s.id ? '✓' : s.id}
                </span>
                <span className="text-[11px]">{s.label}</span>
              </button>
            ))
          ) : moduleMode === 'tplh' ? (
            // Zakładki Modułu 1 (TPLH Forecast)
            [
              { id: 1, label: '1. Cel AOP & MTD Velocity' },
              { id: 2, label: '2. Nienaruszalne Floor Hours (32h)' },
              { id: 3, label: '3. Pula Flex & Szczyty Dni' },
              { id: 4, label: '4. Manager Bridge & Pula Baristów' },
              { id: 5, label: '5. Strategie Balansowania Robocizny' }
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setTab(s.id)}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                  tab === s.id
                    ? 'bg-[#006241] text-white shadow-xs'
                    : s.id < tab
                    ? 'bg-emerald-50 text-[#006241] border border-emerald-200 hover:bg-emerald-100'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                  tab === s.id ? 'bg-white text-[#006241]' : tab > s.id ? 'bg-emerald-200 text-emerald-900' : 'bg-stone-100 text-stone-500'
                }`}>
                  {tab > s.id ? '✓' : s.id}
                </span>
                <span className="text-[11px]">{s.label}</span>
              </button>
            ))
          ) : (
            // Zakładki Modułu Ustawień & Narzędzi (6 Scen)
            [
              { id: 1, label: '1. Parametry AOP & Budżet (12 M-cy)' },
              { id: 2, label: '2. Non-Coverage & Floor Hours (32h)' },
              { id: 3, label: '3. Katalog Zmian & Presety Godzin' },
              { id: 4, label: '4. Skład 7 Kierowników & Propagacja' },
              { id: 5, label: '5. Baza Norm KP (252 M-ce / 10 Lat)' },
              { id: 6, label: '6. Import Excel, Kopie SQLite & OTA' }
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setTab(s.id)}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                  tab === s.id
                    ? 'bg-[#006241] text-white shadow-xs'
                    : s.id < tab
                    ? 'bg-emerald-50 text-[#006241] border border-emerald-200 hover:bg-emerald-100'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                  tab === s.id ? 'bg-white text-[#006241]' : tab > s.id ? 'bg-emerald-200 text-emerald-900' : 'bg-stone-100 text-stone-500'
                }`}>
                  {tab > s.id ? '✓' : s.id}
                </span>
                <span className="text-[11px]">{s.label}</span>
              </button>
            ))
          )}
        </div>

        {/* PRZESTRZEŃ INTERAKTYWNEJ SYMULACJI (JASNY MOTYW) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-[#f8faf8]">
          
          {/* ========================================================= */}
          {/* SEKCJA MODUŁU 2: GRAFIK MANAGERSKI (SCENY 1..6)           */}
          {/* ========================================================= */}
          {moduleMode === 'schedule' && tab === 1 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-base font-black text-stone-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#006241]" />
                    <span>Pływające Logo Starbucks — 1:1 Prawdziwy Interfejs Speed-Dial</span>
                  </h4>
                  <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                    Poniżej znajduje się <strong>dokładne odzwierciedlenie okna Speed-Dial z aplikacji</strong>. Kliknij w poszczególne kafelki (<strong>Auto AI, Dyspo, Wsparcie, TOR, Wersje, Eksport</strong>), aby zobaczyć ich dokładną rolę.
                  </p>
                </div>
              </div>

              {/* TŁO SYMULACYJNE Z REALISTYCZNYM SPEED-DIAL (JASNE) */}
              <div className="p-6 bg-gradient-to-br from-[#edf4f0] to-[#e5ede8] rounded-3xl border border-stone-200 min-h-[380px] flex items-center justify-between flex-wrap gap-6 relative overflow-hidden shadow-sm">
                
                {/* Lewa: Panel Wyjaśniający Aktywną Akcję */}
                <div className="p-5 bg-white rounded-3xl border border-stone-200 max-w-md shadow-lg space-y-2.5 z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 rounded-xl text-[#006241] border border-emerald-200">
                      <Info className="w-4 h-4 text-[#006241]" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-stone-900 uppercase tracking-wider block">
                        {selectedSpeedDialAction === 'auto_ai' && '✨ Auto AI (Generator 20 000 prób)'}
                        {selectedSpeedDialAction === 'dispo' && '📋 Dyspo (Matryca Miesiąca & Smart Paste)'}
                        {selectedSpeedDialAction === 'support' && '🤝 Wsparcie (Delegacje Międzykawiarniane)'}
                        {selectedSpeedDialAction === 'tor' && '⚖️ TOR (Kwartalne Rozliczenie Q1–Q4)'}
                        {selectedSpeedDialAction === 'versions' && '📜 Wersje (Publikacja 7 Dni Przed Startem)'}
                        {selectedSpeedDialAction === 'export' && '📊 Eksport do Excela (.xlsx)'}
                        {selectedSpeedDialAction === 'month_nav' && '📅 Nawigacja Miesięcy (LM / MTD / NM)'}
                      </span>
                      <span className="text-[10px] text-[#006241] font-bold">Kliknij kafelek po prawej, aby poznać szczegóły</span>
                    </div>
                  </div>

                  <p className="text-xs text-stone-700 leading-relaxed pt-1">
                    {selectedSpeedDialAction === 'auto_ai' && 'Uruchamia algorytm Monte Carlo (20k prób) bilansujący etaty 7 menedżerów w <150ms z dociążeniem do 100%, zachowaniem Floor Hours 32h/d i limitu max 2 osób w niedziele.'}
                    {selectedSpeedDialAction === 'dispo' && 'Otwiera zbiorczą matrycę preferencji zespołu z obsługą wklejania danych prosto z arkusza Excela (Ctrl+V / Smart Paste).'}
                    {selectedSpeedDialAction === 'support' && 'Asystent delegacji: pozwala oddawać menedżerów na płatne wsparcie do innych lokali (SUP) lub przyjmować wsparcie zewnętrzne.'}
                    {selectedSpeedDialAction === 'tor' && 'Przełącza widok na 3-miesięczne rozliczenie kwartalne z podziałem na Normę KP, Grafik, zabezpieczone RCP z systemu MAPAL, Urlop H i L4.'}
                    {selectedSpeedDialAction === 'versions' && 'Zabezpiecza grafik na 7 dni przed startem (art. 129 § 3 KP) i prowadzi automatyczny rejestr zmian po publikacji.'}
                    {selectedSpeedDialAction === 'export' && 'Pobiera gotowy, sformatowany plik grafiku w formacie Microsoft Excel (.xlsx) ze stylami i formułami.'}
                    {selectedSpeedDialAction === 'month_nav' && 'Płynnie przełącza aktywny miesiąc operacyjny (np. Wrzesień ➔ Październik 2026) bez utraty kontekstu.'}
                  </p>

                  <div className="pt-2.5 flex items-center justify-between border-t border-stone-100">
                    <span className="text-[11px] text-stone-500 font-semibold">Chcesz przetestować tę funkcję?</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedSpeedDialAction === 'auto_ai') setTab(2);
                        if (selectedSpeedDialAction === 'support') setTab(3);
                        if (selectedSpeedDialAction === 'dispo') setTab(5);
                        if (selectedSpeedDialAction === 'tor') setTab(6);
                      }}
                      className="px-3.5 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Przejdź do Sceny ➔</span>
                    </button>
                  </div>
                </div>

                {/* Prawa: 1:1 DOKŁADNE OKNO SPEED-DIAL ZE ZDJĘCIA */}
                <div className="flex flex-col items-end gap-3 z-10">
                  
                  {isSpeedDialOpen && (
                    <div className="w-[300px] bg-white text-stone-900 rounded-[28px] shadow-2xl border border-stone-200/90 p-3.5 space-y-2.5 animate-in slide-in-from-bottom-3 duration-200">
                      
                      {/* 1. GÓRNA NAWIGACJA MIESIĘCY */}
                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedSpeedDialAction('month_nav')}
                          className="w-8 h-8 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center transition cursor-pointer shadow-2xs"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedSpeedDialAction('month_nav')}
                          className="flex-1 py-1.5 px-3 rounded-full bg-[#006241] hover:bg-[#00754A] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer"
                        >
                          <span>Wrzesień 2026</span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedSpeedDialAction('month_nav')}
                          className="w-8 h-8 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center transition cursor-pointer shadow-2xs"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* 2. RZĄD 5 PIONOWYCH MINI-IKONEK ZE ZDJĘCIA */}
                      <div className="grid grid-cols-5 gap-1.5">
                        
                        {/* Auto AI */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSpeedDialAction('auto_ai');
                            setIsAiSubmenuExpanded(!isAiSubmenuExpanded);
                          }}
                          className={`p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                            selectedSpeedDialAction === 'auto_ai'
                              ? 'bg-emerald-50 border-[#006241] text-[#006241] shadow-inner font-bold'
                              : 'bg-white hover:bg-emerald-50/50 border-stone-200 text-stone-700 hover:text-[#006241] shadow-2xs'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-xl bg-emerald-100 text-[#006241] flex items-center justify-center font-bold">
                            <Sparkles className="w-3.5 h-3.5 text-[#006241]" />
                          </div>
                          <span className="text-[9.5px] font-black tracking-tight">Auto AI</span>
                        </button>

                        {/* Dyspo */}
                        <button
                          type="button"
                          onClick={() => setSelectedSpeedDialAction('dispo')}
                          className={`p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                            selectedSpeedDialAction === 'dispo'
                              ? 'bg-amber-50 border-amber-600 text-amber-900 shadow-inner font-bold'
                              : 'bg-white hover:bg-amber-50/60 border-stone-200 text-stone-700 hover:text-amber-900 shadow-2xs'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                            <CalendarCheck className="w-3.5 h-3.5 text-amber-700" />
                          </div>
                          <span className="text-[9.5px] font-bold tracking-tight">Dyspo</span>
                        </button>

                        {/* Wsparcie */}
                        <button
                          type="button"
                          onClick={() => setSelectedSpeedDialAction('support')}
                          className={`p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                            selectedSpeedDialAction === 'support'
                              ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-inner font-bold'
                              : 'bg-white hover:bg-teal-50/70 border-stone-200 text-stone-700 hover:text-teal-900 shadow-2xs'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-teal-700" />
                          </div>
                          <span className="text-[9.5px] font-bold tracking-tight">Wsparcie</span>
                        </button>

                        {/* TOR */}
                        <button
                          type="button"
                          onClick={() => setSelectedSpeedDialAction('tor')}
                          className={`p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                            selectedSpeedDialAction === 'tor'
                              ? 'bg-amber-100/80 border-amber-400 text-amber-950 font-black shadow-inner'
                              : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700 shadow-2xs'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center font-bold">
                            <Scale className="w-3.5 h-3.5 text-[#CBA258]" />
                          </div>
                          <span className="text-[9.5px] font-bold tracking-tight">TOR</span>
                        </button>

                        {/* Wersje */}
                        <button
                          type="button"
                          onClick={() => setSelectedSpeedDialAction('versions')}
                          className={`p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                            selectedSpeedDialAction === 'versions'
                              ? 'bg-amber-50 border-amber-600 text-amber-900 shadow-inner font-bold'
                              : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-700 shadow-2xs'
                          }`}
                        >
                          <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                            <History className="w-3.5 h-3.5 text-amber-800" />
                          </div>
                          <span className="text-[9.5px] font-bold tracking-tight">Wersje</span>
                        </button>
                      </div>

                      {/* ROZWINIĘTE POD-MENU DLA AUTO AI */}
                      {isAiSubmenuExpanded && (
                        <div className="p-2.5 bg-emerald-50/80 rounded-2xl border border-emerald-200 space-y-1.5 animate-in fade-in">
                          <div className="flex items-center justify-between text-[9.5px] font-black uppercase tracking-wider text-[#006241]">
                            <span>Tryby Auto AI (20k prób):</span>
                            <span className="px-1.5 py-0.2 bg-white text-[#006241] rounded-full border border-emerald-200 text-[8.5px]">w tle</span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => { setSelectedSpeedDialAction('auto_ai'); setTab(2); }}
                              className="p-2 rounded-xl bg-white hover:bg-[#006241] hover:text-white border border-emerald-200 text-stone-800 text-left transition cursor-pointer shadow-2xs"
                            >
                              <div className="text-[11px] font-black">🌟 Smart Full</div>
                              <div className="text-[8.5px] text-stone-500 hover:text-emerald-100">Od zera (100%)</div>
                            </button>

                            <button
                              type="button"
                              onClick={() => { setSelectedSpeedDialAction('auto_ai'); setTab(2); }}
                              className="p-2 rounded-xl bg-white hover:bg-[#006241] hover:text-white border border-emerald-200 text-stone-800 text-left transition cursor-pointer shadow-2xs"
                            >
                              <div className="text-[11px] font-black">🧩 Fill Gaps</div>
                              <div className="text-[8.5px] text-stone-500 hover:text-emerald-100">Dopełnij luki</div>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 3. DOLNA BELKA: EKSPORT (.XLSX) I ODŚWIEŻENIE */}
                      <div className="pt-1.5 border-t border-stone-100 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSpeedDialAction('export')}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-[#006241]" />
                          <span>Eksport (.xlsx)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedSpeedDialAction('month_nav')}
                          className="w-8 h-8 rounded-xl bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 flex items-center justify-center transition cursor-pointer shadow-2xs"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PŁYWAJĄCY PRZYCISK ZE ZŁOTYM PIERŚCIENIEM (#CBA258) */}
                  <div
                    onClick={() => setIsSpeedDialOpen(!isSpeedDialOpen)}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-[#003822] via-[#004d33] to-[#041d13] border-2 border-[#CBA258] shadow-xl flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 ring-4 ring-emerald-500/20"
                    title="Kliknij, aby otworzyć/zamknąć Speed-Dial"
                  >
                    <span className="text-2xl">☕</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCENA 2: AUTOSCHEDULING AI (JASNY MOTYW) */}
          {/* ========================================================= */}
          {moduleMode === 'schedule' && tab === 2 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <h4 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#006241]" />
                  <span>AutoScheduling AI — 2 Tryby Generowania i 20 000 Prób</span>
                </h4>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  Silnik sztucznej inteligencji pozwala ułożyć cały miesiąc od zera (<strong>Smart Full</strong>) lub uzupełnić jedynie brakujące luki w istniejącym grafiku (<strong>Fill Gaps</strong>). Przetestuj oba tryby poniżej.
                </p>
              </div>

              <div className="p-5 bg-white rounded-3xl border border-stone-200 space-y-4 shadow-sm">
                
                {/* Przełącznik 2 Trybów (Jasny) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  {/* Tryb 1: Smart Full */}
                  <div
                    onClick={() => { setAiMode('smart_full'); setAiState('idle'); }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      aiMode === 'smart_full'
                        ? 'bg-purple-50/80 border-purple-500 shadow-md ring-1 ring-purple-400/40'
                        : 'bg-stone-50 border-stone-200 hover:border-purple-300 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <strong className="text-sm font-bold text-stone-900 flex items-center gap-2">
                          <span>🌟 Smart Full (Pełne Generowanie)</span>
                        </strong>
                        <span className="text-[10px] px-2.5 py-0.5 bg-purple-100 text-purple-900 font-bold rounded-full border border-purple-200">
                          Od Zera
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                        Układa cały miesiąc od 1. do 30/31. dnia. Dociąża etaty 7 menedżerów do 100.0% (błąd bilansu ±0.9h), pilnuje ochrony Floor Hours (32h/d) oraz twardego limitu max 2 osób w niedziele (AMN + PMN).
                      </p>
                    </div>
                    <div className="text-[10px] text-purple-800 font-bold pt-2 border-t border-purple-200 mt-3">
                      ✓ Najlepsze przy tworzeniu nowego grafiku na kolejny miesiąc
                    </div>
                  </div>

                  {/* Tryb 2: Fill Gaps */}
                  <div
                    onClick={() => { setAiMode('fill_gaps'); setAiState('idle'); }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      aiMode === 'fill_gaps'
                        ? 'bg-emerald-50/80 border-emerald-600 shadow-md ring-1 ring-emerald-400/40'
                        : 'bg-stone-50 border-stone-200 hover:border-emerald-300 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <strong className="text-sm font-bold text-stone-900 flex items-center gap-2">
                          <span>🧩 Fill Gaps (Uzupełnij Luki)</span>
                        </strong>
                        <span className="text-[10px] px-2.5 py-0.5 bg-emerald-100 text-emerald-900 font-bold rounded-full border border-emerald-200">
                          Bezpieczny
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                        Nie narusza dni już ręcznie zaplanowanych przez Store Managera ani zaakceptowanych próśb. Wypełnia wyłącznie puste komórki i brakujące obsady otwarć/zamknięć.
                      </p>
                    </div>
                    <div className="text-[10px] text-emerald-800 font-bold pt-2 border-t border-emerald-200 mt-3">
                      ✓ Idealne przy wprowadzaniu poprawek w trakcie trwającego miesiąca
                    </div>
                  </div>
                </div>

                {/* Strefa Uruchomienia Symulacji AI (Jasna) */}
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleRunAi(aiMode)}
                      disabled={aiState === 'running'}
                      className="px-5 py-2.5 bg-gradient-to-r from-[#006241] to-[#00754A] hover:from-[#00754A] hover:to-[#00875A] text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4 fill-current text-amber-300" />
                      <span>{aiState === 'running' ? 'Kalkulacja...' : '▶ Uruchom Silnik AI (20 000 Prób)'}</span>
                    </button>

                    <div className="text-xs">
                      <span className="text-stone-500 block text-[10px] uppercase font-bold">Zbadane warianty obsady:</span>
                      <strong className="text-sm font-mono text-stone-900 font-black">{aiPermutations.toLocaleString('pl-PL')} / 20 000</strong>
                    </div>
                  </div>

                  {/* Wskaźniki Sukcesu */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="p-2 bg-white rounded-xl border border-stone-200 text-center shadow-2xs">
                      <span className="text-[10px] text-stone-500 block font-semibold">Bilans Etatów</span>
                      <strong className={aiState === 'done' ? 'text-emerald-700 font-bold' : 'text-stone-400'}>
                        {aiState === 'done' ? '100.0% (±0.0h)' : 'Oczekuje...'}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-stone-200 text-center shadow-2xs">
                      <span className="text-[10px] text-stone-500 block font-semibold">Limit Niedziel</span>
                      <strong className={aiState === 'done' ? 'text-emerald-700 font-bold' : 'text-stone-400'}>
                        {aiState === 'done' ? 'Max 2 os. (OK)' : 'Oczekuje...'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Pasek Postępu */}
                <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden p-0.5 border border-stone-200">
                  <div
                    style={{ width: `${aiProgress}%` }}
                    className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-600 rounded-full transition-all duration-75"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCENA 3: MODUŁ WSPARCIA MIĘDZYKAWIARNIANEGO (SUP/SAM/SPM) */}
          {/* ========================================================= */}
          {moduleMode === 'schedule' && tab === 3 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <h4 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-[#006241]" />
                  <span>Moduł Wsparcia Międzykawiarnianego — Wyszukiwarka Zmian SUP / SAM / SPM</span>
                </h4>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  Gdy inna kawiarnia Starbucks w Warszawie (np. <strong>323 Nowy Świat</strong>, <strong>756 San Park</strong>, <strong>341 Sadyba</strong>) zgłasza zapotrzebowanie na menedżera, system automatycznie wyszukuje legalne warianty wydelegowania wsparcia, pilnuje bilansu godzin i generuje gotowe wiadomości WhatsApp.
                </p>
              </div>

              {/* GŁÓWNY FORMULARZ WYSZUKIWANIA WSPARCIA */}
              <div className="p-4 bg-white rounded-2xl border border-stone-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-700">Formularz zapotrzebowania na wsparcie:</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-[#006241] border border-emerald-200 font-bold rounded-md">
                    Inter-Store Engine
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Wybór Kawiarni */}
                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">
                      Kawiarnia prosząca:
                    </label>
                    <select className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-800 font-medium focus:outline-none focus:border-[#006241]">
                      <option>323 Nowy Świat</option>
                      <option>756 San Park Mysiadło</option>
                      <option>341 Sadyba Best Mall</option>
                      <option>327 Westfield Arkadia</option>
                      <option>381 Złote Tarasy</option>
                    </select>
                  </div>

                  {/* Wybór Dnia */}
                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">
                      Dzień zapotrzebowania:
                    </label>
                    <select className="w-full px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-800 font-medium focus:outline-none focus:border-[#006241]">
                      <option>Sobota 19.09 (Szczyt weekendowy)</option>
                      <option>Piątek 18.09 (Popołudnie)</option>
                      <option>Niedziela 20.09 (Handlowa)</option>
                    </select>
                  </div>

                  {/* Wybór Zmiany Wsparcia */}
                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">
                      Wymagana zmiana:
                    </label>
                    <div className="flex items-center gap-1.5">
                      {['SPM (14:30–22:30)', 'SAM (07:00–15:00)', 'SUP (Elast.)'].map((sc, i) => (
                        <span key={i} className={`px-2 py-1.5 rounded-xl text-[10px] font-bold border ${i === 0 ? 'bg-teal-100 text-teal-900 border-teal-300 shadow-2xs' : 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                          {sc.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* WYNIKI WYSZUKIWANIA I PODGLĄD KOMUNIKACJI */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Lewa Kolumna: Znalezione Warianty Wsparcia */}
                <div className="lg:col-span-7 space-y-2.5">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                    Wyniki Wyszukiwania Kandydatów (2 Warianty Bezpieczne Operacyjnie):
                  </span>

                  {compromises.map((c, idx) => (
                    <div
                      key={c.id}
                      onClick={() => { setActiveCompromiseIndex(idx); setCompromiseApplied(false); }}
                      className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-1.5 ${
                        activeCompromiseIndex === idx
                          ? 'bg-teal-50/80 border-teal-600 shadow-md ring-1 ring-teal-400/40'
                          : 'bg-white border-stone-200 hover:border-stone-300 opacity-85'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-xs font-bold text-stone-900">{c.title}</strong>
                        <span className="text-[10px] text-teal-800 font-bold">{c.gain}</span>
                      </div>
                      <p className="text-[11px] text-stone-600 leading-relaxed">{c.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Prawa Kolumna: Wirtualny Telefon z Wiadomością WhatsApp */}
                <div className="lg:col-span-5 p-4 bg-white rounded-2xl border border-stone-200 flex flex-col justify-between space-y-3 shadow-md">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-teal-700" />
                        <span className="text-xs font-bold text-stone-900">Auto-Generowana Wiadomość</span>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 font-bold rounded-md">
                        1-Klik WhatsApp
                      </span>
                    </div>

                    {/* Dymek Wiadomości */}
                    <div className="mt-3 p-3.5 bg-[#e7f8ef] border border-emerald-200 rounded-2xl rounded-tl-none text-xs text-stone-800 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between text-[10px] text-emerald-800 font-bold">
                        <span>Do: Store Manager (323 Nowy Świat)</span>
                        <span>Teraz</span>
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-stone-800 font-sans">
                        {compromises[activeCompromiseIndex].msg}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => handleCopyWhatsApp(compromises[activeCompromiseIndex].msg)}
                      className="w-full py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedMsg ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-teal-200" />
                          <span>Skopiowano do Schowka!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>1-Klik Kopiuj Wiadomość</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setCompromiseApplied(true)}
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                        compromiseApplied
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-400'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      {compromiseApplied ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#006241]" />
                          <span>Wydelegowano wsparcie do grafiku!</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Zatwierdź & Wydeleguj Wsparcie ➔</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCENA 4: POPOVER ZMIAN & PRE-FLIGHT TARCZA KP (JASNY) */}
          {/* ========================================================= */}
          {moduleMode === 'schedule' && tab === 4 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <h4 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#006241]" />
                  <span>Siatka Grafiku, Popover Zmian & Pre-Flight Tarcza Kodeksu Pracy</span>
                </h4>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  Wybór zmiany natychmiast uruchamia <strong>Pre-flight Walidację Kodeksu Pracy</strong>. Wybierz poniżej zmianę dla czwartku, aby zobaczyć jak system blokuje naruszenie 11h odpoczynku dobowego (art. 132 KP).
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Lewa: Siatka 7 Dni Menedżera */}
                <div className="lg:col-span-6 p-4 bg-white rounded-2xl border border-stone-200 space-y-3 shadow-md">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                    Grafik: Dawid Apel (ASM, 1.0 etat) • Środa PM ➔ Czwartek ?
                  </span>

                  <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
                    <div className="p-2 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-[9px] text-stone-400 block font-bold">Pn</span>
                      <strong className="text-xs text-stone-800 block mt-0.5 font-bold">AM</strong>
                      <span className="text-[8px] text-stone-400">06:30</span>
                    </div>

                    <div className="p-2 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-[9px] text-stone-400 block font-bold">Wt</span>
                      <strong className="text-xs text-stone-800 block mt-0.5 font-bold">AM</strong>
                      <span className="text-[8px] text-stone-400">06:30</span>
                    </div>

                    {/* Środa PM (zamknięcie do 22:30) */}
                    <div className="p-2 bg-amber-50 rounded-xl border border-amber-300 shadow-2xs">
                      <span className="text-[9px] text-amber-800 block font-bold">Śr (22:30)</span>
                      <strong className="text-xs text-amber-900 block mt-0.5 font-bold">PM</strong>
                      <span className="text-[8px] text-amber-700">Zamkn.</span>
                    </div>

                    {/* Czwartek — Aktywny w popoverze */}
                    <div className={`p-2 rounded-xl border-2 transition-all cursor-pointer ${
                      showKpViolationAlert
                        ? 'bg-rose-50 border-rose-400 shadow-sm animate-pulse'
                        : 'bg-emerald-50 border-emerald-500 shadow-sm'
                    }`}>
                      <span className="text-[9px] text-stone-600 block font-bold">Czw (Wybrany)</span>
                      <strong className={`text-xs block mt-0.5 font-black ${showKpViolationAlert ? 'text-rose-700' : 'text-[#006241]'}`}>
                        {activeShiftCode}
                      </strong>
                      <span className="text-[8px] text-stone-500 font-semibold">{customStartTime}</span>
                    </div>

                    <div className="p-2 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-[9px] text-stone-400 block font-bold">Pt</span>
                      <strong className="text-xs text-stone-400 block mt-0.5">OFF</strong>
                      <span className="text-[8px] text-stone-400">Wolne</span>
                    </div>

                    <div className="p-2 bg-stone-50 rounded-xl border border-stone-200">
                      <span className="text-[9px] text-stone-400 block font-bold">Sob</span>
                      <strong className="text-xs text-stone-800 block mt-0.5 font-bold">AM</strong>
                      <span className="text-[8px] text-stone-400">07:30</span>
                    </div>

                    <div className="p-2 bg-blue-50/50 rounded-xl border border-blue-200">
                      <span className="text-[9px] text-blue-700 block font-bold">Nd (🛒)</span>
                      <strong className="text-xs text-stone-400 block mt-0.5">OFF</strong>
                      <span className="text-[8px] text-stone-400">Handl.</span>
                    </div>
                  </div>

                  {/* Pre-flight Komunikat Błędu / Zgody (Jasny) */}
                  <div className="pt-2">
                    {showKpViolationAlert ? (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1 text-rose-900">
                        <div className="flex items-center gap-1.5 font-bold text-rose-800">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Naruszenie art. 132 Kodeksu Pracy (Odpoczynek dobowy 11h)</span>
                        </div>
                        <p className="text-[11px] leading-tight text-rose-700">
                          Od środowego zamknięcia o <strong>22:30</strong> do wybranego otwarcia o <strong>{customStartTime}</strong> mija tylko <strong>8.0h</strong>. Wymagane min. 11.0h nieprzerwanego odpoczynku!
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1 text-emerald-900">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                          <ShieldCheck className="w-4 h-4 text-[#006241] shrink-0" />
                          <span>Pełna zgodność z Kodeksem Pracy (16.0h odpoczynku)</span>
                        </div>
                        <p className="text-[11px] leading-tight text-emerald-700">
                          Od zamknięcia o 22:30 do dyżuru popołudniowego o 14:30 pracownik ma zapewniony pełny dobowy odpoczynek.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Prawa: Mock Popovera Wyboru Zmiany (`ShiftPickerPopover`) z WYSZUKIWARKĄ */}
                <div className="lg:col-span-6 p-4 bg-white text-stone-900 rounded-2xl border border-stone-200 shadow-md space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                    <span className="text-xs font-bold text-stone-800">Popover Zmiany (Wybierz dla Czwartku)</span>
                    <span className="text-[10px] text-[#006241] font-mono font-black">{customHours}h ({customStartTime}–{customEndTime})</span>
                  </div>

                  {/* PASEK WYSZUKIWANIA ZMIAN W POPOVERZE */}
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={activeShiftCode === 'AM' || activeShiftCode === 'PM' || activeShiftCode === 'SUP' || activeShiftCode === 'NC' ? '' : activeShiftCode}
                        onChange={(e) => setActiveShiftCode(e.target.value.toUpperCase())}
                        placeholder="🔍 Wyszukaj zmianę (np. AM, PM, SUP, NC, H, L4)..."
                        className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-300 focus:border-[#006241] rounded-xl text-[11px] text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#006241]"
                      />
                    </div>

                    {/* Szybkie Tagi Filtrowania */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[9.5px]">
                      <span className="text-stone-400 font-semibold shrink-0">Filtruj:</span>
                      {[
                        { label: 'Wszystkie', code: 'AM', start: '06:30', end: '15:00', h: 8.0 },
                        { label: 'Otwarcie AM', code: 'AM', start: '06:30', end: '15:00', h: 8.0 },
                        { label: 'Zamknięcie PM', code: 'PM', start: '14:30', end: '22:30', h: 8.0 },
                        { label: 'Wsparcie SUP', code: 'SUP', start: '09:00', end: '17:00', h: 8.0 },
                        { label: 'Admin NC', code: 'NC', start: '08:00', end: '14:00', h: 6.0 },
                        { label: 'Urlop H', code: 'H', start: '—', end: '—', h: 8.0 },
                        { label: 'Chorobowe L4', code: 'L4', start: '—', end: '—', h: 8.0 }
                      ].map((chip, cIdx) => (
                        <button
                          key={cIdx}
                          type="button"
                          onClick={() => handleSelectShift(chip.code, chip.start, chip.end, chip.h)}
                          className={`px-2 py-0.5 rounded-lg font-bold shrink-0 transition-all cursor-pointer border ${
                            activeShiftCode === chip.code
                              ? 'bg-[#006241] text-white border-[#006241]'
                              : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Szybkie Pigułki Zmian */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { code: 'AM', label: 'AM (Otwarcie)', start: '06:30', end: '15:00', h: 8.0 },
                      { code: 'PM', label: 'PM (Zamknięcie)', start: '14:30', end: '22:30', h: 8.0 },
                      { code: 'MID', label: 'MID (Środkowa)', start: '10:00', end: '18:00', h: 8.0 },
                      { code: 'OFF', label: 'OFF (Wolne)', start: '—', end: '—', h: 0.0 },
                      { code: 'H', label: 'H (Urlop)', start: '—', end: '—', h: 8.0 },
                      { code: 'L4', label: 'L4 (Chorobowe)', start: '—', end: '—', h: 8.0 },
                      { code: 'NC', label: 'NC (Admin)', start: '08:00', end: '14:00', h: 6.0 },
                      { code: 'SUP', label: 'SUP (Wsparcie)', start: '09:00', end: '17:00', h: 8.0 }
                    ].map((s) => (
                      <button
                        key={s.code}
                        type="button"
                        onClick={() => handleSelectShift(s.code, s.start, s.end, s.h)}
                        className={`p-2 rounded-xl text-center transition-all cursor-pointer border ${
                          activeShiftCode === s.code
                            ? 'bg-[#006241] text-white border-emerald-700 shadow-md font-bold'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-emerald-600'
                        }`}
                      >
                        <span className="text-xs block font-bold">{s.code}</span>
                        <span className={`text-[8px] block mt-0.5 ${activeShiftCode === s.code ? 'text-emerald-100' : 'text-stone-400'}`}>
                          {s.start}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Regulacja Godzin & Przedziału Od-Do */}
                  <div className="pt-2 border-t border-stone-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500">Dostosuj wymiar godzin:</span>
                      <div className="flex items-center gap-1">
                        {[4.0, 6.0, 8.0, 10.0].map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setCustomHours(h)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                              customHours === h ? 'bg-[#006241] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                          >
                            {h}h
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCENA 5: MATRYCA DYSPOZYCJI & SMART PASTE (JASNY) */}
          {/* ========================================================= */}
          {moduleMode === 'schedule' && tab === 5 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <h4 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#006241]" />
                  <span>Matryca Dyspozycyjności & Smart Paste z Excela</span>
                </h4>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  Zbiorcza matryca pozwala wprowadzać preferencje zespołu klawiszami <kbd className="px-1.5 py-0.5 bg-stone-100 border border-stone-300 rounded font-bold">A</kbd>, <kbd className="px-1.5 py-0.5 bg-stone-100 border border-stone-300 rounded font-bold">P</kbd>, <kbd className="px-1.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 rounded font-bold">O</kbd> (OFF - czerwony badge) lub 1-klikiem wkleić całą tabelę prosto z Excela (Smart Paste).
                </p>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-3 shadow-md">
                
                {/* Belka Narzędzi Matrycy */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-stone-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 font-semibold">Legenda:</span>
                    <span className="px-2 py-0.5 bg-stone-100 text-stone-700 border border-stone-200 rounded-md font-bold text-[10px]">Puste = FULL</span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-bold text-[10px]">A = AM</span>
                    <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md font-bold text-[10px]">P = PM</span>
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-md font-bold text-[10px]">O = OFF (Prośba o wolne)</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplySmartPaste}
                    className="px-3.5 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>{smartPasteActive ? 'Wklejanie danych...' : '📋 Smart Paste z Excela (Ctrl+V)'}</span>
                  </button>
                </div>

                {/* Siatka Matrycy Dyspozycji */}
                <div className="border border-stone-200 rounded-xl overflow-hidden bg-white text-xs">
                  <table className="w-full text-center">
                    <thead className="bg-stone-50 text-[10px] text-stone-500 uppercase font-bold border-b border-stone-200">
                      <tr>
                        <th className="p-2 text-left">Menedżer</th>
                        <th className="p-2">Pn 1</th>
                        <th className="p-2">Wt 2</th>
                        <th className="p-2">Śr 3</th>
                        <th className="p-2">Czw 4</th>
                        <th className="p-2">Pt 5</th>
                        <th className="p-2">Sob 6</th>
                        <th className="p-2">Nd 7</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {[
                        { id: 'mgr_1', name: 'Dawid Apel (ASM)' },
                        { id: 'mgr_2', name: 'Gabriela Kaczmarczyk (SM)' },
                        { id: 'mgr_3', name: 'Zuzanna Bartczak (SSV)' },
                        { id: 'mgr_4', name: 'Weronika Pytlak (SSV)' },
                      ].map((m) => (
                        <tr key={m.id} className="hover:bg-emerald-50/40">
                          <td className="p-2 text-left font-bold text-stone-800">{m.name}</td>
                          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                            const val = dispoGrid[`${m.id}_day_${d}`];
                            return (
                              <td key={d} className="p-1">
                                <div className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center font-bold text-xs ${
                                  val === 'OFF'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs'
                                    : val === 'AM'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : val === 'PM'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-stone-50 text-stone-300 border border-stone-100'
                                }`}>
                                  {val || '—'}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SCENA 6: KWARTALNY TOR — OPIS KAŻDEGO PRZYCISKU I KOLUMNY */}
          {/* ========================================================= */}
          {moduleMode === 'schedule' && tab === 6 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <h4 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-amber-700" />
                  <span>Kwartalne Rozliczenie TOR (Q1–Q4) — Opis Każdego Przycisku i Kolumny</span>
                </h4>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  Trzymiesięczny Okres Rozliczeniowy (TOR) rozlicza normy czasu pracy, zaplanowany grafik, rzeczywiste odbicia RCP z systemu MAPAL oraz urlopy i zwolnienia lekarskie. <strong>Kliknij w dowolny nagłówek kolumny lub przycisk poniżej</strong>, aby poznać jego formułę i podstawę prawną.
                </p>
              </div>

              {/* Panel Wyjaśniający Aktywny Element TOR */}
              <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-300 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <strong className="text-sm font-bold text-amber-950 flex items-center gap-2">
                    <span>{torExplanations[activeTorInspector]?.title}</span>
                  </strong>
                  <span className="text-[10px] px-2.5 py-0.5 bg-amber-200 text-amber-900 font-bold rounded-md border border-amber-300">
                    {torExplanations[activeTorInspector]?.badge}
                  </span>
                </div>
                <p className="text-xs text-stone-700 leading-relaxed">
                  {torExplanations[activeTorInspector]?.desc}
                </p>
                <div className="text-[11px] font-mono text-amber-900 font-bold pt-1 border-t border-amber-200/80">
                  Formuła / Reguła: {torExplanations[activeTorInspector]?.rule}
                </div>
              </div>

              {/* INTERAKTYWNA TABELA TOR 1:1 (JASNA) */}
              <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-3 shadow-md">
                
                {/* Belka Górna TOR: Selektor Kwartału & Przyciski Akcji */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-stone-100 text-xs">
                  <div className="flex items-center gap-1.5">
                    {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setSelectedQuarter(q)}
                        className={`px-3 py-1 rounded-xl font-bold cursor-pointer transition-all ${
                          selectedQuarter === q
                            ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                            : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {q} 2026
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTorInspector('btn_conflict')}
                      className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-100"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>Kolizje RCP vs L4/H</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setActiveTorInspector('btn_export'); handleExportTor(); }}
                      className="px-3.5 py-1 bg-[#006241] hover:bg-[#00754A] text-white font-bold rounded-xl text-[11px] flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>{torExportDone ? 'Wyeksportowano!' : 'Eksport TOR (.xlsx)'}</span>
                    </button>
                  </div>
                </div>

                {/* Siatka Tabeli TOR */}
                <div className="border border-stone-200 rounded-xl overflow-hidden bg-white text-xs overflow-x-auto">
                  <table className="w-full text-right">
                    <thead className="bg-stone-50 text-[10px] text-stone-500 uppercase font-bold border-b border-stone-200">
                      <tr>
                        <th className="p-2.5 text-left">Menedżer</th>
                        <th
                          onClick={() => setActiveTorInspector('norm')}
                          className="p-2.5 text-center cursor-pointer hover:text-amber-800 hover:bg-amber-50 transition-colors"
                        >
                          Norma (h) ℹ️
                        </th>
                        <th
                          onClick={() => setActiveTorInspector('grafik')}
                          className="p-2.5 text-center cursor-pointer hover:text-amber-800 hover:bg-amber-50 transition-colors"
                        >
                          Grafik (h) ℹ️
                        </th>
                        <th
                          onClick={() => setActiveTorInspector('rcp')}
                          className="p-2.5 text-center cursor-pointer hover:text-amber-800 hover:bg-amber-50 transition-colors"
                        >
                          RCP (h) ℹ️
                        </th>
                        <th
                          onClick={() => setActiveTorInspector('h')}
                          className="p-2.5 text-center cursor-pointer hover:text-amber-800 hover:bg-amber-50 transition-colors"
                        >
                          H (h) ℹ️
                        </th>
                        <th
                          onClick={() => setActiveTorInspector('l4')}
                          className="p-2.5 text-center cursor-pointer hover:text-amber-800 hover:bg-amber-50 transition-colors"
                        >
                          L4 (h) ℹ️
                        </th>
                        <th
                          onClick={() => setActiveTorInspector('balance')}
                          className="p-2.5 text-center cursor-pointer hover:text-amber-800 hover:bg-amber-50 transition-colors"
                        >
                          Saldo Kwartału ℹ️
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {[
                        { name: 'Dawid Apel (ASM)', norm: 528.0, plan: 528.0, rcp: 496.0, h: 32.0, l4: 0.0, bal: 0.0, status: 'OK' },
                        { name: 'Gabriela Kaczmarczyk (SM)', norm: 528.0, plan: 530.0, rcp: 530.0, h: 0.0, l4: 0.0, bal: 2.0, status: 'Nadgodziny (+2.0h)' },
                        { name: 'Zuzanna Bartczak (SSV)', norm: 396.0, plan: 396.0, rcp: 360.0, h: 0.0, l4: 36.0, bal: 0.0, status: 'OK' }
                      ].map((row, idx) => (
                        <tr key={idx} className="hover:bg-stone-50">
                          <td className="p-2.5 text-left font-bold text-stone-800">{row.name}</td>
                          <td className="p-2.5 text-center font-mono text-stone-600">{row.norm}h</td>
                          <td className="p-2.5 text-center font-mono text-stone-600">{row.plan}h</td>
                          <td className="p-2.5 text-center font-mono font-bold text-[#006241]">{row.rcp}h</td>
                          <td className="p-2.5 text-center font-mono text-amber-700 font-semibold">{row.h}h</td>
                          <td className="p-2.5 text-center font-mono text-purple-700 font-semibold">{row.l4}h</td>
                          <td className="p-2.5 text-center font-mono font-bold text-emerald-800">
                            {row.bal >= 0 ? `+${row.bal}h` : `${row.bal}h`} ({row.status})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SEKCJA MODUŁU 1: TPLH FORECAST (SCENY 1..5)               */}
          {/* ========================================================= */}

          {/* SCENA 1 TPLH: SILNIK AOP & MTD VELOCITY */}
          {moduleMode === 'tplh' && tab === 1 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <h4 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#006241]" />
                  <span>Silnik Celów AOP & MTD Velocity — Wypracowany Budżet HANW</span>
                </h4>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  System na bieżąco monitoruje tempo sprzedaży kawiarni (<strong>MTD Velocity</strong>) i automatycznie koryguje dopuszczalny budżet robocizny (<strong>HANW</strong>), chroniąc wskaźnik TPLH i odblokowując godziny przy wyższym popycie (Earned Labor). <strong>Przełącz tempo sprzedaży poniżej</strong>, aby zaobserwować dynamiczne przeliczenie.
                </p>
              </div>

              {/* Interaktywny selektor tempa sprzedaży */}
              <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-300 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-black text-stone-900 uppercase tracking-wider">
                    Wybierz Symulowany Scenariusz Popytu:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTplhVelocityOption('high')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        tplhVelocityOption === 'high'
                          ? 'bg-[#006241] text-white shadow-xs'
                          : 'bg-white text-stone-700 border border-stone-200 hover:bg-emerald-100/50'
                      }`}
                    >
                      🔥 Wysoki Popyt (+12% TRX)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTplhVelocityOption('plan')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        tplhVelocityOption === 'plan'
                          ? 'bg-[#006241] text-white shadow-xs'
                          : 'bg-white text-stone-700 border border-stone-200 hover:bg-emerald-100/50'
                      }`}
                    >
                      🎯 Plan AOP (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTplhVelocityOption('low')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        tplhVelocityOption === 'low'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white text-stone-700 border border-stone-200 hover:bg-amber-50'
                      }`}
                    >
                      🌧️ Spowolnienie (-10% TRX)
                    </button>
                  </div>
                </div>

                {/* Dashboard KPI na żywo */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-center">
                  <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] text-stone-500 font-bold uppercase block">Prognoza Miesiąca (TRX)</span>
                    <strong className="text-sm font-black text-stone-900">
                      {dynamicTplhData.projectedTrx.toLocaleString('pl-PL')}
                    </strong>
                    <span className={`text-[10px] block font-semibold ${
                      tplhVelocityOption === 'high' ? 'text-[#006241]' : tplhVelocityOption === 'low' ? 'text-amber-700' : 'text-stone-500'
                    }`}>
                      {tplhVelocityOption === 'high' ? '+12% vs Plan' : tplhVelocityOption === 'low' ? '-10% vs Plan' : '100% Plan AOP'}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] text-stone-500 font-bold uppercase block">Cel TPLH Lokalu</span>
                    <strong className="text-sm font-black text-[#006241]">
                      {aopTargetTplh.toFixed(2)}
                    </strong>
                    <span className="text-[10px] text-stone-400 block">Nienaruszalna norma</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] text-stone-500 font-bold uppercase block">Wypracowany Budżet (HANW)</span>
                    <strong className="text-sm font-black text-[#006241]">
                      {dynamicTplhData.earnedLaborHours} h
                    </strong>
                    <span className={`text-[10px] block font-bold ${
                      dynamicTplhData.deltaHours > 0 ? 'text-[#006241]' : dynamicTplhData.deltaHours < 0 ? 'text-amber-700' : 'text-stone-500'
                    }`}>
                      {dynamicTplhData.deltaHours > 0 ? `+${dynamicTplhData.deltaHours}h na grafik` : `${dynamicTplhData.deltaHours}h`}
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-stone-200 shadow-2xs">
                    <span className="text-[10px] text-stone-500 font-bold uppercase block">Średni Tydzień (h)</span>
                    <strong className="text-sm font-black text-stone-900">
                      {dynamicTplhData.weeklyBudgetAvg} h
                    </strong>
                    <span className="text-[10px] text-stone-400 block">4 tygodnie rozliczeniowe</span>
                  </div>
                </div>

                {/* Objaśnienie reguły Earned Labor */}
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-200 text-xs text-stone-700 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#006241] shrink-0 mt-0.5" />
                  <div>
                    <strong>Zasada Earned Labor:</strong> Gdy kawiarnia sprzedaje więcej niż plan AOP (np. w sezonie letnim), system natychmiast przelicza nadwyżkę na dodatkowy budżet godzin na grafik. Zapobiega to przeciążeniu zespołu i spadkom Customer Connection Score!
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCENA 2 TPLH: NIENARUSZALNE FLOOR HOURS (32H/DZIEŃ) */}
          {moduleMode === 'tplh' && tab === 2 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <h4 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#006241]" />
                  <span>Nienaruszalne Floor Hours (32.0 h / dzień = 224.0 h / tydzień)</span>
                </h4>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  Każda kawiarnia Starbucks posiada nienaruszalną bazę bezpieczeństwa i standardów operacyjnych. Poniżej tej wartości lokal nie może bezpiecznie funkcjonować.
                </p>
              </div>

              {/* Interaktywny symulator dobowego składu */}
              <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-4 shadow-sm">
                
                {/* Rozbicie składu 32h */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-300 rounded-2xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-950 uppercase">☀️ Zmiana Poranna (AM)</span>
                      <span className="text-xs font-black text-[#006241] font-mono">16.0 h</span>
                    </div>
                    <p className="text-xs text-stone-600">
                      • 1x Kierownik Zmiany (SSV / SM / ASM) = <strong>8.0h</strong>
                      <br />• 1x Barista Otwarcia & Baru = <strong>8.0h</strong>
                    </p>
                  </div>

                  <div className="p-3.5 bg-emerald-50/70 border border-emerald-300 rounded-2xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-950 uppercase">🌙 Zmiana Wieczorna (PM)</span>
                      <span className="text-xs font-black text-[#006241] font-mono">16.0 h</span>
                    </div>
                    <p className="text-xs text-stone-600">
                      • 1x Kierownik Zmiany (SSV / SM / ASM) = <strong>8.0h</strong>
                      <br />• 1x Barista Zamknięcia & Clean Play = <strong>8.0h</strong>
                    </p>
                  </div>
                </div>

                {/* Interaktywny test obniżenia obsady */}
                <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-stone-800">
                      Przetestuj próbę obniżenia obsady dobowej:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[32.0, 28.0, 24.0].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => handleTestFloorCut(h)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            floorSimHours === h
                              ? h < 32 ? 'bg-rose-600 text-white font-black' : 'bg-[#006241] text-white font-black'
                              : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          {h === 32.0 ? '32.0h (Baza Floor)' : `${h.toFixed(1)}h (Próba cięcia)`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {floorAttemptViolation ? (
                    <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-950 space-y-1 animate-in zoom-in-95 duration-200">
                      <div className="flex items-center gap-1.5 font-black text-rose-700">
                        <AlertTriangle className="w-4 h-4" />
                        <span>⛔ BLOKADA TARCZY BEZPIECZEŃSTWA STARBUCKS (FLOOR HOURS VIOLATION)</span>
                      </div>
                      <p className="leading-relaxed">
                        Próba zaplanowania lokalu poniżej <strong>32.0 h / dzień (224.0 h / tydzień)</strong> narusza zasady bezpieczeństwa (Single Coverage Risk) oraz standardy Customer Connection. System automatycznie przywraca minimum Floor!
                      </p>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-[#006241] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Obsada spełnia w 100% nienaruszalną normę Floor Hours kawiarni 108120 Janki.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SCENA 3 TPLH: PULA FLEX & SZCZYTY DNI */}
          {moduleMode === 'tplh' && tab === 3 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <h4 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-amber-700" />
                  <span>Pula Flex & Dociążenie Weekendów (Soboty ~57h, Piątki ~48h)</span>
                </h4>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  Każda godzina wypracowana ponad bazę Floor (<strong>Pula Flex = HANW − 224h</strong>) jest inteligentnie dystrybuowana na dni o najwyższym wolumenie transakcji.
                </p>
              </div>

              {/* Dystrybucja dobowych godzin */}
              <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-4 shadow-sm">
                
                {/* Wybór strategii dystrybucji */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-bold text-stone-800">Profil Dystrybucji Puli Flex:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFlexStrategy('weekend_boost')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        flexStrategy === 'weekend_boost'
                          ? 'bg-[#006241] text-white shadow-xs'
                          : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      🌟 Weekend Peak (Zalecana)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlexStrategy('flat')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        flexStrategy === 'flat'
                          ? 'bg-[#006241] text-white shadow-xs'
                          : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      ⚖️ Płaska (Równomierna)
                    </button>
                  </div>
                </div>

                {/* Wizualizacja słupkowa 7 dni */}
                <div className="grid grid-cols-7 gap-2 pt-1 text-center">
                  {[
                    { day: 'Pon', hours: flexStrategy === 'weekend_boost' ? 32 : 36, flex: flexStrategy === 'weekend_boost' ? 0 : 4, isPeak: false },
                    { day: 'Wt', hours: flexStrategy === 'weekend_boost' ? 32 : 36, flex: flexStrategy === 'weekend_boost' ? 0 : 4, isPeak: false },
                    { day: 'Śr', hours: flexStrategy === 'weekend_boost' ? 34 : 36, flex: flexStrategy === 'weekend_boost' ? 2 : 4, isPeak: false },
                    { day: 'Czw', hours: flexStrategy === 'weekend_boost' ? 36 : 36, flex: flexStrategy === 'weekend_boost' ? 4 : 4, isPeak: false },
                    { day: 'Pt', hours: flexStrategy === 'weekend_boost' ? 48 : 38, flex: flexStrategy === 'weekend_boost' ? 16 : 6, isPeak: true },
                    { day: 'Sob', hours: flexStrategy === 'weekend_boost' ? 57 : 42, flex: flexStrategy === 'weekend_boost' ? 25 : 10, isPeak: true },
                    { day: 'Nd', hours: flexStrategy === 'weekend_boost' ? 32 : 36, flex: flexStrategy === 'weekend_boost' ? 0 : 4, isPeak: false },
                  ].map((d, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                        d.isPeak && flexStrategy === 'weekend_boost'
                          ? 'bg-emerald-50 border-emerald-300 shadow-2xs'
                          : 'bg-stone-50 border-stone-200'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-stone-500 uppercase">{d.day}</span>
                      <div className="my-2">
                        <strong className={`text-sm font-black ${
                          d.isPeak && flexStrategy === 'weekend_boost' ? 'text-[#006241]' : 'text-stone-800'
                        }`}>
                          {d.hours}h
                        </strong>
                        <span className="text-[9px] block text-stone-400 font-mono">
                          Floor: 32h
                        </span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold ${
                        d.flex > 0 ? 'bg-amber-100 text-amber-900' : 'bg-stone-200 text-stone-500'
                      }`}>
                        +{d.flex}h Flex
                      </span>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600">
                  💡 <strong>Wskazówka SM:</strong> W soboty kawiarnia generuje do 35% całotygodniowego wolumenu napojów. Dociążenie do 57h zapewnia 3 baristów na barze i eliminuje kolejki w godzinach szczytu.
                </div>
              </div>
            </div>
          )}

          {/* SCENA 4 TPLH: MANAGER LABOR BRIDGE */}
          {moduleMode === 'tplh' && tab === 4 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <h4 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-[#006241]" />
                  <span>Manager Labor Bridge — Pula Baristów (HANW − H_MGR = BAR)</span>
                </h4>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  Mostek automatycznie pobiera zaplanowane dyżury kierowników z Modułu 2 i wylicza dokładną pulę godzin pozostałą do ułożenia dla zespołu Baristów.
                </p>
              </div>

              {/* Interaktywny Mostek */}
              <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-3.5 shadow-sm">
                
                {/* Selektor Tygodnia */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-stone-100">
                  <span className="text-xs font-bold text-stone-800">Tydzień Planowania (W1–W5):</span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setSelectedBridgeWeek(w)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          selectedBridgeWeek === w
                            ? 'bg-[#006241] text-white shadow-xs'
                            : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        Tydzień W{w}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wizualizacja mostka matematycznego */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                    <span className="text-[10px] text-stone-500 font-bold uppercase block">1. Cel Tygodnia (HANW)</span>
                    <strong className="text-lg font-black text-stone-900 font-mono">404.0 h</strong>
                    <span className="text-[10px] text-stone-400 block">Wypracowany budżet tygodnia</span>
                  </div>

                  <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-300">
                    <span className="text-[10px] text-amber-900 font-bold uppercase block">2. Grafik Kierowników (H_MGR)</span>
                    <strong className="text-lg font-black text-amber-900 font-mono">176.0 h</strong>
                    <span className="text-[10px] text-amber-700 block">22 dyżury kierownicze z Modułu 2</span>
                  </div>

                  <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-300">
                    <span className="text-[10px] text-[#006241] font-bold uppercase block">3. Dostępna Pula Baristów (BAR)</span>
                    <strong className="text-lg font-black text-[#006241] font-mono">228.0 h</strong>
                    <span className="text-[10px] text-emerald-700 block font-semibold">Do rozpisania dla ~6 baristów</span>
                  </div>
                </div>

                {/* Formuła */}
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-stone-700 flex items-center justify-between font-mono">
                  <span>Pula Baristów = 404.0h (HANW) − 176.0h (MGR)</span>
                  <strong className="text-[#006241] font-black">= 228.0 h</strong>
                </div>
              </div>
            </div>
          )}

          {/* SCENA 5 TPLH: STRATEGIE BALANSOWANIA ROBOCIZNY & AI TREND INTELLIGENCE */}
          {moduleMode === 'tplh' && tab === 5 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <h4 className="text-base font-black text-stone-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#006241]" />
                  <span>Strategie Balansowania Robocizny & AI Trend Intelligence</span>
                </h4>
                <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                  Silnik uczenia maszynowego analizuje trendy sprzedaży z 89 tygodni i sugeruje Store Managerowi 3 gotowe strategie planowania robocizny w zależności od priorytetu kawiarni.
                </p>
              </div>

              {/* 3 Interaktywne Strategie */}
              <div className="p-4 bg-white rounded-2xl border border-stone-200 space-y-4 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  
                  {/* Strategia 1: Floor-Safe */}
                  <div
                    onClick={() => setFlexStrategy('cost_saving')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      flexStrategy === 'cost_saving'
                        ? 'bg-blue-50/90 border-blue-600 shadow-md ring-1 ring-blue-400/40'
                        : 'bg-stone-50 border-stone-200 hover:border-blue-300 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-stone-900">🛡️ Floor-Safe</span>
                        <span className="text-[9px] px-2 py-0.5 bg-blue-100 text-blue-900 font-bold rounded-md">
                          Ochrona TPLH
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 mt-1.5 leading-relaxed">
                        Sztywne trzymanie bazy 32h/d w dni powszednie. Pula flex ograniczona do &le; 8h/tydzień. Zabezpiecza cel TPLH 6.70 w miesiącach o niższym popycie.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-blue-200 text-[10px] text-blue-900 font-bold">
                      Prognoza TPLH: 6.85 • Ryzyko nadgodzin: 0%
                    </div>
                  </div>

                  {/* Strategia 2: Balanced (Domyślna) */}
                  <div
                    onClick={() => setFlexStrategy('weekend_boost')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      flexStrategy === 'weekend_boost'
                        ? 'bg-emerald-50/90 border-[#006241] shadow-md ring-1 ring-emerald-400/40'
                        : 'bg-stone-50 border-stone-200 hover:border-emerald-300 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-stone-900">⚖️ Balanced (Optimum)</span>
                        <span className="text-[9px] px-2 py-0.5 bg-emerald-200 text-emerald-900 font-bold rounded-md">
                          Zalecana
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 mt-1.5 leading-relaxed">
                        Dynamiczne przeliczanie MTD Velocity. Dociążenie Sobót do 85h i Piątków do 68h przy bazie 32h od poniedziałku do czwartku.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-emerald-200 text-[10px] text-[#006241] font-bold">
                      Prognoza TPLH: 6.70 • Customer Connection: Max
                    </div>
                  </div>

                  {/* Strategia 3: Growth */}
                  <div
                    onClick={() => setFlexStrategy('flat')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                      flexStrategy === 'flat'
                        ? 'bg-amber-50/90 border-amber-600 shadow-md ring-1 ring-amber-400/40'
                        : 'bg-stone-50 border-stone-200 hover:border-amber-300 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-stone-900">🚀 Growth (Wzrost)</span>
                        <span className="text-[9px] px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded-md">
                          Wysoki Popyt
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 mt-1.5 leading-relaxed">
                        Maksymalna obsada barowa w szczytach letnich/promocyjnych (+15h flex/tydzień). Pełna eliminacja kolejek i obsługa każdego klienta.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-amber-200 text-[10px] text-amber-900 font-bold">
                      Prognoza TPLH: 6.55 • Maksymalizacja Wolumenu
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-stone-700 flex items-center justify-between">
                  <span className="font-medium">
                    Wybrana strategia: <strong>{flexStrategy === 'weekend_boost' ? '⚖️ Balanced (Optimum Weekend Peak)' : flexStrategy === 'cost_saving' ? '🛡️ Floor-Safe (Ochrona TPLH)' : '🚀 Growth (Wzrost Sprzedaży)'}</strong>
                  </span>
                  <span className="text-[11px] font-bold text-[#006241]">
                    Aktywna w kawiarni 108120 Janki ✓
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SEKCJA MODUŁU 3: USTAWIENIA & BAZA DANYCH (SCENY 1..3)     */}
          {/* ========================================================= */}

          {/* ========================================================= */}
          {/* SEKCJA MODUŁU 3: USTAWIENIA & NARZĘDZIA (6 PEŁNYCH SCEN)  */}
          {/* ========================================================= */}

          {/* ========================================================= */}
          {/* SEKCJA MODUŁU 3: USTAWIENIA & BAZA DANYCH (ODWZOROWANIE 1:1) */}
          {/* ========================================================= */}
          {moduleMode === 'settings' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              {/* NAGŁÓWEK SCENY SAMOUCZEKA */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-base font-black text-stone-900 flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-[#006241]" />
                    <span>
                      {tab === 1 && 'Scena 1/6: Budżety AOP & Cel Wydajności TPLH (12 Miesięcy)'}
                      {tab === 2 && 'Scena 2/6: Zadania Stałe, Pakiety Non-Coverage (NC) & Floor Hours'}
                      {tab === 3 && 'Scena 3/6: Katalog Zmian Starbucks, Presety Godzinowe & Reguła Niedzieli'}
                      {tab === 4 && 'Scena 4/6: Autonomiczny Skład 7 Menedżerów, Etaty & Auto-Propagacja'}
                      {tab === 5 && 'Scena 5/6: Baza Norm Kodeksu Pracy (252 Miesiące / 10 Lat art. 130 KP)'}
                      {tab === 6 && 'Scena 6/6: System, Universal Report Auto-Detect, Kopie SQLite & OTA'}
                    </span>
                  </h4>
                  <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                    Poniżej znajduje się aktywne, w 100% wierne odwzorowanie okna <strong>Centrum Konfiguracji & Parametrów Operacyjnych</strong>. Możesz przełączać zakładki po lewej stronie oraz testować parametry.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-bold text-[#006241]">
                  <Store className="w-3.5 h-3.5 text-[#CBA258]" />
                  <span>Lokal: 108120 Janki</span>
                </div>
              </div>

              {/* RAMA OKNA USTAWIEŃ 1:1 */}
              <div className="rounded-2xl border border-stone-300 shadow-md bg-white overflow-hidden">
                
                {/* 1. GÓRNA BELKA MODALU (STARBUCKS GREEN) */}
                <div className="bg-[#006241] text-white px-5 py-3.5 flex items-center justify-between select-none">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                      <Sliders className="w-4 h-4 text-emerald-200" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black tracking-wide uppercase flex items-center gap-2">
                        <span>Centrum Konfiguracji & Parametrów Operacyjnych</span>
                        <span className="text-[10px] px-2 py-0.5 bg-[#CBA258] text-[#1E3932] font-black rounded-full">
                          108120 Janki
                        </span>
                      </h3>
                      <p className="text-[10px] text-emerald-100 font-medium">
                        Starbucks Operations Suite • Podgląd Aktywnych Reguł Systemowych
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 text-xs">
                    <span className="px-2 py-0.5 bg-white/10 rounded-md text-[10px] font-mono font-bold text-emerald-200">
                      v2.8.27
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-emerald-200 opacity-60">
                      <X className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* 2. GŁÓWNY UKŁAD 2-KOLUMNOWY (SIDEBAR + CONTENT) */}
                <div className="flex flex-col md:flex-row min-h-[440px]">
                  
                  {/* LEWY PASEK BOCZNY (SIDEBAR 1:1) */}
                  <div className="w-full md:w-60 bg-stone-50 border-r border-stone-200 p-3 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-stone-400">
                        Moduły Operacyjne
                      </div>

                      {/* TAB 1: TPLH & AOP */}
                      <button
                        type="button"
                        onClick={() => setTab(1)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                          tab === 1 || tab === 2
                            ? 'bg-[#006241] text-white shadow-xs'
                            : 'text-stone-700 hover:bg-stone-200/70'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <BarChart3 className={`w-3.5 h-3.5 ${tab === 1 || tab === 2 ? 'text-white' : 'text-[#006241]'}`} />
                          <span>TPLH & AOP / NC</span>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          tab === 1 || tab === 2 ? 'bg-emerald-900 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {tab === 1 ? 'AOP' : tab === 2 ? 'NC' : 'W1'}
                        </span>
                      </button>

                      {/* TAB 2: Grafik & Zmiany */}
                      <button
                        type="button"
                        onClick={() => setTab(3)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                          tab === 3 || tab === 4 || tab === 5
                            ? 'bg-[#006241] text-white shadow-xs'
                            : 'text-stone-700 hover:bg-stone-200/70'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <CalendarDays className={`w-3.5 h-3.5 ${tab === 3 || tab === 4 || tab === 5 ? 'text-white' : 'text-[#006241]'}`} />
                          <span>Grafik & Zmiany</span>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          tab === 3 ? 'Zmiany' : tab === 4 ? 'Zespół' : tab === 5 ? 'Normy' : 'W2'
                        }`}>
                          {tab === 3 || tab === 4 || tab === 5 ? 'Aktywny' : 'KP'}
                        </span>
                      </button>

                      {/* TAB 3: Szkolenia & Standardy */}
                      <div className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-stone-400 bg-stone-100/50 cursor-not-allowed">
                        <div className="flex items-center space-x-2">
                          <GraduationCap className="w-3.5 h-3.5 text-stone-400" />
                          <span>Szkolenia (T1–T10)</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono bg-stone-200 text-stone-600">
                          v1.0
                        </span>
                      </div>

                      {/* TAB 4: COL P&L & Stawki */}
                      <div className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-stone-400 bg-stone-100/50 cursor-not-allowed">
                        <div className="flex items-center space-x-2">
                          <Calculator className="w-3.5 h-3.5 text-stone-400" />
                          <span>COL P&L & ZUS</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono bg-stone-200 text-stone-600">
                          19.48%
                        </span>
                      </div>

                      {/* TAB 5: Baza & Kawiarnia */}
                      <div className="pt-2">
                        <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-stone-400">
                          System & Kawiarnia
                        </div>
                        <button
                          type="button"
                          onClick={() => setTab(6)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                            tab === 6
                              ? 'bg-[#006241] text-white shadow-xs'
                              : 'text-stone-700 hover:bg-stone-200/70'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <Database className={`w-3.5 h-3.5 ${tab === 6 ? 'text-white' : 'text-[#006241]'}`} />
                            <span>Baza & Import</span>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            tab === 6 ? 'bg-emerald-900 text-emerald-200' : 'bg-stone-200 text-stone-600'
                          }`}>
                            SQLite
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* STOPKA LEWEGO PASKA */}
                    <div className="p-2.5 bg-white rounded-xl border border-stone-200 text-[10px] text-stone-500 space-y-0.5">
                      <div className="font-bold text-stone-800 flex items-center gap-1">
                        <Store className="w-3 h-3 text-[#CBA258]" />
                        108120 Warszawa Janki
                      </div>
                      <div>Baza: SQLite (WASM Local)</div>
                      <div className="text-[#006241] font-bold">Wszystkie reguły zsynchronizowane ✓</div>
                    </div>
                  </div>

                  {/* PRAWA SEKCJA ROBOCZA (TREŚĆ ZAKŁADKI 1:1) */}
                  <div className="flex-1 p-4 bg-white overflow-y-auto space-y-4">
                    
                    {/* WIDOK DLA SCENY 1: AOP (12 MIESIĘCY) */}
                    {tab === 1 && (
                      <div className="space-y-3.5 animate-in fade-in duration-200">
                        {/* Sub-zakładki TPLH */}
                        <div className="flex items-center justify-between border-b border-stone-200 pb-2.5 flex-wrap gap-2">
                          <div className="flex items-center space-x-1.5 bg-stone-100 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setTab(1)}
                              className="px-3 py-1 bg-white text-[#006241] font-bold text-xs rounded-lg shadow-2xs cursor-pointer"
                            >
                              Budżety AOP (2021–2036)
                            </button>
                            <button
                              type="button"
                              onClick={() => setTab(2)}
                              className="px-3 py-1 text-stone-600 hover:text-stone-900 font-bold text-xs rounded-lg cursor-pointer"
                            >
                              Zadania Stałe & Non-Coverage (NC)
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-emerald-100 text-[#006241] font-bold rounded-lg text-xs">
                              Rok AOP: 2026
                            </span>
                            <div className="px-3 py-1 bg-[#006241] text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-1">
                              <Save className="w-3.5 h-3.5" />
                              <span>Zapisz AOP</span>
                            </div>
                          </div>
                        </div>

                        {/* Pasek Masowej Zmiany TPLH */}
                        <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#006241]" />
                            <span className="font-bold text-stone-800">Masowe TPLH dla wszystkich miesięcy:</span>
                            <span className="px-2 py-0.5 bg-white border border-stone-300 font-mono font-black text-[#006241] rounded">
                              6.70
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-800 font-semibold">
                            Wzór: Godziny = Transakcje (TRX) / Cel TPLH
                          </span>
                        </div>

                        {/* Tabela 12 Miesięcy AOP 1:1 */}
                        <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200 text-[11px]">
                                <th className="p-2">Miesiąc</th>
                                <th className="p-2 text-center">Tyg.</th>
                                <th className="p-2 text-right">Plan TRX</th>
                                <th className="p-2 text-center">Cel TPLH</th>
                                <th className="p-2 text-right">Plan Sprzedaży</th>
                                <th className="p-2 text-right text-[#006241]">Budżet Robocizny</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 text-[11px] font-mono">
                              {[
                                { m: 'Lipiec', w: 5, trx: 11200, tplh: 6.80, sales: 215000, h: 1647.1, curr: false },
                                { m: 'Sierpień', w: 4, trx: 11050, tplh: 6.80, sales: 210000, h: 1625.0, curr: false },
                                { m: 'Wrzesień', w: 5, trx: 10830, tplh: 6.70, sales: 205800, h: 1616.4, curr: true },
                                { m: 'Październik', w: 4, trx: 10900, tplh: 6.70, sales: 208000, h: 1626.9, curr: false },
                                { m: 'Listopad', w: 4, trx: 11400, tplh: 6.75, sales: 218500, h: 1688.9, curr: false },
                                { m: 'Grudzień', w: 5, trx: 13500, tplh: 7.10, sales: 265000, h: 1901.4, curr: false },
                              ].map((row, i) => (
                                <tr key={i} className={row.curr ? 'bg-emerald-50/90 font-bold' : 'hover:bg-stone-50'}>
                                  <td className="p-2 font-sans font-bold flex items-center gap-1.5">
                                    <span className={row.curr ? 'text-[#006241]' : 'text-stone-800'}>{row.m} 2026</span>
                                    {row.curr && <span className="px-1.5 py-0.2 bg-[#006241] text-white text-[9px] rounded font-bold">MTD</span>}
                                  </td>
                                  <td className="p-2 text-center text-stone-500">{row.w} tyg.</td>
                                  <td className="p-2 text-right text-stone-900 font-bold">{row.trx.toLocaleString('pl-PL')}</td>
                                  <td className="p-2 text-center">
                                    <span className="px-1.5 py-0.5 bg-white border border-stone-200 rounded font-black text-stone-800">
                                      {row.tplh.toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="p-2 text-right text-stone-600">{row.sales.toLocaleString('pl-PL')} zł</td>
                                  <td className="p-2 text-right text-[#006241] font-black">{row.h.toFixed(1)} h</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* WIDOK DLA SCENY 2: NON-COVERAGE & FLOOR HOURS */}
                    {tab === 2 && (
                      <div className="space-y-3.5 animate-in fade-in duration-200">
                        {/* Sub-zakładki TPLH */}
                        <div className="flex items-center justify-between border-b border-stone-200 pb-2.5 flex-wrap gap-2">
                          <div className="flex items-center space-x-1.5 bg-stone-100 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setTab(1)}
                              className="px-3 py-1 text-stone-600 hover:text-stone-900 font-bold text-xs rounded-lg cursor-pointer"
                            >
                              Budżety AOP (2021–2036)
                            </button>
                            <button
                              type="button"
                              onClick={() => setTab(2)}
                              className="px-3 py-1 bg-white text-[#006241] font-bold text-xs rounded-lg shadow-2xs cursor-pointer"
                            >
                              Zadania Stałe & Non-Coverage (NC)
                            </button>
                          </div>

                          <div className="px-3 py-1 bg-emerald-100 text-[#006241] font-bold text-xs rounded-lg">
                            Suma Pakietów: 50.0 h / miesiąc
                          </div>
                        </div>

                        {/* Tabela Reguł Non-Coverage 1:1 */}
                        <div className="border border-stone-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200 text-[11px]">
                                <th className="p-2">Zadanie / Pakiet NC</th>
                                <th className="p-2">Kategoria</th>
                                <th className="p-2 text-right">Miesięczny Limit</th>
                                <th className="p-2 text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 text-[11px]">
                              {[
                                { name: 'Administracja Store Managera (SM)', cat: 'Zarządzanie', h: '20.0 h', mand: true },
                                { name: 'Szkolenia Baristyczne & Onboarding', cat: 'Rozwój Załogi', h: '12.0 h', mand: true },
                                { name: 'Inwentaryzacja Miesięczna & Audyt', cat: 'Operacje', h: '6.0 h', mand: true },
                                { name: 'Zebranie Załogi Kawiarni Janki', cat: 'Zespół', h: '4.0 h', mand: true },
                                { name: 'Głębokie Czyszczenie (Deep Clean)', cat: 'Czystość / Serwis', h: '8.0 h', mand: true },
                              ].map((nc, idx) => (
                                <tr key={idx} className="hover:bg-stone-50">
                                  <td className="p-2 font-bold text-stone-900">{nc.name}</td>
                                  <td className="p-2 text-stone-500">{nc.cat}</td>
                                  <td className="p-2 text-right font-mono font-black text-[#006241]">{nc.h}</td>
                                  <td className="p-2 text-center">
                                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold">
                                      Stały Pakiet ✓
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Karta Floor Hours 32h */}
                        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                          <div>
                            <strong className="text-stone-900 block">Nienaruszalna Baza Floor Hours (Obsada Bezpieczeństwa):</strong>
                            <span className="text-stone-600 text-[11px]">32.0 h / dzień (1 MGR + 1 Barista rano i wieczorem = 224.0 h / tydzień)</span>
                          </div>
                          <span className="px-2.5 py-1 bg-emerald-50 text-[#006241] border border-emerald-300 rounded-lg font-black font-mono">
                            32.0 h / doba
                          </span>
                        </div>
                      </div>
                    )}

                    {/* WIDOK DLA SCENY 3: KATALOG ZMIAN & GODZINY ELASTYCZNE */}
                    {tab === 3 && (
                      <div className="space-y-3.5 animate-in fade-in duration-200">
                        {/* Sub-zakładki Grafiku */}
                        <div className="flex items-center justify-between border-b border-stone-200 pb-2.5 flex-wrap gap-2">
                          <div className="flex items-center space-x-1.5 bg-stone-100 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setTab(3)}
                              className="px-3 py-1 bg-white text-[#006241] font-bold text-xs rounded-lg shadow-2xs cursor-pointer"
                            >
                              Katalog Zmian & Godziny
                            </button>
                            <button
                              type="button"
                              onClick={() => setTab(4)}
                              className="px-3 py-1 text-stone-600 hover:text-stone-900 font-bold text-xs rounded-lg cursor-pointer"
                            >
                              Skład 7 Menedżerów
                            </button>
                            <button
                              type="button"
                              onClick={() => setTab(5)}
                              className="px-3 py-1 text-stone-600 hover:text-stone-900 font-bold text-xs rounded-lg cursor-pointer"
                            >
                              Baza Norm KP (10 Lat)
                            </button>
                          </div>

                          <div className="text-[10px] px-2.5 py-1 bg-stone-100 text-stone-700 font-bold rounded-lg border">
                            15 Kodów Zmian Starbucks
                          </div>
                        </div>

                        {/* Siatka 1:1 Kart Zmian */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          {[
                            { code: 'AM', label: 'Otwarcie', h: '8.0h', time: '06:30–15:00', bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
                            { code: 'PM', label: 'Zamknięcie', h: '8.0h', time: '14:30–22:30', bg: 'bg-indigo-50 text-indigo-900 border-indigo-300' },
                            { code: 'AMN', label: 'Niedziela AM', h: '8.0h', time: '07:30–16:00', bg: 'bg-amber-50 text-amber-900 border-amber-300' },
                            { code: 'PMN', label: 'Niedziela PM', h: '8.0h', time: '13:00–21:30', bg: 'bg-purple-50 text-purple-900 border-purple-300' },
                            { code: 'MID', label: 'Środkowa', h: '8.0h (4–10h)', time: '08:00–16:00', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
                            { code: 'SUP', label: 'Wsparcie Lokalu', h: '8.0h (4–10h)', time: '08:00–16:00', bg: 'bg-cyan-50 text-cyan-900 border-cyan-300' },
                            { code: 'NC', label: 'Non-Coverage', h: '4.0h (1–12h)', time: '08:00–12:00', bg: 'bg-teal-50 text-teal-900 border-teal-300' },
                            { code: 'H / L4', label: 'Urlop / Chorobowe', h: '8.0h (Etat)', time: '08:00–16:00', bg: 'bg-rose-50 text-rose-900 border-rose-300' },
                          ].map((s, idx) => (
                            <div key={idx} className={`p-2 rounded-xl border ${s.bg} flex flex-col justify-between`}>
                              <div className="flex items-center justify-between">
                                <strong className="font-mono text-xs font-black">{s.code}</strong>
                                <span className="text-[10px] font-bold font-mono">{s.h}</span>
                              </div>
                              <div className="mt-1">
                                <span className="text-[10px] block font-medium opacity-90">{s.label}</span>
                                <span className="text-[9px] font-mono opacity-70 block">{s.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Belka Presetów Elastycznych */}
                        <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                          <span className="text-stone-700 font-medium">Szybkie Presety Godzinowe (MID, SUP, NC):</span>
                          <div className="flex items-center gap-1">
                            {['4.0h', '5.0h', '6.0h', '7.0h', '8.0h', '10.0h'].map((p) => (
                              <span key={p} className="px-1.5 py-0.5 bg-white border border-stone-300 rounded font-mono font-bold text-[10px] text-stone-800">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* WIDOK DLA SCENY 4: SKŁAD 7 MENEDŻERÓW */}
                    {tab === 4 && (
                      <div className="space-y-3.5 animate-in fade-in duration-200">
                        {/* Sub-zakładki Grafiku */}
                        <div className="flex items-center justify-between border-b border-stone-200 pb-2.5 flex-wrap gap-2">
                          <div className="flex items-center space-x-1.5 bg-stone-100 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setTab(3)}
                              className="px-3 py-1 text-stone-600 hover:text-stone-900 font-bold text-xs rounded-lg cursor-pointer"
                            >
                              Katalog Zmian & Godziny
                            </button>
                            <button
                              type="button"
                              onClick={() => setTab(4)}
                              className="px-3 py-1 bg-white text-[#006241] font-bold text-xs rounded-lg shadow-2xs cursor-pointer"
                            >
                              Skład 7 Menedżerów
                            </button>
                            <button
                              type="button"
                              onClick={() => setTab(5)}
                              className="px-3 py-1 text-stone-600 hover:text-stone-900 font-bold text-xs rounded-lg cursor-pointer"
                            >
                              Baza Norm KP (10 Lat)
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#006241] bg-emerald-100 px-2 py-1 rounded-lg">
                              Wrzesień 2026
                            </span>
                            <div className="px-2.5 py-1 bg-[#006241] text-white font-bold text-xs rounded-lg flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              <span>Suma: 6.00 FTE</span>
                            </div>
                          </div>
                        </div>

                        {/* Tabela 7 Menedżerów 1:1 */}
                        <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200 text-[11px]">
                                <th className="p-2">Imię i Nazwisko</th>
                                <th className="p-2">Rola Starbucks</th>
                                <th className="p-2 text-center">Wymiar Etatu</th>
                                <th className="p-2 text-right">Stawka (PLN/h)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 text-[11px]">
                              {[
                                { name: 'Dawid Apel', role: 'Store Manager (SM)', fte: '1.00 (Pełny etat)', rate: '35.50 zł/h', bg: 'bg-emerald-50/50' },
                                { name: 'Gabriela Kaczmarczyk', role: 'Assistant Store Manager (ASM)', fte: '1.00 (Pełny etat)', rate: '31.00 zł/h', bg: '' },
                                { name: 'Weronika Kowalska', role: 'Shift Supervisor (SSV)', fte: '1.00 (Pełny etat)', rate: '29.50 zł/h', bg: '' },
                                { name: 'Zuzanna Nowak', role: 'Shift Supervisor (SSV)', fte: '1.00 (Pełny etat)', rate: '29.50 zł/h', bg: '' },
                                { name: 'Joanna Wiśniewska', role: 'Shift Supervisor (SSV)', fte: '0.75 (3/4 etatu)', rate: '29.00 zł/h', bg: '' },
                                { name: 'Oliwia Dąbrowska', role: 'Shift Supervisor (SSV)', fte: '0.75 (3/4 etatu)', rate: '29.00 zł/h', bg: '' },
                                { name: 'Patrycja Lewandowska', role: 'Shift Supervisor (SSV)', fte: '0.50 (1/2 etatu)', rate: '28.50 zł/h', bg: '' },
                              ].map((m, idx) => (
                                <tr key={idx} className={m.bg || 'hover:bg-stone-50'}>
                                  <td className="p-2 font-bold text-stone-900">{m.name}</td>
                                  <td className="p-2 text-stone-600">{m.role}</td>
                                  <td className="p-2 text-center font-mono font-bold text-stone-800">{m.fte}</td>
                                  <td className="p-2 text-right font-mono font-bold text-[#006241]">{m.rate}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Przełącznik Propagacji */}
                        <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs text-stone-700 flex items-center justify-between">
                          <span className="font-medium">Auto-Dziedziczenie: <strong>Propaguj zmiany na kolejne miesiące</strong></span>
                          <span className="text-[#006241] font-black">WŁĄCZONE (Domyślne) ✓</span>
                        </div>
                      </div>
                    )}

                    {/* WIDOK DLA SCENY 5: BAZA NORM KP (10 LAT) */}
                    {tab === 5 && (
                      <div className="space-y-3.5 animate-in fade-in duration-200">
                        {/* Sub-zakładki Grafiku */}
                        <div className="flex items-center justify-between border-b border-stone-200 pb-2.5 flex-wrap gap-2">
                          <div className="flex items-center space-x-1.5 bg-stone-100 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setTab(3)}
                              className="px-3 py-1 text-stone-600 hover:text-stone-900 font-bold text-xs rounded-lg cursor-pointer"
                            >
                              Katalog Zmian & Godziny
                            </button>
                            <button
                              type="button"
                              onClick={() => setTab(4)}
                              className="px-3 py-1 text-stone-600 hover:text-stone-900 font-bold text-xs rounded-lg cursor-pointer"
                            >
                              Skład 7 Menedżerów
                            </button>
                            <button
                              type="button"
                              onClick={() => setTab(5)}
                              className="px-3 py-1 bg-white text-[#006241] font-bold text-xs rounded-lg shadow-2xs cursor-pointer"
                            >
                              Baza Norm KP (10 Lat)
                            </button>
                          </div>

                          <div className="text-xs font-bold text-[#006241] bg-emerald-100 px-2.5 py-1 rounded-lg">
                            art. 130 § 2 Kodeksu Pracy
                          </div>
                        </div>

                        {/* Formularz Edycji Normy 1:1 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-center">
                            <span className="text-[10px] text-stone-500 font-bold uppercase block">Dni Robocze</span>
                            <strong className="text-lg font-black text-stone-900 font-mono">22 dni</strong>
                            <span className="text-[10px] text-stone-400 block">Wrzesień 2026</span>
                          </div>

                          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-center">
                            <span className="text-[10px] text-stone-500 font-bold uppercase block">Dni Wolne</span>
                            <strong className="text-lg font-black text-stone-900 font-mono">8 dni</strong>
                            <span className="text-[10px] text-stone-400 block">4 weekendy</span>
                          </div>

                          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300 text-center">
                            <span className="text-[10px] text-emerald-900 font-bold uppercase block">Nominalna Norma KP</span>
                            <strong className="text-lg font-black text-[#006241] font-mono">176.0 h</strong>
                            <span className="text-[10px] text-emerald-700 block font-semibold">22 dni × 8.0h</span>
                          </div>
                        </div>

                        {/* Rejestr 252 Miesięcy */}
                        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 space-y-1">
                          <strong className="text-stone-900 block font-bold">Oficjalna Baza Norm 2016–2036 (252 miesiące):</strong>
                          <p className="text-[11px] leading-relaxed">
                            System automatycznie uwzględnia wszystkie święta państwowe. Święto przypadające w sobotę (np. 15 sierpnia, 26 grudnia) obniża wymiar o 8h zgodnie z art. 130 § 2 KP.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* WIDOK DLA SCENY 6: BAZA DANYCH, IMPORT & OTA */}
                    {tab === 6 && (
                      <div className="space-y-3.5 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
                          <strong className="text-xs text-stone-900 flex items-center gap-1.5">
                            <Database className="w-4 h-4 text-[#006241]" />
                            <span>Zarządzanie Danymi, Kopia Zapasowa & Aktualizacje</span>
                          </strong>
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-[#006241] font-bold rounded-md">
                            SQLite WASM
                          </span>
                        </div>

                        {/* Narzędzia Systemowe 1:1 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          {/* Importer Excel */}
                          <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between">
                              <strong className="text-stone-900 flex items-center gap-1">
                                <FileSpreadsheet className="w-4 h-4 text-[#006241]" />
                                <span>Universal Import Excel</span>
                              </strong>
                              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-200 text-emerald-900 font-bold rounded">Auto-Detect</span>
                            </div>
                            <p className="text-[10px] text-stone-600 leading-relaxed">
                              Automatyczne rozpoznawanie raportów AOP P&L (cele roczne i miesięczne) vs MAPAL Fichajes (rzeczywiste logowania RCP menedżerów i załogi).
                            </p>
                          </div>

                          {/* Kopie Zapasowe */}
                          <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-1.5">
                            <div className="flex items-center justify-between">
                              <strong className="text-stone-900 flex items-center gap-1">
                                <ShieldCheck className="w-4 h-4 text-[#006241]" />
                                <span>Rotacja 15 Kopii SQLite</span>
                              </strong>
                              <span className="text-[9px] px-1.5 py-0.5 bg-stone-200 text-stone-700 font-bold rounded">Auto-Backup</span>
                            </div>
                            <p className="text-[10px] text-stone-600 leading-relaxed">
                              Automatyczne punkty przywracania bazy przed publikacją grafiku, importem oraz startem aplikacji. 1-klik przywracanie z kopii.
                            </p>
                          </div>
                        </div>

                        {/* Wskaźnik OTA */}
                        <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                          <div>
                            <strong className="text-stone-900 block">Bezpieczne Aktualizacje Kodu (Hot-Patch OTA):</strong>
                            <span className="text-stone-500 text-[10px]">Pobieranie i podmienianie wyłącznie plików programu, baza SQLite pozostaje nienaruszona.</span>
                          </div>
                          <span className="px-2 py-0.5 bg-emerald-100 text-[#006241] font-bold rounded text-[10px]">
                            Status: Aktualna ✓
                          </span>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>

              {/* 3. DOLNY PANEL EKSPERTA STORE MANAGERA (WYJAŚNIENIE JAK TO DZIAŁA) */}
              <div className="p-3.5 bg-emerald-50/80 rounded-2xl border border-emerald-200 text-xs text-stone-700 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-2 font-bold text-[#006241]">
                  <Sparkles className="w-4 h-4 text-[#006241]" />
                  <span>
                    {tab === 1 && '💡 Jak działa AOP & TPLH: Transakcje (TRX) dzielone przez cel TPLH wyliczają budżet robocizny lokalu.'}
                    {tab === 2 && '💡 Jak działa NC & Floor: Pakiety NC są chronione i nie mogą obniżać obsady bezpieczeństwa lokalu (32h/dzień).'}
                    {tab === 3 && '💡 Jak działa Katalog Zmian: Każda zmiana ma dedykowany wymiar i kod; dla MID, SUP i NC możesz elastycznie zmieniać godziny.'}
                    {tab === 4 && '💡 Jak działa Skład Menedżerów: Każdy miesiąc posiada autonomiczny skład z opcją automatycznej propagacji na kolejne miesiące.'}
                    {tab === 5 && '💡 Jak działa Norma KP: System wylicza normę art. 130 KP dla 252 miesięcy (2016–2036) z uwzględnieniem świąt w soboty.'}
                    {tab === 6 && '💡 Jak działa System & Import: Wrzucasz dowolny plik Excel, silnik sam wykrywa czy to AOP czy MAPAL i zapisuje w SQLite.'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  {tab === 1 && 'Wszystkie zmiany w tabeli AOP natychmiast odświeżają cele tygodniowe (W1–W5) w Module 1. Import oficjalnego pliku Excel automatycznie zaktualizuje wszystkie 12 miesięcy.'}
                  {tab === 2 && 'Pakiety Non-Coverage są odejmowane od ogólnej puli robocizny jako zadania stałe kierownictwa, zapewniając pełną realizację obowiązków operacyjnych bez uszczerbku dla baru.'}
                  {tab === 3 && 'W grafiku menedżerskim możesz używać szybkich kodów klawiszowych (A, P, O, H, L) lub otwierać popover i wybierać presety od 4.0h do 12.0h z krokiem 30 minut.'}
                  {tab === 4 && 'Jeśli menedżer odchodzi lub awansuje (np. zmiana SSV na ASM), edytujesz tylko ten miesiąc, nie niszcząc danych historycznych ani rozliczeń kwartalnych TOR.'}
                  {tab === 5 && 'Urlopy (H) i chorobowe (L4) zaliczają dobowy wymiar pracownika wyłącznie w dni robocze (art. 154² § 1 KP), nie obciążając limitu w weekendy i święta.'}
                  {tab === 6 && 'Wszystkie Twoje grafiki, dyspozycje i logowania MAPAL są bezpiecznie przechowywane na Twoim komputerze. Aktualizacje programu nigdy nie kasują bazy danych.'}
                </p>
              </div>

            </div>
          )}
        </div>

        {/* DOLNY PASEK NAWIGACJI SAMOUCZEKA (JASNY) */}
        <div className="px-6 py-4 bg-white border-t border-stone-200 flex items-center justify-between shadow-2xs">
          <button
            type="button"
            disabled={tab === 1}
            onClick={() => setTab(tab - 1)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Wstecz</span>
          </button>

          <div className="flex items-center gap-3">
            {tab < maxSteps ? (
              <button
                type="button"
                onClick={() => setTab(tab + 1)}
                className="px-6 py-2.5 bg-gradient-to-r from-[#006241] to-[#00754A] hover:from-[#00754A] hover:to-[#00875A] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Kolejna Funkcja ➔</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={closeModelTour}
                className="px-8 py-2.5 bg-gradient-to-r from-[#006241] via-[#00754A] to-[#00875A] hover:from-[#00754A] hover:to-[#009664] text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>🚀 Zakończ & Przejdź do Aplikacji</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
