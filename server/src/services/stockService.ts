import { getCollections } from '../db/connection.js';
import type { Product, StockLog, UnitType } from '../types/index.js';

export async function addStock(
  productId: string,
  unit: UnitType,
  quantity: number
): Promise<Product> {
  const qty = +quantity;
  if (!productId || !qty || qty <= 0 || !Number.isInteger(qty)) {
    throw new Error('Invalid quantity. Must be a positive integer.');
  }

  const { products, stockLog } = getCollections();
  const p = await products.findOne({ id: productId });
  if (!p) {
    throw new Error('Product not found');
  }

  const pieces = unit === 'box' ? qty * p.boxSize : qty;
  const now = Date.now();

  await products.updateOne(
    { id: productId },
    { $inc: { currentStock: pieces }, $set: { updatedAt: now } }
  );

  await stockLog.insertOne({
    productId,
    type: 'add',
    unit: unit === 'box' ? 'box' : 'piece',
    quantity: qty,
    pieces,
    at: now,
  });

  const updated = await products.findOne({ id: productId });
  if (!updated) throw new Error('Product not found after adding stock');
  return updated;
}

export async function getStockLogs(limit = 30): Promise<StockLog[]> {
  const { stockLog } = getCollections();
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  return stockLog.find({}).sort({ at: -1 }).limit(boundedLimit).toArray();
}
