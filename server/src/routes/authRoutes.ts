import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  loginAdmin,
  verifyToken,
  verifyAccessCode,
  changeAdminPassword,
} from '../services/authService.js';
import {
  checkPinRateLimit,
  recordFailedPinAttempt,
  recordSuccessfulPinAttempt,
} from '../middleware/rateLimiter.js';

interface LoginBody {
  username?: string;
  password?: string;
}

interface ChangePasswordBody {
  oldPassword?: string;
  newPassword?: string;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // 6-digit PIN verify route
  app.post('/auth/verify-code', async (req: FastifyRequest<{ Body: { code?: string } }>, reply: FastifyReply) => {
    if (!checkPinRateLimit(req, reply)) return;

    try {
      const { code = '' } = req.body || {};
      const result = await verifyAccessCode(code);
      recordSuccessfulPinAttempt(req);
      return reply.code(200).send({
        ok: true,
        token: result.token,
        user: result.user,
      });
    } catch (err: unknown) {
      recordFailedPinAttempt(req);
      const message = err instanceof Error ? err.message : 'Incorrect access code';
      return reply.code(401).send({ ok: false, error: message });
    }
  });

  // Login route
  app.post('/auth/login', async (req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    if (!checkPinRateLimit(req, reply)) return;

    try {
      const { username = '', password = '' } = req.body || {};
      if (!username.trim() || !password) {
        return reply.code(400).send({ ok: false, error: 'Username and password are required' });
      }

      const result = await loginAdmin(username, password);
      recordSuccessfulPinAttempt(req);
      return reply.code(200).send({
        ok: true,
        token: result.token,
        user: result.user,
      });
    } catch (err: unknown) {
      recordFailedPinAttempt(req);
      const message = err instanceof Error ? err.message : 'Invalid credentials';
      return reply.code(401).send({ ok: false, error: message });
    }
  });


  // Verify token / get current admin user
  app.get('/auth/me', async (req: FastifyRequest, reply: FastifyReply) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ ok: false, error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7).trim();
    const user = verifyToken(token);
    if (!user) {
      return reply.code(401).send({ ok: false, error: 'Session expired or invalid' });
    }

    return reply.code(200).send({ ok: true, user });
  });

  // Change password
  app.post(
    '/auth/change-password',
    async (req: FastifyRequest<{ Body: ChangePasswordBody }>, reply: FastifyReply) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ ok: false, error: 'Unauthorized' });
      }

      const token = authHeader.substring(7).trim();
      const user = verifyToken(token);
      if (!user) {
        return reply.code(401).send({ ok: false, error: 'Session expired or invalid' });
      }

      const { oldPassword = '', newPassword = '' } = req.body || {};
      if (!oldPassword || !newPassword) {
        return reply.code(400).send({ ok: false, error: 'Old password and new password are required' });
      }

      try {
        await changeAdminPassword(user.username, oldPassword, newPassword);
        return reply.code(200).send({ ok: true, message: 'Password updated successfully' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update password';
        return reply.code(400).send({ ok: false, error: message });
      }
    }
  );
}
