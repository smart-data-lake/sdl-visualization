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
import { ForceGroups, assignCoordinates, fitGroupBoxes, forceModelOf, forceModelOfFlow, shownForceCentreOf } from '../src/util/ConfigExplorer/LineageLayout';
import { groupFlowEdges, groupFlowNodes, rerunForceLayout } from '../src/util/ConfigExplorer/LineageTabUtils';

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
        const {centres} = forceModelOfFlow(nodes, groupFlowEdges(nodes, flow.edges));

        expect(centres.has(groupBoxId('along', 'g1'))).toBe(true);
        expect([...centres.keys()].some(id => groupOf.get(id) === 'g1')).toBe(false);
        expect(centres.has('g2-n0')).toBe(true);
    });
});

describe('re-running the force layout, keeping the moved nodes', () => {
    beforeEach(() => clearCollapsedGroups());
    const grouping: Grouping = {along: 'subjectArea'};
    const moved = (node: ReactFlowNode, by: {x: number, y: number}) =>
        ({...node, position: {x: node.position.x + by.x, y: node.position.y + by.y}, data: {...node.data, manualOffset: by}});

    it('pins a moved node where it is shown and lets the others settle around it', () => {
        const {graph, groupOf} = syntheticGraph();
        const flow = forceFlowOf(graph, groupOf, grouping);
        const nodes = laidOut(flow).map(node => node.id === 'free-1' ? moved(node, {x: 400, y: -300}) : node);

        const kept = forceModelOfFlow(nodes, flow.edges, {keepMoved: true}).centres;
        const pinned = nodes.find(node => node.id === 'free-1')!;
        expect(kept.get('free-1')).toEqual(shownForceCentreOf(pinned));
        const fresh = forceModelOfFlow(nodes, flow.edges).centres;
        expect(fresh.get('free-1')).not.toEqual(shownForceCentreOf(pinned));
    });

    it('does not push a moved node aside to make room, the others give way', () => {
        const {graph, groupOf} = syntheticGraph();
        const flow = forceFlowOf(graph, groupOf, grouping);
        const laid = laidOut(flow);
        const target = laid.find(node => node.id === 'g2-n0')!.position;
        const free = laid.find(node => node.id === 'free-2')!;
        // dropped right onto a member of another group
        const nodes = flow.nodes.map(node => node.id === 'free-2'
            ? {...node, data: {...node.data, manualOffset: {x: target.x - free.position.x, y: target.y - free.position.y}}} : node);

        const after = laidOut({nodes, edges: flow.edges});
        expect(after.find(node => node.id === 'free-2')!.position).toEqual(target);
        expectApart(after, groupOf);
    });
});

describe('re-running the force layout again', () => {
    beforeEach(() => clearCollapsedGroups());

    // just enough of a ReactFlow instance for rerunForceLayout
    function flowInstance(nodes: ReactFlowNode[], edges: ReactFlowEdge[]) {
        const state = {nodes, edges};
        const set = <T,>(key: 'nodes' | 'edges') => (update: T[] | ((current: T[]) => T[])) => {
            (state as any)[key] = typeof update === 'function' ? (update as any)(state[key]) : update;
        };
        return {state, rfi: {getNodes: () => state.nodes, getEdges: () => state.edges,
                             setNodes: set<ReactFlowNode>('nodes'), setEdges: set<ReactFlowEdge>('edges')} as any};
    }
    const positions = (nodes: ReactFlowNode[]) => new Map(nodes.filter(node => !node.hidden).map(node => [node.id, node.position]));
    const expectSame = (a: Map<string, {x: number, y: number}>, b: Map<string, {x: number, y: number}>) => {
        expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
        a.forEach((p, id) => {
            expect(b.get(id)!.x, id).toBeCloseTo(p.x, 3);
            expect(b.get(id)!.y, id).toBeCloseTo(p.y, 3);
        });
    };

    const cases: [string, boolean][] = [['with a moved node', true], ['without any', false], ];
    cases.forEach(([name, withMoved]) => it(`changes nothing when repeated, ${name}, also with a group collapsed`, () => {
        const {graph, groupOf} = syntheticGraph();
        setGroupCollapsed(groupBoxId('along', 'g3'), true);
        const flow = forceFlowOf(graph, groupOf, {along: 'subjectArea'});
        let nodes = laidOut(flow);
        if (withMoved) nodes = nodes.map(node => node.id === 'g1-n0'
            ? {...node, position: {x: node.position.x - 500, y: node.position.y + 200}, data: {...node.data, manualOffset: {x: -500, y: 200}}} : node);
        const {state, rfi} = flowInstance(nodes, groupFlowEdges(nodes, flow.edges));
        const movedAt = state.nodes.find(node => node.id === 'g1-n0')!.position;

        rerunForceLayout(rfi, true);
        const first = positions(state.nodes);
        if (withMoved) {
            expect(first.get('g1-n0')!.x).toBeCloseTo(movedAt.x, 6);
            expect(first.get('g1-n0')!.y).toBeCloseTo(movedAt.y, 6);
        }
        for (let click = 0; click < 3; click++) {
            rerunForceLayout(rfi, true);
            expectSame(first, positions(state.nodes));
        }
    }));

    it('re-runs with the nodes at their real size, so that tall ones do not stack and steepen their relations', () => {
        // the star of the screenshot: one data object related to two others, all three open on their columns
        const ids = ['btl', 'int-airports', 'int-departures'];
        const objects = new Map(ids.map(id => [id, new DataObject(id)]));
        const graph = new DAGraph([...objects.values()], [
            new Edge(objects.get('btl')!, objects.get('int-airports')!, 'e0'),
            new Edge(objects.get('int-departures')!, objects.get('int-airports')!, 'e1'),
        ]);
        const groupOf = new Map(ids.map(id => [id, 'compute']));
        const tall = (id: string) => ({width: 172, height: id === 'int-airports' ? 260 : 120});
        const flow = forceFlowOf(graph, groupOf, {along: 'feed'}, tall);
        const {state, rfi} = flowInstance(laidOut(flow), flow.edges);

        rerunForceLayout(rfi, false);
        const centre = (id: string) => {
            const node = state.nodes.find(node => node.id === id)!;
            return {x: node.position.x + 86, y: node.position.y + 18}; // the header, where the key columns start
        };
        ['btl', 'int-departures'].forEach(id => {
            const a = centre(id), b = centre('int-airports');
            const angle = Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180 / Math.PI;
            expect(angle, id).toBeLessThan(10);
        });
    });
});

describe('collapsing a hull', () => {
    beforeEach(() => clearCollapsedGroups());

    it('puts the collapsed group in the middle of its hull, also after a member was moved', () => {
        const {graph, groupOf} = syntheticGraph();
        const flow = forceFlowOf(graph, groupOf, {along: 'subjectArea'});
        // a member dragged away stretches the hull, and the collapsed group follows it there
        const nodes = flow.nodes.map(node => node.id === 'g2-n0' ? {...node, data: {...node.data, manualOffset: {x: -250, y: 120}}} : node);
        const open = laidOut({nodes, edges: flow.edges});
        const hull = open.find(node => node.id === groupBoxId('along', 'g2'))!;
        const middle = {x: hull.position.x + Number(hull.style!.width) / 2, y: hull.position.y + Number(hull.style!.height) / 2};

        setGroupCollapsed(groupBoxId('along', 'g2'), true);
        // laid out from where the members are, not from the open layout the final pass may have moved
        const collapsed = fitGroupBoxes(assignCoordinates(groupFlowNodes(open.map(node =>
            isGroupBox(node) ? node : {...node, data: {...node.data, forceCentre: {x: node.position.x + 86 - (node.data.manualOffset?.x ?? 0),
                                                                              y: node.position.y + 18 - (node.data.manualOffset?.y ?? 0)}}})), flow.edges, 'LR'));
        const box = collapsed.find(node => node.id === groupBoxId('along', 'g2'))!;
        const size = {width: Number(box.style!.width), height: Number(box.style!.height)};
        expect(box.position.x + size.width / 2).toBeCloseTo(middle.x, 0);
        expect(box.position.y + size.height / 2).toBeCloseTo(middle.y, 0);
    });
});

