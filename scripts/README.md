# scripts

Node scripts that are part of the build but not of the app bundle. Run with Node 24
(`.nvmrc`), which strips the types natively, so imports carry explicit `.ts` extensions.

## buildSearchIndex.ts

Builds the global search index for a statically served project — the `local;` and `exported`
backend modes, which have no backend to build one for them. `yarn build:search-index`, and
`build_index.sh` runs it after the Python step (non-fatally: without an index the search
covers the configuration only).

```bash
node scripts/buildSearchIndex.ts --public public --env dev
node scripts/buildSearchIndex.ts --public tests/e2e/fixtures/exported \
  --description tests/e2e/fixtures/shared/description \
  --schema tests/e2e/fixtures/shared/schema \
  --out tests/e2e/fixtures/exported/search/index.json
```

`--public` (default `public`) is the served root; `--config`, `--description`, `--schema` and
`--out` override the paths derived from it; `--env` names the `envConfig/{env}.conf` to include
when parsing HOCON; `--version` is written into the index metadata.

It reads `exportedConfig.json` where SDLB wrote one, and otherwise parses the HOCON files —
the parser runs under plain Node with its own `file` source, whereas the browser remaps that
source to `http` (`patches/`, `HoconParser.ts`). **The two are not equivalent:** `_sourceDoc`
and `_origin` are written by SDLB's config exporter and simply do not
exist in HOCON, so an index built from HOCON covers less. The script says so on stdout.

For schemas it takes the **newest export of each data object the configuration contains**,
as it is. A failed export carries only an error message and no columns, and that data object
then has none in the index - reaching back to an older export would describe columns that may
no longer exist.

It shares `src/util/ConfigExplorer/searchDocuments.ts` with the app and with the backend, so
the documents and the MiniSearch options are the same wherever the index is built. That module
must therefore stay free of React, the DOM and browser globals.
