import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

const sheet = wb.Sheets['USER GUIDE'];

console.log('=== USER GUIDE FULL DUMP ===');
const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  if (r && r.length > 0) {
    const text = r.map((c: any) => (c !== undefined && c !== null ? String(c).trim() : '')).filter(Boolean).join(' | ');
    if (text) {
      console.log(`L${i + 1}: ${text}`);
    }
  }
}
