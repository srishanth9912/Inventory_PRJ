import type { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const pinRateLimits = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_MAP_ENTRIES = 5000;

// Periodic cleanup of expired rate limit entries to prevent memory growth
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of pinRateLimits.entries()) {
    if (entry.resetAt <= now) {
      pinRateLimits.delete(key);
    }
  }
}

// Run cleanup every 5 minutes if timer not already running
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
  if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }
}

export function getClientIp(req: FastifyRequest): string {
  // Check X-Forwarded-For header if present
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    // Take the leftmost IP in the chain (original client)
    const clientIp = forwarded.split(',')[0]?.trim();
    if (clientIp) return clientIp;
  }
  return req.ip || '127.0.0.1';
}

export function checkPinRateLimit(req: FastifyRequest, reply: FastifyReply): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = pinRateLimits.get(ip);

  if (entry && entry.resetAt > now) {
    if (entry.count >= MAX_ATTEMPTS) {
      const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      reply.header('Retry-After', retryAfterSec);
      reply.code(429).send({
        ok: false,
        error: `Too many login attempts. Please try again in ${Math.ceil(retryAfterSec / 60)} minutes.`,
      });
      return false;
    }
  } else if (entry && entry.resetAt <= now) {
    pinRateLimits.delete(ip);
  }
  return true;
}

export function recordFailedPinAttempt(req: FastifyRequest): void {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = pinRateLimits.get(ip);

  // Evict oldest entries if map exceeds maximum bounds
  if (pinRateLimits.size >= MAX_MAP_ENTRIES) {
    cleanupExpiredEntries();
    if (pinRateLimits.size >= MAX_MAP_ENTRIES) {
      const firstKey = pinRateLimits.keys().next().value;
      if (firstKey) pinRateLimits.delete(firstKey);
    }
  }

  if (!entry || entry.resetAt <= now) {
    pinRateLimits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function recordSuccessfulPinAttempt(req: FastifyRequest): void {
  const ip = getClientIp(req);
  pinRateLimits.delete(ip);
}

