import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { StoreService } from '../../../src/services/storeService';
import * as starbucksStores from '../../../src/constants/starbucksStores';
import { STARBUCKS_STORES_CATALOG } from '../../../src/constants/starbucksStores';
import { ColEngine } from '../../../src/modules/col-calculator/services/colEngine';
import {
  DEFAULT_COL_STORE_INFO,
  DEFAULT_COL_KPIS,
  DEFAULT_COL_MANAGERS,
  DEFAULT_COL_CREW_UOP,
  DEFAULT_COL_CREW_UZ,
  DEFAULT_COL_OTHER_COSTS
} from '../../../src/modules/col-calculator/services/colDefaultData';
import { ColManagerItem } from '../../../src/modules/col-calculator/types/colTypes';

test('B19: Milestone 1 Adversarial Empirical Stress Testing', async (t) => {
  // Helper for virtual localStorage
  const setupVirtualLocalStorage = () => {
    const storage = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, String(v)),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear()
    };
    (globalThis as any).window = {
      dispatchEvent: () => {}
    };
    return storage;
  };

  await t.test('test_b19_clean_launch_unconfigured_state_and_no_default_store_id', () => {
    setupVirtualLocalStorage();

    // 1. Storage is empty on clean launch
    assert.equal(StoreService.hasConfiguredStore(), false, 'StoreService.hasConfiguredStore() must be false on clean launch');

    // 2. DEFAULT_STORE_ID must be eliminated
    assert.equal('DEFAULT_STORE_ID' in starbucksStores, false, 'DEFAULT_STORE_ID must not exist in starbucksStores exports');

    // 3. getCurrentStore must return empty unconfigured store, not fall back to store 108120
    const store = StoreService.getCurrentStore();
    assert.equal(store.id, '', 'Current store ID must be empty string on clean launch');
    assert.equal(store.unitCode, '', 'Current store unitCode must be empty string on clean launch');
    assert.equal(store.name, '', 'Current store name must be empty string on clean launch');
  });

  await t.test('test_b19_multiple_store_switches_isolation_and_no_leakage', async () => {
    const storage = setupVirtualLocalStorage();

    // Store 1: Nowy Świat (Unit 323, MPK 108004)
    const storeNowySwiat = STARBUCKS_STORES_CATALOG.find(s => s.unitCode === '323');
    assert.ok(storeNowySwiat, 'Store 323 Nowy Świat must exist in catalog');
    await StoreService.setCurrentStore(storeNowySwiat!);

    let current = StoreService.getCurrentStore();
    assert.equal(current.unitCode, '323');
    assert.equal(current.id, '108004');
    assert.equal(storage.get('sbx_unit_code'), '323');

    // Store 2: Galeria Bałtycka (Unit 18035, MPK 108035)
    const storeBaltycka = STARBUCKS_STORES_CATALOG.find(s => s.id === '108035');
    assert.ok(storeBaltycka, 'Store 108035 Galeria Bałtycka must exist in catalog');
    await StoreService.setCurrentStore(storeBaltycka!);

    current = StoreService.getCurrentStore();
    assert.equal(current.unitCode, '18035');
    assert.equal(current.id, '108035');
    assert.equal(storage.get('sbx_unit_code'), '18035');

    // Verify no hardcoded Janki (18120 / 108120) values leaked into storage
    for (const [k, v] of storage.entries()) {
      assert.ok(!String(v).includes('18120'), `Leak of 18120 in storage key ${k}`);
      assert.ok(!String(v).includes('108120'), `Leak of 108120 in storage key ${k}`);
      assert.ok(!String(v).includes('Janki'), `Leak of Janki in storage key ${k}`);
    }
  });

  await t.test('test_b19_col_calculator_pure_zero_state', () => {
    // Pure zero inputs across all parameters
    const res = ColEngine.calculate(
      DEFAULT_COL_STORE_INFO,
      DEFAULT_COL_KPIS,
      DEFAULT_COL_MANAGERS,
      DEFAULT_COL_CREW_UOP,
      DEFAULT_COL_CREW_UZ,
      DEFAULT_COL_OTHER_COSTS
    );

    assert.equal(res.colPlanPct, 0, 'colPlanPct must be 0 for zero sales target');
    assert.equal(res.colEstPct, 0, 'colEstPct must be 0 for zero sales est');
    assert.equal(res.tplhTotalPlan, 0, 'tplhTotalPlan must be 0 when hours are 0');
    assert.equal(Number.isFinite(res.whatIfColSavings), true, 'whatIfColSavings must be finite');
    assert.equal(Number.isFinite(res.whatIfColPctInfluence), true, 'whatIfColPctInfluence must be finite');
  });

  await t.test('test_b19_col_calculator_empty_crew_zero_division_vulnerability', () => {
    // Managers have hours (e.g. 160h after schedule creation / sync), but crew arrays are empty
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
        storeCostRatio: 1
      }
    ];

    const kpis = {
      ...DEFAULT_COL_KPIS,
      salesTarget: 100000,
      trxTarget: 5000,
      tplhTarget: 6.6,
      whatIfTplhImprovement: 7.0
    };

    const res = ColEngine.calculate(
      DEFAULT_COL_STORE_INFO,
      kpis,
      managersWithHours,
      DEFAULT_COL_CREW_UOP, // empty array []
      DEFAULT_COL_CREW_UZ,  // empty array []
      DEFAULT_COL_OTHER_COSTS
    );

    // Adversarial verification: whatIfColSavings must NOT be NaN or Infinity
    const isFiniteSavings = Number.isFinite(res.whatIfColSavings) && !Number.isNaN(res.whatIfColSavings);
    const isFinitePct = Number.isFinite(res.whatIfColPctInfluence) && !Number.isNaN(res.whatIfColPctInfluence);

    assert.ok(
      isFiniteSavings,
      `VULNERABILITY DETECTED: ColEngine produced non-finite whatIfColSavings: ${res.whatIfColSavings} (colEngine.ts:302 zero-division on crewHoursPlan=0)`
    );
    assert.ok(
      isFinitePct,
      `VULNERABILITY DETECTED: ColEngine produced non-finite whatIfColPctInfluence: ${res.whatIfColPctInfluence}`
    );
  });

  await t.test('test_b19_col_bonus_sheet_no_hardcoded_financial_defaults', () => {
    // Read ColBonusSheet.tsx and assert absence of mock financial numbers
    const bonusSheetPath = path.resolve(process.cwd(), 'src/modules/col-calculator/components/ColBonusSheet.tsx');
    const source = fs.readFileSync(bonusSheetPath, 'utf8');

    const hasMockSalesAop = source.includes('useState<number>(310000)');
    const hasMockSalesActual = source.includes('useState<number>(315000)');
    const hasMockProfitAop = source.includes('useState<number>(45000)');
    const hasMockProfitActual = source.includes('useState<number>(47000)');

    assert.equal(
      hasMockSalesAop,
      false,
      'ColBonusSheet.tsx contains hardcoded mock salesAop (310000 PLN) instead of 0 or dynamic AOP'
    );
    assert.equal(
      hasMockSalesActual,
      false,
      'ColBonusSheet.tsx contains hardcoded mock salesActual (315000 PLN) instead of 0 or dynamic AOP'
    );
    assert.equal(
      hasMockProfitAop,
      false,
      'ColBonusSheet.tsx contains hardcoded mock profitAop (45000 PLN) instead of 0 or dynamic AOP'
    );
    assert.equal(
      hasMockProfitActual,
      false,
      'ColBonusSheet.tsx contains hardcoded mock profitActual (47000 PLN) instead of 0 or dynamic AOP'
    );
  });
});
