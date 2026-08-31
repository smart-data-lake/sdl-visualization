import { repositories } from '../store/repositories.js';
import type { Scope, Subtype } from '../store/types.js';
import { blobPaths, readJson, writeJson } from '../store/blobs.js';
import type { SchemaData, Stats } from '../domain/types.js';
import { notFound } from '../errors.js';
import { registerScope } from './scope.js';

/**
 * Schemas and statistics: a blob per timestamp, and one table partition per data
 * object listing the timestamps newest first.
 *
 * The local backend derives its timestamp list by parsing filenames; here it comes
 * from the index, so the blob layout can be the plain {dataObjectId}/{tstamp}.json.
 */

export type { Subtype };

function blobPathFor(scope: Scope, subtype: Subtype, dataObjectId: string, tstamp: number): string {
  return subtype === 'schema'
    ? blobPaths.schema(scope, dataObjectId, tstamp)
    : blobPaths.stats(scope, dataObjectId, tstamp);
}

export async function putSchemaOrStats(
  scope: Scope,
  subtype: Subtype,
  dataObjectId: string,
  tstamp: number,
  body: unknown,
): Promise<void> {
  const path = blobPathFor(scope, subtype, dataObjectId, tstamp);
  await writeJson(path, body);

  await (await repositories()).schemaStats.put(scope, subtype, dataObjectId, {
    tstamp,
    blobPath: path,
    sizeBytes: JSON.stringify(body).length,
  });
  await registerScope(scope);
}

/** The timestamps a data object has, newest first. The SPA sorts them again itself. */
export async function tstamps(
  scope: Scope,
  subtype: Subtype,
  dataObjectId: string,
): Promise<number[]> {
  return (await repositories()).schemaStats.listTstamps(scope, subtype, dataObjectId);
}

export async function getSchema(
  scope: Scope,
  dataObjectId: string,
  tstamp: number,
): Promise<SchemaData> {
  const data = await readJson<SchemaData>(blobPaths.schema(scope, dataObjectId, tstamp));
  if (!data) throw notFound(`schema of ${dataObjectId} at ${tstamp}`);
  return data;
}

export async function getStats(
  scope: Scope,
  dataObjectId: string,
  tstamp: number,
): Promise<{ stats: Stats }> {
  const data = await readJson<Stats>(blobPaths.stats(scope, dataObjectId, tstamp));
  if (!data) throw notFound(`statistics of ${dataObjectId} at ${tstamp}`);
  // The SPA reads `parsedJson.stats`, so the payload is wrapped even though the
  // blob holds it bare - see fetchAPI_rest.getStats.
  return { stats: data };
}

/** The newest timestamp at or before a moment, for "what did the schema look like then". */
export async function tstampAt(
  scope: Scope,
  subtype: Subtype,
  dataObjectId: string,
  atMillis?: number,
): Promise<number | undefined> {
  const all = await tstamps(scope, subtype, dataObjectId);
  if (atMillis === undefined) return all[0];
  return all.find((t) => t <= atMillis);
}
