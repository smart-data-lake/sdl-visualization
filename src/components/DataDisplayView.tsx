import FlowChart from "./FlowChart";
import ChartView from "./ChartView";
import LayoutFlow from "./LayoutFlow";
import LayoutFlowTest from "./LayoutFlowTest";
import React, {useEffect, useState} from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import './ComponentsStyles.css';
import DetailsView from './DetailsView'

interface displayProps {
  data: object;
  displayMode: string;
  selectedElementToChild: string;
  selectedElementTypeToChild: string;
  setDisplayMode: React.Dispatch<React.SetStateAction<string>>;
  sendSelectedElementToParent: React.Dispatch<React.SetStateAction<string>>;
  sendSelectedElementTypeToParent: React.Dispatch<React.SetStateAction<string>>;
}

export default function DataDisplayView(props: displayProps) {


    const file = props.data; 
    const displayMode = props.displayMode;

    let display = null;
  
    if (displayMode==='table'){
      display = <DetailsView data={file} elementName={props.selectedElementToChild} elementType={props.selectedElementTypeToChild}/>;

    }
    else if (displayMode==='dataFlow'){
      display = <FlowChart data={file}/>;
    }
   /* else if (displayMode==='dataFlow'){
    display = <LayoutFlowTest/>
   } */
    else {
      display = <ChartView data={file} />;
    }
  
    return (
        <div>
            <Stack direction="row" spacing={2}>
                <Button variant="outlined" className='buttons' onClick={() => props.setDisplayMode('dataFlow')}>Data Flow</Button>
                <Button variant="outlined" className='buttons' onClick={() => props.setDisplayMode('tree')}>Tree</Button>
            </Stack>
            <div>{display}</div>
        </div>
    );
    //<DetailsTable/>
    //<ChartView data={file} />
} 