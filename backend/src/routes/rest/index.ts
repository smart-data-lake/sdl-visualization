import type { FastifyInstance } from 'fastify';
import { authenticate, schemas, scopeOf, scopedRequest, type ScopeQuery } from '../common.js';
import * as runs from '../../services/runs.js';
import * as config from '../../services/config.js';
import * as descriptions from '../../services/descriptions.js';
import * as schemaStats from '../../services/schemaStats.js';
import * as scopes from '../../services/scope.js';
import { listTokens, mintToken, revokeToken } from '../../auth/mcpTokens.js';
import { relayTokenRequest } from '../../auth/databricks.js';
import { notFound } from '../../errors.js';

/**
 * The read API the SPA consumes, reimplementing the contract in
 * spec/upstream-openapi.json. Paths, methods and parameter validation come from
 * that file; the response shapes come from src/types.ts of the frontend, because
 * the spec declares every response as an empty schema. The conformance suite is
 * what actually holds those shapes in place.
 *
 * Deliberately absent: /users and /license. A deployment serves one tenant whose
 * access is decided by its Databricks workspace, so there is no user directory to
 * manage and nothing to meter. GET /me replaces both.
 */

export async function registerRestRoutes(app: FastifyInstance): Promise<void> {
  /* ---------------------------------------------------------------- workspace */

  app.get('/tenants', async () => scopes.tenants());

  app.get<{ Querystring: { tenant: string } }>(
    '/repo',
    { schema: { querystring: schemas.tenantOnly } },
    async (request) => {
      await authenticate(request);
      return scopes.repos();
    },
  );

  app.get<{ Querystring: { tenant: string; repo: string } }>(
    '/envs',
    { schema: { querystring: schemas.tenantAndRepo } },
    async (request) => {
      await authenticate(request);
      return scopes.envs(request.query.repo);
    },
  );

  /** Who the caller is. Replaces /users and /license for a single-tenant deployment. */
  app.get('/me', async (request) => {
    const principal = await authenticate(request);
    return {
      email: principal.email,
      groups: principal.groups,
      via: principal.via,
      workspaceHost: principal.workspaceHost,
    };
  });

  /* ----------------------------------------------------------------- workflows */

  app.get<{ Querystring: ScopeQuery }>(
    '/workflows',
    { schema: { querystring: schemas.scope } },
    async (request) => {
      const { scope } = await scopedRequest(request);
      return runs.getWorkflows(scope);
    },
  );

  app.get<{ Querystring: ScopeQuery & { application: string } }>(
    '/workflow',
    { schema: { querystring: schemas.scopeWithApplication } },
    async (request) => {
      const { scope } = await scopedRequest(request);
      return runs.getWorkflowRuns(scope, request.query.application);
    },
  );

  app.get<{ Querystring: ScopeQuery & { application: string; runId: number; attemptId: number } }>(
    '/state',
    { schema: { querystring: schemas.scopeWithAttempt } },
    async (request) => {
      const { scope } = await scopedRequest(request);
      const { application, runId, attemptId } = request.query;
      return runs.getRun(scope, application, runId, attemptId);
    },
  );

  /**
   * The two lookups fetchAPI_rest leaves unimplemented, which is why the config
   * explorer's "Last 5 runs" panel is empty against a REST backend today.
   */
  for (const [path, kind] of [
    ['/runs/byAction', 'action'],
    ['/runs/byDataObject', 'dataObject'],
  ] as const) {
    app.get<{ Querystring: ScopeQuery & { name: string; limit?: number } }>(
      path,
      {
        schema: {
          querystring: {
            type: 'object',
            required: ['tenant', 'repo', 'env', 'name'],
            properties: {
              ...schemas.scope.properties,
              name: { type: 'string' },
              limit: { type: 'integer', minimum: 1, maximum: 200 },
            },
          },
        },
      },
      async (request) => {
        const { scope } = await scopedRequest(request);
        return runs.getRunsByElement(scope, kind, request.query.name, request.query.limit ?? 20);
      },
    );
  }

  /* -------------------------------------------------------------------- config */

  app.get<{ Querystring: ScopeQuery & { version: string } }>(
    '/config',
    { schema: { querystring: schemas.scopeWithVersion } },
    async (request) => {
      const { scope } = await scopedRequest(request);
      // The SPA reads parsedJson.config, so the configuration is wrapped.
      return { config: await config.getConfig(scope, request.query.version) };
    },
  );

  app.get<{ Querystring: ScopeQuery }>(
    '/versions',
    { schema: { querystring: schemas.scope } },
    async (request) => {
      const { scope } = await scopedRequest(request);
      return config.configVersions(scope);
    },
  );

  /* -------------------------------------------------------- schema and statistics */

  for (const subtype of ['schema', 'stats'] as const) {
    app.get<{ Params: { dataObjectId: string }; Querystring: ScopeQuery }>(
      `/dataobject/${subtype}/:dataObjectId/tstamps`,
      { schema: { params: schemas.dataObjectParam, querystring: schemas.scope } },
      async (request) => {
        const { scope } = await scopedRequest(request);
        return schemaStats.tstamps(scope, subtype, request.params.dataObjectId);
      },
    );

    app.get<{ Params: { dataObjectId: string }; Querystring: ScopeQuery & { tstamp: number } }>(
      `/dataobject/${subtype}/:dataObjectId`,
      { schema: { params: schemas.dataObjectParam, querystring: schemas.scopeWithTstamp } },
      async (request) => {
        const { scope } = await scopedRequest(request);
        const { dataObjectId } = request.params;
        const { tstamp } = request.query;
        return subtype === 'schema'
          ? schemaStats.getSchema(scope, dataObjectId, tstamp)
          : schemaStats.getStats(scope, dataObjectId, tstamp);
      },
    );
  }

  /* -------------------------------------------------------------- descriptions */

  // Registered before the wildcard below, or "list" is read as a filename.
  app.get<{ Querystring: ScopeQuery & { version: string } }>(
    '/descriptions/list',
    { schema: { querystring: schemas.scopeWithVersion } },
    async (request) => {
      const { scope } = await scopedRequest(request);
      return descriptions.listDescriptions(scope, request.query.version);
    },
  );

  /**
   * A wildcard, because the filename is itself a path: the SPA asks for
   * "descriptions/dataObjects/int-airports.md" and, for images embedded in that
   * markdown, "descriptions/images/train.png".
   *
   * Markdown comes back as JSON with a `content` field and everything else as raw
   * bytes, because that is how the SPA reads them - .json() for the description,
   * .blob() for the images it then turns into blob: URLs.
   */
  app.get<{ Params: { '*': string }; Querystring: ScopeQuery & { version: string } }>(
    '/descriptions/*',
    { schema: { querystring: schemas.scopeWithVersion } },
    async (request, reply) => {
      const { scope } = await scopedRequest(request);
      const filename = request.params['*'];
      const file = await descriptions.getDescription(scope, request.query.version, filename);
      if (!file) throw notFound(`description "${filename}"`);

      if (descriptions.isMarkdown(filename)) {
        return { content: file.body.toString('utf8') };
      }
      reply.header('content-type', file.contentType);
      return reply.send(file.body);
    },
  );

  /* ------------------------------------------------------------- OAuth exchange */

  /*
    The browser's half of the Databricks OAuth flow, finished here because it cannot
    be finished there: the workspace token endpoint sends no CORS headers, so the SPA
    can send the request but never read the answer. See relayTokenRequest.

    Unauthenticated by necessity - this is where the credential comes from - and the
    workspace host is checked against the allowlist before anything is sent.
  */

  const oauthCommon = {
    workspaceHost: { type: 'string', maxLength: 200 },
    clientId: { type: 'string', maxLength: 100 },
  };

  app.post<{
    Body: { workspaceHost: string; clientId: string; code: string; codeVerifier: string; redirectUri: string };
  }>(
    '/auth/token',
    {
      schema: {
        body: {
          type: 'object',
          required: ['workspaceHost', 'clientId', 'code', 'codeVerifier', 'redirectUri'],
          properties: {
            ...oauthCommon,
            code: { type: 'string', maxLength: 4096 },
            codeVerifier: { type: 'string', minLength: 43, maxLength: 128 },
            redirectUri: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const { status, body } = await relayTokenRequest(request.body.workspaceHost, {
        grant_type: 'authorization_code',
        client_id: request.body.clientId,
        code: request.body.code,
        code_verifier: request.body.codeVerifier,
        redirect_uri: request.body.redirectUri,
      });
      reply.code(status);
      return body;
    },
  );

  app.post<{ Body: { workspaceHost: string; clientId: string; refreshToken: string } }>(
    '/auth/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['workspaceHost', 'clientId', 'refreshToken'],
          properties: { ...oauthCommon, refreshToken: { type: 'string', maxLength: 4096 } },
        },
      },
    },
    async (request, reply) => {
      const { status, body } = await relayTokenRequest(request.body.workspaceHost, {
        grant_type: 'refresh_token',
        client_id: request.body.clientId,
        refresh_token: request.body.refreshToken,
      });
      reply.code(status);
      return body;
    },
  );

  /* ---------------------------------------------------------------- MCP tokens */

  app.post<{ Querystring: ScopeQuery; Body: { label?: string; ttlDays?: number } }>(
    '/mcp-tokens',
    {
      schema: {
        querystring: schemas.scope,
        body: {
          type: 'object',
          properties: {
            label: { type: 'string', maxLength: 100 },
            ttlDays: { type: 'integer', minimum: 1, maximum: 3650 },
          },
        },
      },
    },
    async (request, reply) => {
      const { scope, principal } = await scopedRequest(request);
      const { token, info } = await mintToken(
        scope,
        principal.email,
        request.body?.label ?? 'MCP client',
        request.body?.ttlDays,
      );
      // The only time the token itself is ever returned.
      reply.code(201);
      return { ...info, token };
    },
  );

  app.get<{ Querystring: ScopeQuery }>(
    '/mcp-tokens',
    { schema: { querystring: schemas.scope } },
    async (request) => {
      const { scope, principal } = await scopedRequest(request);
      return listTokens(scope, principal.email);
    },
  );

  app.delete<{ Querystring: ScopeQuery & { id: string } }>(
    '/mcp-tokens',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['tenant', 'repo', 'env', 'id'],
          properties: { ...schemas.scope.properties, id: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const { scope } = await scopedRequest(request);
      await revokeToken(scope, request.query.id);
      reply.code(204);
    },
  );
}

export { scopeOf };
