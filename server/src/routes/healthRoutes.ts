import type { FastifyPluginAsync } from 'fastify';
import { getDb, getCollections } from '../db/connection.js';
import type { HealthResponse, DbStatusResponse } from '../types/index.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    try {
      const db = getDb();
      const { products, sales, stockLog, customers } = getCollections();

      const start = Date.now();
      await db.command({ ping: 1 });

      const [prodCount, saleCount, logCount, custCount] = await Promise.all([
        products.countDocuments(),
        sales.countDocuments(),
        stockLog.countDocuments(),
        customers.countDocuments(),
      ]);

      const response: HealthResponse = {
        ok: true,
        database: 'connected',
        target: 'MongoDB Atlas',
        dbName: db.databaseName,
        counts: {
          products: prodCount,
          sales: saleCount,
          stockLogs: logCount,
          customers: custCount,
        },
        latencyMs: Date.now() - start,
        timestamp: Date.now(),
      };

      return response;
    } catch (err: any) {
      return reply.code(503).send({
        ok: false,
        database: 'disconnected',
        error: err.message,
      });
    }
  });

  app.get('/db/status', async () => {
    const db = getDb();
    const { products, sales, stockLog, customers } = getCollections();

    const [prods, saleCount, logCount, custCount] = await Promise.all([
      products.find({}).toArray(),
      sales.countDocuments(),
      stockLog.countDocuments(),
      customers.countDocuments(),
    ]);

    const response: DbStatusResponse = {
      database: 'MongoDB Atlas',
      dbName: db.databaseName,
      isCloud: true,
      collections: {
        products: { count: prods.length, data: prods },
        sales: { count: saleCount },
        stockLog: { count: logCount },
        customers: { count: custCount },
      },
      status: 'healthy',
    };

    return response;
  });
};
