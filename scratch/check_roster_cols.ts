import initSqlJs from 'sql.js';
import fs from 'fs';

async function checkColumns() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync('data/tplh_forecast.db'));
  const res = db.exec('PRAGMA table_info(manager_monthly_roster)');
  console.log('manager_monthly_roster columns:', res[0].values.map(v => v[1]));
}

checkColumns();
