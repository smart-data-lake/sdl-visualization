import MetadataTable from "../components/MetadataTable";
import './ComponentsStyles.css';
import MarkdownComponent from "../components/MarkdownComponent";

import { Box } from "@mui/material";


/**
 * Legacy code that merged both the MetadataTable and the Markdown explanation into a single component. 
 */

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