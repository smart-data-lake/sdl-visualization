import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import type { LiveDriver } from '../index.js';

/**
 * Server-sent events from this process: for the local Node backend and the e2e suite only,
 * since a Function would be billed for every open stream. EventSource cannot send a header,
 * so the URL carries a token signed with a per-process secret.
 */

const secret = randomBytes(32);
const listeners = new Map<string, Set<ServerResponse>>();
const HEARTBEAT_MS = 25_000;

const sign = (group: string, expires: number) =>
  createHmac('sha256', secret).update(`${group}|${expires}`).digest('base64url');

function verify(group: string, token: string): boolean {
  const [expiresText, signature] = token.split('.');
  const expires = Number(expiresText);
  if (!signature || !(expires > Date.now())) return false;
  const expected = Buffer.from(sign(group, expires));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Hold the response open as an event stream, or answer 401. Handles its own CORS: the reply is hijacked. */
export function attachListener(group: string, token: string, response: ServerResponse): void {
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (!verify(group, token)) {
    response.writeHead(401, { ...cors, 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ detail: 'invalid or expired live update token' }));
    return;
  }
  response.writeHead(200, {
    ...cors,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  response.write(': connected\n\n');

  let set = listeners.get(group);
  if (!set) listeners.set(group, (set = new Set()));
  set.add(response);
  const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), HEARTBEAT_MS);
  response.on('close', () => {
    clearInterval(heartbeat);
    set!.delete(response);
    if (set!.size === 0) listeners.delete(group);
  });
}

export const sseDriver: LiveDriver = {
  async clientUrl(group, minutes, apiOrigin) {
    const expires = Date.now() + minutes * 60_000;
    const query = new URLSearchParams({ group, token: `${expires}.${sign(group, expires)}` });
    return `${apiOrigin}/api/v1/live/events?${query}`;
  },
  async publish(group, message) {
    const data = `data: ${JSON.stringify(message)}\n\n`;
    for (const response of listeners.get(group) ?? []) response.write(data);
  },
};
