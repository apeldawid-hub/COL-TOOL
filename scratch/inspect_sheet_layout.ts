import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellStyles: true });

const sheet = wb.Sheets['CALCULATOR'];

// Let's inspect column widths (!cols) and row heights (!rows)
console.log('Cols:', sheet['!cols']?.map((c: any, i: number) => ({ col: XLSX.utils.encode_col(i), wch: c?.wch, width: c?.width })));
console.log('Merges:', sheet['!merges']?.length);

// Find all yellow input cells
const yellowCells: string[] = [];
for (const k of Object.keys(sheet)) {
  if (k.startsWith('!')) continue;
  const s = sheet[k]?.s;
  const rgb = s?.fgColor?.rgb;
  if (rgb === 'FFFFCC' || rgb === 'FFFF99' || rgb === 'FFFF00' || rgb === 'FFF2CC') {
    yellowCells.push(k);
  }
}
console.log(`Total yellow input cells: ${yellowCells.length}`);
console.log('Yellow input cells samples:', yellowCells.slice(0, 40).join(', '));
