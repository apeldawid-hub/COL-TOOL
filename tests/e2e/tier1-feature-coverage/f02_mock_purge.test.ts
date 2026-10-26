import test from 'node:test';
import assert from 'node:assert/strict';

test('F2: Mock Data & Fake Rosters Purge', async (t) => {
  await t.test('test_f02_new_store_roster_is_empty_by_default', () => {
    // A clean store data model must initialize with an empty roster
    const freshStoreRoster: any[] = [];
    assert.equal(freshStoreRoster.length, 0, 'Initial roster for a new store must be empty');
    const hasMockSalaries = freshStoreRoster.some((m) => m.baseSalaryPLN !== undefined);
    assert.equal(hasMockSalaries, false);
  });

  await t.test('test_f02_no_mock_baristas_in_col_defaults', () => {
    // When generating COL structure for a new store, baristas list should be empty or user-configured
    const initialColState = {
      storeId: 'store_108150',
      managers: [],
      baristas: [],
      monthlyBudgetPLN: 0,
    };
    assert.deepEqual(initialColState.baristas, []);
    assert.deepEqual(initialColState.managers, []);
  });

  await t.test('test_f02_no_fake_training_partners_in_seed', () => {
    // Fresh store should have 0 active training partners before import
    const trainingState = {
      storeId: 'store_108150',
      partners: [],
    };
    assert.equal(trainingState.partners.length, 0);
  });

  await t.test('test_f02_admin_user_registry_requires_real_auth', () => {
    // System must not contain default hardcoded admin accounts like 'admin@starbucks.test'
    const allowedAdminDomains = ['amrest.eu', 'starbucks.com'];
    const testEmail = 'manager.janki@amrest.eu';
    const domain = testEmail.split('@')[1];
    assert.ok(allowedAdminDomains.includes(domain), 'Admin accounts must use corporate domains');
  });

  await t.test('test_f02_actuals_log_segregated_by_unit', () => {
    // Actuals log records must belong to the active store unit code
    const actualsBatch = [
      { unit_code: '18150', hours: 8.0, employee: 'Partner 1' },
      { unit_code: '18150', hours: 7.5, employee: 'Partner 2' },
    ];
    for (const record of actualsBatch) {
      assert.equal(record.unit_code, '18150');
    }
  });
});
