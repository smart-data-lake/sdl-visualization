import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';
import type { FastifyInstance } from 'fastify';
import { buildFastify } from '../app.js';
import { fromFetchResponse, handleWithFastify, toFetchRequest } from '../azure/bridge.js';
import { isMcpPath } from '../mcp/path.js';

/**
 * The single HTTP entry point.
 *
 * A catch-all route, with `extensions.http.routePrefix` emptied in host.json so the
 * paths are the ones the contract names rather than being pushed under /api. A
 * wildcard does not match an empty segment, so the root is registered separately.
 *
 * /mcp/* goes straight to the MCP handler, everything else into Fastify.
 *
 * The MCP handler is imported lazily. Its SDK and zod cost roughly 200 ms to load,
 * and the cold start that matters is the one serving an SDLB upload, which has five
 * seconds before the uploader gives up and fails the job.
 */

let fastifyPromise: Promise<FastifyInstance> | undefined;

/** Built once per instance, so only the first request after a cold start pays for it. */
function fastify(): Promise<FastifyInstance> {
  if (!fastifyPromise) fastifyPromise = buildFastify();
  return fastifyPromise;
}

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const pathname = new URL(request.url).pathname;
  try {
    if (isMcpPath(pathname)) {
      const { handleMcpRequest } = await import('../mcp/handler.js');
      return await fromFetchResponse(await handleMcpRequest(await toFetchRequest(request)));
    }
    return await handleWithFastify(await fastify(), request);
  } catch (error) {
    context.error('unhandled error', error);
    return {
      status: 500,
      jsonBody: { detail: error instanceof Error ? error.message : 'Internal server error' },
    };
  }
}

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

app.http('catchAll', {
  route: '{*path}',
  methods: [...methods],
  authLevel: 'anonymous',
  handler,
});

app.http('root', {
  route: '',
  methods: [...methods],
  authLevel: 'anonymous',
  handler,
});
