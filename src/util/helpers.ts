import { AnyRecord } from "dns";

/**
 * Function to transform a value by a function if it is defined, and otherwise returns a default value.
 */
export function transformOrDefault<In,Out>(input: In, f: (In) => Out, defaultVal: Out) {
    return (input ? f(input) : defaultVal);
}

export function withDefault<Type>(input: Type, defaultVal: Type) {
    return (input ? input : defaultVal);
}


/**
 * Format javascript object as Hocon configuration string
 */
export function hoconify(obj: any, level: number = 0, addStartIndent: boolean = true): string {
  const startIndent = (addStartIndent ?  getIndent(level) : '');
  const endIndent = getIndent(level);
  if (typeof obj == 'object' && Array.isArray(obj)) {
    return startIndent + '[\n' + obj.map(e => hoconify(e, level+1)).join('\n') + '\n' + endIndent + ']';
  } else if (typeof obj == 'object') {
    return startIndent + '{\n' + hoconifyObjectEntries(obj, level+1) + '\n' + endIndent + '}';
  } else if (typeof obj == 'string' && obj.match('^[a-zA-Z0-9-_]*$')) { // identifier need not quotes
    return startIndent + obj; 
  } else if (typeof obj == 'string' && obj.includes('\n')) { // reformat multiline string
    const lines = obj.split('\n').filter(l => l.trim().length>0);
    const existingIndent = lines[0].match(/^\s*/);
    const childIndent = (existingIndent ? getIndent(level+1).substring(existingIndent[0].length) : getIndent(level+1));
    return startIndent + '"""\n' + lines.map(l => childIndent + l).join('\n') + '\n' + endIndent + '"""';
  } else {
    return startIndent + JSON.stringify(obj, null, 2);
  }
}
function getIndent(level: number) { return ' '.repeat(level*2); }
function hoconifyObjectEntries(obj: object, level: number) {
  const indent = getIndent(level);
  return Object.entries(obj).map(e => indent + e[0] + ": " + hoconify(e[1], level, false)).join('\n');
}

/**
 * Access property by path, e.g "a.b.c", also supports array indexes, e.g. "a[0].b.c"
 * see also https://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-and-arrays-by-string-path
 */
export function getPropertyByPath(object: any, path: string) {
  return path
   .split(/[\.\[\]\'\"]/)
   .filter(p => p)
   .reduce((o, p) => o ? o[p] : undefined, object);
}
