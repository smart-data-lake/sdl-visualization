// Which box a node of the lineage graph belongs to, and the boxes' geometry - see the Grouping
// section of src/components/ConfigExplorer/LineageTab/README.md.

import { Edge as ReactFlowEdge, Node as ReactFlowNode } from 'reactflow';
import { ConfigData } from './ConfigData';
import { DAGraph, NodeType } from './Graphs';

export type AlongAttribute = 'feed' | 'subjectArea';
export type AcrossAttribute = 'layer';
export type GroupAttribute = AlongAttribute | AcrossAttribute;
/* along: a lane the flow runs through; across: a column the flow crosses */
export type GroupAxis = 'along' | 'across';

export interface Grouping {
    along?: AlongAttribute;
    across?: AcrossAttribute;
}

/* The group keys of one node, per axis. Undefined where the node belongs to no box. */
export interface NodeGroups {
    along?: string;
    across?: string;
}

export const GROUP_ATTRIBUTE_LABELS: Record<GroupAttribute, string> = {
    feed: 'Feed',
    subjectArea: 'Subject area',
    layer: 'Layer',
};

export const isGrouping = (grouping: Grouping | undefined) => !!(grouping?.along || grouping?.across);
export const groupingKey = (grouping: Grouping | undefined) => `${grouping?.along ?? ''}|${grouping?.across ?? ''}`;

/* ------------------------------------------------------------ membership */

// the attribute a node type carries itself in SDLB's metadata; the other type derives it
const OWN_ATTRIBUTES: Record<GroupAttribute, NodeType> = {
    feed: NodeType.ActionNode,
    subjectArea: NodeType.DataNode,
    layer: NodeType.DataNode,
};

function configObjectOf(configData: ConfigData | undefined, id: string, nodeType: NodeType): any {
    return nodeType === NodeType.ActionNode ? configData?.actions?.[id] : configData?.dataObjects?.[id];
}

function ownValue(configData: ConfigData | undefined, id: string, nodeType: NodeType, attribute: GroupAttribute): string | undefined {
    const value = configObjectOf(configData, id, nodeType)?.metadata?.[attribute];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

// the one value all of them agree on, or none
function unique(values: (string | undefined)[]): string | undefined {
    const distinct = new Set(values);
    return distinct.size === 1 ? [...distinct][0] : undefined;
}

// the key of every node of the full graph; the type not carrying the attribute derives it from its neighbours where they agree
function keysOfAttribute(configData: ConfigData, attribute: GroupAttribute): Map<string, string> {
    const graph = configData.fullGraph;
    const keys = new Map<string, string>();
    if (!graph) return keys;
    const ownType = OWN_ATTRIBUTES[attribute];
    graph.nodes.forEach(node => {
        if (node.nodeType !== ownType) return;
        const value = ownValue(configData, node.id, node.nodeType, attribute);
        if (value) keys.set(node.id, value);
    });
    const derived = new Map<string, (string | undefined)[]>();
    graph.edges.forEach(edge => {
        // a data object takes the feed of its writer, an action the layer of its output: both action -> data object
        const [from, to] = ownType === NodeType.ActionNode ? [edge.fromNode, edge.toNode] : [edge.toNode, edge.fromNode];
        if (from.nodeType !== ownType || to.nodeType === ownType) return;
        derived.set(to.id, [...(derived.get(to.id) ?? []), keys.get(from.id)]);
    });
    derived.forEach((values, id) => {
        const value = unique(values);
        if (value) keys.set(id, value);
    });
    return keys;
}

const keyCache = new WeakMap<ConfigData, Map<GroupAttribute, Map<string, string>>>();

function keysOf(configData: ConfigData, attribute: GroupAttribute): Map<string, string> {
    let byAttribute = keyCache.get(configData);
    if (!byAttribute) {
        byAttribute = new Map();
        keyCache.set(configData, byAttribute);
    }
    let keys = byAttribute.get(attribute);
    if (!keys) {
        keys = keysOfAttribute(configData, attribute);
        byAttribute.set(attribute, keys);
    }
    return keys;
}

/* The groups of every node of a graph. Nodes the configuration does not know (a run's) stay ungrouped. */
export function groupsOfGraph(graph: DAGraph, configData: ConfigData | undefined, grouping: Grouping): Map<string, NodeGroups> {
    const along = grouping.along && configData ? keysOf(configData, grouping.along) : undefined;
    const across = grouping.across && configData ? keysOf(configData, grouping.across) : undefined;
    return new Map(graph.nodes.map(node => [node.id, {along: along?.get(node.id), across: across?.get(node.id)}]));
}

/* ------------------------------------------------------------ boxes */

export const GROUP_BOX_TYPE = 'groupBox';
export const GROUP_EDGE_PREFIX = 'group-edge:';

export const groupBoxId = (axis: GroupAxis, key: string) => `group:${axis}:${key}`;
export const isGroupBox = (node: ReactFlowNode | undefined) => node?.type === GROUP_BOX_TYPE;
export const isGroupEdge = (edge: ReactFlowEdge) => edge.id.startsWith(GROUP_EDGE_PREFIX);
export const groupsOf = (node: ReactFlowNode | undefined): NodeGroups | undefined => node?.data?.groups;

/* The data of a box node, see GroupBoxNode. */
export interface GroupBoxData {
    axis: GroupAxis;
    attribute: GroupAttribute;
    key: string;
    collapsed: boolean;
    /* the members it stands for while collapsed */
    memberIds: string[];
    /* while collapsed: its box in the other axis, if all of its members share one */
    groups?: NodeGroups;
}

export const boxDataOf = (node: ReactFlowNode): GroupBoxData => node.data.box;

// the space between a box's border and its members, and the header on top of that
export const GROUP_PADDING = 20;
export const GROUP_HEADER = 32;
// between the header and the members: the header's own height already leaves room around its title
export const GROUP_HEADER_GAP = 4;

// How far a box reaches past its members, per side of the screen. A column box crossed by lanes
// encloses theirs: their padding and, on top, their header as well.
export function groupInset(axis: GroupAxis, bothAxes: boolean): {side: number, top: number, bottom: number} {
    const around = axis === 'across' && bothAxes ? 2 : 1;
    return {side: around * GROUP_PADDING, top: around * (GROUP_HEADER + GROUP_HEADER_GAP), bottom: around * GROUP_PADDING};
}

/* The insets of a box on both ends of a screen axis: left and right on x, top and bottom on y. */
export function groupInsetOn(axis: GroupAxis, bothAxes: boolean, screenAxis: 'x' | 'y'): {before: number, after: number} {
    const {side, top, bottom} = groupInset(axis, bothAxes);
    return screenAxis === 'x' ? {before: side, after: side} : {before: top, after: bottom};
}

/* The gap two boxes of an axis next to each other on a screen axis need between their members. */
export function groupGap(axis: GroupAxis, bothAxes: boolean, screenAxis: 'x' | 'y'): number {
    const {before, after} = groupInsetOn(axis, bothAxes, screenAxis);
    return after + before + GROUP_PADDING;
}

// which boxes are collapsed: module state like the column displays, so that it survives a rebuild of the node set
const collapsedGroups = new Set<string>();

export function isGroupCollapsed(boxId: string): boolean {
    return collapsedGroups.has(boxId);
}

export function setGroupCollapsed(boxId: string, collapsed: boolean): void {
    if (collapsed) collapsedGroups.add(boxId);
    else collapsedGroups.delete(boxId);
}

export function clearCollapsedGroups(): void {
    collapsedGroups.clear();
}
