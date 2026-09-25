import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  buildColumnLineageIndex, columnEdgesOf, columnId, COLUMN_LINEAGE_INDEX_VERSION,
  indexedColumns, parseColumnLineage, parseColumnLineageIndex, traceColumn, type ColumnLineage,
} from '../src/util/ConfigExplorer/columnLineage';

const identity = (name: string, field: string) =>
  ({ namespace: 'sdlb', name, field, transformations: [{ type: 'DIRECT', subtype: 'IDENTITY', masking: false }] });

const doc = (actionId: string, dataObjectId: string, fields: Record<string, any>, unresolvedFields?: string[]) =>
  ({ actionId, dataObjectId, columnLineage: { fields }, ...(unresolvedFields ? { unresolvedFields } : {}) });

const lineageOf = (raw: unknown): ColumnLineage => parseColumnLineage(raw)[0];

describe('parsing a lineage document', () => {
  test('keeps inputs, transformations, expressions and unresolved columns', () => {
    const lineage = lineageOf(doc('compute', 'stats', {
      city: { inputFields: [identity('cities', 'name')] },
      population: { inputFields: [{ namespace: 'sdlb', name: 'cities', field: 'inhabitants',
        transformations: [{ type: 'DIRECT', subtype: 'TRANSFORMATION', description: 'sum(inhabitants)', masking: false }] }] },
      loadedAt: { inputFields: [], expression: 'current_timestamp()' },
    }, ['externalRating']));

    expect(lineage.actionId).toBe('compute');
    expect(lineage.fields.map((f) => f.column)).toEqual(['city', 'population', 'loadedAt']);
    expect(lineage.fields[1].inputs[0].transformations[0].description).toBe('sum(inhabitants)');
    expect(lineage.fields[2]).toEqual({ column: 'loadedAt', inputs: [], expression: 'current_timestamp()' });
    expect(lineage.unresolved).toEqual(['externalRating']);
  });

  test('accepts an array of documents, for a DataObject written by several actions', () => {
    const docs = parseColumnLineage([doc('a1', 'out', {}), doc('a2', 'out', {})]);
    expect(docs.map((d) => d.actionId)).toEqual(['a1', 'a2']);
  });

  test('drops what is malformed rather than throwing', () => {
    expect(parseColumnLineage(null)).toEqual([]);
    expect(parseColumnLineage({ dataObjectId: 'out' })).toEqual([]);
    const lineage = lineageOf(doc('a', 'out', {
      broken: 'not an object',
      partial: { inputFields: [{ name: 'in' }, identity('in', 'x'), 42] },
    }));
    expect(lineage.fields).toHaveLength(1);
    expect(lineage.fields[0].inputs.map((i) => i.column)).toEqual(['x']);
    expect(lineage.unresolved).toEqual([]);
  });

  test('flattens into one edge per input column', () => {
    const edges = columnEdgesOf(lineageOf(doc('join', 'out', {
      label: { inputFields: [identity('a', 'city'), identity('b', 'country')] },
    })));
    expect(edges.map((e) => `${columnId(e.from)}->${columnId(e.to)}`)).toEqual(['a.city->out.label', 'b.country->out.label']);
    expect(edges.every((e) => e.actionId === 'join')).toBe(true);
  });
});

describe('the index', () => {
  const sources = [
    { lineage: lineageOf(doc('hist', 'int', { id: { inputFields: [identity('stg', 'ID')] }, ts: { inputFields: [], expression: 'now()' } })), tstamp: 2 },
    { lineage: lineageOf(doc('join', 'btl', { id: { inputFields: [identity('int', 'id')] }, x: { inputFields: [] } }, ['y'])), tstamp: 3 },
  ];

  test('holds the dependencies without the transformation text', () => {
    const index = buildColumnLineageIndex(sources, '2026-09-25T00:00:00Z');
    expect(index.schemaVersion).toBe(COLUMN_LINEAGE_INDEX_VERSION);
    expect(index.documents).toEqual([
      { dataObjectId: 'btl', actionId: 'join', tstamp: 3 },
      { dataObjectId: 'int', actionId: 'hist', tstamp: 2 },
    ]);
    expect(index.edges).toEqual([['int', 'id', 'btl', 'id', 'join'], ['stg', 'ID', 'int', 'id', 'hist']]);
    expect(index.sourceless).toEqual([['btl', 'x', 'join'], ['int', 'ts', 'hist']]);
    expect(index.unresolved).toEqual([['btl', 'y', 'join']]);
    expect(JSON.stringify(index)).not.toContain('IDENTITY');
  });

  test('does not depend on the order of its sources', () => {
    expect(buildColumnLineageIndex([...sources].reverse(), 'x')).toEqual(buildColumnLineageIndex(sources, 'x'));
  });

  test('is refused when it has another layout', () => {
    const index = buildColumnLineageIndex(sources, 'x');
    expect(parseColumnLineageIndex(JSON.parse(JSON.stringify(index)))).toEqual(index);
    expect(parseColumnLineageIndex({ ...index, schemaVersion: COLUMN_LINEAGE_INDEX_VERSION + 1 })).toBeUndefined();
    expect(parseColumnLineageIndex('nonsense')).toBeUndefined();
  });
});

describe('tracing a column', () => {
  const index = buildColumnLineageIndex([
    { lineage: lineageOf(doc('a1', 'b', { x: { inputFields: [identity('a', 'x')] }, y: { inputFields: [identity('a', 'y')] } })) },
    { lineage: lineageOf(doc('a2', 'c', { z: { inputFields: [identity('b', 'X'), identity('other', 'q')] } })) },
  ], 'x');

  test('follows the columns downstream, case insensitively', () => {
    const trace = traceColumn(index, { dataObjectId: 'a', column: 'X' }, 'downstream');
    expect([...trace.columns].sort()).toEqual(['a.x', 'b.x', 'c.z']);
    expect(trace.edges.map((e) => e[4])).toEqual(['a1', 'a2']);
  });

  test('follows the columns upstream, including a second source', () => {
    const trace = traceColumn(index, { dataObjectId: 'c', column: 'z' }, 'upstream');
    expect([...trace.columns].sort()).toEqual(['a.x', 'b.x', 'c.z', 'other.q']);
  });

  test('stops at maxDepth and says whether there was more', () => {
    const one = traceColumn(index, { dataObjectId: 'c', column: 'z' }, 'upstream', 1);
    expect([...one.columns].sort()).toEqual(['b.x', 'c.z', 'other.q']);
    expect(one.truncated).toBe(true);
    const two = traceColumn(index, { dataObjectId: 'c', column: 'z' }, 'upstream', 2);
    expect(two.columns.has('a.x')).toBe(true);
    expect(two.truncated).toBe(false);
    expect(traceColumn(index, { dataObjectId: 'c', column: 'z' }, 'upstream').truncated).toBe(false);
  });

  test('knows the columns of a DataObject, named as the writing action exported them', () => {
    // b writes x, the next action reads it as X
    expect(indexedColumns(index, 'b').sort()).toEqual(['x', 'y']);
    expect(indexedColumns(index, 'a').sort()).toEqual(['x', 'y']);
    expect(indexedColumns(index, 'unknown')).toEqual([]);
  });

  test('ends on a cycle, as the historization pattern writes what it reads', () => {
    const cyclic = buildColumnLineageIndex([
      { lineage: lineageOf(doc('hist', 'h', { id: { inputFields: [identity('h', 'id'), identity('s', 'id')] } })) },
    ], 'x');
    expect([...traceColumn(cyclic, { dataObjectId: 's', column: 'id' }, 'downstream').columns]).toEqual(['s.id', 'h.id']);
    expect([...traceColumn(cyclic, { dataObjectId: 'h', column: 'id' }, 'upstream').columns].sort()).toEqual(['h.id', 's.id']);
  });
});

describe('the fixtures', () => {
  const dir = path.join(__dirname, 'e2e/fixtures/shared/schema');
  const files = readdirSync(dir).filter((f) => /\.lineage\.\d+\.json$/.test(f));

  test('are all readable lineage documents', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(parseColumnLineage(JSON.parse(readFileSync(path.join(dir, file), 'utf8')))).toHaveLength(1);
  });

  test('have an index that is up to date', () => {
    const sources = files.map((file) => ({
      lineage: lineageOf(JSON.parse(readFileSync(path.join(dir, file), 'utf8'))),
      tstamp: Number(/\.(\d+)\.json$/.exec(file)![1]),
    }));
    const stored = parseColumnLineageIndex(JSON.parse(readFileSync(path.join(dir, 'columnLineage.json'), 'utf8')))!;
    expect({ ...stored, builtAt: '' }).toEqual(buildColumnLineageIndex(sources, ''));
  });
});
