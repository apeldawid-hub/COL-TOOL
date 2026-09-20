import * as xlsxModule from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;
const grafikDir = path.resolve(process.cwd(), 'Grafik');

const f = 'Grafik wrzesień Janki 2026.xlsm';
const buffer = fs.readFileSync(path.join(grafikDir, f));
const wb = XLSX.read(buffer, { type: 'buffer' });
const ws = wb.Sheets['TOR'];
const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('=== Q3 W ARKUSZU TOR (Wiersze 29..39) ===');
for (let r = 28; r <= 38; r++) {
  const row = data[r] || [];
  console.log(`R${r + 1}:`, row.map((c: any) => c === undefined || c === null ? '' : c));
}
