import type { FastifyRequest, FastifyReply } from 'fastify';
import { env, isOriginPermitted } from '../config/env.js';
import { verifyToken } from '../services/authService.js';

export async function authHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.method === 'OPTIONS') return;
  if (req.url === '/health' || req.url === '/db/status' || req.url.startsWith('/auth/')) return;

  // 1. API key header
  if (env.API_KEY) {
    if (req.headers['x-api-key'] === env.API_KEY) return;
    reply.code(401).send({ ok: false, error: 'Unauthorized: Invalid API key' });
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

  // 3. Origin & Host check (allows trusted frontend origins and same-origin proxy requests)
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  if (origin) {
    if (isOriginPermitted(origin)) return;
  } else {
    // Same-origin GET requests or Vercel/Netlify proxy rewrites do not send an Origin header
    const rawHost = (
      typeof req.headers['x-forwarded-host'] === 'string'
        ? req.headers['x-forwarded-host']
        : typeof req.headers.host === 'string'
          ? req.headers.host
          : ''
    ).split(',')[0]?.trim() || '';

    const hostname = rawHost.split(':')[0] || '';

    if (
      !hostname ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.netlify.app') ||
      hostname.endsWith('.onrender.com') ||
      Boolean(process.env.VERCEL) ||
      Boolean(process.env.NETLIFY)
    ) {
      return;
    }
  }

  reply.code(401).send({ ok: false, error: 'Unauthorized request origin' });
}
