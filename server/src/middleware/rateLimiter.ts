import type { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const pinRateLimits = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function getClientIp(req: FastifyRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip || '127.0.0.1';
}

export function checkPinRateLimit(req: FastifyRequest, reply: FastifyReply): boolean {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = pinRateLimits.get(ip);

  if (entry && entry.resetAt > now) {
    if (entry.count >= MAX_ATTEMPTS) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
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
