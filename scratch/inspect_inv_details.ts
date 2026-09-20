import * as xlsxModule from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;
const grafikDir = path.resolve(process.cwd(), 'Grafik');

const f = 'Grafik Sierpien Janki 2026 (7).xlsm';
const buffer = fs.readFileSync(path.join(grafikDir, f));
const wb = XLSX.read(buffer, { type: 'buffer' });
for (const sName of wb.SheetNames) {
  const ws = wb.Sheets[sName];
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
  for (let r = 0; r < data.length; r++) {
    const row = data[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (String(row[c]).includes('INV')) {
        console.log(`Arkusz ${sName} [R${r + 1}, C${c}]:`, row[c], 'cały wiersz:', row.filter(x => x !== undefined));
      }
    }
  }
}
