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
