import { createHash, randomBytes } from 'node:crypto';
import { TABLES, deleteEntity, getEntity, listPartition, upsert } from '../store/tables.js';
import { keys, type Scope } from '../store/keys.js';

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

export interface McpTokenEntity {
  partitionKey: string;
  rowKey: string;
  email: string;
  label: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

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

  await upsert<Omit<McpTokenEntity, 'partitionKey' | 'rowKey'>>(TABLES.mcpTokens, {
    partitionKey: keys.mcpTokens(scope),
    rowKey,
    email,
    label,
    createdAt,
    expiresAt,
  } as McpTokenEntity);

  return { token, info: { id: rowKey, label, email, createdAt, expiresAt } };
}

export async function listTokens(scope: Scope, email?: string): Promise<McpTokenInfo[]> {
  const entities = await listPartition<McpTokenEntity>(TABLES.mcpTokens, keys.mcpTokens(scope));
  return entities
    .filter((e) => email === undefined || e.email === email)
    .map((e) => ({
      id: e.rowKey,
      label: e.label,
      email: e.email,
      createdAt: e.createdAt,
      expiresAt: e.expiresAt,
      lastUsedAt: e.lastUsedAt,
    }));
}

export async function revokeToken(scope: Scope, id: string): Promise<void> {
  await deleteEntity(TABLES.mcpTokens, keys.mcpTokens(scope), id);
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
  const entity = await getEntity<McpTokenEntity>(TABLES.mcpTokens, keys.mcpTokens(scope), rowKey);
  if (!entity) return undefined;
  if (entity.expiresAt && Date.parse(entity.expiresAt) < Date.now()) {
    await revokeToken(scope, rowKey);
    return undefined;
  }

  // Best effort: a failed touch must never cost the caller their request.
  void upsert(TABLES.mcpTokens, {
    partitionKey: entity.partitionKey,
    rowKey,
    lastUsedAt: new Date().toISOString(),
  }).catch(() => undefined);

  return { email: entity.email, label: entity.label };
}
