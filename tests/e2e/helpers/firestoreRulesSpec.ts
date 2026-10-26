import fs from 'node:fs';
import path from 'node:path';

export interface RuleMatchAnalysis {
  collectionPath: string;
  allowedRolesRead: string[];
  allowedRolesWrite: string[];
  enforcesTenantStoreId: boolean;
  forbidsCollectionGroupLeak: boolean;
  immutableFields: string[];
}

/**
 * Validates production Firestore rules according to Zero-Leak Tenant Isolation standards.
 */
export function analyzeFirestoreRules(rulesFilePath?: string): {
  rawRules: string;
  hasRulesVersion2: boolean;
  hasStoreTenantIsolation: boolean;
  executiveFinancialVaultIsolated: boolean;
  noWildcardCollectionGroupLeak: boolean;
} {
  const filePath = rulesFilePath || path.join(process.cwd(), 'firestore.rules');
  const rawRules = fs.readFileSync(filePath, 'utf8');

  const hasRulesVersion2 = /rules_version\s*=\s*['"]2['"]/.test(rawRules);
  const hasStoreTenantIsolation =
    rawRules.includes('match /stores/{storeId}') &&
    (rawRules.includes('request.auth.token.storeId == storeId') || rawRules.includes('isStoreManager(storeId)'));
  const executiveFinancialVaultIsolated =
    rawRules.includes('/executive_financial_vault/{docId}') &&
    rawRules.includes('isExecutive(storeId)');
  const noWildcardCollectionGroupLeak = !rawRules.includes('match /{path=**}/executive_financial_vault');

  return {
    rawRules,
    hasRulesVersion2,
    hasStoreTenantIsolation,
    executiveFinancialVaultIsolated,
    noWildcardCollectionGroupLeak,
  };
}
