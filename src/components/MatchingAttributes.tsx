import {Box} from '@mui/material';
import { getAttributeGeneral } from '../util/ConfigSearchOperation';
import { Link } from "react-router-dom";


function isArray(obj: any){
    return !!obj && obj.constructor === Array;
  }


/**
 * 
 * @param props "data" is the entire parsed HOCON object, searchKey and searchValue are taken from the URL
 * @returns React component to display elements that match with an exact attribute (e.g. feed === download). 
 *          Search for entire config file is implemented separately.
 */
export default function MatchingAttributes(props: {data: any, searchKey: string, searchValue: string}): JSX.Element{

    const data = props.data;
    const searchKey = props.searchKey;
    const searchValue = props.searchValue;
  /**
   * 
   * @returns A list of the resulting dataObjects and Actions that comply with the search.
   * The result is a list of [elementName, elementType]
   */
   function getResultingElements():string[][]{
    let result: string[][] = [];
    ['dataObjects', 'actions'].forEach(elementType => {
        let elements: string[] = Object.keys(data[elementType]);
        let auxSearchKey = searchKey;
        if (auxSearchKey === 'feed' || auxSearchKey === 'tags'){
            auxSearchKey = 'metadata.'+auxSearchKey; //These two attributes are in the metadata part
        }
        elements.forEach((element: string)=>{
            let elementPair = [element, elementType]; //[elementName, elementType]
            let push = false;
            let att = getAttributeGeneral(data, element, elementType, auxSearchKey);
            if (att !== undefined){
                //we need the following line to search in values that are an array (e.g. the tags attribute is an array of strings)
              if (isArray(att)){ if (att.includes(searchValue)){result.push(elementPair);}} //Cannot merge both conditions because it would throw an error
              else if (att ===searchValue){ result.push(elementPair);}
            }
        });
    });
    return result;
  }

  function resultComponent(elementName: string, elementType: string){
    const path = `/${elementType}/${elementName}`;
    return(
      <div>
        <Link to={path}>
          {elementName}
        </Link>
      </div>

    )
  }

  const resultingElements = getResultingElements().map(elementNameAndType => resultComponent(elementNameAndType[0], elementNameAndType[1]))

  return (
    <Box>
        <p>Resulting Elements with '{searchKey}' == {searchValue}:</p>
        <br></br>
        {resultingElements}
    </Box>
  );
}