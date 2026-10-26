/**
 * Starbucks Operations Suite — Feature F13: Sensitive Payload Classification & Vault Packaging
 *
 * Verifies genuine VaultService:
 * 1. Field-level data classification across financial, personnel, health (GDPR Art. 9), and public routing.
 * 2. Full end-to-end cryptographic vault packaging and unpackaging for all 4 vault collections:
 *    - vault_financials: AOP targets, sales, COL %, ops profit, KPI logs
 *    - vault_personnel: manager salaries, crew hourly rates, contracts
 *    - vault_schedules: manager schedules, shift codes, versions
 *    - vault_health_gdpr: L4 medical sick leaves, disability accommodations, sanepid clearances
 * 3. AEAD context binding and tamper rejection on mismatched storeId, vaultType, and docId.
 * 4. Public schedule sanitization: stripping sensitive compensation fields and obfuscating medical sick leave L4.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { VaultService } from '../../../src/services/security/vaultService';
import type {
  FinancialVaultPayload,
  PersonnelVaultPayload,
  ScheduleVaultPayload,
  HealthGdprVaultPayload,
} from '../../../src/services/security/vaultService';

test('F13: Sensitive Payload Classification & Vault Packaging (Genuine Service)', async (t) => {
  const storeId = '108150'; // Starbucks Wrocław Dworzec Główny PKP
  const unitCode = '18150';

  // 1. Classification: Financial P&L
  await t.test('test_f13_financial_pl_classified_as_sensitive', () => {
    const financialFields = ['sales_net', 'col_pln', 'plan_ops_profit', 'revenue', 'agc', 'budget'];
    for (const field of financialFields) {
      const rule = VaultService.classifyField('kpi', field);
      assert.equal(rule.tier, 'TIER_1_FINANCIAL', `Field ${field} must be TIER_1_FINANCIAL`);
      assert.equal(rule.requiresEncryption, true);
      assert.equal(rule.targetVault, 'vault_financials');
    }
  });

  // 2. Classification: Personnel & Compensation
  await t.test('test_f13_employee_salaries_classified_as_sensitive', () => {
    const personnelFields = ['monthly_salary', 'hourly_rate', 'payroll', 'iban', 'bonus'];
    for (const field of personnelFields) {
      const rule = VaultService.classifyField('employees', field);
      assert.equal(rule.tier, 'TIER_2_HR_GDPR', `Field ${field} must be TIER_2_HR_GDPR`);
      assert.equal(rule.requiresEncryption, true);
      assert.equal(rule.targetVault, 'vault_personnel');
    }
  });

  // 3. Classification: GDPR Art. 9 Special Category Health Data
  await t.test('test_f13_gdpr_art9_health_data_classified_as_sensitive', () => {
    const healthFields = ['medical_l4', 'sick', 'disability', 'diagnosis', 'sanepid'];
    for (const field of healthFields) {
      const rule = VaultService.classifyField('shifts', field);
      assert.equal(rule.tier, 'TIER_2_HR_GDPR', `Field ${field} must be TIER_2_HR_GDPR`);
      assert.equal(rule.requiresEncryption, true);
      assert.equal(rule.targetVault, 'vault_health_gdpr');
    }
  });

  // 4. Classification: Public Schedule & Operational Routing
  await t.test('test_f13_public_schedule_and_routing_remains_unencrypted', () => {
    const publicFields = ['shift_code', 'store_name', 'calendar_week', 'topology'];
    for (const field of publicFields) {
      const rule = VaultService.classifyField('schedule', field);
      assert.equal(rule.tier, 'TIER_3_PUBLIC_ROUTING', `Field ${field} must be TIER_3_PUBLIC_ROUTING`);
      assert.equal(rule.requiresEncryption, false);
      assert.equal(rule.targetVault, 'telemetry');
    }
  });

  // 5. Genuine Packaging & Unpackaging: Financial Vault
  await t.test('test_f13_financial_vault_end_to_end_packaging_and_unpackaging', async () => {
    const payload: FinancialVaultPayload = {
      period: 'month_2026_03',
      aopPlans: [
        {
          key: 'aop_2026_03',
          year: 2026,
          month: 'Marzec',
          month_code: '03',
          plan_trx: 25000,
          target_tplh: 9.85,
          labor_budget: 2500,
          avg_weekly_hours: 560,
          plan_sales: 789000,
          actual_sales: 812000,
          actual_trx: 26000,
          actual_tplh: 10.1,
          plan_agc: 31.56,
          actual_agc: 31.23,
          plan_col_pln: 145000,
          plan_col_percent: 18.37,
          plan_cos_pln: 215000,
          plan_cos_percent: 27.24,
          plan_ops_profit: 45000,
        },
      ],
      dailyKpiLogs: [
        {
          date: '2026-03-01',
          sales_net: 28500,
          trx: 920,
          agc: 30.97,
          hours: 91.5,
          tplh: 10.05,
          delivery_trx: 45,
        },
      ],
      colSummary: {
        totalLaborCostPLN: 145000,
        totalZusCostPLN: 28246,
        status: 'TARGET_MET',
      },
    };

    const pkg = await VaultService.packageFinancialVault(storeId, unitCode, 'month_2026_03', payload, 'sm_audit');
    assert.equal(pkg.success, true);
    assert.equal(pkg.doc.storeId, storeId);
    assert.equal(pkg.doc.vaultType, 'vault_financials');
    assert.equal(pkg.doc.docId, 'month_2026_03');
    assert.ok(typeof pkg.doc.encryptedPayload === 'string');
    assert.ok((pkg.doc.encryptedPayload as string).startsWith('enc:v1:108150:k1:'));
    assert.equal(pkg.doc.checksum.length, 64);

    const unpkg = await VaultService.unpackageFinancialVault(pkg.doc, storeId, unitCode);
    assert.equal(unpkg.success, true);
    assert.equal(unpkg.metrics.checksumVerified, true);
    assert.deepEqual(unpkg.payload, payload);
  });

  // 6. Genuine Packaging & Unpackaging: Personnel Vault
  await t.test('test_f13_personnel_vault_end_to_end_packaging_and_unpackaging', async () => {
    const payload: PersonnelVaultPayload = {
      staffGroup: 'active_roster',
      managers: [
        {
          id: 1,
          name: 'Jan Kowalski',
          role: 'STORE_MANAGER',
          contract_type: 'UoP',
          contract_hours_ratio: 1.0,
          hourly_rate: 65.0,
          monthly_salary: 11000,
          sort_order: 1,
          is_active: 1,
        },
      ],
      crewUop: [
        {
          id: 'uop_1',
          name: 'Anna Nowak',
          position: 'BARISTA',
          contractRatio: 0.75,
          hourlyRate: 32.5,
          planWorkHours: 126,
          isDisability: false,
        },
      ],
      crewUz: [
        {
          id: 'uz_1',
          name: 'Piotr Wiśniewski',
          position: 'BARISTA',
          hourlyRate: 31.0,
          planWorkHours: 80,
          bonus: 450,
        },
      ],
    };

    const pkg = await VaultService.packagePersonnelVault(storeId, unitCode, 'active_roster', 'roster_2026_03', payload, 'sm_audit');
    assert.equal(pkg.success, true);
    assert.equal(pkg.doc.vaultType, 'vault_personnel');

    const unpkg = await VaultService.unpackagePersonnelVault(pkg.doc, storeId, unitCode);
    assert.equal(unpkg.success, true);
    assert.equal(unpkg.metrics.checksumVerified, true);
    assert.deepEqual(unpkg.payload, payload);
  });

  // 7. Genuine Packaging & Unpackaging: Schedule Vault
  await t.test('test_f13_schedule_vault_end_to_end_packaging_and_unpackaging', async () => {
    const payload: ScheduleVaultPayload = {
      weekKey: 'week_2026_W12',
      shifts: [
        {
          year: 2026,
          month: 3,
          day: 16,
          date: '2026-03-16',
          employee_id: 1,
          shift_code: 'AM',
          hours: 8,
          custom_start_time: '06:30',
          custom_end_time: '15:00',
        },
      ],
    };

    const pkg = await VaultService.packageScheduleVault(storeId, unitCode, 'week_2026_W12', 'week_2026_W12', payload, 'sm_audit');
    assert.equal(pkg.success, true);
    assert.equal(pkg.doc.vaultType, 'vault_schedules');

    const unpkg = await VaultService.unpackageScheduleVault(pkg.doc, storeId, unitCode);
    assert.equal(unpkg.success, true);
    assert.equal(unpkg.metrics.checksumVerified, true);
    assert.deepEqual(unpkg.payload, payload);
  });

  // 8. Genuine Packaging & Unpackaging: Health & GDPR Art. 9 Vault
  await t.test('test_f13_health_gdpr_vault_end_to_end_packaging_and_unpackaging', async () => {
    const payload: HealthGdprVaultPayload = {
      period: 'period_2026_Q1',
      l4MedicalAbsences: [
        {
          employeeId: 1,
          employeeName: 'Anna Nowak',
          date: '2026-03-10',
          shiftCode: 'L4',
          hours: 8,
          notes: 'Zwolnienie lekarskie ZUS e-ZLA',
        },
      ],
    };

    const pkg = await VaultService.packageHealthGdprVault(storeId, unitCode, 'period_2026_Q1', 'l4_2026_Q1', payload, 'sm_audit');
    assert.equal(pkg.success, true);
    assert.equal(pkg.doc.vaultType, 'vault_health_gdpr');

    const unpkg = await VaultService.unpackageHealthGdprVault(pkg.doc, storeId, unitCode);
    assert.equal(unpkg.success, true);
    assert.equal(unpkg.metrics.checksumVerified, true);
    assert.deepEqual(unpkg.payload, payload);
  });

  // 9. AEAD Context Binding: Tamper Rejection
  await t.test('test_f13_vault_packaging_binds_aad_metadata_and_rejects_tampering', async () => {
    const payload: FinancialVaultPayload = { period: 'month_2026_03' };
    const pkg = await VaultService.packageFinancialVault(storeId, unitCode, 'month_2026_03', payload, 'sm_audit');

    // Mismatched storeId during unpackage
    await assert.rejects(
      async () => VaultService.unpackageFinancialVault(pkg.doc, '108120', '18120'),
      /Tenant storeId mismatch/
    );

    // Tampered docId header violates AAD context during AES-256-GCM decryption
    const tamperedDocId = { ...pkg.doc, docId: 'month_2026_04' };
    await assert.rejects(
      async () => VaultService.unpackageFinancialVault(tamperedDocId, storeId, unitCode),
      /Unsupported state or unable to authenticate data/
    );

    // Mismatched vaultType
    await assert.rejects(
      async () => VaultService.unpackagePersonnelVault(pkg.doc, storeId, unitCode),
      /VaultType mismatch/
    );
  });

  // 10. Sanitization: Public Schedule Security Guardrail
  await t.test('test_f13_public_schedule_sanitization_removes_compensation_and_obfuscates_l4', () => {
    const record = {
      id: 101,
      name: 'Jan Kowalski',
      shift_code: 'L4',
      hourly_rate: 35.5,
      hourlyRate: 35.5,
      monthly_salary: 8000,
      iban: 'PL1234567890',
      notes: 'Zwolnienie lekarskie',
      hours: 8,
    };

    const sanitized = VaultService.sanitizeForPublicSchedule(record);
    assert.equal(sanitized.id, 101);
    assert.equal(sanitized.name, 'Jan Kowalski');
    assert.equal(sanitized.hours, 8);
    assert.equal(sanitized.shift_code, 'ABSENCE');
    assert.equal(sanitized.hourly_rate, undefined);
    assert.equal(sanitized.hourlyRate, undefined);
    assert.equal(sanitized.monthly_salary, undefined);
    assert.equal(sanitized.iban, undefined);
    assert.equal(sanitized.notes, undefined);
  });
});
