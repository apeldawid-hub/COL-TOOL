import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.resolve(process.cwd(), 'data', 'tplh_forecast.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const res = db.exec("SELECT DISTINCT strftime('%Y-%m', date) as ym, count(*) as cnt FROM labor_actuals_log GROUP BY ym ORDER BY ym DESC");
  console.log('Miesiące w labor_actuals_log:');
  if (res.length > 0) {
    for (const r of res[0].values) {
      console.log(`Miesiąc: ${r[0]}, liczba logowań: ${r[1]}`);
    }
  } else {
    console.log('Brak logowań w labor_actuals_log');
  }

  // Sprawdźmy też jakie zmiany menedżerów są obecnie w manager_schedule_shifts
  const mgrShiftsRes = db.exec("SELECT year, month, count(*) as cnt FROM manager_schedule_shifts GROUP BY year, month ORDER BY year DESC, month DESC");
  console.log('\nZmiany w manager_schedule_shifts:');
  if (mgrShiftsRes.length > 0) {
    for (const r of mgrShiftsRes[0].values) {
      console.log(`Rok: ${r[0]}, Miesiąc: ${r[1]}, liczba zmian: ${r[2]}`);
    }
  } else {
    console.log('Brak zmian w manager_schedule_shifts');
  }

  db.close();
}

main().catch(console.error);
