/*
    Custom ReactFlow Nodes and Edges that are used in the LineageTab as well as theme styling

    TODO: 
    -should implement textoverflow handler
    -adjust between node distance (max width and text-overflow)
    -sohuld be able to show all nodes of the same type (generic function in Graph.ts)
*/
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from "react-router-dom";
import { EdgeProps, Handle, getSmoothStepPath } from 'reactflow';

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
import { useFetchWorkflowRunsByElement } from '../../../hooks/useFetchData';
import { NodeType } from '../../../util/ConfigExplorer/Graphs';
import { flowProps, graphNodeProps, ReactFlowNodeProps } from '../../../util/ConfigExplorer/LineageTabUtils';
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
          expandNodeFunc, graphNodeProps, highlighted, runContext, status
  }: ReactFlowNodeProps = data;
  const {isSink,  isSource,  
         isCenterNodeDescendant, isCenterNodeAncestor, isCenterNode
  }: graphNodeProps = graphNodeProps

  // init state
  const [ showDetails, setShowDetails ] = useState(false);
  const initStateBwd = (isCenterNode || isGraphFullyExpanded) && !isSource;
  const initStateFwd = (isCenterNode || isGraphFullyExpanded) && !isSink;
  const [ isExpandedBackward, setIsExpandedBackward ] = useState(initStateBwd); // neighbours are shown by default when creating the subgraph of the center node
  const [ isExpandedForward, setIsExpandedForward ] = useState(initStateFwd);
  const chartBox = useRef<HTMLDivElement>(); 

  useEffect(() => {
    setIsExpandedBackward(initStateBwd);
    setIsExpandedForward(initStateFwd);

  }, [initStateBwd, initStateFwd]);

  const bgcolor = isCenterNode ? nodeColors.centralNode : "#fff";
  // in a run attempt the border tells the state the action ended up in, e.g. red for FAILED. The
  // status icon names that state, so it does not rely on the colour alone
  const borderColor = highlighted ? highLightedEdgeColor :
                      status ? getStatusColor(status) :
                      defaultNodeBorderColor;

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

  // handlers
  const urlParams = useParams();
  const {navigateContent} = useWorkspace();
  const { selectedNodeAttributes } = useLineageGraph();
  const handleOnExpandButtonClick = (direction) => {
    if(direction === 'forward'){
      setIsExpandedForward(!isExpandedForward); 
      expandNodeFunc(label, isExpandedForward, direction, graphView, layoutDirection);
    } else {
      setIsExpandedBackward(!isExpandedBackward); 
      expandNodeFunc(label, isExpandedBackward, direction, graphView, layoutDirection);
    }
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
          {nodeType === NodeType.ActionNode ? <RocketLaunchOutlined sx={{height: '18px'}}/> : <TableViewIcon sx={{height: '18px'}}/>}
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
                          sx={{fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100%', maxHeight: '30px', fontSize:21, cursor: 'pointer'}}
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

  // the offset is symmetric
  const isVerticalLayout = sourcePosition === Position.Bottom; // maybe this is a bug because the hanle is not updated in the first change;
  const handleHOffset = isVerticalLayout ? '1px' : '24px';
  const handleWOffset = isVerticalLayout ? '24px' : '1px';

  return (
    <>
      <Box 
      zIndex={4} 
      ref={chartBox}
      sx={{
        padding: '10px',
        border: ` ${highlighted ? highlightedEdgeStrokeWidth : defaultEdgeStrokeWidth}px solid ${borderColor}`,
        ...(nodeType === NodeType.ActionNode && {borderRadius: '20px',}),
        minWidth: '200px',
        maxWidth: '200px',
        minHeight: '80px',
        maxHeight: '95px',
        position: 'relative',
        bgcolor: bgcolor,
        textOverflow: 'ellipsis',
      }}
    >
      <Handle type="source" position={sourcePosition} id={`${label}`} 
              style={{height: handleHOffset, width: handleWOffset, background: 0, border: 0, 
                      bottom: (isVerticalLayout ? "10px" : undefined), right: (!isVerticalLayout ? "10px" : undefined)}} 
              >
        <IconButton onClick={() => handleOnExpandButtonClick('forward')} sx={{ minHeight: 0, minWidth: 0, padding: 0}}>
        { (!isSink && (isCenterNodeDescendant || isCenterNode)) && (() => {
                      if(isExpandedForward) return <IndeterminateCheckBoxOutlinedIcon style={{...expandButtonStyles}}/>
                      else return <AddBoxOutlinedIcon style={{...expandButtonStyles}} />})()
        }
        </IconButton>
      </Handle>

      <div>
        {showObjectTitle()}
        {showObjectName(layoutDirection)}
      </div>
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
              style={{height: handleHOffset, width: handleWOffset, background: 0, border: 0, 
                      top: (isVerticalLayout ? "-14px": undefined), left: (!isVerticalLayout ? "-14px": undefined)}} 
              >
        <IconButton onClick={() => handleOnExpandButtonClick('backward')} sx={{ minHeight: 0, minWidth: 0, padding: 0}}>
        { (!isSource && (isCenterNodeAncestor || isCenterNode)) && (() => {
                      if(isExpandedBackward) return <IndeterminateCheckBoxOutlinedIcon style={{...expandButtonStyles}}/>
                      else return <AddBoxOutlinedIcon style={{...expandButtonStyles}} />})()
        }
        </IconButton>
      </Handle>
      </Box>
    </>
  );
};


//https://github.com/xyflow/xyflow/discussions/2347
export const CustomEdge = ({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition,targetPosition,
  style,
  markerEnd,
}: EdgeProps) => {

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
  });

  // maybe use BaseEdge...
  return (
    <>
      <path style={style} className="react-flow__edge-path-selector" d={edgePath} markerEnd={markerEnd} fillRule="evenodd"/>
      <path id={id} style={style} className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd}/>
    </>
  );
}


export const ParentNode = ({props}) => {
  return (
    <Box>
      
    </Box>
  )
}