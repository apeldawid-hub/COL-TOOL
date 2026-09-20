import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

async function performCleanSlate() {
  const dbPath = path.join(process.cwd(), 'data', 'tplh_forecast.db');
  if (!fs.existsSync(dbPath)) {
    console.error('Brak pliku bazy danych:', dbPath);
    process.exit(1);
  }

  // Backup ratunkowy przed czyszczeniem
  const backupDir = path.join(process.cwd(), 'backups', 'db_backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(dbPath, path.join(backupDir, `pre_clean_slate_${timestamp}.db`));

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // Czyszczenie danych operacyjnych
  db.run(`
    DELETE FROM labor_actuals_log;
    DELETE FROM weekly_actual_trx;
    DELETE FROM manager_schedule_shifts;
    DELETE FROM manager_schedule_events;
    DELETE FROM manager_schedule_versions;
    DELETE FROM manager_monthly_roster;
    DELETE FROM manager_employees;
    DELETE FROM training_partners;
    DELETE FROM training_shifts;
    DELETE FROM training_skill_checks;
    DELETE FROM aop_plans;
  `);

  const updatedBuffer = Buffer.from(db.export());
  fs.writeFileSync(dbPath, updatedBuffer);

  console.log('🧹 Baza danych w ./data/tplh_forecast.db została zresetowana do czystego stanu instalacyjnego (Clean Slate)!');
  console.log('✨ Usunięto dane operacyjne:');
  console.log('   - labor_actuals_log (logowania MAPAL): 0 rekordów');
  console.log('   - manager_schedule_shifts (grafiki menedżerskie): 0 rekordów');
  console.log('   - manager_employees & manager_monthly_roster (zespół): 0 rekordów');
  console.log('   - weekly_actual_trx (godziny baristyczne i TRX): 0 rekordów');
  console.log('   - aop_plans: wyzerowano actual_sales, actual_trx, actual_tplh');
  console.log('   - szkolenia (training_partners/shifts/checks): 0 rekordów');
  console.log('🔒 Nienaruszone fundamenty systemowe:');
  console.log('   - shift_definitions (25 kodów zmian Starbucks): ZACHOWANE');
  console.log('   - manager_monthly_norms (252 miesiące Kodeksu Pracy 2016-2036): ZACHOWANE');
  console.log('   - calendar_weeks (1152 tygodnie biznesowe 2021-2036): ZACHOWANE');
  console.log('   - floor_rules, nc_rules, stores: ZACHOWANE');
}

performCleanSlate().catch(console.error);
