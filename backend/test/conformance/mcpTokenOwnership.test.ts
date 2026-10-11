import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { useTempStore } from '../setup/store.js';

/**
 * Who may see and revoke which access token: a member of SDLB_ADMIN_GROUP everyone's, anybody
 * else their own - and a caller holding an access token none, so a token cannot mint its successor.
 */

const HOST = 'https://adb-1.1.azuredatabricks.net';
const PEOPLE: Record<string, { email: string; groups: string[] }> = {
  alice: { email: 'alice@example.com', groups: ['users'] },
  bob: { email: 'bob@example.com', groups: ['users'] },
  admin: { email: 'admin@example.com', groups: ['users', 'sdlb-admins'] },
};

vi.mock('../../src/auth/databricks.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/auth/databricks.js')>()),
  verifyDatabricksToken: async (token: string) => {
    const person = PEOPLE[token];
    if (!person) throw new Error(`unknown test token ${token}`);
    return { ...person, workspaceHost: HOST };
  },
}));

let app: FastifyInstance;
let store: Awaited<ReturnType<typeof useTempStore>>;
const Q = new URLSearchParams({ tenant: 'PrivateTenant', repo: 'getting-started', env: 'dev' }).toString();

const as = (bearer: string) => ({ authorization: `Bearer ${bearer}`, 'x-databricks-host': HOST });
const mint = (who: string) =>
  app.inject({ method: 'POST', url: `/api/v1/mcp-tokens?${Q}`, headers: as(who), payload: { label: who } });
const list = (who: string) => app.inject({ method: 'GET', url: `/api/v1/mcp-tokens?${Q}`, headers: as(who) });
const revoke = (who: string, id: string) =>
  app.inject({ method: 'DELETE', url: `/api/v1/mcp-tokens?${Q}&id=${id}`, headers: as(who) });

beforeAll(async () => {
  process.env.SDLB_AUTH_MODE = 'databricks';
  process.env.SDLB_DATABRICKS_HOSTS = HOST;
  process.env.SDLB_ADMIN_GROUP = 'sdlb-admins';
  store = await useTempStore();
  const { buildFastify } = await import('../../src/app.js');
  app = await buildFastify();
});

afterAll(async () => {
  await app?.close();
  await store?.cleanup();
  delete process.env.SDLB_AUTH_MODE;
  delete process.env.SDLB_DATABRICKS_HOSTS;
  delete process.env.SDLB_ADMIN_GROUP;
});

describe('a user who is not an admin', () => {
  test('sees only their own tokens', async () => {
    const own = (await mint('alice')).json();
    const other = (await mint('bob')).json();
    const ids = (await list('alice')).json().map((t: any) => t.id);
    expect(ids).toContain(own.id);
    expect(ids).not.toContain(other.id);
  });

  test("cannot revoke another user's token, which answers like a missing one", async () => {
    const other = (await mint('bob')).json();
    expect((await revoke('alice', other.id)).statusCode).toBe(404);
    expect((await list('bob')).json().map((t: any) => t.id)).toContain(other.id);
  });

  test('can revoke their own', async () => {
    const own = (await mint('alice')).json();
    expect((await revoke('alice', own.id)).statusCode).toBe(204);
    expect((await list('alice')).json().map((t: any) => t.id)).not.toContain(own.id);
  });
});

describe('a member of the admin group', () => {
  test("sees everyone's tokens, with whose they are", async () => {
    await mint('alice');
    await mint('bob');
    const emails = new Set((await list('admin')).json().map((t: any) => t.email));
    expect(emails).toEqual(new Set(['alice@example.com', 'bob@example.com']));
  });

  test("can revoke another user's token", async () => {
    const other = (await mint('bob')).json();
    expect((await revoke('admin', other.id)).statusCode).toBe(204);
    expect((await list('bob')).json().map((t: any) => t.id)).not.toContain(other.id);
  });

  test('is told so by /me', async () => {
    const me = (who: string) => app.inject({ method: 'GET', url: '/api/v1/me', headers: as(who) });
    expect((await me('admin')).json().admin).toBe(true);
    expect((await me('alice')).json().admin).toBe(false);
  });
});

describe('a caller holding an access token', () => {
  test('can neither mint, list nor revoke tokens', async () => {
    const issued = (await mint('alice')).json();
    expect((await mint(issued.token)).statusCode).toBe(403);
    expect((await list(issued.token)).statusCode).toBe(403);
    expect((await revoke(issued.token, issued.id)).statusCode).toBe(403);
  });

  test('still reaches the data its scope covers', async () => {
    const issued = (await mint('alice')).json();
    const workflows = await app.inject({ method: 'GET', url: `/api/v1/workflows?${Q}`, headers: as(issued.token) });
    expect(workflows.statusCode).toBe(200);
  });
});
