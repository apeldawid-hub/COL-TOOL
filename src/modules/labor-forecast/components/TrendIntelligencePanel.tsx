import React from 'react';
import {
  BrainCircuit,
  TrendingUp,
  Shield,
  Zap,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Award,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { TrendLearningSummary, StrategyOption } from '../../../types';

interface TrendIntelligencePanelProps {
  summary: TrendLearningSummary;
  selectedStrategy: 'floor_safe' | 'balanced' | 'growth';
  onSelectStrategy: (strategy: 'floor_safe' | 'balanced' | 'growth') => void;
}

export const TrendIntelligencePanel: React.FC<TrendIntelligencePanelProps> = ({
  summary,
  selectedStrategy,
  onSelectStrategy,
}) => {
  const { velocityScore, momentumTrend, confidenceLevel, strategyOptions, insights, historicalMonthsAnalyzed } = summary;

  const velocityPercent = ((velocityScore - 1) * 100).toFixed(1);
  const velocitySign = Number(velocityPercent) > 0 ? `+${velocityPercent}%` : `${velocityPercent}%`;

  return (
    <div className="bg-white border border-[#E2E8E5] rounded-2xl p-6 shadow-xs mb-6">
      {/* Nagłówek modułu */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#E2E8E5]">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl text-white flex items-center justify-center shadow-xs ${summary.isBaselineMode ? 'bg-[#B45309]' : 'bg-[#006241]'}`}>
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-[#1E3932] tracking-tight">
                {summary.isBaselineMode
                  ? 'Planowanie wg AOP — Oczekiwanie na Dane'
                  : 'Moduł Uczenia Się Trendów & Inteligencji Predykcyjnej'}
              </h3>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${
                summary.isBaselineMode
                  ? 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                  : 'bg-[#E8F5E9] text-[#006241] border-[#C8E6C9]'
              }`}>
                {summary.isBaselineMode ? '📋 Tryb AOP' : 'Uczenie Maszynowe'}
              </span>
            </div>
            <p className="text-xs text-[#5C6F68] mt-0.5">
              {summary.isBaselineMode
                ? 'Brak zamkniętych tygodni z ACT TRX. Rekomendacje bazują wyłącznie na planie AOP. Silnik predykcyjny uruchomi się po zamknięciu pierwszego tygodnia.'
                : <>Analiza wzorców sezonowości, dynamiki popytu i trajektorii TPLH z <strong>{historicalMonthsAnalyzed} miesięcy</strong> historii.</>}
            </p>
          </div>
        </div>

        {/* Wskaźniki statusu modelu */}
        <div className="flex items-center gap-3 flex-wrap">
          {summary.isBaselineMode ? (
            <div className="bg-[#FEF3C7] px-3 py-1.5 rounded-xl border border-[#FDE68A] flex items-center gap-2 text-xs">
              <AlertCircle className="w-3.5 h-3.5 text-[#B45309]" />
              <span className="font-black text-[#92400E]">Brak ACT TRX — Trend nieaktywny</span>
            </div>
          ) : (
            <>
              <div className="bg-[#F4F7F5] px-3 py-1.5 rounded-xl border border-[#E2E8E5] flex items-center gap-2 text-xs">
                <span className="text-[#5C6F68] font-bold">Dynamika (Velocity):</span>
                <span className="font-black text-[#006241]">{velocitySign}</span>
              </div>

              <div className="bg-[#F4F7F5] px-3 py-1.5 rounded-xl border border-[#E2E8E5] flex items-center gap-2 text-xs">
                <span className="text-[#5C6F68] font-bold">Poziom Ufności:</span>
                <span
                  className={`font-black uppercase text-[11px] ${
                    confidenceLevel === 'high'
                      ? 'text-[#006241]'
                      : confidenceLevel === 'medium'
                      ? 'text-[#B45309]'
                      : 'text-gray-500'
                  }`}
                >
                  {confidenceLevel === 'high' ? 'Wysoki (90%+)' : confidenceLevel === 'medium' ? 'Średni (80%)' : 'Wstępny'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3 Strategie Planowania do wyboru przez Store Managera */}
      <div className="my-5">
        <h4 className="text-xs font-black text-[#1E3932] uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#CBA258]" />
          Wybierz Strategię Balansowania Robocizny:
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Strategia 1: Floor Safe */}
          <div
            onClick={() => onSelectStrategy('floor_safe')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedStrategy === 'floor_safe'
                ? 'bg-[#FEFCE8]/80 border-[#F59E0B] shadow-xs ring-2 ring-[#F59E0B]/20'
                : 'bg-white border-[#E2E8E5] hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-[#1E3932] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#D97706]" />
                {strategyOptions.floor_safe.name}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-gray-200">
                {strategyOptions.floor_safe.badge}
              </span>
            </div>
            <p className="text-[11px] text-[#5C6F68] leading-relaxed mb-3">
              {strategyOptions.floor_safe.description}
            </p>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
              <span className="text-[#5C6F68]">Cel TPLH: <strong>{strategyOptions.floor_safe.expectedTplh.toFixed(2)}</strong></span>
              <span className="font-extrabold text-[#D97706]">
                {strategyOptions.floor_safe.hoursDelta >= 0 ? `+${strategyOptions.floor_safe.hoursDelta}h` : `${strategyOptions.floor_safe.hoursDelta}h`}
              </span>
            </div>
          </div>

          {/* Strategia 2: Balanced AI */}
          <div
            onClick={() => onSelectStrategy('balanced')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedStrategy === 'balanced'
                ? 'bg-[#F0FDF4] border-[#006241] shadow-xs ring-2 ring-[#006241]/20'
                : 'bg-white border-[#E2E8E5] hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-[#006241] flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#006241]" />
                {strategyOptions.balanced.name}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#006241] border border-[#86EFAC]">
                {strategyOptions.balanced.badge}
              </span>
            </div>
            <p className="text-[11px] text-[#5C6F68] leading-relaxed mb-3">
              {strategyOptions.balanced.description}
            </p>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
              <span className="text-[#5C6F68]">Cel TPLH: <strong>{strategyOptions.balanced.expectedTplh.toFixed(2)}</strong></span>
              <span className="font-black text-[#006241]">
                {strategyOptions.balanced.hoursDelta >= 0 ? `+${strategyOptions.balanced.hoursDelta}h` : `${strategyOptions.balanced.hoursDelta}h`}
              </span>
            </div>
          </div>

          {/* Strategia 3: Growth */}
          <div
            onClick={() => onSelectStrategy('growth')}
            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
              selectedStrategy === 'growth'
                ? 'bg-[#EEF2FF] border-[#6366F1] shadow-xs ring-2 ring-[#6366F1]/20'
                : 'bg-white border-[#E2E8E5] hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-[#4338CA] flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#6366F1]" />
                {strategyOptions.growth.name}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white border border-gray-200">
                {strategyOptions.growth.badge}
              </span>
            </div>
            <p className="text-[11px] text-[#5C6F68] leading-relaxed mb-3">
              {strategyOptions.growth.description}
            </p>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
              <span className="text-[#5C6F68]">Cel TPLH: <strong>{strategyOptions.growth.expectedTplh.toFixed(2)}</strong></span>
              <span className="font-extrabold text-[#4338CA]">
                +{strategyOptions.growth.hoursDelta}h
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rozkład Obciążenia w Dniach Tygodnia (Pn–Nd) z MAPAL */}
      {summary.dayOfWeekTrends && summary.dayOfWeekTrends.length > 0 && (
        <div className="my-5 pt-4 border-t border-[#EEF2F0]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
            <h4 className="text-xs font-black text-[#1E3932] uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-[#006241]" />
              Rozkład Godzin w Dniach Tygodnia (Historia MAPAL & Dystrybucja H +/-):
            </h4>
            <span className="text-[10px] text-[#006241] font-extrabold bg-[#E8F5E9] px-2 py-0.5 rounded-full border border-[#C8E6C9]">
              ✨ Model Dobowy H +/-
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {summary.dayOfWeekTrends.map((d) => {
              const delta = Number((d.avgHours - d.floorHours).toFixed(1));
              const isAbove = delta > 0.5;
              const isBelow = delta < -0.5;

              return (
                <div
                  key={d.dayId}
                  className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                    isAbove
                      ? 'bg-[#F0FDF4] border-[#86EFAC]/80 shadow-2xs'
                      : isBelow
                      ? 'bg-[#FEFCE8] border-[#FDE047]/80'
                      : 'bg-[#F8FAF9] border-[#E2E8E5]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#1E3932]">{d.shortName}</span>
                    <span className="text-[10px] font-bold text-[#5C6F68]">{d.sharePercent}%</span>
                  </div>

                  <div className="my-2 text-center">
                    <div className="text-base font-black text-[#1E3932]">
                      {d.avgHours} <span className="text-[11px] font-normal text-[#5C6F68]">h</span>
                    </div>
                    <div className="text-[10px] text-[#5C6F68] mt-0.5">
                      Śr. dobowo
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-[#E2E8E5]/70 flex items-center justify-center text-[10px] font-black">
                    {isAbove ? (
                      <span className="text-[#00754A] flex items-center gap-0.5">
                        <ArrowUpRight className="w-3 h-3" /> +{delta}h
                      </span>
                    ) : isBelow ? (
                      <span className="text-[#B45309] flex items-center gap-0.5">
                        <ArrowDownRight className="w-3 h-3" /> {delta}h
                      </span>
                    ) : (
                      <span className="text-[#5C6F68] flex items-center gap-0.5">
                        <Minus className="w-3 h-3" /> W normie
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Wykryte Wzorce i Automatyczne Wnioski (Insights) */}
      <div className="mt-5 pt-4 border-t border-[#EEF2F0]">
        <h4 className="text-xs font-black text-[#1E3932] uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-[#006241]" />
          Wnioski i Wzorce Wykryte w Danych:
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((insight) => (
            <div key={insight.id} className="p-3.5 rounded-xl bg-[#F8FAF9] border border-[#E2E8E5] text-xs">
              <div className="flex items-start justify-between gap-2">
                <h5 className="font-bold text-[#1E3932] flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#006241] shrink-0" />
                  {insight.title}
                </h5>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-white text-[#006241] border border-[#C8E6C9] shrink-0">
                  Ufność: {insight.confidenceScore}%
                </span>
              </div>
              <p className="text-[#5C6F68] mt-1.5 leading-relaxed text-[11px]">
                {insight.description}
              </p>
              <div className="mt-2 text-[11px] font-bold text-[#00754A] flex items-center gap-1">
                <span>Wpływ:</span>
                <strong>{insight.impact}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
