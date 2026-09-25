import { describe, expect, test } from 'vitest';
import { schemaViewerUrl } from '../src/util/ConfigExplorer/schemaViewer';

describe('schema viewer link', () => {
  test('links a type by its section and simple name', () => {
    expect(schemaViewerUrl('actions', 'CopyAction')).toBe('https://smartdatalake.ch/json-schema-viewer?path=actions/CopyAction');
    expect(schemaViewerUrl('dataObjects', 'DeltaLakeTableDataObject')).toBe('https://smartdatalake.ch/json-schema-viewer?path=dataObjects/DeltaLakeTableDataObject');
  });

  test('a fully qualified SDLB type is linked by its simple name', () => {
    expect(schemaViewerUrl('dataObjects', 'io.smartdatalake.workflow.dataobject.CsvFileDataObject'))
      .toBe('https://smartdatalake.ch/json-schema-viewer?path=dataObjects/CsvFileDataObject');
  });

  test('a custom class and a missing type get no link', () => {
    expect(schemaViewerUrl('dataObjects', 'com.sample.CustomWebserviceDataObject')).toBeUndefined();
    expect(schemaViewerUrl('actions', undefined)).toBeUndefined();
    expect(schemaViewerUrl('actions', '')).toBeUndefined();
  });
});
