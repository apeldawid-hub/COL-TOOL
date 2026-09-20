import initSqlJs from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.resolve(process.cwd(), 'data', 'tplh_forecast.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const res = db.exec("SELECT code, name, hours, category, is_nc, is_absence FROM shift_definitions ORDER BY code ASC");
  console.log('Katalog zmian w bazie:');
  console.table(res[0].values.map(r => ({
    code: r[0], name: r[1], hours: r[2], category: r[3], is_nc: r[4], is_absence: r[5]
  })));

  db.close();
}

main().catch(console.error);
