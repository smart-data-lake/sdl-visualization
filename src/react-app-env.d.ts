/// <reference types="react-scripts" />

declare module '*.md' { //Needed in order to import .md files. 
    const content: any;
    export default content;
  }
