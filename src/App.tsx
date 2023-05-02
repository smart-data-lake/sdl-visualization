import CssBaseline from '@mui/joy/CssBaseline';
import { useState } from 'react';
import { createHashRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import ConfigExplorer from './components/ConfigExplorer/ConfigExplorer';
import DataDisplayView from './components/ConfigExplorer/DataDisplayView';
import GlobalConfigView from './components/ConfigExplorer/GlobalConfigView';
import SearchResults from './components/ConfigExplorer/SearchResults';
import Run from './components/WorkflowsExplorer/Run/Run';
import WorkflowHistory from './components/WorkflowsExplorer/Workflow/WorkflowHistory';
import Workflows from './components/WorkflowsExplorer/Workflows/Workflows';
import NotFound from './layouts/NotFound';
import RootLayout from './layouts/RootLayout';
import { QueryClient, QueryClientProvider, useQuery } from 'react-query'



/**
 * App is the top element of SDLB. It defines routing and how data are fetched from the config file for the config file viewer. It returns the root page which consists of the root layout.
 */

export default function App() {
  // Declare and initialize the `data` state variable with `useState`
  const [data, setData] = useState<any>({});

   /**
   * `storeData` is a function that takes in data as an argument and sets the `data` state variable to that value when called.
   * @param data - The data to be stored in the `data` state variable.
   */
  const storeData = (data: any) => {
    setData(data)
  }
  
  /**
   * `router` sets up the router for the application using `createHashRouter` and `createRoutesFromElements`.
   * It returns a router object.
   * @returns The router object.
   */
  const router = () => createHashRouter(
    createRoutesFromElements(
      <Route path='/' element={<RootLayout storeData={storeData}/>}>
        <Route path='/workflows/' element={<Workflows/>}/>
        <Route path='/workflows/:workflow' element={<WorkflowHistory/>}/>
        <Route path='/workflows/:flowId/:runNumber/:taskId/:tab' element={<Run/>}/>
        <Route path='/workflows/:flowId/:runNumber/:taskId/:tab/:stepName' element={<Run panelOpen={true}/>}/>
        <Route path='*' element={<NotFound/>}/>
        <Route path='/config' element={<ConfigExplorer data={data}/>}>
          <Route
              path='/config/search/:ownSearchString' //the ownSearchString is our definition of a 
              //search because of problems with routing Search Parameters
              element={
                <SearchResults data={data}/>
              } />
          <Route
            path="/config/:elementType/:elementName"
            element={
              <DataDisplayView data={data} />
            } />
          <Route
            path="/config/globalOptions"
            element={
              <GlobalConfigView data={data.global}/>
            } />
        </Route> 
      </Route>
    )
  )

  /**
   * `queryClient` is a new instance of `QueryClient` that is used to store the data fetched from the config file.
   * @returns The `QueryClient` object.
   * @see https://react-query.tanstack.com/reference/QueryClient
   * @see https://react-query.tanstack.com/guides/using-queryclient
   * @see https://react-query.tanstack.com/guides/using-queryclientprovider
   * @see https://react-query.tanstack.com/guides/using-queryclientprovider#using-queryclientprovider
    */
  const queryClient = new QueryClient()

  return (
    <>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        {/* Provide the router object to the rest of the application with `RouterProvider` */}
        <RouterProvider router={router()}/>
      </QueryClientProvider>
    </>
  );
}
