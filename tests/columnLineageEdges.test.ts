import { describe, expect, test } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { buildColumnModel, ColumnDisplay } from '../src/util/ConfigExplorer/ColumnModel';
import { buildColumnLineageIndex, parseColumnLineage } from '../src/util/ConfigExplorer/columnLineage';
import { DAGraph, DataObject, Edge as GraphEdge, NodeType } from '../src/util/ConfigExplorer/Graphs';
import { buildActionPorts, portRowCount } from '../src/util/ConfigExplorer/ActionPorts';
import { buildGraphTrace, columnLineageEdges, portGroupRanks, CustomEdgeProps, traceEnds, traceHighlights, traceIndex } from '../src/util/ConfigExplorer/LineageTabUtils';

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

describe('what a column trace highlights', () => {
  // s -a1-> m -a2-> t, where m.x feeds t.x and m.y feeds nothing
  const index = buildColumnLineageIndex(parseColumnLineage([
    { actionId: 'a1', dataObjectId: 'm', columnLineage: { fields: {
      x: { inputFields: [identity('s', 'X')] }, y: { inputFields: [identity('s', 'y')] } } } },
    { actionId: 'a2', dataObjectId: 't', columnLineage: { fields: { x: { inputFields: [identity('m', 'x')] } } } },
    { actionId: 'a3', dataObjectId: 'u', columnLineage: { fields: { z: { inputFields: [identity('m', 'y')] } } } },
  ]).map((lineage) => ({ lineage })), '');
  const dataNode = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: { nodeType: NodeType.DataNode } });
  const actionNode = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: { nodeType: NodeType.ActionNode } });

  test('traces both ways from the column, case insensitively', () => {
    const trace = buildGraphTrace(index, { dataObjectId: 'm', column: 'X' });
    expect([...trace.columns].map(([id, columns]) => [id, [...columns]])).toEqual([['m', ['x']], ['s', ['x']], ['t', ['x']]]);
  });

  test('names the columns a trace begins and ends with', () => {
    const ref = (dataObjectId: string, column: string) => ({ dataObjectId, column });
    expect(traceEnds(buildGraphTrace(index, { dataObjectId: 'm', column: 'X' })))
      .toEqual({ starts: [ref('s', 'X')], ends: [ref('t', 'x')] });
    // a column without lineage is both
    expect(traceEnds(buildGraphTrace(index, { dataObjectId: 'u', column: 'q' })))
      .toEqual({ starts: [ref('u', 'q')], ends: [ref('u', 'q')] });
  });

  test('in the data view, only the edges the traced columns run along', () => {
    const trace = buildGraphTrace(index, { dataObjectId: 's', column: 'x' });
    const { nodeIds, edgeIds } = traceHighlights(trace, ['s', 'm', 't', 'u'].map(dataNode), [
      { id: 's->a1->m', source: 's', target: 'm' },
      { id: 'm->a2->t', source: 'm', target: 't' },
      // m is read by a3 too, but not through a traced column
      { id: 'm->a3->u', source: 'm', target: 'u' },
    ]);
    expect([...edgeIds].sort()).toEqual(['m->a2->t', 's->a1->m']);
    expect([...nodeIds].sort()).toEqual(['m', 's', 't']);
  });

  test('in the full view, the edges into and out of the actions on the trace', () => {
    const trace = buildGraphTrace(index, { dataObjectId: 's', column: 'x' });
    const { edgeIds } = traceHighlights(trace, [...['s', 'm', 't', 'u'].map(dataNode), ...['a1', 'a2', 'a3'].map(actionNode)], [
      { id: 'a1_from_s', source: 's', target: 'a1' }, { id: 'a1_to_m', source: 'a1', target: 'm' },
      { id: 'a2_from_m', source: 'm', target: 'a2' }, { id: 'a2_to_t', source: 'a2', target: 't' },
      { id: 'a3_from_m', source: 'm', target: 'a3' }, { id: 'a3_to_u', source: 'a3', target: 'u' },
    ]);
    expect([...edgeIds].sort()).toEqual(['a1_from_s', 'a1_to_m', 'a2_from_m', 'a2_to_t']);
  });

  test('in the action view, an edge only where a traced column passes through its data object', () => {
    const nodes = ['a1', 'a2', 'a3'].map(actionNode);
    const edges = [{ id: 'a1->m->a2', source: 'a1', target: 'a2', data: { dataObjectId: 'm' } },
                   { id: 'a1->m->a3', source: 'a1', target: 'a3', data: { dataObjectId: 'm' } }];
    expect([...traceHighlights(buildGraphTrace(index, { dataObjectId: 's', column: 'x' }), nodes, edges).edgeIds]).toEqual(['a1->m->a2']);
    expect([...traceHighlights(buildGraphTrace(index, { dataObjectId: 's', column: 'y' }), nodes, edges).edgeIds]).toEqual(['a1->m->a3']);
  });

  test('a column edge by its column pair, and never a relation', () => {
    const trace = buildGraphTrace(index, { dataObjectId: 's', column: 'x' });
    const column = (source: string, sourceColumn: string, target: string, targetColumn: string): Edge => ({
      id: `${source}.${sourceColumn}->${target}.${targetColumn}::lineage`, source, target,
      data: { columnLineage: { sourceColumn, targetColumn, sourceName: sourceColumn, targetName: targetColumn, via: [] } },
    });
    const { edgeIds } = traceHighlights(trace, ['s', 'm'].map(dataNode), [
      column('s', 'x', 'm', 'x'), column('s', 'y', 'm', 'y'),
      { id: 'fk', source: 's', target: 'm', data: { relation: { sourceColumn: 'x', targetColumn: 'x' } } },
    ]);
    expect([...edgeIds]).toEqual(['s.x->m.x::lineage']);
  });

  test('a column edge of the action view by the column written resp. read through its data object', () => {
    const trace = buildGraphTrace(index, { dataObjectId: 's', column: 'x' });
    const portEdge = (column: string, target: string, ports: { sourcePort?: string; targetPort?: string }): Edge => ({
      id: `a1->m.${column}->${target}::port`, source: 'a1', target,
      data: { columnLineage: { sourceColumn: column, targetColumn: column, sourceName: column, targetName: column, via: [], dataObjectId: 'm', ...ports } },
    });
    const { edgeIds, nodeIds } = traceHighlights(trace, ['a1', 'a2', 'a3'].map(actionNode), [
      portEdge('x', 'a2', { sourcePort: 'm.x', targetPort: 'm.x' }),
      portEdge('y', 'a3', { sourcePort: 'm.y', targetPort: 'm.y' }),
      // a1 writes the traced m.x, a3 is closed: on the trace by what a1 writes
      portEdge('x', 'a3', { sourcePort: 'm.x' }),
    ]);
    expect([...edgeIds].sort()).toEqual(['a1->m.x->a2::port', 'a1->m.x->a3::port']);
    expect([...nodeIds].sort()).toEqual(['a1', 'a2', 'a3']);
  });

  test('without a built index, one document held by a data object and an action counts once', () => {
    const shown = [{ ...dataNode('out'), data: { columnLineage: lineage } }, { ...actionNode('a1'), data: { outputLineage: [lineage[0]] } }];
    const alone = traceIndex(undefined, [shown[0]]).index.edges.length;
    expect(traceIndex(undefined, shown).index.edges.length).toBe(alone);
    expect(traceIndex(undefined, [shown[1]]).index.edges.length).toBeGreaterThan(0);
  });

  test('without a built index, the lineage the shown nodes have read', () => {
    const shown = [{ ...dataNode('t'), data: { columnLineage: lineage } }];
    expect(traceIndex(undefined, shown).complete).toBe(false);
    expect(traceIndex(undefined, shown).index.edges.length).toBeGreaterThan(0);
    expect(traceIndex(index, shown)).toEqual({ index, complete: true });
  });
});

describe('the ports of an action', () => {
  const docs = parseColumnLineage([
    { actionId: 'join', dataObjectId: 'out', columnLineage: { fields: {
      a: { inputFields: [identity('left', 'A')] },
      b: { inputFields: [identity('left', 'A'), transformed('right', 'b', 'upper(b)')] },
      c: { inputFields: [], expression: 'now()' } } }, unresolvedFields: ['d'] },
    { actionId: 'other', dataObjectId: 'out', columnLineage: { fields: { x: { inputFields: [identity('left', 'x')] } } } },
  ]);

  test('one port per column read and written, grouped by data object, and only this action\'s', () => {
    const ports = buildActionPorts('join', docs);
    expect(ports.inputs.map((p) => p.key)).toEqual(['left.a', 'right.b']);
    expect(ports.outputs.map((p) => p.key)).toEqual(['out.a', 'out.b', 'out.c', 'out.d']);
    expect(ports.outputs[2].expression).toBe('now()');
    expect(ports.outputs[3].unresolved).toBe(true);
    expect(ports.inputRows).toEqual([{ caption: 'left' }, { port: ports.inputs[0] }, { caption: 'right' }, { port: ports.inputs[1] }]);
    expect(ports.connections.map((c) => `${c.from}>${c.to}`)).toEqual(['left.a>out.a', 'left.a>out.b', 'right.b>out.b']);
    expect(portRowCount(ports)).toBe(5);
  });

  test('ports follow the column order of their data object, columns it does not list last', () => {
    const columnsOf = (id: string) => ({ out: ['D', 'c', 'x', 'a'], right: ['b'] })[id];
    const ports = buildActionPorts('join', docs, { columnsOf });
    expect(ports.outputs.map((p) => p.key)).toEqual(['out.d', 'out.c', 'out.a', 'out.b']);
    expect(ports.inputs.map((p) => p.key)).toEqual(['left.a', 'right.b']);
  });

  test('groups follow the rank of their data object, unranked ones last in first appearance', () => {
    const wide = parseColumnLineage([{ actionId: 'j', dataObjectId: 'out', columnLineage: { fields: {
      a: { inputFields: [identity('p', 'a'), identity('q', 'a'), identity('r', 'a')] } } } }]);
    const groupRankOf = (id: string, side: 'input' | 'output') => side === 'input' ? ({ r: 0, q: 1 } as Record<string, number>)[id] : undefined;
    expect(buildActionPorts('j', wide, { groupRankOf }).inputRows.filter((row) => 'caption' in row))
      .toEqual([{ caption: 'r' }, { caption: 'q' }, { caption: 'p' }]);
    expect(buildActionPorts('j', wide).inputs.map((p) => p.dataObjectId)).toEqual(['p', 'q', 'r']);
  });

  test('in the action view, groups are ranked by the actions at the other end of their data object', () => {
    // w1 and w2 write what j reads, j writes o, which r1 and r2 read
    const nodes = new Map(['w1', 'w2', 'j', 'r1', 'r2'].map((id) => [id, new DataObject(id)]));
    const edge = (from: string, to: string, dataObjectId: string) => new GraphEdge(nodes.get(from)!, nodes.get(to)!, `${from}-${dataObjectId}-${to}`, undefined, dataObjectId);
    const graph = new DAGraph([...nodes.values()], [edge('w1', 'j', 'p'), edge('w2', 'j', 'q'), edge('j', 'r1', 'o'), edge('j', 'r2', 'o')]);
    const placement = new Map([['w1', { rank: 0, order: 1 }], ['w2', { rank: 0, order: 0 }], ['r1', { rank: 2, order: 3 }], ['r2', { rank: 2, order: 2 }]]);
    expect(portGroupRanks(graph, 'j', placement)).toEqual({ input: { p: 1, q: 0 }, output: { o: 2 } });
  });

  test('in the full view, the edges of an open action run per column to its ports', () => {
    const ports = buildActionPorts('join', docs);
    const action: Node = { id: 'join', position: { x: 0, y: 0 }, data: { graphView: 'full', nodeType: NodeType.ActionNode, ports, columnDisplay: 'all' } };
    const left = { ...node('left', 'none'), data: { ...node('left', 'none').data, graphView: 'full' } };
    const out = { ...node('out', 'none'), data: { ...node('out', 'none').data, graphView: 'full' } };
    const { replaced, wanted } = columnLineageEdges([left, action, out], [
      { id: 'join_from_left', source: 'left', target: 'join' }, { id: 'join_to_out', source: 'join', target: 'out' },
    ]);
    expect([...replaced].sort()).toEqual(['join_from_left', 'join_to_out']);
    expect(idsOf(wanted)).toEqual([
      'join->out.a::port', 'join->out.b::port', 'join->out.c::port', 'join->out.d::port', 'left.a->join::port',
    ]);
  });

  test('a closed action gets port edges only for the columns an open data object shows', () => {
    const ports = buildActionPorts('join', docs);
    const action: Node = { id: 'join', position: { x: 0, y: 0 }, data: { graphView: 'full', nodeType: NodeType.ActionNode, ports, columnDisplay: 'none' } };
    const left = { ...node('left', 'keys', { primaryKey: ['a'] }), data: { ...node('left', 'keys', { primaryKey: ['a'] }).data, graphView: 'full' } };
    const { wanted } = columnLineageEdges([left, action], [{ id: 'join_from_left', source: 'left', target: 'join' }]);
    expect(idsOf(wanted)).toEqual(['left.a->join::port']);
  });

  test('a trace lights up a port edge where the traced column is read resp. written by that action', () => {
    const index = buildColumnLineageIndex(docs.map((lineage) => ({ lineage })), '');
    const trace = buildGraphTrace(index, { dataObjectId: 'right', column: 'b' });
    const portEdge = (id: string, source: string, target: string, column: string, port: 'sourcePort' | 'targetPort'): Edge =>
      ({ id, source, target, data: { columnLineage: { sourceColumn: column, targetColumn: column, sourceName: column, targetName: column, via: [], [port]: 'x' } } });
    const nodes: Node[] = [
      { id: 'join', position: { x: 0, y: 0 }, data: { nodeType: NodeType.ActionNode } },
      { id: 'left', position: { x: 0, y: 0 }, data: { nodeType: NodeType.DataNode } },
    ];
    const { edgeIds } = traceHighlights(trace, nodes, [
      portEdge('right.b->join::port', 'right', 'join', 'b', 'targetPort'),
      portEdge('left.a->join::port', 'left', 'join', 'a', 'targetPort'),
      portEdge('join->out.b::port', 'join', 'out', 'b', 'sourcePort'),
      portEdge('join->out.a::port', 'join', 'out', 'a', 'sourcePort'),
    ]);
    expect([...edgeIds].sort()).toEqual(['join->out.b::port', 'right.b->join::port']);
  });
});

describe('the column edges of the action view', () => {
  // a1 writes m.x and m.y, a2 reads m.x and m.z
  const docs = parseColumnLineage([
    { actionId: 'a1', dataObjectId: 'm', columnLineage: { fields: {
      x: { inputFields: [identity('s', 'x')] }, y: { inputFields: [identity('s', 'y')] } } } },
    { actionId: 'a2', dataObjectId: 't', columnLineage: { fields: {
      x: { inputFields: [identity('m', 'X')] }, z: { inputFields: [identity('m', 'z')] } } } },
  ]);
  const action = (id: string, display: ColumnDisplay): Node =>
    ({ id, position: { x: 0, y: 0 }, data: { graphView: 'action', nodeType: NodeType.ActionNode, ports: buildActionPorts(id, docs), columnDisplay: display } });
  const edge: Edge = { id: 'a1->m->a2', source: 'a1', target: 'a2', data: { dataObjectId: 'm' } };
  const lineageOf = (e: Edge) => (e.data as CustomEdgeProps).columnLineage!;

  test('there are none while both actions are closed', () => {
    const { replaced, wanted } = columnLineageEdges([action('a1', 'none'), action('a2', 'none')], [edge]);
    expect(wanted).toEqual([]);
    expect(replaced.size).toBe(0);
  });

  test('both open: one edge per column both have a port for, from port to port', () => {
    const { replaced, wanted } = columnLineageEdges([action('a1', 'all'), action('a2', 'all')], [edge]);
    expect([...replaced]).toEqual(['a1->m->a2']);
    expect(idsOf(wanted)).toEqual(['a1->m.x->a2::port']);
    expect(lineageOf(wanted[0])).toMatchObject({ sourcePort: 'm.x', targetPort: 'm.x', dataObjectId: 'm' });
  });

  test('only the writer open: every column it writes, ending on the reader', () => {
    const { wanted } = columnLineageEdges([action('a1', 'all'), action('a2', 'none')], [edge]);
    expect(idsOf(wanted)).toEqual(['a1->m.x->a2::port', 'a1->m.y->a2::port']);
    expect(wanted.map((e) => lineageOf(e).targetPort)).toEqual(['m.x', undefined]);
  });

  test('only the reader open: every column it reads, starting on the writer', () => {
    const { wanted } = columnLineageEdges([action('a1', 'none'), action('a2', 'all')], [edge]);
    expect(idsOf(wanted)).toEqual(['a1->m.x->a2::port', 'a1->m.z->a2::port']);
    expect(wanted.map((e) => lineageOf(e).sourcePort)).toEqual(['m.x', undefined]);
  });
});
