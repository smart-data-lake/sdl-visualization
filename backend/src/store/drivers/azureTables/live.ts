import type { LiveRepository } from '../../repositories.js';
import type { Scope } from '../../types.js';
import { assertKeyPart } from '../../limits.js';
import { TABLES, type TableStore } from './tables.js';
import { scopeKey } from './keys.js';

/** The LiveRegistrations table: one partition per scope, one row per watched workflow. */
interface LiveEntity {
  partitionKey: string;
  rowKey: string;
  expiresAt: string;
}

export function liveRepository(tables: TableStore): LiveRepository {
  return {
    async register(scope: Scope, workflow: string, expiresAt: string): Promise<void> {
      await tables.upsert(TABLES.liveRegistrations, {
        partitionKey: scopeKey(scope),
        rowKey: assertKeyPart(workflow, 'workflow'),
        expiresAt,
      });
    },

    async expiresAt(scope: Scope, workflow: string): Promise<string | undefined> {
      const entity = await tables.getEntity<LiveEntity>(
        TABLES.liveRegistrations,
        scopeKey(scope),
        assertKeyPart(workflow, 'workflow'),
      );
      return entity?.expiresAt;
    },
  };
}
