import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildFastify } from '../../src/app.js';
import { useTempStore } from '../setup/store.js';

/**
 * Minting an access token for a scope that does not exist yet - what a fresh
 * installation runs on, since nothing provisions a repository until SDLB uploads and
 * SDLB cannot upload without a token.
 *
 * So the mint route does not check the scope is known, and just as deliberately does
 * not register it: `GET /repo` means "SDLB has pushed something here". Both halves are
 * one careless line away in either direction.
 */

let app: FastifyInstance;
let store: Awaited<ReturnType<typeof useTempStore>>;

const UNKNOWN = { tenant: 'PrivateTenant', repo: 'never-uploaded', env: 'dev' };
const q = (scope: Record<string, string>) => new URLSearchParams(scope).toString();

beforeAll(async () => {
  store = await useTempStore();
  app = await buildFastify();
});

afterAll(async () => {
  await app?.close();
  await store?.cleanup();
});

async function mint(scope: Record<string, string>, label = 'bootstrap') {
  return app.inject({
    method: 'POST',
    url: `/api/v1/mcp-tokens?${q(scope)}`,
    payload: { label },
  });
}

describe('a token for a repository that does not exist yet', () => {
  test('is issued, because it is what makes the first upload possible', async () => {
    const response = await mint(UNKNOWN);
    expect(response.statusCode, response.body).toBe(201);
    const body = response.json();
    // The only time the token itself comes back; only its hash is stored.
    expect(body.token).toMatch(/^sdlb_/);
    expect(body.id).toBeTruthy();
  });

  test('does not conjure the repository into the workspace switcher', async () => {
    const repos = await app.inject({ method: 'GET', url: '/api/v1/repo?tenant=PrivateTenant' });
    expect(repos.json()).not.toContain(UNKNOWN.repo);
    const envs = await app.inject({
      method: 'GET',
      url: `/api/v1/envs?tenant=PrivateTenant&repo=${UNKNOWN.repo}`,
    });
    expect(envs.json()).toEqual([]);
  });

  test('can be listed and revoked like any other', async () => {
    const created = (await mint(UNKNOWN, 'to be revoked')).json();

    const listed = await app.inject({ method: 'GET', url: `/api/v1/mcp-tokens?${q(UNKNOWN)}` });
    expect(listed.json().map((token: any) => token.id)).toContain(created.id);

    const revoked = await app.inject({
      method: 'DELETE',
      url: `/api/v1/mcp-tokens?${q(UNKNOWN)}&id=${created.id}`,
    });
    expect(revoked.statusCode).toBe(204);

    const after = await app.inject({ method: 'GET', url: `/api/v1/mcp-tokens?${q(UNKNOWN)}` });
    expect(after.json().map((token: any) => token.id)).not.toContain(created.id);
  });

});

describe('a scope has to be named', () => {
  // The shared NAME pattern ends in `*`, so an empty name satisfies it - and minting
  // wrote a real credential under {repo:'', env:''}. Hence scopeRequired.
  test.each([
    ['no repository', { tenant: 'PrivateTenant', repo: '', env: 'dev' }],
    ['no environment', { tenant: 'PrivateTenant', repo: 'getting-started', env: '' }],
    ['neither', { tenant: 'PrivateTenant', repo: '', env: '' }],
  ])('%s is refused rather than minted', async (_name, scope) => {
    // 422, not 400: parameter validation keeps FastAPI's status here, which is what
    // the upstream contract this service reimplements answers with. See app.ts.
    expect((await mint(scope)).statusCode).toBe(422);
  });

  test('listing and revoking refuse an empty scope too', async () => {
    const empty = q({ tenant: 'PrivateTenant', repo: '', env: '' });
    expect((await app.inject({ method: 'GET', url: `/api/v1/mcp-tokens?${empty}` })).statusCode).toBe(422);
    expect(
      (await app.inject({ method: 'DELETE', url: `/api/v1/mcp-tokens?${empty}&id=x` })).statusCode,
    ).toBe(422);
  });
});
