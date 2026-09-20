import * as xlsxModule from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import initSqlJs from 'sql.js';
import { TorEngine } from '../src/modules/managers-schedule/services/torEngine';
import { ManagerScheduleEngine, getPolishHolidays } from '../src/modules/managers-schedule/services/managerScheduleEngine';

const XLSX: any = (xlsxModule as any).default || xlsxModule;
const grafikDir = path.resolve(process.cwd(), 'Grafik');

interface ScheduleFileInfo {
  fileName: string;
  year: number;
  month: number;
  days: number;
}

const filesToImport: ScheduleFileInfo[] = [
  { fileName: 'GRAFIK MGR 2026 Lipiec Janki (1).xlsm', year: 2026, month: 7, days: 31 },
  { fileName: 'Grafik Sierpien Janki 2026 (7).xlsm', year: 2026, month: 8, days: 31 },
  { fileName: 'Grafik wrzesień Janki 2026.xlsm', year: 2026, month: 9, days: 30 }
];

async function runImport() {
  console.log('=== START: IMPORT GRAFIKÓW MANAGERSKICH ZA POPRZEDNI KWARTAŁ (Q3 2026) ===\n');

  const SQL = await initSqlJs();
  const dbPath = path.resolve(process.cwd(), 'data', 'tplh_forecast.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // 1. Zapewnienie kodów zmian PR i INV w shift_definitions
  db.run(`
    INSERT INTO shift_definitions (code, name, start_time, end_time, hours, is_nc, is_absence, color_bg, color_text, category, is_sunday_only)
    VALUES ('PR', 'Praktyki dział PR', '10:00', '18:00', 8.0, 1, 0, '#F3E8FF', '#6B21A8', 'nc', 0)
    ON CONFLICT(code) DO UPDATE SET hours = 8.0, is_nc = 1, category = 'nc';

    INSERT INTO shift_definitions (code, name, start_time, end_time, hours, is_nc, is_absence, color_bg, color_text, category, is_sunday_only)
    VALUES ('INV', 'Inwentaryzacja', '22:00', '06:00', 8.0, 1, 0, '#FEF3C7', '#92400E', 'nc', 0)
    ON CONFLICT(code) DO UPDATE SET hours = 8.0, is_nc = 1, category = 'nc';
  `);

  // 2. Zapewnienie Hanny Domachowskiej w manager_employees
  const checkHanna = db.exec("SELECT id FROM manager_employees WHERE name LIKE '%Domachowska%'");
  if (checkHanna.length === 0 || checkHanna[0].values.length === 0) {
    db.run(`
      INSERT INTO manager_employees (id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active)
      VALUES (8, 'Hanna Domachowska', 'SSV', '0.5', 0.5, 32.5, 8, 1);
    `);
    console.log('✅ Dodano Hannę Domachowską do manager_employees (etat 0.5)');
  }

  // Pobranie pracowników
  const empRes = db.exec("SELECT id, name, role, contract_type, contract_hours_ratio FROM manager_employees ORDER BY sort_order ASC");
  const employees = empRes[0].values.map(r => ({
    id: Number(r[0]),
    name: String(r[1]),
    role: String(r[2]),
    contract_type: String(r[3]),
    contract_hours_ratio: Number(r[4])
  }));

  // Słownik definicji zmian
  const shiftDefsRes = db.exec("SELECT code, hours, is_nc, is_absence, is_sunday_only FROM shift_definitions");
  const shiftDefs = new Map<string, { hours: number; is_nc: boolean; is_absence: boolean }>();
  if (shiftDefsRes.length > 0) {
    for (const r of shiftDefsRes[0].values) {
      shiftDefs.set(String(r[0]), {
        hours: Number(r[1]),
        is_nc: Boolean(r[2]),
        is_absence: Boolean(r[3])
      });
    }
  }

  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[,.-]/g, ' ').split(/\s+/).filter(Boolean).sort();
  const matchEmp = (excelName: string) => {
    const tA = normalize(excelName);
    return employees.find(e => {
      const tB = normalize(e.name);
      return tB.every(token => tA.includes(token));
    });
  };

  const holidays = getPolishHolidays(2026);

  // 3. Przetwarzanie plików
  for (const info of filesToImport) {
    const filePath = path.join(grafikDir, info.fileName);
    console.log(`\n--------------------------------------------------`);
    console.log(`Wczytywanie: ${info.fileName} (${info.year}-${String(info.month).padStart(2, '0')}, ${info.days} dni)`);
    const fileBuf = fs.readFileSync(filePath);
    const wb = XLSX.read(fileBuf, { type: 'buffer' });
    const ws = wb.Sheets['Schedule'];
    if (!ws) {
      console.error(`❌ Brak arkusza Schedule w pliku ${info.fileName}!`);
      continue;
    }
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Czyścimy dotychczasowe zmiany dla danego roku i miesiąca przed importem
    db.run("DELETE FROM manager_schedule_shifts WHERE year = ? AND month = ?", [info.year, info.month]);
    db.run("DELETE FROM manager_schedule_events WHERE year = ? AND month = ?", [info.year, info.month]);

    const insShiftStmt = db.prepare(`
      INSERT INTO manager_schedule_shifts (year, month, day, date, employee_id, shift_code, hours, notes, disposition)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let importedShiftsCount = 0;
    let importedEventsCount = 0;

    for (let r = 14; r < data.length; r++) {
      const row = data[r] || [];
      const colName = row[2];

      // Wiersz Ważne wydarzenia
      if (typeof row[0] === 'string' && row[0].toLowerCase().includes('ważne')) {
        for (let d = 1; d <= info.days; d++) {
          const evText = row[9 + d];
          if (evText && typeof evText === 'string' && evText.trim() !== '') {
            const dateStr = `${info.year}-${String(info.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            db.run(`
              INSERT INTO manager_schedule_events (year, month, day, date, event_text)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(year, month, day) DO UPDATE SET event_text = excluded.event_text
            `, [info.year, info.month, d, dateStr, evText.trim()]);
            importedEventsCount++;
          }
        }
        continue;
      }

      if (!colName || typeof colName !== 'string') continue;
      if (colName.includes('Plan') || colName.includes('Ważne') || colName.includes('Nazwa') || colName.includes('Obsada') || colName.includes('Otwarcie') || colName.includes('Zamknięcie')) continue;

      const emp = matchEmp(colName);
      if (!emp) {
        // Ignorujemy pomocników jak "Will Kućma"
        console.log(`  Pominięto osobę spoza zespołu: "${colName}"`);
        continue;
      }

      for (let d = 1; d <= info.days; d++) {
        const rawCode = row[9 + d];
        const shiftCode = (rawCode === undefined || rawCode === null || String(rawCode).trim() === '') ? 'OFF' : String(rawCode).trim();
        const date = new Date(info.year, info.month - 1, d);
        const dayOfWeek = date.getDay(); // 0 = Nd, 6 = So
        const dateStr = `${info.year}-${String(info.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isNonWorkingDay = dayOfWeek === 0 || dayOfWeek === 6 || holidays.has(dateStr);

        let hours = 0;
        if (shiftCode === 'OFF' || ['M', 'Z', 'FULL'].includes(shiftCode)) {
          hours = 0.0;
        } else if (shiftCode === 'H' || shiftCode === 'L4') {
          // Zgodnie z art. 154² § 1 KP i regułami aplikacji: w weekendy i święta 0.0h, w dni robocze 8.0 * etat
          hours = isNonWorkingDay ? 0.0 : Number((8.0 * emp.contract_hours_ratio).toFixed(1));
        } else {
          const def = shiftDefs.get(shiftCode);
          hours = def ? def.hours : 8.0;
        }

        insShiftStmt.run([
          info.year,
          info.month,
          d,
          dateStr,
          emp.id,
          shiftCode,
          hours,
          null,
          ['M', 'Z', 'FULL'].includes(shiftCode) ? shiftCode : 'OFF'
        ]);
        importedShiftsCount++;
      }
    }

    insShiftStmt.free();
    console.log(`✅ Zaimportowano ${importedShiftsCount} zmian oraz ${importedEventsCount} wydarzeń dla ${info.year}-${info.month}`);
  }

  // Zapis bazy do pliku na dysku
  const exported = db.export();
  fs.writeFileSync(dbPath, Buffer.from(exported));
  console.log('\n💾 Zapisano zaktualizowaną bazę danych w data/tplh_forecast.db');

  // 4. Weryfikacja TOR (Trzymiesięczny Okres Rozliczeniowy)
  console.log('\n==================================================');
  console.log('🚀 AUTOMATYCZNE PRZELICZENIE I WERYFIKACJA TOR DLA Q3 2026');
  console.log('==================================================');

  // Pobranie danych tak jak robi to IPC db:get-tor-quarter-data
  const allShiftsRes = db.exec(`
    SELECT id, year, month, day, date, employee_id, shift_code, hours, notes, disposition
    FROM manager_schedule_shifts
    WHERE year = 2026 AND month IN (7, 8, 9)
    ORDER BY month ASC, day ASC
  `);
  const allShifts: any[] = [];
  if (allShiftsRes.length > 0) {
    const cols = allShiftsRes[0].columns;
    for (const val of allShiftsRes[0].values) {
      const s: any = {};
      cols.forEach((c, idx) => s[c] = val[idx]);
      allShifts.push(s);
    }
  }

  const normsRes = db.exec("SELECT * FROM manager_monthly_norms WHERE year = 2026 AND month IN (7, 8, 9)");
  const monthlyNorms: Record<number, any> = {};
  if (normsRes.length > 0) {
    const cols = normsRes[0].columns;
    for (const val of normsRes[0].values) {
      const n: any = {};
      cols.forEach((c, idx) => n[c] = val[idx]);
      monthlyNorms[n.month] = n;
    }
  }

  // Wyliczamy TOR przez TorEngine
  const torResult = TorEngine.calculateQuarterData(
    2026,
    3,
    employees as any,
    allShifts,
    monthlyNorms
  );

  console.log(`\nKwartał: ${torResult.quarterName}`);
  console.log(`Miesiące: ${torResult.monthNames.join(', ')}`);

  console.log('\nSzczegółowe wyniki menedżerów w Q3:');
  console.log('-------------------------------------------------------------------------------------------------------------------------');
  console.log('MANAGER                | ETAT | M7: RCP  H   L4  BIL | M8: RCP  H   L4  BIL | M9: RCP  H   L4  BIL | BILANS Q3 | STATUS');
  console.log('-------------------------------------------------------------------------------------------------------------------------');

  for (const r of torResult.rows) {
    const m7 = r.months[0];
    const m8 = r.months[1];
    const m9 = r.months[2];

    const fmtM = (m: any) => `${String(m.rcpHours).padStart(4)} ${String(m.hHours).padStart(3)} ${String(m.l4Hours).padStart(3)} ${m.balanceHours >= 0 ? '+' : ''}${String(m.balanceHours).padStart(4)}`;

    const name = r.employee.name.padEnd(22);
    const etat = String(r.employee.contract_type).padEnd(4);
    const qBil = `${r.quarterTotalBalance >= 0 ? '+' : ''}${r.quarterTotalBalance} h`.padStart(9);
    const status = r.quarterStatus.toUpperCase();

    console.log(`${name} | ${etat} | ${fmtM(m7)} | ${fmtM(m8)} | ${fmtM(m9)} | ${qBil} | ${status}`);
  }
  console.log('-------------------------------------------------------------------------------------------------------------------------');

  db.close();
}

runImport().catch(err => {
  console.error('Błąd importu:', err);
  process.exit(1);
});
