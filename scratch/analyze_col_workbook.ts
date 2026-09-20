import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const colDir = path.resolve('COL CALC');
const files = fs.readdirSync(colDir);
console.log('Files in COL CALC:', files);

const targetFile = files.find(f => f.endsWith('.xlsx'));
if (!targetFile) {
  console.error('No xlsx file found');
  process.exit(1);
}

const filePath = path.join(colDir, targetFile);
console.log('Reading file:', filePath);

const buffer = fs.readFileSync(filePath);
const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

console.log('Sheet Names:', workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  const sheet = workbook.Sheets[sheetName];
  const ref = sheet['!ref'] || 'Empty';
  console.log(`\n========================================`);
  console.log(`SHEET: "${sheetName}" (Range: ${ref})`);
  console.log(`========================================`);

  // Print first 25 rows with non-empty content
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, blankrows: false });
  console.log(`Total non-blank rows: ${data.length}`);
  for (let i = 0; i < Math.min(data.length, 30); i++) {
    const row = data[i];
    const rowStr = row.map(c => (c !== undefined && c !== null ? String(c).trim() : '')).filter(Boolean).slice(0, 10).join(' | ');
    if (rowStr) {
      console.log(`R${i + 1}: ${rowStr}`);
    }
  }
}
