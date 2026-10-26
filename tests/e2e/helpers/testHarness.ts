export interface StoreInfo {
  id: string;
  name: string;
  shortName: string;
  unitCode: string;
  mpk: string;
  city: string;
  district: string;
  address?: string;
  type?: 'Drive-Thru' | 'Mall' | 'High-Street' | 'Office';
}

/**
 * In-Memory Virtual LocalStorage implementation
 */
export class VirtualLocalStorage {
  private store = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  public removeItem(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }

  public getAllKeys(): string[] {
    return Array.from(this.store.keys());
  }

  public getStorePartitionKeys(storeId: string): string[] {
    const prefix = `sbx_store_${storeId}_`;
    return this.getAllKeys().filter((k) => k.startsWith(prefix));
  }
}

/**
 * Concurrency Mutex for serialized async operations
 */
export class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  public async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void;
    const waitPromise = new Promise<void>((resolve) => {
      release = resolve;
    });

    const previous = this.queue;
    this.queue = previous.then(() => waitPromise);

    await previous;
    try {
      return await fn();
    } finally {
      release!();
    }
  }
}

/**
 * LRU Connection Pool maintaining up to maxConnections (default 8) SQLite handles
 */
export class LRUConnectionPool {
  private pool = new Map<string, { handle: any; lastAccessed: number; isDirty: boolean }>();
  public evictionLog: Array<{ evictedStoreId: string; flushed: boolean }> = [];

  constructor(public readonly maxConnections = 8) {}

  public get(storeId: string): any | null {
    const entry = this.pool.get(storeId);
    if (!entry) return null;
    entry.lastAccessed = Date.now();
    return entry.handle;
  }

  public put(storeId: string, handle: any, isDirty = false): { evicted?: string } {
    if (this.pool.has(storeId)) {
      const entry = this.pool.get(storeId)!;
      entry.lastAccessed = Date.now();
      entry.isDirty = isDirty;
      return {};
    }

    let evicted: string | undefined;
    if (this.pool.size >= this.maxConnections) {
      // Find least recently used
      let oldestId: string | null = null;
      let oldestTime = Infinity;
      for (const [id, entry] of this.pool.entries()) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestId = id;
        }
      }

      if (oldestId) {
        const evictedEntry = this.pool.get(oldestId)!;
        this.evictionLog.push({ evictedStoreId: oldestId, flushed: evictedEntry.isDirty });
        this.pool.delete(oldestId);
        evicted = oldestId;
      }
    }

    this.pool.set(storeId, {
      handle,
      lastAccessed: Date.now(),
      isDirty,
    });

    return { evicted };
  }

  public size(): number {
    return this.pool.size;
  }

  public has(storeId: string): boolean {
    return this.pool.has(storeId);
  }

  public clear(): void {
    this.pool.clear();
  }
}

/**
 * Generates an array of N unique Starbucks Store configurations
 */
export function generateStoreCatalog(count = 105): StoreInfo[] {
  const cities = ['Warszawa', 'Kraków', 'Wrocław', 'Poznań', 'Gdańsk', 'Katowice', 'Łódź', 'Szczecin'];
  const types: Array<'Drive-Thru' | 'Mall' | 'High-Street' | 'Office'> = ['Drive-Thru', 'Mall', 'High-Street', 'Office'];

  const stores: StoreInfo[] = [];
  for (let i = 1; i <= count; i++) {
    const unitCode = String(18000 + i);
    const mpk = `108${String(i).padStart(3, '0')}`;
    const city = cities[i % cities.length];
    const type = types[i % types.length];
    const name = `${mpk} SBX ${city} Store ${i}`;
    const shortName = `${city} ${i}`;

    stores.push({
      id: mpk,
      name,
      shortName,
      unitCode,
      mpk,
      city,
      district: `Dystrykt ${city}`,
      address: `ul. Kawowa ${i}, ${city}`,
      type,
    });
  }
  return stores;
}
