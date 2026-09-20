import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { TorEngine } from '../src/modules/managers-schedule/services/torEngine';

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.resolve(process.cwd(), 'data', 'tplh_forecast.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const year = 2026;
  const quarter = 3;
  const months = [7, 8, 9];

  // Symulacja kodu z electron/main.ts db:get-tor-quarter-data
  const empStmt = db.prepare(`
    SELECT id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active
    FROM manager_employees
    WHERE is_active = 1
    ORDER BY sort_order ASC
  `);
  const employees: any[] = [];
  while (empStmt.step()) {
    employees.push(empStmt.getAsObject());
  }
  empStmt.free();

  const shiftsStmt = db.prepare(`
    SELECT id, year, month, day, date, employee_id, shift_code, hours, notes, disposition
    FROM manager_schedule_shifts
    WHERE year = ? AND month IN (${months.join(',')})
    ORDER BY month ASC, day ASC
  `);
  shiftsStmt.bind([year]);
  const shifts: any[] = [];
  while (shiftsStmt.step()) {
    shifts.push(shiftsStmt.getAsObject());
  }
  shiftsStmt.free();

  const normsStmt = db.prepare(`
    SELECT year, month, working_days, off_days, full_time_hours, is_custom, notes, updated_at
    FROM manager_monthly_norms
    WHERE year = ? AND month IN (${months.join(',')})
  `);
  normsStmt.bind([year]);
  const monthlyNorms: Record<number, any> = {};
  while (normsStmt.step()) {
    const n = normsStmt.getAsObject();
    monthlyNorms[Number(n.month)] = n;
  }
  normsStmt.free();

  const normalizeName = (str: string): string[] => {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[,.-]/g, ' ').split(/\s+/).filter(Boolean).sort();
  };

  const matchesManager = (excelEmpName: string, mgrName: string): boolean => {
    const tokensA = normalizeName(excelEmpName);
    const tokensB = normalizeName(mgrName);
    if (tokensA.length === 0 || tokensB.length === 0) return false;
    return tokensB.every(t => tokensA.includes(t));
  };

  const actualRcpByMonth: Record<number, Record<number, number>> = {};
  const hasActualRcpByMonth: Record<number, boolean> = {};

  for (const m of months) {
    const dPrefix = `${year}-${String(m).padStart(2, '0')}-%`;
    const mRcpStmt = db.prepare(`
      SELECT date, employee, computable_time
      FROM labor_actuals_log
      WHERE date LIKE ?
    `);
    mRcpStmt.bind([dPrefix]);

    const mRcpDays = new Set<number>();
    while (mRcpStmt.step()) {
      const rcp = mRcpStmt.getAsObject();
      const rcpEmpName = String(rcp.employee || '');
      const matchedEmp = employees.find(e => matchesManager(rcpEmpName, e.name));
      if (matchedEmp) {
        const dStr = String(rcp.date || '');
        const day = parseInt(dStr.split('-')[2], 10);
        mRcpDays.add(day);

        if (!actualRcpByMonth[matchedEmp.id]) {
          actualRcpByMonth[matchedEmp.id] = {};
        }
        const prev = actualRcpByMonth[matchedEmp.id][m] || 0;
        actualRcpByMonth[matchedEmp.id][m] = Number((prev + Number(rcp.computable_time || 0)).toFixed(1));
      }
    }
    mRcpStmt.free();

    const daysInM = new Date(year, m, 0).getDate();
    hasActualRcpByMonth[m] = mRcpDays.has(daysInM) || (mRcpDays.size >= 15);
  }

  console.log('hasActualRcpByMonth:', hasActualRcpByMonth);
  console.log('actualRcpByMonth:', actualRcpByMonth);

  const calculated = TorEngine.calculateQuarterData(
    year,
    quarter as any,
    employees,
    shifts,
    monthlyNorms,
    actualRcpByMonth,
    hasActualRcpByMonth
  );

  console.log('\nTOR Obliczony z uwzględnieniem danych IPC (widok aplikacji):');
  console.table(calculated.rows.map(r => ({
    Manager: r.employee.name,
    Etat: r.employee.contract_type,
    'M7 (Lipiec)': `${r.months[0].rcpHours}h (H:${r.months[0].hHours}, L4:${r.months[0].l4Hours}) bil:${r.months[0].balanceHours}`,
    'M8 (Sierpień)': `${r.months[1].rcpHours}h (H:${r.months[1].hHours}, L4:${r.months[1].l4Hours}) bil:${r.months[1].balanceHours}`,
    'M9 (Wrzesień)': `${r.months[2].rcpHours}h (H:${r.months[2].hHours}, L4:${r.months[2].l4Hours}) bil:${r.months[2].balanceHours}`,
    BilansQ3: `${r.quarterTotalBalance}h`,
    Status: r.quarterStatus
  })));

  db.close();
}

main().catch(console.error);
