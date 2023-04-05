import './App.css';
import ElementList from './ElementList';
import React, {useState, useCallback} from 'react';
import DataDisplayView from './DataDisplayView';
import SearchResults from './SearchResults';
import {parseTextStrict, listConfigFiles, readConfigIndexFile, readManifestFile, getUrlContent, standardizeKeys} from '../util/HoconParser';
import {Box, Toolbar, Drawer, CssBaseline} from '@mui/material';
import Header from './Header';
import { Routes, Route, useLocation } from "react-router-dom";
import GlobalConfigView from './GlobalConfigView';

export const defaultDrawerWidth = 300;
const minDrawerWidth = 50;
const maxDrawerWidth = 600;

function App() {

  // state
  const [data, setData] = React.useState<any>({dataObjects: {}, actions: {}, connections: {}, global: {}});
  const [isLoading, setLoading] = useState(true);
  const [drawerWidth, setDrawerWidth] = useState(defaultDrawerWidth);




  const routerLocation = useLocation();
  const baseUrl = window.location.href
    .replace(new RegExp("/index.html$"), "")
    .replace(new RegExp(routerLocation.pathname+"$"), "")
    .replace(new RegExp("#$"), "")
    .replace(new RegExp("/$"), "");
  const exportedConfigUrl = baseUrl+"/exportedConfig.json"  
  const configSubdir = "/config";  
  const envConfigSubdir = "/envConfig";  
  const configUrl = baseUrl+configSubdir;


  // get config
  React.useEffect(() => {
    // a) search for exported config in json format
    getUrlContent(exportedConfigUrl)
    .then(jsonStr => JSON.parse(jsonStr))
    .catch(err => {
      console.log("Could not get exported config in json format "+configUrl+", will try listing hocon config files. ("+err+")");
      // b) parse config from Hocon Files
      console.log("reading config from url "+configUrl);
      // b1) get config file list by listing config directory
      return listConfigFiles(configUrl, "")
      .catch(err => {
        // b2) read config file list from static index.json
        console.log("Could not list files in URL "+configUrl+", will try reading index.json. ("+err+")");
        return readConfigIndexFile(configUrl);
      })
      .then(files => {
        // prepend config directory to files to create relative Url
        const filesRelUrl = files.map(f => configSubdir+f);
        // check for environment config property in manifest file
        return readManifestFile(baseUrl).then(manifest => {
          // add environment config file if existing
          if (manifest["env"]) {
            const envConfigRelUrl = envConfigSubdir+"/"+manifest["env"]+".conf";
            // make sure envConfig Url exists
            return getUrlContent(envConfigRelUrl).then(_ => {
              filesRelUrl.push(envConfigRelUrl);
              return filesRelUrl;
            });
          } else {
            return filesRelUrl;
          }
        })
      })
      .then(files => {
        console.log("config files to read", files);
        const includeText = files.map(f => `include "${baseUrl}${f}"`).join("\n");
        return parseTextStrict(includeText);
      })
    })
    .then(newData => {
      setData(standardizeKeys(newData));
      setLoading(false);
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only once
  
  // resize drawer
  const handleDraggerMouseDown = (_: React.MouseEvent) => { // this needs React.MouseEvent as it is used in react component
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
      <Header />
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
          <ElementList data={data} />
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, "paddingTop": "7px" }}>
        <Toolbar />
        <Routes>
          <Route index element={<p>Please select a component from the drawer on the left to see its configuration</p>} />
          <Route
            path='/search/:ownSearchString' //the ownSearchString is our definition of a 
                                            //search because of problems with routing Search Parameters
            element={
              <SearchResults data={data}/>
            } />
          <Route
            path="/:elementType/:elementName"
            element={
              <DataDisplayView data={data} />
            } />
          <Route
            path="/globalOptions"
            element={
              <GlobalConfigView data={data.global}/>
            } />
        </Routes>
      </Box>
    </Box>
  );
}

export default App;
