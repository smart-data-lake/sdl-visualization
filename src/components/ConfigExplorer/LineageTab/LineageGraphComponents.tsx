/*
    Custom ReactFlow Nodes and Edges that are used in the LineageTab as well as theme styling
    TODO: should implement an Abstract class of custom Node and custom Edge
*/
import { memo, useRef, useCallback, useState } from 'react';
import { useNavigate, useParams } from "react-router-dom";
import { Handle, NodeProps, Position } from 'reactflow';
import { EdgeProps, getBezierPath } from 'reactflow';
import { borderColor, borderRadius, padding, position } from 'polished';

import {ThemeProvider, createTheme} from '@mui/system';// shouldnt this be material? doesnt fail now somehow...
import { Divider, IconButton, Tooltip} from '@mui/joy';
import Box from '@mui/joy/Box';
import LinearProgress from '@mui/joy/LinearProgress';
import { InfoOutlined, ExpandMore , ExpandLess, ArrowOutward  } from '@mui/icons-material';
import Typography from '@mui/joy/Typography';
import FunctionsIcon from '@mui/icons-material/Functions';
import Link from '@mui/joy/Link';

import { Node as GraphNode, Edge as GraphEdge, NodeType } from '../../../util/ConfigExplorer/Graphs';
import Button from '@mui/joy/Button';
import { flowPropsWithSeparateDataAndAction } from './LineageTabWithSeparateView';

const theme = createTheme({
  palette: {
    background: {
      paper: '#fff',
    },
    primary: {
      main: '#ff0000',
    },
    secondary: {
      main: '#00ff00',
    },
    success:{
      dark: '#009688',
    }
  },
})

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

const getActionStatus = (progress) => {
  if (progress < 100) {
    return 'In progress';
  } else {
    return 'Completed';
  }
};

const renderProperties = (properties) => {
  return (
    <div>
      {Object.entries(properties).map(([key, value]) => (
        <Typography key={key} variant="plain">
          {key}: {value}
        </Typography>
      ))}
    </div>
  );
};

const handleTypeClick = () => {
  // Handle click event to show documentation
  console.log('Show documentation');
};



// we don't need labels for now
// const showLabels(edges: ReactFlowEdge[]) {
//   return edges.map(e => {
//     e.label = (hidden ? '' : e.data.label_copy);
//     return e;
//   })
// };

// export memo? 
export const CustomDataNode = ({ data }) => {
  // TODO: remove redundant vars that we can get from props
  const { id, label, isCenterNode, nodeType, targetPosition, sourcePosition, 
          properties, progress, metric, style, jsonObject, props
  } = data;
  const [ showDetails, setShowDetails ] = useState(false);
  const chartBox = useRef<HTMLDivElement>(); 
  const color = progress < 30 ? actionNodeStyles.progressBar.color.low : 
                progress < 70 ? actionNodeStyles.progressBar.color.medium : 
                progress < 100 ? actionNodeStyles.progressBar.color.high:
                actionNodeStyles.progressBar.color.done;
  const nodeSubTypeName: string = jsonObject ? jsonObject.type : label;
  const nodeTypeName: string = nodeType === NodeType.ActionNode  ? "Action" :
                               nodeType === NodeType.DataNode ? "Data" :
                               "";
  const abbr = nodeSubTypeName.replace(/(?!^)[^A-Z\d]/g, '')
  const schemaViewerURL = 'https://smartdatalake.ch/json-schema-viewer'

  // handlers
  const navigate = useNavigate();
  const url = useParams();

  // navigate to object and show details on label click
  const handleDetailsClick = (props: flowPropsWithSeparateDataAndAction, nodeId: string, nodeType: NodeType) => {

    let propsHasConfigData = props.configData;
    console.log("props: ", props);

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
        <LinearProgress determinate size="lg" value={progress} sx={{marginBottom: actionNodeStyles.progressBar.bar.marginBottom, color: color}}  />
      </>
    );
  };

  return (
    <Box 
      zIndex={4} 
      ref={chartBox}
      sx={{
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '10px',
        minWidth: '200px',
        minHeight: '100px',
        position: 'relative',
        bgcolor: style.background
      }}
    >
      <Handle type="source" position={sourcePosition} id={id}/>

      <div>
        <Typography level="body-xs" sx={{ fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', 
                                          marginRight: '15px'}}>
          <div style={{display: 'flex', flexDirection: 'row'}}>
              <Box 
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
              {/* <IconButton size="xs" 
                          component={Link}
                          to={schemaViewerURL}
                          variant='contained'
                          sx={{ fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginBottom: '1px'}}>
                <InfoOutlined />
              </IconButton> */}

          </div>
        </Typography>
        <Tooltip title="View Object Details">
          <Button variant='plain' onClick={() => handleDetailsClick(props, label, nodeType)}>
            <Typography level="body-lg" 
                        sx={{ fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginBottom: '1px', marginLeft: '10px'}}>
              {label}
            </Typography> 
          </Button>  
        </Tooltip>
      </div>
      
      {/* <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}> */}
      {/* <Typography level='body-xs' variant="soft">          
        <FunctionsIcon/>
        {metric}
      </Typography> */}
      {/* </div> */}
      <IconButton title='Show object properties'
                  // style={{borderRadius: 1, }}
                  size="sm" 
                  sx={{display: 'inline', float: 'right'}} onClick={() => setShowDetails(!showDetails)}>
        {/* {showDetails ?   "hide props": "show props"}   */}
        {showDetails ?   <ExpandLess />: <ExpandMore />}
      </IconButton>

      { nodeType === NodeType.DataNode ? (
        <>
        </>
      ) : (
        <>
          {/* <Divider sx={{mt:5, mb:1}}  orientation='horizontal'/>
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
          </Box> */}
        </>
      )} 

     
      { showDetails && (
        <>
          <Divider sx={{mt:4, mb:1}} orientation='horizontal'/>
          {renderProperties(properties)}
        </>
        )
      }
        
      <Handle type="target" position={targetPosition} id={id}/>
    </Box>
  );
};

export const CustomActionNode = ({data}) => {

}
