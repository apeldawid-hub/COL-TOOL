/**
 * Starbucks Operations Suite — Test B13: Sensitive Payload Classification Boundaries
 *
 * Verifies edge-case classification & sanitization boundaries using genuine VaultService:
 * 1. Zero substring collisions: Ensures fields like 'col4', 'level4', 'corporate_id',
 *    'generate_timestamp', and 'operate_mode' do NOT trigger false-positive sensitive classifications.
 * 2. Case-insensitive & camelCase medical sick leave (L4) obfuscation on public schedules:
 *    Ensures 'shift_code: L4', 'shift_code: l4', 'shiftCode: L4', and 'ShiftCode: l4' are all obfuscated.
 * 3. Deep sensitivity scanning: Validates detection of nested sensitive fields without false positives on metadata.
 * 4. Checksum verification: Ensures unpackage fails closed when decrypted content checksum is tampered.
 * 5. Document size boundaries: Validates 1 MiB Firestore document size constraint enforcement.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { VaultService } from '../../../src/services/security/vaultService';
import type { FinancialVaultPayload } from '../../../src/services/security/vaultService';

test('B13: Sensitive Payload Classification Boundaries (Genuine Service)', async (t) => {
  const storeId = '108150';
  const unitCode = '18150';

  // 1. Substring Collision Elimination
  await t.test('test_b13_substring_collisions_in_classify_field_eliminated', () => {
    // Non-sensitive columns that must NOT trigger health vault routing
    const nonHealthColumns = ['col4', 'level4'];
    for (const col of nonHealthColumns) {
      const rule = VaultService.classifyField('settings', col);
      assert.notEqual(rule.targetVault, 'vault_health_gdpr', `Field ${col} must NOT be classified as vault_health_gdpr`);
      assert.equal(rule.requiresEncryption, false);
      assert.equal(rule.targetVault, 'telemetry');
    }

    // Non-sensitive columns that must NOT trigger personnel/salary vault routing
    const nonPersonnelColumns = ['corporate_id', 'generate_timestamp', 'operate_mode'];
    for (const col of nonPersonnelColumns) {
      const rule = VaultService.classifyField('metadata', col);
      assert.notEqual(rule.targetVault, 'vault_personnel', `Field ${col} must NOT be classified as vault_personnel`);
      assert.equal(rule.requiresEncryption, false);
      assert.equal(rule.targetVault, 'telemetry');
    }

    // Genuine sensitive compensation columns
    const compColumns = ['rate_pln', 'hourly_rate', 'hourlyrate', 'monthly_salary', 'salary', 'payroll'];
    for (const col of compColumns) {
      const rule = VaultService.classifyField('payroll', col);
      assert.equal(rule.targetVault, 'vault_personnel');
      assert.equal(rule.requiresEncryption, true);
    }

    // Genuine sensitive health/GDPR columns
    const healthColumns = ['medical_l4', 'shift_l4', 'l4', 'l4_absence', 'sick_leave'];
    for (const col of healthColumns) {
      const rule = VaultService.classifyField('shifts', col);
      assert.equal(rule.targetVault, 'vault_health_gdpr');
      assert.equal(rule.requiresEncryption, true);
    }
  });

  // 2. Medical Leave Leak Prevention Across Casing and Naming Conventions
  await t.test('test_b13_medical_leave_leak_prevention_across_casing_and_naming', () => {
    // Variations of shift code key and L4 value
    const testCases = [
      { shift_code: 'L4' },
      { shift_code: 'l4' },
      { shiftCode: 'L4' },
      { shiftCode: 'l4' },
      { ShiftCode: 'l4' },
      { SHIFT_CODE: 'l4' },
    ];

    for (const tc of testCases) {
      const sanitized = VaultService.sanitizeForPublicSchedule(tc);
      const shiftKey = Object.keys(tc)[0];
      assert.equal(
        sanitized[shiftKey],
        'ABSENCE',
        `Failed to obfuscate medical sick leave for key=${shiftKey}, value=${(tc as any)[shiftKey]}`
      );
    }

    // Non-medical shifts must remain intact
    const normalShifts = [
      { shift_code: 'AM' },
      { shiftCode: 'PM' },
      { shift_code: 'SUP' },
      { shift_code: 'MIB' },
    ];
    for (const ns of normalShifts) {
      const sanitized = VaultService.sanitizeForPublicSchedule(ns);
      const shiftKey = Object.keys(ns)[0];
      assert.equal(sanitized[shiftKey], (ns as any)[shiftKey]);
    }

    // Sensitive compensation & notes fields stripped completely
    const mixedRecord = {
      id: 'shift_123',
      partnerName: 'Barista 1',
      startTime: '06:30',
      hourlyRate: 35.0,
      salary: 6000,
      iban: 'PL998877',
      medicalL4: true,
      notes: 'Doctor medical note',
      shift_code: 'L4',
    };
    const sanitizedMixed = VaultService.sanitizeForPublicSchedule(mixedRecord);
    assert.equal(sanitizedMixed.id, 'shift_123');
    assert.equal(sanitizedMixed.partnerName, 'Barista 1');
    assert.equal(sanitizedMixed.startTime, '06:30');
    assert.equal(sanitizedMixed.shift_code, 'ABSENCE');
    assert.equal(sanitizedMixed.hourlyRate, undefined);
    assert.equal(sanitizedMixed.salary, undefined);
    assert.equal(sanitizedMixed.iban, undefined);
    assert.equal(sanitizedMixed.medicalL4, undefined);
    assert.equal(sanitizedMixed.notes, undefined);
  });

  // 3. Deep Sensitivity Scanning and False-Positive Resistance
  await t.test('test_b13_contains_sensitive_fields_deep_scan_and_false_positive_resistance', () => {
    // Nested sensitive object (level 4)
    const nestedSensitive = {
      level1: {
        level2: {
          level3: {
            privateSalary: 5000,
          },
        },
      },
    };
    assert.equal(VaultService.containsSensitiveFields(nestedSensitive), true);

    // Deep health data (level 3)
    const nestedHealth = {
      roster: {
        partner_1: {
          medical_l4: true,
        },
      },
    };
    assert.equal(VaultService.containsSensitiveFields(nestedHealth), true);

    // Non-sensitive operational payload with edge-case names must NOT trigger false positive
    const operationalData = {
      storeId: '108150',
      col4: 'display_mode',
      level4: 'zoom_level',
      corporate_id: 'corp_starbucks_poland',
      operate_mode: 'standalone',
      shifts: [
        { code: 'AM', hours: 8 },
        { code: 'PM', hours: 8 },
      ],
    };
    assert.equal(VaultService.containsSensitiveFields(operationalData), false);

    // Null and primitive handling
    assert.equal(VaultService.containsSensitiveFields(null), false);
    assert.equal(VaultService.containsSensitiveFields(undefined), false);
    assert.equal(VaultService.containsSensitiveFields('test string'), false);
    assert.equal(VaultService.containsSensitiveFields({}), false);
  });

  // 4. Checksum Mismatch Detection
  await t.test('test_b13_checksum_mismatch_fails_closed_in_unpackage', async () => {
    const payload: FinancialVaultPayload = {
      period: 'month_2026_03',
      aopPlans: [{
        key: 'k1', year: 2026, month: '03', month_code: '03',
        plan_trx: 100, target_tplh: 10, labor_budget: 100, avg_weekly_hours: 40,
        plan_sales: 1000, actual_sales: null, actual_trx: null, actual_tplh: null,
        plan_agc: null, actual_agc: null, plan_col_pln: null, plan_col_percent: null,
        plan_cos_pln: null, plan_cos_percent: null, plan_ops_profit: null,
      }],
    };

    const pkg = await VaultService.packageFinancialVault(storeId, unitCode, 'month_2026_03', payload, 'sm_audit');
    assert.equal(pkg.success, true);

    // Clean unpackage succeeds with verified checksum
    const cleanUnpkg = await VaultService.unpackageFinancialVault(pkg.doc, storeId, unitCode);
    assert.equal(cleanUnpkg.metrics.checksumVerified, true);

    // Mutate checksum header (simulating data corruption or tampering)
    const corruptedDoc = {
      ...pkg.doc,
      checksum: '0000000000000000000000000000000000000000000000000000000000000000',
    };

    // When checksum verification fails, unpackageGenericVault fails closed
    const corruptedResult = await VaultService.unpackageFinancialVault(corruptedDoc, storeId, unitCode).catch((err) => ({
      success: false,
      error: err.message,
    }));
    assert.equal(
      corruptedResult.success === false || (corruptedResult as any).metrics?.checksumVerified === false,
      true,
      'Checksum mismatch must be detected and fail verification'
    );
  });

  // 5. Firestore 1 MiB Document Size Boundary
  await t.test('test_b13_payload_near_and_exceeding_1_mib_boundary', async () => {
    // 1. Payload near 1 MiB boundary (400 KB string payload) succeeds
    const mediumArray = Array.from({ length: 1500 }, (_, i) => ({
      key: `item_${i}`,
      description: 'AOP plan record benchmark string with multiple parameters',
      val1: 12345.67,
      val2: 98765.43,
    }));
    const nearBoundaryPayload: FinancialVaultPayload = {
      period: 'month_2026_03',
      aopPlans: mediumArray as any,
    };

    const pkg = await VaultService.packageFinancialVault(storeId, unitCode, 'month_2026_03', nearBoundaryPayload, 'sm_audit');
    assert.equal(pkg.success, true);

    // 2. Payload exceeding 1 MiB throws guardrail error
    const hugeArray = Array.from({ length: 12000 }, (_, i) => ({
      key: `huge_item_${i}`,
      description: 'Massive string payload designed to exceed 1 MiB Firestore document limit',
      buffer: '0123456789abcdef'.repeat(16),
    }));
    const oversizedPayload: FinancialVaultPayload = {
      period: 'month_2026_03',
      aopPlans: hugeArray as any,
    };

    await assert.rejects(
      async () => VaultService.packageFinancialVault(storeId, unitCode, 'month_2026_03', oversizedPayload, 'sm_audit'),
      /Vault packaging exceeded Firestore maximum document size \(1 MiB\)/
    );
  });
});
