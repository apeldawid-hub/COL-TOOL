import initSqlJs from 'sql.js';
import fs from 'fs';
import { ManagerScheduleEngine } from '../src/modules/managers-schedule/services/managerScheduleEngine';
import { ColEngine } from '../src/modules/col-calculator/services/colEngine';

async function verifyBridgeLogic() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync('data/tplh_forecast.db'));

  const year = 2026;
  const month = 9;
  const monthName = 'Wrzesień';

  // 1. Get Monthly Roster
  const rosterStmt = db.prepare(`
    SELECT r.employee_id as id, r.name, r.role, r.contract_hours_ratio, r.hourly_rate, r.sort_order, r.contract_type
    FROM manager_monthly_roster r
    WHERE r.year = ? AND r.month = ?
    ORDER BY r.sort_order ASC
  `);
  rosterStmt.bind([year, month]);
  const employees: any[] = [];
  while (rosterStmt.step()) {
    employees.push(rosterStmt.getAsObject());
  }
  rosterStmt.free();

  // 2. Get Shifts
  const shiftsStmt = db.prepare(`
    SELECT id, year, month, day, date, employee_id, shift_code, hours, notes, disposition, custom_start_time, custom_end_time
    FROM manager_schedule_shifts
    WHERE year = ? AND month = ?
    ORDER BY day ASC
  `);
  shiftsStmt.bind([year, month]);
  const shifts: any[] = [];
  while (shiftsStmt.step()) {
    shifts.push(shiftsStmt.getAsObject());
  }
  shiftsStmt.free();

  // 3. Shift Defs
  const defsStmt = db.prepare(`SELECT * FROM shift_definitions`);
  const defs: any[] = [];
  while (defsStmt.step()) {
    defs.push(defsStmt.getAsObject());
  }
  defsStmt.free();

  // 4. Calculate Manager Schedule
  const calcSchedule = ManagerScheduleEngine.calculateMonthData(
    year,
    month,
    employees,
    defs,
    shifts,
    []
  );

  console.log(`=== AUTOMATIC BRIDGE TEST FOR ${monthName} ${year} ===`);
  console.log(`Nominal full contract hours: ${calcSchedule.fullTimeNominalHours} h`);
  console.log(`Loaded ${calcSchedule.rows.length} managers from Moduł 2:`);

  const colManagers: any[] = calcSchedule.rows.map((row) => {
    const fullNominal = calcSchedule.fullTimeNominalHours;
    const emp = row.employee;
    const baseSalary = emp.hourly_rate > 0
      ? Math.round(emp.hourly_rate * fullNominal)
      : (emp.role === 'STORE MANAGER' || emp.role === 'SM')
      ? 7200
      : (emp.role.includes('ASSISTANT') || emp.role === 'ASM')
      ? 6300
      : 5600;

    const shortRole = emp.role === 'STORE MANAGER' ? 'SM' : emp.role.includes('ASSISTANT') ? 'ASM' : 'SSV';

    let planWork = 0;
    let planSick = 0;
    let planHoliday = 0;

    Object.values(row.shifts || {}).forEach(s => {
      const code = s.shift_code;
      if (code === 'H') {
        planHoliday += s.hours || (emp.contract_hours_ratio * 8);
      } else if (code === 'L4' || code === 'L') {
        planSick += s.hours || (emp.contract_hours_ratio * 8);
      } else if (code && code !== 'OFF') {
        planWork += s.hours || 0;
      }
    });

    return {
      id: `mgr-${emp.id}`,
      name: emp.name,
      position: shortRole,
      contractRatio: emp.contract_hours_ratio,
      baseSalary,
      planWorkHours: planWork,
      planSickHours: planSick,
      planHolidayHours: planHoliday,
      planBonus: 0,
      isDisability: false,
      estWorkHours: planWork,
      estSickHours: planSick,
      estHolidayHours: planHoliday,
      estBonus: 0,
      storeCostRatio: 1
    };
  });

  for (const m of colManagers) {
    console.log(`- ${m.name} (${m.position}, etat: ${m.contractRatio}): PlanWork=${m.planWorkHours}h, L4=${m.planSickHours}h, Urlop=${m.planHolidayHours}h, EstWork=${m.estWorkHours}h, BaseSalary=${m.baseSalary} zł`);
  }

  // 5. AOP Plan
  const aopStmt = db.prepare(`SELECT * FROM aop_plans WHERE year = ? AND month = ?`);
  aopStmt.bind([year, monthName]);
  let aop: any = null;
  if (aopStmt.step()) {
    aop = aopStmt.getAsObject();
  }
  aopStmt.free();

  console.log('\nAOP Plan for Wrzesień 2026:', aop ? { sales: aop.sales, trx: aop.target_trx, tplh: aop.target_tplh } : 'None');
}

verifyBridgeLogic();
