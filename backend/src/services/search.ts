import { blobPaths, list, readBuffer, readJson, writeBuffer, writeJson } from '../store/blobs.js';
import type { Scope } from '../store/types.js';
import { isMarkdown } from '../store/contentType.js';
import type { ConfigJson, SchemaData } from '../domain/types.js';
import {
  columnDocuments, descriptionDocument, elementDocuments,
  LIMITS, SEARCH_INDEX_OPTIONS, SEARCH_SCHEMA_VERSION, type SearchDocument,
} from '../domain/search.js';
import { getConfig } from './config.js';
import { notFound } from '../errors.js';

/**
 * The global search index: one serialized MiniSearch per configuration version, built by
 * an explicit rebuild and served to the browser verbatim.
 *
 * Nothing builds it implicitly. An upload would be the wrong place - SDLB pushes the
 * configuration before the descriptions and schemas, a non-2xx there fails the job, and
 * reading every description and schema blob takes seconds. So the rebuild is its own
 * operation, and an absent index is a state the UI is built to handle.
 */

/** MiniSearch is only needed when an index is actually built, so keep it off the cold-start path. */
let mini: Promise<typeof import('minisearch')> | undefined;
const miniSearch = async () => (await (mini ??= import('minisearch'))).default;

const MIN_REBUILD_INTERVAL_MS = 10_000;
const READ_CONCURRENCY = 16;

export interface SearchIndexMeta {
  version: string;
  builtAt: string;
  schemaVersion: number;
  documentCount: number;
  counts: { element: number; description: number; column: number };
  sizeBytes: number;
  fingerprint: string;
  /** kinds the builder had to cut to stay within its caps */
  truncated?: ('description' | 'column')[];
}

export interface RebuildResult extends SearchIndexMeta {
  built: boolean;
  reason?: 'fresh' | 'debounced' | 'inflight';
  durationMs: number;
  sources: { descriptionFiles: number; schemaBlobs: number };
}

/* ------------------------------------------------------------------ building */

const inFlight = new Map<string, Promise<RebuildResult>>();
const lastBuilt = new Map<string, { at: number; result: RebuildResult }>();

const cacheKey = (scope: Scope, version: string) => `${scope.repo}|${scope.env}|${version}`;

export function clearSearchCache(): void {
  inFlight.clear();
  lastBuilt.clear();
}

/**
 * Rebuild the index for one configuration version. Safe to call unconditionally at the end
 * of every SDLB run: without `force` an unchanged configuration is a no-op.
 */
export async function rebuildSearchIndex(
  scope: Scope,
  version: string,
  options: { force?: boolean } = {},
): Promise<RebuildResult> {
  const key = cacheKey(scope, version);
  const running = inFlight.get(key);
  if (running) return { ...(await running), built: false, reason: 'inflight' };

  const recent = lastBuilt.get(key);
  if (recent && Date.now() - recent.at < MIN_REBUILD_INTERVAL_MS) {
    return { ...recent.result, built: false, reason: 'debounced' };
  }

  const build = buildAndStore(scope, version, options.force ?? false);
  inFlight.set(key, build);
  try {
    const result = await build;
    lastBuilt.set(key, { at: Date.now(), result });
    return result;
  } finally {
    inFlight.delete(key);
  }
}

async function buildAndStore(scope: Scope, version: string, force: boolean): Promise<RebuildResult> {
  const started = Date.now();
  const config = await getConfig(scope, version);
  const { documents, sources, truncated } = await buildDocuments(scope, version, config);

  const fingerprint = fingerprintOf(documents);
  const existing = await searchIndexMeta(scope, version);
  if (!force && existing?.fingerprint === fingerprint && existing.schemaVersion === SEARCH_SCHEMA_VERSION) {
    return { ...existing, built: false, reason: 'fresh', durationMs: Date.now() - started, sources };
  }

  const MiniSearch = await miniSearch();
  const index = new MiniSearch<SearchDocument>(SEARCH_INDEX_OPTIONS as any);
  index.addAll(documents);

  const counts = {
    element: documents.filter((d) => d.kind === 'element').length,
    description: documents.filter((d) => d.kind === 'description').length,
    column: documents.filter((d) => d.kind === 'column').length,
  };
  const serialized = JSON.stringify(index);
  const meta: SearchIndexMeta = {
    version, builtAt: new Date().toISOString(), schemaVersion: SEARCH_SCHEMA_VERSION,
    documentCount: documents.length, counts, sizeBytes: Buffer.byteLength(serialized, 'utf8'), fingerprint,
    truncated: truncated.length ? truncated : undefined,
  };
  // the same {meta, index} bundle scripts/buildSearchIndex.ts writes, so a statically served
  // project and this backend hand the browser the same file - and the metadata travels in the
  // body rather than a header, which CORS would hide from it
  const body = Buffer.from(JSON.stringify({ meta, index: JSON.parse(serialized) }), 'utf8');

  // an index too large to be usable is worse than the previous one, so keep that instead
  if (body.byteLength > LIMITS.maxIndexBytes) {
    throw new Error(`the search index would be ${body.byteLength} bytes, over the ${LIMITS.maxIndexBytes} limit`);
  }

  await writeBuffer(blobPaths.searchIndex(scope, version), body, 'application/json');
  await writeJson(blobPaths.searchMeta(scope, version), meta);
  return { ...meta, built: true, durationMs: Date.now() - started, sources };
}

/** Elements from the configuration, descriptions from their version prefix, columns from the schemas. */
async function buildDocuments(scope: Scope, version: string, config: ConfigJson) {
  const documents: SearchDocument[] = elementDocuments(config);
  const truncated: ('description' | 'column')[] = [];

  const descriptionBlobs = (await list(blobPaths.descriptionsPrefix(scope, version)))
    .filter((blob) => isMarkdown(blob.name));
  const markdowns = await mapLimit(descriptionBlobs, READ_CONCURRENCY, async (blob) => ({
    name: blob.name,
    text: (await readBuffer(blobPaths.description(scope, version, blob.name)))?.toString('utf8'),
  }));
  for (const { name, text } of markdowns) {
    const doc = text ? descriptionDocument(name, text) : undefined;
    if (doc) documents.push(doc);
  }

  // only what this configuration version contains: schemas are not versioned, so the store
  // still holds exports of data objects that have since been removed or renamed
  const known = new Set(Object.keys(config.dataObjects ?? {}));
  const schemaBlobs = await list(blobPaths.schemaPrefix(scope));
  const wanted = [...schemaTstampsPerDataObject(schemaBlobs.map((blob) => blob.name))]
    .filter(([dataObjectId]) => known.has(dataObjectId));

  // the newest export, whatever it says. One that failed carries an error and no columns,
  // which is a fact about that export rather than something for the indexer to work around.
  const schemas = await mapLimit(wanted, READ_CONCURRENCY, async ([dataObjectId, tstamps]) => ({
    dataObjectId,
    tstamp: tstamps[0],
    schema: await readJson<SchemaData>(blobPaths.schema(scope, dataObjectId, tstamps[0])),
  }));
  for (const { dataObjectId, tstamp, schema } of schemas) {
    if (documents.length >= LIMITS.maxDocuments) { truncated.push('column'); break; }
    documents.push(...columnDocuments(dataObjectId, schema, tstamp));
  }

  return { documents, sources: { descriptionFiles: descriptionBlobs.length, schemaBlobs: schemaBlobs.length }, truncated };
}

/** Every schema export per data object, newest first. */
export function schemaTstampsPerDataObject(names: string[]): Map<string, number[]> {
  const perDataObject = new Map<string, number[]>();
  for (const name of names) {
    const match = /^(.+)\/(\d+)\.json$/.exec(name);
    if (!match) continue;
    const list = perDataObject.get(match[1]) ?? [];
    list.push(Number(match[2]));
    perDataObject.set(match[1], list);
  }
  for (const list of perDataObject.values()) list.sort((a, b) => b - a);
  return perDataObject;
}

/** Cheap and order-independent: enough to tell "nothing changed" from "rebuild it". */
function fingerprintOf(documents: SearchDocument[]): string {
  let hash = 0;
  for (const doc of [...documents].sort((a, b) => a.docId.localeCompare(b.docId))) {
    const text = `${doc.docId}|${doc.name ?? ''}|${doc.description ?? ''}|${doc.body ?? ''}`;
    for (let i = 0; i < text.length; i++) hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  }
  return `${documents.length}-${(hash >>> 0).toString(36)}`;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/* ------------------------------------------------------------------- reading */

export async function searchIndexMeta(scope: Scope, version: string): Promise<SearchIndexMeta | undefined> {
  return readJson<SearchIndexMeta>(blobPaths.searchMeta(scope, version));
}

/** The {meta, index} bundle, with its fingerprint as ETag so a reload after a rebuild is a 304. */
export async function readSearchIndexBlob(
  scope: Scope,
  version: string,
): Promise<{ body: Buffer; meta: SearchIndexMeta; etag: string }> {
  const [body, meta] = await Promise.all([
    readBuffer(blobPaths.searchIndex(scope, version)),
    searchIndexMeta(scope, version),
  ]);
  if (!body || !meta) throw notFound(`search index for configuration version "${version}"`);
  return { body, meta, etag: `"${meta.fingerprint}"` };
}
