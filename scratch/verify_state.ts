import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

async function verifyState() {
  const SQL = await initSqlJs();
  const dbPath = path.join(process.cwd(), 'data', 'tplh_forecast.db');
  const db = new SQL.Database(fs.readFileSync(dbPath));

  const tablesToCheck = [
    'manager_employees',
    'manager_schedule_shifts',
    'labor_actuals_log',
    'training_partners',
    'shift_definitions',
    'manager_monthly_norms',
    'calendar_weeks',
    'aop_plans'
  ];

  console.log('=== AKTUALNY STAN BAZY (data/tplh_forecast.db) ===');
  for (const t of tablesToCheck) {
    const res = db.exec(`SELECT COUNT(*) FROM ${t}`);
    const count = res[0]?.values[0]?.[0];
    console.log(`- ${t}: ${count} rekordów`);
  }

  console.log('\n=== ZAWARTOŚĆ FOLDERU ./IMPORT/ ===');
  const importDir = path.join(process.cwd(), 'IMPORT');
  const files = fs.readdirSync(importDir);
  console.log(`Znaleziono ${files.length} plików w ./IMPORT/:`, files);
}

verifyState().catch(console.error);
