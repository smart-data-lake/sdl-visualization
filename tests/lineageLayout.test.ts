/**
 * The stable layout of the lineage graph: a node's (rank, order) is computed once per graph, the
 * coordinates follow from it. What these tests guard is that the order never changes - that is the
 * property the user reads as "the graph stayed where it was".
 */
import { Node as ReactFlowNode } from 'reactflow';
import { describe, expect, it } from 'vitest';
import { DAGraph, DataObject, Edge } from '../src/util/ConfigExplorer/Graphs.ts';
import {
    LAYOUT_NODESEP, LAYOUT_RANKSEP, LayoutDirection, LayoutModel,
    assignCoordinates, layoutModelOf, placementOf
} from '../src/util/ConfigExplorer/LineageLayout.ts';

function graphOf(ids: string[], edges: [string, string][]): DAGraph {
    const nodes = new Map(ids.map(id => [id, new DataObject(id)]));
    return new DAGraph([...nodes.values()],
        edges.map(([from, to], i) => new Edge(nodes.get(from)!, nodes.get(to)!, `e${i}`)));
}

// a diamond with a tail, so there is a rank holding more than one node
const DIAMOND: [string[], [string, string][]] = [
    ['a', 'b', 'c', 'd', 'e'],
    [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd'], ['d', 'e']],
];

function shuffled<T>(items: T[], seed: number): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        const j = seed % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function rfNode(id: string, model: LayoutModel, style?: {width: number, height: number}): ReactFlowNode {
    return {id, position: {x: 0, y: 0}, data: {placement: model.placement.get(id)}, style} as ReactFlowNode;
}

const rfEdges = DIAMOND[1].map(([source, target]) =>
    ({id: `${source}->${target}`, source, target}) as any);

/* The mental map property: how many pairs sharing a rank swapped their cross axis order. */
function orderInversions(before: ReactFlowNode[], after: ReactFlowNode[], direction: LayoutDirection): number {
    const cross = direction === 'TB' ? 'x' : 'y';
    const positionsAfter = new Map(after.map(node => [node.id, node.position[cross]]));
    const shared = before.filter(node => positionsAfter.has(node.id));
    let inversions = 0;
    shared.forEach((u, i) => shared.slice(i + 1).forEach(v => {
        if (placementOf(u)!.rank !== placementOf(v)!.rank) return;
        const wasBefore = u.position[cross] < v.position[cross];
        const isBefore = positionsAfter.get(u.id)! < positionsAfter.get(v.id)!;
        if (wasBefore !== isBefore) inversions++;
    }));
    return inversions;
}

describe('layoutModelOf', () => {
    it('places every node of the graph', () => {
        const model = layoutModelOf(graphOf(...DIAMOND), 'TB');

        expect([...model.placement.keys()].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
        expect(model.placement.get('a')!.rank).toBeLessThan(model.placement.get('b')!.rank);
        expect(model.placement.get('b')!.rank).toBe(model.placement.get('c')!.rank);
        expect(model.placement.get('b')!.order).not.toBe(model.placement.get('c')!.order);
    });

    it('is the same whichever order the graph was built in', () => {
        // the node list of a partial graph comes out of a traversal that starts at the selected
        // node - the layout must not depend on which node that was
        const [ids, edges] = DIAMOND;
        const reference = layoutModelOf(graphOf(ids, edges), 'TB');

        for (let seed = 1; seed <= 5; seed++) {
            const permuted = layoutModelOf(graphOf(shuffled(ids, seed), shuffled(edges, seed * 7)), 'TB');
            expect([...permuted.placement.entries()].sort()).toEqual([...reference.placement.entries()].sort());
        }
    });

    it('caches per graph and direction', () => {
        const graph = graphOf(...DIAMOND);

        expect(layoutModelOf(graph, 'TB')).toBe(layoutModelOf(graph, 'TB'));
        expect(layoutModelOf(graph, 'LR')).not.toBe(layoutModelOf(graph, 'TB'));
    });

    it('places a cyclic graph - the relations graph is not acyclic', () => {
        const model = layoutModelOf(graphOf(['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['c', 'a']]), 'LR');

        expect([...model.placement.keys()].sort()).toEqual(['a', 'b', 'c']);
    });
});

describe('assignCoordinates', () => {
    const model = layoutModelOf(graphOf(...DIAMOND), 'TB');
    const size = {width: 200, height: 80};
    const all = () => ['a', 'b', 'c', 'd', 'e'].map(id => rfNode(id, model, size));

    it('lays the ranks out along the main axis, in order along the cross axis', () => {
        const laidOut = assignCoordinates(all(), rfEdges, 'TB');
        const at = (id: string) => laidOut.find(node => node.id === id)!.position;

        expect(at('b').y).toBe(at('c').y);
        expect(at('b').y - at('a').y).toBe(80 + LAYOUT_RANKSEP);
        const [first, second] = [model.placement.get('b')!.order < model.placement.get('c')!.order ? 'b' : 'c',
                                 model.placement.get('b')!.order < model.placement.get('c')!.order ? 'c' : 'b'];
        expect(at(second).x - at(first).x).toBe(200 + LAYOUT_NODESEP);
    });

    it('does not touch the nodes it is given', () => {
        const nodes = all();
        assignCoordinates(nodes, rfEdges, 'TB');

        expect(nodes.every(node => node.position.x === 0 && node.position.y === 0)).toBe(true);
    });

    it('is its own fixed point', () => {
        const once = assignCoordinates(all(), rfEdges, 'TB');
        const twice = assignCoordinates(once, rfEdges, 'TB');

        expect(twice.map(node => node.position)).toEqual(once.map(node => node.position));
    });

    it('keeps the order when a node grows, and only moves the ranks after it', () => {
        const before = assignCoordinates(all(), rfEdges, 'TB');
        const grown = before.map(node => node.id === 'b' ? {...node, style: {width: 200, height: 300}} : node);

        const after = assignCoordinates(grown, rfEdges, 'TB', {anchorId: 'b'});

        expect(orderInversions(before, after, 'TB')).toBe(0);
        const at = (nodes: ReactFlowNode[], id: string) => nodes.find(node => node.id === id)!.position;
        expect(at(after, 'b')).toEqual(at(before, 'b'));                  // the anchor does not move
        expect(at(after, 'e').y - at(before, 'e').y).toBe(300 - 80);      // the rank after it makes room
    });

    it('keeps the order when a node is added', () => {
        const before = assignCoordinates(all().filter(node => node.id !== 'c'), rfEdges, 'TB');

        const after = assignCoordinates([...before, rfNode('c', model, size)], rfEdges, 'TB', {anchorId: 'a'});

        expect(orderInversions(before, after, 'TB')).toBe(0);
        expect(after.find(node => node.id === 'c')!.position.y).toBe(after.find(node => node.id === 'b')!.position.y);
    });

    it('places a node over the one it is connected to, not in the middle of the graph', () => {
        // a rank holding one node used to be centred on the whole graph, which left it hanging
        // between the ranks below rather than over the node it leads to
        const leftRank = ['b', 'c'].map(id => rfNode(id, model, size));
        const onlyB = [rfNode('a', model, size), ...leftRank.filter(node => node.id === 'b')];

        const laidOut = assignCoordinates(onlyB, rfEdges, 'TB');
        const centre = (id: string) => {
            const at = laidOut.find(node => node.id === id)!.position;
            return at.x + size.width / 2;
        };

        expect(centre('a')).toBe(centre('b'));
    });

    it('leaves an empty rank out, so hiding one closes its gap', () => {
        const withoutSecondRank = all().filter(node => !['b', 'c'].includes(node.id));

        const laidOut = assignCoordinates(withoutSecondRank, rfEdges, 'TB');
        const at = (id: string) => laidOut.find(node => node.id === id)!.position;

        expect(at('d').y - at('a').y).toBe(80 + LAYOUT_RANKSEP);
    });

    it('counts a node named twice once - a traversal can return it per edge', () => {
        const withDuplicate = [...all(), rfNode('c', model, size)];

        const laidOut = assignCoordinates(withDuplicate, rfEdges, 'TB');
        const at = (id: string) => laidOut.filter(node => node.id === id).map(node => node.position);

        expect(at('c')[0]).toEqual(at('c')[1]);
        expect(at('c')[0]).toEqual(assignCoordinates(all(), rfEdges, 'TB').find(node => node.id === 'c')!.position);
    });

    it('keeps a node the user has dragged displaced, and moves it with its neighbours', () => {
        const laidOut = assignCoordinates(all(), rfEdges, 'TB');
        const at = (nodes: ReactFlowNode[], id: string) => nodes.find(node => node.id === id)!.position;
        const moved = laidOut.map(node => node.id === 'e'
            ? {...node, data: {...node.data, manualOffset: {x: 40, y: 15}}} : node);

        const dragged = assignCoordinates(moved, rfEdges, 'TB');
        expect(at(dragged, 'e')).toEqual({x: at(laidOut, 'e').x + 40, y: at(laidOut, 'e').y + 15});

        // a node in a rank before it grows, so its slot moves down - and it moves with it
        const grown = dragged.map(node => node.id === 'd' ? {...node, style: {width: 200, height: 300}} : node);
        const after = assignCoordinates(grown, rfEdges, 'TB', {anchorId: 'd'});
        expect(at(after, 'e').y - at(dragged, 'e').y).toBe(300 - 80);
        expect(at(after, 'e').x).toBe(at(dragged, 'e').x);
    });

    it('anchors on where a dragged node is, not on where its slot is', () => {
        const laidOut = assignCoordinates(all(), rfEdges, 'TB')
            .map(node => node.id === 'a' ? {...node, data: {...node.data, manualOffset: {x: 40, y: 15}}} : node);
        const dragged = assignCoordinates(laidOut, rfEdges, 'TB');

        const after = assignCoordinates(dragged, rfEdges, 'TB', {anchorId: 'a'});

        expect(after.map(node => node.position)).toEqual(dragged.map(node => node.position));
    });

    it('passes a node without a placement through - the grouping boxes have none', () => {
        const box = {id: 'group', position: {x: 7, y: 9}, data: {}} as ReactFlowNode;

        const laidOut = assignCoordinates([...all(), box], rfEdges, 'TB');

        expect(laidOut.find(node => node.id === 'group')!.position).toEqual({x: 7, y: 9});
    });

    it('lays out left to right in the LR direction', () => {
        const lr = layoutModelOf(graphOf(...DIAMOND), 'LR');
        const nodes = ['a', 'b', 'c', 'd', 'e'].map(id => rfNode(id, lr, size));

        const laidOut = assignCoordinates(nodes, rfEdges, 'LR');
        const at = (id: string) => laidOut.find(node => node.id === id)!.position;

        expect(at('b').x).toBe(at('c').x);
        expect(at('b').x - at('a').x).toBe(200 + LAYOUT_RANKSEP);
    });
});
