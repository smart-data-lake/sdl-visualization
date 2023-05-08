import { StrictMode } from "react";
import App from "./App";
import * as ReactDOMClient from "react-dom/client";

// react 17
// import { render } from "react-dom";
// render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
//   document.getElementById("root")
// );

// react 18
const rootElement = document.getElementById("root");
const root = ReactDOMClient.createRoot(rootElement as HTMLElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);