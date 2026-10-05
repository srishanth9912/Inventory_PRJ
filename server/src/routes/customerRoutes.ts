import type { FastifyPluginAsync } from 'fastify';
import {
  getCustomers,
  createOrUpdateCustomer,
  updateCustomerById,
  deleteCustomer,
} from '../services/customerService.js';

export const customerRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { limit?: string } }>('/customers', async (req) => {
    const limit = parseInt(req.query.limit || '200', 10);
    return getCustomers(limit);
  });

  app.post<{ Body: { name: string; phone?: string; notes?: string } }>(
    '/customers',
    async (req) => {
      return createOrUpdateCustomer(req.body || { name: '' });
    }
  );

  app.patch<{
    Params: { id: string };
    Body: { name?: string; phone?: string; notes?: string };
  }>('/customers/:id', async (req) => {
    return updateCustomerById(req.params.id, req.body || {});
  });

  app.delete<{ Params: { id: string } }>('/customers/:id', async (req) => {
    const ok = await deleteCustomer(req.params.id);
    return { ok };
  });
};
