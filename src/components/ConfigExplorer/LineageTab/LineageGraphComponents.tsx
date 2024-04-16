/*
    Custom ReactFlow Nodes and Edges that are used in the LineageTab as well as theme styling
    TODO: should implement an Abstract class of custom Node and custom Edge
*/
import { memo, ReactNode, useCallback } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { EdgeProps, getBezierPath } from 'reactflow';
import { Node as GraphNode, Edge as GraphEdge } from '../../../util/ConfigExplorer/Graphs';
import {Box, ThemeProvider, createTheme} from '@mui/system';


/*
  A palette for custom node stylinng
*/
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
  
const TurboNode = memo(({ data }: NodeProps<GraphNode>) => {
    return (
    <>
    <div className="wrapper gradient">
        <div className="inner">
        <div className="body">
            <div>
            <div className="title">{data.id}</div>
            </div>
        </div>
        </div>
    </div>
    </>
    );
});
  

function TurboEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
  }: EdgeProps) {
    const xEqual = sourceX === targetX;
    const yEqual = sourceY === targetY;
  
    const [edgePath] = getBezierPath({
      // we need this little hack in order to display the gradient for a straight line
      sourceX: xEqual ? sourceX + 0.0001 : sourceX,
      sourceY: yEqual ? sourceY + 0.0001 : sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  
    return (
      <>
        <path
          id={id}
          style={style}
          className="react-flow__edge-path"
          d={edgePath}
          markerEnd={markerEnd}
        />
      </>
    );
  }


// Do we need an id for each handle so that it can be linked in the component?
// Should we remove any other initializations in the component file because this might cause custom component not recognizing the init values?
// function CustomNode ({id, data, targetPosition, sourcePosition }) {
// am I implicitly calling reactFlow components here?
const handleStyle = { left: 10 };

// function CustomNode(props: NodeProps<GraphNode>){
//     return (
//       <>
//         <div className="custom">

//           {/* <Handle 
//             type="target" 
//             position={(props.sourcePosition as Position)}//Position.Top} 
//             id={props.id}        
//           /> */}
//           <div>
//             <label htmlFor="text">Name:</label>
//             <div className="title">{props.data.id}</div>
//           </div>
//           {/* <Handle
//             type="source"
//             position={props.targetPosition as Position}
//             id={props.id}
//             style={handleStyle}
//           /> */}

          
//           {/* <Handle type="source" position={Position.Bottom} id="b" /> */}
//         </div>
//       </>
//       );
// }

function CustomNode({data, isConnectable}){
  return (
    <div className="text-updater-node">
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      <div>
        <label htmlFor="text">Text:</label>
        <input id="text" name="text"  className="nodrag" />
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
      /> 
       {/* <Handle type="source" position={Position.Bottom}  
       isConnectable={isConnectable} /> */}
    </div>
  );
}

export {CustomNode};
export {TurboNode, TurboEdge}