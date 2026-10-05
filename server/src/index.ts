import { env } from './config/env.js';
import { connectToDatabase, closeDatabase } from './db/connection.js';
import { ensureIndexes } from './db/indexes.js';
import { ensureSeedProducts } from './db/seed.js';
import { buildApp } from './app.js';

async function bootstrap() {
  try {
    // 1. Establish single MongoDB Atlas database connection
    const { db, products } = await connectToDatabase();

    // 2. Ensure database performance indexes
    await ensureIndexes(db);

    // 3. Ensure essential products exist (preserves existing stock)
    await ensureSeedProducts(products);

    // 4. Build application instance
    const app = await buildApp();

    // 5. Graceful shutdown handler
    const handleShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      try {
        await app.close();
        await closeDatabase();
        console.log('Server and database connections closed cleanly.');
        process.exit(0);
      } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

    // 6. Start HTTP listener
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`🚀 IFB Server active at http://0.0.0.0:${env.PORT} [MongoDB Atlas: "${env.DB_NAME}"]`);
  } catch (err: any) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

bootstrap();
