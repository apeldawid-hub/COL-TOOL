// src/services/security/profilePolicyService.ts
/**
 * Starbucks Operations Suite — Profile Security Policy Service
 * Central authority governing UI pruning, store access scoping, and operational boundaries
 * between FLEET_MASTER and STORE_CLIENT runtime profiles.
 */

export type AppRuntimeMode = 'FLEET_MASTER' | 'STORE_CLIENT';

export interface ProfileSecurityPolicy {
  // Destructive Database Operations
  allowCleanSlateReset: boolean;
  allowHistoricalImport: boolean;
  allowRawDatabaseOverwrite: boolean;
  allowManualVacuumPragma: boolean;

  // Settings Tabs & Diagnostics
  allowFirebaseFleetTab: boolean;
  allowTestingGuideTab: boolean;

  // Navigation & Multi-Store Hopping
  allowStoreSwitching: boolean;
  allowCustomStoreAddition: boolean;
  allowFleetMasterDashboard: boolean;

  // Client Features
  showCloudSyncIndicator: boolean;
  showStationLockedBadge: boolean;
}

export class ProfilePolicyService {
  /**
   * Zwraca politykę uprawnień interfejsu dla danego profilu runtime.
   * Domyślnie (fail-safe) stosuje najbardziej restrykcyjny profil STORE_CLIENT.
   */
  public static getPolicy(mode?: string | null): ProfileSecurityPolicy {
    if (mode === 'FLEET_MASTER') {
      return {
        allowCleanSlateReset: true,
        allowHistoricalImport: true,
        allowRawDatabaseOverwrite: true,
        allowManualVacuumPragma: true,
        allowFirebaseFleetTab: true,
        allowTestingGuideTab: true,
        allowStoreSwitching: true,
        allowCustomStoreAddition: true,
        allowFleetMasterDashboard: true,
        showCloudSyncIndicator: true,
        showStationLockedBadge: false,
      };
    }

    // Fail-safe: STORE_CLIENT (domyślny i dla wszelkich nieznanych/błędnych wartości)
    return {
      allowCleanSlateReset: false,
      allowHistoricalImport: false,
      allowRawDatabaseOverwrite: false,
      allowManualVacuumPragma: false,
      allowFirebaseFleetTab: false,
      allowTestingGuideTab: false,
      allowStoreSwitching: false,
      allowCustomStoreAddition: false,
      allowFleetMasterDashboard: false,
      showCloudSyncIndicator: true,
      showStationLockedBadge: true,
    };
  }

  /**
   * Weryfikuje, czy przełączenie do lokalu targetStoreId jest dopuszczalne dla danego profilu.
   */
  public static canSwitchToStore(
    mode: AppRuntimeMode | string,
    targetStoreId: string,
    assignedStoreIds: string[] = []
  ): boolean {
    if (!targetStoreId || typeof targetStoreId !== 'string' || !targetStoreId.trim()) {
      return false;
    }
    if (mode === 'FLEET_MASTER') {
      return true;
    }

    // Fail-closed defensive guard: reject null, undefined, non-array, or empty assigned store lists
    if (!Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) {
      return false;
    }

    // STORE_CLIENT może pracować wyłącznie w ramach przypisanych jednostek
    const normalizedTarget = targetStoreId.toLowerCase().trim();
    return assignedStoreIds.some(
      (id) => typeof id === 'string' && Boolean(id.trim()) && id.toLowerCase().trim() === normalizedTarget
    );
  }

  /**
   * Filtruje katalog kawiarni do jednostek dozwolonych dla profilu.
   */
  public static filterStoresForProfile<T extends { id: string; unitCode?: string; mpk?: string }>(
    stores: T[],
    mode: AppRuntimeMode | string,
    assignedStoreIds: string[] = []
  ): T[] {
    if (!Array.isArray(stores)) {
      return [];
    }

    if (mode === 'FLEET_MASTER') {
      return stores;
    }

    if (!Array.isArray(assignedStoreIds) || assignedStoreIds.length === 0) {
      return [];
    }

    const assignedSet = new Set(
      assignedStoreIds
        .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
        .map((id) => id.toLowerCase().trim())
    );

    return stores.filter((s) => {
      if (!s) return false;
      const idMatch = typeof s.id === 'string' && s.id ? assignedSet.has(s.id.toLowerCase().trim()) : false;
      const unitMatch = typeof s.unitCode === 'string' && s.unitCode ? assignedSet.has(s.unitCode.toLowerCase().trim()) : false;
      const mpkMatch = typeof s.mpk === 'string' && s.mpk ? assignedSet.has(s.mpk.toLowerCase().trim()) : false;
      return idMatch || unitMatch || mpkMatch;
    });
  }
}
