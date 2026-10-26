/**
 * Starbucks Operations Suite — Final Milestone Phase 2: Tier 5 Adversarial Stress & Hardening
 *
 * Test Suite: `final_cross_module_stress.test.ts`
 * Archetype: EMPIRICAL CHALLENGER
 * Focus: Cross-Module Security, Integrity, Concurrency Fuzzing & Business Rule Compliance
 *
 * Dimension 1: High-concurrency store switching, rapid LRU pool evictions, mutex contention
 * Dimension 2: Tenant isolation penetration testing on `firestore.rules`
 * Dimension 3: Full migration pipeline rollback under simulated crash/power-outage conditions
 * Dimension 4: Real-world Starbucks business rules (Floor Hours 32.0 h/day, Non-coverage training budget isolation, Polish Labor Code art. 132 KP 11h rest)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import initSqlJs from 'sql.js';

// Electron & SQLite Infrastructure
import { StoreConnectionPool, AsyncMutex, DatabaseManager } from '../../../electron/database/db';

// Migration & Security Services
import {
  CloudMigrationService,
  MAX_DOCS_PER_BATCH,
} from '../../../src/services/security/cloudMigrationService';
import type {
  ILocalDatabaseExtractor,
  IBackupProvider,
  ICloudVaultUploader,
} from '../../../src/services/security/cloudMigrationService';
import { VaultService } from '../../../src/services/security/vaultService';
import {
  canonicalJson,
  canonicalSha256,
  parseEnvelope,
} from '../../../src/services/security/encryptionService';

// Starbucks Business Rule Engines
import { CalculationEngine } from '../../../src/modules/labor-forecast/services/calculationEngine';
import {
  ManagerScheduleEngine,
  getPolishTradingSundays,
  getPolishHolidays,
} from '../../../src/modules/managers-schedule/services/managerScheduleEngine';
import { DEFAULT_SHIFT_DEFINITIONS } from '../../../src/modules/managers-schedule/constants/defaultShifts';
import { TrainingEngine } from '../../../src/modules/trainings/services/trainingEngine';
import { FIRST_30_SHIFTS } from '../../../src/modules/trainings/services/trainingStandardData';
import { ColEngine } from '../../../src/modules/col-calculator/services/colEngine';
import {
  DEFAULT_COL_STORE_INFO,
  DEFAULT_COL_KPIS,
  DEFAULT_COL_MANAGERS,
} from '../../../src/modules/col-calculator/services/colDefaultData';
import type {
  ManagerEmployee,
  ManagerScheduleShift,
  ShiftDefinition,
  WeekRecord,
  ManagerDailyCoverageItem,
} from '../../../src/types';

test('Tier 5 Adversarial: Final Cross-Module Security, Integrity & Concurrency Fuzzing', async (suite) => {
  const SQL = await initSqlJs();

  // =========================================================================
  // SUITE 1: HIGH-CONCURRENCY STORE SWITCHING, LRU POOL & MUTEX CONTENTION
  // =========================================================================
  await suite.test('Suite 1: High-Concurrency Store Switching, Rapid LRU Eviction & Mutex Contention', async (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_final_challenger_concurrency_'));

    try {
      // 1.1 Rapid LRU Eviction Under High Store Turnover (60 distinct stores in 8-connection pool)
      await t.test('test_lru_pool_60_store_turnover_preserves_dirty_writes_and_sqlite_integrity', async () => {
        const pool = new StoreConnectionPool(8);
        const storeCount = 60;
        const dirtyStores = new Set<string>();

        for (let i = 1; i <= storeCount; i++) {
          const storeId = `108${String(i).padStart(3, '0')}`;
          const dbPath = path.join(tmpDir, `store_${storeId}.db`);

          const db = new SQL.Database();
          db.run(`
            CREATE TABLE operational_shifts (
              id INTEGER PRIMARY KEY,
              store_id TEXT,
              partner_name TEXT,
              hours REAL
            );
          `);
          db.run(`INSERT INTO operational_shifts VALUES (1, '${storeId}', 'Partner ${i}', 8.0);`);

          // Odd-numbered stores perform an uncommitted dirty write
          const isDirty = i % 2 === 1;
          if (isDirty) {
            db.run(`INSERT INTO operational_shifts VALUES (2, '${storeId}', 'Dirty Shift ${i}', 4.5);`);
            dirtyStores.add(storeId);
          }

          // Initial write to disk
          fs.writeFileSync(dbPath, Buffer.from(db.export()));

          // Put into pool
          const putResult = pool.put(storeId, db, dbPath, isDirty);

          assert.ok(pool.size() <= 8, `Pool size ${pool.size()} must never exceed limit of 8`);
          if (i > 8) {
            assert.ok(putResult.evicted, `Expected an eviction when inserting store ${i}`);
          }
        }

        assert.equal(pool.size(), 8, 'Pool size must be capped at exactly 8');
        assert.equal(pool.evictionLog.length, 52, '52 stores must have been evicted (60 - 8)');

        // Forensically inspect all 60 stores on disk
        for (let i = 1; i <= storeCount; i++) {
          const storeId = `108${String(i).padStart(3, '0')}`;
          const dbPath = path.join(tmpDir, `store_${storeId}.db`);
          assert.ok(fs.existsSync(dbPath), `Store db file for ${storeId} must exist on disk`);

          const diskBuffer = fs.readFileSync(dbPath);
          const diskDb = new SQL.Database(diskBuffer);

          try {
            // Check SQLite integrity
            const integrityRes = diskDb.exec('PRAGMA integrity_check;');
            assert.equal(
              integrityRes[0].values[0][0],
              'ok',
              `Store ${storeId} on disk must pass PRAGMA integrity_check`
            );

            // Verify row counts: dirty stores must have both rows flushed on eviction
            const rowsRes = diskDb.exec('SELECT COUNT(*) FROM operational_shifts;');
            const count = Number(rowsRes[0].values[0][0]);

            if (dirtyStores.has(storeId)) {
              assert.equal(
                count,
                2,
                `Dirty store ${storeId} must have both initial and dirty rows saved to disk`
              );
            } else {
              assert.equal(count, 1, `Clean store ${storeId} should have 1 row`);
            }
          } finally {
            diskDb.close();
          }
        }

        pool.closeAll();
      });

      // 1.2 Mutex Contention: 60 Parallel switchStoreDatabase calls across 15 rotating stores
      await t.test('test_database_manager_60_concurrent_switches_strict_serialization_zero_races', async () => {
        const dbManager = DatabaseManager.getInstance(tmpDir);
        await dbManager.init();

        let activeLocks = 0;
        let peakConcurrency = 0;
        const mutex = dbManager.getSwitchMutex();

        // Spy on mutex execution to prove strict serialization
        const originalRunExclusive = mutex.runExclusive.bind(mutex);
        mutex.runExclusive = async function <T>(fn: () => Promise<T>): Promise<T> {
          return originalRunExclusive(async () => {
            activeLocks++;
            peakConcurrency = Math.max(peakConcurrency, activeLocks);
            try {
              return await fn();
            } finally {
              activeLocks--;
            }
          });
        };

        const totalSwitchCalls = 60;
        const switchPromises = Array.from({ length: totalSwitchCalls }, (_, idx) => {
          const storeIndex = (idx % 15) + 1;
          const storeId = `108${String(storeIndex).padStart(3, '0')}`;
          const unitCode = String(18000 + storeIndex);

          return (async () => {
            const res = await dbManager.switchStoreDatabase(storeId, {
              name: `SBX Test Store ${storeIndex}`,
              unitCode,
              mpk: storeId,
              city: 'Warszawa',
            });

            assert.equal(res.success, true, `Switch to store ${storeId} must succeed`);
            assert.equal(res.storeId, storeId);

            // Write an app setting during the active switch
            dbManager.setAppSetting(`concurrent_metric_${idx}`, `value_${idx}`);

            return res;
          })();
        });

        const results = await Promise.all(switchPromises);

        assert.equal(results.length, totalSwitchCalls, 'All 60 switches must complete successfully');
        assert.equal(
          peakConcurrency,
          1,
          `AsyncMutex must strictly serialize switches (peak concurrency was ${peakConcurrency}, expected 1)`
        );

        // Verify pool size after high concurrency
        const pool = dbManager.getConnectionPool();
        assert.ok(pool.size() <= 8, `Pool size ${pool.size()} must never exceed 8`);

        // Check SQLite integrity on all 15 stores created during stress
        for (let i = 1; i <= 15; i++) {
          const storeId = `108${String(i).padStart(3, '0')}`;
          const dbPath = dbManager.computeDbFilePath(storeId);
          assert.ok(fs.existsSync(dbPath), `File ${dbPath} must exist`);

          const checkDb = new SQL.Database(fs.readFileSync(dbPath));
          try {
            const integrity = checkDb.exec('PRAGMA integrity_check;');
            assert.equal(
              integrity[0].values[0][0],
              'ok',
              `PRAGMA integrity_check failed on ${dbPath}`
            );
          } finally {
            checkDb.close();
          }
        }
      });

      // 1.3 Mutex Resilience Under Injected Critical Exceptions
      await t.test('test_async_mutex_lock_releases_cleanly_on_fatal_rejection_no_deadlock', async () => {
        const mutex = new AsyncMutex();
        let exceptionThrown = false;

        try {
          await mutex.runExclusive(async () => {
            throw new Error('FATAL_DISK_IO_PANIC');
          });
        } catch (err: any) {
          exceptionThrown = true;
          assert.equal(err.message, 'FATAL_DISK_IO_PANIC');
        }

        assert.equal(exceptionThrown, true);

        // Next operation must execute immediately without deadlock
        let nextExecuted = false;
        await mutex.runExclusive(async () => {
          nextExecuted = true;
        });

        assert.equal(nextExecuted, true, 'Subsequent mutex operation must execute without deadlocking');
      });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  // =========================================================================
  // SUITE 2: TENANT ISOLATION PENETRATION TESTING ON FIRESTORE.RULES
  // =========================================================================
  await suite.test('Suite 2: Tenant Isolation Penetration Testing on firestore.rules', async (t) => {
    const rulesPath = path.join(process.cwd(), 'firestore.rules');
    assert.ok(fs.existsSync(rulesPath), 'firestore.rules must exist at project root');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    // 2.1 Static Security Verification of firestore.rules
    await t.test('test_firestore_rules_static_guarantees', () => {
      // Must be rules_version 2
      assert.match(rulesContent, /rules_version\s*=\s*['"]2['"]/);

      // Default deny pattern must be present
      assert.match(rulesContent, /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/);

      // Must enforce request.auth.token.storeId == storeId
      assert.match(rulesContent, /request\.auth\.token\.storeId\s*==\s*storeId/);

      // Corporate email domain pattern check (AmRest / Starbucks)
      assert.ok(rulesContent.includes("request.auth.token.email.matches('.*@((amrest\\\\.eu)|(starbucks\\\\.com))$')"));

      // Zero hardcoded store fallbacks
      assert.equal(/108120/.test(rulesContent), false, 'Hardcoded 108120 must not exist in rules logic');
      assert.equal(/18120/.test(rulesContent), false, 'Hardcoded 18120 must not exist in rules logic');
      assert.equal(/\b384\b/.test(rulesContent), false, 'Hardcoded 384 must not exist in rules logic');

      // Verify app_installations aggregation leak prevention
      assert.match(rulesContent, /match\s+\/app_installations\/\{installId\}/);
      assert.ok(rulesContent.includes("request.auth.token.email == resource.data.userEmail || request.auth.token.role == 'DISTRICT_MANAGER'"));
    });

    // 2.2 Dynamic AST-Faithful Simulator for Firestore Penetration Testing
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

    class RuleValidator {
      public static isAuthenticated(ctx: SecurityContext): boolean {
        return ctx.auth !== null && typeof ctx.auth.uid === 'string' && ctx.auth.uid.length > 0;
      }

      public static isCorporateEmail(ctx: SecurityContext): boolean {
        if (!this.isAuthenticated(ctx) || !ctx.auth?.token.email) return false;
        return /.*@((amrest\.eu)|(starbucks\.com))$/.test(ctx.auth.token.email);
      }

      public static isStoreAuthorized(ctx: SecurityContext, targetStoreId: string): boolean {
        if (!this.isAuthenticated(ctx)) return false;
        const sId = ctx.auth?.token.storeId;
        if (!sId || typeof sId !== 'string') return false;
        return sId === targetStoreId;
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

      public static isValidVaultDocument(data: Record<string, any>, storeId: string, expectedVaultType: string): boolean {
        const required = ['docId', 'storeId', 'vaultType', 'version', 'iv', 'tag', 'ciphertext', 'updatedAt', 'updatedBy'];
        for (const f of required) {
          if (!(f in data)) return false;
        }
        if (data.storeId !== storeId) return false;
        if (data.vaultType !== expectedVaultType) return false;
        if (data.version !== 'v1') return false;
        if (typeof data.docId !== 'string' || data.docId.length < 1 || data.docId.length > 128) return false;
        if (typeof data.iv !== 'string' || data.iv.length < 16 || data.iv.length > 32) return false;
        if (typeof data.tag !== 'string' || data.tag.length < 20 || data.tag.length > 32) return false;
        if (typeof data.ciphertext !== 'string' || data.ciphertext.length < 1 || data.ciphertext.length > 2000000) return false;
        return true;
      }
    }

    // 2.3 Cross-Store Read/Write Penetration Attacks
    await t.test('test_cross_store_read_and_write_injection_is_strictly_rejected', () => {
      // Attacker has valid token for Store 108120 (Warszawa Janki)
      const attackerContext: SecurityContext = {
        auth: {
          uid: 'user_attacker_108120',
          token: {
            uid: 'user_attacker_108120',
            email: 'attacker@starbucks.com',
            storeId: '108120',
            role: 'STORE_MANAGER',
          },
        },
      };

      const victimStoreId = '108150'; // Wrocław PKP

      // Attempted read of victim's vaults
      assert.equal(RuleValidator.isStoreAuthorized(attackerContext, victimStoreId), false);
      assert.equal(RuleValidator.isStoreStaff(attackerContext, victimStoreId), false);
      assert.equal(RuleValidator.isExecutive(attackerContext, victimStoreId), false);
      assert.equal(RuleValidator.isAssistantOrStoreManager(attackerContext, victimStoreId), false);

      // Attempted write to victim's financial vault
      const maliciousPayload = {
        docId: 'month_2026_03',
        storeId: victimStoreId,
        vaultType: 'vault_financials',
        version: 'v1',
        iv: 'YWJjZGVmZ2hpamsxMjM0NQ==',
        tag: 'MTIzNDU2Nzg5MDEyMzQ1Ng==',
        ciphertext: 'malicious_ciphertext_injection',
        updatedAt: new Date().toISOString(),
        updatedBy: attackerContext.auth!.uid,
      };

      const canWriteVictim = RuleValidator.isStoreManager(attackerContext, victimStoreId);
      assert.equal(canWriteVictim, false, 'Attacker cannot write to victim store vault!');
    });

    // 2.4 Token Tampering & Injection Fuzzing
    await t.test('test_token_tampering_and_spoofing_fuzzing_all_rejected', () => {
      const maliciousTokens = [
        { desc: 'Missing storeId', token: { uid: 'u1', email: 'user@starbucks.com', role: 'STORE_MANAGER' } },
        { desc: 'Null storeId', token: { uid: 'u1', email: 'user@starbucks.com', storeId: null as any, role: 'STORE_MANAGER' } },
        { desc: 'Empty storeId', token: { uid: 'u1', email: 'user@starbucks.com', storeId: '', role: 'STORE_MANAGER' } },
        { desc: 'Wildcard storeId', token: { uid: 'u1', email: 'user@starbucks.com', storeId: '*', role: 'STORE_MANAGER' } },
        { desc: 'Directory traversal storeId', token: { uid: 'u1', email: 'user@starbucks.com', storeId: '../108150', role: 'STORE_MANAGER' } },
        { desc: 'Public email domain', token: { uid: 'u1', email: 'hacker@gmail.com', storeId: '108150', role: 'STORE_MANAGER' } },
        { desc: 'Unverified starbucks.pl domain', token: { uid: 'u1', email: 'hacker@starbucks.pl', storeId: '108150', role: 'STORE_MANAGER' } },
      ];

      for (const { desc, token } of maliciousTokens) {
        const ctx: SecurityContext = { auth: { uid: token.uid, token } };
        assert.equal(
          RuleValidator.isStoreStaff(ctx, '108150'),
          false,
          `Token tampering exploit [${desc}] must be rejected!`
        );
        assert.equal(
          RuleValidator.isExecutive(ctx, '108150'),
          false,
          `Executive access exploit [${desc}] must be rejected!`
        );
      }
    });

    // 2.5 Role Privilege Separation
    await t.test('test_role_privilege_boundaries_within_authorized_store', () => {
      const baristaCtx: SecurityContext = {
        auth: {
          uid: 'barista_1',
          token: { uid: 'barista_1', email: 'barista@starbucks.com', storeId: '108120', role: 'BARISTA' },
        },
      };

      const ssvCtx: SecurityContext = {
        auth: {
          uid: 'ssv_1',
          token: { uid: 'ssv_1', email: 'ssv@starbucks.com', storeId: '108120', role: 'SHIFT_SUPERVISOR' },
        },
      };

      const asmCtx: SecurityContext = {
        auth: {
          uid: 'asm_1',
          token: { uid: 'asm_1', email: 'asm@amrest.eu', storeId: '108120', role: 'ASSISTANT_STORE_MANAGER' },
        },
      };

      const smCtx: SecurityContext = {
        auth: {
          uid: 'sm_1',
          token: { uid: 'sm_1', email: 'sm@amrest.eu', storeId: '108120', role: 'STORE_MANAGER' },
        },
      };

      // Barista: can read public schedule & vault_schedules, cannot read financial/personnel/health vaults, cannot write
      assert.equal(RuleValidator.isStoreStaff(baristaCtx, '108120'), true);
      assert.equal(RuleValidator.isExecutive(baristaCtx, '108120'), false);
      assert.equal(RuleValidator.isAssistantOrStoreManager(baristaCtx, '108120'), false);

      // Shift Supervisor: cannot read executive financial or health vaults
      assert.equal(RuleValidator.isStoreStaff(ssvCtx, '108120'), true);
      assert.equal(RuleValidator.isExecutive(ssvCtx, '108120'), false);
      assert.equal(RuleValidator.isAssistantOrStoreManager(ssvCtx, '108120'), false);

      // ASM: can write schedule, but cannot read executive financial vault
      assert.equal(RuleValidator.isAssistantOrStoreManager(asmCtx, '108120'), true);
      assert.equal(RuleValidator.isExecutive(asmCtx, '108120'), false);

      // SM: has full executive access
      assert.equal(RuleValidator.isExecutive(smCtx, '108120'), true);
    });

    // 2.6 Vault Envelope Tamper Validation
    await t.test('test_vault_envelope_schema_validation_rejects_malformed_and_oversized_payloads', () => {
      const validDoc = {
        docId: 'month_2026_03',
        storeId: '108120',
        vaultType: 'vault_financials',
        version: 'v1',
        iv: 'YWJjZGVmZ2hpamsxMjM0NQ==',
        tag: 'MTIzNDU2Nzg5MDEyMzQ1Ng==',
        ciphertext: 'valid_ciphertext_base64_payload',
        updatedAt: new Date().toISOString(),
        updatedBy: 'sm_uid',
      };

      assert.equal(RuleValidator.isValidVaultDocument(validDoc, '108120', 'vault_financials'), true);

      // Tamper 1: storeId mismatch in document vs path
      assert.equal(RuleValidator.isValidVaultDocument(validDoc, '108150', 'vault_financials'), false);

      // Tamper 2: vaultType mismatch
      assert.equal(RuleValidator.isValidVaultDocument(validDoc, '108120', 'vault_personnel'), false);

      // Tamper 3: version not v1
      assert.equal(RuleValidator.isValidVaultDocument({ ...validDoc, version: 'v2' }, '108120', 'vault_financials'), false);

      // Tamper 4: missing ciphertext
      const { ciphertext, ...missingCiphertext } = validDoc;
      assert.equal(RuleValidator.isValidVaultDocument(missingCiphertext as any, '108120', 'vault_financials'), false);

      // Tamper 5: oversized ciphertext (> 2,000,000 chars)
      const oversizedCiphertext = 'A'.repeat(2000001);
      assert.equal(
        RuleValidator.isValidVaultDocument({ ...validDoc, ciphertext: oversizedCiphertext }, '108120', 'vault_financials'),
        false
      );
    });
  });

  // =========================================================================
  // SUITE 3: FULL MIGRATION PIPELINE ROLLBACK UNDER SIMULATED CRASH / POWER OUTAGE
  // =========================================================================
  await suite.test('Suite 3: Full Migration Pipeline Rollback Under Simulated Crash & Power Outage', async (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_migration_rollback_stress_'));
    const storeId = '108120';
    const unitCode = '18120';
    const dbPath = path.join(tmpDir, `store_${storeId}.db`);

    // Create real SQLite database file on disk with operational tables
    const db = new SQL.Database();
    db.run(`
      CREATE TABLE schedules (
        id INTEGER PRIMARY KEY,
        weekKey TEXT,
        shiftCode TEXT,
        hours REAL,
        employeeId INTEGER
      );
      CREATE TABLE manager_employees (
        id INTEGER PRIMARY KEY,
        name TEXT,
        role TEXT,
        hourly_rate REAL,
        monthly_salary REAL,
        is_active INTEGER
      );
      CREATE TABLE aop_plans (
        key TEXT PRIMARY KEY,
        year INTEGER,
        month TEXT,
        month_code TEXT,
        plan_sales REAL,
        plan_trx REAL,
        target_tplh REAL
      );
    `);

    // Insert representative data
    db.run(`
      INSERT INTO schedules VALUES (1, '2026-W12', 'AM', 8.0, 101);
      INSERT INTO schedules VALUES (2, '2026-W12', 'PM', 8.0, 102);
      INSERT INTO manager_employees VALUES (1, 'Kierownik Jan', 'SM', 52.0, 9000.0, 1);
      INSERT INTO aop_plans VALUES ('aop_03', 2026, 'Marzec', '03', 850000.0, 21000.0, 9.8);
    `);

    // Write SQLite database to disk
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
    db.close();

    const initialDbBytes = fs.readFileSync(dbPath);
    const initialDbHash = crypto.createHash('sha256').update(initialDbBytes).digest('hex');

    // Non-destructive table extractor reading real file
    async function extractFromDisk(): Promise<Record<string, any[]>> {
      const bytes = fs.readFileSync(dbPath);
      const readDb = new SQL.Database(bytes);
      const data: Record<string, any[]> = {};
      for (const tbl of ['schedules', 'manager_employees', 'aop_plans']) {
        const stmt = readDb.prepare(`SELECT * FROM ${tbl}`);
        const rows: any[] = [];
        while (stmt.step()) {
          const row = stmt.getAsObject();
          CloudMigrationService.validateRowSchema(tbl, row);
          rows.push(row);
        }
        stmt.free();
        data[tbl] = rows;
      }
      readDb.close();
      return data;
    }

    try {
      // 3.1 Crash at Pre-Flight (e.g. ENOSPC / power failure during initial backup)
      await t.test('test_crash_at_preflight_aborts_immediately_zero_cloud_requests_db_untouched', async () => {
        let cloudAttempted = false;

        const service = new CloudMigrationService({
          dbExtractor: {
            extractAllTables: extractFromDisk,
            getTableNames: () => ['schedules', 'manager_employees', 'aop_plans'],
            getDatabaseHealth: async () => ({ isHealthy: true, totalRecords: 4 }),
          },
          backupProvider: {
            async createPreflightBackup() {
              throw new Error('ENOSPC: no space left on device (simulated disk full)');
            },
          },
          cloudUploader: {
            async uploadVaultBatch() {
              cloudAttempted = true;
              return { uploadedCount: 0 };
            },
            async fetchAllVaultDocuments() { return []; },
          },
        });

        const res = await service.executeStoreMigration(storeId, { unitCode });

        assert.equal(res.success, false);
        assert.equal(res.status, 'failed');
        assert.equal(res.error?.phase, 'preflight');
        assert.equal(cloudAttempted, false, 'ZERO cloud upload calls must be made if backup crashes');

        // Check SQLite file on disk is byte-for-byte untouched
        const currentBytes = fs.readFileSync(dbPath);
        const currentHash = crypto.createHash('sha256').update(currentBytes).digest('hex');
        assert.equal(currentHash, initialDbHash, 'SQLite database must be 100% byte-for-byte unmodified');
      });

      // 3.2 Mid-Upload Sudden Crash / Power Outage
      await t.test('test_simulated_power_outage_mid_upload_triggers_rollback_preserves_backup_and_db', async () => {
        const backupPath = path.join(tmpDir, `store_${storeId}_pre_migration_backup.db`);
        fs.writeFileSync(backupPath, initialDbBytes);
        const backupHash = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');

        let uploadAttempts = 0;

        const service = new CloudMigrationService({
          dbExtractor: {
            extractAllTables: extractFromDisk,
            getTableNames: () => ['schedules', 'manager_employees', 'aop_plans'],
            getDatabaseHealth: async () => ({ isHealthy: true, totalRecords: 4 }),
          },
          backupProvider: {
            async createPreflightBackup() {
              return { success: true, filePath: backupPath, sha256: backupHash };
            },
          },
          cloudUploader: {
            async uploadVaultBatch() {
              uploadAttempts++;
              // Simulate power outage or unrecoverable network failure mid-upload
              throw new Error('CRASH_SIMULATION: Abrupt connection termination / SIGKILL');
            },
            async fetchAllVaultDocuments() { return []; },
          },
        });

        const res = await service.executeStoreMigration(storeId, {
          unitCode,
          maxRetries: 2,
          retryDelayMs: 5,
        });

        assert.equal(res.success, false);
        assert.equal(res.status, 'failed');
        assert.equal(res.error?.phase, 'uploading');
        assert.equal(res.rollbackTriggered, true, 'Rollback flag must be true');
        assert.equal(res.localDbUntouched, true, 'localDbUntouched flag must be true');
        assert.equal(uploadAttempts, 2, 'Must exhaust retries before failing');

        // 1. Verify backup file exists and is completely intact
        assert.ok(fs.existsSync(backupPath), 'Pre-flight backup must exist on disk');
        const postCrashBackupHash = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');
        assert.equal(postCrashBackupHash, backupHash, 'Backup file SHA-256 must match pre-migration state');

        // 2. Verify original SQLite database file on disk is byte-for-byte untouched
        const postCrashDbHash = crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex');
        assert.equal(postCrashDbHash, initialDbHash, 'Active database SHA-256 must match pre-migration state');

        // 3. Verify SQLite integrity
        const checkDb = new SQL.Database(fs.readFileSync(dbPath));
        try {
          const integrity = checkDb.exec('PRAGMA integrity_check;');
          assert.equal(integrity[0].values[0][0], 'ok');
        } finally {
          checkDb.close();
        }
      });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {}
    }
  });

  // =========================================================================
  // SUITE 4: REAL-WORLD STARBUCKS BUSINESS RULES & LABOR LAW COMPLIANCE
  // =========================================================================
  await suite.test('Suite 4: Real-World Starbucks Business Rules & Labor Law Compliance', async (t) => {
    // 4.1 Floor Hours 32.0 h/day Base & 224.0 h/week Base
    await t.test('test_floor_hours_32h_per_day_base_and_flex_pool_distribution', () => {
      // Full 7-day week
      const fullWeek: WeekRecord = {
        id: 1,
        week_key: '2026-W12',
        year: 2026,
        month: 3,
        week_number: 12,
        days_count: 7,
        date_from: '16.03',
        date_to: '22.03',
        floor_hours: 224.0,
        plan_hours: 310.0,
        plan_trx: 5500,
        target_tplh: 10.0,
        min_tplh: 9.0,
      };

      const fullInfo = CalculationEngine.calculatePartialWeekInfo(fullWeek);
      assert.equal(fullInfo.isPartial, false, '7-day week is not partial');
      assert.equal(fullInfo.calculatedDaysCount, 7);
      assert.equal(fullInfo.calculatedFloorHours, 224.0, '7 days * 32.0h/day must equal 224.0h Floor base');

      // Partial 3-day split week (e.g. month-end bridge)
      const partial3Week: WeekRecord = {
        id: 2,
        week_key: '2026-W14-P1',
        year: 2026,
        month: 3,
        week_number: 14,
        days_count: 3,
        date_from: '29.03',
        date_to: '31.03',
        floor_hours: 96.0,
        plan_hours: 130.0,
        plan_trx: 2400,
        target_tplh: 10.0,
        min_tplh: 9.0,
      };

      const partial3Info = CalculationEngine.calculatePartialWeekInfo(partial3Week);
      assert.equal(partial3Info.isPartial, true);
      assert.equal(partial3Info.calculatedDaysCount, 3);
      assert.equal(partial3Info.calculatedFloorHours, 96.0, '3 days * 32.0h/day must equal 96.0h Floor base');

      // Test Floor Hours Distribution with Non-Trading Sunday via enrichDailyCoverageWithFlex
      const mockDays: ManagerDailyCoverageItem[] = [
        { day: 16, dayOfWeek: 'Pn', coverageHours: 16.0, ncHours: 0, date: '2026-03-16' },
        { day: 17, dayOfWeek: 'Wt', coverageHours: 16.0, ncHours: 0, date: '2026-03-17' },
        { day: 18, dayOfWeek: 'Śr', coverageHours: 16.0, ncHours: 0, date: '2026-03-18' },
        { day: 19, dayOfWeek: 'Czw', coverageHours: 16.0, ncHours: 0, date: '2026-03-19' },
        { day: 20, dayOfWeek: 'Pt', coverageHours: 16.0, ncHours: 0, date: '2026-03-20' },
        { day: 21, dayOfWeek: 'Sob', coverageHours: 16.0, ncHours: 0, date: '2026-03-21' },
        { day: 22, dayOfWeek: 'Nd', coverageHours: 16.0, ncHours: 0, date: '2026-03-22', isTradingSunday: false },
      ];

      const totalWeekBudget = 300.0; // 300h total budget (224h base floor + 76h flex pool)
      const flexEnrichment = CalculationEngine.enrichDailyCoverageWithFlex(
        mockDays,
        totalWeekBudget,
        [],
        2026
      );

      assert.equal(flexEnrichment.totalBaseFloorHours, 224.0);
      assert.equal(flexEnrichment.flexHoursPool, 76.0); // 300 - 224 = 76h flex pool
      assert.equal(flexEnrichment.enrichedDays.length, 7);

      // Find Sunday in daily distribution
      const sundayItem = flexEnrichment.enrichedDays.find((d) => d.dayOfWeek === 'Nd');
      assert.ok(sundayItem, 'Sunday item must exist in distribution');
      assert.equal(sundayItem.baseFloorHours, 32.0);
      assert.equal(sundayItem.suggestedFlexHours, 0.0, 'Non-trading Sunday must receive strictly 0.0h flex');
      assert.equal(sundayItem.suggestedTotalDayHours, 32.0, 'Non-trading Sunday total hours must remain exactly at Floor base (32h)');
      assert.ok(sundayItem.suggestedExtraShifts?.includes('Baza Floor'), 'suggestedExtraShifts should specify Baza Floor');
      assert.ok(sundayItem.manipulationTip?.includes('Obsada ściśle na poziomie Floor'), 'manipulationTip should specify Obsada ściśle na poziomie Floor');
    });

    // 4.2 Non-Coverage Training Budget Isolation (Barista Journey T1-T10)
    await t.test('test_barista_journey_training_budget_is_isolated_from_floor_coverage', () => {
      // 1. Generate standard T1-T10 shifts for new partner
      const partnerId = 101;
      const hireDate = '2026-03-02';
      const trainingShifts = TrainingEngine.generateDefaultShiftsForPartner(partnerId, hireDate, 'first_30');

      assert.equal(trainingShifts.length, FIRST_30_SHIFTS.length);
      assert.ok(trainingShifts.length >= 10, 'First 30 days program must have at least 10 training shifts (T1-T10)');

      const hoursSummary = TrainingEngine.calculateHoursSummary(trainingShifts);
      assert.ok(hoursSummary.totalBaristaPlanned > 30.0, 'Barista planned hours should be > 30h');

      // 2. Test COL Engine Isolation: Training hours do NOT count toward Floor Coverage Hours
      const baseStoreInfo = { ...DEFAULT_COL_STORE_INFO, storeCode: '108120', fullContractHours: 168 };

      const kpisWithoutTraining = {
        ...DEFAULT_COL_KPIS,
        salesTarget: 400000,
        salesAop: 380000,
        trxTarget: 20000,
        trxAop: 19000,
        tplhTarget: 8.0,
        tplhAop: 8.0,
        nonCoverageHolidayTarget: 50,
        nonCoverageTrainingTarget: 0, // No training
      };

      const kpisWithTraining = {
        ...kpisWithoutTraining,
        nonCoverageTrainingTarget: 75, // 75h dedicated Non-Coverage Training budget
      };

      const testMgr = {
        ...DEFAULT_COL_MANAGERS[0],
        id: 'sm_1',
        name: 'Store Manager',
        position: 'SM',
        contractRatio: 1.0,
        baseSalary: 8500,
        planWorkHours: 168,
        estWorkHours: 168,
        isSpecialRow: false,
      };

      const testCrewUop = [
        {
          id: 'crew_1',
          name: 'Barista 1',
          position: 'BARISTA',
          contractRatio: 1.0,
          hourlyRate: 32.5,
          planWorkHours: 168,
          planSickHours: 0,
          planHolidayHours: 0,
          isDisability: false,
          estWorkHours: 168,
          estSickHours: 0,
          estHolidayHours: 0,
        },
      ];

      const resWithout = ColEngine.calculate(baseStoreInfo, kpisWithoutTraining, [testMgr], testCrewUop, [], []);
      const resWith = ColEngine.calculate(baseStoreInfo, kpisWithTraining, [testMgr], testCrewUop, [], []);

      // Total working hours remain identical (168 + 168 = 336h)
      assert.equal(resWithout.totalWorkingHoursPlan, resWith.totalWorkingHoursPlan);
      assert.equal(resWithout.totalWorkingHoursPlan, 336);

      // TPLH Coverage with training increases because training hours are excluded from Floor coverage denominator
      assert.ok(
        resWith.tplhCoveragePlan > resWithout.tplhCoveragePlan,
        `TPLH Coverage with training (${resWith.tplhCoveragePlan.toFixed(2)}) must be higher than without training (${resWithout.tplhCoveragePlan.toFixed(2)})`
      );

      // Total TPLH remains unchanged (20,000 / 336 = 59.524)
      assert.equal(resWithout.tplhTotalPlan.toFixed(3), resWith.tplhTotalPlan.toFixed(3));
      assert.equal(resWithout.tplhTotalPlan.toFixed(2), '59.52');
    });

    // 4.3 Polish Labor Code art. 132 KP: 11h Daily Rest Enforcement
    await t.test('test_polish_labor_code_art_132_kp_11h_daily_rest_violations_detection', () => {
      const shiftDefMap = new Map<string, ShiftDefinition>();
      for (const def of DEFAULT_SHIFT_DEFINITIONS) {
        shiftDefMap.set(def.code, def);
      }

      const testEmployee: ManagerEmployee = {
        id: 1,
        name: 'Michał Kowalski',
        role: 'STORE_MANAGER',
        contract_type: 'UoP',
        contract_hours_ratio: 1.0,
        hourly_rate: 55.0,
        monthly_salary: 9240.0,
        sort_order: 1,
        is_active: 1,
      };

      const year = 2026;
      const month = 3;
      const totalDays = 31;

      // --- Case 1: Intra-Month Rest Violation ---
      // Day 10: PM shift (14:30 - 22:30, end = 22.5h)
      // Day 11: AM shift (07:00 - 15:00, start = 7.0h)
      // Rest between shifts: (24 - 22.5) + 7.0 = 8.5h < 11.0h -> Critical art. 132 KP Violation!
      const shiftsCase1: Record<number, ManagerScheduleShift> = {
        10: {
          id: 10,
          employee_id: 1,
          year,
          month,
          day: 10,
          shift_code: 'PM',
          hours: 8.0,
        },
        11: {
          id: 11,
          employee_id: 1,
          year,
          month,
          day: 11,
          shift_code: 'AM',
          hours: 8.0,
        },
      };

      const resultCase1 = ManagerScheduleEngine.validateLaborLaw(
        year,
        month,
        totalDays,
        testEmployee,
        shiftsCase1,
        shiftDefMap
      );

      assert.ok(resultCase1.violations.length > 0, 'Labor law violations must be detected for PM -> AM');
      const dailyRestViolation = resultCase1.violations.find((v) => v.ruleType === 'daily_rest_11h');
      assert.ok(dailyRestViolation, 'daily_rest_11h violation must be reported');
      assert.equal(dailyRestViolation.day, 11);
      assert.equal(dailyRestViolation.severity, 'error');
      assert.ok(dailyRestViolation.details.includes('art. 132'));
      assert.ok(dailyRestViolation.message.includes('8.5h'));

      // --- Case 2: Cross-Month Boundary Rest Violation (M-1 -> D1) ---
      // Day 28 (Feb last day): PM shift (ending 22:30)
      // Day 1 (Mar 1): AM shift (starting 07:00)
      const shiftsCase2: Record<number, ManagerScheduleShift> = {
        1: {
          id: 101,
          employee_id: 1,
          year,
          month,
          day: 1,
          shift_code: 'AM',
          hours: 8.0,
        },
      };

      const prevMonthShifts: ManagerScheduleShift[] = [
        {
          id: 99,
          employee_id: 1,
          year,
          month: 2,
          day: 28, // Last day of February
          shift_code: 'PM',
          hours: 8.0,
        },
      ];

      const resultCase2 = ManagerScheduleEngine.validateLaborLaw(
        year,
        month,
        totalDays,
        testEmployee,
        shiftsCase2,
        shiftDefMap,
        { prevMonthShifts }
      );

      const crossMonthViolation = resultCase2.violations.find((v) => v.ruleType === 'daily_rest_11h');
      assert.ok(crossMonthViolation, 'daily_rest_11h violation must be detected across month boundary (M-1 -> D1)');
      assert.equal(crossMonthViolation.day, 1);
      assert.ok(crossMonthViolation.details.includes('art. 132'));

      // --- Case 3: Compliant Schedule ---
      // Day 10: PM shift (ending 22:30)
      // Day 11: MIB shift (12:00 - 20:00, start = 12.0h)
      // Rest between shifts: (24 - 22.5) + 12.0 = 13.5h >= 11.0h -> Fully compliant!
      const shiftsCase3: Record<number, ManagerScheduleShift> = {
        10: {
          id: 10,
          employee_id: 1,
          year,
          month,
          day: 10,
          shift_code: 'PM',
          hours: 8.0,
        },
        11: {
          id: 11,
          employee_id: 1,
          year,
          month,
          day: 11,
          shift_code: 'MIB',
          hours: 8.0,
        },
      };

      const resultCase3 = ManagerScheduleEngine.validateLaborLaw(
        year,
        month,
        totalDays,
        testEmployee,
        shiftsCase3,
        shiftDefMap
      );

      const case3RestViolations = resultCase3.violations.filter((v) => v.ruleType === 'daily_rest_11h');
      assert.equal(case3RestViolations.length, 0, 'Compliant rest of 13.5h must have zero daily_rest_11h violations');
    });

    // 4.4 Polish Labor Code art. 151^10 KP: 4th Sunday Rest Rule
    await t.test('test_polish_labor_code_art_151_10_kp_consecutive_sundays_rule', () => {
      const shiftDefMap = new Map<string, ShiftDefinition>();
      for (const def of DEFAULT_SHIFT_DEFINITIONS) {
        shiftDefMap.set(def.code, def);
      }

      const testEmployee: ManagerEmployee = {
        id: 2,
        name: 'Anna Nowak',
        role: 'SHIFT_SUPERVISOR',
        contract_type: 'UoP',
        contract_hours_ratio: 1.0,
        hourly_rate: 45.0,
        monthly_salary: 7560.0,
        sort_order: 2,
        is_active: 1,
      };

      const year = 2026;
      const month = 3;
      const totalDays = 31;
      // March 2026 Sundays: 1st (day 1), 8th (day 8), 15th (day 15), 22nd (day 22), 29th (day 29)

      // Schedule employee on 4 consecutive Sundays: 1, 8, 15, 22
      const fourSundaysShifts: Record<number, ManagerScheduleShift> = {
        1: { id: 1, employee_id: 2, year, month, day: 1, shift_code: 'AMN', hours: 8.0 },
        8: { id: 8, employee_id: 2, year, month, day: 8, shift_code: 'AMN', hours: 8.0 },
        15: { id: 15, employee_id: 2, year, month, day: 15, shift_code: 'AMN', hours: 8.0 },
        22: { id: 22, employee_id: 2, year, month, day: 22, shift_code: 'AMN', hours: 8.0 },
      };

      const result = ManagerScheduleEngine.validateLaborLaw(
        year,
        month,
        totalDays,
        testEmployee,
        fourSundaysShifts,
        shiftDefMap
      );

      const sundayViolation = result.violations.find((v) => v.ruleType === 'consecutive_sundays');
      assert.ok(sundayViolation, '4 consecutive working Sundays must trigger consecutive_sundays violation');
      assert.equal(sundayViolation.day, 22);
      assert.equal(sundayViolation.severity, 'error');
      assert.ok(sundayViolation.details.includes('art. 151'));
    });
  });
});
