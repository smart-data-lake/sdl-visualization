/*
    Custom ReactFlow Nodes and Edges that are used in the LineageTab as well as theme styling

    TODO: 
    -should implement textoverflow handler
    -adjust between node distance (max width and text-overflow)
    -sohuld be able to show all nodes of the same type (generic function in Graph.ts)
*/
import { memo, useRef, useCallback, useState } from 'react';
import { useNavigate, useParams } from "react-router-dom";
import { Handle, useUpdateNodeInternals, EdgeProps, getBezierPath, getStraightPath, getSmoothStepPath} from 'reactflow';

import { Divider, IconButton, Tooltip, Chip} from '@mui/joy';
import Box from '@mui/joy/Box';
import LinearProgress from '@mui/joy/LinearProgress';
import { InfoOutlined, ExpandMore , ExpandLess, ArrowOutward  } from '@mui/icons-material';
import Typography from '@mui/joy/Typography';
import FunctionsIcon from '@mui/icons-material/Functions';
import Button from '@mui/joy/Button';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import TableViewIcon from '@mui/icons-material/TableView';
import { Link } from "react-router-dom";

import { Node as GraphNode, Edge as GraphEdge, NodeType } from '../../../util/ConfigExplorer/Graphs';
import { flowProps } from './LineageTabWithSeparateView';
import { getIcon } from '../../../util/WorkflowsExplorer/StatusInfo';
import { useFetchWorkflowRunsByElement } from '../../../hooks/useFetchData';
import './LineageTab.css'

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
  const { props, label, isCenterNode, nodeType, targetPosition, sourcePosition, 
          progress, jsonObject
  } = data;

  const [ showDetails, setShowDetails ] = useState(false);
  const chartBox = useRef<HTMLDivElement>(); 
  const progressColor = progress < 30 ? actionNodeStyles.progressBar.color.low : 
                progress < 70 ? actionNodeStyles.progressBar.color.medium : 
                progress < 100 ? actionNodeStyles.progressBar.color.high:
                actionNodeStyles.progressBar.color.done;
  const bgcolor = isCenterNode ? nodeColors.centralNode : "#fff"; //'linear-gradient(to right bottom, #430089, #82ffa1)'

  const nodeSubTypeName: string = jsonObject !== undefined ? jsonObject.type : label;
  const nodeTypeName: string = nodeType === NodeType.ActionNode  ? "actions" :
                               nodeType === NodeType.DataNode ? "dataObjects" :
                               "";
  const abbr = nodeSubTypeName.replace(/(?!^)[^A-Z\d]/g, '') // take the capital letters and the first letter of the camelCase name
  const schemaViewerURL = 'https://smartdatalake.ch/json-schema-viewer'
  const { data: runs} = useFetchWorkflowRunsByElement(nodeTypeName, label);
  const lastRun = runs?.at(-1); // this only shows the LAST run, but the times could be different for each object
  // const totalRuns = runs?.length;

  // handlers
  const navigate = useNavigate();
  const url = useParams();

  // navigate to object and show details on label click
  const handleDetailsClick = (props: flowProps, nodeId: string, nodeType: NodeType) => {

    let propsHasConfigData = props.configData;

    if(nodeType === NodeType.DataNode){
      if(propsHasConfigData){
        navigate(`/config/dataObjects/${nodeId}`); 
      }
    } else if (nodeType === NodeType.ActionNode){

      if(propsHasConfigData){
        navigate(`/config/actions/${nodeId}`);
      } else {
        navigate(`/workflows/${url.flowId}/${url.runNumber}/${url.taskId}/${url.tab}/${nodeId}`);
      }
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
    return <Typography level="body-xs" sx={{ fontWeight: 'bold', 
                                             textOverflow: 'ellipsis', 
                                             overflow: 'hidden', 
                                             whiteSpace: 'nowrap', 
                                             marginRight: '15px'}}>
              <div style={{display: 'flex', 
                           flexDirection: 'row'}}>
                <div style={{justifyContent: 'flex-end'}}>
                  <Tooltip title={objectType}>
                    {nodeType === NodeType.ActionNode ? <RocketLaunchOutlined/> : <TableViewIcon/>}
                  </Tooltip>
                </div>
                <Tooltip title={nodeSubTypeName}>
                  <Box onClick={() => window.open(schemaViewerURL, '_blank')} 
                    sx={{marginLeft:'7px', 
                      textAlign: 'center', 
                      // border: '',
                      borderRadius: '2px',
                      display: 'inline-block',
                      "&:hover": {
                      backgroundColor: 'rgb(7, 120, 200, 0.42)',
                      },
                      fontSize: 14
                    }}
                    >
                  {abbr}
                  </Box>
                </Tooltip>
                {/* <div>
                  {createConnectionChip(props.connection.id)} // need distinction on objects without conn.  
                </div> */}
                <div>
                  {lastRun?.status !== undefined  && (getIcon(lastRun?.status, '0px', {display: 'block'}))}
                </div>

                
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

              </div>
            </Typography>
  }

  function showObjectName(){
    return <Tooltip title="View Object Details">
              <Button variant='plain' onClick={() => handleDetailsClick(props, label, nodeType)}>
                <Typography level="body-lg" 
                            sx={{ 
                              fontWeight: 'bold', 
                              textOverflow: 'ellipsis', 
                              overflow: 'hidden', 
                              whiteSpace: 'nowrap', 
                              marginBottom: '1px', 
                              maxWidth: '150px',
                              maxHeight: '30px',
                              fontSize:21
                            }}>
                  {label}
                </Typography> 
              </Button>  
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

  function showProperties(){
    return <IconButton title='Show object properties'
           size="sm" 
           sx={{display: 'inline', float: 'right'}} onClick={() => setShowDetails(!showDetails)}>
           {/* {showDetails ?   "hide props": "show props"}   */}
           {showDetails ?  <ExpandLess />: <ExpandMore />}
           </IconButton>
  }

  return (
    <Box 
      zIndex={4} 
      ref={chartBox}
      sx={{
        padding: '10px',
        border: '3px solid #a9a9a9',
        ...(nodeType === NodeType.ActionNode && {borderRadius: '20px',}),
        minWidth: '200px',
        maxWidth: '200px',
        minHeight: '80px',
        maxHeight: '95px',
        position: 'relative',
        bgcolor: bgcolor,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flexDirection: 'row'
      }}
    >
      <Handle type="source" position={sourcePosition} id={`${label}`}/>

      <div>
        {showObjectTitle()}
        <div style={{
                    display: 'flex',
                    textOverflow: 'ellipsis',
                    width: '50px'
                }}>
                    {showObjectName()}
          </div>
      </div>
      {showProperties()}
      
      {/* <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}> */}
      {/* <Typography level='body-xs' variant="soft">          
        <FunctionsIcon/>
        {metric}
      </Typography> */}
      {/* </div> */}

      { showDetails && (
        <>
          {renderProperties(runs)}
        </>
        )
      }
        
      <Handle type="target" position={targetPosition} id={`${label}`}/>
    </Box>
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
    borderRadius: 10
  });

  // maybe use BaseEdge...
  return (
    <>
      <path style={style} className="react-flow__edge-path-selector" d={edgePath} markerEnd={markerEnd} fillRule="evenodd"/>
      <path id={id} style={style} className="react-flow__edge-path" d={edgePath} markerEnd={markerEnd}/>
    </>
  );
}