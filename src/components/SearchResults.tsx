import { useParams } from 'react-router-dom';
import { getAttributeGeneral } from '../util/ConfigSearchOperation';

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



export default function SearchResults(props: searchResultProps) {

  const data = props.data;
  const {ownSearchString} = useParams();
  const keyValuePairs: string[][] = returnSearchParamsKV(ownSearchString);

  //As of now, we only work with one search KV-pair
  let [searchKey, searchValue] = ['', ''];
  if (keyValuePairs.length > 0){
    [searchKey, searchValue] = [keyValuePairs[0][0], keyValuePairs[0][1]]
  }

  function resultingElements(){
    let result: string[] = [];
    ['dataObjects', 'actions'].forEach(elementType => {
        let elements: string[] = Object.keys(data[elementType]);
        let auxSearchKey = searchKey;
        if (auxSearchKey === 'feed' || auxSearchKey === 'tags'){
            auxSearchKey = 'metadata.'+auxSearchKey; //These two attributes are in the metadata
        }
        elements.forEach((element: string)=>{
            let att = getAttributeGeneral(data, element, elementType, auxSearchKey);
            if (att !== undefined && att ===searchValue){ 
                result.push(element);
            }
        });
    });
    return result;
  }


  return (
    <div>
        <p>OwnSearchString: {ownSearchString}</p>
        <p>search Key: {searchKey}</p>
        <p>search Value: {searchValue}</p>
        <p>Resulting Elements: {resultingElements()}</p>
    </div>
  );
}