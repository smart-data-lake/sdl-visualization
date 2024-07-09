/**
 * The toolbar for the lineage graph 
 * modified from https://github.com/trananhtuat/animated-sidebar-indicator/blob/main/src/components/sidebar/Sidebar.jsx
 */
import { AlignVerticalTop, LoopOutlined } from '@mui/icons-material';
import AlignHorizontalLeft from '@mui/icons-material/AlignHorizontalLeft';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import FilterCenterFocusIcon from '@mui/icons-material/FilterCenterFocus';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import SchemaIcon from '@mui/icons-material/Schema';
import TableViewTwoTone from '@mui/icons-material/TableViewTwoTone';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import { Divider, IconButton, Tooltip } from '@mui/joy';
import Option from '@mui/joy/Option';
import Select, { SelectOption } from '@mui/joy/Select';
import Box from '@mui/material/Box';
import { toPng } from 'html-to-image';

import Draggable from 'react-draggable';
import { ReactFlowInstance, Node as ReactFlowNode } from 'reactflow';
import { onlyUnique } from '../../../util/helpers';


/*
  Styling
*/
const componentZIndex = 4;
const styles = { zIndex:  componentZIndex, cursor: 'pointer' }

/*
  interface definitions
*/
type FuncTypes = 'group' | 'filter' | 'update';


/*
  helper function for image downloading
*/
function downloadImage(dataUrl: string) {
  const a = document.createElement('a');
  a.setAttribute('download', 'lineage.png');
  a.setAttribute('href', dataUrl);
  a.click();
}


/*
  Individual components of the toolbar with its custom hooks
*/
const GraphViewSelector = ({graphView, setGraphView}) => {
  const handleChange = (event, value) => {
    if(event !== null){
      setGraphView(value);
    }
  };

  // same in ElementList.tsx
  function getSearchTypeElement(value: string) {
    const options = {
      full:
        <Tooltip arrow title='show full graph' enterDelay={500} enterNextDelay={500} placement='right'>
          <SchemaIcon />
        </Tooltip>,
      data:
        <Tooltip arrow title='show data graph' enterDelay={500} enterNextDelay={500} placement='right'>
          <TableViewTwoTone />
        </Tooltip>,
      action: 
        <Tooltip arrow title='show action graph' enterDelay={500} enterNextDelay={500} placement='right'>
          <RocketLaunchOutlined />
        </Tooltip>    
    }
    return options[value];
  }

  function renderSearchType(option: SelectOption<string> | null) {
    if (!option) {return null};
    return getSearchTypeElement(option!.value);
  }
  return (
        <Select variant="plain"
                size="sm"
                value={graphView}
                onChange={handleChange}
                renderValue={renderSearchType}
                sx={{ zIndex: componentZIndex, '& .MuiSelect-button': {overflow: "visible"}}}
        >
          <Option id="full" value="full">{getSearchTypeElement('full')}</Option>
          <Option id="data" value="data">{getSearchTypeElement('data')}</Option>
          <Option id="action" value="action">{getSearchTypeElement('action')}</Option>
        </Select>
  );
}

const LayoutButton = ({layout, setLayout}) => {
  return <div
  title={layout === 'TB' ? 'switch to horizontal layout' : 'switch to vertical layout'}
  className="controls"
  style={styles}
>
  <IconButton
    color={'neutral'}
    onClick={() => setLayout(layout === 'TB' ? 'LR' : 'TB')}
  >
    {layout === 'TB' ? <AlignVerticalTop /> : <AlignHorizontalLeft />}
  </IconButton>
</div>
}

const GraphExpansionButton = ({expanded, setExpanded, expansionState}) => {
  function expandGraph(): void {
    let buttonMessage = expanded ? 'Compress Graph' : 'Expand Graph';
    setExpanded([!expanded, buttonMessage]);
  }

  return <div
      title={expansionState as string}
      style={styles}
    >
      <IconButton
        color='neutral'
        onClick={expandGraph}
      >
        {expanded ? <OpenWithIcon /> : <CloseFullscreenIcon />}
      </IconButton>
    </div>
}

const ShowActionButton = ({hidden, setHidden}) => {
  return  <div
  title='Display / Hide action IDs'
  style={styles}
>
  <IconButton
    color={hidden ? 'neutral' : 'primary'}
    onClick={() => setHidden(!hidden)}
  >
    <RocketLaunchOutlined />
  </IconButton>
</div>
}


function DownloadLineageButton() {
  const download = () => {
    toPng(document.querySelector('.react-flow') as HTMLElement, {
      filter: (node) => {
        // don't include minimap, the controls and the MUI Buttons.
        return (          
        !node?.classList?.contains('react-flow__minimap') &&
        !node?.classList?.contains('react-flow__controls') &&
        !node?.classList?.contains('MuiSvgIcon-root') &&
        !node?.classList?.contains('MuiButtonBase-root'))
      },
    }).then(downloadImage);
  };

  return (
    <div
      title='Download image as PNG file'
      style={styles}
    >
      <IconButton
        color='neutral'
        onClick={download}>
        <CloudDownloadIcon />
      </IconButton>
    </div>
  );
}

function ResetViewPortButton({handleOnClick}){
  return (
    <div
      title='Center viewport'
      style={styles}>
      <IconButton onClick={handleOnClick}>
        <LoopOutlined/>
      </IconButton>
    </div>
  )
}

function CenterFocusButton({handleOnClick}){
  return (
    <div
      title='Focus on central node'
      style={styles}>
      <IconButton onClick={handleOnClick}>
        <FilterCenterFocusIcon/>
      </IconButton>
    </div>
  )
}

function printMethods(obj: any) {
  // Get the prototype of the object
  const proto = Object.getPrototypeOf(obj);

  // Get all property names from the prototype
  const propertyNames = Object.getOwnPropertyNames(proto);

  // Filter out the methods
  const methods = propertyNames.filter((name) => {
    return typeof proto[name] === 'function';
  });

  // Print the methods
  methods.forEach((method) => {
    console.log(method);
  });
}

/*
  takes as input a ReactFlowInstance and functions:
  - filterFunc: filter rfNodes based on custom criteria
  - groupingFunc: defined the aggregation to be done on the filtered nodes
  - updateFunc: update ReactFlowInstance

  args: jsonObj

  This function implemented for nodes only
*/
function GroupingButton({rfi, groupingFunc, graph, args}){ 
  // create new rfNode need to set parentId, no nested subflows for now
  const handleOnClick = () => {
    groupingFunc(rfi, graph, args)
  }

  // need code to remove the grouped node

  // there might be weird parent node overlappings, as the groupings are not guaranteed to be layed out well
   return (<IconButton onClick={handleOnClick}>
            <WorkspacesIcon/>
          </IconButton>)
}


/*
  The main toolbar component
*/
export function LineageGraphToolbar(props) {
  return <Box
    sx={{
      zIndex: componentZIndex,
      position: 'absolute',
      left: 9,
      bottom: 135,
      display: 'flex',
      flexDirection: 'column-reverse',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: '7px',
      width: 50,
      bgcolor: 'white',
      color: 'grey.900',
      boxShadow: 2,
      '& svg': {
        m: -0.5,
      },
    }}
  >
      <GroupingButton rfi={props.rfi} groupingFunc={props.groupingFunc} graph={props.graph} args={props.groupingArgs}/>
      <GraphViewSelector graphView={props.graphView} setGraphView={props.setGraphView}/>
      <Divider orientation='horizontal'/>
      <ResetViewPortButton handleOnClick={props.handleOnClickResetViewport}/>
      <CenterFocusButton handleOnClick={props.handleOnClickCenterFocus}/>
      <LayoutButton layout={props.layout} setLayout={props.setLayout}/>
      {props.isPropsConfigDefined && <GraphExpansionButton expanded={props.expanded} setExpanded={props.setExpanded} expansionState={props.expansionState}/>}
      <Divider orientation='horizontal'/>
      {/* <ShowActionButton hidden={props.hidden} setHidden={props.setHidden}/> */}
      <DownloadLineageButton/>
</Box>
}

/*
  Make the toolbar optionally draggable
*/
export function DraggableLineageGraphToolbar(props) {
  return (
    <Draggable>
      <LineageGraphToolbar {...props}/>
    </Draggable>
  );
}


export default LineageGraphToolbar;

