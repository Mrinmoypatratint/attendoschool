import http from 'http';
import app from './app';
import { env } from './config/env';
import { pool } from './db';
import { startKeepAliveService } from './services/keepAliveService';

const server = http.createServer({ maxHeaderSize: 1024 * 1024 }, app);
server.listen(env.port, () => {
  console.log(`School Attendance API running on http://localhost:${env.port}`);

  // Keep-alive auto-pinger (prevents cloud container idle hibernation - 4 min interval)
  startKeepAliveService(env.keepAliveUrl, 4);
});

// Production reverse proxy / load balancer keep-alive alignment:
// Ensure Node.js HTTP keep-alive timeout is higher than upstream proxy timeout (e.g., Render/ALB 60s)
// to prevent upstream proxy getting ECONNRESET or "server unreachable" 502/504 errors.
server.keepAliveTimeout = 65000; // 65 seconds
server.headersTimeout = 66000;   // 66 seconds (> keepAliveTimeout)

async function shutdown(signal: string) {
  console.log(`Received ${signal}, starting graceful shutdown...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log('Database pool connections closed.');
    } catch (err) {
      console.error('Error closing database pool:', err);
    }
    console.log('Process gracefully terminated.');
    process.exit(0);
  });

  // Force close after 10s if connections linger
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.warn('[Server] Background unhandled rejection caught:', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.warn('[Server] Uncaught exception caught:', err.message);
});
