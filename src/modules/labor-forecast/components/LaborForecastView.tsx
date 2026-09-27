import React, { useState } from 'react';
import {
  AopPlanRecord,
  WeekRecord,
  MonthlyCalculationSummary,
  ManagerScheduleShift,
  ShiftDefinition,
  ManagerEmployee,
  WeeklyCalculatedRow
} from '../../../types';
import { WeeklyScheduleTable } from './WeeklyScheduleTable';
import { TrendCharts } from './TrendCharts';
import { TrendIntelligencePanel } from './TrendIntelligencePanel';
import { ImportModal } from './ImportModal';
import { LaborLogViewerModal } from './LaborLogViewerModal';
import { ManagerLaborBridgeModal } from './ManagerLaborBridgeModal';
import { MondayProjectionModal } from './MondayProjectionModal';
import { LaborForecastWidget } from './LaborForecastWidget';
import { useTutorial } from '../../../context/TutorialContext';
import { FeatureInfoButton } from '../../../components/FeatureInfoButton';
import {
  TrendingUp,
  Target,
  ShieldCheck,
  Waves,
  Calendar,
  Sparkles,
  X,
  BookOpen,
  HelpCircle,
  Zap,
} from 'lucide-react';

interface LaborForecastViewProps {
  currentYear: number;
  currentMonthName: string;
  aopPlan: AopPlanRecord | null;
  summary: MonthlyCalculationSummary | null;
  weeks: WeekRecord[];
  onPeriodChange: (year: number, monthName: string) => void;
  onSaveTrx: (weekKey: string, trx: number | null) => Promise<void>;
  onSaveScheduledHours: (weekKey: string, hours: number | null) => Promise<void>;
  onSelectTargetWeek: (key: string) => void;
  onRefresh: () => void;
  selectedStrategy: 'floor_safe' | 'balanced' | 'growth';
  onSelectStrategy: (strat: 'floor_safe' | 'balanced' | 'growth') => void;
  managerShifts: ManagerScheduleShift[];
  shiftDefinitions: ShiftDefinition[];
  managerEmployees: ManagerEmployee[];
  onNavigateToManagerSchedule?: () => void;
}

const MONTHS_ORDER = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

export const LaborForecastView: React.FC<LaborForecastViewProps> = ({
  currentYear,
  currentMonthName,
  aopPlan,
  summary,
  weeks: _weeks,
  onPeriodChange,
  onSaveTrx,
  onSaveScheduledHours,
  onSelectTargetWeek,
  onRefresh,
  selectedStrategy,
  onSelectStrategy,
  managerShifts: _managerShifts,
  shiftDefinitions: _shiftDefinitions,
  managerEmployees: _managerEmployees,
  onNavigateToManagerSchedule
}) => {
  const { isTutorialMode, openModelTour } = useTutorial();

  // Stany otwarcia poszczególnych modali akcji
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFlashForecastOpen, setIsFlashForecastOpen] = useState(false);
  const [isAiTrendsModalOpen, setIsAiTrendsModalOpen] = useState(false);
  const [isTrendChartsOpen, setIsTrendChartsOpen] = useState(false);
  const [activeBridgeWeekRow, setActiveBridgeWeekRow] = useState<WeeklyCalculatedRow | null>(null);
  const [activeViewerWeek, setActiveViewerWeek] = useState<{
    key: string;
    label: string;
  } | null>(null);

  // Nawigacja miesięcy
  const handlePrevMonth = () => {
    const idx = MONTHS_ORDER.indexOf(currentMonthName);
    if (idx > 0) {
      onPeriodChange(currentYear, MONTHS_ORDER[idx - 1]);
    } else {
      onPeriodChange(currentYear - 1, MONTHS_ORDER[11]);
    }
  };

  const handleNextMonth = () => {
    const idx = MONTHS_ORDER.indexOf(currentMonthName);
    if (idx < 11) {
      onPeriodChange(currentYear, MONTHS_ORDER[idx + 1]);
    } else {
      onPeriodChange(currentYear + 1, MONTHS_ORDER[0]);
    }
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    const currentMonthIdx = now.getMonth();
    onPeriodChange(now.getFullYear(), MONTHS_ORDER[currentMonthIdx]);
  };

  // Metryki MTD dla kompaktowego Hero Bara
  const mtdTrx = summary ? summary.rows.reduce((acc, r) => acc + (r.actualTrx || 0), 0) : 0;
  const mtdHours = summary ? summary.rows.reduce((acc, r) => acc + (r.actualHours || 0), 0) : 0;
  const mtdTplh = mtdHours > 0 ? mtdTrx / mtdHours : 0;
  const mtdFlexHours = summary ? summary.rows.reduce((acc, r) => acc + (r.flexHoursPool || 0), 0) : 0;
  const hasMondayProjected = summary ? summary.rows.some(r => r.isMondayProjected) : false;
  const mondayProjectedRow = summary?.rows.find(r => r.isMondayProjected) || summary?.rows.find(r => r.isTargetPlanningWeek) || summary?.rows[0];

  return (
    <div className="space-y-4 pb-20 select-none">
      {/* 🌟 KOMPAKTOWY HERO BAR METRYK MTD (Połączenie KPI & Statusu AOP) */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3.5 shadow-xs border border-stone-200/90 flex items-center justify-between gap-3 flex-wrap">
        {/* Lewa strona: Kontekst Miesiąca & AOP */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#006241]/10 border border-[#006241]/20">
            <Calendar className="w-4 h-4 text-[#006241]" />
            <span className="text-xs font-black text-[#006241]">
              {currentMonthName} {currentYear}
            </span>
          </div>

          {aopPlan && (
            <div className="flex items-center gap-3 text-xs text-stone-600 flex-wrap">
              <span className="flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-stone-400" />
                <span>TRX AOP:</span>
                <strong className="text-stone-900">{aopPlan.plan_trx.toLocaleString('pl-PL')}</strong>
              </span>
              <span className="text-stone-300">•</span>
              <span>
                Sprzedaż: <strong className="text-stone-900">{aopPlan.plan_sales ? `${aopPlan.plan_sales.toLocaleString('pl-PL')} zł` : '—'}</strong>
              </span>
              <span className="text-stone-300">•</span>
              <span>
                AGC: <strong className="text-amber-800 font-bold">{aopPlan.plan_agc ? `${aopPlan.plan_agc.toFixed(2)} zł` : (aopPlan.plan_sales && aopPlan.plan_trx ? `${(aopPlan.plan_sales / aopPlan.plan_trx).toFixed(2)} zł` : '—')}</strong>
              </span>
              {aopPlan.plan_col_percent && (
                <>
                  <span className="text-stone-300">•</span>
                  <span>
                    COL: <strong className="text-emerald-800 font-bold">{aopPlan.plan_col_percent.toFixed(1)}%</strong>
                    {aopPlan.plan_col_pln ? <span className="text-stone-400 font-normal text-[11px] ml-1">({aopPlan.plan_col_pln.toLocaleString('pl-PL')} zł)</span> : null}
                  </span>
                </>
              )}
              <span className="text-stone-300">•</span>
              <span>
                TPLH Cel: <strong className="text-[#006241] font-black">{aopPlan.target_tplh.toFixed(2)}</strong>
              </span>
              <span className="text-stone-300">•</span>
              <span>
                Budżet: <strong className="text-stone-900">{aopPlan.labor_budget !== undefined ? `${aopPlan.labor_budget.toFixed(1)}h` : '—'}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Prawa strona: MTD Velocity, Floor Safety & Flex Pool */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* MTD Velocity */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 border border-stone-200 text-xs" title="Rzeczywista dynamika wypracowana w miesiącu">
            <TrendingUp className="w-3.5 h-3.5 text-[#006241]" />
            <span className="text-stone-500 font-medium">MTD:</span>
            <strong className="text-stone-900">{mtdHours.toFixed(1)}h</strong>
            <span className="text-stone-400">/</span>
            <strong className="text-[#006241] font-black">{mtdTplh.toFixed(2)} TPLH</strong>
            <FeatureInfoButton
              title="MTD Velocity & Wypracowany Budżet"
              category="TPLH & ROBOCIZNA"
              description="Wskaźnik tempa realizacji budżetu robocizny na podstawie dotychczasowych rzeczywistych transakcji TRX i zaraportowanych godzin pracy w miesiącu."
              details={[
                "Śledzi faktyczną efektywność TPLH od 1. dnia miesiąca",
                "Pozwala z wyprzedzeniem korygować obsadę w kolejnych tygodniach"
              ]}
              tips="Jeśli MTD TPLH jest wyższe niż cel AOP, lokal wypracowuje dodatkowy bufor bezpieczeństwa."
            />
          </div>

          {/* Floor Hours Safe Base */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-xs" title="Baza nienaruszalna Floor Hours (32.0h/dzień = 224h/tydzień)">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span className="text-emerald-800 font-bold">Floor: 32h/d</span>
            <FeatureInfoButton
              title="Nienaruszalna Baza Floor Hours (32.0h/dzień)"
              category="TPLH & ROBOCIZNA"
              description="Minimalna dobowa obsada operacyjna kawiarni 108120 Janki zapewniająca bezpieczne otwarcie i zamknięcie lokalu."
              rules={[
                "1 MGR + 1 Barista rano (AM) oraz 1 MGR + 1 Barista wieczorem (PM) = 32.0h / dobę",
                "Łącznie 224.0h w każdym 7-dniowym tygodniu operacyjnym"
              ]}
              tips="Godziny poniżej bazy Floor nigdy nie powinny być redukowane, aby chronić bezpieczeństwo i standardy serwisu."
            />
          </div>

          {/* Pula Flex */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-50 border border-sky-200 text-xs" title="Pula godzin Flex ponad bazę Floor">
            <Waves className="w-3.5 h-3.5 text-sky-700" />
            <span className="text-sky-800 font-medium">Pula Flex:</span>
            <strong className="text-sky-950 font-black">+{mtdFlexHours.toFixed(1)}h</strong>
            <FeatureInfoButton
              title="Pula Flex dla Baristów"
              category="TPLH & ROBOCIZNA"
              description="Nadwyżka wypracowanych godzin robocizny ponad bazę Floor Hours (Tydzień - 224.0h)."
              details={[
                "Zapewnia wsparcie drugiego i trzeciego baristy na barze w godzinach szczytu (Peak Hours)",
                "Może być swobodnie alokowana na piątki i soboty"
              ]}
              tips="Wykorzystuj pulę Flex do wzmocnienia Customer Connection podczas weekendowych peaków."
            />
          </div>

          {/* Strategia AI Badge */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsAiTrendsModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-xs font-bold text-purple-900 transition-all cursor-pointer shadow-2xs"
              title="Kliknij, aby otworzyć panel strategii AI i wniosków z trendów"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>AI: {selectedStrategy === 'floor_safe' ? 'Floor-Safe' : selectedStrategy === 'growth' ? 'Growth' : 'Balanced'}</span>
            </button>
            <FeatureInfoButton
              title="Strategie Sezonowe AI AOP"
              category="AI & OPTYMALIZACJA"
              description="Model uczenia maszynowego analizujący wielomiesięczną historię popytu i transakcji lokalu 108120 Janki."
              details={[
                "Floor-Safe: maksymalna ochrona TPLH w niskim sezonie (styczeń–kwiecień)",
                "Balanced: optymalny balans godzin i Customer Connection",
                "Growth: dynamiczne dociążenie sobót i piątków w sezonie szczytowym (maj–sierpień)"
              ]}
            />
          </div>
        </div>
      </div>

      {/* 🎓 BANER SAMOUCZEK & WSKAZÓWKI PILOTAŻU (Renderowany tylko w trybie samouczka) */}
      {isTutorialMode && (
        <div className="p-3.5 bg-gradient-to-r from-emerald-950/80 via-[#0a1811] to-[#0d2217] border border-emerald-500/40 rounded-2xl text-xs text-emerald-100 shadow-md flex items-center justify-between gap-3 flex-wrap animate-in fade-in duration-200">
          <div className="flex items-center gap-3 flex-1 min-w-[280px]">
            <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-400/30 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <strong className="text-white text-xs font-bold">Wskazówki Pilotażu: TPLH Forecast & Labor</strong>
                <span className="text-[9px] px-1.5 py-0.2 bg-amber-400 text-amber-950 rounded-full font-black uppercase">
                  Moduł 1
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                🛡️ <strong>Floor 32h/d</strong> (224h/tydz.) to nienaruszalna baza • 🌊 <strong>Pula Flex</strong> to godziny ponad Floor do manipulacji dniami szczytu • 🔮 <strong>W poniedziałek</strong> silnik predykcji domyka tydzień W+2.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openModelTour(1, 'tplh')}
            className="px-3 py-1.5 bg-[#006241] hover:bg-[#00754A] text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border border-emerald-400/40 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Animowany Samouczek TPLH ➔</span>
          </button>
        </div>
      )}

      {/* 📊 GŁÓWNA TABELA TYGODNIOWA (W1-W5 / W5+W1) */}
      {summary ? (
        <WeeklyScheduleTable
          rows={summary.rows}
          crossMonthBridge={summary.crossMonthBridge}
          onNavigateMonth={(m, y) => onPeriodChange(y, m)}
          onSaveTrx={onSaveTrx}
          onSaveScheduledHours={onSaveScheduledHours}
          onSelectTargetWeek={onSelectTargetWeek}
          onViewLaborDetails={(key, label) => setActiveViewerWeek({ key, label })}
          onViewMonthLaborDetails={() =>
            setActiveViewerWeek({
              key: `${currentYear}_${currentMonthName}`,
              label: `Cały miesiąc: ${currentMonthName} ${currentYear}`,
            })
          }
          onViewManagerBridge={(row) => setActiveBridgeWeekRow(row)}
        />
      ) : (
        <div className="py-24 text-center">
          <div className="w-12 h-12 border-4 border-[#006241] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-bold text-[#1E3932]">
            Ładowanie silników obliczeniowych i bazy danych...
          </p>
        </div>
      )}

      {/* 📈 SEKCJA WYKRESÓW TRENDÓW (Otwierana ze Speed-Diala) */}
      {isTrendChartsOpen && summary && (
        <div className="bg-white rounded-2xl shadow-xs border border-stone-200 p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#006241]" />
              <span>Wykresy Wizualizacji Trendu TPLH & Robocizny</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsTrendChartsOpen(false)}
              className="p-1 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <TrendCharts rows={summary.rows} monthPlan={summary.monthPlan} />
        </div>
      )}

      {/* 🧠 MODAL STRATEGII AI TRENDÓW */}
      {isAiTrendsModalOpen && summary?.trendLearning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-purple-100 text-purple-900 flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900">Uczenie Maszynowe Trendów AOP & Strategie</h2>
                  <p className="text-xs text-stone-500">Wnioski z 89 tygodni logowań i rekomendacje obsady dobowej</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiTrendsModalOpen(false)}
                className="p-1.5 hover:bg-stone-100 rounded-full text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <TrendIntelligencePanel
              summary={summary.trendLearning}
              selectedStrategy={selectedStrategy}
              onSelectStrategy={(strat) => {
                onSelectStrategy(strat);
              }}
            />
          </div>
        </div>
      )}

      {/* 🔮 FLASH FORECAST MODAL (Pre-closing Poniedziałku) */}
      {isFlashForecastOpen && mondayProjectedRow && (
        <MondayProjectionModal
          isOpen={isFlashForecastOpen}
          onClose={() => setIsFlashForecastOpen(false)}
          row={mondayProjectedRow}
          onSaveTrx={onSaveTrx}
          onSaveScheduledHours={onSaveScheduledHours}
        />
      )}

      {/* 🌉 MANAGER LABOR BRIDGE MODAL */}
      {activeBridgeWeekRow && (
        <ManagerLaborBridgeModal
          isOpen={Boolean(activeBridgeWeekRow)}
          onClose={() => setActiveBridgeWeekRow(null)}
          weekRow={activeBridgeWeekRow}
          crossMonthBridge={summary?.crossMonthBridge}
          onNavigateToManagerSchedule={onNavigateToManagerSchedule}
        />
      )}

      {/* 📥 IMPORT MAPAL MODAL */}
      {isImportModalOpen && (
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={() => {
            setIsImportModalOpen(false);
            onRefresh();
          }}
        />
      )}

      {/* 📜 LABOR LOG VIEWER MODAL (Fichajes) */}
      {activeViewerWeek && (
        <LaborLogViewerModal
          isOpen={Boolean(activeViewerWeek)}
          onClose={() => setActiveViewerWeek(null)}
          weekKey={activeViewerWeek.key}
          weekLabel={activeViewerWeek.label}
        />
      )}

      {/* ✨ PŁYWAJĄCY STARBUCKS SPEED-DIAL BULLET WIDGET */}
      <LaborForecastWidget
        currentYear={currentYear}
        currentMonthName={currentMonthName}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onCurrentMonth={handleCurrentMonth}
        onOpenFlashForecast={() => setIsFlashForecastOpen(true)}
        onOpenFichajesViewer={() => {
          setActiveViewerWeek({
            key: `${currentYear}_${currentMonthName}`,
            label: `Ewidencja Fichajes: ${currentMonthName} ${currentYear}`,
          });
        }}
        onToggleTrendCharts={() => setIsTrendChartsOpen(prev => !prev)}
        isTrendChartsOpen={isTrendChartsOpen}
        onRefresh={onRefresh}
        hasMondayProjection={hasMondayProjected}
        activeStrategy={selectedStrategy}
      />
    </div>
  );
};
