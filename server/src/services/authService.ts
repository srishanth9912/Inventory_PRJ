import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { getDb } from '../db/connection.js';

// Custom admin credentials store in DB or fallback to env
interface AdminDoc {
  username: string;
  passwordHash: string;
  salt: string;
  updatedAt: number;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function createToken(payload: { username: string; role: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Date.now();
  const body = Buffer.from(
    JSON.stringify({
      username: String(payload.username).trim(),
      role: String(payload.role || 'admin').trim(),
      exp: now + 14 * 24 * 60 * 60 * 1000, // 14 days validity
      iat: now,
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): { username: string; role: string } | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    if (!header || !body || !signature) return null;

    // 1. Verify header algorithm strictly (pinning to HS256)
    const headerJson = Buffer.from(header, 'base64url').toString('utf8');
    const headerObj = JSON.parse(headerJson);
    if (!headerObj || headerObj.alg !== 'HS256' || headerObj.typ !== 'JWT') {
      return null;
    }

    // 2. Verify signature with constant-time equality
    const expectedSignature = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    // 3. Verify payload claims
    const payloadJson = Buffer.from(body, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    if (!payload || typeof payload !== 'object') return null;

    if (!payload.username || typeof payload.username !== 'string') return null;
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;

    const now = Date.now();
    if (now > payload.exp) {
      return null; // Expired
    }

    // Reject tokens with futuristic iat (allowing up to 60 seconds clock skew)
    if (typeof payload.iat === 'number' && payload.iat > now + 60000) {
      return null;
    }

    return {
      username: String(payload.username),
      role: typeof payload.role === 'string' ? payload.role : 'admin',
    };
  } catch {
    return null;
  }
}

export async function loginAdmin(
  usernameInput: string,
  passwordInput: string
): Promise<{ token: string; user: { username: string; role: string } }> {
  const username = String(usernameInput || '').trim();
  const password = String(passwordInput || '');

  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  // Check against env default or DB custom credentials
  let isValid = false;

  try {
    const db = getDb();
    const adminsCol = db.collection<AdminDoc>('admins');
    const adminDoc = await adminsCol.findOne({ username });

    if (adminDoc) {
      const computed = hashPassword(password, adminDoc.salt);
      isValid =
        computed.length === adminDoc.passwordHash.length &&
        crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(adminDoc.passwordHash));
    } else {
      // Check default credentials with timing safe comparison
      const envUser = env.ADMIN_USERNAME.toLowerCase();
      const envPass = env.ADMIN_PASSWORD;
      const userMatches = username.toLowerCase() === envUser;
      const passMatches =
        password.length === envPass.length &&
        crypto.timingSafeEqual(Buffer.from(password), Buffer.from(envPass));
      isValid = userMatches && passMatches;
    }
  } catch {
    const envUser = env.ADMIN_USERNAME.toLowerCase();
    const envPass = env.ADMIN_PASSWORD;
    const userMatches = username.toLowerCase() === envUser;
    const passMatches =
      password.length === envPass.length &&
      crypto.timingSafeEqual(Buffer.from(password), Buffer.from(envPass));
    isValid = userMatches && passMatches;
  }

  if (!isValid) {
    throw new Error('Invalid username or password');
  }

  const token = createToken({ username, role: 'admin' });
  return {
    token,
    user: { username, role: 'admin' },
  };
}

export async function verifyAccessCode(
  codeInput: string
): Promise<{ token: string; user: { username: string; role: string } }> {
  const code = String(codeInput || '').trim();
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
    throw new Error('A 6-digit access code is required');
  }

  const expectedPin = env.ACCESS_PIN;
  const isMatch =
    code.length === expectedPin.length &&
    crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expectedPin));

  if (!isMatch) {
    throw new Error('Incorrect access code');
  }

  const token = createToken({ username: 'admin', role: 'admin' });
  return {
    token,
    user: { username: 'admin', role: 'admin' },
  };
}

export async function changeAdminPassword(
  username: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  if (!newPassword || newPassword.length < 4) {
    throw new Error('New password must be at least 4 characters long');
  }

  // Verify old password first
  await loginAdmin(username, oldPassword);

  const db = getDb();
  const adminsCol = db.collection<AdminDoc>('admins');
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(newPassword, salt);

  await adminsCol.updateOne(
    { username },
    { $set: { username, passwordHash, salt, updatedAt: Date.now() } },
    { upsert: true }
  );
}
