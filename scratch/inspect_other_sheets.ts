import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

function inspectSheet(sheetName: string, maxRows = 40, maxCols = 30) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    console.log(`Sheet "${sheetName}" not found`);
    return;
  }
  console.log(`\n======================================================`);
  console.log(`INSPECTING SHEET: "${sheetName}" (Range: ${sheet['!ref']})`);
  console.log(`======================================================`);

  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const endRow = Math.min(range.e.r, maxRows);
  const endCol = Math.min(range.e.c, maxCols);

  for (let r = range.s.r; r <= endRow; r++) {
    const rowEntries: string[] = [];
    for (let c = range.s.c; c <= endCol; c++) {
      const cellAddr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[cellAddr];
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        const valStr = String(cell.v).trim().substring(0, 40);
        rowEntries.push(`${XLSX.utils.encode_col(c)}${r + 1}: ${valStr}${cell.f ? ` [=${cell.f}]` : ''}`);
      }
    }
    if (rowEntries.length > 0) {
      console.log(`R${r + 1}: ${rowEntries.join(' | ')}`);
    }
  }
}

inspectSheet('BONUS', 40, 15);
inspectSheet('Rezerwa urlopowa', 40, 10);
inspectSheet('AOP', 30, 20);
inspectSheet('TPLH PLAN', 35, 15);
