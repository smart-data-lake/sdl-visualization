import CssBaseline from '@mui/joy/CssBaseline';
import { CssVarsProvider } from '@mui/joy/styles';
import { RouterProvider } from 'react-router-dom';
import { router } from './util/WorkflowsExplorer/routing';

export default function App() {
  
  return (
    <CssVarsProvider>
      <CssBaseline />
      <RouterProvider router={router}/>
    </CssVarsProvider>
  );
}
