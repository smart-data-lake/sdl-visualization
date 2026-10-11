import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchAPI_rest } from '../src/api/fetchAPI_rest';

// a response without a body, e.g. DELETE's 204, must not be parsed as JSON
const api = new fetchAPI_rest('http://backend/api/v1', undefined, undefined);
const respond = (status: number, body: string, statusText = '') =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(status === 204 ? null : body, { status, statusText })));

afterEach(() => vi.unstubAllGlobals());

describe('fetchAPI_rest.fetch', () => {
  test('a 204 resolves to undefined', async () => {
    respond(204, '');
    await expect((api as any).fetch('http://backend/x', Promise.resolve({}))).resolves.toBeUndefined();
  });

  test('a JSON body is parsed', async () => {
    respond(200, '{"a":1}');
    await expect((api as any).fetch('http://backend/x', Promise.resolve({}))).resolves.toEqual({ a: 1 });
  });

  test('an error carries the backend message and the status', async () => {
    respond(403, '{"detail":"Only an admin can delete workflow runs"}');
    await expect((api as any).fetch('http://backend/x', Promise.resolve({}))).rejects.toThrow('Only an admin can delete workflow runs (403)');
  });

  test('an error without a JSON body still names the status', async () => {
    respond(502, '<html>Bad Gateway</html>', 'Bad Gateway');
    await expect((api as any).fetch('http://backend/x', Promise.resolve({}))).rejects.toThrow('Bad Gateway (502)');
  });
});
