import type { FastifyPluginAsync } from 'fastify';
import { getDb, getCollections } from '../db/connection.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    try {
      const db = getDb();
      await db.command({ ping: 1 });

      return {
        ok: true,
        status: 'healthy',
        timestamp: Date.now(),
      };
    } catch {
      return reply.code(503).send({
        ok: false,
        status: 'unhealthy',
      });
    }
  });

  app.get('/db/status', async () => {
    const { products, sales, stockLog, customers } = getCollections();

    const [prodCount, saleCount, logCount, custCount] = await Promise.all([
      products.countDocuments(),
      sales.countDocuments(),
      stockLog.countDocuments(),
      customers.countDocuments(),
    ]);

    return {
      status: 'healthy',
      collections: {
        products: { count: prodCount },
        sales: { count: saleCount },
        stockLog: { count: logCount },
        customers: { count: custCount },
      },
    };
  });
};

