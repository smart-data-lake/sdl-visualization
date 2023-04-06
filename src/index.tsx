import React from 'react';
import ReactDOM from 'react-dom/client';
import ConfigExplorer, { useConfig } from './components/ConfigExplorer/ConfigExplorer';
import { createHashRouter, createRoutesFromElements, HashRouter, Route, RouterProvider } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { CssVarsProvider } from '@mui/joy';
import Header from './layouts/Header';
import RootLayout from './layouts/RootLayout';
import Workflows from './components/WorkflowsExplorer/Workflows/Workflows';
import WorkflowHistory from './components/WorkflowsExplorer/Workflow/WorkflowHistory';
import RunOverview from './components/WorkflowsExplorer/Run/RunOverview';
import NotFound from './layouts/NotFound';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);


root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);