import * as xlsxModule from 'xlsx';
import fs from 'fs';
import path from 'path';
import { DatabaseManager } from '../database/db';
import { BackupManager } from '../database/backupManager';
import { MapalParser } from './mapalParser';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

export type DetectedReportType = 'AOP_PL' | 'MAPAL_FICHAJES' | 'MANAGER_SCHEDULE' | 'DAILY_KPI_ACTUAL' | 'UNKNOWN';

export interface DailyKpiDayPreview {
  date: string;          // np. '2026-09-01'
  dayOfMonth: number;    // 1
  dayLabel: string;      // 'Tuesday, 1 Sep'
  salesNet: number;      // 13182.27
  trx: number;           // 429
  agc: number;           // 30.73
  deliveryTrx: number;   // 8
  hours: number;         // 56.2
  tplh: number;          // 7.63
  weekNum: string;       // 'W1'
  weekKey: string;       // '2026_Wrzesień_W1'
}

export interface DailyKpiWeekPreview {
  weekKey: string;
  weekNum: string;
  daysCount: number;
  salesNet: number;
  trx: number;
  hours: number;
  deliveryTrx: number;
  agc: number;
  tplh: number;
}

export interface DailyKpiPreviewData {
  year: number;
  month: number;
  monthName: string;
  monthKey: string;      // '2026_Wrzesień'
  storeName: string;
  days: DailyKpiDayPreview[];
  summary: {
    reportedDaysCount: number;
    totalSalesNet: number;
    totalTrx: number;
    totalHours: number;
    totalDeliveryTrx: number;
    avgAgc: number;
    avgTplh: number;
  };
  weeklyBreakdown: DailyKpiWeekPreview[];
}

export interface ManagerScheduleShiftPreview {
  day: number;
  date: string;
  employeeName: string;
  shiftCode: string;
  hours: number;
  customStartTime?: string;
  customEndTime?: string;
}

export interface ManagerScheduleEmployeePreview {
  name: string;
  role: string;
  contractType: string;
  contractHoursRatio: number;
  hourlyRate: number;
  sortOrder: number;
}

export interface SchedulePreviewData {
  year: number;
  month: number;
  monthName: string;
  fileName?: string;
  employees: ManagerScheduleEmployeePreview[];
  shifts: ManagerScheduleShiftPreview[];
  events?: { day: number; eventText: string }[];
  totalShiftsCount: number;
  totalHours: number;
}

export interface AopMonthPreview {
  key: string;
  year: number;
  month: string;
  month_code: string;
  weeks_count: number;
  plan_trx: number;
  target_tplh: number;
  labor_budget: number;
  avg_weekly_hours: number;
  plan_sales: number;
  plan_col_pln: number;
  plan_col_percent: number;
  plan_cos_pln: number;
  plan_cos_percent: number;
  plan_ops_profit: number;
}

export interface MapalRecordPreview {
  id?: string;
  date: string;
  year: number;
  month: string;
  week: string;
  week_key: string;
  day_of_week: string;
  employee: string;
  category: string;
  contract_type: string;
  computable_time: number;
  unit_code: string;
  unit_name: string;
  is_manager?: boolean;
}

export interface ParseReportPreviewResult {
  success: boolean;
  reportType: DetectedReportType;
  reportTypeName: string;
  year?: number;
  // AOP Preview
  aopData?: {
    year: number;
    months: AopMonthPreview[];
    summary: {
      totalSales: number;
      totalTrx: number;
      totalCol: number;
      avgColPct: number;
      totalCos: number;
      totalOpsProfit: number;
      avgTplh: number;
    };
  };
  // MAPAL Preview
  mapalData?: {
    minDate: string;
    maxDate: string;
    totalHours: number;
    recordsCount: number;
    uniqueEmployeesCount: number;
    records: MapalRecordPreview[];
  };
  // Schedule Preview
  scheduleData?: SchedulePreviewData;
  // Daily KPI Preview
  dailyKpiData?: DailyKpiPreviewData;
  validation: {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  };
  message: string;
}

export interface UniversalImportResult {
  success: boolean;
  reportType: DetectedReportType;
  reportTypeName: string;
  importedCount: number;
  replacedCount?: number;
  year?: number;
  minDate?: string;
  maxDate?: string;
  totalSales?: number;
  totalTrx?: number;
  totalCol?: number;
  message: string;
}

export class UniversalReportParser {
  /**
   * Wstępne parsowanie i walidacja raportu z przygotowaniem podglądu do edycji
   */
  public static async parseReportForPreview(
    fileBufferOrPath: Buffer | string
  ): Promise<ParseReportPreviewResult> {
    try {
      let buffer: Buffer;
      if (typeof fileBufferOrPath === 'string') {
        buffer = fs.readFileSync(fileBufferOrPath);
      } else {
        buffer = fileBufferOrPath;
      }

      const workbook = XLSX.read(buffer, { type: 'buffer' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return {
          success: false,
          reportType: 'UNKNOWN',
          reportTypeName: 'Nieznany',
          validation: { isValid: false, warnings: [], errors: ['Brak arkuszy w wybranym pliku Excel.'] },
          message: 'Brak arkuszy w wybranym pliku Excel.'
        };
      }

      const detectedType = this.detectReportType(workbook);

      if (detectedType === 'AOP_PL') {
        return await this.parseAopForPreview(workbook);
      } else if (detectedType === 'MAPAL_FICHAJES') {
        return await this.parseMapalForPreview(workbook, buffer);
      } else if (detectedType === 'MANAGER_SCHEDULE') {
        return await this.parseScheduleForPreview(workbook);
      } else if (detectedType === 'DAILY_KPI_ACTUAL') {
        return await this.parseDailyKpiForPreview(workbook);
      } else {
        return {
          success: false,
          reportType: 'UNKNOWN',
          reportTypeName: 'Nierozpoznany format',
          validation: {
            isValid: false,
            warnings: [],
            errors: ['Nie rozpoznano struktury raportu AOP P&L, MAPAL Fichajes, Raportu Dziennego KPI ani Grafiku Managerskiego.']
          },
          message: 'Nie udało się automatycznie rozpoznać formatu raportu. Upewnij się, że przesyłasz oficjalny raport AOP P&L, raport MAPAL Fichajes, raport dzienny KPI (Actual) lub plik Grafiku Managerskiego (.xlsm).'
        };
      }
    } catch (err: any) {
      console.error('Błąd parseReportForPreview:', err);
      return {
        success: false,
        reportType: 'UNKNOWN',
        reportTypeName: 'Błąd',
        validation: { isValid: false, warnings: [], errors: [err.message || String(err)] },
        message: `Błąd podczas przetwarzania pliku: ${err.message || String(err)}`
      };
    }
  }

  /**
   * Automatyczna detekcja struktury pliku Excel
   */
  private static detectReportType(workbook: any): DetectedReportType {
    // Sprawdzenie nazw arkuszy pod kątem grafiku
    const hasScheduleSheet = workbook.SheetNames.some((s: string) => 
      /Grafik|Schedule|Managers|Menedżer/i.test(s)
    );

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) return 'UNKNOWN';

    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: true
    });

    const flatContent = rawRows
      .slice(0, 35)
      .map(row => (Array.isArray(row) ? row.join(' ') : ''))
      .join('\n');

    // 0. Sprawdzenie formatu Raportu Dziennego KPI (Day & Date, Sales Net, TRX, AGC, Delivery, Hours, TPLH)
    const hasDailyKpiHeaders = /Day & Date/i.test(flatContent) && (/Sales Net|Net Sales/i.test(flatContent) || /AGC/i.test(flatContent) || /Delivery TRX/i.test(flatContent));
    if (hasDailyKpiHeaders) {
      return 'DAILY_KPI_ACTUAL';
    }

    // 1. Sprawdzenie formatu Grafiku Managerskiego
    const hasScheduleHeaders = /GRAFIK MANAGERSKI|MANAGER|Pozycja|Dni OFF|Godziny wypracowane|Bilans \(\+\/\- h\)/i.test(flatContent);
    const hasShiftCodes = /\b(AM|PM|AMN|PMN|SAM|SPM|SUP|MIB|NC)\b/.test(flatContent);
    if (hasScheduleSheet || (hasScheduleHeaders && hasShiftCodes)) {
      return 'MANAGER_SCHEDULE';
    }

    // 2. Sprawdzenie formatu AOP P&L
    const hasPnlHierarchy = /PnL Equity Hierarchy|P&L Level/i.test(flatContent);
    const hasSalesAndTrx = /SALES/i.test(flatContent) && (/TRANSACTIONS/i.test(flatContent) || /Net Sales/i.test(flatContent));
    const hasAppliedFilters = /Applied filters|District is SBX|Restaurant Code/i.test(flatContent);
    const hasColAndCos = /COL/i.test(flatContent) && /COS/i.test(flatContent);

    if ((hasPnlHierarchy && hasSalesAndTrx) || (hasSalesAndTrx && hasAppliedFilters) || (hasSalesAndTrx && hasColAndCos)) {
      return 'AOP_PL';
    }

    // 3. Sprawdzenie formatu MAPAL Fichajes
    const hasFichajesTerms = /Empleado|Employee|Fichaje|Tiempo computable|Computable Time/i.test(flatContent);
    const hasStoreAndTimes = /Hora inicio|Hora fin|Total horas|Business Day|Contract Type/i.test(flatContent);
    const hasMapalHeader = rawRows.some(row => 
      Array.isArray(row) && row.some(cell => typeof cell === 'string' && /Computable Time|Total horas|Business Unit/i.test(cell))
    );

    if (hasFichajesTerms || hasStoreAndTimes || hasMapalHeader || rawRows.length > 50) {
      return 'MAPAL_FICHAJES';
    }

    return 'UNKNOWN';
  }

  /**
   * Parsowanie AOP do widoku edycji i weryfikacji
   */
  private static async parseAopForPreview(workbook: any): Promise<ParseReportPreviewResult> {
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

    let detectedYear = 2026;
    for (const row of rows) {
      if (Array.isArray(row)) {
        for (const cell of row) {
          if (typeof cell === 'string') {
            const matchFilter = cell.match(/(?:Calendar Month \/ Year is|Year is)\s*(?:[A-Za-z]{3}\s*)?(\d{4})/i);
            if (matchFilter && matchFilter[1]) {
              detectedYear = parseInt(matchFilter[1], 10);
            }
          }
        }
      }
    }

    const metricRowMap: Record<string, number> = {};
    rows.forEach((r, idx) => {
      if (Array.isArray(r) && r[0]) {
        const key = String(r[0]).trim();
        metricRowMap[key] = idx;
        if (/^SALES/i.test(key)) metricRowMap['SALES'] = idx;
        if (/^TRANSACTIONS/i.test(key)) metricRowMap['TRANSACTIONS'] = idx;
        if (/^COL$/i.test(key)) metricRowMap['COL'] = idx;
        if (/^COS$/i.test(key)) metricRowMap['COS'] = idx;
        if (/^OPS Profit/i.test(key)) metricRowMap['OPS_PROFIT'] = idx;
        if (/^AGC/i.test(key)) metricRowMap['AGC'] = idx;
      }
    });

    const monthConfigs = [
      { name: 'Styczeń', code: 'M01', col: 1, defaultWeeks: 5 },
      { name: 'Luty', code: 'M02', col: 3, defaultWeeks: 5 },
      { name: 'Marzec', code: 'M03', col: 5, defaultWeeks: 6 },
      { name: 'Kwiecień', code: 'M04', col: 7, defaultWeeks: 5 },
      { name: 'Maj', code: 'M05', col: 9, defaultWeeks: 5 },
      { name: 'Czerwiec', code: 'M06', col: 11, defaultWeeks: 6 },
      { name: 'Lipiec', code: 'M07', col: 13, defaultWeeks: 5 },
      { name: 'Sierpień', code: 'M08', col: 15, defaultWeeks: 5 },
      { name: 'Wrzesień', code: 'M09', col: 17, defaultWeeks: 5 },
      { name: 'Październik', code: 'M10', col: 19, defaultWeeks: 5 },
      { name: 'Listopad', code: 'M11', col: 21, defaultWeeks: 5 },
      { name: 'Grudzień', code: 'M12', col: 23, defaultWeeks: 5 }
    ];

    const headerRow = rows[0] || [];
    monthConfigs.forEach((m, idx) => {
      const foundCol = headerRow.findIndex((cell: any) => {
        if (typeof cell !== 'string') return false;
        const normalized = cell.toLowerCase();
        const shortEn = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][idx];
        return normalized.includes(shortEn) || normalized.includes(m.name.toLowerCase());
      });
      if (foundCol >= 0) {
        m.col = foundCol;
      }
    });

    const dbManager = DatabaseManager.getInstance();
    await dbManager.init();
    const db = dbManager.getDb();

    const existingPlans: Record<string, any> = {};
    try {
      const stmtExisting = db.prepare('SELECT * FROM aop_plans WHERE year = ?');
      stmtExisting.bind([detectedYear]);
      while (stmtExisting.step()) {
        const row = stmtExisting.getAsObject();
        existingPlans[String(row.key)] = row;
      }
      stmtExisting.free();
    } catch (_) {}

    const warnings: string[] = [];
    const errors: string[] = [];
    const months: AopMonthPreview[] = [];

    let totalSales = 0;
    let totalTrx = 0;
    let totalCol = 0;
    let totalCos = 0;
    let totalOpsProfit = 0;

    for (const m of monthConfigs) {
      const key = `${detectedYear}_${m.name}`;
      const existing = existingPlans[key] || {};

      const salesRowIdx = metricRowMap['SALES'];
      const trxRowIdx = metricRowMap['TRANSACTIONS'];
      const colRowIdx = metricRowMap['COL'];
      const cosRowIdx = metricRowMap['COS'];
      const opsProfitRowIdx = metricRowMap['OPS_PROFIT'];

      const sales = salesRowIdx !== undefined && rows[salesRowIdx] ? Number(Number(rows[salesRowIdx][m.col] || 0).toFixed(2)) : (existing.plan_sales || 0);
      const trx = trxRowIdx !== undefined && rows[trxRowIdx] ? Math.round(Number(rows[trxRowIdx][m.col] || 0)) : (existing.plan_trx || 0);
      const colVal = colRowIdx !== undefined && rows[colRowIdx] ? Number(Number(rows[colRowIdx][m.col] || 0).toFixed(2)) : (existing.plan_col_pln || 0);
      const colPct = colRowIdx !== undefined && rows[colRowIdx] ? Number((Number(rows[colRowIdx][m.col + 1] || 0) * 100).toFixed(2)) : (existing.plan_col_percent || 0);
      const cosVal = cosRowIdx !== undefined && rows[cosRowIdx] ? Number(Number(rows[cosRowIdx][m.col] || 0).toFixed(2)) : (existing.plan_cos_pln || 0);
      const cosPct = cosRowIdx !== undefined && rows[cosRowIdx] ? Number((Number(rows[cosRowIdx][m.col + 1] || 0) * 100).toFixed(2)) : (existing.plan_cos_percent || 0);
      const opsProfit = opsProfitRowIdx !== undefined && rows[opsProfitRowIdx] ? Number(Number(rows[opsProfitRowIdx][m.col] || 0).toFixed(2)) : (existing.plan_ops_profit || 0);

      const targetTplh = Number(existing.target_tplh) > 0 ? Number(existing.target_tplh) : 6.7;
      const weeksCount = Number(existing.weeks_count) > 0 ? Number(existing.weeks_count) : m.defaultWeeks;
      const laborBudget = Number((trx / targetTplh).toFixed(1));
      const avgWeekly = Number((laborBudget / weeksCount).toFixed(1));

      // Walidacja poprawności
      if (sales <= 0) {
        warnings.push(`Miesiąc ${m.name}: Sprzedaż wynosi 0 zł.`);
      }
      if (trx <= 0) {
        warnings.push(`Miesiąc ${m.name}: Liczba transakcji wynosi 0.`);
      }
      if (colPct > 40) {
        warnings.push(`Miesiąc ${m.name}: Wskaźnik COL % jest wysoki (${colPct.toFixed(1)}%).`);
      }

      months.push({
        key,
        year: detectedYear,
        month: m.name,
        month_code: m.code,
        weeks_count: weeksCount,
        plan_trx: trx,
        target_tplh: targetTplh,
        labor_budget: laborBudget,
        avg_weekly_hours: avgWeekly,
        plan_sales: sales,
        plan_col_pln: colVal,
        plan_col_percent: colPct,
        plan_cos_pln: cosVal,
        plan_cos_percent: cosPct,
        plan_ops_profit: opsProfit
      });

      totalSales += sales;
      totalTrx += trx;
      totalCol += colVal;
      totalCos += cosVal;
      totalOpsProfit += opsProfit;
    }

    const avgColPct = totalSales > 0 ? Number(((totalCol / totalSales) * 100).toFixed(2)) : 0;
    const avgTplh = months.length > 0 ? Number((months.reduce((acc, m) => acc + m.target_tplh, 0) / months.length).toFixed(2)) : 6.7;

    return {
      success: true,
      reportType: 'AOP_PL',
      reportTypeName: 'Raport AOP P&L (Equity Plan)',
      year: detectedYear,
      aopData: {
        year: detectedYear,
        months,
        summary: {
          totalSales: Number(totalSales.toFixed(2)),
          totalTrx,
          totalCol: Number(totalCol.toFixed(2)),
          avgColPct,
          totalCos: Number(totalCos.toFixed(2)),
          totalOpsProfit: Number(totalOpsProfit.toFixed(2)),
          avgTplh
        }
      },
      validation: {
        isValid: errors.length === 0,
        warnings,
        errors
      },
      message: `Pomyślnie sparsowano dane AOP na rok ${detectedYear} (12 miesięcy). Możesz zweryfikować i zmodyfikować wartości przed zatwierdzeniem.`
    };
  }

  /**
   * Parsowanie MAPAL Fichajes do widoku edycji i weryfikacji
   */
  private static async parseMapalForPreview(
    workbook: any,
    _buffer: Buffer
  ): Promise<ParseReportPreviewResult> {
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: true
    });

    const dbManager = DatabaseManager.getInstance();
    await dbManager.init();
    const db = dbManager.getDb();

    const managerNames: string[] = [];
    try {
      const mgrStmt = db.prepare(`
        SELECT DISTINCT name FROM manager_employees
        UNION
        SELECT DISTINCT name FROM manager_monthly_roster
      `);
      while (mgrStmt.step()) {
        const row = mgrStmt.getAsObject();
        if (row.name) {
          managerNames.push(String(row.name).trim());
        }
      }
      mgrStmt.free();
    } catch (e) {
      console.warn('Nie udało się pobrać listy menedżerów:', e);
    }

    const NICKNAME_MAP: Record<string, string> = {
      gabi: 'gabriela', gabrysia: 'gabriela', zuza: 'zuzanna', zuzia: 'zuzanna',
      werka: 'weronika', wera: 'weronika', hania: 'hanna', ola: 'aleksandra',
      olka: 'aleksandra', kuba: 'jakub', bartek: 'bartosz', bartlomiej: 'bartosz',
      tomek: 'tomasz', krzysiek: 'krzysztof', krzys: 'krzysztof', aga: 'agnieszka',
      magda: 'magdalena', kasia: 'katarzyna', ania: 'anna', gosia: 'malgorzata',
      malgosia: 'malgorzata', piotrek: 'piotr', maciek: 'maciej', patka: 'patrycja',
      natalka: 'natalia', nati: 'natalia'
    };

    const canonicalToken = (token: string): string => NICKNAME_MAP[token] || token;

    const normalizeName = (str: string): string[] => {
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

    const matchesManagerName = (excelEmpName: string, mgrName: string): boolean => {
      const tokensExcel = normalizeName(excelEmpName);
      const tokensMgr = normalizeName(mgrName);
      if (tokensExcel.length === 0 || tokensMgr.length === 0) return false;
      return tokensMgr.every(t => tokensExcel.includes(t));
    };

    const records: MapalRecordPreview[] = [];
    const datesFound: string[] = [];
    const uniqueEmployees = new Set<string>();

    const monthNames = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    const daysMap = ['Nd', 'Pn', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob'];
    const { unitCode: activeUnitCode, mpk: activeMpk, storeName: activeStoreName } = dbManager.getActiveStoreIdentifiers();
    const cleanActiveName = activeStoreName ? activeStoreName.toLowerCase().replace(/^108\d{3}\s*/, '').replace(/^sbx\s*/i, '').trim() : '';

    for (let r = 7; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length < 9) continue;

      const unitName = String(row[14] || '');
      const unitCode = String(row[13] || '');
      const empName = String(row[2] || '').trim();

      const isStoreMatch = Boolean(
        (activeUnitCode && (unitCode === activeUnitCode || unitCode.includes(activeUnitCode) || activeUnitCode.includes(unitCode))) ||
        (activeMpk && (unitName.includes(activeMpk) || unitCode.includes(activeMpk))) ||
        (cleanActiveName && cleanActiveName.length >= 3 && unitName.toLowerCase().includes(cleanActiveName))
      );

      const isManager = managerNames.some(mName => matchesManagerName(empName, mName));

      if (!isStoreMatch && !isManager) continue;

      const dateVal = row[5];
      let dateNormalized = '';
      let year = 2026;
      let monthIdx = 8;
      let dayOfMonth = 1;
      let dayOfWeek = 'Pn';

      if (typeof dateVal === 'number') {
        const parsed = XLSX.SSF.parse_date_code(dateVal);
        if (parsed) {
          year = parsed.y;
          monthIdx = parsed.m - 1;
          dayOfMonth = parsed.d;
          dateNormalized = `${year}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
          const jsDate = new Date(year, monthIdx, dayOfMonth);
          dayOfWeek = daysMap[jsDate.getDay()];
        }
      } else if (typeof dateVal === 'string') {
        const dateStr = dateVal.trim();
        if (dateStr.includes('.')) {
          const parts = dateStr.split('.');
          if (parts.length === 3) {
            dateNormalized = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            const jsDate = new Date(dateNormalized);
            year = jsDate.getFullYear();
            monthIdx = jsDate.getMonth();
            dayOfMonth = jsDate.getDate();
            dayOfWeek = daysMap[jsDate.getDay()];
          }
        } else if (dateStr.includes('-')) {
          dateNormalized = dateStr;
          const jsDate = new Date(dateNormalized);
          year = jsDate.getFullYear();
          monthIdx = jsDate.getMonth();
          dayOfMonth = jsDate.getDate();
          dayOfWeek = daysMap[jsDate.getDay()];
        }
      }

      if (!dateNormalized) continue;

      const compTimeRaw = row[8];
      const compTime = typeof compTimeRaw === 'number' 
        ? compTimeRaw 
        : parseFloat(String(compTimeRaw || '0').replace(',', '.'));

      if (isNaN(compTime) || compTime <= 0) continue;

      const category = String(row[3] || '').trim();
      const contractType = String(row[4] || '').trim();
      const month = monthNames[monthIdx] || 'Wrzesień';

      let weekNum = 'W1';
      if (dayOfMonth > 28) weekNum = 'W5';
      else if (dayOfMonth > 21) weekNum = 'W4';
      else if (dayOfMonth > 14) weekNum = 'W3';
      else if (dayOfMonth > 7) weekNum = 'W2';

      const weekKey = `${year}_${month}_${weekNum}`;

      datesFound.push(dateNormalized);
      uniqueEmployees.add(empName);

      records.push({
        id: `${dateNormalized}_${empName}_${category}_${compTime}`,
        date: dateNormalized,
        year,
        month,
        week: weekNum,
        week_key: weekKey,
        day_of_week: dayOfWeek,
        employee: empName,
        category,
        contract_type: contractType,
        computable_time: Number(compTime.toFixed(2)),
        unit_code: unitCode || activeUnitCode || activeMpk || '',
        unit_name: unitName || activeStoreName || '',
        is_manager: isManager
      });
    }

    if (records.length === 0) {
      return {
        success: false,
        reportType: 'MAPAL_FICHAJES',
        reportTypeName: 'Ewidencja MAPAL Fichajes',
        validation: {
          isValid: false,
          warnings: [],
          errors: [`W wybranym raporcie nie znaleziono żadnych wpisów dla lokalu ${activeStoreName || 'aktywnego'} (${activeUnitCode || activeMpk || ''}) ani menedżerów.`]
        },
        message: `Nie znaleziono danych logowań dla kawiarni ${activeStoreName || 'aktywnej'}.`
      };
    }

    datesFound.sort();
    const minDate = datesFound[0];
    const maxDate = datesFound[datesFound.length - 1];
    const totalHours = Number(records.reduce((acc, r) => acc + r.computable_time, 0).toFixed(2));

    const warnings: string[] = [];
    if (records.some(r => r.computable_time > 12.0)) {
      warnings.push('Wykryto logowania powyżej 12.0h (możliwe nadgodziny lub pomyłka w odbiciu zegara).');
    }

    return {
      success: true,
      reportType: 'MAPAL_FICHAJES',
      reportTypeName: 'Ewidencja MAPAL Fichajes (RCP)',
      mapalData: {
        minDate,
        maxDate,
        totalHours,
        recordsCount: records.length,
        uniqueEmployeesCount: uniqueEmployees.size,
        records
      },
      validation: {
        isValid: true,
        warnings,
        errors: []
      },
      message: `Pomyślnie sparsowano ${records.length} logowań (${totalHours}h, ${uniqueEmployees.size} pracowników, zakres: ${minDate} – ${maxDate}).`
    };
  }

  /**
   * Zapis zatwierdzonych przez użytkownika danych AOP do SQLite
   */
  public static async commitAopData(
    year: number,
    months: AopMonthPreview[]
  ): Promise<UniversalImportResult> {
    try {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.init();
      const db = dbManager.getDb();

      try {
        BackupManager.getInstance().createBackup('pre_import_aop');
      } catch (_) {}

      // Upewnienie się że kolumny finansowe istnieją
      try { db.run('ALTER TABLE aop_plans ADD COLUMN plan_col_pln REAL'); } catch (_) {}
      try { db.run('ALTER TABLE aop_plans ADD COLUMN plan_col_percent REAL'); } catch (_) {}
      try { db.run('ALTER TABLE aop_plans ADD COLUMN plan_cos_pln REAL'); } catch (_) {}
      try { db.run('ALTER TABLE aop_plans ADD COLUMN plan_cos_percent REAL'); } catch (_) {}
      try { db.run('ALTER TABLE aop_plans ADD COLUMN plan_ops_profit REAL'); } catch (_) {}

      const stmt = db.prepare(`
        INSERT INTO aop_plans 
        (key, year, month, month_code, weeks_count, plan_trx, target_tplh, labor_budget, avg_weekly_hours, plan_sales, plan_col_pln, plan_col_percent, plan_cos_pln, plan_cos_percent, plan_ops_profit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          plan_trx=excluded.plan_trx,
          target_tplh=excluded.target_tplh,
          labor_budget=excluded.labor_budget,
          avg_weekly_hours=excluded.avg_weekly_hours,
          plan_sales=excluded.plan_sales,
          plan_col_pln=excluded.plan_col_pln,
          plan_col_percent=excluded.plan_col_percent,
          plan_cos_pln=excluded.plan_cos_pln,
          plan_cos_percent=excluded.plan_cos_percent,
          plan_ops_profit=excluded.plan_ops_profit
      `);

      let totalSales = 0;
      let totalTrx = 0;
      let totalCol = 0;

      for (const m of months) {
        const targetTplh = Number(m.target_tplh) > 0 ? Number(m.target_tplh) : 6.7;
        const weeksCount = Number(m.weeks_count) > 0 ? Number(m.weeks_count) : 5;
        const laborBudget = Number((m.plan_trx / targetTplh).toFixed(1));
        const avgWeekly = Number((laborBudget / weeksCount).toFixed(1));

        stmt.run([
          m.key,
          year,
          m.month,
          m.month_code,
          weeksCount,
          m.plan_trx,
          targetTplh,
          laborBudget,
          avgWeekly,
          m.plan_sales,
          m.plan_col_pln,
          m.plan_col_percent,
          m.plan_cos_pln,
          m.plan_cos_percent,
          m.plan_ops_profit
        ]);

        totalSales += m.plan_sales;
        totalTrx += m.plan_trx;
        totalCol += m.plan_col_pln;
      }

      stmt.free();
      dbManager.persist();

      // Aktualizacja pliku nasion jeśli dotyczy 2026
      try {
        const seedPath = path.join(process.cwd(), 'desktop_app_blueprint', 'data_schemas_and_seeds', 'aop_plan_master_seed.json');
        if (fs.existsSync(seedPath)) {
          const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
          for (const m of months) {
            const idx = seed.findIndex((s: any) => s.key === m.key || (s.year === year && s.month === m.month));
            const budget = Number((m.plan_trx / m.target_tplh).toFixed(1));
            const avgWeekly = Number((budget / m.weeks_count).toFixed(1));
            const entry = {
              key: m.key,
              year,
              month: m.month,
              month_code: m.month_code,
              weeks_count: m.weeks_count,
              plan_trx: m.plan_trx,
              target_tplh: m.target_tplh,
              labor_hours_budget: budget,
              avg_weekly_hours: avgWeekly,
              plan_sales: m.plan_sales,
              plan_col_pln: m.plan_col_pln,
              plan_col_percent: m.plan_col_percent,
              plan_cos_pln: m.plan_cos_pln,
              plan_cos_percent: m.plan_cos_percent
            };
            if (idx >= 0) {
              seed[idx] = { ...seed[idx], ...entry };
            } else {
              seed.push(entry);
            }
          }
          fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2));
        }
      } catch (_) {}

      try {
        BackupManager.getInstance().createBackup('post_import_aop');
      } catch (_) {}

      return {
        success: true,
        reportType: 'AOP_PL',
        reportTypeName: 'Raport AOP P&L',
        importedCount: months.length,
        year,
        totalSales: Number(totalSales.toFixed(2)),
        totalTrx,
        totalCol: Number(totalCol.toFixed(2)),
        message: `✨ Pomyślnie zaimportowano plan AOP na rok ${year} (${months.length} miesięcy). Zaktualizowano cele sprzedaży (${totalSales.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł) oraz transakcji (${totalTrx.toLocaleString('pl-PL')} TRX).`
      };
    } catch (err: any) {
      console.error('Błąd commitAopData:', err);
      return {
        success: false,
        reportType: 'AOP_PL',
        reportTypeName: 'Raport AOP P&L',
        importedCount: 0,
        message: `Błąd zapisu planu AOP do bazy: ${err.message || String(err)}`
      };
    }
  }

  /**
   * Zapis zatwierdzonych logowań MAPAL do SQLite
   */
  public static async commitMapalData(
    records: MapalRecordPreview[]
  ): Promise<UniversalImportResult> {
    try {
      if (!records || records.length === 0) {
        return {
          success: false,
          reportType: 'MAPAL_FICHAJES',
          reportTypeName: 'Ewidencja MAPAL Fichajes',
          importedCount: 0,
          message: 'Brak rekordów do zaimportowania.'
        };
      }

      const dbManager = DatabaseManager.getInstance();
      await dbManager.init();
      const db = dbManager.getDb();

      try {
        BackupManager.getInstance().createBackup('pre_import_mapal');
      } catch (_) {}

      const dates = records.map(r => r.date).sort();
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];

      // Pobranie unikalnych pracowników Janki w importowanym zbiorze
      const managerNames = Array.from(new Set(records.map(r => r.employee)));
      const employeePlaceholders = managerNames.map(() => '?').join(',');
      const { unitCode: activeUnitCode, mpk: activeMpk, storeName: activeStoreName } = dbManager.getActiveStoreIdentifiers();
      const storeFilter = `%${activeMpk || activeUnitCode}%`;

      // Usunięcie starych rekordów dla kawiarni oraz wsparcia menedżerów w innych lokalach w tym zakresie dat
      if (managerNames.length > 0) {
        db.run(`
          DELETE FROM labor_actuals_log 
          WHERE date >= ? AND date <= ?
            AND (
              unit_code = ? OR unit_code = ? OR unit_name LIKE ?
              OR employee IN (${employeePlaceholders})
            )
        `, [minDate, maxDate, activeUnitCode, activeMpk, storeFilter, ...managerNames]);
      } else {
        db.run(`
          DELETE FROM labor_actuals_log 
          WHERE (unit_code = ? OR unit_code = ? OR unit_name LIKE ?)
            AND date >= ? AND date <= ?
        `, [activeUnitCode, activeMpk, storeFilter, minDate, maxDate]);
      }

      // Wstawienie zatwierdzonych rekordów
      const insertStmt = db.prepare(`
        INSERT INTO labor_actuals_log
        (date, year, month, week, week_key, day_of_week, employee, category, contract_type, computable_time, unit_code, unit_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const rec of records) {
        insertStmt.run([
          rec.date,
          rec.year,
          rec.month,
          rec.week,
          rec.week_key,
          rec.day_of_week,
          rec.employee,
          rec.category,
          rec.contract_type,
          rec.computable_time,
          rec.unit_code,
          rec.unit_name
        ]);
      }
      insertStmt.free();
      dbManager.persist();

      try {
        BackupManager.getInstance().createBackup('post_import_mapal');
      } catch (_) {}

      const totalHours = Number(records.reduce((acc, r) => acc + r.computable_time, 0).toFixed(2));

      return {
        success: true,
        reportType: 'MAPAL_FICHAJES',
        reportTypeName: 'Ewidencja MAPAL Fichajes',
        importedCount: records.length,
        minDate,
        maxDate,
        message: `✨ Pomyślnie zaimportowano ${records.length} logowań (${totalHours}h) dla kawiarni ${activeStoreName || 'aktywnej'} w zakresie ${minDate} – ${maxDate}.`
      };
    } catch (err: any) {
      console.error('Błąd commitMapalData:', err);
      return {
        success: false,
        reportType: 'MAPAL_FICHAJES',
        reportTypeName: 'Ewidencja MAPAL Fichajes',
        importedCount: 0,
        message: `Błąd zapisu logowań MAPAL do bazy: ${err.message || String(err)}`
      };
    }
  }

  /**
   * Parsowanie pliku Grafiku Managerskiego (.xlsm / .xlsx)
   */
  private static async parseScheduleForPreview(workbook: any): Promise<ParseReportPreviewResult> {
    // Znajdź arkusz grafiku
    let targetSheetName = workbook.SheetNames.find((s: string) => /Grafik/i.test(s)) || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheetName];
    if (!worksheet) {
      return {
        success: false,
        reportType: 'MANAGER_SCHEDULE',
        reportTypeName: 'Grafik Managerski',
        validation: { isValid: false, warnings: [], errors: ['Nie znaleziono arkusza grafiku.'] },
        message: 'Brak arkusza grafiku w wybranym pliku.'
      };
    }

    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

    // 1. Detekcja Miesiąca i Roku
    const monthNamesPl = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];

    let detectedMonth = 9;
    let detectedMonthName = 'Wrzesień';
    let detectedYear = 2026;

    // Przeszukaj pierwsze 10 wierszy i nazwę arkusza
    const headerSearchText = (targetSheetName + ' ' + rows.slice(0, 10).map(r => Array.isArray(r) ? r.join(' ') : '').join(' ')).toLowerCase();

    for (let m = 0; m < monthNamesPl.length; m++) {
      const plName = monthNamesPl[m].toLowerCase();
      const baseStem = plName.slice(0, 4);
      if (headerSearchText.includes(plName) || headerSearchText.includes(baseStem)) {
        detectedMonth = m + 1;
        detectedMonthName = monthNamesPl[m];
        break;
      }
    }

    const yearMatch = headerSearchText.match(/\b(202[0-9])\b/);
    if (yearMatch) {
      detectedYear = parseInt(yearMatch[1], 10);
    }

    const totalDaysInMonth = new Date(detectedYear, detectedMonth, 0).getDate();

    // 2. Znalezienie wiersza nagłówka dni (dni 1..30/31) oraz kolumn
    let headerRowIdx = -1;
    let colEtatIdx = -1;
    let colManagerIdx = -1;
    let colRoleIdx = -1;
    let dayColMap: Record<number, number> = {};

    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      let foundDaysCount = 0;
      const currentDayMap: Record<number, number> = {};

      row.forEach((cell, colIdx) => {
        const str = String(cell ?? '').trim();
        const num = parseInt(str, 10);
        if (!isNaN(num) && num >= 1 && num <= 31 && String(num) === str) {
          currentDayMap[num] = colIdx;
          foundDaysCount++;
        }
        if (/Etat|Contract/i.test(str)) colEtatIdx = colIdx;
        if (/Manager|Pracownik|Imię|Nazwisko/i.test(str)) colManagerIdx = colIdx;
        if (/Pozycja|Rola|Stanowisko/i.test(str)) colRoleIdx = colIdx;
      });

      if (foundDaysCount >= 20) {
        headerRowIdx = r;
        dayColMap = currentDayMap;
        break;
      }
    }

    if (colEtatIdx === -1) colEtatIdx = 0;
    if (colManagerIdx === -1) colManagerIdx = 1;
    if (colRoleIdx === -1) colRoleIdx = 2;

    if (headerRowIdx === -1) {
      return {
        success: false,
        reportType: 'MANAGER_SCHEDULE',
        reportTypeName: 'Grafik Managerski',
        validation: { isValid: false, warnings: [], errors: ['Nie znaleziono wiersza z dniami miesiąca (1–31).'] },
        message: 'Nie udało się rozpoznać struktury siatki dni grafiku managerskiego.'
      };
    }

    const defaultShiftHours: Record<string, number> = {
      'AM': 8.0, 'PM': 8.0, 'AMN': 6.0, 'PMN': 7.0, 'SAM': 8.0, 'SPM': 8.0, 'SUP': 8.0,
      'MIB': 8.0, 'AMB': 8.0, 'PMB': 8.0, 'MI4': 4.0, 'BT': 8.0, 'NC': 8.0, 'TAM': 8.0,
      'TPM': 8.0, 'RET': 8.0, 'T': 8.0, 'PRE': 8.0, 'MEE': 3.0, 'OFF': 0.0, 'H': 8.0, 'L4': 8.0,
      'M': 0.0, 'Z': 0.0, 'FULL': 0.0
    };

    const employees: ManagerScheduleEmployeePreview[] = [];
    const shifts: ManagerScheduleShiftPreview[] = [];
    const events: { day: number; eventText: string }[] = [];
    let totalScheduleHours = 0;

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawName = String(row[colManagerIdx] || '').trim();
      const firstCell = String(row[0] || '').trim();

      if (!rawName && !firstCell) continue;
      if (/Ważne wydarzenia|Wydarzenia/i.test(firstCell) || /Ważne wydarzenia/i.test(rawName)) {
        for (let d = 1; d <= totalDaysInMonth; d++) {
          const cIdx = dayColMap[d];
          if (cIdx !== undefined && row[cIdx]) {
            const evText = String(row[cIdx]).trim();
            if (evText) events.push({ day: d, eventText: evText });
          }
        }
        continue;
      }

      if (/Obsada|Otwarcie|Zamknięcie|Podsumowanie|Dni OFF|Norma|Bilans/i.test(firstCell) || /Obsada|Otwarcie|Zamknięcie/i.test(rawName)) {
        continue;
      }

      if (!rawName || rawName.length < 3) continue;

      const rawEtat = String(row[colEtatIdx] || 'FULL').trim().toUpperCase();
      let contractRatio = 1.0;
      if (rawEtat.includes('0.75') || rawEtat.includes('3/4')) contractRatio = 0.75;
      else if (rawEtat.includes('0.5') || rawEtat.includes('1/2')) contractRatio = 0.5;

      const rawRole = String(row[colRoleIdx] || 'SSV').trim().toUpperCase();
      let role = 'SSV';
      if (rawRole.includes('SM') && !rawRole.includes('ASM')) role = 'SM';
      else if (rawRole.includes('ASM')) role = 'ASM';

      employees.push({
        name: rawName,
        role,
        contractType: rawEtat || 'FULL',
        contractHoursRatio: contractRatio,
        hourlyRate: role === 'SM' ? 42.0 : role === 'ASM' ? 36.0 : 32.5,
        sortOrder: employees.length + 1
      });

      for (let d = 1; d <= totalDaysInMonth; d++) {
        const cIdx = dayColMap[d];
        const rawShift = cIdx !== undefined ? String(row[cIdx] || '').trim().toUpperCase() : '';
        const shiftCode = rawShift || 'OFF';
        const dateStr = `${detectedYear}-${String(detectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        let hours = defaultShiftHours[shiftCode] ?? 8.0;
        const customHoursMatch = shiftCode.match(/(\d+(?:[.,]\d+)?)\s*h?$/);
        if (customHoursMatch) {
          hours = parseFloat(customHoursMatch[1].replace(',', '.'));
        }

        if (shiftCode !== 'OFF') {
          totalScheduleHours += hours;
        }

        shifts.push({
          day: d,
          date: dateStr,
          employeeName: rawName,
          shiftCode,
          hours
        });
      }
    }

    if (employees.length === 0) {
      return {
        success: false,
        reportType: 'MANAGER_SCHEDULE',
        reportTypeName: 'Grafik Managerski',
        validation: { isValid: false, warnings: [], errors: ['Nie znaleziono wierszy pracowników w arkuszu.'] },
        message: 'Nie udało się odczytać zespołu kierowników z arkusza grafiku.'
      };
    }

    return {
      success: true,
      reportType: 'MANAGER_SCHEDULE',
      reportTypeName: `Grafik Managerski (${detectedMonthName} ${detectedYear})`,
      year: detectedYear,
      scheduleData: {
        year: detectedYear,
        month: detectedMonth,
        monthName: detectedMonthName,
        employees,
        shifts,
        events,
        totalShiftsCount: shifts.length,
        totalHours: Number(totalScheduleHours.toFixed(1))
      },
      validation: {
        isValid: true,
        warnings: [],
        errors: []
      },
      message: `✨ Pomyślnie sparsowano Grafik Managerski: ${detectedMonthName} ${detectedYear} (${employees.length} menedżerów, ${shifts.length} zmian, suma: ${totalScheduleHours.toFixed(1)}h).`
    };
  }

  /**
   * Zapis pojedynczego grafiku do bazy SQLite
   */
  public static async commitScheduleData(
    schedule: SchedulePreviewData
  ): Promise<UniversalImportResult> {
    try {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.init();
      const db = dbManager.getDb();

      const { year, month, employees, shifts, events } = schedule;

      // 1. Synchronizacja manager_employees i manager_monthly_roster
      const empMap: Record<string, number> = {};

      for (const emp of employees) {
        db.run(`
          INSERT OR IGNORE INTO manager_employees (name, role, contract_type, contract_hours_ratio, hourly_rate, monthly_salary, sort_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `, [emp.name, emp.role, emp.contractType, emp.contractHoursRatio, emp.hourlyRate, 0.0, emp.sortOrder]);

        const res = db.exec(`SELECT id FROM manager_employees WHERE name = ?`, [emp.name]);
        if (res.length > 0 && res[0].values.length > 0) {
          const empId = Number(res[0].values[0][0]);
          empMap[emp.name] = empId;

          db.run(`
            INSERT OR REPLACE INTO manager_monthly_roster
            (year, month, employee_id, name, role, contract_type, contract_hours_ratio, hourly_rate, monthly_salary, sort_order, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          `, [year, month, empId, emp.name, emp.role, emp.contractType, emp.contractHoursRatio, emp.hourlyRate, 0.0, emp.sortOrder]);
        }
      }

      // 2. Wstawienie zmian do manager_schedule_shifts
      db.run(`DELETE FROM manager_schedule_shifts WHERE year = ? AND month = ?`, [year, month]);

      const shiftStmt = db.prepare(`
        INSERT OR REPLACE INTO manager_schedule_shifts (year, month, day, date, employee_id, shift_code, hours, custom_start_time, custom_end_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const s of shifts) {
        const empId = empMap[s.employeeName];
        if (empId) {
          shiftStmt.run([
            year,
            month,
            s.day,
            s.date,
            empId,
            s.shiftCode,
            s.hours,
            s.customStartTime || null,
            s.customEndTime || null
          ]);
        }
      }
      shiftStmt.free();

      // 3. Wstawienie wydarzeń
      if (events && events.length > 0) {
        db.run(`DELETE FROM manager_schedule_events WHERE year = ? AND month = ?`, [year, month]);
        const evStmt = db.prepare(`
          INSERT INTO manager_schedule_events (year, month, day, event_text)
          VALUES (?, ?, ?, ?)
        `);
        for (const ev of events) {
          evStmt.run([year, month, ev.day, ev.eventText]);
        }
        evStmt.free();
      }

      dbManager.persist();

      return {
        success: true,
        reportType: 'MANAGER_SCHEDULE',
        reportTypeName: `Grafik Managerski (${schedule.monthName} ${year})`,
        importedCount: shifts.length,
        year,
        message: `✨ Zapisano grafik na ${schedule.monthName} ${year} (${employees.length} menedżerów, ${shifts.length} zmian).`
      };
    } catch (err: any) {
      console.error('Błąd commitScheduleData:', err);
      return {
        success: false,
        reportType: 'MANAGER_SCHEDULE',
        reportTypeName: 'Grafik Managerski',
        importedCount: 0,
        message: `Błąd zapisu grafiku do bazy: ${err.message || String(err)}`
      };
    }
  }

  /**
   * Zapis wielu grafików naraz do bazy SQLite
   */
  public static async commitMultipleSchedules(
    schedules: SchedulePreviewData[]
  ): Promise<UniversalImportResult> {
    try {
      if (!schedules || schedules.length === 0) {
        return {
          success: true,
          reportType: 'MANAGER_SCHEDULE',
          reportTypeName: 'Grafiki Managerskie',
          importedCount: 0,
          message: 'Brak grafików do zaimportowania.'
        };
      }

      try {
        BackupManager.getInstance().createBackup('pre_import_schedules');
      } catch (_) {}

      let totalShifts = 0;
      for (const s of schedules) {
        const res = await this.commitScheduleData(s);
        if (res.success) {
          totalShifts += res.importedCount;
        }
      }

      try {
        BackupManager.getInstance().createBackup('post_import_schedules');
      } catch (_) {}

      return {
        success: true,
        reportType: 'MANAGER_SCHEDULE',
        reportTypeName: 'Grafiki Managerskie',
        importedCount: totalShifts,
        message: `✨ Pomyślnie zaimportowano ${schedules.length} grafików miesięcznych (łącznie ${totalShifts} zmian).`
      };
    } catch (err: any) {
      console.error('Błąd commitMultipleSchedules:', err);
      return {
        success: false,
        reportType: 'MANAGER_SCHEDULE',
        reportTypeName: 'Grafiki Managerskie',
        importedCount: 0,
        message: `Błąd zbiorczego zapisu grafików: ${err.message || String(err)}`
      };
    }
  }

  /**
   * Parsowanie Raportu Dziennego KPI (Wykonanie Rzeczywiste Dzień po Dniu)
   */
  private static async parseDailyKpiForPreview(workbook: any): Promise<ParseReportPreviewResult> {
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });

    let detectedYear = 2026;
    let detectedMonthName = 'Wrzesień';
    let detectedMonthNum = 9;
    const { storeName: activeStoreName } = DatabaseManager.getInstance().getActiveStoreIdentifiers();
    let detectedStoreName = activeStoreName || 'Kawiarnia Starbucks';

    const monthMap: Record<string, { name: string; num: number }> = {
      'jan': { name: 'Styczeń', num: 1 },
      'feb': { name: 'Luty', num: 2 },
      'mar': { name: 'Marzec', num: 3 },
      'apr': { name: 'Kwiecień', num: 4 },
      'may': { name: 'Maj', num: 5 },
      'jun': { name: 'Czerwiec', num: 6 },
      'jul': { name: 'Lipiec', num: 7 },
      'aug': { name: 'Sierpień', num: 8 },
      'sep': { name: 'Wrzesień', num: 9 },
      'oct': { name: 'Październik', num: 10 },
      'nov': { name: 'Listopad', num: 11 },
      'dec': { name: 'Grudzień', num: 12 }
    };

    for (const row of rows.slice(0, 6)) {
      if (Array.isArray(row)) {
        for (const cell of row) {
          if (typeof cell === 'string') {
            const matchFilter = cell.match(/(?:Calendar Month \/ Year is|Month is)\s*([A-Za-z]{3})\s*(\d{4})/i);
            if (matchFilter) {
              const mKey = matchFilter[1].toLowerCase();
              if (monthMap[mKey]) {
                detectedMonthName = monthMap[mKey].name;
                detectedMonthNum = monthMap[mKey].num;
              }
              detectedYear = parseInt(matchFilter[2], 10);
            }
            const matchStore = cell.match(/Restaurant is\s*(.+)/i);
            if (matchStore) {
              detectedStoreName = matchStore[1].trim();
            }
          }
        }
      }
    }

    let headerIdx = -1;
    rows.forEach((r, idx) => {
      if (Array.isArray(r) && r.some(c => typeof c === 'string' && /Day & Date|Sales Net/i.test(c))) {
        headerIdx = idx;
      }
    });

    if (headerIdx === -1) {
      return {
        success: false,
        reportType: 'DAILY_KPI_ACTUAL',
        reportTypeName: 'Raport Dzienny KPI (Actual)',
        validation: {
          isValid: false,
          warnings: [],
          errors: ['Nie znaleziono wiersza nagłówkowego z kolumnami Day & Date, Sales Net, TRX.']
        },
        message: 'Nieprawidłowa struktura nagłówków w pliku raportu dziennego KPI.'
      };
    }

    const header = rows[headerIdx];
    const dayCol = header.findIndex(c => typeof c === 'string' && /Day & Date|Date/i.test(c));
    const salesCol = header.findIndex(c => typeof c === 'string' && /Sales Net|Net Sales|Sales/i.test(c));
    const trxCol = header.findIndex(c => typeof c === 'string' && /^TRX$|Transactions/i.test(c));
    const agcCol = header.findIndex(c => typeof c === 'string' && /^AGC$|Avg Check/i.test(c));
    const delCol = header.findIndex(c => typeof c === 'string' && /Delivery/i.test(c));
    const hoursCol = header.findIndex(c => typeof c === 'string' && /^Hours$|Godziny/i.test(c));
    const tplhCol = header.findIndex(c => typeof c === 'string' && /^TPLH$/i.test(c));

    const days: DailyKpiDayPreview[] = [];
    const warnings: string[] = [];

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!Array.isArray(r) || !r[dayCol]) continue;

      const dayStr = String(r[dayCol]).replace(/[★*]/g, '').trim();
      const dayMatch = dayStr.match(/(\d{1,2})/);
      if (!dayMatch) continue;

      const dayNum = parseInt(dayMatch[1], 10);
      const salesVal = r[salesCol];
      if (salesVal === null || salesVal === undefined || salesVal === '') continue;
      const sales = Number(salesVal);
      if (isNaN(sales) || sales <= 0) continue; // dzień nieraportowany/przyszły

      const trx = Math.round(Number(r[trxCol]) || 0);
      const hours = Number(Number(r[hoursCol] || 0).toFixed(2));
      const agc = Number(Number(r[agcCol] || (trx > 0 ? sales / trx : 0)).toFixed(2));
      const del = Math.round(Number(r[delCol]) || 0);
      const tplh = Number(Number(r[tplhCol] || (hours > 0 ? trx / hours : 0)).toFixed(2));

      const iso = `${detectedYear}-${String(detectedMonthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      // Wyznaczenie tygodnia W1..W5
      let weekNum = 'W1';
      if (dayNum > 28) weekNum = 'W5';
      else if (dayNum > 21) weekNum = 'W4';
      else if (dayNum > 14) weekNum = 'W3';
      else if (dayNum > 7) weekNum = 'W2';

      const weekKey = `${detectedYear}_${detectedMonthName}_${weekNum}`;

      days.push({
        date: iso,
        dayOfMonth: dayNum,
        dayLabel: dayStr,
        salesNet: Number(sales.toFixed(2)),
        trx,
        agc,
        hours,
        tplh,
        deliveryTrx: del,
        weekNum,
        weekKey
      });
    }

    if (days.length === 0) {
      return {
        success: false,
        reportType: 'DAILY_KPI_ACTUAL',
        reportTypeName: 'Raport Dzienny KPI (Actual)',
        validation: {
          isValid: false,
          warnings: [],
          errors: ['Plik nie zawiera żadnych dni ze zrealizowaną sprzedażą (wszystkie wiersze są puste lub 0 zł).']
        },
        message: 'Nie znaleziono zaraportowanych dni sprzedaży w pliku.'
      };
    }

    // Podsumowanie zbiorcze
    const totalSalesNet = Number(days.reduce((acc, d) => acc + d.salesNet, 0).toFixed(2));
    const totalTrx = days.reduce((acc, d) => acc + d.trx, 0);
    const totalHours = Number(days.reduce((acc, d) => acc + d.hours, 0).toFixed(1));
    const totalDeliveryTrx = days.reduce((acc, d) => acc + d.deliveryTrx, 0);
    const avgAgc = totalTrx > 0 ? Number((totalSalesNet / totalTrx).toFixed(2)) : 0;
    const avgTplh = totalHours > 0 ? Number((totalTrx / totalHours).toFixed(2)) : 0;

    // Agregacja tygodniowa
    const weekMap: Record<string, DailyKpiWeekPreview> = {};
    for (const d of days) {
      if (!weekMap[d.weekKey]) {
        weekMap[d.weekKey] = {
          weekKey: d.weekKey,
          weekNum: d.weekNum,
          daysCount: 0,
          salesNet: 0,
          trx: 0,
          hours: 0,
          deliveryTrx: 0,
          agc: 0,
          tplh: 0
        };
      }
      const w = weekMap[d.weekKey];
      w.daysCount++;
      w.salesNet = Number((w.salesNet + d.salesNet).toFixed(2));
      w.trx += d.trx;
      w.hours = Number((w.hours + d.hours).toFixed(1));
      w.deliveryTrx += d.deliveryTrx;
    }

    const weeklyBreakdown: DailyKpiWeekPreview[] = Object.values(weekMap).map(w => ({
      ...w,
      agc: w.trx > 0 ? Number((w.salesNet / w.trx).toFixed(2)) : 0,
      tplh: w.hours > 0 ? Number((w.trx / w.hours).toFixed(2)) : 0
    }));

    const dailyKpiData: DailyKpiPreviewData = {
      year: detectedYear,
      month: detectedMonthNum,
      monthName: detectedMonthName,
      monthKey: `${detectedYear}_${detectedMonthName}`,
      storeName: detectedStoreName,
      days,
      summary: {
        reportedDaysCount: days.length,
        totalSalesNet,
        totalTrx,
        totalHours,
        totalDeliveryTrx,
        avgAgc,
        avgTplh
      },
      weeklyBreakdown
    };

    return {
      success: true,
      reportType: 'DAILY_KPI_ACTUAL',
      reportTypeName: 'Raport Dzienny KPI (Actual)',
      year: detectedYear,
      dailyKpiData,
      validation: {
        isValid: true,
        warnings,
        errors: []
      },
      message: `Pomyślnie sparsowano ${days.length} dni raportu za ${detectedMonthName} ${detectedYear} (Sprzedaż: ${totalSalesNet.toLocaleString('pl-PL')} zł, TRX: ${totalTrx.toLocaleString('pl-PL')}, Średnie AGC: ${avgAgc.toFixed(2)} zł, Średni TPLH: ${avgTplh.toFixed(2)}).`
    };
  }

  /**
   * Zapis zatwierdzonych przez użytkownika danych Dziennego KPI do SQLite
   */
  public static async commitDailyKpiData(
    dailyKpiData: DailyKpiPreviewData
  ): Promise<UniversalImportResult> {
    try {
      const dbManager = DatabaseManager.getInstance();
      await dbManager.init();
      const db = dbManager.getDb();

      try {
        BackupManager.getInstance().createBackup('pre_import_daily_kpi');
      } catch (_) {}

      // Migracje kolumn dla weekly_actual_trx i aop_plans
      try { db.run('ALTER TABLE weekly_actual_trx ADD COLUMN actual_sales REAL'); } catch (_) {}
      try { db.run('ALTER TABLE weekly_actual_trx ADD COLUMN actual_hours REAL'); } catch (_) {}
      try { db.run('ALTER TABLE weekly_actual_trx ADD COLUMN actual_agc REAL'); } catch (_) {}
      try { db.run('ALTER TABLE weekly_actual_trx ADD COLUMN actual_tplh REAL'); } catch (_) {}
      try { db.run('ALTER TABLE weekly_actual_trx ADD COLUMN delivery_trx INTEGER'); } catch (_) {}

      try { db.run('ALTER TABLE aop_plans ADD COLUMN actual_sales REAL'); } catch (_) {}
      try { db.run('ALTER TABLE aop_plans ADD COLUMN actual_trx INTEGER'); } catch (_) {}
      try { db.run('ALTER TABLE aop_plans ADD COLUMN actual_tplh REAL'); } catch (_) {}
      try { db.run('ALTER TABLE aop_plans ADD COLUMN actual_agc REAL'); } catch (_) {}

      // Tabela logów dobowych KPI
      db.run(`
        CREATE TABLE IF NOT EXISTS daily_kpi_actuals_log (
          date TEXT PRIMARY KEY,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          month_name TEXT NOT NULL,
          day_of_month INTEGER NOT NULL,
          day_label TEXT,
          week_key TEXT,
          sales_net REAL NOT NULL,
          trx INTEGER NOT NULL,
          agc REAL NOT NULL,
          hours REAL NOT NULL,
          tplh REAL NOT NULL,
          delivery_trx INTEGER DEFAULT 0,
          imported_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 1. Zapis dni dobowych
      const dayStmt = db.prepare(`
        INSERT OR REPLACE INTO daily_kpi_actuals_log
        (date, year, month, month_name, day_of_month, day_label, week_key, sales_net, trx, agc, hours, tplh, delivery_trx, imported_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      for (const d of dailyKpiData.days) {
        dayStmt.run([
          d.date,
          dailyKpiData.year,
          dailyKpiData.month,
          dailyKpiData.monthName,
          d.dayOfMonth,
          d.dayLabel,
          d.weekKey,
          d.salesNet,
          d.trx,
          d.agc,
          d.hours,
          d.tplh,
          d.deliveryTrx
        ]);
      }
      dayStmt.free();

      // 2. Zapis agregacji tygodniowych do weekly_actual_trx
      const weekStmt = db.prepare(`
        INSERT INTO weekly_actual_trx 
        (week_key, actual_trx, actual_sales, actual_hours, actual_agc, actual_tplh, delivery_trx, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(week_key) DO UPDATE SET
          actual_trx = excluded.actual_trx,
          actual_sales = excluded.actual_sales,
          actual_hours = excluded.actual_hours,
          actual_agc = excluded.actual_agc,
          actual_tplh = excluded.actual_tplh,
          delivery_trx = excluded.delivery_trx,
          updated_at = CURRENT_TIMESTAMP
      `);

      for (const w of dailyKpiData.weeklyBreakdown) {
        weekStmt.run([
          w.weekKey,
          w.trx,
          w.salesNet,
          w.hours,
          w.agc,
          w.tplh,
          w.deliveryTrx
        ]);
      }
      weekStmt.free();

      // 3. Aktualizacja wykonania MTD w aop_plans
      const aopStmt = db.prepare(`
        UPDATE aop_plans SET
          actual_sales = ?,
          actual_trx = ?,
          actual_tplh = ?,
          actual_agc = ?
        WHERE key = ?
      `);

      aopStmt.run([
        dailyKpiData.summary.totalSalesNet,
        dailyKpiData.summary.totalTrx,
        dailyKpiData.summary.avgTplh,
        dailyKpiData.summary.avgAgc,
        dailyKpiData.monthKey
      ]);
      aopStmt.free();

      dbManager.persist();

      try {
        BackupManager.getInstance().createBackup('post_import_daily_kpi');
      } catch (_) {}

      return {
        success: true,
        reportType: 'DAILY_KPI_ACTUAL',
        reportTypeName: 'Raport Dzienny KPI (Actual)',
        importedCount: dailyKpiData.days.length,
        message: `✨ Pomyślnie zaimportowano wykonanie za ${dailyKpiData.days.length} dni (${dailyKpiData.monthName} ${dailyKpiData.year}). Zaktualizowano tygodnie W1–W5 oraz podsumowanie MTD (Sprzedaż: ${dailyKpiData.summary.totalSalesNet.toLocaleString('pl-PL')} zł, TRX: ${dailyKpiData.summary.totalTrx.toLocaleString('pl-PL')}, AGC: ${dailyKpiData.summary.avgAgc.toFixed(2)} zł, TPLH: ${dailyKpiData.summary.avgTplh.toFixed(2)}).`
      };
    } catch (err: any) {
      console.error('Błąd commitDailyKpiData:', err);
      return {
        success: false,
        reportType: 'DAILY_KPI_ACTUAL',
        reportTypeName: 'Raport Dzienny KPI (Actual)',
        importedCount: 0,
        message: `Błąd podczas zapisu danych dziennego KPI: ${err.message || String(err)}`
      };
    }
  }

  /**
   * Bezpośredni import (all-in-one dla skryptów lub CLI)
   */
  public static async parseAndImport(
    fileBufferOrPath: Buffer | string
  ): Promise<UniversalImportResult> {
    const preview = await this.parseReportForPreview(fileBufferOrPath);
    if (!preview.success) {
      return {
        success: false,
        reportType: preview.reportType,
        reportTypeName: preview.reportTypeName,
        importedCount: 0,
        message: preview.message
      };
    }

    if (preview.reportType === 'AOP_PL' && preview.aopData) {
      return await this.commitAopData(preview.aopData.year, preview.aopData.months);
    } else if (preview.reportType === 'MAPAL_FICHAJES' && preview.mapalData) {
      return await this.commitMapalData(preview.mapalData.records);
    } else if (preview.reportType === 'MANAGER_SCHEDULE' && preview.scheduleData) {
      return await this.commitScheduleData(preview.scheduleData);
    } else if (preview.reportType === 'DAILY_KPI_ACTUAL' && preview.dailyKpiData) {
      return await this.commitDailyKpiData(preview.dailyKpiData);
    } else {
      return {
        success: false,
        reportType: 'UNKNOWN',
        reportTypeName: 'Nieznany',
        importedCount: 0,
        message: preview.message
      };
    }
  }
}
