import './App.css';
import ElementList from './ElementList';
import { useEffect } from 'react';
import {Box, Toolbar } from '@mui/material';
import { Routes, Route } from "react-router-dom";
import { CircularProgress, Sheet } from '@mui/joy';
import { useConfig } from '../../hooks/useConfig';



function ConfigExplorer(props: {storeData: (data: any) => void}) {
  const { storeData } = props;
  const { data, isLoading } = useConfig()

  useEffect(()=>{
    if (!isLoading) storeData(data)
  }, [isLoading])

  if (isLoading) {
    return <CircularProgress />
  }
  return (
    <Box sx={{ display: 'flex'}}>
      <Sheet
        sx={{
          position: 'fixed',
          display: 'flex',
          border: '1px solid',
          borderColor: 'lightgray',
          borderRadius: '0.5rem',
          height: '90%',

        }}
        
      >
        <Box sx={{ overflow: 'auto' }}>
          <ElementList data={data} />
        </Box>
      </Sheet>
      <Box component="main" sx={{ flexGrow: 1, p: 3, pt: "7px", ml: '20rem' }}>
        <Toolbar />
        <Routes>
          <Route index element={<p>Please select a component from the drawer on the left to see its configuration</p>} />
        </Routes>
      </Box> 
    </Box>
  );
}

export default ConfigExplorer;
