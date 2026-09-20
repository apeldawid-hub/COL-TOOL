import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

const calcSheet = wb.Sheets['CALCULATOR'];

console.log('=== CALCULATOR: COLS BH .. DG ===');
for (let r = 1; r <= 30; r++) {
  const rowEntries: string[] = [];
  for (let c = 59; c < 112; c++) { // 59 is BH
    const colLetter = XLSX.utils.encode_col(c);
    const cell = calcSheet[`${colLetter}${r}`];
    if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
      rowEntries.push(`${colLetter}${r}: "${String(cell.v).trim()}"${cell.f ? ` [=${cell.f}]` : ''}`);
    }
  }
  if (rowEntries.length > 0) {
    console.log(`R${r}: ${rowEntries.join(' | ')}`);
  }
}
