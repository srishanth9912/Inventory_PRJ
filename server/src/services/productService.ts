import { getCollections } from '../db/connection.js';
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
  const { products, stockLog } = getCollections();
  const current = await products.findOne({ id });
  if (!current) {
    throw new Error('Product not found');
  }

  if (body.boxSize !== undefined && (!Number.isInteger(+body.boxSize) || +body.boxSize < 1)) {
    throw new Error('Box size must be an integer greater than 0');
  }
  if (body.defaultPricePerPiece !== undefined && (Number.isNaN(+body.defaultPricePerPiece) || +body.defaultPricePerPiece < 0)) {
    throw new Error('Default price per piece cannot be negative');
  }
  if (body.currentStock !== undefined && (!Number.isInteger(+body.currentStock) || +body.currentStock < 0)) {
    throw new Error('Current stock must be a non-negative integer');
  }
  if (body.lowStockLimit !== undefined && (!Number.isInteger(+body.lowStockLimit) || +body.lowStockLimit < 0)) {
    throw new Error('Low stock limit must be a non-negative integer');
  }

  const allowed: (keyof UpdateProductInput)[] = [
    'name',
    'description',
    'defaultPricePerPiece',
    'boxSize',
    'currentStock',
    'lowStockLimit',
    'imageUrl',
  ];

  const update: Record<string, unknown> = { updatedAt: Date.now() };
  for (const k of allowed) {
    if (body[k] !== undefined) {
      if (k === 'boxSize' || k === 'currentStock' || k === 'lowStockLimit' || k === 'defaultPricePerPiece') {
        update[k] = +body[k]!;
      } else {
        update[k] = body[k];
      }
    }
  }

  // Audit log for manual currentStock modification
  if (body.currentStock !== undefined && +body.currentStock !== current.currentStock) {
    const diff = +body.currentStock - current.currentStock;
    await stockLog.insertOne({
      productId: id,
      type: 'manual_edit',
      pieces: diff,
      oldStock: current.currentStock,
      newStock: +body.currentStock,
      at: Date.now(),
    });
  }

  await products.updateOne({ id }, { $set: update });
  const updated = await products.findOne({ id });
  if (!updated) throw new Error('Product not found after update');
  return updated;
}
