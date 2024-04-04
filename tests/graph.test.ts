
/**
 * Tests Graph class
 */
import {DAGraph, NodeType, Node, Edge, ActionObject, DataObject, Action} from '../src/util/ConfigExplorer/Graphs.ts';
import {expect, test, it} from 'vitest';

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
                          [e1, e2, e3, e4],);

    expect(e1.toNode.id).toBe("n2");
    expect(e1.fromNode.id).toBe("n1");

    expect(e2.toNode.id).toBe("n3");
    expect(e2.fromNode.id).toBe("n2");

    expect(e3.toNode.id).toBe("n4");
    expect(e3.fromNode.id).toBe("n3");

    expect(e4.toNode.id).toBe("n3");
    expect(e4.fromNode.id).toBe("n1");
})


// n1 -> a1 -> n2 -> a2 -> n3 -> a3 -> n4
test('get data graph, single I/O source', () => {
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    const n4 = new DataObject('n4');

    const a1 = new ActionObject(n1, n2, 'a1');
    const a2 = new ActionObject(n2, n3, 'a2');
    const a3 = new ActionObject(n3, n4, 'a3');

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

    // hard-coded edge values
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

//  {d1, d2, d4} -> a1 -> {d3, d5}; {d4} -> a2 -> {d3}
test('get data graph, multiple I/O sources', () => {
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    const n4 = new DataObject('n4');
    const n5 = new DataObject('n5');

    const a13 = new ActionObject(n1, n3, 'a13');
    const a15 = new ActionObject(n1, n5, 'a15');
    const a23 = new ActionObject(n2, n3, 'a23');
    const a25 = new ActionObject(n2, n5, 'a25');
    const a43 = new ActionObject(n4, n3, 'a43');
    const a45 = new ActionObject(n4, n5, 'a45');
    const a43_ = new ActionObject(n4, n3, '_a43_'); 

    const e15_in = new Edge(n1, a15, "e15_in");
    const e15_out = new Edge(a15, n5, "e15_out");
    const e13_in = new Edge(n1, a13, "e13_in");
    const e13_out = new Edge(a13, n3, "e13_out");
    const e23_in = new Edge(n2, a23, "e23_in");
    const e23_out = new Edge(a23, n3, "e23_out");
    const e25_in = new Edge(n2, a25, "e25_in");
    const e25_out = new Edge(a25, n5, "e25_out");
    const e43_in = new Edge(n4, a43, "e43_in");
    const e43_out = new Edge(a43, n3, "e43_out");
    const e45_in = new Edge(n4, a45, "e45_in");
    const e45_out = new Edge(a45, n5, "e45_out");
    const _e43_in = new Edge(n4, a43_, "_e43_in");
    const _e43_out = new Edge(a43_, n3, "_e43_out");

    const g = new DAGraph([n1, n2, n3, n4, n5, a13, a15, a23, a25, a43, a45, a43_], 
                          [e15_in, e15_out, e13_in, e13_out, e23_in, e23_out, e25_in, 
                            e25_out, e43_in, e43_out, e45_in, e45_out, _e43_in, _e43_out]);
    
    const dataGraph = g.getDataGraph();

    expect(dataGraph.edges.length).toBe(7);
    expect(dataGraph.nodes.length).toBe(5);

    // hard-coded edge values
    const e_n1_n5 = dataGraph.getEdgeById(`${n1.id}->${a15.id}->${n5.id}`);
    const e_n1_n3 = dataGraph.getEdgeById(`${n1.id}->${a13.id}->${n3.id}`);
    const e_n2_n5 = dataGraph.getEdgeById(`${n2.id}->${a25.id}->${n5.id}`);
    const e_n2_n3 = dataGraph.getEdgeById(`${n2.id}->${a23.id}->${n3.id}`);
    const e_n4_n5 = dataGraph.getEdgeById(`${n4.id}->${a45.id}->${n5.id}`);
    const e_n4_n3 = dataGraph.getEdgeById(`${n4.id}->${a43.id}->${n3.id}`);
    const e_n4_n3_ = dataGraph.getEdgeById(`${n4.id}->${a43_.id}->${n3.id}`);

    expect(e_n1_n5).toBeDefined();
    expect(e_n1_n3).toBeDefined();
    expect(e_n2_n5).toBeDefined();
    expect(e_n2_n3).toBeDefined();
    expect(e_n4_n5).toBeDefined();
    expect(e_n4_n3).toBeDefined();
    expect(e_n4_n3_).toBeDefined();
})

// TODO
test('get data graph, data read from lineage', () => {
    
})

// n1 -> a1 -> n2 -> a2 -> n3 
test('get action graph, single I/O source', () => {
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    
    const a12 = new ActionObject(n1, n2, 'a12', {type: "actionType1"});
    const a23 = new ActionObject(n2, n3, 'a23', {type: "actionType2"});

    const e12_in = new Edge(n1, a12, "e12_in");
    const e12_out = new Edge(a12, n2, "e12_out");
    const e23_in = new Edge(n2, a23, "e23_in");
    const e23_out = new Edge(a23, n3, "e23_out");

    const g = new DAGraph([n1, n2, n3, a12, a23], 
                          [e12_in, e12_out, e23_in, e23_out]);

    const actionGraph = g.getActionGraph();
    expect(actionGraph.nodes.length).toBe(2);
    expect(actionGraph.edges.length).toBe(1); // might need to be adjusted if we introduce source and sink nodes
})

// {d1, d2} -> a1 -> {d3}; {d4} -> a3 -> {d3}
test('get action graph, multiple I/O source', () => {
    const n1 = new DataObject('n1');
    const n2 = new DataObject('n2');
    const n3 = new DataObject('n3');
    const n4 = new DataObject('n4');

    // we have two types of actions
    const a13 = new ActionObject(n1, n3, 'a13', {type: "actionType1"});
    const a23 = new ActionObject(n2, n3, 'a23', {type: "actionType1"});
    const a43 = new ActionObject(n4, n3, 'a43', {type: "actionType2"});

    const e13_in = new Edge(n1, a13, "e13_in");
    const e13_out = new Edge(a13, n3, "e13_out");
    const e23_in = new Edge(n2, a23, "e23_in");
    const e23_out = new Edge(a23, n3, "e23_out");
    const e43_in = new Edge(n4, a43, "e43_in");
    const e43_out = new Edge(a43, n3, "e43_out");

    const g = new DAGraph([n1, n2, n3, n4, a13, a23, a43], 
                          [e13_in, e13_out, e23_in, e23_out, e43_in, e43_out]);

    const actionGraph = g.getActionGraph();

    // test action types
    expect(actionGraph.nodes.length).toBe(2);

    // should be the same as above
    const actionTypes = new Set(actionGraph.nodes.filter((n)=>n.nodeType));
    expect(actionTypes.size).toBe(2);
})

// TODO
test('get action graph, data read from lineage', () => {
    
})
