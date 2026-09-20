import { DatabaseManager } from '../electron/database/db';
import { ManagerScheduleEngine } from '../src/modules/managers-schedule/services/managerScheduleEngine';

async function testIPCData() {
  const dbManager = DatabaseManager.getInstance();
  await dbManager.init();

  const year = 2026;
  const month = 9;

  const data = dbManager.getManagerScheduleData(year, month);
  console.log('Employees count:', data.employees.length);
  console.log('Shifts count:', data.shifts.length);
  console.log('Shift definitions count:', data.shiftDefinitions.length);

  const calc = ManagerScheduleEngine.calculateMonthData(
    year,
    month,
    data.employees,
    data.shiftDefinitions,
    data.shifts,
    data.events,
    data.monthlyNormRecord,
    data.boundaryShifts,
    data.rcpLogs,
    data.hasCompleteRcpLogs
  );

  console.log('Calculated rows for 2026-09:');
  for (const r of calc.rows) {
    console.log(`- ${r.emp.name} (${r.emp.role}): PlanHours=${r.planHours}h, L4=${r.sickHours}h, Urlop=${r.vacationHours}h, RCP=${r.rcpHours}h, Stawka=${r.emp.hourly_rate} zł/h`);
  }

  const aop = dbManager.getAopPlan(year, 'Wrzesień');
  console.log('AOP for Wrzesień 2026:', aop ? { sales: aop.sales, trx: aop.target_trx, tplh: aop.target_tplh } : 'None');
}

testIPCData();
