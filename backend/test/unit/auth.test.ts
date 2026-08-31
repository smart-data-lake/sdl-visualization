import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetSettings } from '../../src/config.js';
import {
  AuthError,
  clearIdentityCache,
  relayTokenRequest,
  validateWorkspaceHost,
  verifyDatabricksToken,
} from '../../src/auth/databricks.js';
import { authorizeScope, credentialsFrom, verifyBearer } from '../../src/auth/verifyBearer.js';
import { repositories } from '../../src/store/repositories.js';

/**
 * The checks that separate one workspace from another.
 *
 * The host arrives from the client, and an Entra token is issued for the Azure
 * Databricks first-party resource rather than for a particular workspace - so a
 * token minted for workspace A verifies happily against workspace B. The allowlist
 * is the only thing that stops that, and it is also what stops the header being
 * used as an SSRF primitive. These tests exist to keep it from becoming optional.
 */

const ALLOWED = 'https://adb-1234567890.4.azuredatabricks.net';
const ALSO_ALLOWED = 'https://adb-9876543210.12.azuredatabricks.net';

beforeEach(() => {
  process.env.SDLB_AUTH_MODE = 'databricks';
  process.env.SDLB_DATABRICKS_HOSTS = `${ALLOWED},${ALSO_ALLOWED}`;
  process.env.SDLB_AUTH_CACHE_TTL_SECONDS = '300';
  resetSettings();
  clearIdentityCache();
});

afterEach(() => {
  process.env.SDLB_AUTH_MODE = 'disabled';
  delete process.env.SDLB_DATABRICKS_HOSTS;
  resetSettings();
  clearIdentityCache();
});

/** A fresh Response per call: a body can only be read once. */
function scimResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const ME = { userName: 'someone@example.com', displayName: 'Someone', groups: [{ display: 'data-eng' }] };

describe('the workspace host allowlist', () => {
  test('an allowlisted Azure Databricks workspace is accepted and normalised', () => {
    expect(validateWorkspaceHost(ALLOWED)).toBe(ALLOWED);
    expect(validateWorkspaceHost(`${ALLOWED.toUpperCase()}/`)).toBe(ALLOWED);
  });

  test.each([
    ['a host nobody configured', 'https://adb-5555555555.1.azuredatabricks.net'],
    ['an attacker-controlled look-alike', 'https://adb-1234567890.4.azuredatabricks.net.evil.com'],
    ['plain http', 'http://adb-1234567890.4.azuredatabricks.net'],
    ['an internal address', 'https://169.254.169.254'],
    ['localhost', 'https://localhost:8080'],
    ['the legacy regional form', 'https://westeurope.azuredatabricks.net'],
    ['a host with a path', `${ALLOWED}/api/2.0`],
    ['a host with credentials', 'https://user:pw@adb-1234567890.4.azuredatabricks.net'],
    ['a host with a port', 'https://adb-1234567890.4.azuredatabricks.net:8443'],
    ['nonsense', 'not a url'],
    ['nothing at all', undefined],
  ])('%s is refused', (_name, host) => {
    expect(() => validateWorkspaceHost(host)).toThrow(AuthError);
  });

  test('the host is checked before anything is sent to it', async () => {
    const fetchImpl = vi.fn();
    await expect(
      verifyDatabricksToken('t', 'https://adb-5555555555.1.azuredatabricks.net', fetchImpl as never),
    ).rejects.toThrow(AuthError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('verifying a token against a workspace', () => {
  test('a 200 from SCIM yields the identity', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => scimResponse(ME));
    const identity = await verifyDatabricksToken('token', ALLOWED, fetchImpl as never);

    expect(identity.email).toBe('someone@example.com');
    expect(identity.groups).toEqual(['data-eng']);
    expect(identity.workspaceHost).toBe(ALLOWED);
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/2.0/preview/scim/v2/Me');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
  });

  test('a rejected token is a 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(scimResponse({}, 403));
    await expect(verifyDatabricksToken('bad', ALLOWED, fetchImpl as never)).rejects.toMatchObject({
      status: 401,
    });
  });

  /** SCIM allows roughly 255 GET/min per workspace, so this is correctness, not speed. */
  test('a repeated request does not call Databricks again', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => scimResponse(ME));
    await verifyDatabricksToken('token', ALLOWED, fetchImpl as never);
    await verifyDatabricksToken('token', ALLOWED, fetchImpl as never);
    await verifyDatabricksToken('token', ALLOWED, fetchImpl as never);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('the same token against a different workspace is verified again', async () => {
    // An Entra token is not workspace-specific, so caching on the token alone
    // would let access to one workspace imply access to another.
    const fetchImpl = vi.fn().mockImplementation(async () => scimResponse(ME));
    await verifyDatabricksToken('token', ALLOWED, fetchImpl as never);
    await verifyDatabricksToken('token', ALSO_ALLOWED, fetchImpl as never);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('a rate limit or an outage is not cached as a rejection', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(scimResponse({}, 429))
      .mockImplementation(async () => scimResponse(ME));

    await expect(verifyDatabricksToken('token', ALLOWED, fetchImpl as never)).rejects.toThrow();
    // the next attempt really asks again, rather than replaying the failure
    await expect(verifyDatabricksToken('token', ALLOWED, fetchImpl as never)).resolves.toMatchObject(
      { email: 'someone@example.com' },
    );
  });

  test('a transport failure is reported, not cached', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockImplementation(async () => scimResponse(ME));
    await expect(verifyDatabricksToken('token', ALLOWED, fetchImpl as never)).rejects.toThrow();
    await expect(verifyDatabricksToken('token', ALLOWED, fetchImpl as never)).resolves.toBeTruthy();
  });

  test('a 200 without an identity is not accepted', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(scimResponse({ displayName: 'no userName' }));
    await expect(verifyDatabricksToken('token', ALLOWED, fetchImpl as never)).rejects.toThrow(
      /identity/,
    );
  });
});

describe('reading credentials off a request', () => {
  test('the header form the SPA and MCP clients use', () => {
    const credentials = credentialsFrom(
      { authorization: 'Bearer abc', 'x-databricks-host': ALLOWED },
      new URLSearchParams(),
    );
    expect(credentials).toEqual({ authorization: 'Bearer abc', workspaceHost: ALLOWED });
  });

  /**
   * None of SDLB's auth modes can set a second header, so the workspace host has to
   * be bakeable into the configured base URL - sttp appends its own parameters, so
   * one already in the URL survives.
   */
  test('the query form SDLB has to use', () => {
    const credentials = credentialsFrom(
      { authorization: 'Bearer abc' },
      new URLSearchParams({ dbxHost: ALLOWED }),
    );
    expect(credentials.workspaceHost).toBe(ALLOWED);
  });

  test('a header wins over the query parameter', () => {
    const credentials = credentialsFrom(
      { authorization: 'Bearer abc', 'x-databricks-host': ALLOWED },
      new URLSearchParams({ dbxHost: ALSO_ALLOWED }),
    );
    expect(credentials.workspaceHost).toBe(ALLOWED);
  });
});

describe('verifyBearer', () => {
  test('a missing Authorization header is a 401', async () => {
    await expect(verifyBearer({ workspaceHost: ALLOWED })).rejects.toMatchObject({ status: 401 });
  });

  test('local development can turn authentication off entirely', async () => {
    process.env.SDLB_AUTH_MODE = 'disabled';
    resetSettings();
    await expect(verifyBearer({})).resolves.toMatchObject({ via: 'anonymous' });
  });

  test('an unknown MCP token is refused', async () => {
    await expect(
      verifyBearer({ authorization: 'Bearer sdlb_nope' }, { repo: 'r', env: 'e' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  test('an MCP token cannot be used where there is no scope to have minted it for', async () => {
    await expect(verifyBearer({ authorization: 'Bearer sdlb_nope' })).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('scope authorisation', () => {
  const scope = { repo: 'getting-started', env: 'dev' };
  const principal = {
    email: 'someone@example.com',
    groups: ['data-eng'],
    via: 'databricks' as const,
    workspaceHost: ALLOWED,
  };

  test('a workspace with no row may see everything, so nothing has to be provisioned', async () => {
    await expect(authorizeScope(principal, scope)).resolves.toBeUndefined();
  });

  test('a row narrows the workspace to the repos and envs it names', async () => {
    await (await repositories()).workspaces.putRule(ALSO_ALLOWED.replace('https://', ''), {
      repos: 'something-else',
    });
    await expect(
      authorizeScope({ ...principal, workspaceHost: ALSO_ALLOWED }, scope),
    ).rejects.toMatchObject({ status: 403 });
  });

  test('a required group is enforced', async () => {
    const host = ALLOWED.replace('https://', '');
    await (await repositories()).workspaces.putRule(host, { requiredGroup: 'platform-admins' });
    await expect(authorizeScope(principal, scope)).rejects.toMatchObject({ status: 403 });
    await expect(
      authorizeScope({ ...principal, groups: ['platform-admins'] }, scope),
    ).resolves.toBeUndefined();
  });
});

/**
 * The OAuth relay.
 *
 * It exists because the workspace token endpoint sends no CORS headers, so the SPA
 * can post to it but never read the answer. It is unauthenticated, which makes the
 * host allowlist the only thing standing between it and being an open relay - so
 * that is what these mostly check.
 */
describe('relaying an OAuth token request', () => {
  const form = { grant_type: 'authorization_code', code: 'abc', client_id: 'cid' };

  test('posts form-encoded to the workspace token endpoint', async () => {
    const fetchImpl = vi.fn(async (url: any, init: any) => {
      expect(url).toBe(`${ALLOWED}/oidc/v1/token`);
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual(form);
      return new Response(JSON.stringify({ access_token: 'at', expires_in: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const { status, body } = await relayTokenRequest(ALLOWED, form, fetchImpl as any);
    expect(status).toBe(200);
    expect(body).toEqual({ access_token: 'at', expires_in: 3600 });
  });

  test('refuses a host that is not allowed, without sending anything', async () => {
    const fetchImpl = vi.fn();
    await expect(
      relayTokenRequest('https://adb-666.1.azuredatabricks.net', form, fetchImpl as any),
    ).rejects.toThrow(AuthError);
    // The point of the check: nothing may leave until the host is known to be ours.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('refuses an arbitrary URL, so the relay is not an SSRF primitive', async () => {
    const fetchImpl = vi.fn();
    for (const host of ['https://evil.example.com', 'http://169.254.169.254', 'not a url']) {
      await expect(relayTokenRequest(host, form, fetchImpl as any)).rejects.toThrow(AuthError);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("passes the workspace's own error through, status and body", async () => {
    // The useful case: "Scopes 'x' are not assigned to the client" has to reach the
    // sign-in screen intact, or the user is told nothing they can act on.
    const refusal = { error: 'invalid_scope', error_description: "Scopes 'scim' are not assigned" };
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(refusal), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
    );

    const { status, body } = await relayTokenRequest(ALLOWED, form, fetchImpl as any);
    expect(status).toBe(400);
    expect(body).toEqual(refusal);
  });

  test('survives a non-JSON answer from something that is not the OAuth endpoint', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>gateway timeout</html>', { status: 504 }));
    const { status, body } = await relayTokenRequest(ALLOWED, form, fetchImpl as any);
    expect(status).toBe(504);
    expect(body).toMatchObject({ error: 'invalid_response' });
  });

  test('turns a transport failure into a 401 rather than a 500', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(relayTokenRequest(ALLOWED, form, fetchImpl as any)).rejects.toThrow(AuthError);
  });
});
