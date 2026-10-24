/**
 * Multi-core Native Cluster Runner
 * Spawns worker processes across all available physical/virtual CPU cores
 * to maximize throughput for 10k - 50k+ active users.
 */

import cluster from 'cluster';
import os from 'os';

const numCPUs = os.cpus().length;
const maxWorkers = Math.max(1, parseInt(process.env.WEB_CONCURRENCY || '', 10) || numCPUs);

if (cluster.isPrimary) {
  console.log(`[Cluster Primary] Master PID ${process.pid} is running.`);
  console.log(`[Cluster Primary] Spawning ${maxWorkers} worker processes across ${numCPUs} CPU cores...`);

  // Fork workers
  for (let i = 0; i < maxWorkers; i++) {
    cluster.fork();
  }

  cluster.on('online', (worker) => {
    console.log(`[Cluster Worker] Worker #${worker.id} (PID ${worker.process.pid}) online.`);
  });

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`[Cluster Warning] Worker #${worker.id} (PID ${worker.process.pid}) died (${signal || code}). Respawning...`);
    cluster.fork();
  });

  // Graceful shutdown forwarding
  const forwardSignal = (sig: NodeJS.Signals) => {
    console.log(`[Cluster Primary] Received ${sig}. Terminating all workers...`);
    for (const id in cluster.workers) {
      cluster.workers[id]?.process.kill(sig);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));
} else {
  // Worker process runs HTTP server instance
  import('./server');
}
