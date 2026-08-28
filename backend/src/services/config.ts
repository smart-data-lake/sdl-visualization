import { TABLES, listPartition, truncate, upsert, upsertBatch } from '../store/tables.js';
import { keys, versionKey, type Scope } from '../store/keys.js';
import { blobPaths, readJson, writeJson } from '../store/blobs.js';
import { ELEMENT_TYPES, type ConfigJson, type ElementType } from '../domain/types.js';
import { actionIds, buildFullGraph, DAGraph } from '../domain/graph.js';
import { ConfigDataLists_, applyFilter, type SearchType } from '../domain/filter.js';
import { leafValues } from '../domain/helpers.js';
import { registerScope } from './scope.js';
import { notFound } from '../errors.js';

/**
 * Everything about a configuration version: storing one, reading one back, and
 * answering questions about it.
 *
 * Search runs in process, over the configuration blob, not over the table. Table
 * Storage has no substring or regex filter, and the semantics the UI offers -
 * property-path regex, the feedSel grammar - cannot be expressed in OData at all.
 * A configuration is hundreds to a few thousand elements, so loading it and running
 * the ported filters gives exact parity with the config explorer at a cost that does
 * not matter. The ConfigElements table is the index for the questions that should
 * not have to materialise the whole configuration.
 */

export interface ConfigVersionEntity {
  partitionKey: string;
  rowKey: string;
  createdAt: string;
  blobPath: string;
  numDataObjects: number;
  numActions: number;
  numConnections: number;
}

export interface ConfigElementEntity {
  partitionKey: string;
  rowKey: string;
  id: string;
  elementType: ElementType;
  type?: string;
  name?: string;
  layer?: string;
  subjectArea?: string;
  feed?: string;
  tags?: string;
  connectionId?: string;
  inputIds?: string;
  outputIds?: string;
  path?: string;
  tableFullName?: string;
  originPath?: string;
  originLine?: number;
  descriptionSnippet?: string;
  /** Every leaf value, lowercased, for cheap containment without loading the blob. */
  searchText?: string;
}

export interface ElementEntity {
  partitionKey: string;
  rowKey: string;
  lastVersion: string;
  lastSeenAt: string;
  type?: string;
  layer?: string;
}

/* ------------------------------------------------------------------ writing */

export async function putConfig(scope: Scope, version: string, config: ConfigJson): Promise<void> {
  const path = blobPaths.config(scope, version);
  await writeJson(path, config);

  const dataObjects = config.dataObjects ?? {};
  const actions = config.actions ?? {};
  const connections = config.connections ?? {};

  const versionEntity: ConfigVersionEntity = {
    partitionKey: keys.configVersions(scope),
    rowKey: versionKey(version),
    createdAt: new Date().toISOString(),
    blobPath: path,
    numDataObjects: Object.keys(dataObjects).length,
    numActions: Object.keys(actions).length,
    numConnections: Object.keys(connections).length,
  };
  await upsert(TABLES.configVersions, versionEntity);

  const elements: ConfigElementEntity[] = [];
  const latest: ElementEntity[] = [];
  const now = new Date().toISOString();

  for (const elementType of ELEMENT_TYPES) {
    for (const [id, element] of Object.entries(config[elementType] ?? {})) {
      elements.push(projectElement(scope, version, elementType, id, element));
      latest.push({
        partitionKey: keys.elements(scope, elementType),
        rowKey: id,
        lastVersion: version,
        lastSeenAt: now,
        type: element?.type,
        layer: element?.metadata?.layer,
      });
    }
  }

  await upsertBatch(TABLES.configElements, elements);
  await upsertBatch(TABLES.elements, latest);
  await registerScope(scope);
  invalidate(scope, version);
}

function projectElement(
  scope: Scope,
  version: string,
  elementType: ElementType,
  id: string,
  element: any,
): ConfigElementEntity {
  const metadata = element?.metadata ?? {};
  const { inputIds, outputIds } = elementType === 'actions' ? actionIds(element ?? {}) : { inputIds: [], outputIds: [] };
  const table = element?.table;
  return {
    partitionKey: keys.configElements(scope, version),
    rowKey: `${elementType}|${id}`,
    id,
    elementType,
    type: element?.type,
    name: metadata.name,
    layer: metadata.layer,
    subjectArea: metadata.subjectArea,
    feed: metadata.feed,
    tags: metadata.tags ? JSON.stringify(metadata.tags) : undefined,
    connectionId: element?.connectionId,
    inputIds: inputIds.length ? JSON.stringify(inputIds) : undefined,
    outputIds: outputIds.length ? JSON.stringify(outputIds) : undefined,
    path: typeof element?.path === 'string' ? element.path : undefined,
    tableFullName: table ? [table.catalog, table.db, table.name].filter(Boolean).join('.') : undefined,
    originPath: element?._origin?.path,
    originLine: element?._origin?.lineNumber,
    descriptionSnippet: truncate(metadata.description, 2_000),
    searchText: truncate(leafValues(element).join(' '), 30_000),
  };
}

/* ------------------------------------------------------------------ reading */

export async function configVersions(scope: Scope): Promise<string[]> {
  const entities = await listPartition<ConfigVersionEntity>(
    TABLES.configVersions,
    keys.configVersions(scope),
  );
  return entities.map((e) => e.rowKey);
}

/** The most recent version, preferring the literal "latest" SDLB writes by default. */
export async function resolveVersion(scope: Scope, version?: string): Promise<string> {
  if (version) return version;
  const available = await configVersions(scope);
  if (available.includes('latest')) return 'latest';
  const sorted = [...available].sort();
  const newest = sorted[sorted.length - 1];
  if (!newest) throw notFound('configuration');
  return newest;
}

/**
 * The configuration blob, memoised per version.
 *
 * Every search, lineage query and element lookup reads it, so a per-instance cache
 * turns a burst of MCP tool calls into one blob download. Configurations are
 * immutable once written under a version - except "latest", which SDLB overwrites,
 * which is why putConfig invalidates the entry it just replaced.
 */
const cache = new Map<string, { config: ConfigJson; graph: DAGraph; lists: ConfigDataLists_ }>();
const CACHE_LIMIT = 8;

function cacheKey(scope: Scope, version: string): string {
  return `${scope.repo}|${scope.env}|${version}`;
}

function invalidate(scope: Scope, version: string): void {
  cache.delete(cacheKey(scope, version));
}

export function clearConfigCache(): void {
  cache.clear();
}

async function load(scope: Scope, version: string) {
  const key = cacheKey(scope, version);
  const hit = cache.get(key);
  if (hit) return hit;

  const config = await readJson<ConfigJson>(blobPaths.config(scope, version));
  if (!config) throw notFound(`configuration version "${version}"`);

  const entry = {
    config,
    graph: buildFullGraph(config).graph,
    lists: new ConfigDataLists_(config),
  };
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, entry);
  return entry;
}

export async function getConfig(scope: Scope, version: string): Promise<ConfigJson> {
  return (await load(scope, version)).config;
}

export async function getGraph(scope: Scope, version: string): Promise<DAGraph> {
  return (await load(scope, version)).graph;
}

export interface SearchHit {
  id: string;
  kind: ElementType;
  type?: string;
  name?: string;
  layer?: string;
  feed?: string;
  snippet?: string;
  source?: string;
}

/** The config explorer's search, verbatim, so an agent and a user get the same answer. */
export async function searchConfig(
  scope: Scope,
  version: string,
  query: string,
  searchType: SearchType,
  kind?: ElementType,
  limit = 50,
): Promise<{ hits: SearchHit[]; total: number }> {
  const { lists } = await load(scope, version);
  const filtered = applyFilter(lists, { text: query, type: searchType });

  const all: SearchHit[] = [];
  for (const elementType of ELEMENT_TYPES) {
    if (kind && kind !== elementType) continue;
    for (const element of filtered[elementType]) all.push(toHit(elementType, element));
  }
  return { hits: all.slice(0, limit), total: all.length };
}

function toHit(kind: ElementType, element: any): SearchHit {
  const metadata = element.metadata ?? {};
  return {
    id: element.id,
    kind,
    type: element.type,
    name: metadata.name,
    layer: metadata.layer,
    feed: metadata.feed,
    snippet: truncate(metadata.description, 240),
    source: element._origin ? `${element._origin.path}:${element._origin.lineNumber}` : undefined,
  };
}

export async function getElement(
  scope: Scope,
  version: string,
  id: string,
  kind?: ElementType,
): Promise<{ kind: ElementType; element: any } | undefined> {
  const { config } = await load(scope, version);
  for (const elementType of ELEMENT_TYPES) {
    if (kind && kind !== elementType) continue;
    const element = config[elementType]?.[id];
    if (element) return { kind: elementType, element: { ...element, id } };
  }
  return undefined;
}

/**
 * Elements grouped by one of their properties, with a representative for each group.
 * The cheapest way for an agent to learn the conventions of a repository before it
 * proposes anything: which data object types are in use here, how many of each, and
 * one to copy.
 */
export async function configPatterns(
  scope: Scope,
  version: string,
  kind: ElementType,
  groupBy: 'type' | 'layer' | 'connectionId' | 'executionMode' | 'transformerType',
): Promise<{ group: string; count: number; examples: string[] }[]> {
  const { config } = await load(scope, version);
  const groups = new Map<string, string[]>();

  for (const [id, element] of Object.entries<any>(config[kind] ?? {})) {
    for (const group of groupValues(element, groupBy)) {
      const list = groups.get(group);
      if (list) list.push(id);
      else groups.set(group, [id]);
    }
  }

  return [...groups.entries()]
    .map(([group, ids]) => ({ group, count: ids.length, examples: ids.slice(0, 3).sort() }))
    .sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
}

function groupValues(element: any, groupBy: string): string[] {
  switch (groupBy) {
    case 'type':
      return [element?.type ?? '(none)'];
    case 'layer':
      return [element?.metadata?.layer ?? '(none)'];
    case 'connectionId':
      return [element?.connectionId ?? '(none)'];
    case 'executionMode':
      return [element?.executionMode?.type ?? '(none)'];
    case 'transformerType': {
      const transformers = element?.transformers;
      if (!Array.isArray(transformers) || transformers.length === 0) return ['(none)'];
      return [...new Set(transformers.map((t: any) => t?.type ?? '(untyped)'))];
    }
    default:
      throw new Error(`Unknown grouping ${groupBy}`);
  }
}

/**
 * Elements resembling a given one: same type, and where the exemplar has them, the
 * same layer and connection. Ranked by how many of those they share, so the closest
 * pattern to copy comes first.
 */
export async function findSimilar(
  scope: Scope,
  version: string,
  kind: ElementType,
  like: { id?: string; type?: string; layer?: string; connectionId?: string },
  limit = 10,
): Promise<SearchHit[]> {
  const { config } = await load(scope, version);
  const elements = config[kind] ?? {};
  const reference = like.id ? elements[like.id] : undefined;

  const wanted = {
    type: like.type ?? reference?.type,
    layer: like.layer ?? reference?.metadata?.layer,
    connectionId: like.connectionId ?? reference?.connectionId,
  };
  if (!wanted.type && !wanted.layer && !wanted.connectionId) return [];

  const scored: { score: number; hit: SearchHit }[] = [];
  for (const [id, element] of Object.entries<any>(elements)) {
    if (id === like.id) continue;
    let score = 0;
    if (wanted.type && element?.type === wanted.type) score += 3;
    if (wanted.layer && element?.metadata?.layer === wanted.layer) score += 2;
    if (wanted.connectionId && element?.connectionId === wanted.connectionId) score += 2;
    if (score > 0) scored.push({ score, hit: toHit(kind, { ...element, id }) });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.hit.id.localeCompare(b.hit.id))
    .slice(0, limit)
    .map((s) => s.hit);
}
