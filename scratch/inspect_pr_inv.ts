import * as xlsxModule from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;
const grafikDir = path.resolve(process.cwd(), 'Grafik');

for (const f of ['GRAFIK MGR 2026 Lipiec Janki (1).xlsm', 'Grafik Sierpien Janki 2026 (7).xlsm']) {
  console.log(`\n=================== ${f} ===================`);
  const buffer = fs.readFileSync(path.join(grafikDir, f));
  const wb = XLSX.read(buffer, { type: 'buffer' });
  for (const sName of ['Lists', 'Admin']) {
    const ws = wb.Sheets[sName];
    if (!ws) continue;
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    for (const r of data) {
      if (r && r.some((c: any) => c === 'PR' || c === 'INV' || (typeof c === 'string' && (c.includes('Praktyki') || c.includes('Inwentaryz'))))) {
        console.log(`Arkusz ${sName}:`, JSON.stringify(r.filter((c: any) => c !== undefined && c !== null)));
      }
    }
  }
}
