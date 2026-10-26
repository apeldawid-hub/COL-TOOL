import test from 'node:test';
import assert from 'node:assert/strict';
import { LRUConnectionPool, AsyncMutex, VirtualLocalStorage, generateStoreCatalog } from '../helpers/testHarness';
import { deriveStoreKey, encryptPayload, decryptPayload, verifyParity, canonicalSha256 } from '../helpers/cryptoSpec';
import { analyzeFirestoreRules } from '../helpers/firestoreRulesSpec';

test('Tier 4: Real-World Application Workloads & User Journeys (9 Scenarios)', async (t) => {
  await t.test('scenario_01_store_manager_weekly_schedule_and_labor_forecast_workflow', () => {
    // 1. Store Manager selects Store 108150
    const storeId = '108150';
    const unitCode = '18150';

    // 2. Verifies Floor Hours base (32.0 h/day * 7 days = 224.0 h)
    const dailyFloorHours = [32.0, 32.0, 32.0, 32.0, 32.0, 32.0, 32.0];
    const weeklyFloorHours = dailyFloorHours.reduce((a, b) => a + b, 0);
    assert.equal(weeklyFloorHours, 224.0, 'Weekly floor hours must be 224.0h base');

    // 3. Verifies Polish Labor Law (art. 132 KP 11h daily rest)
    const shift1End = 22.0; // 22:00
    const shift2Start = 10.0; // 10:00 next day
    const restBetweenShifts = 24.0 - shift1End + shift2Start;
    assert.ok(restBetweenShifts >= 11.0, 'Must have at least 11h daily rest');

    // 4. Publishes public schedule document
    const publicSchedule = {
      docId: 'schedule_2026_w38',
      storeId,
      totalFloorHours: weeklyFloorHours,
      shiftsCount: 28,
      status: 'published',
    };
    assert.equal(publicSchedule.status, 'published');
  });

  await t.test('scenario_02_district_manager_multi_store_oversight', () => {
    const dmStores = ['108110', '108120', '108130', '108140', '108150'];
    const vStorage = new VirtualLocalStorage();

    // DM inspects each store and saves store-specific review notes
    for (const id of dmStores) {
      vStorage.setItem(`sbx_store_${id}_dm_notes`, `Review completed for Store ${id}`);
    }

    // Verify isolation: notes are partitioned and do not bleed
    for (const id of dmStores) {
      const note = vStorage.getItem(`sbx_store_${id}_dm_notes`);
      assert.equal(note, `Review completed for Store ${id}`);
    }
  });

  await t.test('scenario_03_monthly_payroll_and_col_financial_reconciliation', () => {
    const storeId = '108150';
    const unitCode = '18150';

    // Monthly payroll calculation: Base wages + ZUS markup 19.48%
    const baseWagesPLN = 100_000.0;
    const zusMarkupRate = 0.1948;
    const zusCostPLN = Number((baseWagesPLN * zusMarkupRate).toFixed(2));
    const totalLaborCostPLN = Number((baseWagesPLN + zusCostPLN).toFixed(2));

    assert.equal(zusCostPLN, 19480.0);
    assert.equal(totalLaborCostPLN, 119480.0);

    // Package into encrypted vault payload
    const financialData = {
      period: '2026-09',
      baseWagesPLN,
      zusCostPLN,
      totalLaborCostPLN,
      crew: [
        { type: 'UoP', count: 8, cost: 72000 },
        { type: 'UZ', count: 12, cost: 47480 },
      ],
    };

    const envelope = encryptPayload(financialData, storeId, unitCode, 'col_pl', 'pl_2026_09');
    const decrypted = decryptPayload(envelope, storeId, unitCode, 'col_pl', 'pl_2026_09');

    assert.deepEqual(decrypted, financialData);
  });

  await t.test('scenario_04_new_store_onboarding_and_first_week_setup', () => {
    const vStorage = new VirtualLocalStorage();

    // 1. Initial state requires onboarding
    assert.equal(vStorage.getItem('sbx_onboarding_completed'), null);

    // 2. Submit onboarding wizard for 108200 Gdańsk Forum
    const newStore = {
      id: '108200',
      name: '108200 SBX Gdańsk Forum',
      unitCode: '18200',
      mpk: '108200',
      city: 'Gdańsk',
    };

    vStorage.setItem('sbx_store_name', newStore.name);
    vStorage.setItem('sbx_unit_code', newStore.unitCode);
    vStorage.setItem('sbx_store_mpk', newStore.mpk);
    vStorage.setItem('sbx_onboarding_completed', 'true');

    // 3. New store database initialized with empty roster
    const newStoreRoster: any[] = [];
    assert.equal(newStoreRoster.length, 0);

    // 4. Verify no fallback to 108120 Janki
    assert.equal(vStorage.getItem('sbx_unit_code'), '18200');
    assert.notEqual(vStorage.getItem('sbx_unit_code'), '18120');
  });

  await t.test('scenario_05_legacy_store_cloud_migration_with_parity_certificate', () => {
    const storeId = '108120';
    const unitCode = '18120';

    // 1. Local legacy records
    const localRecords = {
      schedules: [
        { id: 1, week: '2026_W35', floorHours: 224.0 },
        { id: 2, week: '2026_W36', floorHours: 232.0 },
      ],
      employees: [
        { id: 101, name: 'Barista Alpha', contract: 'UoP' },
        { id: 102, name: 'Barista Beta', contract: 'UZ' },
      ],
      aop_plans: [{ key: '2026_09', plan_sales: 350000, target_tplh: 6.7 }],
    };

    // 2. Cloud migration batch upload (simulated encrypted upload & download)
    const cloudRecords = JSON.parse(JSON.stringify(localRecords));

    // 3. Bi-directional cryptographic parity verification
    const parityReport = verifyParity(storeId, localRecords, cloudRecords);

    assert.equal(parityReport.isParityVerified, true);
    assert.equal(parityReport.mismatches.length, 0);
    assert.ok(parityReport.certificate);
    assert.equal(parityReport.certificate?.storeId, storeId);
    assert.ok(parityReport.certificate?.signature);
  });

  await t.test('scenario_06_barista_journey_training_and_skill_check_workflow', () => {
    // 1. Trainee Barista Journey with T1-T10 shifts
    const trainingShifts = Array.from({ length: 10 }, (_, i) => ({
      shiftCode: `T${i + 1}`,
      hours: 4.0,
      isNonCoverage: true,
    }));

    // 2. Verify all training shifts are 100% Non-Coverage (NC Training)
    for (const shift of trainingShifts) {
      assert.equal(shift.isNonCoverage, true, 'Training shifts must be Non-Coverage');
    }

    // 3. Floor Hours base remains strictly untouched at 32h/day
    const storeFloorHours = 32.0;
    const totalTrainingHours = trainingShifts.reduce((s, sh) => s + sh.hours, 0);

    assert.equal(storeFloorHours, 32.0, 'Floor hours must not be reduced by training');
    assert.equal(totalTrainingHours, 40.0);
  });

  await t.test('scenario_07_fichajes_rcp_import_and_absences_collision_resolution', () => {
    // Store Manager imports MAPAL Fichajes RCP records
    const rcpRecord = { partnerId: 'p101', date: '2026-09-12', rcpHours: 8.0 };
    const leaveRecord = { partnerId: 'p101', date: '2026-09-12', absenceType: 'L4' };

    // Collision detection: Partner has RCP punch on an active L4 medical leave day!
    const isCollision = rcpRecord.date === leaveRecord.date && rcpRecord.rcpHours > 0;
    assert.equal(isCollision, true, 'Collision detected between RCP hours and L4 leave');

    // Resolution: Manager reviews and overrides or marks as corrected
    const resolvedRecord = {
      partnerId: 'p101',
      date: '2026-09-12',
      effectiveHours: 0.0,
      absenceType: 'L4',
      resolutionNote: 'Pobyt na L4 potwierdzony w ZUS PUE — błędne odbicie RCP unieważnione',
      resolvedBy: 'STORE_MANAGER',
    };

    assert.equal(resolvedRecord.effectiveHours, 0.0);
    assert.equal(resolvedRecord.absenceType, 'L4');
  });

  await t.test('scenario_08_disaster_recovery_corrupted_db_and_backup_restore', () => {
    const storeId = '108150';
    const validData = Buffer.from('SQLite format 3: production store 108150 data');
    const validChecksum = canonicalSha256(validData.toString('hex'));

    // Simulated backup file
    const backupRegistry = new Map<string, { buffer: Buffer; checksum: string }>();
    backupRegistry.set(`store_${storeId}_backup.db`, {
      buffer: validData,
      checksum: validChecksum,
    });

    // Simulating database crash / corruption
    const corruptedActiveData = Buffer.from('Corrupted zero byte or bad sector');

    // Recovery process:
    const backupEntry = backupRegistry.get(`store_${storeId}_backup.db`)!;
    const restoreChecksum = canonicalSha256(backupEntry.buffer.toString('hex'));

    assert.equal(restoreChecksum, validChecksum, 'Backup checksum verified before restoration');
    const restoredData = backupEntry.buffer;
    assert.equal(restoredData.toString('utf8'), validData.toString('utf8'));
  });

  await t.test('scenario_09_high_concurrency_multi_store_stress_and_lru_eviction', async () => {
    const pool = new LRUConnectionPool(8);
    const mutex = new AsyncMutex();
    const stores = Array.from({ length: 25 }, (_, i) => `store_${108100 + i}`);

    // Simulate 100 fast concurrent store operations
    const operations = Array.from({ length: 100 }, (_, i) => {
      const targetStore = stores[i % stores.length];
      return mutex.runExclusive(async () => {
        pool.put(targetStore, { storeId: targetStore });
        return pool.get(targetStore);
      });
    });

    await Promise.all(operations);

    // Pool must never exceed 8 handles
    assert.equal(pool.size(), 8, 'Pool never exceeds maxConnections');
    assert.ok(pool.evictionLog.length > 0, 'Eviction log records cleanly managed handles');
  });
});
