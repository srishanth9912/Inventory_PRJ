import type { FastifyPluginAsync } from 'fastify';
import { getSales, createSale, type CreateSaleParams } from '../services/salesService.js';

export const salesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { limit?: string } }>('/sales', async (req) => {
    const limit = parseInt(req.query.limit || '100', 10);
    return getSales(limit);
  });

  app.post<{ Body: CreateSaleParams }>('/sales', async (req) => {
    return createSale(req.body || {});
  });
};
