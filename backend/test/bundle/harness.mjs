import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * Exercise a built bundle under plain Node, and report what happened as JSON.
 *
 * Deliberately a separate process rather than part of the vitest run: vitest
 * resolves modules through its own runner, so importing the bundle there tests
 * Vite's module graph rather than the artefact Azure executes. This runs the file
 * exactly as the Functions host would - real Node, real ESM, real chunk loading.
 *
 * `@azure/functions` is external in the bundle, so it is resolved here to a stub
 * that records what the entry point registers. That registration is the thing that
 * fails silently if bundling goes wrong: an app with no routes still starts.
 */

// The entry file to load: the bundle's http.js, or tsc's src/functions/http.js.
const entry = process.argv[2];
const registered = [];
globalThis.__registered = registered;

const stub = `
export const app = {
  http(name, options) { globalThis.__registered.push({ name, options }); },
};
`;
const stubUrl = `data:text/javascript,${encodeURIComponent(stub)}`;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@azure/functions') return { url: stubUrl, shortCircuit: true };
    return next(specifier, context);
  },
});

await import(pathToFileURL(path.resolve(entry)).href);

const context = { error: () => undefined, log: () => undefined };

function azureRequest({ method = 'GET', url, headers = {}, body }) {
  const buffer = body === undefined ? undefined : Buffer.from(body);
  return {
    method,
    url,
    headers: new Headers(headers),
    async arrayBuffer() {
      return buffer
        ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        : new ArrayBuffer(0);
    },
  };
}

const catchAll = registered.find((r) => r.name === 'catchAll');
const call = async (request) => {
  const response = await catchAll.options.handler(request, context);
  return { status: response.status, body: String(response.body ?? '') };
};

const result = {
  registered: registered.map((r) => ({
    name: r.name,
    route: r.options.route,
    methods: r.options.methods,
    authLevel: r.options.authLevel,
  })),
};

if (catchAll) {
  result.health = await call(azureRequest({ url: 'https://x.net/health' }));
  result.rest = await call(
    azureRequest({ url: 'https://x.net/api/v1/workflows?tenant=t&repo=bundle_test&env=dev' }),
  );
  result.validation = await call(
    azureRequest({ url: 'https://x.net/api/v1/workflows?tenant=t&repo=a%20b&env=dev' }),
  );
  result.mcp = await call(
    azureRequest({
      method: 'POST',
      url: 'https://x.net/mcp/bundle_test/dev',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    }),
  );
}

process.stdout.write(`\n__RESULT__${JSON.stringify(result)}__RESULT__\n`);
process.exit(0);
