import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildFastify } from '../../src/app.js';
import { useTempStore } from '../setup/store.js';
import { resetSettings } from '../../src/config.js';

/**
 * The OAuth relay as the browser meets it: through Fastify, with the rate limit on.
 *
 * The unit tests next door cover the window arithmetic; what this file is for is the
 * two things only the wiring can get wrong - that the limit is attached to the routes
 * at all, and that it is one allowance across both of them rather than one each.
 */

const ALLOWED = 'https://adb-1234567890.4.azuredatabricks.net';
const LIMIT = 3;

let app: FastifyInstance;
let upstream: ReturnType<typeof vi.fn>;

const body = {
  workspaceHost: ALLOWED,
  clientId: 'cid',
  code: 'a-code',
  codeVerifier: '0123456789012345678901234567890123456789012',
  redirectUri: 'https://example.com/',
};

let store: Awaited<ReturnType<typeof useTempStore>>;

beforeEach(async () => {
  store = await useTempStore();
  process.env.SDLB_AUTH_MODE = 'databricks';
  process.env.SDLB_DATABRICKS_HOSTS = ALLOWED;
  process.env.SDLB_AUTH_RATE_LIMIT_PER_MINUTE = String(LIMIT);
  resetSettings();

  // The relay must never reach the real workspace from a test.
  upstream = vi.fn(async () =>
    new Response(JSON.stringify({ access_token: 'at', expires_in: 3600 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', upstream);

  app = await buildFastify();
});

afterEach(async () => {
  await app.close();
  vi.unstubAllGlobals();
  process.env.SDLB_AUTH_MODE = 'disabled';
  delete process.env.SDLB_DATABRICKS_HOSTS;
  delete process.env.SDLB_AUTH_RATE_LIMIT_PER_MINUTE;
  resetSettings();
  await store.cleanup();
});

const post = (url: string, payload: Record<string, unknown> = body) =>
  app.inject({ method: 'POST', url, payload, remoteAddress: '203.0.113.7' });

describe('the OAuth relay routes', () => {
  test('exchanges a code without any credential of its own', async () => {
    const response = await post('/api/v1/auth/token');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ access_token: 'at' });
    expect(upstream).toHaveBeenCalledOnce();
    expect(upstream.mock.calls[0][0]).toBe(`${ALLOWED}/oidc/v1/token`);
  });

  test('refuses a workspace outside the allowlist before calling anything', async () => {
    const response = await post('/api/v1/auth/token', { ...body, workspaceHost: 'https://evil.example.com' });
    expect(response.statusCode).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  test('stops at the limit, with a Retry-After the caller can act on', async () => {
    for (let i = 0; i < LIMIT; i++) expect((await post('/api/v1/auth/token')).statusCode).toBe(200);

    const refused = await post('/api/v1/auth/token');
    expect(refused.statusCode).toBe(429);
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
    expect(refused.json().detail).toMatch(/too many requests/i);
    // The whole point: a refused request must not reach Databricks.
    expect(upstream).toHaveBeenCalledTimes(LIMIT);
  });

  test('is one allowance across both routes, not one each', async () => {
    for (let i = 0; i < LIMIT; i++) expect((await post('/api/v1/auth/token')).statusCode).toBe(200);
    const refresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { workspaceHost: ALLOWED, clientId: 'cid', refreshToken: 'r' },
      remoteAddress: '203.0.113.7',
    });
    expect(refresh.statusCode).toBe(429);
  });

  test('ignores the port Azure appends to the forwarded address', async () => {
    // X-Forwarded-For from Azure is "ip:port", and the port is different on every
    // connection. Keyed on the raw value, every request looks like a new caller and
    // the limit never fires - which is exactly what it did in the deployment.
    const fromPort = (port: number) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/token',
        payload: body,
        headers: { 'x-forwarded-for': `203.0.113.50:${port}` },
      });

    for (let i = 0; i < LIMIT; i++) expect((await fromPort(40000 + i)).statusCode).toBe(200);
    expect((await fromPort(49999)).statusCode).toBe(429);
  });

  test('counts per address, so one caller cannot lock everyone out', async () => {
    for (let i = 0; i < LIMIT; i++) await post('/api/v1/auth/token');
    expect((await post('/api/v1/auth/token')).statusCode).toBe(429);

    const other = await app.inject({
      method: 'POST', url: '/api/v1/auth/token', payload: body, remoteAddress: '198.51.100.9',
    });
    expect(other.statusCode).toBe(200);
  });
});
