/// <reference types="vite/client" />

declare module '*.md' { //Needed in order to import .md files. 
    const content: any;
    export default content;
  }
