import './App.css';
import file from './util/SBB_ANABEL';
import NestedList from './NestedList';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import React, {useState} from 'react';
import DataDisplayView from './DataDisplayView';
import Header from './common/Header';
import printAGraph from './dagre_test';



function App() {


  const [selectedElement, setSelectedElement] = React.useState("");
  const [selectedElementType, setSelectedElementType] = React.useState("");
  const [displayMode, setDisplayMode] = useState('dataFlow');


  /*
  printAGraph(); //remove later
  */
 
  return (
    <Grid container spacing={1}>
      <Grid item xs={12}>
        <Header />
      </Grid>
      <Grid item xs={3}>
        <Paper
          sx={{
            height: 400
          }}
        >
          <NestedList 
            data={file} 
            selectedElementToChild={selectedElement}
            sendSelectedElementToParent={setSelectedElement} 
            selectedElementTypeToChild={selectedElementType}
            sendSelectedElementTypeToParent={setSelectedElementType} 
            setDisplayMode = {setDisplayMode}/>
          
        </Paper>
      </Grid>
      <Grid item xs={9}>
       <DataDisplayView 
          data={file} 
          selectedElementToChild={selectedElement}
          sendSelectedElementToParent={setSelectedElement} 
          selectedElementTypeToChild={selectedElementType}
          sendSelectedElementTypeToParent={setSelectedElementType} 
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}/>
      </Grid>
    </Grid>
  );
}

export default App;
