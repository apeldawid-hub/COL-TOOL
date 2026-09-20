import React from 'react';
import { Target, Clock, TrendingUp, ArrowUpRight, ArrowDownRight, Briefcase, CheckCircle2 } from 'lucide-react';
import { MonthlyCalculationSummary } from '../../../types';

interface KpiSummaryCardsProps {
  summary: MonthlyCalculationSummary;
  onSelectTargetWeek?: (weekKey: string) => void;
}

export const KpiSummaryCards: React.FC<KpiSummaryCardsProps> = ({
  summary,
  onSelectTargetWeek,
}) => {
  const {
    monthPlan,
    planHoursTotal,
    actualHoursMtd,
    actualTrxMtd,
    trendVelocityMtd,
    earnedLaborBudget,
    deltaEarnedHours,
    nextWeekHanwFinal,
    planningCadence,
    rows,
  } = summary;

  const hoursDiffVsPlan = Number(
    (
      actualHoursMtd -
      summary.rows.filter((r) => r.isClosed).reduce((s, r) => s + r.planHours, 0)
    ).toFixed(1)
  );
  const trendPercent = ((trendVelocityMtd - 1) * 100).toFixed(1);
  const isTrendPositive = trendVelocityMtd >= 1.0;

  const targetWeekNum = planningCadence?.targetWeekNum || 'W4';
  const targetWeekDates = planningCadence?.targetWeekDates || '';
  const isDeadlineToday = planningCadence?.isDeadlineToday;
  const daysUntil = planningCadence?.daysUntilDeadline;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Karta 1: Plan AOP */}
      <div className="bg-white border border-[#E2E8E5] rounded-2xl p-5 shadow-xs relative overflow-hidden transition-all hover:shadow-md">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#5C6F68] flex items-center gap-1.5">
            <Target className="w-4 h-4 text-[#006241]" />
            1. Plan AOP na MSC
          </span>
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#E8F5E9] text-[#006241] border border-[#C8E6C9]">
              Cel: {monthPlan.target_tplh.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <div className="text-3xl font-black text-[#1E3932] tracking-tight">
              {planHoursTotal.toLocaleString('pl-PL')}{' '}
              <span className="text-sm font-bold text-[#5C6F68]">h</span>
            </div>
            <div className="text-xs font-medium text-[#5C6F68]">Budżet Godzin AOP</div>
          </div>

          <div className="pt-2.5 border-t border-[#EEF2F0] flex justify-between text-xs">
            <div>
              <span className="text-[#5C6F68]">Plan TRX:</span>{' '}
              <span className="font-extrabold text-[#1E3932]">
                {monthPlan.plan_trx.toLocaleString('pl-PL')}
              </span>
            </div>
            <div>
              <span className="text-[#5C6F68]">Śr/Tydz:</span>{' '}
              <span className="font-extrabold text-[#1E3932]">
                {monthPlan.avg_weekly_hours ? `${monthPlan.avg_weekly_hours.toFixed(1)} h` : '-'}
              </span>
            </div>
          </div>

          {/* Kluczowa metryka: Pula H +/- */}
          <div className="pt-1.5 space-y-1">
            {summary.ncBudgetTotal !== undefined && summary.ncBudgetTotal > 0 && (
              <div className="flex justify-between text-[11px] text-[#5C6F68]">
                <span>Budżet NC: <strong className="text-[#1E3932]">{summary.ncBudgetTotal.toFixed(1)} h</strong></span>
                <span>Tygodnie: <strong className="text-[#1E3932]">{monthPlan.weeks_count || 5} tyg.</strong></span>
              </div>
            )}
            <div className={`flex items-center justify-between text-xs font-bold px-2.5 py-1.5 rounded-lg border ${
              summary.surplusHours > 0
                ? 'bg-[#E8F5E9] text-[#006241] border-[#A5D6A7]'
                : 'bg-[#FEF2F2] text-[#DC2626] border-[#FCA5A5]'
            }`}>
              <span>Pula H +/-:</span>
              <span className="text-sm font-black">
                +{summary.surplusHours.toFixed(1)} h
                <span className="text-[10px] font-semibold ml-1 opacity-70">
                  (~{summary.surplusHoursPerWeek.toFixed(1)} h/tydz)
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Karta 2: Wykonanie MTD */}
      <div className="bg-white border border-[#E2E8E5] rounded-2xl p-5 shadow-xs relative overflow-hidden transition-all hover:shadow-md">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#5C6F68] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#0284C7]" />
            2. Wykonanie MTD
          </span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
              isTrendPositive
                ? 'bg-[#E8F5E9] text-[#006241] border-[#C8E6C9]'
                : 'bg-[#FEF2F2] text-[#DC2626] border-[#FCA5A5]'
            }`}
          >
            {isTrendPositive ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            Trend: {isTrendPositive ? `+${trendPercent}%` : `${trendPercent}%`}
          </span>
        </div>

        <div className="space-y-2">
          <div>
            <div className="text-3xl font-black text-[#1E3932] tracking-tight">
              {actualHoursMtd.toLocaleString('pl-PL')}{' '}
              <span className="text-sm font-bold text-[#5C6F68]">h</span>
            </div>
            <div className="text-xs font-medium text-[#5C6F68]">Rzeczywiste Godziny (RCP)</div>
          </div>

          <div className="pt-2.5 border-t border-[#EEF2F0] flex justify-between text-xs">
            <div>
              <span className="text-[#5C6F68]">Vs Plan MTD:</span>{' '}
              <span
                className={`font-extrabold ${
                  hoursDiffVsPlan <= 0 ? 'text-[#006241]' : 'text-[#DC2626]'
                }`}
              >
                {hoursDiffVsPlan <= 0 ? `${hoursDiffVsPlan}` : `+${hoursDiffVsPlan}`} h
              </span>
            </div>
            <div>
              <span className="text-[#5C6F68]">Act TRX:</span>{' '}
              <span className="font-extrabold text-[#1E3932]">
                {actualTrxMtd.toLocaleString('pl-PL')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Karta 3: Rekomendacja HANW / Wynik Rozliczenia */}
      <div className="bg-white border-2 border-[#C8E6C9] rounded-2xl p-5 shadow-xs relative overflow-hidden transition-all hover:shadow-md bg-gradient-to-b from-white to-[#F7FBF8]">
        {summary.monthTemporalStatus === 'past' ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#006241] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#006241]" />
                3. Rozliczenie Robocizny
              </span>
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#006241] border border-[#A5D6A7]">
                Zamknięty
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-black text-[#006241] tracking-tight">
                    {earnedLaborBudget.toLocaleString('pl-PL')}{' '}
                    <span className="text-sm font-bold text-[#5C6F68]">h</span>
                  </div>
                  {summary.totalActualTplh !== null && (
                    <span className="text-xs font-black text-[#006241] bg-[#E8F5E9] px-2 py-0.5 rounded-lg border border-[#C8E6C9]">
                      TPLH: {summary.totalActualTplh.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-[#00754A] mt-0.5">
                  Wypracowany budżet robocizny (Earned Labor)
                </div>
              </div>

              <div className="pt-2.5 border-t border-[#E8F5E9] flex justify-between text-xs">
                <div>
                  <span className="text-[#5C6F68]">Korekta AOP:</span>{' '}
                  <span
                    className={`font-extrabold ${
                      deltaEarnedHours >= 0 ? 'text-[#006241]' : 'text-[#B45309]'
                    }`}
                  >
                    {deltaEarnedHours >= 0 ? `+${deltaEarnedHours}` : deltaEarnedHours} h
                  </span>
                </div>
                <div>
                  <span className="text-[#5C6F68]">Cel TPLH:</span>{' '}
                  <span className="font-extrabold text-[#1E3932]">
                    {monthPlan.target_tplh.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#006241] flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-[#006241]" />
                3. Rekomendacja HANW
              </span>
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#006241] border border-[#A5D6A7]">
                  Cel: {targetWeekNum}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-black text-[#006241] tracking-tight">
                    {nextWeekHanwFinal !== null ? `${nextWeekHanwFinal.toLocaleString('pl-PL')} h` : '-'}
                  </div>
                  <span className="text-[11px] font-bold text-[#5C6F68]">
                    {targetWeekDates}
                  </span>
                </div>
                <div className="text-xs font-bold text-[#00754A] flex items-center gap-1 mt-0.5">
                  <span>Limit na grafik {targetWeekNum}</span>
                  <span className="text-[10px] font-medium text-[#5C6F68]">
                    ({isDeadlineToday ? 'planujesz dzisiaj' : `plan w pon. za ${daysUntil} dni`})
                  </span>
                </div>
              </div>

              <div className="pt-2.5 border-t border-[#E8F5E9] flex justify-between text-xs">
                <div>
                  <span className="text-[#5C6F68]">Korekta AOP:</span>{' '}
                  <span
                    className={`font-extrabold ${
                      deltaEarnedHours >= 0 ? 'text-[#006241]' : 'text-[#B45309]'
                    }`}
                  >
                    {deltaEarnedHours >= 0 ? `+${deltaEarnedHours}` : deltaEarnedHours} h
                  </span>
                </div>
                {planningCadence?.publishedWeekNum && (
                  <div>
                    <span className="text-[#5C6F68]">{planningCadence.publishedWeekNum} (Opublik.):</span>{' '}
                    <span className="font-extrabold text-[#0284C7]">
                      {planningCadence.publishedScheduledHours.toFixed(1)} h
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
