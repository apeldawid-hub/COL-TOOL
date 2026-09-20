export type ColSheetTab =
  | 'CALCULATOR'
  | 'BONUS'
  | 'Rezerwa urlopowa'
  | 'DANE'
  | 'Fields Description'
  | 'USER GUIDE';

export interface ColStoreInfo {
  storeCode: string;
  storeName: string;
  month: string;
  year: number;
  openDays: number;
  fullContractHours: number; // np. 176 dla września 2025
}

export interface ColKpiTargetEst {
  salesTarget: number;
  salesEst: number;
  salesAop: number;
  trxTarget: number;
  trxEst: number;
  trxAop: number;
  tplhAop?: number;
  avgDailyOpeningHours: number;
  nonCoverageHolidayTarget: number;
  nonCoverageHolidayEst: number;
  nonCoverageSickTarget: number;
  nonCoverageSickEst: number;
  nonCoverageTrainingTarget: number;
  matrixPlan: 'Plan A' | 'Plan B' | 'Plan C';
  tplhTarget: number;
  tplhEst?: number;
  whatIfTplhImprovement: number;
}

export interface ColManagerItem {
  id: string;
  name: string;
  position: 'SM' | 'ASM' | 'SSV-PM' | 'SSV-FM' | 'SSV' | 'Manager Maternity' | 'Manager Bench' | 'DM costs' | 'DOS+ accrual' | 'Holiday accrual';
  contractRatio: number; // np. 1.0, 0.75, 0.50
  baseSalary: number; // miesięczna płaca brutto
  planWorkHours: number;
  planSickHours: number;
  planHolidayHours: number;
  planBonus: number;
  isDisability: boolean; // ON: Tak -> 7h norma dzienna
  estWorkHours: number;
  estSickHours: number;
  estHolidayHours: number;
  estBonus: number;
  storeCostRatio: number; // np. 1.0 = 100% kosztów kawiarni
  isSpecialRow?: boolean;
}

export interface ColCrewUopItem {
  id: string;
  name: string;
  position: 'BARISTA' | 'BT' | 'B' | 'KP' | 'LOBBY';
  contractRatio: number;
  hourlyRate: number;
  planWorkHours: number;
  planSickHours: number;
  planHolidayHours: number;
  isDisability: boolean;
  estWorkHours: number;
  estSickHours: number;
  estHolidayHours: number;
  estBonus: number;
}

export interface ColCrewUzItem {
  id: string;
  name: string;
  position: 'BARISTA' | 'BT' | 'B' | 'KP' | 'LOBBY';
  hourlyRate: number;
  planWorkHours: number;
  estWorkHours: number;
  bonus: number;
}

export interface ColOtherItem {
  id: string;
  label: string;
  planVal: number;
  estVal: number;
  ratePct?: number;
  extraMeta?: Record<string, any>;
}

export interface ColCalculatedSummary {
  // KPIs - 3 Filary
  colPlanTotal: number;
  colEstTotal: number;
  colAopTotal: number;
  colPnlTotal: number;
  colPlanPct: number;
  colEstPct: number;
  colAopPct: number;
  fixedColPlan: number;
  fixedColEst: number;
  fixedColAop: number;
  managerHoursPlan: number;
  managerHoursEst: number;
  managerHoursAop: number;
  crewHoursPlan: number;
  crewHoursEst: number;
  crewHoursAop: number;
  totalWorkingHoursPlan: number;
  totalWorkingHoursEst: number;
  totalWorkingHoursAop: number;
  tplhTotalPlan: number;
  tplhTotalEst: number;
  tplhTotalAop: number;
  tplhCoveragePlan: number;
  tplhCoverageEst: number;
  tplhCoverageAop: number;
  totalContracts: number;
  budgetWorkingHours: number;
  budgetWorkingHoursAop: number;
  // Wariancje / Odchylenia
  deltaEstVsAopPln: number;
  deltaEstVsAopPct: number;
  deltaEstVsTargetPln: number;
  deltaEstVsTargetPct: number;
  deltaTargetVsAopPln: number;
  deltaTargetVsAopPct: number;
  // What-If
  whatIfColSavings: number;
  whatIfColPctInfluence: number;
  // P&L Manager
  payrollManagerPlan: number;
  payrollManagerEst: number;
  bonusManagerPlan: number;
  bonusManagerEst: number;
  socialManagerPlan: number;
  socialManagerEst: number;
  pfronManagerPlan: number;
  pfronManagerEst: number;
  socialFundManagerPlan: number;
  socialFundManagerEst: number;
  otherManagerPlan: number;
  otherManagerEst: number;
  totalManagerPlan: number;
  totalManagerEst: number;
  // P&L Crew
  basicSalaryCrewPlan: number;
  basicSalaryCrewEst: number;
  sickLeaveCrewPlan: number;
  sickLeaveCrewEst: number;
  holidayPayCrewPlan: number;
  holidayPayCrewEst: number;
  workingClothesEquivalentPlan: number;
  workingClothesEquivalentEst: number;
  civilContractsSalariesPlan: number;
  civilContractsSalariesEst: number;
  payrollCrewPlan: number;
  payrollCrewEst: number;
  bonusCrewPlan: number;
  bonusCrewEst: number;
  socialCrewPlan: number;
  socialCrewEst: number;
  pfronCrewPlan: number;
  pfronCrewEst: number;
  socialFundCrewPlan: number;
  socialFundCrewEst: number;
  otherCrewPlan: number;
  otherCrewEst: number;
  totalCrewPlan: number;
  totalCrewEst: number;
  // P&L Drivers
  driversPlan: number;
  driversEst: number;
  // Headcount & Hours breakdown
  partnersTotal: number;
  partnersUop: number;
  crewUopCount: number;
  crewUzCount: number;
  partnersUopHoursPlan: number;
  partnersUopHoursEst: number;
  crewUopHoursPlan: number;
  crewUopHoursEst: number;
  crewUzHoursPlan: number;
  crewUzHoursEst: number;
}
