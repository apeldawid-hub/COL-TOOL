import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.resolve(process.cwd(), 'data', 'tplh_forecast.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const normalizeName = (str: string): string[] => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[,.-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .sort();
  };

  const matchesManager = (excelEmpName: string, mgrName: string): boolean => {
    const tokensA = normalizeName(excelEmpName);
    const tokensB = normalizeName(mgrName);
    if (tokensA.length === 0 || tokensB.length === 0) return false;
    return tokensB.every(t => tokensA.includes(t));
  };

  const empRes = db.exec("SELECT id, name, role, contract_type, contract_hours_ratio FROM manager_employees ORDER BY sort_order ASC");
  const employees = empRes[0].values.map(r => ({
    id: r[0], name: r[1], role: r[2], contract_type: r[3], ratio: r[4]
  }));

  console.log('Menedżerowie w bazie:');
  console.table(employees);

  for (const m of [7, 8, 9]) {
    console.log(`\n--- Logowania MAPAL dla 2026-0${m} ---`);
    const rcpRes = db.exec(`SELECT employee, sum(computable_time) as total_h, count(*) as shifts_cnt FROM labor_actuals_log WHERE date LIKE '2026-0${m}-%' GROUP BY employee ORDER BY total_h DESC`);
    if (rcpRes.length > 0) {
      for (const r of rcpRes[0].values) {
        const empName = String(r[0]);
        const matched = employees.find(e => matchesManager(empName, String(e.name)));
        if (matched) {
          console.log(`  MGR [id=${matched.id} ${matched.name}]: MAPAL="${empName}", Godziny=${r[1]}, Zmian=${r[2]}`);
        } else {
          // Barista lub inna osoba
          // console.log(`  Inny: "${empName}", Godziny=${r[1]}`);
        }
      }
    } else {
      console.log('  Brak danych');
    }
  }

  db.close();
}

main().catch(console.error);
