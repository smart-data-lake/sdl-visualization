/**
 * The ?column= deep link a search hit on a schema column navigates to (SchemaTab).
 *
 * Only the two pure helpers are covered here: they decide which rows have to be open and
 * which one is marked, which is the part that can be wrong without anything rendering.
 */
import { expect, test } from 'vitest';
import { ancestorRowIds, rowIdOfColumn } from '../src/components/ConfigExplorer/SchemaTab.tsx';

// the shape numberSchemaTree produces: a flat list carrying id, parentId and the dotted path
const rows = [
  { id: 1, parentId: undefined, path: 'ident' },
  { id: 2, parentId: undefined, path: 'addr' },
  { id: 3, parentId: 2, path: 'addr.city' },
  { id: 4, parentId: 2, path: 'addr.geo' },
  { id: 5, parentId: 4, path: 'addr.geo.lat' },
  { id: 6, parentId: undefined, path: 'legs' },
  { id: 7, parentId: 6, path: 'legs.[]' },
  { id: 8, parentId: undefined, path: 'props' },
  { id: 9, parentId: 8, path: 'props.key' },
];

test('a top level column needs nothing opened', () => {
  expect(ancestorRowIds(rows, 'ident')).toEqual([]);
  expect(rowIdOfColumn(rows, 'ident')).toBe(1);
});

test('a nested column opens every ancestor, innermost first', () => {
  expect(ancestorRowIds(rows, 'addr.geo.lat')).toEqual([4, 2]);
  expect(rowIdOfColumn(rows, 'addr.geo.lat')).toBe(5);
});

test('array and map children resolve like any other row', () => {
  expect(ancestorRowIds(rows, 'legs.[]')).toEqual([6]);
  expect(ancestorRowIds(rows, 'props.key')).toEqual([8]);
});

test('the path is matched ignoring case, as the exported schema may spell it differently', () => {
  expect(rowIdOfColumn(rows, 'ADDR.City')).toBe(3);
  expect(ancestorRowIds(rows, 'ADDR.City')).toEqual([2]);
});

test('a column the schema does not have leaves the tab usable, just unmarked', () => {
  expect(rowIdOfColumn(rows, 'gone')).toBeUndefined();
  expect(ancestorRowIds(rows, 'gone')).toEqual([]);
});

test('no column and no rows are both ordinary cases, not errors', () => {
  expect(ancestorRowIds(rows, undefined)).toEqual([]);
  expect(rowIdOfColumn(undefined, 'ident')).toBeUndefined();
  expect(ancestorRowIds(undefined, 'ident')).toEqual([]);
});
