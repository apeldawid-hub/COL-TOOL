import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

const daneSheet = wb.Sheets['DANE'];

console.log('=== DANE SHEET FULL INSPECTION ===');
const range = XLSX.utils.decode_range(daneSheet['!ref'] || 'A1:A1');
for (let r = 0; r <= range.e.r; r++) {
  const rowEntries: string[] = [];
  for (let c = 0; c <= range.e.c; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r, c });
    const cell = daneSheet[cellAddr];
    if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
      rowEntries.push(`${XLSX.utils.encode_col(c)}${r + 1}: ${String(cell.v).trim()}`);
    }
  }
  if (rowEntries.length > 0) {
    console.log(rowEntries.join(' | '));
  }
}
