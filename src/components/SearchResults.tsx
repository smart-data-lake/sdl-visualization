import { useParams } from 'react-router-dom';
import { getAttributeGeneral, getElementAttributeGeneral } from '../util/ConfigSearchOperation';
import { Link } from "react-router-dom";

interface searchResultProps{
    data: any,
}

/**
 *    
 * @param ownSearchString The custom search string that is given as a URL-parameter.
 *                        Just as standard URL search parameters, we apply a Key-Value
 *                        search and concatenate the predicates. In our version, we don't 
 *                        use the '?' symbol (because of issues in routing/reloading),
 *                        and additionally we don't use one '&' but two '&&' symbols.
 *                        E.g. looking for an element with a feed with value 'myFeed' and a tag with
 *                        value 'myTag' results in the following route:
 *                        /search/feed=myFeed&&tag=myTag
 * @returns A list of the KV pairs that we are looking for in our element search.
 */
function returnSearchParamsKV(ownSearchString: string | undefined): string[][]{
  if (ownSearchString){ 
    return ownSearchString
    .split('&&')
    .map(kv => kv.split('='));
  }
  else return []; //in case we don't have an ownSearchString 
}

function isArray(obj: any){
  return !!obj && obj.constructor === Array;
}



export default function SearchResults(props: searchResultProps) {

  const data = props.data;
  const {ownSearchString} = useParams();
  const keyValuePairs: string[][] = returnSearchParamsKV(ownSearchString);

  //As of now, we only work with one search KV-pair
  let [searchKey, searchValue] = ['', ''];
  if (keyValuePairs.length > 0){
    [searchKey, searchValue] = [keyValuePairs[0][0], keyValuePairs[0][1]]
  }

  /**
   * 
   * @returns A list of the resulting dataObjects and Actions that comply with the search
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
            let att = getElementAttributeGeneral(data, element, elementType, auxSearchKey);
            if (att !== undefined){
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
    <div>
        <p>Resulting Elements with '{searchKey}' == {searchValue}:</p>
        <br></br>
        {resultingElements}
    </div>
  );
}