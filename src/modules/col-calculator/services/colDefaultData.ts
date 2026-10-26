import {
  ColStoreInfo,
  ColKpiTargetEst,
  ColManagerItem,
  ColCrewUopItem,
  ColCrewUzItem,
  ColOtherItem
} from '../types/colTypes';

export const DEFAULT_COL_STORE_INFO: ColStoreInfo = {
  storeCode: '',
  storeName: '',
  month: '',
  year: new Date().getFullYear(),
  openDays: 30,
  fullContractHours: 168
};

export const DEFAULT_COL_KPIS: ColKpiTargetEst = {
  salesTarget: 0,
  salesEst: 0,
  salesAop: 0,
  trxTarget: 0,
  trxEst: 0,
  trxAop: 0,
  avgDailyOpeningHours: 14,
  nonCoverageHolidayTarget: 0,
  nonCoverageHolidayEst: 0,
  nonCoverageSickTarget: 0,
  nonCoverageSickEst: 0,
  nonCoverageTrainingTarget: 0,
  matrixPlan: 'Plan A',
  tplhTarget: 0,
  whatIfTplhImprovement: 0
};

export const DEFAULT_COL_MANAGERS: ColManagerItem[] = [
  {
    id: 'mgr-maternity',
    name: 'Manager Maternity',
    position: 'Manager Maternity',
    contractRatio: 0,
    baseSalary: 0,
    planWorkHours: 0,
    planSickHours: 0,
    planHolidayHours: 0,
    planBonus: 0,
    isDisability: false,
    estWorkHours: 0,
    estSickHours: 0,
    estHolidayHours: 0,
    estBonus: 0,
    storeCostRatio: 1,
    isSpecialRow: true
  },
  {
    id: 'mgr-bench',
    name: 'Manager Bench',
    position: 'Manager Bench',
    contractRatio: 0,
    baseSalary: 0,
    planWorkHours: 0,
    planSickHours: 0,
    planHolidayHours: 0,
    planBonus: 0,
    isDisability: false,
    estWorkHours: 0,
    estSickHours: 0,
    estHolidayHours: 0,
    estBonus: 0,
    storeCostRatio: 1,
    isSpecialRow: true
  },
  {
    id: 'mgr-dm',
    name: 'DM costs',
    position: 'DM costs',
    contractRatio: 0,
    baseSalary: 0,
    planWorkHours: 0,
    planSickHours: 0,
    planHolidayHours: 0,
    planBonus: 0,
    isDisability: false,
    estWorkHours: 0,
    estSickHours: 0,
    estHolidayHours: 0,
    estBonus: 0,
    storeCostRatio: 1,
    isSpecialRow: true
  },
  {
    id: 'mgr-dos',
    name: 'DOS+ accrual',
    position: 'DOS+ accrual',
    contractRatio: 0,
    baseSalary: 0,
    planWorkHours: 0,
    planSickHours: 0,
    planHolidayHours: 0,
    planBonus: 0,
    isDisability: false,
    estWorkHours: 0,
    estSickHours: 0,
    estHolidayHours: 0,
    estBonus: 0,
    storeCostRatio: 1,
    isSpecialRow: true
  },
  {
    id: 'mgr-holiday-accrual',
    name: 'Holiday accrual',
    position: 'Holiday accrual',
    contractRatio: 0,
    baseSalary: 0,
    planWorkHours: 0,
    planSickHours: 0,
    planHolidayHours: 0,
    planBonus: 0,
    isDisability: false,
    estWorkHours: 0,
    estSickHours: 0,
    estHolidayHours: 0,
    estBonus: 0,
    storeCostRatio: 1,
    isSpecialRow: true
  }
];

export const DEFAULT_COL_CREW_UOP: ColCrewUopItem[] = [];

export const DEFAULT_COL_CREW_UZ: ColCrewUzItem[] = [];

export const DEFAULT_COL_OTHER_COSTS: ColOtherItem[] = [
  { id: 'oth-1', label: 'Medical examination ryczałt', planVal: 0, estVal: 0 },
  { id: 'oth-2', label: 'Bonus "Recommend a friend" (netto)', planVal: 0, estVal: 0 },
  { id: 'oth-3', label: 'Bonus SSV No Area', planVal: 0, estVal: 0, ratePct: 0.001 },
  { id: 'oth-4', label: 'Bonus CREW', planVal: 0, estVal: 0, ratePct: 0.002 },
  { id: 'oth-5', label: 'Wyksięgowanie PFRON Manager', planVal: 0, estVal: 0 },
  { id: 'oth-6', label: 'Wyksięgowanie PFRON Crew', planVal: 0, estVal: 0 },
  { id: 'oth-7', label: 'ADP', planVal: 0, estVal: 0 },
  { id: 'oth-8', label: 'Other (Koszty HR, corrections from previous month etc.)', planVal: 0, estVal: 0 },
  { id: 'oth-9', label: 'PPK', planVal: 0, estVal: 0, extraMeta: { ppkMgr: 0, ppkCrew: 0 } },
  { id: 'oth-10', label: 'Drivers', planVal: 0, estVal: 0, extraMeta: { costPerDrop: 14 } }
];
