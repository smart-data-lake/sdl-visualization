import React, { useCallback, useState } from 'react';
import ReactFlow, { addEdge, ConnectionLineType, useNodesState, useEdgesState } from 'react-flow-renderer';
import { applyEdgeChanges, applyNodeChanges, Background, MiniMap, Controls, Node, Edge } from 'react-flow-renderer';
import DataObjectsAndActions, { DataObject, Action } from '../util/Graphs';
import dagre from 'dagre';


//functions to create our nodesd and edges from a custom object
function createReactFlowNodes(dataObjectsAndActions){
  var result = [];
  var nodeType = 'default';
  for (let currentLevel = 0; currentLevel<dataObjectsAndActions.levels.length; currentLevel++){
    if(currentLevel===0){nodeType = 'input'}
    else if(currentLevel===dataObjectsAndActions.levels.length){nodeType = 'output'}
    else {nodeType = 'default'}
    
    const position = {x:0, y:0};
    const nodesInLevel = dataObjectsAndActions.nodes.filter(node => node.level === currentLevel);
    for (let i = 0; i<nodesInLevel.length; i++){
      //var right_or_left = (i%2)*(i%2)-1;
      //var pos_x = 1000 - (right_or_left * 300 * (i+1));
      //var pos_y = (currentLevel+1) * 100;
      result.push({
        id: nodesInLevel[i].id,
        type: nodeType,
        data: { label: nodesInLevel[i].id },
        position //position is going to be automatically layered anyway
        //jsonString: JSON.stringify(nodesInLevel[i].jsonObject, null, '\t'),
      });
    }
  }
  return result;
}


function createReactFlowEdges(dataObjectsAndActions){
  var result = [];
  dataObjectsAndActions.edges.forEach(edge => {
    result.push({
      id: edge.id+edge.fromNode.id+edge.toNode.id,
      source: edge.fromNode.id,
      target: edge.toNode.id,
      animated: true, 
      label: edge.id,
      jsonString: JSON.stringify(edge.jsonObject, null, '\t'),
      style: { stroke: 'red' },
    });
  });
  return result;
}




//create dagre graph and set the width and height of the nodes
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));
const nodeWidth = 172;
const nodeHeight = 36;



const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? 'left' : 'top';
    node.sourcePosition = isHorizontal ? 'right' : 'bottom';

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};





//Ab hier -->  Only relevant for new nodes and Edges
export const LayoutFlow = (props) => {

  const doa = new DataObjectsAndActions(props.data);
  const initialNodes = createReactFlowNodes(doa);
  const initialEdges = createReactFlowEdges(doa);	
  
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    initialNodes,
    initialEdges
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: ConnectionLineType.SmoothStep, animated: true }, eds)),
    []
  );
  const onLayout = useCallback(
    (direction) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction
      );

      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
    },
    [nodes, edges]
  );

  return (
    <div className="layoutflow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
      />
      <div className="controls">
        <button onClick={() => onLayout('TB')}>vertical layout</button>
        <button onClick={() => onLayout('LR')}>horizontal layout</button>
      </div>
    </div>
  );
};

export default LayoutFlow;