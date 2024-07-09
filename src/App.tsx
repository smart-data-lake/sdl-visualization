import { CssVarsProvider } from '@mui/joy';
import CssBaseline from '@mui/joy/CssBaseline';
import { createHashRouter, Route, RouterProvider, Routes } from 'react-router-dom';
import ConfigExplorer from './components/ConfigExplorer/ConfigExplorer';
import Home from './components/HomeMenu/Home';
import Run from './components/WorkflowsExplorer/Run/Run';
import WorkflowHistory from './components/WorkflowsExplorer/WorkflowHistory';
import Workflows from './components/WorkflowsExplorer/Workflows';
import { useManifest } from './hooks/useManifest';
import NotFound from './layouts/NotFound';
import RootLayout from './layouts/RootLayout';
import { Authenticator, ThemeProvider } from '@aws-amplify/ui-react';
import { useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { amplifyTheme } from './theme';
import Setting from './components/Settings/Setting';
import ErrorBoundary from './layouts/ErrorBoundary';
import { WorkspaceProvider } from './hooks/useWorkspace';
import { UserProvider } from "./hooks/useUser";

/**
 * App is the top element of SDLB. It defines routing and how data are fetched from the config file for the config file viewer. It returns the root page which consists of the root layout.
 */

export default function App() {
  
  const {data: manifest} = useManifest();
  
  const root = () => (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<Home/>}/>
        <Route path='workflows/' element={<Workflows/>} errorElement={<ErrorBoundary/>}/>
        <Route path='workflows/:flowId' element={<WorkflowHistory/>} errorElement={<ErrorBoundary/>}/>
        <Route path='workflows/:flowId/:runNumber/:taskId/:tab?/:stepName?' element={<Run/>} errorElement={<ErrorBoundary/>}/>
        <Route path='workflows/*' element={<NotFound/>}/>
        {/* <Route path='lineage/*' element={<LineageExplorer/>} errorElement={<ErrorBoundary/>} /> */}
        <Route path='config/*' element={<ConfigExplorer/>} errorElement={<ErrorBoundary/>}/>
        <Route path='settings/*' element={<Setting />}/>
      </Route>
    </Routes>
  );

  const router = () => createHashRouter([
    { path: "*", Component: root },    
  ])

  useEffect(() => {
    if(manifest?.auth) {
      Amplify.configure(manifest?.auth);
    }
  }, [manifest])

  const MainContent = () => (
    <CssVarsProvider>
      <CssBaseline />
      <RouterProvider router={router()} />
    </CssVarsProvider>
  );

  return (
    <ThemeProvider theme={amplifyTheme}>
      <WorkspaceProvider>
        {!manifest?.auth && <MainContent />}
        {manifest?.auth && (
          <Authenticator.Provider>
            <UserProvider>
              <MainContent />
            </UserProvider>
          </Authenticator.Provider>
        )}
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
