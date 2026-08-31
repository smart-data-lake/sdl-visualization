import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildFastify } from '../../src/app.js';
import { useTempStore } from '../setup/store.js';
import { clientIpOf, fromFetchResponse, handleWithFastify, toFetchRequest } from '../../src/azure/bridge.js';

/**
 * The Azure Functions to Fastify bridge.
 *
 * There is no maintained adapter for this pair, so the bridge is ours, and the
 * details it gets wrong are the ones that fail quietly: an absolute URL that has to
 * be split, a body that can only be read once, a response that must be taken as
 * bytes rather than text or every description image is corrupted, and a client
 * address Azure only supplies behind a header, with a port attached.
 *
 * The Functions runtime is not available here, so the request is a stand-in with
 * the same shape - which is the part the bridge actually depends on.
 */

/** An Azure Functions v4 HttpRequest, as far as the bridge is concerned. */
function azureRequest(options: {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  body?: Buffer | string;
}): any {
  const body = options.body === undefined ? undefined : Buffer.from(options.body as never);
  let consumed = false;
  return {
    method: options.method ?? 'GET',
    url: options.url,
    headers: new Headers(options.headers ?? {}),
    async arrayBuffer() {
      // v4 really does allow this only once; the bridge must not read twice.
      if (consumed) throw new Error('body already read');
      consumed = true;
      return body ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) : new ArrayBuffer(0);
    },
  };
}

let app: FastifyInstance;

let store: Awaited<ReturnType<typeof useTempStore>>;

beforeAll(async () => {
  store = await useTempStore();
  app = await buildFastify();
});

afterAll(async () => {
  await app?.close();
  await store?.cleanup();
});

describe('the client address', () => {
  test('Azure attaches a port to the forwarded IPv4 address', () => {
    expect(clientIpOf(new Headers({ 'x-forwarded-for': '203.0.113.7:51234' }))).toBe('203.0.113.7');
  });

  test('a bare address is left alone', () => {
    expect(clientIpOf(new Headers({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  test('the first hop of a chain is the client', () => {
    expect(clientIpOf(new Headers({ 'x-forwarded-for': '203.0.113.7:1, 198.51.100.9' }))).toBe(
      '203.0.113.7',
    );
  });

  test('a bracketed IPv6 address keeps its colons', () => {
    expect(clientIpOf(new Headers({ 'x-forwarded-for': '[2001:db8::1]:443' }))).toBe('2001:db8::1');
    expect(clientIpOf(new Headers({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1');
  });

  test('locally, where Azure adds no header, there is simply no address', () => {
    expect(clientIpOf(new Headers())).toBeUndefined();
  });
});

describe('routing a request into Fastify', () => {
  test('an absolute URL is split into path and query', async () => {
    const response = await handleWithFastify(
      app,
      azureRequest({ url: 'https://example.azurewebsites.net/api/v1/tenants?tenant=x' }),
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(String(response.body))).toEqual(['PrivateTenant']);
  });

  test('a JSON body survives the crossing', async () => {
    const response = await handleWithFastify(
      app,
      azureRequest({
        method: 'POST',
        url: 'https://example.azurewebsites.net/api/v1/state?tenant=t&repo=bridge_test&env=dev',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nothing: true }),
      }),
    );
    // No applicationName, so the upload is refused - but it was parsed and routed.
    expect(response.status).toBe(400);
    expect(JSON.parse(String(response.body)).detail).toContain('applicationName');
  });

  test('the response comes back as bytes, so binary is not mangled', async () => {
    const response = await handleWithFastify(
      app,
      azureRequest({ url: 'https://example.azurewebsites.net/health' }),
    );
    expect(Buffer.isBuffer(response.body)).toBe(true);
  });

  test('a HEAD request answers without a body', async () => {
    const response = await handleWithFastify(
      app,
      azureRequest({ method: 'HEAD', url: 'https://example.azurewebsites.net/health' }),
    );
    expect(response.status).toBe(200);
    expect(response.body).toBeUndefined();
  });

  test('an unknown path is a 404 in the shape the SPA can read', async () => {
    const response = await handleWithFastify(
      app,
      azureRequest({ url: 'https://example.azurewebsites.net/api/v1/nope' }),
    );
    expect(response.status).toBe(404);
    expect(JSON.parse(String(response.body)).detail).toBeTruthy();
  });
});

describe('routing a request into the MCP handler', () => {
  test('the fetch-standard Request carries method, headers and body', async () => {
    const request = await toFetchRequest(
      azureRequest({
        method: 'POST',
        url: 'https://example.azurewebsites.net/mcp/r/e',
        headers: { authorization: 'Bearer x' },
        body: '{"jsonrpc":"2.0"}',
      }),
    );
    expect(request.method).toBe('POST');
    expect(request.headers.get('authorization')).toBe('Bearer x');
    expect(await request.text()).toBe('{"jsonrpc":"2.0"}');
  });

  test('a GET is not given a body, which fetch would refuse', async () => {
    const request = await toFetchRequest(
      azureRequest({ url: 'https://example.azurewebsites.net/mcp/r/e' }),
    );
    expect(request.body).toBeNull();
  });

  test('the response converts back with its status and headers', async () => {
    const converted = await fromFetchResponse(
      new Response('{"ok":true}', { status: 202, headers: { 'content-type': 'application/json' } }),
    );
    expect(converted.status).toBe(202);
    // HttpResponseInit types headers as a union; the bridge always builds a record.
    expect((converted.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(String(converted.body)).toBe('{"ok":true}');
  });
});
