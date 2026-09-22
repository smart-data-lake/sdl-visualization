/**
 * Loading and querying the search index in the browser (src/util/ConfigExplorer/searchIndex.ts).
 *
 * The cases that matter are the refusals: the search box lives in the title bar, so anything
 * it throws would replace the whole page through the ErrorBoundary.
 */
import { beforeEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import MiniSearch from 'minisearch';
import { ConfigData } from '../src/util/ConfigExplorer/ConfigData.ts';
import {
  elementDocuments, SEARCH_INDEX_OPTIONS, SEARCH_QUERY_OPTIONS, SEARCH_SCHEMA_VERSION,
} from '../src/util/ConfigExplorer/searchDocuments.ts';
import {
  buildFallbackIndex, clearSearchIndexCache, groupHits, indexCacheKey, MAX_INDEX_BYTES,
  parseQuery, parseSearchIndex, refusalFor, runSearch,
} from '../src/util/ConfigExplorer/searchIndex.ts';

const configJson = JSON.parse(readFileSync('tests/e2e/fixtures/exported/exportedConfig.json', 'utf8'));
const bundle = JSON.parse(readFileSync('tests/e2e/fixtures/exported/search/index.json', 'utf8'));
const configData = new ConfigData(configJson);

beforeEach(() => clearSearchIndexCache());

test('the committed fixture index loads and answers', async () => {
  const index = await parseSearchIndex('k', bundle);
  expect(index).toBeDefined();
  const ids = index!.search('aviation', SEARCH_QUERY_OPTIONS as any).map(r => r.id);
  expect(ids).toContain('e:dataObjects:int-airports');
});

test('an index is parsed once per key', async () => {
  const first = await parseSearchIndex('k', bundle);
  const second = await parseSearchIndex('k', bundle);
  expect(second).toBe(first);
});

test('an index built with other options is refused rather than silently misread', async () => {
  const stale = { ...bundle, meta: { ...bundle.meta, schemaVersion: SEARCH_SCHEMA_VERSION + 1 } };
  expect(await parseSearchIndex('k', stale)).toBeUndefined();
  expect(refusalFor('k')).toBe('schemaMismatch');
});

test('an index too large to parse is refused, so the tab cannot hang on it', async () => {
  const huge = { ...bundle, meta: { ...bundle.meta, sizeBytes: MAX_INDEX_BYTES + 1 } };
  expect(await parseSearchIndex('k', huge)).toBeUndefined();
  expect(refusalFor('k')).toBe('tooLarge');
});

test('a corrupt index is refused without throwing', async () => {
  expect(await parseSearchIndex('k', { index: { nonsense: true }, meta: bundle.meta } as any)).toBeUndefined();
  expect(refusalFor('k')).toBe('unreadable');
  expect(await parseSearchIndex('k2', undefined)).toBeUndefined();
});

test('the fallback index covers the configuration only, and is built once per ConfigData', () => {
  const index = buildFallbackIndex(configData);
  expect(buildFallbackIndex(configData)).toBe(index);
  const ids = index.search('aviation', SEARCH_QUERY_OPTIONS as any).map(r => r.id as string);
  expect(ids).toContain('e:dataObjects:int-airports');
  // descriptions and columns need per-element files, which is what the prebuilt index is for
  expect(index.search('could_be_done_by_rail', SEARCH_QUERY_OPTIONS as any)).toEqual([]);
});

test('a built index and a serialized one rank identically', async () => {
  const built = new MiniSearch(SEARCH_INDEX_OPTIONS as any);
  built.addAll(elementDocuments(configJson));
  const restored = await parseSearchIndex('rt', {
    index: JSON.parse(JSON.stringify(built)),
    meta: { ...bundle.meta, schemaVersion: SEARCH_SCHEMA_VERSION },
  });
  const score = (m: any) => m.search('airports', SEARCH_QUERY_OPTIONS as any).map((r: any) => [r.id, r.score]);
  expect(score(restored)).toEqual(score(built));
});

test('results are grouped in a fixed order, whatever order they scored in', async () => {
  const index = await parseSearchIndex('k', bundle);
  const { groups } = runSearch(index, 'airport', '/');
  expect(groups.map(g => g.title)).toEqual(
    ['Data Objects', 'Actions', 'Connections', 'Descriptions', 'Columns'].filter(t => groups.some(g => g.title === t)));
  expect(groups.length).toBeGreaterThan(1);
});

test('each kind navigates to the tab that shows it, columns carrying the column', async () => {
  const index = await parseSearchIndex('k', bundle);
  const hit = (q: string, docId: string) => runSearch(index, q, '/').flat.find(h => h.docId === docId)!;

  expect(hit('aviation', 'e:dataObjects:int-airports').to).toBe('/config/dataObjects/int-airports/configuration');
  expect(hit('rail', 'd:dataObjects/btl-distances.md').to).toBe('/config/dataObjects/btl-distances/description');
  // the tstamp names the export the column was indexed from, which need not be the newest
  expect(hit('icao24', 'c:int-departures:icao24').to)
    .toBe('/config/dataObjects/int-departures/schema?column=icao24&tstamp=1710144922');
});

test('a workspace prefix is kept, so search works under the multi tenant routes', async () => {
  const index = await parseSearchIndex('k', bundle);
  const hit = runSearch(index, 'aviation', '/Acme/content/repo/dev/').flat
    .find(h => h.docId === 'e:dataObjects:int-airports')!;
  expect(hit.to).toBe('/Acme/content/repo/dev/config/dataObjects/int-airports/configuration');
});

test('an element without a metadata name is titled by its id, not by the document key', async () => {
  const index = await parseSearchIndex('k', bundle);
  // ext-airports has no metadata.name in the fixture
  const hit = runSearch(index, 'ext-airports', '/').flat.find(h => h.docId === 'e:dataObjects:ext-airports')!;
  expect(hit.title).toBe('ext-airports');
  expect(hit.title).not.toContain('e:dataObjects:');
});

test('a hit says which terms matched and where, so the list can highlight and explain', async () => {
  const index = await parseSearchIndex('k', bundle);
  const hit = runSearch(index, 'aviation', '/').flat.find(h => h.docId === 'e:dataObjects:int-airports')!;
  expect(hit.terms).toContain('aviation');
  expect(hit.fields).toContain('tags');
  expect(hit.title).toBe('Airport locations');
  expect(hit.subtitle).toContain('int-airports');
});

test('a short query searches nothing, so the list is not flooded on the first keystroke', async () => {
  const index = await parseSearchIndex('k', bundle);
  expect(runSearch(index, 'a', '/').flat).toEqual([]);
  expect(runSearch(undefined, 'aviation', '/').flat).toEqual([]);
});

test('the result list is capped per group and overall', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    id: `e:dataObjects:d${i}`, score: 1, terms: [], queryTerms: [], match: {},
    docId: `e:dataObjects:d${i}`, kind: 'element', elementType: 'dataObjects', elementId: `d${i}`, name: `d${i}`,
  })) as any[];
  const { groups, flat } = groupHits(many, '/');
  expect(groups[0].hits.length).toBe(5);
  expect(groups[0].more).toBe(35);
  expect(flat.length).toBeLessThanOrEqual(25);
});

test('the cache key separates workspaces and versions', () => {
  expect(indexCacheKey('t', 'r', 'e', 'v1')).not.toBe(indexCacheKey('t', 'r', 'e', 'v2'));
  expect(indexCacheKey('t', 'r', 'e1', 'v')).not.toBe(indexCacheKey('t', 'r', 'e2', 'v'));
});

/* --------------------------------------------------------------- scoping */

test('a known prefix is taken off the query and names the scope', () => {
  expect(parseQuery('do:airports')).toEqual({ text: 'airports', scope: expect.objectContaining({ label: 'Data Objects' }) });
  expect(parseQuery('column:distance').scope!.kind).toBe('column');
  expect(parseQuery('tag:aviation').scope!.fields).toEqual(['tags']);
});

test('the prefix is matched ignoring case and surrounding space', () => {
  expect(parseQuery('  DO : airports ').text).toBe('airports');
  expect(parseQuery('Column:distance').scope!.kind).toBe('column');
});

test('an unknown prefix is left alone, so a colon in the text still searches', () => {
  expect(parseQuery('http://example.com')).toEqual({ text: 'http://example.com' });
  expect(parseQuery('default.int_airports')).toEqual({ text: 'default.int_airports' });
  expect(parseQuery('nosuchscope:x').text).toBe('nosuchscope:x');
});

test('only the first colon is a scope; the rest is searched', () => {
  expect(parseQuery('name:a:b')).toEqual({ text: 'a:b', scope: expect.objectContaining({ label: 'name' }) });
});

test('scoping by kind returns only that kind', async () => {
  const index = await parseSearchIndex('k', bundle);
  const kinds = (q: string) => [...new Set(runSearch(index, q, '/').flat.map(h => h.kind))];

  // "callsign" is a column of int-departures and appears in an element body too
  expect(kinds('column:callsign')).toEqual(['column']);
  expect(kinds('element:callsign')).toEqual(['element']);
  expect(kinds('callsign').length).toBeGreaterThan(1);
  expect(kinds('description:distances')).toEqual(['description']);
});

test('scoping by element type separates data objects from actions', async () => {
  const index = await parseSearchIndex('k', bundle);
  const groups = (q: string) => runSearch(index, q, '/').groups.map(g => g.title);

  expect(groups('do:airports')).toEqual(['Data Objects']);
  expect(groups('action:airports')).toEqual(['Actions']);
  expect(groups('elements:airports')).toEqual(expect.arrayContaining(['Data Objects', 'Actions']));
});

test('scoping by field searches that field only', async () => {
  const index = await parseSearchIndex('k', bundle);
  const ids = (q: string) => runSearch(index, q, '/').flat.map(h => h.docId);

  // "aviation" is a tag of int-airports and appears nowhere in a name
  expect(ids('tag:aviation')).toContain('e:dataObjects:int-airports');
  expect(ids('name:aviation')).toEqual([]);
  // the type is indexed in its own field
  expect(ids('type:DeltaLakeTableDataObject')).toContain('e:dataObjects:int-airports');
  expect(ids('name:DeltaLakeTableDataObject')).toEqual([]);
});

test('a scope with nothing after it searches nothing rather than everything', async () => {
  const index = await parseSearchIndex('k', bundle);
  expect(parseQuery('do:').text).toBe('');
  expect(runSearch(index, 'do:', '/').flat).toEqual([]);
});

/* ------------------------------------------- what the index covers, and what it does not */

test('a data object whose newest schema export failed contributes no columns', async () => {
  const index = await parseSearchIndex('k', bundle);
  // btl-distances' newest export carries only an error message; taking an older one instead
  // would describe columns that no longer exist, so the index simply has none for it
  const columns = runSearch(index, 'column:distance', '/').flat;
  expect(columns.every(h => h.docId !== 'c:btl-distances:distance')).toBe(true);
});

test('the columns that are indexed come from the newest export of that data object', async () => {
  const index = await parseSearchIndex('k', bundle);
  const hit = runSearch(index, 'column:icao24', '/').flat[0];
  expect(hit.docId).toBe('c:int-departures:icao24');
  // int-departures has exactly one export, and it is the one indexed
  expect(hit.to).toContain('tstamp=1710144922');
});
