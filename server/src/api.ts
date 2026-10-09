import type { IncomingMessage, ServerResponse } from 'http';
import { buildApp } from './app.js';
import { connectToDatabase } from './db/connection.js';
import { ensureIndexes } from './db/indexes.js';
import { ensureSeedProducts } from './db/seed.js';

let appPromise: Promise<any> | null = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const { db, products } = await connectToDatabase();
      await ensureIndexes(db);
      await ensureSeedProducts(products);
      const app = await buildApp();
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const app = await getApp();
    await new Promise<void>((resolve, reject) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      res.on('error', reject);
      app.server.emit('request', req, res);
    });
  } catch (err: any) {
    console.error('Serverless Handler Error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
    }
  }
}
