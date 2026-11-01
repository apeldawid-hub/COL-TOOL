/**
 * In-memory Store Key Cache for AES-256-GCM encryption keys.
 * Isolated in a standalone module to prevent importing Node native 'crypto' into browser bundles.
 */

export class StoreKeyCache {
  private static cache = new Map<string, { key: any; expiresAt: number }>();
  private static readonly TTL_MS = 60 * 60 * 1000; // 1 hour
  private static readonly MAX_ENTRIES = 256;

  public static get(storeId: string, unitCode: string, passphraseHash: string): any | null {
    const cacheKey = `${storeId}:${unitCode}:${passphraseHash}`;
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      if (entry.key && typeof entry.key.fill === 'function') {
        entry.key.fill(0);
      }
      this.cache.delete(cacheKey);
      return null;
    }
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, entry);
    return entry.key;
  }

  public static set(storeId: string, unitCode: string, passphraseHash: string, key: any): void {
    const cacheKey = `${storeId}:${unitCode}:${passphraseHash}`;
    const existing = this.cache.get(cacheKey);
    if (existing && existing.key !== key) {
      if (existing.key && typeof existing.key.fill === 'function') {
        existing.key.fill(0);
      }
      this.cache.delete(cacheKey);
    }

    if (this.cache.size >= this.MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const oldestEntry = this.cache.get(oldestKey);
        if (oldestEntry?.key && typeof oldestEntry.key.fill === 'function') {
          oldestEntry.key.fill(0);
        }
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, {
      key,
      expiresAt: Date.now() + this.TTL_MS,
    });
  }

  public static invalidateStore(storeId: string): void {
    const prefix = `${storeId}:`;
    for (const [k, entry] of this.cache.entries()) {
      if (k.startsWith(prefix)) {
        if (entry?.key && typeof entry.key.fill === 'function') {
          entry.key.fill(0);
        }
        this.cache.delete(k);
      }
    }
  }

  public static clear(): void {
    for (const entry of this.cache.values()) {
      if (entry?.key && typeof entry.key.fill === 'function') {
        entry.key.fill(0);
      }
    }
    this.cache.clear();
  }

  public static setStoreKey(storeId: string, key: any): void {
    this.set(storeId, storeId, 'default', key);
  }

  public static hasStoreKey(storeId: string): boolean {
    const prefix = `${storeId}:`;
    for (const k of this.cache.keys()) {
      if (k.startsWith(prefix)) return true;
    }
    return false;
  }

  public static size(): number {
    return this.cache.size;
  }
}
