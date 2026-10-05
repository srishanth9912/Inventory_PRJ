import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { getCollections } from '../db/connection.js';

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
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Date.now() + 14 * 24 * 60 * 60 * 1000, // 14 days validity
      iat: Date.now(),
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
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', env.JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }

    return { username: payload.username, role: payload.role || 'admin' };
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
    const db = getCollections();
    const adminsCol = db.products.db.collection<AdminDoc>('admins');
    const adminDoc = await adminsCol.findOne({ username });

    if (adminDoc) {
      const computed = hashPassword(password, adminDoc.salt);
      isValid = computed === adminDoc.passwordHash;
    } else {
      // Check default credentials
      isValid =
        username.toLowerCase() === env.ADMIN_USERNAME.toLowerCase() &&
        password === env.ADMIN_PASSWORD;
    }
  } catch {
    isValid =
      username.toLowerCase() === env.ADMIN_USERNAME.toLowerCase() &&
      password === env.ADMIN_PASSWORD;
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

  const db = getCollections();
  const adminsCol = db.products.db.collection<AdminDoc>('admins');
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(newPassword, salt);

  await adminsCol.updateOne(
    { username },
    { $set: { username, passwordHash, salt, updatedAt: Date.now() } },
    { upsert: true }
  );
}
