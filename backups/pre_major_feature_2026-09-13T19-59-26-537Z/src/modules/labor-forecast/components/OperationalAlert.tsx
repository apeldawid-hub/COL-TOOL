import React from 'react';
import { AlertTriangle, Lightbulb, Calendar, CheckCircle2 } from 'lucide-react';
import { MonthlyCalculationSummary } from '../../../types';

interface OperationalAlertProps {
  summary: MonthlyCalculationSummary;
}

export const OperationalAlert: React.FC<OperationalAlertProps> = ({ summary }) => {
  const {
    trendVelocityMtd,
    nextWeekHanwFinal,
    nextWeekFloorHours,
    isFloorAlertTriggered,
    deltaEarnedHours,
    planningCadence,
    rows,
  } = summary;

  // Znajdź tydzień docelowy planowania
  const targetRow = rows.find((r) => r.status === 'target_planning') || rows.find((r) => r.status === 'current');
  const targetWeekName = targetRow ? `${targetRow.week.week_num_in_month} (${targetRow.week.date_from} – ${targetRow.week.date_to})` : 'kolejny';
  
  const margin =
    nextWeekHanwFinal !== null && nextWeekFloorHours !== null
      ? Number((nextWeekHanwFinal - nextWeekFloorHours).toFixed(1))
      : 0;

  const trendPercent = ((trendVelocityMtd - 1) * 100).toFixed(1);
  const trendSign = Number(trendPercent) > 0 ? `+${trendPercent}%` : `${trendPercent}%`;

  // 1. Widok dla miesiąca przyszłego (np. Październik, Listopad)
  if (summary.monthTemporalStatus === 'future') {
    return (
      <div className="mb-6 p-5 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] shadow-xs flex items-start space-x-3.5">
        <div className="p-2.5 rounded-xl bg-[#DCFCE7] text-[#006241] border border-[#86EFAC] mt-0.5 shrink-0">
          <Calendar className="w-5 h-5 text-[#006241]" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#006241]">
                📅 Planowanie Miesiąca Przyszłego: {summary.month} {summary.year}
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#006241] border border-[#86EFAC]">
                Plan AOP
              </span>
            </div>
            <div className="text-[11px] font-bold text-[#5C6F68] bg-white px-2.5 py-1 rounded-lg border border-[#D0DCD6]">
              {summary.rows.length} tygodni planistycznych
            </div>
          </div>

          <p className="text-xs text-[#1E3932] mt-2 leading-relaxed">
            Miesiąc przyszły — wszystkie tygodnie są otwarte do planowania według założeń AOP.{' '}
            Budżet robocizny: <strong>{summary.planHoursTotal.toLocaleString('pl-PL')} h</strong> (Plan TRX:{' '}
            <strong>{summary.monthPlan.plan_trx.toLocaleString('pl-PL')}</strong>, Cel TPLH:{' '}
            <strong>{summary.monthPlan.target_tplh.toFixed(2)}</strong>).
          </p>

          <div className="mt-2.5 flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold bg-[#E8F5E9] text-[#006241] border-[#A5D6A7]">
              <span>🧑‍🤝‍🧑 Pula na extra zmiany w miesiącu:</span>
              <span className="text-sm font-black">{summary.surplusHours.toFixed(1)} h</span>
              <span className="text-[10px] font-medium opacity-70">
                (~{summary.surplusHoursPerWeek.toFixed(1)} h/tydz)
              </span>
            </div>
            <span className="text-[11px] text-[#5C6F68]">
              = Budżet {summary.earnedLaborBudget.toFixed(1)}h − Floor {summary.totalFloorHoursMonth.toFixed(1)}h − NC {(summary.ncBudgetTotal || 0).toFixed(1)}h
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Widok dla miesiąca przeszłego / rozliczonego (np. Sierpień, Lipiec)
  if (summary.monthTemporalStatus === 'past') {
    return (
      <div className="mb-6 p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] shadow-xs flex items-start space-x-3.5">
        <div className="p-2.5 rounded-xl bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] mt-0.5 shrink-0">
          <CheckCircle2 className="w-5 h-5 text-[#475569]" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#334155]">
                📋 Podsumowanie Zamkniętego Miesiąca: {summary.month} {summary.year}
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E2E8F0] text-[#475569] border border-[#CBD5E1]">
                Miesiąc Rozliczony
              </span>
            </div>
            {summary.totalActualTplh !== null && (
              <div className="text-[11px] font-black text-[#006241] bg-white px-2.5 py-1 rounded-lg border border-[#CBD5E1]">
                Realny TPLH: {summary.totalActualTplh.toFixed(2)}
              </div>
            )}
          </div>

          <p className="text-xs text-[#334155] mt-2 leading-relaxed">
            Miesiąc zamknięty. Wypracowany wynik:{' '}
            <strong>{summary.actualTrxMtd.toLocaleString('pl-PL')} TRX</strong> przy wykorzystaniu{' '}
            <strong>{summary.actualHoursMtd.toLocaleString('pl-PL')} h RCP</strong>.{' '}
            {summary.deltaEarnedHours >= 0 ? (
              <span className="text-[#006241] font-bold">Wypracowano nadwyżkę +{summary.deltaEarnedHours} h względem planu AOP.</span>
            ) : (
              <span className="text-[#DC2626] font-bold">Odchylenie od planu: {summary.deltaEarnedHours} h.</span>
            )}
          </p>
        </div>
      </div>
    );
  }

  // 3. Widok dla miesiąca bieżącego z alertem Floor Hours
  if (isFloorAlertTriggered) {
    return (
      <div className="mb-6 p-5 rounded-2xl bg-[#FEF2F2] border-2 border-[#F87171] text-[#7F1D1D] shadow-xs flex items-start space-x-3.5">
        <div className="p-2.5 rounded-xl bg-[#FEE2E2] text-[#DC2626] mt-0.5 shrink-0">
          <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black uppercase tracking-wide text-[#991B1B]">
              🚨 KRYTYCZNY DEFICYT: SPRZEDAŻ WYMUSZA CIĘCIA PONIŻEJ FLOOR HOURS
            </h4>
            {planningCadence && (
              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]">
                Planowanie w poniedziałek ({planningCadence.planningDeadlineDate})
              </span>
            )}
          </div>
          <p className="text-xs text-[#7F1D1D] mt-1.5 leading-relaxed">
            Trend sprzedaży i wypracowany budżet godzin sugerują redukcję poniżej minimum operacyjnego kawiarni.
            Grafik dla celu planowania <strong>{targetWeekName}</strong> został automatycznie zablokowany na poziomie bezpieczeństwa{' '}
            <strong>{nextWeekFloorHours?.toFixed(1)} h</strong>. Wymagana akceptacja i konsultacja z <strong>District Managerem (DM)</strong>.
          </p>
          {planningCadence && planningCadence.publishedWeekNum && (
            <p className="text-[11px] text-[#991B1B]/80 mt-1 font-medium">
              Uwaga: Grafik pośredni na tydzień <strong>{planningCadence.publishedWeekNum} ({planningCadence.publishedWeekDates})</strong> jest już opublikowany z obsadą <strong>{planningCadence.publishedScheduledHours.toFixed(1)} h</strong> i został zabezpieczony w kalkulacji.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-5 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] shadow-xs flex items-start space-x-3.5">
      <div className="p-2.5 rounded-xl bg-[#DCFCE7] text-[#006241] border border-[#86EFAC] mt-0.5 shrink-0">
        <Lightbulb className="w-5 h-5 text-[#006241]" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#006241]">
              💡 Rekomendacja Operacyjna dla Store Managera (Rytm Poniedziałkowy)
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#006241] border border-[#86EFAC]">
              Status: Bezpieczny
            </span>
          </div>
          {planningCadence && (
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-[#006241] bg-white px-2.5 py-1 rounded-lg border border-[#A7F3D0] shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-[#006241]" />
              <span>
                {planningCadence.isDeadlineToday
                  ? 'Dziś jest poniedziałek — dzień układania grafiku!'
                  : `Planowanie w poniedziałek ${planningCadence.planningDeadlineDate} (za ${planningCadence.daysUntilDeadline} dni)`}
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-[#1E3932] mt-2 leading-relaxed">
          Sprzedaż {trendVelocityMtd >= 1.0 ? 'stabilna i rosnąca' : 'poniżej założeń AOP'} ({trendSign} MTD).{' '}
          {deltaEarnedHours >= 0 ? (
            <>Kawiarnia wypracowała prawo do zwiększenia godzin o <strong>+{deltaEarnedHours} h</strong> w skali miesiąca. </>
          ) : (
            <>Konieczna dyscyplina godzinowa (odchylenie budżetu: <strong>{deltaEarnedHours} h</strong>). </>
          )}
          W najbliższy poniedziałek rozpisz grafik na <strong>{targetWeekName}</strong> w granicach{' '}
          <strong className="text-[#006241] font-black text-sm">{nextWeekHanwFinal !== null ? `${nextWeekHanwFinal.toFixed(1)} h` : '-'}</strong>.
        </p>

        {/* Kluczowa informacja: pula na dodatkowe zmiany */}
        <div className="mt-2 flex items-center gap-3 text-xs flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold ${
            summary.surplusHours > 0
              ? 'bg-[#E8F5E9] text-[#006241] border-[#A5D6A7]'
              : 'bg-[#FEF9C4] text-[#92400E] border-[#FDE68A]'
          }`}>
            <span>🧑‍🤝‍🧑 Pula na extra zmiany w miesiącu:</span>
            <span className="text-sm font-black">{summary.surplusHours.toFixed(1)} h</span>
            <span className="text-[10px] font-medium opacity-70">(~{summary.surplusHoursPerWeek.toFixed(1)} h/tydz)</span>
          </div>
          <span className="text-[11px] text-[#5C6F68]">
            = Earned {summary.earnedLaborBudget.toFixed(1)}h − Floor {summary.totalFloorHoursMonth.toFixed(1)}h − NC {(summary.ncBudgetTotal || 0).toFixed(1)}h
          </span>
        </div>

        {/* Informacja o Puli Baristów i obsadzie kierowniczej */}
        {targetRow && targetRow.managerHours !== undefined && targetRow.managerHours > 0 && (
          <div className="mt-2.5 flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]">
              <span>☕ Pula Baristów dla celu ({targetRow.week.week_num_in_month}):</span>
              <span className="text-sm font-black">{targetRow.baristaHoursPool?.toFixed(1) || '-'} h</span>
              <span className="text-[10px] font-normal text-blue-700">
                (Menedżerowie: <strong>{targetRow.managerHours.toFixed(1)}h</strong> na Janki, w tym {targetRow.managerCoverageHours?.toFixed(1)}h Coverage i {targetRow.managerNcHours?.toFixed(1)}h NC)
              </span>
            </div>
            {summary.ncPlannedVsBudget && (
              <span className="text-[11px] text-stone-500">
                Budżet NC miesiąca: <strong>{summary.ncPlannedVsBudget.plannedNcHours.toFixed(1)}h</strong> / {summary.ncPlannedVsBudget.budgetNcHours.toFixed(1)}h reguł
              </span>
            )}
          </div>
        )}

        {planningCadence && (
          <div className="mt-2.5 pt-2 border-t border-[#BBF7D0]/60 flex flex-col gap-1.5 text-[11px] text-[#2D5A46]">
            {planningCadence.currentWeekNum && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse shrink-0" />
                <span>
                  Trwa tydzień <strong>{planningCadence.currentWeekNum} ({planningCadence.currentWeekDates})</strong> — rejestrowane godziny RCP i transakcje są <strong>cząstkowe</strong>. Pełne zamknięcie tygodnia i zasilenie silnika MTD nastąpi w poniedziałek <strong>{planningCadence.planningDeadlineDate}</strong>.
                </span>
              </div>
            )}
            {planningCadence.publishedWeekNum && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#006241] shrink-0" />
                <span>
                  Grafik na tydzień <strong>{planningCadence.publishedWeekNum} ({planningCadence.publishedWeekDates})</strong> jest opublikowany (<strong>{planningCadence.publishedScheduledHours.toFixed(1)} h</strong>) i został zabezpieczony w kalkulacji.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
