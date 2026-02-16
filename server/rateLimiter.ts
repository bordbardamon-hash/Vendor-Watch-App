interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  windowMs: 60 * 1000,
  maxRequests: 100,
};

const API_CONFIG: RateLimiterConfig = {
  windowMs: 60 * 1000,
  maxRequests: 60,
};

const AUTH_CONFIG: RateLimiterConfig = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 20,
};

const store = new Map<string, RateLimitEntry>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store.entries()) {
    if (now - entry.windowStart > 15 * 60 * 1000) {
      store.delete(key);
    }
  }
}

function checkLimit(key: string, config: RateLimiterConfig): { allowed: boolean; remaining: number; resetMs: number } {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= config.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.maxRequests - 1, resetMs: config.windowMs };
  }

  entry.count++;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const resetMs = config.windowMs - (now - entry.windowStart);

  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetMs };
  }

  return { allowed: true, remaining, resetMs };
}

function getClientKey(req: any): string {
  if (req.user?.id) return `user:${req.user.id}`;
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0]) : req.ip || req.socket?.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function createRateLimiter(config: Partial<RateLimiterConfig> = {}): RequestHandler {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${cfg.keyPrefix || 'default'}:${getClientKey(req)}`;
    const result = checkLimit(key, cfg);

    res.setHeader('X-RateLimit-Limit', cfg.maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetMs / 1000));

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfterMs: result.resetMs,
        limit: cfg.maxRequests,
        windowMs: cfg.windowMs,
      });
    }

    next();
  };
}

export const generalLimiter = createRateLimiter(DEFAULT_CONFIG);

export const apiLimiter = createRateLimiter({ ...API_CONFIG, keyPrefix: 'api' });

export const authLimiter = createRateLimiter({ ...AUTH_CONFIG, keyPrefix: 'auth' });

export const strictLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'strict',
});

export function getRateLimiterStats(): { totalEntries: number; memoryEstimateKb: number } {
  return {
    totalEntries: store.size,
    memoryEstimateKb: Math.round(store.size * 0.1),
  };
}
