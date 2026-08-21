
/**
 * Tests Graph class
 * 
 * General Remarks:
 * 1. The edges are linked via action types
 * 2. ActionNode id (e.g. MyCustomScalaTransform) and ActionNode type (e.g. CustomDataFrameAction) are different
 * 3. An n-ary action is ONE ActionObject holding all its inputs and outputs, with one edge per
 *    input and per output. This mirrors how getActionsObjects() builds the graph from the config:
 *    an action id appears exactly once, so the graph needs no merging of duplicated action nodes.
 */
import { graphlib } from 'dagre';
import {DAGraph, NodeType, Node, Edge, ActionObject, DataObject, Action, DataObjectsAndActionsSep} from '../src/util/ConfigExplorer/Graphs.ts';
import {expect, test, it} from 'vitest';


function construct_demo_example_graph(): DAGraph {
    const ext_airports = new DataObject('ext-arports');
    const stg_airports = new DataObject('stg-airports');
    const int_airports = new DataObject('int-airports');
    const ext_departures = new DataObject('ext-departures');
    const int_departures = new DataObject('int-departures');
    const btl_dep_arr_airports = new DataObject('btl-dep-arr-airports');
    const btl_distances = new DataObject('btl-distances'); 

    const dld_ded_dep = new ActionObject([ext_departures], [int_departures], "download deduplicate departures", {type: "DOWNLOAD"})
    const dld_airp = new ActionObject([ext_airports], [stg_airports], "download airports", {type: "DOWNLOAD"})
    const hist_airp = new ActionObject([stg_airports], [int_airports], "historize airports", {type: "HISTORIZE"})
    const join = new ActionObject([int_departures, int_airports], [btl_dep_arr_airports], "join airports and departures", {type: "JOIN"})
    const comp_dist = new ActionObject([btl_dep_arr_airports], [btl_distances], "compute distances", {type: "COMPUTE"})
    
    const e1 = new Edge(ext_departures, dld_ded_dep, "e1");
    const e2 = new Edge(dld_ded_dep, int_departures,"e2");
    const e3 = new Edge(ext_airports, dld_airp, "e3");
    const e4 = new Edge(dld_airp, stg_airports, "e4");
    const e5 = new Edge(stg_airports, hist_airp, "e5");
    const e6 = new Edge(hist_airp, int_airports, "e6");

    const e7 = new Edge(int_departures, join, "e7");
    const e8 = new Edge(int_airports, join, "e8");
    const e9 = new Edge(join, btl_dep_arr_airports, "e9");

    const e10 = new Edge(btl_dep_arr_airports, comp_dist, "e10");
    const e11 = new Edge(comp_dist, btl_distances, "e11");

    const g = new DAGraph([ext_airports, stg_airports, int_airports, ext_departures, int_departures, btl_dep_arr_airports, btl_distances, dld_ded_dep, dld_airp, hist_airp, join, comp_dist],
                          [e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11]);
 

    return g;
}

test('data graph creation', () => {
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    const n4 = new DataObject('n4');

    const e1 = new Edge(n1, n2, "e1");
    const e2 = new Edge(n2, n3, "e2");
    const e3 = new Edge(n3, n4, "e3");
    const e4 = new Edge(n1, n3, "e4");

    const g = new DAGraph([n1, n2, n3, n4], 
                          [e1, e2, e3, e4]);

    expect(g.nodes.length).toBe(4);
    expect(g.edges.length).toBe(4);

    expect(e1.toNode.id).toBe("n2");
    expect(e1.fromNode.id).toBe("n1");

    expect(e2.toNode.id).toBe("n3");
    expect(e2.fromNode.id).toBe("n2");

    expect(e3.toNode.id).toBe("n4");
    expect(e3.fromNode.id).toBe("n3");

    expect(e4.toNode.id).toBe("n3");
    expect(e4.fromNode.id).toBe("n1");
})

/*
     n1 -> a1 -> n2 -> a2 -> n3 -> a3 -> n4
*/     
test('get data graph, single I/O source', () => {
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    const n4 = new DataObject('n4');

    const a1 = new ActionObject([n1], [n2], 'a1');
    const a2 = new ActionObject([n2], [n3], 'a2');
    const a3 = new ActionObject([n3], [n4], 'a3');

    const e11 = new Edge(n1, a1, "e11");
    const e12 = new Edge(a1, n2, "e12");
    const e21 = new Edge(n2, a2, "e21");
    const e22 = new Edge(a2, n3, "e22");
    const e31 = new Edge(n3, a3, "e31");
    const e32 = new Edge(a3, n4, "e32");

    const g = new DAGraph([n1, n2, n3, n4, a1, a2, a3], 
                          [e11, e12, e21, e22, e31, e32]);
    const dataGraph = g.getDataGraph();

    const edges = dataGraph.edges;
    const nodes = dataGraph.nodes;
    expect(nodes.length).toBe(4);
    expect(edges.length).toBe(3);
  

    edges.forEach((edge) => {
        expect(edge.fromNode.nodeType).toBe(NodeType.DataNode);
        expect(edge.toNode.nodeType).toBe(NodeType.DataNode);
    })

    // hard-coded edge values (naming conventions may change)
    const e_n1_n2 = dataGraph.getEdgeById(`${n1.id}->${a1.id}->${n2.id}`);
    const e_n2_n3 = dataGraph.getEdgeById(`${n2.id}->${a2.id}->${n3.id}`);
    const e_n3_n4 = dataGraph.getEdgeById(`${n3.id}->${a3.id}->${n4.id}`);

    expect(e_n1_n2).toBeDefined();
    expect(e_n2_n3).toBeDefined();
    expect(e_n3_n4).toBeDefined();

    expect(e_n1_n2?.fromNode).toBe(n1);
    expect(e_n1_n2?.toNode).toBe(n2);
    expect(e_n2_n3?.fromNode).toBe(n2);
    expect(e_n2_n3?.toNode).toBe(n3);
    expect(e_n3_n4?.fromNode).toBe(n3);
    expect(e_n3_n4?.toNode).toBe(n4);
})

/*
  Note that each a_i is ONE action:

  {d1, d2, d4} -> a1 -> {d3, d5}
  {d4} -> a2 -> {d3}

  The data graph only models reachability, so it drops the action nodes and keeps one edge per
  connected pair of data objects. d4 -> d3 exists through both a1 and a2 and is deduplicated,
  hence we expect 6 edges and not 7.
*/
  test('get data graph, multiple I/O sources', () => {
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    const n4 = new DataObject('n4');
    const n5 = new DataObject('n5');

    const a1 = new ActionObject([n1, n2, n4], [n3, n5], 'a1', {type: "actionType1"});
    const a2 = new ActionObject([n4], [n3], 'a2', {type: "actionType2"});

    const e1_in1 = new Edge(n1, a1, "e1_in1");
    const e1_in2 = new Edge(n2, a1, "e1_in2");
    const e1_in4 = new Edge(n4, a1, "e1_in4");
    const e1_out3 = new Edge(a1, n3, "e1_out3");
    const e1_out5 = new Edge(a1, n5, "e1_out5");
    const e2_in = new Edge(n4, a2, "e2_in");
    const e2_out = new Edge(a2, n3, "e2_out");

    const g = new DAGraph([n1, n2, n3, n4, n5, a1, a2], 
                          [e1_in1, e1_in2, e1_in4, e1_out3, e1_out5, e2_in, e2_out]);

    expect(g.nodes.length).toBe(7); // d1-d5, a1, a2
    expect(g.edges.length).toBe(7); // (3 in + 2 out) + (1 in + 1 out)

    const dataGraph = g.getDataGraph();
    expect(dataGraph.edges.length).toBe(6); // 3 x 2 through a1, d4->d3 through a2 is a duplicate
    expect(dataGraph.nodes.length).toBe(5);
})

// TODO
test('get data graph, data read from lineage', () => {
 
})

/*
     n1 -> a1 -> n2 -> a2 -> n3 
*/
test('get action graph, single I/O source', () => {
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    
    const a12 = new ActionObject([n1], [n2], 'a12', {type: "actionType1"});
    const a23 = new ActionObject([n2], [n3], 'a23', {type: "actionType2"});

    const e12_in = new Edge(n1, a12, "e12_in");
    const e12_out = new Edge(a12, n2, "e12_out");
    const e23_in = new Edge(n2, a23, "e23_in");
    const e23_out = new Edge(a23, n3, "e23_out");

    const g = new DAGraph([n1, n2, n3, a12, a23], 
                          [e12_in, e12_out, e23_in, e23_out]);

    const actionGraph = g.getActionGraph();

    expect(actionGraph.nodes.length).toBe(2);
    expect(actionGraph.edges.length).toBe(1); 
    // the data object the two actions share is kept on the edge and in its id, it is the only place
    // left to look up the metrics of the data that flowed between them
    expect(actionGraph.edges[0].dataObjectId).toBe('n2');
    expect(actionGraph.edges[0].id).toBe('a12->n2->a23');
})

/*
     n1 -> hist -> n1, i.e. an action reading and writing the same data object
*/
test('get action graph, an action is not its own successor', () => {
    const n0 = new DataObject('n0');
    const n1 = new DataObject('n1');

    const hist = new ActionObject([n0, n1], [n1], 'hist', {type: "actionType1"});

    const g = new DAGraph([n0, n1, hist],
                          [new Edge(n0, hist, "e0"), new Edge(n1, hist, "e1"), new Edge(hist, n1, "e2")]);

    // the historization pattern would make the action its own successor, which says nothing about
    // how the actions are connected
    expect(g.getActionGraph().edges.length).toBe(0);
})

/*
     a1 -> {n1, n2} -> a2, i.e. two actions sharing two data objects
*/
test('get action graph, two actions connected by two data objects', () => {
    const n0 = new DataObject('n0');
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');

    const a1 = new ActionObject([n0], [n1, n2], 'a1', {type: "actionType1"});
    const a2 = new ActionObject([n1, n2], [], 'a2', {type: "actionType2"});

    const g = new DAGraph([n0, n1, n2, a1, a2],
                          [new Edge(n0, a1, "e0"), new Edge(a1, n1, "e1"), new Edge(a1, n2, "e2"),
                           new Edge(n1, a2, "e3"), new Edge(n2, a2, "e4")]);

    const actionGraph = g.getActionGraph();

    // one edge per shared data object, with distinct ids - a single a1->a2 edge would hide one of
    // the two data flows, and two edges of the same id would collide in the ReactFlow instance
    expect(actionGraph.edges.length).toBe(2);
    expect(new Set(actionGraph.edges.map(e => e.id)).size).toBe(2);
    expect(actionGraph.edges.map(e => e.dataObjectId).sort()).toEqual(['n1', 'n2']);
})

/*
    {d1, d2} -> a1 -> {d3}; {d4} -> a3 -> {d3}
*/
test('get action graph, multiple I/O source', () => {
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    const n4 = new DataObject('n4');

    // we have two types of actions
    const a1 = new ActionObject([n1, n2], [n3], 'a1', {type: "actionType1"});
    const a3 = new ActionObject([n4], [n3], 'a3', {type: "actionType2"});

    const e1_in1 = new Edge(n1, a1, "e1_in1");
    const e1_in2 = new Edge(n2, a1, "e1_in2");
    const e1_out = new Edge(a1, n3, "e1_out");
    const e3_in = new Edge(n4, a3, "e3_in");
    const e3_out = new Edge(a3, n3, "e3_out");

    const g = new DAGraph([n1, n2, n3, n4, a1, a3], 
                          [e1_in1, e1_in2, e1_out, e3_in, e3_out]);

    expect(g.nodes.length).toBe(6);
    expect(g.edges.length).toBe(5);

    const actionGraph = g.getActionGraph();

    // test action types
    expect(actionGraph.nodes.length).toBe(2);

    const actionTypes = new Set((actionGraph.nodes as ActionObject[]).map(n => n.getActionType()));
    expect(actionTypes.size).toBe(2);
})

// TODO
test.skip('get action graph, data read from lineage', () => {
    
})

/*
    1.   d4 -> a3 ->  d1, d5 -> a4 -> d2
    2.   {d1, d2} -> {a1, a2} as a -> d3
*/
test("get action graph, single n-ary action, no duplicates", () => {
    const d1 = new DataObject('d1');
    const d2 = new DataObject('d2');
    const d3 = new DataObject('d3');
    const d4 = new DataObject('d4');
    const d5 = new DataObject('d5');
    const join = new ActionObject([d1, d2], [d3], 'join', {type: "actionType1"});
    const a3 = new ActionObject([d4], [d1], 'comp d4-d1', {type: "actionType2"});
    const a4 = new ActionObject([d5], [d2], 'comp d5-d2', {type: "actionType3"});

    const e1_in = new Edge(d1, join, 'e1_in');
    const e2_in = new Edge(d2, join, 'e2_in');
    const e1_out = new Edge(join, d3, 'e1_out');
    const e3_in = new Edge(d4, a3, 'e3_in');
    const e4_in = new Edge(d5, a4, 'e4_in');
    const e3_out = new Edge(a3, d1, 'e3_out');
    const e4_out = new Edge(a4, d2, 'e4_out');

    const g = new DAGraph([d1, d2, d3, d4, d5, join, a3, a4],
        [e1_in, e1_out, e2_in, e3_in, e3_out, e4_in, e4_out])

    const actionGraph = g.getActionGraph()

    expect(actionGraph.nodes.length).toBe(3);
    expect(actionGraph.edges.length).toBe(2);
    
})

/*
    The demo example:
    1. ext_departures -> dld_ded_dep -> int_departures
    2. ext_airports -> dld_airp -> stg_airports -> hist_airp -> int_airports
    3. {int_departures, int_airports} -> join -> btl_dep_arr_airports -> comp_dist -> btl_distances
*/
test("get action graph, demo example, no duplicates", () => {
    const g = construct_demo_example_graph();
    const actionGraph = g.getActionGraph();

    // check for duplicates
    actionGraph.edges.forEach( e => {
        console.log(e.fromNode.id + " TO " + e.toNode.id)
    })
    expect(actionGraph.edges.length).toBe(4);
    const actionIds = new Set(actionGraph.edges.map((n) => n.id));
    expect(actionIds.size).toBe(4);
})


test("get partial graph, data objects only, no duplicates", () =>{
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    const n4 = new DataObject('n4');

    const e1 = new Edge(n1, n2, "e1");
    const e2 = new Edge(n2, n3, "e2");
    const e3 = new Edge(n3, n4, "e3");
    const e4 = new Edge(n1, n3, "e4");

    const g = new DAGraph([n1, n2, n3, n4], 
                          [e1, e2, e3, e4]);

    const specificNodeId = 'n3';

    // returns the partial graph with the specific node as the root
    // includes every predecessor and successor node and their edges
    const [nodes, edges] = g.returnPartialGraphInputs(specificNodeId)
    expect(nodes.length).toBe(4);
    expect(edges.length).toBe(4);

    // returns the direct neighbours of the specific node
    // the edges between the direct neighbours are not present
    const [nodes_direct, edges_direct] = g.returnDirectNeighbours(specificNodeId);
    expect(nodes_direct.length).toBe(4);
    expect(edges_direct.length).toBe(3);
})

/*
    Tests whether there are duplicates in the partial graph.
    An n-ary action is a single node, as getActionsObjects() builds it from the config, so the
    partial graph contains it once. Were it split per input, we would see N nodes and 2N edges
    for every N-ary action, which would not correspond to the displayed lineage graph.
*/
test("get partial graph from demo example full graph, no duplicates", ()=>{
    const g = construct_demo_example_graph();

    const specificNodeId = 'btl-dep-arr-airports'; // the data object id directly after join
    const [nodes, edges] = g.returnPartialGraphInputs(specificNodeId); 
    expect(nodes.length).toBe(12); // 7 data objects + 5 actions
    expect(edges.length).toBe(11); // one per action input and output

    const [nodes_direct, edges_direct] = g.returnDirectNeighbours(specificNodeId);
    expect(nodes_direct.length).toBe(3); // join, comp distances and the node itself
    expect(edges_direct.length).toBe(2);
})


/*
 * n1 -> a1 -> n2
   n1 -> a2 -> n3
 */
test("simple open branch", () =>{
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    const a1 = new ActionObject([n1], [n2], 'transform1', {type: "actionType1"});
    const a2 = new ActionObject([n1], [n3], 'transform2', {type: "actionType1"});

    const e1 = new Edge(n1, a1, "e1");
    const e2 = new Edge(a1, n2, "e2");
    const e3 = new Edge(n1, a2, "e3");
    const e4 = new Edge(a2, n3, "e4");

    const g = new DAGraph(
        [n1, n2, n3, a1, a2], 
        [e1, e2, e3, e4],
    );

    expect(g.nodes.length).toBe(5);
    expect(g.edges.length).toBe(4);

    const ag = g.getActionGraph();
    const dg = g.getDataGraph();

    expect(ag.nodes.length).toBe(2);
    expect(ag.edges.length).toBe(0);
    expect(dg.nodes.length).toBe(3);
    expect(dg.edges.length).toBe(2);
})

/*
 * n1 -> a1 -> n2
   n1 -> a2 -> n3
   {n2, n3} -> a3 -> n4
 */
test("simple closed branch", () =>{
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    const n4 = new DataObject('n4');
    const a1 = new ActionObject([n1], [n2], 'transform1', {type: "actionType1"});
    const a2 = new ActionObject([n1], [n3], 'transform2', {type: "actionType1"});
    const a3 = new ActionObject([n2, n3], [n4], 'transform3', {type: "actionType2"});

    const e1 = new Edge(n1, a1, "e1");
    const e2 = new Edge(a1, n2, "e2");
    const e3 = new Edge(n1, a2, "e3");
    const e4 = new Edge(a2, n3, "e4");
    const e3_in2 = new Edge(n2, a3, "e3_in2");
    const e3_in3 = new Edge(n3, a3, "e3_in3");
    const e3_out = new Edge(a3, n4, "e3_out");

    const g = new DAGraph(
        [n1, n2, n3, n4, a1, a2, a3], 
        [e1, e2, e3, e4, e3_in2, e3_in3, e3_out],
    );

    expect(g.nodes.length).toBe(7);
    expect(g.edges.length).toBe(7);

    const ag = g.getActionGraph();
    const dg = g.getDataGraph();

    expect(ag.nodes.length).toBe(3);
    expect(ag.edges.length).toBe(2);
    expect(dg.nodes.length).toBe(4);
    expect(dg.edges.length).toBe(4);
})

/*
    Note that each a_i is ONE type of action:

    n1 -> a1 -> N
    {n2, n3} -> a2 -> N
    {n4, n5, n6} -> a3 -> N
*/
test("N:1 action, > 2 action types", () =>{
    const N = new DataObject('N');
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    const n4 = new DataObject('n4');
    const n5 = new DataObject('n5');
    const n6 = new DataObject('n6');

    const a1 = new ActionObject([n1], [N], 'transform1', {type: "actionType1"});
    const a2 = new ActionObject([n2, n3], [N], 'transform2', {type: "actionType2"});
    const a3 = new ActionObject([n4, n5, n6], [N], 'transform3', {type: "actionType3"});

    const e1_in1 = new Edge(n1, a1, "e1_in1");
    const e1_out = new Edge(a1, N, "e1_out");
    const e2_in2 = new Edge(n2, a2, "e2_in2");
    const e2_in3 = new Edge(n3, a2, "e2_in3");
    const e2_out = new Edge(a2, N, "e2_out");
    const e3_in4 = new Edge(n4, a3, "e3_in4");
    const e3_in5 = new Edge(n5, a3, "e3_in5");
    const e3_in6 = new Edge(n6, a3, "e3_in6");
    const e3_out = new Edge(a3, N, "e3_out");

    const g = new DAGraph(
        [n1, n2, n3, n4, n5, n6, a1, a2, a3, N],
        [e1_in1, e1_out, e2_in2, e2_in3, e2_out, e3_in4, e3_in5, e3_in6, e3_out]
    )

    expect(g.nodes.length).toBe(10); // 6 n_i + 1 N + 3 a_i
    expect(g.edges.length).toBe(9); // (1 + 2 + 3) in + 3 out
})


// TODO: maybe add reachability tests