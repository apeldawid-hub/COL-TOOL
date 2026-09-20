import * as xlsxModule from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import initSqlJs from 'sql.js';
import { getPolishHolidays } from '../src/modules/managers-schedule/services/managerScheduleEngine';
import { MapalParser } from '../electron/importer/mapalParser';
import { DatabaseManager } from '../electron/database/db';

const XLSX: any = (xlsxModule as any).default || xlsxModule;
const grafikDir = path.resolve(process.cwd(), 'Grafik');

// Słownik polskich zdrobnień i form imion
const NICKNAME_MAP: Record<string, string> = {
  gabi: 'gabriela',
  gabrysia: 'gabriela',
  zuza: 'zuzanna',
  zuzia: 'zuzanna',
  werka: 'weronika',
  wera: 'weronika',
  hania: 'hanna',
  ola: 'aleksandra',
  olka: 'aleksandra',
  kuba: 'jakub',
  bartek: 'bartosz',
  bartlomiej: 'bartosz',
  tomek: 'tomasz',
  krzysiek: 'krzysztof',
  krzys: 'krzysztof',
  aga: 'agnieszka',
  magda: 'magdalena',
  kasia: 'katarzyna',
  ania: 'anna',
  gosia: 'malgorzata',
  malgosia: 'malgorzata',
  piotrek: 'piotr',
  maciek: 'maciej',
  patka: 'patrycja',
  natalka: 'natalia',
  nati: 'natalia'
};

const canonicalToken = (token: string): string => NICKNAME_MAP[token] || token;

const normalizeEmpName = (str: string): string[] => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[,.-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(canonicalToken)
    .sort();
};

const matchesManagerEmp = (excelEmpName: string, mgrName: string): boolean => {
  const tokensA = normalizeEmpName(excelEmpName);
  const tokensB = normalizeEmpName(mgrName);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  return tokensB.every(t => tokensA.includes(t));
};

interface ScheduleFileInfo {
  fileName: string;
  year: number;
  month: number;
  days: number;
}

const scheduleFiles: ScheduleFileInfo[] = [
  { fileName: 'GRAFIK MGR 2026 Styczen.xlsm', year: 2026, month: 1, days: 31 },
  { fileName: 'GRAFIK MGR 2026 luty.xlsm', year: 2026, month: 2, days: 28 },
  { fileName: 'GRAFIK MGR 2026 marzec (1).xlsm', year: 2026, month: 3, days: 31 },
  { fileName: 'GRAFIK MGR 2026 kwiecień (1) 1 (1).xlsm', year: 2026, month: 4, days: 30 },
  { fileName: 'GRAFIK MGR 2026 maj (1).xlsm', year: 2026, month: 5, days: 31 },
  { fileName: 'GRAFIK MGR 2026 czerwiec Janki (2).xlsm', year: 2026, month: 6, days: 30 },
  { fileName: 'GRAFIK MGR 2026 Lipiec Janki (1).xlsm', year: 2026, month: 7, days: 31 },
  { fileName: 'Grafik Sierpien Janki 2026 (7).xlsm', year: 2026, month: 8, days: 31 },
  { fileName: 'Grafik wrzesień Janki 2026.xlsm', year: 2026, month: 9, days: 30 }
];

async function main() {
  console.log('========================================================================');
  console.log('🚀 ROZPOCZĘCIE IMPORTU WSZYSTKICH GRAFIKÓW Z JANEK (STYCZEŃ – WRZESIEŃ 2026)');
  console.log('========================================================================\n');

  const SQL = await initSqlJs();
  const dbPath = path.resolve(process.cwd(), 'data', 'tplh_forecast.db');
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // 1. Zapewnienie pełnej listy pracowników w manager_employees (w tym historycznych)
  const allMasterEmployees = [
    { id: 1, name: 'Dawid Szeluga', role: 'CUSTOMER AND SALES MANAGER', contract_type: 'FULL', contract_hours_ratio: 1.0, hourly_rate: 37.0, sort_order: 1, is_active: 1 },
    { id: 2, name: 'Dawid Apel', role: 'ASSISTANT STORE MANAGER', contract_type: 'FULL', contract_hours_ratio: 1.0, hourly_rate: 34.0, sort_order: 2, is_active: 1 },
    { id: 3, name: 'Kamil Kamiński', role: 'SSV', contract_type: 'FULL', contract_hours_ratio: 1.0, hourly_rate: 32.5, sort_order: 3, is_active: 1 },
    { id: 4, name: 'Zuzanna Makowska', role: 'SSV', contract_type: '0.75', contract_hours_ratio: 0.75, hourly_rate: 32.5, sort_order: 4, is_active: 1 },
    { id: 5, name: 'Weronika Bieńkowska', role: 'SSV', contract_type: '0.5', contract_hours_ratio: 0.5, hourly_rate: 32.5, sort_order: 5, is_active: 1 },
    { id: 6, name: 'Gabi Znojek', role: 'SSV', contract_type: 'FULL', contract_hours_ratio: 1.0, hourly_rate: 32.5, sort_order: 6, is_active: 1 },
    { id: 7, name: 'Aleksandra Płużyńska', role: 'SSV', contract_type: 'FULL', contract_hours_ratio: 1.0, hourly_rate: 32.5, sort_order: 7, is_active: 1 },
    { id: 8, name: 'Hanna Domachowska', role: 'SSV', contract_type: '0.5', contract_hours_ratio: 0.5, hourly_rate: 32.5, sort_order: 8, is_active: 0 },
    { id: 9, name: 'Maciej Chlabicz', role: 'SSV IN TRAINING', contract_type: 'FULL', contract_hours_ratio: 1.0, hourly_rate: 32.5, sort_order: 9, is_active: 0 },
    { id: 10, name: 'Weronika Stasiewicz', role: 'SSV IN TRAINING', contract_type: 'FULL', contract_hours_ratio: 1.0, hourly_rate: 32.5, sort_order: 10, is_active: 0 }
  ];

  for (const emp of allMasterEmployees) {
    db.run(`
      INSERT INTO manager_employees (id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        contract_type = excluded.contract_type,
        contract_hours_ratio = excluded.contract_hours_ratio,
        hourly_rate = excluded.hourly_rate,
        sort_order = excluded.sort_order;
    `, [emp.id, emp.name, emp.role, emp.contract_type, emp.contract_hours_ratio, emp.hourly_rate, emp.sort_order, emp.is_active]);
  }
  console.log(`✅ Zsynchronizowano tabelę główną manager_employees (10 pracowników).\n`);

  // 2. Pobranie słownika zmian
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

  const holidays = getPolishHolidays(2026);

  // 3. Przetwarzanie plików miesiąc po miesiącu
  for (const info of scheduleFiles) {
    const filePath = path.join(grafikDir, info.fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Brak pliku: ${info.fileName}, pomijam.`);
      continue;
    }

    console.log(`------------------------------------------------------------------------`);
    console.log(`📅 Przetwarzanie: ${info.fileName} (Miesiąc: ${info.month}/${info.year}, ${info.days} dni)`);
    const fileBuf = fs.readFileSync(filePath);
    const wb = XLSX.read(fileBuf, { type: 'buffer' });
    const ws = wb.Sheets['Schedule'];
    if (!ws) {
      console.error(`❌ Brak arkusza Schedule w pliku ${info.fileName}!`);
      continue;
    }

    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Czyścimy dotychczasowe zmiany, wydarzenia i skład dla tego miesiąca
    db.run("DELETE FROM manager_schedule_shifts WHERE year = ? AND month = ?", [info.year, info.month]);
    db.run("DELETE FROM manager_schedule_events WHERE year = ? AND month = ?", [info.year, info.month]);
    db.run("DELETE FROM manager_monthly_roster WHERE year = ? AND month = ?", [info.year, info.month]);

    const insShiftStmt = db.prepare(`
      INSERT INTO manager_schedule_shifts (year, month, day, date, employee_id, shift_code, hours, notes, disposition)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insRosterStmt = db.prepare(`
      INSERT INTO manager_monthly_roster (year, month, employee_id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let importedShiftsCount = 0;
    let importedEventsCount = 0;
    const activeEmployeesInMonth: Array<{ emp: typeof allMasterEmployees[0]; ratio: number; role: string; contractType: string }> = [];

    // Pierwsza pętla: rozpoznanie pracowników i ich etatu/roli w danym miesiącu
    for (let r = 14; r <= 24; r++) {
      const row = data[r];
      if (!row || !row[2]) continue;
      const colName = String(row[2]).trim();
      if (colName.includes('Ważne') || colName.includes('TOTAL') || colName.includes('Supporty') || colName.includes('Will Kućma') || colName.includes('BILANS')) {
        continue;
      }

      const matchedMaster = allMasterEmployees.find(m => matchesManagerEmp(colName, m.name));
      if (!matchedMaster) {
        console.warn(`  ⚠️ Nieznana osoba w wierszu r${r}: "${colName}"`);
        continue;
      }

      // Odczyt etatu z kolumny 0
      const rawEtat = row[0] !== undefined ? String(row[0]).trim() : '';
      let ratio = matchedMaster.contract_hours_ratio;
      let contractType = matchedMaster.contract_type;

      if (rawEtat === 'FULL' || rawEtat === '1' || rawEtat === '1.0') {
        ratio = 1.0;
        contractType = 'FULL';
      } else if (rawEtat === '0.75') {
        ratio = 0.75;
        contractType = '0.75';
      } else if (rawEtat === '0.5' || rawEtat === '0.50') {
        ratio = 0.5;
        contractType = '0.5';
      } else if (rawEtat === '0.25') {
        ratio = 0.25;
        contractType = '0.25';
      }

      // Odczyt roli z kolumny 7
      const rawRole = row[7] !== undefined ? String(row[7]).trim() : '';
      let role = rawRole || matchedMaster.role;
      if (matchedMaster.name === 'Maciej Chlabicz' || matchedMaster.name === 'Weronika Stasiewicz') {
        role = 'SSV IN TRAINING';
      }

      activeEmployeesInMonth.push({
        emp: matchedMaster,
        ratio,
        role,
        contractType
      });

      // Zapis do manager_monthly_roster
      insRosterStmt.run([
        info.year,
        info.month,
        matchedMaster.id,
        matchedMaster.name,
        role,
        contractType,
        ratio,
        matchedMaster.hourly_rate,
        activeEmployeesInMonth.length
      ]);

      // Druga pętla w ramach wiersza pracownika: odczyt zmian z kolumn dni (1..days)
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
          // Zgodnie z art. 154² § 1 KP: w weekendy i święta 0.0h, w dni robocze 8.0 * etat pracownika w tym miesiącu
          hours = isNonWorkingDay ? 0.0 : Number((8.0 * ratio).toFixed(1));
        } else {
          const def = shiftDefs.get(shiftCode);
          hours = def ? def.hours : 8.0;
        }

        insShiftStmt.run([
          info.year,
          info.month,
          d,
          dateStr,
          matchedMaster.id,
          shiftCode,
          hours,
          null,
          ['M', 'Z', 'FULL'].includes(shiftCode) ? shiftCode : 'OFF'
        ]);
        importedShiftsCount++;
      }
    }

    insRosterStmt.free();
    insShiftStmt.free();

    // Odczyt ważnych wydarzeń (z wiersza r24 lub innego z tekstem "Ważne")
    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;
      const c0 = String(row[0] || '');
      if (c0.toLowerCase().includes('ważne')) {
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
        break;
      }
    }

    console.log(`  ✅ Skład: ${activeEmployeesInMonth.length} menedżerów: ${activeEmployeesInMonth.map(a => `${a.emp.name} (${a.contractType})`).join(', ')}`);
    console.log(`  ✅ Zaimportowano ${importedShiftsCount} zmian oraz ${importedEventsCount} ważnych wydarzeń.`);
  }

  // Zapis bazy do pliku na dysku
  const exported = db.export();
  fs.writeFileSync(dbPath, Buffer.from(exported));
  console.log('\n💾 Zapisano zaktualizowaną bazę danych w data/tplh_forecast.db');

  // 4. Zaimportowanie pełnego pliku Fichajes (wraz ze wszystkimi zmianami supportowymi)
  console.log('\n========================================================================');
  console.log('📥 IMPORT PEŁNEGO PLIKU FICHAJES (amrestpl_Fichajes_Raw_Export.xls)');
  console.log('========================================================================');

  // Uruchomienie MapalParser
  const dbManager = DatabaseManager.getInstance();
  await dbManager.init();

  const rawExportPath = path.resolve('desktop_app_blueprint/reference_files/amrestpl_Fichajes_Raw_Export.xls');
  const importResult = await MapalParser.parseAndImport(rawExportPath);
  console.log('Wynik importu MAPAL:', importResult);

  // 5. Zrzut tabeli labor_actuals_log do labor_actuals_2026_seed.json
  const currentDb = dbManager.getDb();
  const actualsStmt = currentDb.prepare(`
    SELECT date, year, month, week, week_key, day_of_week, employee, category, contract_type, computable_time, unit_code, unit_name
    FROM labor_actuals_log
    ORDER BY date ASC, employee ASC
  `);
  const actualsRecords: any[] = [];
  while (actualsStmt.step()) {
    actualsRecords.push(actualsStmt.getAsObject());
  }
  actualsStmt.free();

  const seedPath = path.resolve('desktop_app_blueprint/data_schemas_and_seeds/labor_actuals_2026_seed.json');
  fs.writeFileSync(seedPath, JSON.stringify(actualsRecords, null, 2), 'utf8');
  console.log(`✅ Zaktualizowano seed labor_actuals_2026_seed.json z ${actualsRecords.length} rekordami.`);

  console.log('\n========================================================================');
  console.log('🎉 ZAKOŃCZONO POMYŚLNIE PEŁNY IMPORT GRAFIKÓW I LOGOWAŃ MAPAL!');
  console.log('========================================================================\n');
}

main().catch(err => {
  console.error('BŁĄD IMPORTU:', err);
  process.exit(1);
});
