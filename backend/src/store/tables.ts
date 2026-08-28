import { TableClient, TableEntity, TableTransaction, odata } from '@azure/data-tables';
import { settings } from '../config.js';
import { storageCredential, tableEndpoint } from './credential.js';

/**
 * Thin layer over @azure/data-tables.
 *
 * It exists to hide three things the rest of the code should never have to think
 * about: creating tables on first use, chunking batch writes to the 100-entity
 * transaction limit, and draining continuation tokens correctly - a query can
 * return zero entities and still hand back a token, so paging must loop on the
 * token and never on the result count.
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

/** Azure Tables transactions take at most 100 entities in one partition. */
export const MAX_BATCH = 100;

const clients = new Map<string, Promise<TableClient>>();
const created = new Set<string>();

export function tableClient(name: TableName): Promise<TableClient> {
  let client = clients.get(name);
  if (!client) {
    client = buildTableClient(name);
    clients.set(name, client);
  }
  return client;
}

async function buildTableClient(name: TableName): Promise<TableClient> {
  const storage = settings().storage;
  if (storage.kind === 'identity') {
    return new TableClient(tableEndpoint(storage.accountName), name, await storageCredential());
  }
  return TableClient.fromConnectionString(storage.value, name, {
    allowInsecureConnection: true, // Azurite speaks http
  });
}

/** Create the table if this process has not already done so. Idempotent and cheap after the first call. */
export async function ensureTable(name: TableName): Promise<TableClient> {
  const client = await tableClient(name);
  if (!created.has(name)) {
    await client.createTable();
    created.add(name);
  }
  return client;
}

export async function ensureAllTables(): Promise<void> {
  await Promise.all(Object.values(TABLES).map((t) => ensureTable(t)));
}

/** Only for tests, which point successive cases at different Azurite accounts. */
export function resetTableClients(): void {
  clients.clear();
  created.clear();
}

export async function upsert<T extends object>(
  name: TableName,
  entity: TableEntity<T>,
): Promise<void> {
  const client = await ensureTable(name);
  await client.upsertEntity(entity, 'Merge');
}

/**
 * Upsert many entities of one partition, chunked into transactions.
 * Entities of different partitions are grouped automatically, because a
 * transaction may not span partitions.
 */
export async function upsertBatch<T extends object>(
  name: TableName,
  entities: TableEntity<T>[],
  mode: 'Merge' | 'Replace' = 'Merge',
): Promise<void> {
  if (entities.length === 0) return;
  const client = await ensureTable(name);

  const byPartition = new Map<string, TableEntity<T>[]>();
  for (const entity of entities) {
    const list = byPartition.get(entity.partitionKey);
    if (list) list.push(entity);
    else byPartition.set(entity.partitionKey, [entity]);
  }

  for (const partition of byPartition.values()) {
    for (let i = 0; i < partition.length; i += MAX_BATCH) {
      const transaction = new TableTransaction();
      for (const entity of partition.slice(i, i + MAX_BATCH)) {
        transaction.upsertEntity(entity, mode);
      }
      await client.submitTransaction(transaction.actions);
    }
  }
}

export async function getEntity<T extends object>(
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
}

export async function deleteEntity(
  name: TableName,
  partitionKey: string,
  rowKey: string,
): Promise<void> {
  const client = await ensureTable(name);
  try {
    await client.deleteEntity(partitionKey, rowKey);
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

export interface ListOptions {
  /** Stop after this many entities. Omit to read the whole partition. */
  limit?: number;
  /** Restrict to these properties. PartitionKey and RowKey always come back. */
  select?: string[];
  /** Extra OData filter, ANDed with the partition key. Only eq/ne/gt/ge/lt/le/and/or/not exist. */
  filter?: string;
  /** Restrict to a RowKey range, e.g. everything with a given prefix. */
  rowKeyFrom?: string;
  rowKeyTo?: string;
}

/**
 * Read a partition in RowKey order.
 *
 * Results come back in RowKey ascending order, which - given the inverted keys in
 * keys.ts - means newest first. The loop is over the async iterator rather than a
 * page count on purpose: an empty page may still carry a continuation token.
 */
export async function listPartition<T extends object>(
  name: TableName,
  partitionKey: string,
  options: ListOptions = {},
): Promise<T[]> {
  const client = await ensureTable(name);

  const clauses = [odata`PartitionKey eq ${partitionKey}`];
  if (options.rowKeyFrom !== undefined) clauses.push(odata`RowKey ge ${options.rowKeyFrom}`);
  if (options.rowKeyTo !== undefined) clauses.push(odata`RowKey lt ${options.rowKeyTo}`);
  if (options.filter) clauses.push(`(${options.filter})`);

  const results: T[] = [];
  const iterator = client.listEntities<T>({
    queryOptions: { filter: clauses.join(' and '), select: options.select },
  });
  for await (const entity of iterator) {
    results.push(entity as unknown as T);
    if (options.limit !== undefined && results.length >= options.limit) break;
  }
  return results;
}

/** Read every entity of a table. Only for small tables such as Workspaces and Meta. */
export async function listTable<T extends object>(name: TableName, filter?: string): Promise<T[]> {
  const client = await ensureTable(name);
  const results: T[] = [];
  const iterator = client.listEntities<T>(filter ? { queryOptions: { filter } } : undefined);
  for await (const entity of iterator) results.push(entity as unknown as T);
  return results;
}

function isNotFound(error: unknown): boolean {
  const status = (error as { statusCode?: number })?.statusCode;
  return status === 404;
}

/**
 * Azure Tables caps a string property at 64 KiB. Anything that could exceed that -
 * an exception message, a serialised action map - goes through here, and anything
 * that would still be too big belongs in a blob instead.
 */
export function truncate(value: string | undefined, max = 30_000): string | undefined {
  if (value === undefined) return undefined;
  return value.length <= max ? value : `${value.slice(0, max)}… [truncated]`;
}
