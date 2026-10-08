import { Request, Response, NextFunction } from 'express';

/**
 * Production-grade client IP resolver.
 * Handles reverse proxies (Render ALB/Envoy, Cloudflare, Nginx, AWS)
 * by safely extracting the real client IP from upstream proxy headers.
 */
export function getClientIp(req: Request): string {
  const headers = req.headers || {};
  const cf = headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();

  const xff = headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }

  const xReal = headers['x-real-ip'];
  if (typeof xReal === 'string' && xReal.trim()) return xReal.trim();

  return String(req.ip || (req.socket as any)?.remoteAddress || '127.0.0.1');
}

/**
 * Production-grade rate limiting with separate buckets for:
 * - General API traffic (600 req/min in prod, 1000 in dev)
 * - Login routes with intelligent dual-layer protection:
 *   1. Account-level: 30 attempts/min per account per IP (stops targeted brute-force)
 *   2. IP-level burst: 150 attempts/min per IP (supports entire schools/Wi-Fi networks)
 *   3. Instant reset on successful login: legitimate users never stay locked out
 */
const buckets = new Map<string, { count: number; start: number }>();
const loginAccountBuckets = new Map<string, { count: number; start: number }>();
const loginIpBuckets = new Map<string, { count: number; start: number }>();
const WINDOW = 60_000; // 1 minute window

// General API limit
const LIMIT = process.env.RATE_LIMIT
  ? Number(process.env.RATE_LIMIT)
  : (process.env.NODE_ENV === 'production' ? 600 : 1000);

// Login account-level limit (per IP + targeted account)
const ACCOUNT_LOGIN_LIMIT = Number(process.env.LOGIN_RATE_LIMIT || 30);

// Login IP-level burst limit (allows multi-user school networks)
const IP_LOGIN_LIMIT = Number(process.env.LOGIN_IP_RATE_LIMIT || 150);

// Periodically clean stale buckets to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of buckets) {
    if (now - val.start >= WINDOW * 2) buckets.delete(key);
  }
  for (const [key, val] of loginAccountBuckets) {
    if (now - val.start >= WINDOW * 2) loginAccountBuckets.delete(key);
  }
  for (const [key, val] of loginIpBuckets) {
    if (now - val.start >= WINDOW * 2) loginIpBuckets.delete(key);
  }
}, 5 * 60_000).unref();

export function requestContext(req: Request, _res: Response, next: NextFunction) {
  (req as any).securityContext = {
    userId: (req as any).user?.id || null,
    schoolId: (req as any).user?.schoolId || null,
    ip: getClientIp(req),
    userAgent: req.get ? req.get('user-agent') || '' : ''
  };
  next();
}

/**
 * Intelligent Login Rate Limiter.
 * Strictly applied only to login submission endpoints (POST /api/auth/login),
 * never to informational routes like institute discovery or lookup.
 */
export function loginRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();

  const rawTarget = String(
    req.body?.email ||
    req.body?.admissionNumber ||
    req.body?.admissionNo ||
    req.body?.studentId ||
    req.query?.email ||
    ''
  ).trim().toLowerCase();

  const accountKey = rawTarget ? `${ip}:${rawTarget}` : `${ip}:unspecified`;

  // 1. Check account-level bucket (protects specific account against credential guessing)
  const accountBucket = loginAccountBuckets.get(accountKey);
  if (accountBucket && now - accountBucket.start < WINDOW && accountBucket.count >= ACCOUNT_LOGIN_LIMIT) {
    const retryAfter = Math.ceil((WINDOW - (now - accountBucket.start)) / 1000);
    return res.status(429).json({
      message: 'Too many login attempts. Please wait 1 minute before trying again.',
      retryAfter: Math.max(1, retryAfter)
    });
  }

  // 2. Check IP-level global burst bucket (protects against distributed credential stuffing)
  const ipBucket = loginIpBuckets.get(ip);
  if (ipBucket && now - ipBucket.start < WINDOW && ipBucket.count >= IP_LOGIN_LIMIT) {
    const retryAfter = Math.ceil((WINDOW - (now - ipBucket.start)) / 1000);
    return res.status(429).json({
      message: 'Too many login attempts from this network. Please wait 1 minute before trying again.',
      retryAfter: Math.max(1, retryAfter)
    });
  }

  // Record attempt
  if (!accountBucket || now - accountBucket.start >= WINDOW) {
    loginAccountBuckets.set(accountKey, { count: 1, start: now });
  } else {
    accountBucket.count++;
  }

  if (!ipBucket || now - ipBucket.start >= WINDOW) {
    loginIpBuckets.set(ip, { count: 1, start: now });
  } else {
    ipBucket.count++;
  }

  next();
}

/**
 * Instantly clears login attempt counters for an account upon successful authentication.
 * Guarantees that users who mistype a password or switch roles are never locked out.
 */
export function clearLoginAttempts(req: Request, accountIdentifier?: string): void {
  try {
    const ip = getClientIp(req);
    const rawTarget = String(
      accountIdentifier ||
      req.body?.email ||
      req.body?.admissionNumber ||
      req.body?.admissionNo ||
      req.body?.studentId ||
      ''
    ).trim().toLowerCase();

    if (rawTarget) {
      loginAccountBuckets.delete(`${ip}:${rawTarget}`);
    }
    const ipBucket = loginIpBuckets.get(ip);
    if (ipBucket && ipBucket.count > 0) {
      ipBucket.count = Math.max(0, ipBucket.count - 1);
    }
  } catch {}
}

/**
 * Reset all in-memory login buckets (for maintenance or explicit admin resets).
 */
export function resetAllLoginBuckets(): void {
  loginAccountBuckets.clear();
  loginIpBuckets.clear();
}

export function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const clientIp = getClientIp(req);
  const key = `${clientIp}:${(req as any).user?.id || 'anon'}`;
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
