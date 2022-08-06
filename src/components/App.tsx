import './App.css';
import NestedList from './NestedList';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import React, {useState} from 'react';
import DataDisplayView from './DataDisplayView';
import Header from './common/Header';
import {parseFileStrict} from './util/HoconParser';

function App() {

  // state
  const [data, setData] = React.useState<Object>({dataObjects: {}, actions: {}, connections: {}, global: {}});
  const [selectedElement, setSelectedElement] = React.useState("");
  const [selectedElementType, setSelectedElementType] = React.useState("");
  const [displayMode, setDisplayMode] = useState('dataFlow');
  const [isLoading, setLoading] = useState(true)

  // parse config
  React.useEffect(() => {
    parseFileStrict("http://localhost:3000/config/exampleFile.conf")
      .then(newData => {
        setData(newData);
        setLoading(false);
        console.log("data", newData);
    })
  }, []); // only once
  
  if (isLoading) {
    return <div>Loading...</div>
  }
  return (
    <Grid container spacing={1}>
      <Grid item xs={12}>
        <Header />
      </Grid>
      <Grid item xs={3}>
          <NestedList 
            data={data} 
            selectedElementToChild={selectedElement}
            sendSelectedElementToParent={setSelectedElement} 
            selectedElementTypeToChild={selectedElementType}
            sendSelectedElementTypeToParent={setSelectedElementType} 
            setDisplayMode = {setDisplayMode}/>
      </Grid>
      <Grid item xs={9}>
      <DataDisplayView 
          data={data} 
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
