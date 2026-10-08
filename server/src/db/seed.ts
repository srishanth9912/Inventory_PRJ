import type { Collection } from 'mongodb';
import type { Product } from '../types/index.js';

export const SEED_PRODUCTS: Array<Omit<Product, '_id'>> = [
  {
    id: 'detergent',
    name: 'Liquid Detergent',
    description: '945 ml',
    imageUrl: '/products/detergent.jpg',
    defaultPricePerPiece: 150,
    boxSize: 10,
    currentStock: 0,
    lowStockLimit: 2,
    updatedAt: Date.now(),
  },
  {
    id: 'descal',
    name: 'Descaler Powder',
    description: '100 g',
    imageUrl: '/products/descal.jpg',
    defaultPricePerPiece: 200,
    boxSize: 10,
    currentStock: 0,
    lowStockLimit: 2,
    updatedAt: Date.now(),
  },
];

export async function ensureSeedProducts(productsCol: Collection<Product>): Promise<void> {
  for (const p of SEED_PRODUCTS) {
    const existing = await productsCol.findOne({ id: p.id });
    if (!existing) {
      await productsCol.insertOne(p as any);
      console.log(`🌱 Initialized seed product "${p.name}" (${p.id})`);
    } else {
      // Ensure all metadata fields exist without overriding existing user stock or price
      await productsCol.updateOne(
        { id: p.id },
        {
          $set: {
            name: existing.name || p.name,
            description: existing.description || p.description,
            imageUrl: existing.imageUrl || p.imageUrl,
            boxSize: existing.boxSize || p.boxSize,
            defaultPricePerPiece:
              existing.defaultPricePerPiece !== undefined
                ? existing.defaultPricePerPiece
                : p.defaultPricePerPiece,
            lowStockLimit:
              existing.lowStockLimit !== undefined
                ? existing.lowStockLimit
                : p.lowStockLimit,
            currentStock:
              existing.currentStock !== undefined
                ? existing.currentStock
                : p.currentStock,
            updatedAt: existing.updatedAt || Date.now(),
          },
        }
      );
    }
  }
}
