import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { authHook } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { productRoutes } from './routes/productRoutes.js';
import { stockRoutes } from './routes/stockRoutes.js';
import { salesRoutes } from './routes/salesRoutes.js';
import { customerRoutes } from './routes/customerRoutes.js';
import { statsRoutes } from './routes/statsRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { authRoutes } from './routes/authRoutes.js';
import { isOriginPermitted } from './config/env.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // 1. CORS plugin
  await app.register(cors, {
    origin: (origin, callback) => callback(null, !origin || isOriginPermitted(origin)),
  });

  // 2. Strip /api prefix if present from Vercel top-level rewrite
  app.addHook('onRequest', async (req) => {
    if (req.url.startsWith('/api/')) {
      req.raw.url = req.url.substring(4);
    } else if (req.url === '/api') {
      req.raw.url = '/';
    }
  });

  // 3. Authentication & security hook
  app.addHook('onRequest', authHook);

  // 3. Centralized error handling
  app.setErrorHandler(errorHandler);

  // 4. Register modular routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(productRoutes);
  await app.register(stockRoutes);
  await app.register(salesRoutes);
  await app.register(customerRoutes);
  await app.register(statsRoutes);

  return app;
}
