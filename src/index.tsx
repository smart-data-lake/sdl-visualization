import { StrictMode } from "react";
import App from "./App";
import * as ReactDOMClient from "react-dom/client";
import { QueryClient, QueryClientProvider } from "react-query";
import "@aws-amplify/ui-react/styles.css";

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
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // default: true
    },
  },
});
root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
