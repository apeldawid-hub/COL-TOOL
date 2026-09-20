import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { DatabaseManager } from './database/db';
import { BackupManager } from './database/backupManager';
import { MapalParser } from './importer/mapalParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  const dbManager = DatabaseManager.getInstance();
  await dbManager.init();

  // Sprawdzenie i wykonanie automatycznego backupu startowego
  try {
    BackupManager.getInstance().checkAndPerformStartupBackup();
  } catch (err) {
    console.error('Błąd backupu startowego:', err);
  }

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

// Słownik polskich zdrobnień i form imion menedżerów
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

const canonicalToken = (token: string): string => {
  return NICKNAME_MAP[token] || token;
};

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

  // Pobranie wszystkich historycznych miesięcy AOP z wykonaniem rzeczywistym
  ipcMain.handle('db:get-all-historical-aop-plans', () => {
    dbManager.reloadFromDisk();
    const db = dbManager.getDb();
    const stmt = db.prepare(`
      SELECT key, year, month, month_code, weeks_count, plan_trx, target_tplh, labor_budget, avg_weekly_hours,
             plan_sales, actual_sales, actual_trx, actual_tplh
      FROM aop_plans
      WHERE (actual_trx IS NOT NULL AND actual_trx > 0) OR (actual_tplh IS NOT NULL AND actual_tplh > 0)
      ORDER BY year ASC, month_code ASC
    `);
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
        AND (unit_code = '384' OR unit_name LIKE '%108120%' OR unit_code IS NULL OR unit_code = '')
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
        AND (unit_code = '384' OR unit_name LIKE '%108120%' OR unit_code IS NULL OR unit_code = '')
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

  // ==========================================
  // MODUŁ 2: MANAGERS SCHEDULE IPC HANDLERS
  // ==========================================

  // Pobranie danych grafiku managerskiego (zespół, definicje zmian, zmiany danego miesiąca, wydarzenia)
  ipcMain.handle('db:get-manager-schedule-data', (_event, year: number, month: number) => {
    dbManager.reloadFromDisk();
    const db = dbManager.getDb();

    // 1. Pracownicy (menedżerowie) dla wybranego miesiąca ze struktury manager_monthly_roster
    const employees = dbManager.getMonthlyRoster(year, month);

    // 2. Słownik zmian
    const shiftDefStmt = db.prepare(`
      SELECT code, name, start_time, end_time, hours, is_nc, is_absence, color_bg, color_text, category, is_sunday_only
      FROM shift_definitions
      ORDER BY is_absence ASC, is_nc ASC, code ASC
    `);
    const shiftDefinitions: any[] = [];
    while (shiftDefStmt.step()) {
      shiftDefinitions.push(shiftDefStmt.getAsObject());
    }
    shiftDefStmt.free();

    // 3. Zmiany przypisane w wybranym roku i miesiącu
    const shiftsStmt = db.prepare(`
      SELECT id, year, month, day, date, employee_id, shift_code, hours, notes, disposition, custom_start_time, custom_end_time
      FROM manager_schedule_shifts
      WHERE year = ? AND month = ?
      ORDER BY day ASC
    `);
    shiftsStmt.bind([year, month]);
    const shifts: any[] = [];
    while (shiftsStmt.step()) {
      shifts.push(shiftsStmt.getAsObject());
    }
    shiftsStmt.free();

    // 4. Wydarzenia / notatki dzienne
    const eventsStmt = db.prepare(`
      SELECT id, year, month, day, date, event_text
      FROM manager_schedule_events
      WHERE year = ? AND month = ?
      ORDER BY day ASC
    `);
    eventsStmt.bind([year, month]);
    const events: any[] = [];
    while (eventsStmt.step()) {
      events.push(eventsStmt.getAsObject());
    }
    eventsStmt.free();

    // 5. Norma miesiąca z bazy (lub oficjalna KP)
    const normStmt = db.prepare(`
      SELECT year, month, working_days, off_days, full_time_hours, is_custom, notes, updated_at
      FROM manager_monthly_norms
      WHERE year = ? AND month = ?
    `);
    normStmt.bind([year, month]);
    let monthlyNorm: any = null;
    if (normStmt.step()) {
      monthlyNorm = normStmt.getAsObject();
    }
    normStmt.free();

    // 6. Zmiany graniczne z sąsiednich miesięcy dla inspekcji Kodeksu Pracy na styku miesięcy
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;

    // Ostatnie 7 dni z poprzedniego miesiąca (dni 22..31)
    const prevShiftsStmt = db.prepare(`
      SELECT id, year, month, day, date, employee_id, shift_code, hours, notes, disposition, custom_start_time, custom_end_time
      FROM manager_schedule_shifts
      WHERE year = ? AND month = ? AND day >= 22
      ORDER BY day ASC
    `);
    prevShiftsStmt.bind([prevYear, prevMonth]);
    const prevMonthShifts: any[] = [];
    while (prevShiftsStmt.step()) {
      prevMonthShifts.push(prevShiftsStmt.getAsObject());
    }
    prevShiftsStmt.free();

    // Pierwsze 7 dni z kolejnego miesiąca (dni 1..7 dla pełnego cyklu przełomu tygodni)
    const nextShiftsStmt = db.prepare(`
      SELECT id, year, month, day, date, employee_id, shift_code, hours, notes, disposition, custom_start_time, custom_end_time
      FROM manager_schedule_shifts
      WHERE year = ? AND month = ? AND day <= 7
      ORDER BY day ASC
    `);
    nextShiftsStmt.bind([nextYear, nextMonth]);
    const nextMonthShifts: any[] = [];
    while (nextShiftsStmt.step()) {
      nextMonthShifts.push(nextShiftsStmt.getAsObject());
    }
    nextShiftsStmt.free();

    // 7. Zarejestrowane logowania RCP menedżerów z labor_actuals_log (ze wszystkich lokali)
    const matchesManager = matchesManagerEmp;

    const datePrefix = `${year}-${String(month).padStart(2, '0')}-%`;
    const rcpStmt = db.prepare(`
      SELECT date, employee, computable_time, unit_code, unit_name
      FROM labor_actuals_log
      WHERE date LIKE ?
      ORDER BY date ASC
    `);
    rcpStmt.bind([datePrefix]);

    // rcpLogs: empId -> day -> { hours, unitCode, unitName }
    const rcpLogs: Record<number, Record<number, { hours: number; unitCode?: string; unitName?: string }>> = {};
    const rcpDaysSet = new Set<number>();

    while (rcpStmt.step()) {
      const rcp = rcpStmt.getAsObject();
      const rcpEmpName = String(rcp.employee || '');
      const matchedEmp = employees.find(e => matchesManager(rcpEmpName, e.name));
      if (matchedEmp) {
        const dStr = String(rcp.date || '');
        const day = parseInt(dStr.split('-')[2], 10);
        if (day >= 1 && day <= 31) {
          rcpDaysSet.add(day);
          if (!rcpLogs[matchedEmp.id]) {
            rcpLogs[matchedEmp.id] = {};
          }
          const prev = rcpLogs[matchedEmp.id][day];
          const newHours = Number((Number(prev?.hours || 0) + Number(rcp.computable_time || 0)).toFixed(2));
          rcpLogs[matchedEmp.id][day] = {
            hours: newHours,
            unitCode: String(rcp.unit_code || ''),
            unitName: String(rcp.unit_name || '')
          };
        }
      }
    }
    rcpStmt.free();

    const daysInMonth = new Date(year, month, 0).getDate();
    const hasCompleteRcpLogs = rcpDaysSet.has(daysInMonth) || (rcpDaysSet.size >= 15);

    return {
      employees,
      shiftDefinitions,
      shifts,
      events,
      monthlyNorm,
      boundaryShifts: {
        prevMonthShifts,
        nextMonthShifts
      },
      rcpLogs,
      hasCompleteRcpLogs
    };
  });

  // Pobranie danych dla Trzymiesięcznego Okresu Rozliczeniowego (TOR)
  ipcMain.handle('db:get-tor-quarter-data', (_event, year: number, quarter: number) => {
    const db = dbManager.getDb();
    const q = Number(quarter) || 1;
    const y = Number(year) || 2026;
    const months = q === 1 ? [1, 2, 3] : q === 2 ? [4, 5, 6] : q === 3 ? [7, 8, 9] : [10, 11, 12];

    // 1. Zbudowanie składu menedżerów aktywnego w kwartale na podstawie manager_monthly_roster
    const employeeMap = new Map<number, any>();
    for (const m of months) {
      const mRoster = dbManager.getMonthlyRoster(y, m);
      for (const emp of mRoster) {
        if (!employeeMap.has(emp.id)) {
          employeeMap.set(emp.id, {
            ...emp,
            activeMonths: [m],
            monthlyRatios: { [m]: emp.contract_hours_ratio },
            monthlyRoles: { [m]: emp.role }
          });
        } else {
          const existing = employeeMap.get(emp.id);
          if (!existing.activeMonths.includes(m)) {
            existing.activeMonths.push(m);
          }
          existing.monthlyRatios[m] = emp.contract_hours_ratio;
          existing.monthlyRoles[m] = emp.role;
        }
      }
    }
    const employees: any[] = Array.from(employeeMap.values()).sort((a, b) => a.sort_order - b.sort_order);

    const shiftsStmt = db.prepare(`
      SELECT id, year, month, day, date, employee_id, shift_code, hours, notes, disposition, custom_start_time, custom_end_time
      FROM manager_schedule_shifts
      WHERE year = ? AND month IN (${months.join(',')})
      ORDER BY month ASC, day ASC
    `);
    shiftsStmt.bind([y]);
    const shifts: any[] = [];
    while (shiftsStmt.step()) {
      shifts.push(shiftsStmt.getAsObject());
    }
    shiftsStmt.free();

    const normsStmt = db.prepare(`
      SELECT year, month, working_days, off_days, full_time_hours, is_custom, notes, updated_at
      FROM manager_monthly_norms
      WHERE year = ? AND month IN (${months.join(',')})
    `);
    normsStmt.bind([y]);
    const monthlyNorms: Record<number, any> = {};
    while (normsStmt.step()) {
      const n = normsStmt.getAsObject();
      monthlyNorms[Number(n.month)] = n;
    }
    normsStmt.free();

    const matchesManager = matchesManagerEmp;

    // Pobranie rzeczywistych logowań RCP dla menedżerów w kwartale
    const actualRcpByMonth: Record<number, Record<number, number>> = {}; // empId -> month -> totalHours
    const hasActualRcpByMonth: Record<number, boolean> = {}; // month -> boolean

    for (const m of months) {
      const dPrefix = `${y}-${String(m).padStart(2, '0')}-%`;
      const mRcpStmt = db.prepare(`
        SELECT date, employee, computable_time
        FROM labor_actuals_log
        WHERE date LIKE ?
      `);
      mRcpStmt.bind([dPrefix]);

      const mRcpDays = new Set<number>();
      while (mRcpStmt.step()) {
        const rcp = mRcpStmt.getAsObject();
        const rcpEmpName = String(rcp.employee || '');
        const matchedEmp = employees.find(e => matchesManager(rcpEmpName, e.name));
        if (matchedEmp) {
          const dStr = String(rcp.date || '');
          const day = parseInt(dStr.split('-')[2], 10);
          mRcpDays.add(day);

          if (!actualRcpByMonth[matchedEmp.id]) {
            actualRcpByMonth[matchedEmp.id] = {};
          }
          const prev = actualRcpByMonth[matchedEmp.id][m] || 0;
          actualRcpByMonth[matchedEmp.id][m] = Number((prev + Number(rcp.computable_time || 0)).toFixed(1));
        }
      }
      mRcpStmt.free();

      const daysInM = new Date(y, m, 0).getDate();
      hasActualRcpByMonth[m] = mRcpDays.has(daysInM) || (mRcpDays.size >= 15);
    }

    return { employees, shifts, monthlyNorms, months, actualRcpByMonth, hasActualRcpByMonth };
  });

  // Zapis / nadpisanie normy miesięcznej
  ipcMain.handle('db:save-monthly-norm', (_event, norm: any) => {
    const db = dbManager.getDb();
    const stmt = db.prepare(`
      INSERT INTO manager_monthly_norms (year, month, working_days, off_days, full_time_hours, is_custom, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(year, month) DO UPDATE SET
        working_days = excluded.working_days,
        off_days = excluded.off_days,
        full_time_hours = excluded.full_time_hours,
        is_custom = 1,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run([
      Number(norm.year),
      Number(norm.month),
      Number(norm.working_days),
      Number(norm.off_days),
      Number(norm.full_time_hours),
      norm.notes || 'Ręczna korekta normy'
    ]);
    stmt.free();
    dbManager.persist();
    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Przywrócenie domyślnej normy Kodeksu Pracy dla danego miesiąca
  ipcMain.handle('db:reset-monthly-norm', (_event, year: number, month: number) => {
    const db = dbManager.getDb();
    db.run(`
      DELETE FROM manager_monthly_norms WHERE year = ? AND month = ?
    `, [Number(year), Number(month)]);
    dbManager.persist();
    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Zapis pojedynczej zmiany menedżera z opcjonalną rejestracją modyfikacji po publikacji
  ipcMain.handle('db:save-manager-shift', (_event, shift: any) => {
    const db = dbManager.getDb();
    
    // Sprawdzenie czy grafik jest w fazie opublikowanej (mniej niż 7 dni do startu miesiąca lub w trakcie)
    const year = Number(shift.year);
    const month = Number(shift.month);
    const cutoffDate = new Date(year, month - 1, 1, 0, 0, 0);
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const now = new Date();
    const isPostPublication = now >= cutoffDate;

    // Pobranie poprzedniego kodu zmiany przed nadpisaniem
    let prevCode = 'OFF';
    const prevRes = db.exec(`SELECT shift_code FROM manager_schedule_shifts WHERE year = ${year} AND month = ${month} AND day = ${Number(shift.day)} AND employee_id = ${Number(shift.employee_id)}`);
    if (prevRes.length > 0 && prevRes[0].values.length > 0) {
      prevCode = String(prevRes[0].values[0][0]);
    }

    const stmt = db.prepare(`
      INSERT INTO manager_schedule_shifts (year, month, day, date, employee_id, shift_code, hours, notes, disposition, custom_start_time, custom_end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'OFF'), ?, ?)
      ON CONFLICT(year, month, day, employee_id) DO UPDATE SET
        shift_code = excluded.shift_code,
        hours = excluded.hours,
        notes = excluded.notes,
        disposition = COALESCE(excluded.disposition, manager_schedule_shifts.disposition, 'OFF'),
        custom_start_time = excluded.custom_start_time,
        custom_end_time = excluded.custom_end_time
    `);
    stmt.run([
      year,
      month,
      Number(shift.day),
      String(shift.date),
      Number(shift.employee_id),
      String(shift.shift_code),
      Number(shift.hours),
      shift.notes || null,
      shift.disposition || null,
      shift.custom_start_time || null,
      shift.custom_end_time || null
    ]);
    stmt.free();

    // Rejestracja modyfikacji po publikacji, jeśli zmiana zaszła w fazie po dacie publikacji (7 dni przed wejściem w życie)
    if (isPostPublication && prevCode !== shift.shift_code) {
      const empRes = db.exec(`SELECT name FROM manager_employees WHERE id = ${Number(shift.employee_id)}`);
      const empName = (empRes.length > 0 && empRes[0].values.length > 0) ? String(empRes[0].values[0][0]) : `Pracownik #${shift.employee_id}`;

      const numRes = db.exec(`SELECT MAX(version_num) FROM manager_schedule_versions WHERE year = ${year} AND month = ${month}`);
      const maxNum = (numRes.length > 0 && numRes[0].values.length > 0 && numRes[0].values[0][0]) ? Number(numRes[0].values[0][0]) : 0;

      const vStmt = db.prepare(`
        INSERT INTO manager_schedule_versions
        (year, month, version_num, version_type, title, description, shifts_json, is_published)
        VALUES (?, ?, ?, 'post_publication_edit', ?, ?, '[]', 1)
      `);
      vStmt.run([
        year,
        month,
        maxNum + 1,
        `Korekta po publikacji: ${empName} • Dzień ${shift.day} (${prevCode} → ${shift.shift_code})`,
        shift.reason ? `Powód: ${shift.reason}` : `Modyfikacja grafiku po terminie publikacji 7 dni (art. 129 § 3 KP)`
      ]);
      vStmt.free();
    }

    dbManager.persist();
    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Zapis dyspozycyjności menedżera na dany dzień
  ipcMain.handle('db:save-manager-disposition', (_event, payload: any) => {
    const db = dbManager.getDb();
    const year = Number(payload.year);
    const month = Number(payload.month);
    const day = Number(payload.day);
    const date = String(payload.date);
    const employeeId = Number(payload.employee_id);
    const disposition = String(payload.disposition || 'OFF');

    const stmt = db.prepare(`
      INSERT INTO manager_schedule_shifts (year, month, day, date, employee_id, shift_code, hours, disposition)
      VALUES (?, ?, ?, ?, ?, 'OFF', 0.0, ?)
      ON CONFLICT(year, month, day, employee_id) DO UPDATE SET
        disposition = excluded.disposition
    `);
    stmt.run([year, month, day, date, employeeId, disposition]);
    stmt.free();

    dbManager.persist();
    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Zbiorczy zapis dyspozycyjności menedżerów (Matryca Miesięczna / Import z Excela)
  ipcMain.handle('db:save-batch-manager-dispositions', (_event, payload: {
    year: number;
    month: number;
    items: Array<{ day: number; employee_id: number; disposition: string; date?: string }>;
  }) => {
    const db = dbManager.getDb();
    const year = Number(payload.year);
    const month = Number(payload.month);
    const items = payload.items || [];

    if (items.length === 0) return true;

    db.run('BEGIN TRANSACTION;');
    try {
      const stmt = db.prepare(`
        INSERT INTO manager_schedule_shifts (year, month, day, date, employee_id, shift_code, hours, disposition)
        VALUES (?, ?, ?, ?, ?, 'OFF', 0.0, ?)
        ON CONFLICT(year, month, day, employee_id) DO UPDATE SET
          disposition = excluded.disposition
      `);

      for (const item of items) {
        const day = Number(item.day);
        const empId = Number(item.employee_id);
        const dateStr = item.date || `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const disposition = String(item.disposition || 'OFF');
        stmt.run([year, month, day, dateStr, empId, disposition]);
      }
      stmt.free();
      db.run('COMMIT;');
      dbManager.persist();
      if (mainWindow) {
        mainWindow.webContents.send('data:refreshed');
      }
      return true;
    } catch (err) {
      try { db.run('ROLLBACK;'); } catch (_) {}
      console.error('Błąd podczas zbiorczego zapisu dyspozycji:', err);
      throw err;
    }
  });

  // Pobranie listy wersji grafiku dla wybranego roku i miesiąca
  ipcMain.handle('db:get-schedule-versions', (_event, year: number, month: number) => {
    dbManager.reloadFromDisk();
    const db = dbManager.getDb();
    const stmt = db.prepare(`
      SELECT id, year, month, version_num, version_type, title, description, is_published, created_at
      FROM manager_schedule_versions
      WHERE year = ? AND month = ?
      ORDER BY id DESC
    `);
    stmt.bind([year, month]);
    const list: any[] = [];
    while (stmt.step()) {
      list.push(stmt.getAsObject());
    }
    stmt.free();
    return list;
  });

  // Zapis nowej wersji / punktu przywracania grafiku
  ipcMain.handle('db:save-schedule-version', (_event, payload: any) => {
    const db = dbManager.getDb();
    const year = Number(payload.year);
    const month = Number(payload.month);

    // Pobierz aktualny zrzut zmian z bazy
    const sStmt = db.prepare(`
      SELECT year, month, day, date, employee_id, shift_code, hours, notes 
      FROM manager_schedule_shifts 
      WHERE year = ? AND month = ?
    `);
    sStmt.bind([year, month]);
    const currentShifts: any[] = [];
    while (sStmt.step()) {
      currentShifts.push(sStmt.getAsObject());
    }
    sStmt.free();
    const shiftsJson = JSON.stringify(currentShifts);

    // Kolejny numer wersji
    const numRes = db.exec(`SELECT MAX(version_num) FROM manager_schedule_versions WHERE year = ${year} AND month = ${month}`);
    const maxNum = (numRes.length > 0 && numRes[0].values.length > 0 && numRes[0].values[0][0])
      ? Number(numRes[0].values[0][0])
      : 0;
    const versionNum = maxNum + 1;

    const vStmt = db.prepare(`
      INSERT INTO manager_schedule_versions
      (year, month, version_num, version_type, title, description, shifts_json, events_json, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    vStmt.run([
      year,
      month,
      versionNum,
      payload.version_type || 'draft',
      payload.title || `Wersja v${versionNum}`,
      payload.description || '',
      shiftsJson,
      payload.events_json || null,
      payload.is_published ? 1 : 0
    ]);
    vStmt.free();
    dbManager.persist();

    // Automatyczny backup bazy przed publikacją oficjalnego grafiku
    if (payload.is_published) {
      try {
        BackupManager.getInstance().createBackup('pre_version_publish');
      } catch (err) {
        console.warn('Ostrzeżenie: Nie udało się wykonać automatycznego backupu przed publikacją wersji:', err);
      }
    }

    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Przywrócenie wybranej wersji grafiku
  ipcMain.handle('db:restore-schedule-version', (_event, versionId: number) => {
    const db = dbManager.getDb();
    const stmt = db.prepare("SELECT * FROM manager_schedule_versions WHERE id = ?");
    stmt.bind([versionId]);
    if (!stmt.step()) {
      stmt.free();
      throw new Error(`Nie znaleziono wersji o ID ${versionId}`);
    }
    const version = stmt.getAsObject() as any;
    stmt.free();

    const year = Number(version.year);
    const month = Number(version.month);

    // Sprawdzenie reguły 7 dni: po opublikowaniu grafiku nie wolno wracać do wersji roboczych!
    const cutoffDate = new Date(year, month - 1, 1, 0, 0, 0);
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const now = new Date();
    if (now >= cutoffDate && version.version_type === 'draft') {
      throw new Error('Zgodnie z art. 129 § 3 Kodeksu Pracy na 7 dni przed rozpoczęciem miesiąca grafik został opublikowany. Przywracanie wcześniejszych wersji roboczych zostało zablokowane.');
    }

    const shiftsToRestore: any[] = JSON.parse(version.shifts_json || '[]');
    if (shiftsToRestore.length === 0) {
      throw new Error('Wybrany rekord wersji nie zawiera zapisanego stanu grafiku.');
    }

    // Usunięcie bieżących zmian i wstawienie zmigrowanych ze snapshotu
    db.run("DELETE FROM manager_schedule_shifts WHERE year = ? AND month = ?", [year, month]);

    const insStmt = db.prepare(`
      INSERT INTO manager_schedule_shifts (year, month, day, date, employee_id, shift_code, hours, notes, disposition, custom_start_time, custom_end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of shiftsToRestore) {
      insStmt.run([
        Number(s.year),
        Number(s.month),
        Number(s.day),
        String(s.date),
        Number(s.employee_id),
        String(s.shift_code),
        Number(s.hours),
        s.notes || null,
        s.disposition || 'OFF',
        s.custom_start_time || null,
        s.custom_end_time || null
      ]);
    }
    insStmt.free();

    dbManager.persist();
    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Zapis notatki / wydarzenia dziennego
  ipcMain.handle('db:save-manager-event', (_event, event: any) => {
    const db = dbManager.getDb();
    const text = String(event.event_text || '').trim();
    if (!text) {
      db.run(`DELETE FROM manager_schedule_events WHERE year = ? AND month = ? AND day = ?`, [
        Number(event.year),
        Number(event.month),
        Number(event.day)
      ]);
    } else {
      const stmt = db.prepare(`
        INSERT INTO manager_schedule_events (year, month, day, date, event_text)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(year, month, day) DO UPDATE SET
          event_text = excluded.event_text
      `);
      stmt.run([
        Number(event.year),
        Number(event.month),
        Number(event.day),
        String(event.date),
        text
      ]);
      stmt.free();
    }
    dbManager.persist();
    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Aktualizacja zespołu menedżerów (obsługa dedykowanego składu per miesiąc lub globalnego)
  ipcMain.handle('db:manage-employees', (_event, payload: any) => {
    if (payload && !Array.isArray(payload) && payload.year && payload.month && Array.isArray(payload.employees)) {
      const propagate = payload.propagateToFuture !== undefined ? Boolean(payload.propagateToFuture) : true;
      dbManager.saveMonthlyRoster(Number(payload.year), Number(payload.month), payload.employees, propagate);
    } else {
      // Wsteczna kompatybilność: bezpośrednia tablica pracowników
      const employees = Array.isArray(payload) ? payload : (payload?.employees || []);
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      dbManager.saveMonthlyRoster(currentYear, currentMonth, employees, true);
    }
    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Kopiowanie i nadpisanie składu z poprzedniego miesiąca
  ipcMain.handle('db:copy-roster-from-previous-month', (_event, year: number, month: number) => {
    const roster = dbManager.copyRosterFromPreviousMonth(Number(year), Number(month));
    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return roster;
  });

  // Zapis / aktualizacja słownika zmian
  ipcMain.handle('db:save-shift-definitions', (_event, shifts: any[]) => {
    const db = dbManager.getDb();
    for (const s of shifts) {
      const isSundayOnly = (s.is_sunday_only || (s.name && s.name.toLowerCase().includes('niedziel')) || s.code === 'AMN' || s.code === 'PMN') ? 1 : 0;
      db.run(`
        INSERT INTO shift_definitions (code, name, start_time, end_time, hours, is_nc, is_absence, color_bg, category, is_sunday_only)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          name = excluded.name,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          hours = excluded.hours,
          is_nc = excluded.is_nc,
          is_absence = excluded.is_absence,
          category = excluded.category,
          is_sunday_only = excluded.is_sunday_only
      `, [
        s.code.trim().toUpperCase(),
        s.name,
        s.start_time,
        s.end_time,
        Number(s.hours) || 0.0,
        s.is_nc ? 1 : 0,
        s.is_absence ? 1 : 0,
        s.color_bg || 'bg-stone-50 text-stone-700',
        s.category || 'coverage',
        isSundayOnly
      ]);
    }
    dbManager.persist();
    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
  });

  // Usunięcie definicji zmiany
  ipcMain.handle('db:delete-shift-definition', (_event, code: string) => {
    const db = dbManager.getDb();
    db.run('DELETE FROM shift_definitions WHERE code = ?', [code]);
    dbManager.persist();
    if (mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return true;
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
    try {
      BackupManager.getInstance().createBackup('pre_import_mapal');
    } catch (err) {
      console.warn('Ostrzeżenie: backup przed importem:', err);
    }
    const result = await MapalParser.parseAndImport(filePath);
    if (result.success && mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return result;
  });

  // Import z bufora danych (np. po drag & drop na okno)
  ipcMain.handle('import:fichajes-buffer', async (_event, arrayBuffer: ArrayBuffer) => {
    try {
      BackupManager.getInstance().createBackup('pre_import_mapal');
    } catch (err) {
      console.warn('Ostrzeżenie: backup przed importem:', err);
    }
    const buffer = Buffer.from(arrayBuffer);
    const result = await MapalParser.parseAndImport(buffer);
    if (result.success && mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return result;
  });

  // Zarządzanie Kopiami Zapasowymi (SQLite Backup Manager)
  ipcMain.handle('db:create-backup', (_event, reason?: string) => {
    return BackupManager.getInstance().createBackup(reason || 'manual');
  });

  ipcMain.handle('db:list-backups', () => {
    return BackupManager.getInstance().listBackups();
  });

  ipcMain.handle('db:restore-backup', (_event, filename: string) => {
    const res = BackupManager.getInstance().restoreBackup(filename);
    if (res.success && mainWindow) {
      mainWindow.webContents.send('data:refreshed');
    }
    return res;
  });

  ipcMain.handle('db:get-database-status', () => {
    return BackupManager.getInstance().getDatabaseStatus();
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
