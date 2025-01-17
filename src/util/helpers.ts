import { Theme } from "@mui/joy";

/**
 * Function to transform a value by a function if it is defined, and otherwise returns a default value.
 */
export function transformOrDefault<In, Out>(input: In, f: (In) => Out, defaultVal: Out) {
  return (input ? f(input) : defaultVal);
}

export function withDefault<Type>(input: Type, defaultVal: Type) {
  return (input ? input : defaultVal);
}


/**
 * Format javascript object as Hocon configuration string
 */
export function hoconify(obj: any, level: number = 0, addStartIndent: boolean = true, propertiesToIgnore: (string) => boolean = () => false): string {
  const startIndent = (addStartIndent ? getIndent(level) : '');
  const endIndent = getIndent(level);
  if (obj == null) {
    return startIndent + 'null';
  } else if (isArray(obj)) {
    return startIndent + '[\n' + obj.map(e => hoconify(e, level + 1, true, propertiesToIgnore)).join('\n') + '\n' + endIndent + ']';
  } else if (typeof obj == 'object') {
    return startIndent + '{\n' + hoconifyObjectEntries(obj, level + 1, propertiesToIgnore) + '\n' + endIndent + '}';
  } else if (typeof obj == 'string' && obj.match('^[a-zA-Z0-9-_]*$')) { // identifier need not quotes
    return startIndent + obj;
  } else if (typeof obj == 'string' && obj.includes('\n')) { // reformat multiline string
    const lines = obj.split('\n').filter(l => l.trim().length > 0);
    const existingIndent = lines[0].match(/^\s*/);
    const childIndent = (existingIndent ? getIndent(level + 1).substring(existingIndent[0].length) : getIndent(level + 1));
    return startIndent + '"""\n' + lines.map(l => childIndent + l).join('\n') + '\n' + endIndent + '"""';
  } else {
    return startIndent + JSON.stringify(obj, null, 2);
  }
}
function getIndent(level: number) { return ' '.repeat(level * 2); }
function hoconifyObjectEntries(obj: object, level: number, propertiesToIgnore: (string) => boolean = () => false) {
  const indent = getIndent(level);
  return Object.entries(obj).map(e => {
    if (!propertiesToIgnore(e[0])) return indent + e[0] + ": " + hoconify(e[1], level, false, propertiesToIgnore);
    else return undefined;
  }).filter(e => e).join('\n');
}

/**
 * Access property by path, e.g "a.b.c", also supports array indexes, e.g. "a[0].b.c"
 * see also https://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-and-arrays-by-string-path
 */
export function getPropertyByPath(object: any, path: string) {
  return path
    .split(/[.[\]'"]/)
    .filter(k => k)
    .reduce((o, k) => o ? o[k] : undefined, object);
}

/**
 * Filter function to make array unique
 * usage: arr.filter(onlyUnique);
 */
export function onlyUnique(value, index, array) {
  return array.indexOf(value) === index;
}

/**
 * Create function to compare attribute of two objects.
 * This can be used for sorting arrays.
 * usage: arr.sort(compareFunc("x"))
 */
export function compareFunc(attr: any, reverse: boolean = false) {
  return (a, b) => {
    if (a[attr] === b[attr]) return 0;
    else return (a[attr] > b[attr] || a[attr] === undefined ? 1 : -1) * (reverse ? -1 : 1);
  }
}

/**
 * Create function to compare attributes of two objects.
 * This can be used for sorting arrays with multiple sort attributes.
 * usage: arr.sort(compareFunc(["x","y"]))
 */
export function compareMultiFunc(attrs: any[]) {
  function compare(a: any, b: any, attrIdx: number) {
    const aVal = getPropertyByPath(a, attrs[attrIdx]);
    const bVal = getPropertyByPath(b, attrs[attrIdx]);
    if (aVal === bVal) {
      if (attrIdx === attrs.length - 1) return 0; // final attr to compare?
      else return compare(a, b, attrIdx + 1); // otherwise continue with next attr
    } else return aVal > bVal || aVal === undefined ? 1 : -1;
  }
  return (a, b) => compare(a, b, 0);
}

/**
 * Dynamically remove an attribute from an object
 * without changing the original object (deep clone)
 */
export function removeAttr(obj: object, attrs: string[]): object {
  let objClone = { ...obj }; // deep clone to avoid mutation of the original data
  attrs.forEach(a => delete objClone[a]);
  return objClone;
}

/**
 * Format number of bytes human friendly
 */
export function formatFileSize(size: number) {
  var i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
* Camel case to title case, e.g. helloWorld -> Hello World
*/
export function camelToTitleCase(str: string) {
  if (str.length == 0) return str;
  var str1 = str.replace(/([A-Z])/g, (match) => ` ${match}`);
  return str1.charAt(0).toUpperCase() + str1.slice(1);
}

/**
 * Check if value is a number
 */
export function isNumber(value) {
  return typeof value === 'number';
}

/**
 * Check if value is an array
 */
export function isArray(value) {
  return typeof value == 'object' && Array.isArray(value);
}


/**
 * check if value is an array of type T
 */
export function isArrayOfT<T>(arr: any[], isType: (obj: any) => boolean): boolean {
  return Array.isArray(arr) && arr.every(isType);
}


/**
* Remove elements from array that have the same specified attributes.
* 
* @param {T} arr - The array we want to filter
* @param {string[] | undefined} attr - An array of attributes we want to filter on. If undefined, this function returns the unmodified input array.
* 
* @returns {T} The filtered array
*/
export function removeDuplicatesFromObjArrayOnAttributes<T>(arr: T[], attr: string[] | undefined) {
  if (attr !== undefined) {
    if (attr!.length === 0) {
      return [...new Map(arr.map(v => [JSON.stringify(v), v])).values()];
    } else {
      return arr.filter((v, i, a) => a.findIndex(v2 => attr.every(k => v2[k] === v[k])) === i)
    }
  } else {
    return arr;
  }
}

export function findFirstKeyWithObject(map: Map<string, Object[]>, targetObject: Object, F?: (arg: Object[]) => Object[]): string | undefined {
  for (var [key, valueArray] of map) {
    if (F !== undefined) {
      valueArray = F(valueArray);
    }
    if (valueArray.some(obj => obj === targetObject)) {
      return key;
    }
  }
  return undefined;
}

export function deepClone<T>(source: T): T {
  // Check if the source is null or not an object
  if (source === null || typeof source !== 'object') {
      return source;
  }

  // Handle array case
  if (Array.isArray(source)) {
      const clonedArray = [] as T[];
      for (const item of source) {
          clonedArray.push(deepClone(item));
      }
      return clonedArray as unknown as T;
  }

  // Handle object case (including class instances)
  const clonedObject = Object.create(Object.getPrototypeOf(source));
  for (const key in source) {
      if (source.hasOwnProperty(key)) {
          clonedObject[key] = deepClone(source[key]);
      }
  }
  return clonedObject;
}

export function setAttributeFromPath ( entity, path, value) {
  const pathParts = path.split('.');
  let obj = entity;
  console.log(entity, path, value, pathParts)
  
  pathParts.forEach((part, index) => {
    if (obj[part]) {
      if (index < pathParts.length - 1) {
        obj = obj[part];
      } else {
        obj[part] = value;
      }
    }
  });
};

export function dateFromNumber( ts: number ) {
  // convert number to date handling seconds or milliseconds format.
  return new Date((ts<9000000000 ? ts*1000 : ts))
}

export function sortIfArray<TInput>(v: TInput) {
  if (Array.isArray(v)) return (v as []).sort() as TInput;
  else v;
}