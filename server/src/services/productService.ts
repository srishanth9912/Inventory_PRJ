import { getCollections, getMongoClient } from '../db/connection.js';
import type { Product, UpdateProductInput } from '../types/index.js';

export async function getAllProducts(): Promise<Product[]> {
  const { products } = getCollections();
  return products.find({}).sort({ id: 1 }).toArray();
}

export async function getProductById(id: string): Promise<Product | null> {
  const { products } = getCollections();
  return products.findOne({ id });
}

export async function updateProduct(
  id: string,
  body: UpdateProductInput
): Promise<Product> {
  const pId = String(id || '').trim();
  if (!pId) throw new Error('Product ID is required');

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name || name.length > 200) {
      throw new Error('Product name must be between 1 and 200 characters');
    }
  }

  if (body.description !== undefined && String(body.description).length > 2000) {
    throw new Error('Description is too long (maximum 2000 characters)');
  }

  if (body.imageUrl !== undefined && String(body.imageUrl).length > 2000) {
    throw new Error('Image URL is too long (maximum 2000 characters)');
  }

  if (
    body.boxSize !== undefined &&
    (!Number.isFinite(+body.boxSize) || !Number.isInteger(+body.boxSize) || +body.boxSize < 1 || +body.boxSize > 10000)
  ) {
    throw new Error('Box size must be an integer greater than 0');
  }
  if (
    body.defaultPricePerPiece !== undefined &&
    (!Number.isFinite(+body.defaultPricePerPiece) || +body.defaultPricePerPiece < 0 || +body.defaultPricePerPiece > 10000000)
  ) {
    throw new Error('Default price per piece cannot be negative');
  }
  if (
    body.currentStock !== undefined &&
    (!Number.isFinite(+body.currentStock) || !Number.isInteger(+body.currentStock) || +body.currentStock < 0 || +body.currentStock > 10000000)
  ) {
    throw new Error('Current stock must be a non-negative integer');
  }
  if (
    body.lowStockLimit !== undefined &&
    (!Number.isFinite(+body.lowStockLimit) || !Number.isInteger(+body.lowStockLimit) || +body.lowStockLimit < 0 || +body.lowStockLimit > 1000000)
  ) {
    throw new Error('Low stock limit must be a non-negative integer');
  }

  const { products, stockLog } = getCollections();
  const current = await products.findOne({ id: pId });
  if (!current) {
    throw new Error('Product not found');
  }

  const allowed = [
    'name',
    'description',
    'defaultPricePerPiece',
    'boxSize',
    'currentStock',
    'lowStockLimit',
    'imageUrl',
  ] as const;

  const update: Record<string, unknown> = { updatedAt: Date.now() };
  for (const k of allowed) {
    if (body[k] !== undefined) {
      if (k === 'boxSize' || k === 'currentStock' || k === 'lowStockLimit' || k === 'defaultPricePerPiece') {
        update[k] = +body[k]!;
      } else {
        update[k] = String(body[k]).trim();
      }
    }
  }

  const client = getMongoClient();
  const session = client.startSession();

  try {
    const executeInSession = async (sess?: any) => {
      const options = sess ? { session: sess } : {};

      const isStockChange =
        body.currentStock !== undefined && +body.currentStock !== current.currentStock;

      const res = await products.updateOne({ id: pId }, { $set: update }, options);
      if (res.matchedCount === 0) {
        throw new Error('Product not found');
      }

      if (isStockChange) {
        const diff = +body.currentStock! - current.currentStock;
        try {
          await stockLog.insertOne(
            {
              productId: pId,
              type: 'manual_edit',
              pieces: diff,
              oldStock: current.currentStock,
              newStock: +body.currentStock!,
              at: Date.now(),
            },
            options
          );
        } catch (logErr) {
          if (!sess) {
            // Revert product update if stockLog failed and not in transaction
            await products.updateOne(
              { id: pId },
              { $set: { currentStock: current.currentStock, updatedAt: current.updatedAt } }
            );
          }
          throw logErr;
        }
      }
    };

    try {
      await session.withTransaction(async () => {
        await executeInSession(session);
      });
    } catch (txErr: any) {
      if (
        txErr?.message?.includes('Transaction numbers are only allowed') ||
        txErr?.message?.includes('replica set')
      ) {
        await executeInSession();
      } else {
        throw txErr;
      }
    }
  } finally {
    await session.endSession();
  }

  const updated = await products.findOne({ id: pId });
  if (!updated) throw new Error('Product not found after update');
  return updated;
}

