/*
    The stable layout of the lineage graph.

    A node's place in the layout is a (rank, order) pair, computed once per graph and direction and
    then kept; the coordinates are a pure function of those, of the current node sizes and of which
    nodes are shown. Nothing that is shown can therefore change its order because another node was
    expanded, selected or opened on its columns - only the spacing changes.
*/
import dagre from 'dagre';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, SimulationNodeDatum } from 'd3-force';
import { Edge as ReactFlowEdge, Node as ReactFlowNode } from 'reactflow';
import { DAGraph, isColumnLineageEdge, rfNodeSize } from './Graphs';

export type LayoutDirection = 'TB' | 'LR';
/* layered: ranks and order, see above. force: a force directed placement, offered for the relations view */
export type LayoutMode = 'layered' | 'force';

export const LAYOUT_NODESEP = 150;
export const LAYOUT_RANKSEP = 150;

// the model is built at one size for every node, so that it does not change when a node grows
const REFERENCE_NODE_WIDTH = 172;
const REFERENCE_NODE_HEIGHT = 36;

/* Where a node sits in the layered layout: in ranks and cross axis order, not in pixels. */
export interface NodePlacement {
    rank: number;
    order: number;
}

export interface LayoutModel {
    direction: LayoutDirection;
    placement: ReadonlyMap<string, NodePlacement>;
}

// the main axis is the one the ranks advance along, the cross axis the one nodes are ordered along
function axes(direction: LayoutDirection) {
    return direction === 'TB'
        ? {main: 'y' as const, cross: 'x' as const, mainSize: 'height' as const, crossSize: 'width' as const}
        : {main: 'x' as const, cross: 'y' as const, mainSize: 'width' as const, crossSize: 'height' as const};
}

/*
    Lay the whole graph out once to learn where its nodes belong relative to each other.

    The input is sorted first: dagre is deterministic for a given insertion order but its ordering
    heuristic is sensitive to it, so without this the same graph comes out differently depending on
    which node the caller happened to build its node list around.
*/
function buildLayoutModel(graph: DAGraph, direction: LayoutDirection): LayoutModel {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setGraph({rankdir: direction, nodesep: LAYOUT_NODESEP, ranksep: LAYOUT_RANKSEP});
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const ids = graph.nodes.map(node => node.id).sort();
    ids.forEach(id => dagreGraph.setNode(id, {width: REFERENCE_NODE_WIDTH, height: REFERENCE_NODE_HEIGHT}));

    graph.edges
        .map(edge => [edge.fromNode.id, edge.toNode.id])
        .filter(([source, target]) => source !== target && dagreGraph.hasNode(source) && dagreGraph.hasNode(target))
        .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
        .forEach(([source, target]) => dagreGraph.setEdge(source, target));

    dagre.layout(dagreGraph);

    // every node of a rank has the same centre on the main axis, so the distinct centres are the ranks
    const {main, cross} = axes(direction);
    const laidOut = ids.map(id => {
        const node = dagreGraph.node(id);
        return {id, main: Math.round(node[main]), cross: node[cross]};
    });
    const rankOf = new Map([...new Set(laidOut.map(node => node.main))].sort((a, b) => a - b).map((v, i) => [v, i]));

    const placement = new Map<string, NodePlacement>();
    rankOf.forEach((rank, mainCoordinate) => {
        laidOut
            .filter(node => node.main === mainCoordinate)
            .sort((a, b) => a.cross - b.cross || a.id.localeCompare(b.id))
            .forEach((node, order) => placement.set(node.id, {rank, order}));
    });

    return {direction, placement};
}

// one model per graph and direction; the DAGraph instances are stable per ConfigData
const models = new WeakMap<DAGraph, Map<LayoutDirection, LayoutModel>>();

export function layoutModelOf(graph: DAGraph, direction: LayoutDirection): LayoutModel {
    let byDirection = models.get(graph);
    if (!byDirection) {
        byDirection = new Map();
        models.set(graph, byDirection);
    }
    let model = byDirection.get(direction);
    if (!model) {
        model = buildLayoutModel(graph, direction);
        byDirection.set(direction, model);
    }
    return model;
}

const FORCE_LINK_DISTANCE = 2 * REFERENCE_NODE_WIDTH;
const FORCE_COLLIDE_RADIUS = REFERENCE_NODE_WIDTH / 2 + 40;
const FORCE_TICKS = 300;
// the gap assignCoordinates keeps between two nodes of a force layout once they have their real size
export const FORCE_NODE_GAP = 40;

/*
    Where each node of the graph belongs in a force directed layout: its centre, once per graph.
    Deterministic - sorted input and a seeded random source - so it is a function of the graph alone.
*/
function buildForceModel(graph: DAGraph): Map<string, {x: number, y: number}> {
    type ForceNode = SimulationNodeDatum & {id: string};
    const nodes: ForceNode[] = graph.nodes.map(node => node.id).sort().map(id => ({id}));
    const known = new Set(nodes.map(node => node.id));
    const links = graph.edges
        .map(edge => ({source: edge.fromNode.id, target: edge.toNode.id}))
        .filter(link => link.source !== link.target && known.has(link.source) && known.has(link.target))
        .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));

    let seed = 1;
    const random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    forceSimulation(nodes)
        .randomSource(random)
        .force('link', forceLink<ForceNode, {source: string, target: string}>(links).id(node => node.id).distance(FORCE_LINK_DISTANCE))
        .force('charge', forceManyBody().strength(-1500))
        .force('collide', forceCollide(FORCE_COLLIDE_RADIUS))
        // keeps the connected components, which repel each other, from drifting apart
        .force('x', forceX(0).strength(0.05))
        .force('y', forceY(0).strength(0.05))
        .stop()
        .tick(FORCE_TICKS);

    return new Map(nodes.map(node => [node.id, {x: node.x ?? 0, y: node.y ?? 0}]));
}

const forceModels = new WeakMap<DAGraph, Map<string, {x: number, y: number}>>();

export function forceModelOf(graph: DAGraph): ReadonlyMap<string, {x: number, y: number}> {
    let model = forceModels.get(graph);
    if (!model) {
        model = buildForceModel(graph);
        forceModels.set(graph, model);
    }
    return model;
}

export function forceCentreOf(node: ReactFlowNode): {x: number, y: number} | undefined {
    return node.data?.forceCentre;
}

export function placementOf(node: ReactFlowNode): NodePlacement | undefined {
    return node.data?.placement;
}

/* How far the user has dragged a node away from the place the layout gives it. */
export function manualOffsetOf(node: ReactFlowNode): {x: number, y: number} | undefined {
    return node.data?.manualOffset;
}

export interface CoordinateOptions {
    /* the node that must not move: everything is translated so that it keeps the position it came in with */
    anchorId?: string;
    nodesep?: number;
    ranksep?: number;
    defaultWidth?: number;
    defaultHeight?: number;
}

/*
    Coordinates for the given nodes, from their placement and the size they declare.

    Pure, unlike dagreLayoutRf: the nodes are returned as new objects in the order they came in.
    Nodes without a placement - the grouping boxes - are passed through untouched.
*/
export function assignCoordinates(nodes: ReactFlowNode[], edges: ReactFlowEdge[], direction: LayoutDirection, options: CoordinateOptions = {}): ReactFlowNode[] {
    if (nodes.some(node => forceCentreOf(node))) return assignForceCoordinates(nodes, options);
    const {main, cross, mainSize, crossSize} = axes(direction);
    const nodesep = options.nodesep ?? LAYOUT_NODESEP;
    const ranksep = options.ranksep ?? LAYOUT_RANKSEP;
    const sizeOf = (node: ReactFlowNode) =>
        rfNodeSize(node, options.defaultWidth ?? REFERENCE_NODE_WIDTH, options.defaultHeight ?? REFERENCE_NODE_HEIGHT);

    // by id: a node list built from a traversal can name the same node twice, e.g. where two
    // foreign keys run between the same pair of data objects
    const byRank = new Map<number, ReactFlowNode[]>();
    const seen = new Set<string>();
    nodes.forEach(node => {
        const placement = placementOf(node);
        if (!placement || seen.has(node.id)) return;
        seen.add(node.id);
        byRank.set(placement.rank, [...(byRank.get(placement.rank) ?? []), node]);
    });
    byRank.forEach(rank => rank.sort((a, b) =>
        (placementOf(a)!.order - placementOf(b)!.order) || a.id.localeCompare(b.id)));

    // the cross axis first, so that the ranks can be centred on the widest one
    const crossStart = new Map<string, number>();
    const crossExtent = new Map<number, number>();
    byRank.forEach((rankNodes, rank) => {
        let cursor = 0;
        rankNodes.forEach(node => {
            crossStart.set(node.id, cursor);
            cursor += sizeOf(node)[crossSize] + nodesep;
        });
        crossExtent.set(rank, Math.max(0, cursor - nodesep));
    });
    const widestRank = Math.max(0, ...crossExtent.values());

    // where each node starts on the cross axis, the ranks centred on the widest one. This is only
    // the starting point: the sweeps below pull each node towards the nodes it is connected to
    const crossOf = new Map<string, number>();
    byRank.forEach((rankNodes, rank) => {
        const shift = (widestRank - crossExtent.get(rank)!) / 2;
        rankNodes.forEach(node => crossOf.set(node.id, crossStart.get(node.id)! + shift));
    });
    alignWithNeighbours(byRank, edges.filter(edge => !isColumnLineageEdge(edge)), crossOf, node => sizeOf(node)[crossSize], nodesep);

    // the main axis: empty ranks are left out, so hiding a whole rank closes the gap it leaves
    const mainCentre = new Map<number, number>();
    let cursor = 0;
    [...byRank.keys()].sort((a, b) => a - b).forEach(rank => {
        const extent = Math.max(...byRank.get(rank)!.map(node => sizeOf(node)[mainSize]));
        mainCentre.set(rank, cursor + extent / 2);
        cursor += extent + ranksep;
    });

    const positioned = new Map<string, {x: number, y: number}>();
    byRank.forEach((rankNodes, rank) => {
        rankNodes.forEach(node => {
            const size = sizeOf(node);
            positioned.set(node.id, {
                [cross]: crossOf.get(node.id)!,
                [main]: mainCentre.get(rank)! - size[mainSize] / 2,
            } as {x: number, y: number});
        });
    });

    // a node the user has dragged keeps that displacement, so that laying out again moves it with
    // its neighbours instead of snapping it back. Before the anchoring, which compares against it
    nodes.forEach(node => {
        const offset = manualOffsetOf(node);
        const position = offset && positioned.get(node.id);
        if (offset && position) positioned.set(node.id, {x: position.x + offset.x, y: position.y + offset.y});
    });

    const delta = translation(nodes, positioned, options.anchorId);
    return nodes.map(node => {
        const position = positioned.get(node.id);
        if (!position) return node;
        return {...node, position: {x: position.x + delta.x, y: position.y + delta.y}};
    });
}

/*
    Coordinates for nodes carrying a force layout centre: that centre, the user's displacement, and
    then as little movement as removes the overlaps of nodes that have grown, e.g. opened their columns.
*/
function assignForceCoordinates(nodes: ReactFlowNode[], options: CoordinateOptions): ReactFlowNode[] {
    const sizeOf = (node: ReactFlowNode) =>
        rfNodeSize(node, options.defaultWidth ?? REFERENCE_NODE_WIDTH, options.defaultHeight ?? REFERENCE_NODE_HEIGHT);

    const boxes: {id: string, x: number, y: number, width: number, height: number}[] = [];
    const seen = new Set<string>();
    nodes.forEach(node => {
        const centre = forceCentreOf(node);
        if (!centre || seen.has(node.id)) return;
        seen.add(node.id);
        const {width, height} = sizeOf(node);
        const offset = manualOffsetOf(node) ?? {x: 0, y: 0};
        boxes.push({id: node.id, x: centre.x - width / 2 + offset.x, y: centre.y - height / 2 + offset.y, width, height});
    });
    boxes.sort((a, b) => a.id.localeCompare(b.id));
    separateBoxes(boxes, options.anchorId, options.nodesep ?? FORCE_NODE_GAP);

    const positioned = new Map(boxes.map(box => [box.id, {x: box.x, y: box.y}]));
    const delta = translation(nodes, positioned, options.anchorId);
    return nodes.map(node => {
        const position = positioned.get(node.id);
        if (!position) return node;
        return {...node, position: {x: position.x + delta.x, y: position.y + delta.y}};
    });
}

/*
    Push overlapping boxes apart along the axis they overlap less on, until a gap of `gap` is kept
    between any two. The anchor does not move; the other box of a pair with it takes the whole push.
*/
function separateBoxes(boxes: {id: string, x: number, y: number, width: number, height: number}[], anchorId: string | undefined, gap: number): void {
    for (var pass = 0; pass < 100; pass++) {
        var moved = false;
        for (var i = 0; i < boxes.length; i++) {
            for (var j = i + 1; j < boxes.length; j++) {
                const a = boxes[i], b = boxes[j];
                const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + gap;
                const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + gap;
                if (overlapX <= 0.5 || overlapY <= 0.5) continue;
                moved = true;
                const alongX = overlapX < overlapY;
                const aCentre = alongX ? a.x + a.width / 2 : a.y + a.height / 2;
                const bCentre = alongX ? b.x + b.width / 2 : b.y + b.height / 2;
                // ties go by id order, so the result does not depend on floating point noise
                const sign = bCentre > aCentre || (bCentre === aCentre && a.id < b.id) ? 1 : -1;
                const push = alongX ? overlapX : overlapY;
                const aShare = a.id === anchorId ? 0 : b.id === anchorId ? 1 : 0.5;
                const axis = alongX ? 'x' : 'y';
                a[axis] -= sign * push * aShare;
                b[axis] += sign * push * (1 - aShare);
            }
        }
        if (!moved) return;
    }
}

/*
    Pull every node towards the nodes it is connected to, without changing the order within a rank.

    Packing a rank from one end and centring it leaves a node with one neighbour stranded in the
    middle of the graph rather than above the node it feeds. Sweeping down and up, each rank is
    placed as close as possible to the median of its neighbours in the rank before resp. after it -
    the classic barycentre pass, except that the order is fixed and only the gaps are solved for.
*/
function alignWithNeighbours(byRank: Map<number, ReactFlowNode[]>, edges: ReactFlowEdge[],
                             crossOf: Map<string, number>, crossSizeOf: (node: ReactFlowNode) => number,
                             nodesep: number): void {
    const rankOf = new Map<string, number>();
    byRank.forEach((rankNodes, rank) => rankNodes.forEach(node => rankOf.set(node.id, rank)));

    const adjacent = new Map<string, string[]>();
    edges.forEach(edge => {
        if (edge.source === edge.target || !rankOf.has(edge.source) || !rankOf.has(edge.target)) return;
        adjacent.set(edge.source, [...(adjacent.get(edge.source) ?? []), edge.target]);
        adjacent.set(edge.target, [...(adjacent.get(edge.target) ?? []), edge.source]);
    });

    const ranks = [...byRank.keys()].sort((a, b) => a - b);
    const centreOf = (id: string, node: ReactFlowNode) => crossOf.get(id)! + crossSizeOf(node) / 2;
    const nodeById = new Map<string, ReactFlowNode>();
    byRank.forEach(rankNodes => rankNodes.forEach(node => nodeById.set(node.id, node)));

    const sweep = (order: number[], step: number) => order.forEach(rank => {
        const rankNodes = byRank.get(rank)!;
        const wanted = rankNodes.map(node => {
            const centres = (adjacent.get(node.id) ?? [])
                .filter(id => rankOf.get(id) === rank + step)
                .map(id => centreOf(id, nodeById.get(id)!))
                .sort((a, b) => a - b);
            if (centres.length === 0) return crossOf.get(node.id)!;
            const middle = centres.length % 2 === 1 ? centres[(centres.length - 1) / 2]
                : (centres[centres.length / 2 - 1] + centres[centres.length / 2]) / 2;
            return middle - crossSizeOf(node) / 2;
        });
        placeInOrder(rankNodes, wanted, crossOf, crossSizeOf, nodesep);
    });

    for (var pass = 0; pass < 2; pass++) {
        sweep(ranks, -1);                  // towards the rank before
        sweep([...ranks].reverse(), 1);    // and towards the one after
    }
}

/*
    Place a rank's nodes as close as possible to where they want to be, keeping their order and a
    gap of nodesep between them. Subtracting the space taken by the nodes before it turns the gaps
    into a "must not decrease" constraint, which pooling adjacent violators solves exactly.
*/
function placeInOrder(rankNodes: ReactFlowNode[], wanted: number[], crossOf: Map<string, number>,
                      crossSizeOf: (node: ReactFlowNode) => number, nodesep: number): void {
    const offsets: number[] = [];
    var taken = 0;
    rankNodes.forEach(node => { offsets.push(taken); taken += crossSizeOf(node) + nodesep; });

    const blocks: {sum: number, count: number}[] = [];
    wanted.forEach((want, i) => {
        blocks.push({sum: want - offsets[i], count: 1});
        while (blocks.length > 1) {
            const [previous, last] = blocks.slice(-2);
            if (previous.sum / previous.count <= last.sum / last.count) break;
            blocks.splice(-2, 2, {sum: previous.sum + last.sum, count: previous.count + last.count});
        }
    });

    var i = 0;
    blocks.forEach(block => {
        for (var n = 0; n < block.count; n++, i++) crossOf.set(rankNodes[i].id, block.sum / block.count + offsets[i]);
    });
}

/*
    How far to move the whole result so that the anchor node keeps the position it came in with.
    Without an anchor the result starts at the origin - that is the case of a graph built from
    scratch, where there is nothing to stay next to.
*/
function translation(nodes: ReactFlowNode[], positioned: Map<string, {x: number, y: number}>, anchorId?: string) {
    const anchor = anchorId ? nodes.find(node => node.id === anchorId) : undefined;
    const anchorPosition = anchor && positioned.get(anchor.id);
    if (!anchor?.position || !anchorPosition) return {x: 0, y: 0};
    return {x: anchor.position.x - anchorPosition.x, y: anchor.position.y - anchorPosition.y};
}
