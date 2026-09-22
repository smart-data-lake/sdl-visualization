import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "react-query";
import type MiniSearch from "minisearch";
import { fetcher } from "../api/Fetcher";
import type { SearchIndexMeta } from "../api/fetchAPI";
import type { SearchDocument } from "../util/ConfigExplorer/searchDocuments";
import {
  buildFallbackIndex, indexCacheKey, parseQuery, parseSearchIndex, refusalFor, runSearch,
  type IndexRefusal, type SearchGroup, type SearchHit, type SearchScope,
} from "../util/ConfigExplorer/searchIndex";
import { useFetchConfigQuiet, useFetchConfigVersionsQuiet, useFetchSearchIndex } from "./useFetchData";
import { useConfigVersion } from "./useConfigVersion";
import { useWorkspace } from "./useWorkspace";

/*
  The index behind the global search.

  Every query here is a quiet one: this is consumed from the title bar, and a hook that
  rethrows there would replace the whole page through the ErrorBoundary.

  While the real index is being fetched and parsed the configuration-only fallback answers,
  so typing works from the moment the palette opens and the results get richer when the
  index lands. That makes the fallback the loading state as well as the degraded one.
*/

export type SearchCoverage = 'full' | 'configOnly' | 'loading' | 'none';

export interface SearchIndexState {
  index: MiniSearch<SearchDocument> | undefined;
  coverage: SearchCoverage;
  meta: SearchIndexMeta | undefined;
  reason: IndexRefusal | 'noIndex' | 'error' | undefined;
}

const searchIndexKey = (tenant?: string, repo?: string, env?: string, version?: string) =>
  ["searchIndex", tenant, repo, env, version];

/** Arms the query on hover or focus of the trigger, so the common path rarely sees the fallback. */
export function useSearchIndexPrefetch(): () => void {
  const queryClient = useQueryClient();
  const { tenant, repo, env } = useWorkspace();
  const { version } = useConfigVersion();
  const { data: versions } = useFetchConfigVersionsQuiet(false);
  const effective = version ?? versions?.[0];

  return () => {
    queryClient.prefetchQuery({
      queryKey: searchIndexKey(tenant, repo, env, effective),
      queryFn: () => fetcher().getSearchIndex?.(tenant!, repo!, env!, effective) ?? Promise.resolve(undefined),
      retry: false,
      staleTime: 1000 * 60 * 60 * 24,
    });
  };
}

export function useSearchIndex(enabled: boolean): SearchIndexState {
  const { tenant, repo, env } = useWorkspace();
  const { version } = useConfigVersion();
  const { data: versions } = useFetchConfigVersionsQuiet(enabled);
  // the palette is reachable from the workflows explorer too, where no version was ever selected
  const effectiveVersion = version ?? versions?.[0];

  const { data: bundle, isError, isFetching } = useFetchSearchIndex(effectiveVersion, enabled);
  const { data: configData } = useFetchConfigQuiet(effectiveVersion, enabled);

  const key = indexCacheKey(tenant, repo, env, effectiveVersion);
  // the parsed index is tagged with the key it belongs to, so a workspace switch cannot show a stale one
  const [loaded, setLoaded] = useState<{ key: string; index: MiniSearch<SearchDocument> | undefined }>();

  useEffect(() => {
    let cancelled = false;
    if (bundle) {
      parseSearchIndex(key, bundle).then((index) => { if (!cancelled) setLoaded({ key, index }); });
    }
    return () => { cancelled = true; };
  }, [key, bundle]);

  const index = loaded?.key === key ? loaded.index : undefined;

  const fallback = useMemo(() => (configData ? buildFallbackIndex(configData) : undefined), [configData]);

  if (index) return { index, coverage: 'full', meta: bundle?.meta, reason: undefined };

  const reason: SearchIndexState['reason'] =
    refusalFor(key) ?? (isError ? 'error' : (!isFetching && !bundle ? 'noIndex' : undefined));
  if (fallback) return { index: fallback, coverage: reason ? 'configOnly' : 'loading', meta: undefined, reason };
  return { index: undefined, coverage: isFetching ? 'loading' : 'none', meta: undefined, reason };
}

export interface GlobalSearchState {
  groups: SearchGroup[];
  flat: SearchHit[];
  status: 'empty' | 'loading' | 'noHits' | 'ok';
  coverage: SearchCoverage;
  meta: SearchIndexMeta | undefined;
  reason: SearchIndexState['reason'];
  /** the query with its scope prefix removed, and the scope it named */
  text: string;
  scope: SearchScope | undefined;
}

export function useGlobalSearch(query: string, enabled: boolean): GlobalSearchState {
  const { contentPath } = useWorkspace();
  const { index, coverage, meta, reason } = useSearchIndex(enabled);

  const { groups, flat } = useMemo(
    () => runSearch(index, query, contentPath ?? '/'),
    [index, query, contentPath],
  );

  // the scope prefix is not part of what was searched, so "do:" alone is an empty query
  const { text, scope } = useMemo(() => parseQuery(query), [query]);

  const status = text.length < 2 ? 'empty'
    : flat.length > 0 ? 'ok'
    : coverage === 'loading' || coverage === 'none' ? 'loading'
    : 'noHits';

  return { groups, flat, status, coverage, meta, reason, text, scope };
}
