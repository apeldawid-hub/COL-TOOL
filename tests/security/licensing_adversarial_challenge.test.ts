/**
 * Starbucks Operations Suite — Milestone 1 Adversarial Challenge Test Suite
 * File: tests/security/licensing_adversarial_challenge.test.ts
 *
 * Scope: Empirical Adversarial Stress Testing of the Licensing & Hardware-Bound Activation Engine
 * - Collision stress testing across 5,000+ keys (10,000 keys generated)
 * - 1-bit and 1-character mutation forgery and brute-force resistance
 * - Boundary values (length extremes, special chars, null bytes, unicode, injections)
 * - Constant-time comparison robustness under length mismatches, invalid types, and timing analysis
 * - Adversarial license envelope tampering & Kill-Switch bypass verification
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  LicensingService,
  timingSafeStringEqual,
  ILicensingStorageProvider,
  IHardwareFingerprintProvider,
} from '../../src/services/security/licensingService';

test('M1-CHALLENGE: Adversarial Stress & Vulnerability Testing', async (t) => {
  const masterSecret = 'sbx_test_master_secret_2026';

  // ==========================================================================
  // CHALLENGE 1: Key Collision Resistance Across Large Samples (10,000 Keys)
  // ==========================================================================
  await t.test('challenge_1_massive_scale_collision_test_10000_keys', () => {
    const totalKeys = 10000;
    const generatedKeys = new Set<string>();
    const generatedEntropy = new Set<string>();
    const checksums = new Set<string>();

    const storeIds = ['108120', '18120', '384', 'STORE_001', 'HQ_MASTER', 'WARSZAWA_01'];
    const hexCounts: Record<string, number> = {};

    for (let i = 0; i < totalKeys; i++) {
      const storeId = storeIds[i % storeIds.length];
      const tier = i % 10 === 0 ? 'FLEET_MASTER' : 'STORE_CLIENT';
      const key = LicensingService.generateActivationKey(storeId, tier, masterSecret);

      // Check key uniqueness
      assert.equal(
        generatedKeys.has(key),
        false,
        `CRITICAL: Collision detected in fullKey at index ${i}: ${key}`
      );
      generatedKeys.add(key);

      // Check entropy uniqueness
      const parts = key.split('-');
      const randomHex = parts[2];
      const entropy = randomHex.substring(2); // Bytes 1..7 (14 hex chars = 56 bits)
      assert.equal(
        generatedEntropy.has(entropy),
        false,
        `CRITICAL: Collision detected in 56-bit CSPRNG entropy at index ${i}: ${entropy}`
      );
      generatedEntropy.add(entropy);

      checksums.add(parts[3]);

      // Track hex digit distribution for entropy quality check
      for (const ch of entropy) {
        hexCounts[ch] = (hexCounts[ch] || 0) + 1;
      }
    }

    assert.equal(generatedKeys.size, totalKeys, `All ${totalKeys} keys must be distinct`);
    assert.equal(generatedEntropy.size, totalKeys, `All ${totalKeys} entropy segments must be distinct`);

    // Verify entropy uniformity (14 chars * 10000 keys = 140,000 hex characters)
    // Expected frequency per hex digit (0-F, 16 bins): 140,000 / 16 = 8,750
    // Check that no bin deviates by more than 15% (3.5 sigma safety band)
    const totalHexChars = totalKeys * 14;
    const expectedPerBin = totalHexChars / 16;
    for (let h = 0; h < 16; h++) {
      const hexChar = h.toString(16).toUpperCase();
      const count = hexCounts[hexChar] || 0;
      const deviation = Math.abs(count - expectedPerBin) / expectedPerBin;
      assert.ok(
        deviation < 0.15,
        `Entropy bias detected for hex '${hexChar}': count=${count}, expected=${expectedPerBin}, dev=${(deviation * 100).toFixed(1)}%`
      );
    }
  });

  // ==========================================================================
  // CHALLENGE 2: Bit-Flip, 1-Char Mutation Forgery & Brute-Force Resistance
  // ==========================================================================
  await t.test('challenge_2_1char_and_1bit_mutations_never_forge_signature', () => {
    const hexChars = '0123456789ABCDEF';
    const sampleKeys = [
      LicensingService.generateActivationKey('108120', 'STORE_CLIENT', masterSecret),
      LicensingService.generateActivationKey('18120', 'STORE_CLIENT', masterSecret),
      LicensingService.generateActivationKey('384', 'STORE_CLIENT', masterSecret),
      LicensingService.generateActivationKey('HQ_MASTER', 'FLEET_MASTER', masterSecret),
    ];

    let totalChecksumMutations = 0;
    let totalRandomHexMutations = 0;
    let totalBitFlips = 0;

    for (const key of sampleKeys) {
      const parts = key.split('-');
      const prefix = parts[0];
      const storeId = parts[1];
      const randomHex = parts[2];
      const checksum = parts[3];

      // 1. Mutate each character of checksum (10 positions * 15 alt hex = 150 per key)
      for (let pos = 0; pos < checksum.length; pos++) {
        const originalChar = checksum[pos];
        for (const alt of hexChars) {
          if (alt === originalChar) continue;
          totalChecksumMutations++;
          const mutatedChecksum = checksum.substring(0, pos) + alt + checksum.substring(pos + 1);
          const forgedKey = `${prefix}-${storeId}-${randomHex}-${mutatedChecksum}`;
          const verified = LicensingService.verifyKeySignature(forgedKey, storeId, masterSecret);
          assert.equal(
            verified,
            false,
            `SECURITY FAILURE: Forged key passed with mutated checksum: ${forgedKey}`
          );
        }
      }

      // 2. Mutate each character of randomHex (16 positions * 15 alt hex = 240 per key)
      for (let pos = 0; pos < randomHex.length; pos++) {
        const originalChar = randomHex[pos];
        for (const alt of hexChars) {
          if (alt === originalChar) continue;
          totalRandomHexMutations++;
          const mutatedRandom = randomHex.substring(0, pos) + alt + randomHex.substring(pos + 1);
          const forgedKey = `${prefix}-${storeId}-${mutatedRandom}-${checksum}`;
          const verified = LicensingService.verifyKeySignature(forgedKey, storeId, masterSecret);
          assert.equal(
            verified,
            false,
            `SECURITY FAILURE: Forged key passed with mutated randomHex: ${forgedKey}`
          );
        }
      }

      // 3. Exact 1-bit flips in checksum (10 chars * 4 bits = 40 flips per key)
      for (let pos = 0; pos < checksum.length; pos++) {
        const val = parseInt(checksum[pos], 16);
        for (let bit = 0; bit < 4; bit++) {
          totalBitFlips++;
          const flippedVal = val ^ (1 << bit);
          const flippedChar = flippedVal.toString(16).toUpperCase();
          const mutatedChecksum = checksum.substring(0, pos) + flippedChar + checksum.substring(pos + 1);
          const forgedKey = `${prefix}-${storeId}-${randomHex}-${mutatedChecksum}`;
          const verified = LicensingService.verifyKeySignature(forgedKey, storeId, masterSecret);
          assert.equal(
            verified,
            false,
            `SECURITY FAILURE: Forged key passed 1-bit flip at pos ${pos} bit ${bit}`
          );
        }
      }

      // 4. Exact 1-bit flips in randomHex (16 chars * 4 bits = 64 flips per key)
      for (let pos = 0; pos < randomHex.length; pos++) {
        const val = parseInt(randomHex[pos], 16);
        for (let bit = 0; bit < 4; bit++) {
          totalBitFlips++;
          const flippedVal = val ^ (1 << bit);
          const flippedChar = flippedVal.toString(16).toUpperCase();
          const mutatedRandom = randomHex.substring(0, pos) + flippedChar + randomHex.substring(pos + 1);
          const forgedKey = `${prefix}-${storeId}-${mutatedRandom}-${checksum}`;
          const verified = LicensingService.verifyKeySignature(forgedKey, storeId, masterSecret);
          assert.equal(
            verified,
            false,
            `SECURITY FAILURE: Forged key passed 1-bit flip in randomHex at pos ${pos} bit ${bit}`
          );
        }
      }

      // 5. Mutate storeId characters
      for (let pos = 0; pos < storeId.length; pos++) {
        const altChar = storeId[pos] === '9' ? '8' : '9';
        const mutatedStoreId = storeId.substring(0, pos) + altChar + storeId.substring(pos + 1);
        const forgedKey = `${prefix}-${mutatedStoreId}-${randomHex}-${checksum}`;
        const verified = LicensingService.verifyKeySignature(forgedKey, mutatedStoreId, masterSecret);
        assert.equal(
          verified,
          false,
          `SECURITY FAILURE: Forged key passed with mutated storeId: ${forgedKey}`
        );
      }
    }

    assert.ok(totalChecksumMutations >= 600, `Tested ${totalChecksumMutations} checksum mutations`);
    assert.ok(totalRandomHexMutations >= 960, `Tested ${totalRandomHexMutations} randomHex mutations`);
    assert.ok(totalBitFlips >= 416, `Tested ${totalBitFlips} bit flips`);
  });

  await t.test('challenge_2_brute_force_forgery_resistance_10000_guesses', () => {
    // Attacker attempts 10,000 random checksum guesses for a known storeId and randomHex
    const targetStoreId = '108120';
    const targetRandomHex = '01A1B2C3D4E5F678';
    let falsePositives = 0;

    for (let i = 0; i < 10000; i++) {
      const guessedChecksum = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 chars
      const candidateKey = `SBX-${targetStoreId}-${targetRandomHex}-${guessedChecksum}`;
      if (LicensingService.verifyKeySignature(candidateKey, targetStoreId, masterSecret)) {
        falsePositives++;
      }
    }

    assert.equal(
      falsePositives,
      0,
      `SECURITY FAILURE: Brute-force guessing succeeded with ${falsePositives} false positives out of 10,000 attempts!`
    );
  });

  // ==========================================================================
  // CHALLENGE 3: Boundary Values, Edge Cases, and Input Sanitization
  // ==========================================================================
  await t.test('challenge_3_store_id_boundary_values_and_injections', () => {
    // Test store IDs: short, long, special, unicode, null byte, injections
    const boundaryCases = [
      { id: '', desc: 'empty string', shouldBeValid: false },
      { id: '   ', desc: 'whitespace only', shouldBeValid: false },
      { id: '1', desc: '1 char (too short)', shouldBeValid: false },
      { id: '12', desc: '2 chars (too short)', shouldBeValid: false },
      { id: '123', desc: '3 chars (min valid)', shouldBeValid: true },
      { id: '1234567890123456', desc: '16 chars (max valid)', shouldBeValid: true },
      { id: '12345678901234567', desc: '17 chars (too long)', shouldBeValid: false },
      { id: 'A'.repeat(100), desc: '100 chars (extremely long)', shouldBeValid: false },
      { id: 'A'.repeat(5000), desc: '5,000 chars (extreme buffer)', shouldBeValid: false },
      { id: 'STORE-123', desc: 'store ID with hyphen', shouldBeValid: false },
      { id: 'STORE.123', desc: 'store ID with dot', shouldBeValid: false },
      { id: 'STORE/123', desc: 'store ID with slash', shouldBeValid: false },
      { id: 'STORE:123', desc: 'store ID with colon', shouldBeValid: false },
      { id: 'STORE\x00123', desc: 'null byte inside storeId', shouldBeValid: false },
      { id: '108120\x00', desc: 'trailing null byte', shouldBeValid: false },
      { id: 'STORE\n123', desc: 'newline character', shouldBeValid: false },
      { id: 'STORE\t123', desc: 'tab character', shouldBeValid: false },
      { id: 'KRAKÓW_1', desc: 'polish unicode Ó', shouldBeValid: false },
      { id: 'МОСКВА', desc: 'cyrillic unicode', shouldBeValid: false },
      { id: '東京_101', desc: 'CJK unicode', shouldBeValid: false },
      { id: '☕_STORE', desc: 'emoji unicode', shouldBeValid: false },
      { id: "' OR '1'='1", desc: 'SQL injection string', shouldBeValid: false },
      { id: '<script>alert(1)</script>', desc: 'XSS payload', shouldBeValid: false },
      { id: '{"store":108120}', desc: 'JSON object payload', shouldBeValid: false },
      { id: '../../etc/passwd', desc: 'Path traversal string', shouldBeValid: false },
    ];

    for (const testCase of boundaryCases) {
      if (!testCase.shouldBeValid) {
        assert.throws(
          () => {
            LicensingService.generateActivationKey(testCase.id, 'STORE_CLIENT', masterSecret);
          },
          /Invalid store identifier/i,
          `Invalid store ID must throw on generation: ${testCase.desc}`
        );
      } else {
        // Generation produces a valid key
        const key = LicensingService.generateActivationKey(testCase.id, 'STORE_CLIENT', masterSecret);
        assert.ok(typeof key === 'string' && key.startsWith('SBX-'), `Key must start with SBX- for: ${testCase.desc}`);

        // Validate format
        const formatResult = LicensingService.validateKeyFormat(key);
        assert.equal(formatResult.valid, true, `Expected valid format for: ${testCase.desc}`);
        assert.equal(
          LicensingService.verifyKeySignature(key, testCase.id, masterSecret),
          true,
          `Expected valid signature for: ${testCase.desc}`
        );
      }
    }
  });

  await t.test('challenge_3_key_input_adversarial_types_and_extremes', () => {
    // Malformed and non-string inputs that must be rejected without unhandled exceptions
    const syntacticallyInvalidInputs: any[] = [
      null,
      undefined,
      123456,
      true,
      false,
      {},
      [],
      ['SBX-108120-01A1B2C3D4E5F678-1234567890'],
      { key: 'SBX-108120-01A1B2C3D4E5F678-1234567890' },
      () => 'SBX-108120-01A1B2C3D4E5F678-1234567890',
      Symbol('SBX-108120'),
      Buffer.from('SBX-108120-01A1B2C3D4E5F678-1234567890'),
      'SBX',
      'SBX-',
      'SBX--01A1B2C3D4E5F678-1234567890',
      'SBX-108120-',
      'SBX-108120-01A1B2C3D4E5F678-',
      'SBX-108120-01A1B2C3D4E5F678-1234567890-EXTRA',
      'SBX-108120-01A1B2C3D4E5F678-1234567890\x00',
      'A'.repeat(10000),
    ];

    for (const input of syntacticallyInvalidInputs) {
      const res = LicensingService.validateKeyFormat(input as any);
      assert.equal(res.valid, false, `Expected valid: false for syntactically invalid input: ${String(input)}`);

      const verified = LicensingService.verifyKeySignature(input as any);
      assert.equal(verified, false, `Expected verify: false for input: ${String(input)}`);
    }

    // Whitespace-padded valid format: validateKeyFormat trims, but signature check fails if checksum is fake
    const paddedKey = '  SBX-108120-01A1B2C3D4E5F678-1234567890\n';
    const paddedFormat = LicensingService.validateKeyFormat(paddedKey);
    assert.equal(paddedFormat.valid, true, 'Trimming should allow valid format extraction');
    assert.equal(LicensingService.verifyKeySignature(paddedKey, '108120', masterSecret), false, 'Fake signature must fail');
  });

  // ==========================================================================
  // CHALLENGE 4: Constant-Time Comparison Robustness & Type Safety
  // ==========================================================================
  await t.test('challenge_4_constant_time_comparison_edge_cases_and_types', () => {
    // 1. Length mismatches
    assert.equal(timingSafeStringEqual('A', 'AB'), false);
    assert.equal(timingSafeStringEqual('AB', 'A'), false);
    assert.equal(timingSafeStringEqual('', 'A'), false);
    assert.equal(timingSafeStringEqual('A', ''), false);
    assert.equal(timingSafeStringEqual('0123456789', '012345678'), false);
    assert.equal(timingSafeStringEqual('0123456789', '01234567890'), false);
    assert.equal(timingSafeStringEqual('A'.repeat(1000), 'A'.repeat(999)), false);

    // 2. Invalid non-string types
    const invalidTypes: any[] = [
      null,
      undefined,
      123,
      true,
      false,
      {},
      [],
      Buffer.from('test'),
      Symbol('test'),
      () => {},
    ];

    for (const inv of invalidTypes) {
      assert.equal(timingSafeStringEqual(inv, 'test'), false, `Must reject invalid type as 'a'`);
      assert.equal(timingSafeStringEqual('test', inv), false, `Must reject invalid type as 'b'`);
      assert.equal(timingSafeStringEqual(inv, inv), false, `Must reject invalid type for both`);
    }

    // 3. Multibyte UTF-8 characters and surrogates
    assert.equal(timingSafeStringEqual('é', 'a'), false);
    assert.equal(timingSafeStringEqual('é', 'é'), true);
    assert.equal(timingSafeStringEqual('Warszawa_Główna', 'Warszawa_Główna'), true);
    assert.equal(timingSafeStringEqual('Warszawa_Główna', 'Warszawa_Głowna'), false);

    // 4. Null bytes within string
    assert.equal(timingSafeStringEqual('abc\x00def', 'abc\x00def'), true);
    assert.equal(timingSafeStringEqual('abc\x00def', 'abc\x00deg'), false);
    assert.equal(timingSafeStringEqual('abc\x00def', 'abc\x00\x00ef'), false);

    // 5. Hex tags comparison
    const tagA = '7F2A9B8C1D';
    const tagB = '7F2A9B8C1E'; // Last char differs
    const tagC = '6F2A9B8C1D'; // First char differs
    assert.equal(timingSafeStringEqual(tagA, tagA), true);
    assert.equal(timingSafeStringEqual(tagA, tagB), false);
    assert.equal(timingSafeStringEqual(tagA, tagC), false);
  });

  await t.test('challenge_4_timing_variance_analysis_constant_time', () => {
    const iterations = 50000;
    const baseTag = 'A1B2C3D4E5';
    const diffFirst = 'F1B2C3D4E5'; // Differs at index 0
    const diffMid = 'A1B2F3D4E5';   // Differs at index 4
    const diffLast = 'A1B2C3D4EF';  // Differs at index 9
    const identical = 'A1B2C3D4E5'; // Identical

    // Warmup JIT
    for (let i = 0; i < 5000; i++) {
      timingSafeStringEqual(baseTag, diffFirst);
      timingSafeStringEqual(baseTag, diffLast);
      timingSafeStringEqual(baseTag, identical);
    }

    // Benchmark diffFirst
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      timingSafeStringEqual(baseTag, diffFirst);
    }
    const durFirst = Number(process.hrtime.bigint() - t0);

    // Benchmark diffMid
    const t1 = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      timingSafeStringEqual(baseTag, diffMid);
    }
    const durMid = Number(process.hrtime.bigint() - t1);

    // Benchmark diffLast
    const t2 = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      timingSafeStringEqual(baseTag, diffLast);
    }
    const durLast = Number(process.hrtime.bigint() - t2);

    // Benchmark identical
    const t3 = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      timingSafeStringEqual(baseTag, identical);
    }
    const durIdentical = Number(process.hrtime.bigint() - t3);

    // Verify constant-time behavior: ratio should be within tolerance under parallel test runner load
    const ratioFirstToLast = Math.max(durFirst, durLast) / Math.min(durFirst, durLast);
    assert.ok(
      ratioFirstToLast < 5.0,
      `Timing disparity detected between first-char diff (${durFirst}ns) and last-char diff (${durLast}ns). Ratio: ${ratioFirstToLast.toFixed(2)}`
    );
  });

  // ==========================================================================
  // CHALLENGE 5: Store ID Type Resilience & Edge Cases in verifyKeySignature
  // ==========================================================================
  await t.test('challenge_5_verify_key_signature_handles_non_string_expected_store_id', () => {
    const key = LicensingService.generateActivationKey('108120', 'STORE_CLIENT', masterSecret);

    // 1. Valid string checks
    assert.equal(LicensingService.verifyKeySignature(key, '108120', masterSecret), true);
    assert.equal(LicensingService.verifyKeySignature(key, ' 108120 ', masterSecret), true);
    assert.equal(LicensingService.verifyKeySignature(key, '108121', masterSecret), false);
    assert.equal(LicensingService.verifyKeySignature(key, undefined, masterSecret), true);

    // 2. Empty string expectedStoreId must return false without bypass
    const emptyStoreResult = LicensingService.verifyKeySignature(key, '', masterSecret);
    assert.equal(emptyStoreResult, false, 'Empty string expectedStoreId must return false');

    // 3. Whitespace expectedStoreId must return false
    const whitespaceStoreResult = LicensingService.verifyKeySignature(key, '   ', masterSecret);
    assert.equal(whitespaceStoreResult, false, 'Whitespace expectedStoreId must return false');

    // 4. Non-string expectedStoreId must return false without throwing TypeError
    assert.doesNotThrow(() => {
      const numericResult = LicensingService.verifyKeySignature(key, (108120 as any), masterSecret);
      assert.equal(numericResult, false, 'Numeric expectedStoreId must return false');
    });

    assert.doesNotThrow(() => {
      const objectResult = LicensingService.verifyKeySignature(key, ({ id: '108120' } as any), masterSecret);
      assert.equal(objectResult, false, 'Object expectedStoreId must return false');
    });
  });

  // ==========================================================================
  // CHALLENGE 6: Adversarial Envelope Tampering & Kill-Switch Bypass Probe
  // ==========================================================================
  await t.test('challenge_6_adversarial_kill_switch_tampering_vulnerability', async () => {
    let savedLicenseStr: string | null = null;
    const hw = 'a'.repeat(64);

    const mockStorage: ILicensingStorageProvider = {
      saveLicense: async (str: string) => {
        savedLicenseStr = str;
        return true;
      },
      loadLicense: async () => savedLicenseStr,
      revokeLicense: async () => true, // Simulate storage preserving file or backup restoration
    };

    const mockHwProvider: IHardwareFingerprintProvider = {
      getFingerprint: async () => hw,
    };

    const service = new LicensingService(mockStorage, mockHwProvider, masterSecret);
    const key = service.generateActivationKey('108120', 'STORE_CLIENT');

    // 1. Activate station
    const act = await service.activateStation(key, '108120');
    assert.equal(act.success, true);
    assert.equal(await service.isStationActivated(), true);

    // 2. Station is revoked via Kill-Switch
    await service.revokeLicense('Revoked by Fleet Admin');

    // In storage, license has revoked: true
    const parsedRevoked = JSON.parse(savedLicenseStr!);
    assert.equal(parsedRevoked.revoked, true);

    // 3. ATTACK SCENARIO: Adversary edits stored JSON and flips revoked: false
    parsedRevoked.revoked = false;
    delete parsedRevoked.revokeReason;
    savedLicenseStr = JSON.stringify(parsedRevoked);

    // 4. Verify station status
    const statusAfterAttack = await service.verifyStationHardwareLock();

    // Kill-Switch tampering prevention:
    // Because envelope signature cryptographically seals revoked status (ACTIVE vs REVOKED),
    // flipping revoked: false invalidates the HMAC and triggers TAMPER_DETECTED!
    assert.equal(
      statusAfterAttack.status,
      'TAMPER_DETECTED',
      'Tampering revoked status from true to false must trigger TAMPER_DETECTED'
    );
    assert.equal(statusAfterAttack.isActivated, false, 'Station must remain locked');
  });
});
