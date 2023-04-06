import React from 'react';
import ReactDOM from 'react-dom/client';
import ConfigExplorer from './components/ConfigExplorer/ConfigExplorer';
import { createHashRouter, createRoutesFromElements, HashRouter, Route, RouterProvider } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { CssVarsProvider } from '@mui/joy';
import Header from './layouts/Header';
import RootLayout from './layouts/RootLayout';
import Workflows from './components/WorkflowsExplorer/Workflows/Workflows';
import WorkflowHistory from './components/WorkflowsExplorer/Workflow/WorkflowHistory';
import RunOverview from './components/WorkflowsExplorer/Run/RunOverview';
import NotFound from './layouts/NotFound';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

export const router = createHashRouter(
  createRoutesFromElements(
    <Route path='/' element={<RootLayout/>}>
      <Route path='/configviewer' element={<ConfigExplorer/>}/> 
      <Route path='/workflows/' element={<Workflows/>}/>
      <Route path='/workflows/:workflow' element={<WorkflowHistory/>}/>
      <Route path='/workflows/:flowId/:runNumber/:taskId/:tab' element={<RunOverview/>}/>
      <Route path='/workflows/:flowId/:runNumber/:taskId/:tab/:stepName' element={<RunOverview panelOpen={true}/>}/>
      <Route path='*' element={<NotFound/>}/>
    </Route>
  )
)

root.render(
    <React.StrictMode>
        <CssBaseline />
        <RouterProvider router={router}/>
    </React.StrictMode>
);