/**
 * Ported from src/util/helpers.ts of the frontend. Kept byte-compatible in behaviour so
 * that a server-side search answers exactly what the config explorer's search answers.
 */

/** Access a property by path, e.g. "a.b.c", also supporting array indexes, e.g. "a[0].b.c". */
export function getPropertyByPath(object: any, path: string): any {
  return path
    .split(/[.[\]'"]/)
    .filter((k) => k)
    .reduce((o: any, k: string) => (o ? o[k] : undefined), object);
}

/**
 * getPropertyByPath, but property names are matched ignoring case, so a search does not
 * have to know how a property is spelled in the configuration.
 */
export function getPropertyByPathIgnoreCase(object: any, path: string): any {
  return path
    .split(/[.[\]'"]/)
    .filter((k) => k)
    .reduce((o: any, k: string) => {
      if (!o || typeof o !== 'object') return undefined;
      const key = Object.keys(o).find((name) => name.toLowerCase() === k.toLowerCase());
      return key === undefined ? undefined : o[key];
    }, object);
}

export function onlyUnique<T>(value: T, index: number, array: T[]): boolean {
  return array.indexOf(value) === index;
}

/** Every leaf value of an object graph, as lowercased strings. Used to build a search blob. */
export function leafValues(value: unknown, into: string[] = []): string[] {
  if (value === null || value === undefined) return into;
  if (Array.isArray(value)) {
    value.forEach((v) => leafValues(v, into));
  } else if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((v) => leafValues(v, into));
  } else {
    into.push(String(value).toLowerCase());
  }
  return into;
}
