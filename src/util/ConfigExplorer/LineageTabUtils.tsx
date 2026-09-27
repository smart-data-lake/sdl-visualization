import {
    MarkerType, Position,
    Edge as ReactFlowEdge,
    ReactFlowInstance,
    Node as ReactFlowNode
} from 'reactflow';

import assert from 'assert';

import { nodeHeight, nodeWidth } from '../../components/ConfigExplorer/LineageTab/LineageTabWithSeparateView';
import { SchemaData, TaskStatus } from '../../types';
import { findFirstKeyWithObject } from '../helpers';
import { ColumnDisplay, ColumnInfo, buildColumnModel, filterColumns, isKnownDataObject } from './ColumnModel';
import { ConfigData } from './ConfigData';
import { RelationEdge, getIncomingRefs } from './RelationsGraph';
import { ActionPorts, Port, connectionKey, portRowCount } from './ActionPorts';
import { ColumnLineage, ColumnLineageIndex, ColumnRef, ColumnTransformation, IndexEdge, buildColumnLineageIndex, columnEdgesOf, columnId, columnKey, traceColumn } from './columnLineage';
import { ACTION_NODE_WIDTH_WITH_PORTS, columnHandleId, nodeHeightFor, nodeRelationHandleId, nodeWidthFor, portHandleId } from '../../components/ConfigExplorer/LineageTab/DataObjectColumns';
import { EdgeMetrics, NodeMetrics } from '../WorkflowsExplorer/Lineage';
import { FlowMetric } from '../WorkflowsExplorer/metrics';
import { ActionObject, DAGraph, DataObject, Edge as GraphEdge, ExpandSides, Node as GraphNode, NodeType, PartialDataObjectsAndActions, dagreLayoutRf, dfsRemoveRfElems, expandSidesFrom, isColumnLineageEdge, rfNodeSize, setRfNodeData, setRfNodeSize } from './Graphs';
import { LayoutDirection, LayoutMode, NodePlacement, assignCoordinates, forceCentreOf, forceModelOf, layoutModelOf } from './LineageLayout';


/*
    Constants
*/
const SUBFLOW_BORDER_SIZE = 30;
const RF_NODE_WIDTH_CUSTOM = 200;
const RF_NODE_HEIGHT_CUSTOM = 80;
const RF_NODE_WIDTH_DEFAULT = 172;
const RF_NODE_HEIGHT_DEFAULT = 36;

const LABEL_COLOR = '#fcae1e';
const EDGE_COLOR_DEFAULT = '#b1b1b7';
const EDGE_COLOR_HIGHLIGHTED = '#096bde';
const PARENT_NODE_COLOR_DEFAULT = 'rgba(255, 0, 0, 0.2)';
const EDGE_STROKE_WIDTH_DEFAULT = 3
const EDGE_STROKE_WIDTH_HIGHLIGHTED = 5;
// a column lineage edge is one of many between two nodes, so it is drawn finer
const COLUMN_EDGE_STROKE_WIDTH_DEFAULT = 1.5;
const COLUMN_EDGE_STROKE_WIDTH_HIGHLIGHTED = 3;
const strokeWidthOf = (edge: ReactFlowEdge, highlighted: boolean) => isColumnLineageEdge(edge)
    ? (highlighted ? COLUMN_EDGE_STROKE_WIDTH_HIGHLIGHTED : COLUMN_EDGE_STROKE_WIDTH_DEFAULT)
    : (highlighted ? EDGE_STROKE_WIDTH_HIGHLIGHTED : EDGE_STROKE_WIDTH_DEFAULT);
/*
    The z level a selected edge, the nodes it connects and its metric labels are lifted to, so that
    the highlighting is not hidden behind another edge or another edge's labels. ReactFlow renders
    the edges of one z level into one SVG layer and puts the level on it, and takes the z of a node
    from the same attribute (see groupEdgesByZLevel resp. createNodeInternals).
*/
export const SELECTED_ELEMENT_Z_INDEX = 1000;


/*
    Grouping working state.

    This is imperative bookkeeping for the ReactFlow instance, not React state - it is only ever
    read and written by the functions in this file, and it must survive re-renders of the lineage
    tab, which is why it lives at module level.
*/
const groupingState: {
    components?: Map<string, GraphNode[]>,          // connected components of the retrieved graph elements
    componentsRf?: Map<string, ReactFlowNode[]>,    // the same components mapped to the current rfi
    subgroups?: Map<string, GraphNode[]>,
    subgroupsRf?: Map<string, ReactFlowNode[]>
} = {};


/*
    Types and Interfaces
*/
export type { LayoutDirection };
export type ExpandDirection = 'forward' | 'backward';
export type GraphView = 'full' | 'data' | 'action' | 'relations';
export type DataOrActionObject = DataObject | ActionObject;
export type GraphElements = GraphNode[] | GraphEdge[] | [GraphNode[], GraphEdge[]];
export type ReactFlowElements = ReactFlowNode[] | ReactFlowEdge[] | [ReactFlowNode[], ReactFlowEdge[]];

// generic graph retrieval function
type GraphRetrievalFunction<F extends (...args: any[]) => any, Args extends Parameters<F>> = (
    fn: F,
    ...args: Args
) => ReturnType<F>;

const applyGraphRetrievalFunction: GraphRetrievalFunction<any, any[]> = (fn, ...args) => {
    return fn(...args);
}

export interface flowProps {
    elementName: string;
    elementType: string; // we have either dataObjects or actions now
    configData?: ConfigData;
    // a ready-made graph to show as a whole, instead of the neighbourhood of elementName in one of
    // configData's graphs. Used by the run view, which builds its graph from the state file.
    graph?: DAGraph;
    // which view a given graph is. The run view passes an action graph and no view, the configuration
    // tables pass the data resp. action graph restricted to the elements they list.
    graphView?: GraphView;
    // the state of each node within a run attempt, by node id. Only the run view knows these.
    nodeStatuses?: Map<string, TaskStatus>;
    // the metrics of the data flows within a run attempt, by edge id resp. by node id for the flows
    // that have no edge to sit on (see getRunMetrics). Only the run view knows these.
    edgeMetrics?: Map<string, EdgeMetrics>;
    nodeMetrics?: Map<string, NodeMetrics>;
    runContext?: boolean;
}

export interface preparedGraph {
    nodes: ReactFlowNode[];
    edges: ReactFlowEdge[];
    // set if the selected element does not exist in the selected graph view. The caller has to
    // navigate to this path - doing it here would update the router while the graph is rendering.
    navigateTo?: string;
}

// the lineage graph settings needed to (re-)create the graph, see useLineage
export interface lineageGraphState {
    graphView: GraphView;
    props: flowProps;
    layout: LayoutDirection;
    layoutMode?: LayoutMode;
    isExpanded: boolean;
}

export interface graphNodeProps {
    isSink: boolean,
    isSource: boolean,
    isCenterNode: boolean,
}

/** What a relation edge stands for: one column pair of one declared foreign key. */
export interface RelationEdgeProps {
    fkName?: string;
    /** the column of the referencing data object, lowercased - see columnHandleId */
    sourceColumn: string;
    /** the column of the referenced data object */
    targetColumn: string;
}

/** What a column lineage edge stands for: one input column feeding one output column, see syncColumnLineageEdges. */
export interface ColumnLineageEdgeProps {
    /** lowercased, see columnHandleId */
    sourceColumn: string;
    targetColumn: string;
    /** as exported, for the title */
    sourceName: string;
    targetName: string;
    /** every action creating the target column from the source column - usually one */
    via: {actionId: string, transformations: ColumnTransformation[]}[];
    /*
        Set where that end is a port of an action rather than a column, in the full view. The
        column on the other end is then the one read resp. written, and `via` is empty: how the
        action transforms it is drawn inside the action.
    */
    sourcePort?: string;
    targetPort?: string;
    /** in the action view, where both ends are actions: the data object the column belongs to */
    dataObjectId?: string;
}

/** The data a customEdge is rendered from, see CustomEdge */
export interface CustomEdgeProps {
    output?: FlowMetric,          // what the source action wrote to the data object of this edge
    input?: FlowMetric,           // what the target action read from it
    outputIndex: number,          // position among the edges leaving the source, to spread the labels
    inputIndex: number,           // position among the edges entering the target
    highlighted: boolean,
    relation?: RelationEdgeProps, // set in the relations view, where an edge is a foreign key
    columnLineage?: ColumnLineageEdgeProps, // set on the column edges of the data view
    dataObjectId?: string,        // in the action view: the data object two actions share
}

export interface ReactFlowNodeProps {
    props: any,
    label: string,
    nodeType: NodeType,
    targetPosition: Position,
    sourcePosition: Position
    progress: number | undefined,
    jsonObject: any,
    layoutDirection: LayoutDirection,
    expandNodeFunc: (id: string, isExpanded: boolean, direction: ExpandDirection, graphView: GraphView, layout: LayoutDirection) => void
    graphNodeProps: graphNodeProps,
    isGraphFullyExpanded: boolean,
    graphView: GraphView,
    runContext: boolean, // rendered inside a run attempt, i.e. without config data behind the nodes
    status: TaskStatus | undefined, // the state of the node within a run attempt, if it has one
    metrics: NodeMetrics | undefined, // the metrics of this action that have no edge to sit on
    highlighted: boolean,
    numFwdActiveEdges: number,
    numBwdActiveEdges: number,
    numFwdEdges: number, // not used for now, but might be helpful
    numBwdEdges: number,
    /*
        Every column of a data object. What the node renders is this narrowed to columnDisplay.
        Empty for an action node and in the run view, which has no configuration behind its nodes.
    */
    columns: ColumnInfo[],
    /*
        Recomputes those columns with an exported schema merged in. Undefined where there are no
        columns to show at all, which is what decides whether the node offers to show them.
    */
    columnsFunc?: ColumnsFunc,
    /*
        The exported column lineage of this data object, one document per action writing it. Set by
        the node once fetched; the edges between columns are built from the lineage of their target.
    */
    columnLineage?: ColumnLineage[],
    /** the keys of this node's columns on the column trace that is shown, see traceHighlights */
    tracedColumns?: string[],
    /** an action's ports, from the column lineage of what it writes. Undefined for a data object. */
    ports?: ActionPorts,
    /** the column lineage an action's ports were built from, for a trace without an index */
    outputLineage?: ColumnLineage[],
    /** an action's connections on the column trace that is shown, see connectionKey */
    tracedConnections?: string[],
    /*
        How much of its columns this node shows. Per node, and deliberately kept in the node's data
        rather than in React state: the lineage tab re-creates the whole flow whenever a setting in
        useLineageGraph changes, so node local state would not survive, and the edges have to be
        able to read it to pick the handle they attach to.
    */
    columnDisplay: ColumnDisplay,
    /*
        Whether this is the element the config explorer is showing. Distinct from
        graphNodeProps.isCenterNode, which names the node the current node set was built around and
        therefore decides which expand handles start out open.
    */
    isSelectedElement: boolean,
    /*
        Whether this node's neighbours are shown, per direction. Undefined until it is expanded or
        collapsed once, which means "as the node was created", see the handles in CustomDataNode.
    */
    isExpandedForward?: boolean,
    isExpandedBackward?: boolean,
    /*
        How far the user has dragged this node away from where the layout puts it. Kept as an offset
        rather than as a position, so that the node still follows its neighbours when they move.
    */
    manualOffset?: {x: number, y: number},
    /*
        Which sides of this node may extend the graph - the ones facing away from the selected
        element, see expandSidesFrom. Undefined where nothing may, i.e. where nothing is selected.
    */
    expandSides?: ExpandSides,
    /*
        Where this node sits in the layout, in ranks and cross axis order. Computed once per graph
        and direction and carried on the node from there, so that laying out again needs nothing but
        the current content of the ReactFlow instance. See LineageLayout.ts.
    */
    placement?: NodePlacement,
    /* the node's centre in a force layout of the relations view; when set, it replaces placement */
    forceCentre?: {x: number, y: number},
    /* in the action view: how an action's port groups are ordered, see portGroupRanks */
    portGroupRanks?: PortGroupRanks,
}

/** Where each data object's port group of an action goes, per side - the key PortOrder.groupRankOf reads. */
export type PortGroupRanks = {input: Record<string, number>, output: Record<string, number>};

/*
    In the action view a data object is an edge, so its group is ranked by the actions at the other end
    of it: the writer for an input, the first reader for an output. From the whole graph's layout model,
    so that the order does not depend on which neighbours are shown.
*/
export function portGroupRanks(graph: DAGraph, actionId: string, placement: ReadonlyMap<string, NodePlacement>): PortGroupRanks {
    const ranks: PortGroupRanks = {input: {}, output: {}};
    const rank = (side: Record<string, number>, dataObjectId: string, otherId: string) => {
        const order = placement.get(otherId)?.order;
        if (order !== undefined) side[dataObjectId] = Math.min(side[dataObjectId] ?? order, order);
    };
    graph.edges.forEach(edge => {
        if (!edge.dataObjectId) return;
        if (edge.toNode.id === actionId) rank(ranks.input, edge.dataObjectId, edge.fromNode.id);
        if (edge.fromNode.id === actionId) rank(ranks.output, edge.dataObjectId, edge.toNode.id);
    });
    return ranks;
}

/** Merges an exported schema and column lineage into the columns a data object's configuration declares. */
export type ColumnsFunc = (schema?: SchemaData, lineage?: ColumnLineage[]) => ColumnInfo[];

/*
    How far each node was opened, by node type and id, so a node stays open when the graph view or
    the layout changes, or the config explorer is left and entered again. Module state like the trace:
    in the graph context every toggle would re-render every node.
*/
const columnDisplays = new Map<string, ColumnDisplay>();
const columnDisplayKey = (nodeType: NodeType, id: string) => `${nodeType}:${id}`;

export function rememberColumnDisplay(nodeType: NodeType, id: string, display: ColumnDisplay): void {
    if (display === 'none') columnDisplays.delete(columnDisplayKey(nodeType, id));
    else columnDisplays.set(columnDisplayKey(nodeType, id), display);
}

export function rememberedColumnDisplay(nodeType: NodeType, id: string): ColumnDisplay {
    return columnDisplays.get(columnDisplayKey(nodeType, id)) ?? 'none';
}

/** The size a node is laid out and rendered at, from what it shows. */
export function nodeSizeFor(data: {columns?: ColumnInfo[], columnDisplay?: ColumnDisplay, ports?: ActionPorts}): {width: number, height: number} {
    const display = data.columnDisplay ?? 'none';
    // an action node opens on its ports, see ActionPortsView
    if (data.ports) {
        return display === 'none'
            ? {width: nodeWidthFor(false), height: nodeHeightFor(0)}
            : {width: ACTION_NODE_WIDTH_WITH_PORTS, height: nodeHeightFor(Math.max(portRowCount(data.ports), 1))};
    }
    const visible = filterColumns(data.columns ?? [], display);
    return {
        width: nodeWidthFor(display !== 'none'),
        // an open node with no columns still shows one row, saying so
        height: nodeHeightFor(display === 'none' ? 0 : Math.max(visible.length, 1)),
    };
}


/*
    Functions for rfi components creation
*/
export function getGraphFromConfig(configData: any, graphView: GraphView): DAGraph {
    var graph: DAGraph;
    switch (graphView) {
        case 'full': {
            graph = configData!.fullGraph!;
            break;
        }
        case 'data': {
            graph = configData!.dataGraph!;
            break;
        }
        case 'action': {
            graph = configData!.actionGraph!;
            break;
        }
        case 'relations': {
            graph = configData!.relationsGraph!;
            break;
        }
        default: {
            throw Error("Unknown graph view " + graphView);
        }
    }
    return graph;
}

/*
    The graph to render: either the one passed in through the props (run view), or the graph of the
    selected view built from the config (config explorer).
*/
export function getGraph(props: flowProps, graphView: GraphView): DAGraph {
    return props.graph ? props.graph : getGraphFromConfig(props.configData, graphView);
}


/*
    The columns to show on a data object node.

    What comes back is a function per node rather than a list, because a node's columns are only
    fully known once its exported schema has been fetched - which happens in the node itself, on
    demand, and not here. Calling it without a schema gives what the configuration alone declares,
    which is what the node shows until, and if, an export arrives. It returns every column; how many
    of them a node shows is the node's own state (see ColumnsToggle).

    Only the configuration knows about columns, so the run view - which builds its graph from a
    state file - has none, and neither has an action node.
*/
function makeColumnsOf(props: flowProps): (node: GraphNode) => ColumnsFunc | undefined {
    const configData = props.configData;
    if (!configData || props.runContext) return () => undefined;
    return (node: GraphNode) => {
        if (node.nodeType !== NodeType.DataNode) return undefined;
        const configObj = configData.dataObjects?.[node.id];
        if (!configObj) return undefined;
        const referencedBy = getIncomingRefs(node.id, configData.relationsGraph);
        return (schema?: SchemaData, lineage?: ColumnLineage[]) => {
            return buildColumnModel(configObj, {
                schema,
                lineage,
                isKnownDataObject: dataObjectId => isKnownDataObject(configData.dataObjects, dataObjectId),
                referencedBy,
            }).columns;
        };
    };
}

export function createReactFlowNodes(selectedNodes: GraphNode[],
    layoutDirection: LayoutDirection,
    isGraphFullyExpanded: boolean,
    isExpandedNode: boolean,          // The selectedNodes are the newly expanded neighbours of a node
    expandDirection: ExpandDirection | undefined,
    graphView: GraphView,
    expandNodeFunc: (id: string, isExpanded: boolean, direction: ExpandDirection, graphView: GraphView, layout: LayoutDirection) => void,
    props: flowProps,
    layoutMode: LayoutMode = 'layered'
): ReactFlowNode[] {
    const dataObjectsAndActions = getGraph(props, graphView);
    const columnsOf = makeColumnsOf(props);
    const isHorizontal = layoutDirection === 'LR';

    // there is no center node if the whole graph is shown (run view), so everything derived from it
    // stays empty and the nodes are rendered without center node highlighting and expand handles
    const centerNode = dataObjectsAndActions.getNodeById(props.elementName);
    const targetPos = isHorizontal ? Position.Left : Position.Top;
    const sourcePos = isHorizontal ? Position.Right : Position.Bottom;
    const sinkNodes = dataObjectsAndActions.getSinkNodes();
    const sourceNodes = dataObjectsAndActions.getSourceNodes();
    const [fwdNodes, fwdEdges] = centerNode ? dataObjectsAndActions.getDirectDescendants(centerNode, "all") as [GraphNode[], GraphEdge[]] : [[], []];
    const [bwdNodes, bwdEdges] = centerNode ? dataObjectsAndActions.getDirectAncestors(centerNode, "all") as [GraphNode[], GraphEdge[]] : [[], []];
    const [centerNodeDirectFwdNodes,] = centerNode ? dataObjectsAndActions.getOutElems(centerNode.id) : [[], []];
    const [centerNodeDirectBwdNodes,] = centerNode ? dataObjectsAndActions.getInElems(centerNode.id) : [[], []];
    const [reachableNodes, reachableEdges] = [[...fwdNodes, ...bwdNodes], [...fwdEdges, ...bwdEdges]];
    const reachableSubGraph = new PartialDataObjectsAndActions(reachableNodes, reachableEdges, layoutDirection, undefined, true);

    // without a center node the reachable subgraph is empty, so the edge counts are taken from the
    // graph itself - all of its nodes are shown anyway
    const neighbourGraph = centerNode ? reachableSubGraph : dataObjectsAndActions;

    // If we need more information to be displayed on the node,
    // just add more fields to the flowProps interface and access it in the custom node component.
    // The additional props can be passed in ElementDetails where the LineageTab is opened.
    const layoutModel = layoutModelOf(dataObjectsAndActions, layoutDirection);
    // only the relations view offers a force layout, see LineageLayout.ts
    const forceModel = graphView === 'relations' && layoutMode === 'force' ? forceModelOf(dataObjectsAndActions) : undefined;

    var result: ReactFlowNode[] = [];
    selectedNodes.forEach((node) => {
        const nodeType = node.nodeType;
        const [currNodeDirectFwdNodes,] = neighbourGraph.getOutElems(node.id); // instead of dataObjectsAndActions
        const [currNodeDirectBwdNodes,] = neighbourGraph.getInElems(node.id);

        const isCenterNode = node.isCenterNode;
        const isSink = sinkNodes.includes(node);
        const isSource = sourceNodes.includes(node);
        const isCenterNodeDirectFwdNeighbour = centerNodeDirectFwdNodes.includes(node);
        const isCenterNodeDirectBwdNeighbour = centerNodeDirectBwdNodes.includes(node);

        const columnsFunc = columnsOf(node);
        const data: ReactFlowNodeProps = {
            props: props.configData?.[props.elementType]?.[props.elementName],
            label: node.id,
            nodeType: nodeType,
            targetPosition: targetPos,
            sourcePosition: sourcePos,
            isGraphFullyExpanded: isGraphFullyExpanded,
            layoutDirection: layoutDirection,
            graphView: graphView,
            runContext: props.runContext === true,
            status: props.nodeStatuses?.get(node.id),
            metrics: props.nodeMetrics?.get(node.id as string),
            expandNodeFunc: expandNodeFunc,
            graphNodeProps: {
                isCenterNode: isCenterNode,
                isSink: isSink,
                isSource: isSource,
                // isCenterNodeDirectFwdNeighbour: isCenterNodeDirectFwdNeighbour,
                // isCenterNodeDirectBwdNeighbour: isCenterNodeDirectBwdNeighbour,
            },
            numBwdActiveEdges: (isGraphFullyExpanded || isCenterNode) ? currNodeDirectBwdNodes.length :
                (isCenterNodeDirectFwdNeighbour || (isExpandedNode && expandDirection === 'forward')) ? 1 :
                    0,
            numFwdActiveEdges: (isGraphFullyExpanded || isCenterNode) ? currNodeDirectFwdNodes.length :
                (isCenterNodeDirectBwdNeighbour || (isExpandedNode && expandDirection === 'backward')) ? 1 :
                    0,
            numBwdEdges: currNodeDirectBwdNodes.length,
            numFwdEdges: currNodeDirectFwdNodes.length,
            // the following are  hard coded for testing
            progress: nodeType === NodeType.ActionNode ? Math.round(Math.random() * 100) : undefined,
            jsonObject: node['jsonObject'],
            highlighted: false, // set by handlers in Core
            columnsFunc: columnsFunc,
            columns: columnsFunc ? columnsFunc() : [],
            // an action opens once its ports are known, see the node component
            columnDisplay: columnsFunc && nodeType === NodeType.DataNode ? rememberedColumnDisplay(nodeType, node.id) : 'none',
            isSelectedElement: node.id === props.elementName,
            placement: layoutModel.placement.get(node.id),
            forceCentre: forceModel?.get(node.id),
            portGroupRanks: graphView === 'action' && nodeType === NodeType.ActionNode
                ? portGroupRanks(dataObjectsAndActions, node.id, layoutModel.placement) : undefined,
        }

        const newNode = {
            id: node.id,
            type: 'customDataNode',   // should match the name defined in custom node types
            positionAbsolute: { x: node.position.x, y: node.position.y },
            position: { x: node.position.x, y: node.position.y },
            targetPosition: targetPos, // required for the node positions to actually change internally
            sourcePosition: sourcePos,
            data: data,
            // the node declares the size it is laid out at, see nodeSizeFor - the layout has to know
            // how tall a node is before it is rendered
            style: nodeSizeFor(data),
            extent: undefined,
            parentId: undefined
        } as ReactFlowNode

        result.push(newNode);
    });
    return result;
}

/*
    The edges of the relations view: one ReactFlow edge per column pair of a declared foreign key.

    A foreign key over several columns is several edges, one per pair. While both of its ends are
    collapsed they share the two node level handles and draw on top of each other - one line between
    two data objects, which is what the collapsed view means - and they move apart onto their columns
    as soon as a node is expanded (see updateColumnEdgeHandles). Creating them per pair up front
    means expanding a node only re-points existing edges instead of creating and destroying them.
*/
function createRelationReactFlowEdges(relations: RelationEdge[],
    edgeColor: string,
    selectedEdgeId: string | undefined): ReactFlowEdge[] {

    const result: ReactFlowEdge[] = [];
    relations.forEach(relation => {
        // a data object referencing itself has nothing to draw between two node level handles; the
        // relation only becomes visible, and readable, once its columns are shown
        const isSelfReference = relation.source === relation.target;
        relation.columns.forEach(({from, to}) => {
            const id = `${relation.id}::${from}->${to}`;
            result.push({
                type: 'customEdge',
                id: id,
                source: relation.source,
                target: relation.target,
                // every node starts closed, so every edge starts on the node's relation handles -
                // which, unlike its layout driven one, are on the same left and right borders the
                // column handles are on
                sourceHandle: nodeRelationHandleId('source', relation.source),
                targetHandle: nodeRelationHandleId('target', relation.target),
                hidden: isSelfReference,
                // no arrow head: CustomEdge draws a crow's foot on the referencing side instead
                data: {
                    outputIndex: 0,
                    inputIndex: 0,
                    highlighted: selectedEdgeId === id,
                    relation: {fkName: relation.fkName, sourceColumn: from, targetColumn: to},
                } as CustomEdgeProps,
                style: { stroke: edgeColor, strokeWidth: EDGE_STROKE_WIDTH_DEFAULT },
            } as ReactFlowEdge);
        });
    });
    return result;
}

/** Whether a node shows a column right now: open, and the column among what its display shows. */
function showsColumn(node: ReactFlowNode | undefined, column: string): boolean {
    const display: ColumnDisplay = node?.data?.columnDisplay ?? 'none';
    if (display === 'none') return false;
    return filterColumns(node!.data.columns ?? [], display).some(c => c.key === column);
}

const isOpen = (node: ReactFlowNode | undefined) => (node?.data?.columnDisplay ?? 'none') !== 'none';

/**
 * Point every relation and column lineage edge at the column it belongs to, on the ends whose node
 * shows that column, and at the node itself on the ends whose node does not.
 *
 * The two ends are decided separately: expanding one of two related data objects gives an edge from
 * a column to a node, which is the honest picture of what is known.
 */
function updateColumnEdgeHandles(rfi: ReactFlowInstance) {
    const nodes = new Map(rfi.getNodes().map(node => [node.id, node]));
    rfi.setEdges(edges => edges.map(edge => {
        const data = edge.data as CustomEdgeProps | undefined;
        const ends = data?.relation ?? data?.columnLineage;
        if (!ends) return edge;
        const source = nodes.get(edge.source), target = nodes.get(edge.target);
        // a relation is horizontal, so its closed end is the node's relation handle; a column
        // lineage edge runs beside a data flow edge and ends where that one does
        const nodeHandle = (kind: 'source' | 'target', nodeId: string) =>
            data?.relation ? nodeRelationHandleId(kind, nodeId) : nodeId;
        const lineage = data?.columnLineage;
        const sourceHandle = lineage?.sourcePort ? (isOpen(source) ? portHandleId('source', lineage.sourcePort) : edge.source)
                           : showsColumn(source, ends.sourceColumn) ? columnHandleId('source', ends.sourceColumn)
                           : nodeHandle('source', edge.source);
        const targetHandle = lineage?.targetPort ? (isOpen(target) ? portHandleId('target', lineage.targetPort) : edge.target)
                           : showsColumn(target, ends.targetColumn) ? columnHandleId('target', ends.targetColumn)
                           : nodeHandle('target', edge.target);
        const hidden = data?.relation !== undefined && edge.source === edge.target && !isOpen(source);
        if (sourceHandle === edge.sourceHandle && targetHandle === edge.targetHandle && hidden === (edge.hidden === true)) {
            return edge;
        }
        return {...edge, sourceHandle, targetHandle, hidden};
    }));
}

/*
    The column edges of the data view, derived from what the flow shows.

    Between two data objects of which at least one shows its columns, the data flow edge makes way
    for one edge per column pair, taken from the column lineage of its target. Pairs produced by
    several actions - two actions writing the same data object from the same input - are one edge
    naming all of them, because a column has one lineage however many actions agree on it. A pair
    neither of whose columns is shown would only draw the data flow edge again, so it is left out,
    and where nothing is left the data flow edge stays.

    Rebuilt as a whole on every change, merged by id so that ReactFlow keeps what did not change.
*/
export function columnLineageEdges(rfNodes: ReactFlowNode[], rfEdges: ReactFlowEdge[]): {replaced: Set<string>, wanted: ReactFlowEdge[]} {
    const nodes = new Map(rfNodes.map(node => [node.id, node]));
    const inDataView = rfNodes.some(node => node.data?.graphView === 'data');
    const inFullView = rfNodes.some(node => node.data?.graphView === 'full');
    const inActionView = rfNodes.some(node => node.data?.graphView === 'action');
    const replaced = new Set<string>();
    const wanted: ReactFlowEdge[] = [];
    const lineageEdge = (id: string, source: string, target: string, lineage: ColumnLineageEdgeProps): ReactFlowEdge => ({
        type: 'customEdge', id, source, target, sourceHandle: source, targetHandle: target,
        markerEnd: {type: MarkerType.ArrowClosed, width: 10, height: 10, color: EDGE_COLOR_DEFAULT},
        data: {outputIndex: 0, inputIndex: 0, highlighted: false, columnLineage: lineage} as CustomEdgeProps,
        style: {stroke: EDGE_COLOR_DEFAULT, strokeWidth: COLUMN_EDGE_STROKE_WIDTH_DEFAULT},
    } as ReactFlowEdge);

    /*
        The full view: an edge between a data object and an action makes way for one edge per
        column the action reads resp. writes, from the column to the action's port, as soon as the
        column or the port is shown. The ports know which columns those are.
    */
    if (inFullView) rfEdges.forEach(edge => {
        if (isColumnLineageEdge(edge) || edge.data?.relation) return;
        const source = nodes.get(edge.source), target = nodes.get(edge.target);
        if (!source || !target) return;
        const reads = target.data?.ports as ActionPorts | undefined;
        const writes = source.data?.ports as ActionPorts | undefined;
        const shown: ReactFlowEdge[] = [];
        if (reads) reads.inputs.filter(port => port.dataObjectId === source.id).forEach(port => {
            const column = columnKey(port.column);
            if (!isOpen(target) && !showsColumn(source, column)) return;
            shown.push(lineageEdge(`${source.id}.${column}->${target.id}::port`, source.id, target.id,
                {sourceColumn: column, targetColumn: column, sourceName: port.column, targetName: port.column, via: [], targetPort: port.key}));
        });
        if (writes) writes.outputs.filter(port => port.dataObjectId === target.id).forEach(port => {
            const column = columnKey(port.column);
            if (!isOpen(source) && !showsColumn(target, column)) return;
            shown.push(lineageEdge(`${source.id}->${target.id}.${column}::port`, source.id, target.id,
                {sourceColumn: column, targetColumn: column, sourceName: port.column, targetName: port.column, via: [], sourcePort: port.key}));
        });
        if (shown.length === 0) return;
        replaced.add(edge.id);
        wanted.push(...shown);
    });

    /*
        The action view: an edge stands for a data object two actions share, and makes way for one
        edge per column of it, from the writer's port to the reader's. Where both are open only the
        columns both have a port for; where one is, its columns end on the other's node.
    */
    if (inActionView) rfEdges.forEach(edge => {
        const dataObjectId = (edge.data as CustomEdgeProps | undefined)?.dataObjectId;
        if (isColumnLineageEdge(edge) || !dataObjectId) return;
        const source = nodes.get(edge.source), target = nodes.get(edge.target);
        if (!source || !target || !(isOpen(source) || isOpen(target))) return;
        const portsOf = (ports: Port[] | undefined) => new Map((ports ?? []).filter(port => port.dataObjectId === dataObjectId).map(port => [port.key, port]));
        const writes = portsOf((source.data?.ports as ActionPorts | undefined)?.outputs);
        const reads = portsOf((target.data?.ports as ActionPorts | undefined)?.inputs);
        const keys = isOpen(source) && isOpen(target) ? [...writes.keys()].filter(key => reads.has(key))
                   : isOpen(source) ? [...writes.keys()] : [...reads.keys()];
        if (keys.length === 0) return;
        replaced.add(edge.id);
        keys.forEach(key => {
            const port = (writes.get(key) ?? reads.get(key))!;
            const column = columnKey(port.column);
            wanted.push(lineageEdge(`${source.id}->${dataObjectId}.${column}->${target.id}::port`, source.id, target.id,
                {sourceColumn: column, targetColumn: column, sourceName: port.column, targetName: port.column, via: [], dataObjectId,
                 sourcePort: writes.has(key) ? key : undefined, targetPort: reads.has(key) ? key : undefined}));
        });
    });

    if (inDataView) rfEdges.forEach(edge => {
        const data = edge.data as CustomEdgeProps | undefined;
        if (isColumnLineageEdge(edge) || data?.relation) return;
        const source = nodes.get(edge.source), target = nodes.get(edge.target);
        if (!source || !target || !(isOpen(source) || isOpen(target))) return;

        const pairs = new Map<string, ColumnLineageEdgeProps>();
        ((target.data.columnLineage ?? []) as ColumnLineage[]).flatMap(columnEdgesOf)
            .filter(columnEdge => columnEdge.from.dataObjectId === source.id)
            .forEach(columnEdge => {
                const sourceColumn = columnKey(columnEdge.from.column), targetColumn = columnKey(columnEdge.to.column);
                const key = `${sourceColumn}->${targetColumn}`;
                const pair = pairs.get(key) ?? {sourceColumn, targetColumn, sourceName: columnEdge.from.column,
                                                 targetName: columnEdge.to.column, via: []};
                pair.via.push({actionId: columnEdge.actionId, transformations: columnEdge.transformations});
                pairs.set(key, pair);
            });
        const shown = [...pairs.values()]
            .filter(pair => showsColumn(source, pair.sourceColumn) || showsColumn(target, pair.targetColumn));
        if (shown.length === 0) return;

        replaced.add(edge.id);
        shown.forEach(pair => wanted.push(lineageEdge(
            `${source.id}.${pair.sourceColumn}->${target.id}.${pair.targetColumn}::lineage`, source.id, target.id, pair)));
    });
    return {replaced, wanted};
}

function syncColumnLineageEdges(rfi: ReactFlowInstance) {
    const {replaced, wanted} = columnLineageEdges(rfi.getNodes(), rfi.getEdges());
    rfi.setEdges(edges => {
        const existing = new Map(edges.filter(isColumnLineageEdge).map(edge => [edge.id, edge]));
        if (existing.size === 0 && wanted.length === 0) return edges; // nothing to do, the common case
        const flowEdges = edges.filter(edge => !isColumnLineageEdge(edge)).map(edge => {
            const hidden = replaced.has(edge.id);
            return (edge.data?.relation || hidden === (edge.hidden === true)) ? edge : {...edge, hidden};
        });
        // an edge that stays keeps its handles and styling; only what it stands for can change
        const lineageEdges = wanted.map(edge => {
            const kept = existing.get(edge.id);
            return kept ? {...kept, data: {...kept.data, columnLineage: edge.data.columnLineage}} : edge;
        });
        return [...flowEdges, ...lineageEdges];
    });
}

/**
 * Bring the column edges in line with what the nodes show: after a node opened or closed its
 * columns, its columns or its lineage changed, or the node set changed.
 */
export function updateColumnEdges(rfi: ReactFlowInstance) {
    syncColumnLineageEdges(rfi);
    updateColumnEdgeHandles(rfi);
    // edges created just now know nothing of a trace that is shown
    if (traceState.trace) applyColumnTrace(rfi, traceState.trace);
}

/* ------------------------------------------------------------ column trace */

/** A column traced both ways: everything it depends on and everything that depends on it. */
export interface GraphTrace {
    start: ColumnRef;
    /** the traced column keys per data object, the start column included */
    columns: Map<string, Set<string>>;
    edges: IndexEdge[];
}

export function buildGraphTrace(index: ColumnLineageIndex, start: ColumnRef): GraphTrace {
    const upstream = traceColumn(index, start, 'upstream');
    const downstream = traceColumn(index, start, 'downstream');
    const columns = new Map<string, Set<string>>();
    const add = (dataObjectId: string, column: string) =>
        columns.set(dataObjectId, (columns.get(dataObjectId) ?? new Set()).add(columnKey(column)));
    add(start.dataObjectId, start.column);
    const edges = [...upstream.edges, ...downstream.edges];
    edges.forEach(([fromDo, fromCol, toDo, toCol]) => { add(fromDo, fromCol); add(toDo, toCol); });
    return {start, columns, edges};
}

/**
 * Where a trace begins and ends: the columns on it that depend on nothing on it resp. that nothing
 * on it depends on. A column reading itself (historization) does not count as a dependency.
 */
export function traceEnds(trace: GraphTrace): {starts: ColumnRef[], ends: ColumnRef[]} {
    const refs = new Map<string, ColumnRef>([[columnId(trace.start), trace.start]]);
    const hasInput = new Set<string>(), hasOutput = new Set<string>();
    trace.edges.forEach(([fromDo, fromCol, toDo, toCol]) => {
        const from = {dataObjectId: fromDo, column: fromCol}, to = {dataObjectId: toDo, column: toCol};
        if (!refs.has(columnId(from))) refs.set(columnId(from), from);
        if (!refs.has(columnId(to))) refs.set(columnId(to), to);
        if (columnId(from) === columnId(to)) return;
        hasOutput.add(columnId(from));
        hasInput.add(columnId(to));
    });
    const sorted = (ids: string[]) => ids.sort().map(id => refs.get(id)!);
    return {
        starts: sorted([...refs.keys()].filter(id => !hasInput.has(id))),
        ends: sorted([...refs.keys()].filter(id => !hasOutput.has(id))),
    };
}

/**
 * The index to trace with: the one that was built, or else one assembled from the lineage the shown
 * nodes have read - which covers those nodes only, and says so through `complete`.
 */
export function traceIndex(built: ColumnLineageIndex | undefined, rfNodes: ReactFlowNode[]): {index: ColumnLineageIndex, complete: boolean} {
    if (built) return {index: built, complete: true};
    // a document can be held by the data object it describes and by the action writing it
    const lineage = new Map(rfNodes.flatMap(node => [...(node.data?.columnLineage ?? []), ...(node.data?.outputLineage ?? [])] as ColumnLineage[])
        .map(doc => [`${doc.dataObjectId}\u0000${doc.actionId}`, doc]));
    return {index: buildColumnLineageIndex([...lineage.values()].map(doc => ({lineage: doc})), ''), complete: false};
}

/*
    What a trace lights up in the flow that is shown.

    A column edge is on the trace when its column pair is. Any other edge only when the trace
    actually runs along it - a data object reading one traced column of another is not a dependency
    of every column of it: in the data view a traced pair between its two data objects, in the full
    view a traced pair read resp. written by its action, and in the action view two traced pairs
    meeting on the same column of the data object it stands for. A relation is never on it.
*/
export function traceHighlights(trace: GraphTrace, rfNodes: ReactFlowNode[], rfEdges: ReactFlowEdge[]): {nodeIds: Set<string>, edgeIds: Set<string>} {
    const isAction = new Map(rfNodes.map(node => [node.id, node.data?.nodeType === NodeType.ActionNode]));
    const edgeIds = new Set<string>();
    const nodeIds = new Set<string>();
    const pairKey = (fromDo: string, fromCol: string, toDo: string, toCol: string) =>
        `${fromDo}.${columnKey(fromCol)}>${toDo}.${columnKey(toCol)}`;
    const pairs = new Set(trace.edges.map(([fromDo, fromCol, toDo, toCol]) => pairKey(fromDo, fromCol, toDo, toCol)));

    const onTrace = (edge: ReactFlowEdge): boolean => {
        const data = edge.data as CustomEdgeProps | undefined;
        if (data?.relation) return false;
        if (data?.columnLineage) {
            const lineage = data.columnLineage;
            if (lineage.dataObjectId) {
                const x = lineage.dataObjectId, column = lineage.sourceColumn;
                const written = trace.edges.some(e => e[4] === edge.source && e[2] === x && columnKey(e[3]) === column);
                const read = trace.edges.some(e => e[4] === edge.target && e[0] === x && columnKey(e[1]) === column);
                return (!lineage.sourcePort || written) && (!lineage.targetPort || read) && (written || read);
            }
            if (lineage.targetPort) return trace.edges.some(([fromDo, fromCol, , , actionId]) =>
                fromDo === edge.source && columnKey(fromCol) === lineage.sourceColumn && actionId === edge.target);
            if (lineage.sourcePort) return trace.edges.some(([, , toDo, toCol, actionId]) =>
                actionId === edge.source && toDo === edge.target && columnKey(toCol) === lineage.targetColumn);
            return pairs.has(pairKey(edge.source, lineage.sourceColumn, edge.target, lineage.targetColumn));
        }
        const sourceIsAction = isAction.get(edge.source), targetIsAction = isAction.get(edge.target);
        if (!sourceIsAction && !targetIsAction) {
            return trace.edges.some(([fromDo, , toDo]) => fromDo === edge.source && toDo === edge.target);
        }
        if (!sourceIsAction) return trace.edges.some(([fromDo, , , , actionId]) => fromDo === edge.source && actionId === edge.target);
        if (!targetIsAction) return trace.edges.some(([, , toDo, , actionId]) => actionId === edge.source && toDo === edge.target);
        const via = data?.dataObjectId;
        if (!via) return false;
        const written = new Set(trace.edges.filter(e => e[4] === edge.source && e[2] === via).map(e => columnKey(e[3])));
        return trace.edges.some(e => e[4] === edge.target && e[0] === via && written.has(columnKey(e[1])));
    };

    rfEdges.forEach(edge => {
        if (!onTrace(edge)) return;
        edgeIds.add(edge.id);
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
    });
    // a traced column of a node no edge on the trace reaches, e.g. while its neighbours are hidden
    const actions = new Set(trace.edges.map(e => e[4]));
    rfNodes.forEach(node => { if (trace.columns.has(node.id) || (isAction.get(node.id) && actions.has(node.id))) nodeIds.add(node.id); });
    return {nodeIds, edgeIds};
}

/*
    The trace that is shown. Module state for the same reason the grouping state is: only the
    imperative code in this file reads it, and it has to be re-applied whenever the column edges are
    rebuilt, which happens far from the component that set it.
*/
const traceState: {trace?: GraphTrace} = {};

function applyColumnTrace(rfi: ReactFlowInstance, trace: GraphTrace) {
    const {nodeIds, edgeIds} = traceHighlights(trace, rfi.getNodes(), rfi.getEdges());
    rfi.setEdges(edges => edges.map(edge => {
        const highlighted = edgeIds.has(edge.id);
        if ((edge.data?.highlighted === true) === highlighted) return edge;
        const color = highlighted ? EDGE_COLOR_HIGHLIGHTED : EDGE_COLOR_DEFAULT;
        return {
            ...edge,
            data: {...edge.data, highlighted},
            zIndex: highlighted ? SELECTED_ELEMENT_Z_INDEX : 0,
            style: {...edge.style, stroke: color, strokeWidth: strokeWidthOf(edge, highlighted)},
            markerEnd: {type: MarkerType.ArrowClosed, width: 10, height: 10, color},
        };
    }));
    rfi.setNodes(nodes => nodes.map(node => {
        const highlighted = nodeIds.has(node.id);
        const columns = trace.columns.get(node.id);
        const tracedColumns = columns ? [...columns].sort() : undefined;
        const connections = trace.edges.filter(edge => edge[4] === node.id)
            .map(([fromDo, fromCol, toDo, toCol]) => connectionKey(`${fromDo}.${columnKey(fromCol)}`, `${toDo}.${columnKey(toCol)}`));
        const tracedConnections = connections.length > 0 ? connections.sort() : undefined;
        if ((node.data.highlighted === true) === highlighted
            && (node.data.tracedColumns ?? []).join() === (tracedColumns ?? []).join()
            && (node.data.tracedConnections ?? []).join() === (tracedConnections ?? []).join()) return node;
        return {...node, zIndex: highlighted ? SELECTED_ELEMENT_Z_INDEX : 0,
                data: {...node.data, highlighted, tracedColumns, tracedConnections}};
    }));
}

const indexedColumnsCache = new WeakMap<ColumnLineageIndex, Set<string>>();

/** Every column the index knows, as columnIds - which is what decides whether a row can be traced. */
export function indexedColumnIds(index: ColumnLineageIndex): Set<string> {
    let ids = indexedColumnsCache.get(index);
    if (!ids) {
        ids = new Set(index.edges.flatMap(([fromDo, fromCol, toDo, toCol]) =>
            [columnId({dataObjectId: fromDo, column: fromCol}), columnId({dataObjectId: toDo, column: toCol})]));
        indexedColumnsCache.set(index, ids);
    }
    return ids;
}

/** Highlight a trace, replacing whatever was highlighted; undefined takes it away again. */
export function showColumnTrace(rfi: ReactFlowInstance, trace: GraphTrace | undefined) {
    if (!trace && !traceState.trace) return; // leave another highlight alone
    traceState.trace = trace;
    resetEdgeStyles(rfi);
    resetNodeStyles(rfi);
    if (trace) applyColumnTrace(rfi, trace);
}

export function createReactFlowEdges(selectedEdges: GraphEdge[],
    props: flowProps,
    graphView: GraphView,
    selectedEdgeId: string | undefined): ReactFlowEdge[] {
    const dataObjectsAndActions = getGraph(props, graphView);
    const edges = dataObjectsAndActions.edges?.filter(edge => selectedEdges.includes(edge));
    const edgeColor = selectedEdgeId ? EDGE_COLOR_HIGHLIGHTED : EDGE_COLOR_DEFAULT;

    // an edge of the relations graph is a foreign key, not a data flow, and is built differently
    if (graphView === 'relations') return createRelationReactFlowEdges(edges as RelationEdge[], edgeColor, selectedEdgeId);

    var result: ReactFlowEdge[] = [];
    edges.forEach(edge => {
        assert(!(edge.toNode.id === undefined || edge.fromNode.id === undefined), "Edge has no source or target")
        const uniqueId = edge.id;
        const fromNodeId = edge.fromNode.id;
        const toNodeId = edge.toNode.id;
        // where the metric labels sit among the labels of the sibling edges leaving the source resp.
        // entering the target, so that the labels of one action do not end up on top of each other
        const siblingOutEdges = dataObjectsAndActions.getOutElems(fromNodeId)[1];
        const siblingInEdges = dataObjectsAndActions.getInElems(toNodeId)[1];
        const metrics = props.edgeMetrics?.get(edge.id as string);

        const newEdge = {
            type: 'customEdge',
            id: uniqueId, // has to be unique, linked to node ids
            source: fromNodeId,
            target: toNodeId,
            // The node level handles are named after the node (see CustomDataNode). Naming them
            // explicitly matters as soon as a node has more than one handle per type - a node
            // showing its columns has one per column - because ReactFlow's fallback picks the
            // first handle of the right type, which is then not necessarily the node's own.
            sourceHandle: fromNodeId,
            targetHandle: toNodeId,
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 10,
                height: 10,
                color: edgeColor,
            },
            data: {
                // the metrics of the data object this edge stands for, only set in a run attempt
                output: metrics?.output,
                input: metrics?.input,
                outputIndex: Math.max(siblingOutEdges.findIndex(e => e.id === edge.id), 0),
                inputIndex: Math.max(siblingInEdges.findIndex(e => e.id === edge.id), 0),
                highlighted: selectedEdgeId === edge.id,
                dataObjectId: edge.dataObjectId,
            } as CustomEdgeProps,
            style: { stroke: edgeColor, strokeWidth: EDGE_STROKE_WIDTH_DEFAULT },
        } as ReactFlowEdge;
        result.push(newEdge);
    });

    return result;
}

function prepareGraphDirect(rfi: ReactFlowInstance, doa: DAGraph, graphView: GraphView, props: flowProps, layout: LayoutDirection, isExpanded: boolean, layoutMode?: LayoutMode): [ReactFlowNode[], ReactFlowEdge[]] {
    var partialGraphPair: [GraphNode[], GraphEdge[]] = [[], []];
    var centralNodeId: string = props.elementName;
    const centralNode = doa.getNodeById(centralNodeId);

    if (centralNode) {
        // reset isCenterNode flags otherwise all previous ones will be colored
        doa.nodes.forEach((node) => node.setIsCenterNode(false));

        // When the layout has changed, the nodes and edges have to be recomputed
        partialGraphPair = !isExpanded ? doa.returnDirectNeighbours(centralNodeId) : doa.returnPartialGraphInputs(centralNodeId);
        const partialGraph = new PartialDataObjectsAndActions(partialGraphPair[0], partialGraphPair[1], layout, props.configData, true);
        if (centralNode) partialGraph.setCenterNode(centralNode);

        let newNodes = createReactFlowNodes(partialGraphPair[0], layout, isExpanded, false, undefined, graphView, makeExpandNodeFunc(rfi, props), props, layoutMode);
        let newEdges = createReactFlowEdges(partialGraphPair[1], props, graphView, undefined);

        return [newNodes, newEdges];
    } else {
        console.warn(`Central node ${centralNodeId} not found in current graph`);
        return [[], []];
    }
}

/*
    Renders the whole graph, without a center node and without expand/collapse handles on the nodes.
*/
function prepareGraphComplete(rfi: ReactFlowInstance, doa: DAGraph, graphView: GraphView, props: flowProps, layout: LayoutDirection): [ReactFlowNode[], ReactFlowEdge[]] {
    // no node is the center node, otherwise a previously selected one would still be colored
    doa.nodes.forEach((node) => node.setIsCenterNode(false));

    const nodes = createReactFlowNodes(doa.nodes, layout, true, false, undefined, graphView, makeExpandNodeFunc(rfi, props), props);
    const edges = createReactFlowEdges(doa.edges, props, graphView, undefined);
    return [nodes, edges];
}

export function prepareAndRenderGraph(rfi: ReactFlowInstance, lineageState: lineageGraphState): preparedGraph {
    const { graphView, props, layout, isExpanded, layoutMode } = lineageState;

    var doa: DAGraph; // data objects and actions
    var navigateTo: string | undefined;

    // a graph given through the props is shown as a whole, there is no element to center it on
    if (props.graph) {
        const [nodes, edges] = prepareGraphComplete(rfi, props.graph, graphView, props, layout);
        return { nodes: applyExpandSides(nodes, edges, undefined), edges };
    }

    // get the right central node for the graph
    if (graphView === 'full') {
        doa = props.configData!.fullGraph!;
    } else if (graphView === 'data') {
        doa = props.configData!.dataGraph!;
        if (props.elementType === 'actions') {
            // switch to data graph when an action is selected -> navigate to first direct neighbour
            const [neighours,] = props.configData?.fullGraph?.returnDirectNeighbours(props.elementName)!;
            navigateTo = `config/dataObjects/${neighours[0].id}`;
        }
    } else if (graphView === 'action') {
        doa = props.configData!.actionGraph!;
        if (props.elementType === 'dataObjects') {
            // switch to action graph when a data object is selected -> navigate to first direct neighbour
            const [neighours,] = props.configData?.fullGraph?.returnDirectNeighbours(props.elementName)!;
            navigateTo = `config/actions/${neighours[0].id}`;
        }
    } else if (graphView === 'relations') {
        doa = props.configData!.relationsGraph!;
        if (props.elementType === 'actions') {
            // the relations graph has no actions -> navigate to a data object the action touches
            const [neighours,] = props.configData?.fullGraph?.returnDirectNeighbours(props.elementName)!;
            navigateTo = `config/dataObjects/${neighours[0].id}`;
        }
    } else {
        throw Error("Unknown graph view " + graphView);
    }

    // the selected element is not part of the selected graph view, so there is no graph to build yet.
    // The caller navigates to navigateTo and we are called again for the element it lands on.
    if (navigateTo) return { nodes: [], edges: [], navigateTo };

    // reset isCenterNode flags otherwise all previous ones will be colored
    const [nodes, edges] = prepareGraphDirect(rfi, doa, graphView, props, layout, isExpanded, layoutMode);
    return { nodes: applyExpandSides(nodes, edges, props.elementName), edges };
}

/*
    Which sides of each node may extend the graph, from the element that is selected. Has to be
    redone whenever the selection or the set of shown nodes changes - the sides are relative to
    both, see expandSidesFrom.
*/
export function applyExpandSides(nodes: ReactFlowNode[], edges: ReactFlowEdge[], selectedId?: string): ReactFlowNode[] {
    const sides = expandSidesFrom(nodes, edges, selectedId);
    return nodes.map(node => node.data.expandSides === sides.get(node.id)
        ? node
        : {...node, data: {...node.data, expandSides: sides.get(node.id)}});
}

export function updateExpandSides(rfi: ReactFlowInstance, selectedId?: string): void {
    rfi.setNodes(nodes => applyExpandSides(nodes, rfi.getEdges(), selectedId));
}

/*
    Functions for expand/collapse
*/
// binds the current ReactFlow instance and lineage tab props to the expand/collapse handler that is
// stored on each node, so that the handler keeps the signature expected by the custom node component
// nodes added to a shown graph follow the layout its nodes were created with
function flowLayoutMode(rfi: ReactFlowInstance): LayoutMode {
    return rfi.getNodes().some(node => forceCentreOf(node)) ? 'force' : 'layered';
}

function makeExpandNodeFunc(rfi: ReactFlowInstance, props: flowProps) {
    return (id: string, isExpanded: boolean, expandDirection: ExpandDirection, graphView: GraphView, layoutDirection: LayoutDirection) =>
        expandNodeFunc(rfi, props, id, isExpanded, expandDirection, graphView, layoutDirection);
}

function expandNodeFunc(rfi: ReactFlowInstance, props: flowProps,
    id: string, isExpanded: boolean,
    expandDirection: ExpandDirection,
    graphView: GraphView,
    layoutDirection: LayoutDirection) {

    // if expanded, show the direct out neighbours of the node with the id; if unexpanded, hide all descendants
    const graph = getGraph(props, graphView);
    const selectedId = selectedNodeId(rfi);
    const isFwd = expandDirection === 'forward';
    const currNode = graph.getNodeById(id)!;
    const currRfNode = rfi.getNode(currNode?.id!)!;

    if (!isExpanded) {
        // expand
        let [neighbourNodes, neighbourEdges] = isFwd ? graph.getOutElems(id) : graph.getInElems(id); // all positions are 0,0 here

        // only create not existing nodes, update active edges of exisiting nodes
        const currRfNodes = rfi.getNodes();
        const currRfNodeIds = currRfNodes.map(rfNode => rfNode.id);
        let rfNodes = createReactFlowNodes(neighbourNodes.filter(node => !currRfNodeIds.includes(node.id)),
            layoutDirection,
            isExpanded,
            true,
            expandDirection,
            graphView,
            makeExpandNodeFunc(rfi, props),
            props,
            flowLayoutMode(rfi));

        let rfEdges = createReactFlowEdges(neighbourEdges,
            props,
            graphView,
            undefined,
        );

        updateLineageGraphOnExpand(rfi, rfEdges, rfNodes, {
            isFwd,
            currRfNodeIds,
            currRfNode,
            neighbourEdges,
            layoutDirection,
        });
        // the new edges were built for collapsed nodes; point them at the columns of the ones that
        // are not, so that a neighbour expanded into an already expanded node connects to its rows
        updateColumnEdges(rfi);

    } else {
        // collapse
        updateLineageGraphOnCollapse(rfi, {
            currRfNode,
            expandDirection,
            layoutDirection,
        });
        //resetViewPortCentered(rfi, [currRfNode]);
    }
    // the node's own handles read this, so that expanding it from elsewhere keeps them in step
    setRfNodeData(rfi, {nodeId: id, path: isFwd ? 'isExpandedForward' : 'isExpandedBackward', value: !isExpanded});
    setSelectedNode(rfi, selectedId); // the new nodes were built from the props of their creator
    dropDanglingEdges(rfi);
    updateExpandSides(rfi, selectedId);
    prioritizeParentNodes(rfi);
}

/*
    Show the direct neighbours of a node that is already in the flow, in both directions - what
    selecting an element does. The graph grows around the node instead of being rebuilt around it.
*/
export function expandNeighbours(rfi: ReactFlowInstance, props: flowProps, nodeId: string,
    graphView: GraphView, layoutDirection: LayoutDirection) {

    const graph = getGraph(props, graphView);
    if (!graph.getNodeById(nodeId) || !rfi.getNode(nodeId)) return;
    const shown = new Set(rfi.getNodes().map(node => node.id));

    (['forward', 'backward'] as ExpandDirection[]).forEach(direction => {
        const [neighbours] = direction === 'forward' ? graph.getOutElems(nodeId) : graph.getInElems(nodeId);
        const path = direction === 'forward' ? 'isExpandedForward' : 'isExpandedBackward';
        // expanding what is already expanded would only inflate the active edge counts collapse
        // reads - but its neighbours are shown either way, which is what the handle has to say
        if (neighbours.length === 0 || neighbours.every(node => shown.has(node.id))) {
            if (neighbours.length > 0) setRfNodeData(rfi, {nodeId, path, value: true});
            return;
        }
        expandNodeFunc(rfi, props, nodeId, false, direction, graphView, layoutDirection);
    });
}

/*
    Add a node that is not shown, together with the shortest chain of nodes connecting it to what
    is. Everything that is already shown keeps its place - the graph only grows.
*/
export function spliceNodePath(rfi: ReactFlowInstance, props: flowProps, nodeId: string,
    graphView: GraphView, layoutDirection: LayoutDirection) {

    const graph = getGraph(props, graphView);
    if (!graph.getNodeById(nodeId) || rfi.getNode(nodeId)) return;

    const shownIds = rfi.getNodes().map(node => node.id);
    const [pathNodes, pathEdges] = shownIds.length > 0 ? graph.shortestPathToAny(nodeId, shownIds) : [[], []];
    // in another connected component there is no chain to it, so it comes on its own
    const nodes = pathNodes.length > 0 ? pathNodes : [graph.getNodeById(nodeId)!];
    const anchorId = pathNodes.length > 0 ? pathNodes[pathNodes.length - 1].id : undefined;

    const newRfNodes = createReactFlowNodes(nodes.filter(node => !shownIds.includes(node.id)),
        layoutDirection, false, true, undefined, graphView, makeExpandNodeFunc(rfi, props), props, flowLayoutMode(rfi));
    const newRfEdges = createReactFlowEdges(pathEdges, props, graphView, undefined);

    rfi.setEdges(eds => [...eds, ...newRfEdges.filter(edge => !eds.some(e => e.id === edge.id))]);
    rfi.setNodes(nds => [...nds, ...newRfNodes]);

    // the same bookkeeping an expansion does, so that collapsing later takes the chain away again
    const add = (x: number, y: number) => x + y;
    pathEdges.forEach(edge => {
        setRfNodeData(rfi, {nodeId: edge.fromNode.id, path: 'numFwdActiveEdges', value: 1, fromOwnProps: 'data.numFwdActiveEdges', combine: add});
        setRfNodeData(rfi, {nodeId: edge.toNode.id, path: 'numBwdActiveEdges', value: 1, fromOwnProps: 'data.numBwdActiveEdges', combine: add});
    });

    if (!isGrouped(rfi)) {
        rfi.setNodes(nds => assignCoordinates(nds, rfi.getEdges(), layoutDirection, {anchorId}));
    } else {
        recomputeLayout(rfi, layoutDirection, anchorId);
    }
    updateColumnEdges(rfi);
}

function updateLineageGraphOnExpand(rfi: ReactFlowInstance, rfEdges: ReactFlowEdge[], rfNodes: ReactFlowNode[], props: any) {
    const { isFwd,
        currRfNodeIds,
        currRfNode,
        neighbourEdges,
        layoutDirection,
    } = props;

    const add = (x, y) => x + y;
    rfEdges.forEach(rfEdge => {
        if (isFwd) {
            const currNode = rfi.getNode(rfEdge.target)!;
            if (currNode !== undefined && currRfNodeIds.includes(currNode.id)) {
                // currNode.data.numBwdActiveEdges += 1;
                setRfNodeData(rfi, {
                        nodeId: currNode.id,
                        path: 'numBwdActiveEdges',
                        value: 1,
                        fromOwnProps: 'data.numBwdActiveEdges',
                        combine: add
                    });

            }
        } else {
            const currNode = rfi.getNode(rfEdge.source)!;
            if (currNode !== undefined && currRfNodeIds.includes(currNode.id)) {
                // currNode.data.numFwdActiveEdges += 1;
                setRfNodeData(rfi, {
                        nodeId: currNode.id,
                        path: 'numFwdActiveEdges',
                        value: 1,
                        fromOwnProps: 'data.numFwdActiveEdges',
                        combine: add
                    });
            }
        }
    });

    if (isFwd) {
        //currRfNode!.data.numFwdActiveEdges += neighbourEdges.length;
        setRfNodeData(rfi, {
                nodeId: currRfNode.id,
                path: 'numFwdActiveEdges',
                value: neighbourEdges.length,
                fromOwnProps: 'data.numFwdActiveEdges',
                combine: add
            });
    } else {
        // currRfNode!.data.numBwdActiveEdges += neighbourEdges.length;
        setRfNodeData(rfi, {
                nodeId: currRfNode.id,
                path: 'numBwdActiveEdges',
                value: neighbourEdges.length,
                fromOwnProps: 'data.numBwdActiveEdges',
                combine: add
            });
    }

    // current workaround: auto layout in setNodes
    rfi.setEdges((eds) => {
        const byId = new Map(eds.map(edge => [edge.id, edge]));
        rfEdges.forEach(edge => { if (!byId.has(edge.id)) byId.set(edge.id, edge); });
        rfEdges = [...byId.values()];
        return rfEdges;
    });

    rfi.setNodes((nds) => {
        const newRfNodes = rfNodes;
        rfNodes = Array.from(new Set(nds.concat(rfNodes))); // existing nodes first, then the new ones
        if (!isGrouped(rfi)) {
            // the new nodes bring their own place in the layout, so nothing that is shown reorders
            return assignCoordinates(rfNodes, rfEdges, layoutDirection, {anchorId: currRfNode.id});
        }

        // grouped: the boxes have to follow their children, and a child's position is relative to its box
        const nonParentNodes = dagreLayoutRf(getNonParentNodesFromArray(rfNodes), rfEdges, layoutDirection, nodeWidth, nodeHeight);
        rfNodes = Array.from(new Set(nonParentNodes));
        rfNodes = rfNodes.map(rfNode => newRfNodes.includes(rfNode) ? assignNodeToParent(rfNode, rfi)! : rfNode);
        const parentNodes = computeParentNodePositionFromArray(rfNodes, getParentNodesFromRFI(rfi));
        rfNodes = Array.from(new Set([...rfNodes, ...parentNodes]));
        rfNodes = computeNodePositionFromParent(rfNodes, rfNodes);
        return rfNodes;
    });
}

function updateLineageGraphOnCollapse(rfi: ReactFlowInstance, props: any) {
    const { currRfNode, expandDirection, layoutDirection, grouped } = props;
    const [nodesIdsToRemove, edgesIdsToRemove] = dfsRemoveRfElems(rfi, currRfNode, expandDirection);
    rfi.setEdges((eds) => eds.filter(e => !edgesIdsToRemove.includes(e.id)));
    rfi.setNodes((nds) => {
        var rfNodes = nds.filter(n => !nodesIdsToRemove.includes(n.id));
        // taking nodes away leaves the rest where it is - there is nothing to lay out
        if (!isGrouped(rfi)) return rfNodes;

        // grouped: the boxes shrink onto what is left of their children
        var nonParentNodes = Array.from(new Set(dagreLayoutRf(getNonParentNodesFromArray(rfNodes), rfi.getEdges(), layoutDirection, nodeWidth, nodeHeight)));
        const parentNodes = computeParentNodePositionFromArray(nonParentNodes, getParentNodesFromArrayIds(rfi, nonParentNodes));
        nonParentNodes = computeNodePositionFromParent(nonParentNodes, parentNodes);
        return [...nonParentNodes, ...parentNodes];
    });
}


/*
    Functions for viewport setting
*/
export function resetViewPortCentered(rfi: ReactFlowInstance, rfNodes?: ReactFlowNode[]): void {
    const nodes = rfNodes || rfi.getNodes();
    // reset view port to the center of the lineage graph or the given node if only one provided
    assert(nodes.length > 0, "no ReactFlowNodes provided for reset viewport")
    var n: ReactFlowNode;
    if (nodes.length === 1) {
        n = rfi.getNode(nodes[0].id)!;
    } else {
        const filteredCenterNode = nodes.filter(node => node.data.graphNodeProps!['isCenterNode']);
        n = rfi.getNode(filteredCenterNode[0].id)!;
    }

    rfi.fitView({ nodes: [n as ReactFlowNode], duration: 600 });
}

// reset the view port with the center node in the center
export function resetViewPort(rfi: ReactFlowInstance, duration: number = 600): void {
    rfi.fitView({ nodes: rfi.getNodes(), duration: duration });
}

/*
    Center node in Viewport
*/
export function setCenter(rfi: ReactFlowInstance, rfNode?: ReactFlowNode): void {
    const node = rfNode || rfi.getNodes().filter(node => node.data.graphNodeProps!['isCenterNode'])[0];
    const x = node.position.x + (node.width || 0)/2
    const y = node.position.y + (node.height || 0)/2
    rfi.setCenter(x,y, {zoom: rfi.getZoom()});
}

/*
    An edge can only be drawn where both of its ends are shown.

    dfsRemoveRfElems walks the edges it removes, so an edge that reached a removed node from another
    branch stays behind - and ReactFlow draws it into empty space, as an arrow head with no node.
*/
export function dropDanglingEdges(rfi: ReactFlowInstance): void {
    const shown = new Set(rfi.getNodes().map(node => node.id));
    rfi.setEdges(edges => {
        const kept = edges.filter(edge => shown.has(edge.source) && shown.has(edge.target));
        return kept.length === edges.length ? edges : kept;
    });
}

/*
    The element the config explorer is showing, as the flow itself knows it.

    The expand handler of a node carries the flowProps of the moment the node was created, so its
    props.elementName is whatever was selected back then. Anything acting on the current selection
    has to ask the flow instead.
*/
export function selectedNodeId(rfi: ReactFlowInstance): string | undefined {
    return rfi.getNodes().find(node => node.data.isSelectedElement)?.id;
}

/*
    Highlight the element the config explorer is showing. Styling only: selecting an element must
    not move anything, so this touches neither the node set nor the positions.
*/
export function setSelectedNode(rfi: ReactFlowInstance, nodeId: string | undefined): void {
    rfi.setNodes(nodes => nodes.map(node => node.data.isSelectedElement === (node.id === nodeId)
        ? node
        : {...node, data: {...node.data, isSelectedElement: node.id === nodeId}}));
}

/*
    Bring a node into view at the current zoom, and only when it is not there already - panning to
    something the user can see would move the graph under them for nothing.
*/
export function revealNode(rfi: ReactFlowInstance, nodeId: string, duration: number = 400): void {
    const node = rfi.getNode(nodeId);
    const container = document.querySelector('.react-flow');
    if (!node || !container) return;

    const {x, y, zoom} = rfi.getViewport();
    const {width, height} = rfNodeSize(node, nodeWidth, nodeHeight);
    const position = node.positionAbsolute ?? node.position; // a child of a grouping box is placed relative to it
    const left = position.x * zoom + x;
    const top = position.y * zoom + y;
    const bounds = container.getBoundingClientRect();
    const isInView = left >= 0 && top >= 0
        && left + width * zoom <= bounds.width && top + height * zoom <= bounds.height;
    if (isInView) return;

    rfi.setCenter(position.x + width / 2, position.y + height / 2, {zoom, duration});
}

/*
    Functions for node and edge styling
*/
export function setDefaultEdgeStyles() { } // TODO
export function setDefaultNodeStyles() { }

export function resetEdgeStyles(rfi: ReactFlowInstance) {
    rfi.setEdges((edge) => {
        // a new object per edge, so that the custom edge component re-renders its metric labels
        return edge.map((e) => ({
            ...e,
            data: {...e.data, highlighted: false},
            zIndex: 0,
            style: {
                ...e.style,
                stroke: EDGE_COLOR_DEFAULT,
                strokeWidth: strokeWidthOf(e, false)
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 10,
                height: 10,
                color: EDGE_COLOR_DEFAULT,
            }
        }))
    })
}

export function resetNodeStyles(rfi: ReactFlowInstance) {
    rfi.setNodes((node) => {
        return node.map((elem) => {
            const newElem = {
                ...elem,
                zIndex: 0,
                data: {
                    ...elem.data,
                    highlighted: false,
                    tracedColumns: undefined,
                    tracedConnections: undefined,
                }
            }
            return newElem;
        })
    })
}

export function setNodeStyles(rfi: ReactFlowInstance, nodeIds: string[]) {
    // set node styles based on the given nodeIds
    rfi.setNodes((n) => {
        return n.map((elem) => {
            if (nodeIds.includes(elem.id)) {
                const newElem = {
                    ...elem,
                    data: {
                        ...elem.data,
                        highlighted: true
                    }
                }
                return newElem;
            }
            return elem;
        })
    })
}

export function setEdgeStyles() { } // TODO

export function setNodeStylesOnEdgeClick(rfi: ReactFlowInstance, edge: SelectableEdge) {
    rfi.setNodes((n) => {
        return n.map((elem) => {
            if (edge.source === elem.id || edge.target === elem.id) {
                const newElem = {
                    ...elem,
                    zIndex: SELECTED_ELEMENT_Z_INDEX,
                    data: {
                        ...elem.data,
                        highlighted: true
                    }
                }
                return newElem;
            }
            return elem;
        })
    })
}

export function setEdgeStylesOnEdgeClick(rfi: ReactFlowInstance, edge: SelectableEdge) {
    rfi.setEdges((e) => {
        return e.map((elem) => {
            if (elem.id !== edge.id) return elem;
            // a new object, so that the custom edge component re-renders its metric labels highlighted
            return {
                ...elem,
                data: {...elem.data, highlighted: true},
                zIndex: SELECTED_ELEMENT_Z_INDEX,
                style: {
                    ...elem.style,
                    stroke: EDGE_COLOR_HIGHLIGHTED,
                    strokeWidth: strokeWidthOf(elem, true),
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 10,
                    height: 10,
                    color: EDGE_COLOR_HIGHLIGHTED,
                }
            }
        })
    });
}

/**
 * Everything an edge needs to identify for being selected. The metric labels of an edge are rendered
 * outside of its SVG group, so they select the edge themselves and only know these attributes.
 */
export type SelectableEdge = {id: string, source: string, target: string};

/** Select one edge: highlight it, the nodes it connects and its metric labels, and nothing else */
export function selectEdge(rfi: ReactFlowInstance, edge: SelectableEdge) {
    traceState.trace = undefined; // selecting an edge replaces a column trace
    resetEdgeStyles(rfi);
    resetNodeStyles(rfi);
    setNodeStylesOnEdgeClick(rfi, edge);
    setEdgeStylesOnEdgeClick(rfi, edge);
}


/*
    Functions for Grouping / Retrieval
    These should be done on the DAGraph instance only, to separete computation from rendering the ReactFlowInstance

    - A grouping function can be abstracted as follows:

    function groupBy(args){
        const groupingFunction = ...
        groupingRoutine(groupingFuntion, args)
    }

    optionally, the grouper takes as input a Tagger function and its arguments to create custom group names.
*/
function getGraphNodeElementsByConnectedComponent(G: DAGraph, F: (g: DAGraph, fargs: any) => GraphNode[], args: any) {
    // a generic grouping function interface that retrieves the elements from G via a getter fuction F
    // returns the connected components 
    const elems = F(G, args);
    const components: Map<string, GraphNode[]> = G.getConnectedNodeComponents(graphNodeElementsToId(elems) as string[], G);
    return components;
}

function getGraphNodeElementsBySubgroups(G: DAGraph, F: (node: GraphNode, fargs: any) => any, args: any,
    Tagger?: (result: any, targs: any) => string, taggerArgs?: any) {
    const subgroups: Map<string, GraphNode[]> = G.getSubgroups(F, args, Tagger, taggerArgs);
    return subgroups;
}

function graphNodeElementsToId(elements: GraphNode[]): string[] {
    return elements.map(node => node.id);
}

function getRfElementsfromDAGElements(elements: GraphNode[], rfi: ReactFlowInstance): ReactFlowNode[] {
    // maps retrieved elements to currently shown reactFlow elements
    // can also be done in the components computation
    const graphElemIds = graphNodeElementsToId(elements);
    return rfi.getNodes().filter(n => graphElemIds.includes(n.id));
}

export function getParentNodesFromRFI(rfi: ReactFlowInstance) {
    return rfi.getNodes().filter(node => node.type === 'group');
}

export function getParentNodesFromArray(rfNodes: ReactFlowNode[]) {
    return rfNodes.filter(node => node.type === 'group');
}

export function getNonParentNodesFromRFI(rfi: ReactFlowInstance) {
    return rfi.getNodes().filter(node => node.type !== 'group');
}

export function getNonParentNodesFromArray(rfNodes: ReactFlowNode[]) {
    return rfNodes.filter(node => node.type !== 'group');
}

export function getFreeNodesFromRFI(rfi: ReactFlowInstance) {
    return rfi.getNodes().filter(node => node.type !== 'group' && node.parentId === undefined);
}

export function getFreeNodesFromArray(rfNodes: ReactFlowNode[]) {
    return rfNodes.filter(node => node.type !== 'group' && node.parentId === undefined);
}

export function getParentNodeIds(rfNodes: ReactFlowNode[]) {
    // returns an array of distinct parent node ids from the given array
    // filter out undefined
    return Array.from(new Set(rfNodes.map(rfNode => rfNode.parentId).filter(e => e)));
}

export function getParentNodesFromArrayIds(rfi: ReactFlowInstance, rfNodes: ReactFlowNode[]) {
    // return the array of distinct parent nodes of the given array rfNodes 
    const ids = getParentNodeIds(rfNodes);
    return getParentNodesFromRFI(rfi).filter(node => ids.includes(node.id));
}

export function getParentNodeFromRFI(rfi: ReactFlowInstance, parentId: string): ReactFlowNode | undefined {
    // assume now that no parent nodes overlap
    return getParentNodesFromRFI(rfi).filter(node => node.id === parentId)[0]
}

export function getParentNodeFromArray(parentNodes: ReactFlowNode[], parentId: string) {
    // assume now that no parent nodes overlap
    return parentNodes.filter(node => node.id === parentId)[0]
}

function computeParentNodeCoordsFromChildren(rfElements: ReactFlowNode[]) {
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    // the far corner is taken from each child's own size - a node showing its columns is taller
    // than the default, and the box would clip it
    rfElements.forEach(elem => {
        const {width, height} = rfNodeSize(elem, RF_NODE_WIDTH_CUSTOM, RF_NODE_HEIGHT_CUSTOM);
        xMin = Math.min(xMin, elem.position.x);
        xMax = Math.max(xMax, elem.position.x + width);
        yMin = Math.min(yMin, elem.position.y);
        yMax = Math.max(yMax, elem.position.y + height);
    });

    // Adjust by the border size B. (x, y) position is the upper left corner
    xMin -= SUBFLOW_BORDER_SIZE;
    xMax += SUBFLOW_BORDER_SIZE;
    yMin -= SUBFLOW_BORDER_SIZE;
    yMax += SUBFLOW_BORDER_SIZE;

    const centerX = (xMin + xMax) / 2;
    const centerY = (yMin + yMax) / 2;

    return { xMin: xMin, yMin: yMin, xMax: xMax, yMax: yMax, centerX: centerX, centerY: centerY };
}

export function computeChildNodeRelativePosition(childNode: ReactFlowNode, parentNode: ReactFlowNode) {
    // used to update child nodes' relative positions, assuming they have been created already.
    // note that a child node always has a positionAbsolute prop by implementation, but not necessarily a position prop
    return {
        x: childNode.position.x - parentNode.position.x,
        y: childNode.position.y - parentNode.position.y
    }
}

function computeParentNodePositionFromRFI(rfi: ReactFlowInstance): ReactFlowNode[] {
    // returns the parent nodes whose positions are computed from their children 
    // this is inefficient, we should pass component information to rfi props and get them directly 
    // could be replaced / adapted by a mapGroupStateToRFI() function
    const rfNodes = rfi.getNodes();
    var parentNodes = getParentNodesFromArray(rfNodes);
    parentNodes = parentNodes.map(parentNode => {
        const children = rfNodes.filter(rfNode => rfNode.parentId === parentNode.id);
        const coords = computeParentNodeCoordsFromChildren(children);
        const parentNodeWidth = coords.xMax - coords.xMin;
        const parentNodeHeight = coords.yMax - coords.yMin;
        const initPosition = { x: coords.xMin, y: coords.yMin };
        parentNode = {
            ...parentNode,
            data: { ...parentNode.data, initPosition: initPosition },
            position: initPosition,
            zIndex: -1,
            style: { ...parentNode.style, width: parentNodeWidth, height: parentNodeHeight },
        }
        return parentNode;
    });
    return parentNodes;
}

export function computeParentNodePositionFromArray(rfNodes: ReactFlowNode[], parentNodes: ReactFlowNode[]): ReactFlowNode[] {
    // same as computeParentNodePositionFromRFI, except that the parentNodes are not get from the rfi, but from the provided argument parentNodes
    // as we do not necessarily want to recompute all parent node positions
    // rfNodes is the array of nodes we compute the parents' position from
    parentNodes = parentNodes.map(parentNode => {
        const children = rfNodes.filter(rfNode => rfNode.parentId === parentNode.id);
        const coords = computeParentNodeCoordsFromChildren(children);
        const parentNodeWidth = coords.xMax - coords.xMin;
        const parentNodeHeight = coords.yMax - coords.yMin;
        const initPosition = { x: coords.xMin, y: coords.yMin };
        parentNode = {
            ...parentNode,
            data: { ...parentNode.data, initPosition: initPosition },
            position: initPosition,
            zIndex: -1,
            style: { ...parentNode.style, width: parentNodeWidth, height: parentNodeHeight },
        }
        return parentNode;
    });
    return parentNodes;
}

export function computeNodePositionFromParent(nonParentNodes: ReactFlowNode[], parentNodes: ReactFlowNode[]) {
    nonParentNodes = nonParentNodes.map(rfNode => {
        if (rfNode.parentId !== undefined) {
            const parentNode = getParentNodeFromArray(parentNodes, rfNode.parentId!);
            rfNode = {
                ...rfNode,
                position: computeChildNodeRelativePosition(rfNode, parentNode!),
            }
        }
        return rfNode;
    }
    );
    return nonParentNodes;
}

// TODO: adapt this
function assignNodeToParent(rfNode: ReactFlowNode, rfi: ReactFlowInstance) {
    // get parentId of the node and assign it to the respective parent component, return the updated note
    // if the parent does not yet exist in the flow, create it. Otherwise, the unmodified node is returned
    // note that we don't recompute the child's position here as parent node's position has not been fixed yet
    const { components, componentsRf, subgroups, subgroupsRf } = groupingState;
    if ((!components || !componentsRf) && (!subgroups || !subgroupsRf)) { return rfNode }

    // TODO: adapt logic to subgroups here
    const parentId = findFirstKeyWithObject(components!, rfNode.id, (a) => (a.map(elem => (elem as GraphNode).id)));
    if (parentId === undefined) { return rfNode }

    if (getParentNodeFromRFI(rfi, parentId) === undefined) {
        const coords = computeParentNodeCoordsFromChildren([rfNode]); // rfNode is the first child that appears
        const parentNodeWidth = coords.xMax - coords.xMin;
        const parentNodeHeight = coords.yMax - coords.yMin;
        const initPosition = { x: coords.xMin, y: coords.yMin };
        const parentNode = {
            id: parentId,
            data: { label: parentId, initPosition: initPosition },
            position: initPosition,
            style: { backgroundColor: PARENT_NODE_COLOR_DEFAULT, width: parentNodeWidth, height: parentNodeHeight },
            type: 'group',
            zIndex: -1
        } as ReactFlowNode;
        rfi.addNodes(parentNode);
    }

    const updatedRfNode = {
        ...rfNode,
        parentId: parentId,
        extent: 'parent',
        expandParent: true,
    } as ReactFlowNode;
    // FIXME: this pushes a ReactFlow node into the map of graph nodes. It only ever compiled because the
    // grouping state was read from the redux store as 'any' - kept as is to not change behaviour.
    (components!.get(parentId)! as any[]).push(updatedRfNode);
    rfNode = updatedRfNode;

    return rfNode;
}

// TODO: refactor into one function to govern mapping from custom graph to reactflow graph
export function createParentNodesFromComponentsByGroup(rfi: ReactFlowInstance, layoutDirection: LayoutDirection) {
    const componentsRf = groupingState.subgroupsRf;
    const rfNodeIds = rfi.getNodes().map(node => node.id);
    assert(componentsRf !== undefined, "subgroups should not be undefined!");

    const isHorizontal = layoutDirection === 'LR';
    const targetPos = isHorizontal ? Position.Left : Position.Top;
    const sourcePos = isHorizontal ? Position.Right : Position.Bottom;

    // assume for now that every node has at most 1 parent
    // create a new graph where all nodes belonging to a group are replaced by one single parent node
    const groupedNodeIds: string[] = [];        // ids of nodes to remove
    const parentNodes: ReactFlowNode[] = [];    // parent nodes to keep 
    const edgesToParent: ReactFlowEdge[] = [];  // edges to parent nodes to keep
    const edgesToChildrenIds: string[] = [];    // ids of edges to remove

    componentsRf.forEach((v, k) => {
        if (v.length > 0) {
            // TODO: the following can be refactored
            const groupId = k;
            const initPosition = { x: 0, y: 0 };

            const parentNode = {
                id: groupId,
                data: { label: groupId, initPosition: initPosition, children: v.map(rfNode => rfNode.id) },
                position: initPosition,
                sourcePosition: sourcePos,
                targetPosition: targetPos,
                style: { backgroundColor: PARENT_NODE_COLOR_DEFAULT, width: RF_NODE_WIDTH_CUSTOM, height: RF_NODE_HEIGHT_CUSTOM },
                // type: 'group',
            } as ReactFlowNode;

            if (rfNodeIds.includes(groupId)) {
                throw Error(`parent node with id ${groupId} already exists!`);
            }

            // remove children and keep parent
            parentNodes.push(parentNode);
        }
    });

    const edgeIdSet = new Set<string>();// keep track of exisiting edge ids
    componentsRf.forEach((v, k) => {
        if (v.length > 0) {
            const groupId = k;
            v.forEach(rfNode => {
                // reroute all edges to children to the new parent node
                groupedNodeIds.push(rfNode.id);
                const rfEdges = rfi.getEdges().filter(rfEdge => rfEdge.source === rfNode.id || rfEdge.target === rfNode.id);
                rfEdges.forEach(rfEdge => {
                    edgesToChildrenIds.push(rfEdge.id);
                    const isOutgoing = rfEdge.source === rfNode.id;
                    const otherChildNodeId = isOutgoing ? rfEdge.target : rfEdge.source;
                    const otherParentNode = parentNodes.find(parentNode => (parentNode.data.children! as [string]).includes(otherChildNodeId));
                    const otherId = otherParentNode ? otherParentNode.id : rfEdge.id;
                    const newEdgeId = isOutgoing ? `${groupId}===${otherId}` : `${otherId}===${groupId}`;
                    if (!edgeIdSet.has(newEdgeId) && otherId !== groupId) { // find if rfEdge end is within a different parent
                        edgeIdSet.add(newEdgeId);
                        edgesToParent.push({ // if rfEdge comes from a node in another parent component, only one edge is kept
                            type: 'customEdge',
                            id: newEdgeId,
                            source: isOutgoing ? groupId : otherId,
                            target: isOutgoing ? otherId : groupId,
                            markerEnd: {
                                type: MarkerType.ArrowClosed,
                                width: 10,
                                height: 10,
                                color: EDGE_COLOR_DEFAULT,
                            },
                            labelBgPadding: [7, 7],
                            labelBgBorderRadius: 8,
                            labelBgStyle: { fill: '#fff', fillOpacity: 0.75, stroke: LABEL_COLOR },
                            style: { stroke: EDGE_COLOR_DEFAULT, strokeWidth: EDGE_STROKE_WIDTH_DEFAULT },
                        } as ReactFlowEdge);
                    }

                });
            });
        }
    })

    const newNodes = [...rfi.getNodes().filter(node => !groupedNodeIds.includes(node.id)), ...parentNodes];
    const newEdges = [...rfi.getEdges().filter(edge => !edgesToChildrenIds.includes(edge.id)), ...edgesToParent]
    rfi.setNodes(dagreLayoutRf(newNodes, newEdges, layoutDirection, RF_NODE_WIDTH_CUSTOM, RF_NODE_HEIGHT_CUSTOM));
    rfi.setEdges(newEdges);
}

export function createParentNodesFromComponents(rfi: ReactFlowInstance) {
    // creates initial parent nodes from the grouped component
    const componentsRf = groupingState.componentsRf;
    const rfNodeIds = rfi.getNodes().map(node => node.id);
    assert(componentsRf !== undefined, "connected components should not be undefined!");

    componentsRf.forEach((v, k) => {
        if (v.length > 0) {
            const groupId = k; // group nodes have to be in front of the children in the sorted rfNode array
            const coords = computeParentNodeCoordsFromChildren(v);
            const parentNodeWidth = coords.xMax - coords.xMin;
            const parentNodeHeight = coords.yMax - coords.yMin;
            const initPosition = { x: coords.xMin, y: coords.yMin };

            const groupedNode = {
                id: groupId,
                data: { label: groupId, initPosition: initPosition },
                position: initPosition,
                style: { backgroundColor: PARENT_NODE_COLOR_DEFAULT, width: parentNodeWidth, height: parentNodeHeight },
                type: 'group',
            } as ReactFlowNode;

            if (!rfNodeIds.includes(groupId)) {
                rfi.addNodes(groupedNode);
            } else {
                throw Error(`parent node with id ${groupId} already exists!`);
            }

            //map rfElements to parent nodes
            const idsInComponent = v.map(n => n.id);
            rfi.setNodes(rfNodes => {
                return rfNodes.map(rfNode => {
                    if (idsInComponent.includes(rfNode.id)) {
                        rfNode = {
                            ...rfNode,
                            parentId: groupId,
                            extent: 'parent',
                            expandParent: true,
                            position: computeChildNodeRelativePosition(rfNode, groupedNode),
                        }
                    }
                    return rfNode;
                });
            });
        }
    });
}

export function prioritizeParentNodes(rfi: ReactFlowInstance) {
    // needed for subflow, see:
    // https://github.com/xyflow/xyflow/issues/3041 

    const sortNodes = (a: ReactFlowNode, b: ReactFlowNode): number => {
        // break ties
        if (a.parentId === b.parentId) {
            return -1;
        }

        // not all nodes have a parent node
        if (a.parentId === undefined && b.parentId !== undefined) {
            return -1;
        } else if (a.parentId !== undefined && b.parentId === undefined) {
            return 1;
        } else {
            return a.parentId! > b.parentId! ? 1 : -1;
        }
    };
    rfi.setNodes(nodes => nodes.sort(sortNodes));
}

function highlightRoutine(G: DAGraph, F: (graph: DAGraph, fargs: any) => GraphNode[], args: any, rfi: ReactFlowInstance) {
    /*
        Compute the components based on the retrieved results / aggregation 
    */
    const components = getGraphNodeElementsByConnectedComponent(G, F, args) as Map<string, GraphNode[]>;

    /*
        Update ReactFlow Instance
    */
    const ids: string[] = Array.from(components.values()).flatMap((nodes) => nodes.map(node => node.id));
    setNodeStyles(rfi, ids);
}

function groupingRoutineBySubgroup(G: DAGraph, rfi: ReactFlowInstance, layoutDirection: LayoutDirection,
    F: (node: GraphNode, fargs: any) => any, groupingArgs: any,
    Tagger?: (result: any, targs: any) => string, taggerArgs?: any,) {
    /*
        Compute the components based on the retrieved results / aggregation and map them to ReactFlow elements

        Parent nodes have to be in front of all other nodes in the sorted rfNode array, hence the tagger has to produce
        a group name with a unique identifier that guarantees this order (e.g. by prepending a '#').
        This is handled in Graphs.ts
    */
    const subgroups = getGraphNodeElementsBySubgroups(G, F, groupingArgs, Tagger, taggerArgs) as Map<string, GraphNode[]>;
    const subgroupsRf: Map<string, ReactFlowNode[]> = new Map();
    subgroups.forEach((v, k) => { subgroupsRf.set(k, getRfElementsfromDAGElements(v, rfi)); })

    /*
        Update ReactFlow Instance
    */
    groupingState.subgroups = subgroups;
    groupingState.subgroupsRf = subgroupsRf;
    createParentNodesFromComponentsByGroup(rfi, layoutDirection);

    prioritizeParentNodes(rfi);
}

const groupingRoutine = (G: DAGraph, rfi: ReactFlowInstance,
    F: (graph: DAGraph, fargs: any) => GraphNode[], args: any,
    Tagger?: (targs: any) => string, taggerArgs?: any) => {
    /*
        Compute the components based on the retrieved results / aggregation and map them to ReactFlow elements
    */
    const components = getGraphNodeElementsByConnectedComponent(G, F, args) as Map<string, GraphNode[]>;
    const componentsRf: Map<string, ReactFlowNode[]> = new Map();
    components.forEach((v, k) => { componentsRf.set(k, getRfElementsfromDAGElements(v, rfi)); }
    );
    /*
        Update ReactFlow Instance
    */
    groupingState.components = components;
    groupingState.componentsRf = componentsRf;
    createParentNodesFromComponents(rfi);

    // recompute layout in favor of the parent nodes and adjust the children in each parent node
    // rfi.setNodes(computeLayout(rfi.getNodes().filter(node => !(node.extent === 'parent')), // includes all parent nodes and non grouped nodes
    //                            rfi.getEdges(), 
    //                            args.layoutDirection));
    // TODO: for each component, shift the children nodes by the origin of the parent node to get the relative coords and recompute layout (is the recompute guarenteed to stay in the parent node's frame?)
    // This works only if we have created and merged the new edges as well?
    // computeChildeNodeRelativePosition()

    // extra step to sort the reactFlow children nodes, as required by the current ReactFlow implementation...
    prioritizeParentNodes(rfi);
}


export function restoreGroupSettings(rfi: ReactFlowInstance) {
    // remove all parent nodes and reset child node props (TODO: remove edges after we incorporate collapse/expand on nodes)
    // the order matters
    rfi.setNodes(nodes => nodes.map(node => {
        node = {
            ...node,
            parentId: undefined,
            extent: undefined,
            expandParent: false,
            position: node.position,
        }
        return node;
    }));
    rfi.setNodes(nodes => nodes.filter(node => !(node.type === 'group')));
    groupingState.components = undefined;
    groupingState.componentsRf = undefined;
}

export function restoreGroupSettingsBySubgroup(rfi: ReactFlowInstance, lineageState: lineageGraphState) {
    // restore the flow state to the state in configData
    const { graphView, props, layout, isExpanded, layoutMode } = lineageState;

    groupingState.subgroups = undefined;
    groupingState.subgroupsRf = undefined;

    const graph: DAGraph = getGraph(props, graphView);
    const [nodes, edges] = props.graph ? prepareGraphComplete(rfi, graph, graphView, props, layout)
                                       : prepareGraphDirect(rfi, graph, graphView, props, layout, isExpanded, layoutMode);
    rfi.setNodes(nodes);
    rfi.setEdges(edges);
}

export function highlightBySubstring(rfi: ReactFlowInstance, G: DAGraph, args: string) {
    // required args: substring
    const F = (graph: DAGraph, fargs: any) => {
        return graph.nodes.filter(node => (node as DataOrActionObject).data.id.includes(fargs.substring));
    }
    highlightRoutine(G, F, args, rfi);
}

export function groupBySubstring(rfi: ReactFlowInstance, G: DAGraph, args: any) {
    // required args: substring
    const F = (graph: DAGraph, fargs: any) => {
        return graph.nodes.filter(node => (node as DataOrActionObject).data.id.includes(fargs.substring));
    }
    groupingRoutine(G, rfi, F, args);
}

export function groupByFeedName(rfi: ReactFlowInstance, G: DAGraph, args: any) {
    // required args: feedName
    const F = (graph: DAGraph, fargs: any) => {
        return graph.nodes.filter(node => (node as ActionObject).jsonObject.metadata?.feed === fargs.feedName);
    }
    groupingRoutine(G, rfi, F, args);
}

// TODO: merge this with groupBYFeed
export function groupByFeed(rfi: ReactFlowInstance, G: DAGraph, layoutDirection: LayoutDirection) {
    // Returns the feed of the (action) object
    const F = (node: GraphNode, _: any) => {
        return (node as ActionObject).jsonObject.metadata?.feed;
    }
    const Tagger = (result, _) => result;
    groupingRoutineBySubgroup(G, rfi, layoutDirection, F, undefined, Tagger, undefined);
}

export function groupByObjectType(rfi: ReactFlowInstance, G: DAGraph, args: any) {
    // required args: objectType
    const F = (graph: DAGraph, fargs: any) => {
        return graph.nodes.filter(node => (node as DataOrActionObject).jsonObject.type === fargs.objectType);
    }
    groupingRoutine(G, rfi, F, args);
}

export function groupByTableName(rfi: ReactFlowInstance, G: DAGraph, args: any) {
    // required args: tableName
    const F = (graph: DAGraph, fargs: any) => {
        return graph.nodes.filter(node => (node as DataObject).jsonObject.table.name === fargs.objectType);
    }
    groupingRoutine(G, rfi, F, args);
}

export function groupByConnectionId(rfi: ReactFlowInstance, G: DAGraph, args: any) {
    // required args: connectionId
    const F = (graph: DAGraph, fargs: any) => {
        return graph.nodes.filter(node => (node as DataObject).jsonObject.connectionId === fargs.connectionId);
    }
    groupingRoutine(G, rfi, F, args);
}

/*
    Remember that the user moved nodes by hand, as the distance they were dragged. Laying out again
    then keeps the displacement instead of snapping them back to where the layout puts them.
*/
export function recordManualMoves(rfi: ReactFlowInstance, moves: Map<string, {x: number, y: number}>): void {
    rfi.setNodes(nodes => nodes.map(node => {
        const move = moves.get(node.id);
        if (!move || (move.x === 0 && move.y === 0)) return node;
        const offset = node.data.manualOffset ?? {x: 0, y: 0};
        return {...node, data: {...node.data, manualOffset: {x: offset.x + move.x, y: offset.y + move.y}}};
    }));
}

/* Forget every manual move - the toolbar's way back to the layout as it is computed. */
export function clearManualMoves(rfi: ReactFlowInstance): void {
    rfi.setNodes(nodes => nodes.map(node => node.data.manualOffset === undefined
        ? node
        : {...node, data: {...node.data, manualOffset: undefined}}));
}

/* Whether the flow currently holds grouping boxes, which own their children's coordinates. */
export function isGrouped(rfi: ReactFlowInstance): boolean {
    return getParentNodesFromRFI(rfi).length > 0;
}

/*
    Lay out once for a burst of changes.

    Several nodes' exported schemas can arrive within the same tick, and each of them changes the
    height of its node. Laying out per arrival would let the user watch the nodes move N times.
*/
let pendingRelayout: ReturnType<typeof setTimeout> | undefined;

export function scheduleRelayout(rfi: ReactFlowInstance, layoutDirection: LayoutDirection, anchorId?: string) {
    if (pendingRelayout) clearTimeout(pendingRelayout);
    pendingRelayout = setTimeout(() => {
        pendingRelayout = undefined;
        recomputeLayout(rfi, layoutDirection, anchorId);
    }, 0);
}

/*
    Re-space the current content of the ReactFlow instance: the ranks and the order within them are
    what the nodes carry, so only the gaps change. Used by the toolbar button and whenever a node
    changes size, e.g. when it starts or stops showing its columns.

    anchorId names the node that must not move - the one the user just acted on. Without it the
    result is anchored on the center node, so that a change nobody asked for does not shift the view.
*/
/* Lay out the nodes shown again from scratch: every node closed, and none where the user has moved it. */
export function resetLayout(rfi: ReactFlowInstance, layoutDirection: LayoutDirection) {
    closeAllColumns(rfi);
    clearManualMoves(rfi);
    recomputeLayout(rfi, layoutDirection);
}

function closeAllColumns(rfi: ReactFlowInstance): void {
    columnDisplays.clear();
    rfi.setNodes(nodes => nodes.map(node => (node.data?.columnDisplay ?? 'none') === 'none'
        ? node
        : {...node, data: {...node.data, columnDisplay: 'none'},
           style: {...node.style, ...nodeSizeFor({...node.data, columnDisplay: 'none'})}}));
    // the column handles are gone with the columns, so the edges go back onto the nodes
    updateColumnEdges(rfi);
}

export function recomputeLayout(rfi: ReactFlowInstance, layoutDirection: LayoutDirection, anchorId?: string) {
    const rfNodes = rfi.getNodes();
    const anchor = anchorId ?? rfNodes.find(node => node.data?.graphNodeProps?.isCenterNode)?.id;

    if (!isGrouped(rfi)) {
        rfi.setNodes(assignCoordinates(rfNodes, rfi.getEdges(), layoutDirection, {anchorId: anchor}));
        return;
    }

    // grouped: the boxes have to keep surrounding their children, whose coordinates are relative to them
    const nonParentNodes = getNonParentNodesFromArray(rfNodes);
    const parentNodes = getParentNodesFromArray(rfNodes);
    var layoutedNonParentNodes = dagreLayoutRf(nonParentNodes, rfi.getEdges(), layoutDirection, nodeWidth, nodeHeight);
    var layoutedParentNodes = computeParentNodePositionFromArray(layoutedNonParentNodes, parentNodes);
    layoutedNonParentNodes = computeNodePositionFromParent(layoutedNonParentNodes, layoutedParentNodes);

    rfi.setNodes([...layoutedNonParentNodes, ...layoutedParentNodes]);
    prioritizeParentNodes(rfi);
}
