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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Background,
  Controls,
  ReactFlow,
  Edge as ReactFlowEdge,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
// default styling
import 'reactflow/dist/style.css';

// mui imports
import Box from '@mui/material/Box';

// local imports
import { useLineageGraph, useLineagePanel } from '../../../hooks/useLineage';
import { dagreLayoutRf } from '../../../util/ConfigExplorer/Graphs';
import {
  prepareAndRenderGraph,
  resetEdgeStyles, resetNodeStyles,
  setEdgeStylesOnEdgeClick, setNodeStylesOnEdgeClick
} from '../../../util/ConfigExplorer/LineageTabUtils';
import CenteredCirularProgress from '../../Common/CenteredCircularProgress';
import { CustomDataNode, CustomEdge } from './LineageGraphComponents';
import LineageGraphToolbar from './LineageGraphToolbar';
import { useWorkspace } from '../../../hooks/useWorkspace';

/*
 Add custom node and edge types
*/
const nodeTypes = {
  customDataNode: CustomDataNode,
}

const edgeTypes = {
  customEdge: CustomEdge,
};

//TODO: refactor as layout settings
export const nodeWidth = 172;
export const nodeHeight = 36;

/*
  Implements the Lineage tab for separated action and dataObject view
  edge labels will be replaced by action nodes in the full graph view
*/
function LineageTabCore() {
  const { lineageTabProps: props } = useLineagePanel();
  const {navigateContent} = useWorkspace(); // handlers for navigating dataObjects and actions

  // to save the zoom level before re-creating a new ReactFlow component
  const [previousZoom, setPreviousZoom] = useState<number>();
  // workaround to wait for reactflow div mounted, in order to get container width/height
  const [rfContainerMounted, setRfContainerMounted] = useState(false);

  const { graphView, isExpanded, layout } = useLineageGraph();

  const reactFlow = useReactFlow();
  const [reactFlowKey, setReactFlowKey] = useState(0);

  const rfContainer = useRef<HTMLDivElement>(); // container holding SVG needs manual height resizing to fill 100%

  // defines the conditions to (re-)render the lineage graph
  const [nodes, edges] = useMemo(() => {
    // save current zoom to initialize new react flow component
    setPreviousZoom(previousZoom ? reactFlow.getZoom() : 0.5); // initialize with 0.5
    setRfContainerMounted(false); // workaround to make changing layout work correctly
    var [nodes_init, edges_init] = prepareAndRenderGraph(reactFlow, navigateContent, {graphView, props, layout, isExpanded});
    nodes_init = dagreLayoutRf(nodes_init, edges_init, layout, nodeWidth, nodeHeight);
    setReactFlowKey(reactFlowKey + 1); // change key to re-create react flow component (and initialize it through default nodes)
    return [nodes_init, edges_init];
  }, [isExpanded, props.elementName, props.elementType, props.configData, graphView, layout]);

  useEffect(() => {
    setRfContainerMounted(true); // workaround to make changing layout work correctly
  }, [nodes])

  const onPaneClick = () => {
    resetEdgeStyles(reactFlow);
    resetNodeStyles(reactFlow);
  }

  // highlight edge and src, target nodes' border
  const onEdgeClick = (_event, edge: ReactFlowEdge) => {
    resetEdgeStyles(reactFlow);
    resetNodeStyles(reactFlow);
    setNodeStylesOnEdgeClick(reactFlow, edge);
    setEdgeStylesOnEdgeClick(reactFlow, edge);
  }

  useEffect(() => {
    if (rfContainer.current) setRfContainerMounted(true);
  }, [rfContainer])

  return (

    <Box ref={rfContainer} sx={{ height: '100%' }}>
      {rfContainerMounted && // need to wait for rfContainer ready in order to get width/height.
        <ReactFlow
          key={reactFlowKey}
          defaultNodes={nodes}
          defaultEdges={edges}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodesConnectable={false}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectOnClick={false}
          minZoom={0.02}
          maxZoom={1}
          fitView
          fitViewOptions={{maxZoom: previousZoom, nodes: nodes.filter((node) => node.data.graphNodeProps.isCenterNode)}}
        >
          <Controls showFitView={false} showInteractive={false} />
          <Background /> {/* Background macht fehler "<pattern> attribute x: Expected length, "NaN"!*/}
          <LineageGraphToolbar/>
        </ReactFlow>
      }
      {!rfContainerMounted && <CenteredCirularProgress/>}
    </Box>
  )
}


function LineageTabSep() {
  return (
    <ReactFlowProvider>
      <LineageTabCore />
    </ReactFlowProvider>
  )
}


export default LineageTabSep;