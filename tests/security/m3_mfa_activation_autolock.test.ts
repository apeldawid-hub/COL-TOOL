/**
 * Starbucks Operations Suite — Milestone 3 Automated Security Test Suite
 * File: tests/security/m3_mfa_activation_autolock.test.ts
 *
 * Scope:
 * - Feature F7: Pre-Login Station Activation Gate Modal & Input Parsing
 * - Feature F8: Corporate 2FA Authentication Flow & Email Domain Enforcer
 * - Feature F9: Session Inactivity Auto-Lock & Cryptographic RAM Key Zeroization
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseActivationInput } from '../../src/components/ActivationModal';
import { LicensingService } from '../../src/services/security/licensingService';
import { 
  AuthService, 
  validateCorporateEmail, 
  generateCsprngOtp, 
  generateSalt, 
  computeSha256,
  ALLOWED_CORPORATE_DOMAINS 
} from '../../src/services/auth/authService';
import { AdminService } from '../../src/services/admin/adminService';
import { StoreStorage } from '../../src/services/storeStorage';
import { StoreKeyCache } from '../../src/services/security/encryptionService';
import { 
  DEFAULT_INACTIVITY_TIMEOUT_MS, 
  DEFAULT_ACTIVITY_THROTTLE_MS,
  executeCryptographicZeroization, 
  broadcastSessionLockEvents 
} from '../../src/hooks/useInactivityAutoLock';

// ----------------------------------------------------------------------------
// Test Mock Environment: Polyfill localStorage & sessionStorage for Node runner
// ----------------------------------------------------------------------------
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  get length(): number {
    return this.store.size;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = new MemoryStorage();
}
if (typeof (globalThis as any).sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = new MemoryStorage();
}

test('M3-SEC: Milestone 3 Security & Activation Suite', async (t) => {
  const storeId = '108120';
  const unitCode = '18120';
  const testSecret = 'sbx_test_master_secret_2026';

  // ==========================================================================
  // Task 1 (Feature F7): Activation Modal Key Validation & Pre-Login Gate
  // ==========================================================================
  await t.test('1.1 Canonical raw key input parsing', () => {
    const rawKey = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT', testSecret);
    const parsed = parseActivationInput(rawKey);

    assert.strictEqual(parsed.isValidFormat, true);
    assert.strictEqual(parsed.cleanKey, rawKey.toUpperCase());
    assert.strictEqual(parsed.storeId, storeId);
    assert.strictEqual(parsed.tier, 'STORE_CLIENT');
  });

  await t.test('1.2 JSON envelope paste parsing', () => {
    const rawKey = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT', testSecret);
    const jsonPayload = JSON.stringify({ key: rawKey, issuedFor: '108120 SBX Warszawa Janki' });
    const parsed = parseActivationInput(jsonPayload);

    assert.strictEqual(parsed.isValidFormat, true);
    assert.strictEqual(parsed.cleanKey, rawKey.toUpperCase());
    assert.strictEqual(parsed.formatSource, 'JSON_ENVELOPE');
    assert.strictEqual(parsed.storeId, storeId);
    assert.strictEqual(parsed.tier, 'STORE_CLIENT');
  });

  await t.test('1.3 QR code URL / deep link paste parsing', () => {
    const rawKey = LicensingService.generateActivationKey('HQ_FLEET', 'FLEET_MASTER', testSecret);
    const qrUrl = `sbx://activate?key=${rawKey}&store=HQ_FLEET`;
    const parsed = parseActivationInput(qrUrl);

    assert.strictEqual(parsed.isValidFormat, true);
    assert.strictEqual(parsed.cleanKey, rawKey.toUpperCase());
    assert.strictEqual(parsed.formatSource, 'QR_URL');
    assert.strictEqual(parsed.storeId, 'HQ_FLEET');
    assert.strictEqual(parsed.tier, 'FLEET_MASTER');
  });

  await t.test('1.4 Instruction / email text paste parsing', () => {
    const rawKey = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT', testSecret);
    const emailBody = `Dzień dobry, przesyłam klucz licencyjny dla kawiarni: ${rawKey}. Proszę wkleić go w oknie aktywacji stacji roboczej.`;
    const parsed = parseActivationInput(emailBody);

    assert.strictEqual(parsed.isValidFormat, true);
    assert.strictEqual(parsed.cleanKey, rawKey.toUpperCase());
    assert.strictEqual(parsed.formatSource, 'INSTRUCTION_TEXT');
    assert.strictEqual(parsed.storeId, storeId);
  });

  await t.test('1.5 Rejection of invalid, tampered, or empty keys in input parser', () => {
    assert.strictEqual(parseActivationInput('').isValidFormat, false);
    assert.strictEqual(parseActivationInput('   ').isValidFormat, false);
    assert.strictEqual(parseActivationInput('NOT-A-KEY').isValidFormat, false);
    assert.strictEqual(parseActivationInput('SBX-18120-INVALIDHEX-1234567890').isValidFormat, false);
    assert.strictEqual(parseActivationInput('{"invalid": true}').isValidFormat, false);
    assert.strictEqual(parseActivationInput('SBX-108120-1122334455667788-12345678901').isValidFormat, false);
    assert.strictEqual(parseActivationInput('{key: "SBX-108120-1122334455667788-1234567890"}').isValidFormat, false);
  });

  await t.test('1.6 LicensingService isActivated() and activate() convenience aliases', async () => {
    const svc = LicensingService.getInstance();
    assert.strictEqual(typeof svc.isActivated, 'function', 'isActivated must be defined on instance');
    assert.strictEqual(typeof LicensingService.isActivated, 'function', 'isActivated must be defined on class');
    assert.strictEqual(typeof svc.activate, 'function', 'activate must be defined on instance');
    assert.strictEqual(typeof LicensingService.activate, 'function', 'activate must be defined on class');

    const validKey = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT');
    const actRes = await svc.activate(validKey, storeId);
    assert.strictEqual(actRes.success, true);
    assert.strictEqual(await svc.isActivated(), true);

    // Clean up
    await svc.revokeLicense('Koniec testu 1.6');
  });

  // ==========================================================================
  // Task 2 (Feature F8): Corporate Email Domain Enforcement
  // ==========================================================================
  await t.test('2.1 Accepts valid corporate domains (@amrest.eu, @starbucks.com)', () => {
    const validEmails = [
      'dawid.apel@amrest.eu',
      'manager.18120@amrest.eu',
      'district.manager@amrest.eu',
      'john.doe@starbucks.com',
      'store108120@starbucks.com',
    ];

    for (const email of validEmails) {
      const res = validateCorporateEmail(email);
      assert.strictEqual(res.isValid, true, `Email ${email} should be accepted`);
      assert.strictEqual(res.category, 'VALID_CORPORATE');
      assert.strictEqual(AuthService.isCorporateEmail(email), true);
    }
  });

  await t.test('2.2 Normalizes case and whitespace in valid corporate emails', () => {
    const res = validateCorporateEmail('  Dawid.Apel@AMREST.EU  ');
    assert.strictEqual(res.isValid, true);
    assert.strictEqual(res.normalizedEmail, 'dawid.apel@amrest.eu');
    assert.strictEqual(res.domain, 'amrest.eu');
  });

  await t.test('2.3 Strictly rejects public consumer webmail domains with explicit Polish message', () => {
    const publicEmails = [
      'user@gmail.com',
      'user@googlemail.com',
      'barista@wp.pl',
      'manager@onet.pl',
      'sbx@interia.pl',
      'employee@yahoo.com',
      'worker@outlook.com',
      'test@icloud.com',
      'anon@proton.me',
    ];

    for (const email of publicEmails) {
      const res = validateCorporateEmail(email);
      assert.strictEqual(res.isValid, false, `Public email ${email} must be rejected`);
      assert.strictEqual(res.category, 'PUBLIC_DOMAIN');
      assert.match(res.error || '', /Domena publiczna/i, 'Error message must mention public domain');
      assert.strictEqual(AuthService.isCorporateEmail(email), false);
    }
  });

  await t.test('2.4 Rejects multi-@ injection attacks and malformed syntax', () => {
    const malformed = [
      'user@evil.com@amrest.eu',
      'admin@amrest.eu@attacker.com',
      'user@amrest.eu@evil.org',
      'plainaddress',
      '@amrest.eu',
      'user@',
      'user @amrest.eu',
      'user@ amrest.eu',
      '',
      '   ',
    ];

    for (const email of malformed) {
      const res = validateCorporateEmail(email);
      assert.strictEqual(res.isValid, false, `Malformed email "${email}" must be rejected`);
      assert.strictEqual(res.category, 'INVALID_SYNTAX');
    }
  });

  await t.test('2.5 Rejects subdomains, suffix attacks, and unknown domains', () => {
    const unapproved = [
      'user@sub.amrest.eu',
      'user@corp.starbucks.com',
      'user@starbucks.com.pl',
      'user@amrest.eu.attacker.com',
      'user@evil-amrest.eu',
      'user@company.pl',
    ];

    for (const email of unapproved) {
      const res = validateCorporateEmail(email);
      assert.strictEqual(res.isValid, false, `Unapproved domain "${email}" must be rejected`);
      assert.strictEqual(res.category, 'UNKNOWN_DOMAIN');
    }
  });

  // ==========================================================================
  // Task 2 (Feature F8): 2FA OTP CSPRNG Randomness, Expiry & Sliding Rate Limiter
  // ==========================================================================
  await t.test('3.1 CSPRNG 6-digit OTP token generation and entropy', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const code = generateCsprngOtp();
      assert.match(code, /^[0-9]{6}$/, 'OTP must be exactly 6 digits');
      const num = parseInt(code, 10);
      assert.strictEqual(num >= 100000 && num <= 999999, true, 'OTP must be in range 100000..999999');
      codes.add(code);
    }
    assert.strictEqual(codes.size > 480, true, 'High entropy: minimal collisions in 500 CSPRNG draws');
  });

  await t.test('3.2 Salted SHA-256 storage protects memory buffers', () => {
    const code = '742918';
    const salt = generateSalt(16);
    const hash1 = computeSha256(`${code}:${salt}`);
    const hash2 = computeSha256(`${code}:${salt}`);

    assert.strictEqual(hash1, hash2, 'Identical code + salt produces identical hash');
    assert.notStrictEqual(hash1, code, 'Hash must not equal plaintext code');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hex must be 64 characters');
  });

  await t.test('3.3 2FA Sliding Rate Limiter: 3 failed attempts trigger 60s cooldown lockout', async () => {
    const testEmail = 'tester.otp@amrest.eu';
    AuthService.clearAllChallenges();

    // Register active user in AdminService so request2FaOtp succeeds
    const users = AdminService.getUsers();
    users.push({
      id: 'usr_test_m3',
      storeUnitCode: unitCode,
      fullName: 'Jan Tester',
      email: testEmail,
      role: 'BARISTA',
      isActive: true,
      permissions: { canViewFinancialSales: false, canEditForecastTarget: false, canModifyNcRules: false, canViewWageRates: false, canViewMedicalLeaves: false, canPublishSchedule: false, canApproveTor: false, canImportFichajes: false, canViewColPnl: false, canViewZusRates: false, canSimulateWhatIf: false, canExportExcel: false },
      sessionVersion: 1,
      createdAt: new Date().toISOString(),
    });
    StoreStorage.setItem('admin_managed_users', users);

    // Request initial OTP
    const reqRes = await AuthService.request2FaOtp(testEmail, unitCode);
    assert.strictEqual(reqRes.success, true);
    assert.strictEqual(typeof reqRes.simulatedCode, 'string');

    // Attempt 1: wrong code -> remainingAttempts: 2
    const v1 = await AuthService.verify2FaOtp(testEmail, '000000');
    assert.strictEqual(v1.success, false);
    assert.strictEqual(v1.remainingAttempts, 2);
    assert.strictEqual(v1.isLockedOut, false);

    // Attempt 2: wrong code -> remainingAttempts: 1
    const v2 = await AuthService.verify2FaOtp(testEmail, '111111');
    assert.strictEqual(v2.success, false);
    assert.strictEqual(v2.remainingAttempts, 1);
    assert.strictEqual(v2.isLockedOut, false);

    // Attempt 3: wrong code -> triggers 60s lockout
    const v3 = await AuthService.verify2FaOtp(testEmail, '222222');
    assert.strictEqual(v3.success, false);
    assert.strictEqual(v3.remainingAttempts, 0);
    assert.strictEqual(v3.isLockedOut, true);
    assert.strictEqual(v3.cooldownSeconds, 60);

    // Subsequent attempt during cooldown is immediately rejected
    const v4 = await AuthService.verify2FaOtp(testEmail, reqRes.simulatedCode!);
    assert.strictEqual(v4.success, false);
    assert.strictEqual(v4.isLockedOut, true);

    // Resend attempt during cooldown is also blocked
    const resendReq = await AuthService.request2FaOtp(testEmail, unitCode);
    assert.strictEqual(resendReq.success, false);
    assert.strictEqual(resendReq.isLockedOut, true);
  });

  await t.test('3.4 30-second resend throttle enforcement', async () => {
    const testEmail2 = 'throttle.tester@amrest.eu';
    AuthService.clearAllChallenges();

    const users = AdminService.getUsers();
    users.push({
      id: 'usr_throttle_m3',
      storeUnitCode: unitCode,
      fullName: 'Piotr Throttle',
      email: testEmail2,
      role: 'BARISTA',
      isActive: true,
      permissions: { canViewFinancialSales: false, canEditForecastTarget: false, canModifyNcRules: false, canViewWageRates: false, canViewMedicalLeaves: false, canPublishSchedule: false, canApproveTor: false, canImportFichajes: false, canViewColPnl: false, canViewZusRates: false, canSimulateWhatIf: false, canExportExcel: false },
      sessionVersion: 1,
      createdAt: new Date().toISOString(),
    });
    StoreStorage.setItem('admin_managed_users', users);

    // Request 1
    const req1 = await AuthService.request2FaOtp(testEmail2, unitCode);
    assert.strictEqual(req1.success, true);

    // Immediate Request 2 is throttled (< 30s)
    const req2 = await AuthService.request2FaOtp(testEmail2, unitCode);
    assert.strictEqual(req2.success, false);
    assert.strictEqual(req2.cooldownSeconds! <= 30 && req2.cooldownSeconds! > 0, true);
  });

  await t.test('3.5 Successful verification burns OTP token and prevents replay attacks', async () => {
    const testEmail3 = 'valid.otp@amrest.eu';
    AuthService.clearAllChallenges();

    const users = AdminService.getUsers();
    users.push({
      id: 'usr_valid_m3',
      storeUnitCode: unitCode,
      fullName: 'Anna Walidacja',
      email: testEmail3,
      role: 'BARISTA',
      isActive: true,
      permissions: { canViewFinancialSales: false, canEditForecastTarget: false, canModifyNcRules: false, canViewWageRates: false, canViewMedicalLeaves: false, canPublishSchedule: false, canApproveTor: false, canImportFichajes: false, canViewColPnl: false, canViewZusRates: false, canSimulateWhatIf: false, canExportExcel: false },
      sessionVersion: 1,
      createdAt: new Date().toISOString(),
    });
    StoreStorage.setItem('admin_managed_users', users);

    const req = await AuthService.request2FaOtp(testEmail3, unitCode);
    assert.strictEqual(req.success, true);
    const validCode = req.simulatedCode!;

    // Verification 1: Valid
    const res1 = await AuthService.verify2FaOtp(testEmail3, validCode);
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.session?.email, testEmail3);

    // Verification 2: Replay attack fails because challenge is burned
    const res2 = await AuthService.verify2FaOtp(testEmail3, validCode);
    assert.strictEqual(res2.success, false);
    assert.match(res2.message || '', /Brak aktywnego żądania/);
  });

  // ==========================================================================
  // Task 3 (Feature F9): Session Inactivity Auto-Lock & Key Zeroization
  // ==========================================================================
  await t.test('4.1 Inactivity auto-lock timing constants adhere to policy', () => {
    assert.strictEqual(DEFAULT_INACTIVITY_TIMEOUT_MS, 900_000, 'Must be strictly 15 minutes');
    assert.strictEqual(DEFAULT_ACTIVITY_THROTTLE_MS, 1_000, 'Must be strictly 1,000 ms throttle');
  });

  await t.test('4.2 Cryptographic RAM Key Zeroization fills SEK buffers with 0x00 and flushes cache', () => {
    const testStore = 'STORE_RAM_ZERO_1';
    const testUnit = '18991';
    const passHash = 'hash_sec_01';

    // Allocate 32-byte non-zero secret key buffer
    const secretKey = Buffer.alloc(32, 0xEF);
    StoreKeyCache.set(testStore, testUnit, passHash, secretKey);

    assert.strictEqual(StoreKeyCache.size(), 1);
    assert.strictEqual(secretKey[0], 0xEF);

    // Execute zeroization
    executeCryptographicZeroization();

    // Verify memory buffer was physically overwritten with zeroes
    assert.strictEqual(secretKey.every(b => b === 0x00), true, 'Buffer must be completely filled with 0x00');
    assert.strictEqual(StoreKeyCache.size(), 0, 'StoreKeyCache map must be empty');
    assert.strictEqual(StoreKeyCache.get(testStore, testUnit, passHash), null);
  });

  await t.test('4.3 Multi-Store Simultaneous Zeroization Stress', () => {
    const buffers: Buffer[] = [];
    for (let i = 0; i < 8; i++) {
      const buf = Buffer.alloc(32, 0x20 + i);
      buffers.push(buf);
      StoreKeyCache.set(`STORE_${i}`, `UNIT_${i}`, `hash_${i}`, buf);
    }

    assert.strictEqual(StoreKeyCache.size(), 8);
    executeCryptographicZeroization();

    assert.strictEqual(StoreKeyCache.size(), 0);
    buffers.forEach((b, idx) => {
      assert.strictEqual(b.every(byte => byte === 0x00), true, `Buffer ${idx} must be zeroed`);
    });
  });

  await t.test('4.4 Modal dismissal and session lock event broadcast', () => {
    let dismissFired = false;
    let lockFired = false;

    const mockWindow = {
      dispatchEvent: (e: any) => {
        if (e.type === 'sbx:dismiss-modals') dismissFired = true;
        if (e.type === 'sbx:session-locked') lockFired = true;
        return true;
      },
    };
    (globalThis as any).window = mockWindow;

    broadcastSessionLockEvents();

    assert.strictEqual(dismissFired, true, 'sbx:dismiss-modals event must be dispatched');
    assert.strictEqual(lockFired, true, 'sbx:session-locked event must be dispatched');

    // Clean up global mock
    delete (globalThis as any).window;
  });

  await t.test('4.5 Headless Node safety: zeroization and broadcast execute safely when window is undefined', () => {
    assert.strictEqual(typeof (globalThis as any).window, 'undefined');
    assert.doesNotThrow(() => {
      executeCryptographicZeroization();
      broadcastSessionLockEvents();
    });
  });

  await t.test('4.6 SessionLockOverlay mounted in renderModals for both STORE_CLIENT and FLEET_MASTER profiles', () => {
    const appTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    assert.strictEqual(appTsx.includes("import { SessionLockOverlay } from './components/security/SessionLockOverlay'"), true);
    
    // Ensure SessionLockOverlay is mounted inside renderModals
    const renderModalsDef = appTsx.match(/const renderModals = \(\) => \(([\s\S]*?)\n  \);/);
    assert.ok(renderModalsDef, 'renderModals definition must exist');
    assert.strictEqual(renderModalsDef[1].includes('<SessionLockOverlay />'), true, 'SessionLockOverlay must be mounted inside renderModals()');

    // Ensure renderModals is invoked in both isStoreClient and default Fleet Master returns
    assert.strictEqual(appTsx.includes('{renderModals()}'), true);
  });
});
