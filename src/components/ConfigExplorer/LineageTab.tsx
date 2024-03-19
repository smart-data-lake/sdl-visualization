import { useState, useCallback, useEffect, useRef} from 'react';
import ReactFlow, { applyEdgeChanges, applyNodeChanges, Background, MiniMap, Controls, Node, Edge, MarkerType, isNode } from 'react-flow-renderer';
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

// what if other what is the tradeoff when Graph.ts is used by a lot of classes that require the position?
function createReactFlowNodes(dataObjectsAndActions: DAGraph, direction: string = 'TB'){
  const isHorizontal = direction === 'LR';
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
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom'
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
/**function createReactFlowNodes_Old(dataObjectsAndActions: DAGraph){
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
}**/

// TODO: Add horizonal option tab
function createReactFlowEdges(dataObjectsAndActions: DAGraph){
  var result: any[] = [];
  dataObjectsAndActions.edges.forEach(edge => {
    //const action = edge as Action; //downcasting in order to access jsonObject
    const action = edge; //downcasting in order to access jsonObjectsourcePosition: 'right',
    result.push({
      old_id: action.id, //what we use for linking
      id: action.id + action.fromNode.id+action.toNode.id, //because it has to be unique
      source: action.fromNode.id,
      target: action.toNode.id,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 10,
        height: 10,
        color: '#096bde',
      },
      // label: action.id, // the action tab should not be shown on initialization
      label_copy: action.id,
      labelBgPadding: [7, 7],
      labelBgBorderRadius: 8,
      labelBgStyle: { fill: '#fff', fillOpacity: 1, stroke: '#ed7b24' },
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

// TODO:  implement this in a hook, refactor hooks
let layout: string = "TB";

/**const edgeTypes = {
  runLineage: RunLineageEdge,
}**/
function LineageTab(props: flowProps) {
  const url = useParams();

  const doa = props.graph ? props.graph : new DataObjectsAndActions(props.configData); //
  let nodes_init: any[] = [];
  let edges_init: any[] = [];
  const [onlyDirectNeighbours, setOnlyDirectNeighbours] = useState([true, 'Expand Graph']);
  const [pageClick, setPageClick] = useState(false);
  const [layoutChange, setLayoutChange] = useState(false);
  // let [layout, setLayout] = useState('TB');

  function expandGraph(){
    let buttonMessage = onlyDirectNeighbours[0] ? 'Compress Graph' : 'Expand Graph';
    setOnlyDirectNeighbours([!onlyDirectNeighbours[0], buttonMessage]);
    console.log('hidden: ', hidden);
    console.log("curr direction: " +layout);
  }

  function prepareAndRenderGraph(){
    // console.log("renderng " + layout_direction);
    if (props.elementType==='dataObjects'){ //only a partial graph
      const partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighbours(props.elementName) : doa.returnPartialGraphInputs(props.elementName);
      //const partialGraphPair = doa.returnPartialGraphInputs(props.elementName);
      const partialNodes = partialGraphPair[0];
      const partialEdges = partialGraphPair[1];
      const partialGraph = new PartialDataObjectsAndActions(partialNodes, partialEdges, layout);
      nodes_init = createReactFlowNodes(partialGraph, layout);
      edges_init = createReactFlowEdges(partialGraph);
    }
  
    else if(props.elementType==='actions'){
      const partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighboursFromEdge(props.elementName) : doa.returnPartialGraphInputsFromEdge(props.elementName);
      const partialNodes = partialGraphPair[0];
      const partialEdges = partialGraphPair[1];
      const partialGraph = new PartialDataObjectsAndActions(partialNodes, partialEdges, layout);
      nodes_init = createReactFlowNodes(partialGraph, layout);
      edges_init = createReactFlowEdges(partialGraph);
    }
  
    else{ //to be able to see the complete lineage when selecting connections / global
      nodes_init = createReactFlowNodes(doa, layout);
      edges_init = createReactFlowEdges(doa);
    }
    return [nodes_init, edges_init];

  }

  
  //DEPRECATED
  /**function renderPartialGraph(nodeId: string){

    const partialGraphPair = doa.returnPartialGraphInputs(nodeId);
    const partialNodes = partialGraphPair[0];
    const partialEdges = partialGraphPair[1];
    const partialGraph = new PartialDataObjectsAndActions(partialNodes, partialEdges);

    const newNodes = createReactFlowNodes(partialGraph);
    const newEdges = createReactFlowEdges(partialGraph);

    setNodes(newNodes);
    setEdges(newEdges);
  }**/

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
  let [hidden, setHidden] = useState(useParams().elementType === 'dataObjects' ? true : false); 

  const hide = (hidden: boolean) => (edge: any) => {
    if (hidden){
      edge.label = '';
    }else{
      edge.label = edge.label_copy;
    }
    return edge;
  };

  useEffect(() => {
    setEdges((eds) => eds.map(hide(hidden)));
  }, [hidden, onlyDirectNeighbours, pageClick, layoutChange]); //edges must be hidden at each render (that is, also when we expand/compress the graph)

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
    if (props.configData) {
      navigate(`/config/dataObjects/${node.id}`); //Link programmatically
    }
    setPageClick(!pageClick);
  } 
  function clickOnEdge(edge: flowEdgeWithString){
    if (props.configData) { 
      navigate(`/config/actions/${edge.old_id}`); //Link programmatically
    } else {
      navigate( `/workflows/${url.flowId}/${url.runNumber}/${url.taskId}/${url.tab}/${edge.old_id}`);
    }
    setPageClick(!pageClick);
  }

  // container holding SVG needs manual height resizing to fill 100%
  const chartBox = useRef<HTMLDivElement>();
  /**const [contentHeight, setContentHeight] = useState(100);**/

  /**const reactFlow = useReactFlow();**/

  /**function handleResize() {
    if (chartBox.current) {
      const height = window.innerHeight - chartBox.current.offsetTop - 25; // 25px bottom margin...
      setContentHeight(height);
    }
  }**/

//Asynchronously changes the centering of the lineage
  /**function init() {
    handleResize();
    setTimeout(() => {
      reactFlow.setCenter(0, 0, {zoom: 0.8});
    }, 1);
    window.addEventListener('resize', () => handleResize());
  }**/

  // update the graph layout, either horizontal or vertical
  // the input nodes and edges should be the custom classes imported from Graphs.ts
  // not to be confused with dagre graph nodes and  edges

  const onLayout = useCallback(
    (direction) => {
      console.log("layouting");      
      // setLayout(direction); 
      layout = direction;
      [nodes_init, edges_init] = prepareAndRenderGraph();
      setLayoutChange(!layoutChange);
      setNodes(nodes_init);
      setEdges(edges_init);
    },
    [nodes, edges]
  );

  // TODO: add onHover references
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
        /*onInit={init}*/
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

        
        <div title ={layout == 'TB' ? 'switch to horizontal layout' : 'switch to vertical layout'} className="controls" style={{zIndex: 4, cursor: 'pointer'}}>
          <IconButton 
            color={'neutral'}
            onClick={() => onLayout(layout == 'TB' ? 'LR' : 'TB')}>
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
