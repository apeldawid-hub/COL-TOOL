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

      CREATE INDEX IF NOT EXISTS idx_labor_week_key ON labor_actuals_log(week_key);
      CREATE INDEX IF NOT EXISTS idx_labor_date ON labor_actuals_log(date);
      CREATE INDEX IF NOT EXISTS idx_labor_year_month ON labor_actuals_log(year, month);
      CREATE INDEX IF NOT EXISTS idx_calendar_year_month ON calendar_weeks(year, month_name);
      CREATE INDEX IF NOT EXISTS idx_mgr_shifts_ym ON manager_schedule_shifts(year, month);
      CREATE INDEX IF NOT EXISTS idx_mgr_shifts_emp ON manager_schedule_shifts(employee_id);
      CREATE INDEX IF NOT EXISTS idx_mgr_events_ym ON manager_schedule_events(year, month);
      CREATE INDEX IF NOT EXISTS idx_mgr_versions_ym ON manager_schedule_versions(year, month);
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
