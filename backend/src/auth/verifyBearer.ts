import { settings } from '../config.js';
import { TABLES, getEntity } from '../store/tables.js';
import { keys, type Scope } from '../store/keys.js';
import { AuthError, verifyDatabricksToken, validateWorkspaceHost } from './databricks.js';
import { isMcpToken, resolveToken } from './mcpTokens.js';

/**
 * One transport-agnostic entry point for authentication, used by the REST routes
 * through a preHandler and by the MCP handler directly. It answers a single
 * question - who is calling, and may they touch this repo and environment - and
 * knows nothing about Fastify, JSON-RPC or HTTP status codes beyond AuthError.
 */

export interface Principal {
  email: string;
  groups: string[];
  /** Which of the two credential kinds was used. */
  via: 'databricks' | 'mcp-token' | 'anonymous';
  workspaceHost?: string;
}

export interface WorkspaceEntity {
  partitionKey: string;
  rowKey: string;
  /** Comma-separated allowlists. Empty or absent means "every repo" / "every env". */
  repos?: string;
  envs?: string;
  /** If set, the caller must be in this Databricks group. */
  requiredGroup?: string;
}

export interface Credentials {
  authorization?: string | null;
  /** Sent by the SPA and MCP clients as a header; SDLB can only put it in the base URL. */
  workspaceHost?: string | null;
}

/**
 * Pull the credentials out of a request, whatever shape it arrives in.
 * SDLB's HTTP client can set exactly one header - Authorization - because none of its
 * auth modes emit a second one, so the workspace host is also accepted as a query
 * parameter baked into the configured base URL.
 */
export function credentialsFrom(headers: Headers | Record<string, unknown>, query: URLSearchParams): Credentials {
  const get = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    const value = (headers as Record<string, unknown>)[name];
    return typeof value === 'string' ? value : undefined;
  };
  return {
    authorization: get('authorization'),
    workspaceHost: get('x-databricks-host') ?? query.get('dbxHost') ?? undefined,
  };
}

function bearerOf(authorization: string | undefined | null): string {
  if (!authorization) throw new AuthError(401, 'Missing Authorization header');
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  // Older SDLB deployments send a bare token with no scheme; accept that rather
  // than failing a job over a missing word.
  const token = match ? match[1] : authorization.trim();
  if (!token) throw new AuthError(401, 'Empty bearer token');
  return token;
}

/**
 * Authenticate a caller. `scope` is required for MCP tokens, which are minted per
 * repo and environment; pass undefined for the endpoints that have no scope
 * (GET /tenants, GET /repo).
 */
export async function verifyBearer(
  credentials: Credentials,
  scope?: Scope,
): Promise<Principal> {
  if (settings().authMode === 'disabled') {
    return { email: 'anonymous@localhost', groups: [], via: 'anonymous' };
  }

  const token = bearerOf(credentials.authorization);

  if (isMcpToken(token)) {
    if (!scope) throw new AuthError(403, 'This endpoint cannot be used with an MCP token');
    const resolved = await resolveToken(scope, token);
    if (!resolved) throw new AuthError(401, 'Unknown or expired MCP token');
    return { email: resolved.email, groups: [], via: 'mcp-token' };
  }

  const identity = await verifyDatabricksToken(token, credentials.workspaceHost);
  return {
    email: identity.email,
    groups: identity.groups,
    via: 'databricks',
    workspaceHost: identity.workspaceHost,
  };
}

/**
 * Check that the workspace the caller proved access to is allowed to see this repo
 * and environment. A workspace with no row is allowed everything, so a deployment
 * that does not need per-workspace rules needs no rows at all; a row narrows it.
 */
export async function authorizeScope(principal: Principal, scope: Scope): Promise<void> {
  if (settings().authMode === 'disabled') return;
  if (principal.via === 'mcp-token') return; // the token itself is scoped
  if (!principal.workspaceHost) throw new AuthError(401, 'No workspace established for this caller');

  const entity = await getEntity<WorkspaceEntity>(
    TABLES.workspaces,
    keys.workspaces(),
    encodeWorkspaceRowKey(principal.workspaceHost),
  );
  if (!entity) return;

  if (entity.requiredGroup && !principal.groups.includes(entity.requiredGroup)) {
    throw new AuthError(403, `Access requires membership of the Databricks group "${entity.requiredGroup}"`);
  }
  assertAllowed(entity.repos, scope.repo, 'repository');
  assertAllowed(entity.envs, scope.env, 'environment');
}

function assertAllowed(allowlist: string | undefined, value: string, what: string): void {
  if (!allowlist) return;
  const allowed = allowlist.split(',').map((v) => v.trim()).filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(value)) {
    throw new AuthError(403, `This workspace may not access the ${what} "${value}"`);
  }
}

/** "https://adb-1.2.azuredatabricks.net" has a slash, which is illegal in a row key. */
export function encodeWorkspaceRowKey(host: string): string {
  return validateWorkspaceHost(host).replace(/^https:\/\//, '');
}

export { AuthError };
