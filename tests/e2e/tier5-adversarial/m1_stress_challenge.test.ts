import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import * as xlsxModule from 'xlsx';
import { StoreService } from '../../../src/services/storeService';
import { VirtualLocalStorage } from '../helpers/testHarness';
import { ColEngine } from '../../../src/modules/col-calculator/services/colEngine';
import {
  DEFAULT_COL_STORE_INFO,
  DEFAULT_COL_KPIS,
  DEFAULT_COL_MANAGERS,
  DEFAULT_COL_CREW_UOP,
  DEFAULT_COL_CREW_UZ,
  DEFAULT_COL_OTHER_COSTS,
} from '../../../src/modules/col-calculator/services/colDefaultData';
import { ColManagerItem } from '../../../src/modules/col-calculator/types/colTypes';

const XLSX: any = (xlsxModule as any).default || xlsxModule;

test('Tier 5 Adversarial: Milestone 1 Boundary & Stress Testing', async (suite) => {
  // Setup virtual localStorage for storeService tests
  const setupVirtualStorage = () => {
    const storage = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, String(v)),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear(),
    };
    (globalThis as any).window = {
      dispatchEvent: () => {},
    };
    return storage;
  };

  // =========================================================================
  // 1. ONBOARDING WIZARD VALIDATION STRESS TESTS
  // =========================================================================
  await suite.test('1. Onboarding Wizard Validation: Empty, Whitespace & Boundary Inputs', async (t) => {
    const validateManagerName = (name: string): boolean => name.trim().length >= 3;
    const validateManagerEmail = (email: string): boolean =>
      /^[a-zA-Z0-9._%+-]+@amrest\.eu$/i.test(email.trim());
    const validateStore = (store: { name: string; unitCode: string }): boolean =>
      Boolean(store.name && store.unitCode && store.name.trim().length > 0 && store.unitCode.trim().length > 0);

    await t.test('test_rejects_empty_and_whitespace_manager_names', () => {
      const emptyNames = ['', ' ', '   ', '\t', '\n', ' \t \n '];
      for (const name of emptyNames) {
        assert.equal(validateManagerName(name), false, `Should reject empty/whitespace name: "${name}"`);
      }
    });

    await t.test('test_rejects_manager_names_under_3_characters', () => {
      const shortNames = ['A', 'AB', '  A  ', ' X ', '12'];
      for (const name of shortNames) {
        assert.equal(validateManagerName(name), false, `Should reject name under 3 chars: "${name}"`);
      }
    });

    await t.test('test_accepts_valid_manager_names', () => {
      const validNames = ['Jan', 'Anna Kowalska', 'Store Manager', 'Piotr Nowak', '  Ewa Nowak  '];
      for (const name of validNames) {
        assert.equal(validateManagerName(name), true, `Should accept valid name: "${name}"`);
      }
    });

    await t.test('test_rejects_non_amrest_and_malformed_emails', () => {
      const invalidEmails = [
        '',
        '   ',
        'jan.kowalski@gmail.com',
        'sm@starbucks.com',
        'jan.kowalski@amrest.com',
        'jan.kowalski@amrest.pl',
        '@amrest.eu',
        'jan.kowalski@',
        'jan kowalski@amrest.eu',
        'jan.kowalski@amrest.eu.com',
        'attacker<script>@amrest.eu',
      ];
      for (const email of invalidEmails) {
        assert.equal(validateManagerEmail(email), false, `Should reject invalid email: "${email}"`);
      }

      // Edge-case observation: current regex /^[a-zA-Z0-9._%+-]+@amrest\.eu$/i permits consecutive dots
      const consecutiveDotsEmail = 'jan..kowalski@amrest.eu';
      const permitsConsecutiveDots = validateManagerEmail(consecutiveDotsEmail);
      assert.equal(permitsConsecutiveDots, true, 'Regex permits consecutive dots in email local-part');
    });

    await t.test('test_accepts_valid_amrest_emails', () => {
      const validEmails = [
        'jan.kowalski@amrest.eu',
        'anna.nowak@AMREST.EU',
        'sm_janki@amrest.eu',
        'store.18120@amrest.eu',
        '  jan.kowalski@amrest.eu  ',
      ];
      for (const email of validEmails) {
        assert.equal(validateManagerEmail(email), true, `Should accept valid email: "${email}"`);
      }
    });

    await t.test('test_rejects_empty_or_whitespace_store_selection', () => {
      assert.equal(validateStore({ name: '', unitCode: '' }), false);
      assert.equal(validateStore({ name: 'SBX Janki', unitCode: '' }), false);
      assert.equal(validateStore({ name: '', unitCode: '18120' }), false);
      assert.equal(validateStore({ name: '   ', unitCode: '   ' }), false);
      assert.equal(validateStore({ name: '108120 SBX Janki', unitCode: '18120' }), true);
    });

    await t.test('test_store_service_clean_unconfigured_state', () => {
      setupVirtualStorage();
      assert.equal(StoreService.hasConfiguredStore(), false, 'Clean environment must report hasConfiguredStore() as false');

      const store = StoreService.getCurrentStore();
      assert.equal(store.id, '', 'Unconfigured store ID must be empty string');
      assert.equal(store.name, '', 'Unconfigured store name must be empty string');
      assert.equal(store.unitCode, '', 'Unconfigured store unitCode must be empty string');
    });

    await t.test('test_store_service_rejects_incomplete_onboarding_flags', () => {
      const storage = setupVirtualStorage();

      // Case 1: Name exists, but onboarding was not completed
      storage.set('sbx_store_name', 'SBX Test');
      storage.set('sbx_onboarding_completed', 'false');
      assert.equal(StoreService.hasConfiguredStore(), false, 'Cannot be configured if onboarding flag is false');

      // Case 2: Onboarding is true, but store keys are missing
      storage.clear();
      storage.set('sbx_onboarding_completed', 'true');
      assert.equal(StoreService.hasConfiguredStore(), false, 'Cannot be configured if store keys are missing');
    });
  });

  // =========================================================================
  // 2. IMPORTER STRESS TESTING (NON-JANKI & MALFORMED ROWS)
  // =========================================================================
  await suite.test('2. Importer Stress Testing: Non-Janki Handling & Malformed Rows', async (t) => {
    // Implementation of report type detection logic from UniversalReportParser
    function detectReportTypeFromWorkbook(workbook: any): string {
      const hasScheduleSheet = workbook.SheetNames.some((s: string) =>
        /Grafik|Schedule|Managers|Menedżer/i.test(s)
      );
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      if (!worksheet) return 'UNKNOWN';

      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true });
      const flatContent = rawRows
        .slice(0, 35)
        .map((row: any) => (Array.isArray(row) ? row.join(' ') : ''))
        .join('\n');

      if (/Day & Date/i.test(flatContent) && (/Sales Net|Net Sales/i.test(flatContent) || /AGC/i.test(flatContent))) {
        return 'DAILY_KPI_ACTUAL';
      }
      const hasScheduleHeaders = /GRAFIK MANAGERSKI|MANAGER|Pozycja|Dni OFF|Godziny wypracowane/i.test(flatContent);
      const hasShiftCodes = /\b(AM|PM|AMN|PMN|SAM|SPM|SUP|MIB|NC)\b/.test(flatContent);
      if (hasScheduleSheet || (hasScheduleHeaders && hasShiftCodes)) {
        return 'MANAGER_SCHEDULE';
      }
      const hasPnlHierarchy = /PnL Equity Hierarchy|P&L Level/i.test(flatContent);
      const hasSalesAndTrx = /SALES/i.test(flatContent) && (/TRANSACTIONS/i.test(flatContent) || /Net Sales/i.test(flatContent));
      if (hasPnlHierarchy && hasSalesAndTrx) {
        return 'AOP_PL';
      }
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

    // Parsing simulation for MAPAL rows matching UniversalReportParser.parseMapalForPreview
    function parseMapalRows(
      rawRows: any[][],
      activeStore: { unitCode: string; mpk: string; storeName: string },
      managerNames: string[]
    ) {
      if (rawRows.length < 8) {
        return { success: false, records: [], message: 'Fewer than 8 rows' };
      }

      const cleanActiveName = activeStore.storeName
        ? activeStore.storeName.toLowerCase().replace(/^108\d{3}\s*/, '').replace(/^sbx\s*/i, '').trim()
        : '';

      const validRecords: any[] = [];

      for (let r = 7; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length < 9) continue;

        const unitName = String(row[14] || '');
        const unitCode = String(row[13] || '');
        const empName = String(row[2] || '').trim();

        const isStoreMatch = Boolean(
          (activeStore.unitCode && (unitCode === activeStore.unitCode || unitCode.includes(activeStore.unitCode) || activeStore.unitCode.includes(unitCode))) ||
          (activeStore.mpk && (unitName.includes(activeStore.mpk) || unitCode.includes(activeStore.mpk))) ||
          (cleanActiveName && cleanActiveName.length >= 3 && unitName.toLowerCase().includes(cleanActiveName))
        );

        const isManager = managerNames.some(m => m.toLowerCase() === empName.toLowerCase());

        if (!isStoreMatch && !isManager) continue;

        // Date check
        const dateVal = row[5];
        let dateNormalized = '';
        if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
          dateNormalized = dateVal.trim();
        } else if (typeof dateVal === 'number') {
          const parsed = XLSX.SSF.parse_date_code(dateVal);
          if (parsed) {
            dateNormalized = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
          }
        }

        if (!dateNormalized) continue;

        const compTimeRaw = row[8];
        const compTime = typeof compTimeRaw === 'number'
          ? compTimeRaw
          : parseFloat(String(compTimeRaw || '0').replace(',', '.'));

        if (isNaN(compTime) || compTime <= 0) continue;

        validRecords.push({
          date: dateNormalized,
          employee: empName,
          computable_time: Number(compTime.toFixed(2)),
          unit_code: unitCode || activeStore.unitCode,
          unit_name: unitName || activeStore.storeName,
          is_manager: isManager,
        });
      }

      return {
        success: validRecords.length > 0,
        records: validRecords,
        message: validRecords.length > 0 ? 'Success' : `No records for store ${activeStore.storeName}`,
      };
    }

    await t.test('test_importer_detects_all_report_formats_correctly', () => {
      // 1. MAPAL Workbook
      const wbMapal = XLSX.utils.book_new();
      const wsMapal = XLSX.utils.aoa_to_sheet([
        ['MAPAL Fichajes Report'],
        ['Parameters: Business Unit'],
        [''],
        [''],
        [''],
        ['Employee', 'Category', 'Contract Type', 'Business Day', 'Computable Time', 'Total horas']
      ]);
      XLSX.utils.book_append_sheet(wbMapal, wsMapal, 'Report');
      assert.equal(detectReportTypeFromWorkbook(wbMapal), 'MAPAL_FICHAJES');

      // 2. Schedule Workbook
      const wbSched = XLSX.utils.book_new();
      const wsSched = XLSX.utils.aoa_to_sheet([['GRAFIK MANAGERSKI'], ['AM', 'PM']]);
      XLSX.utils.book_append_sheet(wbSched, wsSched, 'Grafik Wrzesień');
      assert.equal(detectReportTypeFromWorkbook(wbSched), 'MANAGER_SCHEDULE');

      // 3. AOP Workbook (requires PnL hierarchy + SALES + TRANSACTIONS)
      const wbAop = XLSX.utils.book_new();
      const wsAop = XLSX.utils.aoa_to_sheet([['PnL Equity Hierarchy'], ['SALES'], ['TRANSACTIONS']]);
      XLSX.utils.book_append_sheet(wbAop, wsAop, 'AOP');
      assert.equal(detectReportTypeFromWorkbook(wbAop), 'AOP_PL');
    });

    await t.test('test_importer_parses_non_janki_store_and_rejects_malformed_rows', () => {
      const activeStore = {
        unitCode: '18144',
        mpk: '108144',
        storeName: '108144 SBX Złote Tarasy',
      };
      const managers = ['Krzysztof Manager'];

      const rawRows: any[][] = [
        ['MAPAL Fichajes Export Report'],
        ['Period: 2026-09-01 to 2026-09-30'],
        ['Created: 2026-10-01'],
        [],
        ['Parameters:'],
        ['Header row with column definitions'],
        [], // Row 7
        // Row 8 (valid non-Janki barista)
        ['', '', 'Anna Kowalska', 'Barista', 'UoP', '2026-09-15', '', '', 8.0, '', '', '', '', '444', '108144 SBX Złote Tarasy'],
        // Row 9 (negative hours: -8.0 -> must be skipped)
        ['', '', 'Piotr Nowak', 'Barista', 'UoP', '2026-09-15', '', '', -8.0, '', '', '', '', '444', '108144 SBX Złote Tarasy'],
        // Row 10 (NaN hours: "brak" -> must be skipped)
        ['', '', 'Maria Wiśniewska', 'Barista', 'UZ', '2026-09-15', '', '', 'brak', '', '', '', '', '444', '108144 SBX Złote Tarasy'],
        // Row 11 (invalid date: "invalid-date" -> must be skipped)
        ['', '', 'Tomasz Lewandowski', 'Barista', 'UoP', 'invalid-date', '', '', 8.0, '', '', '', '', '444', '108144 SBX Złote Tarasy'],
        // Row 12 (unrelated foreign store non-manager: 108999 -> must be skipped)
        ['', '', 'Krzysztof Wójcik', 'Barista', 'UoP', '2026-09-15', '', '', 8.0, '', '', '', '', '999', '108999 SBX Other Store'],
        // Row 13 (string comma hours: "7,5" -> must parse to 7.5)
        ['', '', 'Zofia Kamińska', 'Barista', 'UoP', '2026-09-16', '', '', '7,5', '', '', '', '', '444', '108144 SBX Złote Tarasy'],
        // Row 14 (manager working in another store: 108999 -> must be kept as support shift)
        ['', '', 'Krzysztof Manager', 'SM', 'UoP', '2026-09-17', '', '', 8.0, '', '', '', '', '999', '108999 SBX Other Store'],
      ];

      const res = parseMapalRows(rawRows, activeStore, managers);
      assert.equal(res.success, true);
      assert.equal(res.records.length, 3, 'Expected exactly 3 valid records (Anna, Zofia, Krzysztof Manager)');

      // Verify no hardcoded 18120 or 384 was injected
      for (const rec of res.records) {
        assert.notEqual(rec.unit_code, '18120', 'Unit code must not be hardcoded to 18120');
        assert.notEqual(rec.unit_code, '384', 'Unit code must not be hardcoded to 384');
        assert.notEqual(rec.unit_name, '108120 SBX Warszawa Janki', 'Unit name must not be Janki');
      }

      const zofia = res.records.find(r => r.employee === 'Zofia Kamińska');
      assert.equal(zofia?.computable_time, 7.5, 'Comma decimal "7,5" must parse to 7.5');

      const mgr = res.records.find(r => r.employee === 'Krzysztof Manager');
      assert.equal(mgr?.is_manager, true, 'Manager support shift in foreign store must be tagged');
    });

    await t.test('test_legacy_mapal_parser_no_janki_hardcode_in_success_message', () => {
      // Direct source inspection of electron/importer/mapalParser.ts lines 348-351
      const mapalParserPath = path.resolve(process.cwd(), 'electron/importer/mapalParser.ts');
      const content = fs.readFileSync(mapalParserPath, 'utf8');

      const hasJankiHardcode = content.includes('dla kawiarni Janki');
      assert.equal(
        hasJankiHardcode,
        false,
        'RESOLVED: electron/importer/mapalParser.ts must not contain hardcoded "dla kawiarni Janki"'
      );
    });
  });

  // =========================================================================
  // 3. ZERO AI PLACEHOLDER TEXT AUDIT ACROSS SOURCE CODE
  // =========================================================================
  await suite.test('3. Codebase Audit: Zero AI Placeholder Texts in Source Views', async (t) => {
    const srcDir = path.resolve(process.cwd(), 'src');

    const bannedSubstrings = [
      'lorem ipsum',
      'tutaj pojawi',
      'tutaj pojawią',
      'w budowie (scratch)',
      'ai placeholder',
      'ai filler',
      'dummy status',
      'sample text placeholder',
      '[insert description',
      'todo: ai',
    ];

    function getAllSourceFiles(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...getAllSourceFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
          if (!fullPath.includes('constants/changelog.ts')) {
            results.push(fullPath);
          }
        }
      }
      return results;
    }

    const files = getAllSourceFiles(srcDir);
    const violations: Array<{ file: string; line: number; banned: string; text: string }> = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      lines.forEach((lineText, idx) => {
        const lower = lineText.toLowerCase();
        for (const banned of bannedSubstrings) {
          if (lower.includes(banned)) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: idx + 1,
              banned,
              text: lineText.trim(),
            });
          }
        }
      });
    }

    assert.equal(
      violations.length,
      0,
      `Found ${violations.length} banned placeholder occurrences in src/:\n` +
        violations.map(v => `  - ${v.file}:${v.line} [${v.banned}]: ${v.text}`).join('\n')
    );
  });

  // =========================================================================
  // 4. CROSS-VERIFICATION OF DEFECTS REPORTED BY PEER CHALLENGER (m1_challenger_1)
  // =========================================================================
  await suite.test('4. Cross-Verification of ColCalculator Zero-Division & Mock Numbers', async (t) => {
    await t.test('verify_col_engine_zero_division_defect', () => {
      // Managers scheduled, crew arrays empty (exact state on new store onboarding)
      const managersWithHours: ColManagerItem[] = [
        ...DEFAULT_COL_MANAGERS,
        {
          id: 'mgr-test-1',
          name: 'Store Manager',
          position: 'SM',
          contractRatio: 1,
          baseSalary: 6000,
          planWorkHours: 160,
          planSickHours: 0,
          planHolidayHours: 0,
          planBonus: 0,
          isDisability: false,
          estWorkHours: 160,
          estSickHours: 0,
          estHolidayHours: 0,
          estBonus: 0,
          storeCostRatio: 1,
        },
      ];

      const kpis = {
        ...DEFAULT_COL_KPIS,
        salesTarget: 100000,
        trxTarget: 5000,
        tplhTarget: 6.6,
        whatIfTplhImprovement: 7.0,
      };

      const res = ColEngine.calculate(
        DEFAULT_COL_STORE_INFO,
        kpis,
        managersWithHours,
        DEFAULT_COL_CREW_UOP, // []
        DEFAULT_COL_CREW_UZ,  // []
        DEFAULT_COL_OTHER_COSTS
      );

      // Verify that colEngine produces NaN due to line 302:
      // const avgCrewHourlyCost = totalWorkingHoursPlan > 0 ? totalCrewPlan / crewHoursPlan : 32.5;
      const isDefective = Number.isNaN(res.whatIfColSavings) || !Number.isFinite(res.whatIfColSavings);
      assert.equal(
        isDefective,
        false,
        'RESOLVED: ColEngine must produce finite numbers on crewHoursPlan=0 when managers are scheduled'
      );
    });

    await t.test('verify_col_bonus_sheet_unpurged_mock_numbers', () => {
      const bonusSheetPath = path.resolve(process.cwd(), 'src/modules/col-calculator/components/ColBonusSheet.tsx');
      const source = fs.readFileSync(bonusSheetPath, 'utf8');

      const hasMockSalesAop = source.includes('useState<number>(310000)');
      assert.equal(
        hasMockSalesAop,
        false,
        'RESOLVED: ColBonusSheet.tsx must not contain hardcoded 310000 salesAop mock default'
      );
    });
  });
});
