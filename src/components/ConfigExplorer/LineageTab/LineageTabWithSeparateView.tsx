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
import ReactFlow, { applyEdgeChanges, applyNodeChanges, Background, MiniMap, Controls, Node as ReactFlowNode, Edge as ReactFlowEdge, MarkerType, isNode, Position } from 'react-flow-renderer';
import Dropdown from 'react-bootstrap/Dropdown';
import { useParams } from 'react-router-dom';
import { useNavigate } from "react-router-dom";

// mui imports
import Box from '@mui/material/Box';


// local imports
import {DAGraph, PartialDataObjectsAndActions, DataObjectsAndActionsSep } from '../../../util/ConfigExplorer/Graphs';
import { TaskStatus } from '../../../types';
import { ConfigData } from '../../../util/ConfigExplorer/ConfigData';
import { Node as GraphNode } from '../../../util/ConfigExplorer/Graphs';
import { Edge as GraphEdge } from '../../../util/ConfigExplorer/Graphs';
import { NodeType } from '../../../util/ConfigExplorer/Graphs';
import {CustomDataNode} from './LineageGraphComponents';
import { ReactFlowProvider } from 'reactflow';
import { ConsoleLogger } from '@aws-amplify/core';
import {DraggableLineageGraphToolBar} from './LineageGraphToolbar';

// TODO: add onHover references
// TODO: implement icon for showing node types etc.
// TODO: implement a nodeFactory? 
// TODO: statically store data graph, action graph and entire graph, custom grouping in graph attibutes

/*
 Add custom node and edge types
*/
const nodeTypes = {
  // turbo: TurboNode,
  customDataNode: CustomDataNode,
  // customActionNode: CustomActionNode,
}

// const edgeTypes = {
//   turbo: TurboEdge,
// };


// TODO: maybe add more parameters to the flowProps interface
export interface flowProps {
  elementName: string;
  elementType: string; // we have either dataObjects or actions now
  configData: ConfigData;
  runContext?: boolean;
}

export interface flowPropsWithSeparateDataAndAction extends flowProps {
  configData: ConfigData;
}

function createReactFlowNodes(dataObjectsAndActions: DAGraph, direction: string = 'TB', props: flowPropsWithSeparateDataAndAction): ReactFlowNode[] {
  const isHorizontal = direction === 'LR';
  const nodes = dataObjectsAndActions.nodes;
  var result: ReactFlowNode[] = []; 

  nodes.forEach((node)=>{
    const dataObject = node
    const nodeType = dataObject.nodeType;
    const newNode = {
      id: dataObject.id,
      type: 'customDataNode', // should match the name defined in custom node types
      position: {x: dataObject.position.x, y: dataObject.position.y},
      data: {
        props: props,
        label: dataObject.id, 
        isCenterNode: dataObject.isCenterNode, 
        nodeType: nodeType,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        // the following are hard coded for testing
        progress: nodeType === NodeType.ActionNode ? (Math.random()*100).toFixed(1) : undefined, 
        metric: "sum", 
        jsonObject: (nodeType === NodeType.ActionNode || nodeType === NodeType.DataNode) ? node.jsonObject : undefined,
      },

    } as ReactFlowNode

    result.push(newNode);
  });
  return result;
}


function createReactFlowEdges(dataObjectsAndActions: DAGraph, selectedEdgeId: string | undefined): ReactFlowEdge[] {
  var result: ReactFlowEdge[] = [];
  const labelColor = '#fcae1e';

  dataObjectsAndActions.edges.forEach(edge => {
    //const action = edge as Action; //downcasting in order to access jsonObject
    const action = edge; //downcasting in order to access jsonObjectsourcePosition: 'right',
    const selected = selectedEdgeId === action.id;
    var newEdge = {} as ReactFlowEdge;

    if (edge.toNode.id === undefined || edge.fromNode.id === undefined) {
      throw Error("Edge has no source or target");
    }

    newEdge = {
      // : action.id, //what we use for linking
      id: action.id + action.fromNode.id+action.toNode.id, //because it has to be unique
      source: action.fromNode.id,
      target: action.toNode.id,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 10,
        height: 10,
        color: '#096bde',
      },
      data: {
        label_copy: action.id,
        old_id: action.id
      },
      labelBgPadding: [7, 7],
      labelBgBorderRadius: 8,
      labelBgStyle: { fill: selected ? labelColor : '#fff', fillOpacity: selected ? 1 : 0.75, stroke:  labelColor}, 
      style: { stroke: '#096bde', strokeWidth: 2},
      // animated:  true, 
    };
    result.push(newEdge);
  });

  return result;
}


/*
  Implements the Lineage tab for separated action and dataObject view
  edge labels will be replaced by action nodes in the full graph view

  TODO list:
  -adapt & add effect and state functions for all views
  -buttons for switching between data and action view and full graph view
  -grouping by attributes ( see JsonSchemaViewer https://smartdatalake.ch/json-schema-viewer for which atttributes can be used, i.e. jsonObject.type in Graph constructor)
  -implement graph layout setter as getDataGraph, getActionGraph and keep a whole graph view, the performance can be optimized later
*/
function LineageTabSep(props: flowPropsWithSeparateDataAndAction) {
   // initialization 
   const url = useParams();
 
   let nodes_init: ReactFlowNode[] = [];
   let edges_init: ReactFlowEdge[] = [];
 
   const [graphView, setGraphView] = useState('full'); // control for action/data/full graph view 
   const [onlyDirectNeighbours, setOnlyDirectNeighbours] = useState([true, 'Expand Graph']); // can be simplified as well
   const [layout, setLayout] = useState('TB');
   let [hidden, setHidden] = useState(useParams().elemelsntType === 'dataObjects' ? true : false); 
  
   let initial_render = prepareAndRenderGraph();
   const [nodes, setNodes] = useState(initial_render[0]);
   const [edges, setEdges] = useState(initial_render[1]);
 
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
    // what about initial state?
    if (graphView === 'full'){ 
      doa = props.configData.fullGraph!;
    } else if (graphView === 'data'){
      doa = props.configData.dataGraph!;
      if(props.elementType === 'actions'){ 
        // switch to data graph when an action is selected -> select the first data node id
        centralNodeId = props.configData.dataGraph!.levelOneNodes[0].id;
      }
    } else if (graphView === 'action'){
      doa = props.configData.actionGraph!;
      if (props.elementType === 'dataObjects'){ 
        // switch to action graph when a data object is selected -> select, should only be possible on first change
        centralNodeId = props.configData.actionGraph!.levelOneNodes[0].id;
      }
    } else {
      throw Error("Unknown graph view " + graphView);
    }

    partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighbours(centralNodeId) : doa.returnPartialGraphInputs(centralNodeId);
    const partialGraph = new PartialDataObjectsAndActions(partialGraphPair[0],partialGraphPair[1], layout, props.configData);
        
    console.log("partial graph: ", partialGraph)
    let nodes = createReactFlowNodes(partialGraph, layout, props);
    let edges = createReactFlowEdges(partialGraph, undefined);
    return [nodes, edges];
  }

  // TODO: the edges remain on every click, might be because that the centralNode id is not correctly set (or we just don't use it because of renamings)
  useEffect(() =>{
    [nodes_init, edges_init] = prepareAndRenderGraph();
    setNodes(nodes_init);
    setEdges(edges_init); // set edge visibility
  }, [hidden, layout, onlyDirectNeighbours, props, graphView]);

  // Nodes and edges can be moved. Used "any" type as first, non-clean implementation. 
  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds: any) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds: any) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  
  return (
    <Box
      className='data-flow'
      ref={chartBox}
      sx={{
        height: '100%',
      }}
    >
      <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            defaultPosition={[0, 0]}
            // onNodeClick={(event, node) => {!props.runContext && clickOnNode(node)}}
            // onEdgeClick={(event, edge) => {!props.runContext && clickOnEdge(edge)}}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodesConnectable={false} 
            nodeTypes={nodeTypes}
          >
            <Background/>
            <MiniMap/> 
            <Controls />

          </ReactFlow>
          <DraggableLineageGraphToolBar
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
          />
        </ReactFlowProvider>
      </Box>
    );}

export default LineageTabSep;