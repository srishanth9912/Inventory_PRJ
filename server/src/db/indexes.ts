import type { Db } from 'mongodb';

export async function ensureIndexes(db: Db): Promise<void> {
  const products = db.collection('products');
  const sales = db.collection('sales');
  const stockLog = db.collection('stock_log');
  const customers = db.collection('customers');

  await Promise.all([
    products.createIndex({ id: 1 }, { unique: true }),
    products.createIndex({ updatedAt: -1 }),

    sales.createIndex({ soldAt: -1 }),
    sales.createIndex({ customerId: 1 }, { sparse: true }),
    sales.createIndex({ 'items.productId': 1 }),
    sales.createIndex({ createdAt: -1 }),

    stockLog.createIndex({ at: -1 }),
    stockLog.createIndex({ productId: 1, at: -1 }),
    stockLog.createIndex({ type: 1 }),

    customers.createIndex({ phone: 1 }, { sparse: true }),
    customers.createIndex({ updatedAt: -1 }),
    customers.createIndex({ name: 1 }),
  ]);

  console.log('⚡ All database indexes verified and active in "ifb"!');
}
