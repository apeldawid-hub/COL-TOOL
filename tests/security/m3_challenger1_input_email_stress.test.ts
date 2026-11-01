/**
 * Starbucks Operations Suite — Milestone 3 Empirical Challenger Test Suite
 * Challenger: M3 Gate Challenger 1
 * File: tests/security/m3_challenger1_input_email_stress.test.ts
 *
 * Scope:
 * 1. Empirical Stress-Testing of parseActivationInput:
 *    - Valid formats: canonical raw key, JSON envelope (key, activationKey, fullKey),
 *      deep link URLs (starbucks-col://, sbx://, https://), multiline email instructions.
 *    - Malformed/tampered formats: truncated keys, invalid checksums, SQL injection,
 *      corrupted JSON, null/undefined/non-string, catastrophic backtracking (ReDoS),
 *      homoglyphs and unicode.
 * 2. Empirical Stress-Testing of validateCorporateEmail:
 *    - Permitted corporate domains (@amrest.eu, @starbucks.com).
 *    - Exact classification & Polish error messaging for public consumer webmail.
 *    - Subdomain, suffix, and typosquatting attacks.
 *    - Multi-@ injection and parser confusion attacks.
 *    - Embedded whitespace (spaces, tabs, newlines) and RFC 5322 boundaries.
 * 3. Cross-verification with LicensingService and AuthService.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseActivationInput } from '../../src/components/ActivationModal';
import { LicensingService } from '../../src/services/security/licensingService';
import { 
  validateCorporateEmail, 
  AuthService, 
  KNOWN_PUBLIC_DOMAINS 
} from '../../src/services/auth/authService';

test('M3-CHALLENGER-1: Activation Input Parser & Corporate Email Stress Suite', async (t) => {
  const storeId = '108120';
  const testSecret = 'sbx_challenger1_secret_2026';
  const validCanonicalKey = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT', testSecret);
  const validMasterKey = LicensingService.generateActivationKey('HQ_MASTER', 'FLEET_MASTER', testSecret);

  // ==========================================================================
  // SECTION 1: Stress-Testing parseActivationInput
  // ==========================================================================

  await t.test('1.1 Valid formats: Raw canonical keys with case and whitespace variations', () => {
    // Exact canonical key
    const res1 = parseActivationInput(validCanonicalKey);
    assert.strictEqual(res1.isValidFormat, true);
    assert.strictEqual(res1.cleanKey, validCanonicalKey.toUpperCase());
    assert.strictEqual(res1.storeId, storeId);
    assert.strictEqual(res1.tier, 'STORE_CLIENT');

    // Lowercase canonical key
    const res2 = parseActivationInput(validCanonicalKey.toLowerCase());
    assert.strictEqual(res2.isValidFormat, true);
    assert.strictEqual(res2.cleanKey, validCanonicalKey.toUpperCase());

    // Leading and trailing whitespace
    const res3 = parseActivationInput(`   ${validCanonicalKey}  \n\t `);
    assert.strictEqual(res3.isValidFormat, true);
    assert.strictEqual(res3.cleanKey, validCanonicalKey.toUpperCase());

    // Master tier key
    const res4 = parseActivationInput(validMasterKey);
    assert.strictEqual(res4.isValidFormat, true);
    assert.strictEqual(res4.cleanKey, validMasterKey.toUpperCase());
    assert.strictEqual(res4.storeId, 'HQ_MASTER');
    assert.strictEqual(res4.tier, 'FLEET_MASTER');
  });

  await t.test('1.2 Valid formats: JSON envelopes with various property keys', () => {
    // {"key": "..."}
    const envKey = JSON.stringify({ key: validCanonicalKey });
    const resKey = parseActivationInput(envKey);
    assert.strictEqual(resKey.isValidFormat, true);
    assert.strictEqual(resKey.formatSource, 'JSON_ENVELOPE');
    assert.strictEqual(resKey.cleanKey, validCanonicalKey.toUpperCase());

    // {"activationKey": "..."} (Explicitly requested by prompt)
    const envAct = JSON.stringify({ 
      activationKey: validCanonicalKey,
      storeName: '108120 SBX Warszawa Janki',
      timestamp: new Date().toISOString()
    });
    const resAct = parseActivationInput(envAct);
    assert.strictEqual(resAct.isValidFormat, true);
    assert.strictEqual(resAct.formatSource, 'JSON_ENVELOPE');
    assert.strictEqual(resAct.cleanKey, validCanonicalKey.toUpperCase());
    assert.strictEqual(resAct.storeId, storeId);

    // {"fullKey": "..."}
    const envFull = JSON.stringify({ fullKey: validCanonicalKey });
    const resFull = parseActivationInput(envFull);
    assert.strictEqual(resFull.isValidFormat, true);
    assert.strictEqual(resFull.formatSource, 'JSON_ENVELOPE');
    assert.strictEqual(resFull.cleanKey, validCanonicalKey.toUpperCase());

    // Pretty printed multiline JSON
    const prettyJson = `{\n  "activationKey": "${validCanonicalKey}",\n  "tier": "STORE_CLIENT"\n}`;
    const resPretty = parseActivationInput(prettyJson);
    assert.strictEqual(resPretty.isValidFormat, true);
    assert.strictEqual(resPretty.formatSource, 'JSON_ENVELOPE');
  });

  await t.test('1.3 Valid formats: Deep links and QR code URLs', () => {
    // starbucks-col://activate?key=... (Explicitly requested by prompt)
    const url1 = `starbucks-col://activate?key=${validCanonicalKey}`;
    const res1 = parseActivationInput(url1);
    assert.strictEqual(res1.isValidFormat, true);
    assert.strictEqual(res1.formatSource, 'QR_URL');
    assert.strictEqual(res1.cleanKey, validCanonicalKey.toUpperCase());

    // starbucks-col://activate?key=... with other query parameters
    const url2 = `starbucks-col://activate?source=fleet_hq&key=${validCanonicalKey}&storeId=108120#token`;
    const res2 = parseActivationInput(url2);
    assert.strictEqual(res2.isValidFormat, true);
    assert.strictEqual(res2.formatSource, 'QR_URL');
    assert.strictEqual(res2.cleanKey, validCanonicalKey.toUpperCase());

    // sbx://activate?key=...
    const url3 = `sbx://activate?key=${validCanonicalKey}`;
    const res3 = parseActivationInput(url3);
    assert.strictEqual(res3.isValidFormat, true);
    assert.strictEqual(res3.formatSource, 'QR_URL');

    // https URL: https://portal.starbucks.com/activate?key=...
    const url4 = `https://portal.starbucks.com/activate?key=${validCanonicalKey}`;
    const res4 = parseActivationInput(url4);
    assert.strictEqual(res4.isValidFormat, true);
    assert.strictEqual(res4.formatSource, 'QR_URL');

    // Deep link path without query parameter: starbucks-col://activate/SBX-...
    const url5 = `starbucks-col://activate/${validCanonicalKey}`;
    const res5 = parseActivationInput(url5);
    assert.strictEqual(res5.isValidFormat, true);
    assert.strictEqual(res5.formatSource, 'QR_URL');
    assert.strictEqual(res5.cleanKey, validCanonicalKey.toUpperCase());
  });

  await t.test('1.4 Valid formats: Multiline email instructions and formatted text', () => {
    // Polish corporate onboarding email
    const email1 = `
      Cześć Dawid,
      Przesyłam klucz licencyjny dla nowej kasy w CH Janki:
      Klucz: ${validCanonicalKey}
      Wklej go w oknie aktywacji stacji i kliknij 'Aktywuj Stację'.
      
      Pozdrawiamy,
      Dział IT AmRest
    `;
    const res1 = parseActivationInput(email1);
    assert.strictEqual(res1.isValidFormat, true);
    assert.strictEqual(res1.formatSource, 'INSTRUCTION_TEXT');
    assert.strictEqual(res1.cleanKey, validCanonicalKey.toUpperCase());
    assert.strictEqual(res1.storeId, storeId);

    // Key in brackets or quotes
    const email2 = `Your station activation code is [${validCanonicalKey}]. Do not share this.`;
    const res2 = parseActivationInput(email2);
    assert.strictEqual(res2.isValidFormat, true);
    assert.strictEqual(res2.cleanKey, validCanonicalKey.toUpperCase());

    // Key with trailing colon or comma
    const text3 = `Licencja: ${validCanonicalKey}, ważna dla jednostki 18120.`;
    const res3 = parseActivationInput(text3);
    assert.strictEqual(res3.isValidFormat, true);
    assert.strictEqual(res3.cleanKey, validCanonicalKey.toUpperCase());
  });

  await t.test('1.5 Malformed & Tampered inputs: Truncated keys at every boundary', () => {
    const parts = validCanonicalKey.split('-');
    // parts[0] = 'SBX', parts[1] = storeId, parts[2] = randomHex (16), parts[3] = checksum (10)

    const truncatedSamples = [
      'SBX',
      'SBX-',
      `SBX-${parts[1]}`,
      `SBX-${parts[1]}-`,
      `SBX-${parts[1]}-${parts[2].substring(0, 5)}`,
      `SBX-${parts[1]}-${parts[2]}`,
      `SBX-${parts[1]}-${parts[2]}-`,
      `SBX-${parts[1]}-${parts[2]}-${parts[3].substring(0, 5)}`, // Truncated checksum (5 hex)
      `SBX-${parts[1]}-${parts[2]}-${parts[3].substring(0, 9)}`, // Truncated checksum (9 hex)
    ];

    for (const sample of truncatedSamples) {
      const res = parseActivationInput(sample);
      assert.strictEqual(res.isValidFormat, false, `Sample "${sample}" must fail format check`);
    }
  });

  await t.test('1.6 Malformed & Tampered inputs: Invalid checksum formatting & non-hex characters', () => {
    const parts = validCanonicalKey.split('-');
    const store = parts[1];
    const rand = parts[2];

    // Checksums with invalid characters or truncated lengths strictly return isValidFormat: false
    const invalidChecksumSamples = [
      `SBX-${store}-${rand}-ZZZZZZZZZZ`, // Non-hex chars (Z)
      `SBX-${store}-${rand}-123456789G`, // Non-hex char (G)
      `SBX-${store}-${rand}-123456789`,  // 9 hex chars (too short)
      `SBX-${store}-${rand}-1234 56789`, // Embedded space in checksum
      `SBX-${store}-${rand}-!@#$%^&*()`, // Symbols in checksum
      `SBX-${store}-${rand}-`,           // Empty checksum
    ];

    for (const sample of invalidChecksumSamples) {
      const res = parseActivationInput(sample);
      assert.strictEqual(res.isValidFormat, false, `Sample "${sample}" must fail format check`);
    }

    // Negative lookahead (?![A-F0-9]) rejects overlong checksums (e.g. 11 digits: 12345678901)
    // rather than matching the first 10 hex characters
    const overlongChecksum = `SBX-${store}-${rand}-12345678901`;
    const overlongRes = parseActivationInput(overlongChecksum);
    assert.strictEqual(overlongRes.isValidFormat, false, 'Overlong checksum (>10 hex chars) must fail format check');
  });

  await t.test('1.7 Malformed & Tampered inputs: SQL injection, XSS, and exploit strings', () => {
    const attackPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE stores; --",
      `SBX-108120'-DROP TABLE stores;--`,
      "1; DROP TABLE store_108120;",
      "<script>alert('XSS')</script>",
      `{"key": "<script>alert(1)</script>"}`,
      "<img src=x onerror=alert(1)>",
      "../../../../etc/passwd",
      "\\x00\\x00\\x00\\x00",
      "UNION SELECT * FROM sqlite_master WHERE type='table';",
    ];

    for (const payload of attackPayloads) {
      assert.doesNotThrow(() => {
        const res = parseActivationInput(payload);
        assert.strictEqual(res.isValidFormat, false, `Attack payload "${payload}" must return isValidFormat: false`);
      });
    }
  });

  await t.test('1.8 Malformed & Tampered inputs: Null, undefined, empty, and non-string types', () => {
    const emptyOrInvalidTypes: any[] = [
      '',
      '   ',
      '\t\n\r',
      null,
      undefined,
      12345,
      true,
      false,
      {},
      [],
      { key: 12345 },
      () => {},
      Symbol('test')
    ];

    for (const val of emptyOrInvalidTypes) {
      assert.doesNotThrow(() => {
        const res = parseActivationInput(val);
        assert.strictEqual(res.isValidFormat, false);
        assert.strictEqual(res.cleanKey, null);
      });
    }
  });

  await t.test('1.9 Malformed & Tampered inputs: Corrupted JSON with invalid or missing keys', () => {
    const corruptedJsonWithInvalidKeys = [
      '{"key": ',
      '{key: "SBX-108120-INVALID"}',
      '{key: "SBX-108120-0123456789ABCDEF-0123456789"}',
      '{"activationKey": null}',
      '{"activationKey": 99999}',
      '{"activationKey": []}',
      '{"otherField": "NOT-A-KEY"}',
      '{"key": "NOT-A-KEY"}',
      '{"activationKey": "SBX-SHORT-KEY"}',
      '{' + '"a":'.repeat(500) + '1' + '}'.repeat(500),
    ];

    for (const jsonStr of corruptedJsonWithInvalidKeys) {
      assert.doesNotThrow(() => {
        const res = parseActivationInput(jsonStr);
        assert.strictEqual(res.isValidFormat, false, `Corrupted JSON with invalid key must return isValidFormat: false: ${jsonStr}`);
      });
    }
  });

  await t.test('1.10 Performance & ReDoS resilience: Catastrophic backtracking defense', () => {
    const start = Date.now();
    
    // Test large inputs
    const largeNoise = 'A'.repeat(50000);
    const res1 = parseActivationInput(largeNoise);
    assert.strictEqual(res1.isValidFormat, false);

    // Repeated prefixes
    const prefixBomb = 'SBX-'.repeat(5000);
    const res2 = parseActivationInput(prefixBomb);
    assert.strictEqual(res2.isValidFormat, false);

    // Deep link with huge noise
    const urlBomb = 'starbucks-col://activate?key=' + 'B'.repeat(50000);
    const res3 = parseActivationInput(urlBomb);
    assert.strictEqual(res3.isValidFormat, false);

    const elapsed = Date.now() - start;
    assert.strictEqual(elapsed < 1000, true, `Regex parsing must complete within 1000ms (took ${elapsed}ms)`);
  });

  // ==========================================================================
  // SECTION 2: Stress-Testing validateCorporateEmail
  // ==========================================================================

  await t.test('2.1 Permitted corporate emails: @amrest.eu and @starbucks.com', () => {
    const validEmails = [
      'dawid.apel@amrest.eu',
      'sm.18120@amrest.eu',
      'asm.108120@amrest.eu',
      'kawiarnia.janki@amrest.eu',
      'jan.kowalski+sbx@amrest.eu',
      'john.doe@starbucks.com',
      'district.manager@starbucks.com',
      'support-ops@starbucks.com',
      'a@amrest.eu', // Single-letter local part
      '12345@amrest.eu', // Numeric local part
    ];

    for (const email of validEmails) {
      const res = validateCorporateEmail(email);
      assert.strictEqual(res.isValid, true, `Email ${email} should be valid`);
      assert.strictEqual(res.category, 'VALID_CORPORATE');
      assert.strictEqual(typeof res.normalizedEmail, 'string');
      assert.strictEqual(AuthService.isCorporateEmail(email), true);
    }
  });

  await t.test('2.2 Case normalization and boundary whitespace trimming in valid emails', () => {
    const tests = [
      { input: '  Dawid.Apel@AMREST.EU  ', expected: 'dawid.apel@amrest.eu', domain: 'amrest.eu' },
      { input: '\tJohn.DOE@STARBUCKS.COM\n', expected: 'john.doe@starbucks.com', domain: 'starbucks.com' },
      { input: 'TEST.USER@amrest.eu', expected: 'test.user@amrest.eu', domain: 'amrest.eu' },
    ];

    for (const tCase of tests) {
      const res = validateCorporateEmail(tCase.input);
      assert.strictEqual(res.isValid, true);
      assert.strictEqual(res.normalizedEmail, tCase.expected);
      assert.strictEqual(res.domain, tCase.domain);
      assert.strictEqual(res.category, 'VALID_CORPORATE');
    }
  });

  await t.test('2.3 Rejection of public consumer webmail with exact Polish error message', () => {
    for (const pubDomain of KNOWN_PUBLIC_DOMAINS) {
      const email = `test.user@${pubDomain}`;
      const res = validateCorporateEmail(email);

      assert.strictEqual(res.isValid, false, `Public email ${email} must be rejected`);
      assert.strictEqual(res.category, 'PUBLIC_DOMAIN', `Category must be PUBLIC_DOMAIN for ${email}`);
      assert.strictEqual(res.domain, pubDomain);
      assert.match(
        res.error || '',
        /Dostęp zastrzeżony\. Domena publiczna \(@.*\) nie jest dozwolona\./i,
        `Must return standard Polish refusal for ${pubDomain}`
      );
      assert.strictEqual(AuthService.isCorporateEmail(email), false);
    }
  });

  await t.test('2.4 Subdomain, suffix, and typosquatting attacks strictly rejected as UNKNOWN_DOMAIN', () => {
    const maliciousDomains = [
      // Subdomain spoofing
      'user@sub.amrest.eu',
      'user@mail.amrest.eu',
      'user@corp.starbucks.com',
      'user@internal.starbucks.com',
      // Suffix appending / domain trailing attacks
      'user@amrest.eu.evil.com',
      'user@starbucks.com.attacker.org',
      'user@starbucks.com.pl',
      'user@amrest.eu.pl',
      // Typosquatting / Look-alikes
      'user@amrest-eu.com',
      'user@amrest.com',
      'user@starbuckss.com',
      'user@starbucks.eu',
      'user@starbucks.org',
      'user@amrestgroup.com',
    ];

    for (const email of maliciousDomains) {
      const res = validateCorporateEmail(email);
      assert.strictEqual(res.isValid, false, `Email ${email} must be rejected`);
      assert.strictEqual(res.category, 'UNKNOWN_DOMAIN', `Email ${email} must be classified as UNKNOWN_DOMAIN`);
      assert.match(res.error || '', /Nieautoryzowana domena/i);
      assert.strictEqual(AuthService.isCorporateEmail(email), false);
    }
  });

  await t.test('2.5 Multi-@ injection and parser confusion attacks strictly rejected as INVALID_SYNTAX', () => {
    const multiAtEmails = [
      'user@evil.com@amrest.eu',
      'admin@amrest.eu@attacker.com',
      'user@starbucks.com@amrest.eu',
      'a@b@c@amrest.eu',
      'user@@amrest.eu',
      '@@amrest.eu',
      'user@amrest.eu@',
    ];

    for (const email of multiAtEmails) {
      const res = validateCorporateEmail(email);
      assert.strictEqual(res.isValid, false, `Multi-@ email ${email} must be rejected`);
      assert.strictEqual(res.category, 'INVALID_SYNTAX', `Category must be INVALID_SYNTAX for ${email}`);
      assert.match(res.error || '', /dokładnie jeden znak "@"/i);
      assert.strictEqual(AuthService.isCorporateEmail(email), false);
    }
  });

  await t.test('2.6 Embedded whitespace (spaces, tabs, newlines) rejected as INVALID_SYNTAX', () => {
    const whitespaceEmails = [
      'user @amrest.eu',
      'user@ amrest.eu',
      'us er@amrest.eu',
      'user@am rest.eu',
      'user\t@amrest.eu',
      'user@\tamrest.eu',
      'user\n@amrest.eu',
      'user@\namrest.eu',
      'user\r@amrest.eu',
    ];

    for (const email of whitespaceEmails) {
      const res = validateCorporateEmail(email);
      assert.strictEqual(res.isValid, false, `Email with whitespace "${email}" must be rejected`);
      assert.strictEqual(res.category, 'INVALID_SYNTAX');
      assert.match(res.error || '', /spacji/i);
    }
  });

  await t.test('2.7 Missing local part, missing domain, missing @, or empty string', () => {
    const invalidSyntaxList = [
      '@amrest.eu',           // Empty local part
      '@starbucks.com',       // Empty local part
      'amrest.eu',            // Missing @
      'starbucks.com',        // Missing @
      'user',                 // Plain string without @
      'user@',                // Missing domain
      '@',                    // Only @
      '',                     // Empty string
      '    ',                 // Whitespace only
    ];

    for (const item of invalidSyntaxList) {
      const res = validateCorporateEmail(item);
      assert.strictEqual(res.isValid, false, `Item "${item}" must be invalid syntax`);
      assert.strictEqual(res.category, 'INVALID_SYNTAX');
      assert.strictEqual(AuthService.isCorporateEmail(item), false);
    }
  });

  await t.test('2.8 RFC 5322 local-part syntax and dot-atom boundaries', () => {
    // Consecutive dots in local part
    const res1 = validateCorporateEmail('user..name@amrest.eu');
    assert.strictEqual(res1.isValid, false);
    assert.strictEqual(res1.category, 'INVALID_SYNTAX');

    // Leading dot in local part
    const res2 = validateCorporateEmail('.user@amrest.eu');
    assert.strictEqual(res2.isValid, false);
    assert.strictEqual(res2.category, 'INVALID_SYNTAX');

    // Trailing dot in local part
    const res3 = validateCorporateEmail('user.@amrest.eu');
    assert.strictEqual(res3.isValid, false);
    assert.strictEqual(res3.category, 'INVALID_SYNTAX');

    // Invalid characters (quotes, parens, brackets, semicolons)
    const invalidChars = [
      'user"name"@amrest.eu',
      'user(comment)@amrest.eu',
      'user[123]@amrest.eu',
      'user;drop@amrest.eu',
      'user<tag>@amrest.eu',
    ];
    for (const email of invalidChars) {
      const res = validateCorporateEmail(email);
      assert.strictEqual(res.isValid, false, `Email ${email} with illegal chars must fail`);
      assert.strictEqual(res.category, 'INVALID_SYNTAX');
    }

    // 64 character local-part limit (RFC 5322)
    const exact64Local = 'a'.repeat(64) + '@amrest.eu';
    const res64 = validateCorporateEmail(exact64Local);
    assert.strictEqual(res64.isValid, true, '64-character local-part must be accepted');

    const over64Local = 'a'.repeat(65) + '@amrest.eu';
    const res65 = validateCorporateEmail(over64Local);
    assert.strictEqual(res65.isValid, false, '65-character local-part must be rejected');
    assert.strictEqual(res65.category, 'INVALID_SYNTAX');

    // 254 character overall email limit
    const longDomain = 'amrest.eu'; // 9 chars
    const over254 = 'a'.repeat(64) + '@' + 'b'.repeat(190);
    const res255 = validateCorporateEmail(over254);
    assert.strictEqual(res255.isValid, false);
    assert.strictEqual(res255.category, 'INVALID_SYNTAX');
  });

  await t.test('2.9 Robustness: Null, undefined, and non-string types fail safely', () => {
    const invalidTypes: any[] = [
      null,
      undefined,
      12345,
      true,
      {},
      [],
      () => {},
      Symbol('email')
    ];

    for (const val of invalidTypes) {
      assert.doesNotThrow(() => {
        const res = validateCorporateEmail(val);
        assert.strictEqual(res.isValid, false);
        assert.strictEqual(res.category, 'INVALID_SYNTAX');
      });
    }
  });

  // ==========================================================================
  // SECTION 3: Cryptographic Integrity & End-to-End Key Verification
  // ==========================================================================

  await t.test('3.1 Key signature tampering: valid format but forged checksum fails verification', () => {
    // Generate valid key
    const legitimateKey = LicensingService.generateActivationKey(storeId, 'STORE_CLIENT', testSecret);
    const parts = legitimateKey.split('-');
    
    // Create tampered checksum with valid format (10 hex chars) but forged content
    const forgedChecksum = '0123456789';
    const forgedKey = `SBX-${parts[1]}-${parts[2]}-${forgedChecksum}`;

    // 1. parseActivationInput correctly extracts format
    const parsed = parseActivationInput(forgedKey);
    assert.strictEqual(parsed.isValidFormat, true, 'Format structure is valid syntax');

    // 2. LicensingService cryptographic verification strictly rejects forged signature
    const svc = new LicensingService(undefined, undefined, testSecret);
    const isCryptoValid = svc.verifyKeySignature(forgedKey, storeId);
    assert.strictEqual(isCryptoValid, false, 'Forged checksum must fail cryptographic signature verification');

    // 3. Legitimate key passes both
    const isLegitCryptoValid = svc.verifyKeySignature(legitimateKey, storeId);
    assert.strictEqual(isLegitCryptoValid, true, 'Legitimate key must pass signature verification');
  });
});
