import * as xlsxModule from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;
const grafikDir = path.resolve(process.cwd(), 'Grafik');

const files = [
  { file: 'GRAFIK MGR 2026 Lipiec Janki (1).xlsm', month: 7, days: 31 },
  { file: 'Grafik Sierpien Janki 2026 (7).xlsm', month: 8, days: 31 },
  { file: 'Grafik wrzesień Janki 2026.xlsm', month: 9, days: 30 }
];

for (const { file, month, days } of files) {
  console.log(`\n=================== ${file} (Miesiąc ${month}) ===================`);
  const buffer = fs.readFileSync(path.join(grafikDir, file));
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets['Schedule'];
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  for (let r = 14; r <= 23; r++) {
    const row = data[r] || [];
    const name = row[2];
    if (!name || typeof name !== 'string' || name.includes('Plan') || name.includes('Ważne') || name.includes('Nazwa')) continue;

    const offDays = row[41];
    const workedHours = row[43];
    const ratio = row[0];

    // Policzmy kody
    const codeCounts: Record<string, number> = {};
    for (let d = 1; d <= days; d++) {
      const c = String(row[9 + d] || 'OFF').trim();
      codeCounts[c] = (codeCounts[c] || 0) + 1;
    }

    console.log(`Pracownik: "${name.padEnd(22)}" | Etat: ${String(ratio).padEnd(4)} | OFF (C41): ${String(offDays).padEnd(2)} | Wypracowane (C43): ${workedHours} | Kody:`, JSON.stringify(codeCounts));
  }
}
