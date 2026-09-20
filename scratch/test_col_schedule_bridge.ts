import initSqlJs from 'sql.js';
import fs from 'fs';
import { ManagerScheduleEngine } from '../src/modules/managers-schedule/services/managerScheduleEngine';

async function testBridge() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync('data/tplh_forecast.db'));

  const year = 2026;
  const month = 9; // Wrzesień

  // 1. Employees from monthly roster or manager_employees
  const rosterRes = db.exec(`
    SELECT r.employee_id, r.name, r.role, r.contract_hours_ratio, r.hourly_rate, r.display_order, e.contract_type
    FROM manager_monthly_roster r
    LEFT JOIN manager_employees e ON e.id = r.employee_id
    WHERE r.year = ${year} AND r.month = ${month}
    ORDER BY r.display_order ASC
  `);

  let emps: any[] = [];
  if (rosterRes.length > 0 && rosterRes[0].values.length > 0) {
    const cols = rosterRes[0].columns;
    emps = rosterRes[0].values.map(vals => {
      const obj: any = {};
      cols.forEach((c, i) => obj[c] = vals[i]);
      obj.id = obj.employee_id;
      return obj;
    });
  }

  // 2. Shifts
  const shiftsRes = db.exec(`SELECT * FROM manager_schedule_shifts WHERE year = ${year} AND month = ${month}`);
  const shifts = shiftsRes.length > 0 ? shiftsRes[0].values.map(v => {
    const obj: any = {};
    shiftsRes[0].columns.forEach((c, i) => obj[c] = v[i]);
    return obj;
  }) : [];

  // 3. Shift definitions
  const defsRes = db.exec(`SELECT * FROM shift_definitions`);
  const defs = defsRes.length > 0 ? defsRes[0].values.map(v => {
    const obj: any = {};
    defsRes[0].columns.forEach((c, i) => obj[c] = v[i]);
    return obj;
  }) : [];

  // 4. Calculate month data using ManagerScheduleEngine
  const calcData = ManagerScheduleEngine.calculateMonthData(
    year,
    month,
    emps,
    defs,
    shifts,
    []
  );

  console.log(`=== MANAGERS SCHEDULE BRIDGE FOR ${year}-${month} ===`);
  console.log(`Full nominal hours: ${calcData.norms.fullTimeNominalHours} h`);
  console.log(`Found ${calcData.rows.length} managers in schedule:`);
  for (const r of calcData.rows) {
    console.log(`- ${r.emp.name} (${r.emp.role}, etat: ${r.emp.contract_hours_ratio}): PlanWork=${r.planHours}h, L4=${r.sickHours}h, Urlop=${r.vacationHours}h, RCP=${r.rcpHours}h, Total=${r.totalWorkAndAbsenceHours}h, Balance=${r.balanceHours}h`);
  }

  // 5. AOP Plan
  const aopRes = db.exec(`SELECT * FROM aop_plans WHERE year = ${year} AND month = 'Wrzesień'`);
  if (aopRes.length > 0 && aopRes[0].values.length > 0) {
    const aopCols = aopRes[0].columns;
    const aopObj: any = {};
    aopCols.forEach((c, i) => aopObj[c] = aopRes[0].values[0][i]);
    console.log(`\nAOP Plan: Sales=${aopObj.sales} zł, TRX=${aopObj.target_trx}, Target TPLH=${aopObj.target_tplh}`);
  }
}

testBridge();
