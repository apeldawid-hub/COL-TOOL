import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

function printNonEmpty(sheetName: string, maxRows = 100) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return;
  console.log(`\n======================================================`);
  console.log(`NON EMPTY ROWS IN: "${sheetName}"`);
  console.log(`======================================================`);
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  for (let r = range.s.r; r <= Math.min(range.e.r, maxRows); r++) {
    const entries: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        entries.push(`${XLSX.utils.encode_col(c)}: ${String(cell.v).trim().substring(0, 35)}${cell.f ? ` [=${cell.f}]` : ''}`);
      }
    }
    if (entries.length > 0) {
      console.log(`R${r + 1}: ${entries.slice(0, 10).join(' | ')}${entries.length > 10 ? ` ... (+${entries.length - 10} more)` : ''}`);
    }
  }
}

// Inspect AOP
printNonEmpty('AOP', 35);

// Inspect TPLH PLAN
printNonEmpty('TPLH PLAN', 50);

// Inspect Rezerwa urlopowa
printNonEmpty('Rezerwa urlopowa', 110);
