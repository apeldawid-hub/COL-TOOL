import * as xlsxModule from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import initSqlJs from 'sql.js';

const XLSX: any = (xlsxModule as any).default || xlsxModule;
const grafikDir = path.resolve(process.cwd(), 'Grafik');

async function main() {
  const SQL = await initSqlJs();
  const dbPath = path.resolve(process.cwd(), 'data', 'tplh_forecast.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  const shiftDefsRes = db.exec("SELECT code, name, hours, is_nc, is_absence FROM shift_definitions");
  const knownCodes = new Map<string, any>();
  if (shiftDefsRes.length > 0) {
    for (const r of shiftDefsRes[0].values) {
      knownCodes.set(String(r[0]), { code: r[0], name: r[1], hours: r[2], is_nc: r[3], is_absence: r[4] });
    }
  }

  console.log('Kody w bazie danych (shift_definitions):', Array.from(knownCodes.keys()).join(', '));

  const files = [
    { file: 'GRAFIK MGR 2026 Lipiec Janki (1).xlsm', month: 7, days: 31 },
    { file: 'Grafik Sierpien Janki 2026 (7).xlsm', month: 8, days: 31 },
    { file: 'Grafik wrzesień Janki 2026.xlsm', month: 9, days: 30 }
  ];

  const foundCodes = new Map<string, number>();

  for (const { file, month, days } of files) {
    console.log(`\nBadanie pliku: ${file} (Miesiąc ${month}, dni ${days})`);
    const fBuf = fs.readFileSync(path.join(grafikDir, file));
    const wb = XLSX.read(fBuf, { type: 'buffer' });
    const ws = wb.Sheets['Schedule'];
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    for (let r = 14; r <= 23; r++) {
      const row = data[r] || [];
      const empName = row[2];
      if (!empName || typeof empName !== 'string' || empName.includes('Plan') || empName.includes('Ważne') || empName.includes('Nazwa')) continue;

      for (let d = 1; d <= days; d++) {
        const val = row[9 + d]; // C10 to d=1, więc index 9 + d
        const code = (val === undefined || val === null || String(val).trim() === '') ? 'OFF' : String(val).trim();
        foundCodes.set(code, (foundCodes.get(code) || 0) + 1);
        if (!knownCodes.has(code) && !['OFF', 'M', 'Z', 'FULL'].includes(code)) {
          console.warn(`  [NIEZNANY KOD] w miesiącu ${month}, dzień ${d}, pracownik "${empName}": "${code}"`);
        }
      }
    }
  }

  console.log('\nWszystkie kody znalezione w plikach i ich częstotliwość:');
  for (const [c, cnt] of Array.from(foundCodes.entries()).sort((a, b) => b[1] - a[1])) {
    const inDb = knownCodes.has(c) || ['OFF', 'M', 'Z', 'FULL'].includes(c);
    console.log(`  Kod: "${c}": wystąpień=${cnt} ${inDb ? '(w bazie OK)' : '⚠️ [BRAK W BAZIE!]'}`);
  }

  db.close();
}

main().catch(console.error);
