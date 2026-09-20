import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellStyles: true });

const sheet = wb.Sheets['CALCULATOR'];

console.log('Inspecting cell styles and yellow input fields in CALCULATOR:');
// Check cells with styles or background colors
const cellsWithBg: Record<string, any> = {};
for (const k of Object.keys(sheet)) {
  if (k.startsWith('!')) continue;
  const cell = sheet[k];
  if (cell.s) {
    cellsWithBg[k] = cell.s;
  }
}
console.log('Cells with explicit styles:', Object.keys(cellsWithBg).length);
if (Object.keys(cellsWithBg).length > 0) {
  for (const k of Object.keys(cellsWithBg).slice(0, 15)) {
    console.log(`${k}:`, JSON.stringify(cellsWithBg[k]));
  }
}
