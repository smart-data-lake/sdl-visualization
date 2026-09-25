import { describe, expect, test } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { buildColumnModel, ColumnDisplay } from '../src/util/ConfigExplorer/ColumnModel';
import { parseColumnLineage } from '../src/util/ConfigExplorer/columnLineage';
import { columnLineageEdges, CustomEdgeProps } from '../src/util/ConfigExplorer/LineageTabUtils';

const identity = (name: string, field: string) =>
  ({ namespace: 'sdlb', name, field, transformations: [{ type: 'DIRECT', subtype: 'IDENTITY' }] });
const transformed = (name: string, field: string, description: string) =>
  ({ namespace: 'sdlb', name, field, transformations: [{ type: 'DIRECT', subtype: 'TRANSFORMATION', description }] });

// two actions writing `out` from `in`, and agreeing on one of the columns
const lineage = parseColumnLineage([
  { actionId: 'a1', dataObjectId: 'out', columnLineage: { fields: {
    id: { inputFields: [identity('in', 'ID')] }, total: { inputFields: [transformed('in', 'amount', 'sum(amount)')] } } } },
  { actionId: 'a2', dataObjectId: 'out', columnLineage: { fields: {
    id: { inputFields: [identity('in', 'id')] }, other: { inputFields: [identity('elsewhere', 'x')] } } } },
]);

function node(id: string, display: ColumnDisplay, options: { lineage?: typeof lineage; columns?: string[]; primaryKey?: string[] } = {}): Node {
  const configObj = { table: { primaryKey: options.primaryKey ?? ['id'] } };
  const schema = options.columns && { schema: options.columns.map((name) => ({ name, dataType: 'string' })) };
  const columns = buildColumnModel(configObj, { schema, lineage: options.lineage }).columns;
  return { id, position: { x: 0, y: 0 }, data: { graphView: 'data', columns, columnDisplay: display, columnLineage: options.lineage } };
}

const flowEdge: Edge = { id: 'in->a1->out', source: 'in', target: 'out' };
const idsOf = (edges: Edge[]) => edges.map((edge) => edge.id).sort();

describe('the column edges of the data view', () => {
  test('there are none while both ends are closed', () => {
    const { replaced, wanted } = columnLineageEdges([node('in', 'none'), node('out', 'none', { lineage })], [flowEdge]);
    expect(wanted).toEqual([]);
    expect(replaced.size).toBe(0);
  });

  test('opening the target replaces the data flow edge by one edge per column pair', () => {
    const { replaced, wanted } = columnLineageEdges(
      [node('in', 'none'), node('out', 'all', { lineage })], [flowEdge]);
    expect([...replaced]).toEqual(['in->a1->out']);
    // `other` comes from another data object, so it is not an edge of this pair
    expect(idsOf(wanted)).toEqual(['in.amount->out.total::lineage', 'in.id->out.id::lineage']);
  });

  test('a column pair created by two actions is one edge naming both', () => {
    const { wanted } = columnLineageEdges([node('in', 'none'), node('out', 'all', { lineage })], [flowEdge]);
    const id = wanted.find((edge) => edge.id === 'in.id->out.id::lineage')!.data as CustomEdgeProps;
    expect(id.columnLineage!.via.map((v) => v.actionId)).toEqual(['a1', 'a2']);
    // named as the first action exported it
    expect(id.columnLineage!.sourceName).toBe('ID');
  });

  test('a pair neither of whose columns is shown is left out', () => {
    // the target shows its keys only, which is `id`; the source is open but has no `amount` column
    const { wanted } = columnLineageEdges(
      [node('in', 'all', { columns: ['id'] }), node('out', 'keys', { lineage })], [flowEdge]);
    expect(idsOf(wanted)).toEqual(['in.id->out.id::lineage']);
  });

  test('without any pair to show the data flow edge stays', () => {
    const { replaced, wanted } = columnLineageEdges(
      [node('in', 'all', { columns: ['unrelated'], primaryKey: [] }), node('out', 'none', { lineage })], [flowEdge]);
    expect(wanted).toEqual([]);
    expect(replaced.size).toBe(0);
  });

  test('only the data view has column edges', () => {
    const nodes = [node('in', 'all'), node('out', 'all', { lineage })].map((n) => ({ ...n, data: { ...n.data, graphView: 'full' } }));
    expect(columnLineageEdges(nodes, [flowEdge]).wanted).toEqual([]);
  });
});
