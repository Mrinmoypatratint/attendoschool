/**
 * Hybrid Distributed Cache Engine (Redis + In-Memory Micro-Cache)
 * 
 * Provides:
 * 1. Distributed Redis caching across multiple Node.js instances / containers.
 * 2. Instant zero-dependency fallback to In-Memory cache if Redis is not configured or offline.
 * 3. Exact backward-compatible sync & async APIs to prevent any breaking changes.
 */

import Redis from 'ioredis';

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

class FastMemoryCache {
  private store = new Map<string, CacheItem<any>>();
  private sweepInterval: NodeJS.Timeout | null = null;

  constructor() {
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

class HybridCacheEngine {
  private memCache: FastMemoryCache;
  private redisClient: Redis | null = null;
  private isRedisReady: boolean = false;

  constructor() {
    this.memCache = new FastMemoryCache();
    this.initRedis();
  }

  private initRedis(): void {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_CACHE_URL || '';
    const redisHost = process.env.REDIS_HOST || '';

    if (!redisUrl && !redisHost) {
      return;
    }

    try {
      const options: any = {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 4000,
        enableOfflineQueue: false,
        retryStrategy: (times: number) => {
          if (times > 3) return null; // Stop retrying after 3 attempts, fallback to mem
          return Math.min(times * 1000, 3000);
        }
      };

      if (redisUrl) {
        this.redisClient = new Redis(redisUrl, options);
      } else {
        this.redisClient = new Redis({
          host: redisHost,
          port: Number(process.env.REDIS_PORT || 6379),
          password: process.env.REDIS_PASSWORD || undefined,
          ...options
        });
      }

      this.redisClient.on('connect', () => {
        this.isRedisReady = true;
        console.log('[CacheEngine] Distributed Redis cache connected successfully.');
      });

      this.redisClient.on('error', (err) => {
        if (this.isRedisReady) {
          console.warn('[CacheEngine] Redis connection dropped. Falling back to in-memory cache:', err.message);
        }
        this.isRedisReady = false;
      });

      this.redisClient.connect().catch((err) => {
        console.info('[CacheEngine] Redis server not reached. Operating in high-speed In-Memory cache mode.');
      });
    } catch (err: any) {
      console.warn('[CacheEngine] Redis initialization skipped. Memory cache active.');
    }
  }

  // Synchronous API (Uses memory directly for instant sub-millisecond return)
  get<T>(key: string): T | null {
    return this.memCache.get<T>(key);
  }

  set<T>(key: string, value: T, ttlSeconds: number = 30): void {
    this.memCache.set<T>(key, value, ttlSeconds);
    // Also push to Redis asynchronously if connected
    if (this.isRedisReady && this.redisClient) {
      try {
        const serialized = JSON.stringify(value);
        this.redisClient.set(key, serialized, 'EX', ttlSeconds).catch(() => {});
      } catch {}
    }
  }

  delete(key: string): void {
    this.memCache.delete(key);
    if (this.isRedisReady && this.redisClient) {
      this.redisClient.del(key).catch(() => {});
    }
  }

  invalidatePattern(prefixOrMatcher: string | RegExp): void {
    this.memCache.invalidatePattern(prefixOrMatcher);
    if (this.isRedisReady && this.redisClient && typeof prefixOrMatcher === 'string') {
      const pattern = prefixOrMatcher.includes('*') ? prefixOrMatcher : `*${prefixOrMatcher}*`;
      this.redisClient.keys(pattern).then(keys => {
        if (keys && keys.length > 0) {
          this.redisClient!.del(...keys).catch(() => {});
        }
      }).catch(() => {});
    }
  }

  deletePattern(prefixOrMatcher: string | RegExp): void {
    this.invalidatePattern(prefixOrMatcher);
  }

  clear(): void {
    this.memCache.clear();
    if (this.isRedisReady && this.redisClient) {
      this.redisClient.flushdb().catch(() => {});
    }
  }

  // Async API for distributed operations
  async getAsync<T>(key: string): Promise<T | null> {
    // 1. Check local memory first (L1 cache)
    const local = this.memCache.get<T>(key);
    if (local !== null) return local;

    // 2. Check Redis (L2 cache) if available
    if (this.isRedisReady && this.redisClient) {
      try {
        const raw = await this.redisClient.get(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.memCache.set(key, parsed, 10); // Cache in L1 for 10s
          return parsed as T;
        }
      } catch {}
    }

    return null;
  }

  async setAsync<T>(key: string, value: T, ttlSeconds: number = 30): Promise<void> {
    this.set(key, value, ttlSeconds);
  }

  async deleteAsync(key: string): Promise<void> {
    this.delete(key);
  }

  async invalidatePatternAsync(prefixOrMatcher: string | RegExp): Promise<void> {
    this.invalidatePattern(prefixOrMatcher);
  }

  isDistributed(): boolean {
    return this.isRedisReady;
  }
}

export const fastCache = new HybridCacheEngine();
