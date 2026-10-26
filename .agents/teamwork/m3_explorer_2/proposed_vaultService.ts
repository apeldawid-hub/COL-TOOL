// src/services/security/vaultService.ts
/**
 * Starbucks Operations Suite — Sensitive Payload Classification & Vault Packaging Service (Feature F13)
 * 
 * Provides production client-side data classification, cryptographic vault packaging,
 * and unpackaging pipelines for multi-store cloud synchronization.
 * 
 * Security Standard:
 * - Tier 1: AES-256-GCM Encrypted (Financial, P&L, Targets, Actuals, Revenue, COL)
 * - Tier 2: AES-256-GCM Encrypted (HR, PII, Salaries, Hourly Rates, GDPR Art. 9 Medical L4)
 * - Tier 3: Plaintext Metadata Header (Store routing, timestamps, audit checksums, public norms)
 * 
 * AAD Context Binding: `${storeId}:${vaultType}:${docId}`
 */

import crypto from 'crypto';

// =========================================================================================
// 1. Data Classification Tiers & Types
// =========================================================================================

export type DataClassificationTier = 'TIER_1_FINANCIAL' | 'TIER_2_HR_GDPR' | 'TIER_3_PUBLIC_ROUTING';

export type VaultType =
  | 'vault_financials'
  | 'vault_personnel'
  | 'vault_schedules'
  | 'vault_health_gdpr'
  | 'telemetry';

export interface FieldClassificationRule {
  tier: DataClassificationTier;
  requiresEncryption: boolean;
  targetVault: VaultType;
  description: string;
}

export interface EncryptedEnvelope {
  version: 'v1';
  storeId: string;
  keyId: string;
  iv: string;         // base64 (96-bit / 12 bytes)
  tag: string;        // base64 (128-bit / 16 bytes)
  ciphertext: string; // base64
  serialized?: string;
  aadContext?: string;
}

// =========================================================================================
// 2. Firestore Document Schemas
// =========================================================================================

/**
 * Universal Firestore Vault Document Header (Tier 3 Plaintext Metadata)
 */
export interface VaultDocumentHeader {
  storeId: string;
  unitCode: string;
  vaultType: VaultType;
  docId: string;
  period?: string;
  staffGroup?: string;
  weekKey?: string;
  updatedAt: string;
  updatedBy: string;
  clientVersion: string;
  recordCount: number;
  checksum: string; // SHA-256 hex digest of canonical plaintext payload
  schemaVersion: 'v1';
}

/**
 * Production Firestore Encrypted Vault Document Envelope
 */
export interface EncryptedVaultDocument extends VaultDocumentHeader {
  encryptedPayload: string | EncryptedEnvelope; // enc:v1:... or structured envelope
}

/**
 * Plaintext Telemetry & Status Document (/stores/{storeId}/telemetry/status)
 */
export interface PlaintextTelemetryDocument {
  storeId: string;
  unitCode: string;
  storeName: string;
  clientVersion: string;
  platform: string;
  lastSyncAt: string;
  lastHeartbeatAt: string;
  vaultStats: {
    financialsRecordsCount: number;
    financialsLastChecksum: string;
    personnelRecordsCount: number;
    personnelLastChecksum: string;
    schedulesRecordsCount: number;
    schedulesLastChecksum: string;
    healthGdprRecordsCount: number;
    healthGdprLastChecksum: string;
  };
  syncState: 'idle' | 'syncing' | 'error' | 'offline';
  localDatabaseHealth: {
    integrity: 'ok' | 'corrupted' | 'error';
    totalTables: number;
    totalLocalRecords: number;
    dbSizeBytes: number;
  };
  updatedAt: string;
  updatedBy: string;
}

// =========================================================================================
// 3. Vault Payloads (Decrypted In-Memory Domain Models)
// =========================================================================================

/**
 * 1. Financial Vault Payload (`stores/{storeId}/vault_financials/{period}`)
 */
export interface FinancialVaultPayload {
  period: string; // e.g. 'month_2026_03' or 'annual_2026'
  aopPlans?: Array<{
    key: string;
    year: number;
    month: string;
    month_code: string;
    plan_trx: number;
    target_tplh: number;
    labor_budget: number;
    avg_weekly_hours: number;
    plan_sales: number | null;
    actual_sales: number | null;
    actual_trx: number | null;
    actual_tplh: number | null;
    plan_agc: number | null;
    actual_agc: number | null;
    plan_col_pln: number | null;
    plan_col_percent: number | null;
    plan_cos_pln: number | null;
    plan_cos_percent: number | null;
    plan_ops_profit: number | null;
  }>;
  dailyKpiLogs?: Array<{
    date: string;
    sales_net: number;
    trx: number;
    agc: number;
    hours: number;
    tplh: number;
    delivery_trx: number;
  }>;
  colSummary?: Record<string, any>; // ColCalculatedSummary (P&L totals, ZUS, What-If savings)
  weeklyActuals?: Array<{
    week_key: string;
    actual_trx: number | null;
    manual_hours_override: number | null;
    scheduled_hours: number | null;
  }>;
}

/**
 * 2. Personnel Vault Payload (`stores/{storeId}/vault_personnel/{staffGroup}`)
 */
export interface PersonnelVaultPayload {
  staffGroup: string; // e.g. 'active_roster', 'managers', 'crew'
  managers?: Array<{
    id: number;
    name: string;
    role: string;
    contract_type: string;
    contract_hours_ratio: number;
    hourly_rate: number;
    monthly_salary: number;
    sort_order: number;
    is_active: number;
  }>;
  monthlyRosters?: Array<{
    year: number;
    month: number;
    employee_id: number;
    name: string;
    role: string;
    contract_type: string;
    contract_hours_ratio: number;
    hourly_rate: number;
    monthly_salary: number;
  }>;
  crewUop?: Array<{
    id: string;
    name: string;
    position: string;
    contractRatio: number;
    hourlyRate: number;
    planWorkHours: number;
    isDisability: boolean;
  }>;
  crewUz?: Array<{
    id: string;
    name: string;
    position: string;
    hourlyRate: number;
    planWorkHours: number;
    bonus: number;
  }>;
  trainingPartners?: Array<{
    id: number;
    name: string;
    hire_date: string;
    current_program: string;
    assigned_trainer_name?: string;
    sanepid_valid_until?: string;
    bhp_completed_date?: string;
    notes?: string;
  }>;
  trainingSkillChecks?: Array<{
    id: number;
    partner_id: number;
    check_type: string;
    exam_date: string;
    examiner_name: string;
    is_passed: number;
    score_pct: number;
    criteria_results: string;
    notes?: string;
  }>;
}

/**
 * 3. Schedule Vault Payload (`stores/{storeId}/vault_schedules/{weekKey}`)
 */
export interface ScheduleVaultPayload {
  weekKey: string; // e.g. 'week_2026_W12'
  shifts: Array<{
    id?: number;
    year: number;
    month: number;
    day: number;
    date: string;
    employee_id: number;
    employee_name?: string;
    shift_code: string;
    hours: number;
    notes?: string;
    disposition?: string;
    custom_start_time?: string;
    custom_end_time?: string;
  }>;
  versions?: Array<{
    version_num: number;
    version_type: string;
    title: string;
    description?: string;
    shifts_json: string;
    events_json?: string;
    is_published: number;
  }>;
  trainingShifts?: Array<{
    partner_id: number;
    shift_code: string;
    title: string;
    scheduled_date: string;
    start_time: string;
    end_time: string;
    barista_hours_t: number;
    trainer_hours_t: number;
    sm_hours_t: number;
    notes?: string;
  }>;
  fichajesLogs?: Array<{
    date: string;
    employee: string;
    category?: string;
    contract_type?: string;
    computable_time: number;
  }>;
}

/**
 * 4. Health & GDPR Art. 9 Vault Payload (`stores/{storeId}/vault_health_gdpr/{period}`)
 */
export interface HealthGdprVaultPayload {
  period: string; // e.g. 'period_2026_Q1' or 'month_2026_03'
  l4MedicalAbsences: Array<{
    employeeId: number;
    employeeName: string;
    date: string;
    shiftCode: 'L4';
    hours: number;
    notes?: string; // Doctor's recommendations, convalescence details
  }>;
  torHealthSummary?: Array<{
    employeeId: number;
    employeeName: string;
    year: number;
    quarter: number;
    l4DaysTotal: number;
    l4HoursTotal: number;
  }>;
  disabilityAccommodations?: Array<{
    employeeId: number | string;
    name: string;
    reducedNorm7h: boolean;
    accommodationsNotes?: string;
  }>;
  sanitaryClearances?: Array<{
    partnerId: number;
    partnerName: string;
    sanepidValidUntil: string;
    bhpCompletedDate: string;
  }>;
  rcpAbsenceConflicts?: Array<{
    employeeId: number;
    employeeName: string;
    day: number;
    date: string;
    shiftCode: 'L4' | 'H';
    rcpHours: number;
  }>;
}

// =========================================================================================
// 4. Packaging & Unpackaging Result Interfaces
// =========================================================================================

export interface VaultPackagingResult<T = any> {
  success: boolean;
  doc: EncryptedVaultDocument;
  metrics: {
    recordCount: number;
    plaintextSizeBytes: number;
    ciphertextSizeBytes: number;
    checksum: string;
    durationMs: number;
  };
}

export interface VaultUnpackagingResult<T = any> {
  success: boolean;
  header: VaultDocumentHeader;
  payload: T;
  metrics: {
    durationMs: number;
    checksumVerified: boolean;
  };
}

// =========================================================================================
// 5. Canonical Serialization & Cryptographic Primitives
// =========================================================================================

/**
 * Deterministic Canonical JSON serialization (RFC 8785 subset)
 * Guarantees identical byte representation regardless of key order.
 */
export function canonicalJson(data: any): string {
  if (data === null || typeof data !== 'object') {
    return JSON.stringify(data);
  }

  if (Array.isArray(data)) {
    return '[' + data.map(canonicalJson).join(',') + ']';
  }

  const sortedKeys = Object.keys(data).sort();
  const pairs = sortedKeys.map((key) => {
    return JSON.stringify(key) + ':' + canonicalJson(data[key]);
  });
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes SHA-256 hash of canonical JSON string
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
    aadContext: `${storeId}:${vaultType}:${docId}`,
  };
}

/**
 * Decrypts payload verifying AAD and 128-bit authentication tag
 */
export function decryptPayload<T = any>(
  envelopeOrSerialized: EncryptedEnvelope | string,
  storeId: string,
  unitCode: string,
  vaultType: string,
  docId: string
): T {
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
  return JSON.parse(decrypted.toString('utf8')) as T;
}

// =========================================================================================
// 6. VaultService Implementation
// =========================================================================================

export class VaultService {
  public static readonly CLIENT_VERSION = '2.6.0';
  public static readonly SCHEMA_VERSION = 'v1';
  public static readonly MAX_FIRESTORE_DOC_SIZE = 1048576; // 1 MiB in bytes

  /**
   * Field-level classification lookup
   */
  public static classifyField(tableName: string, fieldName: string): FieldClassificationRule {
    const fnLower = fieldName.toLowerCase();

    // 1. GDPR Article 9 Health Data & Medical Absences
    if (
      fnLower.includes('medical_l4') ||
      fnLower.includes('medicall4') ||
      fnLower.includes('sick') ||
      fnLower.includes('l4') ||
      fnLower.includes('disability') ||
      fnLower.includes('diagnosis') ||
      fnLower.includes('sanepid')
    ) {
      return {
        tier: 'TIER_2_HR_GDPR',
        requiresEncryption: true,
        targetVault: 'vault_health_gdpr',
        description: 'Special Category Data under GDPR Article 9 (Medical leaves, health clearances, disability status)',
      };
    }

    // 2. HR & Compensation Data
    if (
      fnLower.includes('salary') ||
      fnLower.includes('hourly_rate') ||
      fnLower.includes('hourlyrate') ||
      fnLower.includes('rate') ||
      fnLower.includes('bonus') ||
      fnLower.includes('payroll') ||
      fnLower.includes('iban') ||
      (fnLower.includes('contract') && !fnLower.includes('code'))
    ) {
      return {
        tier: 'TIER_2_HR_GDPR',
        requiresEncryption: true,
        targetVault: 'vault_personnel',
        description: 'Sensitive Personnel Compensation & Contract Terms',
      };
    }

    // 3. Financial & Business Confidential
    if (
      fnLower.includes('sales') ||
      fnLower.includes('col_') ||
      fnLower.includes('cos_') ||
      fnLower.includes('revenue') ||
      fnLower.includes('profit') ||
      fnLower.includes('agc') ||
      fnLower.includes('budget') ||
      fnLower.includes('drivers') ||
      fnLower.includes('whatif')
    ) {
      return {
        tier: 'TIER_1_FINANCIAL',
        requiresEncryption: true,
        targetVault: 'vault_financials',
        description: 'Confidential Commercial & P&L Performance Data',
      };
    }

    // 4. Default: Public Telemetry / Routing
    return {
      tier: 'TIER_3_PUBLIC_ROUTING',
      requiresEncryption: false,
      targetVault: 'telemetry',
      description: 'Public Routing, Calendar Topology, or Operational Definition',
    };
  }

  /**
   * Deep sensitivity check on an arbitrary payload object
   */
  public static containsSensitiveFields(obj: any): boolean {
    if (!obj || typeof obj !== 'object') return false;
    for (const [key, value] of Object.entries(obj)) {
      if (/salary|rate|l4|sick|bonus|payroll|sales|revenue|profit|sanepid/i.test(key)) {
        return true;
      }
      if (typeof value === 'object' && this.containsSensitiveFields(value)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Sanitizes a schedule record before public display or transmission to unprivileged users
   */
  public static sanitizeForPublicSchedule(record: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
      'salary',
      'monthly_salary',
      'hourly_rate',
      'hourlyRate',
      'rate',
      'iban',
      'medical_l4',
      'medicalL4',
      'diagnosis',
      'planSickHours',
      'estSickHours',
      'notes', // Strip notes to prevent accidental health info leakage
    ];

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(record)) {
      if (!sensitiveKeys.includes(key)) {
        // Obfuscate shift code if it is medical sick leave L4
        if (key === 'shift_code' && value === 'L4') {
          sanitized[key] = 'ABSENCE';
        } else {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  }

  // =======================================================================================
  // Generic Packaging & Unpackaging Pipelines
  // =======================================================================================

  /**
   * Generic Vault Packaging Pipeline
   * Strips/validates payload, creates canonical checksum, encrypts with AAD context, constructs Firestore document.
   */
  public static async packageGenericVault<T = any>(params: {
    storeId: string;
    unitCode: string;
    vaultType: VaultType;
    docId: string;
    period?: string;
    staffGroup?: string;
    weekKey?: string;
    sensitivePayload: T;
    recordCount: number;
    updatedBy?: string;
  }): Promise<VaultPackagingResult<T>> {
    const startTime = Date.now();
    const { storeId, unitCode, vaultType, docId, period, staffGroup, weekKey, sensitivePayload, recordCount } = params;

    const updatedBy = params.updatedBy || 'system_vault_service';
    const updatedAt = new Date().toISOString();

    // 1. Canonical Serialization & Integrity Fingerprint
    const canonicalStr = canonicalJson(sensitivePayload);
    const checksum = canonicalSha256(sensitivePayload);
    const plaintextSizeBytes = Buffer.byteLength(canonicalStr, 'utf8');

    // 2. Client-Side AES-256-GCM Encryption with Bound AAD Context
    const envelope = encryptPayload(sensitivePayload, storeId, unitCode, vaultType, docId);
    const ciphertextSizeBytes = Buffer.byteLength(envelope.serialized || '', 'utf8');

    // 3. Construct Firestore Envelope Document
    const doc: EncryptedVaultDocument = {
      storeId,
      unitCode,
      vaultType,
      docId,
      period,
      staffGroup,
      weekKey,
      updatedAt,
      updatedBy,
      clientVersion: this.CLIENT_VERSION,
      recordCount,
      checksum,
      schemaVersion: this.SCHEMA_VERSION,
      encryptedPayload: envelope.serialized || envelope,
    };

    // 4. Validate Firestore Document Size Constraint (1 MiB Limit)
    const docSizeBytes = Buffer.byteLength(JSON.stringify(doc), 'utf8');
    if (docSizeBytes > this.MAX_FIRESTORE_DOC_SIZE) {
      throw new Error(
        `Vault packaging exceeded Firestore maximum document size (1 MiB): ${docSizeBytes} bytes for document ${docId}`
      );
    }

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      doc,
      metrics: {
        recordCount,
        plaintextSizeBytes,
        ciphertextSizeBytes,
        checksum,
        durationMs,
      },
    };
  }

  /**
   * Generic Vault Unpackaging Pipeline
   * Validates Firestore document header, decrypts payload with AAD verification, checks integrity hash.
   */
  public static async unpackageGenericVault<T = any>(params: {
    doc: EncryptedVaultDocument;
    storeId: string;
    unitCode: string;
    expectedVaultType?: VaultType;
  }): Promise<VaultUnpackagingResult<T>> {
    const startTime = Date.now();
    const { doc, storeId, unitCode, expectedVaultType } = params;

    // 1. Header Validation
    if (doc.storeId !== storeId) {
      throw new Error(`Tenant storeId mismatch: expected ${storeId}, got ${doc.storeId}`);
    }
    if (expectedVaultType && doc.vaultType !== expectedVaultType) {
      throw new Error(`VaultType mismatch: expected ${expectedVaultType}, got ${doc.vaultType}`);
    }
    if (!doc.encryptedPayload) {
      throw new Error(`Missing encryptedPayload in vault document ${doc.docId}`);
    }

    // 2. Decrypt Payload with AAD Context Verification
    const payload = decryptPayload<T>(
      doc.encryptedPayload,
      storeId,
      unitCode,
      doc.vaultType,
      doc.docId
    );

    // 3. Verify Decrypted Content Integrity Checksum
    const recalculatedChecksum = canonicalSha256(payload);
    const checksumVerified = recalculatedChecksum === doc.checksum;

    if (!checksumVerified) {
      console.warn(
        `⚠️ Vault checksum mismatch for ${doc.docId}: expected ${doc.checksum}, got ${recalculatedChecksum}`
      );
    }

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      header: {
        storeId: doc.storeId,
        unitCode: doc.unitCode,
        vaultType: doc.vaultType,
        docId: doc.docId,
        period: doc.period,
        staffGroup: doc.staffGroup,
        weekKey: doc.weekKey,
        updatedAt: doc.updatedAt,
        updatedBy: doc.updatedBy,
        clientVersion: doc.clientVersion,
        recordCount: doc.recordCount,
        checksum: doc.checksum,
        schemaVersion: doc.schemaVersion,
      },
      payload,
      metrics: {
        durationMs,
        checksumVerified,
      },
    };
  }

  // =======================================================================================
  // Specific Vault Domain Packaging Methods
  // =======================================================================================

  /**
   * Packages Financial Vault (`stores/{storeId}/vault_financials/{period}`)
   */
  public static async packageFinancialVault(
    storeId: string,
    unitCode: string,
    period: string, // e.g. 'month_2026_03'
    payload: FinancialVaultPayload,
    updatedBy?: string
  ): Promise<VaultPackagingResult<FinancialVaultPayload>> {
    const recordCount =
      (payload.aopPlans?.length || 0) +
      (payload.dailyKpiLogs?.length || 0) +
      (payload.weeklyActuals?.length || 0) +
      (payload.colSummary ? 1 : 0);

    return this.packageGenericVault({
      storeId,
      unitCode,
      vaultType: 'vault_financials',
      docId: period,
      period,
      sensitivePayload: payload,
      recordCount,
      updatedBy,
    });
  }

  /**
   * Unpackages Financial Vault (`stores/{storeId}/vault_financials/{period}`)
   */
  public static async unpackageFinancialVault(
    doc: EncryptedVaultDocument,
    storeId: string,
    unitCode: string
  ): Promise<VaultUnpackagingResult<FinancialVaultPayload>> {
    return this.unpackageGenericVault<FinancialVaultPayload>({
      doc,
      storeId,
      unitCode,
      expectedVaultType: 'vault_financials',
    });
  }

  /**
   * Packages Personnel Vault (`stores/{storeId}/vault_personnel/{staffGroup}`)
   */
  public static async packagePersonnelVault(
    storeId: string,
    unitCode: string,
    staffGroup: string, // e.g. 'active_roster'
    docId: string,      // e.g. 'roster_2026_03'
    payload: PersonnelVaultPayload,
    updatedBy?: string
  ): Promise<VaultPackagingResult<PersonnelVaultPayload>> {
    const recordCount =
      (payload.managers?.length || 0) +
      (payload.monthlyRosters?.length || 0) +
      (payload.crewUop?.length || 0) +
      (payload.crewUz?.length || 0) +
      (payload.trainingPartners?.length || 0) +
      (payload.trainingSkillChecks?.length || 0);

    return this.packageGenericVault({
      storeId,
      unitCode,
      vaultType: 'vault_personnel',
      docId,
      staffGroup,
      sensitivePayload: payload,
      recordCount,
      updatedBy,
    });
  }

  /**
   * Unpackages Personnel Vault (`stores/{storeId}/vault_personnel/{staffGroup}`)
   */
  public static async unpackagePersonnelVault(
    doc: EncryptedVaultDocument,
    storeId: string,
    unitCode: string
  ): Promise<VaultUnpackagingResult<PersonnelVaultPayload>> {
    return this.unpackageGenericVault<PersonnelVaultPayload>({
      doc,
      storeId,
      unitCode,
      expectedVaultType: 'vault_personnel',
    });
  }

  /**
   * Packages Schedule Vault (`stores/{storeId}/vault_schedules/{weekKey}`)
   */
  public static async packageScheduleVault(
    storeId: string,
    unitCode: string,
    weekKey: string, // e.g. 'week_2026_W12'
    docId: string,
    payload: ScheduleVaultPayload,
    updatedBy?: string
  ): Promise<VaultPackagingResult<ScheduleVaultPayload>> {
    const recordCount =
      (payload.shifts?.length || 0) +
      (payload.versions?.length || 0) +
      (payload.trainingShifts?.length || 0) +
      (payload.fichajesLogs?.length || 0);

    return this.packageGenericVault({
      storeId,
      unitCode,
      vaultType: 'vault_schedules',
      docId,
      weekKey,
      sensitivePayload: payload,
      recordCount,
      updatedBy,
    });
  }

  /**
   * Unpackages Schedule Vault (`stores/{storeId}/vault_schedules/{weekKey}`)
   */
  public static async unpackageScheduleVault(
    doc: EncryptedVaultDocument,
    storeId: string,
    unitCode: string
  ): Promise<VaultUnpackagingResult<ScheduleVaultPayload>> {
    return this.unpackageGenericVault<ScheduleVaultPayload>({
      doc,
      storeId,
      unitCode,
      expectedVaultType: 'vault_schedules',
    });
  }

  /**
   * Packages Health & GDPR Article 9 Vault (`stores/{storeId}/vault_health_gdpr/{period}`)
   */
  public static async packageHealthGdprVault(
    storeId: string,
    unitCode: string,
    period: string, // e.g. 'period_2026_Q1'
    docId: string,
    payload: HealthGdprVaultPayload,
    updatedBy?: string
  ): Promise<VaultPackagingResult<HealthGdprVaultPayload>> {
    const recordCount =
      (payload.l4MedicalAbsences?.length || 0) +
      (payload.torHealthSummary?.length || 0) +
      (payload.disabilityAccommodations?.length || 0) +
      (payload.sanitaryClearances?.length || 0) +
      (payload.rcpAbsenceConflicts?.length || 0);

    return this.packageGenericVault({
      storeId,
      unitCode,
      vaultType: 'vault_health_gdpr',
      docId,
      period,
      sensitivePayload: payload,
      recordCount,
      updatedBy,
    });
  }

  /**
   * Unpackages Health & GDPR Article 9 Vault (`stores/{storeId}/vault_health_gdpr/{period}`)
   */
  public static async unpackageHealthGdprVault(
    doc: EncryptedVaultDocument,
    storeId: string,
    unitCode: string
  ): Promise<VaultUnpackagingResult<HealthGdprVaultPayload>> {
    return this.unpackageGenericVault<HealthGdprVaultPayload>({
      doc,
      storeId,
      unitCode,
      expectedVaultType: 'vault_health_gdpr',
    });
  }

  /**
   * Builds Plaintext Public Telemetry Document (`stores/{storeId}/telemetry/status`)
   */
  public static buildTelemetryStatus(params: {
    storeId: string;
    unitCode: string;
    storeName: string;
    platform?: string;
    lastSyncAt?: string;
    vaultStats: PlaintextTelemetryDocument['vaultStats'];
    syncState?: PlaintextTelemetryDocument['syncState'];
    localDatabaseHealth: PlaintextTelemetryDocument['localDatabaseHealth'];
    updatedBy?: string;
  }): PlaintextTelemetryDocument {
    const now = new Date().toISOString();

    return {
      storeId: params.storeId,
      unitCode: params.unitCode,
      storeName: params.storeName,
      clientVersion: this.CLIENT_VERSION,
      platform: params.platform || process.platform || 'darwin',
      lastSyncAt: params.lastSyncAt || now,
      lastHeartbeatAt: now,
      vaultStats: params.vaultStats,
      syncState: params.syncState || 'idle',
      localDatabaseHealth: params.localDatabaseHealth,
      updatedAt: now,
      updatedBy: params.updatedBy || 'system_telemetry_reporter',
    };
  }
}
