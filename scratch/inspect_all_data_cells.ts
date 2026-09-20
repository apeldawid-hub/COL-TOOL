import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const keys = Object.keys(sheet).filter(k => !k.startsWith('!'));
  const populated = keys.filter(k => {
    const c = sheet[k];
    return c && c.v !== undefined && c.v !== null && c.v !== '';
  });
  console.log(`Sheet "${name}": ${populated.length} populated cells out of ${keys.length} defined cells.`);
}
