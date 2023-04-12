import './App.css';
import ElementList from './ElementList';
import { useEffect } from 'react';
import {Box, Toolbar } from '@mui/material';
import { Routes, Route, Outlet } from "react-router-dom";
import { CircularProgress, Sheet } from '@mui/joy';
import { useConfig } from '../../hooks/useConfig';



function ConfigExplorer(props: {data: any}) {
  const { data } = props;

  return (
    <Box>
      <Sheet
        sx={{
          width: '17rem',
          position: 'fixed',
          height: '85vh',
        }}
        
      >
        <Box >
          <ElementList data={data} />
        </Box>
      </Sheet>
      <Box component="main" sx={{ flexGrow: 1, p: 3, pt: "7px", ml: '20rem' }}>
        <Outlet />
      </Box> 
    </Box>
  );
}

export default ConfigExplorer;
