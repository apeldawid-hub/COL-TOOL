import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

async function exportFullDatabaseToImportDir() {
  const importDir = path.join(process.cwd(), 'IMPORT');
  if (!fs.existsSync(importDir)) {
    fs.mkdirSync(importDir, { recursive: true });
  }

  const dbPath = path.join(process.cwd(), 'data', 'tplh_forecast.db');
  if (!fs.existsSync(dbPath)) {
    console.error('Brak pliku bazy danych:', dbPath);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // Kopia bazy binarnej do folderu IMPORT
  fs.writeFileSync(path.join(importDir, 'tplh_forecast_master_backup.db'), fileBuffer);

  const tables = [
    'stores',
    'aop_plans',
    'calendar_weeks',
    'labor_actuals_log',
    'weekly_actual_trx',
    'floor_rules',
    'nc_rules',
    'manager_employees',
    'shift_definitions',
    'manager_schedule_shifts',
    'manager_schedule_events',
    'manager_schedule_versions',
    'manager_monthly_norms',
    'manager_monthly_roster',
    'training_partners',
    'training_shifts',
    'training_skill_checks'
  ];

  const exportSummary: Record<string, number> = {};

  for (const table of tables) {
    try {
      const stmt = db.prepare(`SELECT * FROM ${table}`);
      const rows: any[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();

      const filePath = path.join(importDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');
      exportSummary[table] = rows.length;
      console.log(`✅ Wyeksportowano ${table}: ${rows.length} rekordów -> ${table}.json`);
    } catch (err: any) {
      console.warn(`⚠️ Pominięto ${table}: ${err.message}`);
    }
  }

  // Tworzymy manifest
  const manifest = {
    packageName: 'Starbucks Operations Suite — Historical Master Package',
    version: '2.6.0',
    exportDate: new Date().toISOString(),
    storeCode: '18120',
    storeName: '108120 SBX Warszawa Janki',
    tablesCount: Object.keys(exportSummary).length,
    recordsSummary: exportSummary,
    masterDatabaseFile: 'tplh_forecast_master_backup.db',
    description: 'Kompletny zestaw danych operacyjnych: Plany AOP 2021-2036, logowania MAPAL Fichajes, 9 miesięcy grafików menedżerskich 2026, miesięczne składy i role, normy KP 2016-2036 oraz moduł szkoleń Starbucks.'
  };

  fs.writeFileSync(path.join(importDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log('✨ Wygenerowano manifest.json w folderze IMPORT!');
  console.log('🎉 Cała paczka danych została pomyślnie wyeksportowana do ./IMPORT/');
}

exportFullDatabaseToImportDir().catch(console.error);
