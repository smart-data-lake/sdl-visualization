/**
 * The documents the global search indexes (src/util/ConfigExplorer/searchDocuments.ts).
 *
 * This module is mirrored by backend/src/domain/search.ts, so these cases double as the
 * description of the contract the parity test (backend/test/unit/parity.test.ts) holds both
 * sides to. Importing it here also proves it stays free of React, DOM and MiniSearch.
 */
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  columnDocuments, descriptionDocument, elementDocuments, flattenColumns, routeOf, snippetOf,
  LIMITS, SEARCH_INDEX_OPTIONS, SEARCH_SCHEMA_VERSION,
} from '../src/util/ConfigExplorer/searchDocuments.ts';

const config = JSON.parse(readFileSync('tests/e2e/fixtures/exported/exportedConfig.json', 'utf8'));
const schema = JSON.parse(readFileSync('tests/e2e/fixtures/shared/schema/btl-distances.schema.1702279427.json', 'utf8'));
const failedSchema = JSON.parse(readFileSync('tests/e2e/fixtures/shared/schema/btl-distances.schema.1710144919.json', 'utf8'));

const byId = (docs: any[], docId: string) => docs.find(d => d.docId === docId);

test('every dataObject, action and connection becomes one document, keyed by its element type', () => {
  const docs = elementDocuments(config);
  expect(docs.length).toBe(Object.keys(config.dataObjects).length + Object.keys(config.actions).length);
  expect(docs.every(d => d.kind === 'element')).toBe(true);
  // ids are unique per element type only, so the element type is part of the key
  expect(byId(docs, 'e:dataObjects:int-airports')).toBeDefined();
  expect(byId(docs, 'e:actions:join-departures-airports')).toBeDefined();
  expect(new Set(docs.map(d => d.docId)).size).toBe(docs.length);
});

test('the metadata a user searches by lands in its own field, with tags flattened to text', () => {
  const doc = byId(elementDocuments(config), 'e:dataObjects:int-airports')!;
  expect(doc.name).toBe('Airport locations');
  expect(doc.type).toBe('DeltaLakeTableDataObject');
  expect(doc.layer).toBe('integration');
  expect(doc.subjectArea).toBe('airports');
  expect(doc.description).toBe('airport names and locations');
  expect(doc.tags).toBe('aviation airport location');
  expect(doc.elementType).toBe('dataObjects');
});

test('an action keeps its feed, and its transformer SQL is searchable through the body', () => {
  const doc = byId(elementDocuments(config), 'e:actions:join-departures-airports')!;
  expect(doc.feed).toBe('compute');
  expect(doc.body).toContain('int_departures join int_airports');
});

test('the scaladoc of a DataObject type reaches the body', () => {
  const doc = byId(elementDocuments(config), 'e:dataObjects:ext-departures')!;
  expect(doc.body).toContain(config.dataObjects['ext-departures']._sourceDoc.toLowerCase().slice(0, 30));
});

test('the table name reaches the body, so a search can find a DataObject by it', () => {
  const doc = byId(elementDocuments(config), 'e:dataObjects:btl-distances')!;
  expect(doc.body).toContain('btl_distances');
});

test('_origin becomes the source link and never body text, and column descriptions stay out of it', () => {
  const doc = byId(elementDocuments(config), 'e:dataObjects:btl-distances')!;
  expect(doc.source).toBe('btl.conf:20');
  expect(doc.body).not.toContain('btl.conf');
  // _columnDescriptions become column documents of their own
  expect(doc.body).not.toContain('less than 500km');
});

test('the body is capped, so one huge element cannot dominate the index', () => {
  const huge = { dataObjects: { big: { type: 'X', options: { blob: 'lorem '.repeat(5000) } } } };
  expect(elementDocuments(huge)[0].body!.length).toBe(LIMITS.bodyChars);
});

test('a description file becomes a document keyed by its filename, with the H1 as its name', () => {
  const markdown = readFileSync('tests/e2e/fixtures/shared/description/dataObjects/btl-distances.md', 'utf8');
  const doc = descriptionDocument('dataObjects/btl-distances.md', markdown)!;
  expect(doc.docId).toBe('d:dataObjects/btl-distances.md');
  expect(doc.kind).toBe('description');
  expect(doc.elementType).toBe('dataObjects');
  expect(doc.elementId).toBe('btl-distances');
  expect(doc.name).toBe('Table with computed distances');
  expect(doc.body).toContain('@column');
});

test('an empty description file yields no document', () => {
  expect(descriptionDocument('dataObjects/x.md', '   \n ')).toBeUndefined();
});

test('a column document per schema column, with the configured description merged in', () => {
  const docs = columnDocuments('btl-distances', config.dataObjects['btl-distances'], schema, 1702279427);
  expect(docs.length).toBe(schema.schema.length);
  const distance = byId(docs, 'c:btl-distances:distance')!;
  expect(distance.kind).toBe('column');
  expect(distance.name).toBe('distance');
  expect(distance.type).toBe('double');
  expect(distance.description).toContain('computed distance between the departure and arrival airports');
  expect(distance.elementType).toBe('dataObjects');
  expect(distance.elementId).toBe('btl-distances');
  expect(distance.columnPath).toBe('distance');
  expect(distance.tstamp).toBe(1702279427);
});

test('column descriptions are matched ignoring case, as ColumnModel does', () => {
  const configObj = { _columnDescriptions: { Distance: 'described once' } };
  const docs = columnDocuments('d1', configObj, { schema: [{ name: 'DISTANCE', dataType: 'double' }] } as any);
  expect(docs[0].docId).toBe('c:d1:distance');
  expect(docs[0].description).toBe('described once');
});

test('a failed schema export carries only info and is never indexed', () => {
  expect(failedSchema.info).toBeDefined();
  expect(columnDocuments('btl-distances', config.dataObjects['btl-distances'], failedSchema)).toEqual([]);
  expect(columnDocuments('x', {}, undefined)).toEqual([]);
});

test('nested columns flatten to the dotted paths the schema table uses', () => {
  const columns = [
    { name: 'addr', dataType: { dataType: 'struct', fields: [{ name: 'city', dataType: 'string' }] } },
    { name: 'legs', dataType: { dataType: 'array', elementType: 'string' } },
    { name: 'props', dataType: { dataType: 'map', keyType: 'string', valueType: 'int' } },
  ] as any;
  expect(flattenColumns(columns).map(c => c.path))
    .toEqual(['addr', 'addr.city', 'legs', 'legs.[]', 'props', 'props.key', 'props.value']);
});

test('flattening stops at the depth limit rather than following a recursive schema', () => {
  const deep = (n: number): any => (n === 0 ? 'string' : { dataType: 'struct', fields: [{ name: `l${n}`, dataType: deep(n - 1) }] });
  const paths = flattenColumns([{ name: 'root', dataType: deep(10) }] as any, 3).map(c => c.path);
  expect(paths.every(p => p.split('.').length <= 3)).toBe(true);
});

test('the schema comment is kept alongside the configured description', () => {
  const docs = columnDocuments('d1', { _columnDescriptions: { c: 'from config' } },
    { schema: [{ name: 'c', dataType: 'string', comment: 'from schema' }] } as any);
  expect(docs[0].description).toBe('from config\nfrom schema');
});

test('each kind routes to the tab that shows it', () => {
  const docs = elementDocuments(config);
  expect(routeOf(byId(docs, 'e:dataObjects:int-airports')!)).toBe('dataObjects/int-airports/configuration');
  expect(routeOf(descriptionDocument('dataObjects/int-airports.md', '# Airports\n\ntext')!))
    .toBe('dataObjects/int-airports/description');
  expect(routeOf(columnDocuments('btl-distances', {}, schema)[0])).toBe('dataObjects/btl-distances/schema');
});

test('a snippet is plain text, cut on a word boundary', () => {
  expect(snippetOf('# Heading\n\nSome **bold** text with a [link](http://x)')).toBe('Heading Some bold text with a link');
  expect(snippetOf('word '.repeat(200))!.length).toBeLessThanOrEqual(LIMITS.snippetChars + 1);
  expect(snippetOf(undefined)).toBeUndefined();
});

test('kind is stored, because the per-kind boost reads it back at query time', () => {
  expect(SEARCH_INDEX_OPTIONS.storeFields).toContain('kind');
  expect(SEARCH_INDEX_OPTIONS.idField).toBe('docId');
  expect(SEARCH_SCHEMA_VERSION).toBeTypeOf('number');
});
