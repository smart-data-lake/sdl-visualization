import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Scope } from '../store/keys.js';
import { authorizeScope, credentialsFrom, verifyBearer, type Principal } from '../auth/verifyBearer.js';

/**
 * Shared route plumbing: the parameter schemas the upstream contract defines, and
 * the two things every handler needs - who is calling, and which repo and
 * environment they are asking about.
 */

/**
 * The upstream OpenAPI constrains these to 50 characters matching ^[\w_\-]*$.
 * Reproducing the constraint exactly matters: it is what makes the values safe to
 * put straight into a table key and a blob path.
 */
const NAME = { type: 'string', maxLength: 50, pattern: '^[\\w_\\-]*$' } as const;
/** dataObjectId has the same character class upstream, but no length limit. */
const ID = { type: 'string', pattern: '^[\\w_\\-]*$' } as const;
/**
 * version is free-form apart from its length upstream, and SDLB's default is the
 * literal "latest". It becomes a blob path segment, so it may not be empty or carry a
 * path separator - narrower than the upstream contract, deliberately, and no narrower
 * than that.
 *
 * Control characters are left to assertPathSegment rather than added here: that is the
 * guard that actually holds, since a version also reaches blobPaths from places with no
 * route schema. This only moves the common refusal to the schema, where it is a 400
 * before a handler runs. String.raw because the escaping is otherwise easy to get
 * wrong, and a pattern ajv cannot compile takes down every route on the app.
 */
const VERSION = {
  type: 'string',
  minLength: 1,
  maxLength: 50,
  pattern: String.raw`^[^/\\]+$`,
} as const;

export const schemas = {
  /** tenant is required for compatibility and then ignored - this service is single tenant. */
  scope: {
    type: 'object',
    required: ['tenant', 'repo', 'env'],
    properties: { tenant: NAME, repo: NAME, env: NAME },
  },
  scopeWithApplication: {
    type: 'object',
    required: ['tenant', 'repo', 'env', 'application'],
    properties: { tenant: NAME, repo: NAME, env: NAME, application: NAME },
  },
  scopeWithAttempt: {
    type: 'object',
    required: ['tenant', 'repo', 'env', 'application', 'runId', 'attemptId'],
    properties: {
      tenant: NAME,
      repo: NAME,
      env: NAME,
      application: NAME,
      runId: { type: 'number' },
      attemptId: { type: 'number' },
    },
  },
  scopeWithVersion: {
    type: 'object',
    required: ['tenant', 'repo', 'env', 'version'],
    properties: { tenant: NAME, repo: NAME, env: NAME, version: VERSION },
  },
  scopeWithTstamp: {
    type: 'object',
    required: ['tenant', 'repo', 'env', 'tstamp'],
    properties: { tenant: NAME, repo: NAME, env: NAME, tstamp: { type: 'integer' } },
  },
  dataObjectParam: {
    type: 'object',
    required: ['dataObjectId'],
    properties: { dataObjectId: ID },
  },
  tenantOnly: { type: 'object', required: ['tenant'], properties: { tenant: NAME } },
  tenantAndRepo: {
    type: 'object',
    required: ['tenant', 'repo'],
    properties: { tenant: NAME, repo: NAME },
  },
} as const;

export interface ScopeQuery {
  tenant: string;
  repo: string;
  env: string;
}

export function scopeOf(query: ScopeQuery): Scope {
  return { repo: query.repo, env: query.env };
}

/**
 * Authenticate the caller and check they may see this scope.
 *
 * The workspace host may arrive as a header or as a query parameter: SDLB's HTTP
 * client can only set Authorization, because none of its auth modes emits a second
 * header, so the host has to be baked into the configured base URL instead.
 */
export async function authenticate(request: FastifyRequest, scope?: Scope): Promise<Principal> {
  const url = new URL(request.url, 'http://localhost');
  const credentials = credentialsFrom(
    request.headers as Record<string, unknown>,
    url.searchParams,
  );
  const principal = await verifyBearer(credentials, scope);
  if (scope) await authorizeScope(principal, scope);
  return principal;
}

/** Convenience for the common case: authenticate and hand back the scope. */
export async function scopedRequest(
  request: FastifyRequest,
): Promise<{ scope: Scope; principal: Principal }> {
  const scope = scopeOf(request.query as ScopeQuery);
  const principal = await authenticate(request, scope);
  return { scope, principal };
}

export function sendBinary(reply: FastifyReply, body: Buffer, contentType: string): void {
  reply.header('content-type', contentType).send(body);
}
