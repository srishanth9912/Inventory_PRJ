import type { FastifyPluginAsync } from 'fastify';
import { getDashboardStats } from '../services/statsService.js';

export const statsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/stats', async () => {
    return getDashboardStats();
  });
};
