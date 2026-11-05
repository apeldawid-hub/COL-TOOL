import type {
  AopPlanRecord,
  WeeklyCalculatedRow,
  EnsembleForecastResult,
} from '../../../../types';

export class EnsembleForecastEngine {
  /**
   * Silnik Predykcji Zespołowej (Multi-Model Ensemble Forecasting):
   * Łączy 3 niezależne modele analityczne w zbalansowaną prognozę z przedziałem ufności:
   * 1. Model AOP MTD Velocity (waga 35–60%) — oficjalna kotwica planu korporacyjnego
   * 2. Krótkoterminowy Run-Rate z wykładniczymi wagami (waga 30–50%) — najnowsza dynamika z ostatnich tygodni
   * 3. Model Sezonowości Bliźniaczej YoY (waga 15–35%) — historyczne wykonanie dla tego samego miesiąca
   */
  public static calculateEnsembleForecast(
    aopPlan: AopPlanRecord,
    historicalPlans: AopPlanRecord[],
    closedRows: WeeklyCalculatedRow[],
    monthTemporalStatus: 'past' | 'current' | 'future',
    planTrxTotal: number,
    targetTplh: number
  ): EnsembleForecastResult {
    const rowsWithTrx = closedRows.filter((r) => r.actualTrx !== null && r.actualTrx > 0);
    const planTrxForTrend = rowsWithTrx.reduce((s, r) => s + r.planTrx, 0);
    const actTrxForTrend = rowsWithTrx.reduce((s, r) => s + (r.actualTrx || 0), 0);

    // 1. Model AOP MTD:
    let aopVelocity = 1.0;
    if (monthTemporalStatus === 'past' && aopPlan.actual_trx && aopPlan.actual_trx > 0 && planTrxTotal > 0) {
      aopVelocity = Number((aopPlan.actual_trx / planTrxTotal).toFixed(4));
    } else if (rowsWithTrx.length > 0 && planTrxForTrend > 0) {
      aopVelocity = Number((actTrxForTrend / planTrxForTrend).toFixed(4));
    }

    // 2. Model Krótkiego Run-Rate (Wykładnicza Recencja):
    let runRateVelocity = aopVelocity;
    let hasRunRateData = false;
    if (rowsWithTrx.length > 1) {
      hasRunRateData = true;
      let weightedSum = 0;
      let totalWeight = 0;
      rowsWithTrx.forEach((r, idx) => {
        const weekRatio = (r.actualTrx || 0) / (r.planTrx || 1);
        const weight = Math.pow(1.8, idx);
        weightedSum += weekRatio * weight;
        totalWeight += weight;
      });
      if (totalWeight > 0) {
        runRateVelocity = Number((weightedSum / totalWeight).toFixed(4));
      }
    } else if (rowsWithTrx.length === 1) {
      runRateVelocity = aopVelocity;
      hasRunRateData = true;
    }

    // 3. Model Sezonowości Bliźniaczej YoY:
    let yoyVelocity = 1.0;
    let hasYoYData = false;
    const sameMonthHistory = (historicalPlans || []).filter(
      (p) =>
        p.month === aopPlan.month &&
        p.year < aopPlan.year &&
        typeof p.actual_trx === 'number' &&
        p.actual_trx > 0 &&
        typeof p.plan_trx === 'number' &&
        p.plan_trx > 0
    );

    if (sameMonthHistory.length > 0) {
      hasYoYData = true;
      const totalHistPlan = sameMonthHistory.reduce((sum, p) => sum + (p.plan_trx || 0), 0);
      const totalHistAct = sameMonthHistory.reduce((sum, p) => sum + (p.actual_trx || 0), 0);
      if (totalHistPlan > 0) {
        yoyVelocity = Number((totalHistAct / totalHistPlan).toFixed(4));
      }
    } else {
      const anyHistory = (historicalPlans || []).filter(
        (p) =>
          typeof p.actual_trx === 'number' &&
          p.actual_trx > 0 &&
          typeof p.plan_trx === 'number' &&
          p.plan_trx > 0
      );
      if (anyHistory.length > 0) {
        const totalHistPlan = anyHistory.reduce((sum, p) => sum + (p.plan_trx || 0), 0);
        const totalHistAct = anyHistory.reduce((sum, p) => sum + (p.actual_trx || 0), 0);
        if (totalHistPlan > 0) {
          yoyVelocity = Number((totalHistAct / totalHistPlan).toFixed(4));
        }
      }
    }

    // 4. Dobór Wag Zespołu (Ensemble Weight Optimization):
    let aopWeight = 0.50;
    let runRateWeight = 0.30;
    let yoyWeight = 0.20;

    if (monthTemporalStatus === 'past') {
      aopWeight = 1.0;
      runRateWeight = 0.0;
      yoyWeight = 0.0;
    } else if (rowsWithTrx.length === 0) {
      if (hasYoYData) {
        aopWeight = 0.65;
        yoyWeight = 0.35;
        runRateWeight = 0.0;
      } else {
        aopWeight = 1.0;
        yoyWeight = 0.0;
        runRateWeight = 0.0;
      }
    } else if (rowsWithTrx.length === 1) {
      aopWeight = 0.50;
      runRateWeight = 0.30;
      yoyWeight = hasYoYData ? 0.20 : 0.0;
      if (!hasYoYData) {
        aopWeight = 0.60;
        runRateWeight = 0.40;
      }
    } else {
      aopWeight = 0.35;
      runRateWeight = 0.50;
      yoyWeight = hasYoYData ? 0.15 : 0.0;
      if (!hasYoYData) {
        aopWeight = 0.40;
        runRateWeight = 0.60;
      }
    }

    const sumW = aopWeight + runRateWeight + yoyWeight;
    aopWeight = Number((aopWeight / sumW).toFixed(2));
    runRateWeight = Number((runRateWeight / sumW).toFixed(2));
    yoyWeight = Number((1 - aopWeight - runRateWeight).toFixed(2));

    const blendedVelocity = Number(
      (aopWeight * aopVelocity + runRateWeight * runRateVelocity + yoyWeight * yoyVelocity).toFixed(4)
    );

    const allVelocities = [aopVelocity, runRateVelocity, yoyVelocity].filter((v) => v > 0);
    const minVel = Math.min(...allVelocities);
    const maxVel = Math.max(...allVelocities);

    const minFactor = Math.max(0.85, Math.min(blendedVelocity * 0.985, minVel));
    const maxFactor = Math.min(1.25, Math.max(blendedVelocity * 1.015, maxVel));

    let confidenceScore = 75;
    if (monthTemporalStatus === 'past') confidenceScore = 100;
    else {
      if (rowsWithTrx.length >= 2) confidenceScore += 15;
      else if (rowsWithTrx.length === 1) confidenceScore += 8;
      if (hasYoYData) confidenceScore += 7;
      if (Math.abs(maxFactor - minFactor) < 0.06) confidenceScore += 3;
    }
    confidenceScore = Math.min(99, confidenceScore);

    return {
      aopVelocity,
      runRateVelocity,
      yoyVelocity,
      blendedVelocity,
      weights: { aopWeight, runRateWeight, yoyWeight },
      forecastTrxRange: {
        min: Math.round(planTrxTotal * minFactor),
        expected: Math.round(planTrxTotal * blendedVelocity),
        max: Math.round(planTrxTotal * maxFactor),
      },
      earnedLaborRange: {
        floorSafe: Number(((planTrxTotal * minFactor) / targetTplh).toFixed(1)),
        balanced: Number(((planTrxTotal * blendedVelocity) / targetTplh).toFixed(1)),
        growth: Number(((planTrxTotal * maxFactor) / targetTplh).toFixed(1)),
      },
      confidenceScore,
      modelExplanation: `Zespół 3 modeli: AOP (${Math.round(aopWeight * 100)}%), Run-Rate (${Math.round(runRateWeight * 100)}%), Sezonowość YoY (${Math.round(yoyWeight * 100)}%).`,
      hasYoYData,
      hasRunRateData,
    };
  }
}
