import type { FastifyPluginAsync } from 'fastify';
import { addStock, getStockLogs } from '../services/stockService.js';
import type { UnitType } from '../types/index.js';

export const stockRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: { productId: string; unit: UnitType; quantity: number } }>(
    '/stock/add',
    async (req) => {
      const { productId, unit, quantity } = req.body || {};
      return addStock(productId, unit, quantity);
    }
  );

  app.get<{ Querystring: { limit?: string } }>('/stock/log', async (req) => {
    const limit = parseInt(req.query.limit || '30', 10);
    return getStockLogs(limit);
  });
};
