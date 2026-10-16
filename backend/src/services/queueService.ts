/**
 * Distributed Queue Service (Redis-backed with In-Memory fallback)
 * Offloads Email, SMS, and WhatsApp dispatch from HTTP request lifecycle.
 */

import Redis from 'ioredis';
import { EventEmitter } from 'events';

export interface NotificationJob {
  id?: string;
  type: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'BATCH';
  schoolId?: string;
  sessionId?: string;
  timestamp: number;
  payload?: any;
}

class QueueService extends EventEmitter {
  private redisClient: Redis | null = null;
  private isRedisReady: boolean = false;
  private memoryQueue: NotificationJob[] = [];
  private readonly QUEUE_KEY = 'attendoschool:notifications:queue';

  constructor() {
    super();
    this.initRedis();
  }

  private initRedis(): void {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_QUEUE_URL || '';
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
          if (times > 3) return null;
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
        console.log('[QueueService] Redis background queue connected.');
      });

      this.redisClient.on('error', (err) => {
        if (this.isRedisReady) {
          console.warn('[QueueService] Redis connection dropped. Falling back to local queue:', err.message);
        }
        this.isRedisReady = false;
      });

      this.redisClient.connect().catch(() => {
        console.info('[QueueService] Redis offline. Operating with high-speed In-Memory worker queue.');
      });
    } catch {
      console.warn('[QueueService] Redis initialization skipped. In-memory queue active.');
    }
  }

  public isDistributed(): boolean {
    return this.isRedisReady && this.redisClient !== null;
  }

  public async enqueueNotificationJob(job: NotificationJob): Promise<boolean> {
    if (this.isRedisReady && this.redisClient) {
      try {
        await this.redisClient.rpush(this.QUEUE_KEY, JSON.stringify(job));
        return true;
      } catch (err: any) {
        console.warn('[QueueService] Failed to enqueue to Redis, pushing to memory:', err.message);
      }
    }

    // Fallback in-memory queue
    this.memoryQueue.push(job);
    this.emit('job_enqueued', job);
    return true;
  }

  public async dequeueNotificationJob(): Promise<NotificationJob | null> {
    if (this.isRedisReady && this.redisClient) {
      try {
        const item = await this.redisClient.lpop(this.QUEUE_KEY);
        if (item) {
          return JSON.parse(item) as NotificationJob;
        }
      } catch {}
    }

    // Check memory queue
    if (this.memoryQueue.length > 0) {
      return this.memoryQueue.shift() || null;
    }

    return null;
  }

  public async getQueueLength(): Promise<number> {
    if (this.isRedisReady && this.redisClient) {
      try {
        return await this.redisClient.llen(this.QUEUE_KEY);
      } catch {}
    }
    return this.memoryQueue.length;
  }
}

export const queueService = new QueueService();
