import { useState, useCallback } from 'react';
import ReactFlow, { ConnectionLineType,  applyEdgeChanges, applyNodeChanges, Background, MiniMap, Controls } from 'react-flow-renderer';
import DataObjectsAndActions from './playground/Graphs.js';

const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'DataObject 1' },
    position: { x: 250, y: 25 },
    jsonString: "type = WebserviceFileDataObject \nurl = https://opensky-network.org/api/flights/departure?airport=LSZB&begin=1630200800&end=1630310979 \nreadTimeoutMs=200000",
  },

  {
    id: '2',
    // you can also pass a React component as a label
    data: { label: <div>DataObject2</div> },
    position: { x: 100, y: 125 },
    jsonString: "type = WebserviceFileDataObject \nurl = https://opensky-network.org/api/flights/departure?airport=LSZB&begin=1630200800&end=1630310979 \nreadTimeoutMs=200000",
  },
  {
    id: '3',
    data: { label: <div>DataObject3</div> },
    position: { x: 300, y: 125 },
    jsonString: "type = WebserviceFileDataObject \nurl = https://opensky-network.org/api/flights/departure?airport=LSZB&begin=1630200800&end=1630310979 \nreadTimeoutMs=200000",
  },
  {
    id: '4',
    data: { label: <div>DataObject4</div> },
    position: { x: 300, y: 300 },
    jsonString: "type = WebserviceFileDataObject \nurl = https://opensky-network.org/api/flights/departure?airport=LSZB&begin=1630200800&end=1630310979 \nreadTimeoutMs=200000",
  },
  {
    id: '5',
    data: { label: <div>DataObject5</div> },
    position: { x: 100, y: 300 },
    jsonString: "type = WebserviceFileDataObject \nurl = https://opensky-network.org/api/flights/departure?airport=LSZB&begin=1630200800&end=1630310979 \nreadTimeoutMs=200000",
  },
  {
    id: '6',
    type: 'output',
    data: { label: 'Output' },
    position: { x: 200, y: 400 },
    jsonString: "type = WebserviceFileDataObject \nurl = https://opensky-network.org/api/flights/departure?airport=LSZB&begin=1630200800&end=1630310979 \nreadTimeoutMs=200000",
  },
  {
    id: '7',
    type: 'input',
    data: { label: 'DataObject7' },
    position: { x: 450, y: 25 },
    jsonString: "type = WebserviceFileDataObject \nurl = https://opensky-network.org/api/flights/departure?airport=LSZB&begin=1630200800&end=1630310979 \nreadTimeoutMs=200000",
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', animated: true, label: 'Action1' },
  { id: 'e1-3', source: '1', target: '3', animated: true, label: 'Action1' },
  { id: 'e2-5', source: '2', target: '5', animated: true, label: 'Action2' },
  { id: 'e3-4', source: '3', target: '4', animated: true, label: 'Action2' },
  { id: 'e2-6', source: '2', target: '6', animated: true, label: 'Action3' },
  { id: 'e5-6', source: '5', target: '6', animated: true, label: 'Action3' },
  { id: 'e4-6', source: '4', target: '6', animated: true, label: 'Action3' },
  { id: 'e7-6', source: '7', target: '6', animated: true, label: 'Action3' },
];

function Flow() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);


  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  function clickOnNode(node){
    window.alert('This dataObject is defined as: \n '+node.jsonString);
  }

  return (
    <ReactFlow 
      nodes={nodes} 
      edges={edges} 
      fitView 
      onNodeClick={(event, node) => clickOnNode(node)}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
}

export default Flow;
