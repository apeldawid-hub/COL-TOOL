import * as xlsxModule from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;
const grafikDir = path.resolve(process.cwd(), 'Grafik');

const files = [
  'GRAFIK MGR 2026 Lipiec Janki (1).xlsm',
  'Grafik Sierpien Janki 2026 (7).xlsm',
  'Grafik wrzesień Janki 2026.xlsm'
];

for (const f of files) {
  console.log(`\n=================== TOR W PLIKU: ${f} ===================`);
  const buffer = fs.readFileSync(path.join(grafikDir, f));
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets['TOR'];
  if (!ws) {
    console.log('Brak arkusza TOR!');
    continue;
  }
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  for (let r = 0; r < Math.min(45, data.length); r++) {
    const row = data[r] || [];
    const hasVal = row.some((c: any) => c !== undefined && c !== null && c !== '');
    if (hasVal) {
      console.log(`R${r + 1}:`, JSON.stringify(row.slice(0, 16)));
    }
  }
}
