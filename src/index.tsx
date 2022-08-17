import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import MarkdownComponent from './components/MarkdownComponent';
import FileDisplay from './util/FileDisplay';
import LayoutFlowTest from './archiv/LayoutFlowTest';
import { BrowserRouter, HashRouter } from "react-router-dom";

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <HashRouter>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </HashRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
