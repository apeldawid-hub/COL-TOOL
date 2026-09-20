import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';

function getEasterDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function calculateOfficialMonthNorm(year: number, month: number): { workingDays: number; offDays: number; fullTimeHours: number } {
  const daysInMonth = new Date(year, month, 0).getDate();
  const holidays = new Set<string>();

  // Stałe święta w Polsce
  holidays.add(`${year}-01-01`);
  holidays.add(`${year}-01-06`);
  holidays.add(`${year}-05-01`);
  holidays.add(`${year}-05-03`);
  holidays.add(`${year}-08-15`);
  holidays.add(`${year}-11-01`);
  holidays.add(`${year}-11-11`);
  holidays.add(`${year}-12-25`);
  holidays.add(`${year}-12-26`);

  // Ruchome święta
  const easter = getEasterDate(year);
  const easterDate = new Date(year, easter.month - 1, easter.day);
  const easterMonday = new Date(easterDate);
  easterMonday.setDate(easterDate.getDate() + 1);
  holidays.add(`${year}-${String(easterMonday.getMonth() + 1).padStart(2, '0')}-${String(easterMonday.getDate()).padStart(2, '0')}`);

  const corpusChristi = new Date(easterDate);
  corpusChristi.setDate(easterDate.getDate() + 60);
  holidays.add(`${year}-${String(corpusChristi.getMonth() + 1).padStart(2, '0')}-${String(corpusChristi.getDate()).padStart(2, '0')}`);

  let workingDaysCount = 0;
  let saturdayHolidays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay(); // 0 = Nd, 6 = So
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isHoliday = holidays.has(dateStr);

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (!isHoliday) workingDaysCount++;
    } else if (dayOfWeek === 6 && isHoliday) {
      // Święto w sobotę obniża wymiar o 8h (art. 130 § 2 KP)
      saturdayHolidays++;
    }
  }

  const effectiveWorkingDays = Math.max(0, workingDaysCount - saturdayHolidays);
  const fullTimeHours = effectiveWorkingDays * 8.0;
  const offDays = daysInMonth - effectiveWorkingDays;

  return { workingDays: effectiveWorkingDays, offDays, fullTimeHours };
}

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

  public getDbFilePath(): string {
    return this.dbFilePath;
  }

  public persist(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbFilePath, buffer);
  }

  /**
   * Zwraca skład managerski dla danego roku i miesiąca.
   * Jeśli miesiąc nie posiada jeszcze własnego składu, automatycznie klonuje strukturę z poprzedniego miesiąca.
   */
  public getMonthlyRoster(year: number, month: number): any[] {
    if (!this.db) throw new Error('Baza nie została zainicjalizowana. Wywołaj najpierw init().');

    // 1. Sprawdź czy istnieją rekordy w manager_monthly_roster dla (year, month)
    const stmt = this.db.prepare(`
      SELECT employee_id as id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active
      FROM manager_monthly_roster
      WHERE year = ? AND month = ? AND is_active = 1
      ORDER BY sort_order ASC
    `);
    stmt.bind([year, month]);
    const roster: any[] = [];
    while (stmt.step()) {
      roster.push(stmt.getAsObject());
    }
    stmt.free();

    if (roster.length > 0) {
      return roster;
    }

    // 2. Jeśli brak składu dla (year, month), automatycznie importuj/odziedzicz z poprzedniego miesiąca!
    const prevRes = this.db.exec(`
      SELECT year, month 
      FROM manager_monthly_roster 
      WHERE (year < ${year}) OR (year = ${year} AND month < ${month})
      ORDER BY year DESC, month DESC 
      LIMIT 1
    `);

    let sourceRecords: any[] = [];

    if (prevRes.length > 0 && prevRes[0].values.length > 0) {
      const foundYear = Number(prevRes[0].values[0][0]);
      const foundMonth = Number(prevRes[0].values[0][1]);
      const srcStmt = this.db.prepare(`
        SELECT employee_id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active
        FROM manager_monthly_roster
        WHERE year = ? AND month = ? AND is_active = 1
        ORDER BY sort_order ASC
      `);
      srcStmt.bind([foundYear, foundMonth]);
      while (srcStmt.step()) {
        sourceRecords.push(srcStmt.getAsObject());
      }
      srcStmt.free();
    }

    // Jeśli brak wcześniejszego miesiąca, weź z bazowego rejestru manager_employees
    if (sourceRecords.length === 0) {
      const baseStmt = this.db.prepare(`
        SELECT id as employee_id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active
        FROM manager_employees
        WHERE is_active = 1
        ORDER BY sort_order ASC
      `);
      while (baseStmt.step()) {
        sourceRecords.push(baseStmt.getAsObject());
      }
      baseStmt.free();
    }

    // Zapisz odziedziczony skład do bazy dla tego miesiąca
    if (sourceRecords.length > 0) {
      const insertStmt = this.db.prepare(`
        INSERT OR REPLACE INTO manager_monthly_roster 
        (year, month, employee_id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      for (const r of sourceRecords) {
        insertStmt.run([
          year,
          month,
          r.employee_id,
          r.name,
          r.role,
          r.contract_type,
          r.contract_hours_ratio,
          r.hourly_rate || 0.0,
          r.sort_order || 1
        ]);
      }
      insertStmt.free();
      this.persist();

      console.log(`✨ Automatycznie zaimportowano skład managerski z poprzedniego okresu dla ${month}/${year} (${sourceRecords.length} osób).`);
    }

    return sourceRecords.map(r => ({
      id: r.employee_id,
      name: r.name,
      role: r.role,
      contract_type: r.contract_type,
      contract_hours_ratio: r.contract_hours_ratio,
      hourly_rate: r.hourly_rate,
      sort_order: r.sort_order,
      is_active: r.is_active
    }));
  }

  /**
   * Zapisuje skład managerski dla wybranego miesiąca z opcjonalną propagacją do miesięcy przyszłych.
   */
  public saveMonthlyRoster(year: number, month: number, employees: any[], propagateToFuture: boolean = false): void {
    if (!this.db) throw new Error('Baza nie została zainicjalizowana. Wywołaj najpierw init().');

    // 1. Upewnij się, że każdy pracownik ma swoje employee_id w manager_employees (master registry)
    for (const emp of employees) {
      if (!emp.id || emp.id === 0) {
        this.db.run(`
          INSERT INTO manager_employees (name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `, [
          emp.name,
          emp.role,
          emp.contract_type,
          Number(emp.contract_hours_ratio) || 1.0,
          Number(emp.hourly_rate) || 0.0,
          Number(emp.sort_order) || 1
        ]);
        const lastIdRes = this.db.exec("SELECT last_insert_rowid()");
        emp.id = Number(lastIdRes[0].values[0][0]);
      } else {
        // Zaktualizuj dane bazowe pracownika w master registry
        this.db.run(`
          UPDATE manager_employees 
          SET name = ?, role = ?, contract_type = ?, contract_hours_ratio = ?, hourly_rate = ?
          WHERE id = ?
        `, [
          emp.name,
          emp.role,
          emp.contract_type,
          Number(emp.contract_hours_ratio) || 1.0,
          Number(emp.hourly_rate) || 0.0,
          emp.id
        ]);
      }
    }

    // 2. Usunięcie dotychczasowego składu dla danego (year, month)
    this.db.run(`DELETE FROM manager_monthly_roster WHERE year = ? AND month = ?`, [year, month]);

    // 3. Wstawienie nowego składu
    const insertStmt = this.db.prepare(`
      INSERT INTO manager_monthly_roster 
      (year, month, employee_id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let idx = 0; idx < employees.length; idx++) {
      const emp = employees[idx];
      insertStmt.run([
        year,
        month,
        emp.id,
        emp.name,
        emp.role,
        emp.contract_type,
        Number(emp.contract_hours_ratio) || 1.0,
        Number(emp.hourly_rate) || 0.0,
        emp.sort_order || (idx + 1),
        emp.is_active !== undefined ? (emp.is_active ? 1 : 0) : 1
      ]);
    }
    insertStmt.free();

    // 4. Jeśli włączono propagację do przyszłych miesięcy:
    if (propagateToFuture) {
      const futureMonthsRes = this.db.exec(`
        SELECT DISTINCT year, month 
        FROM manager_monthly_roster 
        WHERE (year > ${year}) OR (year = ${year} AND month > ${month})
      `);

      if (futureMonthsRes.length > 0 && futureMonthsRes[0].values) {
        for (const row of futureMonthsRes[0].values) {
          const fYear = Number(row[0]);
          const fMonth = Number(row[1]);
          this.saveMonthlyRoster(fYear, fMonth, employees, false);
        }
      }
    }

    this.persist();
  }

  /**
   * Kopiuje i nadpisuje skład wskazanego miesiąca strukturą z miesiąca poprzedniego
   */
  public copyRosterFromPreviousMonth(year: number, month: number): any[] {
    if (!this.db) throw new Error('Baza nie została zainicjalizowana. Wywołaj najpierw init().');
    this.db.run(`DELETE FROM manager_monthly_roster WHERE year = ? AND month = ?`, [year, month]);
    this.persist();
    return this.getMonthlyRoster(year, month);
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

      -- Moduł 2: Managers Schedule
      CREATE TABLE IF NOT EXISTS manager_employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        contract_type TEXT NOT NULL,
        contract_hours_ratio REAL NOT NULL,
        hourly_rate REAL DEFAULT 0.0,
        sort_order INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS shift_definitions (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        hours REAL NOT NULL,
        is_nc INTEGER NOT NULL DEFAULT 0,
        is_absence INTEGER NOT NULL DEFAULT 0,
        color_bg TEXT,
        color_text TEXT,
        category TEXT DEFAULT 'coverage',
        is_sunday_only INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS manager_schedule_shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        day INTEGER NOT NULL,
        date TEXT NOT NULL,
        employee_id INTEGER NOT NULL,
        shift_code TEXT NOT NULL,
        hours REAL NOT NULL,
        notes TEXT,
        disposition TEXT DEFAULT 'OFF',
        custom_start_time TEXT,
        custom_end_time TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, month, day, employee_id)
      );

      CREATE TABLE IF NOT EXISTS manager_schedule_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        day INTEGER NOT NULL,
        date TEXT NOT NULL,
        event_text TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, month, day)
      );

      CREATE TABLE IF NOT EXISTS manager_schedule_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        version_num INTEGER NOT NULL,
        version_type TEXT NOT NULL, -- 'draft' | 'published' | 'post_publication_edit'
        title TEXT NOT NULL,
        description TEXT,
        shifts_json TEXT NOT NULL,
        events_json TEXT,
        is_published INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS manager_monthly_norms (
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        working_days INTEGER NOT NULL,
        off_days INTEGER NOT NULL,
        full_time_hours REAL NOT NULL,
        is_custom INTEGER DEFAULT 0,
        notes TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(year, month)
      );

      CREATE TABLE IF NOT EXISTS manager_monthly_roster (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        contract_type TEXT NOT NULL,
        contract_hours_ratio REAL NOT NULL,
        hourly_rate REAL DEFAULT 0.0,
        sort_order INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, month, employee_id)
      );

      CREATE INDEX IF NOT EXISTS idx_labor_week_key ON labor_actuals_log(week_key);
      CREATE INDEX IF NOT EXISTS idx_labor_date ON labor_actuals_log(date);
      CREATE INDEX IF NOT EXISTS idx_labor_year_month ON labor_actuals_log(year, month);
      CREATE INDEX IF NOT EXISTS idx_calendar_year_month ON calendar_weeks(year, month_name);
      CREATE INDEX IF NOT EXISTS idx_mgr_shifts_ym ON manager_schedule_shifts(year, month);
      CREATE INDEX IF NOT EXISTS idx_mgr_shifts_emp ON manager_schedule_shifts(employee_id);
      CREATE INDEX IF NOT EXISTS idx_mgr_events_ym ON manager_schedule_events(year, month);
      CREATE INDEX IF NOT EXISTS idx_mgr_versions_ym ON manager_schedule_versions(year, month);
      CREATE INDEX IF NOT EXISTS idx_mgr_roster_ym ON manager_monthly_roster(year, month);
      CREATE INDEX IF NOT EXISTS idx_mgr_roster_emp ON manager_monthly_roster(employee_id);

      -- Moduł 3: Szkolenia (Starbucks Training Suite)
      CREATE TABLE IF NOT EXISTS training_partners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        hire_date TEXT NOT NULL,
        current_program TEXT NOT NULL DEFAULT 'first_30',
        assigned_trainer_id INTEGER,
        assigned_trainer_name TEXT,
        store_manager_name TEXT DEFAULT 'Dawid Apel',
        sanepid_valid_until TEXT,
        bhp_completed_date TEXT,
        status TEXT NOT NULL DEFAULT 'in_progress',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS training_shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        partner_id INTEGER NOT NULL,
        shift_code TEXT NOT NULL,
        title TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        start_time TEXT NOT NULL DEFAULT '08:00',
        end_time TEXT NOT NULL DEFAULT '12:00',
        barista_hours_t REAL NOT NULL DEFAULT 4.0,
        trainer_hours_t REAL NOT NULL DEFAULT 0.0,
        sm_hours_t REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'planned',
        trainer_name TEXT,
        station TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS training_skill_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        partner_id INTEGER NOT NULL,
        check_type TEXT NOT NULL,
        exam_date TEXT NOT NULL,
        examiner_name TEXT NOT NULL,
        examiner_role TEXT NOT NULL DEFAULT 'SM',
        is_passed INTEGER NOT NULL DEFAULT 1,
        score_pct REAL DEFAULT 100.0,
        criteria_results TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_train_shifts_partner ON training_shifts(partner_id);
      CREATE INDEX IF NOT EXISTS idx_train_shifts_date ON training_shifts(scheduled_date);
      CREATE INDEX IF NOT EXISTS idx_train_checks_partner ON training_skill_checks(partner_id);
    `);

    // Migracja kolumn finansowych dla aop_plans
    try { this.db.run('ALTER TABLE aop_plans ADD COLUMN plan_sales REAL'); } catch (_) {}
    try { this.db.run('ALTER TABLE aop_plans ADD COLUMN actual_sales REAL'); } catch (_) {}
    try { this.db.run('ALTER TABLE aop_plans ADD COLUMN actual_trx INTEGER'); } catch (_) {}
    try { this.db.run('ALTER TABLE aop_plans ADD COLUMN actual_tplh REAL'); } catch (_) {}
    try { this.db.run('ALTER TABLE weekly_actual_trx ADD COLUMN scheduled_hours REAL'); } catch (_) {}
    try { this.db.run('ALTER TABLE manager_employees ADD COLUMN hourly_rate REAL DEFAULT 0.0'); } catch (_) {}
    try {
      this.db.run(`
        UPDATE manager_employees SET hourly_rate = 42.0 WHERE (hourly_rate IS NULL OR hourly_rate = 0) AND role LIKE '%STORE MANAGER%' AND role NOT LIKE '%ASSISTANT%';
        UPDATE manager_employees SET hourly_rate = 36.0 WHERE (hourly_rate IS NULL OR hourly_rate = 0) AND role LIKE '%ASSISTANT%';
        UPDATE manager_employees SET hourly_rate = 32.5 WHERE (hourly_rate IS NULL OR hourly_rate = 0) AND (role LIKE '%SSV%' OR role LIKE '%SUPERVISOR%');
      `);
    } catch (_) {}
    try { this.db.run('ALTER TABLE shift_definitions ADD COLUMN is_sunday_only INTEGER DEFAULT 0'); } catch (_) {}
    try {
      this.db.run(`
        UPDATE shift_definitions SET is_sunday_only = 1 WHERE name LIKE '%Niedziela%' OR code IN ('AMN', 'PMN');
      `);
    } catch (_) {}
    try { this.db.run("ALTER TABLE manager_schedule_shifts ADD COLUMN disposition TEXT DEFAULT 'OFF'"); } catch (_) {}
    try { this.db.run("ALTER TABLE manager_schedule_shifts ADD COLUMN custom_start_time TEXT"); } catch (_) {}
    try { this.db.run("ALTER TABLE manager_schedule_shifts ADD COLUMN custom_end_time TEXT"); } catch (_) {}
    try {
      this.db.run(`
        UPDATE shift_definitions SET name = 'Support AM (inna kawiarnia)' WHERE code = 'SAM';
        UPDATE shift_definitions SET name = 'Support PM (inna kawiarnia)' WHERE code = 'SPM';
        UPDATE shift_definitions SET name = 'Support do oddania (inna kawiarnia)' WHERE code = 'SUP';
      `);
    } catch (_) {}

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

    // Inicjalizacja danych Modułu 2: Managers Schedule
    this.seedManagerModuleData();
  }

  private seedManagerModuleData(): void {
    if (!this.db) return;

    // 1. Domyślny katalog zmian Starbucks
    const shiftsCountRes = this.db.exec('SELECT COUNT(*) as count FROM shift_definitions');
    const shiftsCount = shiftsCountRes[0]?.values[0]?.[0] as number || 0;
    if (shiftsCount === 0) {
      const defaultShifts = [
        ['AM', 'Opening', '07:00', '15:00', 8.0, 0, 0, 'bg-emerald-100 text-emerald-800 border-emerald-300', 'coverage'],
        ['PM', 'Closing', '14:30', '22:30', 8.0, 0, 0, 'bg-amber-100 text-amber-900 border-amber-300', 'coverage'],
        ['AMN', 'AM Niedziela', '08:00', '14:00', 6.0, 0, 0, 'bg-teal-100 text-teal-800 border-teal-300', 'coverage'],
        ['PMN', 'PM Niedziela', '14:00', '21:00', 7.0, 0, 0, 'bg-orange-100 text-orange-900 border-orange-300', 'coverage'],
        ['SAM', 'Support AM', '07:00', '15:00', 8.0, 0, 0, 'bg-green-100 text-green-800 border-green-300', 'coverage'],
        ['SPM', 'Support PM', '14:30', '22:30', 8.0, 0, 0, 'bg-yellow-100 text-yellow-800 border-yellow-300', 'coverage'],
        ['SUP', 'Support do oddania', '10:00', '18:00', 8.0, 0, 0, 'bg-lime-100 text-lime-800 border-lime-300', 'coverage'],
        ['MIB', 'MID Bar', '12:00', '20:00', 8.0, 0, 0, 'bg-cyan-100 text-cyan-800 border-cyan-300', 'coverage'],
        ['AMB', 'AM Bar', '07:00', '15:00', 8.0, 0, 0, 'bg-emerald-50 text-emerald-700 border-emerald-200', 'coverage'],
        ['PMB', 'PM Bar', '14:30', '22:30', 8.0, 0, 0, 'bg-amber-50 text-amber-800 border-amber-200', 'coverage'],
        ['MI4', 'MiD 4h', '10:00', '14:00', 4.0, 0, 0, 'bg-teal-50 text-teal-700 border-teal-200', 'coverage'],
        ['BT', 'Business Trip', '10:00', '18:00', 8.0, 1, 0, 'bg-indigo-100 text-indigo-800 border-indigo-300', 'nc'],
        ['NC', 'NC (Administracja)', '07:00', '15:00', 8.0, 1, 0, 'bg-purple-100 text-purple-800 border-purple-300', 'nc'],
        ['TAM', 'Szkolenie AM', '07:00', '15:00', 8.0, 1, 0, 'bg-violet-100 text-violet-800 border-violet-300', 'nc'],
        ['TPM', 'Szkolenie PM', '14:30', '22:30', 8.0, 1, 0, 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300', 'nc'],
        ['RET', 'Odbiór nadgodziny', '08:00', '16:00', 8.0, 1, 0, 'bg-blue-100 text-blue-800 border-blue-300', 'nc'],
        ['T', 'Training', '08:00', '16:00', 8.0, 1, 0, 'bg-sky-100 text-sky-800 border-sky-300', 'nc'],
        ['PRE', 'Preventive', '10:00', '18:00', 8.0, 1, 0, 'bg-rose-100 text-rose-800 border-rose-300', 'nc'],
        ['MEE', 'Partners Meeting', '19:00', '22:00', 3.0, 1, 0, 'bg-pink-100 text-pink-800 border-pink-300', 'nc'],
        ['OFF', 'Dzień Wolny (Off)', '00:00', '00:00', 0.0, 0, 1, 'bg-stone-100 text-stone-600 border-stone-300', 'absence'],
        ['H', 'Urlop (Holiday)', '08:00', '16:00', 8.0, 0, 1, 'bg-sky-200 text-sky-900 border-sky-400 font-semibold', 'absence'],
        ['L4', 'Chorobowe (L4)', '00:00', '00:00', 8.0, 0, 1, 'bg-red-100 text-red-800 border-red-300 font-semibold', 'absence'],
        ['M', 'Dyspo Rano', '07:00', '15:00', 0.0, 0, 0, 'bg-slate-100 text-slate-700 border-slate-300', 'dispo'],
        ['Z', 'Dyspo Wieczór', '14:30', '22:30', 0.0, 0, 0, 'bg-slate-100 text-slate-700 border-slate-300', 'dispo'],
        ['FULL', 'Dyspo Pełne', '07:00', '22:30', 0.0, 0, 0, 'bg-slate-100 text-slate-700 border-slate-300', 'dispo']
      ];

      const stmt = this.db.prepare(`
        INSERT INTO shift_definitions (code, name, start_time, end_time, hours, is_nc, is_absence, color_bg, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of defaultShifts) {
        stmt.run(s);
      }
      stmt.free();
      console.log('✅ Zaseedowano katalog 25 kodów zmian Starbucks.');
    } else {
      // Migracja: Upewnienie się, że zmiana L4 wlicza się do etatu (8.0h zamiast 0.0h)
      this.db.run("UPDATE shift_definitions SET hours = 8.0 WHERE code = 'L4' AND hours = 0.0");
      this.db.run("UPDATE manager_schedule_shifts SET hours = 8.0 WHERE shift_code = 'L4' AND hours = 0.0");
    }

    // 2. Domyślny zespół menedżerów (108120 Warszawa Janki)
    const empCountRes = this.db.exec('SELECT COUNT(*) as count FROM manager_employees');
    const empCount = empCountRes[0]?.values[0]?.[0] as number || 0;
    if (empCount === 0) {
      const defaultTeam = [
        ['Dawid Szeluga', 'CUSTOMER AND SALES MANAGER', 'FULL', 1.0, 42.0, 1],
        ['Dawid Apel', 'ASSISTANT STORE MANAGER', 'FULL', 1.0, 36.0, 2],
        ['Kamil Kamiński', 'SSV', 'FULL', 1.0, 32.5, 3],
        ['Zuzanna Makowska', 'SSV', '0.75', 0.75, 32.5, 4],
        ['Weronika Bieńkowska', 'SSV', '0.5', 0.5, 32.5, 5],
        ['Gabi Znojek', 'SSV', 'FULL', 1.0, 32.5, 6],
        ['Aleksandra Płużyńska', 'SSV', 'FULL', 1.0, 32.5, 7]
      ];

      const stmt = this.db.prepare(`
        INSERT INTO manager_employees (name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `);
      for (const m of defaultTeam) {
        stmt.run(m);
      }
      stmt.free();
      console.log('✅ Zaseedowano zespół menedżerski kawiarni 108120 Janki (7 osób).');
    }

    // 3. Domyślny grafik na Wrzesień 2026 (z pliku referencyjnego)
    const shifts2026CountRes = this.db.exec("SELECT COUNT(*) as count FROM manager_schedule_shifts WHERE year=2026 AND month=9");
    const shifts2026Count = shifts2026CountRes[0]?.values[0]?.[0] as number || 0;
    if (shifts2026Count === 0) {
      // Pobieramy ID menedżerów
      const empsRes = this.db.exec("SELECT id, name FROM manager_employees ORDER BY sort_order ASC");
      const empMap: Record<string, number> = {};
      if (empsRes[0]) {
        for (const row of empsRes[0].values) {
          empMap[String(row[1])] = Number(row[0]);
        }
      }

      // Mapa godzin dla kodów zmian
      const hoursMap: Record<string, number> = {
        'AM': 8.0, 'PM': 8.0, 'AMN': 6.0, 'PMN': 7.0, 'SAM': 8.0, 'SPM': 8.0, 'SUP': 8.0,
        'MIB': 8.0, 'AMB': 8.0, 'PMB': 8.0, 'MI4': 4.0, 'BT': 8.0, 'NC': 8.0, 'TAM': 8.0,
        'TPM': 8.0, 'RET': 8.0, 'T': 8.0, 'PRE': 8.0, 'MEE': 3.0, 'OFF': 0.0, 'H': 8.0, 'L4': 8.0
      };

      const refShifts: Record<string, string[]> = {
        'Dawid Szeluga': ['H','H','H','H','OFF','OFF','H','NC','NC','RET','OFF','PM','OFF','NC','NC','NC','NC','NC','OFF','OFF','NC','NC','NC','OFF','AM','NC','OFF','NC','NC','OFF'],
        'Dawid Apel': ['AM','SAM','OFF','PM','PM','OFF','MIB','PM','SPM','OFF','AM','AM','AM','NC','SUP','OFF','AM','OFF','AM','AM','NC','OFF','PM','NC','SPM','PM','PM','NC','OFF','OFF'],
        'Kamil Kamiński': ['NC','SAM','AM','SAM','OFF','AM','AM','AM','AM','AM','OFF','OFF','PM','OFF','NC','AM','SPM','PM','OFF','OFF','H','H','H','H','H','OFF','OFF','OFF','PM','PM'],
        'Zuzanna Makowska': ['OFF','PM','OFF','AM','AM','PM','PM','OFF','PM','OFF','PM','OFF','OFF','AM','AM','SPM','OFF','AM','OFF','OFF','OFF','H','H','H','H','OFF','OFF','AM','AM','NC'],
        'Weronika Bieńkowska': ['PM','OFF','PM','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','OFF','SAM','PM','PM','SPM','OFF','OFF','AM','AM','AM','PM','PM','OFF','OFF','SUP','SUP','OFF'],
        'Gabi Znojek': ['MIB','AM','OFF','OFF','MIB','OFF','OFF','SPM','SPM','PM','OFF','OFF','OFF','PM','PM','SUP','RET','OFF','PM','PM','PM','PM','OFF','AM','SAM','AM','AM','PM','OFF','AM'],
        'Aleksandra Płużyńska': ['L4','L4','L4','L4','OFF','OFF','L4','L4','L4','L4','L4','OFF','OFF','L4','L4','L4','L4','L4','OFF','OFF','L4','L4','L4','L4','L4','OFF','OFF','L4','L4','L4']
      };

      const stmtShift = this.db.prepare(`
        INSERT OR REPLACE INTO manager_schedule_shifts (year, month, day, date, employee_id, shift_code, hours)
        VALUES (2026, 9, ?, ?, ?, ?, ?)
      `);

      for (const [empName, shifts] of Object.entries(refShifts)) {
        const empId = empMap[empName];
        if (!empId) continue;
        shifts.forEach((code, idx) => {
          const day = idx + 1;
          const dateStr = `2026-09-${String(day).padStart(2, '0')}`;
          const h = hoursMap[code] ?? 8.0;
          stmtShift.run([day, dateStr, empId, code, h]);
        });
      }
      stmtShift.free();
      console.log('✅ Zaseedowano grafik managerski na Wrzesień 2026 (210 zmian).');

      // 4. Wydarzenia Wrzesień 2026
      const refEvents = [
        { day: 1, text: 'START PUMPKINA | Gabi MID na Sadybie' },
        { day: 2, text: 'Kamil Support Arkadia | Dawid A. support na Nowym Świecie' },
        { day: 4, text: 'Kamil Support SanPark' },
        { day: 8, text: 'Gabi PM Sadyba' },
        { day: 9, text: 'Gabi PM Sadyba | Dawid PM SanPark' },
        { day: 11, text: 'Dawid Preventive | Werka SUP Am Metro Wilanowska' },
        { day: 14, text: 'Dawid Kielce' },
        { day: 15, text: 'Weronika PM Sadyba | Dawid Kielce | Dawid A. NC SM' },
        { day: 16, text: 'Zuza PM Sadyba | Dawid Kielce' },
        { day: 17, text: 'Dawid Kielce | Kamil PM Sadyba' },
        { day: 18, text: 'Dawid Kielce | Werka PM Sadyba' },
        { day: 23, text: 'Dawid S. SCF' },
        { day: 24, text: 'Dawid A. SCF' },
        { day: 25, text: 'Gabi support SanPark' },
        { day: 26, text: 'Gala Hakersi' },
        { day: 27, text: 'Partners Meeting i Mgrs meeting' },
        { day: 29, text: 'PPK Rollout Autumn' }
      ];

      const stmtEvent = this.db.prepare(`
        INSERT OR REPLACE INTO manager_schedule_events (year, month, day, date, event_text)
        VALUES (2026, 9, ?, ?, ?)
      `);
      for (const ev of refEvents) {
        const dateStr = `2026-09-${String(ev.day).padStart(2, '0')}`;
        stmtEvent.run([ev.day, dateStr, ev.text]);
      }
      stmtEvent.free();
      console.log(`✅ Zaseedowano ${refEvents.length} ważnych wydarzeń na Wrzesień 2026.`);
    }

    // Inicjalizacja wersji bazowej dla 2026/09 jeśli brak
    try {
      const vCheck = this.db.exec("SELECT COUNT(*) FROM manager_schedule_versions WHERE year = 2026 AND month = 9");
      const vCount = (vCheck.length > 0 && vCheck[0].values.length > 0) ? Number(vCheck[0].values[0][0]) : 0;
      if (vCount === 0) {
        const sStmt = this.db.prepare("SELECT year, month, day, date, employee_id, shift_code, hours, notes FROM manager_schedule_shifts WHERE year = 2026 AND month = 9");
        const initialShifts: any[] = [];
        while (sStmt.step()) { initialShifts.push(sStmt.getAsObject()); }
        sStmt.free();

        if (initialShifts.length > 0) {
          const vStmt = this.db.prepare(`
            INSERT INTO manager_schedule_versions (year, month, version_num, version_type, title, description, shifts_json, is_published, created_at)
            VALUES (2026, 9, 1, 'published', 'Wersja Oficjalna (Wrzesień 2026)', 'Oficjalny grafik opublikowany 7 dni przed startem miesiąca zgodnie z art. 129 § 3 KP', ?, 1, '2026-08-24 12:00:00')
          `);
          vStmt.run([JSON.stringify(initialShifts)]);
          vStmt.free();
          console.log('✅ Utworzono wersję oficjalną (opublikowaną) dla Września 2026.');
        }
      }
    } catch (e) {
      console.error('Błąd inicjalizacji wersji grafiku:', e);
    }

    // Inicjalizacja oficjalnych norm Kodeksu Pracy dla lat 2016–2036 (-10 i +10 lat)
    this.seedMonthlyNorms();

    // Inicjalizacja dedykowanych składów managerskich per miesiąc
    this.seedMonthlyRosters();

    this.persist();
  }

  /**
   * Generuje i zapisuje normy czasu pracy Kodeksu Pracy na -10 i +10 lat (lata 2016–2036, 252 miesiące)
   */
  private seedMonthlyNorms(): void {
    if (!this.db) return;
    try {
      const res = this.db.exec("SELECT COUNT(*) FROM manager_monthly_norms");
      const count = (res.length > 0 && res[0].values.length > 0) ? Number(res[0].values[0][0]) : 0;
      if (count < 252) {
        const stmt = this.db.prepare(`
          INSERT OR IGNORE INTO manager_monthly_norms 
          (year, month, working_days, off_days, full_time_hours, is_custom, notes)
          VALUES (?, ?, ?, ?, ?, 0, ?)
        `);

        for (let yr = 2016; yr <= 2036; yr++) {
          for (let m = 1; m <= 12; m++) {
            const norm = calculateOfficialMonthNorm(yr, m);
            stmt.run([
              yr,
              m,
              norm.workingDays,
              norm.offDays,
              norm.fullTimeHours,
              'Kodeks Pracy (art. 130 KP)'
            ]);
          }
        }
        stmt.free();
        console.log(`✅ Zaseedowano oficjalne normy Kodeksu Pracy dla lat 2016–2036 (252 miesiące).`);
      }
    } catch (e) {
      console.error('Błąd seedowania manager_monthly_norms:', e);
    }
  }

  /**
   * Inicjalizuje dedykowane składy managerskie dla Lipca, Sierpnia i Września 2026
   */
  private seedMonthlyRosters(): void {
    if (!this.db) return;
    try {
      const res = this.db.exec("SELECT COUNT(*) FROM manager_monthly_roster");
      const count = (res.length > 0 && res[0].values.length > 0) ? Number(res[0].values[0][0]) : 0;
      if (count === 0) {
        // Upewnij się, że Hanna Domachowska istnieje w master registry manager_employees
        this.db.run(`
          INSERT OR IGNORE INTO manager_employees (id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active)
          VALUES (8, 'Hanna Domachowska', 'SSV', '0.5', 0.5, 32.5, 8, 1)
        `);

        // Pobierz id pracowników z manager_employees
        const empsRes = this.db.exec("SELECT id, name FROM manager_employees");
        const empMap: Record<string, number> = {};
        if (empsRes.length > 0) {
          for (const row of empsRes[0].values) {
            empMap[String(row[1])] = Number(row[0]);
          }
        }

        // 1. Lipiec 2026 (M07) - 8 osób (w tym Hanna Domachowska, Dawid Apel jako SSV)
        const julyTeam = [
          ['Dawid Szeluga', 'CUSTOMER AND SALES MANAGER', 'FULL', 1.0, 42.0, 1],
          ['Dawid Apel', 'SSV', 'FULL', 1.0, 32.5, 2],
          ['Kamil Kamiński', 'SSV', 'FULL', 1.0, 32.5, 3],
          ['Zuzanna Makowska', 'SSV', '0.75', 0.75, 32.5, 4],
          ['Weronika Bieńkowska', 'SSV', '0.5', 0.5, 32.5, 5],
          ['Hanna Domachowska', 'SSV', '0.5', 0.5, 32.5, 6],
          ['Aleksandra Płużyńska', 'SSV', 'FULL', 1.0, 32.5, 7],
          ['Gabi Znojek', 'SSV', 'FULL', 1.0, 32.5, 8]
        ];

        // 2. Sierpień 2026 (M08) - 8 osób (w tym Hanna Domachowska, Dawid Apel jako ASM)
        const augustTeam = [
          ['Dawid Szeluga', 'CUSTOMER AND SALES MANAGER', 'FULL', 1.0, 42.0, 1],
          ['Dawid Apel', 'ASSISTANT STORE MANAGER', 'FULL', 1.0, 36.0, 2],
          ['Kamil Kamiński', 'SSV', 'FULL', 1.0, 32.5, 3],
          ['Zuzanna Makowska', 'SSV', '0.75', 0.75, 32.5, 4],
          ['Weronika Bieńkowska', 'SSV', '0.5', 0.5, 32.5, 5],
          ['Hanna Domachowska', 'SSV', '0.5', 0.5, 32.5, 6],
          ['Aleksandra Płużyńska', 'SSV', 'FULL', 1.0, 32.5, 7],
          ['Gabi Znojek', 'SSV', 'FULL', 1.0, 32.5, 8]
        ];

        // 3. Wrzesień 2026 (M09) - 7 osób (BEZ Hanny, Dawid Apel jako ASM)
        const septemberTeam = [
          ['Dawid Szeluga', 'CUSTOMER AND SALES MANAGER', 'FULL', 1.0, 42.0, 1],
          ['Dawid Apel', 'ASSISTANT STORE MANAGER', 'FULL', 1.0, 36.0, 2],
          ['Kamil Kamiński', 'SSV', 'FULL', 1.0, 32.5, 3],
          ['Zuzanna Makowska', 'SSV', '0.75', 0.75, 32.5, 4],
          ['Weronika Bieńkowska', 'SSV', '0.5', 0.5, 32.5, 5],
          ['Gabi Znojek', 'SSV', 'FULL', 1.0, 32.5, 6],
          ['Aleksandra Płużyńska', 'SSV', 'FULL', 1.0, 32.5, 7]
        ];

        const rStmt = this.db.prepare(`
          INSERT OR REPLACE INTO manager_monthly_roster 
          (year, month, employee_id, name, role, contract_type, contract_hours_ratio, hourly_rate, sort_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);

        for (const t of julyTeam) {
          const empId = empMap[t[0] as string] || 0;
          if (empId > 0) rStmt.run([2026, 7, empId, t[0], t[1], t[2], t[3], t[4], t[5]]);
        }
        for (const t of augustTeam) {
          const empId = empMap[t[0] as string] || 0;
          if (empId > 0) rStmt.run([2026, 8, empId, t[0], t[1], t[2], t[3], t[4], t[5]]);
        }
        for (const t of septemberTeam) {
          const empId = empMap[t[0] as string] || 0;
          if (empId > 0) rStmt.run([2026, 9, empId, t[0], t[1], t[2], t[3], t[4], t[5]]);
        }
        rStmt.free();

        // Usunięcie ewentualnej próbnej zmiany Hani z września 2026
        if (empMap['Hanna Domachowska']) {
          this.db.run(`DELETE FROM manager_schedule_shifts WHERE year = 2026 AND month = 9 AND employee_id = ${empMap['Hanna Domachowska']}`);
        }

        console.log('✅ Zaseedowano dedykowane składy managerskie dla Lipca (8 os.), Sierpnia (8 os.) i Września 2026 (7 os.).');
      }
    } catch (e) {
      console.error('Błąd seedowania manager_monthly_roster:', e);
    }
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

  // =========================================================================
  // MODUŁ 3: SZKOLENIA (STARBUCKS TRAINING SUITE)
  // =========================================================================

  public getTrainingPartners(): any[] {
    if (!this.db) return [];
    const res: any[] = [];
    const stmt = this.db.prepare(`
      SELECT * FROM training_partners
      ORDER BY 
        CASE status 
          WHEN 'in_progress' THEN 1 
          WHEN 'paused' THEN 2 
          ELSE 3 
        END,
        hire_date DESC
    `);
    while (stmt.step()) {
      res.push(stmt.getAsObject());
    }
    stmt.free();

    // Auto-seed jeśli tabela jest pusta (2 przykładowych partnerów kawiarni 108120 Janki)
    if (res.length === 0) {
      const seedPartners = [
        {
          name: 'Kacper Wiśniewski',
          hire_date: '2026-09-01',
          current_program: 'first_30',
          assigned_trainer_name: 'Weronika Łukasiak',
          store_manager_name: 'Dawid Apel',
          sanepid_valid_until: '2027-08-31',
          bhp_completed_date: '2026-09-01',
          status: 'in_progress',
          notes: 'Nowy barista na etapie wdrożenia First 30 (AM/PM).'
        },
        {
          name: 'Maja Zielińska',
          hire_date: '2026-06-15',
          current_program: 'barista_90',
          assigned_trainer_name: 'Gabriela Szymańska',
          store_manager_name: 'Dawid Apel',
          sanepid_valid_until: '2027-06-10',
          bhp_completed_date: '2026-06-15',
          status: 'in_progress',
          notes: 'Ukończony First 30 (certyfikowana). Przygotowanie do 90-Dniowego Check-In.'
        }
      ];

      for (const p of seedPartners) {
        this.saveTrainingPartner(p);
      }
      return this.getTrainingPartners();
    }

    return res;
  }

  public saveTrainingPartner(partner: any): number {
    if (!this.db) return 0;
    if (partner.id) {
      const stmt = this.db.prepare(`
        UPDATE training_partners
        SET name = ?, hire_date = ?, current_program = ?, assigned_trainer_id = ?,
            assigned_trainer_name = ?, store_manager_name = ?, sanepid_valid_until = ?,
            bhp_completed_date = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      stmt.run([
        partner.name,
        partner.hire_date,
        partner.current_program || 'first_30',
        partner.assigned_trainer_id || null,
        partner.assigned_trainer_name || null,
        partner.store_manager_name || 'Dawid Apel',
        partner.sanepid_valid_until || null,
        partner.bhp_completed_date || null,
        partner.status || 'in_progress',
        partner.notes || null,
        partner.id
      ]);
      stmt.free();
      this.persist();
      return partner.id;
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO training_partners
        (name, hire_date, current_program, assigned_trainer_id, assigned_trainer_name, store_manager_name, sanepid_valid_until, bhp_completed_date, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        partner.name,
        partner.hire_date,
        partner.current_program || 'first_30',
        partner.assigned_trainer_id || null,
        partner.assigned_trainer_name || null,
        partner.store_manager_name || 'Dawid Apel',
        partner.sanepid_valid_until || null,
        partner.bhp_completed_date || null,
        partner.status || 'in_progress',
        partner.notes || null
      ]);
      stmt.free();
      const lastIdRes = this.db.exec("SELECT last_insert_rowid()");
      const newId = Number(lastIdRes[0]?.values[0]?.[0] || 0);
      this.persist();
      return newId;
    }
  }

  public deleteTrainingPartner(id: number): boolean {
    if (!this.db) return false;
    this.db.run(`DELETE FROM training_shifts WHERE partner_id = ${id}`);
    this.db.run(`DELETE FROM training_skill_checks WHERE partner_id = ${id}`);
    this.db.run(`DELETE FROM training_partners WHERE id = ${id}`);
    this.persist();
    return true;
  }

  public getTrainingShifts(partnerId?: number): any[] {
    if (!this.db) return [];
    const query = partnerId
      ? `SELECT * FROM training_shifts WHERE partner_id = ${partnerId} ORDER BY scheduled_date ASC, shift_code ASC`
      : `SELECT * FROM training_shifts ORDER BY scheduled_date ASC, shift_code ASC`;
    const res: any[] = [];
    const stmt = this.db.prepare(query);
    while (stmt.step()) {
      res.push(stmt.getAsObject());
    }
    stmt.free();
    return res;
  }

  public saveTrainingShiftsBatch(partnerId: number, shifts: any[]): boolean {
    if (!this.db) return false;
    this.db.run(`DELETE FROM training_shifts WHERE partner_id = ${partnerId}`);
    const stmt = this.db.prepare(`
      INSERT INTO training_shifts
      (partner_id, shift_code, title, scheduled_date, start_time, end_time, barista_hours_t, trainer_hours_t, sm_hours_t, status, trainer_name, station, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const s of shifts) {
      stmt.run([
        partnerId,
        s.shift_code,
        s.title,
        s.scheduled_date,
        s.start_time || '08:00',
        s.end_time || '12:00',
        Number(s.barista_hours_t) || 0.0,
        Number(s.trainer_hours_t) || 0.0,
        Number(s.sm_hours_t) || 0.0,
        s.status || 'planned',
        s.trainer_name || null,
        s.station || null,
        s.notes || null
      ]);
    }
    stmt.free();
    this.persist();
    return true;
  }

  public updateTrainingShift(shift: any): boolean {
    if (!this.db || !shift.id) return false;
    const stmt = this.db.prepare(`
      UPDATE training_shifts
      SET scheduled_date = ?, start_time = ?, end_time = ?, barista_hours_t = ?,
          trainer_hours_t = ?, sm_hours_t = ?, status = ?, trainer_name = ?,
          station = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run([
      shift.scheduled_date,
      shift.start_time,
      shift.end_time,
      Number(shift.barista_hours_t) || 0.0,
      Number(shift.trainer_hours_t) || 0.0,
      Number(shift.sm_hours_t) || 0.0,
      shift.status || 'planned',
      shift.trainer_name || null,
      shift.station || null,
      shift.notes || null,
      shift.id
    ]);
    stmt.free();
    this.persist();
    return true;
  }

  public getTrainingSkillChecks(partnerId?: number): any[] {
    if (!this.db) return [];
    const query = partnerId
      ? `SELECT * FROM training_skill_checks WHERE partner_id = ${partnerId} ORDER BY exam_date DESC, id DESC`
      : `SELECT * FROM training_skill_checks ORDER BY exam_date DESC, id DESC`;
    const res: any[] = [];
    const stmt = this.db.prepare(query);
    while (stmt.step()) {
      const obj: any = stmt.getAsObject();
      if (obj.criteria_results && typeof obj.criteria_results === 'string') {
        try {
          obj.criteria_results = JSON.parse(obj.criteria_results);
        } catch (_) {}
      }
      res.push(obj);
    }
    stmt.free();
    return res;
  }

  public saveTrainingSkillCheck(check: any): number {
    if (!this.db) return 0;
    const criteriaJson = typeof check.criteria_results === 'string'
      ? check.criteria_results
      : JSON.stringify(check.criteria_results || {});

    if (check.id) {
      const stmt = this.db.prepare(`
        UPDATE training_skill_checks
        SET check_type = ?, exam_date = ?, examiner_name = ?, examiner_role = ?,
            is_passed = ?, score_pct = ?, criteria_results = ?, notes = ?
        WHERE id = ?
      `);
      stmt.run([
        check.check_type,
        check.exam_date,
        check.examiner_name,
        check.examiner_role || 'SM',
        check.is_passed ? 1 : 0,
        Number(check.score_pct) || 100.0,
        criteriaJson,
        check.notes || null,
        check.id
      ]);
      stmt.free();
      this.persist();
      return check.id;
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO training_skill_checks
        (partner_id, check_type, exam_date, examiner_name, examiner_role, is_passed, score_pct, criteria_results, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        check.partner_id,
        check.check_type,
        check.exam_date,
        check.examiner_name,
        check.examiner_role || 'SM',
        check.is_passed ? 1 : 0,
        Number(check.score_pct) || 100.0,
        criteriaJson,
        check.notes || null
      ]);
      stmt.free();
      const lastIdRes = this.db.exec("SELECT last_insert_rowid()");
      const newId = Number(lastIdRes[0]?.values[0]?.[0] || 0);
      this.persist();
      return newId;
    }
  }
}
