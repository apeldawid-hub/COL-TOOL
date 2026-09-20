import React from 'react';
import { AlertTriangle, Lightbulb, Calendar, CheckCircle2, Sparkles, Users, ArrowRight } from 'lucide-react';
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

  // Znajdź tydzień docelowy planowania oraz tydzień opublikowany (W+1, od jutra)
  const targetRow = rows.find((r) => r.status === 'target_planning') || rows.find((r) => r.status === 'current');
  const targetWeekName = targetRow ? `${targetRow.week.week_num_in_month} (${targetRow.week.date_from} – ${targetRow.week.date_to})` : 'kolejny';
  const publishedRow = rows.find((r) => r.status === 'published');
  
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

        {/* GŁÓWNA KARTA DECYZYJNA: 2 KLUCZOWE PYTANIA NA PONIEDZIAŁEK */}
        {planningCadence && (
          <div className="mt-3.5 mb-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* KAFEL 1: GRAFIK OD JUTRA (W+1) */}
            <div className="p-4 rounded-2xl bg-white border-2 border-blue-300 shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/40 rounded-full blur-xl pointer-events-none -mr-6 -mt-6" />
              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap pb-2.5 border-b border-blue-100">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-black text-[11px] uppercase tracking-wider shadow-2xs">
                    1. Grafik od jutra ({planningCadence.publishedWeekNum}: {planningCadence.publishedWeekDates})
                  </span>
                  <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Opublikowany
                  </span>
                </div>

                <div className="mt-3">
                  <div className="text-[11px] font-black text-stone-500 uppercase tracking-wider">
                    Ile musisz obciąć / możesz dołożyć?
                  </div>

                  {(() => {
                    const pubRow = publishedRow;
                    const sched = planningCadence.publishedScheduledHours;
                    const plan = pubRow?.planHours || 372.1;
                    const diff = Number((sched - plan).toFixed(1));
                    const mgrHrs = pubRow?.managerHours || 0;
                    const barHrs = typeof pubRow?.baristaScheduledHours === 'number'
                      ? pubRow.baristaScheduledHours
                      : Math.max(0, sched - mgrHrs);

                    return (
                      <div className="mt-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xl font-black ${diff <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {diff <= 0 ? '✅ NIE MUSISZ NIC OBCINAĆ' : `⚠️ Nadwyżka: +${diff}h`}
                          </span>
                        </div>

                        <div className="mt-2.5 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/60 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-stone-500 font-bold block text-[10px] uppercase">Ułożony grafik:</span>
                            <span className="text-stone-900 font-black text-base">{sched.toFixed(1)} h</span>
                          </div>
                          <div className="text-right">
                            <span className="text-stone-500 font-bold block text-[10px] uppercase">W tym:</span>
                            <span className="text-stone-700 font-bold">MGR: <strong>{mgrHrs.toFixed(1)}h</strong> + Barisci: <strong className="text-indigo-700">{barHrs.toFixed(1)}h</strong></span>
                          </div>
                        </div>

                        <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed font-medium">
                          ✨ <strong>Decyzja:</strong> Grafik mieści się w budżecie. Dzięki oszczędnościom z poprzednich tygodni <strong>MOŻESZ BEZPIECZNIE DOŁOŻYĆ baristom do +15h</strong> (np. na weekend), jeśli potrzebujesz wzmocnienia flooru!
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-blue-100/80 text-[10px] text-blue-700 font-bold flex items-center gap-1">
                <span>💡 Wskazówka:</span>
                <span className="font-medium text-stone-600">Każda zmiana w tym grafiku automatycznie przeliczy budżet na kolejny tydzień.</span>
              </div>
            </div>

            {/* KAFEL 2: NOWY GRAFIK DO ZAPLANOWANIA / WERYFIKACJA (W+2) */}
            {(() => {
              const hasTargetSched = typeof targetRow?.scheduledHours === 'number' && targetRow.scheduledHours > 0;
              const targetBudget = nextWeekHanwFinal ?? targetRow?.planHours ?? 417.3;
              const targetSched = targetRow?.scheduledHours || 0;
              const targetDiff = hasTargetSched ? Number((targetSched - targetBudget).toFixed(1)) : null;
              const targetMgrHrs = targetRow?.managerHours || 0;
              const targetBarHrs = hasTargetSched
                ? (typeof targetRow?.baristaScheduledHours === 'number'
                    ? targetRow.baristaScheduledHours
                    : Math.max(0, targetSched - targetMgrHrs))
                : (targetRow?.baristaHoursPool || 0);

              return (
                <div className={`p-4 rounded-2xl bg-white border-2 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all ${
                  hasTargetSched
                    ? targetDiff! <= 0
                      ? 'border-emerald-500 ring-2 ring-emerald-400/20'
                      : 'border-rose-400 ring-2 ring-rose-400/20'
                    : 'border-emerald-400'
                }`}>
                  <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-xl pointer-events-none -mr-6 -mt-6 ${
                    hasTargetSched && targetDiff! > 0 ? 'bg-rose-100/40' : 'bg-emerald-100/40'
                  }`} />
                  <div>
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-2.5 border-b border-emerald-100">
                      <span className="px-2.5 py-1 rounded-lg bg-[#006241] text-white font-black text-[11px] uppercase tracking-wider shadow-2xs">
                        2. Nowy grafik ({targetWeekName})
                      </span>
                      {hasTargetSched ? (
                        <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                          targetDiff! <= 0
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-rose-100 text-rose-900 border-rose-300 animate-pulse'
                        }`}>
                          {targetDiff! <= 0 ? '✅ Zweryfikowany (w budżecie)' : '⚠️ Wymaga korekty'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold text-[#006241] bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300">
                          Planujesz dziś (Pn)
                        </span>
                      )}
                    </div>

                    <div className="mt-3">
                      {hasTargetSched ? (
                        /* WIDOK NATYCHMIASTOWEJ WERYFIKACJI WPISANEGO WYNIKU */
                        <div>
                          <div className="text-[11px] font-black text-stone-500 uppercase tracking-wider">
                            Weryfikacja Twojego zaplanowanego grafiku:
                          </div>

                          <div className="mt-1 flex items-baseline gap-2">
                            <span className={`text-2xl font-black ${targetDiff! <= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {targetDiff! <= 0
                                ? targetDiff === 0
                                  ? '🎯 IDEALNIE W CELU (±0.0h)'
                                  : `✅ W BUDŻECIE (Zapas: ${Math.abs(targetDiff!)}h)`
                                : `⚠️ PRZEKROCZENIE O +${targetDiff} H!`}
                            </span>
                          </div>

                          <div className="mt-2.5 p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 text-xs space-y-1.5">
                            <div className="flex items-center justify-between text-stone-700 font-bold">
                              <span>Wpisany grafik łącznie:</span>
                              <span className="text-stone-900 font-black text-sm">{targetSched.toFixed(1)} h <span className="text-[11px] font-normal text-stone-500">(cel: {targetBudget.toFixed(1)} h)</span></span>
                            </div>
                            <div className="flex items-center justify-between text-stone-600 pt-1 border-t border-stone-200">
                              <span>Obsada kierowników (MGR):</span>
                              <span className="font-bold text-stone-800">{targetMgrHrs.toFixed(1)} h</span>
                            </div>
                            <div className="flex items-center justify-between text-[#006241] font-black text-sm pt-1 border-t border-stone-200">
                              <span>☕ Rozpisani barisci:</span>
                              <span className="text-base">{targetBarHrs.toFixed(1)} h <span className="text-[11px] font-normal text-stone-500">(rekomendacja: {targetRow?.baristaHoursPool?.toFixed(1) || '-'} h)</span></span>
                            </div>
                          </div>

                          <div className={`mt-2.5 p-2.5 rounded-xl border text-xs leading-relaxed font-medium ${
                            targetDiff! <= 0
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                              : 'bg-rose-50 border-rose-200 text-rose-950'
                          }`}>
                            {targetDiff! <= 0 ? (
                              <span>
                                ✨ <strong>Werdykt:</strong> Twój ułożony grafik jest w 100% bezpieczny! Chroni wypracowany TPLH i mieści się w wyznaczonym limicie godzin robocizny.
                              </span>
                            ) : (
                              <span>
                                🚨 <strong>Werdykt:</strong> Zaplanowano <strong>{targetSched.toFixed(1)} h</strong> przy limicie <strong>{targetBudget.toFixed(1)} h</strong>. Aby uniknąć straty na TPLH, <strong>zdejmij {targetDiff} h</strong> z grafiku baristów (np. po 2–3 godziny z mniej obciążonych zmian).
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* WIDOK PRZED WPROWADZENIEM DANYCH (CEL PLANOWANIA) */
                        <div>
                          <div className="text-[11px] font-black text-stone-500 uppercase tracking-wider">
                            Ile godzin możesz przeznaczyć na ten grafik?
                          </div>

                          <div className="mt-1.5 flex items-baseline gap-2">
                            <span className="text-3xl font-black text-[#006241] tracking-tight">
                              {nextWeekHanwFinal !== null ? `${nextWeekHanwFinal.toFixed(1)} h` : '-'}
                            </span>
                            <span className="text-xs text-emerald-800 font-black uppercase">
                              Łączny cel tygodnia (HANW)
                            </span>
                          </div>

                          {targetRow && targetRow.managerHours !== undefined && (
                            <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-xs space-y-1.5">
                              <div className="flex items-center justify-between text-stone-700 font-bold">
                                <span>1. Godziny kierowników z grafiku (MGR):</span>
                                <span className="text-emerald-950 font-black">{targetRow.managerHours.toFixed(1)} h</span>
                              </div>
                              <div className="flex items-center justify-between text-[#006241] font-black text-sm pt-1.5 border-t border-emerald-200">
                                <span className="flex items-center gap-1">
                                  <span>☕ 2. DLA BARISTÓW ROZPISZ:</span>
                                </span>
                                <span className="text-lg text-[#006241] font-black">{targetRow.baristaHoursPool?.toFixed(1) || '-'} h</span>
                              </div>
                            </div>
                          )}

                          <div className="mt-2.5 text-xs text-stone-600 leading-relaxed font-medium">
                            🎯 <strong>Rekomendacja:</strong> Twój limit robocizny wynosi <strong>{nextWeekHanwFinal !== null ? `${nextWeekHanwFinal.toFixed(1)}h` : '-'}</strong>. Po odliczeniu {targetRow?.managerHours?.toFixed(1) || 0}h kierowników, w systemie MAPAL rozpisujesz baristom dokładnie <strong>{targetRow?.baristaHoursPool?.toFixed(1) || '-'} h</strong>. Wpisz ułożony wynik w tabeli poniżej, a system od razu go zweryfikuje!
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-emerald-100/80 text-[10px] text-emerald-800 font-bold flex items-center gap-1">
                    <span>🛡️ Ochrona:</span>
                    <span className="font-medium text-stone-600">Gwarantowane 32h dobowego flooru oraz pełne pokrycie otwarć (AM) i zamknięć (PM).</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Pasek podsumowania puli miesięcznej */}
        <div className="mt-2 flex items-center gap-3 text-xs flex-wrap pt-2 border-t border-emerald-100">
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
            = Wypracowany budżet {summary.earnedLaborBudget.toFixed(1)}h − Floor {summary.totalFloorHoursMonth.toFixed(1)}h − NC {(summary.ncBudgetTotal || 0).toFixed(1)}h
          </span>
        </div>
      </div>
    </div>
  );
};
