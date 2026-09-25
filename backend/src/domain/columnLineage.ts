/**
 * Column level lineage as SDLB exports it (`--test dry-run-with-lineage-export`): one document per
 * output DataObject, holding the OpenLineage `columnLineage` facet of the Action that wrote it.
 *
 * Ported from src/util/ConfigExplorer/columnLineage.ts of the frontend, and parity-tested
 * (test/unit/parity.test.ts) - change the pair together.
 */

export interface ColumnRef {
  dataObjectId: string;
  column: string;
}

export interface ColumnTransformation {
  type?: string;
  subtype?: string;
  description?: string;
  masking?: boolean;
}

export interface ColumnLineageInput extends ColumnRef {
  transformations: ColumnTransformation[];
}

export interface ColumnLineageField {
  column: string;
  inputs: ColumnLineageInput[];
  /** what creates a column without input columns, e.g. `current_timestamp()` */
  expression?: string;
}

/** One document, normalized. */
export interface ColumnLineage {
  actionId: string;
  dataObjectId: string;
  fields: ColumnLineageField[];
  /** columns SDLB could not trace back, as opposed to columns without a source */
  unresolved: string[];
}

/** One input column feeding one output column through one Action. */
export interface ColumnLineageEdge {
  from: ColumnRef;
  to: ColumnRef;
  actionId: string;
  transformations: ColumnTransformation[];
}

/** Column names are matched case insensitively, as in ColumnModel.ts. */
export const columnKey = (column: string) => column.toLowerCase();

/** DataObject ids cannot contain a dot, so this is unambiguous. */
export const columnId = (ref: ColumnRef) => `${ref.dataObjectId}.${columnKey(ref.column)}`;

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function parseTransformation(raw: unknown): ColumnTransformation | undefined {
  if (!isObject(raw)) return undefined;
  const t: ColumnTransformation = {};
  if (isString(raw.type)) t.type = raw.type;
  if (isString(raw.subtype)) t.subtype = raw.subtype;
  if (isString(raw.description)) t.description = raw.description;
  if (typeof raw.masking === 'boolean') t.masking = raw.masking;
  return t;
}

function parseDocument(raw: unknown): ColumnLineage | undefined {
  if (!isObject(raw) || !isString(raw.actionId) || !isString(raw.dataObjectId)) return undefined;
  const rawFields = raw.columnLineage?.fields;
  const fields: ColumnLineageField[] = [];
  if (isObject(rawFields)) {
    for (const [column, rawField] of Object.entries(rawFields)) {
      if (!isObject(rawField)) continue;
      const inputs: ColumnLineageInput[] = (Array.isArray(rawField.inputFields) ? rawField.inputFields : [])
        .filter((input: unknown) => isObject(input) && isString(input.name) && isString(input.field))
        .map((input: Record<string, any>) => ({
          dataObjectId: input.name,
          column: input.field,
          transformations: (Array.isArray(input.transformations) ? input.transformations : [])
            .map(parseTransformation)
            .filter((t: ColumnTransformation | undefined): t is ColumnTransformation => t !== undefined),
        }));
      const field: ColumnLineageField = { column, inputs };
      if (isString(rawField.expression)) field.expression = rawField.expression;
      fields.push(field);
    }
  }
  const unresolved = Array.isArray(raw.unresolvedFields) ? raw.unresolvedFields.filter(isString) : [];
  return { actionId: raw.actionId, dataObjectId: raw.dataObjectId, fields, unresolved };
}

/**
 * The documents of one upload. A blob holds one document, or an array of them when several
 * Actions write the same DataObject; anything malformed is dropped rather than thrown.
 */
export function parseColumnLineage(raw: unknown): ColumnLineage[] {
  const documents = Array.isArray(raw) ? raw : [raw];
  return documents.map(parseDocument).filter((doc): doc is ColumnLineage => doc !== undefined);
}

export function columnEdgesOf(lineage: ColumnLineage): ColumnLineageEdge[] {
  return lineage.fields.flatMap((field) => field.inputs.map((input) => ({
    from: { dataObjectId: input.dataObjectId, column: input.column },
    to: { dataObjectId: lineage.dataObjectId, column: field.column },
    actionId: lineage.actionId,
    transformations: input.transformations,
  })));
}

/* ------------------------------------------------------------------- index */

/** Bumped by hand whenever the index layout changes, so a stale index is refused rather than misread. */
export const COLUMN_LINEAGE_INDEX_VERSION = 1;

/** [fromDataObjectId, fromColumn, toDataObjectId, toColumn, actionId] */
export type IndexEdge = [string, string, string, string, string];
/** [dataObjectId, column, actionId] */
export type IndexColumn = [string, string, string];

/**
 * Every column dependency of a repository and environment, without the transformation text,
 * so that the browser can trace a column through the whole pipeline from one download.
 */
export interface ColumnLineageIndex {
  schemaVersion: number;
  builtAt: string;
  /** the documents the index was built from, per DataObject */
  documents: { dataObjectId: string; actionId: string; tstamp?: number }[];
  edges: IndexEdge[];
  sourceless: IndexColumn[];
  unresolved: IndexColumn[];
}

export function buildColumnLineageIndex(
  sources: { lineage: ColumnLineage; tstamp?: number }[],
  builtAt: string,
): ColumnLineageIndex {
  const sorted = [...sources].sort((a, b) =>
    a.lineage.dataObjectId.localeCompare(b.lineage.dataObjectId) || a.lineage.actionId.localeCompare(b.lineage.actionId));
  const index: ColumnLineageIndex = {
    schemaVersion: COLUMN_LINEAGE_INDEX_VERSION, builtAt, documents: [], edges: [], sourceless: [], unresolved: [],
  };
  const seen = new Set<string>();
  for (const { lineage, tstamp } of sorted) {
    index.documents.push(tstamp === undefined
      ? { dataObjectId: lineage.dataObjectId, actionId: lineage.actionId }
      : { dataObjectId: lineage.dataObjectId, actionId: lineage.actionId, tstamp });
    for (const edge of columnEdgesOf(lineage)) {
      const key = `${columnId(edge.from)}>${columnId(edge.to)}>${edge.actionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      index.edges.push([edge.from.dataObjectId, edge.from.column, edge.to.dataObjectId, edge.to.column, edge.actionId]);
    }
    for (const field of lineage.fields) {
      if (field.inputs.length === 0) index.sourceless.push([lineage.dataObjectId, field.column, lineage.actionId]);
    }
    for (const column of lineage.unresolved) index.unresolved.push([lineage.dataObjectId, column, lineage.actionId]);
  }
  return index;
}

/** The index as downloaded, or undefined if it is not one this code can read. */
export function parseColumnLineageIndex(raw: unknown): ColumnLineageIndex | undefined {
  if (!isObject(raw) || raw.schemaVersion !== COLUMN_LINEAGE_INDEX_VERSION) return undefined;
  if (!Array.isArray(raw.documents) || !Array.isArray(raw.edges)) return undefined;
  return {
    schemaVersion: raw.schemaVersion,
    builtAt: isString(raw.builtAt) ? raw.builtAt : '',
    documents: raw.documents.filter((d: unknown) => isObject(d) && isString(d.dataObjectId) && isString(d.actionId)),
    edges: raw.edges.filter((e: unknown) => Array.isArray(e) && e.length === 5 && e.every(isString)),
    sourceless: Array.isArray(raw.sourceless) ? raw.sourceless : [],
    unresolved: Array.isArray(raw.unresolved) ? raw.unresolved : [],
  };
}

/* ------------------------------------------------------------------- tracing */

export type TraceDirection = 'upstream' | 'downstream';

export interface ColumnTrace {
  /** `columnId`s reached, the start column included */
  columns: Set<string>;
  /** the index edges on the way, nearest first */
  edges: IndexEdge[];
  /** whether `maxDepth` cut off columns further away */
  truncated: boolean;
}

/**
 * Every column a column depends on (upstream) or that depends on it (downstream), transitively, at
 * most `maxDepth` actions away. Lineage can be cyclic - the historization pattern reads and writes
 * the same DataObject - hence the visited set.
 */
export function traceColumn(
  index: ColumnLineageIndex, start: ColumnRef, direction: TraceDirection, maxDepth = Infinity,
): ColumnTrace {
  const byEnd = new Map<string, IndexEdge[]>();
  for (const edge of index.edges) {
    const from = columnId({ dataObjectId: edge[0], column: edge[1] });
    const to = columnId({ dataObjectId: edge[2], column: edge[3] });
    const key = direction === 'upstream' ? to : from;
    const list = byEnd.get(key) ?? [];
    list.push(edge);
    byEnd.set(key, list);
  }
  const startId = columnId(start);
  const columns = new Set([startId]);
  const edges: IndexEdge[] = [];
  let truncated = false;
  let level = [startId];
  for (let depth = 0; level.length > 0; depth++) {
    if (depth >= maxDepth) {
      truncated = level.some((id) => (byEnd.get(id) ?? []).length > 0);
      break;
    }
    const next: string[] = [];
    for (const id of level) {
      for (const edge of byEnd.get(id) ?? []) {
        edges.push(edge);
        const reached = direction === 'upstream'
          ? columnId({ dataObjectId: edge[0], column: edge[1] })
          : columnId({ dataObjectId: edge[2], column: edge[3] });
        if (columns.has(reached)) continue;
        columns.add(reached);
        next.push(reached);
      }
    }
    level = next;
  }
  return { columns, edges, truncated };
}

/**
 * The columns the index knows of a DataObject: written, sourceless, unresolved or read. The name the
 * writing action exported wins over how a reading action spells it.
 */
export function indexedColumns(index: ColumnLineageIndex, dataObjectId: string): string[] {
  const found = new Map<string, string>();
  const add = (column: string) => { if (!found.has(columnKey(column))) found.set(columnKey(column), column); };
  for (const [, , toDo, toCol] of index.edges) if (toDo === dataObjectId) add(toCol);
  for (const [id, column] of [...index.sourceless, ...index.unresolved]) if (id === dataObjectId) add(column);
  for (const [fromDo, fromCol] of index.edges) if (fromDo === dataObjectId) add(fromCol);
  return [...found.values()];
}
