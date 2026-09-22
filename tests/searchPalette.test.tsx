// @vitest-environment jsdom
/**
 * The search palette: grouping, keyboard navigation, and what it says when it can only
 * see part of the configuration.
 *
 * The index itself is stubbed - what it finds is covered by searchQuery/searchIndex. What
 * matters here is that a hit navigates where it says it does, and that reduced coverage is
 * stated rather than looking like an empty result.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { SearchHit } from '../src/util/ConfigExplorer/searchIndex.ts';

afterEach(cleanup);

const hit = (docId: string, group: string, title: string, to: string): SearchHit => ({
  docId, group, title, to, kind: group === 'Descriptions' ? 'description' : group === 'Columns' ? 'column' : 'element',
  subtitle: 'sub', snippet: 'a snippet', terms: ['air'], fields: ['tags'], score: 1,
});

const navigated: string[] = [];
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => (to: string) => navigated.push(to),
}));

// what useGlobalSearch would return; mutable so each test can set the state it is about
let state: any;
vi.mock('../src/hooks/useSearchIndex', () => ({
  useGlobalSearch: () => state,
  useSearchIndexPrefetch: () => () => undefined,
}));

beforeEach(() => {
  navigated.length = 0;
  state = {
    groups: [
      { title: 'Data Objects', hits: [hit('e:dataObjects:int-airports', 'Data Objects', 'Airport locations', '/config/dataObjects/int-airports/configuration')], more: 0 },
      { title: 'Descriptions', hits: [hit('d:dataObjects/btl.md', 'Descriptions', 'Distances', '/config/dataObjects/btl-distances/description')], more: 2 },
      { title: 'Columns', hits: [hit('c:btl:distance', 'Columns', 'distance', '/config/dataObjects/btl-distances/schema?column=distance')], more: 0 },
    ],
    flat: [],
    status: 'ok', coverage: 'full', meta: { documentCount: 43, builtAt: new Date().toISOString() }, reason: undefined,
  };
  state.flat = state.groups.flatMap((g: any) => g.hits);
});

async function open() {
  const { default: SearchPalette } = await import('../src/components/Search/SearchPalette.tsx');
  const onClose = vi.fn();
  render(<MemoryRouter><SearchPalette onClose={onClose} /></MemoryRouter>);
  await userEvent.type(screen.getByTestId('search-input').querySelector('input')!, 'air');
  return onClose;
}

test('results are grouped, in the fixed order', async () => {
  await open();
  await waitFor(() => expect(screen.getAllByTestId('search-result').length).toBe(3));
  const headings = ['Data Objects', 'Descriptions', 'Columns'];
  for (const heading of headings) expect(screen.getByText(heading)).toBeDefined();
});

test('enter opens the highlighted hit, and the arrows move the highlight', async () => {
  await open();
  await waitFor(() => expect(screen.getAllByTestId('search-result').length).toBe(3));

  await userEvent.keyboard('{Enter}');
  expect(navigated).toEqual(['/config/dataObjects/int-airports/configuration']);

  navigated.length = 0;
  await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
  expect(navigated).toEqual(['/config/dataObjects/btl-distances/schema?column=distance']);
});

test('the arrows stop at the ends rather than wrapping past them', async () => {
  await open();
  await waitFor(() => expect(screen.getAllByTestId('search-result').length).toBe(3));
  await userEvent.keyboard('{ArrowUp}{ArrowUp}{Enter}');
  expect(navigated).toEqual(['/config/dataObjects/int-airports/configuration']);
});

test('escape closes without navigating', async () => {
  const onClose = await open();
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalled();
  expect(navigated).toEqual([]);
});

test('a truncated group says how many it is not showing', async () => {
  await open();
  await waitFor(() => expect(screen.getByText(/\+2 more/)).toBeDefined());
});

test('a built index is reported with its size and age', async () => {
  await open();
  await waitFor(() => expect(screen.getByTestId('search-coverage').textContent).toContain('43 documents'));
});

test('without an index the reduced coverage is stated, not left to look like no hits', async () => {
  state = { ...state, coverage: 'configOnly', reason: 'noIndex', meta: undefined };
  await open();
  await waitFor(() => {
    expect(screen.getByTestId('search-coverage').textContent).toContain('Configuration only');
    expect(screen.getByTestId('search-coverage').textContent).toContain('no search index has been built');
  });
});

test('an index too large to load says so, rather than blaming the configuration', async () => {
  state = { ...state, coverage: 'configOnly', reason: 'tooLarge', meta: undefined };
  await open();
  await waitFor(() => expect(screen.getByTestId('search-coverage').textContent).toContain('too large'));
});

test('no hits is a message of its own, distinct from not having searched yet', async () => {
  state = { ...state, groups: [], flat: [], status: 'noHits' };
  await open();
  await waitFor(() => expect(screen.getByText(/No results for/)).toBeDefined());
});

test('before anything is typed the palette says what it searches', async () => {
  state = { ...state, groups: [], flat: [], status: 'empty' };
  const { default: SearchPalette } = await import('../src/components/Search/SearchPalette.tsx');
  render(<MemoryRouter><SearchPalette onClose={vi.fn()} /></MemoryRouter>);
  expect(screen.getByText(/Type at least two characters/)).toBeDefined();
});
