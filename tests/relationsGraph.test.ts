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
  buildTableIndex,
  getIncomingRefs,
  getRelationsGraph,
  resolveFkTarget,
} from '../src/util/ConfigExplorer/RelationsGraph.ts';

/** a configuration with no actions, so that only the foreign keys shape the relations graph */
function config(dataObjects: any, connections: any = {}) {
  return new ConfigData({ dataObjects, actions: {}, connections });
}

const fk = (table: string, columns: Record<string, string>, extra: any = {}) =>
  ({ table, columns, ...extra });

describe('the table index', () => {
  test('registers a table fully qualified, by db and bare', () => {
    const index = buildTableIndex(config({
      'int-airports': { table: { catalog: 'main', db: 'default', name: 'int_airports' } },
    }));
    expect(index.get('main.default.int_airports')).toBe('int-airports');
    expect(index.get('default.int_airports')).toBe('int-airports');
    expect(index.get('int_airports')).toBe('int-airports');
  });

  test('takes the db from the connection when the table does not name one', () => {
    const index = buildTableIndex(config(
      { 'int-airports': { connectionId: 'dwh', table: { name: 'int_airports' } } },
      { dwh: { type: 'SnowflakeTableConnection', db: 'reporting' } },
    ));
    expect(index.get('reporting.int_airports')).toBe('int-airports');
  });

  test('a name two tables would claim is registered for neither', () => {
    const index = buildTableIndex(config({
      'stg-airports': { table: { db: 'staging', name: 'airports' } },
      'int-airports': { table: { db: 'integration', name: 'airports' } },
    }));
    expect(index.get('airports')).toBeUndefined();
    expect(index.get('staging.airports')).toBe('stg-airports');
    expect(index.get('integration.airports')).toBe('int-airports');
  });

  test('a data object without a table is not in the index', () => {
    expect(buildTableIndex(config({ 'ext-airports': { type: 'WebserviceFileDataObject' } })).size).toBe(0);
  });
});

describe('resolving a foreign key target', () => {
  const configData = config({
    'int-airports': { table: { db: 'default', name: 'int_airports' } },
    'other-airports': { table: { db: 'reference', name: 'int_airports' } },
    'int-departures': { table: { db: 'default', name: 'int_departures' } },
  });
  const departures = configData.dataObjects['int-departures'];

  test('an unqualified key is read as living in the declaring data object\'s db', () => {
    expect(resolveFkTarget(fk('int_airports', {}), departures, configData)).toBe('int-airports');
  });

  test('a key naming its own db wins over that fallback', () => {
    expect(resolveFkTarget(fk('int_airports', {}, { db: 'reference' }), departures, configData))
      .toBe('other-airports');
  });

  test('a key pointing outside the configuration resolves to nothing', () => {
    expect(resolveFkTarget(fk('airlines', {}), departures, configData)).toBeUndefined();
  });
});

describe('building the graph', () => {
  const configData = config({
    'int-airports': { table: { db: 'default', name: 'int_airports', primaryKey: ['ident'] } },
    'int-departures': {
      table: {
        db: 'default', name: 'int_departures',
        foreignKeys: [
          fk('int_airports', { estdepartureairport: 'ident' }, { name: 'fk_departure_airport' }),
          fk('int_airports', { estarrivalairport: 'ident' }, { name: 'fk_arrival_airport' }),
          fk('airlines', { callsign: 'callsign' }, { name: 'fk_airline', db: 'reference' }),
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
