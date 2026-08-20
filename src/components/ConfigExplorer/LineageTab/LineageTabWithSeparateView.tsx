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
  flowProps,
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

  The graph to show is taken from the lineage panel state, unless it is passed in through graphProps.
  The run view does the latter: it shows the action graph of a run attempt as a whole, so there is
  neither a graph view to select nor a center node to expand around.
*/
function LineageTabCore({graphProps}: {graphProps?: flowProps}) {
  const { lineageTabProps } = useLineagePanel();
  const props = graphProps ? graphProps : lineageTabProps;
  const {navigateContent} = useWorkspace(); // handlers for navigating dataObjects and actions

  // to save the zoom level before re-creating a new ReactFlow component
  const [previousZoom, setPreviousZoom] = useState<number>();
  // workaround to wait for reactflow div mounted, in order to get container width/height
  const [rfContainerMounted, setRfContainerMounted] = useState(false);

  const { graphView: selectedGraphView, isExpanded, layout } = useLineageGraph();
  // a graph passed in through the props is always shown as an action graph, the view cannot be switched
  const graphView = props.graph ? 'action' : selectedGraphView;

  const reactFlow = useReactFlow();
  const [reactFlowKey, setReactFlowKey] = useState(0);

  const rfContainer = useRef<HTMLDivElement>(); // container holding SVG needs manual height resizing to fill 100%

  // defines the conditions to (re-)render the lineage graph
  const {nodes, edges, navigateTo} = useMemo(() => {
    // save current zoom to initialize new react flow component
    setPreviousZoom(previousZoom ? reactFlow.getZoom() : 0.5); // initialize with 0.5
    setRfContainerMounted(false); // workaround to make changing layout work correctly
    const prepared = prepareAndRenderGraph(reactFlow, {graphView, props, layout, isExpanded});
    setReactFlowKey(reactFlowKey + 1); // change key to re-create react flow component (and initialize it through default nodes)
    return {...prepared, nodes: dagreLayoutRf(prepared.nodes, prepared.edges, layout, nodeWidth, nodeHeight)};
  }, [isExpanded, props.elementName, props.elementType, props.configData, props.graph, graphView, layout]);

  // the selected element does not exist in the selected graph view, so switch to one that does.
  // This has to happen after rendering, navigating from within the memo above would update the router
  // while this component is rendering.
  useEffect(() => {
    if (navigateTo) navigateContent(navigateTo);
  }, [navigateTo])

  useEffect(() => {
    setRfContainerMounted(true); // workaround to make changing layout work correctly
  }, [nodes])

  // without a center node - the run view shows the whole graph - the view is fitted on all nodes,
  // and up to the maximum zoom, as there is no previously centered element to keep the zoom of
  const centerNodes = nodes.filter((node) => node.data.graphNodeProps.isCenterNode);

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
          fitViewOptions={centerNodes.length > 0 ? {maxZoom: previousZoom, nodes: centerNodes} : {nodes}}
        >
          <Controls showFitView={false} showInteractive={false} />
          <Background /> {/* Background macht fehler "<pattern> attribute x: Expected length, "NaN"!*/}
          <LineageGraphToolbar props={props}/>
        </ReactFlow>
      }
      {!rfContainerMounted && <CenteredCirularProgress/>}
    </Box>
  )
}


function LineageTabSep({graphProps}: {graphProps?: flowProps}) {
  return (
    <ReactFlowProvider>
      <LineageTabCore graphProps={graphProps}/>
    </ReactFlowProvider>
  )
}


export default LineageTabSep;