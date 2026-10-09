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

  // 2. Authentication & security hook
  app.addHook('onRequest', authHook);

  // 3. Centralized error handling
  app.setErrorHandler(errorHandler);

  // 4. Register modular routes (both /api prefixed and direct base routes)
  const routes = [
    healthRoutes,
    authRoutes,
    productRoutes,
    stockRoutes,
    salesRoutes,
    customerRoutes,
    statsRoutes,
  ];

  for (const route of routes) {
    await app.register(route, { prefix: '/api' });
    await app.register(route);
  }

  return app;
}
