import './App.css';
import ElementList from './ElementList';
import { useEffect } from 'react';
import {Box, Toolbar } from '@mui/material';
import { Routes, Route, Outlet } from "react-router-dom";
import { CircularProgress, Sheet } from '@mui/joy';
import { useConfig } from '../../hooks/useConfig';
import PageHeader from '../../layouts/PageHeader';



function ConfigExplorer(props: {data: any}) {
  const { data } = props;

  return (
    <>
    	<PageHeader title={'Configuration'} noBack={true} />
    	<Sheet
			sx={{
				display: 'flex',
				justifyContent: 'flex-start',
				gap: '1rem',
				overflow: 'hidden'
			}}
			>
    	  	<ElementList data={data} />
    	  	<Outlet />
    	</Sheet>
    </>
  );
}

export default ConfigExplorer;
