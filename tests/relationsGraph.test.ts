/**
 * The relations graph: DataObjects as nodes, their declared foreign keys as edges.
 *
 * Unlike the lineage graphs this one can contain cycles, so the traversals the lineage tab runs on
 * it are exercised here too.
 */
import { describe, expect, test } from 'vitest';
import { ConfigData } from '../src/util/ConfigExplorer/ConfigData.ts';
import {
  RelationEdge,
  getIncomingRefs,
  isKnownDataObject,
} from '../src/util/ConfigExplorer/RelationsGraph.ts';

/** a configuration with no actions, so that only the foreign keys shape the relations graph */
function config(dataObjects: any, connections: any = {}) {
  return new ConfigData({ dataObjects, actions: {}, connections });
}

/** a foreign key as SDLB 3.x writes it: it names the data object it references, not its table */
const fk = (dataObjectId: string, columns: Record<string, string>, extra: any = {}) =>
  ({ dataObjectId, columns, ...extra });

describe('which foreign keys become edges', () => {
  const configData = config({
    'int-airports': { table: { db: 'default', name: 'int_airports', primaryKey: ['ident'] } },
    'int-departures': {
      table: {
        db: 'default', name: 'int_departures',
        foreignKeys: [
          fk('int-airports', { estdepartureairport: 'ident' }, { name: 'fk_resolved' }),
          // a data object this configuration does not describe - legitimate, it may have been
          // filtered away by a feed selection
          fk('ext-airlines', { callsign: 'callsign' }, { name: 'fk_unknown' }),
          // the pre 3.x form, naming a table instead of a data object
          { name: 'fk_legacy', db: 'reference', table: 'airlines', columns: { callsign: 'callsign' } },
        ],
      },
    },
  });

  test('a key naming a data object of this configuration becomes an edge', () => {
    expect(configData.relationsGraph!.edges.map((e) => (e as RelationEdge).fkName)).toEqual(['fk_resolved']);
  });

  test('a key in the pre 3.x db/table form is ignored', () => {
    // it names a table, not a data object, and guessing which one is meant would risk a wrong relation
    expect(isKnownDataObject('airlines', configData)).toBe(false);
    expect(configData.relationsGraph!.edges.some((e) => (e as RelationEdge).fkName === 'fk_legacy')).toBe(false);
  });

  test('a key naming a data object outside this configuration is known to be unresolved', () => {
    expect(isKnownDataObject('int-airports', configData)).toBe(true);
    expect(isKnownDataObject('ext-airlines', configData)).toBe(false);
  });
});

describe('building the graph', () => {
  const configData = config({
    'int-airports': { table: { db: 'default', name: 'int_airports', primaryKey: ['ident'] } },
    'int-departures': {
      table: {
        db: 'default', name: 'int_departures',
        foreignKeys: [
          fk('int-airports', { estdepartureairport: 'ident' }, { name: 'fk_departure_airport' }),
          fk('int-airports', { estarrivalairport: 'ident' }, { name: 'fk_arrival_airport' }),
          fk('ext-airlines', { callsign: 'callsign' }, { name: 'fk_airline' }),
        ],
      },
    },
  });
  const graph = configData.relationsGraph!;

  test('the nodes are the data objects, shared with the other graphs', () => {
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['int-airports', 'int-departures']);
    // the very same instances the full graph holds, so node identity is shared across the views
    graph.nodes.forEach((node) => expect(configData.fullGraph!.nodes).toContain(node));
  });

  test('two foreign keys between the same pair are two edges', () => {
    expect(graph.edges.map((e) => e.id)).toEqual([
      'int-departures-fk:fk_departure_airport->int-airports',
      'int-departures-fk:fk_arrival_airport->int-airports',
    ]);
  });

  test('an edge points from the referencing to the referenced data object and carries its columns', () => {
    const edge = graph.edges[1] as RelationEdge;
    expect([edge.source, edge.target]).toEqual(['int-departures', 'int-airports']);
    expect(edge.columns).toEqual([{ from: 'estarrivalairport', to: 'ident' }]);
    expect(edge.fkName).toBe('fk_arrival_airport');
  });

  test('a key pointing outside the configuration produces no edge', () => {
    expect(graph.edges.some((e) => (e as RelationEdge).fkName === 'fk_airline')).toBe(false);
  });

  test('a multi column foreign key is one edge with one pair per column', () => {
    const multi = config({
      parent: { table: { db: 'd', name: 'parent' } },
      child: {
        table: {
          db: 'd', name: 'child',
          foreignKeys: [fk('parent', { a: 'x', b: 'y' }, { name: 'fk' })],
        },
      },
    }).relationsGraph!;
    expect(multi.edges).toHaveLength(1);
    expect((multi.edges[0] as RelationEdge).columns).toEqual([
      { from: 'a', to: 'x' }, { from: 'b', to: 'y' },
    ]);
  });

  test('a self reference is kept as an edge from a node to itself', () => {
    const selfRef = config({
      employee: {
        table: { db: 'd', name: 'employee', primaryKey: ['id'],
                 foreignKeys: [fk('employee', { manager_id: 'id' }, { name: 'fk_manager' })] },
      },
    }).relationsGraph!;
    expect(selfRef.edges).toHaveLength(1);
    expect(selfRef.edges[0].source).toBe('employee');
    expect(selfRef.edges[0].target).toBe('employee');
  });

  test('the incoming references of a data object name the referenced columns', () => {
    expect(getIncomingRefs('int-airports', graph)).toEqual([
      { column: 'ident', dataObjectId: 'int-departures', fromColumn: 'estdepartureairport', fkName: 'fk_departure_airport' },
      { column: 'ident', dataObjectId: 'int-departures', fromColumn: 'estarrivalairport', fkName: 'fk_arrival_airport' },
    ]);
    expect(getIncomingRefs('int-departures', graph)).toEqual([]);
  });
});

describe('cycles', () => {
  /*
      Foreign keys point in circles routinely - orders reference customers, customers reference
      their latest order. The lineage graphs are acyclic, so the traversals the lineage tab uses
      were written without a visited set; on a relations graph that would not terminate.
  */
  const cyclic = config({
    a: { table: { db: 'd', name: 'a', foreignKeys: [fk('b', { b_id: 'id' }, { name: 'fk_b' })] } },
    b: { table: { db: 'd', name: 'b', foreignKeys: [fk('c', { c_id: 'id' }, { name: 'fk_c' })] } },
    c: { table: { db: 'd', name: 'c', foreignKeys: [fk('a', { a_id: 'id' }, { name: 'fk_a' })] } },
  }).relationsGraph!;

  test('returnPartialGraphInputs terminates and returns each node once', () => {
    const [nodes, edges] = cyclic.returnPartialGraphInputs('a');
    expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
    expect(edges).toHaveLength(3);
  });

  test('returnDirectNeighbours gives the direct neighbours of a node in a cycle', () => {
    const [nodes] = cyclic.returnDirectNeighbours('a');
    expect(nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c']);
  });

  test('a self reference does not make the traversal loop', () => {
    const selfRef = config({
      employee: { table: { db: 'd', name: 'employee',
                           foreignKeys: [fk('employee', { manager_id: 'id' }, { name: 'fk' })] } },
    }).relationsGraph!;
    const [nodes] = selfRef.returnPartialGraphInputs('employee');
    expect(nodes.map((n) => n.id)).toEqual(['employee']);
  });
});

describe('a configuration without foreign keys', () => {
  test('gives a relations graph with nodes but no edges', () => {
    const graph = config({
      'int-airports': { table: { db: 'default', name: 'int_airports', primaryKey: ['ident'] } },
    }).relationsGraph!;
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });
});
