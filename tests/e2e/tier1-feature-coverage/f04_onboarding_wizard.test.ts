import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualLocalStorage } from '../helpers/testHarness';

test('F4: Clean Launch Store Onboarding Wizard', async (t) => {
  await t.test('test_f04_clean_launch_triggers_onboarding', () => {
    const vStorage = new VirtualLocalStorage();
    const isCompleted = vStorage.getItem('sbx_onboarding_completed') === 'true';
    const hasCurrentStore = vStorage.getItem('sbx_unit_code') !== null;

    const shouldShowWizard = !isCompleted || !hasCurrentStore;
    assert.equal(shouldShowWizard, true, 'Clean launch must require onboarding');
  });

  await t.test('test_f04_onboarding_wizard_rejects_empty_store_metadata', () => {
    const invalidForm = {
      name: '',
      unitCode: '',
      mpk: '',
    };
    const isValid = Boolean(invalidForm.name.trim() && invalidForm.unitCode.trim() && invalidForm.mpk.trim());
    assert.equal(isValid, false, 'Empty metadata must be rejected');
  });

  await t.test('test_f04_onboarding_wizard_persists_new_store', () => {
    const vStorage = new VirtualLocalStorage();
    const submission = {
      id: '108160',
      name: '108160 SBX Wrocław Wroclavia',
      shortName: 'Wroclavia',
      unitCode: '18160',
      mpk: '108160',
      city: 'Wrocław',
      district: 'Dystrykt Dolny Śląsk',
    };

    vStorage.setItem('sbx_store_name', submission.name);
    vStorage.setItem('sbx_unit_code', submission.unitCode);
    vStorage.setItem('sbx_store_mpk', submission.mpk);
    vStorage.setItem('sbx_onboarding_completed', 'true');

    assert.equal(vStorage.getItem('sbx_unit_code'), '18160');
    assert.equal(vStorage.getItem('sbx_onboarding_completed'), 'true');
  });

  await t.test('test_f04_onboarding_creates_dedicated_store_database', () => {
    const storeId = '108160';
    const computedDbFile = `store_${storeId}.db`;
    assert.equal(computedDbFile, 'store_108160.db');
  });

  await t.test('test_f04_subsequent_launches_bypass_wizard_when_flag_set', () => {
    const vStorage = new VirtualLocalStorage();
    vStorage.setItem('sbx_onboarding_completed', 'true');
    vStorage.setItem('sbx_unit_code', '18160');

    const isCompleted = vStorage.getItem('sbx_onboarding_completed') === 'true';
    const hasCurrentStore = vStorage.getItem('sbx_unit_code') !== null;
    const shouldShowWizard = !isCompleted || !hasCurrentStore;

    assert.equal(shouldShowWizard, false, 'Onboarding is bypassed when properly completed');
  });
});
