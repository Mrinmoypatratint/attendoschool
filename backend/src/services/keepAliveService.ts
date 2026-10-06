import http from 'http';
import https from 'https';

/**
 * AttendoSchool Keep-Alive Service
 * Prevents cloud free-tier hosting (e.g., Render) from spinning down
 * by issuing periodic health pings to the configured URL every 4 minutes.
 */
export function startKeepAliveService(targetUrl?: string, intervalMinutes: number = 4): void {
  const rawUrl = targetUrl || process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;
  if (!rawUrl) {
    console.log('[KeepAlive] No KEEP_ALIVE_URL or RENDER_EXTERNAL_URL configured. Self-ping skipped in local mode.');
    return;
  }

  const cleanBase = rawUrl.replace(/\/+$/, '');
  const pingEndpoint = cleanBase.endsWith('/api/health') ? cleanBase : `${cleanBase}/api/health`;
  const intervalMs = Math.max(2, intervalMinutes) * 60 * 1000;

  console.log(`[KeepAlive] Service active. Auto-pinging ${pingEndpoint} every ${intervalMinutes} minutes.`);

  const executePing = () => {
    try {
      const client = pingEndpoint.startsWith('https') ? https : http;
      const req = client.get(pingEndpoint, { timeout: 15000 }, (res) => {
        console.log(`[KeepAlive] Ping dispatched to ${pingEndpoint} (Status: ${res.statusCode})`);
        res.resume();
      });

      req.on('error', (err) => {
        console.warn(`[KeepAlive] Ping warning: ${err.message}`);
      });

      req.on('timeout', () => {
        req.destroy();
        console.warn(`[KeepAlive] Ping timed out after 15s`);
      });
    } catch (err: any) {
      console.warn(`[KeepAlive] Execution error: ${err.message}`);
    }
  };

  // Initial warmup ping after 90 seconds
  setTimeout(executePing, 90 * 1000);

  // Periodic recurring ping
  const timer = setInterval(executePing, intervalMs);
  timer.unref(); // Don't block process exit
}
