import crypto from 'node:crypto';

export interface EncryptedEnvelope {
  version: 'v1';
  storeId: string;
  keyId: string;
  iv: string; // base64
  tag: string; // base64
  ciphertext: string; // base64
  serialized: string;
}

export interface ParityReport {
  storeId: string;
  localRecordsCount: number;
  cloudRecordsCount: number;
  mismatches: Array<{ table: string; id: string; reason: string }>;
  localCanonicalHash: string;
  cloudCanonicalHash: string;
  isParityVerified: boolean;
  certificate?: {
    signature: string;
    timestamp: string;
    storeId: string;
    hash: string;
  };
}

/**
 * Deterministic Canonical JSON serialization (RFC 8785 subset)
 * Guarantees identical byte representation regardless of object key order.
 */
export function canonicalJson(data: any): string {
  if (data === null || typeof data !== 'object') {
    return JSON.stringify(data);
  }

  if (data instanceof Date) {
    return JSON.stringify(isNaN(data.getTime()) ? null : data.toISOString());
  }

  if (Array.isArray(data)) {
    return (
      '[' +
      data
        .map((v) =>
          v === undefined || typeof v === 'function' || typeof v === 'symbol'
            ? 'null'
            : canonicalJson(v)
        )
        .join(',') +
      ']'
    );
  }

  const sortedKeys = Object.keys(data)
    .filter(
      (key) =>
        data[key] !== undefined &&
        typeof data[key] !== 'function' &&
        typeof data[key] !== 'symbol'
    )
    .sort();

  const pairs = sortedKeys.map((key) => {
    return JSON.stringify(key) + ':' + canonicalJson(data[key]);
  });
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes SHA-256 hash of canonical JSON
 */
export function canonicalSha256(data: any): string {
  const jsonStr = canonicalJson(data);
  return crypto.createHash('sha256').update(jsonStr, 'utf8').digest('hex');
}

/**
 * Derives Store Encryption Key (SEK) using PBKDF2-HMAC-SHA256 (600,000 iterations).
 * Salt = SHA-256("sbx_vault_salt_v1_" + storeId + "_" + unitCode)
 */
export function deriveStoreKey(storeId: string, unitCode: string, passphrase = 'sbx_default_master_passphrase'): Buffer {
  const salt = crypto
    .createHash('sha256')
    .update(`sbx_vault_salt_v1_${storeId}_${unitCode}`, 'utf8')
    .digest();

  return crypto.pbkdf2Sync(passphrase, salt, 600000, 32, 'sha256');
}

/**
 * Encrypts payload with AES-256-GCM and bound AAD context
 */
export function encryptPayload(
  payload: any,
  storeId: string,
  unitCode: string,
  vaultType: string,
  docId: string,
  keyId = 'k1'
): EncryptedEnvelope {
  const sek = deriveStoreKey(storeId, unitCode);
  const iv = crypto.randomBytes(12); // 96-bit IV
  const cipher = crypto.createCipheriv('aes-256-gcm', sek, iv);

  const aad = Buffer.from(`${storeId}:${vaultType}:${docId}`, 'utf8');
  cipher.setAAD(aad);

  const plaintext = Buffer.from(canonicalJson(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag(); // 128-bit tag

  const b64Iv = iv.toString('base64');
  const b64Tag = tag.toString('base64');
  const b64Cipher = ciphertext.toString('base64');

  const serialized = `enc:v1:${storeId}:${keyId}:${b64Iv}:${b64Tag}:${b64Cipher}`;

  return {
    version: 'v1',
    storeId,
    keyId,
    iv: b64Iv,
    tag: b64Tag,
    ciphertext: b64Cipher,
    serialized,
  };
}

/**
 * Decrypts payload verifying AAD and 128-bit authentication tag
 */
export function decryptPayload(
  envelopeOrSerialized: EncryptedEnvelope | string,
  storeId: string,
  unitCode: string,
  vaultType: string,
  docId: string
): any {
  let envelope: EncryptedEnvelope;

  if (typeof envelopeOrSerialized === 'string') {
    const parts = envelopeOrSerialized.split(':');
    if (parts.length !== 7 || parts[0] !== 'enc' || parts[1] !== 'v1') {
      throw new Error(`Malformed envelope format: ${envelopeOrSerialized}`);
    }
    envelope = {
      version: 'v1',
      storeId: parts[2],
      keyId: parts[3],
      iv: parts[4],
      tag: parts[5],
      ciphertext: parts[6],
      serialized: envelopeOrSerialized,
    };
  } else {
    envelope = envelopeOrSerialized;
  }

  if (envelope.storeId !== storeId) {
    throw new Error(`Store ID mismatch in envelope: expected ${storeId}, got ${envelope.storeId}`);
  }

  const sek = deriveStoreKey(storeId, unitCode);
  const iv = Buffer.from(envelope.iv, 'base64');
  const tag = Buffer.from(envelope.tag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  if (iv.length !== 12) {
    throw new Error(`Invalid initialization vector length: expected 12 bytes (96-bit), got ${iv.length} bytes`);
  }
  if (tag.length !== 16) {
    throw new Error(`Invalid authentication tag length: expected 16 bytes (128-bit), got ${tag.length} bytes`);
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', sek, iv);
  const aad = Buffer.from(`${storeId}:${vaultType}:${docId}`, 'utf8');
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

/**
 * Verifies bi-directional cryptographic parity between local records and decrypted cloud records
 */
export function verifyParity(
  storeId: string,
  localRecords: Record<string, any[]>,
  cloudRecords: Record<string, any[]>
): ParityReport {
  let localCount = 0;
  let cloudCount = 0;
  const mismatches: Array<{ table: string; id: string; reason: string }> = [];

  for (const [table, rows] of Object.entries(localRecords)) {
    localCount += rows.length;
    const cloudRows = cloudRecords[table] || [];
    if (rows.length !== cloudRows.length) {
      mismatches.push({
        table,
        id: 'count',
        reason: `Local row count (${rows.length}) does not match cloud row count (${cloudRows.length})`,
      });
    }
  }

  for (const [table, rows] of Object.entries(cloudRecords)) {
    cloudCount += rows.length;
  }

  const localHash = canonicalSha256(localRecords);
  const cloudHash = canonicalSha256(cloudRecords);

  const isParityVerified = localHash === cloudHash && mismatches.length === 0;

  const report: ParityReport = {
    storeId,
    localRecordsCount: localCount,
    cloudRecordsCount: cloudCount,
    mismatches,
    localCanonicalHash: localHash,
    cloudCanonicalHash: cloudHash,
    isParityVerified,
  };

  if (isParityVerified) {
    const signature = crypto
      .createHmac('sha256', 'sbx_parity_cert_key')
      .update(`${storeId}:${localHash}:${new Date().toISOString().slice(0, 10)}`)
      .digest('hex');

    report.certificate = {
      signature,
      timestamp: new Date().toISOString(),
      storeId,
      hash: localHash,
    };
  }

  return report;
}
