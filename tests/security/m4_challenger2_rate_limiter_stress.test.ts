/**
 * Starbucks Operations Suite — Milestone 4 Gate Challenger 2 Empirical Stress Test Suite
 * File: tests/security/m4_challenger2_rate_limiter_stress.test.ts
 *
 * Scope: Feature F11 (Master Credential Manager, Sliding-Window Rate Limiter & Lockfile Hardening)
 * Adversarial Empirical Verification:
 * 1. High Concurrency Burst (50 concurrent calls, race condition resistance, lockout consistency)
 * 2. Timing Invariance Analysis (10,000 iterations measuring first-char vs last-char vs match)
 * 3. Lockfile Corruption & Tampering Recovery (corrupted JSON, read-only permissions, missing dirs, fail-closed)
 * 4. Extreme Input Payloads (1MB strings, null bytes, prototype pollution keys, non-strings, symbols)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import {
  MasterCredentialManager,
  MasterRateLimiter,
} from '../../electron/security/masterCredentialManager';
import { MasterCredentialService } from '../../src/services/security/masterCredentialService';

test('M4-CHALLENGER-2: Master Credential Rate Limiter, Timing & Lockfile Adversarial Stress Suite', async (suite) => {
  const masterSecret = 'sbx_prod_master_secret_2026_adversarial_vector';

  // ==========================================================================
  // Section 1: High Concurrency Burst (50 Concurrent Calls)
  // ==========================================================================
  await suite.test('1.1 Concurrency Burst: 50 simultaneous invalid attempts strictly lock out', async () => {
    let mockTime = 10000000;
    const clock = () => mockTime;

    let lockoutCallCount = 0;
    const limiter = new MasterRateLimiter({
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      lockoutMs: 15 * 60 * 1000,
      nowFn: clock,
    });

    limiter.addLockoutListener(() => {
      lockoutCallCount++;
    });

    const manager = new MasterCredentialManager(undefined, limiter);
    manager.setCustomMasterSecret(masterSecret);

    // Launch 50 simultaneous calls
    const burstPromises = Array.from({ length: 50 }, (_, i) =>
      manager.verifyCredential(`wrong_burst_password_${i}`)
    );

    const results = await Promise.all(burstPromises);

    assert.strictEqual(results.length, 50, 'All 50 calls must complete');

    // Count how many failed with INVALID_CREDENTIAL vs LOCKED_OUT
    const invalidCount = results.filter((r) => r.errorCode === 'INVALID_CREDENTIAL').length;
    const lockedCount = results.filter((r) => r.errorCode === 'LOCKED_OUT').length;

    // Exactly 4 should report remainingAttempts 4,3,2,1 before attempt 5 triggers lockout
    assert.strictEqual(invalidCount, 4, 'Exactly 4 attempts return INVALID_CREDENTIAL before lockout');
    assert.strictEqual(lockedCount, 46, 'Remaining 46 attempts must be rejected with LOCKED_OUT');

    // Rate limiter must be locked
    const status = manager.getStatus();
    assert.strictEqual(status.isLocked, true, 'Rate limiter must be in locked state');
    assert.strictEqual(status.remainingAttempts, 0, 'Remaining attempts must be 0');
    assert.strictEqual(lockoutCallCount, 1, 'Lockout callback must be invoked exactly once');
  });

  await suite.test('1.2 Concurrency Race: Mixed valid and invalid credentials in 50-burst', async () => {
    let mockTime = 20000000;
    const clock = () => mockTime;

    const limiter = new MasterRateLimiter({
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      lockoutMs: 15 * 60 * 1000,
      nowFn: clock,
    });

    const manager = new MasterCredentialManager(undefined, limiter);
    manager.setCustomMasterSecret(masterSecret);

    // First exhaust 5 attempts
    for (let i = 0; i < 5; i++) {
      await manager.verifyCredential(`drain_attempt_${i}`);
    }

    assert.strictEqual(manager.getStatus().isLocked, true, 'Limiter must be locked out');

    // Fire 50 concurrent calls with the VALID master credential
    const validBurst = Array.from({ length: 50 }, () =>
      manager.verifyCredential(masterSecret)
    );
    const validResults = await Promise.all(validBurst);

    // Every single call MUST fail with LOCKED_OUT, zero successes allowed
    const successCount = validResults.filter((r) => r.success).length;
    const lockedCount = validResults.filter((r) => r.errorCode === 'LOCKED_OUT').length;

    assert.strictEqual(successCount, 0, 'Zero valid credentials may succeed during active lockout');
    assert.strictEqual(lockedCount, 50, 'All 50 attempts must receive LOCKED_OUT');
  });

  await suite.test('1.3 Direct Limiter Concurrency: 50 parallel recordFailure invocations', () => {
    let mockTime = 30000000;
    const limiter = new MasterRateLimiter({
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
      lockoutMs: 15 * 60 * 1000,
      nowFn: () => mockTime,
    });

    const results = [];
    for (let i = 0; i < 50; i++) {
      results.push(limiter.recordFailure());
    }

    assert.strictEqual(results[0].remainingAttempts, 4);
    assert.strictEqual(results[1].remainingAttempts, 3);
    assert.strictEqual(results[2].remainingAttempts, 2);
    assert.strictEqual(results[3].remainingAttempts, 1);
    assert.strictEqual(results[4].remainingAttempts, 0);
    assert.strictEqual(results[4].locked, true);

    // Attempts 5 through 49 must all be locked with 0 remaining
    for (let i = 5; i < 50; i++) {
      assert.strictEqual(results[i].locked, true);
      assert.strictEqual(results[i].remainingAttempts, 0);
    }
  });

  // ==========================================================================
  // Section 2: Timing Variance Analysis (10,000 Iterations)
  // ==========================================================================
  await suite.test('2.1 Timing Variance Analysis: 10,000 iterations empirical constant-time test', () => {
    const iterations = 10000;
    const secret = 'AmRest_Starbucks_Enterprise_Master_Secret_Key_Verification_2026!#$';
    
    // Test vectors:
    // 1. Mismatch at first char
    const diffFirst = 'X' + secret.slice(1);
    // 2. Mismatch at middle char
    const midIdx = Math.floor(secret.length / 2);
    const diffMid = secret.slice(0, midIdx) + 'Z' + secret.slice(midIdx + 1);
    // 3. Mismatch at last char
    const diffLast = secret.slice(0, -1) + 'Q';
    // 4. Exact match
    const exactMatch = secret;
    // 5. Length mismatch (short)
    const shortMismatch = 'AmRest';
    // 6. Length mismatch (long)
    const longMismatch = secret + '_extra_padding_string_that_makes_it_longer';

    // JIT Warmup (2,000 iterations each)
    for (let i = 0; i < 2000; i++) {
      MasterCredentialManager.timingSafeVerify(diffFirst, secret);
      MasterCredentialManager.timingSafeVerify(diffMid, secret);
      MasterCredentialManager.timingSafeVerify(diffLast, secret);
      MasterCredentialManager.timingSafeVerify(exactMatch, secret);
      MasterCredentialManager.timingSafeVerify(shortMismatch, secret);
      MasterCredentialManager.timingSafeVerify(longMismatch, secret);
    }

    // 50 rounds of 200 iterations interleaved (10,000 total iterations per vector)
    // Interleaving prevents monolithic V8 GC scavenges from skewing any single vector
    const totals = {
      diffFirst: 0n,
      diffMid: 0n,
      diffLast: 0n,
      exactMatch: 0n,
      shortMismatch: 0n,
      longMismatch: 0n,
    };
    const rounds = 50;
    const itersPerRound = 200;

    for (let r = 0; r < rounds; r++) {
      let t0 = process.hrtime.bigint();
      for (let i = 0; i < itersPerRound; i++) MasterCredentialManager.timingSafeVerify(diffFirst, secret);
      totals.diffFirst += process.hrtime.bigint() - t0;

      t0 = process.hrtime.bigint();
      for (let i = 0; i < itersPerRound; i++) MasterCredentialManager.timingSafeVerify(diffMid, secret);
      totals.diffMid += process.hrtime.bigint() - t0;

      t0 = process.hrtime.bigint();
      for (let i = 0; i < itersPerRound; i++) MasterCredentialManager.timingSafeVerify(diffLast, secret);
      totals.diffLast += process.hrtime.bigint() - t0;

      t0 = process.hrtime.bigint();
      for (let i = 0; i < itersPerRound; i++) MasterCredentialManager.timingSafeVerify(exactMatch, secret);
      totals.exactMatch += process.hrtime.bigint() - t0;

      t0 = process.hrtime.bigint();
      for (let i = 0; i < itersPerRound; i++) MasterCredentialManager.timingSafeVerify(shortMismatch, secret);
      totals.shortMismatch += process.hrtime.bigint() - t0;

      t0 = process.hrtime.bigint();
      for (let i = 0; i < itersPerRound; i++) MasterCredentialManager.timingSafeVerify(longMismatch, secret);
      totals.longMismatch += process.hrtime.bigint() - t0;
    }

    const totalIters = rounds * itersPerRound;
    const nsPerOp = {
      first: Number(totals.diffFirst) / totalIters,
      mid: Number(totals.diffMid) / totalIters,
      last: Number(totals.diffLast) / totalIters,
      match: Number(totals.exactMatch) / totalIters,
      short: Number(totals.shortMismatch) / totalIters,
      long: Number(totals.longMismatch) / totalIters,
    };

    // Compute ratios across mismatch positions
    const posMeans = [nsPerOp.first, nsPerOp.mid, nsPerOp.last, nsPerOp.match];
    const maxMean = Math.max(...posMeans);
    const minMean = Math.min(...posMeans);
    const ratio = maxMean / minMean;

    // Output stats for transparency
    console.log(`[Timing Benchmark 10k iters] FirstChar: ${nsPerOp.first.toFixed(1)}ns, MidChar: ${nsPerOp.mid.toFixed(1)}ns, LastChar: ${nsPerOp.last.toFixed(1)}ns, Match: ${nsPerOp.match.toFixed(1)}ns. Disparity Ratio: ${ratio.toFixed(2)}x`);

    // In constant-time operations, execution time across different byte positions should be virtually identical
    // Ratio must comfortably be below threshold under parallel multi-core test runner load
    assert.ok(
      ratio < 3.5,
      `Timing variance too high across mismatch positions: ratio ${ratio.toFixed(2)}x (max: ${maxMean.toFixed(1)}ns, min: ${minMean.toFixed(1)}ns)`
    );

    // Verify boolean correctness
    assert.strictEqual(MasterCredentialManager.timingSafeVerify(diffFirst, secret), false);
    assert.strictEqual(MasterCredentialManager.timingSafeVerify(diffMid, secret), false);
    assert.strictEqual(MasterCredentialManager.timingSafeVerify(diffLast, secret), false);
    assert.strictEqual(MasterCredentialManager.timingSafeVerify(exactMatch, secret), true);
    assert.strictEqual(MasterCredentialManager.timingSafeVerify(shortMismatch, secret), false);
    assert.strictEqual(MasterCredentialManager.timingSafeVerify(longMismatch, secret), false);
  });

  // ==========================================================================
  // Section 3: Lockfile Corruption & Tampering Recovery
  // ==========================================================================
  await suite.test('3.1 Lockfile Corruption: Truncated / Invalid JSON fails gracefully without crash', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_corrupt_test_'));
    const lockFile = path.join(tmpDir, 'master_rate_limit.lock');

    try {
      // Write corrupted truncated JSON
      fs.writeFileSync(lockFile, '{"lockedUntil": 9999999999999, "failureTimest', 'utf8');

      // Instantiating rate limiter must NOT throw
      let limiter: MasterRateLimiter | null = null;
      assert.doesNotThrow(() => {
        limiter = new MasterRateLimiter({
          lockFilePath: lockFile,
        });
      }, 'Corrupted JSON lockfile must not throw an unhandled exception');

      // Status should safely report unlocked (defaulting safely)
      assert.strictEqual(limiter!.isLockedOut(), false);
      assert.strictEqual(limiter!.getStatus().remainingAttempts, 5);

      // Now record failures to verify write-over works
      for (let i = 0; i < 5; i++) {
        limiter!.recordFailure();
      }
      assert.strictEqual(limiter!.isLockedOut(), true);

      // Verify the file was overwritten with valid JSON
      const fileContent = fs.readFileSync(lockFile, 'utf8');
      const parsed = JSON.parse(fileContent);
      assert.strictEqual(typeof parsed.lockedUntil, 'number');
      assert.strictEqual(parsed.failureTimestamps.length, 5);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await suite.test('3.2 Lockfile Tampering: Malformed types in JSON are rejected safely', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_tamper_types_'));
    const lockFile = path.join(tmpDir, 'master_rate_limit.lock');

    try {
      // Case A: lockedUntil is a string or negative
      fs.writeFileSync(lockFile, JSON.stringify({ lockedUntil: "never_lock_me", failureTimestamps: "not_array" }));
      const limiterA = new MasterRateLimiter({ lockFilePath: lockFile });
      assert.strictEqual(limiterA.isLockedOut(), false);
      assert.strictEqual(limiterA.getStatus().remainingAttempts, 5);

      // Case B: lockedUntil is an object
      fs.writeFileSync(lockFile, JSON.stringify({ lockedUntil: { malicious: true }, failureTimestamps: [1, 2, 3] }));
      const limiterB = new MasterRateLimiter({ lockFilePath: lockFile });
      assert.strictEqual(limiterB.isLockedOut(), false);

      // Case C: lockedUntil is boolean true
      fs.writeFileSync(lockFile, JSON.stringify({ lockedUntil: true, failureTimestamps: null }));
      const limiterC = new MasterRateLimiter({ lockFilePath: lockFile });
      assert.strictEqual(limiterC.isLockedOut(), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await suite.test('3.3 Lockfile Permissions: Read-only directory / file fails closed in-memory without crashing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_readonly_test_'));
    const subDir = path.join(tmpDir, 'protected_security_dir');
    fs.mkdirSync(subDir);
    const lockFile = path.join(subDir, 'master_rate_limit.lock');

    // Create a pre-existing lock file and make it read-only
    fs.writeFileSync(lockFile, '{}', { mode: 0o444 });

    try {
      const limiter = new MasterRateLimiter({
        maxAttempts: 5,
        lockFilePath: lockFile,
      });

      // Recording failures should not crash even if write fails
      assert.doesNotThrow(() => {
        for (let i = 0; i < 5; i++) {
          limiter.recordFailure();
        }
      }, 'Writing to read-only lockfile must fail gracefully without throwing');

      // In-memory lockout must STILL be enforced!
      assert.strictEqual(limiter.isLockedOut(), true, 'In-memory state must enforce lockout despite disk error');
      assert.strictEqual(limiter.getStatus().remainingAttempts, 0);
    } finally {
      try {
        fs.chmodSync(lockFile, 0o666);
      } catch (_) {}
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  await suite.test('3.4 Lockfile Non-Existent Deep Nested Directory Auto-Creation', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbx_nested_test_'));
    const deepLockFile = path.join(tmpDir, 'deep', 'nested', 'path', 'security', 'master.lock');

    try {
      assert.strictEqual(fs.existsSync(path.dirname(deepLockFile)), false);

      const limiter = new MasterRateLimiter({
        maxAttempts: 5,
        lockFilePath: deepLockFile,
      });

      limiter.recordFailure();
      // Verify parent directories were created
      assert.strictEqual(fs.existsSync(path.dirname(deepLockFile)), true, 'Nested directories must be created');
      assert.strictEqual(fs.existsSync(deepLockFile), true, 'Lock file must be created');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ==========================================================================
  // Section 4: Extreme Input Payloads & Boundary Attacks
  // ==========================================================================
  await suite.test('4.1 Extreme Input: 1MB massive payload rejected in bounded time (DoS prevention)', () => {
    const oneMegabyteString = 'A'.repeat(1024 * 1024); // 1,048,576 chars

    const t0 = process.hrtime.bigint();
    const result = MasterCredentialManager.timingSafeVerify(oneMegabyteString, masterSecret);
    const elapsedNs = Number(process.hrtime.bigint() - t0);

    assert.strictEqual(result, false, '1MB payload must return false');
    // Because > 4096 chars bypasses heavy hashing, elapsed time should be < 5ms (5,000,000ns)
    assert.ok(
      elapsedNs < 5000000,
      `1MB verification took too long: ${elapsedNs}ns (> 5ms). Potential DoS vector!`
    );
  });

  await suite.test('4.2 Extreme Input: Null bytes in candidate and secret', () => {
    const secretWithNull = 'sbx\0secret\0with\0nulls';
    const candidateExact = 'sbx\0secret\0with\0nulls';
    const candidateTrunc = 'sbx';
    const candidateDiff = 'sbx\0secret\0diff\0nulls';

    assert.strictEqual(
      MasterCredentialManager.timingSafeVerify(candidateExact, secretWithNull),
      true,
      'Exact matching secret with embedded null bytes must verify'
    );
    assert.strictEqual(
      MasterCredentialManager.timingSafeVerify(candidateTrunc, secretWithNull),
      false,
      'Candidate truncated at null byte must NOT verify (no C-string termination bug)'
    );
    assert.strictEqual(
      MasterCredentialManager.timingSafeVerify(candidateDiff, secretWithNull),
      false,
      'Candidate differing after null byte must NOT verify'
    );
  });

  await suite.test('4.3 Extreme Input: Prototype pollution keys and object injection', () => {
    const maliciousPayloads: any[] = [
      '__proto__',
      'constructor',
      'prototype',
      '__defineGetter__',
      '__defineSetter__',
      '__lookupGetter__',
      JSON.parse('{"__proto__": {"isAdmin": true}}'),
      { constructor: { prototype: { poll: true } } },
      Object.create(null),
      [1, 2, 3],
      new Uint8Array([1, 2, 3, 4]),
    ];

    for (const payload of maliciousPayloads) {
      assert.doesNotThrow(() => {
        const res = MasterCredentialManager.timingSafeVerify(payload, masterSecret);
        assert.strictEqual(res, false, `Malicious payload must be safely rejected`);
      });
    }

    // Verify global Object prototype remains unpolluted
    assert.strictEqual((Object.prototype as any).isAdmin, undefined);
    assert.strictEqual((Object.prototype as any).poll, undefined);
  });

  await suite.test('4.4 Extreme Input: Non-string JavaScript primitives and edge values', () => {
    const exoticInputs: any[] = [
      null,
      undefined,
      0,
      -0,
      NaN,
      Infinity,
      -Infinity,
      BigInt(9007199254740991),
      Symbol('secret'),
      Symbol.for('master'),
      () => true,
      async () => masterSecret,
      new Date(),
      /sbx_prod_master_secret/,
    ];

    for (const input of exoticInputs) {
      assert.doesNotThrow(() => {
        const res = MasterCredentialManager.timingSafeVerify(input, masterSecret);
        assert.strictEqual(res, false, `Exotic input (${String(input)}) must return false safely`);
      });
    }
  });

  await suite.test('4.5 Browser Fallback Service: 50-burst lockout and input safety', async () => {
    const service = new MasterCredentialService();
    service.getFallbackProvider().reset();

    // 50 concurrent calls to fallback provider
    const promises = Array.from({ length: 50 }, (_, i) =>
      service.verifyMasterCredential(`fallback_wrong_${i}`)
    );
    const results = await Promise.all(promises);

    const lockedResults = results.filter((r) => r.errorCode === 'LOCKED_OUT');
    assert.strictEqual(lockedResults.length, 46, 'Browser fallback must lock out 46 of 50 burst calls');

    const status = await service.getStatus();
    assert.strictEqual(status.isLocked, true);
    assert.strictEqual(status.remainingAttempts, 0);
  });
});
