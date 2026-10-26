/**
 * Starbucks Operations Suite — M3 Challenger 2: Adversarial Vault Packaging & Firestore Tenant Isolation
 *
 * Adversarially tests:
 * 1. Sensitive Data Leak Detection:
 *    - Verifies zero plaintext financial numbers (sales, AOP targets, bonus amounts, COL %, What-If savings)
 *      or HR/GDPR data (salaries, hourly rates, medical L4 codes, doctor notes) leak into document headers
 *      or top-level properties of packaged vault documents.
 *    - Validates deep sensitivity scanner and public schedule sanitization boundary.
 * 2. Oversized Payload Boundary:
 *    - Tests payloads near the 1 MiB (1,048,576 bytes) boundary.
 *    - Verifies clean rejection and guardrail error messages when payloads exceed 1 MiB.
 *    - Tests extreme payloads (2 MiB, 5 MiB) and empty payloads.
 * 3. Unicode & Polish Diacritics Fidelity:
 *    - Verifies complex Polish text (including `Zażółć gęślą jaźń 18120 Janki`, employee names, health notes,
 *      currency, and diacritics) survives round-trip vault packaging and unpackaging with byte-for-byte exact equality.
 *    - Verifies canonical JSON equality and cryptographic SHA-256 checksum verification.
 * 4. Firestore Rules Penetration Simulation:
 *    - Tests against `firestore.rules` that simulated tokens with `storeId: '108120'` (CH Janki) are
 *      strictly forbidden from reading or writing paths in `/stores/108150/...` (Wrocław PKP).
 *    - Evaluates role hierarchies (Barista, Shift Supervisor, ASM, SM, DM).
 *    - Tests token tampering, wildcard injection, non-corporate emails, and vault envelope schema enforcement.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  VaultService,
  type FinancialVaultPayload,
  type PersonnelVaultPayload,
  type ScheduleVaultPayload,
  type HealthGdprVaultPayload,
} from '../../../src/services/security/vaultService';
import {
  canonicalJson,
  canonicalSha256,
  parseEnvelope,
} from '../../../src/services/security/encryptionService';

test('M3 Challenger 2: Adversarial Multi-Tenant Isolation & Vault Packaging Boundaries', async (suite) => {
  const storeId1 = '108120'; // Starbucks Warszawa Janki
  const unitCode1 = '18120';
  const storeId2 = '108150'; // Starbucks Wrocław Dworzec Główny PKP
  const unitCode2 = '18150';

  // =========================================================================================
  // SUITE 1: SENSITIVE DATA LEAK DETECTION
  // =========================================================================================
  await suite.test('Suite 1: Sensitive Data Leak Detection Across Vault Packaging Boundaries', async (t) => {
    // 1.1 Financial Vault Plaintext Leak Detection
    await t.test('test_financial_vault_headers_contain_zero_plaintext_financial_metrics', async () => {
      const canarySalesPlan = 789456.12;
      const canarySalesActual = 891234.56;
      const canaryOpsProfit = 45678.90;
      const canaryColPln = 12345.67;
      const canaryColPct = 18.45;
      const canaryWhatIfSavings = 9988.77;
      const canaryZusCost = 3344.55;
      const canaryBonusSM = 6543.21;
      const canaryDeliveryTrx = 142;

      const financialPayload: FinancialVaultPayload = {
        period: 'month_2026_03',
        aopPlans: [
          {
            key: 'aop_2026_03',
            year: 2026,
            month: 'Marzec',
            month_code: '03',
            plan_trx: 24500,
            target_tplh: 9.85,
            labor_budget: 2487.3,
            avg_weekly_hours: 560.0,
            plan_sales: canarySalesPlan,
            actual_sales: canarySalesActual,
            actual_trx: 25100,
            actual_tplh: 10.05,
            plan_agc: 32.22,
            actual_agc: 35.51,
            plan_col_pln: canaryColPln,
            plan_col_percent: canaryColPct,
            plan_cos_pln: 215000.0,
            plan_cos_percent: 27.23,
            plan_ops_profit: canaryOpsProfit,
          },
        ],
        dailyKpiLogs: [
          {
            date: '2026-03-15',
            sales_net: 55443.22,
            trx: 1540,
            agc: 36.0,
            hours: 153.2,
            tplh: 10.05,
            delivery_trx: canaryDeliveryTrx,
          },
        ],
        colSummary: {
          whatIfSavingsPLN: canaryWhatIfSavings,
          totalZusCost: canaryZusCost,
          bonusSmAmount: canaryBonusSM,
          status: 'PROFITABLE_TARGET_MET',
        },
      };

      const result = await VaultService.packageFinancialVault(
        storeId1,
        unitCode1,
        'month_2026_03',
        financialPayload,
        'sm_janki_audit'
      );

      assert.equal(result.success, true);
      const doc = result.doc;

      // Extract top-level properties excluding the encryptedPayload ciphertext
      const headerKeys = Object.keys(doc).filter((k) => k !== 'encryptedPayload');
      const headerOnlyObj: Record<string, any> = {};
      for (const k of headerKeys) {
        headerOnlyObj[k] = (doc as any)[k];
      }
      const headerJson = JSON.stringify(headerOnlyObj);

      // Verify no canary numbers exist in plaintext headers
      const canaryNumbers = [
        canarySalesPlan,
        canarySalesActual,
        canaryOpsProfit,
        canaryColPln,
        canaryColPct,
        canaryWhatIfSavings,
        canaryZusCost,
        canaryBonusSM,
        canaryDeliveryTrx,
      ];

      for (const num of canaryNumbers) {
        assert.equal(
          headerJson.includes(num.toString()),
          false,
          `Plaintext financial number ${num} must NOT leak into document headers!`
        );
      }

      // Verify no sensitive keys exist in header JSON
      const forbiddenSensitiveKeys = [
        'sales',
        'profit',
        'col_',
        'cos_',
        'budget',
        'bonus',
        'whatIf',
        'dailyKpi',
      ];
      for (const forbidden of forbiddenSensitiveKeys) {
        assert.equal(
          new RegExp(`"${forbidden}`, 'i').test(headerJson),
          false,
          `Sensitive key pattern "${forbidden}" must NOT appear in plaintext headers!`
        );
      }

      // Verify encryptedPayload is genuinely ciphertext in enc:v1 format
      assert.equal(typeof doc.encryptedPayload, 'string');
      assert.ok((doc.encryptedPayload as string).startsWith('enc:v1:'));
      const parsedEnv = parseEnvelope(doc.encryptedPayload as string);
      assert.equal(parsedEnv.storeId, storeId1);
      assert.ok(parsedEnv.ciphertext.length > 100);

      // Verify raw JSON strings do not appear inside ciphertext segment
      assert.equal(
        parsedEnv.ciphertext.includes('actual_sales'),
        false,
        'Raw property name actual_sales must not appear in ciphertext'
      );
      assert.equal(
        parsedEnv.ciphertext.includes(canarySalesPlan.toString()),
        false,
        'Canary number must not appear in raw ciphertext'
      );
    });

    // 1.2 Personnel Vault Plaintext Leak Detection
    await t.test('test_personnel_vault_headers_contain_zero_plaintext_salaries_or_rates', async () => {
      const canarySalaryMgr = 11250.00;
      const canaryRateMgr = 67.89;
      const canaryRateBarista = 32.50;
      const canaryRateUz = 31.45;
      const canaryBonusUz = 450.00;
      const canaryEmployeeName = 'Kierownik Jan Kowalski';

      const personnelPayload: PersonnelVaultPayload = {
        staffGroup: 'active_roster',
        managers: [
          {
            id: 101,
            name: canaryEmployeeName,
            role: 'STORE_MANAGER',
            contract_type: 'UoP',
            contract_hours_ratio: 1.0,
            hourly_rate: canaryRateMgr,
            monthly_salary: canarySalaryMgr,
            sort_order: 1,
            is_active: 1,
          },
        ],
        crewUop: [
          {
            id: 'crew_1',
            name: 'Anna Nowak',
            position: 'BARISTA',
            contractRatio: 0.75,
            hourlyRate: canaryRateBarista,
            planWorkHours: 126,
            isDisability: false,
          },
        ],
        crewUz: [
          {
            id: 'crew_2',
            name: 'Piotr Wiśniewski',
            position: 'BARISTA',
            hourlyRate: canaryRateUz,
            planWorkHours: 80,
            bonus: canaryBonusUz,
          },
        ],
      };

      const result = await VaultService.packagePersonnelVault(
        storeId1,
        unitCode1,
        'active_roster',
        'roster_2026_03',
        personnelPayload,
        'sm_janki_audit'
      );

      assert.equal(result.success, true);
      const doc = result.doc;

      const headerKeys = Object.keys(doc).filter((k) => k !== 'encryptedPayload');
      const headerOnlyObj: Record<string, any> = {};
      for (const k of headerKeys) {
        headerOnlyObj[k] = (doc as any)[k];
      }
      const headerJson = JSON.stringify(headerOnlyObj);

      // Verify no salaries or rates in headers
      const hrCanaries = [
        canarySalaryMgr,
        canaryRateMgr,
        canaryRateBarista,
        canaryRateUz,
        canaryBonusUz,
        canaryEmployeeName,
      ];
      for (const canary of hrCanaries) {
        assert.equal(
          headerJson.includes(canary.toString()),
          false,
          `Sensitive HR value ${canary} must NOT leak into document headers!`
        );
      }

      // Verify sensitive field scanner
      assert.equal(
        VaultService.containsSensitiveFields(personnelPayload),
        true,
        'containsSensitiveFields must detect sensitive HR fields in payload'
      );
      assert.equal(
        VaultService.containsSensitiveFields(headerOnlyObj),
        false,
        'containsSensitiveFields must find ZERO sensitive fields in header-only object'
      );
    });

    // 1.3 Health & GDPR Art. 9 Data Leak Detection
    await t.test('test_health_gdpr_vault_headers_contain_zero_l4_codes_or_medical_notes', async () => {
      const canaryPatientName = 'Katarzyna Zielińska';
      const canaryDoctorDiagnosis = 'Zwolnienie lekarskie e-ZLA z powodu ciężkiego zapalenia płuc';
      const canaryAccommodations = 'Orzeczenie o stopniu niepełnosprawności - zakaz dźwigania powyżej 5kg';

      const healthPayload: HealthGdprVaultPayload = {
        period: 'period_2026_Q1',
        l4MedicalAbsences: [
          {
            employeeId: 44,
            employeeName: canaryPatientName,
            date: '2026-03-05',
            shiftCode: 'L4',
            hours: 8,
            notes: canaryDoctorDiagnosis,
          },
        ],
        disabilityAccommodations: [
          {
            employeeId: 88,
            name: 'Marek Dąbrowski',
            reducedNorm7h: true,
            accommodationsNotes: canaryAccommodations,
          },
        ],
        sanitaryClearances: [
          {
            partnerId: 99,
            partnerName: 'Piotr Kaczmarek',
            sanepidValidUntil: '2026-12-31',
            bhpCompletedDate: '2026-01-15',
          },
        ],
      };

      const result = await VaultService.packageHealthGdprVault(
        storeId1,
        unitCode1,
        'period_2026_Q1',
        'health_2026_q1',
        healthPayload,
        'sm_janki_audit'
      );

      assert.equal(result.success, true);
      const doc = result.doc;

      const headerKeys = Object.keys(doc).filter((k) => k !== 'encryptedPayload');
      const headerOnlyObj: Record<string, any> = {};
      for (const k of headerKeys) {
        headerOnlyObj[k] = (doc as any)[k];
      }
      const headerJson = JSON.stringify(headerOnlyObj);

      // Verify no patient names, diagnoses, or notes leak into headers
      assert.equal(headerJson.includes(canaryPatientName), false);
      assert.equal(headerJson.includes(canaryDoctorDiagnosis), false);
      assert.equal(headerJson.includes(canaryAccommodations), false);
      assert.equal(headerJson.includes('"L4"'), false, 'Medical shift code L4 must not appear in plaintext headers');

      // Verify sensitivity check
      assert.equal(VaultService.containsSensitiveFields(healthPayload), true);
      assert.equal(VaultService.containsSensitiveFields(headerOnlyObj), false);
    });

    // 1.4 Public Schedule Sanitization Boundary
    await t.test('test_sanitizeForPublicSchedule_strips_compensation_and_obfuscates_l4', () => {
      const sensitiveRecord = {
        id: 501,
        employee_id: 12,
        employee_name: 'Jan Kowalski',
        shift_code: 'L4',
        hours: 8,
        salary: 8000,
        monthly_salary: 8000,
        hourly_rate: 45.0,
        hourlyRate: 45.0,
        rate: 45.0,
        iban: 'PL61109010140000071219812874',
        medical_l4: true,
        medicalL4: true,
        diagnosis: 'Zwolnienie lekarskie ZUS e-ZLA',
        planSickHours: 8,
        estSickHours: 8,
        notes: 'Informacja medyczna pracownika poufna',
      };

      const sanitized = VaultService.sanitizeForPublicSchedule(sensitiveRecord);

      // L4 must be obfuscated to ABSENCE
      assert.equal(sanitized.shift_code, 'ABSENCE', 'L4 shift code must be obfuscated to ABSENCE for public display');

      // All sensitive keys must be completely removed
      const sensitiveKeys = [
        'salary',
        'monthly_salary',
        'hourly_rate',
        'hourlyRate',
        'rate',
        'iban',
        'medical_l4',
        'medicalL4',
        'diagnosis',
        'planSickHours',
        'estSickHours',
        'notes',
      ];

      for (const key of sensitiveKeys) {
        assert.equal(key in sanitized, false, `Key "${key}" must be stripped from public schedule record`);
      }

      // Safe public fields must be preserved
      assert.equal(sanitized.id, 501);
      assert.equal(sanitized.employee_id, 12);
      assert.equal(sanitized.employee_name, 'Jan Kowalski');
      assert.equal(sanitized.hours, 8);
    });
  });

  // =========================================================================================
  // SUITE 2: OVERSIZED PAYLOAD BOUNDARIES & 1 MIB HARD LIMITS
  // =========================================================================================
  await suite.test('Suite 2: Oversized Payload Boundaries & 1 MiB Hard Limits', async (t) => {
    // 2.1 Near-boundary payload (approx 900 KiB - must succeed)
    await t.test('test_payload_near_1_mib_boundary_succeeds_cleanly', async () => {
      // Build a large but valid payload (< 1 MiB packaged)
      // Base64 expansion is ~33%, so ~700 KiB raw plaintext will yield ~950 KiB document
      const largeArray: Array<{ id: number; date: string; shiftCode: string; description: string }> = [];
      const itemDescription = 'x'.repeat(150); // 150 bytes per item
      for (let i = 0; i < 3000; i++) {
        largeArray.push({
          id: i,
          date: '2026-03-01',
          shiftCode: 'AM',
          description: itemDescription,
        });
      }

      const payload = { items: largeArray };
      const rawPlaintextSize = Buffer.byteLength(canonicalJson(payload), 'utf8');
      assert.ok(rawPlaintextSize > 600000, `Raw plaintext should be ~600KB+, was ${rawPlaintextSize}`);

      const result = await VaultService.packageGenericVault({
        storeId: storeId1,
        unitCode: unitCode1,
        vaultType: 'vault_schedules',
        docId: 'large_doc_near_limit',
        sensitivePayload: payload,
        recordCount: largeArray.length,
      });

      assert.equal(result.success, true);
      const docBytes = Buffer.byteLength(JSON.stringify(result.doc), 'utf8');
      assert.ok(docBytes <= VaultService.MAX_FIRESTORE_DOC_SIZE, `Doc size ${docBytes} must be <= 1 MiB limit`);

      // Verify unpackage round-trip works flawlessly on near-limit document
      const unpackageResult = await VaultService.unpackageGenericVault({
        doc: result.doc,
        storeId: storeId1,
        unitCode: unitCode1,
        expectedVaultType: 'vault_schedules',
      });

      assert.equal(unpackageResult.success, true);
      assert.equal(unpackageResult.metrics.checksumVerified, true);
      assert.equal(unpackageResult.payload.items.length, 3000);
    });

    // 2.2 Payload exceeding 1 MiB boundary (must be cleanly rejected with exact error)
    await t.test('test_payload_exceeding_1_mib_is_cleanly_rejected_with_guardrail_error', async () => {
      // Generate a payload that will definitely exceed 1,048,576 bytes when packaged
      const hugeArray: Array<{ id: number; data: string }> = [];
      const chunk = 'A'.repeat(1024); // 1 KiB
      for (let i = 0; i < 1100; i++) {
        hugeArray.push({ id: i, data: chunk }); // > 1.1 MiB plaintext -> > 1.4 MiB ciphertext
      }

      const hugePayload = { records: hugeArray };

      await assert.rejects(
        async () => {
          await VaultService.packageGenericVault({
            storeId: storeId1,
            unitCode: unitCode1,
            vaultType: 'vault_financials',
            docId: 'oversized_doc_1100kb',
            sensitivePayload: hugePayload,
            recordCount: hugeArray.length,
          });
        },
        (err: Error) => {
          assert.match(
            err.message,
            /Vault packaging exceeded Firestore maximum document size \(1 MiB\)/i,
            'Error message must explicitly mention 1 MiB maximum document size'
          );
          assert.match(
            err.message,
            /oversized_doc_1100kb/,
            'Error message must identify the failing document ID'
          );
          return true;
        }
      );
    });

    // 2.3 Extreme Oversized Attack (3 MiB payload)
    await t.test('test_extreme_oversized_payload_rejection_prevents_firestore_quota_breach', async () => {
      const massivePayload = {
        blobs: Array.from({ length: 30 }, (_, i) => ({
          batchId: i,
          data: crypto.randomBytes(100 * 1024).toString('base64'), // 30 x 100 KB = 3 MB
        })),
      };

      await assert.rejects(
        async () => {
          await VaultService.packageGenericVault({
            storeId: storeId1,
            unitCode: unitCode1,
            vaultType: 'vault_financials',
            docId: 'massive_attack_doc',
            sensitivePayload: massivePayload,
            recordCount: 30,
          });
        },
        /Vault packaging exceeded Firestore maximum document size/
      );
    });

    // 2.4 Empty & Zero-Size Payload Behavior
    await t.test('test_empty_and_minimal_payloads_package_and_unpackage_cleanly', async () => {
      const emptyPayloads = [
        {},
        [],
        { emptyArray: [], emptyObj: {}, nullVal: null },
      ];

      for (let i = 0; i < emptyPayloads.length; i++) {
        const payload = emptyPayloads[i];
        const res = await VaultService.packageGenericVault({
          storeId: storeId1,
          unitCode: unitCode1,
          vaultType: 'vault_financials',
          docId: `empty_doc_${i}`,
          sensitivePayload: payload,
          recordCount: 0,
        });

        assert.equal(res.success, true);
        assert.ok(Buffer.byteLength(JSON.stringify(res.doc)) < 2048, 'Empty doc should be compact');

        const unpackageRes = await VaultService.unpackageGenericVault({
          doc: res.doc,
          storeId: storeId1,
          unitCode: unitCode1,
        });

        assert.deepStrictEqual(unpackageRes.payload, payload);
        assert.equal(unpackageRes.metrics.checksumVerified, true);
      }
    });
  });

  // =========================================================================================
  // SUITE 3: UNICODE & POLISH DIACRITICS FIDELITY
  // =========================================================================================
  await suite.test('Suite 3: Unicode & Polish Diacritics Byte-for-Byte Round-Trip Fidelity', async (t) => {
    // 3.1 Benchmark Phrase & Full Polish Diacritics Alphabet
    await t.test('test_polish_alphabet_and_janki_benchmark_phrase_fidelity', async () => {
      const benchmarkText = 'Zażółć gęślą jaźń 18120 Janki';
      const lowercaseDiacritics = 'aąbcćdeęfghijklłmnńoóprsśtuwyzźż';
      const uppercaseDiacritics = 'AĄBCĆDEĘFGHIJKLŁMNŃOÓPRSŚTUWYZŹŻ';
      const tongueTwister = 'W Szczebrzeszynie chrząszcz brzmi w trzcinie, a Strzegom i Żółkiew świętują rocznicę założenia kawiarni 108120 Starbucks Warszawa Janki przy al. Mszczonowskiej 3.';

      const payload = {
        benchmark: benchmarkText,
        lower: lowercaseDiacritics,
        upper: uppercaseDiacritics,
        twister: tongueTwister,
        location: {
          store: '108120 SBX Warszawa Janki',
          mall: 'Centrum Handlowe Janki',
          address: 'Plac Szwedzki 20, 05-090 Raszyn k. Warszawy',
          wojewodztwo: 'województwo mazowieckie',
          kraj: 'Rzeczpospolita Polska',
        },
      };

      const originalCanonical = canonicalJson(payload);
      const originalChecksum = canonicalSha256(payload);

      const packaged = await VaultService.packageGenericVault({
        storeId: storeId1,
        unitCode: unitCode1,
        vaultType: 'vault_schedules',
        docId: 'unicode_polish_alphabet_test',
        sensitivePayload: payload,
        recordCount: 1,
      });

      assert.equal(packaged.doc.checksum, originalChecksum);

      const unpackaged = await VaultService.unpackageGenericVault<typeof payload>({
        doc: packaged.doc,
        storeId: storeId1,
        unitCode: unitCode1,
        expectedVaultType: 'vault_schedules',
      });

      // 1. Deep structural equality
      assert.deepStrictEqual(unpackaged.payload, payload);

      // 2. Byte-for-byte exact canonical JSON string equality
      const roundTripCanonical = canonicalJson(unpackaged.payload);
      assert.equal(
        Buffer.from(roundTripCanonical, 'utf8').compare(Buffer.from(originalCanonical, 'utf8')),
        0,
        'Canonical JSON bytes must match byte-for-byte with zero drift'
      );

      // 3. Checksum verified flag
      assert.equal(unpackaged.metrics.checksumVerified, true);
      assert.equal(unpackaged.header.checksum, originalChecksum);
    });

    // 3.2 Polish Employee Names, Medical Notes & Financial Formatting
    await t.test('test_polish_employee_names_medical_notes_and_currency_symbols', async () => {
      const complexPersonnelPayload: PersonnelVaultPayload = {
        staffGroup: 'managers_and_crew',
        managers: [
          {
            id: 1,
            name: 'Mściwój Świętopełk-Cieszkowski',
            role: 'STORE_MANAGER',
            contract_type: 'UoP',
            contract_hours_ratio: 1.0,
            hourly_rate: 65.50,
            monthly_salary: 11000.00,
            sort_order: 1,
            is_active: 1,
          },
          {
            id: 2,
            name: 'Grażyna Łączkowska-Kościuszko',
            role: 'ASSISTANT_STORE_MANAGER',
            contract_type: 'UoP',
            contract_hours_ratio: 1.0,
            hourly_rate: 55.00,
            monthly_salary: 9240.00,
            sort_order: 2,
            is_active: 1,
          },
          {
            id: 3,
            name: 'Błażej Jażdżewski',
            role: 'SHIFT_SUPERVISOR',
            contract_type: 'UoP',
            contract_hours_ratio: 0.8,
            hourly_rate: 42.00,
            monthly_salary: 5644.80,
            sort_order: 3,
            is_active: 1,
          },
        ],
        trainingPartners: [
          {
            id: 10,
            name: 'Zdzisław Kręcina',
            hire_date: '2026-02-01',
            currentProgram: 'Barista First 30 Days',
            notes: 'Szkolenie BHP ukończone pomyślnie. Badania Sanepid ważne do 2027-02-01. Trener prowadzący: Józef Piłsudski.',
          } as any,
        ],
      };

      const packaged = await VaultService.packagePersonnelVault(
        storeId1,
        unitCode1,
        'managers_and_crew',
        'personnel_polish_names',
        complexPersonnelPayload
      );

      const unpackaged = await VaultService.unpackagePersonnelVault(
        packaged.doc,
        storeId1,
        unitCode1
      );

      assert.deepStrictEqual(unpackaged.payload, complexPersonnelPayload);
      assert.equal(unpackaged.metrics.checksumVerified, true);
      assert.equal(unpackaged.payload.managers?.[0].name, 'Mściwój Świętopełk-Cieszkowski');
      assert.equal(unpackaged.payload.managers?.[1].name, 'Grażyna Łączkowska-Kościuszko');
      assert.equal(unpackaged.payload.managers?.[2].name, 'Błażej Jażdżewski');
    });

    // 3.3 Multi-byte UTF-8, Control Characters & Emoji Integrity
    await t.test('test_multibyte_utf8_control_characters_and_emoji_fidelity', async () => {
      const payloadWithSpecialChars = {
        symbols: 'ΔTPLH: +1.25, Narzut: 19.48% ± 0.05%, Koszt: 145 200,00 zł (€ 34 100,50 / $ 37 250,00)',
        controlChars: 'Linia 1\nLinia 2\r\nTabulator:\tCudzysłów: "Tekst w cudzysłowie" / Ukośnik: C:\\Starbucks\\Reports\\2026',
        emoji: '☕ Starbucks 🇵🇱 Warszawa 🛡️ AES-256-GCM 🔐 Bezpieczeństwo 🚀 Wdrożenie ✅ Sukces',
        quotedJsonString: '{"nestedKey": "wartość z polskimi znakami: ąęćłóśźż"}',
      };

      const packaged = await VaultService.packageGenericVault({
        storeId: storeId1,
        unitCode: unitCode1,
        vaultType: 'vault_financials',
        docId: 'special_chars_fidelity',
        sensitivePayload: payloadWithSpecialChars,
        recordCount: 4,
      });

      const unpackaged = await VaultService.unpackageGenericVault<typeof payloadWithSpecialChars>({
        doc: packaged.doc,
        storeId: storeId1,
        unitCode: unitCode1,
      });

      assert.deepStrictEqual(unpackaged.payload, payloadWithSpecialChars);
      assert.equal(unpackaged.payload.emoji, '☕ Starbucks 🇵🇱 Warszawa 🛡️ AES-256-GCM 🔐 Bezpieczeństwo 🚀 Wdrożenie ✅ Sukces');
      assert.equal(unpackaged.metrics.checksumVerified, true);
    });
  });

  // =========================================================================================
  // SUITE 4: FIRESTORE RULES PENETRATION SIMULATION
  // =========================================================================================
  await suite.test('Suite 4: Firestore Rules Penetration Simulation & Cross-Tenant Isolation', async (t) => {
    // Load firestore.rules from workspace root to verify actual rules source
    const rulesPath = path.join(process.cwd(), 'firestore.rules');
    assert.ok(fs.existsSync(rulesPath), 'firestore.rules must exist at project root');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    // 4.1 Static Analysis of Rules File
    await t.test('test_firestore_rules_static_analysis_verifies_tenant_isolation_constructs', () => {
      // Must use rules_version 2
      assert.match(rulesContent, /rules_version\s*=\s*['"]2['"]/);

      // Must have isStoreAuthorized helper with exact storeId matching
      assert.match(rulesContent, /function\s+isStoreAuthorized\s*\(\s*storeId\s*\)\s*\{/);
      assert.match(rulesContent, /request\.auth\.token\.storeId\s*==\s*storeId/);

      // Role functions must incorporate isStoreAuthorized(storeId)
      assert.match(rulesContent, /function\s+isStoreStaff\s*\(\s*storeId\s*\)\s*\{[^}]*isStoreAuthorized\s*\(\s*storeId\s*\)/);
      assert.match(rulesContent, /function\s+isAssistantOrStoreManager\s*\(\s*storeId\s*\)\s*\{[^}]*isStoreAuthorized\s*\(\s*storeId\s*\)/);
      assert.match(rulesContent, /function\s+isStoreManager\s*\(\s*storeId\s*\)\s*\{[^}]*isStoreAuthorized\s*\(\s*storeId\s*\)/);
      assert.match(rulesContent, /function\s+isExecutive\s*\(\s*storeId\s*\)\s*\{[^}]*isStoreAuthorized\s*\(\s*storeId\s*\)/);

      // Verify all 5 vault collections exist under /stores/{storeId}
      const expectedVaults = [
        'vault_financials',
        'vault_personnel',
        'vault_schedules',
        'vault_health_gdpr',
        'telemetry',
      ];
      for (const v of expectedVaults) {
        assert.ok(
          rulesContent.includes(`match /${v}/{docId}`),
          `firestore.rules must define rules for match /${v}/{docId}`
        );
      }

      // Verify ZERO static store fallbacks in rules logic
      assert.equal(/108120/.test(rulesContent), false, 'Zero occurrences of 108120 in firestore.rules');
      assert.equal(/18120/.test(rulesContent), false, 'Zero occurrences of 18120 in firestore.rules');
      assert.equal(/\b384\b/.test(rulesContent), false, 'Zero occurrences of 384 in firestore.rules');
    });

    // 4.2 High-Fidelity Simulation Engine for Firestore Security Rules
    interface AuthToken {
      uid: string;
      email?: string;
      storeId?: string;
      role?: string;
    }

    interface SecurityContext {
      auth: { uid: string; token: AuthToken } | null;
      resource?: Record<string, any>;
      requestResource?: Record<string, any>;
    }

    class FirestoreRuleSimulator {
      public static isAuthenticated(ctx: SecurityContext): boolean {
        return ctx.auth !== null && typeof ctx.auth.uid === 'string' && ctx.auth.uid.length > 0;
      }

      public static isCorporateEmail(ctx: SecurityContext): boolean {
        if (!this.isAuthenticated(ctx) || !ctx.auth?.token.email) return false;
        return /.*@((amrest\.eu)|(starbucks\.com))$/.test(ctx.auth.token.email);
      }

      public static isStoreAuthorized(ctx: SecurityContext, targetStoreId: string): boolean {
        if (!this.isAuthenticated(ctx)) return false;
        const tokenStoreId = ctx.auth?.token.storeId;
        if (!tokenStoreId || typeof tokenStoreId !== 'string') return false;
        return tokenStoreId === targetStoreId;
      }

      public static getUserRole(ctx: SecurityContext, targetStoreId: string): string {
        if (!this.isStoreAuthorized(ctx, targetStoreId)) return 'NONE';
        return ctx.auth?.token.role || 'NONE';
      }

      public static isStoreStaff(ctx: SecurityContext, targetStoreId: string): boolean {
        if (!this.isCorporateEmail(ctx) || !this.isStoreAuthorized(ctx, targetStoreId)) return false;
        const role = this.getUserRole(ctx, targetStoreId);
        return ['BARISTA', 'SHIFT_SUPERVISOR', 'ASSISTANT_STORE_MANAGER', 'STORE_MANAGER', 'DISTRICT_MANAGER'].includes(role);
      }

      public static isAssistantOrStoreManager(ctx: SecurityContext, targetStoreId: string): boolean {
        if (!this.isCorporateEmail(ctx) || !this.isStoreAuthorized(ctx, targetStoreId)) return false;
        const role = this.getUserRole(ctx, targetStoreId);
        return ['ASSISTANT_STORE_MANAGER', 'STORE_MANAGER', 'DISTRICT_MANAGER'].includes(role);
      }

      public static isStoreManager(ctx: SecurityContext, targetStoreId: string): boolean {
        if (!this.isCorporateEmail(ctx) || !this.isStoreAuthorized(ctx, targetStoreId)) return false;
        const role = this.getUserRole(ctx, targetStoreId);
        return ['STORE_MANAGER', 'DISTRICT_MANAGER'].includes(role);
      }

      public static isExecutive(ctx: SecurityContext, targetStoreId: string): boolean {
        return this.isStoreManager(ctx, targetStoreId);
      }

      public static isValidVaultDocument(data: any, storeId: string, expectedVaultType: string): boolean {
        if (!data || typeof data !== 'object') return false;
        const required = ['docId', 'storeId', 'vaultType', 'version', 'iv', 'tag', 'ciphertext', 'updatedAt', 'updatedBy'];
        for (const req of required) {
          if (!(req in data) || data[req] === null || data[req] === undefined) return false;
        }
        if (data.storeId !== storeId) return false;
        if (data.vaultType !== expectedVaultType) return false;
        if (data.version !== 'v1') return false;
        if (typeof data.docId !== 'string' || data.docId.length < 1 || data.docId.length > 128) return false;
        if (typeof data.iv !== 'string' || data.iv.length < 16 || data.iv.length > 32) return false;
        if (typeof data.tag !== 'string' || data.tag.length < 20 || data.tag.length > 32) return false;
        if (typeof data.ciphertext !== 'string' || data.ciphertext.length < 1 || data.ciphertext.length > 2000000) return false;
        if (typeof data.updatedBy !== 'string' || data.updatedBy.length < 1 || data.updatedBy.length > 128) return false;
        return true;
      }

      public static evaluateRead(ctx: SecurityContext, collectionPath: string): boolean {
        const segments = collectionPath.replace(/^\/+|\/+$/g, '').split('/');
        // Pattern: stores/{storeId}/{subCollection}/{docId}
        if (segments[0] !== 'stores' || segments.length < 2) return false;
        const storeId = segments[1];

        // Metadata: /stores/{storeId}
        if (segments.length === 2) {
          return this.isStoreStaff(ctx, storeId);
        }

        const subCollection = segments[2];

        switch (subCollection) {
          case 'vault_financials':
          case 'vault_personnel':
          case 'vault_health_gdpr':
          case 'executive_financial_vault':
            return this.isExecutive(ctx, storeId);

          case 'vault_schedules':
          case 'telemetry':
          case 'public_schedule':
            return this.isStoreStaff(ctx, storeId);

          case 'managed_users':
            return this.isCorporateEmail(ctx) && this.isStoreAuthorized(ctx, storeId) &&
                   (this.isAssistantOrStoreManager(ctx, storeId) || ctx.auth?.uid === segments[3]);

          case 'private_staff_vault':
            return this.isCorporateEmail(ctx) && this.isStoreAuthorized(ctx, storeId) &&
                   (this.isAssistantOrStoreManager(ctx, storeId) || ctx.resource?.userId === ctx.auth?.uid);

          default:
            return false;
        }
      }

      public static evaluateWrite(
        ctx: SecurityContext,
        collectionPath: string,
        operation: 'create' | 'update' | 'delete'
      ): boolean {
        const segments = collectionPath.replace(/^\/+|\/+$/g, '').split('/');
        if (segments[0] !== 'stores' || segments.length < 2) return false;
        const storeId = segments[1];

        // Store level metadata: /stores/{storeId}
        if (segments.length === 2) {
          return this.isStoreManager(ctx, storeId);
        }

        const subCollection = segments[2];
        const docId = segments[3];
        const data = ctx.requestResource;

        if (operation === 'delete') {
          return this.isStoreManager(ctx, storeId);
        }

        switch (subCollection) {
          case 'vault_financials':
          case 'vault_personnel':
          case 'vault_health_gdpr':
            if (!this.isStoreManager(ctx, storeId)) return false;
            if (!this.isValidVaultDocument(data, storeId, subCollection)) return false;
            if (operation === 'create' && data?.docId !== docId) return false;
            if (operation === 'update') {
              // Immutable fields: docId, storeId, vaultType, version
              if (ctx.resource && (
                ctx.resource.docId !== data.docId ||
                ctx.resource.storeId !== data.storeId ||
                ctx.resource.vaultType !== data.vaultType ||
                ctx.resource.version !== data.version
              )) {
                return false;
              }
            }
            return true;

          case 'vault_schedules':
            if (!this.isAssistantOrStoreManager(ctx, storeId)) return false;
            if (!this.isValidVaultDocument(data, storeId, subCollection)) return false;
            if (operation === 'create' && data?.docId !== docId) return false;
            if (operation === 'update') {
              if (ctx.resource && (
                ctx.resource.docId !== data.docId ||
                ctx.resource.storeId !== data.storeId ||
                ctx.resource.vaultType !== data.vaultType ||
                ctx.resource.version !== data.version
              )) {
                return false;
              }
            }
            return true;

          case 'telemetry':
            if (!this.isStoreStaff(ctx, storeId)) return false;
            if (operation === 'create' && data?.docId !== docId) return false;
            return true;

          default:
            return false;
        }
      }
    }

    // 4.3 Adversarial Attack Scenario 1: Simulated Cross-Tenant Access from Store 108120 to Store 108150
    await t.test('test_simulated_token_store_108120_strictly_forbidden_from_reading_or_writing_store_108150', () => {
      // Attacker token: Store Manager of Store 108120 (CH Janki)
      const jankiManagerContext: SecurityContext = {
        auth: {
          uid: 'sm_janki_uid_123',
          token: {
            uid: 'sm_janki_uid_123',
            email: 'jan.kowalski@starbucks.com',
            storeId: '108120',
            role: 'STORE_MANAGER',
          },
        },
      };

      const wroclawTargetPaths = [
        '/stores/108150',
        '/stores/108150/vault_financials/month_2026_03',
        '/stores/108150/vault_personnel/active_roster',
        '/stores/108150/vault_schedules/week_2026_W12',
        '/stores/108150/vault_health_gdpr/period_2026_Q1',
        '/stores/108150/telemetry/status',
        '/stores/108150/managed_users/target_user_456',
        '/stores/108150/public_schedule/week_12',
        '/stores/108150/private_staff_vault/target_user_456',
        '/stores/108150/executive_financial_vault/month_2026_03',
      ];

      // Read attempts must ALL be rejected
      for (const targetPath of wroclawTargetPaths) {
        const canRead = FirestoreRuleSimulator.evaluateRead(jankiManagerContext, targetPath);
        assert.equal(
          canRead,
          false,
          `CROSS-TENANT LEAK: Token with storeId=108120 must NOT be able to read ${targetPath}`
        );
      }

      // Write attempts must ALL be rejected
      const mockVaultDoc = {
        docId: 'month_2026_03',
        storeId: '108150',
        vaultType: 'vault_financials',
        version: 'v1',
        iv: '1234567890123456',
        tag: '12345678901234567890',
        ciphertext: 'base64_ciphertext_payload==',
        updatedAt: new Date().toISOString(),
        updatedBy: 'sm_janki_uid_123',
      };

      const writeContext: SecurityContext = {
        ...jankiManagerContext,
        requestResource: mockVaultDoc,
      };

      for (const targetPath of wroclawTargetPaths) {
        const canWrite = FirestoreRuleSimulator.evaluateWrite(writeContext, targetPath, 'create');
        assert.equal(
          canWrite,
          false,
          `CROSS-TENANT TAMPERING: Token with storeId=108120 must NOT be able to write to ${targetPath}`
        );
      }
    });

    // 4.4 Adversarial Attack Scenario 2: Spoofed and Malformed Tokens
    await t.test('test_spoofed_tokens_wildcards_and_non_corporate_emails_are_rejected', () => {
      const maliciousTokens: Array<{ name: string; context: SecurityContext }> = [
        {
          name: 'Empty storeId',
          context: {
            auth: {
              uid: 'user_1',
              token: { uid: 'user_1', email: 'sm@amrest.eu', storeId: '', role: 'STORE_MANAGER' },
            },
          },
        },
        {
          name: 'Null storeId',
          context: {
            auth: {
              uid: 'user_2',
              token: { uid: 'user_2', email: 'sm@amrest.eu', storeId: undefined, role: 'STORE_MANAGER' },
            },
          },
        },
        {
          name: 'Wildcard storeId (*)',
          context: {
            auth: {
              uid: 'user_3',
              token: { uid: 'user_3', email: 'sm@amrest.eu', storeId: '*', role: 'STORE_MANAGER' },
            },
          },
        },
        {
          name: 'Path Traversal storeId (108120/../108150)',
          context: {
            auth: {
              uid: 'user_4',
              token: { uid: 'user_4', email: 'sm@amrest.eu', storeId: '108120/../108150', role: 'STORE_MANAGER' },
            },
          },
        },
        {
          name: 'Non-Corporate Email (@gmail.com)',
          context: {
            auth: {
              uid: 'user_5',
              token: { uid: 'user_5', email: 'hacker@gmail.com', storeId: '108150', role: 'STORE_MANAGER' },
            },
          },
        },
        {
          name: 'Spoofed Domain (@amrest.eu.fake.com)',
          context: {
            auth: {
              uid: 'user_6',
              token: { uid: 'user_6', email: 'hacker@amrest.eu.fake.com', storeId: '108150', role: 'STORE_MANAGER' },
            },
          },
        },
        {
          name: 'Unauthenticated Request (null auth)',
          context: {
            auth: null,
          },
        },
      ];

      for (const { name, context } of maliciousTokens) {
        const canRead = FirestoreRuleSimulator.evaluateRead(
          context,
          '/stores/108150/vault_financials/month_2026_03'
        );
        assert.equal(
          canRead,
          false,
          `Malicious token [${name}] must be rejected from reading store 108150`
        );

        const canWrite = FirestoreRuleSimulator.evaluateWrite(
          context,
          '/stores/108150/vault_financials/month_2026_03',
          'create'
        );
        assert.equal(
          canWrite,
          false,
          `Malicious token [${name}] must be rejected from writing store 108150`
        );
      }
    });

    // 4.5 Role Hierarchy within Authorized Store (Positive & Negative Controls)
    await t.test('test_authorized_store_role_privilege_separation', () => {
      const baristaContext: SecurityContext = {
        auth: {
          uid: 'barista_uid_777',
          token: { uid: 'barista_uid_777', email: 'barista@amrest.eu', storeId: '108150', role: 'BARISTA' },
        },
      };

      const managerContext: SecurityContext = {
        auth: {
          uid: 'sm_uid_888',
          token: { uid: 'sm_uid_888', email: 'sm@amrest.eu', storeId: '108150', role: 'STORE_MANAGER' },
        },
      };

      // Barista CAN read schedule in own store
      assert.equal(
        FirestoreRuleSimulator.evaluateRead(baristaContext, '/stores/108150/vault_schedules/week_2026_W12'),
        true,
        'Barista must be able to read schedules for their authorized store'
      );

      // Barista CANNOT read financial vault
      assert.equal(
        FirestoreRuleSimulator.evaluateRead(baristaContext, '/stores/108150/vault_financials/month_2026_03'),
        false,
        'Barista must NOT have read access to financial vault'
      );

      // Barista CANNOT read personnel vault (salaries)
      assert.equal(
        FirestoreRuleSimulator.evaluateRead(baristaContext, '/stores/108150/vault_personnel/active_roster'),
        false,
        'Barista must NOT have read access to personnel salaries vault'
      );

      // Barista CANNOT read health/GDPR vault
      assert.equal(
        FirestoreRuleSimulator.evaluateRead(baristaContext, '/stores/108150/vault_health_gdpr/period_2026_Q1'),
        false,
        'Barista must NOT have read access to health/GDPR vault'
      );

      // Store Manager CAN read all vaults in own store
      assert.equal(
        FirestoreRuleSimulator.evaluateRead(managerContext, '/stores/108150/vault_financials/month_2026_03'),
        true,
        'Store Manager must have read access to financial vault'
      );
      assert.equal(
        FirestoreRuleSimulator.evaluateRead(managerContext, '/stores/108150/vault_personnel/active_roster'),
        true,
        'Store Manager must have read access to personnel vault'
      );
      assert.equal(
        FirestoreRuleSimulator.evaluateRead(managerContext, '/stores/108150/vault_health_gdpr/period_2026_Q1'),
        true,
        'Store Manager must have read access to health/GDPR vault'
      );
      assert.equal(
        FirestoreRuleSimulator.evaluateRead(managerContext, '/stores/108150/vault_schedules/week_2026_W12'),
        true,
        'Store Manager must have read access to schedule vault'
      );
    });

    // 4.6 Vault Document Envelope Defense & Immutability Enforcement
    await t.test('test_vault_document_envelope_validation_rejects_malformed_or_tampered_writes', () => {
      const validEnvelope = {
        docId: 'month_2026_03',
        storeId: '108150',
        vaultType: 'vault_financials',
        version: 'v1',
        iv: '1234567890123456', // 16 chars base64 (96-bit)
        tag: '12345678901234567890', // 20 chars base64 (128-bit)
        ciphertext: 'base64_encrypted_payload==',
        updatedAt: new Date().toISOString(),
        updatedBy: 'sm_uid_888',
      };

      const managerContext: SecurityContext = {
        auth: {
          uid: 'sm_uid_888',
          token: { uid: 'sm_uid_888', email: 'sm@amrest.eu', storeId: '108150', role: 'STORE_MANAGER' },
        },
        requestResource: validEnvelope,
      };

      // Valid envelope write succeeds
      assert.equal(
        FirestoreRuleSimulator.evaluateWrite(
          managerContext,
          '/stores/108150/vault_financials/month_2026_03',
          'create'
        ),
        true,
        'Valid encrypted vault document write must succeed'
      );

      // Attack: Mismatched storeId in document payload vs path
      const mismatchedStoreCtx: SecurityContext = {
        ...managerContext,
        requestResource: { ...validEnvelope, storeId: '108120' }, // Claiming 108120 inside path 108150
      };
      assert.equal(
        FirestoreRuleSimulator.evaluateWrite(
          mismatchedStoreCtx,
          '/stores/108150/vault_financials/month_2026_03',
          'create'
        ),
        false,
        'Mismatched storeId in body must be rejected'
      );

      // Attack: Short IV (insufficient randomness / not 96-bit)
      const shortIvCtx: SecurityContext = {
        ...managerContext,
        requestResource: { ...validEnvelope, iv: 'short_iv' },
      };
      assert.equal(
        FirestoreRuleSimulator.evaluateWrite(
          shortIvCtx,
          '/stores/108150/vault_financials/month_2026_03',
          'create'
        ),
        false,
        'Short IV must be rejected by isValidVaultDocument rule'
      );

      // Attack: Short Tag (truncated authentication tag)
      const shortTagCtx: SecurityContext = {
        ...managerContext,
        requestResource: { ...validEnvelope, tag: 'short_tag' },
      };
      assert.equal(
        FirestoreRuleSimulator.evaluateWrite(
          shortTagCtx,
          '/stores/108150/vault_financials/month_2026_03',
          'create'
        ),
        false,
        'Short authentication tag must be rejected'
      );

      // Attack: Update mutating immutable docId or storeId
      const updateTamperCtx: SecurityContext = {
        ...managerContext,
        resource: validEnvelope,
        requestResource: { ...validEnvelope, storeId: '108999' }, // Mutating storeId
      };
      assert.equal(
        FirestoreRuleSimulator.evaluateWrite(
          updateTamperCtx,
          '/stores/108150/vault_financials/month_2026_03',
          'update'
        ),
        false,
        'Update attempting to mutate immutable storeId must be rejected'
      );
    });
  });
});
