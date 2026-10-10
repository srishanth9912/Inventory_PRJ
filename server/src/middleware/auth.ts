import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { verifyToken } from '../services/authService.js';

export async function authHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.method === 'OPTIONS') return;

  // Normalize URL path: strip query, strip /api prefix, strip duplicate/trailing slashes
  const rawPath = req.url.split('?')[0] || '';
  const cleanPath = rawPath.replace(/^\/api(?:\/|$)/, '/').replace(/\/+$/, '') || '/';

  // Public endpoints
  if (cleanPath === '/health' || cleanPath === '/auth/verify-code' || cleanPath === '/auth/login') {
    return;
  }

  // 1. API key header (if configured)
  const apiKeyHeader = req.headers['x-api-key'];
  if (
    env.API_KEY &&
    typeof apiKeyHeader === 'string' &&
    apiKeyHeader.length === env.API_KEY.length &&
    crypto.timingSafeEqual(Buffer.from(apiKeyHeader), Buffer.from(env.API_KEY))
  ) {
    (req as any).user = { username: 'api_client', role: 'admin' };
    return;
  }

  // 2. Bearer JWT authorization token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = verifyToken(token);
    if (user) {
      (req as any).user = user;
      return;
    }
  }

  reply.code(401).send({ ok: false, error: 'Unauthorized: Missing or invalid authentication token' });
}


