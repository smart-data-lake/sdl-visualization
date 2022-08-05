import React, { useState, useCallback } from 'react';
import ReactFlow, { applyEdgeChanges, applyNodeChanges, Background, MiniMap, Controls, Node, Edge } from 'react-flow-renderer';
import DataObjectsAndActions, { DataObject, Action } from './util/Graphs';
import './ComponentsStyles.css';

function createReactFlowNodes(dataObjectsAndActions: DataObjectsAndActions){
  var result: any[] = [];
  dataObjectsAndActions.nodes.forEach((node)=>{
    const dataObject = node as DataObject; //downcasting in order to be able to access the JSONObject attribute
    result.push({
      id: dataObject.id,
      position: {x: dataObject.position.x, y: dataObject.position.y},
      data: {label: dataObject.id},
      jsonString: JSON.stringify(dataObject.jsonObject, null, '\t'),
    })
  });
  return result;
}

/**
 * DEPRECATED: Uses Deprecated class "DAGraph_Old" that calculates the levels
 * of each node in order to layyer them. The method is replaced by the dagre library
 * for the layout functions.
 */
function createReactFlowNodes_Old(dataObjectsAndActions: DataObjectsAndActions){
  var result: any[] = [];
  var nodeType = 'default';
  for (let currentLevel = 0; currentLevel<dataObjectsAndActions.levels.length; currentLevel++){
    if(currentLevel===0){nodeType = 'input'}
    else if(currentLevel===dataObjectsAndActions.levels.length){nodeType = 'output'}
    else {nodeType = 'default'}
    
    const nodesInLevel = dataObjectsAndActions.nodes.filter(node => node.level === currentLevel);
    const dataObjectsInLevel = nodesInLevel as DataObject[];
    for (let i = 0; i<dataObjectsInLevel.length; i++){
      var right_or_left = (i%2)*(i%2)-1;
      var pos_x = 1000 - (right_or_left * 300 * (i+1));
      var pos_y = (currentLevel+1) * 100;
      result.push({
        id: dataObjectsInLevel[i].id,
        type: nodeType,
        position: {x: pos_x, y: pos_y},
        data: { label: dataObjectsInLevel[i].id },
        jsonString: JSON.stringify(dataObjectsInLevel[i].jsonObject , null, '\t'),
      });
    }
  }
  return result;
}


function createReactFlowEdges(dataObjectsAndActions: DataObjectsAndActions){
  var result: any[] = [];
  dataObjectsAndActions.edges.forEach(edge => {
    const action = edge as Action; //downcasting in order to access jsonObject
    result.push({
      id: action.id + action.fromNode.id+action.toNode.id,
      source: action.fromNode.id,
      target: action.toNode.id,
      animated: true, 
      label: action.id,
      labelBgPadding: [8, 4],
      jsonString: JSON.stringify(action.jsonObject, null, '\t'),
      style: { stroke: 'red' },
    });
  });
  return result;
}


interface flowProps {
  data: object;
}

type flowNodeWithString = Node<any> & {jsonString?:string} //merge Node type of ReactFlow with an (optional) String attribute. 

type flowEdgeWithString = Edge<any> & {jsonString?:string}



function FlowChart(props: flowProps) {

  const doa = new DataObjectsAndActions(props.data);
  const nodes_init = createReactFlowNodes(doa);
  const edges_init = createReactFlowEdges(doa);	
  const [nodes, setNodes] = useState(nodes_init);
  const [edges, setEdges] = useState(edges_init);



  //Nodes and edges can be moved. Used "any" type as first, non-clean implementation. 
  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds: any) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds: any) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  function clickOnNode(node: flowNodeWithString){
    window.alert('This dataObject is defined as: \n '+node.jsonString);
  }

  function clickOnEdge(edge: flowEdgeWithString){
    window.alert('This action is defined as: \n '+edge.jsonString);
  }


  return (
    <div className='data-flow'>
    <ReactFlow 
      //nodes={nodes} 
      //edges={edges}
      nodes={nodes}
      edges={edges} 
      fitView 
      onNodeClick={(event, node) => clickOnNode(node)}
      onEdgeClick={(event, edge) => clickOnEdge(edge)}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
    >
       <Background />
       <MiniMap />
       <Controls />
    </ReactFlow>
    </div>
  );
}

export default FlowChart;
