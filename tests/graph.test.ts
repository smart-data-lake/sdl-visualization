
/**
 * Tests Graph class
 * 
 * The graph creation might need to be adapted (so that we dont have to create n separate actions 
 * for an n-ary function)
 * 
 * General Remarks:
 * 1. The edges are linked via action types
 * 2. ActionNode id (e.g. MyCustomScalaTransform) and ActionNode type (e.g. CustomDataFrameAction) are different
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
    const join_0 = new ActionObject([int_departures], [btl_dep_arr_airports], "join airports and departures", {type: "JOIN"})
    const join_1 = new ActionObject([int_airports], [btl_dep_arr_airports], "join airports and departures", {type: "JOIN"})
    const comp_dist = new ActionObject([btl_dep_arr_airports], [btl_distances], "compute distances", {type: "COMPUTE"})
    
    const e1 = new Edge(ext_departures, dld_ded_dep, "e1");
    const e2 = new Edge(dld_ded_dep, int_departures,"e2");
    const e3 = new Edge(ext_airports, dld_airp, "e3");
    const e4 = new Edge(dld_airp, stg_airports, "e4");
    const e5 = new Edge(stg_airports, hist_airp, "e5");
    const e6 = new Edge(hist_airp, int_airports, "e6");

    const e7 = new Edge(int_departures, join_0, "e7");
    const e8 = new Edge(int_airports, join_1, "e8");
    const e9 = new Edge(join_0, btl_dep_arr_airports, "e9");
    const e10 = new Edge(join_1, btl_dep_arr_airports, "e10");

    const e11 = new Edge(btl_dep_arr_airports, comp_dist, "e11");
    const e12 = new Edge(comp_dist, btl_distances, "e12");

    const g = new DAGraph([ext_airports, stg_airports, int_airports, ext_departures, int_departures, btl_dep_arr_airports, btl_distances, dld_ded_dep, dld_airp, hist_airp, join_0, join_1, comp_dist],
                          [e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11, e12]);
 

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
                          [e1, e2, e3, e4],
                          false);

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
  Note that each a_i is ONE type of action:

  {d1, d2, d4} -> a1 -> {d3},
  {d1, d2, d4} -> a1 -> {d5}
  {d4} -> a2 -> {d3}

  In this case, we actually have 2 separate a1s to d3 and d5, although they have the same action type
  We need to use set to remove duplicates when creating data graph since we only consider reachability in the data graph
  Hence the reachable sets should look like:

  {d1, d2, d4} -> a1 -> {d3, d5}

  This means that we will have 6 edges.
*/
  test('get data graph, multiple I/O sources', () => {
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    const n4 = new DataObject('n4');
    const n5 = new DataObject('n5');

    // we get something like n2->a13->n3 and n1->a13->n3 after merge, which is ok
    // as in SDL, for the same dataNode, the actionNode ids will be the same for the same actionType 
    const a13 = new ActionObject([n1], [n3], 'a13', {type: "actionType1"});
    const a15 = new ActionObject([n1], [n5], 'a15', {type: "actionType1"});
    const a23 = new ActionObject([n2], [n3], 'a23', {type: "actionType1"});
    const a25 = new ActionObject([n2], [n5], 'a25', {type: "actionType1"});
    const a43 = new ActionObject([n4], [n3], 'a43', {type: "actionType1"});
    const a45 = new ActionObject([n4], [n5], 'a45', {type: "actionType1"});
    const a43_ = new ActionObject([n4], [n3], 'a43_', {type: "actionType2"}); 

    const e15_in = new Edge(n1, a15, "e15_in");
    const e15_out = new Edge(a15, n5, "e15_out");
    const e13_in = new Edge(n1, a13, "e13_in");
    const e13_out = new Edge(a13, n3, "e13_out");
    const e23_in = new Edge(n2, a23, "e23_in");
    const e23_out = new Edge(a23, n3, "e23_out");
    const e25_in = new Edge(n2, a25, "e25_in");
    const e25_out = new Edge(a25, n5, "e25_out");
    const e43_in = new Edge(n4, a43, "e43_in1");
    const e43_out = new Edge(a43, n3, "e43_out1");
    const e45_in = new Edge(n4, a45, "e45_in");
    const e45_out = new Edge(a45, n5, "e45_out");
    const _e43_in = new Edge(n4, a43_, "e43_in2");
    const _e43_out = new Edge(a43_, n3, "e43_out2");

    const g = new DAGraph([n1, n2, n3, n4, n5, a13, a15, a23, a25, a43, a45, a43_], 
                          [e15_in, e15_out, e13_in, e13_out, e23_in, e23_out, e25_in, 
                            e25_out, e43_in, e43_out, e45_in, e45_out, _e43_in, _e43_out]);

    console.log(g.nodes);
    expect(g.nodes.length).toBe(8); // d1-d5, a1 x 2, a2
    expect(g.edges.length).toBe(10); // (3 + 1) x 2 + 2

    const dataGraph = g.getDataGraph();
    console.log(dataGraph.edges);
    expect(dataGraph.edges.length).toBe(6); 
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
    const a13 = new ActionObject([n1], [n3], 'a1', {type: "actionType1"});
    const a23 = new ActionObject([n2], [n3], 'a1', {type: "actionType1"});
    const a43 = new ActionObject([n4], [n3], 'a3', {type: "actionType2"});

    const e13_in = new Edge(n1, a13, "e13_in");
    const e13_out = new Edge(a13, n3, "e13_out");
    const e23_in = new Edge(n2, a23, "e23_in");
    const e23_out = new Edge(a23, n3, "e23_out");
    const e43_in = new Edge(n4, a43, "e43_in");
    const e43_out = new Edge(a43, n3, "e43_out");

    const g = new DAGraph([n1, n2, n3, n4, a13, a23, a43], 
                          [e13_in, e13_out, e23_in, e23_out, e43_in, e43_out]);
    
    // sanity checkh merge common edges
    // console.log("merged g: ", g.nodes);
    expect(g.nodes.length).toBe(6);
    expect(g.edges.length).toBe(5);

    const actionGraph = g.getActionGraph();

    // test action types
    expect(actionGraph.nodes.length).toBe(2);

    // should be the same as above
    const actionTypes = new Set(actionGraph.nodes.filter((n)=>n.nodeType));
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
    const a1 = new ActionObject([d1], [d3], 'join', {type: "actionType1"});
    const a2 = new ActionObject([d2], [d3], 'join', {type: "actionType1"});
    const a3 = new ActionObject([d4], [d1], 'comp d4-d1', {type: "actionType2"});
    const a4 = new ActionObject([d5], [d2], 'comp d5-d2', {type: "actionType3"});

    const e1_in = new Edge(d1, a1, 'e1_in');
    const e2_in = new Edge(d2, a2, 'e2_in');
    const e1_out = new Edge(a1, d3, 'e1_out');
    const e2_out = new Edge(a2, d3, 'e2_out');
    const e3_in = new Edge(d4, a3, 'e3_in');
    const e4_in = new Edge(d5, a4, 'e4_in');
    const e3_out = new Edge(a3, d1, 'e3_out');
    const e4_out = new Edge(a4, d2, 'e4_out');

    const g = new DAGraph([d1, d2, d3, d4, d5, a1, a2, a3, a4],
        [e1_in, e1_out, e2_in, e2_out, e3_in, e3_out, e4_in, e4_out])

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
                          [e1, e2, e3, e4],
                          false); // we don't merge data or action graph, only full graph

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
    Tests whether there are duplicates in the partial graph
    we need the edges to be merged in the constructor, if not, we would expect more nodes and edges, 
    which does not correspond to the displayed lineage graph. The lineage graph maskes use of the
    function getActionObjects, where the edges are actually merged.

    if we don't merge n-ary actions in the constructor, we would expect more nodes and edges: i.e. we would have
    N nodes and 2N edges for every N-ary action
*/
test("get partial graph from demo example full graph, no duplicates", ()=>{
    const g = construct_demo_example_graph();

    const specificNodeId = 'btl-dep-arr-airports'; // the data object id directly after join
    const [nodes, edges] = g.returnPartialGraphInputs(specificNodeId); 
    expect(nodes.length).toBe(12); // no merge: 13
    expect(edges.length).toBe(11); // no merge: 12

    const [nodes_direct, edges_direct] = g.returnDirectNeighbours(specificNodeId);
    expect(nodes_direct.length).toBe(3); // no merge: 4
    expect(edges_direct.length).toBe(2); // no merge: 3
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
    const a24 = new ActionObject([n2], [n4], 'transform3', {type: "actionType2"});
    const a34 = new ActionObject([n3], [n4], 'transform3', {type: "actionType2"});

    const e1 = new Edge(n1, a1, "e1");
    const e2 = new Edge(a1, n2, "e2");
    const e3 = new Edge(n1, a2, "e3");
    const e4 = new Edge(a2, n3, "e4");
    const e24_in = new Edge(n2, a24, "e24_in");
    const e24_out = new Edge(a24, n4, "e24_in");
    const e34_in = new Edge(n3, a34, "e24_in");
    const e34_out = new Edge(a34, n4, "e24_in");


    const g = new DAGraph(
        [n1, n2, n3, n4, a1, a2, a24, a34], 
        [e1, e2, e3, e4, e24_in, e24_out, e34_in, e34_out],
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
    const a2 = new ActionObject([n2], [N], 'transform2', {type: "actionType2"});
    const a3 = new ActionObject([n3], [N], 'transform3', {type: "actionType2"});
    const a4 = new ActionObject([n4], [N], 'transform4', {type: "actionType3"});
    const a5 = new ActionObject([n5], [N], 'transform5', {type: "actionType3"});
    const a6 = new ActionObject([n6], [N], 'transform6', {type: "actionType3"});

    const e1 = new Edge(n1, a1, "e1_in");
    const e1_ = new Edge(a1, N, "e1_out");
    const e2 = new Edge(n2, a2, "e2_in");
    const e2_ = new Edge(a2, N, "e2_out");
    const e3 = new Edge(n3, a3, "e3_in");
    const e3_ = new Edge(a3, N, "e3_out");
    const e4 = new Edge(n4, a4, "e4_in");
    const e4_ = new Edge(a4, N, "e4_out");
    const e5 = new Edge(n5, a5, "e5_in");
    const e5_ = new Edge(a5, N, "e5_out");
    const e6 = new Edge(n6, a6, "e6_in");
    const e6_ = new Edge(a6, N, "e6_out");

    const g = new DAGraph(
        [n1, n2, n3, n4, n5, n6, a1, a2, a3, a4, a5, a6, N],
        [e1, e1_, e2, e2_, e3, e3_, e4, e4_, e5, e5_, e6, e6_]
    )

    expect(g.nodes.length).toBe(10); // 6 n_i + 1 N + 3 a_i
    expect(g.edges.length).toBe(9); // (1 + 2 + 3) in + 3 out
})


// TODO: maybe add reachability tests