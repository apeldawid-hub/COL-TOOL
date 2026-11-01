/**
 * Starbucks Operations Suite — Milestone 4 Security Test Suite
 * File: tests/security/master_credential_rate_limiter.test.ts
 *
 * Scope: Feature F11 — Timing-Safe Master IPC Bridge & Sliding-Window Rate Limiter
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  MasterCredentialManager,
  MasterRateLimiter,
} from './proposed_masterCredentialManager.js';
import { MasterCredentialService } from './proposed_masterCredentialService.js';

test('M4-F11: Master Credential Security & Rate Limiting Suite', async (suite) => {
  const masterSecret = 'sbx_hq_master_passphrase_production_2026';

  // ==========================================================================
  // Section 1: Constant-Time Verification & Variable-Length Input Invariance
  // ==========================================================================
  await suite.test('1.1 timingSafeVerify validates exact matching secret', () => {
    assert.strictEqual(
      MasterCredentialManager.timingSafeVerify(masterSecret, masterSecret),
      true,
      'Exact matching secret must return true'
    );
  });

  await suite.test('1.2 timingSafeVerify rejects mismatches at varying positions', () => {
    const diffFirst = 'x' + masterSecret.slice(1);
    const midIndex = Math.floor(masterSecret.length / 2);
    const diffMid = masterSecret.slice(0, midIndex) + 'x' + masterSecret.slice(midIndex + 1);
    const diffLast = masterSecret.slice(0, -1) + 'x';

    assert.strictEqual(MasterCredentialManager.timingSafeVerify(diffFirst, masterSecret), false);
    assert.strictEqual(MasterCredentialManager.timingSafeVerify(diffMid, masterSecret), false);
    assert.strictEqual(MasterCredentialManager.timingSafeVerify(diffLast, masterSecret), false);
  });

  await suite.test('1.3 timingSafeVerify handles variable-length inputs without RangeError', () => {
    const testCases = [
      { input: '', desc: 'empty string' },
      { input: 'a', desc: '1 char' },
      { input: 'ab', desc: '2 chars' },
      { input: 'x'.repeat(16), desc: '16 chars' },
      { input: 'y'.repeat(32), desc: '32 chars' },
      { input: 'z'.repeat(64), desc: '64 chars' },
      { input: 'w'.repeat(1000), desc: '1,000 chars' },
      { input: 'q'.repeat(4096), desc: '4,096 chars boundary' },
      { input: 'm'.repeat(10000), desc: '10,000 chars oversized' },
    ];

    for (const tc of testCases) {
      assert.doesNotThrow(() => {
        const result = MasterCredentialManager.timingSafeVerify(tc.input, masterSecret);
        assert.strictEqual(result, false, `Mismatched length input (${tc.desc}) must safely return false`);
      }, `Input ${tc.desc} threw exception in timingSafeVerify`);
    }
  });

  await suite.test('1.4 timingSafeVerify safely rejects non-string types', () => {
    const nonStrings: any[] = [
      null,
      undefined,
      123456,
      true,
      false,
      {},
      [],
      Buffer.from('sbx_hq_master_passphrase_production_2026'),
      Symbol('pass'),
      () => {},
    ];

    for (const ns of nonStrings) {
      assert.doesNotThrow(() => {
        const result = MasterCredentialManager.timingSafeVerify(ns, masterSecret);
        assert.strictEqual(result, false, `Non-string type must return false without exception`);
      });
    }
  });

  await suite.test('1.5 timingSafeVerify constant-time benchmark check', () => {
    const iterations = 20000;
    const baseSecret = 'sbx_test_secret_for_timing_measurement_2026';
    const diffFirst = 'x' + baseSecret.slice(1);
    const diffLast = baseSecret.slice(0, -1) + 'x';
    const diffLen = 'x';

    // JIT Warmup
    for (let i = 0; i < 2000; i++) {
      MasterCredentialManager.timingSafeVerify(diffFirst, baseSecret);
      MasterCredentialManager.timingSafeVerify(diffLast, baseSecret);
      MasterCredentialManager.timingSafeVerify(diffLen, baseSecret);
    }

    const t0 = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      MasterCredentialManager.timingSafeVerify(diffFirst, baseSecret);
    }
    const durFirst = Number(process.hrtime.bigint() - t0);

    const t1 = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      MasterCredentialManager.timingSafeVerify(diffLast, baseSecret);
    }
    const durLast = Number(process.hrtime.bigint() - t1);

    const ratio = Math.max(durFirst, durLast) / Math.min(durFirst, durLast);
    assert.ok(
      ratio < 2.5,
      `Timing disparity detected: first-char (${durFirst}ns) vs last-char (${durLast}ns). Ratio: ${ratio.toFixed(2)}`
    );
  });

  // ==========================================================================
  // Section 2: Sliding-Window Rate Limiting (5 attempts / 15 minutes)
  // ==========================================================================
  await suite.test('2.1 Sliding Rate Limiter: 5 failed attempts trigger 15-minute lockout', () => {
    let mockTime = 1000000;
    const clock = () => mockTime;

    const limiter = new MasterRateLimiter({
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      lockoutMs: 15 * 60 * 1000,
      nowFn: clock,
    });

    // Attempt 1
    const res1 = limiter.recordFailure();
    assert.strictEqual(res1.locked, false);
    assert.strictEqual(res1.remainingAttempts, 4);

    // Attempt 2
    mockTime += 60 * 1000; // +1 min
    const res2 = limiter.recordFailure();
    assert.strictEqual(res2.locked, false);
    assert.strictEqual(res2.remainingAttempts, 3);

    // Attempt 3
    mockTime += 60 * 1000; // +2 min
    const res3 = limiter.recordFailure();
    assert.strictEqual(res3.locked, false);
    assert.strictEqual(res3.remainingAttempts, 2);

    // Attempt 4
    mockTime += 60 * 1000; // +3 min
    const res4 = limiter.recordFailure();
    assert.strictEqual(res4.locked, false);
    assert.strictEqual(res4.remainingAttempts, 1);

    // Attempt 5 -> Lockout triggered!
    mockTime += 60 * 1000; // +4 min (mockTime = 1240000)
    const res5 = limiter.recordFailure();
    assert.strictEqual(res5.locked, true);
    assert.strictEqual(res5.remainingAttempts, 0);
    assert.strictEqual(res5.lockedUntil, mockTime + 15 * 60 * 1000);

    // Attempt 6 during active lockout
    mockTime += 60 * 1000; // +5 min
    const res6 = limiter.recordFailure();
    assert.strictEqual(res6.locked, true);
    assert.strictEqual(res6.remainingAttempts, 0);

    // Status check during lockout
    const status = limiter.getStatus();
    assert.strictEqual(status.isLocked, true);
    assert.strictEqual(status.remainingAttempts, 0);
    assert.ok(status.cooldownSeconds! > 0);

    // Advance clock past 15-minute lockout
    mockTime += 15 * 60 * 1000; // mockTime is now past lockedUntil
    const statusAfter = limiter.getStatus();
    assert.strictEqual(statusAfter.isLocked, false);
    assert.strictEqual(statusAfter.remainingAttempts, 5);
  });

  await suite.test('2.2 Verification during lockout rejects even with valid credential', async () => {
    let mockTime = 2000000;
    const clock = () => mockTime;

    const limiter = new MasterRateLimiter({
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      lockoutMs: 15 * 60 * 1000,
      nowFn: clock,
    });

    const manager = new MasterCredentialManager(undefined, limiter);
    manager.setCustomMasterSecret(masterSecret);

    // Exhaust 5 attempts
    for (let i = 0; i < 5; i++) {
      const fail = await manager.verifyCredential('wrong_password');
      assert.strictEqual(fail.success, false);
    }

    // Now test with the EXACT VALID secret
    const lockedVerification = await manager.verifyCredential(masterSecret);
    assert.strictEqual(
      lockedVerification.success,
      false,
      'Valid master credential must be strictly rejected during active lockout'
    );
    assert.strictEqual(lockedVerification.errorCode, 'LOCKED_OUT');
    assert.strictEqual(lockedVerification.remainingAttempts, 0);
    assert.match(lockedVerification.error || '', /Blokada bezpieczeństwa aktywna/);
  });

  await suite.test('2.3 Sliding window rolling expiration without lockout', () => {
    let mockTime = 3000000;
    const clock = () => mockTime;

    const limiter = new MasterRateLimiter({
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 min window
      lockoutMs: 15 * 60 * 1000,
      nowFn: clock,
    });

    // Make 3 failures at T=0
    limiter.recordFailure();
    limiter.recordFailure();
    limiter.recordFailure();
    assert.strictEqual(limiter.getStatus().remainingAttempts, 2);

    // Advance time by 16 minutes -> The 3 attempts slide out of window
    mockTime += 16 * 60 * 1000;
    assert.strictEqual(limiter.getStatus().remainingAttempts, 5);

    // Make 2 failures at T=16m
    limiter.recordFailure();
    limiter.recordFailure();
    assert.strictEqual(limiter.getStatus().remainingAttempts, 3);

    // Advance time by 10 minutes (T=26m) -> failures still in window
    mockTime += 10 * 60 * 1000;
    assert.strictEqual(limiter.getStatus().remainingAttempts, 3);

    // Advance time by 6 more minutes (T=32m, 16m since T=16m) -> failures rolled out
    mockTime += 6 * 60 * 1000;
    assert.strictEqual(limiter.getStatus().remainingAttempts, 5);
  });

  await suite.test('2.4 Successful verification clears previous failures', async () => {
    let mockTime = 4000000;
    const clock = () => mockTime;

    const limiter = new MasterRateLimiter({
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      lockoutMs: 15 * 60 * 1000,
      nowFn: clock,
    });

    const manager = new MasterCredentialManager(undefined, limiter);
    manager.setCustomMasterSecret(masterSecret);

    // Make 3 failures
    await manager.verifyCredential('bad_1');
    await manager.verifyCredential('bad_2');
    await manager.verifyCredential('bad_3');
    assert.strictEqual(manager.getStatus().remainingAttempts, 2);

    // 4th attempt is valid
    const successRes = await manager.verifyCredential(masterSecret);
    assert.strictEqual(successRes.success, true);
    assert.strictEqual(successRes.remainingAttempts, 5);

    // Subsequent status shows fresh 5 attempts
    assert.strictEqual(manager.getStatus().remainingAttempts, 5);
  });

  // ==========================================================================
  // Section 3: Lockout Persistence across Process Restarts
  // ==========================================================================
  await suite.test('3.1 Lockout state persists to disk and survives re-instantiation', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_lock_test_'));
    const lockFile = path.join(tmpDir, 'master_rate_limit.lock');

    let mockTime = 5000000;
    const clock = () => mockTime;

    try {
      // Instance A triggers lockout
      const limiterA = new MasterRateLimiter({
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000,
        lockoutMs: 15 * 60 * 1000,
        lockFilePath: lockFile,
        nowFn: clock,
      });

      for (let i = 0; i < 5; i++) {
        limiterA.recordFailure();
      }
      assert.strictEqual(limiterA.isLockedOut(), true);
      assert.strictEqual(fs.existsSync(lockFile), true, 'Lock file must be created on disk');

      // Instance B loads from the same lockfile (simulating app restart)
      const limiterB = new MasterRateLimiter({
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000,
        lockoutMs: 15 * 60 * 1000,
        lockFilePath: lockFile,
        nowFn: clock,
      });

      assert.strictEqual(
        limiterB.isLockedOut(),
        true,
        'Restarted instance must immediately enforce persisted lockout'
      );
      assert.strictEqual(limiterB.getStatus().remainingAttempts, 0);

      // Advance clock past lockout
      mockTime += 16 * 60 * 1000;
      assert.strictEqual(limiterB.isLockedOut(), false, 'Lockout must be lifted after cooldown');
      assert.strictEqual(limiterB.getStatus().remainingAttempts, 5);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ==========================================================================
  // Section 4: Concurrency & Audit Events
  // ==========================================================================
  await suite.test('4.1 Concurrent burst of invalid attempts triggers lockout safely', async () => {
    let mockTime = 6000000;
    const clock = () => mockTime;

    let lockoutEventFired = false;
    const limiter = new MasterRateLimiter({
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      lockoutMs: 15 * 60 * 1000,
      nowFn: clock,
    });
    limiter.setOnLockout(() => {
      lockoutEventFired = true;
    });

    const manager = new MasterCredentialManager(undefined, limiter);
    manager.setCustomMasterSecret(masterSecret);

    // Fire 10 concurrent invalid attempts
    const attempts = Array.from({ length: 10 }, (_, i) =>
      manager.verifyCredential(`invalid_burst_${i}`)
    );
    const results = await Promise.all(attempts);

    const lockedResults = results.filter((r) => r.errorCode === 'LOCKED_OUT');
    assert.ok(lockedResults.length >= 5, 'At least 5 results must report lockout');
    assert.strictEqual(lockoutEventFired, true, 'Lockout audit callback must fire');
    assert.strictEqual(manager.getStatus().isLocked, true);
  });

  // ==========================================================================
  // Section 5: Renderer Service Headless Fallback
  // ==========================================================================
  await suite.test('5.1 MasterCredentialService operates cleanly in headless environment', async () => {
    const service = new MasterCredentialService();
    assert.strictEqual(service.isElectronAvailable(), false);

    const status = await service.getStatus();
    assert.strictEqual(status.isLocked, false);
    assert.strictEqual(status.remainingAttempts, 5);

    // Verify fallback verification
    const fail = await service.verifyMasterCredential('wrong_pass');
    assert.strictEqual(fail.success, false);
    assert.strictEqual(fail.remainingAttempts, 4);

    const valid = await service.verifyMasterCredential('sbx_default_master_passphrase');
    assert.strictEqual(valid.success, true);
    assert.strictEqual(valid.remainingAttempts, 5);
  });
});
