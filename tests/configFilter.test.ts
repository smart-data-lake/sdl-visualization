/**
 * The search of the config explorer (ConfigDataLists.apply*Filter, see ConfigExplorer.applyFilter).
 *
 * Searching is case insensitive in all three modes - for the searched value and, where the search
 * names a property, for the property name too, so that a search does not have to know how the
 * configuration spells it.
 */
import { expect, test } from 'vitest';
import { ConfigData, InitialConfigDataLists } from '../src/util/ConfigExplorer/ConfigData.ts';

const configData = {
  dataObjects: {
    'int-airports': { type: 'DeltaLakeTableDataObject', metadata: { layer: 'Integration' } },
    'ext-Departures': { type: 'WebserviceFileDataObject', connectionId: 'sfConn' },
    'btl-distances': { type: 'DeltaLakeTableDataObject', metadata: { layer: 'businessTransformed' } },
  },
  actions: {
    'download-departures': { type: 'FileTransferAction', metadata: { feed: 'Download' }, inputId: 'ext-Departures', outputId: 'int-airports' },
    'compute-distances': { type: 'CopyAction', metadata: { feed: 'compute' }, inputIds: ['int-airports'], outputIds: ['btl-distances'] },
  },
  connections: { sfConn: { type: 'SnowflakeTableConnection' } },
  global: {},
} as unknown as ConfigData;

const lists = () => new InitialConfigDataLists(configData);

test('the id search ignores the case of the search text and of the id', () => {
  expect(lists().applyContainsFilter('id', 'airports').dataObjects.map(o => o.id)).toEqual(['int-airports']);
  expect(lists().applyContainsFilter('id', 'AIRPORTS').dataObjects.map(o => o.id)).toEqual(['int-airports']);
  // the id itself is spelled with a capital letter
  expect(lists().applyContainsFilter('id', 'departures').dataObjects.map(o => o.id)).toEqual(['ext-Departures']);
});

test('the property search ignores the case of the searched value', () => {
  expect(lists().applyRegexFilter('type', 'DeltaLakeTableDataObject').dataObjects.map(o => o.id))
    .toEqual(['btl-distances', 'int-airports']);
  expect(lists().applyRegexFilter('type', 'deltalaketabledataobject').dataObjects.map(o => o.id))
    .toEqual(['btl-distances', 'int-airports']);
  // nested properties, and a regular expression rather than a plain substring
  expect(lists().applyRegexFilter('metadata.layer', 'INTEGRATION|business').dataObjects.map(o => o.id))
    .toEqual(['btl-distances', 'int-airports']);
});

test('the property search ignores the case of the property name', () => {
  expect(lists().applyRegexFilter('Type', 'DeltaLake').dataObjects.map(o => o.id))
    .toEqual(['btl-distances', 'int-airports']);
  expect(lists().applyRegexFilter('MetaData.Layer', 'integration').dataObjects.map(o => o.id))
    .toEqual(['int-airports']);
  // a property no element has still matches nothing
  expect(lists().applyRegexFilter('nosuchproperty', 'DeltaLake').dataObjects).toEqual([]);
});

test('the feed search ignores the case of the feed name', () => {
  // the feed of download-departures is spelled "Download"
  const selected = lists().applyFeedFilter('download');

  expect(selected.actions.map(a => a.id)).toEqual(['download-departures']);
  // the data objects of the selected actions come along, and their connections
  expect(selected.dataObjects.map(o => o.id).sort()).toEqual(['ext-Departures', 'int-airports']);
  expect(selected.connections.map(c => c.id)).toEqual(['sfConn']);
});
