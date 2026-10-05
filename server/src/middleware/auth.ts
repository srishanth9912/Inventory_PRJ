import type { FastifyRequest, FastifyReply } from 'fastify';
import { env, isOriginPermitted } from '../config/env.js';

export async function authHook(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (req.method === 'OPTIONS') return;
  if (req.url === '/health' || req.url === '/db/status' || req.url.startsWith('/auth/')) return;

  if (env.API_KEY) {
    if (req.headers['x-api-key'] === env.API_KEY) return;
    reply.code(401).send({ ok: false, error: 'Unauthorized: Invalid API key' });
    return;
  }

  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  const isAllowed = isOriginPermitted(origin);
  const host = typeof req.headers.host === 'string' ? req.headers.host : '';
  const isLocalDevProxy =
    !origin &&
    (req.ip === '127.0.0.1' ||
      req.ip === '::1' ||
      req.ip?.startsWith('192.168.') ||
      req.ip?.startsWith('10.')) &&
    (host.endsWith(`:${env.PORT}`) || host.endsWith(':5173'));

  if (isAllowed || isLocalDevProxy) return;

  reply.code(401).send({ ok: false, error: 'Unauthorized request origin' });
}
