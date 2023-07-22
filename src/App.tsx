import CssBaseline from '@mui/joy/CssBaseline';
import { createHashRouter, createRoutesFromElements, Route, RouterProvider, Routes } from 'react-router-dom';
import ConfigExplorer from './components/ConfigExplorer/ConfigExplorer';
import DataDisplayView from './components/ConfigExplorer/DataDisplayView';
import GlobalConfigView from './components/ConfigExplorer/GlobalConfigView';
import SearchResults from './components/ConfigExplorer/SearchResults';
import Home from './components/HomeMenu/Home';
import Run from './components/WorkflowsExplorer/Run/Run';
import WorkflowHistory from './components/WorkflowsExplorer/Workflow/WorkflowHistory';
import Workflows from './components/WorkflowsExplorer/Workflows/Workflows';
import { useConfig } from './hooks/useConfig';
import { useManifest } from './hooks/useManifest';
import NotFound from './layouts/NotFound';
import RootLayout from './layouts/RootLayout';

/**
 * App is the top element of SDLB. It defines routing and how data are fetched from the config file for the config file viewer. It returns the root page which consists of the root layout.
 */

export default function App() {
  
  const {data: manifest} = useManifest();
  const {data: configData, isLoading} = useConfig(manifest);
  
  const root = () => (
    <Routes>
      <Route element={<RootLayout isLoading={isLoading}/>}>
        <Route index element={<Home/>}/>
        {configData && <>
          <Route path='workflows/' element={<Workflows/>}/>
          <Route path='workflows/:flowId' element={<WorkflowHistory/>}/>
          <Route path='workflows/:flowId/:runNumber/:taskId/:tab' element={<Run configData={configData}/>}/>
          <Route path='workflows/:flowId/:runNumber/:taskId/:tab/:stepName' element={<Run configData={configData} panelOpen={true}/>}/>
          <Route path='workflows/*' element={<NotFound/>}/>
          <Route path='config/*' element={<ConfigExplorer data={configData}/>}/>
          </>
        }
      </Route>
    </Routes>
  )

  const router = () => createHashRouter([
    { path: "*", Component: root },    
  ])

  return (
    <>
      <CssBaseline />
      <RouterProvider router={router()}/>
    </>
  );
}
