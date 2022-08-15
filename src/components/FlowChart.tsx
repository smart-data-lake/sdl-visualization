import { Box } from '@mui/material';
import { useState, useCallback, useEffect, useRef, useLayoutEffect} from 'react';
import ReactFlow, { applyEdgeChanges, applyNodeChanges, Background, MiniMap, Controls, Node, Edge, MarkerType } from 'react-flow-renderer';
import DataObjectsAndActions, { DataObject, Action, DAGraph, PartialDataObjectsAndActions } from '../util/Graphs';
import { useNavigate } from "react-router-dom";
import './ComponentsStyles.css';

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
      id: action.id + action.fromNode.id+action.toNode.id,
      source: action.fromNode.id,
      target: action.toNode.id,
      //animated: true, 
      label: action.id,
      label_copy: action.id,
      labelBgPadding: [8, 4],
      //jsonString: JSON.stringify(action.jsonObject, null, '\t'),
      style: { stroke: 'red' },
    });
  });
  return result;
}


interface flowProps {
  data: object,
  elementName: string,
  elementType: string,
}

type flowNodeWithString = Node<any> & {jsonString?:string} //merge Node type of ReactFlow with an (optional) String attribute. 

type flowEdgeWithString = Edge<any> & {jsonString?:string}



function FlowChart(props: flowProps) {

  const doa = new DataObjectsAndActions(props.data);
  let nodes_init: any[];
  let edges_init: any[];


  if (props.elementType==='dataObjects'){ //only a partial graph
    const partialGraphPair = doa.returnPartialGraphInputs(props.elementName);
    const partialNodes = partialGraphPair[0];
    const partialEdges = partialGraphPair[1];
    const partialGraph = new PartialDataObjectsAndActions(partialNodes, partialEdges);
  
    nodes_init = createReactFlowNodes(partialGraph);
    edges_init = createReactFlowEdges(partialGraph);
  }
  else{ //to be able to see the complete lineage when selecting actions
    nodes_init = createReactFlowNodes(doa);
    edges_init = createReactFlowEdges(doa);
  }

  useEffect(() => {
    setNodes(nodes_init);
    setEdges(edges_init);
  }, [props]); // Only re-run the effect if nodes_init changes

  const [nodes, setNodes] = useState(nodes_init);
  const [edges, setEdges] = useState(edges_init);
  let [hidden, setHidden] = useState(false);



  const hide = (hidden: boolean) => (edge: any) => {
    if (hidden){
      edge.label = '';
      edge.markerEnd = {type: MarkerType.ArrowClosed, color: 'red', width: 20, height: 20};
    }else{
      edge.label = edge.label_copy;
      edge.markerEnd = {};
    }

    return edge;
  };

  useEffect(() => {
    setEdges((eds) => eds.map(hide(hidden)));
  }, [hidden]);

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
    navigate(`/dataObjects/${node.id}`); //Link programmatically
  }
  function clickOnEdge(edge: flowEdgeWithString){
    navigate(`/actions/${edge.id}`); //Link programmatically
  }

  // container holding SVG needs manual height resizing to fill 100%
  const [contentHeight, setContentHeight] = useState(100);
  const chartBox = useRef<HTMLDivElement>();
  function handleResize() {
    if (chartBox.current) {
      const height = window.innerHeight - chartBox.current.offsetTop - 25; // 25px bottom margin...
      console.log('resized to: ', height);
      setContentHeight(height);
    }
  }
  useEffect(() => window.addEventListener('resize', handleResize), []);
  useLayoutEffect(() => handleResize(), []);

  return (
    <Box className='data-flow' sx={{height: contentHeight}} ref={chartBox}>
      <ReactFlow 
        nodes={nodes}
        edges={edges} 
        fitView 
        onNodeClick={(event, node) => clickOnNode(node)}
        onEdgeClick={(event, edge) => clickOnEdge(edge)}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesConnectable={false} //prevents adding new edges
      >
        <Background />
        <MiniMap />
        <Controls />
        <div style={{ position: 'absolute', left: 10, top: 10, zIndex: 4 }}>
          <div>
            <label htmlFor="ishidden" className="hide_edges_checkbox_text">
              Hide Action Labels
              <input
                id="ishidden"
                type="checkbox"
                checked={hidden}
                onChange={(event) => setHidden(event.target.checked)
                }
              />
            </label>
          </div>
        </div>
      </ReactFlow>
    </Box>
  );
}

export default FlowChart;
