import { createHash } from 'node:crypto';
import { settings } from '../config.js';

/**
 * Verifying that a caller really has access to a Databricks workspace.
 *
 * The order of the checks matters. The workspace host arrives from the client, so
 * it is validated against an allowlist *before* anything is sent to it: an Entra
 * token is issued for the Azure Databricks first-party resource and is therefore
 * valid across every workspace, which means a caller could otherwise point us at a
 * host they control and have it answer "yes, valid" - and the header would double
 * as an SSRF primitive.
 *
 * The verification result is cached because workspace-level SCIM allows only about
 * 255 GET/min per workspace; one call per request would exhaust that and add a
 * round trip to every response.
 */

/** Azure Databricks per-workspace URLs. The legacy regional form is deliberately not accepted. */
const AZURE_DATABRICKS_HOST = /^https:\/\/adb-\d+\.\d{1,2}\.azuredatabricks\.net$/;

export interface DatabricksIdentity {
  /** SCIM userName, which is the user's email for Azure Databricks. */
  email: string;
  displayName?: string;
  /** Direct group memberships only - SCIM does not flatten nested groups. */
  groups: string[];
  workspaceHost: string;
}

export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Relay an OAuth token request to the workspace, on behalf of the browser.
 *
 * The SPA cannot make this call itself. The workspace's /oidc/v1/token answers
 * without an Access-Control-Allow-Origin header and does not implement preflight at
 * all - OPTIONS returns 404 - so the browser sends the POST (form-urlencoded is a
 * safelisted content type, so it is a simple request), the workspace processes it,
 * and then the response is withheld from the page. The authorization step is a
 * top-level redirect and is not subject to CORS, which is why the code comes back
 * fine and only the exchange fails.
 *
 * This is deliberately unauthenticated. It cannot be anything else: the caller is
 * in the middle of obtaining the very credential the rest of the API demands. Three
 * things keep it from being a useful relay for anyone else:
 *
 *  - validateWorkspaceHost runs first, so the only reachable destination is a
 *    workspace this deployment is already configured to trust. Without that the
 *    endpoint would be an SSRF primitive, the same hazard the header check above
 *    exists for.
 *  - the client is public - PKCE, no secret - so nothing confidential passes
 *    through and none is added here. A request is only useful to whoever already
 *    holds the matching code_verifier.
 *  - it grants no capability an attacker lacks. Anything that is not a browser can
 *    call the workspace endpoint directly; CORS is a restriction on pages, not on
 *    the network.
 *
 * The workspace's own status and body are passed back untouched, because its
 * errors are the useful ones - "Scopes 'x' are not assigned to the client" is a
 * far better thing to show than a status this function invented.
 */
export async function relayTokenRequest(
  rawHost: string | undefined | null,
  form: Record<string, string>,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number; body: unknown }> {
  const host = validateWorkspaceHost(rawHost);

  let response: Response;
  try {
    response = await fetchImpl(`${host}/oidc/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(form).toString(),
    });
  } catch (cause) {
    throw new AuthError(401, `Could not reach the Databricks workspace: ${String(cause)}`);
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // Not JSON: an edge or a proxy answered instead of the OAuth endpoint.
    body = { error: 'invalid_response', error_description: text.slice(0, 500) };
  }
  return { status: response.status, body };
}

/**
 * Normalise and check a workspace host. Returns the canonical origin, or throws.
 * Exported so the routes can reject a bad host with the same message everywhere.
 */
export function validateWorkspaceHost(rawHost: string | undefined | null): string {
  if (!rawHost) throw new AuthError(401, 'Missing workspace host');

  let url: URL;
  try {
    url = new URL(rawHost.trim());
  } catch {
    throw new AuthError(401, 'Workspace host is not a valid URL');
  }
  if (url.username || url.password) throw new AuthError(401, 'Workspace host must not carry credentials');
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new AuthError(401, 'Workspace host must be an origin, without path or query');
  }

  const origin = url.origin.toLowerCase();
  if (!AZURE_DATABRICKS_HOST.test(origin)) {
    throw new AuthError(401, 'Workspace host is not an Azure Databricks workspace URL');
  }
  if (!settings().databricksHosts.includes(origin)) {
    throw new AuthError(403, 'Workspace is not configured for this deployment');
  }
  return origin;
}

interface CacheEntry {
  expiresAt: number;
  identity?: DatabricksIdentity;
  error?: AuthError;
}

/**
 * Per-instance cache keyed by the token *and* the host: an Entra token verifies
 * against every workspace, so caching by token alone would leak access across them.
 * The raw token is never stored - only its hash, as the key.
 */
const cache = new Map<string, CacheEntry>();

/** Negative results expire sooner, so a user who has just been granted access is not stuck. */
const NEGATIVE_TTL_MS = 30_000;

function cacheKey(token: string, host: string): string {
  return createHash('sha256').update(`${token}\n${host}`).digest('hex');
}

export function clearIdentityCache(): void {
  cache.clear();
}

export async function verifyDatabricksToken(
  token: string,
  rawHost: string | undefined | null,
  fetchImpl: typeof fetch = fetch,
): Promise<DatabricksIdentity> {
  const host = validateWorkspaceHost(rawHost);
  const key = cacheKey(token, host);
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    if (cached.error) throw cached.error;
    return cached.identity!;
  }

  let response: Response;
  try {
    response = await fetchImpl(`${host}/api/2.0/preview/scim/v2/Me?attributes=groups,userName,displayName`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
  } catch (cause) {
    // A transport failure says nothing about the token, so it must not be cached.
    throw new AuthError(401, `Could not reach the Databricks workspace: ${String(cause)}`);
  }

  if (response.status === 429 || response.status >= 500) {
    // Not the caller's fault and not a stable answer: surface it, do not cache it.
    throw new AuthError(401, `Databricks could not verify the token right now (${response.status})`);
  }
  if (!response.ok) {
    const error = new AuthError(401, 'Databricks rejected the token for this workspace');
    cache.set(key, { expiresAt: now + NEGATIVE_TTL_MS, error });
    throw error;
  }

  const me = (await response.json()) as {
    userName?: string;
    displayName?: string;
    groups?: { display?: string; value?: string }[];
  };
  if (!me.userName) {
    throw new AuthError(401, 'Databricks did not return an identity for this token');
  }

  const identity: DatabricksIdentity = {
    email: me.userName,
    displayName: me.displayName,
    groups: (me.groups ?? []).map((g) => g.display ?? g.value ?? '').filter(Boolean),
    workspaceHost: host,
  };
  cache.set(key, { expiresAt: now + settings().authCacheTtlMs, identity });
  return identity;
}
