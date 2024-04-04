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
import { useState, useCallback, useEffect, useRef} from 'react';
import ReactFlow, { applyEdgeChanges, applyNodeChanges, Background, MiniMap, Controls, Node as ReactFlowNode, Edge as ReactFlowEdge, MarkerType, isNode, Position } from 'react-flow-renderer';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Dropdown from 'react-bootstrap/Dropdown';
import { useParams } from 'react-router-dom';
import { useNavigate } from "react-router-dom";

// mui imports
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import AlignHorizontalLeftIcon from '@mui/icons-material/AlignHorizontalLeft';
import AlignVerticalTopIcon from '@mui/icons-material/AlignVerticalTop';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import { Box, IconButton } from '@mui/joy';
import { AlignVerticalTop } from '@mui/icons-material';
import AlignHorizontalLeft from '@mui/icons-material/AlignHorizontalLeft';

// local imports
import './ComponentsStyles.css';
import DownloadButton from './DownloadLineageButton';
import {DAGraph, PartialDataObjectsAndActions, DataObjectsAndActionsSep } from '../../util/ConfigExplorer/Graphs';
import { TaskStatus } from '../../types';
import { ConfigData } from '../../util/ConfigExplorer/ConfigData';
import { Node as GraphNode } from '../../util/ConfigExplorer/Graphs';
import { Edge as GraphEdge } from '../../util/ConfigExplorer/Graphs';
import { NodeType } from '../../util/ConfigExplorer/Graphs';
import {TurboNode,  TurboEdge, CustomNode} from './LineageTabComponents';
import { ReactFlowProvider } from 'reactflow';


// todo: add new libs to project setup, package.json
// TODO: store the graph and its different layouts statically
// TODO: add onHover references
// TODO: implement icon for showing node types etc.
// TODO: implement a nodeFactory? 
// TODO: statically store data graph, action graph and entire graph, custom grouping in graph attibutes

const nodeTypes = {
  turbo: TurboNode,
  custom: CustomNode,
};

const edgeTypes = {
  turbo: TurboEdge,
};

// TODO: maybe add more parameters to the flowProps interface
interface flowProps {
  elementName: string;
  elementType: string;
  configData?: ConfigData;
  graph?: PartialDataObjectsAndActions;
  runContext?: boolean;
}

interface flowPropsWithSeparateDataAndAction extends flowProps {
  dataGraph?: PartialDataObjectsAndActions;   // dataobject only
  actionGraph?: PartialDataObjectsAndActions; // actions only  
  // member "graph" is a graph with both data and actions, without labels or minimal label information
}



function createReactFlowNodes(dataObjectsAndActions: DAGraph, direction: string = 'TB'): ReactFlowNode[] {
  const isHorizontal = direction === 'LR';
  var result: ReactFlowNode[] = []; 

  dataObjectsAndActions.nodes.forEach((node)=>{
    //const dataObject = node as DataObject; //downcasting in order to be able to access the JSONObject attribute
    const dataObject = node
    const nodeType = dataObject.nodeType;
    var newNode: ReactFlowNode = {} as ReactFlowNode;

    if (nodeType === NodeType.DataNode){
      newNode = {
        id: dataObject.id,
        position: {x: dataObject.position.x, y: dataObject.position.y},
        data: {label: dataObject.id, 
               isCenterNode: dataObject.isCenterNode, 
               nodeType: nodeType
        },
        style: {background: dataObject.backgroundColor},
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        // type: 'custom', // should match the name defined in custom node types
      };

    } else if (nodeType === NodeType.ActionNode){ // currently copied from dataNode
      newNode = {
        id: dataObject.id,
        position: {x: dataObject.position.x, y: dataObject.position.y},
        data: {label: dataObject.id, 
               isCenterNode: dataObject.isCenterNode,
               nodeType: nodeType},
        style: {background: dataObject.backgroundColor},
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        // type: 'custom',
      };

    } else {
      throw Error("Node type " + (typeof nodeType) + "  not supported");
    }

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
      console.log(edge.source);
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
      animated:  true, 
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
   const fullGraph = props.graph ? props.graph : new DataObjectsAndActionsSep(props.configData); 
   const dataGraph = props.dataGraph ? props.actionGraph : fullGraph.getDataGraph(); // TODO: needs to be implemented 
   const actionGraph = props.actionGraph ? props.actionGraph :  fullGraph.getActionGraph();
 
   let nodes_init: ReactFlowNode[] = [];
   let edges_init: ReactFlowEdge[] = [];
 
   const [graphView, setGraphView] = useState('full'); // control for action/data/full graph view 
   const [onlyDirectNeighbours, setOnlyDirectNeighbours] = useState([true, 'Expand Graph']); // can be simplified as well
   const [layout, setLayout] = useState('TB');
   const [selectedEdgeId, setSelectedEdgeId] = useState<string | undefined>(''); // wird verschwinden mit anderer Sicht
   let [hidden, setHidden] = useState(useParams().elementType === 'dataObjects' ? true : false); 
  
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
    if (graphView === 'full'){ // TODO: customize choice
      doa = fullGraph;
    } else if (graphView === 'data'){
      doa = dataGraph as PartialDataObjectsAndActions;
    } else if (graphView === 'actions'){
      doa = actionGraph as PartialDataObjectsAndActions;
    } else {
      throw Error("Unknown graph view " + graphView);
    }

    // TODO: we need a third button for the full graph view? not sure if we need type distinction here
    // if (props.elementType==='dataObjects'){
    //   partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighbours(props.elementName) : doa.returnPartialGraphInputs(props.elementName);
    // }    else {
    //   throw Error("Unknown type" + props.elementType)
    // }
    // else if(props.elementType==='actions'){
    //   partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighboursFromEdge(props.elementName) : doa.returnPartialGraphInputsFromEdge(props.elementName);
    // } 
    partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighbours(props.elementName) : doa.returnPartialGraphInputs(props.elementName);
    const partialGraph = new PartialDataObjectsAndActions(partialGraphPair[0],partialGraphPair[1], layout);
    let nodes = createReactFlowNodes(partialGraph, layout);
    let edges = createReactFlowEdges(partialGraph, selectedEdgeId);
    return [nodes, edges];
  }

  // we don't need labels for now
  function showLabels(edges: ReactFlowEdge[]) {
    return edges.map(e => {
      e.label = (hidden ? '' : e.data.label_copy);
      return e;
    })
  };


  // node type distinction
  function clickOnNode(node: ReactFlowNode){
    let propsHasConfigData = props.configData;
    console.log(node.data.nodeType + "is the node type");

    if(node.data.nodeType === NodeType.DataNode){
      console.log("action");
      if(propsHasConfigData){
        navigate(`/config/dataObjects/${node.id}`); 
      }
      setSelectedEdgeId(''); // revert filled action label (this will, however, always change, if we navigate from the config tab)

    } else if (node.data.nodeType === NodeType.ActionNode){

      if(propsHasConfigData){
        navigate(`/config/actions/${node.id}`);
      } else {
        navigate(`/workflows/${url.flowId}/${url.runNumber}/${url.taskId}/${url.tab}/${node.id}`);
      }
      setSelectedEdgeId(node.data.old_id);

    } else {
      throw Error("Unknown node type: " + node.data.nodeType);
    }
   
  } 

  // can be removed or implement other stuff here after clickOnNode is implemented
  function clickOnEdge(edge: ReactFlowEdge){
    
  }

  // a handler for changing the view
  // actual view change is done in prepareAndRenderGraph
  // a dropdown item may not always have an eventKey defined, thus we use a null check
  const handleViewChange = (eventKey: string | null) => {
    if (eventKey !== null) {
    setGraphView(eventKey);
    }
  }


  // TODO: add / adjust Effects 
  useEffect(() =>{
    [nodes_init, edges_init] = prepareAndRenderGraph();
    setNodes(nodes_init);
    setEdges(edges_init); // set edge visibility
    setEdges(             // set edge label visibility
      (eds) => showLabels(eds)
    );
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

// TODO: integrate new components
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
          onNodeClick={(event, node) => {!props.runContext && clickOnNode(node)}}
          // onEdgeClick={(event, edge) => {!props.runContext && clickOnEdge(edge)}}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodesConnectable={false} //prevents adding new edges
          nodeTypes={nodeTypes}
        >
          <Background/>
          <MiniMap
            nodeStrokeColor={(n) => {
              if (n.style?.background) return n.style.background.toString();
              if (n.type === 'input') return '#0041d0';
              if (n.type === 'output') return '#ff0072';
              if (n.type === 'default') return '#1a192b';

              return '#eee';
            }}
            nodeColor={(n) => {
              if (n.style?.background) return n.style.background.toString();

              return '#fff';
            }}
            nodeBorderRadius={2}
          />
          <Controls />
          <Box
            sx={{
              position: 'absolute',
              left: 9,
              bottom: 135,
              display: 'flex',
              flexDirection: 'column-reverse',
            }}
          >
            <div style={{ position: 'absolute', bottom: '20px', right: '20px' }}>
              <DropdownButton
                id="graph-view-dropdown"
                title={graphView ? graphView : 'Select View'}
                onSelect={handleViewChange}
              >
                <Dropdown.Item eventKey={"data"}>Data Graph</Dropdown.Item>
                <Dropdown.Item eventKey={"action"}>Action Graph</Dropdown.Item>
                <Dropdown.Item eventKey={"full"}>Full Graph</Dropdown.Item>
              </DropdownButton>
            </div>

            <div
              title={layout === 'TB' ? 'switch to horizontal layout' : 'switch to vertical layout'}
              className="controls"
              style={{ zIndex: 4, cursor: 'pointer' }}
            >
              <IconButton
                color={'neutral'}
                onClick={() => setLayout(layout === 'TB' ? 'LR' : 'TB')}
              >
                {layout === 'TB' ? <AlignVerticalTop /> : <AlignHorizontalLeft />}
              </IconButton>
            </div>

            <div
              title='Display / Hide action IDs'
              style={{ zIndex: 4, cursor: 'pointer' }}
            >
              <IconButton
                color={hidden ? 'neutral' : 'primary'}
                onClick={() => setHidden(!hidden)}
              >
                <RocketLaunchOutlined />
              </IconButton>
            </div>

            {props.configData && (
              <div
                title={onlyDirectNeighbours[1] as string}
                style={{ zIndex: 4, cursor: 'pointer' }}
              >
                <IconButton
                  color='neutral'
                  onClick={expandGraph}
                >
                  {onlyDirectNeighbours[0] ? <OpenWithIcon /> : <CloseFullscreenIcon />}
                </IconButton>
              </div>
            )}

            <div
              title='Download image as PNG file'
              style={{ zIndex: 4, cursor: 'pointer' }}
            >
              <DownloadButton />
            </div>
          </Box>
        </ReactFlow>
      </ReactFlowProvider>
    </Box>
  );
}

export default LineageTabSep;