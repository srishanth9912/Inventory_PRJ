import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { verifyToken } from '../services/authService.js';

export async function authHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.method === 'OPTIONS') return;

  const path = req.url.split('?')[0]?.replace(/^\/api/, '') || '';
  if (path === '/health' || path === '/auth/verify-code' || path === '/auth/login') {
    return;
  }

  // 1. API key header (if configured)
  if (env.API_KEY && req.headers['x-api-key'] === env.API_KEY) {
    return;
  }

  // 2. Bearer JWT authorization token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const user = verifyToken(token);
    if (user) {
      return;
    }
  }

  reply.code(401).send({ ok: false, error: 'Unauthorized: Missing or invalid authentication token' });
}

