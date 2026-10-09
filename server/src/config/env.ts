import dns from 'dns';

// Fix Node.js SRV DNS resolution on Windows / restrictive local networks (local dev only)
if (process.platform === 'win32' && !process.env.VERCEL) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {
    // ignore
  }
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
  get MONGODB_URI() { return requiredMongoUri(); },
  get DB_NAME() { return process.env.DB_NAME?.trim() || 'inventory'; },
  get PORT() { return serverPort(); },
  get API_KEY() { return process.env.API_KEY || ''; },
  get ADMIN_USERNAME() { return process.env.ADMIN_USERNAME?.trim() || 'admin'; },
  get ADMIN_PASSWORD() { return requiredEnv('ADMIN_PASSWORD'); },
  get JWT_SECRET() { return requiredSecret('JWT_SECRET'); },
  get ACCESS_PIN() { return requiredAccessPin(); },
  get FRONTEND_ORIGIN() { return process.env.FRONTEND_ORIGIN || ''; },
  get NODE_ENV() { return process.env.NODE_ENV || 'development'; },
};

export function isOriginPermitted(origin: string): boolean {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, '');
  const configuredOrigins = (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (configuredOrigins.includes(normalized)) return true;
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname;
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.netlify.app') ||
      hostname.endsWith('.onrender.com') ||
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
