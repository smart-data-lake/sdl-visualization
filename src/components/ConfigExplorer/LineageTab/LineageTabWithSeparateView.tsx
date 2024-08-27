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
import { Provider, useDispatch } from 'react-redux';
import store from '../../../app/store';
import { useAppSelector } from '../../../hooks/useRedux';
import { dagreLayoutRf } from '../../../util/ConfigExplorer/Graphs';
import {
  prepareAndRenderGraph,
  resetEdgeStyles, resetNodeStyles,
  setEdgeStylesOnEdgeClick, setNodeStylesOnEdgeClick
} from '../../../util/ConfigExplorer/LineageTabUtils';
import { setRFI, setSelectedEdge } from '../../../util/ConfigExplorer/slice/LineageTab/Common/ReactFlowSlice';
import { getLineageTabProps } from '../../../util/ConfigExplorer/slice/LineageTab/Core/LineageTabCoreSlice';
import { getExpansionState } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphExpansionSlice';
import { getGraphView } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphViewSlice';
import { getLayout } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/LayoutSlice';
import CenteredCirularProgress from '../../Common/CenteredCircularProgress';
import { CustomDataNode, CustomEdge } from './LineageGraphComponents';
import LineageGraphToolbar from './LineageGraphToolbar';

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
  const props = useAppSelector(state => getLineageTabProps(state))
  const navigate = useNavigate(); // handlers for navigating dataObjects and actions
  const dispatch = useDispatch();

  // to save the zoom level before re-creating a new ReactFlow component
  const [previousZoom, setPreviousZoom] = useState<number>();
  // workaround to wait for reactflow div mounted, in order to get container width/height
  const [rfContainerMounted, setRfContainerMounted] = useState(false);

  const graphView = useAppSelector((state) => getGraphView(state));
  const isExpanded = useAppSelector((state) => getExpansionState(state));
  const layout = useAppSelector((state) => getLayout(state));

  const reactFlow = useReactFlow();
  const [reactFlowKey, setReactFlowKey] = useState(0);
  useEffect(() => {
    if (reactFlow) {
      dispatch(setRFI(Object.assign({}, reactFlow)));
    }
  }, [reactFlow, dispatch]); // though https://github.com/reduxjs/react-redux/issues/1468

  const rfContainer = useRef<HTMLDivElement>(); // container holding SVG needs manual height resizing to fill 100%

  // defines the conditions to (re-)render the lineage graph
  const [nodes, edges] = useMemo(() => {
    // save current zoom to initialize new react flow component
    setPreviousZoom(previousZoom ? reactFlow.getZoom() : 0.5); // initialize with 0.5
    setRfContainerMounted(false); // workaround to make changing layout work correctly
    var [nodes_init, edges_init] = prepareAndRenderGraph(navigate);
    nodes_init = dagreLayoutRf(nodes_init, edges_init, layout, nodeWidth, nodeHeight);
    setReactFlowKey(reactFlowKey + 1); // change key to re-create react flow component (and initialize it through default nodes)
    return [nodes_init, edges_init];
  }, [isExpanded, props.elementName, props.elementType, graphView, layout]);

  useEffect(() => {
    setRfContainerMounted(true); // workaround to make changing layout work correctly
  }, [nodes])

  const onPaneClick = () => {
    resetEdgeStyles(reactFlow);
    resetNodeStyles(reactFlow);
    dispatch(setSelectedEdge(undefined));
  }

  // highlight edge and src, target nodes' border
  const onEdgeClick = (_event, edge: ReactFlowEdge) => {
    resetEdgeStyles(reactFlow);
    resetNodeStyles(reactFlow);
    setNodeStylesOnEdgeClick(reactFlow, edge);
    setEdgeStylesOnEdgeClick(reactFlow, edge);
    dispatch(setSelectedEdge(edge));
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
      <Provider store={store}>
        <LineageTabCore />
      </Provider>
    </ReactFlowProvider>
  )
}


export default LineageTabSep;