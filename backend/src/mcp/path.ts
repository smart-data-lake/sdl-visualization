import type { Scope } from '../store/types.js';

/**
 * Deciding whether a request is for the MCP endpoint, without loading the MCP SDK.
 *
 * Kept apart from handler.ts on purpose: the SDK and zod cost about 200 ms to
 * import, and a cold start serving an SDLB upload should not pay for them. The
 * Function imports this module eagerly and the handler only once a request is
 * actually for /mcp.
 */

const SCOPE_PATH = /^\/mcp\/([\w_-]+)\/([\w_-]+)\/?$/;

export function scopeFromPath(pathname: string): Scope | undefined {
  const match = SCOPE_PATH.exec(pathname);
  return match ? { repo: match[1], env: match[2] } : undefined;
}

export function isMcpPath(pathname: string): boolean {
  return pathname === '/mcp' || pathname.startsWith('/mcp/');
}
