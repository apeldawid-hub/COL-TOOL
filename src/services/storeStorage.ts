// src/services/storeStorage.ts
/**
 * Starbucks Operations Suite — Multi-Store Partitioned Storage Service (F10)
 * Enforces strict namespacing of localStorage: `sbx_store_${safeStoreId}_<feature>`
 * Provides transparent legacy migration for Store 108120 and atomic partition management.
 */

import { StoreService } from './storeService';

export class StoreStorage {
  private static MIGRATION_FLAG_PREFIX = 'sbx_migrated_v2_';

  /**
   * Sanitizes store ID for storage key usage (prevents key path injection)
   */
  public static sanitizeStoreId(storeId: string): string {
    if (!storeId || typeof storeId !== 'string') return 'default';
    return storeId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }

  /**
   * Generates a fully qualified namespaced storage key for a feature
   */
  public static getKey(feature: string, customStoreId?: string): string {
    const rawStoreId = customStoreId || (typeof window !== 'undefined' ? StoreService.getCurrentStore()?.id : '') || '108120';
    const safeStoreId = this.sanitizeStoreId(rawStoreId);
    const cleanFeature = feature.replace(/^sbx_/, '').replace(/^store_[^_]+_/, '');
    return `sbx_store_${safeStoreId}_${cleanFeature}`;
  }

  /**
   * Retrieves an item from the active store's partition
   */
  public static getItem<T = string>(feature: string, customStoreId?: string): T | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const key = this.getKey(feature, customStoreId);
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch (err) {
      console.warn(`[StoreStorage] Błąd odczytu klucza ${feature}:`, err);
      return null;
    }
  }

  /**
   * Sets an item in the active store's partition with QuotaExceededError protection
   */
  public static setItem<T = any>(feature: string, value: T, customStoreId?: string): boolean {
    if (typeof localStorage === 'undefined') return false;
    try {
      const key = this.getKey(feature, customStoreId);
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (err: any) {
      if (err?.name === 'QuotaExceededError' || err?.code === 22) {
        console.error('[StoreStorage] Przekroczono limit pamięci localStorage!', err);
      } else {
        console.warn(`[StoreStorage] Błąd zapisu klucza ${feature}:`, err);
      }
      return false;
    }
  }

  /**
   * Removes an item from the active store's partition
   */
  public static removeItem(feature: string, customStoreId?: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const key = this.getKey(feature, customStoreId);
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`[StoreStorage] Błąd usuwania klucza ${feature}:`, err);
    }
  }

  /**
   * Returns all keys belonging to a specific store's partition
   */
  public static getStorePartitionKeys(storeId: string): string[] {
    if (typeof localStorage === 'undefined') return [];
    const safeStoreId = this.sanitizeStoreId(storeId);
    const prefix = `sbx_store_${safeStoreId}_`;
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          keys.push(k);
        }
      }
    } catch {}
    return keys;
  }

  /**
   * Completely purges a store's partition (leaves other stores intact)
   */
  public static clearStorePartition(storeId: string): number {
    if (typeof localStorage === 'undefined') return 0;
    const keys = this.getStorePartitionKeys(storeId);
    for (const k of keys) {
      try {
        localStorage.removeItem(k);
      } catch {}
    }
    return keys.length;
  }

  /**
   * Migrates un-namespaced legacy keys for Store 108120 to namespaced keys
   */
  public static migrateLegacyKeys(targetStoreId: string = '108120'): { migratedKeys: string[]; count: number } {
    if (typeof localStorage === 'undefined') return { migratedKeys: [], count: 0 };
    const safeTargetId = this.sanitizeStoreId(targetStoreId);
    const flagKey = `${this.MIGRATION_FLAG_PREFIX}${safeTargetId}`;
    if (localStorage.getItem(flagKey) === 'true') {
      return { migratedKeys: [], count: 0 };
    }

    const legacyKeyMapping: Record<string, string> = {
      'sbx_sm_tasks_v1': 'todos',
      'sbx_desktop_notifications_v1': 'notifications',
      'sbx_sync_outbox': 'sync_outbox',
      'sbx_sync_last_timestamp': 'sync_last_ts',
      'sbx_admin_managed_users': 'admin_managed_users',
      'sbx_admin_pending_requests': 'admin_pending_requests',
      'sbx_admin_security_logs': 'admin_security_logs',
      'sbx_notification_preferences': 'notification_preferences',
      'sbx_notification_logs': 'notification_logs',
      'sbux_daily_barista_hours': 'daily_barista_hours',
      'sbx_auth_current_session': 'auth_session',
    };

    const migratedKeys: string[] = [];

    for (const [legacyKey, targetFeature] of Object.entries(legacyKeyMapping)) {
      try {
        const raw = localStorage.getItem(legacyKey);
        if (raw !== null) {
          const namespacedKey = this.getKey(targetFeature, targetStoreId);
          if (localStorage.getItem(namespacedKey) === null) {
            localStorage.setItem(namespacedKey, raw);
            migratedKeys.push(legacyKey);
          }
          // Remove old un-namespaced key to prevent data bleed
          localStorage.removeItem(legacyKey);
        }
      } catch (err) {
        console.warn(`[StoreStorage] Błąd migracji klucza ${legacyKey}:`, err);
      }
    }

    localStorage.setItem(flagKey, 'true');
    console.log(`🚀 [StoreStorage] Zmigrowano ${migratedKeys.length} kluczy dla kawiarni [${targetStoreId}].`);
    return { migratedKeys, count: migratedKeys.length };
  }
}
