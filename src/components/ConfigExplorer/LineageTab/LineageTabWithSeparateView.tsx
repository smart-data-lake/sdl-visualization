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
import {
  Background,
  Controls,
  ReactFlow,
  Edge as ReactFlowEdge,
  Node as ReactFlowNode,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
// default styling
import 'reactflow/dist/style.css';

// mui imports
import Box from '@mui/material/Box';

// local imports
import { useLineageGraph, useLineagePanel } from '../../../hooks/useLineage';
import { assignCoordinates } from '../../../util/ConfigExplorer/LineageLayout';
import {
  expandNeighbours,
  flowProps,
  getGraph,
  recordManualMoves,
  prepareAndRenderGraph,
  resetEdgeStyles, resetNodeStyles,
  revealNode,
  selectEdge,
  setSelectedNode,
  spliceNodePath,
  updateExpandSides
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

  // workaround to wait for reactflow div mounted, in order to get container width/height
  const [rfContainerMounted, setRfContainerMounted] = useState(false);

  const { graphView: selectedGraphView, isExpanded, layout } = useLineageGraph();
  // a graph passed in through the props brings its own view, the selector cannot switch it
  const graphView = props.graph ? (props.graphView ?? 'action') : selectedGraphView;

  const reactFlow = useReactFlow();

  /*
    The element the current node set was built around. Selecting another one does not rebuild the
    graph - it is highlighted and the graph grows towards it - so this only changes where this view
    cannot reach the element at all. See the selection effect.
  */
  const [builtAround, setBuiltAround] = useState({elementName: props.elementName, elementType: props.elementType});

  const rfContainer = useRef<HTMLDivElement>(); // container holding SVG needs manual height resizing to fill 100%

  /*
    The node set, and the only conditions under which it is rebuilt. Deliberately not props itself:
    the config explorer hands down a new object on every navigation, and rebuilding on that would
    throw the graph the user has grown away. A rebuild that does happen is centred on the element
    that is selected now, which is why the memo reads props but does not watch it.
  */
  const {nodes, edges, navigateTo} = useMemo(() => {
    const prepared = prepareAndRenderGraph(reactFlow, {graphView, props, layout, isExpanded});
    return {...prepared, nodes: assignCoordinates(prepared.nodes, prepared.edges, layout, {defaultWidth: nodeWidth, defaultHeight: nodeHeight})};
  }, [isExpanded, graphView, layout, builtAround.elementName, builtAround.elementType,
      props.configData, props.graph, props.graphView, props.runContext,
      props.nodeStatuses, props.edgeMetrics, props.nodeMetrics]);

  // the selected element does not exist in the selected graph view, so switch to one that does.
  // This has to happen after rendering, navigating from within the memo above would update the router
  // while this component is rendering.
  useEffect(() => {
    if (navigateTo) navigateContent(navigateTo);
  }, [navigateTo])

  useEffect(() => {
    setRfContainerMounted(true); // need the container's width/height before ReactFlow can fit the view
  }, [rfContainer])

  /*
    Hand a rebuilt node set to the live ReactFlow instance instead of re-creating the component.
    The first one arrives through defaultNodes, at mount.
  */
  const applied = useRef<typeof nodes | null>(null);
  useEffect(() => {
    if (!rfContainerMounted) return;
    if (applied.current === null || applied.current === nodes) {
      applied.current = nodes;
      return;
    }
    applied.current = nodes;
    const zoom = reactFlow.getZoom();
    reactFlow.setNodes(nodes);
    reactFlow.setEdges(edges);
    const centers = nodes.filter((node) => node.data.graphNodeProps.isCenterNode);
    // after the nodes have been measured, or the fit is computed from sizes ReactFlow does not have yet
    setTimeout(() => reactFlow.fitView(centers.length > 0 ? {maxZoom: zoom, nodes: centers} : {nodes}), 0);
  }, [nodes, edges, rfContainerMounted])

  /*
    Selecting an element highlights it and shows its neighbours where it already is; one that is not
    shown is spliced in with the chain leading to it. Only an element this graph view does not hold
    at all starts a new node set - through the anchor, which is what the memo above watches.
  */
  useEffect(() => {
    if (!rfContainerMounted || props.graph || !props.elementName) return;
    // nothing to grow from: this view holds no such element, or the last build had nothing to show
    if (reactFlow.getNodes().length === 0 || !getGraph(props, graphView).getNodeById(props.elementName)) {
      setBuiltAround({elementName: props.elementName, elementType: props.elementType});
      return;
    }
    if (!reactFlow.getNode(props.elementName)) spliceNodePath(reactFlow, props, props.elementName, graphView, layout);
    setSelectedNode(reactFlow, props.elementName);
    expandNeighbours(reactFlow, props, props.elementName, graphView, layout);
    updateExpandSides(reactFlow, props.elementName); // the sides face away from what is selected now
    // the node set was just built around this element, so the fit above already has it in view.
    // Everything else here is idempotent and has to run again whenever the selection comes back.
    const justBuilt = props.elementName === builtAround.elementName && applied.current === nodes;
    if (!justBuilt) revealNode(reactFlow, props.elementName);
  }, [props.elementName, props.elementType, rfContainerMounted])

  const onPaneClick = () => {
    resetEdgeStyles(reactFlow);
    resetNodeStyles(reactFlow);
  }

  // highlight edge, its metric labels and src, target nodes' border
  const onEdgeClick = (_event, edge: ReactFlowEdge) => {
    selectEdge(reactFlow, edge);
  }

  /*
    A node the user drags keeps that displacement through every later layout, so that expanding
    something elsewhere does not undo the arrangement they have made. Recorded as the distance
    dragged rather than as a position, so the node still follows its neighbours when they move.
  */
  const dragStart = useRef(new Map<string, {x: number, y: number}>());
  const onNodeDragStart = (_event, _node: ReactFlowNode, dragged: ReactFlowNode[]) => {
    dragStart.current = new Map(dragged.map((node) => [node.id, {...node.position}]));
  }
  const onNodeDragStop = (_event, _node: ReactFlowNode, dragged: ReactFlowNode[]) => {
    recordManualMoves(reactFlow, new Map(dragged.map((node) => {
      const from = dragStart.current.get(node.id) ?? node.position;
      return [node.id, {x: node.position.x - from.x, y: node.position.y - from.y}];
    })));
  }

  // without a center node - the run view shows the whole graph - the view is fitted on all nodes,
  // and up to the maximum zoom, as there is no previously centered element to keep the zoom of
  const centerNodes = nodes.filter((node) => node.data.graphNodeProps.isCenterNode);

  return (

    <Box ref={rfContainer} sx={{ height: '100%' }}>
      {rfContainerMounted && // need to wait for rfContainer ready in order to get width/height.
        <ReactFlow
          defaultNodes={nodes}
          defaultEdges={edges}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          nodesConnectable={false}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectOnClick={false}
          minZoom={0.02}
          maxZoom={1}
          fitView
          fitViewOptions={centerNodes.length > 0 ? {maxZoom: 0.5, nodes: centerNodes} : {nodes}}
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