import { useState, useCallback, useEffect, useRef} from 'react';
import ReactFlow, { applyEdgeChanges, applyNodeChanges, Background, MiniMap, Controls, Node, Edge, MarkerType, isNode, Position } from 'react-flow-renderer';
import DataObjectsAndActions, { Action, DAGraph, PartialDataObjectsAndActions, computeNodePositions } from '../../util/ConfigExplorer/Graphs';
import { useNavigate } from "react-router-dom";
import './ComponentsStyles.css';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import AlignHorizontalLeftIcon from '@mui/icons-material/AlignHorizontalLeft';
import AlignVerticalTopIcon from '@mui/icons-material/AlignVerticalTop';
import { useParams } from 'react-router-dom';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import DownloadButton from './DownloadLineageButton';
import { ConfigData } from '../../util/ConfigExplorer/ConfigData';
import { Box, IconButton } from '@mui/joy';
import { TaskStatus } from '../../types';
import dagre from 'dagre';
import { AlignVerticalTop } from '@mui/icons-material';
import AlignHorizontalLeft from '@mui/icons-material/AlignHorizontalLeft';

import { Node as GraphNode } from '../../util/ConfigExplorer/Graphs';
import { Edge as GraphEdge } from '../../util/ConfigExplorer/Graphs';

// TODO: store the graph and its different layouts statically
// TODO: add onHover references
// TODO: implement icon for showing node types etc.

function createReactFlowNodes(dataObjectsAndActions: DAGraph, direction: string = 'TB'): Node[] {
  const isHorizontal = direction === 'LR';
  var result: Node[] = []; 

  dataObjectsAndActions.nodes.forEach((node)=>{
    //const dataObject = node as DataObject; //downcasting in order to be able to access the JSONObject attribute
    const dataObject = node
    
    result.push({
      id: dataObject.id,
      position: {x: dataObject.position.x, y: dataObject.position.y},
      data: {label: dataObject.id, isCenterNode: dataObject.isCenterNode},
      style: {background: dataObject.backgroundColor},
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom
      //jsonString: JSON.stringify(dataObject.jsonObject, null, '\t'), //Do we need this??
    })
  });
  return result;
}


function createReactFlowEdges(dataObjectsAndActions: DAGraph, selectedEdgeId: string | undefined): Edge[] {
  var result: Edge[] = [];
  const labelColor = '#fcae1e';

  dataObjectsAndActions.edges.forEach(edge => {
    //const action = edge as Action; //downcasting in order to access jsonObject
    const action = edge; //downcasting in order to access jsonObjectsourcePosition: 'right',
    const selected = selectedEdgeId === action.id;

    result.push({
      // old_id: action.id, //what we use for linking
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
      labelBgStyle: { fill: selected ? labelColor : '#fff', fillOpacity: selected ? 1 : 0.75, stroke:  labelColor}, // TODO: add fill color for clicked edge
      //jsonString: JSON.stringify(action.jsonObject, null, '\t'),
      style: { stroke: '#096bde', strokeWidth: 2},
      // type: 'runLineage',
      animated:  true, // TODO: only set edges that have been run and add description for the edges
    });
  });
  return result;
}


interface flowProps {
  elementName: string;
  elementType: string;
  configData?: ConfigData;
  graph?: PartialDataObjectsAndActions;
  runContext?: boolean;
}

type flowNodeWithString = Node<any> & {jsonString?:string} //merge Node type of ReactFlow with an (optional) String attribute. 

type flowEdgeWithString = Edge<any> & {jsonString?:string} & {old_id?: string}


function LineageTab(props: flowProps) {
  
  // initialization 
  console.log("call LineageTab");
  const url = useParams();
  const doa = props.graph ? props.graph : new DataObjectsAndActions(props.configData); 

  let nodes_init: Node[] = [];
  let edges_init: Edge[] = [];

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

  function prepareAndRenderGraph(): [Node[], Edge[]] {
    var partialGraphPair: [GraphNode[],GraphEdge[]] = [[],[]];

    if (props.elementType==='dataObjects'){ //only a partial graph
      partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighbours(props.elementName) : doa.returnPartialGraphInputs(props.elementName);
    }
    else if(props.elementType==='actions'){
      partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighboursFromEdge(props.elementName) : doa.returnPartialGraphInputsFromEdge(props.elementName);
    } else {
      throw Error("Unknown type" + props.elementType)
    }

    const partialGraph = new PartialDataObjectsAndActions(partialGraphPair[0],partialGraphPair[1], layout);
    let nodes = createReactFlowNodes(partialGraph, layout);
    let edges = createReactFlowEdges(partialGraph, selectedEdgeId);
    return [nodes, edges];
  }

  function showLabels(edges: Edge[]) {
    return edges.map(e => {
      e.label = (hidden ? '' : e.data.label_copy);
      return e;
    })
  };

  function clickOnNode(node: flowNodeWithString){
    if (props.configData) {
      navigate(`/config/dataObjects/${node.id}`);
    }
    setSelectedEdgeId(''); // revert filled action label (this will, however, always change, if we navigate from the config tab)
  } 

  function clickOnEdge(edge: flowEdgeWithString){
    if (props.configData) { 
      navigate(`/config/actions/${edge.data.old_id}`); //Link programmatically
    } else {
      navigate( `/workflows/${url.flowId}/${url.runNumber}/${url.taskId}/${url.tab}/${edge.data.old_id}`);
    }
    setSelectedEdgeId(edge.data.old_id);
  }
 

  // Effects 
  /*
    Re-render the lineage graph on:

    1. layout change
    2. graph expansion/collapse. 
    3. edge label visibility set

    The labels have to be set again or they will not be visible if we
    have previousely set them.

    TODO: maybe we shouldn't rerender the graph if we navigate while the graph is expanded?
  */
  useEffect(() =>{
    [nodes_init, edges_init] = prepareAndRenderGraph();
    setNodes(nodes_init);
    setEdges(edges_init); // set edge visibility
    setEdges(             // set edge label visibility
      (eds) => showLabels(eds)
    );
  }, [hidden, layout, onlyDirectNeighbours, props]);

  //Nodes and edges can be moved. Used "any" type as first, non-clean implementation. 
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
      <ReactFlow 
        nodes={nodes}
        edges={edges}
        defaultPosition={[0,0]} 
        onNodeClick={(event, node) => {!props.runContext && clickOnNode(node)}}
        onEdgeClick={(event, edge) => {!props.runContext && clickOnEdge(edge)}}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesConnectable={false} //prevents adding new edges
        // onNodeMouseEnter={(event, node) =>{}}
        // onNodeMouseLeave={}
        // onEdgeMouseEnter={}
        // onEdgeMouseLeave={}
      >
        <Background />
        <MiniMap />
        <Controls />
        <Box sx={{position: 'absolute', left: 9, bottom: 135, display: 'flex', flexDirection: 'column-reverse'}}>

        
        <div title ={layout == 'TB' ? 'switch to horizontal layout' : 'switch to vertical layout'} className="controls" style={{zIndex: 4, cursor: 'pointer'}}>
          <IconButton 
            color={'neutral'}
            onClick={() => setLayout(layout == 'TB' ? 'LR' : 'TB')}>
            {layout == 'TB' ? <AlignVerticalTop/> : <AlignHorizontalLeft/>}
          </IconButton>
        </div>

        <div title='Display / Hide action IDs' style={{ zIndex: 4, cursor: 'pointer' }}> 
          <IconButton 
            color={hidden ? 'neutral' : 'primary'}
            onClick={() => setHidden(!hidden)}>
            <RocketLaunchOutlined />
          </IconButton>
        </div>

        {props.configData && <div title={onlyDirectNeighbours[1] as string} style={{  zIndex: 4, cursor: 'pointer' }}>
          <IconButton 
            color='neutral'
            onClick={expandGraph}>
            {onlyDirectNeighbours[0] ? <OpenWithIcon/> : <CloseFullscreenIcon/>}
          </IconButton>
        </div>}

        <div title='Download image as PNG file' style={{ zIndex: 4, cursor: 'pointer' }}>
          <DownloadButton />
        </div>
        </Box>
      </ReactFlow>
    </Box>
  );
}

export default LineageTab;
