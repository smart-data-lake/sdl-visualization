/**
 * The toolbar for the lineage graph 
 * modified from https://github.com/trananhtuat/animated-sidebar-indicator/blob/main/src/components/sidebar/Sidebar.jsx
 */
import { AlignVerticalTop } from '@mui/icons-material';
import AlignHorizontalLeft from '@mui/icons-material/AlignHorizontalLeft';
import RocketLaunchOutlined from '@mui/icons-material/RocketLaunchOutlined';

import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { useTheme } from '@mui/material/styles';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { IconButton, Tooltip, Divider,Sheet, Stack } from '@mui/joy';
import Select, {SelectOption} from '@mui/joy/Select';
import Option from '@mui/joy/Option';
import MenuItem from '@mui/joy/MenuItem';
import FormControl from '@mui/joy/FormControl';
import ArrowDropDownOutlinedIcon from '@mui/icons-material/ArrowDropDownOutlined';
 
import SchemaIcon from '@mui/icons-material/Schema';
import TransformIcon from '@mui/icons-material/Transform';
import DatasetIcon from '@mui/icons-material/Dataset';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { toPng } from 'html-to-image';
import Box from '@mui/material/Box';

import Draggable from 'react-draggable';
import { useState } from 'react';

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
      main: '#009688',
    }
  },
})

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
          <DatasetIcon />
        </Tooltip>,
      action: 
        <Tooltip arrow title='show action graph' enterDelay={500} enterNextDelay={500} placement='right'>
          <TransformIcon />
        </Tooltip>    
    }
    return options[value];
  }

  function renderSearchType(option: SelectOption<string> | null) {
    if (!option) return null;
    return getSearchTypeElement(option.value);
  }

  return (
    <div>
        <Select value={getSearchTypeElement(graphView)} required
                renderValue={renderSearchType}
                variant="plain"
                size="sm"
                onChange={handleChange}
                style={{ zIndex: 4, cursor: 'pointer' }}
                >
          <Option id="full" value="full">{getSearchTypeElement('full')}</Option>
          <Option id="data" value="data">{getSearchTypeElement('data')}</Option>
          <Option id="action" value="action">{getSearchTypeElement('action')}</Option>
        </Select>
    </div>
  );
}

const LayoutButton = ({layout, setLayout}) => {
  return <div
  title={layout === 'TB' ? 'switch to horizontal layout' : 'switch to vertical layout'}
  className="controls"
  style={{ zIndex: 4, cursor: 'pointer' }}
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
      style={{ zIndex: 4, cursor: 'pointer' }}
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
  style={{ zIndex: 4, cursor: 'pointer' }}
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
      style={{ zIndex: 4, cursor: 'pointer' }}
    >
      <IconButton
        color='neutral'
        onClick={download}>
        <CloudDownloadIcon />
      </IconButton>
    </div>
  );
}

/*
  The main toolbar component
*/
function LineageGraphToolbar({isPropsConfigDefined, graphView, setGraphView, layout, setLayout, expanded, setExpanded, expansionState, hidden, setHidden}) {
  return <Box
    sx={{
      position: 'absolute',
      left: 9,
      bottom: 135,
      display: 'flex',
      flexDirection: 'column-reverse',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: '7px',
      bgcolor: 'white',
      color: 'grey.900',
      boxShadow: 2,
      '& svg': {
        m: -0.5,
      },
    }}
  >
      <GraphViewSelector graphView={graphView} setGraphView={setGraphView}/>
      <Divider orientation='horizontal'/>
      <LayoutButton layout={layout} setLayout={setLayout}/>
      {isPropsConfigDefined && <GraphExpansionButton expanded={expanded} setExpanded={setExpanded} expansionState={expansionState}/>}
      <Divider orientation='horizontal'/>
      <ShowActionButton hidden={hidden} setHidden={setHidden}/>
      <DownloadLineageButton/>
</Box>
}

/*
  Make the toolbar optionally draggable
*/
export function DraggableLineageGraphToolBar(props) {
  return (
    <Draggable>
      <LineageGraphToolbar {...props}/>
    </Draggable>
  );
}


export default LineageGraphToolbar;

