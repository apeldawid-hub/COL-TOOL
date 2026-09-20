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
  const filePath = path.join(grafikDir, f);
  console.log(`\n========================================`);
  console.log(`PLIK: ${f}`);
  const buffer = fs.readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  console.log('Wszystkie arkusze:', wb.SheetNames);
  
  // Poszukajmy arkusza typu Schedule lub podobnego
  for (const sName of wb.SheetNames) {
    if (sName.toLowerCase().includes('sched') || sName.toLowerCase().includes('grafik') || sName.toLowerCase().includes('lipiec') || sName.toLowerCase().includes('sierp') || sName.toLowerCase().includes('wrzes')) {
      console.log(`Znaleziono pasujący arkusz: "${sName}"`);
      const ws = wb.Sheets[sName];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      for (let r = 0; r < Math.min(30, data.length); r++) {
        const row = data[r] || [];
        const hasVal = row.some((c: any) => c !== undefined && c !== null && c !== '');
        if (hasVal) {
          console.log(`R${r + 1}:`, row.slice(0, 15).map((c: any) => c === undefined || c === null ? '' : c));
        }
      }
    }
  }
}
