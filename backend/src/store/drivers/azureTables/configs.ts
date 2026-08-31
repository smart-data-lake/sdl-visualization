import type { ConfigRepository } from '../../repositories.js';
import type {
  ConfigElementRecord,
  ConfigVersionRecord,
  LatestElementRecord,
  Scope,
} from '../../types.js';
import { TABLES, type TableStore } from './tables.js';
import { keys, versionKey } from './keys.js';

/** ConfigVersions: one partition per scope, one row per version. */
interface ConfigVersionEntity {
  partitionKey: string;
  rowKey: string;
  createdAt: string;
  blobPath: string;
  numDataObjects: number;
  numActions: number;
  numConnections: number;
}

/**
 * ConfigElements: one partition per version, `elementType|id` as the row key.
 *
 * The type is in the row key rather than only in a property because the same id can
 * exist as both a data object and an action, and Table Storage cannot filter on a
 * property cheaply enough to separate them.
 */
type ConfigElementEntity = ConfigElementRecord & { partitionKey: string; rowKey: string };

/** Elements: one partition per scope and element type, one row per id. */
type ElementEntity = Omit<LatestElementRecord, 'id' | 'elementType'> & {
  partitionKey: string;
  rowKey: string;
};

export function configRepository(tables: TableStore): ConfigRepository {
  return {
    async putVersion(scope: Scope, version: ConfigVersionRecord): Promise<void> {
      const { version: name, ...rest } = version;
      const entity: ConfigVersionEntity = {
        partitionKey: keys.configVersions(scope),
        rowKey: versionKey(name),
        ...rest,
      };
      await tables.upsert(TABLES.configVersions, entity);
    },

    async listVersions(scope: Scope): Promise<string[]> {
      const entities = await tables.listPartition<ConfigVersionEntity>(
        TABLES.configVersions,
        keys.configVersions(scope),
      );
      return entities.map((entity) => entity.rowKey);
    },

    async putElements(
      scope: Scope,
      version: string,
      elements: ConfigElementRecord[],
    ): Promise<void> {
      const partitionKey = keys.configElements(scope, version);
      const entities: ConfigElementEntity[] = elements.map((element) => ({
        partitionKey,
        rowKey: `${element.elementType}|${element.id}`,
        ...element,
      }));
      await tables.upsertBatch(TABLES.configElements, entities);
    },

    async putLatestElements(scope: Scope, elements: LatestElementRecord[]): Promise<void> {
      const entities: ElementEntity[] = elements.map(({ id, elementType, ...rest }) => ({
        partitionKey: keys.elements(scope, elementType),
        rowKey: id,
        ...rest,
      }));
      await tables.upsertBatch(TABLES.elements, entities);
    },
  };
}
