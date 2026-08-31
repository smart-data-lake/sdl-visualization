import type { WorkspaceRepository } from '../../repositories.js';
import type { WorkspaceRule } from '../../types.js';
import { TABLES, getEntity, upsert } from '../../tables.js';
import { keys } from '../../keys.js';

/** The Workspaces table: one partition, one row per workspace host. */
interface WorkspaceEntity {
  partitionKey: string;
  rowKey: string;
  repos?: string;
  envs?: string;
  requiredGroup?: string;
}

export function workspaceRepository(): WorkspaceRepository {
  return {
    async getRule(workspaceHost: string): Promise<WorkspaceRule | undefined> {
      const entity = await getEntity<WorkspaceEntity>(
        TABLES.workspaces,
        keys.workspaces(),
        workspaceHost,
      );
      if (!entity) return undefined;
      // Named fields rather than the entity itself, so partitionKey, rowKey and the
      // etag and timestamp the SDK adds do not leak into what a caller sees - a second
      // driver has no reason to produce any of them.
      return { repos: entity.repos, envs: entity.envs, requiredGroup: entity.requiredGroup };
    },

    async putRule(workspaceHost: string, rule: WorkspaceRule): Promise<void> {
      await upsert(TABLES.workspaces, {
        partitionKey: keys.workspaces(),
        rowKey: workspaceHost,
        ...rule,
      });
    },
  };
}
