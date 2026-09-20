import * as xlsxModule from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;
const grafikDir = path.resolve(process.cwd(), 'Grafik');

for (const f of ['GRAFIK MGR 2026 Lipiec Janki (1).xlsm', 'Grafik Sierpien Janki 2026 (7).xlsm']) {
  console.log(`\n=================== ${f} ===================`);
  const buffer = fs.readFileSync(path.join(grafikDir, f));
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets['Schedule'];
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  for (let r = 14; r <= 22; r++) {
    const row = data[r] || [];
    console.log(`R${r + 1}: Name="${row[2]}", Etat=${row[0]}, Role="${row[7]}"`);
  }
}
