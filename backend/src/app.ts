import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { AuthError } from './auth/verifyBearer.js';
import { HttpError } from './errors.js';
import { registerRestRoutes } from './routes/rest/index.js';
import { registerUploadRoutes } from './routes/upload/index.js';

/**
 * The Fastify application: the SPA's REST API and SDLB's upload API.
 *
 * The MCP endpoint is deliberately not here - it is served straight from the
 * Function, because the MCP SDK's handler is already fetch-shaped and routing it
 * through inject() would mean converting a Request into an injection and back again.
 *
 * Built once at module scope by the Function, so a cold start pays for it once.
 */

export async function buildFastify(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.SDLB_LOG_LEVEL ?? 'info' },
    trustProxy: true,
    // Azure caps a request body at ~100 MB; refuse earlier rather than buffering it.
    bodyLimit: 64 * 1024 * 1024,
    routerOptions: { ignoreTrailingSlash: true },
  });

  await app.register(cors, {
    origin: true,
    credentials: false,
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Databricks-Host'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  });

  await app.register(multipart, { limits: { fileSize: 32 * 1024 * 1024 } });

  // Descriptions arrive either as multipart (SDLB's BackendClient) or as a raw body
  // (SDLB's plain-HTTP export writer, and anything scripted by hand), in whatever
  // content type the file happens to have - markdown, PNG, SVG. Everything JSON and
  // multipart is already handled above, so the fallback simply keeps the bytes.
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ detail: `No route for ${request.method} ${request.url}` });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(registerRestRoutes, { prefix: '/api/v1' });
  await app.register(registerUploadRoutes, { prefix: '/api/v1' });

  await app.ready();
  return app;
}

/**
 * One error shape for everything.
 *
 * The SPA builds its message from `json.message || json.detail`
 * (fetchAPI_rest.fetch), so an error body without one of those keys shows the user
 * "undefined (500)". Parameter validation keeps FastAPI's 422 + HTTPValidationError
 * shape, because that is what the contract this service reimplements returns and
 * what any existing client already copes with.
 */
function errorHandler(error: any, request: FastifyRequest, reply: FastifyReply): void {
  if (error.validation) {
    reply.code(422).send({
      detail: error.validation.map((issue: any) => ({
        loc: [error.validationContext ?? 'query', ...String(issue.instancePath ?? '').split('/').filter(Boolean)],
        msg: issue.message ?? 'invalid value',
        type: issue.keyword ?? 'value_error',
      })),
    });
    return;
  }

  if (error instanceof AuthError) {
    reply.code(error.status).send({ detail: error.message });
    return;
  }

  if (error instanceof HttpError) {
    reply.code(error.status).send({ detail: error.message });
    return;
  }

  const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
  if (status >= 500) request.log.error({ err: error }, 'unhandled error');
  reply.code(status).send({ detail: error.message ?? 'Internal server error' });
}
