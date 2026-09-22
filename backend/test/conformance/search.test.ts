import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { FastifyInstance } from 'fastify';
import MiniSearch from 'minisearch';
import { buildFastify } from '../../src/app.js';
import { useTempStore } from '../setup/store.js';
import { FIXTURES, SEED_SCOPE, SEED_VERSION, seedFixtures } from '../../scripts/seed-fixtures.js';
import { SEARCH_INDEX_OPTIONS, SEARCH_QUERY_OPTIONS } from '../../src/domain/search.js';

/**
 * The search index: building one, serving it, and what it does and does not contain.
 *
 * Nothing builds the index implicitly, so every case here rebuilds first - which is
 * also the behaviour being asserted. The interesting assertions are the negative ones:
 * a term that only ever appears in a state file must not be findable, and an index that
 * was never built must be a 404 rather than an empty answer that looks like "no hits".
 */

let app: FastifyInstance;
let store: Awaited<ReturnType<typeof useTempStore>>;

const Q = new URLSearchParams(SEED_SCOPE).toString();

const rebuild = (body: unknown = {}) =>
  app.inject({ method: 'POST', url: `/api/v1/search/index?${Q}`, payload: body });

beforeAll(async () => {
  store = await useTempStore();
  app = await buildFastify();
  await seedFixtures(app);
});

afterAll(async () => {
  await app?.close();
  await store?.cleanup();
});

describe('building', () => {
  test('nothing is indexed until the rebuild is called', async () => {
    const before = await app.inject({ method: 'GET', url: `/api/v1/search/index?${Q}` });
    expect(before.statusCode).toBe(404);

    const response = await rebuild();
    expect(response.statusCode).toBe(200);
    const result = response.json();
    expect(result.built).toBe(true);
    expect(result.version).toBe(SEED_VERSION);
    expect(result.counts.element).toBeGreaterThan(0);
    expect(result.counts.description).toBeGreaterThan(0);
    expect(result.counts.column).toBeGreaterThan(0);
  });

  test('rebuilding an unchanged configuration is a no-op, so a job can call it every run', async () => {
    await rebuild({ force: true });
    // past the debounce window a second call still recognises there is nothing to do
    const again = await rebuild({ force: false });
    expect(again.json().built).toBe(false);
    expect(['fresh', 'debounced', 'inflight']).toContain(again.json().reason);
  });

  test('the metadata says what is in there', async () => {
    const meta = (await app.inject({ method: 'GET', url: `/api/v1/search/meta?${Q}` })).json();
    expect(meta.schemaVersion).toBe(1);
    expect(meta.documentCount).toBe(meta.counts.element + meta.counts.description + meta.counts.column);
    expect(Date.parse(meta.builtAt)).toBeGreaterThan(0);
    expect(meta.sizeBytes).toBeGreaterThan(0);
  });
});

describe('serving', () => {
  test('the body is an index the browser can load with the shared options', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/search/index?${Q}` });
    expect(response.statusCode).toBe(200);

    const bundle = response.json();
    // the same shape scripts/buildSearchIndex.ts writes, so both backends hand over one file
    expect(bundle.meta.schemaVersion).toBe(1);

    const index = MiniSearch.loadJS(bundle.index, SEARCH_INDEX_OPTIONS as any);
    const hits = index.search('aviation', SEARCH_QUERY_OPTIONS as any);
    expect(hits.map((h) => h.id)).toContain('e:dataObjects:int-airports');
  });

  test('the bundle has the shape the static builder writes, so the SPA reads both the same way', async () => {
    const served = (await app.inject({ method: 'GET', url: `/api/v1/search/index?${Q}` })).json();
    const built = JSON.parse(
      await readFile(path.join(FIXTURES, 'exported/search/index.json'), 'utf8'),
    );
    expect(Object.keys(served).sort()).toEqual(Object.keys(built).sort());
    expect(Object.keys(served.meta)).toEqual(expect.arrayContaining(Object.keys(built.meta)));
    expect(Object.keys(served.index).sort()).toEqual(Object.keys(built.index).sort());
  });

  test('a description body and a column name are reachable, which is the point of the index', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/search/index?${Q}` });
    const index = MiniSearch.loadJS(response.json().index, SEARCH_INDEX_OPTIONS as any);
    const ids = (q: string) => index.search(q, SEARCH_QUERY_OPTIONS as any).map((h) => h.id as string);

    expect(ids('rail').some((id) => id.startsWith('d:'))).toBe(true);
    expect(ids('icao24').some((id) => id.startsWith('c:'))).toBe(true);
  });

  test('nothing from a workflow run is in the index - state files are out of scope', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/search/index?${Q}` });
    const index = MiniSearch.loadJS(response.json().index, SEARCH_INDEX_OPTIONS as any);
    for (const term of ['SUCCEEDED', 'runId', 'attemptId']) {
      expect(index.search(term, SEARCH_QUERY_OPTIONS as any)).toEqual([]);
    }
  });

  test('the fingerprint is an ETag, so a reload after no change costs a 304', async () => {
    const first = await app.inject({ method: 'GET', url: `/api/v1/search/index?${Q}` });
    const etag = first.headers.etag as string;
    expect(etag).toBeTruthy();

    const again = await app.inject({
      method: 'GET', url: `/api/v1/search/index?${Q}`, headers: { 'if-none-match': etag },
    });
    expect(again.statusCode).toBe(304);
  });
});

describe('which schemas are indexed', () => {
  const index = async () => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/search/index?${Q}` });
    return MiniSearch.loadJS(response.json().index, SEARCH_INDEX_OPTIONS as any);
  };
  const ids = async (q: string) =>
    (await index()).search(q, SEARCH_QUERY_OPTIONS as any).map((h) => h.id as string);

  test('the newest export is used, even where it failed and carries no columns', async () => {
    await rebuild({ force: true });
    // btl-distances' newest export is an error message; an older one describes columns that
    // may no longer exist, so the index has none for it rather than stale ones
    expect((await ids('column:distance')).some((id) => id.startsWith('c:btl-distances'))).toBe(false);
    expect((await ids('icao24')).some((id) => id.startsWith('c:int-departures'))).toBe(true);
  });

  test('a schema whose data object is not in this configuration version is left out', async () => {
    // schemas are not versioned, so the store keeps exports of data objects long removed
    const upload = await app.inject({
      method: 'PUT',
      url: `/api/v1/dataobject/schema/gone-away?${Q}&tstamp=1710000000`,
      payload: { schema: [{ name: 'phantom_column', dataType: 'string' }] },
    });
    expect(upload.statusCode).toBe(200);

    await rebuild({ force: true });
    expect(await ids('phantom_column')).toEqual([]);
  });
});

describe('refusals', () => {
  test('an unknown version is a 404, not an empty index', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/search/index?${Q}&version=nope` });
    expect(response.statusCode).toBe(404);
  });

  test('a version that breaks out of its blob prefix is refused by the schema', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/search/index?${Q}&version=..%2Fetc` });
    expect(response.statusCode).toBe(422);
  });
});
