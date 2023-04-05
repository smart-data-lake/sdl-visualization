import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from "react-router-dom";
import ConfigExplorer from './components/ConfigExplorer/ConfigExplorer';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <HashRouter>
    <React.StrictMode>
      <ConfigExplorer />
    </React.StrictMode>
  </HashRouter>
);
