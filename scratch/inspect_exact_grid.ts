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
  const ws = wb.Sheets['Schedule'];
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Wypisz wiersze 11..25 ze wszystkimi komórkami (pokaż indeksy kolumn!)
  for (let r = 10; r < 26; r++) {
    const row = data[r] || [];
    const nonEmpties: { col: number; val: any }[] = [];
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== undefined && row[c] !== null && row[c] !== '') {
        nonEmpties.push({ col: c, val: row[c] });
      }
    }
    if (nonEmpties.length > 0) {
      console.log(`Wiersz ${r + 1}: ${nonEmpties.map(e => `[C${e.col}:${e.val}]`).join(' ')}`);
    }
  }
}
