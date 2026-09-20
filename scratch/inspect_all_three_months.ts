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

  // Szukamy wiersza nagłówka z dniami
  let headerRowIdx = -1;
  let dayStartCol = -1;
  let daysCount = 0;

  for (let r = 0; r < Math.min(20, data.length); r++) {
    const row = data[r] || [];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === 1 && (row[c + 1] === 2 || data[r]?.[c + 1] === 2)) {
        headerRowIdx = r;
        dayStartCol = c;
        // zlicz dni
        let dc = 0;
        while (typeof row[c + dc] === 'number' && row[c + dc] === dc + 1) {
          dc++;
        }
        daysCount = dc;
        break;
      }
    }
    if (headerRowIdx !== -1) break;
  }

  console.log(`Nagłówek dni w wierszu ${headerRowIdx + 1}, start kolumny ${dayStartCol}, liczba dni = ${daysCount}`);

  // Szukamy wierszy pracowników
  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r] || [];
    const name = row[2]; // zazwyczaj kolumna 2
    if (name && typeof name === 'string' && name.trim() !== '' && !name.includes('Plan') && !name.includes('Ważne')) {
      const shifts: string[] = [];
      for (let d = 0; d < daysCount; d++) {
        shifts.push(String(row[dayStartCol + d] || 'OFF'));
      }
      console.log(`Pracownik (R${r + 1}): "${name}", etat: ${row[0]}, pozycja: ${row[7]}, zmiany[1..7]: ${shifts.slice(0, 7).join(',')}`);
    } else if (typeof row[0] === 'string' && row[0].includes('Ważne')) {
      const events: string[] = [];
      for (let d = 0; d < daysCount; d++) {
        const ev = row[dayStartCol + d];
        if (ev) events.push(`D${d + 1}: ${ev}`);
      }
      console.log(`Wydarzenia (${events.length}):`, events.slice(0, 5));
    }
  }
}
