import { getCollections, getMongoClient } from '../db/connection.js';
import type { Product, StockLog, UnitType } from '../types/index.js';

export async function addStock(
  productId: string,
  unit: UnitType,
  quantity: number
): Promise<Product> {
  const qty = +quantity;
  if (unit !== 'box' && unit !== 'piece') {
    throw new Error('Invalid unit. Must be "box" or "piece".');
  }
  if (!productId || !qty || qty <= 0 || !Number.isInteger(qty) || !Number.isFinite(qty)) {
    throw new Error('Invalid quantity. Must be a positive integer.');
  }

  const { products, stockLog } = getCollections();
  const p = await products.findOne({ id: productId });
  if (!p) {
    throw new Error('Product not found');
  }

  const pieces = unit === 'box' ? qty * p.boxSize : qty;
  const now = Date.now();

  const client = getMongoClient();
  const session = client.startSession();

  try {
    const executeInSession = async (sess?: any) => {
      const options = sess ? { session: sess } : {};
      const updateRes = await products.updateOne(
        { id: productId },
        { $inc: { currentStock: pieces }, $set: { updatedAt: now } },
        options
      );
      if (updateRes.matchedCount === 0) {
        throw new Error('Product not found');
      }

      await stockLog.insertOne(
        {
          productId,
          type: 'add',
          unit: unit === 'box' ? 'box' : 'piece',
          quantity: qty,
          pieces,
          at: now,
        },
        options
      );
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

  const updated = await products.findOne({ id: productId });
  if (!updated) throw new Error('Product not found after adding stock');
  return updated;
}

export async function getStockLogs(limit = 20, skip = 0): Promise<StockLog[]> {
  const { stockLog } = getCollections();
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const safeSkip = Math.max(0, skip);
  return stockLog.find({}).sort({ at: -1 }).skip(safeSkip).limit(boundedLimit).toArray();
}

