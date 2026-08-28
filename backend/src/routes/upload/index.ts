import type { FastifyInstance } from 'fastify';
import { schemas, scopedRequest, type ScopeQuery } from '../common.js';
import * as runs from '../../services/runs.js';
import * as config from '../../services/config.js';
import * as descriptions from '../../services/descriptions.js';
import * as schemaStats from '../../services/schemaStats.js';
import { badRequest } from '../../errors.js';

/**
 * The upload API SDLB's `global.uiBackend` pushes to.
 *
 * This is a fixed contract, not a design: the method of each operation is what
 * SDLB's BackendClient sends, and getting one wrong fails silently in the sense
 * that the job keeps running while nothing arrives. In particular config, schema
 * and statistics are PUT, not POST - only the initial state is POST, and an action
 * update is PATCH.
 *
 * A non-2xx on the state insert fails the SDLB job unless the user configured
 * `stagePath`, so these handlers stay as forgiving as correctness allows.
 */

export async function registerUploadRoutes(app: FastifyInstance): Promise<void> {
  /* --------------------------------------------------------------------- state */

  app.post<{ Querystring: ScopeQuery; Body: unknown }>(
    '/state',
    { schema: { querystring: schemas.scope } },
    async (request) => {
      const { scope } = await scopedRequest(request);
      return runs.putState(scope, request.body);
    },
  );

  app.patch<{
    Querystring: ScopeQuery & {
      application: string;
      runId: number;
      attemptId: number;
      actionId: string;
    };
    Body: unknown;
  }>(
    '/state',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['tenant', 'repo', 'env', 'application', 'runId', 'attemptId', 'actionId'],
          properties: {
            ...schemas.scopeWithAttempt.properties,
            actionId: { type: 'string', maxLength: 50, pattern: '^[\\w_\\-]*$' },
          },
        },
      },
    },
    async (request, reply) => {
      const { scope } = await scopedRequest(request);
      const { application, runId, attemptId, actionId } = request.query;
      await runs.patchState(scope, application, runId, attemptId, actionId, request.body);
      reply.code(200);
      return {};
    },
  );

  /* -------------------------------------------------------------------- config */

  app.put<{ Querystring: ScopeQuery & { version: string }; Body: any }>(
    '/config',
    { schema: { querystring: schemas.scopeWithVersion } },
    async (request) => {
      const { scope } = await scopedRequest(request);
      const body = request.body as Record<string, unknown> | null;
      if (!body || typeof body !== 'object') throw badRequest('config body must be a JSON object');
      // Accept both the bare configuration and one wrapped the way GET returns it.
      const wrapped = body.config;
      const configJson = wrapped && typeof wrapped === 'object' ? wrapped : body;
      await config.putConfig(scope, request.query.version, configJson);
      return {};
    },
  );

  /* -------------------------------------------------------- schema and statistics */

  for (const subtype of ['schema', 'stats'] as const) {
    app.put<{
      Params: { dataObjectId: string };
      Querystring: ScopeQuery & { tstamp: number };
      Body: unknown;
    }>(
      `/dataobject/${subtype}/:dataObjectId`,
      { schema: { params: schemas.dataObjectParam, querystring: schemas.scopeWithTstamp } },
      async (request) => {
        const { scope } = await scopedRequest(request);
        await schemaStats.putSchemaOrStats(
          scope,
          subtype,
          request.params.dataObjectId,
          request.query.tstamp,
          request.body,
        );
        return {};
      },
    );
  }

  /* -------------------------------------------------------------- descriptions */

  /**
   * multipart/form-data with a part named `file`, which is what SDLB's
   * BackendClient sends. A raw body is accepted too, for the plain-HTTP export
   * writer and for anything scripted by hand.
   */
  app.post<{ Params: { '*': string }; Querystring: ScopeQuery & { version: string } }>(
    '/descriptions/*',
    { schema: { querystring: schemas.scopeWithVersion } },
    async (request) => {
      const { scope } = await scopedRequest(request);
      const filename = request.params['*'];

      let body: Buffer;
      if (request.isMultipart()) {
        const file = await request.file();
        if (!file) throw badRequest('multipart upload without a file part');
        body = await file.toBuffer();
      } else if (Buffer.isBuffer(request.body)) {
        body = request.body;
      } else if (typeof request.body === 'string') {
        body = Buffer.from(request.body, 'utf8');
      } else {
        throw badRequest('description upload must be multipart/form-data or a raw body');
      }

      await descriptions.putDescription(scope, request.query.version, filename, body);
      return {};
    },
  );

  app.delete<{ Params: { '*': string }; Querystring: ScopeQuery & { version: string } }>(
    '/descriptions/*',
    { schema: { querystring: schemas.scopeWithVersion } },
    async (request) => {
      const { scope } = await scopedRequest(request);
      const deleted = await descriptions.deleteDescription(
        scope,
        request.query.version,
        request.params['*'],
      );
      return { deleted };
    },
  );
}
