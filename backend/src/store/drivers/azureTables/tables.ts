import { TableClient, TableEntity, TableTransaction, odata } from '@azure/data-tables';
import type { AzureStorageAuth } from '../../../config.js';
import { storageCredential, tableEndpoint } from '../../credential.js';
import {
  MAX_BATCH,
  MAX_TRANSACTION_BYTES,
  assertBatch,
  assertRecord,
  estimateBytes,
} from '../../limits.js';

/**
 * Thin layer over @azure/data-tables, used only by this driver's repositories.
 *
 * It hides four things they should not have to think about: creating tables on first
 * use, chunking batch writes to the transaction limits, draining continuation tokens
 * correctly - a query can return zero entities and still hand back a token, so paging
 * must loop on the token and never on the result count - and checking every record
 * against store/limits.ts before it goes anywhere.
 *
 * A store is created with its storage configuration rather than reading settings()
 * itself. That is what lets two exist at once against different accounts, which the
 * conformance suite needs and which no environment variable can arrange.
 */

export const TABLES = {
  workflows: 'Workflows',
  runs: 'Runs',
  runElements: 'RunElements',
  configVersions: 'ConfigVersions',
  configElements: 'ConfigElements',
  elements: 'Elements',
  tstamps: 'Tstamps',
  workspaces: 'Workspaces',
  mcpTokens: 'McpTokens',
  meta: 'Meta',
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];

export interface ListOptions {
  /** Stop after this many entities. Omit to read the whole partition. */
  limit?: number;
  /** Restrict to these properties, as OData names. PartitionKey and RowKey always come back. */
  select?: string[];
}

/** What this driver's repositories are handed instead of a client of their own. */
export interface TableStore {
  upsert<T extends object>(name: TableName, entity: TableEntity<T>): Promise<void>;
  upsertBatch<T extends object>(name: TableName, entities: TableEntity<T>[]): Promise<void>;
  getEntity<T extends object>(
    name: TableName,
    partitionKey: string,
    rowKey: string,
  ): Promise<T | undefined>;
  deleteEntity(name: TableName, partitionKey: string, rowKey: string): Promise<void>;
  listPartition<T extends object>(
    name: TableName,
    partitionKey: string,
    options?: ListOptions,
  ): Promise<T[]>;
}

export function createTableStore(storage: AzureStorageAuth): TableStore {
  const clients = new Map<string, Promise<TableClient>>();
  const created = new Set<string>();

  function tableClient(name: TableName): Promise<TableClient> {
    let client = clients.get(name);
    if (!client) {
      client = buildTableClient(name);
      clients.set(name, client);
    }
    return client;
  }

  async function buildTableClient(name: TableName): Promise<TableClient> {
    if (storage.kind === 'identity') {
      return new TableClient(tableEndpoint(storage.accountName), name, await storageCredential());
    }
    return TableClient.fromConnectionString(storage.value, name, {
      // Azurite speaks http, and core-rest-pipeline refuses that by default. The blob
      // client needs no equivalent: @azure/storage-blob builds its own pipeline with no
      // such guard, and takes the scheme from the connection string's BlobEndpoint.
      allowInsecureConnection: true,
    });
  }

  /** Create the table if this store has not already done so. Cheap after the first call. */
  async function ensureTable(name: TableName): Promise<TableClient> {
    const client = await tableClient(name);
    if (!created.has(name)) {
      await client.createTable();
      created.add(name);
    }
    return client;
  }

  /**
   * Split one partition's entities into transactions, by count and by size.
   *
   * The count limit is the obvious one. The size limit is the one that bites: 100
   * ConfigElements each carrying a 30 000 character searchText is about 6 MB against a
   * 4 MB transaction body, so a large enough configuration would fail - and Azurite does
   * not enforce it, so no test against the emulator would say so first.
   */
  function* chunkTransactions<T extends object>(
    partition: TableEntity<T>[],
  ): Generator<TableEntity<T>[]> {
    let chunk: TableEntity<T>[] = [];
    let bytes = 0;
    for (const entity of partition) {
      const size = estimateBytes(entity as never);
      if (chunk.length > 0 && (chunk.length >= MAX_BATCH || bytes + size > MAX_TRANSACTION_BYTES)) {
        yield chunk;
        chunk = [];
        bytes = 0;
      }
      chunk.push(entity);
      bytes += size;
    }
    if (chunk.length > 0) yield chunk;
  }

  return {
    async upsert<T extends object>(name: TableName, entity: TableEntity<T>): Promise<void> {
      const client = await ensureTable(name);
      await client.upsertEntity(assertRecord(entity as never, name), 'Merge');
    },

    /**
     * Upsert many entities, chunked into transactions. Entities of different partitions
     * are grouped automatically, because a transaction may not span partitions.
     */
    async upsertBatch<T extends object>(
      name: TableName,
      entities: TableEntity<T>[],
    ): Promise<void> {
      if (entities.length === 0) return;
      const checked = assertBatch(entities as never[], name) as TableEntity<T>[];
      const client = await ensureTable(name);

      const byPartition = new Map<string, TableEntity<T>[]>();
      for (const entity of checked) {
        const list = byPartition.get(entity.partitionKey);
        if (list) list.push(entity);
        else byPartition.set(entity.partitionKey, [entity]);
      }

      for (const partition of byPartition.values()) {
        for (const chunk of chunkTransactions(partition)) {
          const transaction = new TableTransaction();
          for (const entity of chunk) transaction.upsertEntity(entity, 'Merge');
          await client.submitTransaction(transaction.actions);
        }
      }
    },

    async getEntity<T extends object>(
      name: TableName,
      partitionKey: string,
      rowKey: string,
    ): Promise<T | undefined> {
      const client = await ensureTable(name);
      try {
        return (await client.getEntity<T>(partitionKey, rowKey)) as unknown as T;
      } catch (error) {
        if (isNotFound(error)) return undefined;
        throw error;
      }
    },

    async deleteEntity(name: TableName, partitionKey: string, rowKey: string): Promise<void> {
      const client = await ensureTable(name);
      try {
        await client.deleteEntity(partitionKey, rowKey);
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },

    /**
     * Read a partition in row-key order.
     *
     * Ascending row key, which - given the inverted keys in keys.ts - means newest
     * first. The loop is over the async iterator rather than a page count on purpose:
     * an empty page may still carry a continuation token.
     */
    async listPartition<T extends object>(
      name: TableName,
      partitionKey: string,
      options: ListOptions = {},
    ): Promise<T[]> {
      const client = await ensureTable(name);

      const results: T[] = [];
      const iterator = client.listEntities<T>({
        queryOptions: { filter: odata`PartitionKey eq ${partitionKey}`, select: options.select },
      });
      for await (const entity of iterator) {
        results.push(entity as unknown as T);
        if (options.limit !== undefined && results.length >= options.limit) break;
      }
      return results;
    },
  };
}

function isNotFound(error: unknown): boolean {
  const status = (error as { statusCode?: number })?.statusCode;
  return status === 404;
}
