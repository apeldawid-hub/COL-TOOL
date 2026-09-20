import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.resolve(process.cwd(), 'data', 'tplh_forecast.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const res = db.exec("SELECT * FROM manager_employees");
  console.log('Pracownicy w manager_employees:');
  if (res.length > 0) {
    const cols = res[0].columns;
    for (const row of res[0].values) {
      const obj: any = {};
      cols.forEach((c, idx) => obj[c] = row[idx]);
      console.log(JSON.stringify(obj));
    }
  }

  db.close();
}

main().catch(console.error);
