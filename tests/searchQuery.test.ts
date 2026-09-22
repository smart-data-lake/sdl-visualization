/**
 * The ranking contract of the global search: what a query finds and in which order.
 *
 * The palette groups and highlights from these results, and the same options have to be used
 * when an index built elsewhere is loaded (MiniSearch.loadJS fails silently on a mismatch),
 * so the behaviour is pinned here rather than left to the library's defaults.
 */
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import MiniSearch from 'minisearch';
import {
  columnDocuments, descriptionDocument, elementDocuments,
  SEARCH_INDEX_OPTIONS, SEARCH_QUERY_OPTIONS,
} from '../src/util/ConfigExplorer/searchDocuments.ts';

const config = JSON.parse(readFileSync('tests/e2e/fixtures/exported/exportedConfig.json', 'utf8'));
const schema = JSON.parse(readFileSync('tests/e2e/fixtures/shared/schema/btl-distances.schema.1702279427.json', 'utf8'));
const markdown = readFileSync('tests/e2e/fixtures/shared/description/dataObjects/btl-distances.md', 'utf8');

const documents = [
  ...elementDocuments(config),
  descriptionDocument('dataObjects/btl-distances.md', markdown)!,
  ...columnDocuments('btl-distances', config.dataObjects['btl-distances'], schema, 1702279427),
];

function index() {
  const mini = new MiniSearch(SEARCH_INDEX_OPTIONS as any);
  mini.addAll(documents);
  return mini;
}

const search = (q: string) => index().search(q, SEARCH_QUERY_OPTIONS as any);
const ids = (q: string) => search(q).map(r => r.id as string);

test('a tag finds its element - the case issue #15 opens with', () => {
  expect(ids('aviation')).toContain('e:dataObjects:int-airports');
});

test('a layer and a subject area are searchable', () => {
  expect(ids('integration')).toContain('e:dataObjects:int-airports');
  expect(ids('airports')).toContain('e:dataObjects:int-airports');
});

test('description prose is searchable, which the old filters could not do', () => {
  expect(ids('merging')).toContain('e:actions:join-departures-airports');
});

test('a description document is found by its body alone', () => {
  const hits = ids('rail');
  expect(hits).toContain('d:dataObjects/btl-distances.md');
});

test('a column is found by its name and by its configured description', () => {
  expect(ids('could_be_done_by_rail')).toContain('c:btl-distances:could_be_done_by_rail');
  expect(ids('sphere')).toContain('c:btl-distances:distance');
});

test('an element outranks a column matching the same term', () => {
  const hits = search('distances');
  const element = hits.findIndex(h => h.id === 'e:dataObjects:btl-distances');
  const column = hits.findIndex(h => (h.id as string).startsWith('c:'));
  expect(element).toBeGreaterThanOrEqual(0);
  if (column >= 0) expect(element).toBeLessThan(column);
});

test('the id is weighted above the body, so typing an id puts it first', () => {
  expect(search('int-airports')[0].id).toBe('e:dataObjects:int-airports');
});

test('only the word being typed is prefix matched, so a half-typed word still finds things', () => {
  expect(ids('aviat')).toContain('e:dataObjects:int-airports');
  // a complete earlier word is not prefix matched: "avi" alone would otherwise match everything
  expect(ids('aviation airpor')).toContain('e:dataObjects:int-airports');
});

test('terms are combined with AND, so an unrelated second word narrows to nothing', () => {
  expect(ids('aviation zzzznotaword')).toEqual([]);
});

test('a typo is tolerated on a long word but not on a short one', () => {
  expect(ids('aviatoin')).toContain('e:dataObjects:int-airports');
});

test('the matched fields are reported, so the palette can say why a hit is there', () => {
  const hit = search('aviation').find(h => h.id === 'e:dataObjects:int-airports')!;
  const fields = [...new Set(Object.values(hit.match).flat())];
  expect(fields).toContain('tags');
  expect(Object.keys(hit.match)).toContain('aviation');
});

test('documents sharing an element id but not a kind both survive', () => {
  const all = index().search('btl-distances', { ...SEARCH_QUERY_OPTIONS, prefix: true } as any).map(r => r.id);
  expect(all).toContain('e:dataObjects:btl-distances');
  expect(all).toContain('d:dataObjects/btl-distances.md');
});

test('stored fields carry everything the result list renders, and nothing more', () => {
  const hit = search('aviation').find(h => h.id === 'e:dataObjects:int-airports')! as any;
  expect(hit.kind).toBe('element');
  expect(hit.elementType).toBe('dataObjects');
  expect(hit.snippet).toBeTruthy();
  // the catch-all body is indexed but not stored - it is the bulk of the index
  expect(hit.body).toBeUndefined();
});

test('a serialized index round trips through loadJS with the same options', () => {
  const built = index();
  const restored = MiniSearch.loadJS(JSON.parse(JSON.stringify(built)) as any, SEARCH_INDEX_OPTIONS as any);
  const before = built.search('aviation', SEARCH_QUERY_OPTIONS as any).map(r => [r.id, r.score]);
  const after = restored.search('aviation', SEARCH_QUERY_OPTIONS as any).map(r => [r.id, r.score]);
  expect(after).toEqual(before);
});

test('nothing from a workflow run is indexed - state files are out of scope', () => {
  expect(documents.every(d => d.kind !== 'element' || !d.docId.includes('runId'))).toBe(true);
  expect(ids('SUCCEEDED')).toEqual([]);
});
