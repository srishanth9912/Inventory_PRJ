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

function requiredMongoUri(): string {
  const value = requiredEnv('MONGODB_URI');
  if (!/^mongodb(\+srv)?:\/\//.test(value) || /\s/.test(value)) {
    throw new Error(
      'MONGODB_URI must be a valid MongoDB URI without whitespace'
    );
  }
  if ((value.match(/@/g) || []).length !== 1) {
    throw new Error(
      'MONGODB_URI contains an unencoded credential character; URL-encode the username or password'
    );
  }
  try {
    new URL(value);
  } catch {
    throw new Error(
      'MONGODB_URI is invalid; URL-encode special characters in the username or password'
    );
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

function serverPort(): number {
  const value = Number.parseInt(process.env.PORT || '8787', 10);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return value;
}

export const env = {
  MONGODB_URI: requiredMongoUri(),
  DB_NAME: requiredEnv('DB_NAME'),
  PORT: serverPort(),
  API_KEY: process.env.API_KEY || '',
  ADMIN_USERNAME: requiredEnv('ADMIN_USERNAME'),
  ADMIN_PASSWORD: requiredEnv('ADMIN_PASSWORD'),
  JWT_SECRET: requiredSecret('JWT_SECRET'),
  ACCESS_PIN: requiredAccessPin(),
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

const configuredOrigins = (env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

export const allowedOrigins = new Set(
  [
    ...configuredOrigins,
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
  const normalized = origin.trim().replace(/\/+$/, '');
  if (allowedOrigins.has(normalized)) return true;
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
