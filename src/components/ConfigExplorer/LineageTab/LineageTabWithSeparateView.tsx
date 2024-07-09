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
  highlightBySubstring
} from '../../../util/ConfigExplorer/LineageTabUtils';
import { CustomDataNode, CustomEdge } from './LineageGraphComponents';
import { LineageGraphToolbar } from './LineageGraphToolbar';



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

  let nodes_init: ReactFlowNode[] = [];
  let edges_init: ReactFlowEdge[] = [];

  const [graphView, setGraphView] = useState<GraphView>('full'); // control for action/data/full graph view 
  const [onlyDirectNeighbours, setOnlyDirectNeighbours] = useState([true, 'Expand Graph']); // can be simplified as well
  const [layout, setLayout] = useState<LayoutDirection>('TB');
  const [grouped, setGrouped] = useState(false); // revert grouped view on second click
  let [hidden, setHidden] = useState(useParams().elemelsntType === 'dataObjects' ? true : false);

  const reactFlow = useReactFlow();
  const [reactFlowKey, setReactFlowKey] = useState(1);

  const navigate = useNavigate();            // handlers for navigating dataObjects and actions
  const chartBox = useRef<HTMLDivElement>(); // container holding SVG needs manual height resizing to fill 100%

  // helper functions
  function expandGraph(): void {
    let buttonMessage = onlyDirectNeighbours[0] ? 'Compress Graph' : 'Expand Graph';
    setOnlyDirectNeighbours([!onlyDirectNeighbours[0], buttonMessage]);
  }

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
        !onlyDirectNeighbours[0],
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
        layoutDirection
      });

    } else {
      console.log("hide");
      updateLineageGraphOnCollapse(reactFlow, {
        currRfNode,
        expandDirection,
        layoutDirection
      });
    }

  }, [])

  function prepareAndRenderGraph(): [ReactFlowNode[], ReactFlowEdge[]] {
    var partialGraphPair: [GraphNode[], GraphEdge[]] = [[], []];
    var doa: DAGraph;
    var centralNodeId: string = props.elementName;
    console.log("initial props: ", props);

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
    partialGraphPair = onlyDirectNeighbours[0] ? doa.returnDirectNeighbours(centralNodeId) : doa.returnPartialGraphInputs(centralNodeId);
    const partialGraph = new PartialDataObjectsAndActions(partialGraphPair[0], partialGraphPair[1], layout, props.configData);
    partialGraph.setCenterNode(partialGraph.getNodeById(centralNodeId)!); // how would props.configData.fullgraph know the new centralId?

    let newNodes = createReactFlowNodes(partialGraphPair[0],
      layout,
      !onlyDirectNeighbours[0],
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


  // TODO: maybe define data separation here (e.g. to separate every functionality, only update if something has changed, without modified the implemented functionalities again)
  useEffect(() => {
    // update grouping
    // resetViewPort(reactFlow);
  }, [reactFlow]);


  // defines the conditions to (re-)render the lineage graph
  const [nodes, edges] = useMemo(() => {
    [nodes_init, edges_init] = prepareAndRenderGraph();
    nodes_init = computeLayout(nodes_init, edges_init, layout);
    setReactFlowKey(reactFlowKey + 1); // change key to re-create react flow component (and initialize it through default nodes)
    return [nodes_init, edges_init];
  }, [hidden, onlyDirectNeighbours, props, graphView, url, layout]);

  // reset viewport for init elems
  useEffect(() => {
    resetViewPort(reactFlow);
  }, [nodes_init, edges_init]);

  // }, [layout]);
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

  const handleCenterFocus = () => {
    resetViewPortCentered(reactFlow, nodes);
  }

  const handleResetViewPort = () => {
    resetViewPort(reactFlow);
  }


  return (
    <>
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
          maxZoom={3}
        >
          {/* <MiniMap/>  */}
          <Controls />
          <Background /> {/* Background macht fehler "<pattern> attribute x: Expected length, "NaN"!*/}
        </ReactFlow>
        <LineageGraphToolbar
          isPropsConfigDefined={props.configData !== undefined}
          hidden={hidden}
          setHidden={setHidden}
          expanded={onlyDirectNeighbours[0]}
          setExpanded={expandGraph}
          expansionState={onlyDirectNeighbours[1]}
          layout={layout}
          setLayout={setLayout}
          graphView={graphView}
          setGraphView={setGraphView}
          handleOnClickResetViewport={handleResetViewPort}
          handleOnClickCenterFocus={handleCenterFocus}
          rfi={reactFlow}
          groupingFunc={highlightBySubstring}
          graph={getGraphFromConfig(props.configData, graphView)}
          groupingArgs={"zlr"} // test input arg
        />
      </Box>

    </>
  )
}


function LineageTabSep(props: flowProps) {
  return (
    <ReactFlowProvider>
      <LineageTabCore {...props} />
    </ReactFlowProvider>
  )
}


export default LineageTabSep;