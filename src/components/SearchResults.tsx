import { useParams } from 'react-router-dom';
import { getAttributeGeneral } from '../util/ConfigSearchOperation';
import { Link } from "react-router-dom";
import MatchingAttributes from './MatchingAttributes';
import MatchEntireConfig from './MatchEntireConfig';
import {Box} from '@mui/material';

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
function returnSearchParamsKV(ownSearchString: string | undefined): string[][]{ //Returns a list of [key, value] pairs for our search.
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

  const display = searchKey === 'entireConfigString' ? 
                                <MatchEntireConfig data={data} searchKey={searchKey} searchValue={searchValue}/> : 
                                <MatchingAttributes data={data} searchKey={searchKey} searchValue={searchValue}/>



  return (
    <Box>
      {display}
    </Box>
  );
}