import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

const calcSheet = wb.Sheets['CALCULATOR'];

// Rows 1 to 10
for (let r = 1; r <= 10; r++) {
  const rowEntries: string[] = [];
  for (let c = 0; c < 110; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: r - 1, c });
    const cell = calcSheet[cellAddr];
    if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
      rowEntries.push(`${XLSX.utils.encode_col(c)}${r}: "${cell.v}"${cell.f ? ` [=${cell.f}]` : ''}`);
    }
  }
  if (rowEntries.length > 0) {
    console.log(`\n=== ROW ${r} ===`);
    console.log(rowEntries.join(' | '));
  }
}
