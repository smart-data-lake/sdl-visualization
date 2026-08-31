import type { TokenRepository } from '../../repositories.js';
import type { Scope, StoredToken } from '../../types.js';
import { TABLES, deleteEntity, getEntity, listPartition, upsert } from '../../tables.js';
import { keys } from '../../keys.js';

/** The McpTokens table: one partition per scope, one row per token hash. */
interface McpTokenEntity {
  partitionKey: string;
  rowKey: string;
  email: string;
  label: string;
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
}

const toToken = (entity: McpTokenEntity): StoredToken => ({
  id: entity.rowKey,
  email: entity.email,
  label: entity.label,
  createdAt: entity.createdAt,
  expiresAt: entity.expiresAt,
  lastUsedAt: entity.lastUsedAt,
});

export function tokenRepository(): TokenRepository {
  return {
    async put(scope: Scope, token: StoredToken): Promise<void> {
      const { id, ...rest } = token;
      await upsert(TABLES.mcpTokens, {
        partitionKey: keys.mcpTokens(scope),
        rowKey: id,
        ...rest,
      });
    },

    async get(scope: Scope, id: string): Promise<StoredToken | undefined> {
      const entity = await getEntity<McpTokenEntity>(TABLES.mcpTokens, keys.mcpTokens(scope), id);
      return entity && toToken(entity);
    },

    async list(scope: Scope): Promise<StoredToken[]> {
      const entities = await listPartition<McpTokenEntity>(
        TABLES.mcpTokens,
        keys.mcpTokens(scope),
      );
      return entities.map(toToken);
    },

    async delete(scope: Scope, id: string): Promise<void> {
      await deleteEntity(TABLES.mcpTokens, keys.mcpTokens(scope), id);
    },

    // Merge mode, so the properties this does not mention keep their stored values.
    async touch(scope: Scope, id: string, at: string): Promise<void> {
      await upsert(TABLES.mcpTokens, {
        partitionKey: keys.mcpTokens(scope),
        rowKey: id,
        lastUsedAt: at,
      });
    },
  };
}
