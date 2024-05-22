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
import { useState, useCallback, useEffect, useRef, useMemo} from 'react';
import ReactFlow, {Background, MiniMap, Controls, Node as ReactFlowNode, Edge as ReactFlowEdge,
   MarkerType, Position, updateEdge } from 'react-flow-renderer';
import { useParams } from 'react-router-dom';
import { useNavigate } from "react-router-dom";
import { Panel, useViewport, useNodesState, useEdgesState, ReactFlowInstance, NodeChange } from 'reactflow';

// mui imports
import Box from '@mui/material/Box';

// local imports
import {DAGraph, PartialDataObjectsAndActions, DataObjectsAndActionsSep } from '../../../util/ConfigExplorer/Graphs';
import { ConfigData } from '../../../util/ConfigExplorer/ConfigData';
import { Node as GraphNode } from '../../../util/ConfigExplorer/Graphs';
import { Edge as GraphEdge } from '../../../util/ConfigExplorer/Graphs';
import { NodeType } from '../../../util/ConfigExplorer/Graphs';
import {CustomDataNode, CustomEdge} from './LineageGraphComponents';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import {DraggableLineageGraphToolbar, LineageGraphToolbar} from './LineageGraphToolbar';

// TODO: add onHover references
// TODO: implement a nodeFactory? 

/*
Global styles to be refactored
*/
const labelColor = '#fcae1e';
const defaultEdgeColor = '#b1b1b7';
const highLightedEdgeColor = '#096bde';

const defaultEdgeStrokeWidth = 3
const highlightedEdgeStrokeWidth = 5;


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
  connection: any;
  configData?: ConfigData;
  runContext?: boolean;
}


function createReactFlowNodes(dataObjectsAndActions: DAGraph, direction: string = 'TB', props: flowProps): ReactFlowNode[] {
  const isHorizontal = direction === 'LR';
  const nodes = dataObjectsAndActions.nodes;
  const targetPos = isHorizontal ? Position.Left : Position.Top;
  const sourcePos = isHorizontal ? Position.Right : Position.Bottom;
  var result: ReactFlowNode[] = []; 

  // If we need more information to be displayed on the node, 
  // just add more fields to the flowProps interface and access it in the custom node component.
  // The additional props can be passed in ElementDetails where the LineageTab is opened.
  nodes.forEach((node)=>{
    const dataObject = node
    const nodeType = dataObject.nodeType;
    const newNode = {
      id: dataObject.id,
      type: 'customDataNode',   // should match the name defined in custom node types
      position: {x: dataObject.position.x, y: dataObject.position.y},
      targetPosition: targetPos, // required for the node positions to actually change internally
      sourcePosition: sourcePos,
      data: {
        props: props,         
        label: dataObject.id, 
        isCenterNode: dataObject.isCenterNode, 
        nodeType: nodeType,
        targetPosition: targetPos,
        sourcePosition: sourcePos,
        // the following are hard coded for testing
        progress: nodeType === NodeType.ActionNode ? (Math.random()*100).toFixed(1) : undefined, 
        jsonObject: (nodeType === NodeType.ActionNode || nodeType === NodeType.DataNode) ? node.jsonObject : undefined,
      },

    } as ReactFlowNode
    result.push(newNode);
  });
  return result;
}


function createReactFlowEdges(dataObjectsAndActions: DAGraph, selectedEdgeId: string | undefined): ReactFlowEdge[] {
  var result: ReactFlowEdge[] = [];
  const edgeColor = selectedEdgeId ? highLightedEdgeColor : defaultEdgeColor;

  dataObjectsAndActions.edges.forEach(edge => {
    const selected = selectedEdgeId === edge.id;
    const uniqueId =  edge.id + edge.fromNode.id+edge.toNode.id;
    const fromNodeId = edge.fromNode.id;
    const toNodeId = edge.toNode.id;
    var newEdge = {} as ReactFlowEdge;

    if (edge.toNode.id === undefined || edge.fromNode.id === undefined) {
      throw Error("Edge has no source or target");
    }
    newEdge = {
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
      // animated:  true, 
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
 
   const [graphView, setGraphView] = useState('full'); // control for action/data/full graph view 
   const [onlyDirectNeighbours, setOnlyDirectNeighbours] = useState([true, 'Expand Graph']); // can be simplified as well
   const [layout, setLayout] = useState('TB');
   let [hidden, setHidden] = useState(useParams().elemelsntType === 'dataObjects' ? true : false); 

   const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | undefined>(undefined);
  
   const [nodes, setNodes] = useState<ReactFlowNode<any>[]>([]);
   const [edges, setEdges] = useState<ReactFlowEdge<any>[]>([]);
 
   const navigate = useNavigate();            // handlers for navigating dataObjects and actions
   const chartBox = useRef<HTMLDivElement>(); // container holding SVG needs manual height resizing to fill 100%

   // helper functions
   function expandGraph(): void {
    let buttonMessage = onlyDirectNeighbours[0] ? 'Compress Graph' : 'Expand Graph';
    setOnlyDirectNeighbours([!onlyDirectNeighbours[0], buttonMessage]);
  }

  function prepareAndRenderGraph(): [ReactFlowNode[], ReactFlowEdge[]] { // 
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
    doa.nodes.forEach(node => {
      node.isCenterNode = false;
    }) 

    // When the layout has changed, the nodes and edges have to be recomputed
    partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighbours(centralNodeId) : doa.returnPartialGraphInputs(centralNodeId);
    const partialGraph = new PartialDataObjectsAndActions(partialGraphPair[0],partialGraphPair[1], layout, props.configData);
    let nodes = createReactFlowNodes(partialGraph, layout, props);
    let edges = createReactFlowEdges(partialGraph, undefined);
    return [nodes, edges];
  }


  // reset view port to the center of the lineage graph
  function resetViewPort(rfi: ReactFlowInstance | null): void {
    const filteredCenterNode = nodes.filter(node => node.data.isCenterNode);
    if (rfi && nodes?.length) {
      const n = rfi.getNode(filteredCenterNode[0].id)
      rfi.fitView({ nodes: [n as ReactFlowNode], duration: 400 });
    }
  }

  // reset the view port with the center node in the center
  function resetViewPortCentered(rfi: ReactFlowInstance | null): void {
    const filteredCenterNode = nodes.filter(node => node.data.isCenterNode);
    if (rfi && nodes?.length) {
      const n = rfi.getNode(filteredCenterNode[0].id)
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

  // defines the conditions to (re-)render the lineage graph
  useEffect(() =>{
    [nodes_init, edges_init] = prepareAndRenderGraph();
    setNodes(nodes_init);
    setEdges(edges_init); 
    resetViewPortCentered(reactFlowInstance!);
  }, [hidden, layout, onlyDirectNeighbours, props, graphView, url, reactFlowInstance]);

  // set reactflow instance on init so that we can access the internal state of it
  const onInit = (rfi) => {
    setReactFlowInstance(rfi);
  };

  const onEdgeClick = (_event, edge) => {
    resetEdgeStyles();
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
          onPaneClick={resetEdgeStyles}
          nodesConnectable={false} 
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.02}
          maxZoom={1}
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