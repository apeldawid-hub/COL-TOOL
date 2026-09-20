import { ColEngine } from '../src/modules/col-calculator/services/colEngine';
import {
  DEFAULT_COL_STORE_INFO,
  DEFAULT_COL_KPIS,
  DEFAULT_COL_MANAGERS,
  DEFAULT_COL_CREW_UOP,
  DEFAULT_COL_CREW_UZ,
  DEFAULT_COL_OTHER_COSTS
} from '../src/modules/col-calculator/services/colDefaultData';

const summary = ColEngine.calculate(
  DEFAULT_COL_STORE_INFO,
  DEFAULT_COL_KPIS,
  DEFAULT_COL_MANAGERS,
  DEFAULT_COL_CREW_UOP,
  DEFAULT_COL_CREW_UZ,
  DEFAULT_COL_OTHER_COSTS
);

console.log('=== VERIFICATION OF COL ENGINE ===');
console.log('TOTAL COL PLAN:', summary.colPlanTotal.toFixed(2), '(Expected in Excel: 78032.62)');
console.log('TOTAL COL ESTIMATION:', summary.colEstTotal.toFixed(2), '(Expected in Excel: 76149.55)');
console.log('TOTAL COL % PLAN:', (summary.colPlanPct * 100).toFixed(2) + '%', '(Expected in Excel: 25.17%)');
console.log('TOTAL COL % EST:', (summary.colEstPct * 100).toFixed(2) + '%', '(Expected in Excel: 27.20%)');
console.log('Total Manager Plan:', summary.totalManagerPlan.toFixed(2), '(Expected in Excel: 39754.39)');
console.log('Total Manager Est:', summary.totalManagerEst.toFixed(2), '(Expected in Excel: 38446.56)');
console.log('Total Crew Plan:', summary.totalCrewPlan.toFixed(2), '(Expected in Excel: 35198.23)');
console.log('Total Crew Est:', summary.totalCrewEst.toFixed(2), '(Expected in Excel: 34818.99)');
console.log('Drivers Plan:', summary.driversPlan.toFixed(2), '(Expected in Excel: 3080.00)');
console.log('Drivers Est:', summary.driversEst.toFixed(2), '(Expected in Excel: 2884.00)');
console.log('Working Hours Plan:', summary.totalWorkingHoursPlan, '(Expected: 1760)');
console.log('TPLH Total Plan:', summary.tplhTotalPlan.toFixed(2), '(Expected: 6.19)');
console.log('Budget Working Hours:', summary.budgetWorkingHours.toFixed(2), '(Expected: 1651.52)');
console.log('What-If COL Savings (TPLH 7.0):', summary.whatIfColSavings.toFixed(2) + ' zł');
