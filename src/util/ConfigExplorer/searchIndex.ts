import MiniSearch, { type SearchResult } from 'minisearch';
import type { SearchIndexBundle } from '../../api/fetchAPI';
import { ConfigData } from './ConfigData';
import {
  elementDocuments, routeOf, SEARCH_INDEX_OPTIONS, SEARCH_QUERY_OPTIONS, SEARCH_SCHEMA_VERSION,
  type DocumentKind, type SearchDocument,
} from './searchDocuments';

/**
 * Loading and querying the global search index in the browser.
 *
 * The parsed MiniSearch is kept here rather than in react-query: it is a large mutable
 * object graph, and react-query compares and serializes what it caches. react-query holds
 * the fetched bundle, this holds what was made of it.
 */

/** Above this the tab would stall on parsing, so the search falls back to the configuration. */
export const MAX_INDEX_BYTES = 8 * 1024 * 1024;

export type IndexRefusal = 'tooLarge' | 'schemaMismatch' | 'unreadable';

const parsed = new Map<string, MiniSearch<SearchDocument>>();
const refusals = new Map<string, IndexRefusal>();

export function indexCacheKey(tenant?: string, repo?: string, env?: string, version?: string): string {
  return `${tenant}/${repo}/${env}/${version}`;
}

export function refusalFor(key: string): IndexRefusal | undefined {
  return refusals.get(key);
}

export function clearSearchIndexCache(): void {
  parsed.clear();
  refusals.clear();
}

/**
 * Parse a fetched bundle once per key, refusing rather than throwing: a search box in the
 * title bar must never be able to take the page down.
 */
export async function parseSearchIndex(
  key: string,
  bundle: SearchIndexBundle | undefined,
): Promise<MiniSearch<SearchDocument> | undefined> {
  if (!bundle?.index) return undefined;
  const cached = parsed.get(key);
  if (cached) return cached;

  // loadJS is silent about options that do not match the ones the index was built with
  if (bundle.meta?.schemaVersion !== SEARCH_SCHEMA_VERSION) {
    refusals.set(key, 'schemaMismatch');
    return undefined;
  }
  if ((bundle.meta.sizeBytes ?? 0) > MAX_INDEX_BYTES) {
    refusals.set(key, 'tooLarge');
    return undefined;
  }

  try {
    const index = await MiniSearch.loadJSAsync<SearchDocument>(bundle.index as any, SEARCH_INDEX_OPTIONS as any);
    parsed.set(key, index);
    refusals.delete(key);
    return index;
  } catch (error) {
    console.warn('the search index could not be loaded', error);
    refusals.set(key, 'unreadable');
    return undefined;
  }
}

/**
 * The configuration on its own, indexed in the browser. This is what the search falls back
 * to where no index was built - it covers the elements but neither descriptions nor columns,
 * both of which live in per-element files a query cannot afford to fetch.
 */
const fallbacks = new WeakMap<ConfigData, MiniSearch<SearchDocument>>();

export function buildFallbackIndex(config: ConfigData): MiniSearch<SearchDocument> {
  const cached = fallbacks.get(config);
  if (cached) return cached;
  const index = new MiniSearch<SearchDocument>(SEARCH_INDEX_OPTIONS as any);
  index.addAll(elementDocuments(config as any));
  fallbacks.set(config, index);
  return index;
}

/* ------------------------------------------------------------------- results */

export const GROUPS: { title: string; kind: DocumentKind; elementType?: string }[] = [
  { title: 'Data Objects', kind: 'element', elementType: 'dataObjects' },
  { title: 'Actions', kind: 'element', elementType: 'actions' },
  { title: 'Connections', kind: 'element', elementType: 'connections' },
  { title: 'Descriptions', kind: 'description' },
  { title: 'Columns', kind: 'column' },
];

export const HITS_PER_GROUP = 5;
export const HITS_TOTAL = 25;

export interface SearchHit {
  docId: string;
  kind: DocumentKind;
  group: string;
  title: string;
  subtitle: string;
  snippet?: string;
  /** the terms that actually matched, for highlighting */
  terms: string[];
  /** the fields they matched in, so the list can say why a hit is there */
  fields: string[];
  score: number;
  to: string;
}

export function toHit(result: SearchResult, contentPath: string): SearchHit {
  const doc = result as unknown as SearchDocument;
  const kind = doc.kind;
  const group = GROUPS.find((g) => g.kind === kind && (!g.elementType || g.elementType === doc.elementType));
  const column = kind === 'column';
  const route = routeOf(doc);
  return {
    docId: doc.docId,
    kind,
    group: group?.title ?? 'Other',
    // not doc.id: MiniSearch reports its idField, which here is the docId, not the element id
    title: (column ? doc.columnPath : doc.name || doc.elementId) ?? doc.docId,
    subtitle: subtitleOf(doc),
    snippet: doc.snippet,
    terms: Object.keys(result.match ?? {}),
    fields: [...new Set(Object.values(result.match ?? {}).flat())] as string[],
    score: result.score,
    // the tstamp matters: the newest export of a data object is often a failed one, and the
    // index was built from the newest that actually had columns
    to: `${contentPath}config/${route}`
      + (column ? `?column=${encodeURIComponent(doc.columnPath!)}` + (doc.tstamp ? `&tstamp=${doc.tstamp}` : '') : ''),
  };
}

function subtitleOf(doc: SearchDocument): string {
  if (doc.kind === 'column') return `${doc.elementId} · ${doc.type ?? ''}`.trim();
  if (doc.kind === 'description') return doc.filename ?? '';
  return [doc.elementId, doc.type, doc.layer].filter(Boolean).join(' · ');
}

export interface SearchGroup { title: string; hits: SearchHit[]; more: number }

/** Groups in a fixed order, so the list does not reshuffle itself between keystrokes. */
export function groupHits(results: SearchResult[], contentPath: string): { groups: SearchGroup[]; flat: SearchHit[] } {
  const hits = results.map((result) => toHit(result, contentPath));
  const groups: SearchGroup[] = [];
  let taken = 0;
  for (const { title } of GROUPS) {
    const all = hits.filter((hit) => hit.group === title);
    if (all.length === 0) continue;
    const room = Math.max(0, Math.min(HITS_PER_GROUP, HITS_TOTAL - taken));
    if (room === 0) continue;
    groups.push({ title, hits: all.slice(0, room), more: Math.max(0, all.length - room) });
    taken += Math.min(room, all.length);
  }
  return { groups, flat: groups.flatMap((group) => group.hits) };
}

/* ------------------------------------------------------------------- scoping */

export interface SearchScope {
  /** what the palette calls it */
  label: string;
  /** restricts the kind of document, and for an element its type */
  kind?: DocumentKind;
  elementType?: string;
  /** restricts which fields are searched */
  fields?: string[];
}

/**
 * The prefixes a query can start with to narrow itself, e.g. "do:airports" or "tag:aviation".
 * Only these words are consumed, so a query that merely contains a colon - a URL, a
 * qualified table name - is searched as typed.
 */
export const SEARCH_SCOPES: Record<string, SearchScope> = {
  // by kind
  dataobjects: { label: 'Data Objects', kind: 'element', elementType: 'dataObjects' },
  dataobject: { label: 'Data Objects', kind: 'element', elementType: 'dataObjects' },
  do: { label: 'Data Objects', kind: 'element', elementType: 'dataObjects' },
  actions: { label: 'Actions', kind: 'element', elementType: 'actions' },
  action: { label: 'Actions', kind: 'element', elementType: 'actions' },
  connections: { label: 'Connections', kind: 'element', elementType: 'connections' },
  connection: { label: 'Connections', kind: 'element', elementType: 'connections' },
  elements: { label: 'Elements', kind: 'element' },
  element: { label: 'Elements', kind: 'element' },
  descriptions: { label: 'Descriptions', kind: 'description' },
  description: { label: 'Descriptions', kind: 'description' },
  docs: { label: 'Descriptions', kind: 'description' },
  doc: { label: 'Descriptions', kind: 'description' },
  columns: { label: 'Columns', kind: 'column' },
  column: { label: 'Columns', kind: 'column' },
  col: { label: 'Columns', kind: 'column' },
  // by field
  id: { label: 'id', fields: ['id'] },
  name: { label: 'name', fields: ['name'] },
  type: { label: 'type', fields: ['type'] },
  layer: { label: 'layer', fields: ['layer'] },
  subjectarea: { label: 'subject area', fields: ['subjectArea'] },
  area: { label: 'subject area', fields: ['subjectArea'] },
  feed: { label: 'feed', fields: ['feed'] },
  tag: { label: 'tag', fields: ['tags'] },
  tags: { label: 'tag', fields: ['tags'] },
  body: { label: 'body', fields: ['body'] },
};

export interface ParsedQuery { text: string; scope?: SearchScope }

/** Splits a leading, known "<scope>:" off a query. Anything else is left alone. */
export function parseQuery(query: string): ParsedQuery {
  const match = /^\s*([a-zA-Z]+)\s*:\s*([\s\S]*)$/.exec(query);
  if (!match) return { text: query.trim() };
  const scope = SEARCH_SCOPES[match[1].toLowerCase()];
  return scope ? { text: match[2].trim(), scope } : { text: query.trim() };
}

export function runSearch(
  index: MiniSearch<SearchDocument> | undefined,
  query: string,
  contentPath: string,
): { groups: SearchGroup[]; flat: SearchHit[] } {
  const { text, scope } = parseQuery(query);
  if (!index || text.length < 2) return { groups: [], flat: [] };

  const options: any = { ...SEARCH_QUERY_OPTIONS };
  if (scope?.fields) options.fields = scope.fields;
  if (scope?.kind) {
    options.filter = (result: any) =>
      result.kind === scope.kind && (!scope.elementType || result.elementType === scope.elementType);
  }
  return groupHits(index.search(text, options), contentPath);
}
