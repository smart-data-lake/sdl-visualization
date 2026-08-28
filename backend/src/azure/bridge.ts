import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import type { FastifyInstance } from 'fastify';

/**
 * Bridge between the Azure Functions v4 HTTP model and Fastify.
 *
 * There is no maintained Azure adapter for Fastify, so this does what
 * @fastify/aws-lambda does: hand the request to `app.inject()`, which runs the
 * whole Fastify lifecycle without a socket. Five details are load-bearing:
 *
 *  - v4's `request.url` is absolute, so it has to be split into path and query.
 *  - the body can be read only once, and `rawBody` does not exist in v4.
 *  - the response has to be read from `rawPayload` (a Buffer), not `body`, or
 *    binary responses - description images - are corrupted.
 *  - light-my-request defaults `remoteAddress` to 127.0.0.1, so `request.ip` is
 *    wrong unless it is passed in. Azure only adds X-Forwarded-For when deployed,
 *    and includes a port in it.
 *  - HEAD must not carry a body.
 */

/** Azure's X-Forwarded-For carries "ip:port"; Fastify wants just the address. */
export function clientIpOf(headers: Headers): string | undefined {
  const forwarded = headers.get('x-forwarded-for');
  if (!forwarded) return undefined;
  const first = forwarded.split(',')[0].trim();
  if (!first) return undefined;
  // IPv6 addresses are bracketed when a port is attached: [::1]:1234
  const bracketed = /^\[(.+)\](?::\d+)?$/.exec(first);
  if (bracketed) return bracketed[1];
  // IPv4 with a port, but leave a bare IPv6 address alone
  const colons = first.split(':');
  return colons.length === 2 ? colons[0] : first;
}

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD', 'DELETE', 'OPTIONS']);

export async function handleWithFastify(
  app: FastifyInstance,
  request: HttpRequest,
): Promise<HttpResponseInit> {
  const url = new URL(request.url);

  let payload: Buffer | undefined;
  if (!METHODS_WITHOUT_BODY.has(request.method.toUpperCase())) {
    const buffer = Buffer.from(await request.arrayBuffer());
    if (buffer.length > 0) payload = buffer;
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const response = await app.inject({
    method: request.method as any,
    url: url.pathname + url.search,
    headers,
    payload,
    remoteAddress: clientIpOf(request.headers),
  });

  const responseHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(response.headers)) {
    if (value === undefined) continue;
    responseHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }

  return {
    status: response.statusCode,
    headers: responseHeaders,
    body: request.method.toUpperCase() === 'HEAD' ? undefined : response.rawPayload,
  };
}

/**
 * Turn an Azure HttpRequest into a web-standard Request, for the MCP handler,
 * whose whole interface is fetch-shaped. Reads the body once, like the above.
 */
export async function toFetchRequest(request: HttpRequest): Promise<Request> {
  const hasBody = !METHODS_WITHOUT_BODY.has(request.method.toUpperCase());
  const body = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: body && body.length > 0 ? body : undefined,
  });
}

/** Turn a web-standard Response back into what an Azure Function returns. */
export async function fromFetchResponse(response: Response): Promise<HttpResponseInit> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return {
    status: response.status,
    headers,
    body: response.body === null ? undefined : Buffer.from(await response.arrayBuffer()),
  };
}
