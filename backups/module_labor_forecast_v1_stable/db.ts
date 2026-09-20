import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: Database | null = null;
  private dbFilePath: string;

  private SQL: any = null;

  private constructor(storageDir?: string) {
    const dir = storageDir || path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.dbFilePath = path.join(dir, 'tplh_forecast.db');
  }

  public static getInstance(storageDir?: string): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(storageDir);
    }
    return DatabaseManager.instance;
  }

  public async init(): Promise<Database> {
    if (this.db) return this.db;

    this.SQL = await initSqlJs();

    if (fs.existsSync(this.dbFilePath)) {
      const fileBuffer = fs.readFileSync(this.dbFilePath);
      this.db = new this.SQL.Database(fileBuffer);
      console.log('📦 Załadowano istniejącą bazę SQLite z pliku:', this.dbFilePath);
      this.createSchema();
    } else {
      this.db = new this.SQL.Database();
      console.log('🆕 Utworzono nową bazę SQLite w pamięci.');
      this.createSchema();
      this.seedInitialData();
      this.persist();
    }

    return this.db!;
  }

  public reloadFromDisk(): Database {
    if (!this.SQL || !fs.existsSync(this.dbFilePath)) {
      return this.getDb();
    }
    const fileBuffer = fs.readFileSync(this.dbFilePath);
    if (this.db) {
      try {
        this.db.close();
      } catch (_) {}
    }
    this.db = new this.SQL.Database(fileBuffer);
    this.createSchema();
    console.log('🔄 Przeładowano bazę SQLite z dysku:', this.dbFilePath);
    return this.db!;
  }

  public getDb(): Database {
    if (!this.db) {
      throw new Error('Baza danych nie została zainicjalizowana. Wywołaj najpierw init().');
    }
    return this.db;
  }

  public persist(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbFilePath, buffer);
  }

  private createSchema(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS stores (
        store_code TEXT PRIMARY KEY,
        store_name TEXT NOT NULL,
        weekly_floor_hours REAL DEFAULT 272.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS aop_plans (
        key TEXT PRIMARY KEY,
        year INTEGER NOT NULL,
        month TEXT NOT NULL,
        month_code TEXT NOT NULL,
        weeks_count INTEGER NOT NULL,
        plan_trx INTEGER NOT NULL,
        target_tplh REAL NOT NULL,
        labor_budget REAL NOT NULL,
        avg_weekly_hours REAL NOT NULL,
        plan_sales REAL,
        actual_sales REAL,
        actual_trx INTEGER,
        actual_tplh REAL
      );

      CREATE TABLE IF NOT EXISTS calendar_weeks (
        week_key TEXT PRIMARY KEY,
        year INTEGER NOT NULL,
        month_name TEXT NOT NULL,
        week_num_in_month TEXT NOT NULL,
        days_count INTEGER NOT NULL,
        week_type TEXT NOT NULL,
        date_from TEXT NOT NULL,
        date_to TEXT NOT NULL,
        floor_hours REAL NOT NULL,
        day_weight REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS labor_actuals_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        year INTEGER NOT NULL,
        month TEXT NOT NULL,
        week TEXT NOT NULL,
        week_key TEXT NOT NULL,
        day_of_week TEXT,
        employee TEXT NOT NULL,
        category TEXT,
        contract_type TEXT,
        computable_time REAL NOT NULL,
        unit_code TEXT NOT NULL,
        unit_name TEXT NOT NULL,
        imported_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS weekly_actual_trx (
        week_key TEXT PRIMARY KEY,
        actual_trx INTEGER,
        manual_hours_override REAL,
        scheduled_hours REAL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS floor_rules (
        day_id TEXT PRIMARY KEY,
        day_name TEXT NOT NULL,
        shifts_count INTEGER NOT NULL,
        hours_per_shift REAL NOT NULL,
        total_day_hours REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nc_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        monthly_hours REAL NOT NULL,
        is_mandatory INTEGER DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_labor_week_key ON labor_actuals_log(week_key);
      CREATE INDEX IF NOT EXISTS idx_labor_date ON labor_actuals_log(date);
      CREATE INDEX IF NOT EXISTS idx_labor_year_month ON labor_actuals_log(year, month);
      CREATE INDEX IF NOT EXISTS idx_calendar_year_month ON calendar_weeks(year, month_name);
    `);

    // Migracja kolumn finansowych dla aop_plans
    try { this.db.run('ALTER TABLE aop_plans ADD COLUMN plan_sales REAL'); } catch (_) {}
    try { this.db.run('ALTER TABLE aop_plans ADD COLUMN actual_sales REAL'); } catch (_) {}
    try { this.db.run('ALTER TABLE aop_plans ADD COLUMN actual_trx INTEGER'); } catch (_) {}
    try { this.db.run('ALTER TABLE aop_plans ADD COLUMN actual_tplh REAL'); } catch (_) {}
    try { this.db.run('ALTER TABLE weekly_actual_trx ADD COLUMN scheduled_hours REAL'); } catch (_) {}

    // Inicjalizacja domyślnych reguł Floor Hours
    this.db.run(`
      INSERT OR IGNORE INTO floor_rules (day_id, day_name, shifts_count, hours_per_shift, total_day_hours) VALUES
      ('monday', 'Poniedziałek', 5, 8.0, 40.0),
      ('tuesday', 'Wtorek', 5, 8.0, 40.0),
      ('wednesday', 'Środa', 5, 8.0, 40.0),
      ('thursday', 'Czwartek', 5, 8.0, 40.0),
      ('friday', 'Piątek', 5, 8.0, 40.0),
      ('saturday', 'Sobota', 5, 8.0, 40.0),
      ('sunday', 'Niedziela', 4, 8.0, 32.0);
    `);

    // Inicjalizacja domyślnych reguł godzin NC (Non-Coverage)
    this.db.run(`
      INSERT OR IGNORE INTO nc_rules (id, name, category, monthly_hours, is_mandatory) VALUES
      ('sm_admin', 'Administracja Store Managera (SM)', 'Zarządzanie', 20.0, 1),
      ('barista_training', 'Szkolenia Baristyczne & Onboarding', 'Rozwój', 12.0, 1),
      ('inventory', 'Inwentaryzacja Miesięczna & Audyt', 'Operacje', 6.0, 1),
      ('team_meeting', 'Zebranie Załogi Kawiarni', 'Zespół', 4.0, 1),
      ('deep_clean', 'Głębokie Czyszczenie Sprzętu (Deep Clean)', 'Czystość', 8.0, 1);
    `);

    // Domyślny lokal: SBX Warszawa Janki
    this.db.run(`
      INSERT OR IGNORE INTO stores (store_code, store_name, weekly_floor_hours)
      VALUES ('384', '108120 SBX Warszawa Janki', 272.0);
    `);
  }

  private seedInitialData(): void {
    if (!this.db) return;

    const baseSeedPath = path.join(process.cwd(), 'desktop_app_blueprint', 'data_schemas_and_seeds');
    if (!fs.existsSync(baseSeedPath)) {
      console.warn('⚠️ Brak katalogu seedów:', baseSeedPath);
      return;
    }

    // 1. Seed AOP Plan
    const aopPath = path.join(baseSeedPath, 'aop_plan_master_seed.json');
    if (fs.existsSync(aopPath)) {
      const aopData = JSON.parse(fs.readFileSync(aopPath, 'utf8'));
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO aop_plans 
        (key, year, month, month_code, weeks_count, plan_trx, target_tplh, labor_budget, avg_weekly_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of aopData) {
        const targetTplh = Number(item.target_tplh) || 6.7;
        const planTrx = Number(item.plan_trx) || 0;
        const laborBudget = Number((planTrx / targetTplh).toFixed(1));
        const weeksCount = Number(item.weeks_count) || 5;
        const avgWeekly = Number((laborBudget / weeksCount).toFixed(1));

        stmt.run([
          item.key,
          Number(item.year),
          item.month,
          item.month_code,
          weeksCount,
          planTrx,
          targetTplh,
          laborBudget,
          avgWeekly
        ]);
      }
      stmt.free();
      console.log(`✅ Zaseedowano ${aopData.length} miesięcy AOP (2021-2036).`);
    }

    // 2. Seed Calendar Weeks
    const weeksPath = path.join(baseSeedPath, 'weeks_engine_seed.json');
    if (fs.existsSync(weeksPath)) {
      const weeksRaw = JSON.parse(fs.readFileSync(weeksPath, 'utf8'));
      // Pomijamy element 0 jeśli jest nagłówkiem
      const weeksData = (weeksRaw.length > 0 && weeksRaw[0].week_key === 'Klucz (Y_M_W)')
        ? weeksRaw.slice(1)
        : weeksRaw;

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO calendar_weeks
        (week_key, year, month_name, week_num_in_month, days_count, week_type, date_from, date_to, floor_hours, day_weight)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const w of weeksData) {
        stmt.run([
          w.week_key,
          Number(w.year),
          w.month_num, // w seedzie month_num to nazwa miesiąca (np. 'Wrzesień')
          w.month_name, // w seedzie month_name to 'W1', 'W2' itp.
          Number(w.days_count),
          w.week_type,
          w.date_from,
          w.date_to,
          Number(w.floor_hours),
          Number(w.day_weight)
        ]);
      }
      stmt.free();
      console.log(`✅ Zaseedowano ${weeksData.length} tygodni biznesowych (2021-2036).`);
    }

    // 3. Seed Labor Actuals 2026
    const actualsPath = path.join(baseSeedPath, 'labor_actuals_2026_seed.json');
    if (fs.existsSync(actualsPath)) {
      const actualsData = JSON.parse(fs.readFileSync(actualsPath, 'utf8'));
      const stmt = this.db.prepare(`
        INSERT INTO labor_actuals_log
        (date, year, month, week, week_key, day_of_week, employee, category, contract_type, computable_time, unit_code, unit_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const a of actualsData) {
        stmt.run([
          a.date,
          Number(a.year),
          a.month,
          a.week,
          a.week_key,
          a.day_of_week || '',
          a.employee,
          a.category || '',
          a.contract_type || '',
          Number(a.computable_time) || 0,
          String(a.unit_code || '384'),
          a.unit_name || '108120 SBX Warszawa Janki'
        ]);
      }
      stmt.free();
      console.log(`✅ Zaseedowano ${actualsData.length} rekordów rzeczywistych godzin (2026).`);
    }

    // Domyślny wpis TRX dla 2026_Wrzesień_W1 (z makiety: 2050 TRX)
    this.db.run(`
      INSERT OR REPLACE INTO weekly_actual_trx (week_key, actual_trx)
      VALUES ('2026_Wrzesień_W1', 2050);
    `);
  }
}
