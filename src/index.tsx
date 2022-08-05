import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import Test from './components/Test';
import MarkdownComponent from './components/MarkdownComponent';
import FileDisplay from './components/FileDisplay';
import LayoutFlowTest from './components/LayoutFlowTest';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
