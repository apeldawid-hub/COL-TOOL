/**
 * Starbucks Operations Suite — Milestone 4 Security Test Suite
 * File: tests/security/master_recovery_bip39.test.ts
 *
 * Scope: Feature F10 — Zero-Dependency BIP-39 Disaster Recovery Engine
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  BIP39_ENGLISH_WORDLIST,
  BIP39_WORDLIST,
  BIP39_WORD_INDEX_MAP,
} from '../../src/services/security/bip39Wordlist';
import {
  MasterRecoveryService,
  masterRecoveryService,
} from '../../src/services/security/masterRecoveryService';

test('M4-F10: BIP-39 Disaster Recovery & Key Derivation Suite', async (suite) => {
  // ==========================================================================
  // Section 1: Canonical BIP-39 Wordlist Integrity & SHA-256 Attestation
  // ==========================================================================
  await suite.test('1.1 Wordlist contains exactly 2,048 unique sorted words', () => {
    assert.strictEqual(BIP39_ENGLISH_WORDLIST.length, 2048, 'Wordlist must have exactly 2048 words');
    assert.strictEqual(BIP39_WORDLIST.length, 2048, 'Alias must match length');
    assert.strictEqual(BIP39_WORD_INDEX_MAP.size, 2048, 'Index map must have 2048 entries');

    // Strict alphabetical order check
    for (let i = 0; i < BIP39_ENGLISH_WORDLIST.length - 1; i++) {
      const current = BIP39_ENGLISH_WORDLIST[i];
      const next = BIP39_ENGLISH_WORDLIST[i + 1];
      assert.ok(
        current < next,
        `Words must be strictly sorted: ${current} should be before ${next}`
      );
    }

    // Boundary words check
    assert.strictEqual(BIP39_ENGLISH_WORDLIST[0], 'abandon', 'Word 0 must be abandon');
    assert.strictEqual(BIP39_ENGLISH_WORDLIST[102], 'art', 'Word 102 must be art');
    assert.strictEqual(BIP39_ENGLISH_WORDLIST[1967], 'vote', 'Word 1967 must be vote');
    assert.strictEqual(BIP39_ENGLISH_WORDLIST[2047], 'zoo', 'Word 2047 must be zoo');

    // Reverse map lookup verification
    assert.strictEqual(BIP39_WORD_INDEX_MAP.get('abandon'), 0);
    assert.strictEqual(BIP39_WORD_INDEX_MAP.get('art'), 102);
    assert.strictEqual(BIP39_WORD_INDEX_MAP.get('vote'), 1967);
    assert.strictEqual(BIP39_WORD_INDEX_MAP.get('zoo'), 2047);
  });

  await suite.test('1.2 Wordlist strictly matches official SatoshiLabs SHA-256 digest', () => {
    const raw = BIP39_ENGLISH_WORDLIST.join('\n') + '\n';
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    assert.strictEqual(
      hash,
      '2f5eed53a4727b4bf8880d8f3f199efc90e58503646d9ff8eff3a2ed3b24dbda',
      'Wordlist SHA-256 must match official Bitcoin BIP-0039 english.txt checksum verbatim'
    );
  });

  await suite.test('1.3 Restoration verification: canonical indices & absence of foreign words', () => {
    assert.strictEqual(BIP39_ENGLISH_WORDLIST[583], 'employ', 'employ must be at canonical index 583');
    assert.strictEqual(BIP39_ENGLISH_WORDLIST[806], 'gospel', 'gospel must be at canonical index 806');
    assert.strictEqual(BIP39_ENGLISH_WORDLIST[1483], 'ride', 'ride must be at canonical index 1483');
    assert.strictEqual(BIP39_ENGLISH_WORDLIST[1019], 'legal', 'legal must be at canonical index 1019');
    assert.strictEqual(BIP39_ENGLISH_WORDLIST[1533], 'sausage', 'sausage must be at canonical index 1533');
    assert.strictEqual(BIP39_ENGLISH_WORDLIST[2040], 'yellow', 'yellow must be at canonical index 2040');

    assert.strictEqual(BIP39_WORD_INDEX_MAP.has('ladle'), false, 'ladle (SLIP-39) must not be present');
    assert.strictEqual(BIP39_WORD_INDEX_MAP.has('offline'), false, 'offline must not be present');
  });

  // ==========================================================================
  // Section 2: Official SatoshiLabs / Trezor Reference Vectors
  // ==========================================================================
  await suite.test('2.1 Official Vector: All-Zeros 256-bit entropy -> 23x abandon + art', () => {
    const entropyZeros = new Uint8Array(32); // All 0x00
    const mnemonic = MasterRecoveryService.entropyToMnemonic(entropyZeros);
    const expected = Array(23).fill('abandon').concat('art').join(' ');

    assert.strictEqual(mnemonic, expected, 'All-zeros entropy must produce 23x abandon + art');

    const validation = MasterRecoveryService.validateRecoveryMnemonic(mnemonic);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.checksumValid, true);
    assert.strictEqual(validation.hexEntropy, '00'.repeat(32));
  });

  await suite.test('2.2 Official Vector: All-Ones 256-bit entropy -> 23x zoo + vote', () => {
    const entropyOnes = new Uint8Array(32);
    entropyOnes.fill(0xff); // All 0xFF
    const mnemonic = MasterRecoveryService.entropyToMnemonic(entropyOnes);
    const expected = Array(23).fill('zoo').concat('vote').join(' ');

    assert.strictEqual(mnemonic, expected, 'All-ones entropy must produce 23x zoo + vote');

    const validation = MasterRecoveryService.validateRecoveryMnemonic(mnemonic);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.checksumValid, true);
    assert.strictEqual(validation.hexEntropy, 'ff'.repeat(32));
  });

  await suite.test('2.3 Official Vector: PBKDF2 seed derivation with passphrase TREZOR', async () => {
    const mnemonic = Array(23).fill('abandon').concat('art').join(' ');
    const expectedSeed =
      'bda85446c68413707090a52022edd26a1c9462295029f2e60cd7c4f2bbd3097170af7a4d73245cafa9c3cca8d561a7c3de6f5d4a10be8ed2a5e608d68f92fcc8';

    // Synchronous derivation
    const seedSync = MasterRecoveryService.mnemonicToSeedSync(mnemonic, 'TREZOR');
    assert.strictEqual(seedSync.toString('hex'), expectedSeed);

    // Asynchronous derivation
    const seedAsync = await MasterRecoveryService.mnemonicToSeed(mnemonic, 'TREZOR');
    assert.strictEqual(seedAsync.toString('hex'), expectedSeed);
  });

  await suite.test('2.4 Official Vector: PBKDF2 seed derivation with empty passphrase', async () => {
    const mnemonic = Array(23).fill('abandon').concat('art').join(' ');
    const expectedSeed =
      '408b285c123836004f4b8842c89324c1f01382450c0d439af345ba7fc49acf705489c6fc77dbd4e3dc1dd8cc6bc9f043db8ada1e243c4a0eafb290d399480840';

    const seedSync = MasterRecoveryService.mnemonicToSeedSync(mnemonic, '');
    assert.strictEqual(seedSync.toString('hex'), expectedSeed);

    const seedAsync = await MasterRecoveryService.mnemonicToSeed(mnemonic, '');
    assert.strictEqual(seedAsync.toString('hex'), expectedSeed);
  });

  await suite.test('2.5 Official Vector: 256-bit mid-range 0x7F vector round-trip & canonical words', () => {
    const entropy7f = new Uint8Array(32).fill(0x7f);
    const mnemonic = MasterRecoveryService.entropyToMnemonic(entropy7f);
    const expectedWords =
      'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title';
    assert.strictEqual(mnemonic, expectedWords, '0x7F vector must match canonical 24 words');

    const validation = MasterRecoveryService.validateRecoveryMnemonic(mnemonic);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.checksumValid, true);
    assert.strictEqual(Buffer.from(validation.entropy!).equals(Buffer.from(entropy7f)), true);
  });

  // ==========================================================================
  // Section 3: 100+ Randomized Round-Trip Fuzz Cycles
  // ==========================================================================
  await suite.test('3.1 100+ randomized round-trip CSPRNG generation & extraction cycles', () => {
    for (let cycle = 0; cycle < 100; cycle++) {
      const mnemonic = MasterRecoveryService.generateMasterRecoveryMnemonic();
      const words = mnemonic.split(' ');
      assert.strictEqual(words.length, 24, `Cycle ${cycle}: Mnemonic must be exactly 24 words`);

      const result = MasterRecoveryService.validateRecoveryMnemonic(mnemonic);
      assert.strictEqual(result.valid, true, `Cycle ${cycle}: Mnemonic must validate successfully`);
      assert.strictEqual(result.checksumValid, true, `Cycle ${cycle}: Checksum must be valid`);
      assert.ok(result.entropy && result.entropy.length === 32, `Cycle ${cycle}: Entropy must be 32 bytes`);

      // Re-encode extracted entropy and confirm bit-exact match
      const reencoded = MasterRecoveryService.entropyToMnemonic(result.entropy!);
      assert.strictEqual(reencoded, mnemonic, `Cycle ${cycle}: Re-encoded mnemonic must match original`);
    }
  });

  // ==========================================================================
  // Section 4: Tamper Detection & Input Validation
  // ==========================================================================
  await suite.test('4.1 Tamper detection: modifying single word fails checksum', () => {
    const validMnemonic = MasterRecoveryService.generateMasterRecoveryMnemonic();
    const words = validMnemonic.split(' ');

    // Alter word 24
    const originalLastWord = words[23];
    const candidateWord = originalLastWord === 'zoo' ? 'abandon' : 'zoo';
    words[23] = candidateWord;
    const tamperedLast = words.join(' ');

    const resLast = MasterRecoveryService.validateRecoveryMnemonic(tamperedLast);
    assert.strictEqual(resLast.valid, false);
    assert.match(resLast.error || '', /Invalid checksum/i);

    // Alter word 1
    const originalFirstWord = words[0];
    words[0] = originalFirstWord === 'abandon' ? 'ability' : 'abandon';
    words[23] = originalLastWord; // restore 24
    const tamperedFirst = words.join(' ');

    const resFirst = MasterRecoveryService.validateRecoveryMnemonic(tamperedFirst);
    assert.strictEqual(resFirst.valid, false);
    assert.match(resFirst.error || '', /Invalid checksum/i);
  });

  await suite.test('4.2 Tamper detection: swapping two adjacent words fails validation', () => {
    const validMnemonic = MasterRecoveryService.generateMasterRecoveryMnemonic();
    const words = validMnemonic.split(' ');

    // Swap word 10 and 11
    const temp = words[10];
    words[10] = words[11];
    words[11] = temp;
    const swapped = words.join(' ');

    const res = MasterRecoveryService.validateRecoveryMnemonic(swapped);
    assert.strictEqual(res.valid, false);
  });

  await suite.test('4.3 Tamper detection: non-dictionary words are detected with exact position', () => {
    const validMnemonic = MasterRecoveryService.generateMasterRecoveryMnemonic();
    const words = validMnemonic.split(' ');

    words[4] = 'starbucks'; // Position 5 (1-based)
    words[12] = 'frappuccino';

    const res = MasterRecoveryService.validateRecoveryMnemonic(words.join(' '));
    assert.strictEqual(res.valid, false);
    assert.ok(res.invalidWords?.includes('starbucks'));
    assert.ok(res.invalidWords?.includes('frappuccino'));
    assert.match(res.error || '', /starbucks/);
  });

  await suite.test('4.4 Invalid word counts (0, 12, 18, 23, 25 words) are strictly rejected', () => {
    const baseWords = MasterRecoveryService.generateMasterRecoveryMnemonic().split(' ');
    const paddedWords = [...baseWords, 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo', 'zoo'];

    const testLengths = [0, 1, 12, 15, 18, 23, 25, 30];
    for (const len of testLengths) {
      const phrase = paddedWords.slice(0, len).join(' ');
      const res = MasterRecoveryService.validateRecoveryMnemonic(phrase);
      assert.strictEqual(res.valid, false, `Length ${len} must be rejected`);
      assert.match(res.error || '', /Invalid mnemonic length|must be a non-empty string/i);
    }
  });

  await suite.test('4.5 Whitespace, case, and NFKD normalization tolerance', () => {
    const validMnemonic = MasterRecoveryService.generateMasterRecoveryMnemonic();
    // Uppercase, multi-space, leading/trailing whitespace, and tabs
    const messyMnemonic =
      '  \t' + validMnemonic.toUpperCase().split(' ').join('   \t  ') + '  \n ';

    const res = MasterRecoveryService.validateRecoveryMnemonic(messyMnemonic);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.checksumValid, true);
  });

  // ==========================================================================
  // Section 5: Hierarchical Key Derivations
  // ==========================================================================
  await suite.test('5.1 Deterministic hierarchical disaster recovery key derivations', () => {
    const seed = crypto.randomBytes(64);

    // Root Key derivation is deterministic
    const rootKey1 = MasterRecoveryService.deriveMasterRootKey(seed);
    const rootKey2 = MasterRecoveryService.deriveMasterRootKey(seed);
    assert.strictEqual(rootKey1.toString('hex'), rootKey2.toString('hex'));
    assert.strictEqual(rootKey1.length, 32);

    // Master Passphrase derivation is deterministic hex string
    const pass1 = MasterRecoveryService.deriveMasterPassphrase(seed);
    const pass2 = MasterRecoveryService.deriveMasterPassphrase(seed);
    assert.strictEqual(pass1, pass2);
    assert.strictEqual(pass1.length, 64);

    // Store SEK derivation is deterministic and domain-isolated
    const storeSekA = MasterRecoveryService.deriveStoreRecoveryKey(seed, '18120', '384');
    const storeSekA2 = MasterRecoveryService.deriveStoreRecoveryKey(seed, '18120', '384');
    const storeSekB = MasterRecoveryService.deriveStoreRecoveryKey(seed, '18121', '385');
    assert.strictEqual(storeSekA.toString('hex'), storeSekA2.toString('hex'));
    assert.notStrictEqual(storeSekA.toString('hex'), storeSekB.toString('hex'), 'Different stores must have different SEKs');

    // Emergency Admin Token derivation
    const adminToken1 = MasterRecoveryService.deriveEmergencyAdminToken(seed);
    const adminToken2 = MasterRecoveryService.deriveEmergencyAdminToken(seed);
    assert.strictEqual(adminToken1, adminToken2);
    assert.strictEqual(adminToken1.length, 64);

    // Offline Store Certificate generation
    const cert = MasterRecoveryService.generateOfflineStoreCertificate(seed, '18120', 'fp_test_123', 30);
    assert.strictEqual(cert.storeId, '18120');
    assert.strictEqual(cert.hardwareFingerprint, 'fp_test_123');
    assert.ok(cert.signature && cert.signature.length === 64);
  });

  // ==========================================================================
  // Section 6: Memory Hygiene & Zeroization
  // ==========================================================================
  await suite.test('6.1 wipeBuffer and withWipedBuffer zeroizes memory cleanly', () => {
    const buf = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    MasterRecoveryService.wipeBuffer(buf);
    assert.ok(buf.every((byte) => byte === 0), 'Buffer must be all zeroes after wipeBuffer');

    const testBuf = Buffer.from('super_secret_payload');
    const result = MasterRecoveryService.withWipedBuffer(testBuf, (b) => {
      assert.strictEqual(b.toString(), 'super_secret_payload');
      return 42;
    });
    assert.strictEqual(result, 42);
    assert.ok(testBuf.every((byte) => byte === 0), 'Buffer must be all zeroes after withWipedBuffer');
  });

  await suite.test('6.2 Instance method parity with static methods', () => {
    assert.strictEqual(typeof masterRecoveryService.generateMasterRecoveryMnemonic, 'function');
    assert.strictEqual(typeof masterRecoveryService.validateRecoveryMnemonic, 'function');
    assert.strictEqual(typeof masterRecoveryService.mnemonicToSeedSync, 'function');
    assert.strictEqual(typeof masterRecoveryService.deriveMasterRootKey, 'function');
  });
});
