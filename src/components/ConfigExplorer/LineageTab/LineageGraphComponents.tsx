/*
    Custom ReactFlow Nodes and Edges that are used in the LineageTab as well as theme styling

    TODO: 
    -should implement textoverflow handler
    -adjust between node distance (max width and text-overflow)
    -sohuld be able to show all nodes of the same type (generic function in Graph.ts)
*/
import { CSSProperties, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from "react-router-dom";
import { EdgeLabelRenderer, EdgeProps, Handle, getSmoothStepPath, useReactFlow, useUpdateNodeInternals } from 'reactflow';

import { ExpandLess, ExpandMore } from '@mui/icons-material';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import IndeterminateCheckBoxOutlinedIcon from '@mui/icons-material/IndeterminateCheckBoxOutlined';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import TableViewIcon from '@mui/icons-material/TableView';
import { Chip, IconButton, Tooltip } from '@mui/joy';
import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import { Link } from "react-router-dom";

import { Position } from 'reactflow';
import { useFetchDataObjectSchema, useFetchDataObjectSchemaEntries, useFetchWorkflowRunsByElement } from '../../../hooks/useFetchData';
import { NodeType } from '../../../util/ConfigExplorer/Graphs';
import { CustomEdgeProps, flowProps, graphNodeProps, nodeSizeFor, ReactFlowNodeProps, recomputeLayout, SELECTED_ELEMENT_Z_INDEX, scheduleRelayout, selectEdge, updateRelationEdgeHandles } from '../../../util/ConfigExplorer/LineageTabUtils';
import { setRfNodeData, setRfNodeSize } from '../../../util/ConfigExplorer/Graphs';
import { ColumnList, ColumnsToggle, NODE_BORDER_VAR, NODE_HEADER_HEIGHT, NodeRelationHandles } from './DataObjectColumns';
import { ColumnDisplay, filterColumns } from '../../../util/ConfigExplorer/ColumnModel';
import { FlowMetric } from '../../../util/WorkflowsExplorer/metrics';
import { getIcon, getPartitionStatus, getExecutionMode } from '../../../util/WorkflowsExplorer/StatusInfo';
import { getStatusColor } from '../../../util/WorkflowsExplorer/statusColors';
import './LineageTab.css';
import { useWorkspace } from '../../../hooks/useWorkspace';
import { useLineageGraph } from '../../../hooks/useLineage';


/*
  Styles to refactor (for the entire LineageTab folder)
*/
const labelColor = '#fcae1e';
const defaultEdgeColor = '#b1b1b7';
const highLightedEdgeColor = '#096bde';
const defaultNodeBorderColor = '#a9a9a9';

const defaultEdgeStrokeWidth = 3
const highlightedEdgeStrokeWidth = 5;

const dataNodeStyles = {
  padding: '10px',
  border: '1px solid #ddd',
  borderRadius: '10px',
  maxWidth: '100px',
  minWidth: '200px',
  position: 'relative',
};

const actionNodeStyles = {
  progressBar: {
    color:{
      low: '#ec4a4a',
      medium: '#fdda0d',
      high: '#50c878',
      done: '#308efe'
    },
    bar:{
      "--LinearProgress-thickness": "6px",
      marginBottom: '10px',
    }
  },
};

const expandButtonStyles = {
  background: '#fff',
}

/*
  The graph expand handles are anchored on the middle of the node's border, which is also where the
  column control runs, so they are lifted above it - a click there has to expand the graph, not open
  the columns. The control keeps its chevrons at the two outer ends for the same reason.
*/
const EXPAND_HANDLE_Z_INDEX = 5;

/*
  The padding of the node box, which the title and the column rows sit inside of.

  Horizontally it has to clear the graph expand button: that button straddles the border and reaches
  EXPAND_BUTTON_OUTSET into the node, so anything padded less than that ends up touching it.

  Vertically it stays at 10: NODE_HEADER_HEIGHT is what the node declares its height from before it
  renders, and the title has to keep fitting inside it.
*/
const NODE_PADDING_X = 16;
const NODE_PADDING_Y = 10;

/*
  The type icon of a node, see showObjectTitle.

  It is squared off, because an MUI icon is 1em wide whatever its height: a 24x24 glyph drawn into a
  24-wide, 18-tall box is centred with 3px of slack on each side. What is left after that is the
  padding inside the glyph itself, which differs per icon, and the pull takes the average of it out
  so that the icon lines up with the first letter of the title under it rather than sitting indented
  against it.
*/
const TYPE_ICON_SIZE = 18;
const typeIconStyle = {
  width: `${TYPE_ICON_SIZE}px`, height: `${TYPE_ICON_SIZE}px`, marginLeft: '-3px',
};

/*
  The expand button is centred on the border of its node, and an edge that ended on that border
  would have its arrow head hidden behind it. So where a button is shown the handle - which is where
  ReactFlow puts the end of the edge - is moved out by half of it, to the button's outer edge, and
  the button is shifted back by the same amount so that it still straddles the border. Where no
  button is shown the handle stays on the border and the edge meets the node exactly there.
*/
const EXPAND_BUTTON_SIZE = 24;
export const EXPAND_BUTTON_OUTSET = EXPAND_BUTTON_SIZE / 2;

/* the button, centred on its handle and then pushed back inwards by what the handle was moved out
   by - so it keeps straddling the border while the edge ends at its outer edge */
function expandButtonSx(position: Position, outset: number) {
  const isHorizontal = position === Position.Left || position === Position.Right;
  const back = (outwardIsNegative: boolean) => `calc(-50% + ${outwardIsNegative ? outset : -outset}px)`;
  return {
    position: 'absolute', top: '50%', left: '50%',
    transform: isHorizontal ? `translate(${back(position === Position.Left)}, -50%)`
                            : `translate(-50%, ${back(position === Position.Top)})`,
    width: `${EXPAND_BUTTON_SIZE}px`, height: `${EXPAND_BUTTON_SIZE}px`,
    minHeight: 0, minWidth: 0, padding: 0,
  };
}

/*
  Where a node level handle sits: on the border it belongs to, in both layouts, moved out by
  `outset` where an expand button is in the way.

  ReactFlow reads the edge's endpoint off the handle element, so this is what decides where an edge
  meets its node. On the border it meets it exactly - an anchor set inside the node hides the end of
  the line under it, one set outside leaves a gap between the arrow head and the node.

  The handle keeps a little length along the border, which widens what can be grabbed without moving
  the anchor, since the anchor is the centre of the box.
*/
function nodeHandleStyle(position: Position, sideTop: string | undefined, outset: number): CSSProperties {
  const isSide = position === Position.Left || position === Position.Right;
  const common = {background: 0, border: 0,
                  height: isSide ? '24px' : '1px', width: isSide ? '1px' : '24px'};
  // a handle is positioned against the node's padded box, so reaching its outer border means
  // clearing the border width - the 50% offsets need no correction, the padded box is centred.
  // `outset` then takes it past the border, to the outer edge of the expand button.
  const out = `calc(-1 * ${NODE_BORDER_VAR} - ${outset}px)`;
  switch (position) {
    case Position.Top:    return {...common, top: out, left: '50%', transform: 'translate(-50%, -50%)'};
    case Position.Bottom: return {...common, bottom: out, left: '50%', transform: 'translate(-50%, 50%)'};
    // the side handles are anchored on the middle of the title rather than of the node, see sideHandleTop
    case Position.Left:   return {...common, left: out, top: sideTop, transform: 'translate(-50%, -50%)'};
    default:              return {...common, right: out, top: sideTop, transform: 'translate(50%, -50%)'};
  }
}

const nodeColors = {
  centralNode: '#addbff',
  dataNode: '',
  actionNode: ''
}

const getActionStatus = (progress) => {
  if (progress < 100) {
    return 'In progress';
  } else {
    return 'Completed';
  }
};

/*
  Render relevant information from runs
*/
const renderProperties = (runs) => {
  // console.log("run props: ", runs)
  return (
    <div>
      {/* <Divider sx={{mt:4, mb:1}} orientation='horizontal'/>
      {runs.map(([key, value]) => (
        <Typography key={key} variant="plain">
          {key}: {value}
        </Typography>
      ))} */}
    </div>
  );
};

/*
  This will be integrated later as soon as 
  we can link object type descriptions 
*/
const handleTypeClick = () => {
  console.log('Show documentation');
};


/*
  The metrics of a data flow, shown next to the edge it flows along (see CustomEdge) or next to the
  node when there is no edge to sit on (see CustomDataNode). Only the value is shown, to keep the
  graph readable - the tooltip names the data object and the metric it comes from.
*/
const MetricLabel = ({metric, direction, highlighted, testId, onClick}: {
  metric: FlowMetric,
  direction: 'output' | 'input',
  highlighted?: boolean,
  testId: string,
  onClick?: () => void,
}) => {
  // the label shows one number, the tooltip names the data object and everything the action
  // recorded for it
  const title = (
    <Box>
      <div><b>{direction === 'output' ? 'written to' : 'read from'} {metric.dataObjectId}:</b></div>
      {metric.all.map(entry => <div key={entry.name}>{entry.name} = {String(entry.value)}</div>)}
    </Box>
  );
  return (
    <Tooltip title={title} arrow disableInteractive size="sm">
      <Typography level="body-xs" data-testid={testId} onClick={onClick}
        sx={{
          padding: '0px 4px',
          borderRadius: '8px',
          // the border follows the edge the label belongs to, so both highlight together
          border: `1px solid ${highlighted ? highLightedEdgeColor : defaultEdgeColor}`,
          bgcolor: '#fff',
          whiteSpace: 'nowrap',
          cursor: onClick ? 'pointer' : 'default',
        }}>
        {metric.value}
      </Typography>
    </Tooltip>
  )
}

function createConnectionChip(name: string){
  return(
    <Link to={"/config/connections/"+name}>
      <Chip key={"connections/"+name} color="primary" startDecorator={<LanOutlinedIcon />} variant="outlined" >{name}</Chip>
    </Link>
  )
}

export const CustomDataNode = ( {data} ) => {
  // destruct data
  const { props, label, nodeType,
          targetPosition, sourcePosition,
          progress, jsonObject, isGraphFullyExpanded, graphView, layoutDirection,
          numBwdActiveEdges, numFwdActiveEdges,
          expandNodeFunc, graphNodeProps, highlighted, runContext, status, metrics,
          columns, columnDisplay, columnsFunc, isSelectedElement, expandSides
  }: ReactFlowNodeProps = data;
  const {isExpandedForward: expandedFwd, isExpandedBackward: expandedBwd}: ReactFlowNodeProps = data;
  const {isSink, isSource, isCenterNode}: graphNodeProps = graphNodeProps

  // init state
  const [ showDetails, setShowDetails ] = useState(false);
  // neighbours are shown by default when creating the subgraph of the center node. Whether they
  // still are lives in the node's data, not in component state: the node can be expanded from
  // elsewhere - by selecting the element - and the handles have to follow
  const initStateBwd = (isCenterNode || isGraphFullyExpanded) && !isSource;
  const initStateFwd = (isCenterNode || isGraphFullyExpanded) && !isSink;
  const isExpandedBackward = expandedBwd ?? initStateBwd;
  const isExpandedForward = expandedFwd ?? initStateFwd;
  const chartBox = useRef<HTMLDivElement>(); 

  // the element the config explorer is showing, which is not the node the graph was built around:
  // selecting another node highlights it where it is instead of rebuilding the graph
  const bgcolor = isSelectedElement ? nodeColors.centralNode : "#fff";
  // in a run attempt the border tells the state the action ended up in, e.g. red for FAILED. The
  // status icon names that state, so it does not rely on the colour alone
  const borderColor = highlighted ? highLightedEdgeColor :
                      status ? getStatusColor(status) :
                      defaultNodeBorderColor;
  // the handles are positioned against the padded box, see nodeHandleStyle - and a highlighted node
  // has a thicker border, so how far that is from the node's outer edge is not a constant
  const borderWidth = highlighted ? highlightedEdgeStrokeWidth : defaultEdgeStrokeWidth;

  // the nodes of a run graph are built from the state file, they have no config object behind them
  const nodeSubTypeName: string | undefined = jsonObject?.type;
  const nodeTypeName: string = nodeType === NodeType.ActionNode  ? "actions" :
                               nodeType === NodeType.DataNode ? "dataObjects" :
                               "";
  const executionMode = jsonObject?.executionMode
  const isPartioned = jsonObject?.partitions !== undefined && jsonObject?.partitions.length >= 1
  const abbr = nodeSubTypeName?.replace(/(?!^)[^A-Z\d]/g, ''); // take the capital letters and the first letter of the camelCase name
  // the runs of an element are only shown in the config explorer, the run view shows a single run
  const { data: runs} = useFetchWorkflowRunsByElement(runContext ? "" : nodeTypeName, label);
  const lastRun = runs?.at(-1); // this only shows the LAST run, but the times could be different for each object
  // the state of the node within a run attempt, falling back to the state of the element's last run
  const titleStatus = status !== undefined ? status : lastRun?.status;

  /*
    Showing and hiding the columns of this node.

    All of it happens against the ReactFlow instance rather than through React state: the flow is
    uncontrolled (see LineageTabCore), the edges have to see the new state to pick the handle they
    attach to, and the node's height has to be updated before the layout runs. updateNodeInternals
    tells ReactFlow to measure the handles again - without it the edges keep pointing at where the
    handles used to be.
  */
  const rfi = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const showColumns = columnDisplay !== undefined && columnDisplay !== 'none';
  const visibleColumns = filterColumns(columns ?? [], columnDisplay ?? 'none');

  /*
    What the schema exporter has written for this data object.

    The *index* is read for every data object node, not only for an open one, because whether the
    node has any columns to show at all decides whether it offers to show them - a data object with
    neither keys nor an export, a web service say, would otherwise offer a control that opens on
    "no columns". It is one small file per node, cached for a day and deduplicated by react-query,
    and the node already fetches its runs the same way.

    The schema *itself* is only fetched once the columns are actually asked for. Passing an empty
    element type is how the hooks are told to stay idle.
  */
  const isDataObject = nodeType === NodeType.DataNode && !runContext && columnsFunc !== undefined;
  const { data: schemaEntries, isLoading: schemaEntriesLoading } =
    useFetchDataObjectSchemaEntries(isDataObject ? "dataObjects" : "", label);
  const { data: exportedSchema, isLoading: schemaLoading } =
    useFetchDataObjectSchema(showColumns ? schemaEntries?.[0] : undefined);
  const isSchemaLoading = showColumns && (schemaEntriesLoading || schemaLoading);
  const wantsSchema = showColumns && isDataObject;

  // there is something to show when the configuration declares columns, or an export exists
  const canShowColumns = isDataObject
    && ((columns?.length ?? 0) > 0 || (schemaEntries?.length ?? 0) > 0);
  /*
    Whether opening the node further would show anything new. Not known before the exported schema
    has resolved: until then all this node has are its key columns, which would make every table
    look as if it had nothing more.
  */
  const hasMoreColumns = columnDisplay === 'none' || isSchemaLoading
    || (columns ?? []).length > filterColumns(columns ?? [], 'keys').length;

  useEffect(() => {
    updateNodeInternals(label);
  }, [columnDisplay, columns?.length]);

  /*
    Merge the schema into the columns once it arrives. It can add columns, so the node changes size
    and the graph has to be laid out again - coalesced, because several nodes can resolve at once.
  */
  useEffect(() => {
    if (!wantsSchema || !exportedSchema || !columnsFunc) return;
    const merged = columnsFunc(exportedSchema);
    const unchanged = merged.length === columns.length
      && merged.every((column, i) => column.key === columns[i].key && column.dataType === columns[i].dataType);
    if (unchanged) return;
    setRfNodeData(rfi, {nodeId: label, path: 'columns', value: merged});
    setRfNodeSize(rfi, label, nodeSizeFor({columns: merged, columnDisplay}));
    updateNodeInternals(label);
    updateRelationEdgeHandles(rfi);
    scheduleRelayout(rfi, layoutDirection);
  }, [exportedSchema, wantsSchema]);

  const handleColumnDisplay = (display: ColumnDisplay) => {
    setRfNodeData(rfi, {nodeId: label, path: 'columnDisplay', value: display});
    setRfNodeSize(rfi, label, nodeSizeFor({columns, columnDisplay: display}));
    // the edges have to move onto, resp. off, the column handles in the same go - ReactFlow drops
    // an edge whose handle does not exist, so this cannot wait for a later render
    updateRelationEdgeHandles(rfi);
    // anchored on this node, so the graph opens around it instead of moving it
    recomputeLayout(rfi, layoutDirection, label);
  };

  // handlers
  const urlParams = useParams();
  const {navigateContent} = useWorkspace();
  const { selectedNodeAttributes } = useLineageGraph();
  const handleOnExpandButtonClick = (direction) => {
    // expandNodeFunc writes the new state onto the node
    expandNodeFunc(label, direction === 'forward' ? isExpandedForward : isExpandedBackward,
                   direction, graphView, layoutDirection);
  }

  // navigate to object and show details on label click
  const handleDetailsClick = (props: flowProps, nodeId: string, nodeType: NodeType) => {

    if (runContext) {
      // show the details of the action within the run attempt instead of its configuration
      navigateContent(`workflows/${urlParams.flowId}/${urlParams.runIdAttempt}/${urlParams.tab}/${nodeId}`);

    } else if(nodeType === NodeType.DataNode){
        navigateContent(`config/dataObjects/${nodeId}`);

    } else if (nodeType === NodeType.ActionNode){
        navigateContent(`config/actions/${nodeId}`);
    } else {
      throw Error("Unknown node type: " + nodeType);
    }
  };

  /*
    small components
  */
 function showNodeTypeName(){
    return <Box 
          sx={{
            border: '1px solid #ddd',
            borderRadius: '3px',
            position: 'relative',
            bgcolor: '#ddd',
            textAlign: 'center',
            display: 'inline-block'
          }}>
            {nodeTypeName}
          </Box> 
  }

  function showObjectTitle(){    
    const objectType = nodeType === NodeType.ActionNode ? "Action Object" : "Data Object";

    return (
      <Box sx={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
        <Tooltip title={objectType} arrow disableInteractive placement={layoutDirection=='TB' ? 'right' : 'bottom'}>
          {/* the icon is squared off, so that it lines up with the title under it: an MUI icon is
              1em wide whatever its height, and a 24x24 glyph drawn into a 24-wide, 18-tall box is
              centred with 3px of slack on each side, which reads as an indent against the title */}
          {nodeType === NodeType.ActionNode ? <RocketLaunchOutlined sx={typeIconStyle}/> : <TableViewIcon sx={typeIconStyle}/>}
        </Tooltip>
        {nodeSubTypeName &&
          <Tooltip title={nodeSubTypeName} arrow disableInteractive placement={layoutDirection=='TB' ? 'right' : 'bottom'}>
            <Typography level="body-xs"
              sx={{marginLeft:'3px', fontSize: 14, fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}
              >
            {abbr}
            </Typography>
          </Tooltip>
        }
        {/* <div>
          {createConnectionChip(props.connection.id)} // need distinction on objects without conn.  
        </div> */}
        <Box sx={{flex: 1}}/>
        {/* the node attributes come from the configuration, which the run view does not have */}
        {!runContext && nodeType === NodeType.ActionNode && selectedNodeAttributes.includes("action-executionMode") ? getExecutionMode(executionMode?.type) : null }
        {!runContext && nodeType === NodeType.DataNode  && selectedNodeAttributes.includes("data-partitionState") ? getPartitionStatus(isPartioned) : null}
        {/* the state within the run attempt, or the state of the element's last run in the config explorer */}
        {titleStatus !== undefined  && (getIcon(titleStatus, '0px', {scale: '100%'}))}

        {/* <div style={{justifyContent: 'flex-end'}}>
          {lastRun.status !== undefined  && (getIcon(lastRun.status, '0px', {display: 'block'}))}
          {runs && (`runs: ${totalRuns}`)}
        </div> */}
        
        {/* <IconButton size="xs" 
        component={Link}
        to={schemaViewerURL}
        variant='contained'
        sx={{ fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginBottom: '1px'}}>
        <InfoOutlined />
        </IconButton> */}

      </Box>
    )
  }

  function showObjectName(layoutDirection: String){
    return <Tooltip title={label} arrow disableInteractive placement={layoutDirection=='TB' ? 'right' : 'bottom'}>
              <Typography level="body-lg" 
                          sx={{fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100%', maxHeight: '30px', fontSize: 16, cursor: 'pointer'}}
                          onClick={() => handleDetailsClick(props, label, nodeType)} >
                {label}
              </Typography> 
            </Tooltip>
  }

  //test
  const expand = true;
  function showProperties(){
    return <IconButton title='Show object properties'
           size="sm" 
           sx={{display: 'inline', float: 'right'}} onClick={() => {handleDetailsClick}}>
           {/* {showDetails ?   "hide props": "show props"}   */}
           {showDetails ?  <ExpandLess />: <ExpandMore />}
           </IconButton>
  }

  const isVerticalLayout = sourcePosition === Position.Bottom; // maybe this is a bug because the hanle is not updated in the first change;
  /*
    An expand button is only shown on a side that can actually extend the graph: the sides facing
    away from the selected element (expandSides, from expandSidesFrom), and never beyond a source
    or a sink, which have nothing there.
  */
  const hasForwardButton = !isSink && (expandSides === 'forward' || expandSides === 'both');
  const hasBackwardButton = !isSource && (expandSides === 'backward' || expandSides === 'both');
  const forwardOutset = hasForwardButton ? EXPAND_BUTTON_OUTSET : 0;
  const backwardOutset = hasBackwardButton ? EXPAND_BUTTON_OUTSET : 0;

  // gaining or losing a button moves the handle on that border, see nodeHandleStyle
  useEffect(() => {
    updateNodeInternals(label);
  }, [hasForwardButton, hasBackwardButton]);
  /*
    In a left to right layout the side handles would sit at the vertical middle of the node, which
    for a node showing its columns is somewhere among the rows - the expand button would cover a
    column and the edges would point at one. Anchoring them on the middle of the title instead keeps
    them where they are for a node without columns, and out of the rows for one with them.
  */
  const sideHandleTop = isVerticalLayout ? undefined
                                         : `calc(${NODE_HEADER_HEIGHT / 2}px - ${NODE_BORDER_VAR})`;

  /*
    The metrics of the data objects this action wrote but nobody read, resp. read from a source no
    action of the attempt produced. They have no edge to sit on, so they are shown just past the
    node on the side the missing edge would leave from - beneath it in a vertical layout, next to it
    in a horizontal one - centered on the node, as there is no line to align them to.
  */
  function showDanglingMetrics(flowMetrics: FlowMetric[], direction: 'output' | 'input'){
    if (flowMetrics.length === 0) return null;
    const isOutput = direction === 'output';
    const gap = 'calc(100% + 10px)';
    const position = isVerticalLayout
      ? {left: '50%', transform: 'translateX(-50%)', ...(isOutput ? {top: gap} : {bottom: gap})}
      : {top: '50%', transform: 'translateY(-50%)', ...(isOutput ? {left: gap} : {right: gap})};
    return (
      <Box sx={{position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '2px', ...position}}>
        {flowMetrics.map(metric =>
          <MetricLabel key={metric.dataObjectId} metric={metric} direction={direction}
                       testId={`node-metric-${direction}-${metric.dataObjectId}`}/>
        )}
      </Box>
    )
  }

  return (
    <>
      <Box 
      zIndex={4} 
      ref={chartBox}
      sx={{
        '--lineage-node-border': `${borderWidth}px`,
        '--lineage-column-inset': `${borderWidth + NODE_PADDING_X}px`,
        // the column block draws its rule edge to edge, so it has to undo this
        '--lineage-node-padding-x': `${NODE_PADDING_X}px`,
        padding: `${NODE_PADDING_Y}px ${NODE_PADDING_X}px`,
        border: ` ${borderWidth}px solid ${borderColor}`,
        ...(nodeType === NodeType.ActionNode && {borderRadius: '20px',}),
        // the node fills the size it declared to the layout (see nodeSizeFor), so that what is
        // laid out and what is rendered cannot drift apart. It does not clip: the metric labels of
        // a run sit just outside the box (see showDanglingMetrics), and the column block brings its
        // own overflow rules
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        bgcolor: bgcolor,
        textOverflow: 'ellipsis',
      }}
    >
      <Handle type="source" position={sourcePosition} id={`${label}`} 
              style={{...nodeHandleStyle(sourcePosition, sideHandleTop, forwardOutset),
                      // above the column control, which runs along the lower border of the node
                      zIndex: EXPAND_HANDLE_Z_INDEX}} 
              >
        {/* the button is rendered only where the graph can be expanded in this direction, not
            rendered empty: an empty one is still a hover target and shows up as a grey box */}
        {hasForwardButton &&
          <IconButton onClick={() => handleOnExpandButtonClick('forward')}
                      sx={expandButtonSx(sourcePosition, forwardOutset)}>
            {isExpandedForward ? <IndeterminateCheckBoxOutlinedIcon style={{...expandButtonStyles}}/>
                               : <AddBoxOutlinedIcon style={{...expandButtonStyles}}/>}
          </IconButton>}
      </Handle>

      {nodeType === NodeType.DataNode &&
        <NodeRelationHandles nodeId={label}
                             outsetLeft={isVerticalLayout ? 0 : backwardOutset}
                             outsetRight={isVerticalLayout ? 0 : forwardOutset}/>}
      <div>
        {showObjectTitle()}
        {showObjectName(layoutDirection)}
      </div>
      {showColumns && <ColumnList columns={visibleColumns} isLoading={isSchemaLoading}/>}
      {/* the columns of a data object, only known where there is a configuration behind the node */}
      {canShowColumns &&
        <ColumnsToggle nodeId={label} display={columnDisplay ?? 'none'} onChange={handleColumnDisplay}
                       hasMore={hasMoreColumns}/>}
      {metrics && showDanglingMetrics(metrics.outputs, 'output')}
      {metrics && showDanglingMetrics(metrics.inputs, 'input')}
      {/*showProperties()*/}
      
      {/* <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}> */}
      {/* <Typography level='body-xs' variant="soft">          
        <FunctionsIcon/>
        {metric}
      </Typography> */}
      {/* </div> */}

      {/* showDetails && (
        <>
          {renderProperties(runs)}
        </>
        )
      */}
        
      <Handle type="target" position={targetPosition} id={`${label}`} 
              style={{...nodeHandleStyle(targetPosition, sideHandleTop, backwardOutset),
                      zIndex: EXPAND_HANDLE_Z_INDEX}} 
              >
        {hasBackwardButton &&
          <IconButton onClick={() => handleOnExpandButtonClick('backward')}
                      sx={expandButtonSx(targetPosition, backwardOutset)}>
            {isExpandedBackward ? <IndeterminateCheckBoxOutlinedIcon style={{...expandButtonStyles}}/>
                                : <AddBoxOutlinedIcon style={{...expandButtonStyles}}/>}
          </IconButton>}
      </Handle>
      </Box>
    </>
  );
};


/*
  How far apart the labels of sibling edges are set. A vertical edge has room along the line, so they
  follow each other away from the node; a horizontal one does not, so they are stacked above it.
*/
const METRIC_LABEL_GAP_ALONG_EDGE = 26;
const METRIC_LABEL_GAP_STACKED = 22;
// the gap between a label and the box of the node it belongs to
const METRIC_LABEL_MARGIN = 10;
// the gap between a label and the line of its edge
const METRIC_LABEL_LINE_GAP = 6;

/*
  Where a metric label sits, as a transform for the label box.

  It is set METRIC_LABEL_MARGIN away from the box of the node it belongs to, along the straight part
  of the smooth step path, so the label lies on its edge in any layout direction and the labels of
  all nodes line up. The node level handles sit exactly on the node's border (see nodeHandleStyle),
  so the endpoint the label is placed from is the border itself.
  The corner of the box facing the node is anchored on that point, so a label is never pushed back
  onto the node by its own size.

  The labels of the edges of one node all start at the same handle, so `index` keeps them apart.
*/
function metricLabelTransform(x: number, y: number, position: Position, index: number) {
  const along = METRIC_LABEL_MARGIN;
  const alongIndexed = along + index * METRIC_LABEL_GAP_ALONG_EDGE;
  const stacked = METRIC_LABEL_LINE_GAP + index * METRIC_LABEL_GAP_STACKED;
  switch (position) {
    // a vertical edge: beside the line, one label after the other away from the node
    case Position.Top:
      return `translate(${METRIC_LABEL_LINE_GAP}px, -100%) translate(${x}px, ${y - alongIndexed}px)`;
    case Position.Bottom:
      return `translate(${METRIC_LABEL_LINE_GAP}px, 0) translate(${x}px, ${y + alongIndexed}px)`;
    // a horizontal edge: above the line, the labels stacked on the same point of the edge
    case Position.Left:
      return `translate(-100%, calc(-100% - ${stacked}px)) translate(${x - along}px, ${y}px)`;
    default:
      return `translate(0, calc(-100% - ${stacked}px)) translate(${x + along}px, ${y}px)`;
  }
}

//https://github.com/xyflow/xyflow/discussions/2347
export const CustomEdge = ({
  id,
  source, target,
  sourceX, sourceY, targetX, targetY,
  sourcePosition,targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps<CustomEdgeProps>) => {

  const reactFlow = useReactFlow();
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
  });

  // the metrics of the data object this edge stands for, only known within a run attempt
  const {output, input} = data || {};
  const outputTransform = metricLabelTransform(sourceX, sourceY, sourcePosition, data?.outputIndex ?? 0);
  const inputTransform = metricLabelTransform(targetX, targetY, targetPosition, data?.inputIndex ?? 0);
  // a selected edge and its labels are lifted over the other edges and labels
  const labelWrapperStyles: CSSProperties = {
    position: 'absolute', pointerEvents: 'all',
    zIndex: data?.highlighted ? SELECTED_ELEMENT_Z_INDEX + 1 : undefined,
  };
  // the labels are rendered outside of the edge's SVG group, so a click on them has to select the
  // edge itself - without that, clicking a label would do nothing
  const onLabelClick = () => selectEdge(reactFlow, {id, source, target});

  // maybe use BaseEdge...
  return (
    <>
      {/*
        The name of the foreign key this edge stands for, as an SVG title, which needs no layout of
        its own. It is the first child of the edge's own group rather than of one of the paths,
        because there are two of them - a wide invisible one that makes the edge easier to hit and
        the visible line drawn on top of it - and a title on either would only show over that one.
      */}
      {data?.relation?.fkName && <title>{data.relation.fkName}</title>}
      <path style={style} className="react-flow__edge-path-selector" d={edgePath} markerEnd={markerEnd} fillRule="evenodd"/>
      <path id={id} style={style} className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd}/>
      {(output || input) &&
        <EdgeLabelRenderer>
          {output &&
            <div className="nodrag nopan" style={{...labelWrapperStyles, transform: outputTransform}}>
              <MetricLabel metric={output} direction='output' highlighted={data?.highlighted}
                           testId={`edge-metric-output-${id}`} onClick={onLabelClick}/>
            </div>
          }
          {input &&
            <div className="nodrag nopan" style={{...labelWrapperStyles, transform: inputTransform}}>
              <MetricLabel metric={input} direction='input' highlighted={data?.highlighted}
                           testId={`edge-metric-input-${id}`} onClick={onLabelClick}/>
            </div>
          }
        </EdgeLabelRenderer>
      }
    </>
  );
}


export const ParentNode = ({props}) => {
  return (
    <Box>
      
    </Box>
  )
}