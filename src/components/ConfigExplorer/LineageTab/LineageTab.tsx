import { AlignVerticalTop } from '@mui/icons-material';
import AlignHorizontalLeft from '@mui/icons-material/AlignHorizontalLeft';
import { Box, IconButton } from '@mui/joy';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, { Background, Controls, Edge, MarkerType, Node, Position, applyEdgeChanges, applyNodeChanges } from 'reactflow';
import { useNavigate, useParams } from "react-router-dom";
import { ConfigData } from '../../../util/ConfigExplorer/ConfigData';
import DataObjectsAndActions, { DAGraph, PartialDataObjectsAndActions } from '../../../util/ConfigExplorer/Graphs';
import '../ComponentsStyles.css';

import { ReactFlowProvider } from 'reactflow';
import { NodeType } from '../../../util/ConfigExplorer/Graphs';

// accessed as ag attributes
interface flowProps {
  elementName: string;
  elementType: string;
  configData?: ConfigData;
  graph?: PartialDataObjectsAndActions;
  runContext?: boolean;
}

type flowNodeWithString = Node<any> & {jsonString?:string} //merge Node type of ReactFlow with an (optional) String attribute. 

type flowEdgeWithString = Edge<any> & {jsonString?:string} & {old_id?: string}



function createReactFlowNodes(dataObjectsAndActions: DAGraph, direction: string = 'TB'): Node[] {
  const isHorizontal = direction === 'LR';
  var result: Node[] = []; 

  dataObjectsAndActions.nodes.forEach((node)=>{
    //const dataObject = node as DataObject; //downcasting in order to be able to access the JSONObject attribute
    const dataObject = node
    const nodeType = dataObject.nodeType;
    var newNode: Node = {} as Node;

    if (nodeType === NodeType.DataNode){
      newNode = {
        id: dataObject.id,
        position: {x: dataObject.position.x, y: dataObject.position.y},
        data: {label: dataObject.id, 
          isCenterNode: dataObject.isCenterNode, 
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
        data: {label: dataObject.id, isCenterNode: dataObject.isCenterNode},
        style: {background: dataObject.backgroundColor},
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        type: 'default',
      };

    } else {
      throw Error("Node type " + (typeof nodeType) + "  not supported");
    }

    result.push(newNode);
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
    var newEdge = {} as Edge;

    if (edge.toNode.id === undefined || edge.fromNode.id === undefined) {
      throw Error("Edge has no source or target");
    }

    newEdge = {
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
      labelBgStyle: { fill: selected ? labelColor : '#fff', fillOpacity: selected ? 1 : 0.75, stroke:  labelColor}, 
      style: { stroke: '#096bde', strokeWidth: 2},
      animated:  true, 
    };
    result.push(newEdge);
  });

  return result;
}

/*
  Older version of Lineage Tab, implements actions as edges and dataObjects as nodes
  edge labels are overlapping 
*/
function LineageTab(props: flowProps) {
  
  // initialization 
  const url = useParams();
  const doa = props.graph ? props.graph : new DataObjectsAndActions(props.configData); 

  let nodes_init: Node[] = [];
  let edges_init: Edge[] = [];

  const [layout, setLayout] = useState('TB');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | undefined>(''); // wird verschwinden mit anderer Sicht
 
  let initial_render = prepareAndRenderGraph();
  const [nodes, setNodes] = useState(initial_render[0]);
  const [edges, setEdges] = useState(initial_render[1]);

  const navigate = useNavigate();            // handlers for navigating dataObjects and actions
  const chartBox = useRef<HTMLDivElement>(); // container holding SVG needs manual height resizing to fill 100%


  // helper functions
  function prepareAndRenderGraph(): [Node[], Edge[]] {
    // fixed ActionGraph for now
    let actionGraph = doa.getActionGraph();
    actionGraph.setLayout(layout);
    let nodes = createReactFlowNodes(actionGraph, layout);
    let edges = createReactFlowEdges(actionGraph, selectedEdgeId);
   
    return [nodes, edges];
  }

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
  useEffect(() =>{
    [nodes_init, edges_init] = prepareAndRenderGraph();
    setNodes(nodes_init);
    setEdges(edges_init); // set edge visibility
  }, [layout, props]);

  //Nodes and edges can be moved. Used "any" type as first, non-clean implementation. 
  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds: any) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds: any) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  

  // caveat: to avoid Zustand error, the Reactflow element with custom implementation of nodes/edges has to be wrapped
  // within the ReactflowProvider Tag as direct children, not in separate files
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
        defaultViewport={{x:0, y:0, zoom:1}} 
        onNodeClick={(event, node) => {!props.runContext && clickOnNode(node)}}
        onEdgeClick={(event, edge) => {!props.runContext && clickOnEdge(edge)}}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesConnectable={false} //prevents adding new edges
      >
        <Background/>
        <Controls />
        <Box sx={{position: 'absolute', left: 9, bottom: 135, display: 'flex', flexDirection: 'column-reverse'}}>

        
        <div title ={layout == 'TB' ? 'switch to horizontal layout' : 'switch to vertical layout'} className="controls" style={{zIndex: 4, cursor: 'pointer'}}>
          <IconButton 
            color={'neutral'}
            onClick={() => setLayout(layout == 'TB' ? 'LR' : 'TB')}>
            {layout == 'TB' ? <AlignVerticalTop/> : <AlignHorizontalLeft/>}
          </IconButton>
        </div>

        </Box>
      </ReactFlow>
      </ReactFlowProvider>
    </Box>
  );
}

export default LineageTab;
