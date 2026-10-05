import { MongoClient, type Db, type Collection } from 'mongodb';
import { env } from '../config/env.js';
import type { Product, Sale, StockLog, Customer } from '../types/index.js';

let client: MongoClient | null = null;
let db: Db | null = null;

let productsCol: Collection<Product> | null = null;
let salesCol: Collection<Sale> | null = null;
let stockLogCol: Collection<StockLog> | null = null;
let customersCol: Collection<Customer> | null = null;

export async function connectToDatabase(): Promise<{
  client: MongoClient;
  db: Db;
  products: Collection<Product>;
  sales: Collection<Sale>;
  stockLog: Collection<StockLog>;
  customers: Collection<Customer>;
}> {
  if (db && client && productsCol && salesCol && stockLogCol && customersCol) {
    return {
      client,
      db,
      products: productsCol,
      sales: salesCol,
      stockLog: stockLogCol,
      customers: customersCol,
    };
  }

  console.log(`Connecting to MongoDB Atlas database "${env.DB_NAME}"...`);

  client = new MongoClient(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
    maxPoolSize: 20,
    minPoolSize: 2,
    connectTimeoutMS: 10000,
    maxIdleTimeMS: 60000,
  });

  await client.connect();
  db = client.db(env.DB_NAME);
  console.log(`✅ Connected directly to single database: "${db.databaseName}" on MongoDB Atlas`);

  // Ensure collections exist
  const existingCols = (await db.listCollections().toArray()).map((c) => c.name);
  for (const colName of ['products', 'sales', 'stock_log', 'customers']) {
    if (!existingCols.includes(colName)) {
      await db.createCollection(colName);
      console.log(`📁 Created collection: "${colName}" in ${env.DB_NAME}`);
    }
  }

  productsCol = db.collection<Product>('products');
  salesCol = db.collection<Sale>('sales');
  stockLogCol = db.collection<StockLog>('stock_log');
  customersCol = db.collection<Customer>('customers');

  return {
    client,
    db,
    products: productsCol,
    sales: salesCol,
    stockLog: stockLogCol,
    customers: customersCol,
  };
}

export function getMongoClient(): MongoClient {
  if (!client) throw new Error('Database not connected. Call connectToDatabase() first.');
  return client;
}

export function getDb(): Db {
  if (!db) throw new Error('Database not connected. Call connectToDatabase() first.');
  return db;
}

export function getCollections() {
  if (!productsCol || !salesCol || !stockLogCol || !customersCol) {
    throw new Error('Database collections not initialized. Call connectToDatabase() first.');
  }
  return {
    products: productsCol,
    sales: salesCol,
    stockLog: stockLogCol,
    customers: customersCol,
  };
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    console.log('Closing MongoDB Atlas connection pool...');
    await client.close();
    client = null;
    db = null;
    productsCol = null;
    salesCol = null;
    stockLogCol = null;
    customersCol = null;
    console.log('MongoDB connection closed cleanly.');
  }
}
