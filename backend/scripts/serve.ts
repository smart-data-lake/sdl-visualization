import { createServer } from 'node:http';
import { buildFastify } from '../src/app.js';
import { isMcpPath } from '../src/mcp/path.js';
import { seedFixtures } from './seed-fixtures.js';

/**
 * Run the service as a plain HTTP server, without the Azure Functions host.
 *
 * The Functions runtime needs Core Tools installed, which is a lot to ask of a test
 * run and of a first look at the project. This puts the same two handlers behind a
 * Node server instead - Fastify for everything, the MCP handler for /mcp/* - so the
 * dispatch mirrors functions/http.ts exactly. What it does not exercise is the
 * bridge in azure/bridge.ts; that has its own tests.
 *
 *   SDLB_PORT             port to listen on (default 7071, the Functions default)
 *   SDLB_START_AZURITE=1  start a throwaway Azurite first
 *   SDLB_SEED_FIXTURES=1  push tests/e2e/fixtures through the upload API on boot
 */

const port = Number(process.env.SDLB_PORT ?? 7071);

if (process.env.SDLB_START_AZURITE === '1') {
  const { setup, TEST_CONNECTION_STRING } = await import('../test/setup/azurite.js');
  await setup();
  process.env.SDLB_STORAGE_CONNECTION_STRING = TEST_CONNECTION_STRING;
} else {
  process.env.SDLB_STORAGE_CONNECTION_STRING ??= 'UseDevelopmentStorage=true';
}
process.env.SDLB_AUTH_MODE ??= 'disabled';

const app = await buildFastify();

if (process.env.SDLB_SEED_FIXTURES === '1') {
  await seedFixtures(app);
  console.log('seeded the getting-started fixtures');
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (isMcpPath(url.pathname)) {
    void handleMcp(request, response, url);
    return;
  }
  app.routing(request, response);
});

async function handleMcp(request: any, response: any, url: URL): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);

  const { handleMcpRequest } = await import('../src/mcp/handler.js');
  const mcpResponse = await handleMcpRequest(
    new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: body.length > 0 ? body : undefined,
    }),
  );

  response.writeHead(mcpResponse.status, Object.fromEntries(mcpResponse.headers.entries()));
  response.end(Buffer.from(await mcpResponse.arrayBuffer()));
}

server.listen(port, () => {
  console.log(`SDLB backend listening on http://localhost:${port}`);
  console.log(`  REST  http://localhost:${port}/api/v1`);
  console.log(`  MCP   http://localhost:${port}/mcp/{repo}/{env}`);
});
