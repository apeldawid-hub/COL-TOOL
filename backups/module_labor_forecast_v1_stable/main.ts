import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { DatabaseManager } from './database/db';
import { MapalParser } from './importer/mapalParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  const dbManager = DatabaseManager.getInstance();
  await dbManager.init();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 740,
    backgroundColor: '#F7F9F8',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // W trybie deweloperskim ładujemy URL z Vite, w produkcyjnym plik index.html
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Rejestracja IPC
function setupIpcHandlers() {
  const dbManager = DatabaseManager.getInstance();

  // Systemowy zegar i data OS
  ipcMain.handle('system:get-time', () => {
    const now = new Date();
    return {
      iso: now.toISOString(),
      timestamp: now.toLocaleString('pl-PL'),
      hours: now.getHours(),
      minutes: now.getMinutes(),
      seconds: now.getSeconds(),
      day: now.getDate(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    };
  });

  // Pobranie lat z bazy
  ipcMain.handle('db:get-available-years', () => {
    const db = dbManager.getDb();
    const res = db.exec('SELECT DISTINCT year FROM aop_plans ORDER BY year ASC');
    if (res.length > 0 && res[0].values) {
      return res[0].values.map((v: any) => Number(v[0]));
    }
    return [2026];
  });

  // Pobranie miesięcy dla wybranego roku
  ipcMain.handle('db:get-months-for-year', (_event, year: number) => {
    const db = dbManager.getDb();
    const res = db.exec(`
      SELECT month FROM aop_plans 
      WHERE year = ${year} 
      ORDER BY month_code ASC
    `);
    if (res.length > 0 && res[0].values) {
      return res[0].values.map((v: any) => String(v[0]));
    }
    return [];
  });

  // Pobranie planu AOP dla wybranego roku i miesiąca
  ipcMain.handle('db:get-aop-plan', (_event, year: number, month: string) => {
    dbManager.reloadFromDisk();
    const db = dbManager.getDb();
    const key = `${year}_${month}`;
    const stmt = db.prepare('SELECT * FROM aop_plans WHERE key = ?');
    stmt.bind([key]);
    let result = null;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      result = {
        key: String(row.key),
        year: Number(row.year),
        month: String(row.month),
        month_code: String(row.month_code),
        weeks_count: Number(row.weeks_count),
        plan_trx: Number(row.plan_trx),
        target_tplh: Number(row.target_tplh),
        labor_budget: Number(row.labor_budget),
        avg_weekly_hours: Number(row.avg_weekly_hours),
        plan_sales: row.plan_sales !== null && row.plan_sales !== undefined ? Number(row.plan_sales) : null,
        actual_sales: row.actual_sales !== null && row.actual_sales !== undefined ? Number(row.actual_sales) : null,
        actual_trx: row.actual_trx !== null && row.actual_trx !== undefined ? Number(row.actual_trx) : null,
        actual_tplh: row.actual_tplh !== null && row.actual_tplh !== undefined ? Number(row.actual_tplh) : null
      };
    }
    stmt.free();
    return result;
  });

  // Pobranie wszystkich miesięcy AOP dla wybranego roku
  ipcMain.handle('db:get-aop-plans-for-year', (_event, year: number) => {
    dbManager.reloadFromDisk();
    const db = dbManager.getDb();
    const stmt = db.prepare(`
      SELECT key, year, month, month_code, weeks_count, plan_trx, target_tplh, labor_budget, avg_weekly_hours,
             plan_sales, actual_sales, actual_trx, actual_tplh
      FROM aop_plans
      WHERE year = ?
      ORDER BY month_code ASC
    `);
    stmt.bind([year]);
    const plans: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      plans.push({
        key: String(row.key),
        year: Number(row.year),
        month: String(row.month),
        month_code: String(row.month_code),
        weeks_count: Number(row.weeks_count),
        plan_trx: Number(row.plan_trx),
        target_tplh: Number(row.target_tplh),
        labor_budget: Number(row.labor_budget),
        avg_weekly_hours: Number(row.avg_weekly_hours),
        plan_sales: row.plan_sales !== null && row.plan_sales !== undefined ? Number(row.plan_sales) : null,
        actual_sales: row.actual_sales !== null && row.actual_sales !== undefined ? Number(row.actual_sales) : null,
        actual_trx: row.actual_trx !== null && row.actual_trx !== undefined ? Number(row.actual_trx) : null,
        actual_tplh: row.actual_tplh !== null && row.actual_tplh !== undefined ? Number(row.actual_tplh) : null
      });
    }
    stmt.free();
    return plans;
  });

  // Zapis pojedynczego planu AOP
  ipcMain.handle('db:save-aop-plan', (_event, plan: any) => {
    const db = dbManager.getDb();
    const targetTplh = Number(plan.target_tplh) > 0 ? Number(plan.target_tplh) : 6.7;
    const planTrx = Math.round(Number(plan.plan_trx) || 0);
    const weeksCount = Number(plan.weeks_count) || 5;
    const laborBudget = Number((planTrx / targetTplh).toFixed(1));
    const avgWeekly = Number((laborBudget / weeksCount).toFixed(1));
    const planSales = plan.plan_sales !== undefined ? plan.plan_sales : null;
    const actualSales = plan.actual_sales !== undefined ? plan.actual_sales : null;
    const actualTrx = plan.actual_trx !== undefined ? plan.actual_trx : null;
    const actualTplh = plan.actual_tplh !== undefined ? plan.actual_tplh : null;

    db.run(`
      INSERT INTO aop_plans 
      (key, year, month, month_code, weeks_count, plan_trx, target_tplh, labor_budget, avg_weekly_hours, plan_sales, actual_sales, actual_trx, actual_tplh)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        year=excluded.year,
        month=excluded.month,
        month_code=excluded.month_code,
        weeks_count=excluded.weeks_count,
        plan_trx=excluded.plan_trx,
        target_tplh=excluded.target_tplh,
        labor_budget=excluded.labor_budget,
        avg_weekly_hours=excluded.avg_weekly_hours,
        plan_sales=COALESCE(excluded.plan_sales, aop_plans.plan_sales),
        actual_sales=COALESCE(excluded.actual_sales, aop_plans.actual_sales),
        actual_trx=COALESCE(excluded.actual_trx, aop_plans.actual_trx),
        actual_tplh=COALESCE(excluded.actual_tplh, aop_plans.actual_tplh)
    `, [
      plan.key,
      Number(plan.year),
      plan.month,
      plan.month_code,
      weeksCount,
      planTrx,
      targetTplh,
      laborBudget,
      avgWeekly,
      planSales,
      actualSales,
      actualTrx,
      actualTplh
    ]);

    dbManager.persist();
    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Zapis wielu miesięcy AOP (roczny plan)
  ipcMain.handle('db:save-yearly-aop', (_event, plans: any[]) => {
    const db = dbManager.getDb();
    const stmt = db.prepare(`
      INSERT INTO aop_plans 
      (key, year, month, month_code, weeks_count, plan_trx, target_tplh, labor_budget, avg_weekly_hours, plan_sales, actual_sales, actual_trx, actual_tplh)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        year=excluded.year,
        month=excluded.month,
        month_code=excluded.month_code,
        weeks_count=excluded.weeks_count,
        plan_trx=excluded.plan_trx,
        target_tplh=excluded.target_tplh,
        labor_budget=excluded.labor_budget,
        avg_weekly_hours=excluded.avg_weekly_hours,
        plan_sales=COALESCE(excluded.plan_sales, aop_plans.plan_sales),
        actual_sales=COALESCE(excluded.actual_sales, aop_plans.actual_sales),
        actual_trx=COALESCE(excluded.actual_trx, aop_plans.actual_trx),
        actual_tplh=COALESCE(excluded.actual_tplh, aop_plans.actual_tplh)
    `);

    for (const plan of plans) {
      const targetTplh = Number(plan.target_tplh) > 0 ? Number(plan.target_tplh) : 6.7;
      const planTrx = Math.round(Number(plan.plan_trx) || 0);
      const weeksCount = Number(plan.weeks_count) || 5;
      const laborBudget = Number((planTrx / targetTplh).toFixed(1));
      const avgWeekly = Number((laborBudget / weeksCount).toFixed(1));
      const planSales = plan.plan_sales !== undefined ? plan.plan_sales : null;
      const actualSales = plan.actual_sales !== undefined ? plan.actual_sales : null;
      const actualTrx = plan.actual_trx !== undefined ? plan.actual_trx : null;
      const actualTplh = plan.actual_tplh !== undefined ? plan.actual_tplh : null;

      stmt.run([
        plan.key,
        Number(plan.year),
        plan.month,
        plan.month_code,
        weeksCount,
        planTrx,
        targetTplh,
        laborBudget,
        avgWeekly,
        planSales,
        actualSales,
        actualTrx,
        actualTplh
      ]);
    }
    stmt.free();
    dbManager.persist();

    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Pobranie tygodni dla wybranego roku i miesiąca
  ipcMain.handle('db:get-weeks-for-month', (_event, year: number, month: string) => {
    const db = dbManager.getDb();
    const stmt = db.prepare(`
      SELECT week_key, year, month_name, week_num_in_month, days_count, week_type, date_from, date_to, floor_hours, day_weight
      FROM calendar_weeks
      WHERE year = ? AND month_name = ? AND days_count > 0
      ORDER BY week_num_in_month ASC
    `);
    stmt.bind([year, month]);
    const weeks: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      weeks.push({
        week_key: String(row.week_key),
        year: Number(row.year),
        month_name: String(row.month_name),
        week_num_in_month: String(row.week_num_in_month),
        days_count: Number(row.days_count),
        week_type: String(row.week_type),
        date_from: String(row.date_from),
        date_to: String(row.date_to),
        floor_hours: Number(row.floor_hours),
        day_weight: Number(row.day_weight)
      });
    }
    stmt.free();
    return weeks;
  });

  // Pobranie sumy godzin rzeczywistych po tygodniach dla danego miesiąca
  ipcMain.handle('db:get-actual-hours-for-month', (_event, year: number, month: string) => {
    const db = dbManager.getDb();
    const pattern = `${year}_${month}_%`;
    const stmt = db.prepare(`
      SELECT week_key, SUM(computable_time) as total_hours
      FROM labor_actuals_log
      WHERE week_key LIKE ?
      GROUP BY week_key
    `);
    stmt.bind([pattern]);
    const hoursMap: Record<string, number> = {};
    while (stmt.step()) {
      const row = stmt.getAsObject();
      hoursMap[String(row.week_key)] = Number(row.total_hours);
    }
    stmt.free();
    return hoursMap;
  });

  // Pobranie wprowadzonych przez SM transakcji actual TRX
  ipcMain.handle('db:get-weekly-actual-trx-map', (_event, year: number, month: string) => {
    const db = dbManager.getDb();
    const pattern = `${year}_${month}_%`;
    const stmt = db.prepare(`
      SELECT week_key, actual_trx
      FROM weekly_actual_trx
      WHERE week_key LIKE ?
    `);
    stmt.bind([pattern]);
    const trxMap: Record<string, number | null> = {};
    while (stmt.step()) {
      const row = stmt.getAsObject();
      trxMap[String(row.week_key)] = row.actual_trx !== null ? Number(row.actual_trx) : null;
    }
    stmt.free();
    return trxMap;
  });

  // Pobranie wprowadzonych zaplanowanych godzin (Scheduled Hours) dla otwartych tygodni
  ipcMain.handle('db:get-weekly-scheduled-hours-map', (_event, year: number, month: string) => {
    dbManager.reloadFromDisk();
    const db = dbManager.getDb();
    const pattern = `${year}_${month}_%`;
    const stmt = db.prepare(`
      SELECT week_key, scheduled_hours
      FROM weekly_actual_trx
      WHERE week_key LIKE ? AND scheduled_hours IS NOT NULL
    `);
    stmt.bind([pattern]);
    const scheduledMap: Record<string, number> = {};
    while (stmt.step()) {
      const row = stmt.getAsObject();
      scheduledMap[String(row.week_key)] = Number(row.scheduled_hours);
    }
    stmt.free();
    return scheduledMap;
  });

  // Zapis wprowadzonych TRX dla tygodnia
  ipcMain.handle('db:save-weekly-trx', (_event, weekKey: string, trx: number | null) => {
    const db = dbManager.getDb();
    if (trx === null || isNaN(trx)) {
      db.run(`
        UPDATE weekly_actual_trx SET actual_trx = NULL WHERE week_key = ?
      `, [weekKey]);
    } else {
      db.run(`
        INSERT INTO weekly_actual_trx (week_key, actual_trx, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(week_key) DO UPDATE SET actual_trx = excluded.actual_trx, updated_at = CURRENT_TIMESTAMP
      `, [weekKey, Math.round(trx)]);
    }
    dbManager.persist();
    return true;
  });

  // Zapis wprowadzonych zaplanowanych godzin grafiku (Scheduled Hours) dla tygodnia
  ipcMain.handle('db:save-weekly-scheduled-hours', (_event, weekKey: string, hours: number | null) => {
    const db = dbManager.getDb();
    if (hours === null || isNaN(hours) || hours <= 0) {
      db.run(`
        UPDATE weekly_actual_trx SET scheduled_hours = NULL WHERE week_key = ?
      `, [weekKey]);
    } else {
      db.run(`
        INSERT INTO weekly_actual_trx (week_key, scheduled_hours, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(week_key) DO UPDATE SET scheduled_hours = excluded.scheduled_hours, updated_at = CURRENT_TIMESTAMP
      `, [weekKey, Number(hours.toFixed(1))]);
    }
    dbManager.persist();
    return true;
  });

  // Pobranie ewidencji logowań pracowników dla wskazanego tygodnia lub całego miesiąca
  ipcMain.handle('db:get-labor-records', (_event, key: string) => {
    const db = dbManager.getDb();
    let stmt;
    if (key && key.includes('_W')) {
      stmt = db.prepare(`
        SELECT id, date, day_of_week, employee, category, contract_type, computable_time, unit_code, unit_name, week
        FROM labor_actuals_log
        WHERE week_key = ?
        ORDER BY date ASC, employee ASC
      `);
      stmt.bind([key]);
    } else if (key && key.includes('_')) {
      const parts = key.split('_');
      const year = Number(parts[0]);
      const month = parts.slice(1).join('_');
      if (!isNaN(year) && month) {
        stmt = db.prepare(`
          SELECT id, date, day_of_week, employee, category, contract_type, computable_time, unit_code, unit_name, week
          FROM labor_actuals_log
          WHERE year = ? AND month = ?
          ORDER BY date ASC, employee ASC
        `);
        stmt.bind([year, month]);
      } else {
        stmt = db.prepare(`
          SELECT id, date, day_of_week, employee, category, contract_type, computable_time, unit_code, unit_name, week
          FROM labor_actuals_log
          WHERE week_key LIKE ?
          ORDER BY date ASC, employee ASC
        `);
        stmt.bind([`${key}_%`]);
      }
    } else {
      stmt = db.prepare(`
        SELECT id, date, day_of_week, employee, category, contract_type, computable_time, unit_code, unit_name, week
        FROM labor_actuals_log
        WHERE week_key LIKE ?
        ORDER BY date ASC, employee ASC
      `);
      stmt.bind([`${key}_%`]);
    }
    const records: any[] = [];
    while (stmt.step()) {
      records.push(stmt.getAsObject());
    }
    stmt.free();
    return records;
  });

  // Pobranie reguł obsady Floor Hours
  ipcMain.handle('db:get-floor-rules', () => {
    const db = dbManager.getDb();
    // Upewniamy się, że tabela istnieje
    db.run(`
      CREATE TABLE IF NOT EXISTS floor_rules (
        day_id TEXT PRIMARY KEY,
        day_name TEXT NOT NULL,
        shifts_count INTEGER NOT NULL,
        hours_per_shift REAL NOT NULL,
        total_day_hours REAL NOT NULL
      );
      INSERT OR IGNORE INTO floor_rules (day_id, day_name, shifts_count, hours_per_shift, total_day_hours) VALUES
      ('monday', 'Poniedziałek', 5, 8.0, 40.0),
      ('tuesday', 'Wtorek', 5, 8.0, 40.0),
      ('wednesday', 'Środa', 5, 8.0, 40.0),
      ('thursday', 'Czwartek', 5, 8.0, 40.0),
      ('friday', 'Piątek', 5, 8.0, 40.0),
      ('saturday', 'Sobota', 5, 8.0, 40.0),
      ('sunday', 'Niedziela', 4, 8.0, 32.0);
    `);

    const res = db.exec(`
      SELECT day_id, day_name, shifts_count, hours_per_shift, total_day_hours
      FROM floor_rules
    `);

    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const rulesMap: Record<string, any> = {};

    if (res.length > 0 && res[0].values) {
      for (const row of res[0].values) {
        rulesMap[String(row[0])] = {
          day_id: String(row[0]),
          day_name: String(row[1]),
          shifts_count: Number(row[2]),
          hours_per_shift: Number(row[3]),
          total_day_hours: Number(row[4]),
        };
      }
    }

    return dayOrder.map(id => rulesMap[id] || {
      day_id: id,
      day_name: id,
      shifts_count: id === 'sunday' ? 4 : 5,
      hours_per_shift: 8.0,
      total_day_hours: id === 'sunday' ? 32.0 : 40.0,
    });
  });

  // Zapis reguł obsady Floor Hours
  ipcMain.handle('db:save-floor-rules', (_event, rules: any[]) => {
    const db = dbManager.getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO floor_rules 
      (day_id, day_name, shifts_count, hours_per_shift, total_day_hours)
      VALUES (?, ?, ?, ?, ?)
    `);

    let weeklySum = 0;
    for (const r of rules) {
      const shifts = Math.max(1, Math.round(Number(r.shifts_count) || 0));
      const hoursPerShift = Math.max(1, Number(r.hours_per_shift) || 8.0);
      const totalDay = Number((shifts * hoursPerShift).toFixed(1));
      weeklySum += totalDay;

      stmt.run([
        r.day_id,
        r.day_name,
        shifts,
        hoursPerShift,
        totalDay
      ]);
    }
    stmt.free();

    // Aktualizacja w tabeli stores
    db.run(`UPDATE stores SET weekly_floor_hours = ? WHERE store_code = '384'`, [weeklySum]);

    dbManager.persist();

    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Pobranie reguł godzin NC (Non-Coverage)
  ipcMain.handle('db:get-nc-rules', () => {
    dbManager.reloadFromDisk();
    const db = dbManager.getDb();
    const stmt = db.prepare(`SELECT id, name, category, monthly_hours, is_mandatory FROM nc_rules ORDER BY id ASC`);
    const rules: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rules.push({
        id: String(row.id),
        name: String(row.name),
        category: String(row.category),
        monthly_hours: Number(row.monthly_hours),
        is_mandatory: Boolean(row.is_mandatory),
      });
    }
    stmt.free();
    return rules;
  });

  // Zapis reguł godzin NC
  ipcMain.handle('db:save-nc-rules', (_event, rules: any[]) => {
    const db = dbManager.getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO nc_rules (id, name, category, monthly_hours, is_mandatory)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const r of rules) {
      stmt.run([
        r.id,
        r.name,
        r.category,
        Number(r.monthly_hours) || 0,
        r.is_mandatory ? 1 : 0,
      ]);
    }
    stmt.free();
    dbManager.persist();
    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Agregacja godzin według dni tygodnia z bazy logowań MAPAL
  ipcMain.handle('db:get-day-of-week-stats', () => {
    const db = dbManager.getDb();
    const stmt = db.prepare(`
      SELECT day_of_week, SUM(computable_time) as total_hours, COUNT(DISTINCT date) as days_count
      FROM labor_actuals_log
      WHERE computable_time > 0
      GROUP BY day_of_week
    `);
    const stats: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      stats.push({
        day_of_week: String(row.day_of_week),
        total_hours: Number(row.total_hours),
        days_count: Number(row.days_count),
      });
    }
    stmt.free();
    return stats;
  });

  // Otwarcie natywnego dialogu wyboru pliku Excel
  ipcMain.handle('dialog:open-file', async () => {
    if (!mainWindow) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Wybierz raport MAPAL Fichajes',
      filters: [
        { name: 'Pliki Excel (*.xls, *.xlsx)', extensions: ['xls', 'xlsx'] },
      ],
      properties: ['openFile']
    });
    if (canceled || filePaths.length === 0) return null;
    return filePaths[0];
  });

  // Import ze ścieżki pliku
  ipcMain.handle('import:fichajes-file', async (_event, filePath: string) => {
    const result = await MapalParser.parseAndImport(filePath);
    if (result.success && mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return result;
  });

  // Import z bufora danych (np. po drag & drop na okno)
  ipcMain.handle('import:fichajes-buffer', async (_event, arrayBuffer: ArrayBuffer) => {
    const buffer = Buffer.from(arrayBuffer);
    const result = await MapalParser.parseAndImport(buffer);
    if (result.success && mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return result;
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  const dbManager = DatabaseManager.getInstance();
  dbManager.persist();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  const dbManager = DatabaseManager.getInstance();
  dbManager.persist();
});
