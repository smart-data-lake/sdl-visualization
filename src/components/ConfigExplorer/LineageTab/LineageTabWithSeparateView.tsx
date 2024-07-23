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
import { DAGraph, Edge as GraphEdge, Node as GraphNode, NodeType, PartialDataObjectsAndActions, dagreLayoutRf as computeLayout } from '../../../util/ConfigExplorer/Graphs';
import {
  resetViewPort, resetViewPortCentered, updateLineageGraphOnCollapse, updateLineageGraphOnExapnd, resetEdgeStyles, resetNodeStyles, setEdgeStylesOnEdgeClick, setNodeStylesOnEdgeClick,
  LayoutDirection, ExpandDirection, GraphView,
  flowProps,
  createReactFlowNodes, createReactFlowEdges,
  groupBySubstring,
  getGraphFromConfig,
  highlightBySubstring,
  groupByFeed,
  resetGroupSettings,
  prioritizeParentNodes
} from '../../../util/ConfigExplorer/LineageTabUtils';
import { CustomDataNode, CustomEdge, EdgeInfoBox, NodeSearchBar } from './LineageGraphComponents';
import { LineageGraphToolbar as Toolbar } from './LineageGraphToolbar';
import store, { RootState } from '../../../app/store';
import { Provider, useDispatch } from 'react-redux'
import { useAppSelector, useAppDispatch } from '../../../hooks/useRedux';
import { getReactFlowKey, setReactFlowInstance, setReactFlowKey } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/ReactFlowSlice';
import { getView } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphViewSlice';
import { getExpansionState } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphExpansionSlice';
import { getLayout } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/LayoutSlice';

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
function LineageTabCore(props: flowProps) {
  // initialization 
  const url = useParams();
  const dispatch = useDispatch();

  let nodes_init: ReactFlowNode[] = [];
  let edges_init: ReactFlowEdge[] = [];

  const graphView = useAppSelector((state) => getView(state));
  const isExpanded = useAppSelector((state) => getExpansionState(state));
  const layout = useAppSelector((state) => getLayout(state));
  const [grouped, setGrouped] = useState(false); // revert grouped view on second click
  const [infoBoxUp, setInfoBoxUp] = useState<[boolean, ReactFlowEdge | undefined]>([false, undefined]);

  const reactFlow = useReactFlow();
  const reactFlowKey = useAppSelector((state) => getReactFlowKey(state));
  useEffect(() => {
    if (reactFlow) {
      dispatch(setReactFlowInstance(reactFlow));
    }
  }, [reactFlow, dispatch]);

  const navigate = useNavigate();            // handlers for navigating dataObjects and actions
  const chartBox = useRef<HTMLDivElement>(); // container holding SVG needs manual height resizing to fill 100%

  const expandNodeFunc = useCallback((id: string, isExpanded: boolean,
    expandDirection: ExpandDirection,
    graphView: GraphView,
    layoutDirection: LayoutDirection) => {

    // if expanded, show the direct out neighbours of the node with the id; if unexpanded, hide all descendants
    const graph = getGraphFromConfig(props.configData, graphView);
    const isFwd = expandDirection === 'forward';
    const currNode = graph.getNodeById(id)!;
    const currRfNode = reactFlow.getNode(currNode?.id!)!;

    if (!isExpanded) {
      console.log("expand");
      let [neighbourNodes, neighbourEdges] = isFwd ? graph.getOutElems(id) : graph.getInElems(id); // all positions are 0,0 here

      // only create not existing nodes, update active edges of exisiting nodes
      const currRfNodes = reactFlow.getNodes();
      const currRfNodeIds = currRfNodes.map(rfNode => rfNode.id);
      let rfNodes = createReactFlowNodes(neighbourNodes.filter(node => !currRfNodeIds.includes(node.id)),
        layoutDirection,
        isExpanded,
        true,
        expandDirection,
        graphView,
        expandNodeFunc,
        props);

      let rfEdges = createReactFlowEdges(neighbourEdges,
        props,
        graphView,
        undefined,
      );

      updateLineageGraphOnExapnd(reactFlow, rfEdges, rfNodes, {
        isFwd,
        currRfNodeIds,
        currRfNode,
        neighbourEdges,
        layoutDirection,
        grouped
      });

    } else {
      console.log("hide");
      updateLineageGraphOnCollapse(reactFlow, {
        currRfNode,
        expandDirection,
        layoutDirection,
        grouped
      });
      resetViewPortCentered(reactFlow, [currRfNode]);
    }
    prioritizeParentNodes(reactFlow);
  }, [])

  function prepareAndRenderGraph(): [ReactFlowNode[], ReactFlowEdge[]] {
    var partialGraphPair: [GraphNode[], GraphEdge[]] = [[], []];
    var doa: DAGraph;
    var centralNodeId: string = props.elementName;

    // get the right central node for the graph
    if (graphView === 'full') {
      doa = props.configData!.fullGraph!;
    } else if (graphView === 'data') {
      doa = props.configData!.dataGraph!;
      if (props.elementType === 'actions') {
        // switch to data graph when an action is selected -> navigate to first direct neighbour
        const [neighours,] = props.configData?.fullGraph?.returnDirectNeighbours(props.elementName)!;
        centralNodeId = neighours[0].id;
        navigate(`/config/dataObjects/${centralNodeId}`);
      }
    } else if (graphView === 'action') {
      doa = props.configData!.actionGraph!;
      if (props.elementType === 'dataObjects') {
        // switch to action graph when a data object is selected -> navigate to first direct neighbour
        const [neighours,] = props.configData?.fullGraph?.returnDirectNeighbours(props.elementName)!;
        centralNodeId = neighours[0].id;
        navigate(`/config/actions/${centralNodeId}`);
      }
    } else {
      throw Error("Unknown graph view " + graphView);
    }

    // reset isCenterNode flags otherwise all previous ones will be colored
    doa.nodes.forEach((node) => {
      node.setIsCenterNode(false);
    });
    doa.setCenterNode(doa.getNodeById(centralNodeId)!);

    // When the layout has changed, the nodes and edges have to be recomputed
    partialGraphPair = !isExpanded ? doa.returnDirectNeighbours(centralNodeId) : doa.returnPartialGraphInputs(centralNodeId);
    const partialGraph = new PartialDataObjectsAndActions(partialGraphPair[0], partialGraphPair[1], layout, props.configData);
    partialGraph.setCenterNode(partialGraph.getNodeById(centralNodeId)!); 

    let newNodes = createReactFlowNodes(partialGraphPair[0],
      layout,
      isExpanded,
      false,
      undefined,
      graphView,
      expandNodeFunc,
      props);

    let newEdges = createReactFlowEdges(partialGraphPair[1],
      props,
      graphView,
      undefined
    );

    return [newNodes, newEdges];
  }

  // defines the conditions to (re-)render the lineage graph
  const [nodes, edges] = useMemo(() => {
    setInfoBoxUp([false, undefined]);
    [nodes_init, edges_init] = prepareAndRenderGraph();
    nodes_init = computeLayout(nodes_init, edges_init, layout);
    // resetGroupSettings(reactFlow); // TODO: reset grouped flag as well (cannot do this on init though)
    dispatch(setReactFlowKey(reactFlowKey+1)); // change key to re-create react flow component (and initialize it through default nodes)
    return [nodes_init, edges_init];
  }, [isExpanded, props, graphView, url, layout]);

  const onPaneClick = () => {
    resetEdgeStyles(reactFlow);
    resetNodeStyles(reactFlow);
    onCloseInfoBox();
  }

  // highlight edge and src, target nodes' border
  const onEdgeClick = (_event, edge: ReactFlowEdge) => {
    resetEdgeStyles(reactFlow);
    resetNodeStyles(reactFlow);
    setNodeStylesOnEdgeClick(reactFlow, edge);
    setEdgeStylesOnEdgeClick(reactFlow, edge);
    setInfoBoxUp([true, edge]);
  }

  const onCloseInfoBox = () => {
    setInfoBoxUp([false, undefined]);
  }

  const handleCenterFocus = () => {
    resetViewPortCentered(reactFlow, nodes);
  }

  const handleResetViewPort = () => {
    resetViewPort(reactFlow);
  }

  // if not a callback, reactflow props will not be updated
  const handleGrouping = useCallback((groupingFunc: any, args: any) => {
    if(!grouped){
      groupingFunc(reactFlow, getGraphFromConfig(props.configData, graphView), args);
    } else {
      resetGroupSettings(reactFlow);
    }
    setGrouped(!grouped);
  }, [grouped, graphView])

 // TODO: refacttor handlers and import from util
  return (

      <Box
        className='data-flow'
        ref={chartBox}
        sx={{
          height: '100%',
        }}
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
          {/* <MiniMap/>  */}
          <Controls />
          <Background /> {/* Background macht fehler "<pattern> attribute x: Expected length, "NaN"!*/}
        </ReactFlow>
        <Toolbar
          isPropsConfigDefined={props.configData !== undefined}
          rfi={reactFlow}
          grouped={grouped}
          handleGrouping={handleGrouping}
          groupingFunc={groupBySubstring}
          groupingArgs={{substring: "load", layoutDirection: layout}} // test input arg
        />
        {infoBoxUp[0] && (
          <EdgeInfoBox
            rfi={reactFlow}
            onClose={onCloseInfoBox}
            edge={infoBoxUp[1]}
          />
        )}
        <NodeSearchBar rfi={reactFlow} />
      </Box>


  )
}


function LineageTabSep(props: flowProps) {
  return (
    <ReactFlowProvider>
      <Provider store={store}>
        <LineageTabCore {...props} />
      </Provider>
    </ReactFlowProvider>
  )
}


export default LineageTabSep;