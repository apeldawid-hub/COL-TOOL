import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('=== KONTROLA INTEGRALNOŚCI I OPTYMALIZACJA BAZY DANYCH ===\n');
  const SQL = await initSqlJs();
  const dbPath = path.resolve(process.cwd(), 'data', 'tplh_forecast.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // 1. PRAGMA integrity_check
  const integrity = db.exec("PRAGMA integrity_check");
  console.log('1. Wynik integrity_check:', integrity[0]?.values[0]?.[0]);

  // 2. PRAGMA foreign_key_check
  const fk = db.exec("PRAGMA foreign_key_check");
  console.log('2. Wynik foreign_key_check:', fk.length === 0 || fk[0].values.length === 0 ? 'OK (brak naruszeń FK)' : fk);

  // 3. Sprawdzenie indeksów
  const indexesRes = db.exec("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index'");
  console.log('3. Istniejące indeksy:');
  if (indexesRes.length > 0) {
    for (const r of indexesRes[0].values) {
      console.log(`   - Indeks: ${r[0]} (tabela: ${r[1]})`);
    }
  }

  // 4. Dodanie indeksu wspomagającego zapytania TOR i widoków miesięcznych
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_mgr_shifts_ym_emp ON manager_schedule_shifts(year, month, employee_id);
    CREATE INDEX IF NOT EXISTS idx_labor_log_date_emp ON labor_actuals_log(date, employee);
    ANALYZE;
    VACUUM;
  `);
  console.log('4. Utworzono dodatkowe indeksy optymalizacyjne oraz wykonano ANALYZE i VACUUM.');

  // 5. Statystyki tabel w bazie
  console.log('\n5. Liczba rekordów w kluczowych tabelach:');
  const tables = [
    'manager_employees',
    'shift_definitions',
    'manager_schedule_shifts',
    'manager_schedule_events',
    'manager_monthly_norms',
    'labor_actuals_log',
    'aop_plans',
    'calendar_weeks',
    'weekly_actual_trx',
    'floor_rules',
    'nc_rules'
  ];

  for (const t of tables) {
    try {
      const res = db.exec(`SELECT count(*) FROM ${t}`);
      console.log(`   - ${t.padEnd(25)}: ${res[0].values[0][0]} rekordów`);
    } catch (err: any) {
      console.log(`   - ${t.padEnd(25)}: brak tabeli lub błąd (${err.message})`);
    }
  }

  // Zapis optymalizacji
  const exported = db.export();
  fs.writeFileSync(dbPath, Buffer.from(exported));
  console.log(`\n💾 Baza danych zoptymalizowana i zapisana (${(fs.statSync(dbPath).size / 1024).toFixed(1)} KB).`);

  db.close();
}

main().catch(console.error);
