import { createHash, randomBytes } from 'node:crypto';
import { repositories } from '../store/repositories.js';
import type { Scope, StoredToken } from '../store/types.js';

/**
 * Long-lived tokens for MCP clients.
 *
 * A Databricks user-to-machine access token lives about an hour, which makes it a
 * poor thing to paste into an agent's configuration file. It is also, from the MCP
 * spec's point of view, a token minted for somebody else's resource. So the SPA
 * exchanges a proven Databricks identity for a token of *this* service, which the
 * user can name, see the last use of, and revoke.
 *
 * Only the hash is stored, so a leak of the table does not leak anyone's access.
 */

export const TOKEN_PREFIX = 'sdlb_';

export interface McpTokenInfo {
  id: string;
  label: string;
  email: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

export function isMcpToken(token: string): boolean {
  return token.startsWith(TOKEN_PREFIX);
}

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function mintToken(
  scope: Scope,
  email: string,
  label: string,
  ttlDays?: number,
): Promise<{ token: string; info: McpTokenInfo }> {
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  const rowKey = hash(token);
  const createdAt = new Date().toISOString();
  const expiresAt =
    ttlDays === undefined
      ? undefined
      : new Date(Date.now() + ttlDays * 86_400_000).toISOString();

  const stored: StoredToken = { id: rowKey, email, label, createdAt, expiresAt };
  await (await repositories()).tokens.put(scope, stored);

  return { token, info: { id: rowKey, label, email, createdAt, expiresAt } };
}

export async function listTokens(scope: Scope, email?: string): Promise<McpTokenInfo[]> {
  const tokens = await (await repositories()).tokens.list(scope);
  return tokens.filter((token) => email === undefined || token.email === email);
}

export async function revokeToken(scope: Scope, id: string): Promise<void> {
  await (await repositories()).tokens.delete(scope, id);
}

/**
 * Resolve a token to the identity it was minted for, or undefined if it is unknown
 * or expired. Records the use, so the SPA can show a token that nothing uses any more.
 */
export async function resolveToken(
  scope: Scope,
  token: string,
): Promise<{ email: string; label: string } | undefined> {
  const rowKey = hash(token);
  const tokens = (await repositories()).tokens;
  const stored = await tokens.get(scope, rowKey);
  if (!stored) return undefined;
  if (stored.expiresAt && Date.parse(stored.expiresAt) < Date.now()) {
    await revokeToken(scope, rowKey);
    return undefined;
  }

  // Best effort: a failed touch must never cost the caller their request.
  void tokens.touch(scope, rowKey, new Date().toISOString()).catch(() => undefined);

  return { email: stored.email, label: stored.label };
}
