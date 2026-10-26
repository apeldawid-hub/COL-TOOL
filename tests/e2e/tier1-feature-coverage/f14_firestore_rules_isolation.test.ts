import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFirestoreRules } from '../helpers/firestoreRulesSpec';

test('F14: Hardened Firestore Security Rules', async (t) => {
  const analysis = analyzeFirestoreRules();

  await t.test('test_f14_rules_enforce_tenant_store_id_isolation', () => {
    assert.equal(analysis.hasStoreTenantIsolation, true, 'Rules must enforce /stores/{storeId} tenant boundary');
  });

  await t.test('test_f14_executive_vault_denies_baristas_and_supervisors', () => {
    assert.equal(analysis.executiveFinancialVaultIsolated, true, 'Executive financial vault must require isExecutive(storeId)');
  });

  await t.test('test_f14_public_schedule_readable_by_all_store_staff', () => {
    assert.ok(analysis.rawRules.includes('match /public_schedule/{docId}'));
    assert.ok(analysis.rawRules.includes('isStoreStaff(storeId)'));
  });

  await t.test('test_f14_immutable_fields_cannot_be_overwritten', () => {
    assert.ok(analysis.rawRules.includes("areImmutableFieldsUnchanged(['userId'])"));
    assert.ok(analysis.rawRules.includes("areImmutableFieldsUnchanged(['docId', 'vaultType', 'period'])"));
  });

  await t.test('test_f14_no_collection_group_wildcard_leak', () => {
    assert.equal(analysis.noWildcardCollectionGroupLeak, true, 'No wildcard collectionGroup match on sensitive vaults');
  });
});
