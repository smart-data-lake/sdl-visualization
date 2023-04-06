import CssBaseline from '@mui/joy/CssBaseline';
import { useState } from 'react';
import { createHashRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import ConfigExplorer from './components/ConfigExplorer/ConfigExplorer';
import DataDisplayView from './components/ConfigExplorer/DataDisplayView';
import GlobalConfigView from './components/ConfigExplorer/GlobalConfigView';
import SearchResults from './components/ConfigExplorer/SearchResults';
import RunOverview from './components/WorkflowsExplorer/Run/RunOverview';
import WorkflowHistory from './components/WorkflowsExplorer/Workflow/WorkflowHistory';
import Workflows from './components/WorkflowsExplorer/Workflows/Workflows';
import NotFound from './layouts/NotFound';
import RootLayout from './layouts/RootLayout';



export default function App() {
  const [data, setData] = useState<any>({});

  const storeData = (data: any) => {
    console.log('changed data')
    setData(data)
  }
  
  const router = createHashRouter(
    createRoutesFromElements(
      <Route path='/' element={<RootLayout/>}>
        <Route path='/workflows/' element={<Workflows/>}/>
        <Route path='/workflows/:workflow' element={<WorkflowHistory/>}/>
        <Route path='/workflows/:flowId/:runNumber/:taskId/:tab' element={<RunOverview/>}/>
        <Route path='/workflows/:flowId/:runNumber/:taskId/:tab/:stepName' element={<RunOverview panelOpen={true}/>}/>
        <Route path='*' element={<NotFound/>}/>
        // ConfigExplorer
        <Route path='/configviewer' element={<ConfigExplorer storeData={storeData}/>}/> 
        <Route
            path='/search/:ownSearchString' //the ownSearchString is our definition of a 
                                            //search because of problems with routing Search Parameters
            element={
              <SearchResults data={data}/>
            } />
          <Route
            path="/:elementType/:elementName"
            element={
              <DataDisplayView data={data} />
            } />
          <Route
            path="/globalOptions"
            element={
              <GlobalConfigView data={data.global}/>
            } />
      </Route>
    )
  )
  return (
    <>
      <CssBaseline />
      <RouterProvider router={router}/>
    </>
  );
}
