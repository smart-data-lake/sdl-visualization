import { McpServer, createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { credentialsFrom, verifyBearer, authorizeScope, AuthError } from '../auth/verifyBearer.js';
import type { Scope } from '../store/types.js';
import * as scopes from '../services/scope.js';
import { isMcpPath, scopeFromPath } from './path.js';
import { registerDiscoveryTools } from './tools/discovery.js';
import { registerRunTools } from './tools/runs.js';
import { json } from './format.js';

/**
 * The MCP endpoint.
 *
 * Served straight from the Function rather than through Fastify: the SDK's handler
 * is already `(Request) => Promise<Response>`, and Azure Functions v4 requests are
 * fetch-shaped, so routing it through Fastify's inject() would mean converting a
 * Request into an injection and back for no gain.
 *
 * `responseMode: 'json'` means one JSON body per request and no server-initiated
 * streaming. That is the right trade here: Azure's load balancer cuts a response
 * off at 230 seconds, so a long-lived stream is not something to build on, and
 * nothing these tools do needs progress notifications. Sampling and elicitation
 * still work - they are answered by an input-required result the client retries.
 *
 * Scope lives in the URL, /mcp/{repo}/{env}, so an agent never repeats it.
 */

export { isMcpPath, scopeFromPath };

let handler: McpHttpHandler | undefined;

function mcpHandler(): McpHttpHandler {
  if (!handler) {
    handler = createMcpHandler(
      (ctx) => {
        const scope = ctx.requestInfo
          ? scopeFromPath(new URL(ctx.requestInfo.url).pathname)
          : undefined;
        return buildServer(scope);
      },
      {
        responseMode: 'json',
        onerror: (error) => console.error('[mcp]', error),
      },
    );
  }
  return handler;
}

function buildServer(scope: Scope | undefined): McpServer {
  const server = new McpServer({
    name: 'sdlb',
    version: '0.1.0',
    title: 'Smart Data Lake Builder',
  });

  server.registerTool(
    'list_scopes',
    {
      title: 'List the repositories and environments available',
      description:
        'Which repository and environment combinations this deployment serves. The scope of a ' +
        'connection is fixed by its URL, /mcp/{repo}/{env}; point the client at a different ' +
        'one to work on it.',
      inputSchema: z.object({}),
    },
    async () => {
      const repos = await scopes.repos();
      const listed = await Promise.all(
        repos.map(async (repo) => ({ repo, envs: await scopes.envs(repo) })),
      );
      return json({ current: scope, available: listed });
    },
  );

  if (scope) {
    registerDiscoveryTools(server, scope);
    registerRunTools(server, scope);
  }

  return server;
}

/**
 * Authenticate, then hand the request to the SDK.
 *
 * Authentication happens here rather than inside a tool so that a bad token is one
 * HTTP 401 with a WWW-Authenticate header, which is what a client knows how to act
 * on, instead of a JSON-RPC error buried in a 200.
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (!isMcpPath(url.pathname)) {
    return jsonResponse(404, { detail: 'Not an MCP endpoint' });
  }

  const scope = scopeFromPath(url.pathname);
  try {
    const credentials = credentialsFrom(request.headers, url.searchParams);
    const principal = await verifyBearer(credentials, scope);
    if (scope) await authorizeScope(principal, scope);

    return await mcpHandler().fetch(request, {
      authInfo: {
        token: '',
        clientId: principal.email,
        scopes: [],
        extra: { email: principal.email, via: principal.via, repo: scope?.repo, env: scope?.env },
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (error.status === 401) {
        headers['www-authenticate'] = 'Bearer realm="sdlb", error="invalid_token"';
      }
      return new Response(JSON.stringify({ detail: error.message }), {
        status: error.status,
        headers,
      });
    }
    throw error;
  }
}

/** Frees the handler's resources. Only the tests need it; Functions never shuts down cleanly. */
export async function closeMcpHandler(): Promise<void> {
  await handler?.close();
  handler = undefined;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
