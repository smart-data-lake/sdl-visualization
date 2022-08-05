import FlowChart from "./FlowChart";
import MetadataTable from "./MetadataTable";
import ChartView from "./ChartView";
import LayoutFlow from "./LayoutFlow";
import LayoutFlowTest from "./LayoutFlowTest";
import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import './ComponentsStyles.css';
import MarkdownComponent from "./MarkdownComponent";
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

interface detailsProps {
    data: object;
    elementName: string;
    elementType: string;
}

export default function DetailsView(props: detailsProps) {

    const [tablesOrMetadata, setTablesOrMetadata] = useState('details');
    const [switchLabel, setSwitchLabel] = useState('Switch to Metadata');

    const handleSwitchChange = () =>{
        if (switchLabel==='Switch to Metadata'){
            setTablesOrMetadata('metadata');
            setSwitchLabel('Switch to Details');
        }
        else{
            setTablesOrMetadata('details');
            setSwitchLabel('Switch to Metadata');
        }
    }

    let display = null;

    if (tablesOrMetadata === 'details') {
        display = <MarkdownComponent filename={props.elementName} />;
    }
    else if (tablesOrMetadata === 'metadata') {
        display = <MetadataTable data={props.data} elementName={props.elementName} elementType={props.elementType} />;
    }
    else{
        display = <p>ERROR in rendering. tablesOrMetadata Hook not tuned correctly.</p>
    }

    return (
        <div>
            <FormGroup>
                <FormControlLabel control={<Switch defaultChecked />} label={switchLabel} onChange={handleSwitchChange}/>
            </FormGroup>
            {display}
        </div>
    );
} 