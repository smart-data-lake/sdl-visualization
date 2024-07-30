/*
    Custom ReactFlow Nodes and Edges that are used in the LineageTab as well as theme styling

    TODO: 
    -should implement textoverflow handler
    -adjust between node distance (max width and text-overflow)
    -sohuld be able to show all nodes of the same type (generic function in Graph.ts)
*/
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from "react-router-dom";
import { EdgeProps, Handle, ReactFlowInstance, Node as ReactFlowNode, getSmoothStepPath } from 'reactflow';

import { ExpandLess, ExpandMore } from '@mui/icons-material';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import TableViewIcon from '@mui/icons-material/TableView';
import { Chip, Divider, IconButton, Input, List, ListItem, TextField, Tooltip, Option, AutocompleteOption, Slider } from '@mui/joy';
import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import { Link } from "react-router-dom";
import IndeterminateCheckBoxOutlinedIcon from '@mui/icons-material/IndeterminateCheckBoxOutlined';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';

import { useFetchWorkflowRunsByElement } from '../../../hooks/useFetchData';
import { NodeType } from '../../../util/ConfigExplorer/Graphs';
import { getIcon } from '../../../util/WorkflowsExplorer/StatusInfo';
import './LineageTab.css';
import { flowProps, graphNodeProps, resetViewPortCentered } from '../../../util/ConfigExplorer/LineageTabUtils';
import { Position } from 'reactflow';
import { reactFlowNodeProps } from '../../../util/ConfigExplorer/LineageTabUtils';
import { AutoComplete } from 'antd';
import Draggable from 'react-draggable';
import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import { getRFI, getSelectedEdge, setSelectedEdge } from '../../../util/ConfigExplorer/slice/LineageTab/Common/ReactFlowSlice';
import store from '../../../app/store';
import { getPropertyByPath } from '../../../util/helpers';

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
          expandNodeFunc, graphNodeProps, highlighted
  }: reactFlowNodeProps = data;
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

  const progressColor = progress === undefined ? actionNodeStyles.progressBar.color.done : // dummy placeholder for undefined progres
                        progress < 30 ? actionNodeStyles.progressBar.color.low : 
                        progress < 70 ? actionNodeStyles.progressBar.color.medium : 
                        progress < 100 ? actionNodeStyles.progressBar.color.high:
                        actionNodeStyles.progressBar.color.done;
  const bgcolor = isCenterNode ? nodeColors.centralNode : "#fff"; 

  const nodeSubTypeName: string = jsonObject !== undefined ? jsonObject.type : label;
  const nodeTypeName: string = nodeType === NodeType.ActionNode  ? "actions" :
                               nodeType === NodeType.DataNode ? "dataObjects" :
                               "";
  const abbr = nodeSubTypeName.replace(/(?!^)[^A-Z\d]/g, ''); // take the capital letters and the first letter of the camelCase name
  const schemaViewerURL = 'https://smartdatalake.ch/json-schema-viewer';
  const { data: runs} = useFetchWorkflowRunsByElement(nodeTypeName, label);
  const lastRun = runs?.at(-1); // this only shows the LAST run, but the times could be different for each object

  // handlers
  const navigate = useNavigate();
  const url = useParams();
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

    let propsHasConfigData = props.configData;

    if(nodeType === NodeType.DataNode){
        navigate(`/config/dataObjects/${nodeId}`); 
      
    } else if (nodeType === NodeType.ActionNode){
        navigate(`/config/actions/${nodeId}`);
        // navigate(`/workflows/${url.flowId}/${url.runNumber}/${url.taskId}/${url.tab}/${nodeId}`);
    } else {
      throw Error("Unknown node type: " + nodeType);
    }
  };

  // render progress bar
  const renderProgressBar = (color, progress) => {
    return (
      <>
        <Typography level="body-xs" variant="plain"> 
          {progress}% complete
        </Typography>
        {/* <LinearProgress determinate size="lg" value={progress} sx={{marginBottom: actionNodeStyles.progressBar.bar.marginBottom, color: color}}  /> */}
      </>
    );
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
        <Tooltip title={objectType}>
          {nodeType === NodeType.ActionNode ? <RocketLaunchOutlined sx={{height: '18px'}}/> : <TableViewIcon sx={{height: '18px'}}/>}
        </Tooltip>
        <Tooltip title={nodeSubTypeName}>
          <Typography level="body-xs" onClick={() => window.open(schemaViewerURL, '_blank')} 
            sx={{marginLeft:'3px', cursor: 'pointer', fontSize: 14, fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'}}
            >
          {abbr}
          </Typography>
        </Tooltip>
        {/* <div>
          {createConnectionChip(props.connection.id)} // need distinction on objects without conn.  
        </div> */}
        <Box sx={{flex: 1}}/>
        {lastRun?.status !== undefined  && (getIcon(lastRun?.status, '0px', {scale: '100%'}))}

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

  function showObjectName(){
    return <Tooltip title={`${label}: view details`} arrow>
              <Typography level="body-lg" 
                          sx={{ 
                            fontWeight: 'bold', 
                            textOverflow: 'ellipsis', 
                            overflow: 'hidden', 
                            whiteSpace: 'nowrap', 
                            maxWidth: '100%',
                            maxHeight: '30px',
                            fontSize:21,
                            cursor: 'pointer'
                          }}
                          onClick={() => handleDetailsClick(props, label, nodeType)} >
                {label}
              </Typography> 
            </Tooltip>
  }

  function showProgressBar(color, progress){
    return  <>
              <Divider sx={{mt:5, mb:1}}  orientation='horizontal'/>
                      {renderProgressBar(color, progress)}
                      <Box sx={{
                        bgcolor: color,
                        border: '1px solid #ddd',
                        borderRadius: '10px',
                        width: 0.3,
                        justifyContent: 'flex-end'
                        }}>
                        <Box flex={0} sx={{justifyContent: 'center', display: 'flex', color: '#fff', fontSize: 'xs', paddingRight: 1}}>
                          {getActionStatus(progress)}
                        </Box>
                      </Box> 
            </>
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
        border: ` ${highlighted ? highlightedEdgeStrokeWidth : defaultEdgeStrokeWidth}px solid ${highlighted ? highLightedEdgeColor : defaultNodeBorderColor}`,
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
        {showObjectName()}
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

export function ZoomSlider(){
  const state = store.getState();
  const rfi: ReactFlowInstance = getPropertyByPath(state, 'reactFlow.rfi');
  const maxZoom = 2.2;
  const minZoom = 0.05
  const zoomValOnClick = 0.3;
  const [currentZoom, setCurrentZoom] = useState(1);

  // are the zoom bounds handled by the reactFlow JSX element?
  const zoomOnSlide = (event) => {
    const val = event.target.value;
    const viewport = rfi.getViewport();
    setCurrentZoom(val);
    rfi.setViewport({...viewport, zoom: val});
  }

  const zoomOnClick = (val: number) => {
    const viewport = rfi.getViewport();
    const currZoom = rfi.getZoom();
    var newZoom = currZoom + val;
    newZoom = Math.min(Math.max(newZoom, minZoom), maxZoom);
    setCurrentZoom(newZoom)
    rfi.setViewport({...viewport, zoom: newZoom});
  }

  const valueText = (value: number) => {
    return `zoom: ${value}`;
  }

  return (
    <Box sx={{
          position: 'absolute',
          left: 8,
          bottom: 40,
          display: 'flex',
          flexDirection: 'column',
          height: 140,
          width: 20
    }}>
      <IconButton onClick={() => zoomOnClick(zoomValOnClick)}>
        <ZoomInIcon sx={{ position: 'absolute', padding: 0}}/>
      </IconButton>
      <Slider
        variant='soft'
        onChange={zoomOnSlide}
        orientation="vertical"
        aria-label="Always visible"
        value={currentZoom ?? 1}
        max={maxZoom}
        min={minZoom}
        getAriaValueText={valueText}
        step={0.02}
        // valueLabelDisplay="on"
      />
      <IconButton onClick={() => zoomOnClick(-zoomValOnClick)}>
        <ZoomOutIcon sx={{position: 'absolute', padding: 0}}/>
      </IconButton>
    </Box>
  )
}


export const ParentNode = ({props}) => {
  return (
    <Box>
      
    </Box>
  )
}

export const EdgeInfoBox = ({rfi}) => {
  const dispatch = useAppDispatch();
  // const rfi = useAppSelector((state) => getRFI(state));
  const edge = useAppSelector((state) => getSelectedEdge(state));

  const source = edge.source;
  const target = edge.target;

  const handleFocus = (rfNode: ReactFlowNode) => {
    resetViewPortCentered(rfi, [rfNode]);
  }

  const onClose = () => {
    dispatch(setSelectedEdge(undefined));
  }

  return <Draggable bounds="parent">
    <Box
  sx={{
    position: 'absolute',
    right: 20,
    top: 20,
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '7px',
    width: 300,
    height: 250,
    maxWidth: 300,
    maxHeight: 300,
    bgcolor: 'white',
    color: 'grey.900',
    boxShadow: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    '& svg': {
      m: -0.5,
    },
  }}
>
  <>
    <button onClick={onClose}>Close</button>
    <p><strong>Selected Edge:</strong> {edge.id}</p>
    <Box sx={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
      <p><strong>Source:</strong> {source}</p>
      <IconButton 
        title='go to object'
        onClick={() => handleFocus(rfi.getNode(source)!)}
        size='sm'
        sx={{ fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginBottom: '1px'}}>
        <ArrowForwardIcon />
      </IconButton>
    </Box>
    <Box sx={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
      <p><strong>Target:</strong> {target}</p>
      <IconButton 
        title='go to object'
        onClick={() => handleFocus(rfi.getNode(target)!)}
        size="sm" 
        sx={{ fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginBottom: '1px'}}>
        <ArrowForwardIcon />
      </IconButton>
    </Box>
  </>
</Box>
</Draggable>
}

