import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

const calcSheet = wb.Sheets['CALCULATOR'];

console.log('=== COLUMN Y & Z (VARIABLES / RATES) ===');
for (let r = 1; r <= 30; r++) {
  const y = calcSheet[`Y${r}`];
  const z = calcSheet[`Z${r}`];
  if (y || z) {
    console.log(`Row ${r}: Y="${y?.v ?? ''}" [${y?.f ?? ''}], Z="${z?.v ?? ''}" [${z?.f ?? ''}]`);
  }
}
