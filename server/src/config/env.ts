import dns from 'dns';

// Fix Node.js SRV DNS resolution on Windows / restrictive local networks
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // ignore
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requiredSecret(name: string): string {
  const value = requiredEnv(name);
  if (value.length < 32) {
    throw new Error(`${name} must be at least 32 characters long`);
  }
  return value;
}

function requiredAccessPin(): string {
  const value = requiredEnv('ACCESS_PIN');
  if (!/^\d{6}$/.test(value)) {
    throw new Error('ACCESS_PIN must be exactly 6 digits');
  }
  return value;
}

export const env = {
  MONGODB_URI: requiredEnv('MONGODB_URI'),
  DB_NAME: requiredEnv('DB_NAME'),
  PORT: parseInt(process.env.PORT || '8787', 10),
  API_KEY: process.env.API_KEY || '',
  ADMIN_USERNAME: requiredEnv('ADMIN_USERNAME'),
  ADMIN_PASSWORD: requiredEnv('ADMIN_PASSWORD'),
  JWT_SECRET: requiredSecret('JWT_SECRET'),
  ACCESS_PIN: requiredAccessPin(),
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

export const allowedOrigins = new Set(
  [
    env.FRONTEND_ORIGIN,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    `http://localhost:${env.PORT}`,
    `http://127.0.0.1:${env.PORT}`,
  ].filter(Boolean) as string[]
);

export function isOriginPermitted(origin: string): boolean {
  if (!origin) return false;
  if (allowedOrigins.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    ) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}
