//Thought as a collection of operations to search the config file.


/**
 * Returns "attribute" object or "undefined" if attribute not existent.
 * "attributeName" supports dot notation for sub attributes (e.g. one can pass a string "metadata.feed" as a parameter)
 **/
function getElementAttributeGeneral(jsonObject: any, elementName: string, elementType: string, attributeName: string) {
  let attributeLevels = attributeName.split('.');
  attributeLevels = [elementType, elementName].concat(attributeLevels);
  return getAttributeGeneral(jsonObject, attributeLevels);
}
function getAttributeGeneral(jsonObject: any, attributeLevels: string[]) {
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



export {getAttributeGeneral, getElementAttributeGeneral}