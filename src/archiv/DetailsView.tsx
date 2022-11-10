import ConfigurationTab from "../components/ConfigurationTab";
import './ComponentsStyles.css';
import DescriptionTab from "../components/DescriptionTab";

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
        <ConfigurationTab data={props.data} elementName={props.elementName} elementType={props.elementType} />;
        <DescriptionTab elementName={props.elementName} data={props.data} elementType={props.elementType}/>;
      </Box>
    );
} 