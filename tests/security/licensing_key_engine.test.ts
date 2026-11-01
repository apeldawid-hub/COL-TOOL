/**
 * Starbucks Operations Suite — Milestone 1 Security Test Suite
 * File: tests/security/licensing_key_engine.test.ts
 *
 * Scope: Feature F1 — Activation Key Cryptographic Engine
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { LicensingService, timingSafeStringEqual } from '../../src/services/security/licensingService';

test('M1-F1: Licensing Key Cryptographic Engine', async (t) => {
  const storeId = '108120';
  const masterSecret = 'sbx_test_master_secret_2026';

  // --------------------------------------------------------------------------
  // 1. Key Generation & Canonical Structure
  // --------------------------------------------------------------------------
  await t.test('test_f1_key_generation_matches_canonical_regex_format', () => {
    const key = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT', masterSecret);
    const regex = /^SBX-([A-Z0-9_]{3,16})-([A-F0-9]{16})-([A-F0-9]{10})$/;

    assert.match(key, regex, 'Generated key must match SBX-<storeId>-<randomHex>-<checksum>');
    const match = key.match(regex)!;
    assert.equal(match[1], storeId, 'Store ID segment must match requested store');
  });

  await t.test('test_f1_tier_encoding_byte_zero', () => {
    const clientKey = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT', masterSecret);
    const masterKey = LicensingService.generateActivationKey('HQ_FLEET', 'FLEET_MASTER', masterSecret);

    const clientParts = clientKey.split('-');
    const masterParts = masterKey.split('-');

    // Byte 0 in hex (chars 0..1)
    assert.equal(clientParts[2].substring(0, 2), '01', 'STORE_CLIENT must have tier byte 01');
    assert.equal(masterParts[2].substring(0, 2), 'FF', 'FLEET_MASTER must have tier byte FF');
  });

  await t.test('test_f1_entropy_uniqueness_no_collisions', () => {
    const generatedKeys = new Set<string>();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      const key = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT', masterSecret);
      assert.equal(generatedKeys.has(key), false, `Collision detected at iteration ${i}: ${key}`);
      generatedKeys.add(key);
    }

    assert.equal(generatedKeys.size, count, '1,000 generated keys must all be globally unique');
  });

  await t.test('test_f1_lowercase_store_id_normalization', () => {
    const key = LicensingService.generateActivationKey('warszawa_janki', 'STORE_CLIENT', masterSecret);
    assert.ok(key.startsWith('SBX-WARSZAWA_JANKI-'), 'Store ID must be normalized to uppercase');
  });

  // --------------------------------------------------------------------------
  // 2. Format Validation & Boundary Rejection
  // --------------------------------------------------------------------------
  await t.test('test_f1_format_validation_valid_keys', () => {
    const key1 = LicensingService.generateActivationKey('108120', 'STORE_CLIENT', masterSecret);
    const res1 = LicensingService.validateKeyFormat(key1);
    assert.equal(res1.valid, true);
    assert.equal(res1.storeId, '108120');
    assert.equal(res1.tier, 'STORE_CLIENT');

    const key2 = LicensingService.generateActivationKey('HQ_MASTER', 'FLEET_MASTER', masterSecret);
    const res2 = LicensingService.validateKeyFormat(key2);
    assert.equal(res2.valid, true);
    assert.equal(res2.tier, 'FLEET_MASTER');
  });

  await t.test('test_f1_format_validation_invalid_prefixes', () => {
    const invalidPrefix = 'XXX-108120-01A4F8B2C9013D7E-7F2A9B8C1D';
    const res = LicensingService.validateKeyFormat(invalidPrefix);
    assert.equal(res.valid, false);
    assert.ok(res.error?.includes('format') || res.error?.includes('SBX'));
  });

  await t.test('test_f1_format_validation_malformed_random_hex_lengths', () => {
    // 15 chars instead of 16
    const shortRandom = 'SBX-108120-01A4F8B2C9013D7-7F2A9B8C1D';
    assert.equal(LicensingService.validateKeyFormat(shortRandom).valid, false);

    // 17 chars instead of 16
    const longRandom = 'SBX-108120-01A4F8B2C9013D7EAA-7F2A9B8C1D';
    assert.equal(LicensingService.validateKeyFormat(longRandom).valid, false);
  });

  await t.test('test_f1_format_validation_non_hex_characters', () => {
    // Character 'Z' in randomHex
    const nonHexRandom = 'SBX-108120-01A4F8B2C9013D7Z-7F2A9B8C1D';
    assert.equal(LicensingService.validateKeyFormat(nonHexRandom).valid, false);

    // Character 'Q' in checksum
    const nonHexChecksum = 'SBX-108120-01A4F8B2C9013D7E-7F2A9B8C1Q';
    assert.equal(LicensingService.validateKeyFormat(nonHexChecksum).valid, false);
  });

  // --------------------------------------------------------------------------
  // 3. Cryptographic Signature & Tamper Detection
  // --------------------------------------------------------------------------
  await t.test('test_f1_legitimate_key_verifies_signature', () => {
    const key = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT', masterSecret);
    const isValid = LicensingService.verifyKeySignature(key, storeId, masterSecret);
    assert.equal(isValid, true, 'Legitimate key must verify successfully');
  });

  await t.test('test_f1_tampered_store_id_fails_signature', () => {
    const key108120 = LicensingService.generateActivationKey('108120', 'STORE_CLIENT', masterSecret);

    // Cross-store attack: attempting to use key for 108120 on store 108150
    const isValidFor108150 = LicensingService.verifyKeySignature(key108120, '108150', masterSecret);
    assert.equal(isValidFor108150, false, 'Key for 108120 must be rejected for store 108150');

    // Tampering key string directly to 108150 keeping same checksum
    const parts = key108120.split('-');
    const forgedKey = `SBX-108150-${parts[2]}-${parts[3]}`;
    assert.equal(LicensingService.verifyKeySignature(forgedKey, '108150', masterSecret), false);
  });

  await t.test('test_f1_tampered_random_hex_fails_signature', () => {
    const key = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT', masterSecret);
    const parts = key.split('-');

    // Flip last character in randomHex
    const lastChar = parts[2].slice(-1);
    const flippedChar = lastChar === 'A' ? 'B' : 'A';
    const tamperedRandomHex = parts[2].slice(0, -1) + flippedChar;
    const tamperedKey = `SBX-${parts[1]}-${tamperedRandomHex}-${parts[3]}`;

    assert.equal(LicensingService.verifyKeySignature(tamperedKey, storeId, masterSecret), false);
  });

  await t.test('test_f1_tampered_checksum_fails_signature', () => {
    const key = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT', masterSecret);
    const parts = key.split('-');

    // Flip first character in checksum
    const firstChar = parts[3][0];
    const flippedChar = firstChar === 'F' ? 'E' : 'F';
    const tamperedChecksum = flippedChar + parts[3].slice(1);
    const tamperedKey = `SBX-${parts[1]}-${parts[2]}-${tamperedChecksum}`;

    assert.equal(LicensingService.verifyKeySignature(tamperedKey, storeId, masterSecret), false);
  });

  await t.test('test_f1_privilege_escalation_tier_flip_fails', () => {
    const clientKey = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT', masterSecret);
    const parts = clientKey.split('-');

    // Attacker flips Byte 0 from 01 to FF to impersonate FLEET_MASTER
    const escalatedRandomHex = 'FF' + parts[2].substring(2);
    const escalatedKey = `SBX-${parts[1]}-${escalatedRandomHex}-${parts[3]}`;

    assert.equal(
      LicensingService.verifyKeySignature(escalatedKey, storeId, masterSecret),
      false,
      'Privilege escalation attack must fail checksum verification'
    );
  });

  await t.test('test_f1_timing_safe_string_equality', () => {
    assert.equal(timingSafeStringEqual('7F2A9B8C1D', '7F2A9B8C1D'), true);
    assert.equal(timingSafeStringEqual('7F2A9B8C1D', '7F2A9B8C1E'), false);
    assert.equal(timingSafeStringEqual('7F2A9B8C1D', '7F2A9B8C1'), false); // length mismatch
    assert.equal(timingSafeStringEqual('', ''), true);
    assert.equal(timingSafeStringEqual('A', ''), false);
  });
});
