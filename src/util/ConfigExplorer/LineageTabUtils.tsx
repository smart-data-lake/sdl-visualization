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

import { DAGraph, dagreLayoutRf as computeLayout, Edge as GraphEdge, Node as GraphNode, NodeType, PartialDataObjectsAndActions, dfsRemoveRfElems, Edge } from './Graphs';
import { ConfigData } from './ConfigData';
import { onlyUnique } from '../helpers';


/*
    Constants
*/
const SUBFLOW_BORDER_SIZE = 30;
const CUSTOM_RF_NODE_WIDTH = 200;
const CUSTOM_RF_NODE_HEIGHT = 80;
const DEFAULT_RF_NODE_WIDTH = 172;
const DEFAULT_RF_NODE_HEIGHT = 36;

const labelColor = '#fcae1e';
const defaultEdgeColor = '#b1b1b7';
const highLightedEdgeColor = '#096bde';

const defaultEdgeStrokeWidth = 3
const highlightedEdgeStrokeWidth = 5;


/*
    Types and Interfaces
*/
export type LayoutDirection = 'TB' | 'LR';
export type ExpandDirection = 'forward' | 'backward';
export type GraphView = 'full' | 'data' | 'action';
export type GraphElements = GraphNode[] | GraphEdge[] | [GraphNode[], GraphEdge[]];
export type ReactFlowElements = ReactFlowNode[] | ReactFlowEdge[] | [ReactFlowNode[], ReactFlowEdge[]];

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
export function getGraphFromConfig(configData: any, graphView: GraphView){
    var graph: DAGraph;
    if (graphView === 'full') {
      graph = configData!.fullGraph!;
    } else if (graphView === 'data') {
      graph = configData!.dataGraph!;
    } else if (graphView === 'action') {
      graph = configData!.actionGraph!;
    } else {
      throw Error("Unknown graph view " + graphView);
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
            targetPosition: targetPos, // required for the node positions to actually change internally
            sourcePosition: sourcePos,
            data: data,
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
export function resetViewPortCentered(rfi: ReactFlowInstance, rfNodes: ReactFlowNode[]): void {
    // reset view port to the center of the lineage graph or the given node if only one provided
    assert(rfNodes.length > 0, "no ReactFlowNodes provided for reset viewport")

    var n: ReactFlowNode;
    if (rfNodes.length === 1){
        n = rfi.getNode(rfNodes[0].id)!;
    } else {
        const filteredCenterNode = rfNodes.filter(node => node.data.graphNodeProps.isCenterNode);
        n = rfi.getNode(filteredCenterNode[0].id)!;
    }
    
    rfi.fitView({ nodes: [n as ReactFlowNode], duration: 400 });
}

// reset the view port with the center node in the center
export function resetViewPort(rfi: ReactFlowInstance): void {
    rfi.fitView({ nodes: rfi.getNodes(), duration: 400 });
}

// keep current graph state on layout
// useEffect(() => {
//   const newLayoutDirection = layout === 'TB' ? { source: Position.Bottom, target: Position.Top } 
//                                              : { source: Position.Right, target: Position.Left };
//   const updatedNodes = computeLayout(reactFlow.getNodes(), reactFlow.getEdges(), layout).map(node => ({
//     ...node,
//     data: { ...node.data, 
//             layoutDirection: layout,
//             sourcePosition: newLayoutDirection.source,
//             targetPosition: newLayoutDirection.target,
//           },
//   }));
//   const updatedEdges = reactFlow.getEdges().map(edge => ({
//     ...edge,
//     source: edge.source,
//     target: edge.target
//   }));
//   updatedEdges.forEach(e => console.log(e.sourceHandle, e.targetHandle))
//   reactFlow.setNodes(updatedNodes);
//   reactFlow.setEdges(updatedEdges);


/*
    Functions for node and edge styling
*/
export function setDefaultEdgeStyles(){} // TODO
export function setDefaultNodeStyles(){}

export function resetEdgeStyles(rfi: ReactFlowInstance) {
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

export function setNodeStyles(rfi: ReactFlowInstance, nodeIds: string[]){
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

export function setEdgeStyles(){} // TODO

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


/*
    Functions for Grouping / Retrieval
    These should be done on the DAGraph instance only, to separete computation from rendering the ReactFlowInstance
*/
function getGraphNodeElements(G: DAGraph, F: (g: DAGraph, fargs: any) => GraphNode[], args: any){
    // a generic grouping function interface that retrieves the elements from G via a getter fuction F
    // returns the connected components 
    const elems = F(G, args);
    const components: Map<string, GraphNode[]> = G.getConnectedNodeComponents(graphNodeElementsToId(elems) as string[], G); 
    return components;
}

function graphNodeElementsToId (elements: GraphNode[]): string[] {
    return elements.map(node => node.id);
}

function getRfElementsfromDAGElements(elements: GraphNode[], rfi: ReactFlowInstance): ReactFlowNode[]{
    // maps retrieved elements to currently shown reactFlow elements
    // can also be done in the components computation
    const graphElemIds = graphNodeElementsToId(elements);
    return rfi.getNodes().filter(n => graphElemIds.includes(n.id));
}

function computeParentNodeCoords(rfElements: ReactFlowNode[]){
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    rfElements.forEach(elem => {
        xMin = Math.min(xMin, elem.position.x);
        xMax = Math.max(xMax, elem.position.x);
        yMin = Math.min(yMin, elem.position.y);
        yMax = Math.max(yMax, elem.position.y);
    });

     // Adjust by the border size B. (x, y) position is the upper left corner
     xMin -= SUBFLOW_BORDER_SIZE;
     xMax += SUBFLOW_BORDER_SIZE + CUSTOM_RF_NODE_WIDTH;
     yMin -= SUBFLOW_BORDER_SIZE;
     yMax += SUBFLOW_BORDER_SIZE + CUSTOM_RF_NODE_HEIGHT;
 
     const centerX = (xMin + xMax) / 2;
     const centerY = (yMin + yMax) / 2;
 
     return { xMin: xMin, yMin: yMin, xMax: xMax, yMax: yMax, centerX: centerX, centerY: centerY};
}

function computeChildeNodeRelativePosition(rfNode: ReactFlowNode, parentNode: ReactFlowNode){
    return {x: rfNode.position.x - parentNode.position.x, 
            y: rfNode.position.y - parentNode.position.y }
}


export function highlightBySubstring(rfi: ReactFlowInstance, G: DAGraph, subString: string){
    /*
        Define the graph retrieval function
    */
    const F = (graph: DAGraph, args: any) => {
        // return graph.nodes.filter(node => node.data.id === args.feedName); 
        return graph.nodes.filter(node => node.data.id.includes(args.subString));
    }

    /*
        Compute the components based on the retrieved results / aggregation 
    */
    const components = getGraphNodeElements(G, F, {subString}) as Map<string, GraphNode[]>;


    /*
        Update ReactFlow Instance
    */
    const ids: string[] = Array.from(components.values()).flatMap((nodes) => nodes.map(node => node.id));
    setNodeStyles(rfi, ids);

}


// does this make sense? we only visualize subgraphs, as each feed defines one
// this function here groups objects with the same substring in their ids
export function groupBySubstring(rfi: ReactFlowInstance, G: DAGraph, subString: string){
    /*
        Define the graph retrieval function
    */
    const F = (graph: DAGraph, args: any) => {
        // return graph.nodes.filter(node => node.data.id === args.feedName); // TODO: read config data to node props 
        return graph.nodes.filter(node => node.data.id.includes(subString));
    }

    /*
        Compute the components based on the retrieved results / aggregation and map them to ReactFlow elements
    */
    const components = getGraphNodeElements(G, F, {}) as Map<string, GraphNode[]>;
    const componentsRf: Map<string, ReactFlowNode[]> = new Map();
    components.forEach((v, k) => 
        {componentsRf.set(k, getRfElementsfromDAGElements(v, rfi));}
    );
    console.log("flow components: ", componentsRf)

    /*
        Update ReactFlow Instance
    */
    componentsRf.forEach((v, k) => { // TODO: update the coordninates of each group locally (need to adapt parent node coord computatino)
        if(v.length > 0){
            // create parent nodles and update reactFlowInstance
            const groupId = "Group " + k;
            const coords = computeParentNodeCoords(v);
            const parentNodeWidth = coords.xMax-coords.xMin;
            const parentNodeHeight = coords.yMax-coords.yMin;

            const groupedNode = {
                id: groupId,
                data: { label: groupId },
                position: {x: coords.xMin, y:coords.yMin},
                // className: 'light',
                style: { backgroundColor: 'rgba(255, 0, 0, 0.2)', width: parentNodeWidth, height: parentNodeHeight},
                type: 'group',
            } as ReactFlowNode; 
            rfi.addNodes(groupedNode);

            //map rfElements to parent nodes
            const idsInComponent = v.map(n => n.id);
            rfi.setNodes(rfNodes => {
                return rfNodes.map(rfNode => {
                    if(idsInComponent.includes(rfNode.id)){
                        rfNode = {
                            ...rfNode, 
                            parentId: groupId,
                            extent: 'parent',
                            // type: 'output', // with handles
                            position: computeChildeNodeRelativePosition(rfNode, groupedNode)
                        }
                    }
                    return rfNode;
                });
            });
        }
    });
}

export function resetGroupSettings(){}// TODO: remove group tags from rfNodes
