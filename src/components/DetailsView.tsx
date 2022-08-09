import FlowChart from "./FlowChart";
import MetadataTable from "./MetadataTable";
import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import './ComponentsStyles.css';
import MarkdownComponent from "./MarkdownComponent";
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { Box } from "@mui/material";

interface detailsProps {
    data: object;
    elementName: string;
    elementType: string;
}

export default function DetailsView(props: detailsProps) {

    return (
      <Box>
        <MetadataTable data={props.data} elementName={props.elementName} elementType={props.elementType} />;
        <MarkdownComponent filename={props.elementName} />;
      </Box>
    );
} 