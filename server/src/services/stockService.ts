import { getCollections, getMongoClient } from '../db/connection.js';
import type { Product, StockLog, UnitType } from '../types/index.js';

export async function addStock(
  productId: string,
  unit: UnitType,
  quantity: number
): Promise<Product> {
  const pId = String(productId || '').trim();
  const qty = Number(quantity);

  if (!pId || pId.length > 100) {
    throw new Error('Valid product ID is required');
  }
  if (unit !== 'box' && unit !== 'piece') {
    throw new Error('Invalid unit. Must be "box" or "piece".');
  }
  if (!Number.isInteger(qty) || !Number.isFinite(qty) || qty <= 0 || qty > 1000000) {
    throw new Error('Invalid quantity. Must be a positive integer.');
  }

  const { products, stockLog } = getCollections();
  const p = await products.findOne({ id: pId });
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
        { id: pId },
        { $inc: { currentStock: pieces }, $set: { updatedAt: now } },
        options
      );
      if (updateRes.matchedCount === 0) {
        throw new Error('Product not found');
      }

      try {
        await stockLog.insertOne(
          {
            productId: pId,
            type: 'add',
            unit: unit === 'box' ? 'box' : 'piece',
            quantity: qty,
            pieces,
            at: now,
          },
          options
        );
      } catch (logErr) {
        // If not running in a MongoDB transaction, compensate by reverting product stock update
        if (!sess) {
          await products.updateOne(
            { id: pId },
            { $inc: { currentStock: -pieces } }
          );
        }
        throw logErr;
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
  if (!updated) throw new Error('Product not found after adding stock');
  return updated;
}

export async function getStockLogs(limit = 20, skip = 0): Promise<StockLog[]> {
  const { stockLog } = getCollections();
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const safeSkip = Math.max(0, skip);
  return stockLog.find({}).sort({ at: -1 }).skip(safeSkip).limit(boundedLimit).toArray();
}

