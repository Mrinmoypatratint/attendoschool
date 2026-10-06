/**
 * High-Speed In-Memory Micro-Cache Engine
 * Eliminates cross-region database network latency for repeated read queries.
 * Features instant invalidation on mutations and zero external dependencies.
 */

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

class FastMemoryCache {
  private store = new Map<string, CacheItem<any>>();
  private sweepInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Sweep expired items every 60 seconds to avoid memory leaks
    this.sweepInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.store.entries()) {
        if (item.expiresAt < now) {
          this.store.delete(key);
        }
      }
    }, 60000);

    if (this.sweepInterval.unref) {
      this.sweepInterval.unref();
    }
  }

  get<T>(key: string): T | null {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number = 20): void {
    if (ttlSeconds <= 0) return;
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidatePattern(prefixOrMatcher: string | RegExp): void {
    for (const key of this.store.keys()) {
      if (typeof prefixOrMatcher === 'string') {
        if (key.includes(prefixOrMatcher)) {
          this.store.delete(key);
        }
      } else if (prefixOrMatcher.test(key)) {
        this.store.delete(key);
      }
    }
  }

  deletePattern(prefixOrMatcher: string | RegExp): void {
    this.invalidatePattern(prefixOrMatcher);
  }


  clear(): void {
    this.store.clear();
  }
}

export const fastCache = new FastMemoryCache();
