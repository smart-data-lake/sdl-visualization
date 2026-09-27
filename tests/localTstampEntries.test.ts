/**
 * How the local fetcher finds the versions of a schema, stats or lineage export: SDLB's
 * `localfile:` writer keeps an index, every other target writes one unversioned file.
 */
import { afterEach, expect, test, vi } from 'vitest';
import { fetchAPI_local_statefiles } from '../src/api/fetchAPI_local_statefiles';

function serve(files: Record<string, string>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => files[url] !== undefined
    ? new Response(files[url])
    : new Response('<!DOCTYPE html><html></html>'))); // vite's SPA fallback for a missing file
}

afterEach(() => { vi.unstubAllGlobals(); });

const api = () => new fetchAPI_local_statefiles('', undefined, undefined);

test('the index lists the versions, newest first', async () => {
  serve({ '/schema/a.lineage.index': 'a.lineage.100.json\na.lineage.200.json\n' });
  const entries = await api().getTstampEntries('schema', 'lineage', 'a', '', '', '');
  expect(entries?.map((e) => e.key)).toEqual(['a.lineage.200.json', 'a.lineage.100.json']);
  expect(entries?.[0].tstamp).toEqual(new Date(200_000));
});

test('without an index the unversioned file is the one latest entry', async () => {
  serve({ '/schema/a.lineage.json': '{}' });
  const entries = await api().getTstampEntries('schema', 'lineage', 'a', '', '', '');
  expect(entries).toEqual([{ key: 'a.lineage.json', elementName: 'a' }]);
});

test('an empty index falls back too', async () => {
  serve({ '/schema/a.stats.index': '\n', '/schema/a.stats.json': '{}' });
  expect((await api().getTstampEntries('schema', 'stats', 'a', '', '', ''))?.[0].key).toBe('a.stats.json');
});

test('neither is no entries', async () => {
  serve({});
  expect(await api().getTstampEntries('schema', 'schema', 'a', '', '', '')).toBeUndefined();
});
