/**
 * Grouping the lineage graph into boxes, see the Grouping section of
 * src/components/ConfigExplorer/LineageTab/README.md. Built on the getting-started fixture, whose
 * actions carry the feeds download and compute and whose data objects the layers extern, staging,
 * integration, btl and the subject areas airports and flight data.
 */
import { readFileSync } from 'node:fs';
import { Edge as ReactFlowEdge, Node as ReactFlowNode } from 'reactflow';
import { describe, expect, it } from 'vitest';
import { ConfigData } from '../src/util/ConfigExplorer/ConfigData';
import { DAGraph } from '../src/util/ConfigExplorer/Graphs';
import { Grouping, groupingKey, groupsOfGraph, groupBoxId, setGroupCollapsed, clearCollapsedGroups, isGroupBox, boxDataOf } from '../src/util/ConfigExplorer/Grouping';
import { LayoutDirection, NodePlacement, assignCoordinates, fitGroupBoxes, layoutModelOf, placementOf } from '../src/util/ConfigExplorer/LineageLayout';
import { groupFlowEdges, groupFlowNodes } from '../src/util/ConfigExplorer/LineageTabUtils';

const configData = new ConfigData(JSON.parse(readFileSync('tests/e2e/fixtures/exported/exportedConfig.json', 'utf8')));

const groupsOf = (graph: DAGraph, grouping: Grouping) => groupsOfGraph(graph, configData, grouping);
const layoutGroups = (graph: DAGraph, grouping: Grouping) =>
    ({key: groupingKey(grouping), of: groupsOf(graph, grouping), along: !!grouping.along, across: !!grouping.across});

/* The ReactFlow nodes of a whole graph, as createReactFlowNodes stamps them. */
function flowOf(graph: DAGraph, grouping: Grouping, direction: LayoutDirection = 'TB'): {nodes: ReactFlowNode[], edges: ReactFlowEdge[]} {
    const groups = groupsOf(graph, grouping);
    const model = layoutModelOf(graph, direction, layoutGroups(graph, grouping));
    const nodes = graph.nodes.map(node => ({
        id: node.id, type: 'customDataNode', position: {x: 0, y: 0}, style: {width: 200, height: 60},
        data: {label: node.id, placement: model.placement.get(node.id), grouping, groups: groups.get(node.id), layoutDirection: direction},
    }) as ReactFlowNode);
    const edges = graph.edges.map(edge => ({id: edge.id, source: edge.fromNode.id, target: edge.toNode.id, data: {}}) as ReactFlowEdge);
    return {nodes, edges};
}

function laidOut(graph: DAGraph, grouping: Grouping, direction: LayoutDirection = 'TB') {
    const {nodes, edges} = flowOf(graph, grouping, direction);
    const grouped = groupFlowNodes(nodes);
    return {nodes: fitGroupBoxes(assignCoordinates(grouped, edges, direction)), edges};
}

type Rect = {x: number, y: number, width: number, height: number};
const rectOf = (node: ReactFlowNode): Rect =>
    ({x: node.position.x, y: node.position.y, width: Number(node.style!.width), height: Number(node.style!.height)});
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (inner: Rect, outer: Rect) => inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

describe('groupsOfGraph', () => {
    it('takes the attribute a node carries itself', () => {
        const groups = groupsOf(configData.fullGraph!, {along: 'feed', across: 'layer'});

        expect(groups.get('download-airports')!.along).toBe('download');
        expect(groups.get('int-airports')!.across).toBe('integration');
    });

    it('derives the feed of a data object from the action writing it, and the layer of an action from what it writes', () => {
        const groups = groupsOf(configData.fullGraph!, {along: 'feed', across: 'layer'});

        expect(groups.get('stg-airports')!.along).toBe('download');
        expect(groups.get('int-airports')!.along).toBe('compute');
        expect(groups.get('download-airports')!.across).toBe('staging');
        expect(groups.get('historize-airports')!.across).toBe('integration');
    });

    it('leaves a node without a value ungrouped - nothing writes the extern data objects', () => {
        const groups = groupsOf(configData.fullGraph!, {along: 'feed'});

        expect(groups.get('ext-airports')!.along).toBeUndefined();
        expect(groups.get('ext-departures')!.along).toBeUndefined();
    });
});

describe('the grouped layout model', () => {
    const graph = configData.fullGraph!;

    it('gives every column a run of ranks of its own, in the order of the flow', () => {
        const grouping: Grouping = {across: 'layer'};
        const groups = groupsOf(graph, grouping);
        const model = layoutModelOf(graph, 'TB', layoutGroups(graph, grouping));
        const ranksOf = new Map<string, number[]>();
        model.placement.forEach((p, id) => {
            const key = groups.get(id)!.across ?? '';
            ranksOf.set(key, [...(ranksOf.get(key) ?? []), p.rank]);
        });
        const spans = [...ranksOf.entries()].map(([key, ranks]) => ({key, min: Math.min(...ranks), max: Math.max(...ranks)}))
            .sort((a, b) => a.min - b.min);

        spans.slice(1).forEach((span, i) => expect(span.min, span.key).toBeGreaterThan(spans[i].max));
        expect(spans.filter(span => span.key !== '').map(span => span.key)).toEqual(['extern', 'staging', 'integration', 'btl']);
    });

    it('keeps the nodes of a lane together in every rank', () => {
        const model = layoutModelOf(graph, 'LR', layoutGroups(graph, {along: 'subjectArea'}));
        const byRank = new Map<number, NodePlacement[]>();
        model.placement.forEach(p => byRank.set(p.rank, [...(byRank.get(p.rank) ?? []), p]));

        byRank.forEach(rank => {
            const lanes = rank.sort((a, b) => a.order - b.order).map(p => p.lane!);
            expect(lanes).toEqual([...lanes].sort((a, b) => a - b));
        });
    });

    it('is the same whichever order the graph was built in', () => {
        const grouping: Grouping = {along: 'feed', across: 'layer'};
        const reference = layoutModelOf(graph, 'TB', layoutGroups(graph, grouping));
        for (const seed of [3, 7, 11]) {
            const rotate = <T,>(items: T[]) => [...items.slice(seed % items.length), ...items.slice(0, seed % items.length)].reverse();
            const permuted = new DAGraph(rotate(graph.nodes), rotate(graph.edges));
            const model = layoutModelOf(permuted, 'TB', layoutGroups(permuted, grouping));
            expect([...model.placement.entries()].sort()).toEqual([...reference.placement.entries()].sort());
        }
    });

    it('is cached per grouping, and leaves the ungrouped model alone', () => {
        const grouped = layoutModelOf(graph, 'TB', layoutGroups(graph, {across: 'layer'}));

        expect(layoutModelOf(graph, 'TB', layoutGroups(graph, {across: 'layer'}))).toBe(grouped);
        expect(layoutModelOf(graph, 'TB')).not.toBe(grouped);
        expect([...layoutModelOf(graph, 'TB').placement.values()].every(p => p.lane === undefined && p.column === undefined)).toBe(true);
    });
});

describe('nodes without a layer', () => {
    // like the getting-started project in public/config: ext-airports and the btl data objects carry no layer
    const json = JSON.parse(readFileSync('tests/e2e/fixtures/exported/exportedConfig.json', 'utf8'));
    ['ext-airports', 'btl-departures-arrivals-airports', 'btl-distances'].forEach(id => delete json.dataObjects[id].metadata.layer);
    const partial = new ConfigData(json);
    const graph = partial.fullGraph!;
    const grouping: Grouping = {across: 'layer'};
    const of = groupsOfGraph(graph, partial, grouping);
    const model = layoutModelOf(graph, 'LR', {key: groupingKey(grouping), of, along: false, across: true});
    const rank = (id: string) => model.placement.get(id)!.rank;

    it('go into the gap between the columns their rank falls into, not into one column of their own', () => {
        expect(rank('ext-airports')).toBeLessThan(rank('download-airports'));
        expect(rank('join-departures-airports')).toBeGreaterThan(rank('int-airports'));
        expect(model.placement.get('ext-airports')!.column).not.toBe(model.placement.get('join-departures-airports')!.column);
    });

    it('leave the columns in the order of the flow, so that none is strung out into one line', () => {
        const columnOf = (id: string) => model.placement.get(id)!.column!;
        expect(columnOf('ext-departures')).toBeLessThan(columnOf('download-airports'));
        expect(columnOf('download-airports')).toBeLessThan(columnOf('int-airports'));
        expect(rank('int-airports')).toBe(rank('int-departures'));
    });

    it('let a column share the ranks of one it is not connected to, on a track of its own', () => {
        // extern holds only ext-departures, which feeds integration; nothing connects it to staging
        expect(rank('ext-departures')).toBe(rank('stg-airports'));
        expect(rank('ext-departures')).toBe(rank('download-deduplicate-departures') - 1);
        expect(model.placement.get('ext-departures')!.track).not.toBe(model.placement.get('stg-airports')!.track);
        // and the column it feeds is ordered to match, so that its edges do not cross
        const order = (id: string) => model.placement.get(id)!.order;
        expect(order('historize-airports')).toBeLessThan(order('download-deduplicate-departures'));
        expect(order('int-airports')).toBeLessThan(order('int-departures'));
    });

    it('let columns share ranks where lanes cross them, as long as they cover different lanes', () => {
        const both: Grouping = {along: 'feed', across: 'layer'};
        const grid = layoutModelOf(graph, 'LR', {key: groupingKey(both), of: groupsOfGraph(graph, partial, both), along: true, across: true});
        const at = (id: string) => grid.placement.get(id)!;
        expect([...grid.placement.values()].every(p => p.track === undefined)).toBe(true);
        expect(at('ext-departures').rank).toBe(at('stg-airports').rank);
        expect(at('ext-departures').lane).not.toBe(at('stg-airports').lane);
    });

    it('overlap neither each other nor a box', () => {
        clearCollapsedGroups();
        const nodes = graph.nodes.map(node => ({
            id: node.id, type: 'customDataNode', position: {x: 0, y: 0}, style: {width: 200, height: 92},
            data: {label: node.id, placement: model.placement.get(node.id), grouping, groups: of.get(node.id), layoutDirection: 'LR'},
        }) as ReactFlowNode);
        const edges = graph.edges.map(edge => ({id: edge.id, source: edge.fromNode.id, target: edge.toNode.id, data: {}}) as ReactFlowEdge);
        const laid = fitGroupBoxes(assignCoordinates(groupFlowNodes(nodes), edges, 'LR'));
        const elements = laid.filter(node => !isGroupBox(node));
        elements.forEach((a, i) => elements.slice(i + 1).forEach(b => expect(overlap(rectOf(a), rectOf(b)), `${a.id} and ${b.id}`).toBe(false)));
        const boxes = laid.filter(isGroupBox);
        elements.forEach(node => boxes.filter(box => boxDataOf(box).key !== node.data.groups?.across)
            .forEach(box => expect(overlap(rectOf(node), rectOf(box)), `${node.id} in ${box.id}`).toBe(false)));
        boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => expect(overlap(rectOf(a), rectOf(b)), `${a.id} and ${b.id}`).toBe(false)));
    });
});

describe('the boxes', () => {
    const graph = configData.fullGraph!;

    it('enclose their members, and boxes of one axis do not overlap', () => {
        clearCollapsedGroups();
        for (const direction of ['TB', 'LR'] as LayoutDirection[]) {
            const {nodes} = laidOut(graph, {along: 'subjectArea', across: 'layer'}, direction);
            const boxes = nodes.filter(isGroupBox);
            expect(boxes.map(box => box.id).sort()).toEqual([
                'group:across:btl', 'group:across:extern', 'group:across:integration', 'group:across:staging',
                'group:along:airports', 'group:along:flight data',
            ]);
            (['along', 'across'] as const).forEach(axis => {
                const ofAxis = boxes.filter(box => boxDataOf(box).axis === axis).map(rectOf);
                ofAxis.forEach((a, i) => ofAxis.slice(i + 1).forEach(b => expect(overlap(a, b), `${direction} ${axis}`).toBe(false)));
            });
            boxes.forEach(box => {
                const {axis, key} = boxDataOf(box);
                nodes.filter(node => !isGroupBox(node) && node.data.groups?.[axis] === key)
                    .forEach(node => expect(inside(rectOf(node), rectOf(box)), `${node.id} in ${box.id}`).toBe(true));
            });
        }
    });

    it('puts an ungrouped node in line with the lane it feeds, where that lane has no box', () => {
        clearCollapsedGroups();
        for (const direction of ['TB', 'LR'] as LayoutDirection[]) {
            const {nodes} = laidOut(graph, {along: 'feed'}, direction);
            const cross = direction === 'TB' ? 'x' : 'y', crossSize = direction === 'TB' ? 'width' : 'height';
            const centreOf = (id: string) => {
                const rect = rectOf(nodes.find(node => node.id === id)!);
                return rect[cross] + rect[crossSize] / 2;
            };

            expect(placementOf(nodes.find(node => node.id === 'ext-airports')!)!.lane)
                .toBe(placementOf(nodes.find(node => node.id === 'download-airports')!)!.lane);
            expect(centreOf('ext-airports'), direction).toBeCloseTo(centreOf('download-airports'));
            expect(centreOf('ext-departures'), direction).toBeCloseTo(centreOf('download-deduplicate-departures'));
        }
    });

    it('moves a lane in line with the one it feeds where their boxes share no rank', () => {
        clearCollapsedGroups();
        for (const direction of ['TB', 'LR'] as LayoutDirection[]) {
            const {nodes} = laidOut(graph, {along: 'feed'}, direction);
            const cross = direction === 'TB' ? 'x' : 'y', crossSize = direction === 'TB' ? 'width' : 'height';
            const centreOf = (id: string) => {
                const rect = rectOf(nodes.find(node => node.id === id)!);
                return rect[cross] + rect[crossSize] / 2;
            };

            expect(centreOf('stg-airports'), direction).toBeCloseTo(centreOf('historize-airports'));
            const boxes = nodes.filter(isGroupBox).map(rectOf);
            expect(overlap(boxes[0], boxes[1]), direction).toBe(false);
        }
    });

    it('keeps every ungrouped node outside the lane boxes', () => {
        clearCollapsedGroups();
        for (const direction of ['TB', 'LR'] as LayoutDirection[]) {
            for (const grouping of [{along: 'feed'}, {along: 'subjectArea'}, {along: 'feed', across: 'layer'}, {along: 'subjectArea', across: 'layer'}] as Grouping[]) {
                for (const view of [configData.fullGraph!, configData.dataGraph!, configData.actionGraph!]) {
                    const {nodes} = laidOut(view, grouping, direction);
                    const lanes = nodes.filter(node => isGroupBox(node) && boxDataOf(node).axis === 'along');
                    nodes.filter(node => !isGroupBox(node) && node.data.groups?.along === undefined).forEach(node =>
                        lanes.forEach(box => expect(overlap(rectOf(node), rectOf(box)), `${direction} ${grouping.along} ${node.id} in ${box.id}`).toBe(false)));
                    lanes.forEach((a, i) => lanes.slice(i + 1).forEach(b =>
                        expect(overlap(rectOf(a), rectOf(b)), `${direction} ${grouping.along} ${a.id} and ${b.id}`).toBe(false)));
                }
            }
        }
    });

    it('pulls a node towards a neighbour ranks away, so that the lanes can line up', () => {
        // both extern data objects start at rank 0, their readers are ranks away past staging
        clearCollapsedGroups();
        for (const direction of ['TB', 'LR'] as LayoutDirection[]) {
            const {nodes} = laidOut(graph, {along: 'feed', across: 'layer'}, direction);
            const cross = direction === 'TB' ? 'x' : 'y', crossSize = direction === 'TB' ? 'width' : 'height';
            const centreOf = (id: string) => {
                const rect = rectOf(nodes.find(node => node.id === id)!);
                return rect[cross] + rect[crossSize] / 2;
            };

            expect(centreOf('ext-departures'), direction).toBeCloseTo(centreOf('download-deduplicate-departures'));
            expect(centreOf('historize-airports'), direction).toBeCloseTo(centreOf('stg-airports'));
        }
    });

    it('a collapsed box hides its members and takes a place of its own', () => {
        clearCollapsedGroups();
        setGroupCollapsed(groupBoxId('along', 'compute'), true);
        const {nodes} = laidOut(configData.actionGraph!, {along: 'feed'});
        const box = nodes.find(node => node.id === 'group:along:compute')!;

        expect(boxDataOf(box).collapsed).toBe(true);
        expect(boxDataOf(box).memberIds).toEqual(['compute-distances', 'download-deduplicate-departures', 'historize-airports', 'join-departures-airports']);
        expect(nodes.filter(node => node.hidden).map(node => node.id).sort()).toEqual(boxDataOf(box).memberIds);
        expect(placementOf(box)).toBeDefined();
        expect(overlap(rectOf(box), rectOf(nodes.find(node => node.id === 'download-airports')!))).toBe(false);
        clearCollapsedGroups();
    });

    it('a collapsed box takes the last rank of its members, beside a node feeding the same successors', () => {
        clearCollapsedGroups();
        setGroupCollapsed(groupBoxId('along', 'download'), true);
        setGroupCollapsed(groupBoxId('along', 'compute'), true);
        const {nodes} = laidOut(configData.fullGraph!, {along: 'feed'}, 'LR');
        const nodeOf = (id: string) => nodes.find(node => node.id === id)!;

        // download-airports and stg-airports are ranks 1 and 2; ext-departures is rank 2 and read by compute
        expect(placementOf(nodeOf('group:along:download'))!.rank).toBe(placementOf(nodeOf('ext-departures'))!.rank);
        expect(nodeOf('group:along:download').position.x).toBe(nodeOf('ext-departures').position.x);
        expect(overlap(rectOf(nodeOf('group:along:download')), rectOf(nodeOf('ext-departures')))).toBe(false);
        clearCollapsedGroups();
    });

    it('a collapsed box takes the edges of its members, merged per neighbour, and none from inside', () => {
        clearCollapsedGroups();
        setGroupCollapsed(groupBoxId('along', 'compute'), true);
        const {nodes, edges} = laidOut(configData.fullGraph!, {along: 'feed'});
        const groupEdges = groupFlowEdges(nodes, edges).filter(edge => edge.id.startsWith('group-edge:'));

        // stg-airports is written by download-airports, read by historize-airports of the compute feed;
        // ext-departures has no feed and is read by download-deduplicate-departures
        expect(groupEdges.map(edge => [edge.source, edge.target, edge.data.groupCount]).sort()).toEqual([
            ['ext-departures', 'group:along:compute', 1],
            ['stg-airports', 'group:along:compute', 1],
        ]);
        clearCollapsedGroups();
    });

    it('merges the edges of two collapsed boxes into one that counts them', () => {
        clearCollapsedGroups();
        setGroupCollapsed(groupBoxId('across', 'integration'), true);
        setGroupCollapsed(groupBoxId('across', 'btl'), true);
        const {nodes, edges} = laidOut(configData.dataGraph!, {across: 'layer'});
        const groupEdges = groupFlowEdges(nodes, edges).filter(edge => edge.id.startsWith('group-edge:'));

        expect(groupEdges.find(edge => edge.source === 'group:across:integration' && edge.target === 'group:across:btl')!.data.groupCount).toBe(2);
        clearCollapsedGroups();
    });
});
