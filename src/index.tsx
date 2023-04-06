import React from 'react';
import ReactDOM from 'react-dom/client';
import ConfigExplorer from './components/ConfigExplorer/ConfigExplorer';
import App from './App';
import { HashRouter } from 'react-router-dom';

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