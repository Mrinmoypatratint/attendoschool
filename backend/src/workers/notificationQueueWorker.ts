/**
 * Continuous Background Notification Worker
 * Dequeues notification tasks from Redis/Memory queue and drains database logs
 * with concurrency control and exponential backoff retry.
 */

import { queueService } from '../services/queueService';
import { processNotificationQueue } from '../services/notificationService';
import { processSmsQueue } from '../services/smsService';

let isRunning = false;
let workerLoopTimeout: NodeJS.Timeout | null = null;

export async function processQueueCycle(): Promise<void> {
  try {
    // 1. Drain any pending job from Redis / memory queue
    const job = await queueService.dequeueNotificationJob();
    if (job) {
      // Job present, process with immediate priority
      await processNotificationQueue(50);
      await processSmsQueue(20);
      return;
    }

    // 2. Periodic database sweep for scheduled retries or pending logs
    await processNotificationQueue(30);
    await processSmsQueue(15);
  } catch (err: any) {
    console.warn('[NotificationWorker] Processing cycle error:', err.message);
  }
}

export function startNotificationWorker(intervalMs = 3000): void {
  if (isRunning) return;
  isRunning = true;
  console.log(`[NotificationWorker] Background notification worker active (Polling every ${intervalMs}ms).`);

  const loop = async () => {
    if (!isRunning) return;
    await processQueueCycle();
    if (isRunning) {
      workerLoopTimeout = setTimeout(loop, intervalMs);
      if (workerLoopTimeout.unref) workerLoopTimeout.unref();
    }
  };

  // Immediate first run
  loop().catch(() => {});
}

export function stopNotificationWorker(): void {
  isRunning = false;
  if (workerLoopTimeout) {
    clearTimeout(workerLoopTimeout);
    workerLoopTimeout = null;
  }
  console.log('[NotificationWorker] Background notification worker stopped.');
}

// Standalone execution entrypoint: `node dist/workers/notificationQueueWorker.js`
if (require.main === module) {
  startNotificationWorker(2000);
  process.on('SIGINT', () => {
    stopNotificationWorker();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    stopNotificationWorker();
    process.exit(0);
  });
}
