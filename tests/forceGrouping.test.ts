/**
 * Grouping the force layout of the relations view into convex hulls, see the Grouping section of
 * src/components/ConfigExplorer/LineageTab/README.md: tight groups, no hull overlapping another,
 * and nodes of no group outside every hull.
 */
import { readFileSync } from 'node:fs';
import { Edge as ReactFlowEdge, Node as ReactFlowNode } from 'reactflow';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigData } from '../src/util/ConfigExplorer/ConfigData';
import { DAGraph, DataObject, Edge } from '../src/util/ConfigExplorer/Graphs';
import { Grouping, HULL_GAP, boxDataOf, clearCollapsedGroups, groupBoxId, groupingKey, groupsOfGraph, isGroupBox, setGroupCollapsed } from '../src/util/ConfigExplorer/Grouping';
import { Point, boundsOf, centroidOf, convexHull, corners, separation } from '../src/util/ConfigExplorer/Hull';
import { ForceGroups, assignCoordinates, fitGroupBoxes, forceModelOf, forceModelOfFlow } from '../src/util/ConfigExplorer/LineageLayout';
import { groupFlowEdges, groupFlowNodes } from '../src/util/ConfigExplorer/LineageTabUtils';

describe('convex hull', () => {
    it('keeps the outer points, clockwise on the screen, and drops inner and collinear ones', () => {
        const hull = convexHull([{x: 0, y: 0}, {x: 2, y: 0}, {x: 4, y: 0}, {x: 4, y: 4}, {x: 0, y: 4}, {x: 2, y: 2}]);
        expect(hull).toEqual([{x: 0, y: 0}, {x: 4, y: 0}, {x: 4, y: 4}, {x: 0, y: 4}]);
    });

    it('separates two overlapping polygons along the shallower axis, away from the first', () => {
        const a = corners({x: 0, y: 0, width: 10, height: 10});
        const b = corners({x: 8, y: 2, width: 10, height: 10});
        const move = separation(a, b)!;
        expect(move.x).toBeCloseTo(2);
        expect(move.y).toBeCloseTo(0);
        expect(separation(a, b.map(p => ({x: p.x + move.x, y: p.y + move.y})))).toBeUndefined();
    });

    it('keeps a gap', () => {
        const a = corners({x: 0, y: 0, width: 10, height: 10});
        const b = corners({x: 12, y: 0, width: 10, height: 10});
        expect(separation(a, b)).toBeUndefined();
        expect(separation(a, b, 5)!.x).toBeCloseTo(3);
    });
});

/* The ReactFlow nodes of a whole graph in the force layout, as createReactFlowNodes stamps them. */
function forceFlowOf(graph: DAGraph, groupOf: Map<string, string | undefined>, grouping: Grouping,
                     sizeOf: (id: string) => {width: number, height: number} = () => ({width: 172, height: 36})) {
    const groups: ForceGroups = {key: groupingKey(grouping), of: groupOf};
    const model = forceModelOf(graph, groups);
    const nodes = graph.nodes.map(node => ({
        id: node.id, type: 'customDataNode', position: {x: 0, y: 0}, style: sizeOf(node.id),
        data: {label: node.id, forceCentre: model.get(node.id), grouping, groups: {along: groupOf.get(node.id)}, layoutDirection: 'LR'},
    }) as ReactFlowNode);
    const edges = graph.edges.map(edge => ({id: edge.id, source: edge.fromNode.id, target: edge.toNode.id,
        data: {relation: {sourceColumn: 'a', targetColumn: 'b'}}}) as ReactFlowEdge);
    return {nodes, edges};
}

function laidOut(flow: {nodes: ReactFlowNode[], edges: ReactFlowEdge[]}) {
    return fitGroupBoxes(assignCoordinates(groupFlowNodes(flow.nodes), flow.edges, 'LR'));
}

const hullsOf = (nodes: ReactFlowNode[]) => nodes.filter(node => isGroupBox(node) && !node.hidden && boxDataOf(node).hull);
const rectOf = (node: ReactFlowNode) => ({x: node.position.x, y: node.position.y, width: Number(node.style!.width), height: Number(node.style!.height)});

function expectApart(nodes: ReactFlowNode[], groupOf: Map<string, string | undefined>) {
    const hulls = hullsOf(nodes);
    hulls.forEach((a, i) => hulls.slice(i + 1).forEach(b =>
        expect(separation(boxDataOf(a).hull!, boxDataOf(b).hull!, HULL_GAP - 1), `${a.id} and ${b.id} overlap`).toBeUndefined()));
    const members = nodes.filter(node => !isGroupBox(node) && !node.hidden);
    members.forEach(node => hulls.forEach(hull => {
        if (boxDataOf(hull).key === groupOf.get(node.id)) return;
        expect(separation(boxDataOf(hull).hull!, corners(rectOf(node))), `${node.id} is inside ${hull.id}`).toBeUndefined();
    }));
}

// several groups related within and between each other, and a few nodes of no group
function syntheticGraph(): {graph: DAGraph, groupOf: Map<string, string | undefined>} {
    const groupOf = new Map<string, string | undefined>();
    const ids: string[] = [];
    ['g1', 'g2', 'g3', 'g4'].forEach((group, g) => {
        for (let i = 0; i < 4 + g; i++) {
            ids.push(`${group}-n${i}`);
            groupOf.set(`${group}-n${i}`, group);
        }
    });
    ['free-1', 'free-2', 'free-3'].forEach(id => { ids.push(id); groupOf.set(id, undefined); });
    let seed = 7;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    const pairs: [string, string][] = [];
    ids.forEach(a => ids.forEach(b => {
        if (a >= b) return;
        const same = groupOf.get(a) !== undefined && groupOf.get(a) === groupOf.get(b);
        if (random() < (same ? 0.5 : 0.06)) pairs.push([a, b]);
    }));
    const nodes = new Map(ids.map(id => [id, new DataObject(id)]));
    return {graph: new DAGraph([...nodes.values()], pairs.map(([a, b], i) => new Edge(nodes.get(a)!, nodes.get(b)!, `e${i}`))), groupOf};
}

describe('grouped force layout', () => {
    beforeEach(() => clearCollapsedGroups());
    const grouping: Grouping = {along: 'subjectArea'};

    it('draws one hull per group around its members, apart from each other and from the nodes of no group', () => {
        const {graph, groupOf} = syntheticGraph();
        const nodes = laidOut(forceFlowOf(graph, groupOf, grouping));

        expect(hullsOf(nodes).map(node => boxDataOf(node).key).sort()).toEqual(['g1', 'g2', 'g3', 'g4']);
        expectApart(nodes, groupOf);
    });

    it('keeps the groups tight: every member is nearer its own group than any other', () => {
        const {graph, groupOf} = syntheticGraph();
        const model = forceModelOf(graph, {key: groupingKey(grouping), of: groupOf});
        const byGroup = new Map<string, Point[]>();
        groupOf.forEach((group, id) => { if (group) byGroup.set(group, [...(byGroup.get(group) ?? []), model.get(id)!]); });
        const centres = new Map([...byGroup].map(([group, points]) => [group, centroidOf(points)]));

        groupOf.forEach((group, id) => {
            if (!group) return;
            const p = model.get(id)!;
            const distance = (c: Point) => Math.hypot(p.x - c.x, p.y - c.y);
            centres.forEach((centre, other) => {
                if (other !== group) expect(distance(centres.get(group)!)).toBeLessThan(distance(centre));
            });
        });
    });

    it('stays apart when nodes grow, e.g. open their columns', () => {
        const {graph, groupOf} = syntheticGraph();
        const nodes = laidOut(forceFlowOf(graph, groupOf, grouping, id => id.endsWith('n1') ? {width: 320, height: 420} : {width: 172, height: 36}));
        expectApart(nodes, groupOf);
    });

    it('is a function of the graph and the grouping alone', () => {
        const {graph, groupOf} = syntheticGraph();
        const first = forceModelOf(graph, {key: 'a', of: groupOf});
        const again = forceModelOf(new DAGraph([...graph.nodes].reverse(), [...graph.edges].reverse()), {key: 'a', of: groupOf});
        first.forEach((p, id) => expect(again.get(id)).toEqual(p));
        expect(forceModelOf(graph)).not.toEqual(first);
    });

    it('collapses a hull to a node where its members are, taking their relations along', () => {
        const {graph, groupOf} = syntheticGraph();
        setGroupCollapsed(groupBoxId('along', 'g1'), true);
        const flow = forceFlowOf(graph, groupOf, grouping);
        const nodes = laidOut(flow);
        const box = nodes.find(node => node.id === groupBoxId('along', 'g1'))!;

        expect(boxDataOf(box).collapsed).toBe(true);
        expect(nodes.filter(node => groupOf.get(node.id) === 'g1').every(node => node.hidden)).toBe(true);
        expectApart(nodes, groupOf);
        const merged = groupFlowEdges(nodes, flow.edges).filter(edge => edge.source === box.id || edge.target === box.id);
        expect(merged.length).toBeGreaterThan(0);
        // the other end of a merged relation is a data object's relation handle
        merged.filter(edge => !edge.target.startsWith('group:')).forEach(edge => expect(edge.targetHandle).not.toBe(edge.target));
    });
});

describe('grouped force layout of the fixture', () => {
    const configData = new ConfigData(JSON.parse(readFileSync('tests/e2e/fixtures/exported/exportedConfig.json', 'utf8')));

    it('groups the data objects of the relations graph by subject area', () => {
        const graph = configData.relationsGraph!;
        const grouping: Grouping = {along: 'subjectArea'};
        const groups = groupsOfGraph(graph, configData, grouping);
        const groupOf = new Map([...groups].map(([id, g]) => [id, g.along]));
        const nodes = laidOut(forceFlowOf(graph, groupOf, grouping));

        expect(hullsOf(nodes).map(node => boxDataOf(node).key).sort()).toEqual(['airports', 'flight data']);
        expectApart(nodes, groupOf);
        // a hull's bounds are the node's own
        hullsOf(nodes).forEach(hull => {
            const bounds = boundsOf(boxDataOf(hull).hull!);
            expect(hull.position).toEqual({x: bounds.x, y: bounds.y});
        });
    });
});

describe('relations in the force layout', () => {
    beforeEach(() => clearCollapsedGroups());

    it('lays related nodes out side by side, as a relation leaves and enters on a left or right border', () => {
        const {graph} = syntheticGraph();
        const model = forceModelOf(graph);
        const level = graph.edges.filter(edge => {
            const a = model.get(edge.fromNode.id)!, b = model.get(edge.toNode.id)!;
            return Math.abs(a.x - b.x) > Math.abs(a.y - b.y);
        });
        // not every one can be, in a graph this dense, but most are - without the force it is about half
        expect(level.length / graph.edges.length).toBeGreaterThan(0.7);
    });

    it('re-runs on what is shown: a collapsed group is one node, its members are left out', () => {
        const {graph, groupOf} = syntheticGraph();
        setGroupCollapsed(groupBoxId('along', 'g1'), true);
        const flow = forceFlowOf(graph, groupOf, {along: 'subjectArea'});
        const nodes = laidOut(flow);
        const centres = forceModelOfFlow(nodes, groupFlowEdges(nodes, flow.edges));

        expect(centres.has(groupBoxId('along', 'g1'))).toBe(true);
        expect([...centres.keys()].some(id => groupOf.get(id) === 'g1')).toBe(false);
        expect(centres.has('g2-n0')).toBe(true);
    });
});

