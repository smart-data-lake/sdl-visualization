import { blobPaths, list, readBuffer, readJson, writeBuffer, writeJson } from '../store/blobs.js';
import type { Scope } from '../store/types.js';
import {
  buildColumnLineageIndex, COLUMN_LINEAGE_INDEX_VERSION, parseColumnLineage, type ColumnLineage,
} from '../domain/columnLineage.js';
import { badRequest, notFound } from '../errors.js';
import { putSchemaOrStats } from './schemaStats.js';
import { mapLimit, schemaTstampsPerDataObject } from './search.js';

/**
 * Column lineage: the documents SDLB uploads per output DataObject, and the index over the newest
 * of them that lets the browser trace a column through the whole pipeline.
 *
 * The index is rebuilt lazily, on the first read after the lineage changed: SDLB uploads one
 * document per DataObject, so rebuilding on every upload would cost one rebuild per DataObject.
 */

const READ_CONCURRENCY = 16;

interface LineageIndexMeta {
  schemaVersion: number;
  builtAt: string;
  /** the newest blob of every DataObject the index was built from */
  fingerprint: string;
}

/**
 * Several documents in one request, e.g. every action of a dry-run. Documents naming the same
 * DataObject are stored together, as an array, so one action's upload does not replace another's.
 */
export async function putLineageBatch(scope: Scope, tstamp: number, body: unknown): Promise<{ dataObjectIds: string[] }> {
  if (!Array.isArray(body)) throw badRequest('expected an array of column lineage documents');
  const perDataObject = new Map<string, unknown[]>();
  body.forEach((document, i) => {
    if (parseColumnLineage(document).length !== 1) {
      throw badRequest(`document ${i} is not a column lineage document with an actionId and a dataObjectId`);
    }
    const id = (document as { dataObjectId: string }).dataObjectId;
    perDataObject.set(id, [...(perDataObject.get(id) ?? []), document]);
  });
  for (const [id, documents] of perDataObject) {
    await putSchemaOrStats(scope, 'lineage', id, tstamp, documents.length === 1 ? documents[0] : documents);
  }
  return { dataObjectIds: [...perDataObject.keys()] };
}

/* ------------------------------------------------------------------- index */

const inFlight = new Map<string, Promise<Buffer>>();
const scopeKey = (scope: Scope) => `${scope.repo}|${scope.env}`;

export function clearLineageIndexCache(): void {
  inFlight.clear();
}

/** The newest lineage blob per DataObject, and a fingerprint that changes with any of them. */
async function newestBlobs(scope: Scope): Promise<{ newest: [string, number][]; fingerprint: string }> {
  const blobs = await list(blobPaths.lineagePrefix(scope));
  const newest = [...schemaTstampsPerDataObject(blobs.map((blob) => blob.name))]
    .map(([id, tstamps]): [string, number] => [id, tstamps[0]])
    .sort(([a], [b]) => a.localeCompare(b));
  return { newest, fingerprint: newest.map(([id, tstamp]) => `${id}:${tstamp}`).join('|') };
}

async function build(scope: Scope, newest: [string, number][], fingerprint: string): Promise<Buffer> {
  const read = await mapLimit(newest, READ_CONCURRENCY, async ([id, tstamp]) => ({
    tstamp,
    documents: parseColumnLineage(await readJson<unknown>(blobPaths.lineage(scope, id, tstamp))),
  }));
  const sources: { lineage: ColumnLineage; tstamp: number }[] = read
    .flatMap(({ tstamp, documents }) => documents.map((lineage) => ({ lineage, tstamp })));
  const builtAt = new Date().toISOString();
  const body = Buffer.from(JSON.stringify(buildColumnLineageIndex(sources, builtAt)), 'utf8');
  await writeBuffer(blobPaths.lineageIndex(scope), body, 'application/json');
  await writeJson(blobPaths.lineageIndexMeta(scope), {
    schemaVersion: COLUMN_LINEAGE_INDEX_VERSION, builtAt, fingerprint,
  } satisfies LineageIndexMeta);
  return body;
}

/** The index, rebuilt first if the lineage changed since it was built or `force` is set. */
export async function readLineageIndex(scope: Scope, options: { force?: boolean } = {}): Promise<{ body: Buffer; etag: string }> {
  const { newest, fingerprint } = await newestBlobs(scope);
  if (newest.length === 0) throw notFound('column lineage');
  const etag = `"${COLUMN_LINEAGE_INDEX_VERSION}-${hash(fingerprint)}"`;

  if (!options.force) {
    const meta = await readJson<LineageIndexMeta>(blobPaths.lineageIndexMeta(scope));
    if (meta?.fingerprint === fingerprint && meta.schemaVersion === COLUMN_LINEAGE_INDEX_VERSION) {
      const body = await readBuffer(blobPaths.lineageIndex(scope));
      if (body) return { body, etag };
    }
  }

  const key = scopeKey(scope);
  let running = inFlight.get(key);
  if (!running) {
    running = build(scope, newest, fingerprint).finally(() => inFlight.delete(key));
    inFlight.set(key, running);
  }
  return { body: await running, etag };
}

function hash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return `${text.length}-${(h >>> 0).toString(36)}`;
}
