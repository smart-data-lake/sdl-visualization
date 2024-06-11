/*
    A newer version of the lineage tab under construction that has the following features:

    - Separated view for data objects and actions and the full graph
    - Expand and collapse functionality based on the selected node / group
    - Group view
    - Customizable node and edge components
    - real-time informationfor nodes and edges, including, but not restricted to:
        1. progress bar
        2. metrics
        3. time information
        4. object description (cklickable & hoverable)
        5. edge animation for tasks in progress (might conflict with 1.)
*/

// react component imports
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType, Position,
  Edge as ReactFlowEdge,
  Node as ReactFlowNode
} from 'react-flow-renderer';
import { useNavigate, useParams } from 'react-router-dom';
import { ReactFlowInstance, useReactFlow } from 'reactflow';

// mui imports
import Box from '@mui/material/Box';

// local imports
import { ReactFlowProvider } from 'reactflow';
import { ConfigData } from '../../../util/ConfigExplorer/ConfigData';
import { DAGraph, dagreLayoutRf as computeLayout, Edge as GraphEdge, Node as GraphNode, NodeType, PartialDataObjectsAndActions } from '../../../util/ConfigExplorer/Graphs';
import { CustomDataNode, CustomEdge } from './LineageGraphComponents';
import { LineageGraphToolbar } from './LineageGraphToolbar';
import assert from 'assert';

/*
Global styles to be refactored
*/
const labelColor = '#fcae1e';
const defaultEdgeColor = '#b1b1b7';
const highLightedEdgeColor = '#096bde';

const defaultEdgeStrokeWidth = 3
const highlightedEdgeStrokeWidth = 5;

export type LayoutDirection = 'TB' | 'LR';
export type ExpandDirection = 'forward' | 'backward'; 
export type GraphView = 'full' | 'data' | 'action';


/*
 Add custom node and edge types
*/
const nodeTypes = {
  customDataNode: CustomDataNode,
}

const edgeTypes = {
  customEdge: CustomEdge,
};


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
  // isDirectFwdNeighbour: boolean,
  // isDirectBwdNeighbour: boolean,
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
  expandNodeFunc: (id: string,  isExpanded: boolean, direction: ExpandDirection, graphView: GraphView, layout: LayoutDirection) => void
  graphNodeProps: graphNodeProps,
  isGraphFullyExpanded: boolean,
  graphView: GraphView,
  highlighted: boolean,
  numFwdExpandedEdges: number, // tracking number of active fwd and bwd edges to expand button changes
  numBwdExpandedEdges: number   
}


function createReactFlowNodes(selectedNodes: GraphNode[],
                              layoutDirection: LayoutDirection, 
                              isGraphFullyExpanded: boolean,
                              graphView: GraphView,
                              expandNodeFunc: (id: string, isExpanded: boolean, direction: ExpandDirection, graphView: GraphView, layout: LayoutDirection) => void, 
                              props: flowProps 
                            ): ReactFlowNode[] {
  const dataObjectsAndActions = graphView === 'action' ? props.configData?.actionGraph! :
                                graphView === 'data' ? props.configData?.dataGraph! :
                                props.configData?.fullGraph!;
  const isHorizontal = layoutDirection === 'LR';
  const nodes = dataObjectsAndActions.nodes?.filter(node => selectedNodes.includes(node)); // verify the usage of .includes, whether to use includes id instead
  const centerNode = dataObjectsAndActions.getNodeById(dataObjectsAndActions.centerNodeId)!;
  const targetPos = isHorizontal ? Position.Left : Position.Top;
  const sourcePos = isHorizontal ? Position.Right : Position.Bottom;
  const sinkNodes = dataObjectsAndActions.getSinkNodes();
  const sourceNodes = dataObjectsAndActions.getSourceNodes();
  const fwdNodes = dataObjectsAndActions.getDirectDescendants(centerNode, "node") as GraphNode[];
  const bwdNodes = dataObjectsAndActions.getDirectAncestors(centerNode, "node") as GraphNode[];

  // If we need more information to be displayed on the node, 
  // just add more fields to the flowProps interface and access it in the custom node component.
  // The additional props can be passed in ElementDetails where the LineageTab is opened.

  // TODO: initialize neighbour node/full graph in/out active degrees 
  // Because we don't recreate the reactflow nodes and edges, the created elements are the one that should be visible
  var result: ReactFlowNode[] = []; 
  nodes.forEach((node)=>{
    const dataObject = node
    const nodeType = dataObject.nodeType;
    const [directFwdNodes, ] = dataObjectsAndActions.getOutElems(node.id);
    const [directBwdNodes, ] = dataObjectsAndActions.getInElems(node.id);

    const isSink = sinkNodes.includes(dataObject);
    const isSource = sourceNodes.includes(dataObject);
    // const isDirectFwdNeighbour = directFwdNodes.includes(node); // is this needed?
    // const isDirectBwdNeighbour = directBwdNodes.includes(node);
    const isCenterNodeDescendant = fwdNodes.includes(node);
    const isCenterNodeAncestor = bwdNodes.includes(node);

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
        isCenterNode: dataObject.isCenterNode, 
        isSink: isSink,
        isSource: isSource,
        // isDirectFwdNeighbour: isDirectFwdNeighbour,
        // isDirectBwdNeighbour: isDirectBwdNeighbour,
        isCenterNodeDescendant: isCenterNodeDescendant,
        isCenterNodeAncestor: isCenterNodeAncestor,
      },
      numBwdExpandedEdges: directBwdNodes.length,
      numFwdExpandedEdges: directFwdNodes.length,
      // the following are  hard coded for testing
      progress: nodeType === NodeType.ActionNode ? Math.round(Math.random()*100): undefined, 
      jsonObject: (nodeType === NodeType.ActionNode || nodeType === NodeType.DataNode) ? node.jsonObject : undefined, 
      highlighted: false // set by handlers in Core
    }

    const newNode = {
      id: dataObject.id,
      type: 'customDataNode',   // should match the name defined in custom node types
      position: {x: dataObject.position.x, y: dataObject.position.y},
      targetPosition: targetPos, // required for the node positions to actually change internally
      sourcePosition: sourcePos,
      data: data,
    } as ReactFlowNode

    result.push(newNode);
  });
  return result;
}


function createReactFlowEdges(selectedEdges: GraphEdge[],
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
    const uniqueId =  edge.id;
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
        color:  edgeColor,
      },
      labelBgPadding: [7, 7],
      labelBgBorderRadius: 8,
      labelBgStyle: { fill: selected ? labelColor : '#fff', fillOpacity: selected ? 1 : 0.75, stroke:  labelColor}, 
      style: { stroke:  edgeColor, strokeWidth: defaultEdgeStrokeWidth},
    } as ReactFlowEdge;
    result.push(newEdge);
  });

  return result;
}


/*
  Implements the Lineage tab for separated action and dataObject view
  edge labels will be replaced by action nodes in the full graph view
*/
function LineageTabCore(props: flowProps) {
   // initialization 
   const url = useParams();
 
   let nodes_init: ReactFlowNode[] = [];
   let edges_init: ReactFlowEdge[] = [];
 
   const [graphView, setGraphView] = useState<GraphView>('full'); // control for action/data/full graph view 
   const [onlyDirectNeighbours, setOnlyDirectNeighbours] = useState([true, 'Expand Graph']); // can be simplified as well
   const [layout, setLayout] = useState<LayoutDirection>('TB');
   let [hidden, setHidden] = useState(useParams().elemelsntType === 'dataObjects' ? true : false); 

   const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | undefined>(undefined); // can this be replaced by useReactFlow?
   const reactFlow = useReactFlow();
  
   const [nodes, setNodes] = useState<ReactFlowNode<any>[]>([]);
   const [edges, setEdges] = useState<ReactFlowEdge<any>[]>([]);
  //  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  // const [edges, setEdges, onEdgesChange] = useEdgesState([]);
 
   const navigate = useNavigate();            // handlers for navigating dataObjects and actions
   const chartBox = useRef<HTMLDivElement>(); // container holding SVG needs manual height resizing to fill 100%

   // helper functions
   function expandGraph(): void {
    let buttonMessage = onlyDirectNeighbours[0] ? 'Compress Graph' : 'Expand Graph';
    setOnlyDirectNeighbours([!onlyDirectNeighbours[0], buttonMessage]);
  }

  const expandNodeFunc = useCallback((id: string, isExpanded: boolean, 
                                      expandDirection: ExpandDirection, 
                                      graphView: GraphView,
                                      layoutDirection: LayoutDirection) => {
    // if expanded, show the direct out neighbours of the node with the id; if unexpanded, hide all descendants
    var graph: DAGraph;
    if (graphView === 'full'){ 
      graph = props.configData!.fullGraph!;
    } else if (graphView === 'data'){
      graph = props.configData!.dataGraph!;
    } else if (graphView === 'action'){
      graph = props.configData!.actionGraph!;
    } else {
      throw Error("Unknown graph view " + graphView);
    }

    if(!isExpanded){
      console.log("expand");
      let [neighbourNodes, neighbourEdges] = expandDirection === 'forward' ? graph.getOutElems(id) : graph.getInElems(id); // all positions are 0,0 here
      let rfNodes = createReactFlowNodes(neighbourNodes, layoutDirection, !onlyDirectNeighbours[0], graphView, expandNodeFunc, props);
      let rfEdges = createReactFlowEdges(neighbourEdges, props, graphView, undefined);
      // current workaround: auto layout in setNodes
      // TODO: update number of in/out active edges currNode.activeOut += neighburNodes.length
      setEdges((eds) => {
        rfEdges = Array.from(new Set([...eds, ...rfEdges]));
        return rfEdges;
      });
      setNodes((nds) => {
        rfNodes = computeLayout(nds.concat(rfNodes), rfEdges, layoutDirection); 
        rfNodes = Array.from(new Set([...rfNodes])); // prevent adding the nodes twice in strict mode, will be changed
        return rfNodes;
      })
    
      
    } else {
      console.log("hide");
      // hide all reachable nodes and edges
      // dfs is implemented as such that all the descendants are hidden on collapse button click. We could also dfs the currently shown node and hide them.
      // we match the reactflow edge ids against the graph edge ids, so the unique ids should be defined in a way we can link to it easily (at least for this implementation...)
      const currNode = graph.getNodeById(id);
      const [reachableNodes, reachableEdges] = expandDirection === 'forward' ? graph.getDirectDescendants(currNode!, 'all') as [GraphNode[], GraphEdge[]]
                                                                             : graph.getDirectAncestors(currNode!, 'all') as [GraphNode[], GraphEdge[]];
      const reachableNodeIds: string[] = reachableNodes.map((node) => {return node.id});
      const reachableEdgeIds: string[] = reachableEdges.map((edge) => {return edge.id});
      console.log("reachable node ids: ", reachableNodes);
      // TODO: update number of in/out aactive edges currNode.activeIn/out -= ..., if currNode.activeIn/Out > 0, do not filter
      setNodes((nds) => nds.filter(n => !reachableNodeIds.includes(n.id)));
      setEdges((eds) => eds.filter(e => !reachableEdgeIds.includes(e.id)));
    }
  }, [])

  function prepareAndRenderGraph(): [ReactFlowNode[], ReactFlowEdge[]] { 
    var partialGraphPair: [GraphNode[],GraphEdge[]] = [[],[]];
    var doa: DAGraph;
    var centralNodeId: string = props.elementName;

    // get the right central node for the graph
    // design choice (currently 2 is implemented):
    // 1. center the graph globally when we change the graph view while veiwing a node of different type
    // 2. center the graph to the direct neighbour when we change the graph view while viewing a node of different type
    if (graphView === 'full'){ 
      doa = props.configData!.fullGraph!;
    } else if (graphView === 'data'){
      doa = props.configData!.dataGraph!;
      if(props.elementType === 'actions'){ 
        // switch to data graph when an action is selected -> navigate to first direct neighbour
        const [neighours, ] = props.configData?.fullGraph?.returnDirectNeighbours(props.elementName)!;
        navigate(`/config/dataObjects/${neighours[0].id}`);
        return [[],[]];
      }
    } else if (graphView === 'action'){
      doa = props.configData!.actionGraph!;
      if (props.elementType === 'dataObjects'){ 
        // switch to action graph when a data object is selected -> navigate to first direct neighbour
        const [neighours, ] = props.configData?.fullGraph?.returnDirectNeighbours(props.elementName)!;
        navigate(`/config/actions/${neighours[0].id}`);
        return [[],[]];
      }
    } else {
      throw Error("Unknown graph view " + graphView);
    }

    // reset isCenterNode flags otherwise all previous ones will be colored
    doa.nodes.forEach((node) => {
      node.setIsCenterNode(false);
    });
    doa.setCenterNode(doa.getNodeById(centralNodeId)!);

    // When the layout has changed, the nodes and edges have to be recomputed
    partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighbours(centralNodeId) : doa.returnPartialGraphInputs(centralNodeId);
    const partialGraph = new PartialDataObjectsAndActions(partialGraphPair[0],partialGraphPair[1], layout, props.configData);
    partialGraph.setCenterNode(partialGraph.getNodeById(centralNodeId)!); // how would props.configData.fullgraph know the new centralId?
    let nodes = createReactFlowNodes(partialGraphPair[0], layout, !onlyDirectNeighbours[0], graphView, expandNodeFunc, props);
    let edges = createReactFlowEdges(partialGraphPair[1], props, graphView, undefined);
    return [nodes, edges];
  }

  // reset view port to the center of the lineage graph
  function resetViewPort(rfi: ReactFlowInstance | null): void {
    const filteredCenterNode = nodes.filter(node => node.data.graphNodeProps.isCenterNode);
    if (rfi && nodes?.length) {
      const n = rfi.getNode(filteredCenterNode[0].id)
      rfi.fitView({ nodes: [n as ReactFlowNode], duration: 400 });
    }
  }

  // reset the view port with the center node in the center
  function resetViewPortCentered(rfi: ReactFlowInstance | null): void {
    if (rfi && nodes?.length) {
      const filteredCenterNode = nodes.filter(node => node.data.graphNodeProps.isCenterNode);
      const n = rfi.getNode(filteredCenterNode[0].id);
      const width = n?.width!;
      const height = n?.height!;
      rfi.setViewport({x: n?.positionAbsolute?.x! + width, y: n?.positionAbsolute?.y! + height, zoom: rfi?.getZoom() || 1})
    }
  }

  // reset node styles on pane click
  function resetEdgeStyles(){
    setEdges((edge) => {
      return edge.map((e) =>{
        e.style = {
          ...e.style,
          stroke: defaultEdgeColor,
          strokeWidth: defaultEdgeStrokeWidth
        }
        e.markerEnd = {
          type: MarkerType.ArrowClosed,
          width: 10,
          height: 10,
          color:  defaultEdgeColor,
        }
        return e;
      })
    })
  }

  function resetNodeStyles(){
    setNodes((node) => {
      return node.map((elem) =>{
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

  // defines the conditions to (re-)render the lineage graph
  useEffect(() =>{
    [nodes_init, edges_init] = prepareAndRenderGraph();
    setNodes(nodes_init);
    setEdges(edges_init); 
    resetViewPortCentered(reactFlowInstance!);
  }, [hidden,  layout, onlyDirectNeighbours, props, graphView, url, reactFlowInstance]);

  // useEffect(() => {
  //   // workaround method to get current nodes and edges
  //   var currRfEdges: ReactFlowEdge[] = [];
  //   var currRfNodes: ReactFlowNode[] = [];

  //   setEdges((eds) => {
  //     currRfEdges = eds;
  //     return currRfEdges;
  //   }); // called after prepareGraph??

  //   setNodes((nds) => {
  //     console.log("nds: ", nds)
  //     currRfNodes = nds;
  //     return currRfNodes;
  //   })

  //   console.log("should be called after setNodes printing nds")

  //   console.log("curr eds and nds: ", currRfEdges, currRfNodes);
  //   if (currRfEdges.length === 0 || currRfNodes.length === 0){
  //     [nodes_init, edges_init] = prepareAndRenderGraph();
  //     setNodes(nodes_init);
  //     setEdges(edges_init); 
  //   } else {
  //     setNodes(computeLayout(currRfNodes, currRfEdges, layout));
  //     setEdges(currRfEdges);
  //   }
  //   resetViewPortCentered(reactFlowInstance!);
  //   console.log("curr eds and nds after set: ", currRfEdges, currRfNodes);


  // }, [layout])


  // set reactflow instance on init so that we can access the internal state of it
  const onInit = (rfi) => {
    setReactFlowInstance(rfi);
  };

  // TODO: don't reset the moved edges on click
  const onEdgeClick = (_event, edge: ReactFlowEdge) => {
    // highlight edge and src, target nodes' border
    resetEdgeStyles();
    resetNodeStyles();
    setNodes((n) => {
      return n.map((elem)=>{
        if (edge.source === elem.id || edge.target === elem.id){
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
    setEdges((e) =>{
      return e.map((elem) =>{
        if(elem.id === edge.id){
          elem.style = {
            ...elem.style,
            stroke: highLightedEdgeColor,
            strokeWidth: highlightedEdgeStrokeWidth,
          }
          elem.markerEnd = {
            type: MarkerType.ArrowClosed,
            width: 10,
            height: 10,
            color:  highLightedEdgeColor,
          }
        }
        return elem;
      })
    });
  }

  const handleCenterFocus = () => {
    if(reactFlowInstance){
      resetViewPortCentered(reactFlowInstance);
    }

  }

  const handleResetViewPort = () => {
    if(reactFlowInstance){
      resetViewPort(reactFlowInstance);
    }
  }


  return (
    <>
     <Box
      className='data-flow'
      ref={chartBox}
      sx={{
        height: '100%',
      }}
      >
        <ReactFlow
          onInit={onInit}
          defaultNodes={nodes}
          defaultEdges={edges}
          defaultPosition={[0, 0]}
          onEdgeClick={onEdgeClick}
          onPaneClick={() => {resetEdgeStyles(); resetNodeStyles();}}
          nodesConnectable={false} 
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.02}
          maxZoom={3}
        >
          <Background/>
          {/* <MiniMap/>  */}
          <Controls />
        </ReactFlow>
          <LineageGraphToolbar
          isPropsConfigDefined={props.configData !== undefined}
          hidden={hidden}
          setHidden={setHidden}
          expanded={onlyDirectNeighbours[0]}
          setExpanded={expandGraph}
          expansionState={onlyDirectNeighbours[1]}
          layout={layout}
          setLayout={setLayout}
          graphView={graphView}
          setGraphView={setGraphView}
          handleOnClickResetViewport={handleResetViewPort}
          handleOnClickCenterFocus={handleCenterFocus}
          reactFlowInstance={reactFlowInstance}
        />
    </Box>
     
    </>
  )          
}


function LineageTabSep(props: flowProps){
  return (
      <ReactFlowProvider>
        <LineageTabCore {...props}/>
      </ReactFlowProvider>
  )
}


export default LineageTabSep;