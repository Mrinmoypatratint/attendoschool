import {Request,Response,NextFunction} from 'express';

/**
 * Production-grade rate limiting with separate buckets for
 * sensitive routes (login) vs general API traffic.
 * 
 * Key design decisions:
 * - General API: 600 req/min per IP (a page load makes 5-8 calls,
 *   so 120 was too low — 15 users/min would trigger 429 errors)
 * - Login route: 20 req/min per IP to prevent brute-force
 * - Stale bucket cleanup every 5 minutes to prevent memory leak
 */

const buckets = new Map<string, { count: number; start: number }>();
const loginBuckets = new Map<string, { count: number; start: number }>();
const WINDOW = 60_000; // 1 minute window

// General API: 600/min in production (configurable via env)
const LIMIT = process.env.RATE_LIMIT
  ? Number(process.env.RATE_LIMIT)
  : (process.env.NODE_ENV === 'production' ? 600 : 1000);

// Login: 20/min to prevent brute-force attacks
const LOGIN_LIMIT = Number(process.env.LOGIN_RATE_LIMIT || 20);

// Periodically clean stale buckets to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of buckets) {
    if (now - val.start >= WINDOW * 2) buckets.delete(key);
  }
  for (const [key, val] of loginBuckets) {
    if (now - val.start >= WINDOW * 2) loginBuckets.delete(key);
  }
}, 5 * 60_000).unref();

export function requestContext(req: Request, _res: Response, next: NextFunction) {
  (req as any).securityContext = {
    userId: (req as any).user?.id || null,
    schoolId: (req as any).user?.schoolId || null,
    ip: req.ip,
    userAgent: req.get('user-agent') || ''
  };
  next();
}

export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = String(req.ip || 'unknown');
  const now = Date.now();
  const b = loginBuckets.get(key);
  if (!b || now - b.start >= WINDOW) {
    loginBuckets.set(key, { count: 1, start: now });
    return next();
  }
  b.count++;
  if (b.count > LOGIN_LIMIT) {
    return res.status(429).json({
      message: 'Too many login attempts. Please wait 1 minute before trying again.',
      retryAfter: Math.ceil((WINDOW - (now - b.start)) / 1000)
    });
  }
  next();
}

export function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = `${req.ip}:${(req as any).user?.id || 'anon'}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start >= WINDOW) {
    buckets.set(key, { count: 1, start: now });
    return next();
  }
  b.count++;
  if (b.count > LIMIT) {
    return res.status(429).json({
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((WINDOW - (now - b.start)) / 1000)
    });
  }
  next();
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(),microphone=(),geolocation=(self)');
  next();
}
