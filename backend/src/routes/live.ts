import type { FastifyInstance } from 'fastify';
import { schemas, scopedRequest, type ScopeQuery } from './common.js';
import { registerLive } from '../notify/index.js';
import { settings } from '../config.js';
import { notFound } from '../errors.js';

/** Registering a UI for a workflow's live updates, and the event stream of the sse driver. */
export async function registerLiveRoutes(app: FastifyInstance): Promise<void> {
  // A POST, as it writes the registration; `url` is null where this deployment has no live updates.
  app.post<{ Querystring: ScopeQuery & { application: string } }>(
    '/live/register',
    { schema: { querystring: schemas.scopeWithApplication } },
    async (request) => {
      const { scope } = await scopedRequest(request);
      return registerLive(scope, request.query.application, `${request.protocol}://${request.host}`);
    },
  );

  app.get<{ Querystring: { group: string; token: string } }>(
    '/live/events',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['group', 'token'],
          properties: { group: { type: 'string', maxLength: 200 }, token: { type: 'string', maxLength: 200 } },
        },
      },
    },
    async (request, reply) => {
      if (settings().liveUpdates.kind !== 'sse') throw notFound('live update events');
      const { attachListener } = await import('../notify/drivers/sse.js');
      reply.hijack();
      attachListener(request.query.group, request.query.token, reply.raw);
    },
  );
}
