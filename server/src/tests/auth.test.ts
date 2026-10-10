import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test, describe, before, after } from 'node:test';
import { buildApp } from '../app.js';
import { createToken } from '../services/authService.js';
import type { FastifyInstance } from 'fastify';

describe('Authentication & Authorization Hardening Tests', () => {
  let app: FastifyInstance;

  before(async () => {
    // Set minimal required environment variables for test execution if needed
    process.env.ACCESS_PIN = process.env.ACCESS_PIN || '123456';
    process.env.JWT_SECRET = process.env.JWT_SECRET || '0123456789012345678901234567890123456789';
    process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminpass123';
    process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    process.env.DB_NAME = process.env.DB_NAME || 'inventory_test';

    app = await buildApp();
  });

  after(async () => {
    if (app) {
      await app.close();
    }
  });

  test('POST /api/auth/verify-code with correct PIN returns token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { code: process.env.ACCESS_PIN || '123456' },
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, true);
    assert.ok(body.token);
    assert.equal(body.user?.username, 'admin');
  });

  test('POST /api/auth/verify-code with incorrect PIN fails', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      payload: { code: '000000' },
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'Incorrect access code');
  });

  test('Protected endpoint rejects request without Bearer token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/products',
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, false);
  });

  test('Protected endpoint rejects request with invalid fake token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: {
        authorization: 'Bearer fake_token_12345',
      },
    });

    assert.equal(res.statusCode, 401);
  });

  test('Protected endpoint rejects request using Origin / Host bypass attempt without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: {
        origin: 'https://my-app.vercel.app',
        host: 'my-app.vercel.app',
      },
    });

    assert.equal(res.statusCode, 401);
  });

  test('Protected endpoint accepts valid server-issued Bearer token', async () => {
    const validToken = createToken({ username: 'admin', role: 'admin' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: {
        authorization: `Bearer ${validToken}`,
      },
    });

    // 200 or 500 depending on DB connection state in test environment, but MUST NOT be 401 Unauthorized
    assert.notEqual(res.statusCode, 401);
  });

  test('Public /health endpoint returns minimal safe status without sensitive database details', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    const body = JSON.parse(res.payload);
    assert.ok(body.status === 'healthy' || body.status === 'unhealthy');
    assert.equal(body.dbName, undefined);
    assert.equal(body.counts, undefined);
    assert.equal(body.target, undefined);
  });

  test('/db/status requires authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/db/status',
    });

    assert.equal(res.statusCode, 401);
  });

  test('Protected endpoint rejects algorithm none JWT attack', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ username: 'admin', role: 'admin', exp: Date.now() + 10000 })
    ).toString('base64url');
    const fakeToken = `${header}.${body}.`;

    const res = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: {
        authorization: `Bearer ${fakeToken}`,
      },
    });

    assert.equal(res.statusCode, 401);
  });

  test('Protected endpoint rejects expired JWT tokens', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({ username: 'admin', role: 'admin', exp: Date.now() - 10000 })
    ).toString('base64url');
    const signature = crypto
      .createHmac('sha256', process.env.JWT_SECRET || '0123456789012345678901234567890123456789')
      .update(`${header}.${body}`)
      .digest('base64url');
    const expiredToken = `${header}.${body}.${signature}`;

    const res = await app.inject({
      method: 'GET',
      url: '/api/products',
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    });

    assert.equal(res.statusCode, 401);
  });

  test('PIN rate limiting blocks repeated failed attempts after 5 failures', async () => {
    const testIp = '192.168.99.99';

    // Perform 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/auth/verify-code',
        headers: { 'x-forwarded-for': testIp },
        payload: { code: '999999' },
      });
    }

    // 6th attempt should return 429 Too Many Requests
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-code',
      headers: { 'x-forwarded-for': testIp },
      payload: { code: '999999' },
    });

    assert.equal(res.statusCode, 429);
    const body = JSON.parse(res.payload);
    assert.equal(body.ok, false);
    assert.match(body.error, /Too many login attempts/);
  });
});
