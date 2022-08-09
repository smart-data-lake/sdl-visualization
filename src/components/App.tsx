import './App.css';
import NestedList from './NestedList';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import React, {useState, useCallback} from 'react';
import DataDisplayView from './DataDisplayView';
import {parseFileStrict} from '../util/HoconParser';
import {Box, AppBar, Toolbar, IconButton, Typography, Drawer, CssBaseline, Icon} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

export const defaultDrawerWidth = 240;
const minDrawerWidth = 50;
const maxDrawerWidth = 600;

function App() {

  // state
  const [data, setData] = React.useState<Object>({dataObjects: {}, actions: {}, connections: {}, global: {}});
  const [selectedElement, setSelectedElement] = React.useState("");
  const [selectedElementType, setSelectedElementType] = React.useState("");
  const [isLoading, setLoading] = useState(true);
  const [drawerWidth, setDrawerWidth] = useState(defaultDrawerWidth);

  // parse config
  React.useEffect(() => {
    parseFileStrict("http://localhost:3000/config/exampleFile.conf")
      .then(newData => {
        setData(newData);
        setLoading(false);
    })
  }, []); // only once
  
  // resize drawer
  const handleDraggerMouseDown = (e: React.MouseEvent) => { // this needs React.MouseEvent as it is used in react component
    document.addEventListener("mouseup", handleMouseUp, true);
    document.addEventListener("mousemove", handleMouseMove, true);
  };
  const handleMouseUp = () => {
    document.removeEventListener("mouseup", handleMouseUp, true);
    document.removeEventListener("mousemove", handleMouseMove, true);
  };
  const handleMouseMove = useCallback((e: MouseEvent): any => { // this needs document MouseEvent as it is used with document add/removeEventListener
    const newWidth = e.clientX - document.body.offsetLeft;
    if (newWidth > minDrawerWidth && newWidth < maxDrawerWidth) {
      setDrawerWidth(newWidth);
    }
  }, []);  

  if (isLoading) {
    return <div>Loading...</div>
  }
  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar component="nav" position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 2 }}>
            <img src="sdl_logo.png" alt="logo" className="logo" height="32px" />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Configuration Viewer
          </Typography>
        </Toolbar>
      </AppBar>    
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
        }}
        PaperProps={{sx: { width: drawerWidth, boxSizing: 'border-box' }}}
      >
        <Toolbar />
        <Box id="dragger"
          onMouseDown={handleDraggerMouseDown}
          sx={{
              cursor: "ew-resize", backgroundColor: "#f4f7f9",
              width: "5px", padding: "4px 0 0", borderTop: "1px solid #ddd",
              position: "absolute", top: 0, right: 0, bottom: 0, zIndex: 100,
          }}/>     
        <Box sx={{ overflow: 'auto' }}>
          <NestedList 
            data={data} 
            selectedElementToChild={selectedElement}
            sendSelectedElementToParent={setSelectedElement} 
            selectedElementTypeToChild={selectedElementType}
            sendSelectedElementTypeToParent={setSelectedElementType}/>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <DataDisplayView 
          data={data} 
          selectedElementToChild={selectedElement}
          sendSelectedElementToParent={setSelectedElement} 
          selectedElementTypeToChild={selectedElementType}
          sendSelectedElementTypeToParent={setSelectedElementType} />
      </Box>
    </Box>
  );
}

export default App;
