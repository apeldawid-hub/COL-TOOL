import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

const calcSheet = wb.Sheets['CALCULATOR'];

console.log('=== CALCULATOR: LEFT KPI / SUMMARY BLOCK (Cols B..F, Rows 1..85) ===');
for (let r = 1; r <= 85; r++) {
  const rowEntries: string[] = [];
  for (const col of ['B', 'C', 'D', 'E', 'F']) {
    const cellAddr = `${col}${r}`;
    const cell = calcSheet[cellAddr];
    if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
      rowEntries.push(`${col}${r}: ${String(cell.v).trim()}${cell.f ? ` [=${cell.f}]` : ''}`);
    }
  }
  if (rowEntries.length > 0) {
    console.log(`R${r}: ${rowEntries.join(' | ')}`);
  }
}
