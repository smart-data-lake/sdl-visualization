import { Box, IconButton } from '@mui/material';
import { useState, useCallback, useEffect, useRef} from 'react';
import ReactFlow, { applyEdgeChanges, applyNodeChanges, Background, MiniMap, Controls, Node, Edge, MarkerType, useReactFlow } from 'react-flow-renderer';
import DataObjectsAndActions, { DAGraph, PartialDataObjectsAndActions } from '../../util/ConfigExplorer/Graphs';
import { useNavigate } from "react-router-dom";
import './ComponentsStyles.css';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import { useParams } from 'react-router-dom';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import DownloadButton from './DownloadLineageButton';
import { Lineage } from '../../util/WorkflowsExplorer/Lineage';
import Run from '../WorkflowsExplorer/Run/Run';
import RunLineageEdge from '../WorkflowsExplorer/Run/RunLineageEdge';



function createReactFlowNodes(dataObjectsAndActions: DAGraph){
  var result: any[] = [];
  dataObjectsAndActions.nodes.forEach((node)=>{
    //const dataObject = node as DataObject; //downcasting in order to be able to access the JSONObject attribute
    const dataObject = node
    result.push({
      id: dataObject.id,
      position: {x: dataObject.position.x, y: dataObject.position.y},
      data: {label: dataObject.id},
      style: {background: dataObject.backgroundColor},
      isCenterNode: dataObject.isCenterNode,
      //jsonString: JSON.stringify(dataObject.jsonObject, null, '\t'), //Do we need this??
    })
  });
  return result;
}


/**
 * DEPRECATED: Uses Deprecated class "DAGraph_Old" that calculates the levels
 * of each node in order to layyer them. The method is replaced by the dagre library
 * for the layout functions.
 */
function createReactFlowNodes_Old(dataObjectsAndActions: DAGraph){
  var result: any[] = [];
  var nodeType = 'default';
  for (let currentLevel = 0; currentLevel<dataObjectsAndActions.levels.length; currentLevel++){
    if(currentLevel===0){nodeType = 'input'}
    else if(currentLevel===dataObjectsAndActions.levels.length){nodeType = 'output'}
    else {nodeType = 'default'}
    
    const nodesInLevel = dataObjectsAndActions.nodes.filter(node => node.level === currentLevel);
    //const dataObjectsInLevel = nodesInLevel as DataObject[];
    const dataObjectsInLevel = nodesInLevel;

    for (let i = 0; i<dataObjectsInLevel.length; i++){
      var right_or_left = (i%2)*(i%2)-1;
      var pos_x = 1000 - (right_or_left * 300 * (i+1));
      var pos_y = (currentLevel+1) * 100;
      result.push({
        id: dataObjectsInLevel[i].id,
        type: nodeType,
        position: {x: pos_x, y: pos_y},
        data: { label: dataObjectsInLevel[i].id },
        style: {onclick: () => console.log("hello")},
        //jsonString: JSON.stringify(dataObjectsInLevel[i].jsonObject , null, '\t'),
      });
    }
  }
  return result;
}


function createReactFlowEdges(dataObjectsAndActions: DAGraph){
  var result: any[] = [];
  dataObjectsAndActions.edges.forEach(edge => {
    //const action = edge as Action; //downcasting in order to access jsonObject
    const action = edge; //downcasting in order to access jsonObject
    result.push({
      old_id: action.id, //what we use for linking
      id: action.id + action.fromNode.id+action.toNode.id, //because it has to be unique
      source: action.fromNode.id,
      target: action.toNode.id,
      //animated: true, 
      label: action.id,
      label_copy: action.id,
      labelBgPadding: [7, 7],
      labelBgBorderRadius: 8,
      labelBgStyle: { fill: '#fff', fillOpacity: 1, stroke: '#ed7b24' },
      //jsonString: JSON.stringify(action.jsonObject, null, '\t'),
      style: { stroke: '#096bde', strokeWidth: 2},
      // type: 'runLineage',
    });
  });
  return result;
}


interface flowProps {
  elementName: string,
  elementType: string,
  data?: object,
  graph?: PartialDataObjectsAndActions, 
  runContext?: boolean,
}

type flowNodeWithString = Node<any> & {jsonString?:string} //merge Node type of ReactFlow with an (optional) String attribute. 

type flowEdgeWithString = Edge<any> & {jsonString?:string} & {old_id?: string}

const edgeTypes = {
  runLineage: RunLineageEdge,
}


function LineageTab(props: flowProps) {
  const url = useParams();

  const doa = props.graph ? props.graph : new DataObjectsAndActions(props.data);
  let nodes_init: any[] = [];
  let edges_init: any[] = [];
  const [onlyDirectNeighbours, setOnlyDirectNeighbours] = useState([true, 'Expand Graph']);

  function expandGraph(){
    let buttonMessage = onlyDirectNeighbours[0] ? 'Compress Graph' : 'Expand Graph';
    setOnlyDirectNeighbours([!onlyDirectNeighbours[0], buttonMessage]);
    console.log('hidden: ', hidden);
  }

  function prepareAndRenderGraph(){

    if (props.elementType==='dataObjects'){ //only a partial graph
      const partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighbours(props.elementName) : doa.returnPartialGraphInputs(props.elementName);
      //const partialGraphPair = doa.returnPartialGraphInputs(props.elementName);
      const partialNodes = partialGraphPair[0];
      const partialEdges = partialGraphPair[1];
      const partialGraph = new PartialDataObjectsAndActions(partialNodes, partialEdges);
    
      nodes_init = createReactFlowNodes(partialGraph);
      edges_init = createReactFlowEdges(partialGraph);
    }
  
    else if(props.elementType==='actions'){
      const partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighboursFromEdge(props.elementName) : doa.returnPartialGraphInputsFromEdge(props.elementName);
      const partialNodes = partialGraphPair[0];
      const partialEdges = partialGraphPair[1];
      const partialGraph = new PartialDataObjectsAndActions(partialNodes, partialEdges);
    
      nodes_init = createReactFlowNodes(partialGraph);
      edges_init = createReactFlowEdges(partialGraph);
    }
  
    else{ //to be able to see the complete lineage when selecting connections / global
      nodes_init = createReactFlowNodes(doa);
      edges_init = createReactFlowEdges(doa);
    }
    return [nodes_init, edges_init];

  }

  useEffect(() => {
    setNodes(nodes_init);
    setEdges(edges_init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props]); // Only re-run the effect if nodes_init changes

  useEffect(()=>{
    const new_graph = prepareAndRenderGraph();
    setNodes(new_graph[0]);
    setEdges(new_graph[1]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyDirectNeighbours]); //Re-render the graph after expanding or contracting

  let initial_render = prepareAndRenderGraph();
  const [nodes, setNodes] = useState(initial_render[0]);
  const [edges, setEdges] = useState(initial_render[0]);
  let [hidden, setHidden] = useState(useParams().elementType === 'dataObjects' ? true : false); //Hidden action labels

  const hide = (hidden: boolean) => (edge: any) => {
    if (hidden){
      edge.label = '';
    }else{
      edge.label = edge.label_copy;
      edge.markerEnd = {};
    }

    return edge;
  };

  useEffect(() => {
    setEdges((eds) => eds.map(hide(hidden)));
  }, [hidden, onlyDirectNeighbours]); //edges must be hidden at each render (that is, also when we expand/compress the graph)

  //DEPRECATED
  function renderPartialGraph(nodeId: string){

    const partialGraphPair = doa.returnPartialGraphInputs(nodeId);
    const partialNodes = partialGraphPair[0];
    const partialEdges = partialGraphPair[1];
    const partialGraph = new PartialDataObjectsAndActions(partialNodes, partialEdges);

    const newNodes = createReactFlowNodes(partialGraph);
    const newEdges = createReactFlowEdges(partialGraph);

    setNodes(newNodes);
    setEdges(newEdges);
  }

  //Nodes and edges can be moved. Used "any" type as first, non-clean implementation. 
  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds: any) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds: any) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  
  // handlers for navigating dataObjects and actions
  const navigate = useNavigate();   
  function clickOnNode(node: flowNodeWithString){
    //renderPartialGraph(node.id); //DEPRECATED WAY OF SHOWING PARTIAL GRAPHS
    if (props.data) {
      navigate(`/config/dataObjects/${node.id}`); //Link programmatically
    }
  } 
  function clickOnEdge(edge: flowEdgeWithString){
    if (props.data) { 
      navigate(`/config/actions/${edge.old_id}`); //Link programmatically
    } else {
      navigate(`/workflows/${url.flowId}/${url.runNumber}/${url.taskId}/${url.tab}/${edge.old_id}`);
    }
  }

  // container holding SVG needs manual height resizing to fill 100%
  const chartBox = useRef<HTMLDivElement>();
  const [contentHeight, setContentHeight] = useState(100);

  const reactFlow = useReactFlow();

  function handleResize() {
    if (chartBox.current) {
      const height = window.innerHeight - chartBox.current.offsetTop - 25; // 25px bottom margin...
      setContentHeight(height);
    }
  }

//Asynchronously changes the centering of the lineage
  function init() {
    handleResize();
    setTimeout(() => {
      reactFlow.setCenter(0, 0, {zoom: 0.8});
    }, 1);
    window.addEventListener('resize', () => handleResize());
  }

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
        onInit={init}
        defaultPosition={[0,0]} 
        onNodeClick={(event, node) => {!props.runContext && clickOnNode(node)}}
        onEdgeClick={(event, edge) => {!props.runContext && clickOnEdge(edge)}}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesConnectable={false} //prevents adding new edges
        //edgeTypes={edgeTypes}
      >
        <Background />
        <MiniMap />
        <Controls />
        <Box sx={{position: 'absolute', left: 9, bottom: 135, display: 'flex', flexDirection: 'column-reverse'}}>

        <div title='Display / Hide action IDs' style={{ zIndex: 4, cursor: 'pointer' }}>
          <IconButton 
            color={hidden ? 'inherit' : 'primary'}
            onClick={() => setHidden(!hidden)}>
            <RocketLaunchOutlined />
          </IconButton>
        </div>

        {props.data && <div title={onlyDirectNeighbours[1] as string} style={{  zIndex: 4, cursor: 'pointer' }}>
          <IconButton 
            color='inherit'
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
