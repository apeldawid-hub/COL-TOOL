/**
 * Starbucks Operations Suite — Milestone 3 Challenger 2 Empirical Stress Test Suite
 * File: tests/security/m3_challenger2_mfa_autolock_stress.test.ts
 *
 * Adversarial Empirical Verification for:
 * 1. 2FA CSPRNG Randomness & Entropy Analysis (1,000 OTP draws, run tests, frequency distribution)
 * 2. Sliding Rate Limiter & 60s Cooldown Lockout (3 failed attempts -> 4th blocked, case-insensitivity)
 * 3. 30s Resend Throttle Resilience (rapid burst attempts, case bypass resistance)
 * 4. Token Replay Protection (immediate re-verification, concurrent racing verification)
 * 5. Inactivity Auto-Lock & Cryptographic Zeroization (RAM buffer physical 0x00 wipe, cache wipe)
 * 6. Modal Dismissal and Event Broadcasting (sbx:dismiss-modals & sbx:session-locked delivery)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  AuthService, 
  generateCsprngOtp, 
  generateSalt, 
  computeSha256,
  validateCorporateEmail 
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

// Polyfill in-memory storage for headless Node test runner
class MockMemoryStorage {
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
  (globalThis as any).localStorage = new MockMemoryStorage();
}
if (typeof (globalThis as any).sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = new MockMemoryStorage();
}

test('M3-CHALLENGER-2: 2FA Rate Limiting, Replay Protection & RAM Zeroization Stress Suite', async (t) => {
  const storeId = '108120';
  const unitCode = '18120';

  // Helper to ensure an active user exists in AdminService
  const ensureRegisteredUser = (email: string, name: string = 'Test Partner') => {
    const users = AdminService.getUsers();
    if (!users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      users.push({
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        storeUnitCode: unitCode,
        fullName: name,
        email: email.toLowerCase().trim(),
        role: 'BARISTA',
        isActive: true,
        permissions: {
          canViewFinancialSales: false,
          canEditForecastTarget: false,
          canModifyNcRules: false,
          canViewWageRates: false,
          canViewMedicalLeaves: false,
          canPublishSchedule: false,
          canApproveTor: false,
          canImportFichajes: false,
          canViewColPnl: false,
          canViewZusRates: false,
          canSimulateWhatIf: false,
          canExportExcel: false,
        },
        sessionVersion: 1,
        createdAt: new Date().toISOString(),
      });
      StoreStorage.setItem('admin_managed_users', users);
    }
  };

  // ==========================================================================
  // Section 1: CSPRNG Randomness & Entropy Stress Test (1,000 Generated OTPs)
  // ==========================================================================
  await t.test('1.1 CSPRNG 1,000 OTP Randomness: No duplicate runs, full numeric range, high entropy', () => {
    const SAMPLE_SIZE = 1000;
    const generatedOtps: string[] = [];
    const uniqueOtps = new Set<string>();
    const digitFrequencies = Array(10).fill(0);

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const otp = generateCsprngOtp();

      // Check strictly 6 numeric digits
      assert.match(otp, /^[0-9]{6}$/, `OTP [${otp}] must be exactly 6 decimal digits`);
      const val = parseInt(otp, 10);
      assert.strictEqual(val >= 100000 && val <= 999999, true, `OTP [${val}] must be in range [100000, 999999]`);

      generatedOtps.push(otp);
      uniqueOtps.add(otp);

      // Accumulate digit frequencies
      for (const char of otp) {
        digitFrequencies[parseInt(char, 10)]++;
      }
    }

    // A. Check for duplicate consecutive runs (no run of identical numbers)
    let maxRunLength = 1;
    let currentRunLength = 1;
    for (let i = 1; i < SAMPLE_SIZE; i++) {
      if (generatedOtps[i] === generatedOtps[i - 1]) {
        currentRunLength++;
        if (currentRunLength > maxRunLength) {
          maxRunLength = currentRunLength;
        }
      } else {
        currentRunLength = 1;
      }
    }
    assert.strictEqual(
      maxRunLength, 
      1, 
      `CSPRNG produced consecutive duplicate codes (max run length: ${maxRunLength})`
    );

    // B. Entropy / Uniqueness test: In 1,000 draws from 900,000 keys, collisions should be extremely rare (< 10)
    assert.strictEqual(
      uniqueOtps.size >= 990, 
      true, 
      `Uniqueness test failed: expected >= 990 unique codes out of 1000, got ${uniqueOtps.size}`
    );

    // C. Digit frequency balance: Total 6,000 digits. Expected per digit ~600.
    // Allow statistical variance: 400..800 per digit
    for (let digit = 0; digit < 10; digit++) {
      const count = digitFrequencies[digit];
      assert.strictEqual(
        count >= 400 && count <= 800,
        true,
        `Digit ${digit} frequency ${count} is out of expected statistical range [400, 800]`
      );
    }
  });

  // ==========================================================================
  // Section 2: Sliding Rate Limiter & 60-Second Cooldown Lockout
  // ==========================================================================
  await t.test('2.1 Sliding Rate Limiter: 3 invalid attempts strictly trigger 60s cooldown lockout', async () => {
    const testEmail = 'adversary.limiter@amrest.eu';
    AuthService.clearAllChallenges();
    ensureRegisteredUser(testEmail, 'Adversary Limiter');

    // Step A: Request OTP
    const req = await AuthService.request2FaOtp(testEmail, unitCode);
    assert.strictEqual(req.success, true);
    const validOtp = req.simulatedCode!;

    // Step B: Attempt 1 with invalid code
    const attempt1 = await AuthService.verify2FaOtp(testEmail, '000000');
    assert.strictEqual(attempt1.success, false);
    assert.strictEqual(attempt1.remainingAttempts, 2);
    assert.strictEqual(attempt1.isLockedOut, false);

    // Step C: Attempt 2 with invalid code
    const attempt2 = await AuthService.verify2FaOtp(testEmail, '111111');
    assert.strictEqual(attempt2.success, false);
    assert.strictEqual(attempt2.remainingAttempts, 1);
    assert.strictEqual(attempt2.isLockedOut, false);

    // Step D: Attempt 3 with invalid code -> should activate 60s cooldown lockout
    const attempt3 = await AuthService.verify2FaOtp(testEmail, '222222');
    assert.strictEqual(attempt3.success, false);
    assert.strictEqual(attempt3.remainingAttempts, 0);
    assert.strictEqual(attempt3.isLockedOut, true);
    assert.strictEqual(attempt3.cooldownSeconds, 60);
    assert.match(attempt3.message || '', /60 sekund/);

    // Step E: Attempt 4 during lockout with the ACTUAL VALID OTP -> MUST be strictly blocked
    const attempt4 = await AuthService.verify2FaOtp(testEmail, validOtp);
    assert.strictEqual(attempt4.success, false, 'Attempt 4 during cooldown must fail even with valid code');
    assert.strictEqual(attempt4.isLockedOut, true);
    assert.match(attempt4.message || '', /Blokada bezpieczeństwa aktywna/);

    // Step F: Attempt 5 with another invalid code -> still blocked
    const attempt5 = await AuthService.verify2FaOtp(testEmail, '999999');
    assert.strictEqual(attempt5.success, false);
    assert.strictEqual(attempt5.isLockedOut, true);

    // Step G: Ensure request2FaOtp also rejects generating a new code during active lockout
    const reqDuringLockout = await AuthService.request2FaOtp(testEmail, unitCode);
    assert.strictEqual(reqDuringLockout.success, false);
    assert.strictEqual(reqDuringLockout.isLockedOut, true);
    assert.match(reqDuringLockout.message, /Blokada bezpieczeństwa aktywna/);
  });

  await t.test('2.2 Rate Limiter Case and Whitespace Invariance: Cannot bypass lockout with varied email casing', async () => {
    const baseEmail = 'case.limiter@amrest.eu';
    AuthService.clearAllChallenges();
    ensureRegisteredUser(baseEmail, 'Case Limiter');

    // Request challenge using mixed case email
    const req = await AuthService.request2FaOtp('  Case.Limiter@AMREST.EU  ', unitCode);
    assert.strictEqual(req.success, true);

    // Exhaust 3 attempts using lowercase
    await AuthService.verify2FaOtp('case.limiter@amrest.eu', '000001');
    await AuthService.verify2FaOtp('CASE.LIMITER@amrest.eu', '000002');
    const lockAttempt = await AuthService.verify2FaOtp('  case.limiter@AMREST.EU  ', '000003');
    assert.strictEqual(lockAttempt.isLockedOut, true);

    // Verify lockout applies when probed with any alternative case or spacing
    const probe = await AuthService.verify2FaOtp('  CASE.LIMITER@AMREST.EU  ', '999999');
    assert.strictEqual(probe.isLockedOut, true);
  });

  // ==========================================================================
  // Section 3: Resend Throttle Resilience (30 Seconds Minimum Interval)
  // ==========================================================================
  await t.test('3.1 Resend Throttle: Triggering request2FaOtp twice in < 30s is strictly throttled', async () => {
    const throttleEmail = 'throttle.victim@amrest.eu';
    AuthService.clearAllChallenges();
    ensureRegisteredUser(throttleEmail, 'Throttle Victim');

    // First request -> Success
    const firstReq = await AuthService.request2FaOtp(throttleEmail, unitCode);
    assert.strictEqual(firstReq.success, true);
    assert.strictEqual(firstReq.resendCooldownSeconds, 30);

    // Immediate second request (< 30s) -> Throttled
    const secondReq = await AuthService.request2FaOtp(throttleEmail, unitCode);
    assert.strictEqual(secondReq.success, false, 'Immediate second OTP request must be throttled');
    assert.strictEqual(typeof secondReq.cooldownSeconds, 'number');
    assert.strictEqual(secondReq.cooldownSeconds! <= 30 && secondReq.cooldownSeconds! > 0, true);
    assert.match(secondReq.message, /Możesz poprosić o kolejny kod za/);
    assert.match(secondReq.message, new RegExp(`${secondReq.cooldownSeconds}s`));
  });

  await t.test('3.2 Resend Throttle Burst Stress: Rapid concurrent burst of 10 requests are all throttled', async () => {
    const burstEmail = 'burst.throttle@amrest.eu';
    AuthService.clearAllChallenges();
    ensureRegisteredUser(burstEmail, 'Burst Throttle');

    // Initial valid request
    const initReq = await AuthService.request2FaOtp(burstEmail, unitCode);
    assert.strictEqual(initReq.success, true);

    // Rapid burst of 10 concurrent requests
    const burstPromises = Array.from({ length: 10 }, () => 
      AuthService.request2FaOtp(burstEmail, unitCode)
    );
    const burstResults = await Promise.all(burstPromises);

    for (let i = 0; i < burstResults.length; i++) {
      const res = burstResults[i];
      assert.strictEqual(res.success, false, `Burst request #${i + 1} must be rejected`);
      assert.strictEqual(res.cooldownSeconds! <= 30 && res.cooldownSeconds! > 0, true);
      assert.match(res.message, /kolejny kod/);
    }
  });

  // ==========================================================================
  // Section 4: Token Replay Prevention & Burning On Use
  // ==========================================================================
  await t.test('4.1 Token Replay Prevention: Verification burns OTP; immediate re-verification fails', async () => {
    const replayEmail = 'replay.target@amrest.eu';
    AuthService.clearAllChallenges();
    ensureRegisteredUser(replayEmail, 'Replay Target');

    const req = await AuthService.request2FaOtp(replayEmail, unitCode);
    assert.strictEqual(req.success, true);
    const validCode = req.simulatedCode!;

    // 1st Verification: Success
    const firstVerify = await AuthService.verify2FaOtp(replayEmail, validCode);
    assert.strictEqual(firstVerify.success, true);
    assert.ok(firstVerify.session);
    assert.strictEqual(firstVerify.session.email, replayEmail);

    // 2nd Verification: Replay attempt immediately fails
    const secondVerify = await AuthService.verify2FaOtp(replayEmail, validCode);
    assert.strictEqual(secondVerify.success, false, 'Replay of burned OTP must fail');
    assert.strictEqual(secondVerify.session, undefined);
    assert.match(secondVerify.message || '', /Brak aktywnego żądania/);

    // 3rd Verification: Continued replay fails
    const thirdVerify = await AuthService.verify2FaOtp(replayEmail, validCode);
    assert.strictEqual(thirdVerify.success, false);
  });

  await t.test('4.2 Concurrent Replay Race: Multiple concurrent verification calls with the same OTP allow only 1 winner', async () => {
    const raceEmail = 'race.replay@amrest.eu';
    AuthService.clearAllChallenges();
    ensureRegisteredUser(raceEmail, 'Race Replay');

    const req = await AuthService.request2FaOtp(raceEmail, unitCode);
    assert.strictEqual(req.success, true);
    const validCode = req.simulatedCode!;

    // Launch 5 concurrent verification attempts with the identical valid OTP
    const raceResults = await Promise.all([
      AuthService.verify2FaOtp(raceEmail, validCode),
      AuthService.verify2FaOtp(raceEmail, validCode),
      AuthService.verify2FaOtp(raceEmail, validCode),
      AuthService.verify2FaOtp(raceEmail, validCode),
      AuthService.verify2FaOtp(raceEmail, validCode),
    ]);

    const successes = raceResults.filter(r => r.success);
    const failures = raceResults.filter(r => !r.success);

    // Exactly one must succeed, others must fail
    assert.strictEqual(successes.length, 1, `Exactly 1 verification should succeed in race, got ${successes.length}`);
    assert.strictEqual(failures.length, 4, `4 verifications should fail in race, got ${failures.length}`);
  });

  // ==========================================================================
  // Section 5: Inactivity Auto-Lock & Cryptographic RAM Key Zeroization
  // ==========================================================================
  await t.test('5.1 Cryptographic RAM Zeroization: Every buffer in StoreKeyCache is physically zeroed to 0x00 and map cleared', () => {
    // Clean cache first
    StoreKeyCache.clear();
    assert.strictEqual(StoreKeyCache.size(), 0);

    // Allocate 10 distinct 32-byte AES keys for 10 stores
    const NUM_STORES = 10;
    const allocatedKeyBuffers: Buffer[] = [];
    const storeIds: string[] = [];

    for (let i = 0; i < NUM_STORES; i++) {
      const sId = `1081${i.toString().padStart(2, '0')}`;
      const uCode = `181${i.toString().padStart(2, '0')}`;
      const pHash = `passhash_${i}_${Date.now()}`;
      storeIds.push(sId);

      // Fill buffer with non-zero distinctive byte
      const keyFillByte = 0x10 + i;
      const keyBuf = Buffer.alloc(32, keyFillByte);
      allocatedKeyBuffers.push(keyBuf);

      // Verify buffer holds non-zero values
      assert.strictEqual(keyBuf[0], keyFillByte);
      assert.strictEqual(keyBuf.every(b => b === keyFillByte), true);

      // Populate StoreKeyCache
      StoreKeyCache.set(sId, uCode, pHash, keyBuf);
    }

    assert.strictEqual(StoreKeyCache.size(), NUM_STORES);

    // Trigger zeroization
    executeCryptographicZeroization();

    // Verification 1: Cache map is completely cleared
    assert.strictEqual(StoreKeyCache.size(), 0, 'StoreKeyCache map size must be 0 after zeroization');

    // Verification 2: Every single buffer reference in memory was physically overwritten with 0x00
    for (let i = 0; i < NUM_STORES; i++) {
      const buf = allocatedKeyBuffers[i];
      assert.strictEqual(buf.length, 32, `Buffer ${i} length must remain 32 bytes`);
      const isAllZero = buf.every(byte => byte === 0x00);
      assert.strictEqual(
        isAllZero, 
        true, 
        `Buffer for store ${storeIds[i]} was NOT completely zeroed! Contains non-zero bytes: ${buf.toString('hex')}`
      );
    }

    // Verification 3: hasStoreKey returns false for all stores
    for (const sId of storeIds) {
      assert.strictEqual(StoreKeyCache.hasStoreKey(sId), false);
    }
  });

  await t.test('5.2 Zeroization Scale Stress: 100 stores populated with AES keys simultaneously zeroized', () => {
    StoreKeyCache.clear();
    const SCALE = 100;
    const buffers: Buffer[] = [];

    for (let i = 0; i < SCALE; i++) {
      const buf = Buffer.alloc(32, (i % 250) + 1); // Non-zero byte 1..250
      buffers.push(buf);
      StoreKeyCache.set(`BULK_STORE_${i}`, `UNIT_${i}`, `hash_${i}`, buf);
    }

    assert.strictEqual(StoreKeyCache.size(), SCALE);

    // Execute zeroization
    executeCryptographicZeroization();

    assert.strictEqual(StoreKeyCache.size(), 0);
    for (let i = 0; i < SCALE; i++) {
      assert.strictEqual(buffers[i].every(b => b === 0x00), true);
    }
  });

  // ==========================================================================
  // Section 6: Session Lock Event Broadcasting (sbx:dismiss-modals & sbx:session-locked)
  // ==========================================================================
  await t.test('6.1 Event Broadcast: Dispatches sbx:dismiss-modals and sbx:session-locked in order', () => {
    const firedEvents: string[] = [];

    const mockWindow = {
      dispatchEvent: (event: any) => {
        firedEvents.push(event.type);
        return true;
      },
    };

    (globalThis as any).window = mockWindow;

    try {
      broadcastSessionLockEvents();

      assert.strictEqual(firedEvents.length, 2, 'Exactly 2 events must be dispatched');
      assert.strictEqual(firedEvents[0], 'sbx:dismiss-modals', 'sbx:dismiss-modals must be fired first');
      assert.strictEqual(firedEvents[1], 'sbx:session-locked', 'sbx:session-locked must be fired second');
    } finally {
      delete (globalThis as any).window;
    }
  });

  await t.test('6.2 Headless Safety: Inactivity zeroization and broadcast never crash when window is undefined', () => {
    assert.strictEqual(typeof (globalThis as any).window, 'undefined');
    assert.doesNotThrow(() => {
      executeCryptographicZeroization();
      broadcastSessionLockEvents();
    });
  });

  await t.test('6.3 Timing Constants: Default policy guarantees 15 min lock and 1s throttle', () => {
    assert.strictEqual(DEFAULT_INACTIVITY_TIMEOUT_MS, 900_000, 'Inactivity timeout must be exactly 900,000 ms (15 min)');
    assert.strictEqual(DEFAULT_ACTIVITY_THROTTLE_MS, 1_000, 'Activity throttle must be exactly 1,000 ms (1 s)');
  });
});
