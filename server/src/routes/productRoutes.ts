import type { FastifyPluginAsync } from 'fastify';
import { getAllProducts, updateProduct } from '../services/productService.js';
import type { UpdateProductInput } from '../types/index.js';

export const productRoutes: FastifyPluginAsync = async (app) => {
  app.get('/products', async () => {
    return getAllProducts();
  });

  app.patch<{ Params: { id: string }; Body: UpdateProductInput }>(
    '/products/:id',
    async (req) => {
      return updateProduct(req.params.id, req.body || {});
    }
  );
};
