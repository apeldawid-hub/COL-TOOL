/**
 * Starbucks Operations Suite — Milestone 3 Cryptographic Adversarial Fuzzer & Stress Suite
 *
 * Tier 5 Adversarial Stress & Fuzzing:
 * 1. Ciphertext Bit-Flipping Fuzzing: 100 random byte flips in valid ciphertexts with 100% rejection and 0 false positives.
 * 2. Auth Tag Corruption Fuzzing: 100 random byte corruptions across 16-byte GCM tag + boundary corruptions (truncation, zeroing).
 * 3. AAD Context Tampering Fuzzing: 50+ mutations testing swapped storeId, swapped vaultType, swapped docId, cross-permutations.
 * 4. Key Collision Resistance: 50 store pairs testing key uniqueness, Hamming distance avalanche effect, and cross-store rejection.
 * 5. Concurrency Stress: 200 parallel encryption/decryption operations across 5 stores with zero race conditions and avg latency < 10ms.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  deriveStoreKeySync,
  deriveStoreKey,
  encryptPayloadSync,
  decryptPayloadSync,
  encryptPayload,
  decryptPayload,
  serializeEnvelope,
  parseEnvelope,
  canonicalJson,
  canonicalSha256,
  StoreKeyCache,
} from '../../../src/services/security/encryptionService';
import type { EncryptedEnvelope } from '../../../src/services/security/encryptionService';
import { VaultService } from '../../../src/services/security/vaultService';

test('Tier 5 Adversarial: Milestone 3 Cryptographic Engine Hardening & Fuzzing Suite', async (suite) => {
  const defaultStoreId = '108150';
  const defaultUnitCode = '18150';
  const defaultVaultType = 'vault_financials';
  const defaultDocId = 'month_2026_03';

  // Helper to generate representative Starbucks operational payload
  function generateTestPayload(index = 0) {
    return {
      storeId: defaultStoreId,
      unitCode: defaultUnitCode,
      index,
      timestamp: new Date().toISOString(),
      financials: {
        planSales: 384000.55 + index * 100,
        actualSales: 391200.75 + index * 50,
        totalColPLN: 98450.25,
        totalColPercent: 25.17,
        zusTaxPLN: 19178.11,
        bonusManagerPLN: 3500.0,
      },
      staff: [
        { id: 'mgr_1', name: 'Kierownik Michał Brzęczyszczykiewicz', role: 'STORE_MANAGER', hourlyRate: 46.5 },
        { id: 'bar_1', name: 'Stanisław Żółkiewski', role: 'BARISTA', hourlyRate: 31.85, sickLeaveL4: false },
        { id: 'bar_2', name: 'Grażyna Łączkowska', role: 'BARISTA', hourlyRate: 30.5, sickLeaveL4: true },
      ],
      legalNotice: 'Poufne dane płacowe Starbucks — Art. 9 RODO / Zażółć gęślą jaźń',
    };
  }

  // =========================================================================
  // 1. CIPHERTEXT BIT-FLIPPING FUZZING (100 RANDOM BYTE FLIPS)
  // =========================================================================
  await suite.test('1. Ciphertext Bit-Flipping: 100 Random Byte Flips in Valid Ciphertexts', async (t) => {
    const payload = generateTestPayload(1);
    const validEnvelope = encryptPayloadSync(payload, defaultStoreId, defaultUnitCode, defaultVaultType, defaultDocId);
    const rawCipher = Buffer.from(validEnvelope.ciphertext, 'base64');
    const cipherLength = rawCipher.length;

    assert.ok(cipherLength > 100, `Ciphertext buffer must be sufficiently large for fuzzing, got ${cipherLength} bytes`);

    let totalAttempts = 0;
    let rejectedAttempts = 0;
    let falsePositives = 0;
    const errorTypes = new Map<string, number>();

    // Execute 100 random bit flips across different byte offsets and bit positions
    for (let i = 0; i < 100; i++) {
      totalAttempts++;
      const corruptedBuf = Buffer.from(rawCipher);
      const randomByteOffset = Math.floor(Math.random() * cipherLength);
      const randomBitMask = 1 << Math.floor(Math.random() * 8);

      // Flip bit
      corruptedBuf[randomByteOffset] ^= randomBitMask;

      const tamperedEnvelope: EncryptedEnvelope = {
        ...validEnvelope,
        ciphertext: corruptedBuf.toString('base64'),
        serialized: `enc:v1:${defaultStoreId}:${validEnvelope.keyId}:${validEnvelope.iv}:${validEnvelope.tag}:${corruptedBuf.toString('base64')}`,
      };

      try {
        decryptPayloadSync(tamperedEnvelope, defaultStoreId, defaultUnitCode, defaultVaultType, defaultDocId);
        // If decryption succeeded on corrupted ciphertext, it's a catastrophic false positive
        falsePositives++;
      } catch (err: any) {
        rejectedAttempts++;
        const msg = String(err?.message || err);
        const errKey = msg.includes('Unsupported state or unable to authenticate data') || msg.includes('bad decrypt')
          ? 'GCM_AUTH_FAILED'
          : msg.slice(0, 40);
        errorTypes.set(errKey, (errorTypes.get(errKey) || 0) + 1);
      }
    }

    console.log(`[FUZZ RESULTS] Ciphertext Bit-Flipping: ${rejectedAttempts}/${totalAttempts} rejected (100%), false positives: ${falsePositives}`);
    assert.equal(totalAttempts, 100, 'Must execute exactly 100 fuzzing attempts');
    assert.equal(rejectedAttempts, 100, 'All 100 tampered ciphertexts must be rejected');
    assert.equal(falsePositives, 0, 'Zero false positives allowed (zero unrejected corrupted ciphertexts)');
    assert.ok(errorTypes.get('GCM_AUTH_FAILED')! >= 95, 'Must fail with GCM authentication error');

    // Also test through serialized string interface with 10 random flips
    for (let i = 0; i < 10; i++) {
      const corruptedBuf = Buffer.from(rawCipher);
      corruptedBuf[i % cipherLength] ^= 0xff;
      const serializedTampered = `enc:v1:${defaultStoreId}:${validEnvelope.keyId}:${validEnvelope.iv}:${validEnvelope.tag}:${corruptedBuf.toString('base64')}`;

      assert.throws(
        () => decryptPayloadSync(serializedTampered, defaultStoreId, defaultUnitCode, defaultVaultType, defaultDocId),
        /Unsupported state or unable to authenticate data|bad decrypt/i
      );
    }
  });

  // =========================================================================
  // 2. AUTH TAG CORRUPTION FUZZING (16-BYTE GCM TAG MUTATIONS)
  // =========================================================================
  await suite.test('2. Auth Tag Corruption: Systematic & Random Mutations of 16-byte GCM Tag', async (t) => {
    const payload = generateTestPayload(2);
    const validEnvelope = encryptPayloadSync(payload, defaultStoreId, defaultUnitCode, defaultVaultType, defaultDocId);
    const rawTag = Buffer.from(validEnvelope.tag, 'base64');

    assert.equal(rawTag.length, 16, 'AES-256-GCM authentication tag must be exactly 16 bytes');

    let tagAttempts = 0;
    let tagRejections = 0;
    let tagFalsePositives = 0;

    // Subtest 2.1: Systematic corruption of each of the 16 bytes
    for (let byteIdx = 0; byteIdx < 16; byteIdx++) {
      for (const mask of [0x01, 0x02, 0x80, 0xff]) {
        tagAttempts++;
        const corruptedTag = Buffer.from(rawTag);
        corruptedTag[byteIdx] ^= mask;

        const envelopeWithBadTag: EncryptedEnvelope = {
          ...validEnvelope,
          tag: corruptedTag.toString('base64'),
          serialized: `enc:v1:${defaultStoreId}:${validEnvelope.keyId}:${validEnvelope.iv}:${corruptedTag.toString('base64')}:${validEnvelope.ciphertext}`,
        };

        try {
          decryptPayloadSync(envelopeWithBadTag, defaultStoreId, defaultUnitCode, defaultVaultType, defaultDocId);
          tagFalsePositives++;
        } catch (err: any) {
          tagRejections++;
        }
      }
    }

    // Subtest 2.2: 100 randomized byte corruptions
    for (let i = 0; i < 100; i++) {
      tagAttempts++;
      const corruptedTag = Buffer.from(rawTag);
      const targetByte = Math.floor(Math.random() * 16);
      const randomByteVal = Math.floor(Math.random() * 255) + 1;
      corruptedTag[targetByte] ^= randomByteVal;

      const envelopeWithBadTag: EncryptedEnvelope = {
        ...validEnvelope,
        tag: corruptedTag.toString('base64'),
        serialized: `enc:v1:${defaultStoreId}:${validEnvelope.keyId}:${validEnvelope.iv}:${corruptedTag.toString('base64')}:${validEnvelope.ciphertext}`,
      };

      try {
        decryptPayloadSync(envelopeWithBadTag, defaultStoreId, defaultUnitCode, defaultVaultType, defaultDocId);
        tagFalsePositives++;
      } catch {
        tagRejections++;
      }
    }

    // Subtest 2.3: Boundary tag mutations (zero tag, inverted tag, length truncation)
    const zeroTag = Buffer.alloc(16, 0);
    const invertedTag = Buffer.from(rawTag.map((b) => ~b & 0xff));

    assert.throws(
      () => decryptPayloadSync({ ...validEnvelope, tag: zeroTag.toString('base64') }, defaultStoreId, defaultUnitCode, defaultVaultType, defaultDocId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );
    assert.throws(
      () => decryptPayloadSync({ ...validEnvelope, tag: invertedTag.toString('base64') }, defaultStoreId, defaultUnitCode, defaultVaultType, defaultDocId),
      /Unsupported state or unable to authenticate data|bad decrypt/i
    );

    // Tag truncation (lengths 0 through 15, and length 17)
    for (const len of [0, 1, 8, 12, 14, 15, 17, 32]) {
      const abnormalTag = Buffer.alloc(len, 0x42);
      assert.throws(
        () => decryptPayloadSync({ ...validEnvelope, tag: abnormalTag.toString('base64') }, defaultStoreId, defaultUnitCode, defaultVaultType, defaultDocId),
        /Invalid authentication tag length|Unsupported state or unable to authenticate data/i
      );
    }

    console.log(`[FUZZ RESULTS] Auth Tag Corruption: ${tagRejections}/${tagAttempts} rejected (100%), false positives: ${tagFalsePositives}`);
    assert.equal(tagRejections, tagAttempts);
    assert.equal(tagFalsePositives, 0);
  });

  // =========================================================================
  // 3. AAD CONTEXT TAMPERING (SWAPPED storeId, vaultType, docId & PERMUTATIONS)
  // =========================================================================
  await suite.test('3. AAD Context Tampering: Swapped storeId, vaultType, docId & Cross-Mutations', async (t) => {
    const payload = generateTestPayload(3);
    const envelope = encryptPayloadSync(payload, defaultStoreId, defaultUnitCode, defaultVaultType, defaultDocId);

    // Vector 3.1: Swapped storeId in decryption argument (with untouched envelope)
    const foreignStoreIds = ['108151', '108120', '108999', 'store_hacked', '999999'];
    for (const foreignId of foreignStoreIds) {
      assert.throws(
        () => decryptPayloadSync(envelope, foreignId, defaultUnitCode, defaultVaultType, defaultDocId),
        /Store ID mismatch in envelope/i,
        `Decryption must fail with Store ID mismatch when storeId argument ${foreignId} differs from envelope`
      );
    }

    // Vector 3.2: Forged envelope storeId matching forged decryption storeId (bypasses envelope check, hits GCM AAD)
    for (const foreignId of foreignStoreIds) {
      const forgedEnvelope: EncryptedEnvelope = {
        ...envelope,
        storeId: foreignId,
        serialized: `enc:v1:${foreignId}:${envelope.keyId}:${envelope.iv}:${envelope.tag}:${envelope.ciphertext}`,
      };

      assert.throws(
        () => decryptPayloadSync(forgedEnvelope, foreignId, defaultUnitCode, defaultVaultType, defaultDocId),
        /Unsupported state or unable to authenticate data|bad decrypt/i,
        `Decryption must fail with GCM auth error when AAD storeId is tampered to ${foreignId}`
      );
    }

    // Vector 3.3: Swapped vaultType
    const tamperedVaultTypes = [
      'vault_personnel',
      'vault_schedules',
      'vault_health_gdpr',
      'telemetry',
      'vault_financials_v2',
      'VAULT_FINANCIALS',
      'vault_financials ',
      '',
    ];
    for (const badVault of tamperedVaultTypes) {
      assert.throws(
        () => decryptPayloadSync(envelope, defaultStoreId, defaultUnitCode, badVault, defaultDocId),
        /Unsupported state or unable to authenticate data|bad decrypt/i,
        `Decryption must fail with GCM auth error when vaultType is tampered to '${badVault}'`
      );
    }

    // Vector 3.4: Swapped docId
    const tamperedDocIds = [
      'month_2026_04',
      'month_2026_02',
      'month_2025_03',
      'month_2026_03_injected',
      'doc_month_2026_03',
      'MONTH_2026_03',
      'month_2026_03\0',
      'month_2026_03:hacked',
    ];
    for (const badDoc of tamperedDocIds) {
      assert.throws(
        () => decryptPayloadSync(envelope, defaultStoreId, defaultUnitCode, defaultVaultType, badDoc),
        /Unsupported state or unable to authenticate data|bad decrypt/i,
        `Decryption must fail with GCM auth error when docId is tampered to '${badDoc}'`
      );
    }

    // Vector 3.5: Delimiter collision attacks (attempting to slide colons across AAD segments)
    // Original AAD: "108150:vault_financials:month_2026_03"
    // Attack 1: storeId = "108150:vault_financials", vaultType = "month_2026_03", docId = ""
    // Notice AAD would produce "108150:vault_financials:month_2026_03:" (trailing colon)
    const forgedColEnvelope: EncryptedEnvelope = {
      ...envelope,
      storeId: '108150:vault_financials',
      serialized: `enc:v1:108150:vault_financials:${envelope.keyId}:${envelope.iv}:${envelope.tag}:${envelope.ciphertext}`,
    };
    assert.throws(
      () => decryptPayloadSync(forgedColEnvelope, '108150:vault_financials', defaultUnitCode, 'month_2026_03', ''),
      /Unsupported state or unable to authenticate data|bad decrypt|Malformed envelope/i
    );
  });

  // =========================================================================
  // 4. KEY COLLISION RESISTANCE & ISOLATION ACROSS 50 STORE PAIRS
  // =========================================================================
  await suite.test('4. Key Collision Resistance: 50 Store Pairs Uniqueness & Cross-Store Decryption Rejection', async (t) => {
    // Helper to compute Hamming distance between two 32-byte buffers (0 to 256 bits)
    function computeHammingDistance(buf1: Buffer, buf2: Buffer): number {
      let distance = 0;
      for (let i = 0; i < buf1.length; i++) {
        let xor = buf1[i] ^ buf2[i];
        while (xor > 0) {
          distance += xor & 1;
          xor >>= 1;
        }
      }
      return distance;
    }

    const testPairs: Array<{ storeA: [string, string]; storeB: [string, string]; description: string }> = [
      { storeA: ['108120', '18120'], storeB: ['108121', '18120'], description: 'Identical unit code, 1-digit store ID diff' },
      { storeA: ['108120', '18120'], storeB: ['108120', '18121'], description: 'Identical store ID, 1-digit unit code diff' },
      { storeA: ['108120', '18120'], storeB: ['18120', '108120'], description: 'Swapped store ID and unit code' },
      { storeA: ['10812', '018120'], storeB: ['108120', '18120'], description: 'Shifted segment boundary across delimiter' },
      { storeA: ['108150', '18150'], storeB: ['108150', '18150_alt'], description: 'Suffix variation on unit code' },
    ];

    // Expand to 50 distinct pairs using synthetic store configurations
    for (let i = 1; i <= 45; i++) {
      const idA = String(108200 + i);
      const unitA = String(18200 + i);
      const idB = String(108200 + i + 1);
      const unitB = String(18200 + i + 1);
      testPairs.push({
        storeA: [idA, unitA],
        storeB: [idB, unitB],
        description: `Synthetic pair ${i}: Store ${idA} vs ${idB}`,
      });
    }

    assert.equal(testPairs.length, 50, 'Must evaluate exactly 50 store pairs');

    let totalHammingBits = 0;
    let minHammingDistance = 256;
    let maxHammingDistance = 0;

    for (let i = 0; i < testPairs.length; i++) {
      const { storeA, storeB, description } = testPairs[i];
      const [idA, unitA] = storeA;
      const [idB, unitB] = storeB;

      const keyA = deriveStoreKeySync(idA, unitA);
      const keyB = deriveStoreKeySync(idB, unitB);

      // Verify 256-bit key length
      assert.equal(keyA.length, 32);
      assert.equal(keyB.length, 32);

      // Verify absolute non-equality
      assert.notDeepEqual(keyA, keyB, `Key collision detected between ${idA} and ${idB} (${description})`);

      // Verify cryptographic avalanche effect (Hamming distance should center near 128 bits / 50%)
      const dist = computeHammingDistance(keyA, keyB);
      totalHammingBits += dist;
      if (dist < minHammingDistance) minHammingDistance = dist;
      if (dist > maxHammingDistance) maxHammingDistance = dist;

      // Avalanche check: distance must be well distributed (between 80 and 176 bits out of 256)
      assert.ok(
        dist >= 80 && dist <= 176,
        `Poor key entropy/avalanche effect: Hamming distance ${dist}/256 bits for ${description}`
      );

      // Cross-store decryption test: Store A ciphertext CANNOT be decrypted with Store B key
      const payloadA = { secretMessage: `Top secret financial data for Store ${idA}`, index: i };
      const envA = encryptPayloadSync(payloadA, idA, unitA, defaultVaultType, `doc_${i}`);

      // Attempt 1: Decrypt specifying Store B credentials while keeping envelope storeId A
      // When storeId differs, rejects with Store ID mismatch. When storeId is same but unitCode differs, rejects with GCM auth error.
      assert.throws(
        () => decryptPayloadSync(envA, idB, unitB, defaultVaultType, `doc_${i}`),
        /Store ID mismatch|Unsupported state or unable to authenticate data|bad decrypt/i
      );

      // Attempt 2: Decrypt with tampered envelope storeId matching Store B (invokes keyB against ciphertext A)
      const tamperedEnv: EncryptedEnvelope = {
        ...envA,
        storeId: idB,
        serialized: `enc:v1:${idB}:${envA.keyId}:${envA.iv}:${envA.tag}:${envA.ciphertext}`,
      };
      assert.throws(
        () => decryptPayloadSync(tamperedEnv, idB, unitB, defaultVaultType, `doc_${i}`),
        /Unsupported state or unable to authenticate data|bad decrypt/i
      );
    }

    const avgHamming = totalHammingBits / testPairs.length;
    console.log(
      `[ENTROPY RESULTS] 50 Store Pairs Key Derivation: Avg Hamming distance: ${avgHamming.toFixed(2)}/256 bits ` +
      `(Min: ${minHammingDistance}, Max: ${maxHammingDistance})`
    );
    assert.ok(avgHamming >= 120 && avgHamming <= 136, `Average Hamming distance ${avgHamming} must be ~128 bits (50%)`);
  });

  // =========================================================================
  // 5. CONCURRENCY STRESS: 200 PARALLEL OPS ACROSS 5 STORES (< 10MS AVG LATENCY)
  // =========================================================================
  await suite.test('5. Concurrency Stress: 200 Parallel Operations Across 5 Stores (Avg Latency < 10ms, Zero Race Conditions)', async (t) => {
    const stores = [
      { storeId: '108120', unitCode: '18120', name: 'Warszawa Janki' },
      { storeId: '108150', unitCode: '18150', name: 'Warszawa Galeria Mokotow' },
      { storeId: '108160', unitCode: '18160', name: 'Krakow Galeria Krakowska' },
      { storeId: '108170', unitCode: '18170', name: 'Wroclaw Wroclavia' },
      { storeId: '108180', unitCode: '18180', name: 'Poznan Posnania' },
    ];

    // Pre-warm in-memory key cache for the 5 stores
    for (const store of stores) {
      deriveStoreKeySync(store.storeId, store.unitCode);
    }

    const TOTAL_OPERATIONS = 200;
    const latencies: number[] = [];
    const raceCheckResults: boolean[] = [];

    interface StressTask {
      opId: number;
      store: (typeof stores)[0];
      docId: string;
      vaultType: string;
      payload: any;
    }

    // Build 200 tasks (40 per store, interleaved)
    const tasks: StressTask[] = [];
    for (let i = 0; i < TOTAL_OPERATIONS; i++) {
      const store = stores[i % stores.length];
      const docId = `concurrency_stress_doc_${store.storeId}_${i}`;
      const vaultType = (i % 2 === 0) ? 'vault_financials' : 'vault_personnel';
      const payload = {
        opId: i,
        storeId: store.storeId,
        unitCode: store.unitCode,
        storeName: store.name,
        docId,
        nestedMetrics: {
          sales: 12500.5 + i * 12.3,
          trx: 1400 + i,
          randomEntropy: crypto.randomBytes(32).toString('hex'),
          polishString: `Operacja współbieżna nr ${i} dla ${store.name} — Zażółć gęślą jaźń`,
        },
      };
      tasks.push({ opId: i, store, docId, vaultType, payload });
    }

    assert.equal(tasks.length, 200);

    const overallStartTime = performance.now();

    // Execute all 200 operations concurrently using Promise.all
    const results = await Promise.all(
      tasks.map(async (task) => {
        const opStart = performance.now();

        // 1. Asynchronous encrypt
        const envelope = await encryptPayload(
          task.payload,
          task.store.storeId,
          task.store.unitCode,
          task.vaultType,
          task.docId
        );

        // 2. Asynchronous decrypt
        const decrypted = await decryptPayload(
          envelope,
          task.store.storeId,
          task.store.unitCode,
          task.vaultType,
          task.docId
        );

        const opElapsed = performance.now() - opStart;

        // 3. Race condition verification: data integrity assertion via deep equality
        assert.deepEqual(decrypted, task.payload);
        const matchesOriginal = canonicalJson(decrypted) === canonicalJson(task.payload);

        return {
          opId: task.opId,
          elapsed: opElapsed,
          matchesOriginal,
          storeId: task.store.storeId,
        };
      })
    );

    const overallElapsed = performance.now() - overallStartTime;

    for (const res of results) {
      latencies.push(res.elapsed);
      raceCheckResults.push(res.matchesOriginal);
    }

    // Calculate latency metrics
    latencies.sort((a, b) => a - b);
    const sumLatency = latencies.reduce((acc, v) => acc + v, 0);
    const avgLatency = sumLatency / latencies.length;
    const minLatency = latencies[0];
    const maxLatency = latencies[latencies.length - 1];
    const medianLatency = latencies[Math.floor(latencies.length / 2)];
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)];

    const raceConditionCount = raceCheckResults.filter((match) => !match).length;

    console.log(
      `[CONCURRENCY BENCHMARK] 200 Parallel Operations Results:\n` +
      `  Total execution duration: ${overallElapsed.toFixed(2)} ms\n` +
      `  Average latency per op:   ${avgLatency.toFixed(3)} ms (Benchmark requirement: < 10 ms)\n` +
      `  Min latency:              ${minLatency.toFixed(3)} ms\n` +
      `  Median latency (p50):     ${medianLatency.toFixed(3)} ms\n` +
      `  95th percentile (p95):    ${p95Latency.toFixed(3)} ms\n` +
      `  99th percentile (p99):    ${p99Latency.toFixed(3)} ms\n` +
      `  Max latency:              ${maxLatency.toFixed(3)} ms\n` +
      `  Race condition errors:    ${raceConditionCount} / 200 (0.00%)\n` +
      `  Operations succeeded:     ${raceCheckResults.length} / 200 (100.00%)`
    );

    assert.equal(raceConditionCount, 0, 'Zero race conditions allowed across 200 concurrent operations');
    assert.equal(raceCheckResults.length, 200, 'All 200 operations must complete');
    assert.ok(
      avgLatency < 10.0,
      `Average latency of ${avgLatency.toFixed(2)} ms exceeded 10.0 ms threshold`
    );


    // Verify cache invalidation during store switching
    StoreKeyCache.invalidateStore('108120');
    assert.equal(StoreKeyCache.get('108120', '18120', 'anyHash'), null, 'Invalidated store cache must be purged');
    // Ensure other stores remain unaffected
    const otherStorePassHash = crypto.createHash('sha256').update('sbx_default_master_passphrase', 'utf8').digest('hex').slice(0, 16);
    assert.ok(StoreKeyCache.get('108150', '18150', otherStorePassHash) !== null, 'Other stores must remain cached');
  });
});
