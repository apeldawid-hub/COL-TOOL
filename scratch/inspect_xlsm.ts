import * as xlsxModule from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const grafikDir = path.resolve(process.cwd(), 'Grafik');
const files = fs.readdirSync(grafikDir).filter(f => f.endsWith('.xlsm') || f.endsWith('.xlsx'));

console.log('Znalezione pliki w folderze Grafik:', files);

for (const f of files) {
  const filePath = path.join(grafikDir, f);
  console.log(`\n========================================`);
  console.log(`ANALIZA PLIKU: ${f}`);
  const buffer = fs.readFileSync(filePath);
  const wb = XLSX.read(buffer, { type: 'buffer' });
  console.log('Arkusze w pliku:', wb.SheetNames);

  // Sprawdźmy arkusze
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    console.log(`\n--- Arkusz "${sheetName}": liczba wierszy = ${data.length} ---`);
    for (let i = 0; i < Math.min(25, data.length); i++) {
      const row = data[i];
      if (row && row.some(cell => cell !== undefined && cell !== '')) {
        console.log(`R${i + 1}:`, JSON.stringify(row.slice(0, 15)));
      }
    }
  }
}
