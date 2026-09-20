import {
  ColStoreInfo,
  ColKpiTargetEst,
  ColManagerItem,
  ColCrewUopItem,
  ColCrewUzItem,
  ColOtherItem,
  ColCalculatedSummary
} from '../types/colTypes';

export class ColEngine {
  // Global rates from DANE sheet
  static readonly SOCIAL_INSURANCE_RATE = 0.1693; // 16.93%
  static readonly FGSP_FP_RATE = 0.0255; // 2.55%
  static readonly TOTAL_ZUS_RATE = 0.1948; // 19.48%
  static readonly PFRON_PER_FTE = 200; // 200 zł / etat
  static readonly EQUIVALENT_CREW_HOURLY = 0.85; // 0.85 zł / h
  static readonly SICK_LEAVE_MGR_RATE = 0.2; // 20%
  static readonly SICK_LEAVE_CREW_RATE = 0.8; // 80%

  static getManagerRyczałt(position: string) {
    if (position === 'SM') {
      return { equiv: 300, pfron: 200, compBen: 300, jpa: 367 };
    }
    if (position === 'ASM') {
      return { equiv: 300, pfron: 200, compBen: 250, jpa: 0 };
    }
    if (position.startsWith('SSV')) {
      return { equiv: 350, pfron: 200, compBen: 200, jpa: 0 };
    }
    return { equiv: 0, pfron: 0, compBen: 0, jpa: 0 };
  }

  static calculate(
    storeInfo: ColStoreInfo,
    kpis: ColKpiTargetEst,
    managers: ColManagerItem[],
    crewUop: ColCrewUopItem[],
    crewUz: ColCrewUzItem[],
    otherCosts: ColOtherItem[]
  ): ColCalculatedSummary {
    const fullHours = storeInfo.fullContractHours || 176;
    const minWageMonth = 4666 / fullHours; // np. 26.51136...

    // 1. MANAGERS
    let mgrHoursPlan = 0;
    let mgrHoursEst = 0;
    let payrollMgrPlan = 0;
    let payrollMgrEst = 0;
    let bonusMgrPlan = 0;
    let bonusMgrEst = 0;
    let socialMgrPlan = 0;
    let socialMgrEst = 0;
    let pfronMgrPlan = 0;
    let pfronMgrEst = 0;
    let socialFundMgrPlan = 0;
    let socialFundMgrEst = 0;
    let otherMgrPlan = 0;
    let otherMgrEst = 0;
    let totalMgrPlan = 0;
    let totalMgrEst = 0;

    for (const m of managers) {
      mgrHoursPlan += m.planWorkHours;
      mgrHoursEst += m.estWorkHours;

      if (m.position === 'DM costs') {
        const pBonus = m.planBonus;
        const eBonus = m.estBonus;
        const pZus = pBonus * this.SOCIAL_INSURANCE_RATE;
        const eZus = eBonus * this.SOCIAL_INSURANCE_RATE;
        bonusMgrPlan += pBonus;
        bonusMgrEst += eBonus;
        socialMgrPlan += pZus;
        socialMgrEst += eZus;
        totalMgrPlan += pBonus + pZus;
        totalMgrEst += eBonus + eZus;
        continue;
      }

      if (m.position === 'Holiday accrual') {
        // Holiday accrual directly in base salary
        payrollMgrPlan += m.baseSalary;
        payrollMgrEst += m.estBonus;
        totalMgrPlan += m.baseSalary;
        totalMgrEst += m.estBonus;
        continue;
      }

      if (m.isSpecialRow) {
        continue;
      }

      const rycz = this.getManagerRyczałt(m.position);
      const storeCost = m.storeCostRatio ?? 1;

      // Plan calculations
      const planSickDeduction = (m.baseSalary / fullHours) * m.planSickHours * this.SICK_LEAVE_MGR_RATE;
      const tBasic = m.contractRatio * m.baseSalary * storeCost - planSickDeduction;
      const tBonus = m.planBonus;
      const tEquiv = rycz.equiv * m.contractRatio * storeCost;
      const tPfron = m.contractRatio * rycz.pfron * storeCost;
      const tCompBen = rycz.compBen * storeCost;
      const tJpa = rycz.jpa * m.contractRatio * storeCost;

      const baseForZusTarget = tBasic + tBonus + tCompBen + tJpa;
      const tSocial = baseForZusTarget * this.SOCIAL_INSURANCE_RATE - (planSickDeduction * this.SOCIAL_INSURANCE_RATE * this.SICK_LEAVE_MGR_RATE);
      const tFgspFp = baseForZusTarget * this.FGSP_FP_RATE;
      const tColTotal = tBasic + tBonus + tSocial + tFgspFp + tEquiv + tPfron + tCompBen + tJpa;

      // Est calculations
      const estSickDeduction = (m.baseSalary / fullHours) * m.estSickHours * this.SICK_LEAVE_MGR_RATE;
      const eBasic = m.contractRatio * m.baseSalary * storeCost - estSickDeduction;
      const eBonus = m.estBonus;
      const eEquiv = rycz.equiv * m.contractRatio * storeCost;
      const ePfron = m.contractRatio * rycz.pfron * storeCost;
      const eCompBen = rycz.compBen * storeCost;
      const eJpa = rycz.jpa * m.contractRatio * storeCost;

      const baseForZusEst = eBasic + eBonus + eCompBen + eJpa;
      const eSocial = baseForZusEst * this.SOCIAL_INSURANCE_RATE - (estSickDeduction * this.SOCIAL_INSURANCE_RATE * this.SICK_LEAVE_MGR_RATE);
      const eFgspFp = baseForZusEst * this.FGSP_FP_RATE;
      const eColTotal = eBasic + eBonus + eSocial + eFgspFp + eEquiv + ePfron + eCompBen + eJpa;

      payrollMgrPlan += tBasic + tEquiv;
      payrollMgrEst += eBasic + eEquiv;
      bonusMgrPlan += tBonus + tJpa;
      bonusMgrEst += eBonus + eJpa;
      socialMgrPlan += tSocial;
      socialMgrEst += eSocial;
      pfronMgrPlan += tPfron;
      pfronMgrEst += ePfron;
      socialFundMgrPlan += tFgspFp;
      socialFundMgrEst += eFgspFp;
      otherMgrPlan += tCompBen;
      otherMgrEst += eCompBen;
      totalMgrPlan += tColTotal;
      totalMgrEst += eColTotal;
    }

    // Add PPK Manager to social contribution and manager total
    const ppkMgrPlan = otherCosts.find(o => o.label === 'PPK')?.planVal || 250;
    const ppkMgrEst = otherCosts.find(o => o.label === 'PPK')?.estVal || 250;
    socialMgrPlan += ppkMgrPlan;
    socialMgrEst += ppkMgrEst;
    totalMgrPlan += ppkMgrPlan;
    totalMgrEst += ppkMgrEst;

    // 2. CREW UMOWA O PRACĘ (UoP)
    let uopHoursPlan = 0;
    let uopHoursEst = 0;
    let uopBasicPlan = 0;
    let uopBasicEst = 0;
    let uopEquivPlan = 0;
    let uopEquivEst = 0;
    let uopSocialPlan = 0;
    let uopSocialEst = 0;
    let uopFgspFpPlan = 0;
    let uopFgspFpEst = 0;
    let uopPfronPlan = 0;
    let uopPfronEst = 0;
    let uopSickPlan = 0;
    let uopSickEst = 0;
    let uopHolidayPlan = 0;
    let uopHolidayEst = 0;

    for (const u of crewUop) {
      uopHoursPlan += u.planWorkHours;
      uopHoursEst += u.estWorkHours;

      const effRate = u.hourlyRate < minWageMonth ? minWageMonth : u.hourlyRate;

      // Plan
      const tBasic = effRate * u.planWorkHours;
      const tSocial = tBasic * this.SOCIAL_INSURANCE_RATE;
      const tFgspFp = tBasic * this.FGSP_FP_RATE;
      const tEquiv = u.planWorkHours * this.EQUIVALENT_CREW_HOURLY;
      const tPfron = u.contractRatio * this.PFRON_PER_FTE;

      // Sick leave plan
      const tSick = u.planSickHours * effRate * this.SICK_LEAVE_CREW_RATE;
      const tHoliday = u.planHolidayHours * effRate;

      // Est
      const eBasic = effRate * u.estWorkHours;
      const eSocial = eBasic * this.SOCIAL_INSURANCE_RATE;
      const eFgspFp = eBasic * this.FGSP_FP_RATE;
      const eEquiv = u.estWorkHours * this.EQUIVALENT_CREW_HOURLY;
      const ePfron = u.contractRatio * this.PFRON_PER_FTE;

      const eSick = u.estSickHours * effRate * this.SICK_LEAVE_CREW_RATE;
      const eHoliday = u.estHolidayHours * effRate;

      uopBasicPlan += tBasic;
      uopBasicEst += eBasic;
      uopEquivPlan += tEquiv;
      uopEquivEst += eEquiv;
      uopSocialPlan += tSocial;
      uopSocialEst += eSocial;
      uopFgspFpPlan += tFgspFp;
      uopFgspFpEst += eFgspFp;
      uopPfronPlan += tPfron;
      uopPfronEst += ePfron;
      uopSickPlan += tSick;
      uopSickEst += eSick;
      uopHolidayPlan += tHoliday;
      uopHolidayEst += eHoliday;
    }

    // 3. CREW UMOWA ZLECENIE (UZ)
    let uzHoursPlan = 0;
    let uzHoursEst = 0;
    let uzBasicPlan = 0;
    let uzBasicEst = 0;
    let uzBonusEst = 0;

    for (const z of crewUz) {
      uzHoursPlan += z.planWorkHours;
      uzHoursEst += z.estWorkHours;
      uzBasicPlan += z.hourlyRate * z.planWorkHours;
      uzBasicEst += z.hourlyRate * z.estWorkHours;
      uzBonusEst += z.bonus || 0;
    }

    // 4. OTHER COSTS & DRIVERS
    const medExam = otherCosts.find(o => o.label.includes('Medical'))?.planVal || 150;
    const adpCost = otherCosts.find(o => o.label === 'ADP')?.planVal || 600;
    const bonusCrewPlan = otherCosts.find(o => o.label === 'Bonus CREW')?.planVal || 600;
    const bonusCrewEst = otherCosts.find(o => o.label === 'Bonus CREW')?.estVal || 400;

    // Social contribution from other items
    const bonusSsvZusPlan = (kpis.salesTarget * 0.001) * this.SOCIAL_INSURANCE_RATE;
    const bonusSsvZusEst = (otherCosts.find(o => o.label === 'Bonus SSV No Area')?.estVal || 300) * this.SOCIAL_INSURANCE_RATE;
    const bonusCrewZusPlan = (bonusCrewPlan) * this.SOCIAL_INSURANCE_RATE;
    const bonusCrewZusEst = (bonusCrewEst) * this.SOCIAL_INSURANCE_RATE;

    const driversPlanTrx = otherCosts.find(o => o.label === 'Drivers')?.planVal || 220;
    const driversEstTrx = otherCosts.find(o => o.label === 'Drivers')?.estVal || 206;
    const costPerDrop = otherCosts.find(o => o.label === 'Drivers')?.extraMeta?.costPerDrop || 14;
    const driversCostPlan = driversPlanTrx * costPerDrop;
    const driversCostEst = driversEstTrx * costPerDrop;

    // Crew Totals
    const payrollCrewPlan = uopBasicPlan + uopSickPlan + uopHolidayPlan + uopEquivPlan + uzBasicPlan;
    const payrollCrewEst = uopBasicEst + uopSickEst + uopHolidayEst + uopEquivEst + uzBasicEst;

    const socialCrewPlan = uopSocialPlan + bonusSsvZusPlan + bonusCrewZusPlan;
    const socialCrewEst = uopSocialEst + bonusSsvZusEst + bonusCrewZusEst;

    const pfronCrewPlan = uopPfronPlan;
    const pfronCrewEst = uopPfronEst;

    const socialFundCrewPlan = uopFgspFpPlan;
    const socialFundCrewEst = uopFgspFpEst;

    const otherCrewPlan = medExam + adpCost;
    const otherCrewEst = medExam + adpCost;

    const totalCrewPlan = uopBasicPlan + uopEquivPlan + uzBasicPlan + bonusCrewPlan + socialCrewPlan + pfronCrewPlan + socialFundCrewPlan + otherCrewPlan;
    const totalCrewEst = uopBasicEst + uopEquivEst + uzBasicEst + bonusCrewEst + socialCrewEst + pfronCrewEst + socialFundCrewEst + otherCrewEst;

    // Overall Totals
    const colPlanTotal = totalMgrPlan + totalCrewPlan + driversCostPlan;
    const colEstTotal = totalMgrEst + totalCrewEst + driversCostEst;

    const colPlanPct = kpis.salesTarget > 0 ? colPlanTotal / kpis.salesTarget : 0;
    const colEstPct = kpis.salesEst > 0 ? colEstTotal / kpis.salesEst : 0;

    const crewHoursPlan = uopHoursPlan + uzHoursPlan;
    const crewHoursEst = uopHoursEst + uzHoursEst;
    const totalWorkingHoursPlan = mgrHoursPlan + crewHoursPlan;
    const totalWorkingHoursEst = mgrHoursEst + crewHoursEst;

    const aopTplh = kpis.tplhAop && kpis.tplhAop > 0 ? kpis.tplhAop : (kpis.tplhTarget > 0 ? kpis.tplhTarget : 6.7);
    const totalWorkingHoursAop = aopTplh > 0 ? kpis.trxAop / aopTplh : 0;
    const managerHoursAop = mgrHoursPlan;
    const crewHoursAop = Math.max(0, totalWorkingHoursAop - managerHoursAop);

    const tplhTotalPlan = totalWorkingHoursPlan > 0 ? kpis.trxTarget / totalWorkingHoursPlan : 0;
    const tplhTotalEst = totalWorkingHoursEst > 0 ? kpis.trxEst / totalWorkingHoursEst : 0;
    const tplhTotalAop = aopTplh;

    const coverageHoursPlan = totalWorkingHoursPlan - kpis.nonCoverageHolidayTarget - kpis.nonCoverageTrainingTarget;
    const coverageHoursEst = totalWorkingHoursEst - kpis.nonCoverageHolidayEst - kpis.nonCoverageTrainingTarget;
    const coverageHoursAop = totalWorkingHoursAop - kpis.nonCoverageHolidayTarget - kpis.nonCoverageTrainingTarget;
    const tplhCoveragePlan = coverageHoursPlan > 0 ? kpis.trxTarget / coverageHoursPlan : 0;
    const tplhCoverageEst = coverageHoursEst > 0 ? kpis.trxEst / coverageHoursEst : 0;
    const tplhCoverageAop = coverageHoursAop > 0 ? kpis.trxAop / coverageHoursAop : 0;

    const budgetWorkingHours = kpis.tplhTarget > 0 ? kpis.trxTarget / kpis.tplhTarget : 0;
    const budgetWorkingHoursAop = aopTplh > 0 ? kpis.trxAop / aopTplh : 0;

    // AOP COL Calculations
    const avgCrewCostHourly = crewHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
    const colAopTotal = totalMgrPlan + (crewHoursAop * avgCrewCostHourly) + driversCostPlan + (otherCosts.reduce((s, o) => s + o.planVal, 0));
    const colAopPct = kpis.salesAop > 0 ? (colAopTotal / kpis.salesAop) : 0;

    // What-If TPLH Improvement impact
    const improvedTplh = kpis.whatIfTplhImprovement || 7.0;
    const hoursWithImprovedTplh = improvedTplh > 0 ? kpis.trxTarget / improvedTplh : 0;
    const hoursSaved = Math.max(0, totalWorkingHoursPlan - hoursWithImprovedTplh);
    const avgCrewHourlyCost = totalWorkingHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
    const whatIfColSavings = hoursSaved * avgCrewHourlyCost;
    const whatIfColPctInfluence = kpis.salesTarget > 0 ? (whatIfColSavings / kpis.salesTarget) * 100 : 0;

    // Total contracts (FTE)
    const mgrFte = managers.filter(m => !m.isSpecialRow).reduce((acc, m) => acc + m.contractRatio, 0);
    const uopFte = crewUop.reduce((acc, u) => acc + u.contractRatio, 0);
    const uzFte = uzHoursPlan / fullHours;
    const totalContracts = mgrFte + uopFte + uzFte;

    // Wariancje
    const deltaEstVsAopPln = colEstTotal - colAopTotal;
    const deltaEstVsAopPct = (colEstPct - colAopPct) * 100;
    const deltaEstVsTargetPln = colEstTotal - colPlanTotal;
    const deltaEstVsTargetPct = (colEstPct - colPlanPct) * 100;
    const deltaTargetVsAopPln = colPlanTotal - colAopTotal;
    const deltaTargetVsAopPct = (colPlanPct - colAopPct) * 100;

    return {
      colPlanTotal,
      colEstTotal,
      colAopTotal,
      colPnlTotal: 0,
      colPlanPct,
      colEstPct,
      colAopPct,
      fixedColPlan: 44608.36,
      fixedColEst: 42892.71,
      fixedColAop: 44608.36,
      managerHoursPlan: mgrHoursPlan,
      managerHoursEst: mgrHoursEst,
      managerHoursAop,
      crewHoursPlan,
      crewHoursEst,
      crewHoursAop,
      totalWorkingHoursPlan,
      totalWorkingHoursEst,
      totalWorkingHoursAop,
      tplhTotalPlan,
      tplhTotalEst,
      tplhTotalAop,
      tplhCoveragePlan,
      tplhCoverageEst,
      tplhCoverageAop,
      totalContracts,
      budgetWorkingHours,
      budgetWorkingHoursAop,
      deltaEstVsAopPln,
      deltaEstVsAopPct,
      deltaEstVsTargetPln,
      deltaEstVsTargetPct,
      deltaTargetVsAopPln,
      deltaTargetVsAopPct,
      whatIfColSavings,
      whatIfColPctInfluence,
      payrollManagerPlan: payrollMgrPlan,
      payrollManagerEst: payrollMgrEst,
      bonusManagerPlan: bonusMgrPlan,
      bonusManagerEst: bonusMgrEst,
      socialManagerPlan: socialMgrPlan,
      socialManagerEst: socialMgrEst,
      pfronManagerPlan: pfronMgrPlan,
      pfronManagerEst: pfronMgrEst,
      socialFundManagerPlan: socialFundMgrPlan,
      socialFundManagerEst: socialFundMgrEst,
      otherManagerPlan: otherMgrPlan,
      otherManagerEst: otherMgrEst,
      totalManagerPlan: totalMgrPlan,
      totalManagerEst: totalMgrEst,
      basicSalaryCrewPlan: uopBasicPlan,
      basicSalaryCrewEst: uopBasicEst,
      sickLeaveCrewPlan: uopSickPlan,
      sickLeaveCrewEst: uopSickEst,
      holidayPayCrewPlan: uopHolidayPlan,
      holidayPayCrewEst: uopHolidayEst,
      workingClothesEquivalentPlan: uopEquivPlan,
      workingClothesEquivalentEst: uopEquivEst,
      civilContractsSalariesPlan: uzBasicPlan,
      civilContractsSalariesEst: uzBasicEst,
      payrollCrewPlan,
      payrollCrewEst,
      bonusCrewPlan,
      bonusCrewEst,
      socialCrewPlan,
      socialCrewEst,
      pfronCrewPlan,
      pfronCrewEst,
      socialFundCrewPlan,
      socialFundCrewEst,
      otherCrewPlan,
      otherCrewEst,
      totalCrewPlan,
      totalCrewEst,
      driversPlan: driversCostPlan,
      driversEst: driversCostEst,
      partnersTotal: managers.filter(m => !m.isSpecialRow && m.name).length + crewUop.length + crewUz.length,
      partnersUop: managers.filter(m => !m.isSpecialRow && m.name).length + crewUop.length,
      crewUopCount: crewUop.length,
      crewUzCount: crewUz.length,
      partnersUopHoursPlan: mgrHoursPlan + uopHoursPlan,
      partnersUopHoursEst: mgrHoursEst + uopHoursEst,
      crewUopHoursPlan: uopHoursPlan,
      crewUopHoursEst: uopHoursEst,
      crewUzHoursPlan: uzHoursPlan,
      crewUzHoursEst: uzHoursEst
    };
  }
}
