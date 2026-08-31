import type { SchemaStatsRepository } from '../../repositories.js';
import type { Scope, Subtype, TstampEntry } from '../../types.js';
import { TABLES, type TableStore } from './tables.js';
import { inv, keys, uninv } from './keys.js';

/**
 * The Tstamps table: one partition per data object and subtype, one row per timestamp.
 *
 * The row key is inv(tstamp), so a plain ascending scan is newest first - Table Storage
 * sorts only by row key and has no $orderby.
 */
interface TstampEntity {
  partitionKey: string;
  rowKey: string;
  tstamp: number;
  blobPath: string;
  sizeBytes: number;
}

export function schemaStatsRepository(tables: TableStore): SchemaStatsRepository {
  return {
    async put(
      scope: Scope,
      subtype: Subtype,
      dataObjectId: string,
      entry: TstampEntry,
    ): Promise<void> {
      await tables.upsert(TABLES.tstamps, {
        partitionKey: keys.tstamps(scope, subtype, dataObjectId),
        rowKey: inv(entry.tstamp),
        ...entry,
      });
    },

    async listTstamps(scope: Scope, subtype: Subtype, dataObjectId: string): Promise<number[]> {
      const entities = await tables.listPartition<TstampEntity>(
        TABLES.tstamps,
        keys.tstamps(scope, subtype, dataObjectId),
      );
      // The stored property, falling back to the key it was encoded into - rows written
      // before tstamp was recorded separately carry it only in the key.
      return entities.map((entity) => entity.tstamp ?? uninv(entity.rowKey));
    },
  };
}
