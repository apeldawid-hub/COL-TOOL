import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

for (const name of ['AOP', 'TPLH PLAN', 'USER GUIDE', 'Fields Description', 'DANE']) {
  const sheet = wb.Sheets[name];
  console.log(`\n=== SHEET: ${name} (Range: ${sheet['!ref']}) ===`);
  const keys = Object.keys(sheet).filter(k => !k.startsWith('!'));
  console.log(`Total cell keys: ${keys.length}`);
  // print first 20 cells
  for (const k of keys.slice(0, 25)) {
    const c = sheet[k];
    console.log(`  ${k}: ${JSON.stringify(c.v)}${c.f ? ` [=${c.f}]` : ''}`);
  }
}
