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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType, Position,
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
  useEdgesState,
  useNodesState
} from 'reactflow';
import { useNavigate, useParams } from 'react-router-dom';
import { ReactFlowInstance, useReactFlow } from 'reactflow';
// default styling
import 'reactflow/dist/style.css';

// mui imports
import Box from '@mui/material/Box';

// local imports
import { ReactFlowProvider } from 'reactflow';
import { ConfigData } from '../../../util/ConfigExplorer/ConfigData';
import { DAGraph, dagreLayoutRf as computeLayout, Edge as GraphEdge, Node as GraphNode, NodeType, PartialDataObjectsAndActions,  dfsRemoveRfElems } from '../../../util/ConfigExplorer/Graphs';
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
  expandNodeFunc: (id: string,  isExpanded: boolean, direction: ExpandDirection, graphView: GraphView, layout: LayoutDirection) => void
  graphNodeProps: graphNodeProps,
  isGraphFullyExpanded: boolean,
  graphView: GraphView,
  highlighted: boolean,
  numFwdActiveEdges: number,
  numBwdActiveEdges: number, 
  numFwdEdges: number, // not used for now, but might be helpful
  numBwdEdges: number
}


function createReactFlowNodes(selectedNodes: GraphNode[],
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
  const [centerNodeDirectFwdNodes, ] = dataObjectsAndActions.getOutElems(centerNode.id);
  const [centerNodeDirectBwdNodes, ] = dataObjectsAndActions.getInElems(centerNode.id);
  const [reachableNodes, reachableEdges] = [[...fwdNodes, ...bwdNodes], [...fwdEdges, ...bwdEdges]];
  const reachableSubGraph = new PartialDataObjectsAndActions(reachableNodes, reachableEdges, layoutDirection);
  console.log("reachable subgraph: ", reachableSubGraph)

  // If we need more information to be displayed on the node, 
  // just add more fields to the flowProps interface and access it in the custom node component.
  // The additional props can be passed in ElementDetails where the LineageTab is opened.
  var result: ReactFlowNode[] = []; 
  selectedNodes.forEach((node)=>{
    const dataObject = node
    const nodeType = dataObject.nodeType;
    const [currNodeDirectFwdNodes, ] = reachableSubGraph.getOutElems(dataObject.id); // instead of dataObjectsAndActions
    const [currNodeDirectBwdNodes, ] = reachableSubGraph.getInElems(dataObject.id);

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
                         (isCenterNodeDirectFwdNeighbour || (isExpandedNode && expandDirection === 'forward')) ?  1:
                         0,
      numFwdActiveEdges: (isGraphFullyExpanded || isCenterNode) ? currNodeDirectFwdNodes.length :
                         (isCenterNodeDirectBwdNeighbour || (isExpandedNode && expandDirection === 'backward')) ?  1 :
                         0,
      numBwdEdges: currNodeDirectBwdNodes.length,
      numFwdEdges: currNodeDirectFwdNodes.length,
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

   const reactFlow = useReactFlow();
   const [reactFlowKey, setReactFlowKey] = useState(1);
  
   //const [nodes, setNodes] = useState<ReactFlowNode<any>[]>([]);
   //const [edges, setEdges] = useState<ReactFlowEdge<any>[]>([]);
   //const [nodes, setNodes, onNodesChange] = useNodesState([]);
   //const [edges, setEdges, onEdgesChange] = useEdgesState([]);
 
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

    const isFwd =  expandDirection === 'forward';
    const currNode = graph.getNodeById(id)!;
    const currRfNode = reactFlow.getNode(currNode?.id!)!;
    if(!isExpanded){
      console.log("expand");
      let [neighbourNodes, neighbourEdges] = isFwd ? graph.getOutElems(id) : graph.getInElems(id); // all positions are 0,0 here

      // only create not existing nodes, update active edges of exisiting nodes
      const currRfNodes = reactFlow.getNodes();
      const currRfNodeIds = currRfNodes.map(rfNode => rfNode.id);

      let rfNodes =  createReactFlowNodes(neighbourNodes.filter(node => !currRfNodeIds.includes(node.id)), 
                                         layoutDirection, 
                                         !onlyDirectNeighbours[0], 
                                         true, 
                                         expandDirection,
                                         graphView, 
                                         expandNodeFunc, 
                                         props);

      let rfEdges = createReactFlowEdges(neighbourEdges, 
                                         props, 
                                         graphView,
                                         undefined);
      rfEdges.forEach(rfEdge => {
        if (isFwd) {
          const currNode = reactFlow.getNode(rfEdge.target)!;
          console.log("currNode before cond update: ", rfEdge.target, currNode, currRfNodes);
          if(currNode !== undefined && currRfNodeIds.includes(currNode.id)){
            currNode.data.numBwdActiveEdges += 1;
          } 
          console.log("currNode after update: ", rfEdge.target, currNode, currRfNodes);
        } else {
          const currNode = reactFlow.getNode(rfEdge.source)!;
          if(currNode !== undefined && currRfNodeIds.includes(currNode.id)){
            currNode.data.numFwdActiveEdges += 1;
          } 
        }
      });

      if(isFwd){
        currRfNode!.data.numFwdActiveEdges += neighbourEdges.length; 
      } else {
        currRfNode!.data.numBwdActiveEdges += neighbourEdges.length; 
      }

      // current workaround: auto layout in setNodes
      reactFlow.setEdges((eds) => {
        rfEdges = Array.from(new Set([...eds, ...rfEdges]));
        return rfEdges;
      });
      reactFlow.setNodes((nds) => {
        rfNodes = computeLayout(nds.concat(rfNodes), rfEdges, layoutDirection); 
        rfNodes = Array.from(new Set([...rfNodes])); // prevent adding the nodes twice in strict mode, will be changed
        return rfNodes;
      })
    } else {
      console.log("hide");
      const [nodesIdsToRemove, edgesIdsToRemove] = dfsRemoveRfElems(currRfNode, expandDirection, reactFlow);
      console.log("nodes and edges to remove: ", nodesIdsToRemove, edgesIdsToRemove)
      reactFlow.setEdges((eds) => eds.filter(e => !edgesIdsToRemove.includes(e.id)));
      reactFlow.setNodes((nds) => { 
        let rfNodes = nds.filter(n => !nodesIdsToRemove.includes(n.id)); 
        rfNodes = computeLayout(rfNodes, reactFlow.getEdges(), layoutDirection);
        return rfNodes;
      });
      
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
    let nodes = createReactFlowNodes(partialGraphPair[0], 
                                     layout, 
                                     !onlyDirectNeighbours[0], 
                                     false,
                                     undefined,
                                     graphView, 
                                     expandNodeFunc, 
                                     props);
    let edges = createReactFlowEdges(partialGraphPair[1],
                                     props, 
                                     graphView, 
                                     undefined);
      return [nodes, edges];
  }

  // reset view port to the center of the lineage graph
  function resetViewPort(): void {
    const filteredCenterNode = nodes.filter(node => node.data.graphNodeProps.isCenterNode);
    const n = reactFlow.getNode(filteredCenterNode[0].id)
    reactFlow.fitView({ nodes: [n as ReactFlowNode], duration: 400 });
  }

  // reset the view port with the center node in the center
  function resetViewPortCentered(): void {
    const filteredCenterNode = nodes.filter(node => node.data.graphNodeProps.isCenterNode);
    const n = reactFlow.getNode(filteredCenterNode[0].id);
    const width = n?.width!;
    const height = n?.height!;
    reactFlow.setViewport({x: n?.positionAbsolute?.x! + width, y: n?.positionAbsolute?.y! + height, zoom: reactFlow?.getZoom() || 1})
  }

  // reset node styles on pane click
  function resetEdgeStyles(){
    reactFlow.setEdges((edge) => {
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
    reactFlow.setNodes((node) => {
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
  const [nodes,edges] = useMemo(() =>{
    [nodes_init, edges_init] = prepareAndRenderGraph();
    nodes_init = computeLayout(nodes_init, edges_init, layout);
    setReactFlowKey(reactFlowKey+1); // change key to re-create react flow component (and initialize it through default nodes)
    console.log("initialize flow");
    return [nodes_init, edges_init];
  }, [hidden, onlyDirectNeighbours, props, graphView, url, layout]);

  // reset viewport for init elems
  useEffect(() => {
    resetViewPortCentered();
  }, [nodes_init, edges_init]);

  // keep current graph state on layout
  // useEffect(() => {
  //   [nodes_init, edges_init] = prepareAndRenderGraph(true);
  // }, [layout])

  // TODO: don't reset the moved edges on click
  const onEdgeClick = (_event, edge: ReactFlowEdge) => {
    // highlight edge and src, target nodes' border
    resetEdgeStyles();
    resetNodeStyles();
    reactFlow.setNodes((n) => {
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
    reactFlow.setEdges((e) =>{
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
      resetViewPortCentered();
  }

  const handleResetViewPort = () => {
    resetViewPort();
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
          key={reactFlowKey}
          defaultNodes={nodes}
          defaultEdges={edges}
          defaultViewport={{x:0, y:0, zoom:1}}
          onEdgeClick={onEdgeClick}
          onPaneClick={() => {resetEdgeStyles(); resetNodeStyles();}}
          nodesConnectable={false} 
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.02}
          maxZoom={3}
        >
          {/* <MiniMap/>  */}
          <Controls />
          <Background/> {/* Background macht fehler "<pattern> attribute x: Expected length, "NaN"!*/}
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