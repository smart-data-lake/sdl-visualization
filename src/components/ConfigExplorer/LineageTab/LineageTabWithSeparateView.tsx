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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MarkerType, Position,
  Edge as ReactFlowEdge,
  ReactFlowInstance,
  Node as ReactFlowNode,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
// default styling
import 'reactflow/dist/style.css';

// mui imports
import Box from '@mui/material/Box';

// local imports
import { dagreLayoutRf as computeLayout } from '../../../util/ConfigExplorer/Graphs';
import {
  resetEdgeStyles, resetNodeStyles, setEdgeStylesOnEdgeClick, setNodeStylesOnEdgeClick,
  useLineageGraph
} from '../../../util/ConfigExplorer/LineageTabUtils';
import { CustomDataNode, CustomEdge, EdgeInfoBox, ZoomSlider } from './LineageGraphComponents';
import LineageGraphToolbar from './LineageGraphToolbar';
import store from '../../../app/store';
import { Provider, useDispatch } from 'react-redux'
import { useAppSelector, useAppDispatch } from '../../../hooks/useRedux';
import { getSelectedEdge, setRFI, setSelectedEdge } from '../../../util/ConfigExplorer/slice/LineageTab/Common/ReactFlowSlice';
import { getGraphView } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphViewSlice';
import { getExpansionState } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphExpansionSlice';
import { getLayout } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/LayoutSlice';
import { getLineageTabProps } from '../../../util/ConfigExplorer/slice/LineageTab/Core/LineageTabCoreSlice';

/*
 Add custom node and edge types
*/
const nodeTypes = {
  customDataNode: CustomDataNode,
}

const edgeTypes = {
  customEdge: CustomEdge,
};


/*
  Implements the Lineage tab for separated action and dataObject view
  edge labels will be replaced by action nodes in the full graph view
*/
function LineageTabCore() {
  const props = useAppSelector(state => getLineageTabProps(state))
  const url = useParams();
  const dispatch = useDispatch();
  const lineageGraph = useLineageGraph();

  const graphView = useAppSelector((state) => getGraphView(state));
  const isExpanded = useAppSelector((state) => getExpansionState(state));
  const layout = useAppSelector((state) => getLayout(state));
  const edgeSelected = useAppSelector((state) => getSelectedEdge(state) !== undefined);

  const reactFlow = useReactFlow();
  const [reactFlowKey, setReactFlowKey] = useState(0);
  useEffect(() => {
    if (reactFlow) {
      dispatch(setRFI(Object.assign({}, reactFlow)));
    }
  }, [reactFlow, dispatch]); // though https://github.com/reduxjs/react-redux/issues/1468

  const chartBox = useRef<HTMLDivElement>(); // container holding SVG needs manual height resizing to fill 100%

  // defines the conditions to (re-)render the lineage graph
  const [nodes, edges] = useMemo(() => {
    var nodes_init, edges_init;
    [nodes_init, edges_init] = lineageGraph();
    nodes_init = computeLayout(nodes_init, edges_init, layout);
    setReactFlowKey(reactFlowKey + 1); // change key to re-create react flow component (and initialize it through default nodes)
    return [nodes_init, edges_init];
  }, [isExpanded, props, graphView, url, layout, dispatch]);

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

  return (

    <Box className='data-flow' ref={chartBox} sx={{ height: '100%' }}
    >
      <ReactFlow
        key={reactFlowKey}
        defaultNodes={nodes}
        defaultEdges={edges}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodesConnectable={false}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        connectOnClick={false}
        minZoom={0.02}
        maxZoom={2.2}
      >
        {/* <Controls /> */}
        <Background /> {/* Background macht fehler "<pattern> attribute x: Expected length, "NaN"!*/}
      </ReactFlow>
      {/* {edgeSelected && <EdgeInfoBox rfi={reactFlow} />} */}
      <LineageGraphToolbar/>
      <ZoomSlider/>
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