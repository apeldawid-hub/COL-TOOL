import * as fs from 'fs';
import * as XLSX from 'xlsx';

const buf = fs.readFileSync('./desktop_app_blueprint/reference_files/amrestpl_Fichajes_Raw_Export.xls');
const wb = XLSX.read(buf, { type: 'buffer' });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const mgrNames = [
  'Dawid Szeluga',
  'Dawid Apel',
  'Kamil Kamiński',
  'Zuzanna Makowska',
  'Weronika Bieńkowska',
  'Hanna Domachowska',
  'Aleksandra Płużyńska'
];

function normalizeTokens(s: string): string[] {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[,.-]/g, ' ').split(/\s+/).filter(Boolean);
}

function matchMgr(name: string): string | null {
  const tA = normalizeTokens(name);
  for (const m of mgrNames) {
    const tB = normalizeTokens(m);
    if (tB.every(x => tA.includes(x))) return m;
  }
  return null;
}

const monthly: Record<string, Record<number, { janki: number; other: number; total: number }>> = {};
mgrNames.forEach(m => {
  monthly[m] = {
    7: { janki: 0, other: 0, total: 0 },
    8: { janki: 0, other: 0, total: 0 },
    9: { janki: 0, other: 0, total: 0 }
  };
});

const otherUnitsByMgr: Record<string, Set<string>> = {};
mgrNames.forEach(m => {
  otherUnitsByMgr[m] = new Set();
});

for (let i = 7; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length < 9) continue;
  const emp = String(r[2] || '');
  const matched = matchMgr(emp);
  if (!matched) continue;

  let y = 0, m = 0, d = 0;
  if (typeof dateVal === 'number') {
    const jsDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    y = jsDate.getUTCFullYear();
    m = jsDate.getUTCMonth() + 1;
    d = jsDate.getUTCDate();
  } else if (typeof dateVal === 'string') {
    const parts = dateVal.split(/[-.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        d = parseInt(parts[2], 10);
      } else {
        d = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
        y = parseInt(parts[2], 10);
      }
    }
  }
  if (y !== 2026 || m < 7 || m > 9) continue;

  const unitCode = String(r[13] || '');
  const unitName = String(r[14] || '');
  const compTime = Number(r[8]) || 0;
  const isJanki = unitCode.includes('384') || unitName.toLowerCase().includes('janki');

  if (isJanki) {
    monthly[matched][m].janki += compTime;
  } else {
    monthly[matched][m].other += compTime;
    otherUnitsByMgr[matched].add(unitCode + ' (' + unitName + ')');
  }
  monthly[matched][m].total += compTime;
}

console.log('=== PORÓWNANIE GODZIN RCP Z LOGÓW MAPAL (Janki vs Inne Lokale) ===');
for (const m of mgrNames) {
  console.log('\n--- Manager:', m, '---');
  if (otherUnitsByMgr[m].size > 0) {
    console.log('Inne lokale:', Array.from(otherUnitsByMgr[m]));
  }
  for (const mon of [7, 8, 9]) {
    const d = monthly[m][mon];
    console.log(`Miesiąc ${mon}: Janki = ${d.janki.toFixed(1)}h | Inne = ${d.other.toFixed(1)}h | RAZEM = ${d.total.toFixed(1)}h`);
  }
}
