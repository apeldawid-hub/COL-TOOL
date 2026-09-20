import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

const calcSheet = wb.Sheets['CALCULATOR'];
console.log('CALCULATOR Range:', calcSheet['!ref']);

// Convert to json with row numbers and inspect rows
const rawRows = XLSX.utils.sheet_to_json<any[]>(calcSheet, { header: 1, blankrows: true });
console.log(`Total rows in CALCULATOR: ${rawRows.length}`);

// Let's print out lines with their row index and non-empty columns
for (let r = 0; r < rawRows.length; r++) {
  const row = rawRows[r] || [];
  const entries: string[] = [];
  for (let c = 0; c < row.length; c++) {
    const val = row[c];
    if (val !== undefined && val !== null && val !== '') {
      const colLetter = XLSX.utils.encode_col(c);
      entries.push(`${colLetter}:${String(val).trim()}`);
    }
  }
  if (entries.length > 0) {
    console.log(`Row ${r + 1}: ${entries.slice(0, 12).join(' | ')}${entries.length > 12 ? ` ... (+${entries.length - 12} more)` : ''}`);
  }
}
