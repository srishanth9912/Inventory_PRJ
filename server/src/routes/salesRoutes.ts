import type { FastifyPluginAsync } from 'fastify';
import { getSales, createSale, type CreateSaleParams } from '../services/salesService.js';

export const salesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { limit?: string; customerId?: string; skip?: string } }>('/sales', async (req) => {
    const limit = parseInt(req.query.limit || '25', 10);
    const skip = parseInt(req.query.skip || '0', 10);
    return getSales(limit, req.query.customerId, skip);
  });

  app.post<{ Body: CreateSaleParams }>('/sales', async (req) => {
    return createSale(req.body || {});
  });
};
