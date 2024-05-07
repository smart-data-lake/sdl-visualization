/*
    Custom ReactFlow Nodes and Edges that are used in the LineageTab as well as theme styling

    TODO: 
    -should implement an Abstract class of custom Node and custom Edge
    -should show last 5 runs states 
    -should implement textoverflow handler
    -adjust between node distance (max width and text-overflow)
    -performance meltdown issue
    -sohuld be able to show all nodes of the same type (generic function in Graph.ts)
*/
import { memo, useRef, useCallback, useState } from 'react';
import { useNavigate, useParams } from "react-router-dom";
import { Handle, NodeProps, Position } from 'reactflow';
import { EdgeProps, getBezierPath } from 'reactflow';

import { Divider, IconButton, Tooltip} from '@mui/joy';
import Box from '@mui/joy/Box';
import LinearProgress from '@mui/joy/LinearProgress';
import { InfoOutlined, ExpandMore , ExpandLess, ArrowOutward  } from '@mui/icons-material';
import Typography from '@mui/joy/Typography';
import FunctionsIcon from '@mui/icons-material/Functions';
import Link from '@mui/joy/Link';
import Button from '@mui/joy/Button';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import TableViewIcon from '@mui/icons-material/TableView';

import { Node as GraphNode, Edge as GraphEdge, NodeType } from '../../../util/ConfigExplorer/Graphs';
import { flowPropsWithSeparateDataAndAction } from './LineageTabWithSeparateView';
import { getIcon } from '../../../util/WorkflowsExplorer/StatusInfo';
import { useFetchWorkflowRunsByElement } from '../../../hooks/useFetchData';

const dataNodeStyles = {
  padding: '10px',
  border: '1px solid #ddd',
  borderRadius: '10px',
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

export const CustomDataNode = ({ data }) => {
  // TODO: remove redundant vars that we can get from props
  // TODO: run status is the same for all nodes now, check runData
  const { id, label, isCenterNode, nodeType, targetPosition, sourcePosition, 
          progress, metric, style, jsonObject, props
  } = data;
  const [ showDetails, setShowDetails ] = useState(false);
  const chartBox = useRef<HTMLDivElement>(); 
  const progressColor = progress < 30 ? actionNodeStyles.progressBar.color.low : 
                progress < 70 ? actionNodeStyles.progressBar.color.medium : 
                progress < 100 ? actionNodeStyles.progressBar.color.high:
                actionNodeStyles.progressBar.color.done;
  const bgcolor = isCenterNode ? nodeColors.centralNode : "#fff"; //'linear-gradient(to right bottom, #430089, #82ffa1)'

  const nodeSubTypeName: string = jsonObject ? jsonObject.type : label;
  const nodeTypeName: string = nodeType === NodeType.ActionNode  ? "Action" :
                               nodeType === NodeType.DataNode ? "Data" :
                               "";
  const abbr = nodeSubTypeName.replace(/(?!^)[^A-Z\d]/g, '')
  const schemaViewerURL = 'https://smartdatalake.ch/json-schema-viewer'

  const { data: runs} = useFetchWorkflowRunsByElement(props.elementType, props.elementName);
  const lastRun = runs?.at(-1);
  const totalRuns = runs?.length;
  console.log("total runs: ", totalRuns)

  // handlers
  const navigate = useNavigate();
  const url = useParams();

  // navigate to object and show details on label click
  const handleDetailsClick = (props: flowPropsWithSeparateDataAndAction, nodeId: string, nodeType: NodeType) => {

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
        <Typography level="body-xs" utterBottom variant="plain">
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
    return <Typography level="body-xs" sx={{ fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', 
                                              marginRight: '15px'}}>
              <div style={{display: 'flex', flexDirection: 'row'}}>
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
                    }}
                    >
                  {abbr}
                  </Box>
                </Tooltip>
                
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
                            sx={{ fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginBottom: '1px', marginLeft: '10px'}}>
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
           // style={{borderRadius: 1, }}
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
        ...(nodeType === NodeType.ActionNode && {borderRadius: '40px',}),
        minWidth: '200px',
        minHeight: '100px',
        position: 'relative',
        bgcolor: bgcolor// replace by customed colors here
      }}
    >
      <Handle type="source" position={sourcePosition} id={id}/>

      <div>
        {showObjectTitle()}
        {showObjectName()}
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
        
      <Handle type="target" position={targetPosition} id={id}/>
    </Box>
  );
};