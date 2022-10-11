import {Box} from '@mui/material';
import SearchElementCard from './SearchElementCard';
import Stack from '@mui/material/Stack';



/**
 * 
 * @param jsonObject The JSON object of a specific element
 * @param elementName Element name (e.g. int-airports)
 * @param attributeName Can be separated by a colon for nesting (e.g. "metdata.feed")
 * @returns 
 */
function getAttributeFromElement(jsonObject: any, attributeName: string){

    let attributeLevels = attributeName.split('.');
  
    let hasAttribute = true;
  
    let forObject = jsonObject;
    for(var i = 0; i<attributeLevels.length; i++ ){
      forObject = forObject[attributeLevels[i]];
      console.log()
      if (forObject === undefined){
        hasAttribute = false;
        break;
      }
    }
  
    return hasAttribute ? forObject : undefined;
  }

/**
 * Represents one element in the context of a specific search predicate
 */
export class SearchElement{
    constructor(public elemName: string, 
                public elemType: string, 
                public object: any, 
                public searchKey: string, 
                public searchValue: string, 
                public rank: number = 0){
        this.elemName = elemName;
        this.elemType = elemType;
        this.object = object;
        this.searchKey = searchKey;
        this.searchValue = searchValue;
        this.rank = this.getRank(); //compute at the end
    }

    getRank(){  //How important is this element in the context of a search. 
                //The sum of less important attributes should never be greater than the one more important attribute. 
        let rank = 0;
        if (this.elemName.includes(this.searchValue)){
            rank += 20; //More important than inlcuding a key (dataObject or Action id) with that name
        }
        if (Object.keys(this.object).includes(this.searchValue)){
            rank += 10;
        }

        const feed = getAttributeFromElement(this.object, 'metadata.feed')
        if (feed !== undefined && feed === this.searchValue){
            rank += 5;
        }

        const tags = getAttributeFromElement(this.object, 'metadata.tags')
        if (tags !== undefined){
            if (JSON.stringify(tags).includes(this.searchValue)){
                rank += 3;
            }
        }
        if (JSON.stringify(this.object).includes(this.searchValue)){
            rank += 1;
        }
        return rank;
    }
}

/**
 * 
 * @param data JSON object
 * @param elementType "dataObjects", "actions", "connections", "global"
 * @returns Element names of the element type
 */
function getElementTypeKeys(data: any, elementType: string): string[]{
    if (data[elementType] !== undefined){
        return Object.keys(data[elementType]);
    }
    return [];
}


/**
 * 
 * @param data The entire JSON config object
 * @param searchKey As of now default search Key 'entireConfigString'
 * @param searchValue The string that is being searched (searchKey is entireConfigString)
 * @returns A list of SearchElements that are relevant to a specific search. The list is sorted by rank.
 */
function getRelevantElements(data: any, searchValue: string, searchKey: string = 'entireConfigString'): SearchElement[]{
    let result: SearchElement[] = [];
    ['dataObjects', 'actions', 'connections', 'global'].forEach(elementType => {
            let elements =  getElementTypeKeys(data, elementType)
                            .map(elemName => new SearchElement(elemName, elementType, data[elementType][elemName], searchKey, searchValue))
                            .filter(searchElement => searchElement.rank > 0); //relevant elements have a Rank > 0
                            console.log(elements);
            
            result = result.concat(elements);
            });
    result = result.sort((a, b) => b.rank - a.rank); //Reverse order in our list for displaying purposes
    console.log(result);
    return result;
}

function elementCard(elementName: string, object: string){
    return(
        <div>
            <h1>{elementName}</h1>
            <p>{object}</p>
        </div>
    );
}






interface MatchEntireConfigProps {
    data: any;
    searchKey: string;
    searchValue: string;
}



export default function MatchEntireConfig(props: MatchEntireConfigProps): JSX.Element{

    const data = props.data;
    const searchKey = props.searchKey;
    const searchValue = props.searchValue;


    let display = getRelevantElements(data, searchValue).map(searchElement => 
                                                <SearchElementCard 
                                                    elementName={searchElement.elemName}
                                                    elementObject={searchElement.object}
                                                    searchValue={searchElement.searchValue}
                                                    elementType={searchElement.elemType}
                                                    rank={searchElement.rank}/>);

    if (display.length === 0) {
        display = [<p>No results were found for your search</p>];
    }

    return (
        <Box>
            <h1>Search results</h1>
            <Stack spacing={2}>
                {display}
            </Stack>
        </Box>
    )

}