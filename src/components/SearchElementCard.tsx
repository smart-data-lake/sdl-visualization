import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { Link } from "react-router-dom";

interface SearchElementCardProps{
    elementObject: any;
    searchValue: string;
    elementName: string;
    elementType: string;
    rank: number;
}

export default function SearchElementCard(props: SearchElementCardProps){

    const elementObject = props.elementObject;
    const searchValue = props.searchValue;
    const elementName = props.elementName;
    const elementType = props.elementType;
    const rank = props.rank;
    const elementTypeDisplay = elementType === 'global' ? elementType : elementType.substring(0, elementType.length-1);




    return (
        <Link to={`/${elementType}/${elementName}`}>
            <Paper className='searchPaper'>
                <Box>
                    <h3>{elementName} ({elementTypeDisplay})</h3>
                    
                    <p>{JSON.stringify(elementObject)}</p>
                </Box>
            </Paper>
        </Link>
    )
}