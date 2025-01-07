import { Authenticator, ThemeProvider } from '@aws-amplify/ui-react';
import { CssVarsProvider } from '@mui/joy';
import CssBaseline from '@mui/joy/CssBaseline';
import { Amplify } from 'aws-amplify';
import { useEffect } from 'react';
import { createHashRouter, Route, RouterProvider, Routes } from 'react-router-dom';
import ConfigExplorer from './components/ConfigExplorer/ConfigExplorer';
import Home from './components/HomeMenu/Home';
import Setting from './components/Settings/Setting';
import Run from './components/WorkflowsExplorer/Run/Run';
import WorkflowHistory from './components/WorkflowsExplorer/WorkflowHistory';
import Workflows from './components/WorkflowsExplorer/Workflows';
import { useManifest } from './hooks/useManifest';
import { UserProvider, useUser } from "./hooks/useUser";
import { useWorkspace, WorkspaceProvider } from './hooks/useWorkspace';
import ErrorBoundary from './layouts/ErrorBoundary';
import NotFound from './layouts/NotFound';
import RootLayout from './layouts/RootLayout';
import { WorkspaceEmpty } from './layouts/RootLayoutSpinner';
import { amplifyTheme } from './theme';

function Routing() {
  const userContext = useUser();
  const workspace = useWorkspace();

  const contentRouting = () => (<>
    <Route errorElement={<ErrorBoundary/>}>
      <Route index element={<Home/>}/>
      <Route path='workflows/' element={<Workflows/>}/>
      <Route path='workflows/:flowId' element={<WorkflowHistory/>}/>
      <Route path='workflows/:flowId/:runIdAttempt/:tab?/:stepName?' element={<Run/>}/>
      <Route path='workflows/*' element={<NotFound/>}/>
      {/* <Route path='lineage/*' element={<LineageExplorer/>}/> */}
      <Route path='config/*' element={<ConfigExplorer/>}/>
    </Route>
  </>);

  const workspaceRouting = () => (<>  
    <Route index element={<WorkspaceEmpty/>}/>
    <Route path=':tenant/content/:repo/:env/*'>
      {contentRouting()}
    </Route>
    <Route path=':tenant/settings/*' element={<Setting />}/>
    <Route path="*" element={<WorkspaceEmpty/>}/>
  </>);

  return (
    <Routes>
      <Route element={<RootLayout />} errorElement={<ErrorBoundary/>}>
      {userContext?.loginElement ? <Route path='*' element={userContext.loginElement}/> : 
        workspace.tenant ? workspaceRouting() : contentRouting()
      }
      </Route>
    </Routes>    
  )
};


/**
 * App is the top element of SDLB. It defines routing and how data are fetched from the config file for the config file viewer. It returns the root page which consists of the root layout.
 */

export default function App() {
  
  const {data: manifest} = useManifest();

  useEffect(() => {
    if(manifest?.auth) {
      Amplify.configure(manifest.auth);
    }
  }, [manifest])

  const rootWithAuth = () => (
    <WorkspaceProvider>
      <Authenticator.Provider>
        <UserProvider>  
          <Routing/>
        </UserProvider>  
      </Authenticator.Provider>
    </WorkspaceProvider>
  )

  const root = () => (
    <WorkspaceProvider>
      <Routing/>
    </WorkspaceProvider>  
  )

  const router = () => createHashRouter([
    { path: "*", Component: (manifest?.auth ? rootWithAuth : root), },    
  ])

  return (
    <ThemeProvider theme={amplifyTheme}>
      <CssVarsProvider>
        <CssBaseline />
        <RouterProvider router={router()}/>
      </CssVarsProvider>
    </ThemeProvider>
  );
}
