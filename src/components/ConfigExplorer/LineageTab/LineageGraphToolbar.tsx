import { AlignVerticalTop, ArrowDropDown, ArrowRight, Expand, LoopOutlined } from '@mui/icons-material';
import AlignHorizontalLeft from '@mui/icons-material/AlignHorizontalLeft';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import FilterCenterFocusIcon from '@mui/icons-material/FilterCenterFocus';
import ReorderIcon from '@mui/icons-material/Reorder';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';
import SchemaIcon from '@mui/icons-material/Schema';
import TableViewTwoTone from '@mui/icons-material/TableViewTwoTone';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';

import { Button, ButtonGroup, Divider, Dropdown, IconButton, List, ListDivider, ListItem, ListItemDecorator, Menu, MenuButton, MenuItem, SvgIcon, Tooltip, Typography, Option } from '@mui/joy';
// import Option from '@mui/joy/Option';
import Select, { SelectOption } from '@mui/joy/Select';
import Box from '@mui/material/Box';
import { toPng } from 'html-to-image';

import Draggable from 'react-draggable';
import { resetGroupSettings, getNonParentNodesFromArray, getParentNodeFromArray, getParentNodesFromArray, computeNodePositionFromParent, computeParentNodePositionFromArray, prioritizeParentNodes, computeChildNodeRelativePosition, getFreeNodesFromArray, GraphView } from '../../../util/ConfigExplorer/LineageTabUtils';
import { useCallback, useState } from 'react';
import { RootState } from '../../../app/store';
import { setGraphViewTo } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphViewSlice';
import { useAppDispatch, useAppSelector } from '../../../hooks/useRedux';
import { setLayoutTo } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/LayoutSlice';
import { setExpansionStateTo } from '../../../util/ConfigExplorer/slice/LineageTab/Toolbar/GraphExpansionSlice';


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



const GraphViewSelector = () => {
  const graphView = useAppSelector((state: RootState) => state.graphViewSelector.view);
  const dispatch = useAppDispatch();

  const handleChange = (event, value) => {
    if(event !== null){
      dispatch(setGraphViewTo(value));
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
            <ListDivider role="none" inset="gutter" />
            <Option id="data" value="data">{getSearchTypeElement('data')}</Option>
            <ListDivider role="none" inset="gutter" />
            <Option id="action" value="action">{getSearchTypeElement('action')}</Option>
        </Select>
  );
}

function LayoutButton () {
  const layout = useAppSelector((state: RootState) => state.layoutSelector.layout);
  const dispatch = useAppDispatch();

  return <div
  title={layout === 'TB' ? 'switch to horizontal layout' : 'switch to vertical layout'}
  className="controls"
  style={styles}
>
  <IconButton
    color={'neutral'}
    onClick={() => dispatch(setLayoutTo(layout === 'TB' ? 'LR' : 'TB'))}
  >
    {layout === 'TB' ? <AlignVerticalTop /> : <AlignHorizontalLeft />}
  </IconButton>
</div>
}

function GraphExpansionButton () {
  const dispatch = useAppDispatch();
  const isExpanded = useAppSelector((state: RootState) => state.graphExpansion.isExpanded);
  const title = isExpanded ? 'Compress Graph' : 'Expand Graph';

  return <div
      title={title}
      style={styles}
    >
      <IconButton
        color='neutral'
        onClick={() =>  dispatch(setExpansionStateTo({isExpanded: !isExpanded}))}
      >
        {isExpanded ?  <CloseFullscreenIcon /> : <OpenWithIcon />}
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
      <IconButton sx={{display:"flex", flexDirection:"column"}}
        color='neutral'
        onClick={download}>
        <CloudDownloadIcon />
        {/* <Typography variant='plain' sx={{ fontSize: '0.55rem' }}>download</Typography> */}
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

function RecomputeLayoutButton({rfi, layoutDirection, computeLayoutFunc}){

  // recomputes the layout from the current nodes in the flow instance (rfi)
  const handleOnClick = () => {
    const rfNodes = rfi.getNodes();
    const nonParentNodes = getNonParentNodesFromArray(rfNodes);
    const parentNodes = getParentNodesFromArray(rfNodes);
    const rfEdges = rfi.getEdges();

    var layoutedNonParentNodes = computeLayoutFunc(nonParentNodes, rfEdges, layoutDirection);
    var layoutedParentNodes = computeParentNodePositionFromArray(layoutedNonParentNodes, parentNodes);
    layoutedNonParentNodes = computeNodePositionFromParent(layoutedNonParentNodes, layoutedParentNodes);

    rfi.setNodes([...layoutedNonParentNodes, ...layoutedParentNodes])
    prioritizeParentNodes(rfi);
  }

  // const handleOnClick1 = () => {
  //   // 1.layout parent nodes and "free" nodes jointly
  //   // 2.adjust children nodes relative to parents
  //   const rfNodes = rfi.getNodes();
  //   const nonParentNodes = getNonParentNodesFromArray(rfNodes);
  //   const freeNodes = getFreeNodesFromArray(rfNodes);
  //   const parentNodes = getParentNodesFromArray(rfNodes);
  //   const rfEdges = rfi.getEdges();
  // }

  return (
    <div
      title='Recompute layout'
      style={styles}>
      <IconButton onClick={handleOnClick}>
            <ReorderIcon/>
      </IconButton>
    </div>
  )
}

function GroupingButton({groupingFunc, args, handleGrouping}){ 
  // create new rfNode need to set parentId, no nested subflows for now
  const handleOnClick = () => {
    handleGrouping(groupingFunc, args);
  }

  // there might be weird parent node overlappings, as the groupings are not guaranteed to be layed out well
  return (
    <div
      title='Grouping'
      style={styles}>
      <IconButton onClick={handleOnClick}>
            <WorkspacesIcon/>
      </IconButton>
    </div>
  )
}

function SettingsButton(){
  const handleOnClick = () => {

  }

  return (
    <div
      title='Settings'
      style={styles}>
      <IconButton onClick={handleOnClick}>
        <SettingsIcon/>
      </IconButton>
    </div>
  )

}

function ShowDocumentationButton(){
  const handleChange = useCallback((_event, value) => {
    let url = '';
    if(value === "schema"){
      url = 'https://smartdatalake.ch/json-schema-viewer';
    } else if(value === "doc"){
      url = 'https://smartdatalake.ch/';
    } else {}
    window.open(url, '_blank');
  }, []);

  function renderDocButton(option){
    return <Tooltip arrow title='Show documentation options' enterDelay={500} enterNextDelay={500} placement='right'>
            <DescriptionIcon sx={{}}/>
          </Tooltip>    
  }

  return (
    <div
      title='View documentation'
      style={styles}>
        <Select variant="plain"
                size="sm"
                renderValue={renderDocButton}
                onChange={handleChange}
                sx={{ zIndex: componentZIndex, '& .MuiSelect-button': {overflow: "visible"}}}
        >
          <Option id="schemaViewer" value="schema"><Typography fontSize='xs' variant='plain'>Schema viewer</Typography></Option>
          <Option id="documentation" value="doc"><Typography fontSize='xs' variant='plain'>Documentation</Typography></Option>
        </Select>
      </div>
  );
}

/*
  The main toolbar component
*/
export function LineageGraphToolbar(props) {
  return  <Draggable bounds="parent">
            <Box
            sx={{
              zIndex: componentZIndex,
              position: 'absolute',
              right: 200,
              top: 20,
              display: 'flex',
              flexDirection: 'row',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '7px',
              width: 410,
              bgcolor: 'white',
              color: 'grey.900',
              boxShadow: 2,
              '& svg': {
                m: -0.5,
              },
            }}
          >   
              <SettingsButton/>
              <ShowDocumentationButton/> 
              <Divider orientation='vertical'/>
              <GroupingButton  groupingFunc={props.groupingFunc} args={props.groupingArgs} handleGrouping={props.handleGrouping}/>
              <GraphViewSelector/>
              {props.isPropsConfigDefined && <GraphExpansionButton/>}
              <Divider orientation='vertical'/>
              <ResetViewPortButton handleOnClick={props.handleOnClickResetViewport}/>
              <CenterFocusButton handleOnClick={props.handleOnClickCenterFocus}/>
              <RecomputeLayoutButton rfi={props.rfi} layoutDirection={props.layout} computeLayoutFunc={props.computeLayoutFunc}/>
              <LayoutButton/>
              <Divider orientation='vertical'/>
              <DownloadLineageButton/>
            </Box>
          </Draggable>
}


export default LineageGraphToolbar;

