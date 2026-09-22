# Global search

The search box in the title bar (`src/layouts/Header.tsx`), and the palette behind it. It
searches one configuration version: its elements, the description documents, and the schema
columns with their descriptions. Workflow runs and state files are deliberately out of scope
([issue #15](https://github.com/smart-data-lake/sdl-visualization/issues/15)).

```
Header.tsx
└── GlobalSearchButton      the fake input and the ctrl/cmd+K listener
    └── SearchPalette       modal, query state, keyboard navigation, navigation on select
        ├── SearchResultItem   one row: icon, title, subtitle, snippet, matched field
        └── SearchStatusFooter what the search can currently see
```

## Why a modal and not a dropdown

The header is `zIndex: 10000`. Joy's popper-based components portal to `document.body` at
`--joy-zIndex-popup` (1000), so a listbox anchored in the header paints *underneath* it -
`Authentication.tsx` already carries a manual override for the same reason. A modal needs the
override in one place, and a 45px bar has no room for grouped results with snippets anyway.

## Narrowing a query

A query may start with a known `<scope>:` prefix, which is taken off before searching
(`parseQuery` in `searchIndex.ts`, table in `SEARCH_SCOPES`). Two kinds of scope:

- **by document kind** — `do:` / `dataObjects:`, `action:`, `connection:`, `element:`,
  `description:` / `doc:`, `column:` / `col:`. Applied as MiniSearch's `filter`.
- **by field** — `id:`, `name:`, `type:`, `layer:`, `area:` / `subjectArea:`, `feed:`,
  `tag:`, `body:`. Applied as MiniSearch's `fields`.

Only those words are consumed, so `http://example.com` or `default.int_airports` is searched
as typed rather than read as a scope. The prefixes are listed in the palette's empty state,
which is the only place they are discoverable, and the active scope shows as a chip in the
footer.

## Where the searching happens

In the browser, over an index fetched once per configuration version. There is no search
endpoint: `MiniSearch.loadJSAsync` turns the fetched bundle into an index and every keystroke
is a local query.

The bundle is `{meta, index}`, and both producers write it: `POST /api/v1/search/index` on the
backend, and `scripts/buildSearchIndex.ts` for a statically served project. The metadata is in
the body rather than a response header on purpose - a custom header is invisible to a
cross-origin browser unless the server exposes it, and that failure would be silent.

- `src/util/ConfigExplorer/searchDocuments.ts` - the documents and the MiniSearch options.
  **Mirrored by `backend/src/domain/search.ts`**, parity-tested; change the pair together.
- `src/util/ConfigExplorer/searchIndex.ts` - parsing, the module-level cache of parsed
  indexes, grouping and the hit model.
- `src/hooks/useSearchIndex.tsx` - fetching, the fallback, and `useGlobalSearch`.

The options have two halves on purpose. `SEARCH_INDEX_OPTIONS` has to be identical to what the
index was built with, because `loadJS` fails *silently* against a mismatch - hence
`SEARCH_SCHEMA_VERSION`, which is written into the index metadata and refused when it differs.
`SEARCH_QUERY_OPTIONS` is query time only: `boostDocument` is a function and cannot be
serialized, and it reads `kind`, which is why `kind` is in `storeFields`.

## When there is no index

A normal state, not an error: the index is only ever produced by an explicit rebuild
(`POST /api/v1/search/index`), and a statically served project only has one if someone ran
`yarn build:search-index`. The search then falls back to indexing the configuration in the
browser, which covers the elements but neither descriptions nor columns - those live in
per-element files a query cannot afford to fetch one by one. The footer says so.

The same fallback is the loading state, so typing works from the moment the palette opens and
the results get richer when the index lands.

Do not try to "fix" the fallback by crawling: `fetchAPI_local_statefiles` has no description
listing at all, only per-element `getDescription`.

## Two things that are easy to break

**Every query this makes must be a quiet one.** `handleError` in `useFetchData.tsx` rethrows,
and `ErrorBoundary` is the `errorElement` of the root route - so anything thrown from a hook
used here replaces the whole page. That is why `useFetchSearchIndex`, `useFetchConfigQuiet`
and `useFetchConfigVersionsQuiet` exist, and why `parseSearchIndex` refuses rather than throws.

**A column hit carries the schema export it was indexed from** (`?column=…&tstamp=…`), and
`SchemaTab` selects that export rather than its own default. Columns come from the newest
export of each data object, taken as it is: where that export failed it carries an error and
no columns, and the data object simply has none in the index. Only data objects the
configuration version contains are indexed at all.
