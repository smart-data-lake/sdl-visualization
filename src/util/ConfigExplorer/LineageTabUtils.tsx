import reactFlow, {
    MarkerType, Position,
    Edge as ReactFlowEdge,
    ReactFlowInstance,
    Node as ReactFlowNode,
} from 'reactflow';

import assert from 'assert';

import { DAGraph, dagreLayoutRf as computeLayout, Edge as GraphEdge, Node as GraphNode, NodeType, PartialDataObjectsAndActions, dfsRemoveRfElems, Edge, ActionObject, DataObject } from './Graphs';
import { ConfigData } from './ConfigData';
import { deepClone, findFirstKeyWithObject, getPropertyByPath } from '../helpers';
import  store  from '../../app/store'
import { setGroupedComponents, setGroupedComponentsRf, setRFINodeData } from './slice/LineageTab/Common/ReactFlowSlice';


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
const EDGE_STROKE_WIDTH_DEFAULT = 3
const EDGE_STROKE_WIDTH_HIGHLIGHTED = 5;


/*
    Types and Interfaces
*/
export type LayoutDirection = 'TB' | 'LR';
export type ExpandDirection = 'forward' | 'backward';
export type GraphView = 'full' | 'data' | 'action';
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
    runContext?: boolean;
}

export interface graphNodeProps {
    isSink: boolean,
    isSource: boolean,
    isCenterNode: boolean,
    // isCenterNodeDirectFwdNeighbour: boolean,
    // isCenterNodeDirectBwdNeighbour: boolean,
    isCenterNodeDescendant: boolean,
    isCenterNodeAncestor: boolean
}

export interface reactFlowNodeProps {
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
    highlighted: boolean,
    numFwdActiveEdges: number,
    numBwdActiveEdges: number,
    numFwdEdges: number, // not used for now, but might be helpful
    numBwdEdges: number
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
        default: {
            throw Error("Unknown graph view " + graphView);
        }
    }
    return graph;
}


export function createReactFlowNodes(selectedNodes: GraphNode[],
    layoutDirection: LayoutDirection,
    isGraphFullyExpanded: boolean,
    isExpandedNode: boolean,          // The selectedNodes are the newly expanded neighbours of a node
    expandDirection: ExpandDirection | undefined,
    graphView: GraphView,
    expandNodeFunc: (id: string, isExpanded: boolean, direction: ExpandDirection, graphView: GraphView, layout: LayoutDirection) => void,
    props: flowProps
): ReactFlowNode[] {
    const dataObjectsAndActions = graphView === 'action' ? props.configData?.actionGraph! :
        graphView === 'data' ? props.configData?.dataGraph! :
            props.configData?.fullGraph!;
    const isHorizontal = layoutDirection === 'LR';

    const centerNode = dataObjectsAndActions.getNodeById(dataObjectsAndActions.centerNodeId)!;
    const targetPos = isHorizontal ? Position.Left : Position.Top;
    const sourcePos = isHorizontal ? Position.Right : Position.Bottom;
    const sinkNodes = dataObjectsAndActions.getSinkNodes();
    const sourceNodes = dataObjectsAndActions.getSourceNodes();
    const [fwdNodes, fwdEdges] = dataObjectsAndActions.getDirectDescendants(centerNode, "all") as [GraphNode[], GraphEdge[]];
    const [bwdNodes, bwdEdges] = dataObjectsAndActions.getDirectAncestors(centerNode, "all") as [GraphNode[], GraphEdge[]];
    const [centerNodeDirectFwdNodes,] = dataObjectsAndActions.getOutElems(centerNode.id);
    const [centerNodeDirectBwdNodes,] = dataObjectsAndActions.getInElems(centerNode.id);
    const [reachableNodes, reachableEdges] = [[...fwdNodes, ...bwdNodes], [...fwdEdges, ...bwdEdges]];
    const reachableSubGraph = new PartialDataObjectsAndActions(reachableNodes, reachableEdges, layoutDirection);

    // If we need more information to be displayed on the node, 
    // just add more fields to the flowProps interface and access it in the custom node component.
    // The additional props can be passed in ElementDetails where the LineageTab is opened.
    var result: ReactFlowNode[] = [];
    selectedNodes.forEach((node) => {
        const nodeType = node.nodeType;
        const [currNodeDirectFwdNodes,] = reachableSubGraph.getOutElems(node.id); // instead of dataObjectsAndActions
        const [currNodeDirectBwdNodes,] = reachableSubGraph.getInElems(node.id);

        const isCenterNode = node.isCenterNode;
        const isSink = sinkNodes.includes(node);
        const isSource = sourceNodes.includes(node);
        const isCenterNodeDirectFwdNeighbour = centerNodeDirectFwdNodes.includes(node);
        const isCenterNodeDirectBwdNeighbour = centerNodeDirectBwdNodes.includes(node);
        const isCenterNodeDescendant = fwdNodes.includes(node);
        const isCenterNodeAncestor = bwdNodes.includes(node);

        const data: reactFlowNodeProps = {
            props: props.configData![props.elementType][props.elementName],
            label: node.id,
            nodeType: nodeType,
            targetPosition: targetPos,
            sourcePosition: sourcePos,
            isGraphFullyExpanded: isGraphFullyExpanded,
            layoutDirection: layoutDirection,
            graphView: graphView,
            expandNodeFunc: expandNodeFunc,
            graphNodeProps: {
                isCenterNode: isCenterNode,
                isSink: isSink,
                isSource: isSource,
                // isCenterNodeDirectFwdNeighbour: isCenterNodeDirectFwdNeighbour,
                // isCenterNodeDirectBwdNeighbour: isCenterNodeDirectBwdNeighbour,
                isCenterNodeDescendant: isCenterNodeDescendant,
                isCenterNodeAncestor: isCenterNodeAncestor,
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
            highlighted: false // set by handlers in Core
        }

        const newNode = {
            id: node.id,
            type: 'customDataNode',   // should match the name defined in custom node types
            positionAbsolute: { x: node.position.x, y: node.position.y },
            position: { x: node.position.x, y: node.position.y },
            targetPosition: targetPos, // required for the node positions to actually change internally
            sourcePosition: sourcePos,
            data: data,
            extent: undefined,
            parentId: undefined
        } as ReactFlowNode

        result.push(newNode);
    });
    return result;
}

export function createReactFlowEdges(selectedEdges: GraphEdge[],
    props: flowProps,
    graphView: GraphView,
    selectedEdgeId: string | undefined): ReactFlowEdge[] {
    const dataObjectsAndActions = graphView === 'action' ? props.configData?.actionGraph! :
        graphView === 'data' ? props.configData?.dataGraph! :
            props.configData?.fullGraph!;
    const edges = dataObjectsAndActions.edges?.filter(edge => selectedEdges.includes(edge));
    const edgeColor = selectedEdgeId ? EDGE_COLOR_HIGHLIGHTED : EDGE_COLOR_DEFAULT;

    var result: ReactFlowEdge[] = [];
    edges.forEach(edge => {
        assert(!(edge.toNode.id === undefined || edge.fromNode.id === undefined), "Edge has no source or target")
        const selected = selectedEdgeId === edge.id;
        const uniqueId = edge.id;
        const fromNodeId = edge.fromNode.id;
        const toNodeId = edge.toNode.id;

        const newEdge = {
            type: 'customEdge',
            id: uniqueId, // has to be unique, linked to node ids
            source: fromNodeId,
            target: toNodeId,
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 10,
                height: 10,
                color: edgeColor,
            },
            labelBgPadding: [7, 7],
            labelBgBorderRadius: 8,
            labelBgStyle: { fill: selected ? LABEL_COLOR : '#fff', fillOpacity: selected ? 1 : 0.75, stroke: LABEL_COLOR },
            style: { stroke: edgeColor, strokeWidth: EDGE_STROKE_WIDTH_DEFAULT },
        } as ReactFlowEdge;
        result.push(newEdge);
    });

    return result;
}

// TODO: adapt this
export function recreateReactFlowNodesOnLayout() {
    const rfi = store.getState()['reactFlow']['rfi'];
    var rfNodes = rfi.getNodes();
    const rfEdges = rfi.getEdges();
    const layoutDirection = store.getState()['layoutSelector']['layout']
    rfNodes = computeLayout(rfNodes, rfEdges, layoutDirection);

    const isHorizontal = layoutDirection === 'LR';
    const targetPos = isHorizontal ? Position.Left : Position.Top;
    const sourcePos = isHorizontal ? Position.Right : Position.Bottom;
    var newNodes: ReactFlowNode[] = [];

    rfNodes.forEach(rfNode => {
        const newNode = {
            ...rfNode,
            targetPosition: targetPos,
            sourcePosition: sourcePos
        } as ReactFlowNode;
        newNodes.push(newNode);
    })

    return [newNodes, rfEdges];
}

/*
    Functions for expand/collapse
*/
export function updateLineageGraphOnExapnd(rfi: ReactFlowInstance, rfEdges: ReactFlowEdge[], rfNodes: ReactFlowNode[], props: any) {
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
                store.dispatch(setRFINodeData(
                    {
                        nodeId: currNode.id,
                        path: 'numBwdActiveEdges',
                        value: 1,
                        fromOwnProps: 'data.numBwdActiveEdges',
                        combine: add
                    }
                ));
                
            }
        } else {
            const currNode = rfi.getNode(rfEdge.source)!;
            if (currNode !== undefined && currRfNodeIds.includes(currNode.id)) {
                // currNode.data.numFwdActiveEdges += 1;
                store.dispatch(setRFINodeData(
                    {
                        nodeId: currNode.id,
                        path: 'numFwdActiveEdges',
                        value: 1,
                        fromOwnProps: 'data.numFwdActiveEdges',
                        combine: add
                    }
                ));
            }
        }
    });

    if (isFwd) {
        //currRfNode!.data.numFwdActiveEdges += neighbourEdges.length;
        store.dispatch(setRFINodeData(
            {
                nodeId: currRfNode.id,
                path: 'numFwdActiveEdges',
                value:  neighbourEdges.length,
                fromOwnProps: 'data.numFwdActiveEdges',
                combine: add
            }
        ));
    } else {
        // currRfNode!.data.numBwdActiveEdges += neighbourEdges.length;
        store.dispatch(setRFINodeData(
            {
                nodeId: currRfNode.id,
                path: 'numBwdActiveEdges',
                value:  neighbourEdges.length,
                fromOwnProps: 'data.numBwdActiveEdges',
                combine: add
            }
        ));
    }

    // current workaround: auto layout in setNodes
    rfi.setEdges((eds) => {
        rfEdges = Array.from(new Set([...eds, ...rfEdges]));
        return rfEdges;
    });

    rfi.setNodes((nds) => {
        // compute layout from non-parent nodes
        const newRfNodes = rfNodes;
        rfNodes = rfNodes.concat(nds) // existing nodes with parent + new nodes without parent
        const nonParentNodes = computeLayout(getNonParentNodesFromArray(rfNodes), rfEdges, layoutDirection);
        rfNodes = Array.from(new Set(nonParentNodes)); // prevents adding the nodes twice in strict mode

        // assign layouted new rfNodes to parents and include new parent nodes if necessary
        rfNodes = rfNodes.map(rfNode => newRfNodes.includes(rfNode) ? assignNodeToParent(rfNode, rfi)! : rfNode);
        const parentNodes = computeParentNodePositionFromArray(rfNodes, getParentNodesFromRFI(rfi));
        rfNodes = Array.from(new Set([...rfNodes, ...parentNodes]));
        rfNodes = computeNodePositionFromParent(rfNodes, rfNodes);
        return rfNodes;
    });
}

export function updateLineageGraphOnCollapse(rfi: ReactFlowInstance, props: any) {
    const { currRfNode, expandDirection, layoutDirection, grouped } = props;
    const [nodesIdsToRemove, edgesIdsToRemove] = dfsRemoveRfElems(currRfNode, expandDirection, rfi);
    rfi.setEdges((eds) => eds.filter(e => !edgesIdsToRemove.includes(e.id)));
    rfi.setNodes((nds) => {
        // recompute parent positions from remaining elements
        var rfNodes = nds.filter(n => !nodesIdsToRemove.includes(n.id));
        var nonParentNodes = Array.from(new Set(computeLayout(getNonParentNodesFromArray(rfNodes), rfi.getEdges(), layoutDirection)));
        const parentNodes = computeParentNodePositionFromArray(nonParentNodes, getParentNodesFromArrayIds(rfi, nonParentNodes));
        nonParentNodes = computeNodePositionFromParent(nonParentNodes, parentNodes);
        rfNodes = [...nonParentNodes, ...parentNodes];
        return rfNodes;
    });
}


/*
    Functions for viewport setting
*/
export function resetViewPortCentered(rfi: ReactFlowInstance, rfNodes: ReactFlowNode[]): void {
    // reset view port to the center of the lineage graph or the given node if only one provided
    assert(rfNodes.length > 0, "no ReactFlowNodes provided for reset viewport")
    var n: ReactFlowNode;
    if (rfNodes.length === 1) {
        n = rfi.getNode(rfNodes[0].id)!;
    } else {
        const filteredCenterNode = rfNodes.filter(node => node.data.graphNodeProps.isCenterNode);
        n = rfi.getNode(filteredCenterNode[0].id)!;
    }

    rfi.fitView({ nodes: [n as ReactFlowNode], duration: 600 });
}

// reset the view port with the center node in the center
export function resetViewPort(rfi: ReactFlowInstance): void {
    rfi.fitView({ nodes: rfi.getNodes(), duration: 600 });
}

/*
    Functions for node and edge styling
*/
export function setDefaultEdgeStyles() { } // TODO
export function setDefaultNodeStyles() { }

export function resetEdgeStyles(rfi: ReactFlowInstance) {
    rfi.setEdges((edge) => {
        return edge.map((e) => {
            e.style = {
                ...e.style,
                stroke: EDGE_COLOR_DEFAULT,
                strokeWidth: EDGE_STROKE_WIDTH_DEFAULT
            }
            e.markerEnd = {
                type: MarkerType.ArrowClosed,
                width: 10,
                height: 10,
                color: EDGE_COLOR_DEFAULT,
            }
            return e;
        })
    })
}

export function resetNodeStyles(rfi: ReactFlowInstance) {
    rfi.setNodes((node) => {
        return node.map((elem) => {
            const newElem = {
                ...elem,
                data: {
                    ...elem.data,
                    highlighted: false
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

export function setNodeStylesOnEdgeClick(rfi: ReactFlowInstance, edge: ReactFlowEdge) {
    rfi.setNodes((n) => {
        return n.map((elem) => {
            if (edge.source === elem.id || edge.target === elem.id) {
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

export function setEdgeStylesOnEdgeClick(rfi: ReactFlowInstance, edge: ReactFlowEdge) {
    rfi.setEdges((e) => {
        return e.map((elem) => {
            if (elem.id === edge.id) {
                elem.style = {
                    ...elem.style,
                    stroke: EDGE_COLOR_HIGHLIGHTED,
                    strokeWidth: EDGE_STROKE_WIDTH_HIGHLIGHTED,
                }
                elem.markerEnd = {
                    type: MarkerType.ArrowClosed,
                    width: 10,
                    height: 10,
                    color: EDGE_COLOR_HIGHLIGHTED,
                }
            }
            return elem;
        })
    });
}


/*
    Functions for Grouping / Retrieval
    These should be done on the DAGraph instance only, to separete computation from rendering the ReactFlowInstance

    - A grouping function can be abstracted as follows:

    function groupBy(args){
        const groupingFunction = ...
        groupingRoutine(groupingFuntion, args)
    }

    - A grouping button executes the following abstract function on click:

    function group(grouped, args){
        if(grouped) { groupBy(args) }
        else { ungroup() }
    }
*/
function getGraphNodeElementsByConnectedComponent(G: DAGraph, F: (g: DAGraph, fargs: any) => GraphNode[], args: any) {
    // a generic grouping function interface that retrieves the elements from G via a getter fuction F
    // returns the connected components 
    const elems = F(G, args);
    const components: Map<string, GraphNode[]> = G.getConnectedNodeComponents(graphNodeElementsToId(elems) as string[], G);
    return components;
}

function getGraphNodeElementsBySubgroups(G: DAGraph, F: (node: GraphNode, fargs: any) => any, args: any) {
    const resultToGroupId = () => {
        return '';
    };
    const subgroups: Map<string, GraphNode[]> = G.getSubgroups(F, resultToGroupId, args);
    return subgroups; // TODO: define groupn func properly
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
    rfElements.forEach(elem => {
        xMin = Math.min(xMin, elem.position.x);
        xMax = Math.max(xMax, elem.position.x);
        yMin = Math.min(yMin, elem.position.y);
        yMax = Math.max(yMax, elem.position.y);
    });

    // Adjust by the border size B. (x, y) position is the upper left corner
    xMin -= SUBFLOW_BORDER_SIZE;
    xMax += SUBFLOW_BORDER_SIZE + RF_NODE_WIDTH_CUSTOM;
    yMin -= SUBFLOW_BORDER_SIZE;
    yMax += SUBFLOW_BORDER_SIZE + RF_NODE_HEIGHT_CUSTOM;

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

function assignNodeToParent(rfNode: ReactFlowNode, rfi: ReactFlowInstance) {
    // get parentId of the node and assign it to the respective parent component, return the updated note
    // if the parent does not yet exist in the flow, create it. Otherwise, the unmodified node is returned
    // note that we don't recompute the child's position here as parent node's position has not been fixed yet
    const state = store.getState();
    const groupedComponents = getPropertyByPath(state, 'reactFlow.groupedNodeComponents');
    const groupedComponentsRf = getPropertyByPath(state, 'reactFlow.groupedNodeComponentsRf');
    const subGroups = getPropertyByPath(state, 'reactFlow.subgroups');
    const subGroupsRf = getPropertyByPath(state, 'reactFlow.subgroupsRf');
    if ((!groupedComponents || !groupedComponentsRf) && (!subGroups || !subGroupsRf)) { return rfNode }

    // TODO: adapt logic to subgroups here
    const parentId = findFirstKeyWithObject(groupedComponents, rfNode.id, (a) => (a.map(elem => (elem as GraphNode).id)));
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
            style: { backgroundColor: 'rgba(255, 0, 0, 0.2)', width: parentNodeWidth, height: parentNodeHeight },
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
    groupedComponents.get(parentId)!.push(updatedRfNode);
    rfNode = updatedRfNode;

    return rfNode;
}

// TODO: refactor into one function to govern mapping from custom graph to reactflow graph
export function createParentNodesFromComponents(rfi: ReactFlowInstance) {
    // creates initial parent nodes from the grouped component
    const componentsRf = store.getState()['reactFlow']['groupedNodeComponentsRf'];
    const rfNodeIds = rfi.getNodes().map(node => node.id);
    assert(componentsRf !== undefined, "connected components should not be undefined!");

    componentsRf.forEach((v, k) => {
        if (v.length > 0) {
            // TODO: the following can be refactored
            const groupId = `#Group ${k}`; // group nodes have to be in front of the children in the sorted rfNode array
            const coords = computeParentNodeCoordsFromChildren(v);
            const parentNodeWidth = coords.xMax - coords.xMin;
            const parentNodeHeight = coords.yMax - coords.yMin;
            const initPosition = { x: coords.xMin, y: coords.yMin };

            const groupedNode = {
                id: groupId,
                data: { label: groupId, initPosition: initPosition },
                position: initPosition,
                style: { backgroundColor: 'rgba(255, 0, 0, 0.2)', width: parentNodeWidth, height: parentNodeHeight },
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

// TODO: probably needs a new / an additional routine to map each node to its group instead of components
function groupingRoutineBySubgroup(G: DAGraph, F: (node: GraphNode, fargs: any) => Map<string, GraphNode[]>, args: any, rfi: ReactFlowInstance) {
    /*
        Compute the components based on the retrieved results / aggregation and map them to ReactFlow elements
    */
    const subgroups = getGraphNodeElementsBySubgroups(G, F, args) as Map<string, GraphNode[]>;
    const subgroupsRf: Map<string, ReactFlowNode[]> = new Map();
    subgroups.forEach((v, k) => { subgroupsRf.set(k, getRfElementsfromDAGElements(v, rfi)); })

    /*
        Update ReactFlow Instance
    */
    store.dispatch(setGroupedComponents(subgroups));
    store.dispatch(setGroupedComponentsRf(subgroupsRf));
    createParentNodesFromComponents(rfi);

    prioritizeParentNodes(rfi);
}

const groupingRoutine = (G: DAGraph, F: (graph: DAGraph, fargs: any) => GraphNode[], args: any, rfi: ReactFlowInstance) => {
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
    store.dispatch(setGroupedComponents(components));
    store.dispatch(setGroupedComponentsRf(componentsRf));
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


export const restoreGroupSettings = (rfi: ReactFlowInstance) => {
    // remove all parent nodes and reset child node props (TODO: remove edges after we incorporate collapse/expand on nodes)
    // the order matters
    rfi.setNodes(nodes => nodes.map(node => {
        node = {
            ...node,
            parentId: undefined,
            extent: undefined,
            expandParent: false,
            position: node.positionAbsolute!,
        }
        return node;
    }));
    rfi.setNodes(nodes => nodes.filter(node => !(node.type === 'group')));
    store.dispatch(setGroupedComponents(undefined));
    store.dispatch(setGroupedComponentsRf(undefined));
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
    groupingRoutine(G, F, args, rfi);
}

export function groupByFeed(rfi: ReactFlowInstance, G: DAGraph, args: any) {
    // required args: feedName
    const F = (graph: DAGraph, fargs: any) => {
        return graph.nodes.filter(node => (node as ActionObject).jsonObject.metadata?.feed === fargs.feedName);
    }
    groupingRoutine(G, F, args, rfi);
}

export function groupByObjectType(rfi: ReactFlowInstance, G: DAGraph, args: any) {
    // required args: objectType
    const F = (graph: DAGraph, fargs: any) => {
        return graph.nodes.filter(node => (node as DataOrActionObject).jsonObject.type === fargs.objectType);
    }
    groupingRoutine(G, F, args, rfi);
}

export function groupByTableName(rfi: ReactFlowInstance, G: DAGraph, args: any) {
    // required args: tableName
    const F = (graph: DAGraph, fargs: any) => {
        return graph.nodes.filter(node => (node as DataObject).jsonObject.table.name === fargs.objectType);
    }
    groupingRoutine(G, F, args, rfi);
}

export function groupByConnectionId(rfi: ReactFlowInstance, G: DAGraph, args: any) {
    // required args: connectionId
    const F = (graph: DAGraph, fargs: any) => {
        return graph.nodes.filter(node => (node as DataObject).jsonObject.connectionId === fargs.connectionId);
    }
    groupingRoutine(G, F, args, rfi);
}

export function showRunHeatmap() { } //TODO - action
export function showDataSizeHeatmap() { } //TODO - data, nFiles or size in bytes