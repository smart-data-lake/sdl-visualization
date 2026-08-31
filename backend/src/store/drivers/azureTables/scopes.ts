import type { ScopeRepository } from '../../repositories.js';
import type { Scope } from '../../types.js';
import { TABLES, type TableStore } from './tables.js';
import { keys } from './keys.js';

/** The Meta table: one partition listing repositories, one per repository listing envs. */
interface MetaEntity {
  partitionKey: string;
  rowKey: string;
  lastSeenAt: string;
}

/**
 * Table Storage sorts by row key ascending, which is not name order for mixed case, so
 * the ordering the interface promises is applied here rather than assumed.
 */
export function scopeRepository(tables: TableStore): ScopeRepository {
  return {
    async register(scope: Scope): Promise<void> {
      const lastSeenAt = new Date().toISOString();
      await Promise.all([
        tables.upsert(TABLES.meta, { partitionKey: keys.metaRepos(), rowKey: scope.repo, lastSeenAt }),
        tables.upsert(TABLES.meta, {
          partitionKey: keys.metaEnvs(scope.repo),
          rowKey: scope.env,
          lastSeenAt,
        }),
      ]);
    },

    async listRepos(): Promise<string[]> {
      const entities = await tables.listPartition<MetaEntity>(TABLES.meta, keys.metaRepos());
      return entities.map((entity) => entity.rowKey).sort();
    },

    async listEnvs(repo: string): Promise<string[]> {
      const entities = await tables.listPartition<MetaEntity>(TABLES.meta, keys.metaEnvs(repo));
      return entities.map((entity) => entity.rowKey).sort();
    },
  };
}
