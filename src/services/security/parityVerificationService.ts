/**
 * Starbucks Operations Suite — Bi-Directional Cryptographic Parity Verification Engine (Feature F17)
 *
 * Implements deep structural, canonical JSON (RFC 8785) and SHA-256 Merkle root verification
 * between local SQLite database records and decrypted cloud vault documents.
 *
 * Core Capabilities:
 * - Deterministic canonical JSON sorting and SHA-256 digests.
 * - Deep structural bi-directional comparison (local -> cloud and cloud -> local).
 * - Detects:
 *   - Row count mismatches
 *   - Missing / extra tables (including ghost tables in cloud)
 *   - Missing / extra records per table
 *   - Field-level value tampering
 *   - IEEE 754 floating point precision drift
 *   - Array element sequencing / ordering drift
 *   - ISO 8601 string vs epoch timestamp drift
 *   - Unicode NFC Polish diacritic normalization
 * - Generates cryptographically signed HMAC-SHA256 Parity Certificate on 100% match.
 */

import crypto from 'node:crypto';
import {
  canonicalJson,
  canonicalSha256,
  resolveUnitCode,
} from './encryptionService';

// =========================================================================================
// 1. Interfaces & Types
// =========================================================================================

export interface ParityMismatch {
  table: string;
  id: string;
  field?: string;
  localValue?: any;
  cloudValue?: any;
  reason: string;
}

export interface ParityCertificate {
  signature: string;
  certifiedAt: string;
  storeId: string;
  unitCode: string;
  localDigest: string;
  cloudDigest: string;
  verifiedTablesCount: number;
  verifiedRecordsCount: number;
}

export interface ParityVerificationReport {
  storeId: string;
  unitCode: string;
  verifiedAt: string;
  isParityVerified: boolean;
  localRecordsCount: number;
  cloudRecordsCount: number;
  totalTablesCompared: number;
  localCanonicalHash: string;
  cloudCanonicalHash: string;
  localTableDigests: Record<string, string>;
  cloudTableDigests: Record<string, string>;
  mismatches: ParityMismatch[];
  certificate?: ParityCertificate;
}

export interface ParityVerificationOptions {
  customSecret?: string;
  unitCode?: string;
  cloudTables?: Record<string, any[]>;
  cloudDocuments?: any[];
  rawTables?: Record<string, any[]>;
  localTables?: Record<string, any[]>;
}

// =========================================================================================
// 2. Normalization Helpers
// =========================================================================================

/**
 * Deeply normalizes all strings to Unicode NFC form while preserving types and arrays.
 */
function normalizeData(val: any): any {
  if (typeof val === 'string') {
    return val.normalize('NFC');
  }
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(normalizeData);
  }
  const res: Record<string, any> = {};
  for (const k of Object.keys(val).sort()) {
    res[k] = normalizeData(val[k]);
  }
  return res;
}

/**
 * Extracts a descriptive identifier for a record from standard fields.
 */
function getRecordId(record: any, index: number): string {
  if (!record || typeof record !== 'object') return String(index);
  if (record.id !== undefined && record.id !== null) return String(record.id);
  if (record.key !== undefined && record.key !== null) return String(record.key);
  if (record.date !== undefined && record.date !== null) return String(record.date);
  if (record.code !== undefined && record.code !== null) return String(record.code);
  if (record.week_key !== undefined && record.week_key !== null) return String(record.week_key);
  if (record.weekKey !== undefined && record.weekKey !== null) return String(record.weekKey);
  return String(index);
}

// =========================================================================================
// 3. ParityVerificationService Implementation
// =========================================================================================

export class ParityVerificationService {
  private secret: string;

  constructor(options?: { customSecret?: string }) {
    this.secret = options?.customSecret || 'sbx_parity_cert_key_v1';
  }

  /**
   * Compares local SQLite records and cloud records bi-directionally with cryptographic Merkle verification.
   */
  public async compareDatasets(
    storeId: string,
    localRaw: Record<string, any[] | undefined>,
    cloudRaw: Record<string, any[] | undefined>,
    unitCode?: string,
    options?: ParityVerificationOptions
  ): Promise<ParityVerificationReport> {
    const verifiedAt = new Date().toISOString();
    const resolvedUnit = resolveUnitCode(storeId, unitCode || options?.unitCode);
    const secretKey = options?.customSecret || this.secret;

    const local = normalizeData(localRaw) as Record<string, any[]>;
    const cloud = normalizeData(cloudRaw) as Record<string, any[]>;

    const mismatches: ParityMismatch[] = [];
    const localTableDigests: Record<string, string> = {};
    const cloudTableDigests: Record<string, string> = {};

    let localRecordsCount = 0;
    let cloudRecordsCount = 0;

    const localTables = Object.keys(local);
    const cloudTables = Object.keys(cloud);
    const allTableNames = Array.from(new Set([...localTables, ...cloudTables]));

    for (const table of localTables) {
      if (Array.isArray(local[table])) {
        localRecordsCount += local[table].length;
      }
    }

    for (const table of cloudTables) {
      if (Array.isArray(cloud[table])) {
        cloudRecordsCount += cloud[table].length;
      }
    }

    // 1. Table-level checks: missing tables in cloud & extra unexpected tables in cloud
    for (const table of cloudTables) {
      if (!(table in local)) {
        mismatches.push({
          table,
          id: 'table_unexpected',
          reason: `Unexpected extra table in cloud: ${table}`,
        });
      }
    }

    for (const table of localTables) {
      if (!(table in cloud)) {
        mismatches.push({
          table,
          id: 'table_missing',
          reason: `Missing table in cloud: ${table}`,
        });
      }
    }

    // 2. Table content deep comparison
    for (const table of allTableNames) {
      const localRows = Array.isArray(local[table]) ? local[table] : [];
      const cloudRows = Array.isArray(cloud[table]) ? cloud[table] : [];

      localTableDigests[table] = canonicalSha256(localRows);
      cloudTableDigests[table] = canonicalSha256(cloudRows);

      if (table in local && table in cloud) {
        if (localRows.length !== cloudRows.length) {
          mismatches.push({
            table,
            id: 'count',
            reason: `Row count mismatch: local has ${localRows.length} rows, cloud has ${cloudRows.length} rows`,
          });
        }

        const maxLen = Math.max(localRows.length, cloudRows.length);
        for (let i = 0; i < maxLen; i++) {
          if (i >= localRows.length) {
            mismatches.push({
              table,
              id: getRecordId(cloudRows[i], i),
              reason: `Extra record in cloud at index ${i}`,
              cloudValue: cloudRows[i],
            });
          } else if (i >= cloudRows.length) {
            mismatches.push({
              table,
              id: getRecordId(localRows[i], i),
              reason: `Missing record in cloud at index ${i}`,
              localValue: localRows[i],
            });
          } else {
            const localRow = localRows[i];
            const cloudRow = cloudRows[i];

            if (typeof localRow !== 'object' || typeof cloudRow !== 'object' || localRow === null || cloudRow === null) {
              if (localRow !== cloudRow) {
                mismatches.push({
                  table,
                  id: String(i),
                  localValue: localRow,
                  cloudValue: cloudRow,
                  reason: 'Primitive value mismatch',
                });
              }
              continue;
            }

            const recordId = getRecordId(localRow, i);
            const allKeys = Array.from(new Set([...Object.keys(localRow), ...Object.keys(cloudRow)]));

            for (const key of allKeys) {
              const lVal = localRow[key];
              const cVal = cloudRow[key];

              // Check type difference (e.g. ISO string vs epoch number)
              if (typeof lVal !== typeof cVal) {
                mismatches.push({
                  table,
                  id: recordId,
                  field: key,
                  localValue: lVal,
                  cloudValue: cVal,
                  reason: `Data type mismatch for field '${key}': local is ${typeof lVal}, cloud is ${typeof cVal}`,
                });
                continue;
              }

              // Check floating point / value equality
              if (typeof lVal === 'number' && typeof cVal === 'number') {
                if (lVal !== cVal) {
                  mismatches.push({
                    table,
                    id: recordId,
                    field: key,
                    localValue: lVal,
                    cloudValue: cVal,
                    reason: `Numeric value mismatch for field '${key}'`,
                  });
                }
                continue;
              }

              // Deep canonical JSON equality for complex values or strings
              if (canonicalJson(lVal) !== canonicalJson(cVal)) {
                mismatches.push({
                  table,
                  id: recordId,
                  field: key,
                  localValue: lVal,
                  cloudValue: cVal,
                  reason: `Field '${key}' value mismatch`,
                });
              }
            }
          }
        }
      }
    }

    const localCanonicalHash = canonicalSha256(local);
    const cloudCanonicalHash = canonicalSha256(cloud);

    const isParityVerified = mismatches.length === 0 && localCanonicalHash === cloudCanonicalHash;

    let certificate: ParityCertificate | undefined = undefined;

    if (isParityVerified) {
      const signaturePayload = `${storeId}:${resolvedUnit}:${localCanonicalHash}:${localRecordsCount}`;
      const signature = crypto.createHmac('sha256', secretKey).update(signaturePayload).digest('hex');

      certificate = {
        signature,
        certifiedAt: verifiedAt,
        storeId,
        unitCode: resolvedUnit,
        localDigest: localCanonicalHash,
        cloudDigest: cloudCanonicalHash,
        verifiedTablesCount: allTableNames.length,
        verifiedRecordsCount: localRecordsCount,
      };
    }

    return {
      storeId,
      unitCode: resolvedUnit,
      verifiedAt,
      isParityVerified,
      localRecordsCount,
      cloudRecordsCount,
      totalTablesCompared: allTableNames.length,
      localCanonicalHash,
      cloudCanonicalHash,
      localTableDigests,
      cloudTableDigests,
      mismatches,
      certificate,
    };
  }

  /**
   * Helper to unpack domain and generic vault payloads into table row arrays.
   */
  private static unpackPayloadIntoTables(
    payload: any,
    cloudTables: Record<string, any[]>,
    localTables?: Record<string, any[] | undefined>
  ): void {
    if (!payload || typeof payload !== 'object') return;

    if (payload.tables && typeof payload.tables === 'object') {
      for (const [table, rows] of Object.entries(payload.tables)) {
        if (Array.isArray(rows)) {
          cloudTables[table] = (cloudTables[table] || []).concat(rows);
        }
      }
    }

    const VAULT_FIELD_TO_TABLE: Record<string, string> = {
      aopPlans: 'aop_plans',
      dailyKpiLogs: 'daily_kpi_actuals_log',
      weeklyActuals: 'weekly_actual_trx',
      managers: 'manager_employees',
      monthlyRosters: 'manager_monthly_roster',
      crewUop: 'crewUop',
      crewUz: 'crewUz',
      trainingPartners: 'training_partners',
      trainingSkillChecks: 'training_skill_checks',
      shifts: 'manager_schedule_shifts',
      versions: 'manager_schedule_versions',
      trainingShifts: 'training_shifts',
      fichajesLogs: 'labor_actuals_log',
      l4MedicalAbsences: 'l4_medical_absences',
      torHealthSummary: 'tor_health_summary',
      disabilityAccommodations: 'disability_accommodations',
      sanitaryClearances: 'sanitary_clearances',
      rcpAbsenceConflicts: 'rcp_absence_conflicts',
    };

    for (const [key, val] of Object.entries(payload)) {
      if (key === 'tables') continue;
      if (Array.isArray(val)) {
        let targetTable = VAULT_FIELD_TO_TABLE[key] || key;
        if (key === 'shifts' && localTables && 'schedules' in localTables && !('manager_schedule_shifts' in localTables)) {
          targetTable = 'schedules';
        }
        cloudTables[targetTable] = (cloudTables[targetTable] || []).concat(val);
      }
    }
  }

  /**
   * Static helper for Electron IPC / CLI execution to verify a store against its cloud vaults.
   */
  public static async verifyStoreParity(
    storeId: string,
    options?: ParityVerificationOptions
  ): Promise<ParityVerificationReport> {
    const { CloudMigrationService } = await import('./cloudMigrationService');
    const { VaultService } = await import('./vaultService');

    const extraction = await CloudMigrationService.extractAllTables(storeId, options as any);
    const localTables = (options?.localTables || extraction.tables) as Record<string, any[]>;

    let cloudTables: Record<string, any[]> = {};

    if (options?.cloudTables) {
      cloudTables = options.cloudTables;
    } else if (options?.cloudDocuments && Array.isArray(options.cloudDocuments)) {
      cloudTables = {};
      const resolvedUnit = resolveUnitCode(storeId, options?.unitCode);

      for (const item of options.cloudDocuments) {
        const doc = (item && item.doc) ? item.doc : item;
        if (!doc) continue;

        // Skip non-encrypted / telemetry documents
        if (doc.vaultType === 'telemetry' || doc.docId === 'status') {
          continue;
        }

        try {
          if (doc.encryptedPayload || doc.ciphertext) {
            const unpackageRes = await VaultService.unpackageGenericVault({
              doc,
              storeId,
              unitCode: resolvedUnit,
              expectedVaultType: doc.vaultType,
            });
            const payload = unpackageRes.payload;
            if (payload && typeof payload === 'object') {
              ParityVerificationService.unpackPayloadIntoTables(payload, cloudTables, localTables);
            }
          } else if (doc.payload && typeof doc.payload === 'object') {
            ParityVerificationService.unpackPayloadIntoTables(doc.payload, cloudTables, localTables);
          }
        } catch {
          // If a document fails decryption or checksum verification, it won't populate tables,
          // which correctly surfaces parity mismatches
        }
      }
    } else {
      // If neither is supplied, do NOT set cloudTables = localTables.
      // Set cloudTables = {} so compareDatasets genuinely reports missing cloud tables/records.
      cloudTables = {};
    }

    const verifier = new ParityVerificationService({ customSecret: options?.customSecret });
    return verifier.compareDatasets(storeId, localTables, cloudTables, options?.unitCode, options);
  }
}
