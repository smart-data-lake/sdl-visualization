import type { SchemaColumn, SchemaData } from "../../types";

/**
 * The documents the global search indexes, and the MiniSearch options they are indexed with.
 *
 * This module is mirrored by backend/src/domain/search.ts and the two are parity-tested
 * (backend/test/unit/parity.test.ts) - change the pair together. It is deliberately pure:
 * no React, no DOM and no MiniSearch value import, so that the backend, the Node build
 * script (scripts/buildSearchIndex.ts) and the browser can all use it.
 */

export type DocumentKind = 'element' | 'description' | 'column';
export type ElementType = 'dataObjects' | 'actions' | 'connections';
export const ELEMENT_TYPES: ElementType[] = ['dataObjects', 'actions', 'connections'];

export interface SearchDocument {
  docId: string;
  kind: DocumentKind;
  // indexed
  id: string;
  name?: string;
  type?: string;
  layer?: string;
  subjectArea?: string;
  feed?: string;
  tags?: string;
  description?: string;
  body?: string;
  // stored only
  elementType?: ElementType;
  elementId?: string;
  filename?: string;
  columnPath?: string;
  snippet?: string;
  source?: string;
  tstamp?: number;
}

/** Bumped by hand whenever the index options below change, so a stale index is refused rather than misread. */
export const SEARCH_SCHEMA_VERSION = 1;

/** Must be identical at build time and at MiniSearch.loadJS - a mismatch fails silently. */
export const SEARCH_INDEX_OPTIONS = {
  idField: 'docId',
  fields: ['id', 'name', 'type', 'layer', 'subjectArea', 'feed', 'tags', 'description', 'body'],
  storeFields: ['docId', 'kind', 'elementType', 'elementId', 'filename', 'columnPath',
                'name', 'type', 'layer', 'snippet', 'source', 'tstamp'],
};

/** Per kind, so that tens of thousands of column documents cannot drown a few thousand elements. */
export const KIND_BOOST: Record<DocumentKind, number> = { element: 1.0, description: 0.8, column: 0.5 };

/**
 * Query time only, and never serialized: boostDocument is a function.
 * Prefixing only the word being typed keeps an AND query from going empty mid-word.
 */
export const SEARCH_QUERY_OPTIONS = {
  boost: { id: 10, name: 8, type: 4, tags: 3, layer: 3, subjectArea: 3, feed: 3, description: 2, body: 1 },
  boostDocument: (_id: any, _term: string, stored?: Record<string, unknown>) =>
    KIND_BOOST[stored?.kind as DocumentKind] ?? 1,
  combineWith: 'AND' as const,
  prefix: (_term: string, i: number, terms: string[]) => i === terms.length - 1,
  fuzzy: (term: string) => (term.length >= 4 ? 0.2 : false),
};

/** Caps that keep the index shippable to a browser. Unrelated to backend/src/store/limits.ts. */
export const LIMITS = {
  bodyChars: 4_000,
  descriptionChars: 20_000,
  columnDescriptionChars: 1_000,
  snippetChars: 240,
  columnsPerDataObject: 2_000,
  columnDepth: 6,
  maxDocuments: 200_000,
  maxIndexBytes: 32 * 1024 * 1024,
};

/** The ConfigExplorer tab each kind of hit belongs on. */
const TAB_OF: Record<DocumentKind, string> = { element: 'configuration', description: 'description', column: 'schema' };

/* ------------------------------------------------------------------ helpers */

function truncate(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.length <= max ? value : value.slice(0, max);
}

/** Every leaf value of an object graph as lowercased strings, used to build the catch-all body field. */
export function leafValues(value: unknown, into: string[] = []): string[] {
  if (value === null || value === undefined) return into;
  if (Array.isArray(value)) value.forEach((v) => leafValues(v, into));
  else if (typeof value === 'object') Object.values(value as Record<string, unknown>).forEach((v) => leafValues(v, into));
  else into.push(String(value).toLowerCase());
  return into;
}

/** A short plain-text summary: markdown markup stripped, cut on a word boundary. */
export function snippetOf(text: string | undefined, max: number = LIMITS.snippetChars): string | undefined {
  if (!text) return undefined;
  const plain = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[*_`#>|]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return undefined;
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

function joinTags(tags: unknown): string | undefined {
  if (Array.isArray(tags)) return tags.filter((t) => t !== null && t !== undefined).map(String).join(' ') || undefined;
  return typeof tags === 'string' ? tags : undefined;
}

/* ------------------------------------------------------------------ elements */

/** One document per dataObject, action and connection of a configuration. */
export function elementDocuments(config: any): SearchDocument[] {
  const documents: SearchDocument[] = [];
  for (const elementType of ELEMENT_TYPES) {
    for (const [id, element] of Object.entries<any>(config?.[elementType] ?? {})) {
      documents.push(elementDocument(elementType, id, element ?? {}));
    }
  }
  return documents;
}

function elementDocument(elementType: ElementType, id: string, element: any): SearchDocument {
  const metadata = element.metadata ?? {};
  // _origin becomes the source link; _columnDescriptions only appears in exports of older SDLB versions
  const { _origin, _columnDescriptions, metadata: _metadata, ...rest } = element;
  return {
    docId: `e:${elementType}:${id}`,
    kind: 'element',
    id,
    name: metadata.name,
    type: element.type,
    layer: metadata.layer,
    subjectArea: metadata.subjectArea,
    feed: metadata.feed,
    tags: joinTags(metadata.tags),
    description: metadata.description,
    body: truncate(leafValues(rest).join(' '), LIMITS.bodyChars),
    elementType,
    elementId: id,
    snippet: snippetOf(metadata.description) ?? snippetOf(element.type),
    source: _origin?.path ? `${_origin.path}:${_origin.lineNumber}` : undefined,
  };
}

/* -------------------------------------------------------------- descriptions */

/**
 * One document per description markdown file. `filename` is the path below description/,
 * e.g. "dataObjects/int-airports.md", which is also what the route is rebuilt from.
 */
export function descriptionDocument(filename: string, markdown: string): SearchDocument | undefined {
  if (!markdown?.trim()) return undefined;
  const segments = filename.split('/');
  const base = segments.pop() ?? filename;
  const elementType = (ELEMENT_TYPES as string[]).includes(segments[0]) ? (segments[0] as ElementType) : undefined;
  const elementId = base.replace(/\.md$/i, '');

  const lines = markdown.split(/\r?\n/);
  const heading = lines.find((l) => /^#\s+\S/.test(l))?.replace(/^#\s+/, '').trim();
  const paragraph = lines.find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('@'))?.trim();

  return {
    docId: `d:${filename}`,
    kind: 'description',
    id: elementId,
    name: heading,
    description: truncate(paragraph, LIMITS.descriptionChars),
    body: truncate(markdown, LIMITS.descriptionChars),
    elementType,
    elementId,
    filename,
    snippet: snippetOf(paragraph ?? markdown),
  };
}

/* ------------------------------------------------------------------ columns */

export interface FlatColumn { path: string; name: string; dataType: string; comment?: string }

/**
 * The schema tree flattened to dotted paths, following SchemaTab's convention:
 * a struct field keeps its parent's path, an array adds ".[]", a map ".key" and ".value".
 */
export function flattenColumns(columns: SchemaColumn[] | undefined,
                               maxDepth: number = LIMITS.columnDepth): FlatColumn[] {
  const flat: FlatColumn[] = [];
  const walkColumns = (cols: SchemaColumn[] | undefined, parentPath: string | undefined, depth: number) => {
    if (!Array.isArray(cols) || depth > maxDepth) return;
    for (const column of cols) {
      if (!column?.name) continue;
      const path = parentPath ? `${parentPath}.${column.name}` : column.name;
      const dataType: any = column.dataType;
      flat.push({ path, name: column.name, dataType: typeOf(dataType), comment: column.comment });
      walkDataType(dataType, path, depth + 1);
    }
  };
  const walkDataType = (dataType: any, path: string, depth: number) => {
    if (!dataType || typeof dataType !== 'object' || depth > maxDepth) return;
    if (dataType.dataType === 'struct') {
      walkColumns(dataType.fields, path, depth);
    } else if (dataType.dataType === 'array') {
      const elementPath = `${path}.[]`;
      flat.push({ path: elementPath, name: '-element-', dataType: typeOf(dataType.elementType) });
      walkDataType(dataType.elementType, elementPath, depth + 1);
    } else if (dataType.dataType === 'map') {
      for (const [suffix, label, child] of [['key', '-key-', dataType.keyType], ['value', '-value-', dataType.valueType]] as const) {
        const childPath = `${path}.${suffix}`;
        flat.push({ path: childPath, name: label, dataType: typeOf(child) });
        walkDataType(child, childPath, depth + 1);
      }
    }
  };
  walkColumns(columns, undefined, 1);
  return flat;
}

function typeOf(dataType: any): string {
  if (typeof dataType === 'string') return dataType;
  return dataType?.dataType ?? '';
}

/**
 * One document per column of a data object, described by the schema's comment - SDLB merges
 * the markdown @column descriptions into it. A schema that only carries `info` is a failed
 * export and is not indexed.
 */
export function columnDocuments(dataObjectId: string, schema: SchemaData | undefined,
                                tstamp?: number): SearchDocument[] {
  if (!schema?.schema?.length) return [];
  return flattenColumns(schema.schema)
    .slice(0, LIMITS.columnsPerDataObject)
    .map((column) => {
      const description = column.comment || undefined;
      return {
        docId: `c:${dataObjectId}:${column.path.toLowerCase()}`,
        kind: 'column' as const,
        id: column.name,
        name: column.name,
        type: column.dataType,
        description: truncate(description, LIMITS.columnDescriptionChars),
        elementType: 'dataObjects' as ElementType,
        elementId: dataObjectId,
        columnPath: column.path,
        snippet: snippetOf(description) ?? column.dataType,
        tstamp,
      };
    });
}

/* ------------------------------------------------------------------ routing */

/** The ConfigExplorer path of a hit, relative to "config/": "dataObjects/btl-distances/schema". */
export function routeOf(doc: SearchDocument): string {
  const elementType = doc.elementType ?? 'dataObjects';
  const elementId = doc.elementId ?? doc.id;
  return `${elementType}/${elementId}/${TAB_OF[doc.kind]}`;
}
