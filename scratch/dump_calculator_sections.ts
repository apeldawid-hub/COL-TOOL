import * as xlsxModule from 'xlsx';
import path from 'path';
import fs from 'fs';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

const filePath = path.resolve('COL CALC/COL plan na wrzesień 2025.xlsx');
const buffer = fs.readFileSync(filePath);
const wb = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellStyles: true });

const calcSheet = wb.Sheets['CALCULATOR'];

function dumpTable(title: string, startRow: number, endRow: number) {
  console.log(`\n======================================================`);
  console.log(`TABLE: ${title} (Rows ${startRow}..${endRow})`);
  console.log(`======================================================`);

  for (let r = startRow; r <= endRow; r++) {
    const rowEntries: string[] = [];
    for (let c = 7; c < 110; c++) { // cols H (index 7) onwards
      const colLetter = XLSX.utils.encode_col(c);
      const cell = calcSheet[`${colLetter}${r}`];
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        rowEntries.push(`${colLetter}${r}: "${String(cell.v).trim()}"${cell.f ? ` [=${cell.f}]` : ''}`);
      }
    }
    if (rowEntries.length > 0) {
      console.log(`R${r}: ${rowEntries.join(' | ')}`);
    }
  }
}

// 1. Crew Umowa o Pracę (UoP)
dumpTable('CREW UMOWA O PRACĘ (UoP)', 20, 24);

// 2. Total row for Crew UoP
dumpTable('CREW UoP TOTAL', 41, 41);

// 3. Crew Umowa Zlecenie (UZ) headers and first rows
dumpTable('CREW UMOWA ZLECENIE (UZ)', 42, 46);

// 4. Total row for Crew UZ
dumpTable('CREW UZ TOTAL', 66, 66);

// 5. Other costs
dumpTable('OTHER COSTS', 67, 80);
