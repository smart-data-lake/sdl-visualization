import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import reactflow, {
    Background,
    Controls,
    MarkerType, Position,
    Edge as ReactFlowEdge,
    ReactFlowInstance,
    Node as ReactFlowNode,
    useEdgesState,
    useNodesState
} from 'reactflow';

import assert from 'assert';

import { DAGraph, dagreLayoutRf as computeLayout, Edge as GraphEdge, Node as GraphNode, NodeType, PartialDataObjectsAndActions, dfsRemoveRfElems } from './Graphs';
import { ConfigData } from './ConfigData';


/*
    Types and Interfaces
*/
export type LayoutDirection = 'TB' | 'LR';
export type ExpandDirection = 'forward' | 'backward';
export type GraphView = 'full' | 'data' | 'action';

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
    props: flowProps,
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
        const dataObject = node
        const nodeType = dataObject.nodeType;
        const [currNodeDirectFwdNodes,] = reachableSubGraph.getOutElems(dataObject.id); // instead of dataObjectsAndActions
        const [currNodeDirectBwdNodes,] = reachableSubGraph.getInElems(dataObject.id);

        const isCenterNode = dataObject.isCenterNode;
        const isSink = sinkNodes.includes(dataObject);
        const isSource = sourceNodes.includes(dataObject);
        const isCenterNodeDirectFwdNeighbour = centerNodeDirectFwdNodes.includes(dataObject);
        const isCenterNodeDirectBwdNeighbour = centerNodeDirectBwdNodes.includes(dataObject);
        const isCenterNodeDescendant = fwdNodes.includes(dataObject);
        const isCenterNodeAncestor = bwdNodes.includes(dataObject);

        const data: reactFlowNodeProps = {
            props: props,
            label: dataObject.id,
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
            jsonObject: (nodeType === NodeType.ActionNode || nodeType === NodeType.DataNode) ? node.jsonObject : undefined,
            highlighted: false // set by handlers in Core
        }

        const newNode = {
            id: dataObject.id,
            type: 'customDataNode',   // should match the name defined in custom node types
            position: { x: dataObject.position.x, y: dataObject.position.y },
            targetPosition: targetPos, // required for the node positions to actually change internally
            sourcePosition: sourcePos,
            data: data,
        } as ReactFlowNode

        result.push(newNode);
    });
    return result;
}


// TODO: maybe colors should be refactored in a separate style sheet
export function createReactFlowEdges(selectedEdges: GraphEdge[],
    props: flowProps,
    graphView: GraphView,
    selectedEdgeId: string | undefined, 
    highLightedEdgeColor, defaultEdgeColor, labelColor, defaultEdgeStrokeWidth): ReactFlowEdge[] {
    const dataObjectsAndActions = graphView === 'action' ? props.configData?.actionGraph! :
        graphView === 'data' ? props.configData?.dataGraph! :
            props.configData?.fullGraph!;
    const edges = dataObjectsAndActions.edges?.filter(edge => selectedEdges.includes(edge));
    const edgeColor = selectedEdgeId ? highLightedEdgeColor : defaultEdgeColor;

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
            labelBgStyle: { fill: selected ? labelColor : '#fff', fillOpacity: selected ? 1 : 0.75, stroke: labelColor },
            style: { stroke: edgeColor, strokeWidth: defaultEdgeStrokeWidth },
        } as ReactFlowEdge;
        result.push(newEdge);
    });

    return result;
}

/*
    Functions for expand/collapse
*/
export function updateLineageGraphOnExapnd(rfi: ReactFlowInstance, rfEdges: ReactFlowEdge[], rfNodes: ReactFlowNode[], props: any) {
    const { isFwd,
        currRfNodeIds,
        currRfNode,
        neighbourEdges,
        layoutDirection } = props;
    rfEdges.forEach(rfEdge => {
        if (isFwd) {
            const currNode = rfi.getNode(rfEdge.target)!;
            if (currNode !== undefined && currRfNodeIds.includes(currNode.id)) {
                currNode.data.numBwdActiveEdges += 1;
            }
        } else {
            const currNode = rfi.getNode(rfEdge.source)!;
            if (currNode !== undefined && currRfNodeIds.includes(currNode.id)) {
                currNode.data.numFwdActiveEdges += 1;
            }
        }
    });

    if (isFwd) {
        currRfNode!.data.numFwdActiveEdges += neighbourEdges.length;
    } else {
        currRfNode!.data.numBwdActiveEdges += neighbourEdges.length;
    }

    // current workaround: auto layout in setNodes
    rfi.setEdges((eds) => {
        rfEdges = Array.from(new Set([...eds, ...rfEdges]));
        return rfEdges;
    });
    rfi.setNodes((nds) => {
        rfNodes = computeLayout(nds.concat(rfNodes), rfEdges, layoutDirection);
        rfNodes = Array.from(new Set([...rfNodes])); // prevent adding the nodes twice in strict mode, will be changed
        return rfNodes;
    })
}


export function updateLineageGraphOnCollapse(rfi: ReactFlowInstance, props: any) {
    const { currRfNode, expandDirection, layoutDirection } = props;
    const [nodesIdsToRemove, edgesIdsToRemove] = dfsRemoveRfElems(currRfNode, expandDirection, rfi);
    rfi.setEdges((eds) => eds.filter(e => !edgesIdsToRemove.includes(e.id)));
    rfi.setNodes((nds) => {
        let rfNodes = nds.filter(n => !nodesIdsToRemove.includes(n.id));
        rfNodes = computeLayout(rfNodes, rfi.getEdges(), layoutDirection);
        return rfNodes;
    });
}


/*
    Functions for viewport setting
*/
// reset view port to the center of the lineage graph
export function resetViewPortCentered(rfi: ReactFlowInstance, rfNodes: ReactFlowNode[]): void {
    const filteredCenterNode = rfNodes.filter(node => node.data.graphNodeProps.isCenterNode);
    const n = rfi.getNode(filteredCenterNode[0].id)
    rfi.fitView({ nodes: [n as ReactFlowNode], duration: 400 });
}

// reset the view port with the center node in the center
export function resetViewPort(rfi: ReactFlowInstance): void {
    rfi.fitView({ nodes: rfi.getNodes(), duration: 400 });
}


/*
    Functions for edge styling
*/
export function resetEdgeStyles(rfi: ReactFlowInstance, props: any) {
    const { defaultEdgeColor, defaultEdgeStrokeWidth } = props;

    rfi.setEdges((edge) => {
        return edge.map((e) => {
            e.style = {
                ...e.style,
                stroke: defaultEdgeColor,
                strokeWidth: defaultEdgeStrokeWidth
            }
            e.markerEnd = {
                type: MarkerType.ArrowClosed,
                width: 10,
                height: 10,
                color: defaultEdgeColor,
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

export function setEdgeStylesOnEdgeClick(rfi: ReactFlowInstance, edge: ReactFlowEdge) {
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

export function setNodeStylesOnEdgeClick(rfi: ReactFlowInstance, edge: ReactFlowEdge, props: any) {
    const { highLightedEdgeColor, highlightedEdgeStrokeWidth } = props;
    rfi.setEdges((e) => {
        return e.map((elem) => {
            if (elem.id === edge.id) {
                elem.style = {
                    ...elem.style,
                    stroke: highLightedEdgeColor,
                    strokeWidth: highlightedEdgeStrokeWidth,
                }
                elem.markerEnd = {
                    type: MarkerType.ArrowClosed,
                    width: 10,
                    height: 10,
                    color: highLightedEdgeColor,
                }
            }
            return elem;
        })
    });
}